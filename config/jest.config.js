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
  collectCoverage: true,
  coverageReporters: ['text-summary', 'lcov'],
  collectCoverageFrom: [
    'src/main/utils/downloader.ts',
    'src/main/utils/fsUtils.ts',
    'src/main/utils/identifier.ts',
    'src/shared/resolution.ts',
    'src/main/services/**/*.ts',
    'src/main/utils/configurators/**/*.ts',
    'src/main/utils/translators/**/*.ts'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    './src/main/utils/downloader.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/main/utils/fsUtils.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/main/utils/identifier.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/shared/resolution.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/main/services/': {
      branches: 45,
      functions: 70,
      lines: 65,
      statements: 65
    },
    './src/main/utils/configurators/': {
      branches: 50,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/main/utils/translators/': {
      branches: 40,
      functions: 90,
      lines: 80,
      statements: 70
    }
  }
};