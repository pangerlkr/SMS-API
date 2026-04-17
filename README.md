# SMS-API

A REST API platform that enables users in India to register their SIM card phone numbers as SMS senders and programmatically route messages through those SIM cards for their businesses, tools, or platforms.

## How It Works

1. **Register** – Create an account on the platform.
2. **Add your SIM** – Register your Indian mobile number and verify ownership with a one-time password (OTP).
3. **Generate an API key** – Create a key that your application uses to authenticate requests.
4. **Send SMS** – Call `POST /api/sms/send` from your application. Messages are routed through your verified SIM card.
5. **Companion Device** – Install the companion app on the phone whose SIM card you registered. The app polls or listens for webhook events and delivers messages using the device's native SMS capability. Alternatively connect a GSM modem to the webhook endpoint.

```
Your App → POST /api/sms/send (API key) → SMS-API → Webhook → Companion App → SIM → Recipient
```

---

## Interfaces

The platform is accessible in two ways:

| Interface | Description |
|-----------|-------------|
| **Web UI** | Browser-based dashboard at `http://localhost:3000` for managing accounts, SIM cards, API keys, and sending SMS |
| **CLI** | Command-line tool (`sms-api`) for scripting and terminal-based workflows |
| **REST API** | Programmatic HTTP access (documented below) |

---

## Quick Start

### Prerequisites

- Node.js 18+

### Installation

```bash
git clone https://github.com/pangerlkr/SMS-API.git
cd SMS-API
npm install
cp .env.example .env       # edit JWT_SECRET
npm start
```

The server starts on `http://localhost:3000` by default.

---

## Web UI

Open `http://localhost:3000` in your browser. You can:

- **Register / Log in** using the sign-in form.
- **SIM Cards** tab – register an Indian mobile number and verify it with an OTP.
- **API Keys** tab – create and revoke API keys (full key shown once at creation).
- **Send SMS** tab – send a message using an API key and a verified SIM card.
- **Logs** tab – paginated history of all outbound messages.
- **Webhooks** tab – register companion device endpoints for message delivery.

---

## CLI

Install the CLI globally after running `npm install`:

```bash
npm link          # makes 'sms-api' available system-wide
# or run directly:
node src/cli/index.js --help
```

By default the CLI talks to `http://localhost:3000`. Override with `--url` or the `$SMSAPI_URL` environment variable.

### Available commands

```
sms-api register              # Create a new account (interactive prompts)
sms-api login                 # Log in and store credentials locally
sms-api logout                # Clear stored credentials
sms-api profile               # Show your account profile

sms-api sim list              # List registered SIM cards
sms-api sim add               # Register a new Indian SIM card
sms-api sim verify            # Verify a SIM card with its OTP
sms-api sim remove <id>       # Deactivate a SIM card

sms-api keys list             # List API keys
sms-api keys create           # Create a new API key
sms-api keys revoke <id>      # Revoke an API key

sms-api sms send              # Send an SMS (uses X-API-Key)
sms-api sms logs              # View paginated SMS logs

sms-api webhooks list         # List registered webhooks
sms-api webhooks add          # Register a companion device webhook
sms-api webhooks remove <id>  # Delete a webhook
```

Credentials (JWT token) are stored in `~/.smsapi/config.json` after login. Pass all values as flags or let the CLI prompt interactively.

**Example workflow:**

```bash
sms-api register --name "Rahul" --email rahul@example.com --password secret123
sms-api sim add --phone +919876543210 --label "Business"
# Copy the sim_card_id and otp_for_testing from the output, then:
sms-api sim verify --id <sim_card_id> --otp <otp>
sms-api keys create --name "My App"
# Copy the full key value, then:
sms-api sms send --key smsapi_... --to 9123456789 --message "Hello from CLI!"
sms-api sms logs
```

---

## API Reference

### Base URL

```
http://localhost:3000/api
```

### Authentication

The platform uses two authentication mechanisms:

| Mechanism | Header | Used for |
|-----------|--------|----------|
| JWT Bearer | `Authorization: Bearer <token>` | User management (SIM cards, API keys, logs) |
| API Key | `X-API-Key: <key>` | Sending SMS from your application |

---

### Auth

#### Register

```
POST /api/auth/register
```

**Body:**
```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "password": "securepassword123"
}
```

**Response `201`:**
```json
{
  "message": "User registered successfully",
  "token": "<jwt>",
  "user": { "id": "...", "name": "Rahul Sharma", "email": "rahul@example.com" }
}
```

#### Login

```
POST /api/auth/login
```

**Body:**
```json
{ "email": "rahul@example.com", "password": "securepassword123" }
```

**Response `200`:**
```json
{ "message": "Login successful", "token": "<jwt>", "user": { ... } }
```

#### Get Profile

