'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./setup');

let token;
let apiKey;
let simCardId;

async function setupUserWithVerifiedSim() {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'SMS Tester',
    email: 'sms@example.com',
    password: 'password123'
  });
  token = reg.body.token;

  // Register and verify a SIM card
  const simReg = await request(app)
    .post('/api/sim/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ phone_number: '+919876543210', label: 'Test SIM' });

  simCardId = simReg.body.sim_card_id;
  const otp = simReg.body.otp_for_testing;

  await request(app)
    .post('/api/sim/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ sim_card_id: simCardId, otp });

  // Create an API key
  const keyRes = await request(app)
    .post('/api/keys')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Key' });

  apiKey = keyRes.body.api_key.key_value;
}

beforeEach(async () => {
  await setupTestDb();
  await setupUserWithVerifiedSim();
});

describe('SMS Sending', () => {
  test('POST /api/sms/send – queued when no webhook registered', async () => {
    const res = await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', apiKey)
      .send({ to: '9123456789', message: 'Hello from SMS API!' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending_device');
    expect(res.body).toHaveProperty('log_id');
    expect(res.body).toHaveProperty('from');
  });

  test('POST /api/sms/send – with explicit sim_card_id', async () => {
    const res = await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', apiKey)
      .send({ to: '9123456789', message: 'Hello!', sim_card_id: simCardId });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('log_id');
  });

  test('POST /api/sms/send – missing API key returns 401', async () => {
    const res = await request(app)
      .post('/api/sms/send')
      .send({ to: '9123456789', message: 'Hello!' });

    expect(res.status).toBe(401);
  });

  test('POST /api/sms/send – missing to returns 400', async () => {
    const res = await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', apiKey)
      .send({ message: 'Hello!' });

    expect(res.status).toBe(400);
  });

  test('POST /api/sms/send – missing message returns 400', async () => {
    const res = await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', apiKey)
      .send({ to: '9123456789' });

    expect(res.status).toBe(400);
  });

  test('POST /api/sms/send – invalid sim_card_id returns 400', async () => {
    const res = await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', apiKey)
      .send({ to: '9123456789', message: 'Hi', sim_card_id: 'nonexistent-id' });

    expect(res.status).toBe(400);
  });
});

describe('SMS Status Update', () => {
  test('POST /api/sms/status – updates log status', async () => {
    const send = await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', apiKey)
      .send({ to: '9123456789', message: 'Hello!' });

    const logId = send.body.log_id;

    const res = await request(app)
      .post('/api/sms/status')
      .set('X-API-Key', apiKey)
      .send({ log_id: logId, status: 'sent' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('sent');
  });

  test('POST /api/sms/status – invalid status returns 400', async () => {
    const send = await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', apiKey)
      .send({ to: '9123456789', message: 'Hello!' });

    const res = await request(app)
      .post('/api/sms/status')
      .set('X-API-Key', apiKey)
      .send({ log_id: send.body.log_id, status: 'unknown_status' });

    expect(res.status).toBe(400);
  });
});

describe('SMS Logs', () => {
  test('GET /api/sms/logs – returns logs', async () => {
    await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', apiKey)
      .send({ to: '9123456789', message: 'Hello 1' });

    await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', apiKey)
      .send({ to: '9123456789', message: 'Hello 2' });

    const res = await request(app)
      .get('/api/sms/logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(2);
  });

  test('GET /api/sms/logs – pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/sms/send')
        .set('X-API-Key', apiKey)
        .send({ to: '9123456789', message: `Message ${i}` });
    }

    const res = await request(app)
      .get('/api/sms/logs?page=1&limit=3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(3);
  });

  test('GET /api/sms/logs – no auth returns 401', async () => {
    const res = await request(app).get('/api/sms/logs');
    expect(res.status).toBe(401);
  });
});
