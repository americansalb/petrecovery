# AI Pet Matching System - Complete Implementation Guide

**Version:** 2.0 (Expanded)
**Created:** December 2024
**Purpose:** Self-contained guide for implementing AI pet matching from scratch in a new Claude context window

---

# PART 1: CODEBASE CONTEXT

This section provides all context needed to understand the existing codebase before implementing the AI matching system.

## 1.1 Project Overview

**ReunitePets.org** is a Next.js 14 application for reuniting lost pets with their owners through organized rescue forces.

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS 3.4 |
| Backend | Next.js API Routes (Node.js) |
| Database | PostgreSQL with Prisma 5.10 ORM |
| Auth | NextAuth.js 4.24 |
| Storage | Bunny.net CDN for images |
| SMS | Twilio (optional) |
| Maps | Leaflet.js |

### Directory Structure
```
/home/user/reunitepets/
└── frontend/
    ├── app/
    │   ├── page.js                    # Homepage
    │   ├── layout.js                  # Root layout with providers
    │   ├── globals.css                # Tailwind imports
    │   ├── api/                       # 222 API routes
    │   │   ├── auth/                  # NextAuth endpoints
    │   │   ├── pets/                  # Pet CRUD
    │   │   ├── missions/                 # Lost/found missions
    │   │   ├── upload/                # Bunny.net image upload
    │   │   ├── ai/                    # EXISTING: Basic AI stubs
    │   │   └── admin/                 # Admin endpoints
    │   ├── lib/                       # Shared utilities
    │   │   ├── prisma.js              # Prisma client singleton
    │   │   ├── auth.js                # NextAuth config
    │   │   ├── permissions.js         # RBAC helpers
    │   │   ├── matching.js            # EXISTING: Basic matching algorithm
    │   │   ├── ai/                    # EXISTING: AI stubs
    │   │   │   ├── imageMatching.js   # Perceptual hash (placeholder)
    │   │   │   └── petRecognition.js  # Facial features (placeholder)
    │   │   └── ml/
    │   │       └── imageAnalysis.js   # Color extraction
    │   ├── login/                     # Auth pages
    │   ├── register/
    │   ├── dashboard/                 # User dashboard
    │   ├── missions/                     # Mission management pages
    │   ├── rescue-forces/             # Squad pages
    │   └── admin/                     # Admin pages
    │       ├── page.js                # Admin dashboard
    │       ├── health/                # System health
    │       └── missions/                 # Mission management
    ├── components/
    │   ├── ui/                        # Reusable UI (Button, Card, etc.)
    │   ├── mission/                      # Mission components
    │   └── maps/                      # Leaflet components
    ├── prisma/
    │   ├── schema.prisma              # Database schema (~2500 lines)
    │   └── migrations/                # Migration history
    └── package.json
```

## 1.2 Existing Database Models (Relevant)

These models already exist and will be referenced:

```prisma
// User - existing, add relations for AI features
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  firstName       String
  lastName        String?
  role            UserRole @default(USER)  // USER, PATROL, MODERATOR, ADMIN
  rescueLevel     RescueLevel @default(PET_OWNER)
  // ... other fields
  pets            Pet[]
  missions           Mission[]
}

// Pet - existing, will add photos relation
model Pet {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  name            String
  species         String   // "dog", "cat", "bird", "other"
  breed           String?
  color           String?
  size            String?  // "small", "medium", "large"
  gender          String?  // "male", "female", "unknown"
  photos          String   @default("[]")  // JSON array of URLs
  primaryPhotoUrl String?
  microchipId     String?
  // ... other fields
}

// Mission - existing lost/found mission
model Mission {
  id              String   @id @default(cuid())
  missionNumber      String   @unique  // "CHI-2024-001234"
  type            MissionType // LOST, FOUND, SIGHTING
  status          MissionStatus // ACTIVE, REUNITED, CLOSED, etc.
  petName         String?
  species         String
  breed           String?
  color           String?
  description     String?
  latitude        Float
  longitude       Float
  photos          String   @default("[]")  // JSON array
  reporterId      String
  reporter        User     @relation(fields: [reporterId], references: [id])
  // ... other fields
}

// PetImageAnalysis - existing stub, will expand
model PetImageAnalysis {
  id              String   @id @default(cuid())
  missionId          String?
  petId           String?
  imageUrl        String
  species         String?
  breedPredictions String  @default("[]")
  colorPalette    String   @default("[]")
  embedding       String?  // Base64 encoded
  status          String   @default("PENDING")
  // ... other fields
}

// PetFacialFeatures - existing stub
model PetFacialFeatures {
  id              String   @id @default(cuid())
  petId           String?
  missionId          String?
  imageUrl        String
  faceRegion      String?
  landmarks       String?
  embedding       String?
  species         String?
  confidence      Float?
}
```

## 1.3 Existing Patterns to Follow

### API Route Pattern
```javascript
// /app/api/example/route.js
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ... logic

    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Admin-Only Route Pattern
```javascript
import { requireAdmin } from '@/app/lib/permissions';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  const adminCheck = requireAdmin(session);
  if (adminCheck) return adminCheck;  // Returns 401/403 response

  // ... admin logic
}
```

### Page Component Pattern
```javascript
// /app/example/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ExamplePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/example');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Content */}
    </div>
  );
}
```

### Image Upload Pattern (Bunny.net)
```javascript
// Existing upload endpoint: POST /api/upload
// Request: FormData with 'file' field
// Response: { url: "https://reunitepets.b-cdn.net/pets/xxx.jpg" }

const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error('Upload failed');
  const { url } = await res.json();
  return url;
};
```

## 1.4 Environment Variables

Existing variables the system uses:
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
BUNNY_STORAGE_ZONE="reunitepets"
BUNNY_API_KEY="..."
BUNNY_CDN_URL="https://reunitepets.b-cdn.net"
```

New variables needed for AI features:
```env
# AI Model Configuration
AI_MODEL_PATH="/models/petnet-v1.onnx"           # Local model path
AI_EMBEDDING_API_URL=""                           # Optional: External API
AI_EMBEDDING_API_KEY=""                           # Optional: External API key

# Vector Search (if using pgvector)
ENABLE_VECTOR_SEARCH="true"

# Feature Flags
ENABLE_AI_MATCHING="true"
ENABLE_LABELING_GAME="true"
```

---

# PART 2: DATABASE SCHEMA ADDITIONS

## 2.1 New Models to Add

Add these models to `/frontend/prisma/schema.prisma`:

```prisma
// ============================================================================
// AI PET MATCHING SYSTEM
// ============================================================================

// Pet Photo Collection - Multiple photos per pet for training
model PetPhoto {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Ownership - EXACTLY ONE of these must be set
  petId           String?
  pet             Pet?     @relation(fields: [petId], references: [id], onDelete: Cascade)
  missionId          String?
  mission            Mission?    @relation(fields: [missionId], references: [id], onDelete: Cascade)

  // Uploader
  uploadedById    String
  uploadedBy      User     @relation("UploadedPhotos", fields: [uploadedById], references: [id])

  // Image URLs
  imageUrl        String                    // Full size: https://reunitepets.b-cdn.net/pets/xxx.jpg
  thumbnailUrl    String?                   // 200x200 thumbnail

  // Display order
  displayOrder    Int      @default(0)      // 0 = primary photo
  isPrimary       Boolean  @default(false)

  // ML Processing Status
  processingStatus PetPhotoProcessingStatus @default(PENDING)
  processedAt     DateTime?
  processingError String?
  processingAttempts Int   @default(0)      // For retry logic, max 3

  // Embedding (512-dimensional vector, base64 encoded)
  embedding       String?                   // Base64 of Float32Array(512)
  embeddingModel  String?                   // "petnet-v1.0", "petnet-v1.1"
  embeddingVersion Int     @default(0)      // Increment when re-processed

  // Quality Assessment (0.0 to 1.0)
  qualityScore    Float?                    // Overall quality
  blurScore       Float?                    // Higher = sharper
  brightnessScore Float?                    // 0.5 = ideal
  framingScore    Float?                    // Pet centered and visible

  // Detection Results
  hasPetFace      Boolean  @default(false)  // Was a pet face detected?
  detectedSpecies String?                   // "dog", "cat", "bird", "other"
  speciesConfidence Float?                  // 0.0 to 1.0
  boundingBox     String?                   // JSON: {"x":0,"y":0,"width":100,"height":100}

  // Extracted Features
  dominantColors  String   @default("[]")   // JSON: [{"hex":"#8B4513","name":"brown","percent":45}]
  detectedBreed   String?
  breedConfidence Float?

  // Training Data Relations
  trainingPairsAsPhoto1 TrainingPair[] @relation("Photo1")
  trainingPairsAsPhoto2 TrainingPair[] @relation("Photo2")

  // Soft delete
  isDeleted       Boolean  @default(false)
  deletedAt       DateTime?

  @@index([petId])
  @@index([missionId])
  @@index([uploadedById])
  @@index([processingStatus])
  @@index([hasPetFace])
  @@index([detectedSpecies])
  @@index([isDeleted])
  @@index([createdAt])
}

enum PetPhotoProcessingStatus {
  PENDING          // Not yet processed
  PROCESSING       // Currently being processed
  COMPLETED        // Successfully processed
  FAILED           // Failed after max retries
  SKIPPED          // Skipped (bad quality, no pet detected)
}

// Training Pair - Two photos that may or may not be the same pet
model TrainingPair {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // The two photos being compared
  photo1Id        String
  photo1          PetPhoto @relation("Photo1", fields: [photo1Id], references: [id], onDelete: Cascade)
  photo2Id        String
  photo2          PetPhoto @relation("Photo2", fields: [photo2Id], references: [id], onDelete: Cascade)

  // Ground Truth Label
  // null = unlabeled, true = same pet, false = different pets
  isSamePet       Boolean?
  labelSource     TrainingPairLabelSource?  // How was this labeled?
  labelConfidence Float?                     // 0.0 to 1.0 consensus confidence
  labeledAt       DateTime?

  // Crowdsourced Labeling Stats
  totalVotes      Int      @default(0)
  sameVotes       Int      @default(0)       // Votes for "same pet"
  differentVotes  Int      @default(0)       // Votes for "different pet"
  skipVotes       Int      @default(0)       // Votes for "can't tell"

  // Pair Metadata
  source          TrainingPairSource @default(UNKNOWN)
  isHardNegative  Boolean  @default(false)   // Similar-looking but different pets
  isHoneypot      Boolean  @default(false)   // Known ground truth for quality control
  honeypotAnswer  Boolean?                   // Expected answer for honeypots

  // Difficulty Estimation
  visualSimilarity Float?                    // Pre-computed similarity 0-1
  difficultyScore Float?                     // Higher = harder to distinguish

  // Training Usage
  usedInTraining  Boolean  @default(false)
  trainingBatchId String?
  trainedAt       DateTime?

  // Status
  status          TrainingPairStatus @default(ACTIVE)
  flaggedReason   String?                    // If flagged for review
  reviewedById    String?
  reviewedAt      DateTime?

  // Relations
  labels          TrainingLabel[]

  // Ensure no duplicate pairs (order-independent)
  @@unique([photo1Id, photo2Id])
  @@index([isSamePet])
  @@index([source])
  @@index([status])
  @@index([totalVotes])
  @@index([usedInTraining])
  @@index([isHoneypot])
  @@index([createdAt])
}

enum TrainingPairSource {
  UNKNOWN          // Source not specified
  SAME_PET_PROFILE // Both photos from same pet profile (high confidence same)
  CONFIRMED_REUNION // Photos matched during confirmed reunion (high confidence same)
  USER_FEEDBACK    // User confirmed match in UI
  CROWDSOURCED     // Labeled by crowd consensus
  ADMIN_LABELED    // Manually labeled by admin
  HARD_NEGATIVE    // Generated as similar-looking different pets
  SYNTHETIC        // Augmented/generated data
  EXTERNAL_DATASET // From external training dataset
}

enum TrainingPairLabelSource {
  AUTO_SAME_PET    // Automatically labeled (same pet profile)
  CROWDSOURCE      // Crowd consensus
  ADMIN            // Admin override
  REUNION          // Confirmed during reunion
  USER_FEEDBACK    // User feedback on match
}

enum TrainingPairStatus {
  ACTIVE           // Available for labeling/training
  NEEDS_MORE_VOTES // Has votes but no consensus
  CONSENSUS_REACHED // Has enough votes with agreement
  FLAGGED          // Flagged for review
  REMOVED          // Removed from dataset
}

// Training Label - Individual vote on a training pair
model TrainingLabel {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())

  // The pair being labeled
  pairId          String
  pair            TrainingPair @relation(fields: [pairId], references: [id], onDelete: Cascade)

  // Who labeled (can be null for anonymous/guest)
  labeledById     String?
  labeledBy       User?    @relation("UserLabels", fields: [labeledById], references: [id])
  sessionId       String?                    // For anonymous users

  // The Label
  vote            TrainingLabelVote
  confidence      Int      @default(3)       // 1-5, how sure they are

  // Timing (for quality analysis)
  timeSpentMs     Int?                       // Milliseconds spent deciding
  photoViewOrder  String?                    // JSON: which photo they viewed first

  // Quality Control
  weight          Float    @default(1.0)     // Based on labeler trust level
  isSpam          Boolean  @default(false)
  spamReason      String?

  // Device Info (for fraud detection)
  ipHash          String?                    // Hashed IP
  userAgent       String?

  // Ensure one vote per user per pair
  @@unique([pairId, labeledById])
  @@index([pairId])
  @@index([labeledById])
  @@index([vote])
  @@index([createdAt])
}

enum TrainingLabelVote {
  SAME             // Same pet
  DIFFERENT        // Different pets
  SKIP             // Can't tell / bad photos
}

// Labeler Stats - Track labeler quality and activity
model LabelerStats {
  id              String   @id

  // Link to user (id = oderId)
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Activity Counts
  totalLabels     Int      @default(0)
  labelsToday     Int      @default(0)
  labelsThisWeek  Int      @default(0)
  labelsThisMonth Int      @default(0)
  lastLabelAt     DateTime?

  // Streaks
  currentStreak   Int      @default(0)       // Days in a row with labels
  longestStreak   Int      @default(0)
  lastStreakDate  DateTime?

  // Accuracy Metrics (compared to consensus/ground truth)
  accuracyScore   Float    @default(0.5)     // 0-1, rolling average
  agreementRate   Float    @default(0.5)     // How often they match consensus
  honeypotAccuracy Float   @default(0.5)     // Accuracy on honeypot pairs
  totalHoneypots  Int      @default(0)       // Honeypots attempted

  // Trust Level
  trustLevel      LabelerTrustLevel @default(NEW)
  trustScore      Float    @default(0.5)     // Composite trust 0-1

  // Rewards
  totalPoints     Int      @default(0)
  pointsThisWeek  Int      @default(0)
  rank            Int?                       // Leaderboard position

  // Flags
  isBanned        Boolean  @default(false)
  bannedAt        DateTime?
  bannedReason    String?
  isSuspicious    Boolean  @default(false)

  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([trustLevel])
  @@index([accuracyScore])
  @@index([totalLabels])
  @@index([isBanned])
}

enum LabelerTrustLevel {
  NEW              // < 20 labels, weight = 0.5
  LEARNING         // 20-50 labels, weight = 0.7
  REGULAR          // 50-200 labels, weight = 1.0
  TRUSTED          // 200+ labels + high accuracy, weight = 1.5
  EXPERT           // Admin-promoted, weight = 2.0
  SUSPICIOUS       // Flagged for review, weight = 0.1
  BANNED           // No voting allowed, weight = 0
}

// AI Model Registry - Track model versions and performance
model AIModel {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Model Identity
  name            String                     // "petnet"
  version         String                     // "1.0.0"
  displayName     String?                    // "PetNet v1.0"
  description     String?

  // Architecture Details
  architecture    String                     // "efficientnet-b4-siamese"
  backboneModel   String?                    // "efficientnet-b4"
  embeddingDim    Int      @default(512)     // Output dimension
  inputSize       Int      @default(384)     // Input image size

  // Model Files
  modelUrl        String?                    // URL to ONNX/weights file
  modelSize       Int?                       // File size in bytes
  modelChecksum   String?                    // SHA256 hash

  // Training Information
  trainedAt       DateTime?
  trainingDatasetSize Int?                   // Number of pairs used
  trainingEpochs  Int?
  trainingLoss    Float?                     // Final training loss
  validationLoss  Float?                     // Final validation loss

  // Performance Metrics (on held-out test set)
  testAccuracy    Float?                     // Overall accuracy
  testPrecision   Float?                     // Precision for "same pet"
  testRecall      Float?                     // Recall for "same pet"
  testF1Score     Float?                     // F1 score
  testAucRoc      Float?                     // Area under ROC curve

  // Threshold Configuration
  matchThreshold  Float    @default(0.75)    // Score >= this = match
  highConfidenceThreshold Float @default(0.90)

  // Deployment Status
  status          AIModelStatus @default(DRAFT)
  isActive        Boolean  @default(false)   // Currently serving production
  deployedAt      DateTime?
  deprecatedAt    DateTime?

  // Usage Statistics
  totalInferences Int      @default(0)
  avgLatencyMs    Float?
  lastInferenceAt DateTime?

  // Relations
  matchResults    AIMatchResult[]

  @@unique([name, version])
  @@index([status])
  @@index([isActive])
}

enum AIModelStatus {
  DRAFT            // Being developed
  TRAINING         // Currently training
  VALIDATING       // Running validation
  READY            // Ready to deploy
  DEPLOYED         // Currently in production
  DEPRECATED       // Old version, no longer used
  FAILED           // Training/validation failed
}

// AI Match Result - Record of each matching attempt
model AIMatchResult {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())

  // Query Information
  queryImageUrl   String                     // Image user uploaded
  queryPhotoId    String?                    // If from existing PetPhoto
  queryEmbedding  String?                    // Embedding of query image

  // Match Information
  matchedPhotoId  String?
  matchedPhoto    PetPhoto? @relation(fields: [matchedPhotoId], references: [id])
  matchedMissionId   String?
  matchedPetId    String?

  // Scores (all 0.0 to 1.0)
  visualScore     Float                      // Embedding similarity
  metadataScore   Float?                     // Species/breed/color match
  locationScore   Float?                     // Geographic proximity
  combinedScore   Float                      // Weighted combination

  // Confidence (0-100 for display)
  confidence      Int                        // Final confidence percentage

  // Model Used
  modelId         String?
  model           AIModel? @relation(fields: [modelId], references: [id])
  modelVersion    String?                    // Denormalized for history

  // Search Context
  searchFilters   String?                    // JSON: filters applied
  searchRadius    Float?                     // Miles searched
  resultRank      Int?                       // Position in results (1-based)
  totalResults    Int?                       // Total matches found

  // User Feedback
  feedbackGiven   Boolean  @default(false)
  isCorrectMatch  Boolean?                   // null = no feedback
  feedbackAt      DateTime?
  feedbackById    String?
  feedbackNotes   String?

  // Analytics
  wasClicked      Boolean  @default(false)
  wasContacted    Boolean  @default(false)
  ledToReunion    Boolean  @default(false)

  @@index([queryPhotoId])
  @@index([matchedPhotoId])
  @@index([matchedMissionId])
  @@index([combinedScore])
  @@index([isCorrectMatch])
  @@index([createdAt])
}

// AI Training Job - Track training runs
model AITrainingJob {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Job Identity
  name            String                     // "petnet-v1.1-training"
  description     String?

  // Target Model
  targetModelName String                     // "petnet"
  targetVersion   String                     // "1.1.0"

  // Configuration
  config          String                     // JSON: full training config
  hyperparameters String                     // JSON: {lr, batch_size, epochs, etc}

  // Dataset
  trainingPairs   Int                        // Number of training pairs
  validationPairs Int                        // Number of validation pairs
  testPairs       Int                        // Number of test pairs
  datasetExportUrl String?                   // URL to exported dataset

  // Status
  status          AITrainingJobStatus @default(PENDING)
  startedAt       DateTime?
  completedAt     DateTime?
  failedAt        DateTime?
  errorMessage    String?

  // Progress
  currentEpoch    Int      @default(0)
  totalEpochs     Int
  currentLoss     Float?
  bestLoss        Float?
  progressPercent Int      @default(0)       // 0-100

  // Results
  resultModelId   String?                    // Created model ID
  finalMetrics    String?                    // JSON: final performance metrics

  // Initiated By
  startedById     String?
  startedBy       User?    @relation(fields: [startedById], references: [id])

  @@index([status])
  @@index([createdAt])
}

enum AITrainingJobStatus {
  PENDING          // Waiting to start
  PREPARING        // Preparing dataset
  TRAINING         // Training in progress
  VALIDATING       // Running validation
  COMPLETED        // Successfully completed
  FAILED           // Failed with error
  CANCELLED        // Manually cancelled
}
```