```
GET /api/auth/profile
Authorization: Bearer <jwt>
```

---

### SIM Cards

All SIM card endpoints require `Authorization: Bearer <jwt>`.

#### Register a SIM Card

```
POST /api/sim/register
```

**Body:**
```json
{
  "phone_number": "+919876543210",
  "label": "Business SIM"
}
```

Accepted formats for Indian numbers: `+91XXXXXXXXXX`, `91XXXXXXXXXX`, `0XXXXXXXXXX`, `XXXXXXXXXX`.

**Response `201`:**
```json
{
  "message": "SIM card registered. Please verify using the OTP sent to your number.",
  "sim_card_id": "uuid",
  "otp_for_testing": "123456"
}
```

> **Note:** In production, the OTP is delivered via SMS to the registered number. The `otp_for_testing` field is present for development convenience and should be removed in production.

#### Verify a SIM Card

```
POST /api/sim/verify
```

**Body:**
```json
{ "sim_card_id": "uuid", "otp": "123456" }
```

#### List SIM Cards

```
GET /api/sim
```

#### Remove a SIM Card

```
DELETE /api/sim/:id
```

---

### API Keys

All API key endpoints require `Authorization: Bearer <jwt>`.

#### Create API Key

```
POST /api/keys
```

**Body:**
```json
{ "name": "My Business App" }
```

**Response `201`:**
```json
{
  "message": "API key created",
  "api_key": {
    "id": "uuid",
    "name": "My Business App",
    "key_value": "smsapi_...",
    "created_at": "..."
  },
  "warning": "Store this key securely. It will not be shown in full again."
}
```

#### List API Keys

```
GET /api/keys
```

Key values are masked in the listing response.

#### Revoke API Key

```
DELETE /api/keys/:id
```

---

### Sending SMS

#### Send an SMS

```
POST /api/sms/send
X-API-Key: smsapi_...
```

**Body:**
```json
{
  "to": "9123456789",
  "message": "Your OTP is 456789",
  "sim_card_id": "uuid"   // optional – uses first verified SIM if omitted
}
```

**Response `200`:**
```json
{
  "message": "SMS queued. Connect a companion device or register a webhook to complete delivery.",
  "log_id": "uuid",
  "from": "9876543210",
  "to": "9123456789",
  "status": "pending_device"
}
```

Possible status values:

| Status | Meaning |
|--------|---------|
| `queued` | Message received, not yet dispatched |
| `pending_device` | No webhook registered; waiting for companion device |
| `dispatched` | Forwarded to the companion device via webhook |
| `sent` | Companion device confirms message sent |
| `delivered` | Delivery receipt received |
| `failed` | Delivery failed |

#### Update Delivery Status (Companion Device Callback)

```
POST /api/sms/status
X-API-Key: smsapi_...
```

**Body:**
```json
{
  "log_id": "uuid",
  "status": "sent",
  "error_message": null
}
```

#### View SMS Logs

```
GET /api/sms/logs?page=1&limit=20
Authorization: Bearer <jwt>
```

---

### Webhooks

Register an HTTP endpoint on your companion device. When an SMS is sent, the platform will POST the message details to this URL so the device can deliver it.

All webhook endpoints require `Authorization: Bearer <jwt>`.

#### Register Webhook

```
POST /api/webhooks
```

**Body:**
```json
{
  "sim_card_id": "uuid",
  "endpoint_url": "https://your-device.example.com/sms",
  "secret": "optional-shared-secret"
}
```

The platform sends a `POST` request to `endpoint_url` with:

```json
{
  "log_id": "uuid",
  "to": "9123456789",
  "message": "Your OTP is 456789",
  "from": "9876543210",
  "webhook_id": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

The shared secret is passed in the `X-SMS-API-Secret` header so you can verify authenticity.

#### List Webhooks

```
GET /api/webhooks
```

#### Delete Webhook

```
DELETE /api/webhooks/:id
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | *(required in production)* | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | `7d` | JWT expiry duration |
| `DB_PATH` | `./data/sms_api.db` | Path to the SQLite database file |

---

## Running Tests

```bash
npm test
```

---

## Architecture Notes

- **Database:** SQLite via [sql.js](https://github.com/sql-js/sql.js) (pure WebAssembly – no native build required). For high-volume production deployments, swap `src/db/index.js` for a PostgreSQL/MySQL adapter.
- **SIM Verification:** OTP is currently returned in the API response (`otp_for_testing`). In production, integrate an SMS provider (e.g. MSG91, Exotel, Textlocal) to deliver the OTP to the handset.
- **Message Delivery:** The platform routes messages to your physical device via webhooks. The companion mobile app (Android/iOS) or a GSM modem connected to a server listens on the webhook URL and uses the SIM card to send the message natively.
- **Rate Limiting:** 100 requests per 15 minutes per IP.
