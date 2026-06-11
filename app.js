const express = require('express');
require('dotenv').config();
const path = require('path');
const db = require('./db/db_connection');
const { auth, requiresAuth } = require('express-openid-connect');

const app = express();
const PORT = process.env.PORT || 3000;

function dbExecute(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.execute(sql, params, (err, results) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(results);
        });
    });
}

function cleanString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function splitDisplayName(name) {
    const parts = cleanString(name) ? name.trim().split(/\s+/) : [];
    return {
        firstName: parts[0] || null,
        lastName: parts.slice(1).join(' ') || null
    };
}

function getAuthUserDefaults(authUser) {
    const nameParts = splitDisplayName(authUser && authUser.name);
    const email = cleanString(authUser && authUser.email);
    const usernameSource =
        cleanString(authUser && authUser.nickname) ||
        (email ? email.split('@')[0] : null) ||
        cleanString(authUser && authUser.name) ||
        `user_${String(authUser && authUser.sub ? authUser.sub : Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(-10)}`;

    return {
        auth0_sub: cleanString(authUser && authUser.sub),
        email,
        first_name: cleanString(authUser && authUser.given_name) || nameParts.firstName || 'Volunteer',
        last_name: cleanString(authUser && authUser.family_name) || nameParts.lastName,
        username: usernameSource.toLowerCase().replace(/\s+/g, '.').slice(0, 100)
    };
}

function getLocalUserName(userRecord) {
    if (!userRecord) return 'Volunteer';
    const fullName = [userRecord.first_name, userRecord.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
    return fullName || userRecord.username || 'Volunteer';
}

function getHeaderDisplayName(authUser, localUser = null) {
    if (localUser) return getLocalUserName(localUser);
    if (!authUser) return null;
    const defaults = getAuthUserDefaults(authUser);
    return cleanString(authUser.name) || defaults.username || 'Volunteer';
}

function getQueryMessage(query) {
    if (query.success === 'profile') {
        return { type: 'success', text: 'Profile updated.' };
    }
    if (query.success === 'event-created') {
        return { type: 'success', text: 'Event created.' };
    }
    if (query.joined === '1') {
        return { type: 'success', text: 'You are signed up for this event.' };
    }
    if (query.already === '1') {
        return { type: 'info', text: 'You were already signed up for this event.' };
    }
    if (query.error) {
        return { type: 'danger', text: query.error };
    }
    return null;
}

let userSchemaPromise = null;

async function hasUserColumn(columnName) {
    if (!['auth0_sub', 'email'].includes(columnName)) {
        throw new Error('Unexpected user column check');
    }
    const rows = await dbExecute(`SHOW COLUMNS FROM user LIKE '${columnName}'`);
    return rows.length > 0;
}

async function ensureUserAuthColumns() {
    if (!userSchemaPromise) {
        userSchemaPromise = (async () => {
            const schema = {
                hasAuth0Sub: false,
                hasEmail: false
            };
            try {
                if (!(await hasUserColumn('auth0_sub'))) {
                    await dbExecute('ALTER TABLE user ADD COLUMN auth0_sub varchar(255) DEFAULT NULL');
                }
                schema.hasAuth0Sub = await hasUserColumn('auth0_sub');
            } catch (err) {
                console.warn('Could not add auth0_sub column:', err.message);
            }
            try {
                if (!(await hasUserColumn('email'))) {
                    await dbExecute('ALTER TABLE user ADD COLUMN email varchar(255) DEFAULT NULL');
                }
                schema.hasEmail = await hasUserColumn('email');
            } catch (err) {
                console.warn('Could not add email column:', err.message);
            }
            return schema;
        })();
    }
    return userSchemaPromise;
}

async function getOrCreateLocalUser(authUser) {
    const defaults = getAuthUserDefaults(authUser);
    const schema = await ensureUserAuthColumns();
    let users = [];

    if (schema.hasAuth0Sub && defaults.auth0_sub) {
        users = await dbExecute('SELECT * FROM user WHERE auth0_sub = ? LIMIT 1', [defaults.auth0_sub]);
    }
    if (users.length === 0 && schema.hasEmail && defaults.email) {
        users = await dbExecute('SELECT * FROM user WHERE email = ? LIMIT 1', [defaults.email]);
    }
    if (users.length === 0 && defaults.username) {
        users = await dbExecute('SELECT * FROM user WHERE username = ? LIMIT 1', [defaults.username]);
    }

    if (users.length > 0) {
        const localUser = users[0];
        const updates = [];
        const params = [];
        if (schema.hasAuth0Sub && defaults.auth0_sub && !localUser.auth0_sub) {
            updates.push('auth0_sub = ?');
            params.push(defaults.auth0_sub);
        }
        if (schema.hasEmail && defaults.email && !localUser.email) {
            updates.push('email = ?');
            params.push(defaults.email);
        }
        if (updates.length > 0) {
            params.push(localUser.user_id);
            await dbExecute(`UPDATE user SET ${updates.join(', ')} WHERE user_id = ?`, params);
            const refreshed = await dbExecute('SELECT * FROM user WHERE user_id = ? LIMIT 1', [localUser.user_id]);
            return refreshed[0];
        }
        return localUser;
    }

    const columns = ['first_name', 'last_name', 'username', 'bio', 'phone_nbr', 'create_date'];
    const values = [defaults.first_name, defaults.last_name, defaults.username, null, null, new Date()];
    if (schema.hasAuth0Sub) {
        columns.push('auth0_sub');
        values.push(defaults.auth0_sub);
    }
    if (schema.hasEmail) {
        columns.push('email');
        values.push(defaults.email);
    }
    const placeholders = columns.map(() => '?').join(', ');
    const result = await dbExecute(
        `INSERT INTO user (${columns.join(', ')}) VALUES (${placeholders})`,
        values
    );
    const newUsers = await dbExecute('SELECT * FROM user WHERE user_id = ? LIMIT 1', [result.insertId]);
    return newUsers[0];
}

function toMysqlDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (number) => String(number).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join('-') + ' ' + [
        pad(date.getHours()),
        pad(date.getMinutes()),
        '00'
    ].join(':');
}