## 2.2 Required Updates to Existing Models

Add these relations to existing models in `schema.prisma`:

```prisma
// Add to User model:
model User {
  // ... existing fields ...

  // AI Training Relations (add these)
  uploadedPhotos    PetPhoto[]       @relation("UploadedPhotos")
  trainingLabels    TrainingLabel[]  @relation("UserLabels")
  labelerStats      LabelerStats?
  trainingJobs      AITrainingJob[]
}

// Add to Pet model:
model Pet {
  // ... existing fields ...

  // AI Photo Relations (add this)
  aiPhotos          PetPhoto[]
}

// Add to Mission model:
model Mission {
  // ... existing fields ...

  // AI Photo Relations (add this)
  aiPhotos          PetPhoto[]
}
```

## 2.3 Migration Commands

```bash
# After updating schema.prisma, run:
cd /home/user/reunitepets/frontend
npx prisma db push

# Or for production with migration history:
npx prisma migrate dev --name add_ai_matching_system
```

---

# PART 3: PHASE 1 - DATABASE & FOUNDATION

## 3.1 Objectives
- Add all database models
- Create seed data for testing
- Verify all relations work correctly

## 3.2 Files to Create/Modify

### 3.2.1 Update Schema
**File:** `/frontend/prisma/schema.prisma`
**Action:** Add all models from Part 2

### 3.2.2 Seed Script
**File:** `/frontend/prisma/seed-ai.js`

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAIData() {
  console.log('Seeding AI training data...');

  // Create test user if not exists
  const testUser = await prisma.user.upsert({
    where: { email: 'ai-test@reunitepets.org' },
    update: {},
    create: {
      email: 'ai-test@reunitepets.org',
      firstName: 'AI',
      lastName: 'Test',
      role: 'ADMIN',
    },
  });

  // Create sample pet with photos
  const testPet = await prisma.pet.create({
    data: {
      userId: testUser.id,
      name: 'Max',
      species: 'dog',
      breed: 'Golden Retriever',
      color: 'golden',
      size: 'large',
      gender: 'male',
    },
  });

  // Create sample pet photos
  const photo1 = await prisma.petPhoto.create({
    data: {
      petId: testPet.id,
      uploadedById: testUser.id,
      imageUrl: 'https://reunitepets.b-cdn.net/test/dog1.jpg',
      displayOrder: 0,
      isPrimary: true,
      processingStatus: 'COMPLETED',
      hasPetFace: true,
      detectedSpecies: 'dog',
      speciesConfidence: 0.95,
      qualityScore: 0.85,
    },
  });

  const photo2 = await prisma.petPhoto.create({
    data: {
      petId: testPet.id,
      uploadedById: testUser.id,
      imageUrl: 'https://reunitepets.b-cdn.net/test/dog2.jpg',
      displayOrder: 1,
      isPrimary: false,
      processingStatus: 'COMPLETED',
      hasPetFace: true,
      detectedSpecies: 'dog',
      speciesConfidence: 0.92,
      qualityScore: 0.78,
    },
  });

  // Create training pair (same pet)
  await prisma.trainingPair.create({
    data: {
      photo1Id: photo1.id,
      photo2Id: photo2.id,
      source: 'SAME_PET_PROFILE',
      isSamePet: true,
      labelSource: 'AUTO_SAME_PET',
      labelConfidence: 1.0,
      labeledAt: new Date(),
      status: 'CONSENSUS_REACHED',
    },
  });

  // Create initial AI model record
  await prisma.aIModel.create({
    data: {
      name: 'petnet',
      version: '0.1.0',
      displayName: 'PetNet v0.1 (Baseline)',
      description: 'Initial baseline model using perceptual hashing',
      architecture: 'perceptual-hash',
      embeddingDim: 64,
      inputSize: 256,
      status: 'DEPLOYED',
      isActive: true,
      deployedAt: new Date(),
      matchThreshold: 0.7,
    },
  });

  // Create labeler stats for test user
  await prisma.labelerStats.create({
    data: {
      id: testUser.id,
      userId: testUser.id,
      trustLevel: 'EXPERT',
      trustScore: 1.0,
    },
  });

  console.log('AI seed data created successfully');
}

seedAIData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## 3.3 Verification Checklist

- [ ] `npx prisma db push` completes without errors
- [ ] `node prisma/seed-ai.js` runs successfully
- [ ] Can query PetPhoto records in Prisma Studio
- [ ] Can query TrainingPair records
- [ ] Relations work (PetPhoto -> Pet, TrainingPair -> PetPhoto)

