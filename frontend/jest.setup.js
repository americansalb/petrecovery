// Jest setup file
// This runs before each test file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret-for-jest';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock environment variables that might be needed
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.SMTP_USER = 'test';
process.env.SMTP_PASS = 'test';
process.env.SMTP_FROM = 'test@petrecovery.org';

// Extend Jest matchers if needed
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Global test utilities
global.testUtils = {
  // Helper to create mock session
  createMockSession: (overrides = {}) => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      ...overrides.user,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }),

  // Helper to create mock request
  createMockRequest: (overrides = {}) => ({
    method: 'GET',
    headers: new Map(),
    json: jest.fn().mockResolvedValue({}),
    ...overrides,
  }),

  // Helper to wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Suppress console.log in tests unless explicitly enabled
if (process.env.DEBUG_TESTS !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Keep error and warn for test debugging
    error: console.error,
    warn: console.warn,
  };
}

// Clean up after all tests
afterAll(async () => {
  // Add any global cleanup here
});
