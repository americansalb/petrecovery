# Public Lost Pet Case Portal MVP - Task Breakdown (Phase 15–16)

**Feature Spec:** `docs/features/public-lost-pet-portal-mvp.md`
**Status:** Ready for Implementation
**Goal:** Build public-facing portal for browsing lost pet cases and submitting reports

---

## Overview

This document breaks down Phase 15–16 (Public Lost Pet Case Portal MVP) into 6 focused tasks:

- **TASK-P01**: Prisma Schema & Migration for Public Flags
- **TASK-P02**: Public Case API Endpoints
- **TASK-P03**: Public Case List Page (`/cases`)
- **TASK-P04**: Public Case Detail Page (`/cases/[caseNumber]`)
- **TASK-P05**: Public Report Form (`/cases/report`)
- **TASK-P06**: QA Integration & Documentation

Each task is designed to be:
- **Small enough** to complete in one focused session
- **Testable** via browser smoke test
- **Committable** with clear acceptance criteria
- **Independent** but building on previous tasks

---

## TASK-P01: Prisma Schema & Migration for Public Flags

**Goal**: Add `isPublic`, `publicContactOk`, and `source` fields to `LostPetCase` model.

**Files to Modify**:
- `frontend/prisma/schema.prisma`

**Changes**:

### Update LostPetCase Model

Add three new fields to the existing `LostPetCase` model:

```prisma
model LostPetCase {
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
| `isPublic` | Boolean | `false` | Controls whether case appears on public pages. Admins must explicitly set to `true`. |
| `publicContactOk` | Boolean | `false` | Controls whether contact info (name, phone, email) is shown on public detail page. |
| `source` | String | `"ADMIN"` | Tracks how case was created: `"ADMIN"` or `"PUBLIC_REPORT"`. |

### Migration Strategy

**Option 1: Manual Migration SQL** (Recommended for production safety)

Create new migration file:
`frontend/prisma/migrations/20251125_add_public_flags_to_cases/migration.sql`

```sql
-- Add public visibility fields to LostPetCase
ALTER TABLE "LostPetCase"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicContactOk" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'ADMIN';

-- Add index for faster public case queries
CREATE INDEX "LostPetCase_isPublic_status_idx" ON "LostPetCase"("isPublic", "status");

-- Add comment for documentation
COMMENT ON COLUMN "LostPetCase"."isPublic" IS 'Whether this case is visible on public-facing pages';
COMMENT ON COLUMN "LostPetCase"."publicContactOk" IS 'Whether to show contact information publicly';
COMMENT ON COLUMN "LostPetCase"."source" IS 'Case source: ADMIN or PUBLIC_REPORT';
```

**Option 2: Prisma CLI** (if available)

```bash
cd frontend
npx prisma migrate dev --name add_public_flags_to_cases
```

### Rollback Plan

If migration needs to be reversed:

```sql
-- Drop index first
DROP INDEX IF EXISTS "LostPetCase_isPublic_status_idx";

-- Drop columns
ALTER TABLE "LostPetCase"
  DROP COLUMN IF EXISTS "isPublic",
  DROP COLUMN IF EXISTS "publicContactOk",
  DROP COLUMN IF EXISTS "source";
```

**Acceptance Criteria**:
- [ ] `isPublic` field added to LostPetCase (Boolean, default false)
- [ ] `publicContactOk` field added to LostPetCase (Boolean, default false)
- [ ] `source` field added to LostPetCase (String, default "ADMIN")
- [ ] Index created for efficient public case queries
- [ ] Migration applied successfully
- [ ] All existing cases have isPublic=false (safe default)
- [ ] No breaking changes to existing Phase 13–14 features
- [ ] Prisma schema formatted correctly

**Testing**:
- [ ] Verify migration applied: Check database schema
- [ ] Verify existing cases unchanged: Query shows isPublic=false
- [ ] Verify `/admin/cases` still works (no regression)

**Commit Message**:
```
[Phase 15-16] TASK-P01: Add public flags to LostPetCase schema

