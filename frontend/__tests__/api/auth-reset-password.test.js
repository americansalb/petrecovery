/**
 * Auth Reset Password API Tests
 * Tests for POST /api/auth/reset-password
 */

import { NextRequest } from 'next/server';

// Mock prisma with the mock object defined INSIDE the factory (avoids the
// "Cannot access 'mockPrisma' before initialization" TDZ when the route's
// hoisted prisma import fires this factory). Aliased as `mockPrisma` below.
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedNewHashValue'),
}));

// Mock rate limiting (always allow). The route uses the ASYNC limiter
// (withRateLimitAsync) since SEC-17 (bb92eba) — mock both forms.
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

// Import the route handler after mocks
import { POST } from '@/app/api/auth/reset-password/route';
import prisma from '@/app/lib/prisma';

// Alias the imported mocked default so existing `mockPrisma.*` refs work unchanged.
const mockPrisma = prisma;

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock request
  function createRequest(body) {
    return new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  describe('Validation', () => {
    it('should return 400 when token is missing', async () => {
      const request = createRequest({
        password: 'newpassword123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('token');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when password is missing', async () => {
      const request = createRequest({
        token: 'valid-token',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('password');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when password is too short', async () => {
      const request = createRequest({
        token: 'valid-token',
        password: 'short',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('8 characters');
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Token Validation', () => {
    it('should return 400 when token is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = createRequest({
        token: 'invalid-token',
        password: 'newpassword123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid or expired');
      expect(data.code).toBe('INVALID_TOKEN');
    });

    it('should return 400 when token has expired', async () => {
      const expiredDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        resetToken: 'expired-token',
        resetTokenExpiry: expiredDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const request = createRequest({
        token: 'expired-token',
        password: 'newpassword123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('expired');
      expect(data.code).toBe('TOKEN_EXPIRED');
    });

    it('should clear expired token', async () => {
      const expiredDate = new Date(Date.now() - 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        resetToken: 'expired-token',
        resetTokenExpiry: expiredDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const request = createRequest({
        token: 'expired-token',
        password: 'newpassword123',
      });

      await POST(request);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          resetToken: null,
          resetTokenExpiry: null,
        },
      });
    });
  });

  describe('Password Reset', () => {
    it('should reset password with valid token', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        resetToken: 'valid-token',
        resetTokenExpiry: futureDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const request = createRequest({
        token: 'valid-token',
        password: 'newpassword123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('reset successfully');
    });

    it('should hash password with bcrypt', async () => {
      const bcrypt = require('bcryptjs');
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        resetToken: 'valid-token',
        resetTokenExpiry: futureDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const request = createRequest({
        token: 'valid-token',
        password: 'newpassword123',
      });

      await POST(request);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
    });

    it('should clear token after successful reset', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        resetToken: 'valid-token',
        resetTokenExpiry: futureDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const request = createRequest({
        token: 'valid-token',
        password: 'newpassword123',
      });

      await POST(request);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            resetToken: null,
            resetTokenExpiry: null,
          }),
        })
      );
    });

    it('should update passwordHash', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        resetToken: 'valid-token',
        resetTokenExpiry: futureDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const request = createRequest({
        token: 'valid-token',
        password: 'newpassword123',
      });

      await POST(request);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: '$2b$12$mockedNewHashValue',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      const request = createRequest({
        token: 'valid-token',
        password: 'newpassword123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Logging', () => {
    it('should log successful password reset', async () => {
      const { logEvent } = require('@/lib/logging');
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        resetToken: 'valid-token',
        resetTokenExpiry: futureDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const request = createRequest({
        token: 'valid-token',
        password: 'newpassword123',
      });

      await POST(request);

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'auth.reset_password_succeeded',
          result: 'success',
        })
      );
    });

    it('should log failed password reset', async () => {
      const { logEvent } = require('@/lib/logging');
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = createRequest({
        token: 'invalid-token',
        password: 'newpassword123',
      });

      await POST(request);

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'auth.reset_password_failed',
          result: 'failure',
        })
      );
    });
  });
});
