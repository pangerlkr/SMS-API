# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-28

### Added
- Initial production release of the SMS-API platform
- Full REST API with JWT authentication (`/api/auth`)
- SIM card registration, verification (OTP-based), and management (`/api/sim`)
- API key generation and management (`/api/keys`)
- SMS sending via registered SIM tokens (`/api/sms`)
- Webhook registration and delivery for SMS status callbacks (`/api/webhooks`)
- Web UI dashboard (`public/`) for managing SIM cards and API keys
- CLI tool (`sms-api`) for programmatic access from terminal
- Multi-stage Docker build with non-root user for security
- Docker Compose setup with persistent volume and health check
- Serverless Framework configuration for AWS Lambda deployment (`ap-south-1`)
- CI workflow (GitHub Actions) with Node.js matrix testing (18.x, 20.x)
- Deploy workflow with OIDC-based AWS credentials
- Helmet, CORS, rate-limiting, and input validation hardening
- Graceful shutdown handling in `server.js`
- SQLite (sql.js) database with in-memory support for Lambda/testing
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `LICENSE`

### Security
- JWT secret validation enforced at startup in production mode
- Rate limiting on all API routes
- Helmet CSP headers for the web UI
- CORS origin validation with configurable allow-list

---

## [Unreleased]

- Linting pipeline integration (`eslint`)
- Test coverage reporting
- Dependabot automated dependency updates
