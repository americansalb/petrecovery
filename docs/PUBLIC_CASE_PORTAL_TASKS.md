# Public Lost Pet Mission Portal MVP - Task Breakdown (Phase 15–16)

**Feature Spec:** `docs/features/public-lost-pet-portal-mvp.md`
**Status:** Ready for Implementation
**Goal:** Build public-facing portal for browsing lost pet missions and submitting reports

---

## Overview

This document breaks down Phase 15–16 (Public Lost Pet Mission Portal MVP) into 6 focused tasks:

- **TASK-P01**: Prisma Schema & Migration for Public Flags
- **TASK-P02**: Public Mission API Endpoints
- **TASK-P03**: Public Mission List Page (`/missions`)
- **TASK-P04**: Public Mission Detail Page (`/missions/[missionNumber]`)
- **TASK-P05**: Public Report Form (`/missions/report`)
- **TASK-P06**: QA Integration & Documentation

Each task is designed to be:
- **Small enough** to complete in one focused session
- **Testable** via browser smoke test
- **Committable** with clear acceptance criteria
- **Independent** but building on previous tasks

---

## TASK-P01: Prisma Schema & Migration for Public Flags

**Goal**: Add `isPublic`, `publicContactOk`, and `source` fields to `LostPetMission` model.

**Files to Modify**:
- `frontend/prisma/schema.prisma`

**Changes**:

### Update LostPetMission Model

Add three new fields to the existing `LostPetMission` model:

```prisma
model LostPetMission {
  // ... existing fields from Phase 13-14 ...

  // NEW: Public visibility and source tracking
  isPublic        Boolean  @default(false)
  publicContactOk Boolean  @default(false)
  source          String   @default("ADMIN")

  // ... existing relations ...
}
```

### Field Details

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `isPublic` | Boolean | `false` | Controls whether mission appears on public pages. Admins must explicitly set to `true`. |
| `publicContactOk` | Boolean | `false` | Controls whether contact info (name, phone, email) is shown on public detail page. |
| `source` | String | `"ADMIN"` | Tracks how mission was created: `"ADMIN"` or `"PUBLIC_REPORT"`. |

### Migration Strategy

**Option 1: Manual Migration SQL** (Recommended for production safety)

Create new migration file:
`frontend/prisma/migrations/20251125_add_public_flags_to_missions/migration.sql`

```sql
-- Add public visibility fields to LostPetMission
ALTER TABLE "LostPetMission"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicContactOk" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'ADMIN';

-- Add index for faster public mission queries
CREATE INDEX "LostPetMission_isPublic_status_idx" ON "LostPetMission"("isPublic", "status");

-- Add comment for documentation
COMMENT ON COLUMN "LostPetMission"."isPublic" IS 'Whether this mission is visible on public-facing pages';
COMMENT ON COLUMN "LostPetMission"."publicContactOk" IS 'Whether to show contact information publicly';
COMMENT ON COLUMN "LostPetMission"."source" IS 'Mission source: ADMIN or PUBLIC_REPORT';
```

**Option 2: Prisma CLI** (if available)

```bash
cd frontend
npx prisma migrate dev --name add_public_flags_to_missions
```

### Rollback Plan

If migration needs to be reversed:

```sql
-- Drop index first
DROP INDEX IF EXISTS "LostPetMission_isPublic_status_idx";

-- Drop columns
ALTER TABLE "LostPetMission"
  DROP COLUMN IF EXISTS "isPublic",
  DROP COLUMN IF EXISTS "publicContactOk",
  DROP COLUMN IF EXISTS "source";
```

**Acceptance Criteria**:
- [ ] `isPublic` field added to LostPetMission (Boolean, default false)
- [ ] `publicContactOk` field added to LostPetMission (Boolean, default false)
- [ ] `source` field added to LostPetMission (String, default "ADMIN")
- [ ] Index created for efficient public mission queries
- [ ] Migration applied successfully
- [ ] All existing missions have isPublic=false (safe default)
- [ ] No breaking changes to existing Phase 13–14 features
- [ ] Prisma schema formatted correctly

**Testing**:
- [ ] Verify migration applied: Check database schema
- [ ] Verify existing missions unchanged: Query shows isPublic=false
- [ ] Verify `/admin/missions` still works (no regression)

**Commit Message**:
```
[Phase 15-16] TASK-P01: Add public flags to LostPetMission schema

- Added isPublic (Boolean, default false)
- Added publicContactOk (Boolean, default false)
- Added source (String, default "ADMIN")
- Added compound index on (isPublic, status)
- All existing missions default to isPublic=false (safe)
- No breaking changes to Phase 13-14 functionality
```

---

## TASK-P02: Public Mission API Endpoints

**Goal**: Implement 3 public-facing API endpoints with structured logging.

**Files to Create**:
1. `frontend/app/api/public/missions/route.js` (GET list, POST report)
2. `frontend/app/api/public/missions/[missionNumber]/route.js` (GET detail)

**Implementation Details**:

### Endpoint 1: GET /api/public/missions (List)

File: `frontend/app/api/public/missions/route.js`

