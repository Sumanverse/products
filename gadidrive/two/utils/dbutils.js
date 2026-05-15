const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'gadidriv_gadidrivenp_db',
    password: 'sumandai@2061',
    database: 'gadidriv_gadidrivenp_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

module.exports = pool;