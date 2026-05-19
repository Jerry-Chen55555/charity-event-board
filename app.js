const express = require('express');
const path = require('path');
const db = require('./db/db_connection');

const app = express();
const PORT = process.env.PORT || 3000;

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Redirect root to search
app.get('/', (req, res) => {
    res.redirect('/search');
});

// Search page – shows all events with optional filters
app.get('/search', (req, res) => {
    const searchQuery = req.query.search || '';
    const dateFilter = req.query.date_filter || '';
    const organizerFilter = req.query.organizer || '';

    // Build WHERE conditions and parameters
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

    if (organizerFilter) {
        conditions.push('e.organizer_id = ?');
        params.push(organizerFilter);
    }

    const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

    // Main query to get events with organizer name and volunteer count
    const eventsQuery = `
        SELECT
            e.event_id,
            e.title,
            e.description,
            e.date,
            e.schedule,
            e.post_date,
            e.organizer_id,
            ST_AsText(e.location) AS location_text,
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

        // Get all organizers for the filter dropdown
        db.execute('SELECT user_id, username FROM user ORDER BY username', (err2, organizers) => {
            if (err2) {
                console.error('Error fetching organizers:', err2);
                organizers = [];
            }

            res.render('search', {
                events,
                organizers: organizers || [],
                searchQuery,
                dateFilter,
                organizerFilter
            });
        });
    });
});

// Single event detail page
app.get('/events/:id', (req, res) => {
    const eventId = req.params.id;

    const eventQuery = `
        SELECT
            e.*,
            ST_AsText(e.location) AS location_text,
            u.username AS organizer_name,
            u.first_name AS organizer_first,
            u.last_name AS organizer_last,
            u.bio AS organizer_bio
        FROM event e
        LEFT JOIN user u ON e.organizer_id = u.user_id
        WHERE e.event_id = ?
    `;

    db.execute(eventQuery, [eventId], (err, eventResult) => {
        if (err || eventResult.length === 0) {
            return res.status(404).send('Event not found');
        }

        const event = eventResult[0];

        // Get attendees
        const volunteerQuery = `
            SELECT u.user_id, u.username, u.first_name, u.last_name
            FROM event_user eu
            JOIN user u ON eu.user_id = u.user_id
            WHERE eu.event_id = ?
        `;

        db.execute(volunteerQuery, [eventId], (err2, volunteers) => {
            if (err2) volunteers = [];
            res.render('event-detail', { event, volunteers });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});