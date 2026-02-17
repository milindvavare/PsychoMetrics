const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'psychometrics_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('Database connection established');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
};

// Initialize database schema
const initialize = async () => {
  try {
    // Test connection first
    await testConnection();
    
    // Read and execute schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.execute(statement);
      }
    }
    
    logger.info('Database schema initialized successfully');
    return true;
  } catch (error) {
    // If database doesn't exist, create it
    if (error.code === 'ER_BAD_DB_ERROR') {
      logger.info('Database does not exist, creating...');
      const tempPool = mysql.createPool({
        ...dbConfig,
        database: undefined
      });
      
      await tempPool.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
      await tempPool.end();
      
      // Retry initialization
      return initialize();
    }
    
    // If tables already exist, that's okay
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      logger.info('Database tables already exist');
      return true;
    }
    
    logger.error('Database initialization error:', error);
    throw error;
  }
};

// Query helper
const query = async (sql, params) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    logger.error('Database query error:', { sql, params, error: error.message });
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  query,
  transaction,
  initialize,
  testConnection
};

