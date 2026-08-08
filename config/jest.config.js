const path = require('path');

const baseConfig = {
  rootDir: path.resolve(__dirname, '../'),
  preset: 'ts-jest',
  moduleNameMapper: {
    '^electron$': '<rootDir>/tests/__mocks__/electron.ts',
    '^better-sqlite3$': '<rootDir>/tests/__mocks__/better-sqlite3.ts',
    '^../../shared/(.*)$': '<rootDir>/src/shared/$1',
    '^../shared/(.*)$': '<rootDir>/src/shared/$1',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  }
};

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  rootDir: path.resolve(__dirname, '../'),
  projects: [
    {
      ...baseConfig,
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/unit/**/*.(spec|test).[jt]s?(x)',
        '<rootDir>/tests/integration/**/*.(spec|test).[jt]s?(x)'
      ]
    },
    {
      ...baseConfig,
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/tests/renderer/**/*.(spec|test).[jt]s?(x)'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setupRenderer.ts']
    }
  ],
  collectCoverage: false,
  coverageReporters: ['text-summary', 'lcov'],
  collectCoverageFrom: [
    'src/main/utils/downloader.ts',
    'src/main/utils/fsUtils.ts',
    'src/main/utils/identifier.ts',
    'src/shared/resolution.ts',
    'src/shared/emulators/**/*.ts',
    'src/main/services/**/*.ts',
    'src/main/emulators/**/*.ts',
    'src/main/data/**/*.ts',
    'src/main/platform/**/*.ts'
  ],
  coverageDirectory: '<rootDir>/test-results/coverage',
  // Thresholds are ratchets set just below measured coverage: they exist to
  // stop regressions, not to describe a target. Raise them when coverage
  // improves; do not lower them to make a change pass.
  //
  // Note these were previously declared but never enforced - collectCoverage
  // was false and no script passed --coverage - so some were aspirational.
  // ratchets set just below measured coverage: they stop regressions, they are
  // not targets. raise them when coverage improves; do not lower them to make a
  // change pass.
  coverageThreshold: {
    './src/main/data/': {
      branches: 88, functions: 95, lines: 95, statements: 95
    },
    './src/shared/emulators/': {
      branches: 95, functions: 85, lines: 95, statements: 95
    },
    './src/main/services/bios/': {
      branches: 95, functions: 95, lines: 95, statements: 95
    },
    './src/main/services/launch/': {
      branches: 90, functions: 95, lines: 95, statements: 95
    },
    './src/main/platform/': {
      branches: 76, functions: 95, lines: 93, statements: 91
    },
    './src/main/emulators/': {
      branches: 66, functions: 93, lines: 87, statements: 84
    },
    './src/main/services/': {
      branches: 67, functions: 91, lines: 84, statements: 82
    },
    './src/main/utils/': {
      branches: 76, functions: 85, lines: 87, statements: 85
    },
    './src/main/utils/downloader.ts': {
      branches: 80, functions: 75, lines: 80, statements: 80
    },
    './src/main/utils/identifier.ts': {
      branches: 70, functions: 80, lines: 85, statements: 85
    },
    './src/main/utils/fsUtils.ts': {
      branches: 82, functions: 82, lines: 88, statements: 87
    },
    './src/shared/resolution.ts': {
      branches: 80, functions: 80, lines: 80, statements: 80
    }
  }
};