async function getCreatedEvents(userId) {
    return dbExecute(`
        SELECT
            e.event_id,
            e.title,
            e.description,
            e.date,
            e.post_date,
            (
                SELECT COUNT(*)
                FROM event_user eu
                WHERE eu.event_id = e.event_id
            ) AS volunteer_count
        FROM event e
        WHERE e.organizer_id = ?
        ORDER BY e.date DESC
    `, [userId]);
}

async function getVolunteeringEvents(userId) {
    return dbExecute(`
        SELECT
            e.event_id,
            e.title,
            e.description,
            e.date,
            e.post_date,
            u.username AS organizer_name,
            u.first_name AS organizer_first,
            u.last_name AS organizer_last,
            (
                SELECT COUNT(*)
                FROM event_user all_volunteers
                WHERE all_volunteers.event_id = e.event_id
            ) AS volunteer_count
        FROM event_user eu
        JOIN event e ON eu.event_id = e.event_id
        LEFT JOIN user u ON e.organizer_id = u.user_id
        WHERE eu.user_id = ?
        ORDER BY e.date DESC
    `, [userId]);
}

// Auth0 configuration
const authConfig = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET || 'change_this_secret',
    baseURL: process.env.AUTH0_BASE_URL || `http://localhost:3000`,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
};

app.use(auth(authConfig));

// Make authentication status available to all views
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.oidc && req.oidc.isAuthenticated && req.oidc.isAuthenticated();
    res.locals.user = req.oidc && req.oidc.user ? req.oidc.user : null;
    res.locals.displayName = getHeaderDisplayName(res.locals.user);
    next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Home page
app.get('/', requiresAuth(), (req, res) => {
    res.render('index');
});

