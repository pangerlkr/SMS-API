```markdown
# SMS-API Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you how to contribute to the SMS-API codebase, a JavaScript project using the Express framework. You'll learn the project's coding conventions, file organization, import/export patterns, and how to write and run tests using Jest. This guide ensures your contributions are consistent and maintainable.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `sendMessage.js`, `userRoutes.js`

### Imports
- Use **relative import paths**.
  - Example:
    ```javascript
    const { sendSMS } = require('./sendSMS');
    ```

### Exports
- Use **named exports**.
  - Example:
    ```javascript
    // sendSMS.js
    function sendSMS(message, recipient) {
      // implementation
    }
    module.exports = { sendSMS };
    ```

### Commit Messages
- Freeform, no strict prefixes.
- Average length: ~33 characters.
  - Example: `add endpoint for sending SMS`

## Workflows

_No automated workflows detected in the repository._

## Testing Patterns

- **Framework:** Jest
- **Test File Pattern:** Files end with `.test.js`
  - Example: `sendSMS.test.js`
- **Test Example:**
    ```javascript
    // sendSMS.test.js
    const { sendSMS } = require('./sendSMS');

    test('should send SMS successfully', () => {
      const result = sendSMS('Hello', '+1234567890');
      expect(result).toBe(true);
    });
    ```

- To run tests:
    ```bash
    npx jest
    ```

## Commands
| Command      | Purpose                                  |
|--------------|------------------------------------------|
| /run-tests   | Run all Jest tests                       |
| /lint        | Lint the codebase (if linter is present) |
| /start-dev   | Start the Express development server      |
```