- Added isPublic (Boolean, default false)
- Added publicContactOk (Boolean, default false)
- Added source (String, default "ADMIN")
- Added compound index on (isPublic, status)
- All existing cases default to isPublic=false (safe)
- No breaking changes to Phase 13-14 functionality
```

---

## TASK-P02: Public Case API Endpoints

**Goal**: Implement 3 public-facing API endpoints with structured logging.

**Files to Create**:
1. `frontend/app/api/public/cases/route.js` (GET list, POST report)
2. `frontend/app/api/public/cases/[caseNumber]/route.js` (GET detail)

**Implementation Details**:

### Endpoint 1: GET /api/public/cases (List)

File: `frontend/app/api/public/cases/route.js`

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
      isPublic: true, // CRITICAL: Only show public cases
    };

    if (city) where.city = city;
    if (state) where.state = state;
    if (status) where.status = status;
    if (species) where.petSpecies = species;

    // Execute query with pagination
    const [cases, total] = await Promise.all([
      prisma.lostPetCase.findMany({
        where,
        select: {
          id: true,
          caseNumber: true,
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
      prisma.lostPetCase.count({ where }),
    ]);

    // Log successful view
    await logEvent({
      event_type: 'public_case.list_viewed',
      resource_type: 'lost_pet_case',
      action: 'list',
      result: 'success',
      actor_user_id: null,
      actor_role: 'public',
      metadata: {
        city,
        state,
        status,
        species,
        results_count: cases.length,
        page,
        limit,
      },
    });

    return NextResponse.json({
      cases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Public case list failed:', error);

    // Log failure
    await logEvent({
      event_type: 'public_case.list_failed',
      resource_type: 'lost_pet_case',
      action: 'list',
      result: 'failure',
      actor_user_id: null,
      actor_role: 'public',
      error_message: error.message,
      metadata: { city, state, status, species },
    });

    return NextResponse.json(
      { error: 'Failed to load cases', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

### Endpoint 2: GET /api/public/cases/[caseNumber] (Detail)

File: `frontend/app/api/public/cases/[caseNumber]/route.js`

```javascript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logEvent } from '@/lib/logging';

