# Security Policy

## Supported Versions

Only the latest `main` branch and the most recent release of SMS-API receive security updates.

| Version | Supported          |
| ------- | ------------------ |
| v1.0.x  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Security is a core priority for this project. If you discover a vulnerability in the REST API, JWT authentication middleware, SQLite/WASM implementation, or any other component, **please do not open a public issue**.

Instead, please report it via one of the following channels:

- **GitHub Private Vulnerability Reporting**: Use the [Security tab](../../security/advisories/new) of this repository to submit a private advisory.
- **Email**: Contact the maintainer directly at the email address listed on their [GitHub profile](https://github.com/pangerlkr).

### What to Include

Please provide as much of the following information as possible to help us understand and reproduce the issue:

- Type of vulnerability (e.g., authentication bypass, injection, token leakage)
- Full path of the affected source file(s)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if available)
- Potential impact and severity assessment

### Response Timeline

- **Acknowledgement**: Within 48 hours of receiving your report.
- **Status update**: Within 5 business days.
- **Patch & disclosure**: A fix will be developed and deployed before any public disclosure is made.

We appreciate responsible disclosure and will credit researchers in the release notes unless you prefer to remain anonymous.
