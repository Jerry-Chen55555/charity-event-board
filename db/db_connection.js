const mysql = require('mysql2');

const dbConfig = {
    host: 'sqlclassdb-instance-1.cqjxl5z5vyvr.us-east-2.rds.amazonaws.com',
    port: 3306,
    user: 'jerche28',
    password: 'NTCNepwgbveL',
    database: 'webdev_proj_2526_t3_jerche28',
    connectTimeout: 20000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true
}

const connection = mysql.createPool(dbConfig);

module.exports = connection;