```javascript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logEvent } from '@/lib/logging';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const city = searchParams.get('city');
  const state = searchParams.get('state');
  const status = searchParams.get('status');
  const species = searchParams.get('species');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const page = parseInt(searchParams.get('page') || '1');

  try {
    // Build where clause
    const where = {
      isPublic: true, // CRITICAL: Only show public missions
    };

    if (city) where.city = city;
    if (state) where.state = state;
    if (status) where.status = status;
    if (species) where.petSpecies = species;

    // Execute query with pagination
    const [missions, total] = await Promise.all([
      prisma.lostPetMission.findMany({
        where,
        select: {
          id: true,
          missionNumber: true,
          petName: true,
          petSpecies: true,
          petBreed: true,
          petColor: true,
          city: true,
          state: true,
          status: true,
          lastSeenAt: true,
          lastSeenLandmark: true,
          createdAt: true,
          // DO NOT SELECT: contactName, contactPhone, contactEmail, createdById, squadId
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lostPetMission.count({ where }),
    ]);

    // Log successful view
    await logEvent({
      event_type: 'public_mission.list_viewed',
      resource_type: 'lost_pet_mission',
      action: 'list',
      result: 'success',
      actor_user_id: null,
      actor_role: 'public',
      metadata: {
        city,
        state,
        status,
        species,
        results_count: missions.length,
        page,
        limit,
      },
    });

    return NextResponse.json({
      missions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Public mission list failed:', error);

    // Log failure
    await logEvent({
      event_type: 'public_mission.list_failed',
      resource_type: 'lost_pet_mission',
      action: 'list',
      result: 'failure',
      actor_user_id: null,
      actor_role: 'public',
      error_message: error.message,
      metadata: { city, state, status, species },
    });

    return NextResponse.json(
      { error: 'Failed to load missions', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

### Endpoint 2: GET /api/public/missions/[missionNumber] (Detail)

File: `frontend/app/api/public/missions/[missionNumber]/route.js`

```javascript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logEvent } from '@/lib/logging';

