#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Config persistence (~/.smsapi/config.json)
// ---------------------------------------------------------------------------

const CONFIG_DIR = path.join(os.homedir(), '.smsapi');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function getBaseUrl(options) {
  const root = options.parent && options.parent.opts().url;
  return (root || process.env.SMSAPI_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function apiRequest(method, url, body, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    console.error(`\nNetwork error: ${err.message}`);
    console.error('Make sure the SMS API server is running.');
    process.exit(1);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { status: res.status, ok: res.ok, data };
}

function bearerHeaders(config) {
  if (!config.token) {
    console.error('Not logged in. Run: sms-api login');
    process.exit(1);
  }
  return { Authorization: `Bearer ${config.token}` };
}

// ---------------------------------------------------------------------------
// Interactive prompt helper
// ---------------------------------------------------------------------------

function prompt(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (hidden) {
      process.stdout.write(question);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      function onData(char) {
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question);
          }
        } else {
          input += char;
        }
      }

      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function printTable(rows, columns) {
  if (!rows || rows.length === 0) {
    console.log('  (none)');
    return;
  }

  // Compute column widths
  const widths = {};
  for (const col of columns) {
    widths[col.key] = col.label.length;
  }
  for (const row of rows) {
    for (const col of columns) {
      const val = String(row[col.key] ?? '');
      if (val.length > widths[col.key]) widths[col.key] = val.length;
    }
  }

  const sep = columns.map((c) => '-'.repeat(widths[c.key] + 2)).join('+');
  const header = columns.map((c) => ` ${c.label.padEnd(widths[c.key])} `).join('|');

  console.log(`+${sep}+`);
  console.log(`|${header}|`);
  console.log(`+${sep}+`);
  for (const row of rows) {
    const line = columns.map((c) => ` ${String(row[c.key] ?? '').padEnd(widths[c.key])} `).join('|');
    console.log(`|${line}|`);
  }
  console.log(`+${sep}+`);
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('sms-api')
  .description('CLI for the SMS-API platform')
  .version('1.0.0')
  .option('-u, --url <url>', 'API base URL (default: http://localhost:3000 or $SMSAPI_URL)');

// ---------------------------------------------------------------------------
// Auth commands
// ---------------------------------------------------------------------------

program
  .command('register')
  .description('Create a new account')
  .option('--name <name>', 'Your name')
  .option('--email <email>', 'Your email address')
  .option('--password <password>', 'Your password (min 8 chars)')
  .action(async (opts) => {
    const baseUrl = getBaseUrl(opts);
    const name = opts.name || (await prompt('Name: '));
    const email = opts.email || (await prompt('Email: '));
    const password = opts.password || (await prompt('Password: ', true));

    const { status, ok, data } = await apiRequest(
      'POST',
      `${baseUrl}/api/auth/register`,
      { name, email, password }
    );

    if (!ok) {
      console.error(`\nError (${status}):`);
      printJson(data);
      process.exit(1);
    }

    const config = loadConfig();
    config.token = data.token;
    config.user = data.user;
    config.baseUrl = baseUrl;
    saveConfig(config);

    console.log(`\n✓ Registered and logged in as ${data.user.name} (${data.user.email})`);
  });

program
  .command('login')
  .description('Log in to your account')
  .option('--email <email>', 'Your email address')
  .option('--password <password>', 'Your password')
  .action(async (opts) => {
    const baseUrl = getBaseUrl(opts);
    const email = opts.email || (await prompt('Email: '));
    const password = opts.password || (await prompt('Password: ', true));

    const { status, ok, data } = await apiRequest(
      'POST',
      `${baseUrl}/api/auth/login`,
      { email, password }
    );

    if (!ok) {
      console.error(`\nError (${status}):`);
      printJson(data);
      process.exit(1);
    }

    const config = loadConfig();
    config.token = data.token;
    config.user = data.user;
    config.baseUrl = baseUrl;
    saveConfig(config);

    console.log(`\n✓ Logged in as ${data.user.name} (${data.user.email})`);
  });

program
  .command('logout')
  .description('Clear stored credentials')
  .action(() => {
    const config = loadConfig();
    delete config.token;
    delete config.user;
    saveConfig(config);
    console.log('✓ Logged out');
  });

program
  .command('profile')
  .description('Show your account profile')
  .action(async (opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const { status, ok, data } = await apiRequest(
      'GET',
      `${baseUrl}/api/auth/profile`,
      null,
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }
    const u = data.user;
    console.log(`\nProfile`);
    console.log(`  ID:    ${u.id}`);
    console.log(`  Name:  ${u.name}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  Since: ${u.created_at}`);
  });

// ---------------------------------------------------------------------------
// SIM card commands
// ---------------------------------------------------------------------------

const simCmd = program
  .command('sim')
  .description('Manage SIM cards');

simCmd
  .command('list')
  .description('List your registered SIM cards')
  .action(async (opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const { status, ok, data } = await apiRequest(
      'GET',
      `${baseUrl}/api/sim`,
      null,
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\nSIM Cards (${data.sim_cards.length}):`);
    printTable(data.sim_cards.map((s) => ({
      ...s,
      verified: s.verified ? 'Yes' : 'No',
      active: s.active ? 'Yes' : 'No'
    })), [
      { key: 'id', label: 'ID' },
      { key: 'phone_number', label: 'Phone' },
      { key: 'label', label: 'Label' },
      { key: 'verified', label: 'Verified' },
      { key: 'active', label: 'Active' },
      { key: 'created_at', label: 'Created' }
    ]);
  });

simCmd
  .command('add')
  .description('Register a new SIM card (Indian number)')
  .option('--phone <number>', 'Phone number (e.g. +919876543210)')
  .option('--label <label>', 'Friendly label for this SIM')
  .action(async (opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const phone_number = opts.phone || (await prompt('Phone number: '));
    const label = opts.label || (await prompt('Label (optional): '));

    const { status, ok, data } = await apiRequest(
      'POST',
      `${baseUrl}/api/sim/register`,
      { phone_number, label: label || undefined },
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\n✓ ${data.message}`);
    console.log(`  SIM Card ID:     ${data.sim_card_id}`);
    console.log(`  OTP (dev/test):  ${data.otp_for_testing}`);
  });

simCmd
  .command('verify')
  .description('Verify a SIM card with the OTP')
  .option('--id <sim_card_id>', 'SIM card ID')
  .option('--otp <code>', '6-digit OTP')
  .action(async (opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const sim_card_id = opts.id || (await prompt('SIM card ID: '));
    const otp = opts.otp || (await prompt('OTP: '));

    const { status, ok, data } = await apiRequest(
      'POST',
      `${baseUrl}/api/sim/verify`,
      { sim_card_id, otp },
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\n✓ ${data.message}`);
  });

simCmd
  .command('remove <id>')
  .description('Deactivate a SIM card')
  .action(async (id, opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const { status, ok, data } = await apiRequest(
      'DELETE',
      `${baseUrl}/api/sim/${id}`,
      null,
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\n✓ ${data.message}`);
  });

// ---------------------------------------------------------------------------
// API key commands
// ---------------------------------------------------------------------------

const keysCmd = program
  .command('keys')
  .description('Manage API keys');

keysCmd
  .command('list')
  .description('List your API keys')
  .action(async (opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const { status, ok, data } = await apiRequest(
      'GET',
      `${baseUrl}/api/keys`,
      null,
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\nAPI Keys (${data.api_keys.length}):`);
    printTable(data.api_keys.map((k) => ({
      ...k,
      active: k.active ? 'Yes' : 'No'
    })), [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'key_preview', label: 'Key (preview)' },
      { key: 'active', label: 'Active' },
      { key: 'last_used_at', label: 'Last Used' },
      { key: 'created_at', label: 'Created' }
    ]);
  });

keysCmd
  .command('create')
  .description('Create a new API key')
  .option('--name <name>', 'Friendly name for the key')
  .action(async (opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const name = opts.name || (await prompt('Key name: '));

    const { status, ok, data } = await apiRequest(
      'POST',
      `${baseUrl}/api/keys`,
      { name },
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\n✓ API key created`);
    console.log(`  ID:        ${data.api_key.id}`);
    console.log(`  Name:      ${data.api_key.name}`);
    console.log(`  Key:       ${data.api_key.key_value}`);
    console.log(`  Created:   ${data.api_key.created_at}`);
    console.log(`\n  ⚠ ${data.warning}`);
  });

keysCmd
  .command('revoke <id>')
  .description('Revoke an API key')
  .action(async (id, opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const { status, ok, data } = await apiRequest(
      'DELETE',
      `${baseUrl}/api/keys/${id}`,
      null,
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\n✓ ${data.message}`);
  });

// ---------------------------------------------------------------------------
// SMS commands
// ---------------------------------------------------------------------------

const smsCmd = program
  .command('sms')
  .description('Send SMS messages and view logs');

smsCmd
  .command('send')
  .description('Send an SMS (requires API key)')
  .option('--key <api_key>', 'API key (or set $SMSAPI_KEY)')
  .option('--to <number>', 'Recipient phone number')
  .option('--message <text>', 'Message text')
  .option('--sim <sim_card_id>', 'SIM card ID to use (optional)')
  .action(async (opts) => {
    const baseUrl = getBaseUrl(opts);
    const apiKey = opts.key || process.env.SMSAPI_KEY || (await prompt('API key: '));
    const to = opts.to || (await prompt('Recipient number: '));
    const message = opts.message || (await prompt('Message: '));

    const body = { to, message };
    if (opts.sim) body.sim_card_id = opts.sim;

    const { status, ok, data } = await apiRequest(
      'POST',
      `${baseUrl}/api/sms/send`,
      body,
      { 'X-API-Key': apiKey }
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\n✓ ${data.message}`);
    console.log(`  Log ID:  ${data.log_id}`);
    console.log(`  From:    ${data.from}`);
    console.log(`  To:      ${data.to}`);
    console.log(`  Status:  ${data.status}`);
  });

smsCmd
  .command('logs')
  .description('View SMS logs')
  .option('--page <n>', 'Page number', '1')
  .option('--limit <n>', 'Results per page', '20')
  .action(async (opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const { status, ok, data } = await apiRequest(
      'GET',
      `${baseUrl}/api/sms/logs?page=${opts.page}&limit=${opts.limit}`,
      null,
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\nSMS Logs (page ${data.page}, ${data.logs.length} results):`);
    printTable(data.logs, [
      { key: 'id', label: 'ID' },
      { key: 'from_number', label: 'From' },
      { key: 'to_number', label: 'To' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created' },
      { key: 'message', label: 'Message' }
    ]);
  });

// ---------------------------------------------------------------------------
// Webhook commands
// ---------------------------------------------------------------------------

const webhooksCmd = program
  .command('webhooks')
  .description('Manage companion device webhooks');

webhooksCmd
  .command('list')
  .description('List registered webhooks')
  .action(async (opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const { status, ok, data } = await apiRequest(
      'GET',
      `${baseUrl}/api/webhooks`,
      null,
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\nWebhooks (${data.webhooks.length}):`);
    printTable(data.webhooks.map((w) => ({
      ...w,
      active: w.active ? 'Yes' : 'No'
    })), [
      { key: 'id', label: 'ID' },
      { key: 'phone_number', label: 'SIM Phone' },
      { key: 'endpoint_url', label: 'Endpoint URL' },
      { key: 'active', label: 'Active' },
      { key: 'created_at', label: 'Created' }
    ]);
  });

webhooksCmd
  .command('add')
  .description('Register a webhook for a SIM card')
  .option('--sim <sim_card_id>', 'SIM card ID')
  .option('--url <endpoint_url>', 'Webhook endpoint URL')
  .option('--secret <secret>', 'Shared secret (optional, min 8 chars)')
  .action(async (opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const sim_card_id = opts.sim || (await prompt('SIM card ID: '));
    const endpoint_url = opts.url || (await prompt('Endpoint URL: '));
    const secret = opts.secret || (await prompt('Secret (optional, press Enter to skip): '));

    const body = { sim_card_id, endpoint_url };
    if (secret) body.secret = secret;

    const { status, ok, data } = await apiRequest(
      'POST',
      `${baseUrl}/api/webhooks`,
      body,
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\n✓ ${data.message}`);
    console.log(`  Webhook ID:   ${data.webhook.id}`);
    console.log(`  Endpoint URL: ${data.webhook.endpoint_url}`);
    console.log(`  Secret:       ${data.webhook.secret}`);
  });

webhooksCmd
  .command('remove <id>')
  .description('Delete a webhook')
  .action(async (id, opts) => {
    const config = loadConfig();
    const baseUrl = getBaseUrl(opts);
    const { status, ok, data } = await apiRequest(
      'DELETE',
      `${baseUrl}/api/webhooks/${id}`,
      null,
      bearerHeaders(config)
    );

    if (!ok) {
      console.error(`Error (${status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`\n✓ ${data.message}`);
  });

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
