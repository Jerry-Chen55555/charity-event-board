const db = require("./db_connection");

async function insertSampleData() {
    const connection = db.promise();

    try {
        console.log("Clearing existing data...");
        await connection.execute("DELETE FROM event_user;");
        await connection.execute("DELETE FROM event;");
        await connection.execute("DELETE FROM user;");

        console.log("Inserting sample users...");
        const insertUserSql = `
            INSERT INTO user 
                (first_name, last_name, username, bio, phone_nbr, create_date) 
            VALUES 
                (?, ?, ?, ?, ?, ?);
        `;
        await connection.execute(insertUserSql, [
            'Alice', 'Chen', 'alicec',
            'Passionate about community service and volunteering.',
            '201-555-1234', '2026-05-01'
        ]);
        await connection.execute(insertUserSql, [
            'Brian', 'Smith', 'bsmith',
            'Organizer for local food drives.',
            '201-555-5678', '2026-05-02'
        ]);
        await connection.execute(insertUserSql, [
            'Carla', 'Lopez', 'carla_l',
            'Loves helping at animal shelters.',
            '201-555-9012', '2026-05-02'
        ]);
        await connection.execute(insertUserSql, [
            'David', 'Kim', 'davidk',
            'High school volunteer club president.',
            '201-555-3456', '2026-05-03'
        ]);

        console.log("Inserting sample events with latitude/longitude...");
        const insertEventSql = `
            INSERT INTO event 
                (date, title, description, schedule, post_date, organizer_id, latitude, longitude) 
            VALUES 
                (?, ?, ?, ?, ?, ?, ?, ?);
        `;
        // Event 1
        await connection.execute(insertEventSql, [
            '2026-05-10 10:00:00',
            'Community Park Cleanup',
            'Help clean up the local park and make it beautiful again.',
            '10:00 AM - Meet\n10:30 AM - Cleanup\n12:30 PM - Wrap up',
            '2026-05-01',
            1,
            40.8859,
            -74.0431
        ]);
        // Event 2
        await connection.execute(insertEventSql, [
            '2026-05-15 09:00:00',
            'Food Drive Volunteer Day',
            'Assist in sorting and distributing donated food.',
            '9:00 AM - Setup\n10:00 AM - Sorting\n1:00 PM - Distribution',
            '2026-05-02',
            2,
            40.8900,
            -74.0400
        ]);
        // Event 3
        await connection.execute(insertEventSql, [
            '2026-05-20 11:00:00',
            'Animal Shelter Support',
            'Spend time caring for animals and cleaning facilities.',
            '11:00 AM - Orientation\n11:30 AM - Activities\n2:00 PM - End',
            '2026-05-03',
            3,
            40.8800,
            -74.0500
        ]);

        console.log("Creating event-user relationships...");
        const insertEventUserSql = `
            INSERT INTO event_user (event_id, user_id) VALUES (?, ?);
        `;
        // Event 1 volunteers
        await connection.execute(insertEventUserSql, [1, 2]);
        await connection.execute(insertEventUserSql, [1, 3]);
        await connection.execute(insertEventUserSql, [1, 4]);
        // Event 2 volunteers
        await connection.execute(insertEventUserSql, [2, 1]);
        await connection.execute(insertEventUserSql, [2, 3]);
        // Event 3 volunteers
        await connection.execute(insertEventUserSql, [3, 1]);
        await connection.execute(insertEventUserSql, [3, 2]);
        await connection.execute(insertEventUserSql, [3, 4]);

        console.log("✅ Sample data inserted successfully.");
    } catch (err) {
        console.error("❌ Insertion failed:", err);
    } finally {
        await db.end();
    }
}

insertSampleData();