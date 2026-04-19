'use strict';

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/sms_api.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

/**
 * Initialise the SQLite database (sql.js WASM).
 * Loads from disk if the file exists, otherwise creates a fresh database
 * and applies the schema.
 */
async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Apply schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.run(schema);

  // Run migrations for columns added after initial schema creation.
  // Check for 'otp_attempts' via PRAGMA rather than catching ALTER TABLE errors.
  const tableInfo = db.exec('PRAGMA table_info(sim_cards)');
  const hasOtpAttempts =
    tableInfo.length > 0 &&
    tableInfo[0].values.some((row) => row[1] === 'otp_attempts');
  if (!hasOtpAttempts) {
    db.run('ALTER TABLE sim_cards ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0');
  }

  saveDb();

  return db;
}

/**
 * Persist the in-memory database to disk.
 */
function saveDb() {
  if (!db) return;
  if (process.env.DB_PATH === ':memory:') return; // skip persistence for in-memory test DBs
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Execute a SQL statement (INSERT / UPDATE / DELETE / DDL).
 * @param {string} sql
 * @param {Array|Object} params
 */
function run(sql, params = []) {
  const database = getDb();
  database.run(sql, params);
  module.exports.saveDb();
}

/**
 * Return the first row matching the query, or undefined.
 * @param {string} sql
 * @param {Array|Object} params
 * @returns {Object|undefined}
 */
function get(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : undefined;
  stmt.free();
  return row;
}

/**
 * Return all rows matching the query.
 * @param {string} sql
 * @param {Array|Object} params
 * @returns {Object[]}
 */
function all(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Synchronous accessor – throws if initDb() hasn't been awaited yet.
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialised. Call initDb() first.');
  }
  return db;
}

/**
 * Replace the internal db instance (used in tests for in-memory DBs).
 */
function setDb(instance) {
  db = instance;
}

module.exports = { initDb, saveDb, run, get, all, getDb, setDb };
