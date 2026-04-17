'use strict';

require('dotenv').config();

const { initDb } = require('./db');
const app = require('./app');

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SMS API server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
