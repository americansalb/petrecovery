# Public Case Portal Tasks (Phase 15–16)

**Feature Spec:** [docs/features/public-lost-pet-portal-mvp.md](features/public-lost-pet-portal-mvp.md)
**Status:** IN PROGRESS
**Last Updated:** 2025-11-25

---

## Task Overview

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| TASK-P01 | Schema updates for public visibility flags | TODO | HIGH |
| TASK-P02 | Create logging helper module | TODO | HIGH |
| TASK-P03 | GET /api/public/cases endpoint | TODO | HIGH |
| TASK-P04 | GET /api/public/cases/[caseNumber] endpoint | TODO | HIGH |
| TASK-P05 | POST /api/public/cases endpoint | TODO | HIGH |
| TASK-P06 | /cases public listing page | TODO | HIGH |
| TASK-P07 | /cases/[caseNumber] public detail page | TODO | HIGH |
| TASK-P08 | /cases/report public submission form | TODO | HIGH |
| TASK-P09 | QA harness tests for public portal | TODO | MEDIUM |
| TASK-P10 | ERROR_IMPACT health dashboard entries | TODO | MEDIUM |
| TASK-P11 | Update VISION.md with completion status | TODO | LOW |

---

## TASK-P01: Schema Updates for Public Visibility Flags

**Goal:** Add public visibility control fields to the Case model.

**Files:**
- `frontend/prisma/schema.prisma`

**Implementation:**

Add to Case model:
```prisma
model Case {
  // ... existing fields ...

  // Public Visibility (Phase 15-16)
  isPublic          Boolean  @default(true)
  publicContactOk   Boolean  @default(true)
  publicPhoneVisible Boolean @default(false)
  publicEmailVisible Boolean @default(false)
}
```

**Steps:**
1. Edit schema.prisma to add new fields
2. Run `npx prisma generate` to update client
3. Run `npx prisma migrate dev --name add-public-visibility` (development)
4. For production: `npx prisma migrate deploy`

**Acceptance Criteria:**
- [ ] Four new boolean fields added to Case model
- [ ] Prisma client generates without errors
- [ ] Migration runs successfully

---

## TASK-P02: Create Logging Helper Module

**Goal:** Create standardized logging module for structured event logging.

**Files:**
- `frontend/app/lib/logging.js` (new)

**Implementation:**

```javascript
// lib/logging.js

/**
 * Log a structured event
 * @param {string} event - Event name (e.g., "public_case.list_viewed")
 * @param {object} data - Event data
 */
export function logEvent(event, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

/**
 * Log an error event
 * @param {string} event - Error event name
 * @param {Error} error - Error object
 * @param {object} context - Additional context
 */
export function logError(event, error, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    error: {
      message: error.message,
      stack: error.stack,
    },
    ...context,
  };
  console.error(JSON.stringify(entry));
}
```

**Acceptance Criteria:**
- [ ] logging.js module created
- [ ] logEvent function logs JSON to console
- [ ] logError function logs error details

---

## TASK-P03: GET /api/public/cases Endpoint

**Goal:** Create public endpoint to list lost pet cases.

**Files:**
- `frontend/app/api/public/cases/route.js` (new)

**Implementation:**

```javascript
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/app/lib/logging';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const city = searchParams.get('city');
  const state = searchParams.get('state');
  const species = searchParams.get('species');
  const status = searchParams.get('status') || 'ACTIVE';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const where = {
      isPublic: true,
      reportType: 'LOST',
      status: status,
    };

    if (species) where.petSpecies = species;
    // Add city/state filtering based on lastSeenAddress

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        select: {
          caseNumber: true,
          petName: true,
          petSpecies: true,
          petBreed: true,
          petColor: true,
          petPhotoUrl: true,
          lastSeenAddress: true,
          lastSeenAt: true,
          status: true,
          hasReward: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.case.count({ where }),
    ]);

    logEvent('public_case.list_viewed', {
      filters: { city, state, species, status },
      resultCount: cases.length,
      total,
    });

    return NextResponse.json({ cases, total, limit, offset });
  } catch (error) {
    logEvent('public_case.list_failed', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to load cases' },
      { status: 500 }
    );
  }
}
```

