const path = require('path');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  rootDir: path.resolve(__dirname, '../'),
  testMatch: [
    '<rootDir>/tests/**/*.(spec|test).[jt]s?(x)',
    '<rootDir>/src/**/*.(spec|test).[jt]s?(x)'
  ],
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^electron$': '<rootDir>/tests/__mocks__/electron.ts',
    '^../../shared/(.*)$': '<rootDir>/src/shared/$1'
  }
};