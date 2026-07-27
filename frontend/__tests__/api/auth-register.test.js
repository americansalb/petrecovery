/**
 * Auth Register API Tests
 * Tests for POST /api/auth/register
 */

import { NextRequest } from 'next/server';

// Mock prisma with the mock object defined INSIDE the factory (avoids the
// "Cannot access 'mockPrisma' before initialization" TDZ when the route's
// hoisted prisma import fires this factory). Aliased as `mockPrisma` below.
jest.mock('@/app/lib/prisma', () => {
  const mock = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    pet: { create: jest.fn() },
    petMedication: { create: jest.fn() },
    // The route creates user (+ optional Health Book pet) transactionally;
    // hand the callback this same mock so user.create expectations hold.
    $transaction: jest.fn(async (fn) => fn(mock)),
  };
  return { __esModule: true, default: mock };
});

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedHashValue'),
}));

// Mock rate limiting (always allow). The route uses the ASYNC limiter
// (withRateLimitAsync) since SEC-17 (bb92eba) - mock both forms.
jest.mock('@/app/lib/rateLimit', () => ({
  withRateLimit: jest.fn().mockReturnValue({ success: true }),
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { AUTH: {} },
  rateLimitResponse: jest.fn(),
}));

// Mock logging
jest.mock('@/lib/logging', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

// Mock email sending
jest.mock('@/app/api/auth/verify-email/route', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

// Import the route handler after mocks
import { POST } from '@/app/api/auth/register/route';
import prisma from '@/app/lib/prisma';

// Alias the imported mocked default so existing `mockPrisma.*` refs work unchanged.
const mockPrisma = prisma;

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock request
  function createRequest(body) {
    return new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  describe('Validation', () => {
    it('should return 400 when email is missing', async () => {
      const request = createRequest({
        password: 'password123',
        firstName: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Email');
    });

    it('should return 400 when password is missing', async () => {
      const request = createRequest({
        email: 'test@example.com',
        firstName: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('password');
    });

    it('should return 400 when firstName is missing', async () => {
      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('first name');
    });

    it('should return 400 for invalid email format', async () => {
      const request = createRequest({
        email: 'not-an-email',
        password: 'password123',
        firstName: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('email');
    });

    it('should return 400 for password shorter than 8 characters', async () => {
      const request = createRequest({
        email: 'test@example.com',
        password: 'short',
        firstName: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('8 characters');
    });

    it('should return 400 for invalid phone format', async () => {
      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        phone: 'abc',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('phone');
    });
  });

  describe('User Creation', () => {
    it('should return 400 when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      const request = createRequest({
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unable to create account');
    });

    it('should create user and return success', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: 'test@example.com',
        firstName: 'Test',
      });

      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('test@example.com');
      expect(data.message).toContain('verify');
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: 'test@example.com',
        firstName: 'Test',
      });

      const request = createRequest({
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
        firstName: 'Test',
      });

      await POST(request);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should accept valid phone number', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: 'test@example.com',
        firstName: 'Test',
      });

      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        phone: '555-123-4567',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should set waiver fields when acceptedTerms is true', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: 'test@example.com',
        firstName: 'Test',
      });

      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        acceptedTerms: true,
      });

      await POST(request);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            waiverAcceptedAt: expect.any(Date),
            waiverVersionAccepted: '1.0',
          }),
        })
      );
    });
  });

  describe('Security', () => {
    it('should generate email verification token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: 'test@example.com',
        firstName: 'Test',
      });

      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
      });

      await POST(request);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailVerified: null,
            emailVerifyToken: expect.any(String),
            emailVerifyExpiry: expect.any(Date),
          }),
        })
      );
    });

    it('should hash password with bcrypt', async () => {
      const bcrypt = require('bcryptjs');
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: 'test@example.com',
        firstName: 'Test',
      });

      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
      });

      await POST(request);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });

    it('should not expose password or hash in response', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: 'test@example.com',
        firstName: 'Test',
        passwordHash: '$2b$12$secret',
      });

      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.user.passwordHash).toBeUndefined();
      expect(data.user.password).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('DB connection failed'));

      const request = createRequest({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Unable to create account');
    });
  });
});