## 3.4 Edge Missions Handled

| Edge Mission | Handling |
|-----------|----------|
| PetPhoto without pet or mission | Validation in API - exactly one must be set |
| Duplicate training pairs | Unique constraint on [photo1Id, photo2Id] |
| Same photo paired with itself | API validation prevents this |
| Deleted photo in training pair | onDelete: Cascade removes pairs |
| User without labeler stats | Created on first label action |

---

# PART 4: PHASE 2 - PHOTO UPLOAD SYSTEM

## 4.1 Objectives
- Allow users to upload multiple photos per pet
- Process photos for quality and embedding
- Auto-generate training pairs from same-pet photos

## 4.2 API Endpoints

### 4.2.1 Upload Photos
**File:** `/frontend/app/api/pets/[petId]/photos/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/pets/[petId]/photos - List all photos for a pet
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { petId } = params;

    // Verify pet exists and user owns it (or is admin)
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: { userId: true },
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    if (pet.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const photos = await prisma.petPhoto.findMany({
      where: {
        petId: petId,
        isDeleted: false,
      },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        imageUrl: true,
        thumbnailUrl: true,
        displayOrder: true,
        isPrimary: true,
        processingStatus: true,
        qualityScore: true,
        hasPetFace: true,
        detectedSpecies: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ photos });
  } catch (error) {
    console.error('Error fetching pet photos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/pets/[petId]/photos - Upload new photo(s)
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { petId } = params;

    // Verify pet exists and user owns it
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: { userId: true, species: true },
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    if (pet.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check current photo count (max 10 per pet)
    const currentCount = await prisma.petPhoto.count({
      where: { petId: petId, isDeleted: false },
    });

    const body = await request.json();
    const { imageUrls } = body;  // Array of uploaded image URLs

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'imageUrls array is required' },
        { status: 400 }
      );
    }

    if (currentCount + imageUrls.length > 10) {
      return NextResponse.json(
        { error: `Cannot exceed 10 photos per pet. Current: ${currentCount}, Attempting to add: ${imageUrls.length}` },
        { status: 400 }
      );
    }

    // Validate URLs
    for (const url of imageUrls) {
      if (!url.startsWith('https://') || !url.includes('b-cdn.net')) {
        return NextResponse.json(
          { error: 'Invalid image URL. Must be from Bunny CDN.' },
          { status: 400 }
        );
      }
    }

    // Determine if this is the first photo (make it primary)
    const isFirst = currentCount === 0;

    // Create photo records
    const createdPhotos = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const photo = await prisma.petPhoto.create({
        data: {
          petId: petId,
          uploadedById: session.user.id,
          imageUrl: imageUrls[i],
          displayOrder: currentCount + i,
          isPrimary: isFirst && i === 0,
          processingStatus: 'PENDING',
        },
      });
      createdPhotos.push(photo);
    }

    // Trigger async processing (don't await)
    processPhotosAsync(createdPhotos.map(p => p.id)).catch(console.error);

    // Generate training pairs if we now have 2+ photos
    if (currentCount + imageUrls.length >= 2) {
      generateTrainingPairsAsync(petId).catch(console.error);
    }

    return NextResponse.json({
      message: `${createdPhotos.length} photo(s) uploaded successfully`,
      photos: createdPhotos,
    });
  } catch (error) {
    console.error('Error uploading pet photos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Async processing function (runs in background)
async function processPhotosAsync(photoIds) {
  const { processPhoto } = await import('@/app/lib/ai/photoProcessor');
  for (const photoId of photoIds) {
    try {
      await processPhoto(photoId);
    } catch (error) {
      console.error(`Failed to process photo ${photoId}:`, error);
    }
  }
}

// Generate training pairs from same-pet photos
async function generateTrainingPairsAsync(petId) {
  const photos = await prisma.petPhoto.findMany({
    where: {
      petId: petId,
      isDeleted: false,
      processingStatus: 'COMPLETED',
      hasPetFace: true,
    },
    select: { id: true },
  });

  // Generate all unique pairs
  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      // Check if pair already exists
      const existing = await prisma.trainingPair.findFirst({
        where: {
          OR: [
            { photo1Id: photos[i].id, photo2Id: photos[j].id },
            { photo1Id: photos[j].id, photo2Id: photos[i].id },
          ],
        },
      });

      if (!existing) {
        await prisma.trainingPair.create({
          data: {
            photo1Id: photos[i].id,
            photo2Id: photos[j].id,
            source: 'SAME_PET_PROFILE',
            isSamePet: true,
            labelSource: 'AUTO_SAME_PET',
            labelConfidence: 1.0,
            labeledAt: new Date(),
            status: 'CONSENSUS_REACHED',
          },
        });
      }
    }
  }
}
```

### 4.2.2 Delete Photo
**File:** `/frontend/app/api/pets/[petId]/photos/[photoId]/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// DELETE /api/pets/[petId]/photos/[photoId]
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { petId, photoId } = params;

    // Verify photo exists and belongs to this pet
    const photo = await prisma.petPhoto.findFirst({
      where: {
        id: photoId,
        petId: petId,
        isDeleted: false,
      },
      include: {
        pet: { select: { userId: true } },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify ownership
    if (photo.pet.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete
    await prisma.petPhoto.update({
      where: { id: photoId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // If this was primary, make the next photo primary
    if (photo.isPrimary) {
      const nextPhoto = await prisma.petPhoto.findFirst({
        where: {
          petId: petId,
          isDeleted: false,
          id: { not: photoId },
        },
        orderBy: { displayOrder: 'asc' },
      });

      if (nextPhoto) {
        await prisma.petPhoto.update({
          where: { id: nextPhoto.id },
          data: { isPrimary: true },
        });
      }
    }

    return NextResponse.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/pets/[petId]/photos/[photoId] - Update photo (set as primary, reorder)
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { petId, photoId } = params;
    const body = await request.json();
    const { isPrimary, displayOrder } = body;

    // Verify photo exists and belongs to this pet
    const photo = await prisma.petPhoto.findFirst({
      where: {
        id: photoId,
        petId: petId,
        isDeleted: false,
      },
      include: {
        pet: { select: { userId: true } },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    if (photo.pet.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData = {};

    // Handle setting as primary
    if (isPrimary === true) {
      // Remove primary from all other photos
      await prisma.petPhoto.updateMany({
        where: {
          petId: petId,
          isDeleted: false,
          id: { not: photoId },
        },
        data: { isPrimary: false },
      });
      updateData.isPrimary = true;
    }

    // Handle reordering
    if (typeof displayOrder === 'number' && displayOrder >= 0) {
      updateData.displayOrder = displayOrder;
    }

    const updated = await prisma.petPhoto.update({
      where: { id: photoId },
      data: updateData,
    });

    return NextResponse.json({ photo: updated });
  } catch (error) {
    console.error('Error updating photo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 4.2.3 Photo Processor
**File:** `/frontend/app/lib/ai/photoProcessor.js`

```javascript
import prisma from '@/app/lib/prisma';

/**
 * Process a pet photo for AI features
 * - Quality assessment
 * - Pet face detection
 * - Species detection
 * - Color extraction
 * - Embedding generation (when model available)
 */
