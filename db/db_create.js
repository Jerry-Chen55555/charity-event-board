const db = require("./db_connection");

/**** Drop existing tables, if any ****/

const drop_assignments_table_sql = "DROP TABLE IF EXISTS event_user;"
db.execute(drop_assignments_table_sql);

const drop_subjects_table_sql = "DROP TABLE IF EXISTS event;"
db.execute(drop_subjects_table_sql);

const drop_users_table_sql = "DROP TABLE IF EXISTS user;"
db.execute(drop_users_table_sql);

/**** Create tables ****/

const create_user_table_sql = `
    CREATE TABLE user (
  user_id int NOT NULL AUTO_INCREMENT,
  first_name varchar(100) DEFAULT NULL,
  last_name varchar(100) DEFAULT NULL,
  username varchar(100) DEFAULT NULL,
  bio varchar(1000) DEFAULT NULL,
  profile_picture longblob,
  phone_nbr varchar(20) DEFAULT NULL,
  create_date datetime DEFAULT NULL,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`

db.execute(create_user_table_sql);

const create_event_table_sql = `
    CREATE TABLE event (
  event_id int NOT NULL AUTO_INCREMENT,
  date datetime DEFAULT NULL,
  title varchar(100) DEFAULT NULL,
  description varchar(2000) DEFAULT NULL,
  schedule varchar(2000) DEFAULT NULL,
  image longblob,
  post_date datetime DEFAULT NULL,
  organizer_id int DEFAULT NULL,
  location point DEFAULT NULL,
  PRIMARY KEY (event_id),
  KEY event_user_FK (organizer_id),
  CONSTRAINT event_user_FK FOREIGN KEY (organizer_id) REFERENCES user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`

db.execute(create_event_table_sql);

const create_event_user_table_sql = `
    CREATE TABLE event_user (
  event_id int DEFAULT NULL,
  user_id int DEFAULT NULL,
  KEY event_user_user_FK (user_id),
  KEY event_user_event_FK (event_id),
  CONSTRAINT event_user_event_FK FOREIGN KEY (event_id) REFERENCES event (event_id),
  CONSTRAINT event_user_user_FK FOREIGN KEY (user_id) REFERENCES user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`

db.execute(create_event_user_table_sql);

db.end();