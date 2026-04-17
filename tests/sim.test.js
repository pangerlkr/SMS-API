'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./setup');

let token;

beforeEach(async () => {
  await setupTestDb();
  const res = await request(app).post('/api/auth/register').send({
    name: 'SIM Tester',
    email: 'sim@example.com',
    password: 'password123'
  });
  token = res.body.token;
});

describe('SIM Card API', () => {
  test('POST /api/sim/register – valid Indian number', async () => {
    const res = await request(app)
      .post('/api/sim/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210', label: 'My SIM' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sim_card_id');
    expect(res.body).toHaveProperty('otp_for_testing');
  });

  test('POST /api/sim/register – number normalised (0-prefix)', async () => {
    const res = await request(app)
      .post('/api/sim/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '09876543210' });

    expect(res.status).toBe(201);
  });

  test('POST /api/sim/register – invalid number returns 400', async () => {
    const res = await request(app)
      .post('/api/sim/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '12345' });
    expect(res.status).toBe(400);
  });

  test('POST /api/sim/register – unauthenticated returns 401', async () => {
    const res = await request(app)
      .post('/api/sim/register')
      .send({ phone_number: '+919876543210' });
    expect(res.status).toBe(401);
  });

  test('POST /api/sim/verify – correct OTP verifies SIM', async () => {
    const reg = await request(app)
      .post('/api/sim/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210' });

    const { sim_card_id, otp_for_testing } = reg.body;

    const res = await request(app)
      .post('/api/sim/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id, otp: otp_for_testing });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/verified/i);
  });

  test('POST /api/sim/verify – wrong OTP returns 400', async () => {
    const reg = await request(app)
      .post('/api/sim/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210' });

    const res = await request(app)
      .post('/api/sim/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: reg.body.sim_card_id, otp: '000000' });

    expect(res.status).toBe(400);
  });

  test('GET /api/sim – lists SIM cards', async () => {
    await request(app)
      .post('/api/sim/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210' });

    const res = await request(app)
      .get('/api/sim')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sim_cards.length).toBe(1);
  });

  test('DELETE /api/sim/:id – deactivates SIM', async () => {
    const reg = await request(app)
      .post('/api/sim/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210' });

    const res = await request(app)
      .delete(`/api/sim/${reg.body.sim_card_id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('normaliseIndianNumber', () => {
  const { normaliseIndianNumber } = require('../src/controllers/simController');

  test('strips +91 prefix', () => {
    expect(normaliseIndianNumber('+919876543210')).toBe('9876543210');
  });

  test('strips 0 prefix', () => {
    expect(normaliseIndianNumber('09876543210')).toBe('9876543210');
  });

  test('accepts bare 10-digit number', () => {
    expect(normaliseIndianNumber('9876543210')).toBe('9876543210');
  });

  test('rejects invalid number', () => {
    expect(normaliseIndianNumber('12345')).toBeNull();
  });

  test('rejects numbers starting with 1-5', () => {
    expect(normaliseIndianNumber('1234567890')).toBeNull();
  });
});
