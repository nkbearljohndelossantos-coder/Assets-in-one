const knex = require('knex');
const knexfile = require('../../knexfile');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';
const config = knexfile[env];

// Create data directory for SQLite if database is SQLite and folder doesn't exist
if (config.client === 'sqlite3') {
  const dbPath = config.connection.filename;
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info(`Created database directory for SQLite at: ${dbDir}`);
  }
}

logger.info(`Initializing database connection using client: ${config.client} in ${env} environment.`);
const db = knex(config);

module.exports = db;
