module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/?(*.)+(test|spec).[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/test/jestSetup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/test/styleMock.js',
  },
};
