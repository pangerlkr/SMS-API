# Contributing to SMS-API

Thank you for considering contributing to SMS-API!

## Development Setup

1. Fork and clone the repository.
2. Install dependencies: `npm install`
3. Set up the environment: `cp .env.example .env` and configure your `JWT_SECRET`.
4. Run the development server: `npm run dev`
5. Run the test suite: `npm test`

## Pull Request Process

1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the `README.md` with details of changes to the interface, including new environment variables, exposed ports, or file locations.
3. Write or update tests in the `tests/` directory to cover your changes.
4. Your pull request will be merged once it receives at least one approval from a maintainer and all CI/CD security and functionality checks pass.

## Code Style

- Follow existing patterns in the codebase.
- Use meaningful commit messages in imperative mood (e.g., `feat: add OTP resend endpoint`).
- Keep PRs focused — one feature or fix per PR.

## Reporting Bugs

Please open an issue with a clear title, steps to reproduce, expected vs actual behavior, and your environment details.

## Feature Requests

Open an issue tagged `enhancement` describing the problem your feature solves and your proposed approach.
