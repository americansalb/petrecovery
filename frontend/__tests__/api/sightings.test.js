/**
 * Sightings API Tests
 * Tests for POST /api/sightings
 */

import { NextRequest } from 'next/server';

// Mock prisma before importing route
const mockPrisma = {
  sighting: {
    create: jest.fn(),
  },
  caseSighting: {
    create: jest.fn(),
  },
  case: {
    findUnique: jest.fn(),
  },
};

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock session
const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  },
};

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

// Mock rate limiting (always allow)
jest.mock('@/app/lib/rateLimit', () => ({
  withRateLimit: jest.fn().mockReturnValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: {} },
  rateLimitResponse: jest.fn(),
}));

// Mock logging
jest.mock('@/lib/logging', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

// Import the route handler and session mock after mocks
import { POST } from '@/app/api/sightings/route';
import { getServerSession } from 'next-auth';

describe('POST /api/sightings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to authenticated user
    getServerSession.mockResolvedValue(mockSession);
  });

  // Helper to create mock request
  function createRequest(body) {
    return new NextRequest('http://localhost:3000/api/sightings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      getServerSession.mockResolvedValue(null);

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('log in');
    });
  });

  describe('Validation', () => {
    it('should return 400 when location is missing', async () => {
      const request = createRequest({
        alertId: 'case-123',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Location');
    });

    it('should return 400 when details are missing', async () => {
      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        timeOfSighting: 'just_now',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('details');
    });

    it('should return 400 when timeOfSighting is missing', async () => {
      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('time');
    });

    it('should return 400 when neither alertId nor caseId is provided', async () => {
      const request = createRequest({
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('specify which pet');
    });
  });

  describe('Sighting Creation', () => {
    it('should create sighting with valid data', async () => {
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-123',
      });
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog near the park',
        timeOfSighting: 'just_now',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sighting.id).toBe('sighting-123');
    });

    it('should use caseId when alertId is not provided', async () => {
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-456',
      });
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const request = createRequest({
        caseId: 'case-456',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      await POST(request);

      expect(mockPrisma.sighting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseId: 'case-456',
          }),
        })
      );
    });

    it('should include behavior in description', async () => {
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-123',
      });
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
        behavior: 'friendly',
      });

      await POST(request);

      expect(mockPrisma.sighting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: expect.stringContaining('Behavior: friendly'),
          }),
        })
      );
    });

    it('should include direction in description', async () => {
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-123',
      });
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
        direction: 'heading north',
      });

      await POST(request);

      expect(mockPrisma.sighting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: expect.stringContaining('Direction: heading north'),
          }),
        })
      );
    });

    it('should set latitude and longitude when provided', async () => {
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-123',
      });
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
        latitude: 30.2672,
        longitude: -97.7431,
      });

      await POST(request);

      expect(mockPrisma.sighting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            latitude: 30.2672,
            longitude: -97.7431,
          }),
        })
      );
    });

    it('should default coordinates to 0 when not provided', async () => {
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-123',
      });
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      await POST(request);

      expect(mockPrisma.sighting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            latitude: 0,
            longitude: 0,
          }),
        })
      );
    });
  });

  describe('CaseSighting Creation', () => {
    it('should create CaseSighting when case exists', async () => {
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-123',
      });
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-123',
        lastSeenLatitude: 30.2672,
        lastSeenLongitude: -97.7431,
      });
      mockPrisma.caseSighting.create.mockResolvedValue({
        id: 'case-sighting-123',
      });

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      await POST(request);

      expect(mockPrisma.caseSighting.create).toHaveBeenCalled();
    });

    it('should not fail if CaseSighting creation fails', async () => {
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-123',
      });
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-123',
      });
      mockPrisma.caseSighting.create.mockRejectedValue(new Error('DB error'));

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed even if CaseSighting fails
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should map behavior to certainty level', async () => {
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-123',
      });
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-123',
        lastSeenLatitude: 30.2672,
        lastSeenLongitude: -97.7431,
      });
      mockPrisma.caseSighting.create.mockResolvedValue({});

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
        behavior: 'injured', // Should map to certainty 5
      });

      await POST(request);

      expect(mockPrisma.caseSighting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            certaintyLevel: 5,
          }),
        })
      );
    });
  });

  describe('Time Mapping', () => {
    it('should map "just_now" to about 15 minutes ago', async () => {
      mockPrisma.sighting.create.mockResolvedValue({ id: 'sighting-123', caseId: 'case-123' });
      mockPrisma.case.findUnique.mockResolvedValue({ id: 'case-123' });
      mockPrisma.caseSighting.create.mockResolvedValue({});

      const beforeTest = Date.now();

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      await POST(request);

      const call = mockPrisma.caseSighting.create.mock.calls[0][0];
      const sightedAt = new Date(call.data.sightedAt).getTime();
      const expectedMin = beforeTest - 16 * 60 * 1000; // Allow 1 min variance
      const expectedMax = beforeTest - 14 * 60 * 1000;

      expect(sightedAt).toBeGreaterThanOrEqual(expectedMin);
      expect(sightedAt).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('Logging', () => {
    it('should log successful sighting', async () => {
      const { logEvent } = require('@/lib/logging');
      mockPrisma.sighting.create.mockResolvedValue({
        id: 'sighting-123',
        caseId: 'case-123',
      });
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      await POST(request);

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'sighting.reported',
          result: 'success',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockPrisma.sighting.create.mockRejectedValue(new Error('DB error'));

      const request = createRequest({
        alertId: 'case-123',
        location: '123 Main St',
        details: 'Saw the dog',
        timeOfSighting: 'just_now',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed');
    });
  });
});
