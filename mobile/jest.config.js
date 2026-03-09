module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  coverageReporters: ['text', 'json-summary'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@pickthebestcard/shared$': '<rootDir>/lib/shared/index.ts',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
      },
    },
  },
};
