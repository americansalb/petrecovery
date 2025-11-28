/**
 * Prisma Mock for Testing
 * This file provides a mock implementation of the Prisma client for unit tests.
 */

// Mock Prisma methods
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  case: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  sighting: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  caseSighting: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  lostPetCase: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  rescueSquad: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  community: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  communityMember: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  alert: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  phoneVerification: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  // Transaction support
  $transaction: jest.fn((callback) => {
    // Execute the callback with the mock client
    if (typeof callback === 'function') {
      return callback(mockPrismaClient);
    }
    // For array of promises
    return Promise.all(callback);
  }),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// Helper to reset all mocks
function resetPrismaMocks() {
  Object.keys(mockPrismaClient).forEach(key => {
    const model = mockPrismaClient[key];
    if (typeof model === 'object' && model !== null) {
      Object.keys(model).forEach(method => {
        if (typeof model[method]?.mockReset === 'function') {
          model[method].mockReset();
        }
      });
    }
  });
}

// Helper to create a mock user
function createMockUser(overrides = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2b$12$test.hash.value',
    firstName: 'Test',
    lastName: 'User',
    phone: '555-123-4567',
    role: 'USER',
    emailVerified: new Date(),
    emailVerifyToken: null,
    emailVerifyExpiry: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// Helper to create a mock case
function createMockCase(overrides = {}) {
  return {
    id: 'case-123',
    petName: 'Buddy',
    species: 'DOG',
    breed: 'Golden Retriever',
    color: 'Golden',
    size: 'LARGE',
    status: 'LOST',
    lastSeenAddress: '123 Main St',
    lastSeenLatitude: 30.2672,
    lastSeenLongitude: -97.7431,
    lastSeenDate: new Date('2024-01-01'),
    description: 'Friendly dog',
    reporterId: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// Helper to create a mock sighting
function createMockSighting(overrides = {}) {
  return {
    id: 'sighting-123',
    caseId: 'case-123',
    userId: 'user-123',
    latitude: 30.2672,
    longitude: -97.7431,
    description: 'Saw the dog near the park',
    photoUrls: '[]',
    verified: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

module.exports = {
  mockPrismaClient,
  resetPrismaMocks,
  createMockUser,
  createMockCase,
  createMockSighting,
};