export async function processPhoto(photoId) {
  // Mark as processing
  await prisma.petPhoto.update({
    where: { id: photoId },
    data: {
      processingStatus: 'PROCESSING',
      processingAttempts: { increment: 1 },
    },
  });

  try {
    const photo = await prisma.petPhoto.findUnique({
      where: { id: photoId },
      select: { imageUrl: true },
    });

    if (!photo) {
      throw new Error('Photo not found');
    }

    // Step 1: Quality Assessment
    const quality = await assessImageQuality(photo.imageUrl);

    // Skip low quality images
    if (quality.overall < 0.3) {
      await prisma.petPhoto.update({
        where: { id: photoId },
        data: {
          processingStatus: 'SKIPPED',
          processingError: 'Image quality too low',
          qualityScore: quality.overall,
          blurScore: quality.blur,
          brightnessScore: quality.brightness,
        },
      });
      return { success: false, reason: 'low_quality' };
    }

    // Step 2: Pet Detection
    const detection = await detectPet(photo.imageUrl);

    // Step 3: Color Extraction
    const colors = await extractColors(photo.imageUrl);

    // Step 4: Generate Embedding (if model available)
    let embedding = null;
    let embeddingModel = null;
    const activeModel = await getActiveModel();
    if (activeModel) {
      embedding = await generateEmbedding(photo.imageUrl, activeModel);
      embeddingModel = `${activeModel.name}-v${activeModel.version}`;
    }

    // Update photo record
    await prisma.petPhoto.update({
      where: { id: photoId },
      data: {
        processingStatus: 'COMPLETED',
        processedAt: new Date(),
        processingError: null,

        // Quality
        qualityScore: quality.overall,
        blurScore: quality.blur,
        brightnessScore: quality.brightness,
        framingScore: quality.framing,

        // Detection
        hasPetFace: detection.hasPet,
        detectedSpecies: detection.species,
        speciesConfidence: detection.confidence,
        boundingBox: detection.boundingBox ? JSON.stringify(detection.boundingBox) : null,
        detectedBreed: detection.breed,
        breedConfidence: detection.breedConfidence,

        // Colors
        dominantColors: JSON.stringify(colors),

        // Embedding
        embedding: embedding,
        embeddingModel: embeddingModel,
        embeddingVersion: { increment: 1 },
      },
    });

    return { success: true };
  } catch (error) {
    console.error(`Photo processing failed for ${photoId}:`, error);

    const photo = await prisma.petPhoto.findUnique({
      where: { id: photoId },
      select: { processingAttempts: true },
    });

    // Mark as failed if max retries exceeded
    const status = photo.processingAttempts >= 3 ? 'FAILED' : 'PENDING';

    await prisma.petPhoto.update({
      where: { id: photoId },
      data: {
        processingStatus: status,
        processingError: error.message,
      },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Assess image quality
 */
async function assessImageQuality(imageUrl) {
  // TODO: Implement real quality assessment
  // For now, return placeholder values
  return {
    overall: 0.75,
    blur: 0.8,        // Higher = sharper
    brightness: 0.5,  // 0.5 = ideal
    framing: 0.7,     // Pet centered
  };
}

/**
 * Detect pet in image
 */
async function detectPet(imageUrl) {
  // TODO: Implement real pet detection with ML model
  // For now, return placeholder
  return {
    hasPet: true,
    species: 'dog',
    confidence: 0.9,
    boundingBox: { x: 50, y: 50, width: 200, height: 250 },
    breed: null,
    breedConfidence: null,
  };
}

/**
 * Extract dominant colors
 */
async function extractColors(imageUrl) {
  // TODO: Implement real color extraction
  return [
    { hex: '#8B4513', name: 'brown', percent: 45 },
    { hex: '#F5DEB3', name: 'tan', percent: 30 },
    { hex: '#FFFFFF', name: 'white', percent: 25 },
  ];
}

/**
 * Get active AI model
 */
async function getActiveModel() {
  return await prisma.aIModel.findFirst({
    where: { isActive: true },
  });
}

/**
 * Generate embedding for image
 */
async function generateEmbedding(imageUrl, model) {
  // TODO: Implement real embedding generation
  // For now, return null (no embedding)
  return null;
}
```

## 4.3 UI Component: Pet Photo Gallery

**File:** `/frontend/components/pet/PetPhotoGallery.jsx`

```jsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Star, Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function PetPhotoGallery({
  petId,
  photos = [],
  onPhotosChange,
  maxPhotos = 10,
  editable = true,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  // Handle file drop/selection
  const onDrop = useCallback(async (acceptedFiles) => {
    if (!editable) return;

    setError(null);

    // Check max photos limit
    if (photos.length + acceptedFiles.length > maxPhotos) {
      setError(`Maximum ${maxPhotos} photos allowed. You have ${photos.length}.`);
      return;
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const invalidFiles = acceptedFiles.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      setError('Only JPEG, PNG, and WebP images are allowed.');
      return;
    }

    // Validate file sizes (max 10MB each)
    const oversizedFiles = acceptedFiles.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError('Images must be under 10MB each.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadedUrls = [];

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];

        // Upload to Bunny CDN via our API
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'pets');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload image');
        }

        const { url } = await uploadRes.json();
        uploadedUrls.push(url);

        setUploadProgress(Math.round(((i + 1) / acceptedFiles.length) * 100));
      }

      // Register photos with pet
      const registerRes = await fetch(`/api/pets/${petId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: uploadedUrls }),
      });

      if (!registerRes.ok) {
        const data = await registerRes.json();
        throw new Error(data.error || 'Failed to register photos');
      }

      // Refresh photos list
      if (onPhotosChange) {
        onPhotosChange();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [petId, photos.length, maxPhotos, editable, onPhotosChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxSize: 10 * 1024 * 1024,
    disabled: !editable || uploading,
  });

  // Delete photo
  const handleDelete = async (photoId) => {
    if (!editable) return;
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      const res = await fetch(`/api/pets/${petId}/photos/${photoId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete photo');

      if (onPhotosChange) onPhotosChange();
    } catch (err) {
      setError(err.message);
    }
  };

  // Set as primary
  const handleSetPrimary = async (photoId) => {
    if (!editable) return;

    try {
      const res = await fetch(`/api/pets/${petId}/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true }),
      });

      if (!res.ok) throw new Error('Failed to set primary photo');

      if (onPhotosChange) onPhotosChange();
    } catch (err) {
      setError(err.message);
    }
  };

  // Get processing status icon
  const getStatusIcon = (status) => {
    switch (status) {
      mission 'PENDING':
      mission 'PROCESSING':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      mission 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      mission 'FAILED':
      mission 'SKIPPED':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
              photo.isPrimary ? 'border-yellow-400' : 'border-gray-200'
            }`}
          >
            <img
              src={photo.thumbnailUrl || photo.imageUrl}
              alt="Pet photo"
              className="w-full h-full object-cover"
            />

            {/* Status badge */}
            <div className="absolute top-2 left-2">
              {getStatusIcon(photo.processingStatus)}
            </div>

            {/* Primary badge */}
            {photo.isPrimary && (
              <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs px-2 py-1 rounded-full font-medium">
                Primary
              </div>
            )}

            {/* Actions */}
            {editable && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex justify-between items-center opacity-0 hover:opacity-100 transition-opacity">
                {!photo.isPrimary && (
                  <button
                    onClick={() => handleSetPrimary(photo.id)}
                    className="text-white hover:text-yellow-400 p-1"
                    title="Set as primary"
                  >
                    <Star className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="text-white hover:text-red-400 p-1 ml-auto"
                  title="Delete photo"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Quality score */}
            {photo.qualityScore !== null && (
              <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-1 rounded">
                Q: {Math.round(photo.qualityScore * 100)}%
              </div>
            )}
          </div>
        ))}

        {/* Upload dropzone */}
        {editable && photos.length < maxPhotos && (
          <div
            {...getRootProps()}
            className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                <p className="text-sm text-gray-500 mt-2">{uploadProgress}%</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-500 mt-2">
                  {isDragActive ? 'Drop here' : 'Add Photo'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Photo count */}
      <p className="text-sm text-gray-500">
        {photos.length} of {maxPhotos} photos
      </p>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-400">
        Upload multiple photos of your pet for better AI matching.
        Photos are automatically analyzed for quality and features.
        JPEG, PNG, WebP up to 10MB each.
      </p>
    </div>
  );
}
```

## 4.4 Verification Checklist

- [ ] Can upload single photo via API
- [ ] Can upload multiple photos (batch)
- [ ] Cannot exceed 10 photos per pet
- [ ] Delete photo works (soft delete)
- [ ] Set primary photo works
- [ ] UI dropzone accepts files
- [ ] UI shows processing status
- [ ] Training pairs auto-generated for same pet

## 4.5 Edge Missions Handled

| Edge Mission | Handling |
|-----------|----------|
| Upload non-image file | Validation rejects, returns 400 |
| Upload file > 10MB | Validation rejects, returns 400 |
| Upload to non-existent pet | Returns 404 |
| Upload to other user's pet | Returns 403 |
| Delete primary photo | Next photo becomes primary |
| Delete only photo | Pet has no photos, allowed |
| Processing fails | Retry up to 3 times, then mark FAILED |
| Low quality image | Mark as SKIPPED, don't use for training |
| No pet face detected | Still save, but hasPetFace = false |

---

# PART 5: PHASE 3 - LABELING GAME

## 5.1 Objectives
- Create gamified interface for crowdsourced labeling
- Implement smart pair selection
- Track labeler quality and rewards
- Anti-spam/gaming protection

## 5.2 API Endpoints

### 5.2.1 Get Next Pair
**File:** `/frontend/app/api/training/next-pair/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Get user's labeler stats if logged in
    let labelerStats = null;
    if (userId) {
      labelerStats = await prisma.labelerStats.findUnique({
        where: { userId },
      });

      // Check daily limit (100 labels/day)
      if (labelerStats && labelerStats.labelsToday >= 100) {
        return NextResponse.json(
          { error: 'Daily labeling limit reached. Come back tomorrow!' },
          { status: 429 }
        );
      }
    }

    // Get IDs of pairs user has already labeled
    const labeledPairIds = userId
      ? (await prisma.trainingLabel.findMany({
          where: { labeledById: userId },
          select: { pairId: true },
        })).map(l => l.pairId)
      : [];

    // Strategy: Prioritize pairs in this order:
    // 1. Honeypots (10% chance) - for quality control
    // 2. Unlabeled pairs (labelCount = 0)
    // 3. Controversial pairs (close vote split)
    // 4. Pairs needing more votes (< 3 votes)

    let pair = null;

    // 10% chance of honeypot
    if (Math.random() < 0.1) {
      pair = await prisma.trainingPair.findFirst({
        where: {
          isHoneypot: true,
          status: 'ACTIVE',
          id: { notIn: labeledPairIds },
        },
        include: {
          photo1: {
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              detectedSpecies: true,
            },
          },
          photo2: {
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              detectedSpecies: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    // If no honeypot, get regular pair
    if (!pair) {
      // Priority 1: Unlabeled
      pair = await prisma.trainingPair.findFirst({
        where: {
          totalVotes: 0,
          status: 'ACTIVE',
          isHoneypot: false,
          id: { notIn: labeledPairIds },
        },
        include: {
          photo1: {
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              detectedSpecies: true,
            },
          },
          photo2: {
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              detectedSpecies: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!pair) {
      // Priority 2: Needs more votes
      pair = await prisma.trainingPair.findFirst({
        where: {
          totalVotes: { lt: 3 },
          status: 'ACTIVE',
          isHoneypot: false,
          id: { notIn: labeledPairIds },
        },
        include: {
          photo1: {
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              detectedSpecies: true,
            },
          },
          photo2: {
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              detectedSpecies: true,
            },
          },
        },
        orderBy: [
          { totalVotes: 'asc' },
          { createdAt: 'asc' },
        ],
      });
    }

    if (!pair) {
      // Priority 3: Controversial (close split)
      const pairs = await prisma.trainingPair.findMany({
        where: {
          status: { in: ['ACTIVE', 'NEEDS_MORE_VOTES'] },
          totalVotes: { gte: 3, lt: 10 },
          isHoneypot: false,
          id: { notIn: labeledPairIds },
        },
        include: {
          photo1: {
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              detectedSpecies: true,
            },
          },
          photo2: {
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              detectedSpecies: true,
            },
          },
        },
        take: 50,
      });

      // Find most controversial (closest to 50/50 split)
      if (pairs.length > 0) {
        pair = pairs.reduce((most, current) => {
          const currentRatio = current.totalVotes > 0
            ? Math.abs(0.5 - (current.sameVotes / current.totalVotes))
            : 1;
          const mostRatio = most.totalVotes > 0
            ? Math.abs(0.5 - (most.sameVotes / most.totalVotes))
            : 1;
          return currentRatio < mostRatio ? current : most;
        });
      }
    }

    if (!pair) {
      return NextResponse.json({
        pair: null,
        message: 'No more pairs to label. Check back later!',
      });
    }

    // Randomly swap photo order to prevent bias
    const swapped = Math.random() > 0.5;

    return NextResponse.json({
      pair: {
        id: pair.id,
        photo1: swapped ? pair.photo2 : pair.photo1,
        photo2: swapped ? pair.photo1 : pair.photo2,
        // Don't expose: isHoneypot, isSamePet, votes
      },
      isSwapped: swapped,  // For analytics, not shown to user
    });
  } catch (error) {
    console.error('Error getting next pair:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 5.2.2 Submit Label
**File:** `/frontend/app/api/training/label/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    const body = await request.json();
    const { pairId, vote, confidence, timeSpentMs } = body;

    // Validate inputs
    if (!pairId) {
      return NextResponse.json({ error: 'pairId is required' }, { status: 400 });
    }

    if (!['SAME', 'DIFFERENT', 'SKIP'].includes(vote)) {
      return NextResponse.json(
        { error: 'vote must be SAME, DIFFERENT, or SKIP' },
        { status: 400 }
      );
    }

    const confidenceValue = Math.min(5, Math.max(1, confidence || 3));

    // Get the pair
    const pair = await prisma.trainingPair.findUnique({
      where: { id: pairId },
    });

    if (!pair) {
      return NextResponse.json({ error: 'Pair not found' }, { status: 404 });
    }

    // Check if user already labeled this pair
    if (userId) {
      const existingLabel = await prisma.trainingLabel.findFirst({
        where: { pairId, labeledById: userId },
      });

      if (existingLabel) {
        return NextResponse.json(
          { error: 'You have already labeled this pair' },
          { status: 400 }
        );
      }
    }

    // Get labeler weight
    let weight = 0.5;  // Default for anonymous
    let labelerStats = null;

    if (userId) {
      labelerStats = await prisma.labelerStats.findUnique({
        where: { userId },
      });

      if (labelerStats) {
        switch (labelerStats.trustLevel) {
          mission 'NEW': weight = 0.5; break;
          mission 'LEARNING': weight = 0.7; break;
          mission 'REGULAR': weight = 1.0; break;
          mission 'TRUSTED': weight = 1.5; break;
          mission 'EXPERT': weight = 2.0; break;
          mission 'SUSPICIOUS': weight = 0.1; break;
          mission 'BANNED': weight = 0; break;
        }
      }
    }

    // Create the label
    const label = await prisma.trainingLabel.create({
      data: {
        pairId,
        labeledById: userId,
        vote,
        confidence: confidenceValue,
        timeSpentMs,
        weight,
      },
    });

    // Update pair vote counts
    const voteUpdate = {
      totalVotes: { increment: 1 },
      ...(vote === 'SAME' && { sameVotes: { increment: 1 } }),
      ...(vote === 'DIFFERENT' && { differentVotes: { increment: 1 } }),
      ...(vote === 'SKIP' && { skipVotes: { increment: 1 } }),
    };

    await prisma.trainingPair.update({
      where: { id: pairId },
      data: voteUpdate,
    });

    // Calculate points earned
    let pointsEarned = 5;  // Base points

    // Check honeypot accuracy
    let honeypotCorrect = null;
    if (pair.isHoneypot && pair.honeypotAnswer !== null && vote !== 'SKIP') {
      const userAnswer = vote === 'SAME';
      honeypotCorrect = userAnswer === pair.honeypotAnswer;

      if (honeypotCorrect) {
        pointsEarned += 10;  // Bonus for correct honeypot
      } else {
        pointsEarned = 0;  // No points for incorrect honeypot
      }
    }

    // Update labeler stats
    if (userId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!labelerStats) {
        // Create new labeler stats
        labelerStats = await prisma.labelerStats.create({
          data: {
            id: userId,
            userId,
            totalLabels: 1,
            labelsToday: 1,
            labelsThisWeek: 1,
            labelsThisMonth: 1,
            lastLabelAt: new Date(),
            totalPoints: pointsEarned,
            pointsThisWeek: pointsEarned,
            currentStreak: 1,
            longestStreak: 1,
            lastStreakDate: today,
            totalHoneypots: pair.isHoneypot ? 1 : 0,
            honeypotAccuracy: honeypotCorrect !== null ? (honeypotCorrect ? 1 : 0) : 0.5,
          },
        });
      } else {
        // Update existing stats
        const lastLabel = labelerStats.lastStreakDate;
        const isConsecutiveDay = lastLabel &&
          (today.getTime() - new Date(lastLabel).getTime()) <= 86400000 * 2;

        const newStreak = isConsecutiveDay ? labelerStats.currentStreak + 1 : 1;

        // Update honeypot accuracy
        let newHoneypotAccuracy = labelerStats.honeypotAccuracy;
        let newTotalHoneypots = labelerStats.totalHoneypots;
        if (pair.isHoneypot && honeypotCorrect !== null) {
          newTotalHoneypots += 1;
          newHoneypotAccuracy =
            (labelerStats.honeypotAccuracy * labelerStats.totalHoneypots +
              (honeypotCorrect ? 1 : 0)) / newTotalHoneypots;
        }

        await prisma.labelerStats.update({
          where: { userId },
          data: {
            totalLabels: { increment: 1 },
            labelsToday: { increment: 1 },
            labelsThisWeek: { increment: 1 },
            labelsThisMonth: { increment: 1 },
            lastLabelAt: new Date(),
            totalPoints: { increment: pointsEarned },
            pointsThisWeek: { increment: pointsEarned },
            currentStreak: newStreak,
            longestStreak: Math.max(newStreak, labelerStats.longestStreak),
            lastStreakDate: today,
            totalHoneypots: newTotalHoneypots,
            honeypotAccuracy: newHoneypotAccuracy,
          },
        });
      }

      // Update trust level based on labels and accuracy
      await updateTrustLevel(userId);
    }

    // Check if pair has reached consensus
    await checkConsensus(pairId);

    return NextResponse.json({
      success: true,
      pointsEarned,
      honeypotResult: pair.isHoneypot ? (honeypotCorrect ? 'correct' : 'incorrect') : null,
    });
  } catch (error) {
    console.error('Error submitting label:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function updateTrustLevel(userId) {
  const stats = await prisma.labelerStats.findUnique({
    where: { userId },
  });

  if (!stats) return;

  let newTrustLevel = stats.trustLevel;

  // Determine new trust level
  if (stats.isBanned) {
    newTrustLevel = 'BANNED';
  } else if (stats.honeypotAccuracy < 0.5 && stats.totalHoneypots >= 10) {
    newTrustLevel = 'SUSPICIOUS';
  } else if (stats.totalLabels >= 200 && stats.honeypotAccuracy >= 0.85) {
    newTrustLevel = 'TRUSTED';
  } else if (stats.totalLabels >= 50) {
    newTrustLevel = 'REGULAR';
  } else if (stats.totalLabels >= 20) {
    newTrustLevel = 'LEARNING';
  } else {
    newTrustLevel = 'NEW';
  }

  if (newTrustLevel !== stats.trustLevel) {
    await prisma.labelerStats.update({
      where: { userId },
      data: { trustLevel: newTrustLevel },
    });
  }
}

async function checkConsensus(pairId) {
  const pair = await prisma.trainingPair.findUnique({
    where: { id: pairId },
  });

  if (!pair || pair.isHoneypot) return;

  const totalNonSkip = pair.sameVotes + pair.differentVotes;

  // Need at least 3 non-skip votes
  if (totalNonSkip < 3) {
    if (pair.totalVotes >= 3) {
      await prisma.trainingPair.update({
        where: { id: pairId },
        data: { status: 'NEEDS_MORE_VOTES' },
      });
    }
    return;
  }

  // Check for strong consensus (>= 80% agreement)
  const sameRatio = pair.sameVotes / totalNonSkip;
  const hasConsensus = sameRatio >= 0.8 || sameRatio <= 0.2;

  if (hasConsensus) {
    await prisma.trainingPair.update({
      where: { id: pairId },
      data: {
        status: 'CONSENSUS_REACHED',
        isSamePet: sameRatio >= 0.5,
        labelSource: 'CROWDSOURCE',
        labelConfidence: Math.abs(sameRatio - 0.5) * 2,  // 0-1 scale
        labeledAt: new Date(),
      },
    });
  } else if (pair.totalVotes >= 10) {
    // Too many votes without consensus - flag for review
    await prisma.trainingPair.update({
      where: { id: pairId },
      data: {
        status: 'FLAGGED',
        flaggedReason: 'No consensus after 10+ votes',
      },
    });
  }
}
```

### 5.2.3 Get Leaderboard
**File:** `/frontend/app/api/training/leaderboard/route.js`

```javascript
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';  // 'week', 'month', 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    let orderByField;
    switch (period) {
      mission 'week':
        orderByField = 'pointsThisWeek';
        break;
      mission 'month':
        orderByField = 'labelsThisMonth';
        break;
      default:
        orderByField = 'totalPoints';
    }

    const leaders = await prisma.labelerStats.findMany({
      where: {
        trustLevel: { notIn: ['BANNED', 'SUSPICIOUS'] },
        [orderByField]: { gt: 0 },
      },
      orderBy: { [orderByField]: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    });

    const leaderboard = leaders.map((stats, index) => ({
      rank: index + 1,
      userId: stats.userId,
      name: `${stats.user.firstName} ${stats.user.lastName?.[0] || ''}.`,
      profileImage: stats.user.profileImage,
      points: period === 'week' ? stats.pointsThisWeek : stats.totalPoints,
      labels: period === 'week' ? stats.labelsThisWeek : stats.totalLabels,
      accuracy: Math.round(stats.honeypotAccuracy * 100),
      streak: stats.currentStreak,
      trustLevel: stats.trustLevel,
    }));

    return NextResponse.json({ leaderboard, period });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 5.2.4 Get My Stats
**File:** `/frontend/app/api/training/my-stats/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await prisma.labelerStats.findUnique({
      where: { userId: session.user.id },
    });

    if (!stats) {
      return NextResponse.json({
        stats: {
          totalLabels: 0,
          labelsToday: 0,
          totalPoints: 0,
          pointsThisWeek: 0,
          currentStreak: 0,
          longestStreak: 0,
          accuracy: 50,
          trustLevel: 'NEW',
          rank: null,
          dailyLimit: 100,
          dailyRemaining: 100,
        },
      });
    }

    // Get user's rank
    const rank = await prisma.labelerStats.count({
      where: {
        totalPoints: { gt: stats.totalPoints },
        trustLevel: { notIn: ['BANNED', 'SUSPICIOUS'] },
      },
    }) + 1;

    return NextResponse.json({
      stats: {
        totalLabels: stats.totalLabels,
        labelsToday: stats.labelsToday,
        totalPoints: stats.totalPoints,
        pointsThisWeek: stats.pointsThisWeek,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        accuracy: Math.round(stats.honeypotAccuracy * 100),
        trustLevel: stats.trustLevel,
        rank,
        dailyLimit: 100,
        dailyRemaining: Math.max(0, 100 - stats.labelsToday),
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## 5.3 Labeling Game Page

**File:** `/frontend/app/match-game/page.jsx`

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  Trophy,
  Flame,
  Zap,
  RefreshCw,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';

export default function MatchGamePage() {
  const { data: session, status } = useSession();

  const [pair, setPair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  const [streak, setStreak] = useState(0);
  const [pointsAnimation, setPointsAnimation] = useState(null);
  const [startTime, setStartTime] = useState(null);

  // Fetch next pair
  const fetchNextPair = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/training/next-pair');
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError(data.error);
          setPair(null);
        } else {
          throw new Error(data.error || 'Failed to fetch pair');
        }
        return;
      }

      if (data.pair) {
        setPair(data.pair);
        setStartTime(Date.now());
      } else {
        setPair(null);
        setError(data.message || 'No more pairs available');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user stats
  const fetchStats = useCallback(async () => {
    if (!session) return;

    try {
      const res = await fetch('/api/training/my-stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setStreak(data.stats.currentStreak);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [session]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/training/leaderboard?period=week&limit=5');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNextPair();
    fetchLeaderboard();
    if (session) {
      fetchStats();
    }
  }, [fetchNextPair, fetchLeaderboard, fetchStats, session]);

  // Submit vote
  const handleVote = async (vote) => {
    if (!pair || submitting) return;

    setSubmitting(true);

    const timeSpentMs = startTime ? Date.now() - startTime : null;

    try {
      const res = await fetch('/api/training/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairId: pair.id,
          vote,
          confidence: 3,
          timeSpentMs,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      // Show points animation
      if (data.pointsEarned > 0) {
        setPointsAnimation({
          points: data.pointsEarned,
          honeypot: data.honeypotResult,
        });
        setTimeout(() => setPointsAnimation(null), 2000);
      }

      // Update local streak
      if (vote !== 'SKIP') {
        setStreak((s) => s + 1);
      }

      // Refresh stats
      if (session) {
        fetchStats();
      }

      // Get next pair
      fetchNextPair();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (submitting || !pair) return;

      switch (e.key) {
        mission '1':
        mission 's':
        mission 'S':
          handleVote('SAME');
          break;
        mission '2':
        mission 'd':
        mission 'D':
          handleVote('DIFFERENT');
          break;
        mission '3':
        mission 'k':
        mission 'K':
          handleVote('SKIP');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pair, submitting]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pet Match Game</h1>
          <p className="text-gray-600 mt-2">
            Help train our AI by identifying matching pets
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-3">
            {/* Stats Bar */}
            {session && stats && (
              <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="font-semibold">{streak} streak</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <span>{stats.totalPoints} points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-purple-500" />
                    <span>#{stats.rank || '-'}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {stats.dailyRemaining} labels left today
                </div>
              </div>
            )}

            {/* Login prompt for anonymous users */}
            {status === 'unauthenticated' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-blue-800 font-medium">
                    Sign in to earn points and track your progress!
                  </p>
                  <p className="text-blue-600 text-sm">
                    You can still play anonymously
                  </p>
                </div>
                <Link
                  href="/login"
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
              </div>
            )}

            {/* Game Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {loading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mx-auto" />
                  <p className="text-gray-500 mt-4">Loading next pair...</p>
                </div>
              ) : error && !pair ? (
                <div className="p-12 text-center">
                  <p className="text-gray-600 mb-4">{error}</p>
                  <button
                    onClick={fetchNextPair}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              ) : pair ? (
                <>
                  {/* Question */}
                  <div className="bg-gray-100 p-4 text-center">
                    <h2 className="text-xl font-semibold text-gray-800">
                      Are these the same pet?
                    </h2>
                  </div>

                  {/* Photo Comparison */}
                  <div className="grid grid-cols-2 gap-4 p-6">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={pair.photo1.imageUrl}
                        alt="Pet 1"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={pair.photo2.imageUrl}
                        alt="Pet 2"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Vote Buttons */}
                  <div className="p-6 pt-0">
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        onClick={() => handleVote('SAME')}
                        disabled={submitting}
                        className="flex flex-col items-center gap-2 p-4 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-10 h-10" />
                        <span className="font-semibold">Same Pet</span>
                        <span className="text-xs text-green-600">Press S or 1</span>
                      </button>

                      <button
                        onClick={() => handleVote('DIFFERENT')}
                        disabled={submitting}
                        className="flex flex-col items-center gap-2 p-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-10 h-10" />
                        <span className="font-semibold">Different</span>
                        <span className="text-xs text-red-600">Press D or 2</span>
                      </button>

                      <button
                        onClick={() => handleVote('SKIP')}
                        disabled={submitting}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors disabled:opacity-50"
                      >
                        <HelpCircle className="w-10 h-10" />
                        <span className="font-semibold">Can't Tell</span>
                        <span className="text-xs text-gray-600">Press K or 3</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Points Animation */}
            <AnimatePresence>
              {pointsAnimation && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <div className="bg-yellow-400 text-yellow-900 px-8 py-4 rounded-2xl shadow-2xl text-center">
                    <div className="text-3xl font-bold">
                      +{pointsAnimation.points}
                    </div>
                    <div className="text-sm">
                      {pointsAnimation.honeypot === 'correct'
                        ? 'Quality check passed!'
                        : 'Points earned!'}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Leaderboard */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                This Week's Leaders
              </h3>
              <div className="space-y-3">
                {leaderboard.map((leader) => (
                  <div
                    key={leader.userId}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        leader.rank === 1
                          ? 'bg-yellow-400 text-yellow-900'
                          : leader.rank === 2
                          ? 'bg-gray-300 text-gray-700'
                          : leader.rank === 3
                          ? 'bg-orange-300 text-orange-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {leader.rank}
                    </div>
                    <div className="flex-1 truncate">
                      <div className="font-medium text-gray-800 truncate">
                        {leader.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {leader.labels} labels
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-700">
                      {leader.points}
                    </div>
                  </div>
                ))}

                {leaderboard.length === 0 && (
                  <p className="text-gray-500 text-sm">
                    No leaders yet this week
                  </p>
                )}
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-800 mb-4">
                How It Works
              </h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <strong>1.</strong> Look at both photos carefully
                </p>
                <p>
                  <strong>2.</strong> Decide if they show the same pet
                </p>
                <p>
                  <strong>3.</strong> Click your answer or use keyboard
                </p>
                <p>
                  <strong>4.</strong> Earn points and help find lost pets!
                </p>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 rounded-xl p-6">
              <h3 className="font-semibold text-blue-800 mb-3">Tips</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>Look for unique markings</li>
                <li>Check ear shapes and eye positions</li>
                <li>Consider lighting differences</li>
                <li>When unsure, click "Can't Tell"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 5.4 Verification Checklist

- [ ] GET /api/training/next-pair returns valid pair
- [ ] POST /api/training/label accepts vote and updates counts
- [ ] Honeypot pairs are served ~10% of time
- [ ] Daily limit (100) is enforced
- [ ] Leaderboard shows top labelers
- [ ] Points are awarded correctly
- [ ] Streaks are tracked
- [ ] Trust level updates based on accuracy
- [ ] Consensus detection works (≥80% agreement)
- [ ] UI keyboard shortcuts work
- [ ] Points animation displays

## 5.5 Edge Missions Handled

| Edge Mission | Handling |
|-----------|----------|
| User labels same pair twice | Unique constraint prevents, returns 400 |
| Anonymous user | Allowed with reduced weight, no stats tracking |
| No pairs available | Returns message, UI shows appropriate state |
| Rapid submissions | Submitting state prevents double-click |
| User at daily limit | Returns 429, UI shows message |
| All photos from same pet | Can still label, but auto-labeled pairs exist |
| Honeypot answered wrong | Points = 0, accuracy updated |
| Low accuracy user | Trust level drops, vote weight reduced |
| Pair with many skip votes | Still counts toward consensus threshold |
| Network error during submit | Error shown, pair remains for retry |

---

# PART 6: PHASE 4 - ADMIN DASHBOARD

*[This section would continue with the same level of detail for the admin dashboard, including exact API endpoints, UI components, and all edge missions]*

---

# PART 7: PHASES 5-10 OVERVIEW

Due to document length, phases 5-10 are summarized here. Each would follow the same exhaustive pattern.

## Phase 5: Neural Network Training
- PyTorch model architecture (Siamese + EfficientNet)
- Training script with contrastive loss
- Data export script (DB -> training format)
- Model evaluation metrics
- ONNX export for inference

## Phase 6: Inference API
- Embedding generation service
- ONNX Runtime integration
- Vector similarity search (pgvector)
- Match scoring algorithm
- Caching layer

## Phase 7: Public Matching Page
- Photo upload and search
- Results display with confidence
- Score breakdown visualization
- Contact/claim workflow

## Phase 8: Feedback Loop
- Match feedback collection
- Automatic pair generation from reunions
- Hard negative mining
- Model retraining triggers

## Phase 9: External Integrations
- PetFinder API integration
- Shelter intake auto-matching
- Social media monitoring (design)

## Phase 10: Production Hardening
- Performance optimization
- Monitoring and alerting
- Security hardening

---

# APPENDIX A: COMPLETE FILE LIST

```
Files to CREATE:
/frontend/prisma/seed-ai.js
/frontend/app/api/pets/[petId]/photos/route.js
/frontend/app/api/pets/[petId]/photos/[photoId]/route.js
/frontend/app/api/training/next-pair/route.js
/frontend/app/api/training/label/route.js
/frontend/app/api/training/leaderboard/route.js
/frontend/app/api/training/my-stats/route.js
/frontend/app/api/admin/ai/stats/route.js
/frontend/app/api/admin/ai/pairs/route.js
/frontend/app/api/admin/ai/labelers/route.js
/frontend/app/api/admin/ai/models/route.js
/frontend/app/api/admin/ai/training/route.js
/frontend/app/lib/ai/photoProcessor.js
/frontend/app/lib/ai/embeddingService.js
/frontend/app/lib/ai/matchingService.js
/frontend/app/match-game/page.jsx
/frontend/app/find-my-pet/page.jsx
/frontend/app/admin/ai/page.jsx
/frontend/app/admin/ai/data/page.jsx
/frontend/app/admin/ai/labelers/page.jsx
/frontend/app/admin/ai/models/page.jsx
/frontend/components/pet/PetPhotoGallery.jsx
/frontend/components/training/PhotoPairCard.jsx
/frontend/components/training/Leaderboard.jsx
/frontend/components/matching/PhotoUploader.jsx
/frontend/components/matching/MatchResultCard.jsx

Files to MODIFY:
/frontend/prisma/schema.prisma (add AI models)
/frontend/package.json (add dependencies: react-dropzone, onnxruntime-node)
```

# APPENDIX B: DEPENDENCIES TO ADD

```json
{
  "dependencies": {
    "react-dropzone": "^14.2.3",
    "onnxruntime-node": "^1.16.0"
  }
}
```

Install with:
```bash
cd /home/user/reunitepets/frontend
npm install react-dropzone onnxruntime-node
```

---

**END OF IMPLEMENTATION GUIDE**

This document is self-contained and can be used in a new Claude context window to implement the AI pet matching system phase by phase.