export async function GET(request, { params }) {
  const { missionNumber } = params;

  try {
    // Find mission by mission number
    const missionData = await prisma.lostPetMission.findUnique({
      where: { missionNumber },
      select: {
        id: true,
        missionNumber: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petColor: true,
        petDescription: true,
        city: true,
        state: true,
        zipCode: true,
        lastSeenAt: true,
        lastSeenLandmark: true,
        status: true,
        isUrgent: true,
        createdAt: true,
        updatedAt: true,
        isPublic: true,
        publicContactOk: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        // DO NOT SELECT: createdById, squadId, source
      },
    });

    // Check if mission exists and is public
    if (!missionData || !missionData.isPublic) {
      await logEvent({
        event_type: 'public_mission.detail_failed',
        resource_type: 'lost_pet_mission',
        action: 'read',
        result: 'failure',
        actor_user_id: null,
        actor_role: 'public',
        error_message: 'Mission not found or not public',
        metadata: { mission_number: missionNumber, error_code: 'CASE_NOT_FOUND' },
      });

      return NextResponse.json(
        { error: 'Mission not found or not public', code: 'CASE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Strip contact info if not allowed
    const response = { ...missionData };
    if (!missionData.publicContactOk) {
      delete response.contactName;
      delete response.contactPhone;
      delete response.contactEmail;
    }

    // Remove internal flags from response
    delete response.isPublic;
    delete response.publicContactOk;

    // Log successful view
    await logEvent({
      event_type: 'public_mission.detail_viewed',
      resource_type: 'lost_pet_mission',
      resource_id: missionData.id,
      action: 'read',
      result: 'success',
      actor_user_id: null,
      actor_role: 'public',
      metadata: {
        mission_number: missionNumber,
        mission_id: missionData.id,
        has_contact_info: missionData.publicContactOk,
      },
    });

    return NextResponse.json({ mission: response });
  } catch (error) {
    console.error('Public mission detail failed:', error);

    await logEvent({
      event_type: 'public_mission.detail_failed',
      resource_type: 'lost_pet_mission',
      action: 'read',
      result: 'failure',
      actor_user_id: null,
      actor_role: 'public',
      error_message: error.message,
      metadata: { mission_number: missionNumber },
    });

    return NextResponse.json(
      { error: 'Failed to load mission', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

### Endpoint 3: POST /api/public/missions (Report)

Add to `frontend/app/api/public/missions/route.js`:

```javascript
export async function POST(request) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['petSpecies', 'city', 'state', 'contactName', 'contactEmail'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      await logEvent({
        event_type: 'public_mission.report_failed',
        resource_type: 'lost_pet_mission',
        action: 'create',
        result: 'failure',
        actor_user_id: null,
        actor_role: 'public',
        error_message: 'Validation failed',
        metadata: { missing_fields: missingFields },
      });

      return NextResponse.json(
        {
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: missingFields.reduce((acc, field) => {
            acc[field] = `${field} is required`;
            return acc;
          }, {}),
        },
        { status: 400 }
      );
    }

    // Validate species enum
    const validSpecies = ['DOG', 'CAT', 'BIRD', 'OTHER'];
    if (!validSpecies.includes(body.petSpecies)) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: { petSpecies: `Must be one of: ${validSpecies.join(', ')}` },
        },
        { status: 400 }
      );
    }

    // Generate mission number (reuse logic from Phase 13-14)
    const cityCode = body.city.substring(0, 3).toUpperMission();
    const year = new Date().getFullYear();

    const existingMissions = await prisma.lostPetMission.count({
      where: {
        missionNumber: { startsWith: `${cityCode}-${year}-` },
      },
    });
    const sequence = (existingMissions + 1).toString().padStart(4, '0');
    const missionNumber = `${cityCode}-${year}-${sequence}`;

    // Create mission with PUBLIC_REPORT source
    const newMission = await prisma.lostPetMission.create({
      data: {
        missionNumber,
        petName: body.petName || null,
        petSpecies: body.petSpecies,
        petBreed: body.petBreed || null,
        petColor: body.petColor || null,
        petDescription: body.petDescription || null,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode || null,
        lastSeenAt: body.lastSeenAt ? new Date(body.lastSeenAt) : null,
        lastSeenLandmark: body.lastSeenLandmark || null,
        contactName: body.contactName,
        contactPhone: body.contactPhone || null,
        contactEmail: body.contactEmail,
        status: 'OPEN',
        isPublic: false, // Requires admin approval
        publicContactOk: false,
        source: 'PUBLIC_REPORT',
        createdById: null, // No user account for public reports (MVP)
      },
    });

    // Log successful submission
    await logEvent({
      event_type: 'public_mission.report_submitted',
      resource_type: 'lost_pet_mission',
      resource_id: newMission.id,
      action: 'create',
      result: 'success',
      actor_user_id: null,
      actor_role: 'public',
      metadata: {
        mission_number: missionNumber,
        mission_id: newMission.id,
        city: body.city,
        state: body.state,
        species: body.petSpecies,
        has_contact_info: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Your lost pet report has been submitted for review. You will be contacted by our team within 24 hours.',
        missionNumber: newMission.missionNumber,
        missionId: newMission.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Public mission report failed:', error);

    await logEvent({
      event_type: 'public_mission.report_failed',
      resource_type: 'lost_pet_mission',
      action: 'create',
      result: 'failure',
      actor_user_id: null,
      actor_role: 'public',
      error_message: error.message,
    });

    return NextResponse.json(
      { error: 'Failed to submit report', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

**Acceptance Criteria**:
- [ ] GET /api/public/missions returns only isPublic=true missions
- [ ] GET /api/public/missions supports city, state, status, species filters
- [ ] GET /api/public/missions paginates correctly
- [ ] GET /api/public/missions/[missionNumber] returns mission details
- [ ] GET /api/public/missions/[missionNumber] shows contact only if publicContactOk=true
- [ ] GET /api/public/missions/[missionNumber] returns 404 for non-public missions
- [ ] POST /api/public/missions creates mission with source=PUBLIC_REPORT
- [ ] POST /api/public/missions creates mission with isPublic=false
- [ ] POST /api/public/missions validates required fields
- [ ] All endpoints emit structured events (public_mission.*)
- [ ] All events logged with actor_role='public'
- [ ] Error responses include clear codes and messages

**Testing**:
- [ ] Test GET /api/public/missions with various filters
- [ ] Test GET /api/public/missions/[missionNumber] for public and non-public missions
- [ ] Test POST /api/public/missions with valid and invalid data
- [ ] Verify events appear in EventLog table
- [ ] Verify no sensitive data exposed (createdById, squadId)

**Commit Message**:
```
[Phase 15-16] TASK-P02: Implement public mission API endpoints

Endpoints:
- GET /api/public/missions (list with filters and pagination)
- GET /api/public/missions/[missionNumber] (detail with privacy controls)
- POST /api/public/missions (report lost pet, creates PUBLIC_REPORT)

Security:
- Only isPublic=true missions visible in list
- Contact info only shown if publicContactOk=true
- All requests logged with public_mission.* events
- No sensitive internal data exposed

Next: TASK-P03 (Public list page UI)
```

---

## TASK-P03: Public Mission List Page (`/missions`)

**Goal**: Build public-facing list page with filters and pagination.

**Files to Create**:
- `frontend/app/missions/page.js`

**Implementation Details**:

```javascript
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PublicMissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state from URL
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [state, setState] = useState(searchParams.get('state') || '');
  const [species, setSpecies] = useState(searchParams.get('species') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

  // Data state
  const [missions, setMissions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch missions when filters or page changes
  useEffect(() => {
    fetchMissions();
  }, [city, state, species, status, page]);

  const fetchMissions = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (state) params.set('state', state);
      if (species) params.set('species', species);
      if (status) params.set('status', status);
      params.set('page', page.toString());
      params.set('limit', '20');

      const res = await fetch(`/api/public/missions?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to load missions');
      }

      const data = await res.json();
      setMissions(data.missions);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching missions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    // Update URL with filter params
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (species) params.set('species', species);
    if (status) params.set('status', status);
    params.set('page', '1');

    router.push(`/missions?${params.toString()}`);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-blue-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">🐾 Find Lost Pets Near You</h1>
          <p className="text-xl">Help reunite lost pets with their families</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., Austin"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All States</option>
                <option value="TX">Texas</option>
                <option value="WA">Washington</option>
                <option value="OR">Oregon</option>
                <option value="CO">Colorado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Species
              </label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Species</option>
                <option value="DOG">Dog</option>
                <option value="CAT">Cat</option>
                <option value="BIRD">Bird</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="OPEN">Open</option>
                <option value="ACTIVE_SEARCH">Active Search</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-yellow-800">
            <strong>Community Service Notice:</strong> This is a volunteer-run service.
            We cannot guarantee the accuracy of information posted. Please exercise caution
            when contacting pet owners or handling found animals.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading missions...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchMissions}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Missions List */}
        {!loading && !error && missions.length === 0 && (
          <div className="bg-white rounded-lg p-12 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <div className="text-lg font-medium text-gray-900 mb-2">
              No missions found
            </div>
            <div className="text-sm text-gray-600">
              Try adjusting your filters or check back later.
            </div>
          </div>
        )}

        {!loading && !error && missions.length > 0 && (
          <div className="space-y-4">
            {missions.map(missionData => (
              <MissionCard key={missionData.id} missionData={missionData} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>

            <span className="px-4 py-2 text-sm text-gray-600">
              Page {page} of {pagination.pages}
            </span>

            <button
              onClick={() => setPage(Math.min(pagination.pages, page + 1))}
              disabled={page === pagination.pages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MissionCard({ missionData }) {
  const statusColors = {
    OPEN: 'bg-yellow-100 text-yellow-800',
    ACTIVE_SEARCH: 'bg-orange-100 text-orange-800',
    RESOLVED: 'bg-green-100 text-green-800',
    CLOSED_OTHER: 'bg-gray-100 text-gray-800',
  };

  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐱',
    BIRD: '🐦',
    OTHER: '🐾',
  };

  const timeAgo = (date) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  return (
    <Link href={`/missions/${missionData.missionNumber}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{speciesEmoji[missionData.petSpecies]}</span>
              <h3 className="text-xl font-bold text-gray-900">
                {missionData.petName || 'Unknown Pet'} - {missionData.petBreed || missionData.petSpecies}
              </h3>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
              <span>{missionData.city}, {missionData.state}</span>
              <span>•</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[missionData.status]}`}>
                {missionData.status.replace('_', ' ')}
              </span>
              <span>•</span>
              <span>{timeAgo(missionData.createdAt)}</span>
            </div>

            {missionData.lastSeenLandmark && (
              <p className="text-sm text-gray-700">
                <strong>Last seen:</strong> {missionData.lastSeenLandmark}
              </p>
            )}
          </div>

          <div className="ml-4">
            <div className="text-blue-600 font-medium">View Details →</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

**Acceptance Criteria**:
- [ ] Page accessible at `/missions` without authentication
- [ ] Hero section displays clear messaging
- [ ] Filter controls work for city, state, species, status
- [ ] Search button updates URL params and refetches
- [ ] Mission cards display pet info, location, status
- [ ] Mission cards link to `/missions/[missionNumber]`
- [ ] Pagination works correctly
- [ ] Loading state shows while fetching
- [ ] Empty state shows when no results
- [ ] Error state shows on fetch failure
- [ ] Disclaimer text visible
- [ ] Only isPublic=true missions appear

**Testing**:
- [ ] Load `/missions` and verify missions display
- [ ] Test each filter individually
- [ ] Test filter combinations
- [ ] Click pagination buttons
- [ ] Click mission card and verify navigation
- [ ] Test with no filters (all missions)
- [ ] Test with filters that return 0 results

**Commit Message**:
```
[Phase 15-16] TASK-P03: Implement public mission list page

- Created public-facing list page at /missions
- Hero section with clear messaging
- Filters: city, state, species, status
- Pagination with page controls
- Mission cards showing key info and status pills
- Loading, error, and empty states
- Links to detail pages
- Community service disclaimer

Next: TASK-P04 (Mission detail page)
```

---

## TASK-P04: Public Mission Detail Page (`/missions/[missionNumber]`)

**Goal**: Build public detail page with privacy controls.

**Files to Create**:
- `frontend/app/missions/[missionNumber]/page.js`

**Implementation Details**:

```javascript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PublicMissionDetailPage() {
  const { missionNumber } = useParams();
  const router = useRouter();

  const [missionData, setMissionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMission();
  }, [missionNumber]);

  const fetchMission = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/missions/${missionNumber}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Mission not found or not public');
        }
        throw new Error('Failed to load mission');
      }

      const data = await res.json();
      setMissionData(data.mission);
    } catch (err) {
      console.error('Error fetching mission:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading mission...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="text-4xl mb-4">😞</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Mission Not Found
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/missions"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 inline-block"
          >
            Browse All Missions
          </Link>
        </div>
      </div>
    );
  }

  const statusColors = {
    OPEN: 'bg-yellow-100 text-yellow-800',
    ACTIVE_SEARCH: 'bg-orange-100 text-orange-800',
    RESOLVED: 'bg-green-100 text-green-800',
    CLOSED_OTHER: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link href="/missions" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Missions
        </Link>

        {/* Mission Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {missionData.petName || 'Unknown Pet'}
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  Mission #{missionData.missionNumber}
                </span>
                <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${statusColors[missionData.status]}`}>
                  {missionData.status.replace('_', ' ')}
                </span>
                {missionData.isUrgent && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-semibold">
                    URGENT
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={copyToClipboard}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              📋 Share This Mission
            </button>
          </div>
        </div>

        {/* Pet Information */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Pet Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Species:</label>
              <p className="text-gray-900">{missionData.petSpecies}</p>
            </div>

            {missionData.petBreed && (
              <div>
                <label className="text-sm font-semibold text-gray-700">Breed:</label>
                <p className="text-gray-900">{missionData.petBreed}</p>
              </div>
            )}

            {missionData.petColor && (
              <div>
                <label className="text-sm font-semibold text-gray-700">Color:</label>
                <p className="text-gray-900">{missionData.petColor}</p>
              </div>
            )}

            {missionData.petDescription && (
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">Description:</label>
                <p className="text-gray-900">{missionData.petDescription}</p>
              </div>
            )}
          </div>
        </div>

        {/* Last Seen */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Last Seen
          </h2>

          <div className="space-y-3">
            {missionData.lastSeenAt && (
              <div>
                <label className="text-sm font-semibold text-gray-700">Date & Time:</label>
                <p className="text-gray-900">
                  {new Date(missionData.lastSeenAt).toLocaleString()}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-700">Location:</label>
              <p className="text-gray-900">
                {missionData.city}, {missionData.state} {missionData.zipCode}
              </p>
            </div>

            {missionData.lastSeenLandmark && (
              <div>
                <label className="text-sm font-semibold text-gray-700">Landmark:</label>
                <p className="text-gray-900">{missionData.lastSeenLandmark}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information (conditional) */}
        {(missionData.contactName || missionData.contactPhone || missionData.contactEmail) && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-green-900 mb-4">
              Contact Information
            </h2>

            <div className="space-y-2">
              {missionData.contactName && (
                <div>
                  <label className="text-sm font-semibold text-green-800">Name:</label>
                  <p className="text-green-900">{missionData.contactName}</p>
                </div>
              )}

              {missionData.contactPhone && (
                <div>
                  <label className="text-sm font-semibold text-green-800">Phone:</label>
                  <p className="text-green-900">
                    <a href={`tel:${missionData.contactPhone}`} className="hover:underline">
                      {missionData.contactPhone}
                    </a>
                  </p>
                </div>
              )}

              {missionData.contactEmail && (
                <div>
                  <label className="text-sm font-semibold text-green-800">Email:</label>
                  <p className="text-green-900">
                    <a href={`mailto:${missionData.contactEmail}`} className="hover:underline">
                      {missionData.contactEmail}
                    </a>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 text-sm text-green-700">
              <strong>Privacy Notice:</strong> Contact information is provided with the owner's consent.
              Please respect their privacy and only contact them if you have relevant information about their lost pet.
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Important Safety Information</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• This is a volunteer-run community service. We cannot guarantee the accuracy of information posted.</li>
            <li>• If you find a lost pet, do not attempt to capture it yourself if it appears injured, sick, or dangerous.</li>
            <li>• Contact the owner directly using the information provided above.</li>
            <li>• For assistance, contact your local animal control or rescue squad.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Page accessible at `/missions/[missionNumber]` without authentication
- [ ] Shows all pet information (name, species, breed, color, description)
- [ ] Shows last seen location and landmark
- [ ] Shows contact info only if available in API response
- [ ] Privacy notice shows when contact info present
- [ ] Safety disclaimer always visible
- [ ] Share button copies URL to clipboard
- [ ] Back link navigates to `/missions`
- [ ] 404 page for non-existent or non-public missions
- [ ] Loading state while fetching
- [ ] Status pill color-coded correctly
- [ ] Urgent badge shows when isUrgent=true

**Testing**:
- [ ] Navigate to detail page from list page
- [ ] Test with mission that has contact info (publicContactOk=true)
- [ ] Test with mission that has NO contact info (publicContactOk=false)
- [ ] Test with non-existent mission number (should 404)
- [ ] Test with mission that has isPublic=false (should 404)
- [ ] Click Share button and verify clipboard
- [ ] Verify all disclaimers visible

**Commit Message**:
```
[Phase 15-16] TASK-P04: Implement public mission detail page

- Created detail page at /missions/[missionNumber]
- Shows pet info, location, last seen details
- Conditionally renders contact info based on API
- Privacy and safety disclaimers
- Share button to copy URL
- 404 handling for non-public missions
- Status pills and urgent badge
- Back link to list page

Next: TASK-P05 (Public report form)
```

---

## TASK-P05: Public Report Form (`/missions/report`)

**Goal**: Build public form for submitting lost pet reports.

**Files to Create**:
- `frontend/app/missions/report/page.js`

**Implementation Details**:

```javascript
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PublicReportPage() {
  // Form state
  const [formData, setFormData] = useState({
    petName: '',
    petSpecies: 'DOG',
    petBreed: '',
    petColor: '',
    petDescription: '',
    city: '',
    state: '',
    zipCode: '',
    lastSeenAt: '',
    lastSeenLandmark: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });

  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [missionNumber, setMissionNumber] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!agreedToTerms) {
      alert('Please agree to the terms before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/public/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'VALIDATION_ERROR') {
          const errorMessages = Object.values(data.details).join(', ');
          throw new Error(errorMessages);
        }
        throw new Error(data.error || 'Failed to submit report');
      }

      setMissionNumber(data.missionNumber);
      setSubmitted(true);
    } catch (err) {
      console.error('Report submission failed:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Report Submitted Successfully!
            </h1>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-lg font-semibold text-blue-900 mb-2">
                Your mission number is:
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {missionNumber}
              </p>
            </div>

            <div className="text-left space-y-3 mb-8">
              <h2 className="font-bold text-gray-900">What happens next:</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>Our volunteer team will review your report within 24 hours</li>
                <li>You'll be contacted at the email or phone number you provided</li>
                <li>Your mission will be made visible to rescue squads in your area</li>
                <li>Community members can help search for your pet</li>
              </ol>
            </div>

            <div className="flex gap-4 justify-center">
              <Link
                href={`/missions/${missionNumber}`}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                View Your Mission
              </Link>
              <Link
                href="/missions/report"
                className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
                onClick={() => {
                  setSubmitted(false);
                  setFormData({
                    petName: '',
                    petSpecies: 'DOG',
                    petBreed: '',
                    petColor: '',
                    petDescription: '',
                    city: '',
                    state: '',
                    zipCode: '',
                    lastSeenAt: '',
                    lastSeenLandmark: '',
                    contactName: '',
                    contactPhone: '',
                    contactEmail: '',
                  });
                  setAgreedToTerms(false);
                }}
              >
                Report Another Pet
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/missions" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Missions
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📝 Report a Lost Pet
          </h1>
          <p className="text-gray-600">
            Our volunteer network will help you search for your lost pet
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800"><strong>Error:</strong> {error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pet Information Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Pet Information
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="petName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Pet Name
                </label>
                <input
                  type="text"
                  id="petName"
                  name="petName"
                  value={formData.petName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Buddy"
                />
              </div>

              <div>
                <label htmlFor="petSpecies" className="block text-sm font-semibold text-gray-700 mb-2">
                  Species <span className="text-red-600">*</span>
                </label>
                <select
                  id="petSpecies"
                  name="petSpecies"
                  value={formData.petSpecies}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DOG">Dog</option>
                  <option value="CAT">Cat</option>
                  <option value="BIRD">Bird</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="petBreed" className="block text-sm font-semibold text-gray-700 mb-2">
                    Breed
                  </label>
                  <input
                    type="text"
                    id="petBreed"
                    name="petBreed"
                    value={formData.petBreed}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Golden Retriever"
                  />
                </div>

                <div>
                  <label htmlFor="petColor" className="block text-sm font-semibold text-gray-700 mb-2">
                    Color
                  </label>
                  <input
                    type="text"
                    id="petColor"
                    name="petColor"
                    value={formData.petColor}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Golden"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="petDescription" className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="petDescription"
                  name="petDescription"
                  value={formData.petDescription}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Include any distinguishing features, collar details, behavior, etc."
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.petDescription.length}/500 characters
                </p>
              </div>
            </div>
          </div>

          {/* Last Seen Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Last Seen
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">
                    City <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Austin"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-2">
                    State <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select State</option>
                    <option value="TX">Texas</option>
                    <option value="WA">Washington</option>
                    <option value="OR">Oregon</option>
                    <option value="CO">Colorado</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="zipCode" className="block text-sm font-semibold text-gray-700 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    id="zipCode"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 78701"
                    maxLength={5}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lastSeenAt" className="block text-sm font-semibold text-gray-700 mb-2">
                  Date & Time Last Seen
                </label>
                <input
                  type="datetime-local"
                  id="lastSeenAt"
                  name="lastSeenAt"
                  value={formData.lastSeenAt}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="lastSeenLandmark" className="block text-sm font-semibold text-gray-700 mb-2">
                  Landmark or Specific Location
                </label>
                <input
                  type="text"
                  id="lastSeenLandmark"
                  name="lastSeenLandmark"
                  value={formData.lastSeenLandmark}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Zilker Park, near the playground"
                />
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Contact Information
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="contactName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="contactName"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Jane Doe"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contactPhone" className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="contactPhone"
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 512-555-1234"
                  />
                </div>

                <div>
                  <label htmlFor="contactEmail" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    id="contactEmail"
                    name="contactEmail"
                    value={formData.contactEmail}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., jane@example.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-sm text-blue-900">
                <strong>By submitting this report, I acknowledge that:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>My information will be reviewed by volunteer staff</li>
                  <li>My contact information may be shared with rescue squads</li>
                  <li>My mission may be published publicly to help find my pet</li>
                  <li>This service is provided as-is with no guarantees</li>
                </ul>
              </div>
            </label>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={submitting || !agreedToTerms}
              className={`w-full px-8 py-4 rounded-lg font-bold text-lg transition-colors ${
                submitting || !agreedToTerms
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {submitting ? 'Submitting Report...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Page accessible at `/missions/report` without authentication
- [ ] Form has sections for Pet Info, Last Seen, Contact
- [ ] Required fields marked with asterisk
- [ ] Species dropdown has DOG, CAT, BIRD, OTHER
- [ ] State dropdown populated
- [ ] Description has 500 char limit with counter
- [ ] Terms checkbox required to enable submit
- [ ] Submit button disabled while submitting
- [ ] Success state shows mission number and next steps
- [ ] Error state shows validation errors clearly
- [ ] "Report Another Pet" resets form
- [ ] All fields map to API request body correctly

**Testing**:
- [ ] Submit form with all required fields
- [ ] Submit form missing required fields (should fail)
- [ ] Submit without agreeing to terms (should alert)
- [ ] Verify success state displays mission number
- [ ] Click "View Your Mission" and verify navigation
- [ ] Click "Report Another Pet" and verify form reset
- [ ] Verify API creates mission with isPublic=false
- [ ] Verify API creates mission with source=PUBLIC_REPORT

**Commit Message**:
```
[Phase 15-16] TASK-P05: Implement public report form

- Created public report form at /missions/report
- Multi-section form: Pet Info, Last Seen, Contact
- Required field validation
- 500 char limit on description
- Terms acknowledgment checkbox
- Success state with mission number
- Error handling with clear messages
- "Report Another Pet" functionality
- Creates missions with isPublic=false, source=PUBLIC_REPORT

Next: TASK-P06 (QA integration and docs)
```

---

## TASK-P06: QA Integration & Documentation

**Goal**: Wire QA tests, update ERROR_IMPACT, and mark phase complete.

**Files to Modify**:
1. `frontend/app/admin/qa/page.js` (add public mission tests)
2. `frontend/app/admin/health/page.jsx` (update ERROR_IMPACT)
3. `VISION.md` (mark Phase 15–16 complete)
4. `docs/features/public-lost-pet-portal-mvp.md` (update status)

**Implementation Details**:

### Update QA Tests

Add public mission tests to `/admin/qa`:

```javascript
// In frontend/app/admin/qa/page.js

// After existing test missions, add:

async function testPublicMissionList() {
  const res = await fetch('/api/public/missions?limit=10');

  if (!res.ok) {
    throw new Error(`List failed: ${res.status}`);
  }

  const { missions, pagination } = await res.json();

  // Verify all missions have isPublic=true (implicitly)
  // Verify no sensitive fields exposed
  if (missions.some(c => c.createdById || c.squadId || c.source)) {
    throw new Error('Sensitive data exposed in public list');
  }

  return { results_count: missions.length, pages: pagination.pages };
}

async function testPublicMissionDetail() {
  // First, create a public test mission via admin
  // For MVP, manually set isPublic=true on a [TEST] mission
  // Then fetch it via public API

  const listRes = await fetch('/api/public/missions?limit=1');
  const { missions } = await listRes.json();

  if (missions.length === 0) {
    throw new Error('No public missions found - create one first');
  }

  const testMission = missions[0];

  const res = await fetch(`/api/public/missions/${testMission.missionNumber}`);

  if (!res.ok) {
    throw new Error(`Detail failed: ${res.status}`);
  }

  const { mission: missionData } = await res.json();

  return { mission_number: missionData.missionNumber, has_contact: !!missionData.contactName };
}

async function testPublicMissionReport() {
  const res = await fetch('/api/public/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      petSpecies: 'DOG',
      petName: '[TEST QA] Public Report Dog',
      city: 'Austin',
      state: 'TX',
      contactName: 'QA Tester',
      contactEmail: 'qa@example.com',
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Report failed: ${error.error}`);
  }

  const { missionNumber, missionId } = await res.json();

  return { mission_number: missionNumber, mission_id: missionId, note: 'Mission created with isPublic=false' };
}

// Then update TestsPanel to include these tests:
const [publicTests, setPublicTests] = useState([
  { id: 'public-list', name: 'Public Mission List', status: 'idle', fn: testPublicMissionList },
  { id: 'public-detail', name: 'Public Mission Detail', status: 'idle', fn: testPublicMissionDetail },
  { id: 'public-report', name: 'Public Report Submission', status: 'idle', fn: testPublicMissionReport },
]);
```

### Update ERROR_IMPACT

In `frontend/app/admin/health/page.jsx`:

```javascript
const ERROR_IMPACT = {
  // ... existing mappings ...

  // Medium severity - public-facing features
  'public_mission.list_failed': { label: 'Public Mission List', severity: 'medium' },
  'public_mission.detail_failed': { label: 'Public Mission Detail', severity: 'medium' },
  'public_mission.report_failed': { label: 'Public Reports', severity: 'medium' },

  // Low severity - successful public interactions
  'public_mission.list_viewed': { label: 'Public Browse', severity: 'low' },
  'public_mission.detail_viewed': { label: 'Public Views', severity: 'low' },
  'public_mission.report_submitted': { label: 'Public Reports', severity: 'low' },
};
```

### Update VISION.md

Add Phase 15–16 section after Phase 20–21:

```markdown
- **🎉 Phase 15–16: Public Lost Pet Mission Portal MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **Public Pages:** Browse lost pets at `/missions`, view details at `/missions/[missionNumber]`
  - **Public Reporting:** Submit lost pet reports via `/missions/report` form
  - **Privacy Controls:** `isPublic` and `publicContactOk` flags control visibility
  - **Data Safety:** Only public-safe fields exposed, no internal IDs or metadata
  - **API Endpoints:** 3 public endpoints (list, detail, report)
    - GET /api/public/missions (filtered list with pagination)
    - GET /api/public/missions/[missionNumber] (detail with privacy controls)
    - POST /api/public/missions (create PUBLIC_REPORT missions)
  - **Observability:** All public interactions emit `public_mission.*` events
  - **QA Tests:** 3 tests added to /admin/qa harness
  - **No Authentication Required:** Public can browse and report without accounts (MVP)
  - **See:** `docs/features/public-lost-pet-portal-mvp.md`
```

### Update Feature Spec Status

In `docs/features/public-lost-pet-portal-mvp.md`, change top section:

```markdown
**Status:** ✅ Fully Implemented
**Last Updated:** November 25, 2025
```

Add Implementation Status section after Summary:

```markdown
## 0.1 Implementation Status

**Implementation Completed:** November 25, 2025

All components of the Public Lost Pet Mission Portal MVP have been fully implemented:

### Backend (TASK-P01, P02)
- ✅ Prisma schema extended with isPublic, publicContactOk, source fields
- ✅ Migration applied successfully
- ✅ All 3 public API endpoints with structured logging:
  - GET /api/public/missions (list with filters)
  - GET /api/public/missions/[missionNumber] (detail with privacy controls)
  - POST /api/public/missions (report submission)

### Frontend (TASK-P03, P04, P05)
- ✅ `/missions` - Public list page with filters and pagination
- ✅ `/missions/[missionNumber]` - Public detail page with conditional contact display
- ✅ `/missions/report` - Public report form with validation
- ✅ Legal disclaimers on all public pages
- ✅ Privacy and safety notices

### Observability (TASK-P06)
- ✅ All public interactions emit `public_mission.*` events
- ✅ Events visible in `/admin/health` Errors tab
- ✅ ERROR_IMPACT updated with public mission event types
- ✅ QA tests added for all 3 public endpoints

### Security & Privacy
- ✅ Only isPublic=true missions visible on public pages
- ✅ Contact info only shown when publicContactOk=true
- ✅ No sensitive internal data exposed (createdById, squadId, source)
- ✅ Public reports create missions with isPublic=false (admin approval required)
```

**Acceptance Criteria**:
- [ ] 3 public mission tests added to `/admin/qa`
- [ ] Tests execute without errors
- [ ] ERROR_IMPACT includes all public_mission.* events
- [ ] VISION.md includes Phase 15–16 section marked COMPLETE
- [ ] Feature spec updated to "Fully Implemented"
- [ ] Implementation Status section added to feature spec
- [ ] All acceptance criteria from previous tasks passing
- [ ] No regressions to existing features

**Testing**:
- [ ] Run all tests in `/admin/qa` (should include new public tests)
- [ ] Browse `/admin/health` Errors tab for public_mission events
- [ ] Verify ERROR_IMPACT labels for public events
- [ ] Smoke test all public pages: /missions, /missions/[missionNumber], /missions/report
- [ ] Smoke test all admin pages: /admin/missions, /admin/health, /admin/qa
- [ ] Verify no regressions to existing functionality

**Commit Message**:
```
[Phase 15-16] TASK-P06: Complete public portal with QA integration and docs

Integration:
- Added 3 public mission tests to /admin/qa
  * Public Mission List (verify no sensitive data exposed)
  * Public Mission Detail (verify privacy controls)
  * Public Report Submission (verify isPublic=false)
- Updated ERROR_IMPACT with public_mission.* events
- All public events visible in admin health

Documentation:
- Updated VISION.md to mark Phase 15–16 COMPLETE
- Added comprehensive Phase 15–16 section
- Updated feature spec to "Fully Implemented"
- Added Implementation Status section

Phase 15–16 COMPLETE: Public Lost Pet Mission Portal MVP fully implemented
- Public can browse lost pets at /missions
- Public can view mission details at /missions/[missionNumber]
- Public can submit reports at /missions/report
- All interactions observable via structured events
- Admin controls for privacy (isPublic, publicContactOk)
- No authentication required (MVP)
```

---

## Testing Checklist

After completing all tasks, verify:

**Functionality (No Regressions):**
- [ ] `/` - Homepage works
- [ ] `/rescue-squads/search` - Squad search works
- [ ] `/admin/health` - All tabs load correctly
- [ ] `/admin/missions` - Mission list works (internal)
- [ ] `/admin/missions/new` - Mission creation works (internal)
- [ ] `/admin/qa` - QA harness works with all existing tests
- [ ] `/legal/consent` - Legal acceptance works

**New Public Features:**
- [ ] `/missions` - Public list loads and filters work
- [ ] `/missions/[missionNumber]` - Public detail shows for isPublic=true missions
- [ ] `/missions/[missionNumber]` - Returns 404 for isPublic=false missions
- [ ] `/missions/report` - Form submission creates PUBLIC_REPORT mission
- [ ] Contact info only shows when publicContactOk=true
- [ ] All public pages work without authentication

**Observability:**
- [ ] Public list views emit public_mission.list_viewed
- [ ] Public detail views emit public_mission.detail_viewed
- [ ] Public reports emit public_mission.report_submitted
- [ ] Failures emit public_mission.*_failed events
- [ ] All events visible in /admin/health Errors tab

---

## Commit Strategy

Small, focused commits for each task:

1. `[Phase 15-16] TASK-P01: Add public flags to LostPetMission schema`
2. `[Phase 15-16] TASK-P02: Implement public mission API endpoints`
3. `[Phase 15-16] TASK-P03: Implement public mission list page`
4. `[Phase 15-16] TASK-P04: Implement public mission detail page`
5. `[Phase 15-16] TASK-P05: Implement public report form`
6. `[Phase 15-16] TASK-P06: Complete public portal with QA integration and docs`

Push after each task to ensure progress is saved.

---

**End of Task Breakdown**