**Acceptance Criteria:**
- [ ] Endpoint returns only isPublic=true cases
- [ ] Filters by species, status work
- [ ] Pagination with limit/offset works
- [ ] Response includes total count
- [ ] Events logged for success and failure

---

## TASK-P04: GET /api/public/cases/[caseNumber] Endpoint

**Goal:** Create public endpoint to view case details.

**Files:**
- `frontend/app/api/public/cases/[caseNumber]/route.js` (new)

**Implementation:**

```javascript
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/app/lib/logging';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { caseNumber } = params;

  try {
    const caseData = await prisma.case.findFirst({
      where: {
        caseNumber,
        isPublic: true,
      },
      select: {
        caseNumber: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petColor: true,
        petSize: true,
        petPhotoUrl: true,
        petDescription: true,
        lastSeenAt: true,
        lastSeenAddress: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        escapeScenario: true,
        status: true,
        hasReward: true,
        rewardAmount: true,
        publicContactOk: true,
        publicPhoneVisible: true,
        publicEmailVisible: true,
        ownerName: true,
        ownerPhone: true,
        ownerEmail: true,
        createdAt: true,
        sightings: {
          select: {
            address: true,
            sightedAt: true,
            certaintyLevel: true,
          },
          orderBy: { sightedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: 'Case not found or not public' },
        { status: 404 }
      );
    }

    // Apply privacy rules
    const response = {
      ...caseData,
      ownerFirstName: caseData.ownerName?.split(' ')[0],
      ownerPhone: caseData.publicPhoneVisible ? caseData.ownerPhone : null,
      ownerEmail: caseData.publicEmailVisible ? caseData.ownerEmail : null,
    };
    delete response.ownerName;

    logEvent('public_case.detail_viewed', { caseNumber });

    return NextResponse.json(response);
  } catch (error) {
    logEvent('public_case.detail_failed', { caseNumber, error: error.message });
    return NextResponse.json(
      { error: 'Failed to load case' },
      { status: 500 }
    );
  }
}
```

**Acceptance Criteria:**
- [ ] Returns 404 for non-public cases
- [ ] Privacy fields respected (phone/email visibility)
- [ ] Includes recent sightings
- [ ] Events logged

---

## TASK-P05: POST /api/public/cases Endpoint

**Goal:** Create endpoint for public case submission.

**Files:**
- `frontend/app/api/public/cases/route.js` (add POST handler)

**Implementation:**

Add POST handler to existing route.js:

```javascript
export async function POST(request) {
  logEvent('public_case.report_attempted', {});

  try {
    const body = await request.json();

    // Validate required fields
    const errors = validatePublicReport(body);
    if (Object.keys(errors).length > 0) {
      logEvent('public_case.report_failed', { error: 'validation', details: errors });
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const { reporter, pet, incident, visibility, reward } = body;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: reporter.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: reporter.email,
          firstName: reporter.firstName,
          lastName: reporter.lastName || null,
          phone: reporter.phone || null,
          role: 'USER',
        },
      });
    }

    // Generate case number
    const caseNumber = await generateCaseNumber(incident.lastSeenAddress);

    // Create case
    const newCase = await prisma.case.create({
      data: {
        caseNumber,
        reporterId: user.id,
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed || null,
        petColor: pet.color,
        petSize: pet.size,
        petPhotoUrl: pet.photoUrl,
        petDescription: pet.description || '',
        ownerName: `${reporter.firstName} ${reporter.lastName || ''}`.trim(),
        ownerPhone: reporter.phone || '',
        ownerEmail: reporter.email,
        lastSeenAt: new Date(incident.lastSeenAt),
        lastSeenAddress: incident.lastSeenAddress,
        lastSeenLatitude: incident.lastSeenLatitude,
        lastSeenLongitude: incident.lastSeenLongitude,
        escapeScenario: incident.escapeScenario,
        escapeDetails: incident.escapeDetails || null,
        isPublic: visibility?.isPublic ?? true,
        publicContactOk: visibility?.publicContactOk ?? true,
        publicPhoneVisible: visibility?.publicPhoneVisible ?? false,
        publicEmailVisible: visibility?.publicEmailVisible ?? false,
        hasReward: reward?.hasReward ?? false,
        rewardAmount: reward?.rewardAmount || null,
        reportType: 'LOST',
        status: 'ACTIVE',
      },
    });

    logEvent('public_case.report_submitted', {
      caseNumber: newCase.caseNumber,
      species: pet.species,
    });

    // Fire notifications (non-blocking)
    // sendCaseReportConfirmation(newCase).catch(console.error);
    // sendAdminPublicReportAlert(newCase).catch(console.error);

    return NextResponse.json(
      {
        success: true,
        caseNumber: newCase.caseNumber,
        message: 'Your lost pet report has been submitted.',
      },
      { status: 201 }
    );
  } catch (error) {
    logEvent('public_case.report_failed', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}

function validatePublicReport(body) {
  const errors = {};

  if (!body.reporter?.email) errors['reporter.email'] = 'Email required';
  if (!body.reporter?.firstName) errors['reporter.firstName'] = 'First name required';
  if (!body.pet?.name) errors['pet.name'] = 'Pet name required';
  if (!body.pet?.species) errors['pet.species'] = 'Species required';
  if (!body.pet?.color) errors['pet.color'] = 'Color required';
  if (!body.pet?.size) errors['pet.size'] = 'Size required';
  if (!body.pet?.photoUrl) errors['pet.photoUrl'] = 'Photo required';
  if (!body.incident?.lastSeenAt) errors['incident.lastSeenAt'] = 'Date/time required';
  if (!body.incident?.lastSeenAddress) errors['incident.lastSeenAddress'] = 'Address required';
  if (!body.incident?.escapeScenario) errors['incident.escapeScenario'] = 'Scenario required';

  return errors;
}

async function generateCaseNumber(address) {
  // Extract city code from address
  const cityMatch = address.match(/,\s*([A-Za-z\s]+),?\s*[A-Z]{2}/);
  const city = cityMatch ? cityMatch[1].trim() : 'UNK';
  const cityCode = city.substring(0, 3).toUpperCase();

  const year = new Date().getFullYear();
  const count = await prisma.case.count({
    where: {
      caseNumber: { startsWith: `${cityCode}-${year}` },
    },
  });

  return `${cityCode}-${year}-${String(count + 1).padStart(6, '0')}`;
}
```

**Acceptance Criteria:**
- [ ] Validates all required fields
- [ ] Creates user if not exists
- [ ] Generates case number with city code
- [ ] Creates case with all fields
- [ ] Returns 201 with case number
- [ ] Events logged at each stage

---

## TASK-P06: /cases Public Listing Page

**Goal:** Create public page to browse lost pet cases.

**Files:**
- `frontend/app/cases/page.js` (new)

**Implementation:**

```jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PublicCasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    species: '',
    status: 'ACTIVE',
  });

  useEffect(() => {
    fetchCases();
  }, [filters]);

  async function fetchCases() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.species) params.set('species', filters.species);
    if (filters.status) params.set('status', filters.status);

    const res = await fetch(`/api/public/cases?${params}`);
    const data = await res.json();
    setCases(data.cases || []);
    setLoading(false);
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Lost Pets Near You</h1>
        <Link
          href="/cases/report"
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Report Lost Pet
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          value={filters.species}
          onChange={(e) => setFilters({ ...filters, species: e.target.value })}
          className="border rounded px-3 py-2"
        >
          <option value="">All Species</option>
          <option value="DOG">Dogs</option>
          <option value="CAT">Cats</option>
          <option value="BIRD">Birds</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Case List */}
      {loading ? (
        <p>Loading...</p>
      ) : cases.length === 0 ? (
        <p>No lost pets reported in your area.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <Link
              key={c.caseNumber}
              href={`/cases/${c.caseNumber}`}
              className="border rounded-lg p-4 hover:shadow-lg transition"
            >
              <img
                src={c.petPhotoUrl}
                alt={c.petName}
                className="w-full h-48 object-cover rounded mb-3"
              />
              <h2 className="font-bold text-lg">{c.petName}</h2>
              <p className="text-gray-600">
                {c.petBreed || c.petSpecies} • {c.petColor}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Last seen: {c.lastSeenAddress}
              </p>
              <div className="flex justify-between mt-3">
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                  {c.status}
                </span>
                {c.hasReward && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    REWARD
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Displays list of public cases
- [ ] Filter by species works
- [ ] Links to case detail pages
- [ ] Report Lost Pet button visible
- [ ] Responsive grid layout

---

## TASK-P07: /cases/[caseNumber] Public Detail Page

**Goal:** Create public case detail page with map.

**Files:**
- `frontend/app/cases/[caseNumber]/page.js` (new)

**Implementation:**

See feature spec for detailed layout. Key sections:
- Pet photo and basic info
- Last seen location with map
- Description
- Escape scenario
- Reward (if applicable)
- Contact form (if publicContactOk)
- Recent sightings

**Acceptance Criteria:**
- [ ] Displays all case details
- [ ] Shows map with marker
- [ ] Respects privacy settings
- [ ] Social share buttons
- [ ] SEO meta tags

---

## TASK-P08: /cases/report Public Submission Form

**Goal:** Create public form for reporting lost pets.

**Files:**
- `frontend/app/cases/report/page.js` (new)

**Implementation:**

Multi-step form with sections:
1. Your Information (email, name, phone)
2. Pet Information (name, species, breed, color, size, photo)
3. Incident Details (when, where, how)
4. Privacy & Reward settings

**Acceptance Criteria:**
- [ ] All required fields validated
- [ ] Photo upload works
- [ ] Map for location selection
- [ ] Privacy checkboxes
- [ ] Submits to POST /api/public/cases
- [ ] Shows success message with case number

---

## TASK-P09: QA Harness Tests

**Goal:** Add public portal tests to QA page.

**Files:**
- `frontend/app/admin/qa/page.js` (create or update)

**Tests to Add:**

```javascript
const publicPortalTests = [
  {
    name: 'Public case list loads',
    endpoint: '/api/public/cases',
    method: 'GET',
    expectedStatus: 200,
    validate: (res) => Array.isArray(res.cases),
  },
  {
    name: 'Public case list filters by species',
    endpoint: '/api/public/cases?species=DOG',
    method: 'GET',
    expectedStatus: 200,
    validate: (res) => res.cases.every(c => c.petSpecies === 'DOG'),
  },
  {
    name: 'Public case detail returns 404 for missing',
    endpoint: '/api/public/cases/NONEXISTENT-001',
    method: 'GET',
    expectedStatus: 404,
  },
  {
    name: 'Public report validates required fields',
    endpoint: '/api/public/cases',
    method: 'POST',
    body: {},
    expectedStatus: 400,
    validate: (res) => res.error === 'Validation failed',
  },
];
```

**Acceptance Criteria:**
- [ ] All tests defined
- [ ] Tests run from /admin/qa page
- [ ] Results displayed with pass/fail

---

## TASK-P10: ERROR_IMPACT Health Dashboard Entries

**Goal:** Add public portal events to health dashboard.

**Files:**
- `frontend/app/admin/health/page.js` (create or update)

**ERROR_IMPACT Entries:**

```javascript
const ERROR_IMPACT = {
  // ... existing entries ...

  // Public Portal (Phase 15-16)
  'public_case.list_failed': {
    level: 'LOW',
    description: 'Public case listing unavailable',
    action: 'Check database connection',
  },
  'public_case.detail_failed': {
    level: 'LOW',
    description: 'Public case detail unavailable',
    action: 'Check case exists and is public',
  },
  'public_case.report_failed': {
    level: 'MEDIUM',
    description: 'Public report submission failed',
    action: 'Check validation or database error',
  },
};
```

**Acceptance Criteria:**
- [ ] ERROR_IMPACT entries added
- [ ] Health dashboard displays these events
- [ ] Impact levels appropriate

---

## TASK-P11: Update VISION.md

**Goal:** Update VISION.md to mark Phase 15-16 as complete.

**Files:**
- `VISION.md`

**Changes:**
- Change Phase 15-16 status from "IN PROGRESS" to "COMPLETE"
- Add completion date

**Acceptance Criteria:**
- [ ] Status updated
- [ ] Date added

---

## Dependencies

```
TASK-P02 (logging) → TASK-P03, TASK-P04, TASK-P05
TASK-P01 (schema) → TASK-P03, TASK-P04, TASK-P05
TASK-P03, TASK-P04, TASK-P05 → TASK-P06, TASK-P07, TASK-P08
TASK-P03...P08 → TASK-P09, TASK-P10
```

---

*Last Updated: 2025-11-25*
