const db = require("./db_connection");

/**** Delete *CONTENTS OF* existing tables (but not dropping tables themselves) ****/

const delete_event_user_table_sql = "DELETE FROM event_user;";
db.execute(delete_event_user_table_sql);

const delete_event_table_sql = "DELETE FROM event;";
db.execute(delete_event_table_sql);

const delete_user_table_sql = "DELETE FROM user;";
db.execute(delete_user_table_sql);

/**** Create some sample users ****/

const insert_user_sql = `
    INSERT INTO user 
        (first_name, last_name, username, bio, phone_nbr, create_date) 
    VALUES 
        (?, ?, ?, ?, ?, ?);
`;

db.execute(insert_user_sql, [
    'Alice', 'Chen', 'alicec', 
    'Passionate about community service and volunteering.', 
    '201-555-1234', '2026-05-01'
]);

db.execute(insert_user_sql, [
    'Brian', 'Smith', 'bsmith', 
    'Organizer for local food drives.', 
    '201-555-5678', '2026-05-02'
]);

db.execute(insert_user_sql, [
    'Carla', 'Lopez', 'carla_l', 
    'Loves helping at animal shelters.', 
    '201-555-9012', '2026-05-02'
]);

db.execute(insert_user_sql, [
    'David', 'Kim', 'davidk', 
    'High school volunteer club president.', 
    '201-555-3456', '2026-05-03'
]);

/**** Create some sample events ****/

const insert_event_sql = `
    INSERT INTO event 
        (date, title, description, schedule, post_date, organizer_id, location) 
    VALUES 
        (?, ?, ?, ?, ?, ?, ST_GeomFromText(?));
`;

// organizer_id: 1 (Alice)
db.execute(insert_event_sql, [
    '2026-05-10 10:00:00',
    'Community Park Cleanup',
    'Help clean up the local park and make it beautiful again.',
    '10:00 AM - Meet\n10:30 AM - Cleanup\n12:30 PM - Wrap up',
    '2026-05-01',
    1,
    'POINT(-74.0431 40.8859)'
]);

// organizer_id: 2 (Brian)
db.execute(insert_event_sql, [
    '2026-05-15 09:00:00',
    'Food Drive Volunteer Day',
    'Assist in sorting and distributing donated food.',
    '9:00 AM - Setup\n10:00 AM - Sorting\n1:00 PM - Distribution',
    '2026-05-02',
    2,
    'POINT(-74.0400 40.8900)'
]);

// organizer_id: 3 (Carla)
db.execute(insert_event_sql, [
    '2026-05-20 11:00:00',
    'Animal Shelter Support',
    'Spend time caring for animals and cleaning facilities.',
    '11:00 AM - Orientation\n11:30 AM - Activities\n2:00 PM - End',
    '2026-05-03',
    3,
    'POINT(-74.0500 40.8800)'
]);

/**** Create event-user relationships (volunteers attending events) ****/

const insert_event_user_sql = `
    INSERT INTO event_user 
        (event_id, user_id) 
    VALUES 
        (?, ?);
`;

// Event 1 attendees
db.execute(insert_event_user_sql, [1, 2]);
db.execute(insert_event_user_sql, [1, 3]);
db.execute(insert_event_user_sql, [1, 4]);

// Event 2 attendees
db.execute(insert_event_user_sql, [2, 1]);
db.execute(insert_event_user_sql, [2, 3]);

// Event 3 attendees
db.execute(insert_event_user_sql, [3, 1]);
db.execute(insert_event_user_sql, [3, 2]);
db.execute(insert_event_user_sql, [3, 4]);

db.end();