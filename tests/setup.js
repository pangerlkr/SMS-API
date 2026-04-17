'use strict';

/**
 * Shared test setup: initialise an in-memory sql.js database,
 * apply the schema, and wire it into the db module before each test suite.
 */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const dbModule = require('../src/db');

let SQL;

async function setupTestDb() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  const db = new SQL.Database(); // in-memory

  const schema = fs.readFileSync(
    path.join(__dirname, '../src/db/schema.sql'),
    'utf8'
  );
  db.run(schema);

  // Patch saveDb to be a no-op for in-memory DB
  dbModule.setDb(db);

  // Override saveDb to skip file writes
  const original = dbModule.saveDb;
  dbModule.saveDb = () => {};

  return { db, restoreSaveDb: () => { dbModule.saveDb = original; } };
}

module.exports = { setupTestDb };
