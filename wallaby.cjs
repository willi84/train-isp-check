module.exports = {
  autoDetect: true,
  env: {
    type: 'node',
    params: {
      runner: '--experimental-vm-modules'
    }
  },
  testFramework: {
    type: 'jest',
    configFile: './jest.config.js'
  },
  files: ['src/**/*.ts', 'api/**/*.ts', '!src/**/*.spec.ts'],
  tests: ['src/**/*.spec.ts']
};
