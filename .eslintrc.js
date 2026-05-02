'use strict';

module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-process-exit': 'off',
    'strict': ['error', 'global'],
    'eqeqeq': ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'warn',
    'curly': ['error', 'all'],
    'semi': ['error', 'always'],
    'quotes': ['warn', 'single', { avoidEscape: true }],
  },
  ignorePatterns: ['node_modules/', 'coverage/', '*.min.js'],
};