// User profile
app.get('/user', requiresAuth(), async (req, res) => {
    try {
        const localUser = await getOrCreateLocalUser(req.oidc.user);
        const createdEvents = await getCreatedEvents(localUser.user_id);
        const volunteeringEvents = await getVolunteeringEvents(localUser.user_id);
        res.locals.displayName = getHeaderDisplayName(req.oidc.user, localUser);
        res.render('user', {
            localUser,
            createdEvents,
            volunteeringEvents,
            message: getQueryMessage(req.query)
        });
    } catch (err) {
        console.error('Error loading user page:', err);
        res.status(500).send('Error loading profile');
    }
});

app.post('/user', requiresAuth(), async (req, res) => {
    try {
        const localUser = await getOrCreateLocalUser(req.oidc.user);
        const username = cleanString(req.body.username);
        if (!username) {
            return res.redirect('/user?error=Username%20is%20required');
        }
        await dbExecute(`
            UPDATE user
            SET first_name = ?, last_name = ?, username = ?, bio = ?, phone_nbr = ?
            WHERE user_id = ?
        `, [
            cleanString(req.body.first_name) || 'Volunteer',
            cleanString(req.body.last_name),
            username,
            cleanString(req.body.bio),
            cleanString(req.body.phone_nbr),
            localUser.user_id
        ]);
        res.redirect('/user?success=profile');
    } catch (err) {
        console.error('Error updating user page:', err);
        res.redirect('/user?error=Could%20not%20update%20profile');
    }
});

// History page
app.get('/history', requiresAuth(), async (req, res) => {
    try {
        const localUser = await getOrCreateLocalUser(req.oidc.user);
        const createdEvents = await getCreatedEvents(localUser.user_id);
        const volunteeringEvents = await getVolunteeringEvents(localUser.user_id);
        res.locals.displayName = getHeaderDisplayName(req.oidc.user, localUser);
        res.render('history', {
            localUser,
            createdEvents,
            volunteeringEvents,
            message: getQueryMessage(req.query)
        });
    } catch (err) {
        console.error('Error loading history page:', err);
        res.status(500).send('Error loading history');
    }
});

// Redirects for old routes
app.get('/create-event', requiresAuth(), (req, res) => {
    res.redirect('/events/new');
});
app.get('/events/create', requiresAuth(), (req, res) => {
    res.redirect('/events/new');
});

// Show create event form
app.get('/events/new', requiresAuth(), async (req, res) => {
    try {
        const localUser = await getOrCreateLocalUser(req.oidc.user);
        res.locals.displayName = getHeaderDisplayName(req.oidc.user, localUser);
        res.render('create-event', {
            localUser,
            formData: {},
            message: getQueryMessage(req.query),
            leaflet: true   // ADDED: enables map on create page
        });
    } catch (err) {
        console.error('Error loading create event page:', err);
        res.status(500).send('Error loading event form');
    }
});

// Create event (POST) - uses latitude/longitude
app.post('/events', requiresAuth(), async (req, res) => {
    const formData = {
        title: cleanString(req.body.title),
        event_date: req.body.event_date || '',
        description: cleanString(req.body.description),
        schedule: cleanString(req.body.schedule),
        latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
        longitude: req.body.longitude ? parseFloat(req.body.longitude) : null
    };

    try {
        const localUser = await getOrCreateLocalUser(req.oidc.user);
        const eventDate = toMysqlDateTime(formData.event_date);
        res.locals.displayName = getHeaderDisplayName(req.oidc.user, localUser);

        if (!formData.title || !eventDate || !formData.description) {
            return res.status(400).render('create-event', {
                localUser,
                formData,
                message: { type: 'danger', text: 'Title, date, and description are required.' },
                leaflet: true
            });
        }

        let latitude = null, longitude = null;
        if (formData.latitude !== null || formData.longitude !== null) {
            if (formData.latitude === null || formData.longitude === null) {
                return res.status(400).render('create-event', {
                    localUser,
                    formData,
                    message: { type: 'danger', text: 'Both latitude and longitude are required if one is provided.' },
                    leaflet: true
                });
            }
            if (isNaN(formData.latitude) || isNaN(formData.longitude) ||
                formData.latitude < -90 || formData.latitude > 90 ||
                formData.longitude < -180 || formData.longitude > 180) {
                return res.status(400).render('create-event', {
                    localUser,
                    formData,
                    message: { type: 'danger', text: 'Latitude must be between -90 and 90, longitude between -180 and 180.' },
                    leaflet: true
                });
            }
            latitude = formData.latitude;
            longitude = formData.longitude;
        }

        const result = await dbExecute(`
            INSERT INTO event
                (date, title, description, schedule, post_date, organizer_id, latitude, longitude)
            VALUES
                (?, ?, ?, ?, NOW(), ?, ?, ?)
        `, [
            eventDate,
            formData.title,
            formData.description,
            formData.schedule,
            localUser.user_id,
            latitude,
            longitude
        ]);

        res.redirect(`/events/${result.insertId}?success=event-created`);
    } catch (err) {
        console.error('Error creating event:', err);
        res.status(500).render('create-event', {
            localUser: null,
            formData,
            message: { type: 'danger', text: 'Could not create event.' },
            leaflet: true
        });
    }
});