export async function GET(request, { params }) {
  const { caseNumber } = params;

  try {
    // Find case by case number
    const caseData = await prisma.lostPetCase.findUnique({
      where: { caseNumber },
      select: {
        id: true,
        caseNumber: true,
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

    // Check if case exists and is public
    if (!caseData || !caseData.isPublic) {
      await logEvent({
        event_type: 'public_case.detail_failed',
        resource_type: 'lost_pet_case',
        action: 'read',
        result: 'failure',
        actor_user_id: null,
        actor_role: 'public',
        error_message: 'Case not found or not public',
        metadata: { case_number: caseNumber, error_code: 'CASE_NOT_FOUND' },
      });

      return NextResponse.json(
        { error: 'Case not found or not public', code: 'CASE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Strip contact info if not allowed
    const response = { ...caseData };
    if (!caseData.publicContactOk) {
      delete response.contactName;
      delete response.contactPhone;
      delete response.contactEmail;
    }

    // Remove internal flags from response
    delete response.isPublic;
    delete response.publicContactOk;

    // Log successful view
    await logEvent({
      event_type: 'public_case.detail_viewed',
      resource_type: 'lost_pet_case',
      resource_id: caseData.id,
      action: 'read',
      result: 'success',
      actor_user_id: null,
      actor_role: 'public',
      metadata: {
        case_number: caseNumber,
        case_id: caseData.id,
        has_contact_info: caseData.publicContactOk,
      },
    });

    return NextResponse.json({ case: response });
  } catch (error) {
    console.error('Public case detail failed:', error);

    await logEvent({
      event_type: 'public_case.detail_failed',
      resource_type: 'lost_pet_case',
      action: 'read',
      result: 'failure',
      actor_user_id: null,
      actor_role: 'public',
      error_message: error.message,
      metadata: { case_number: caseNumber },
    });

    return NextResponse.json(
      { error: 'Failed to load case', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

### Endpoint 3: POST /api/public/cases (Report)

Add to `frontend/app/api/public/cases/route.js`:

```javascript
export async function POST(request) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['petSpecies', 'city', 'state', 'contactName', 'contactEmail'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      await logEvent({
        event_type: 'public_case.report_failed',
        resource_type: 'lost_pet_case',
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

    // Generate case number (reuse logic from Phase 13-14)
    const cityCode = body.city.substring(0, 3).toUpperCase();
    const year = new Date().getFullYear();

    const existingCases = await prisma.lostPetCase.count({
      where: {
        caseNumber: { startsWith: `${cityCode}-${year}-` },
      },
    });
    const sequence = (existingCases + 1).toString().padStart(4, '0');
    const caseNumber = `${cityCode}-${year}-${sequence}`;

    // Create case with PUBLIC_REPORT source
    const newCase = await prisma.lostPetCase.create({
      data: {
        caseNumber,
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
      event_type: 'public_case.report_submitted',
      resource_type: 'lost_pet_case',
      resource_id: newCase.id,
      action: 'create',
      result: 'success',
      actor_user_id: null,
      actor_role: 'public',
      metadata: {
        case_number: caseNumber,
        case_id: newCase.id,
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
        caseNumber: newCase.caseNumber,
        caseId: newCase.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Public case report failed:', error);

    await logEvent({
      event_type: 'public_case.report_failed',
      resource_type: 'lost_pet_case',
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
- [ ] GET /api/public/cases returns only isPublic=true cases
- [ ] GET /api/public/cases supports city, state, status, species filters
- [ ] GET /api/public/cases paginates correctly
- [ ] GET /api/public/cases/[caseNumber] returns case details
- [ ] GET /api/public/cases/[caseNumber] shows contact only if publicContactOk=true
- [ ] GET /api/public/cases/[caseNumber] returns 404 for non-public cases
- [ ] POST /api/public/cases creates case with source=PUBLIC_REPORT
- [ ] POST /api/public/cases creates case with isPublic=false
- [ ] POST /api/public/cases validates required fields
- [ ] All endpoints emit structured events (public_case.*)
- [ ] All events logged with actor_role='public'
- [ ] Error responses include clear codes and messages

**Testing**:
- [ ] Test GET /api/public/cases with various filters
- [ ] Test GET /api/public/cases/[caseNumber] for public and non-public cases
- [ ] Test POST /api/public/cases with valid and invalid data
- [ ] Verify events appear in EventLog table
- [ ] Verify no sensitive data exposed (createdById, squadId)

**Commit Message**:
```
[Phase 15-16] TASK-P02: Implement public case API endpoints

Endpoints:
- GET /api/public/cases (list with filters and pagination)
- GET /api/public/cases/[caseNumber] (detail with privacy controls)
- POST /api/public/cases (report lost pet, creates PUBLIC_REPORT)

Security:
- Only isPublic=true cases visible in list
- Contact info only shown if publicContactOk=true
- All requests logged with public_case.* events
- No sensitive internal data exposed

Next: TASK-P03 (Public list page UI)
```

---

## TASK-P03: Public Case List Page (`/cases`)

**Goal**: Build public-facing list page with filters and pagination.

**Files to Create**:
- `frontend/app/cases/page.js`

**Implementation Details**:

```javascript
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PublicCasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state from URL
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [state, setState] = useState(searchParams.get('state') || '');
  const [species, setSpecies] = useState(searchParams.get('species') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

  // Data state
  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch cases when filters or page changes
  useEffect(() => {
    fetchCases();
  }, [city, state, species, status, page]);

  const fetchCases = async () => {
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

      const res = await fetch(`/api/public/cases?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to load cases');
      }

      const data = await res.json();
      setCases(data.cases);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching cases:', err);
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

    router.push(`/cases?${params.toString()}`);
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
            <div className="text-gray-600">Loading cases...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchCases}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Cases List */}
        {!loading && !error && cases.length === 0 && (
          <div className="bg-white rounded-lg p-12 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <div className="text-lg font-medium text-gray-900 mb-2">
              No cases found
            </div>
            <div className="text-sm text-gray-600">
              Try adjusting your filters or check back later.
            </div>
          </div>
        )}

        {!loading && !error && cases.length > 0 && (
          <div className="space-y-4">
            {cases.map(caseData => (
              <CaseCard key={caseData.id} caseData={caseData} />
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

function CaseCard({ caseData }) {
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
    <Link href={`/cases/${caseData.caseNumber}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{speciesEmoji[caseData.petSpecies]}</span>
              <h3 className="text-xl font-bold text-gray-900">
                {caseData.petName || 'Unknown Pet'} - {caseData.petBreed || caseData.petSpecies}
              </h3>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
              <span>{caseData.city}, {caseData.state}</span>
              <span>•</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[caseData.status]}`}>
                {caseData.status.replace('_', ' ')}
              </span>
              <span>•</span>
              <span>{timeAgo(caseData.createdAt)}</span>
            </div>

            {caseData.lastSeenLandmark && (
              <p className="text-sm text-gray-700">
                <strong>Last seen:</strong> {caseData.lastSeenLandmark}
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
- [ ] Page accessible at `/cases` without authentication
- [ ] Hero section displays clear messaging
- [ ] Filter controls work for city, state, species, status
- [ ] Search button updates URL params and refetches
- [ ] Case cards display pet info, location, status
- [ ] Case cards link to `/cases/[caseNumber]`
- [ ] Pagination works correctly
- [ ] Loading state shows while fetching
- [ ] Empty state shows when no results
- [ ] Error state shows on fetch failure
- [ ] Disclaimer text visible
- [ ] Only isPublic=true cases appear

**Testing**:
- [ ] Load `/cases` and verify cases display
- [ ] Test each filter individually
- [ ] Test filter combinations
- [ ] Click pagination buttons
- [ ] Click case card and verify navigation
- [ ] Test with no filters (all cases)
- [ ] Test with filters that return 0 results

**Commit Message**:
```
[Phase 15-16] TASK-P03: Implement public case list page

- Created public-facing list page at /cases
- Hero section with clear messaging
- Filters: city, state, species, status
- Pagination with page controls
- Case cards showing key info and status pills
- Loading, error, and empty states
- Links to detail pages
- Community service disclaimer

Next: TASK-P04 (Case detail page)
```

---

## TASK-P04: Public Case Detail Page (`/cases/[caseNumber]`)

**Goal**: Build public detail page with privacy controls.

**Files to Create**:
- `frontend/app/cases/[caseNumber]/page.js`

**Implementation Details**:

```javascript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PublicCaseDetailPage() {
  const { caseNumber } = useParams();
  const router = useRouter();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCase();
  }, [caseNumber]);

  const fetchCase = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/cases/${caseNumber}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Case not found or not public');
        }
        throw new Error('Failed to load case');
      }

      const data = await res.json();
      setCaseData(data.case);
    } catch (err) {
      console.error('Error fetching case:', err);
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
        <div className="text-gray-600">Loading case...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="text-4xl mb-4">😞</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Case Not Found
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/cases"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 inline-block"
          >
            Browse All Cases
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
        <Link href="/cases" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Cases
        </Link>

        {/* Case Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {caseData.petName || 'Unknown Pet'}
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  Case #{caseData.caseNumber}
                </span>
                <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${statusColors[caseData.status]}`}>
                  {caseData.status.replace('_', ' ')}
                </span>
                {caseData.isUrgent && (
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
              📋 Share This Case
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
              <p className="text-gray-900">{caseData.petSpecies}</p>
            </div>

            {caseData.petBreed && (
              <div>
                <label className="text-sm font-semibold text-gray-700">Breed:</label>
                <p className="text-gray-900">{caseData.petBreed}</p>
              </div>
            )}

            {caseData.petColor && (
              <div>
                <label className="text-sm font-semibold text-gray-700">Color:</label>
                <p className="text-gray-900">{caseData.petColor}</p>
              </div>
            )}

            {caseData.petDescription && (
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">Description:</label>
                <p className="text-gray-900">{caseData.petDescription}</p>
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
            {caseData.lastSeenAt && (
              <div>
                <label className="text-sm font-semibold text-gray-700">Date & Time:</label>
                <p className="text-gray-900">
                  {new Date(caseData.lastSeenAt).toLocaleString()}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-700">Location:</label>
              <p className="text-gray-900">
                {caseData.city}, {caseData.state} {caseData.zipCode}
              </p>
            </div>

            {caseData.lastSeenLandmark && (
              <div>
                <label className="text-sm font-semibold text-gray-700">Landmark:</label>
                <p className="text-gray-900">{caseData.lastSeenLandmark}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information (conditional) */}
        {(caseData.contactName || caseData.contactPhone || caseData.contactEmail) && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-green-900 mb-4">
              Contact Information
            </h2>

            <div className="space-y-2">
              {caseData.contactName && (
                <div>
                  <label className="text-sm font-semibold text-green-800">Name:</label>
                  <p className="text-green-900">{caseData.contactName}</p>
                </div>
              )}

              {caseData.contactPhone && (
                <div>
                  <label className="text-sm font-semibold text-green-800">Phone:</label>
                  <p className="text-green-900">
                    <a href={`tel:${caseData.contactPhone}`} className="hover:underline">
                      {caseData.contactPhone}
                    </a>
                  </p>
                </div>
              )}

              {caseData.contactEmail && (
                <div>
                  <label className="text-sm font-semibold text-green-800">Email:</label>
                  <p className="text-green-900">
                    <a href={`mailto:${caseData.contactEmail}`} className="hover:underline">
                      {caseData.contactEmail}
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
- [ ] Page accessible at `/cases/[caseNumber]` without authentication
- [ ] Shows all pet information (name, species, breed, color, description)
- [ ] Shows last seen location and landmark
- [ ] Shows contact info only if available in API response
- [ ] Privacy notice shows when contact info present
- [ ] Safety disclaimer always visible
- [ ] Share button copies URL to clipboard
- [ ] Back link navigates to `/cases`
- [ ] 404 page for non-existent or non-public cases
- [ ] Loading state while fetching
- [ ] Status pill color-coded correctly
- [ ] Urgent badge shows when isUrgent=true

**Testing**:
- [ ] Navigate to detail page from list page
- [ ] Test with case that has contact info (publicContactOk=true)
- [ ] Test with case that has NO contact info (publicContactOk=false)
- [ ] Test with non-existent case number (should 404)
- [ ] Test with case that has isPublic=false (should 404)
- [ ] Click Share button and verify clipboard
- [ ] Verify all disclaimers visible

**Commit Message**:
```
[Phase 15-16] TASK-P04: Implement public case detail page

- Created detail page at /cases/[caseNumber]
- Shows pet info, location, last seen details
- Conditionally renders contact info based on API
- Privacy and safety disclaimers
- Share button to copy URL
- 404 handling for non-public cases
- Status pills and urgent badge
- Back link to list page

Next: TASK-P05 (Public report form)
```

---

## TASK-P05: Public Report Form (`/cases/report`)

**Goal**: Build public form for submitting lost pet reports.

**Files to Create**:
- `frontend/app/cases/report/page.js`

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
  const [caseNumber, setCaseNumber] = useState(null);

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
      const res = await fetch('/api/public/cases', {
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

      setCaseNumber(data.caseNumber);
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
                Your case number is:
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {caseNumber}
              </p>
            </div>

            <div className="text-left space-y-3 mb-8">
              <h2 className="font-bold text-gray-900">What happens next:</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>Our volunteer team will review your report within 24 hours</li>
                <li>You'll be contacted at the email or phone number you provided</li>
                <li>Your case will be made visible to rescue squads in your area</li>
                <li>Community members can help search for your pet</li>
              </ol>
            </div>

            <div className="flex gap-4 justify-center">
              <Link
                href={`/cases/${caseNumber}`}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                View Your Case
              </Link>
              <Link
                href="/cases/report"
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
          <Link href="/cases" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Cases
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
                  <li>My case may be published publicly to help find my pet</li>
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
- [ ] Page accessible at `/cases/report` without authentication
- [ ] Form has sections for Pet Info, Last Seen, Contact
- [ ] Required fields marked with asterisk
- [ ] Species dropdown has DOG, CAT, BIRD, OTHER
- [ ] State dropdown populated
- [ ] Description has 500 char limit with counter
- [ ] Terms checkbox required to enable submit
- [ ] Submit button disabled while submitting
- [ ] Success state shows case number and next steps
- [ ] Error state shows validation errors clearly
- [ ] "Report Another Pet" resets form
- [ ] All fields map to API request body correctly

**Testing**:
- [ ] Submit form with all required fields
- [ ] Submit form missing required fields (should fail)
- [ ] Submit without agreeing to terms (should alert)
- [ ] Verify success state displays case number
- [ ] Click "View Your Case" and verify navigation
- [ ] Click "Report Another Pet" and verify form reset
- [ ] Verify API creates case with isPublic=false
- [ ] Verify API creates case with source=PUBLIC_REPORT

**Commit Message**:
```
[Phase 15-16] TASK-P05: Implement public report form

- Created public report form at /cases/report
- Multi-section form: Pet Info, Last Seen, Contact
- Required field validation
- 500 char limit on description
- Terms acknowledgment checkbox
- Success state with case number
- Error handling with clear messages
- "Report Another Pet" functionality
- Creates cases with isPublic=false, source=PUBLIC_REPORT

Next: TASK-P06 (QA integration and docs)
```

---

## TASK-P06: QA Integration & Documentation

**Goal**: Wire QA tests, update ERROR_IMPACT, and mark phase complete.

**Files to Modify**:
1. `frontend/app/admin/qa/page.js` (add public case tests)
2. `frontend/app/admin/health/page.jsx` (update ERROR_IMPACT)
3. `VISION.md` (mark Phase 15–16 complete)
4. `docs/features/public-lost-pet-portal-mvp.md` (update status)

**Implementation Details**:

### Update QA Tests

Add public case tests to `/admin/qa`:

```javascript
// In frontend/app/admin/qa/page.js

// After existing test cases, add:

async function testPublicCaseList() {
  const res = await fetch('/api/public/cases?limit=10');

  if (!res.ok) {
    throw new Error(`List failed: ${res.status}`);
  }

  const { cases, pagination } = await res.json();

  // Verify all cases have isPublic=true (implicitly)
  // Verify no sensitive fields exposed
  if (cases.some(c => c.createdById || c.squadId || c.source)) {
    throw new Error('Sensitive data exposed in public list');
  }

  return { results_count: cases.length, pages: pagination.pages };
}

async function testPublicCaseDetail() {
  // First, create a public test case via admin
  // For MVP, manually set isPublic=true on a [TEST] case
  // Then fetch it via public API

  const listRes = await fetch('/api/public/cases?limit=1');
  const { cases } = await listRes.json();

  if (cases.length === 0) {
    throw new Error('No public cases found - create one first');
  }

  const testCase = cases[0];

  const res = await fetch(`/api/public/cases/${testCase.caseNumber}`);

  if (!res.ok) {
    throw new Error(`Detail failed: ${res.status}`);
  }

  const { case: caseData } = await res.json();

  return { case_number: caseData.caseNumber, has_contact: !!caseData.contactName };
}

async function testPublicCaseReport() {
  const res = await fetch('/api/public/cases', {
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

  const { caseNumber, caseId } = await res.json();

  return { case_number: caseNumber, case_id: caseId, note: 'Case created with isPublic=false' };
}

// Then update TestsPanel to include these tests:
const [publicTests, setPublicTests] = useState([
  { id: 'public-list', name: 'Public Case List', status: 'idle', fn: testPublicCaseList },
  { id: 'public-detail', name: 'Public Case Detail', status: 'idle', fn: testPublicCaseDetail },
  { id: 'public-report', name: 'Public Report Submission', status: 'idle', fn: testPublicCaseReport },
]);
```

### Update ERROR_IMPACT

In `frontend/app/admin/health/page.jsx`:

```javascript
const ERROR_IMPACT = {
  // ... existing mappings ...

  // Medium severity - public-facing features
  'public_case.list_failed': { label: 'Public Case List', severity: 'medium' },
  'public_case.detail_failed': { label: 'Public Case Detail', severity: 'medium' },
  'public_case.report_failed': { label: 'Public Reports', severity: 'medium' },

  // Low severity - successful public interactions
  'public_case.list_viewed': { label: 'Public Browse', severity: 'low' },
  'public_case.detail_viewed': { label: 'Public Views', severity: 'low' },
  'public_case.report_submitted': { label: 'Public Reports', severity: 'low' },
};
```

### Update VISION.md

Add Phase 15–16 section after Phase 20–21:

```markdown
- **🎉 Phase 15–16: Public Lost Pet Case Portal MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **Public Pages:** Browse lost pets at `/cases`, view details at `/cases/[caseNumber]`
  - **Public Reporting:** Submit lost pet reports via `/cases/report` form
  - **Privacy Controls:** `isPublic` and `publicContactOk` flags control visibility
  - **Data Safety:** Only public-safe fields exposed, no internal IDs or metadata
  - **API Endpoints:** 3 public endpoints (list, detail, report)
    - GET /api/public/cases (filtered list with pagination)
    - GET /api/public/cases/[caseNumber] (detail with privacy controls)
    - POST /api/public/cases (create PUBLIC_REPORT cases)
  - **Observability:** All public interactions emit `public_case.*` events
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

All components of the Public Lost Pet Case Portal MVP have been fully implemented:

### Backend (TASK-P01, P02)
- ✅ Prisma schema extended with isPublic, publicContactOk, source fields
- ✅ Migration applied successfully
- ✅ All 3 public API endpoints with structured logging:
  - GET /api/public/cases (list with filters)
  - GET /api/public/cases/[caseNumber] (detail with privacy controls)
  - POST /api/public/cases (report submission)

### Frontend (TASK-P03, P04, P05)
- ✅ `/cases` - Public list page with filters and pagination
- ✅ `/cases/[caseNumber]` - Public detail page with conditional contact display
- ✅ `/cases/report` - Public report form with validation
- ✅ Legal disclaimers on all public pages
- ✅ Privacy and safety notices

### Observability (TASK-P06)
- ✅ All public interactions emit `public_case.*` events
- ✅ Events visible in `/admin/health` Errors tab
- ✅ ERROR_IMPACT updated with public case event types
- ✅ QA tests added for all 3 public endpoints

### Security & Privacy
- ✅ Only isPublic=true cases visible on public pages
- ✅ Contact info only shown when publicContactOk=true
- ✅ No sensitive internal data exposed (createdById, squadId, source)
- ✅ Public reports create cases with isPublic=false (admin approval required)
```

**Acceptance Criteria**:
- [ ] 3 public case tests added to `/admin/qa`
- [ ] Tests execute without errors
- [ ] ERROR_IMPACT includes all public_case.* events
- [ ] VISION.md includes Phase 15–16 section marked COMPLETE
- [ ] Feature spec updated to "Fully Implemented"
- [ ] Implementation Status section added to feature spec
- [ ] All acceptance criteria from previous tasks passing
- [ ] No regressions to existing features

**Testing**:
- [ ] Run all tests in `/admin/qa` (should include new public tests)
- [ ] Browse `/admin/health` Errors tab for public_case events
- [ ] Verify ERROR_IMPACT labels for public events
- [ ] Smoke test all public pages: /cases, /cases/[caseNumber], /cases/report
- [ ] Smoke test all admin pages: /admin/cases, /admin/health, /admin/qa
- [ ] Verify no regressions to existing functionality

**Commit Message**:
```
[Phase 15-16] TASK-P06: Complete public portal with QA integration and docs

Integration:
- Added 3 public case tests to /admin/qa
  * Public Case List (verify no sensitive data exposed)
  * Public Case Detail (verify privacy controls)
  * Public Report Submission (verify isPublic=false)
- Updated ERROR_IMPACT with public_case.* events
- All public events visible in admin health

Documentation:
- Updated VISION.md to mark Phase 15–16 COMPLETE
- Added comprehensive Phase 15–16 section
- Updated feature spec to "Fully Implemented"
- Added Implementation Status section

Phase 15–16 COMPLETE: Public Lost Pet Case Portal MVP fully implemented
- Public can browse lost pets at /cases
- Public can view case details at /cases/[caseNumber]
- Public can submit reports at /cases/report
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
- [ ] `/admin/cases` - Case list works (internal)
- [ ] `/admin/cases/new` - Case creation works (internal)
- [ ] `/admin/qa` - QA harness works with all existing tests
- [ ] `/legal/consent` - Legal acceptance works

**New Public Features:**
- [ ] `/cases` - Public list loads and filters work
- [ ] `/cases/[caseNumber]` - Public detail shows for isPublic=true cases
- [ ] `/cases/[caseNumber]` - Returns 404 for isPublic=false cases
- [ ] `/cases/report` - Form submission creates PUBLIC_REPORT case
- [ ] Contact info only shows when publicContactOk=true
- [ ] All public pages work without authentication

**Observability:**
- [ ] Public list views emit public_case.list_viewed
- [ ] Public detail views emit public_case.detail_viewed
- [ ] Public reports emit public_case.report_submitted
- [ ] Failures emit public_case.*_failed events
- [ ] All events visible in /admin/health Errors tab

---

## Commit Strategy

Small, focused commits for each task:

1. `[Phase 15-16] TASK-P01: Add public flags to LostPetCase schema`
2. `[Phase 15-16] TASK-P02: Implement public case API endpoints`
3. `[Phase 15-16] TASK-P03: Implement public case list page`
4. `[Phase 15-16] TASK-P04: Implement public case detail page`
5. `[Phase 15-16] TASK-P05: Implement public report form`
6. `[Phase 15-16] TASK-P06: Complete public portal with QA integration and docs`

Push after each task to ensure progress is saved.

---

**End of Task Breakdown**
