'use strict';

/**
 * AWS Lambda entry point.
 *
 * Wraps the Express application with serverless-http so it can handle
 * API Gateway (REST/HTTP) and ALB events without any code changes to
 * the existing Express routes or middleware.
 *
 * The database is initialised once per Lambda container (warm starts
 * reuse the same in-memory instance).  Set DB_PATH to a path on a
 * mounted EFS volume for durable storage across cold starts.
 */

// Validate environment before anything else (mirrors server.js logic)
const NODE_ENV = process.env.NODE_ENV || 'production';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required.');
}
if (process.env.JWT_SECRET === 'change_this_secret_in_production') {
  throw new Error('FATAL: JWT_SECRET must not use the default placeholder value.');
}

const serverless = require('serverless-http');
const { initDb } = require('./db');
const app = require('./app');

// Initialise the database once; subsequent invocations on the same
// container reuse the already-open database instance.
let initialised = false;

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  // Tell Lambda not to wait for the event loop to drain before
  // returning the response (sql.js keeps an async handle open).
  context.callbackWaitsForEmptyEventLoop = false;

  if (!initialised) {
    await initDb();
    initialised = true;
  }

  return handler(event, context);
};