// Search page
app.get('/search', (req, res) => {
    const searchQuery = req.query.search || '';
    const dateFilter = req.query.date_filter || '';
    const locationLat = req.query.location_lat || '';
    const locationLng = req.query.location_lng || '';
    const maxDistance = req.query.max_distance || '';

    const conditions = [];
    const params = [];

    if (searchQuery) {
        conditions.push('(e.title LIKE ? OR e.description LIKE ?)');
        params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    if (dateFilter) {
        const now = new Date();
        if (dateFilter === 'upcoming') {
            conditions.push('e.date >= ?');
            params.push(now);
        } else if (dateFilter === 'past') {
            conditions.push('e.date < ?');
            params.push(now);
        } else if (dateFilter === 'this_week') {
            const weekEnd = new Date(now);
            weekEnd.setDate(now.getDate() + 7);
            conditions.push('e.date BETWEEN ? AND ?');
            params.push(now, weekEnd);
        } else if (dateFilter === 'this_month') {
            const monthEnd = new Date(now);
            monthEnd.setMonth(now.getMonth() + 1);
            conditions.push('e.date BETWEEN ? AND ?');
            params.push(now, monthEnd);
        }
    }

    const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

    const eventsQuery = `
        SELECT
            e.event_id,
            e.title,
            e.description,
            e.date,
            e.schedule,
            e.post_date,
            e.organizer_id,
            e.latitude,
            e.longitude,
            u.username AS organizer_name,
            u.first_name AS organizer_first,
            u.last_name AS organizer_last,
            COUNT(eu.user_id) AS volunteer_count
        FROM event e
        LEFT JOIN user u ON e.organizer_id = u.user_id
        LEFT JOIN event_user eu ON e.event_id = eu.event_id
        ${whereClause}
        GROUP BY e.event_id
        ORDER BY e.date ASC
        LIMIT 50
    `;

    db.execute(eventsQuery, params, (err, events) => {
        if (err) {
            console.error('Error fetching events:', err);
            return res.status(500).send('Error loading events');
        }

        const latValue = parseFloat(locationLat);
        const lngValue = parseFloat(locationLng);
        const maxDistanceValue = parseFloat(maxDistance);

        function milesBetween(lat1, lng1, lat2, lng2) {
            if (!Number.isFinite(lat1) || !Number.isFinite(lng1) ||
                !Number.isFinite(lat2) || !Number.isFinite(lng2)) return null;
            const toRadians = degrees => degrees * Math.PI / 180;
            const dLat = toRadians(lat2 - lat1);
            const dLng = toRadians(lng2 - lng1);
            const a = Math.sin(dLat / 2) ** 2
                + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
                * Math.sin(dLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return 3958.8 * c;
        }

        if (Number.isFinite(latValue) && Number.isFinite(lngValue)) {
            events = events
                .map(event => {
                    if (event.latitude === null || event.longitude === null) {
                        return { ...event, distance_miles: null };
                    }
                    const distance = milesBetween(latValue, lngValue, event.latitude, event.longitude);
                    return { ...event, distance_miles: distance };
                })
                .filter(event => {
                    if (event.distance_miles === null) return false;
                    if (Number.isFinite(maxDistanceValue)) {
                        return event.distance_miles <= maxDistanceValue;
                    }
                    return true;
                })
                .sort((a, b) => {
                    if (a.distance_miles == null) return 1;
                    if (b.distance_miles == null) return -1;
                    return a.distance_miles - b.distance_miles;
                });
        } else if (Number.isFinite(maxDistanceValue)) {
            events = events.filter(event => event.latitude !== null && event.longitude !== null);
        }

        res.render('search', {
            events,
            searchQuery,
            dateFilter,
            locationLat,
            locationLng,
            maxDistance,
            leaflet: true
        });
    });
});

// Sign up for an event
app.post('/events/:id/signup', requiresAuth(), async (req, res) => {
    const eventId = req.params.id;
    try {
        const localUser = await getOrCreateLocalUser(req.oidc.user);
        const events = await dbExecute('SELECT event_id, organizer_id FROM event WHERE event_id = ? LIMIT 1', [eventId]);
        if (events.length === 0) {
            return res.status(404).send('Event not found');
        }
        if (events[0].organizer_id === localUser.user_id) {
            return res.redirect(`/events/${eventId}?already=1`);
        }
        const existingSignups = await dbExecute(
            'SELECT event_id FROM event_user WHERE event_id = ? AND user_id = ? LIMIT 1',
            [eventId, localUser.user_id]
        );
        if (existingSignups.length > 0) {
            return res.redirect(`/events/${eventId}?already=1`);
        }
        await dbExecute('INSERT INTO event_user (event_id, user_id) VALUES (?, ?)', [eventId, localUser.user_id]);
        res.redirect(`/events/${eventId}?joined=1`);
    } catch (err) {
        console.error('Error signing up for event:', err);
        res.redirect(`/events/${eventId}?error=Could%20not%20sign%20up%20for%20this%20event`);
    }
});

// Single event detail page
app.get('/events/:id', async (req, res) => {
    const eventId = req.params.id;
    try {
        const eventResult = await dbExecute(`
            SELECT
                e.*,
                u.username AS organizer_name,
                u.first_name AS organizer_first,
                u.last_name AS organizer_last,
                u.bio AS organizer_bio
            FROM event e
            LEFT JOIN user u ON e.organizer_id = u.user_id
            WHERE e.event_id = ?
        `, [eventId]);

        if (eventResult.length === 0) {
            return res.status(404).send('Event not found');
        }

        let event = eventResult[0];
        // Ensure lat/lng are numbers (they come as strings from MySQL)
        event.latitude = parseFloat(event.latitude);
        event.longitude = parseFloat(event.longitude);

        const volunteers = await dbExecute(`
            SELECT u.user_id, u.username, u.first_name, u.last_name
            FROM event_user eu
            JOIN user u ON eu.user_id = u.user_id
            WHERE eu.event_id = ?
            ORDER BY u.first_name, u.last_name, u.username
        `, [eventId]);

        let localUser = null;
        if (res.locals.isAuthenticated) {
            localUser = await getOrCreateLocalUser(req.oidc.user);
            res.locals.displayName = getHeaderDisplayName(req.oidc.user, localUser);
        }

        res.render('event', {
            event,
            volunteers,
            localUser,
            isSignedUp: localUser ? volunteers.some(v => v.user_id === localUser.user_id) : false,
            isOrganizer: localUser ? event.organizer_id === localUser.user_id : false,
            message: getQueryMessage(req.query),
            leaflet: true   // ADDED: enables map on event detail page
        });
    } catch (err) {
        console.error('Error fetching event:', err);
        res.status(500).send('Error loading event');
    }
});

// Return JSON about logged-in user
app.get('/me', requiresAuth(), async (req, res) => {
    const localUser = await getOrCreateLocalUser(req.oidc.user);
    res.json({
        authUser: req.oidc && req.oidc.user ? req.oidc.user : null,
        localUser
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});