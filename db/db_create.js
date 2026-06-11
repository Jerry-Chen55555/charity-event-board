const db = require("./db_connection");

async function runMigration() {
    const connection = db.promise(); // get promise-enabled pool

    try {
        console.log("Dropping existing tables...");
        await connection.execute("DROP TABLE IF EXISTS event_user;");
        await connection.execute("DROP TABLE IF EXISTS event;");
        await connection.execute("DROP TABLE IF EXISTS user;");

        console.log("Creating user table...");
        await connection.execute(`
            CREATE TABLE user (
                user_id int NOT NULL AUTO_INCREMENT,
                first_name varchar(100) DEFAULT NULL,
                last_name varchar(100) DEFAULT NULL,
                username varchar(100) DEFAULT NULL,
                auth0_sub varchar(255) DEFAULT NULL,
                email varchar(255) DEFAULT NULL,
                bio varchar(1000) DEFAULT NULL,
                profile_picture longblob,
                phone_nbr varchar(20) DEFAULT NULL,
                create_date datetime DEFAULT NULL,
                PRIMARY KEY (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        console.log("Creating event table...");
        await connection.execute(`
            CREATE TABLE event (
                event_id int NOT NULL AUTO_INCREMENT,
                date datetime DEFAULT NULL,
                title varchar(100) DEFAULT NULL,
                description varchar(2000) DEFAULT NULL,
                schedule varchar(2000) DEFAULT NULL,
                image longblob,
                post_date datetime DEFAULT NULL,
                organizer_id int DEFAULT NULL,
                latitude DECIMAL(10,7) DEFAULT NULL,
                longitude DECIMAL(10,7) DEFAULT NULL,
                PRIMARY KEY (event_id),
                KEY event_user_FK (organizer_id),
                CONSTRAINT event_user_FK FOREIGN KEY (organizer_id) REFERENCES user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        console.log("Creating event_user table...");
        await connection.execute(`
            CREATE TABLE event_user (
                event_id int DEFAULT NULL,
                user_id int DEFAULT NULL,
                KEY event_user_user_FK (user_id),
                KEY event_user_event_FK (event_id),
                CONSTRAINT event_user_event_FK FOREIGN KEY (event_id) REFERENCES event (event_id),
                CONSTRAINT event_user_user_FK FOREIGN KEY (user_id) REFERENCES user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        console.log("✅ Database schema created successfully.");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await db.end(); // close the pool
    }
}

runMigration();