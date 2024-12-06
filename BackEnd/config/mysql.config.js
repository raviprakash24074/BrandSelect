// backend/config/mysql.config.js
const mysql = require('mysql2/promise');

const vanHeusenConfig = {
  host: '192.168.41.133',
  port: 3306,
  user: 'root',
  password: 'Akash@12706',
  database: 'van_heusen'
};



const createMySQLConnection = async (config) => {
  try {
    const connection = await mysql.createConnection(config);
    console.log(`MySQL connected on port ${config.port}`);
    return connection;
  } catch (error) {
    console.error('MySQL connection error:', error);
    throw error;
  }
};

module.exports = {
  vanHeusenConfig,
  createMySQLConnection
};