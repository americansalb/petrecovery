# AI Pet Matching System - Implementation Plan

**Version:** 1.0
**Created:** December 2024
**Goal:** Build an industry-leading neural network-based pet matching system

---

## Executive Summary

This plan outlines the development of a comprehensive AI pet matching system that will:
1. Collect training data through user-contributed pet photos
2. Train a neural network to generate pet embeddings (visual fingerprints)
3. Match lost pets against found reports, shelter intakes, and social media
4. Provide confidence scores for every match
5. Continuously improve through user feedback

**Timeline:** 12-16 weeks for core functionality
**Data Target:** 10,000+ labeled pet image pairs within 6 months

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER-FACING LAYER                            │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│  Pet Profile    │  Pet Matching   │  Training Game                  │
│  Upload UI      │  Search Page    │  (Crowdsourced Labeling)        │
└────────┬────────┴────────┬────────┴──────────────┬──────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                    │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│  /api/ai/       │  /api/training/ │  /api/admin/ai/                 │
│  - embed        │  - pairs        │  - model-stats                  │
│  - match        │  - label        │  - training-queue               │
│  - analyze      │  - feedback     │  - export-data                  │
└────────┬────────┴────────┬────────┴──────────────┬──────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ML PIPELINE LAYER                               │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│  Embedding      │  Training       │  Model                          │
│  Generation     │  Pipeline       │  Registry                       │
│  (Inference)    │  (Fine-tuning)  │  (Versioning)                   │
└────────┬────────┴────────┬────────┴──────────────┬──────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                     │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│  PostgreSQL     │  Vector DB      │  Blob Storage                   │
│  (Metadata)     │  (Embeddings)   │  (Images)                       │
└─────────────────┴─────────────────┴─────────────────────────────────┘
```

---

## Phase 1: Database Schema & Foundation (Week 1-2)

### 1.1 New Database Models

```prisma
// Pet Photo Collection (multiple photos per pet for training)
model PetPhoto {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())

  // Ownership
  petId       String?
  pet         Pet?     @relation(fields: [petId], references: [id])
  uploadedById String
  uploadedBy  User     @relation(fields: [uploadedById], references: [id])

  // Image data
  imageUrl    String
  thumbnailUrl String?

  // ML Processing
  embedding       String?  // Base64 encoded 512-dim vector
  embeddingModel  String?  // Model version used (e.g., "petnet-v1.0")
  processedAt     DateTime?
  processingError String?

  // Quality metrics
  qualityScore    Float?   // 0-1 (blur, lighting, framing)
  hasPetFace      Boolean  @default(false)
  species         String?  // Detected: dog, cat, bird, other
  boundingBox     String?  // JSON: {x, y, width, height}

  // Labels (crowdsourced)
  labelCount      Int      @default(0)
  isVerified      Boolean  @default(false)

  @@index([petId])
  @@index([uploadedById])
  @@index([processedAt])
  @@index([species])
}

// Training Pairs (same pet, different photos)
model TrainingPair {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())

  // The pair
  photo1Id    String
  photo1      PetPhoto @relation("Photo1", fields: [photo1Id], references: [id])
  photo2Id    String
  photo2      PetPhoto @relation("Photo2", fields: [photo2Id], references: [id])

  // Label (ground truth)
  isSamePet   Boolean?  // null = unlabeled, true = same, false = different
  confidence  Float?    // Consensus confidence 0-1

  // Labeling stats
  labelCount  Int       @default(0)
  sameVotes   Int       @default(0)
  diffVotes   Int       @default(0)

  // Source
  source      TrainingPairSource @default(USER_UPLOAD)
  isHardNegative Boolean @default(false)  // Similar-looking different pets

  // Training status
  usedInTraining Boolean @default(false)
  trainingBatch  String?

  @@unique([photo1Id, photo2Id])
  @@index([isSamePet])
  @@index([labelCount])
  @@index([usedInTraining])
}

enum TrainingPairSource {
  USER_UPLOAD      // Same pet profile, multiple photos
  CONFIRMED_REUNION // Lost pet matched with found
  CROWDSOURCED     // Users labeled as same/different
  SYNTHETIC        // Augmented data
  EXTERNAL         // External dataset
}

// User Labels (crowdsourced annotations)
model TrainingLabel {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())

  // The pair being labeled
  pairId      String
  pair        TrainingPair @relation(fields: [pairId], references: [id])

  // Who labeled
  labeledById String
  labeledBy   User     @relation(fields: [labeledById], references: [id])

  // The label
  isSamePet   Boolean
  confidence  Int      // 1-5 (how sure they are)
  timeSpent   Int?     // Milliseconds spent on decision

  // Quality control
  isSpam      Boolean  @default(false)
  weight      Float    @default(1.0)  // Trusted users get higher weight

  @@unique([pairId, labeledById])
  @@index([labeledById])
}

// Labeler Reputation (for quality control)
model LabelerStats {
  userId      String   @id
  user        User     @relation(fields: [userId], references: [id])

  // Activity
  totalLabels     Int   @default(0)
  labelsThisWeek  Int   @default(0)

  // Accuracy (compared to consensus)
  accuracyScore   Float @default(0.5)  // 0-1
  agreementRate   Float @default(0.5)  // How often they agree with others

  // Rewards
  pointsEarned    Int   @default(0)
  rank            Int?

  // Trust level affects label weight
  trustLevel      LabelerTrustLevel @default(NEW)

  updatedAt   DateTime @updatedAt
}

enum LabelerTrustLevel {
  NEW          // < 50 labels, weight = 0.5
  REGULAR      // 50-200 labels, weight = 1.0
  TRUSTED      // 200+ labels, high accuracy, weight = 1.5
  EXPERT       // Admin-promoted, weight = 2.0
  SUSPICIOUS   // Low accuracy, weight = 0.1
}

// AI Model Registry
model AIModel {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())

  // Model identity
  name        String   // "petnet-v1.0"
  version     String   // "1.0.0"
  description String?

  // Architecture
  architecture String  // "resnet50", "efficientnet-b4", "vit-base"
  embeddingDim Int     // 128, 256, 512
  inputSize   Int      // 224, 384

  // Training info
  trainedOn       DateTime?
  trainingPairs   Int?
  epochs          Int?
  finalLoss       Float?

  // Performance metrics
  accuracy        Float?   // On held-out test set
  precision       Float?
  recall          Float?
  f1Score         Float?
  aucRoc          Float?

  // Deployment
  status          ModelStatus @default(TRAINING)
  isActive        Boolean     @default(false)  // Currently serving
  modelUrl        String?     // S3/Bunny URL to model weights

  // Usage stats
  totalInferences Int @default(0)
  avgLatencyMs    Float?

  @@unique([name, version])
  @@index([status])
  @@index([isActive])
}

enum ModelStatus {
  TRAINING
  VALIDATING
  READY
  DEPLOYED
  DEPRECATED
  FAILED
}

// Match Results (for feedback loop)
model AIMatchResult {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())

  // The match
  lostPetPhotoId   String
  foundPetPhotoId  String

  // Scores
  embeddingScore   Float    // Cosine similarity 0-1
  metadataScore    Float    // Species, color, size match 0-1
  combinedScore    Float    // Weighted combination
  confidence       Float    // Final confidence 0-100

  // Model used
  modelId     String?
  model       AIModel? @relation(fields: [modelId], references: [id])

  // User feedback (ground truth)
  userVerified     Boolean?
  isCorrectMatch   Boolean?  // Was this actually the same pet?
  feedbackAt       DateTime?
  feedbackById     String?

  @@index([lostPetPhotoId])
  @@index([foundPetPhotoId])
  @@index([combinedScore])
  @@index([isCorrectMatch])
}
```

### 1.2 Deliverables
- [ ] Add new models to `schema.prisma`
- [ ] Create and run migration
- [ ] Add indexes for query performance
- [ ] Seed initial test data

---

## Phase 2: Photo Collection & Processing Pipeline (Week 2-3)

### 2.1 Enhanced Pet Profile Photos

**Goal:** Allow users to upload 3-10 photos per pet for training data.

#### UI: Pet Photo Gallery Component
```
Location: /components/pet/PetPhotoGallery.jsx

Features:
- Drag-and-drop multi-photo upload
- Photo carousel with thumbnails
- "Best photo" selection for primary display
- Photo quality indicator (blur detection)
- Remove/reorder functionality
- Progress indicators during processing
```

#### API Endpoints
```
POST   /api/pets/[id]/photos          - Upload new photos
DELETE /api/pets/[id]/photos/[photoId] - Remove photo
PATCH  /api/pets/[id]/photos/[photoId] - Set as primary
GET    /api/pets/[id]/photos          - List all photos
```

### 2.2 Image Processing Pipeline

**Background Job:** Process uploaded images asynchronously.

```javascript
// /app/lib/ai/imageProcessor.js

Pipeline steps:
1. Quality Assessment
   - Blur detection (Laplacian variance)
   - Lighting analysis
   - Face detection (is there a pet?)
   - Framing score

2. Preprocessing
   - Resize to 384x384
   - Normalize pixel values
   - Apply augmentation for training

3. Embedding Generation
   - Run through neural network
   - Store 512-dim embedding vector
   - Update PetPhoto record

4. Auto-Pair Creation
   - For same pet, create TrainingPairs
   - Mark as source = USER_UPLOAD
```

### 2.3 Deliverables
- [ ] Pet photo gallery component
- [ ] Multi-upload API endpoint
- [ ] Background processing job
- [ ] Quality assessment function
- [ ] Auto-pairing logic for same-pet photos

---

## Phase 3: Crowdsourced Labeling System (Week 3-5)

### 3.1 "Pet Match Game" - Public Labeling UI

**Goal:** Gamified interface where users label pet photo pairs.

```
Location: /app/match-game/page.jsx

Game Flow:
1. Show two pet photos side-by-side
2. Ask: "Are these the same pet?"
3. User clicks: "Same Pet" / "Different Pet" / "Can't Tell"
4. Show feedback (streak counter, points)
5. Load next pair
6. Leaderboard for top labelers

Gamification:
- Points per label (5 base + bonus for consensus)
- Streak bonuses (10 in a row = 2x points)
- Daily challenges ("Label 20 pairs today")
- Badges: "Sharp Eye" (90%+ accuracy), "Speedster", etc.
- Weekly leaderboard
```

#### UI Components
```
/components/training/
├── PetMatchGame.jsx       - Main game container
├── PhotoPairCard.jsx      - Side-by-side comparison
├── LabelButtons.jsx       - Same/Different/Skip buttons
├── StreakCounter.jsx      - Current streak display
├── PointsPopup.jsx        - "+5 points!" animation
├── DailyProgress.jsx      - Progress toward daily goal
└── Leaderboard.jsx        - Top labelers this week
```

### 3.2 Smart Pair Selection Algorithm

**Goal:** Show the most valuable pairs for labeling.

```javascript
// Priority order for pair selection:
1. Unlabeled pairs (labelCount = 0)
2. Controversial pairs (close split between same/diff votes)
3. Hard negatives (similar-looking different pets)
4. Pairs needing consensus (< 3 labels)
5. Random sampling for diversity

// Anti-gaming measures:
- Rate limit: max 100 labels/day per user
- Honeypot pairs (known ground truth) to detect spam
- Require 3+ consistent labels for consensus
- Flag users with < 60% accuracy for review
```

### 3.3 API Endpoints
```
GET    /api/training/next-pair           - Get next pair to label
POST   /api/training/label               - Submit a label
GET    /api/training/my-stats            - User's labeling stats
GET    /api/training/leaderboard         - Top labelers
POST   /api/training/report-pair         - Report problematic pair
```

### 3.4 Deliverables
- [ ] Pet Match Game page with full UI
- [ ] Pair selection algorithm
- [ ] Label submission API
- [ ] Points and streak system
- [ ] Leaderboard functionality
- [ ] Anti-spam honeypot system
- [ ] User accuracy tracking

---

## Phase 4: Admin AI Dashboard (Week 5-7)

### 4.1 Admin-Only Training Dashboard

**Goal:** Comprehensive dashboard for monitoring and managing AI training.

```
Location: /app/admin/ai/page.jsx
Access: ADMIN role only

Sections:
┌─────────────────────────────────────────────────────────────────────┐
│  AI Training Dashboard                              [Export Data]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   12,847    │  │   8,234     │  │   87.3%     │  │   v1.2.0   │ │
│  │ Total Pairs │  │  Labeled    │  │  Accuracy   │  │ Active Mdl │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                                     │
│  ══════════════════════════════════════════════════════════════════ │
│                                                                     │
│  📊 Training Data Overview                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ [Chart: Labels over time - line graph]                       │  │
│  │ [Chart: Label distribution - pie chart]                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  🧠 Model Performance                                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Model      │ Status  │ Accuracy │ F1    │ Inferences │ Action│  │
│  │─────────────────────────────────────────────────────────────│  │
│  │ petnet-1.2 │ ACTIVE  │ 87.3%    │ 0.84  │ 45,231     │ [...]│  │
│  │ petnet-1.1 │ READY   │ 84.1%    │ 0.81  │ 12,847     │ [...]│  │
│  │ petnet-1.0 │ DEPR    │ 79.2%    │ 0.76  │ 8,234      │ [...]│  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  👥 Labeler Quality                                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ [Table: Top labelers, accuracy, flags]                       │  │
│  │ [Chart: Accuracy distribution]                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ⚙️ Training Queue                                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ [Button: Start New Training Run]                             │  │
│  │ [List: Pending/Running training jobs]                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Admin Features

#### 4.2.1 Data Quality Management
```
/app/admin/ai/data/page.jsx

Features:
- Browse all training pairs with filters
- Manual label override (admin ground truth)
- Flag/remove bad pairs
- View pair labeling history
- Export labeled dataset (JSON/CSV)
```

#### 4.2.2 Labeler Management
```
/app/admin/ai/labelers/page.jsx

Features:
- View all labelers with stats
- Adjust trust levels manually
- Ban suspicious accounts
- View labeling patterns (detect bots)
- Reward top contributors
```

#### 4.2.3 Model Management
```
/app/admin/ai/models/page.jsx

Features:
- List all model versions
- View training metrics & curves
- A/B test deployment
- Rollback to previous version
- Download model weights
- View inference logs
```

#### 4.2.4 Training Control
```
/app/admin/ai/training/page.jsx

Features:
- Configure training hyperparameters
- Start/stop training jobs
- Monitor training progress (loss curves)
- Validate model on test set
- Promote model to production
```

### 4.3 Admin API Endpoints
```
GET    /api/admin/ai/stats              - Dashboard stats
GET    /api/admin/ai/pairs              - List training pairs
PATCH  /api/admin/ai/pairs/[id]         - Override label
DELETE /api/admin/ai/pairs/[id]         - Remove pair
GET    /api/admin/ai/labelers           - List labelers
PATCH  /api/admin/ai/labelers/[id]      - Update trust level
GET    /api/admin/ai/models             - List models
POST   /api/admin/ai/models/deploy      - Deploy model
POST   /api/admin/ai/training/start     - Start training
GET    /api/admin/ai/training/status    - Training progress
POST   /api/admin/ai/export             - Export dataset
```

### 4.4 Deliverables
- [ ] Admin AI dashboard page
- [ ] Stats cards and charts
- [ ] Training pairs browser
- [ ] Labeler management page
- [ ] Model management page
- [ ] Training control panel
- [ ] Data export functionality
- [ ] All admin API endpoints

---

## Phase 5: Neural Network Architecture (Week 6-8)

### 5.1 Model Architecture

**Recommended:** Siamese Network with EfficientNet-B4 backbone

```
Architecture Overview:

┌─────────────┐     ┌─────────────┐
│   Image A   │     │   Image B   │
└──────┬──────┘     └──────┬──────┘
       │                   │
       ▼                   ▼
┌─────────────────────────────────┐
│     Shared EfficientNet-B4      │  (Pre-trained on ImageNet)
│         (Feature Extractor)     │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│      Global Average Pooling     │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│     Fully Connected (512)       │  → Embedding Vector
│          + BatchNorm            │
│          + ReLU                 │
└──────────────┬──────────────────┘
               │
         ┌─────┴─────┐
         │           │
    Embedding A  Embedding B
         │           │
         └─────┬─────┘
               │
               ▼
┌─────────────────────────────────┐
│     Cosine Similarity           │  → Match Score (0-1)
│  or Euclidean Distance          │
└─────────────────────────────────┘
```

### 5.2 Training Strategy

```python
# Training Configuration

# Loss Function: Contrastive Loss
# - Pull same-pet embeddings together
# - Push different-pet embeddings apart

def contrastive_loss(embedding1, embedding2, label, margin=1.0):
    distance = euclidean_distance(embedding1, embedding2)
    loss = label * distance^2 + (1-label) * max(0, margin - distance)^2
    return loss

# Training Hyperparameters
config = {
    "backbone": "efficientnet-b4",
    "embedding_dim": 512,
    "input_size": 384,
    "batch_size": 32,
    "learning_rate": 1e-4,
    "epochs": 50,
    "optimizer": "AdamW",
    "scheduler": "CosineAnnealing",
    "augmentation": {
        "horizontal_flip": True,
        "rotation": 15,
        "color_jitter": 0.2,
        "random_crop": True,
    }
}

# Data Split
# - 80% training
# - 10% validation
# - 10% test (held out, never seen during training)
```

### 5.3 Training Pipeline Options

#### Option A: Cloud Training (Recommended for Production)
```
Provider: AWS SageMaker / Google Vertex AI / Lambda Labs

Workflow:
1. Export labeled pairs from database
2. Upload to S3/GCS
3. Trigger training job
4. Monitor via CloudWatch/console
5. Download trained model
6. Upload to model registry
```

#### Option B: Local Training (Development)
```
Requirements: GPU with 8GB+ VRAM (RTX 3070 or better)

Workflow:
1. Export labeled pairs
2. Run training script locally
3. Validate model
4. Upload to Bunny.net/S3
```

#### Option C: Pre-trained + Fine-tuning (Quick Start)
```
Use existing pet recognition model as starting point:
- Finding Rover's approach (if available)
- General animal recognition models
- Fine-tune on your data

This gets you 70-80% accuracy quickly.
```

### 5.4 Model Files

```
/app/lib/ml/
├── model.py                 # PyTorch model definition
├── dataset.py               # Custom dataset class
├── train.py                 # Training script
├── evaluate.py              # Evaluation metrics
├── export.py                # Export to ONNX/TorchScript
└── inference.py             # Inference wrapper

/scripts/
├── export_training_data.js  # Export DB to training format
├── start_training.sh        # Launch training job
├── validate_model.js        # Test model accuracy
└── deploy_model.js          # Push to production
```

### 5.5 Deliverables
- [ ] PyTorch model architecture
- [ ] Training dataset class
- [ ] Training script with logging
- [ ] Evaluation script
- [ ] Model export (ONNX for JS inference)
- [ ] Training data export script

---

## Phase 6: Inference API (Week 8-10)

### 6.1 Embedding Generation Service

```javascript
// /app/lib/ai/embeddingService.js

// Option 1: ONNX Runtime (runs in Node.js)
import * as ort from 'onnxruntime-node';

class EmbeddingService {
  constructor() {
    this.session = null;
    this.modelPath = process.env.MODEL_PATH;
  }

  async initialize() {
    this.session = await ort.InferenceSession.create(this.modelPath);
  }

  async generateEmbedding(imageUrl) {
    // 1. Download and preprocess image
    const tensor = await preprocessImage(imageUrl);

    // 2. Run inference
    const results = await this.session.run({ input: tensor });

    // 3. Return normalized embedding
    return normalizeVector(results.embedding.data);
  }

  async compareImages(imageUrl1, imageUrl2) {
    const [emb1, emb2] = await Promise.all([
      this.generateEmbedding(imageUrl1),
      this.generateEmbedding(imageUrl2)
    ]);

    return cosineSimilarity(emb1, emb2);
  }
}

// Option 2: External API (AWS/GCP/Replicate)
class ExternalEmbeddingService {
  async generateEmbedding(imageUrl) {
    const response = await fetch(process.env.EMBEDDING_API_URL, {
      method: 'POST',
      body: JSON.stringify({ image_url: imageUrl }),
      headers: { 'Authorization': `Bearer ${process.env.EMBEDDING_API_KEY}` }
    });
    return response.json();
  }
}
```

### 6.2 Matching API Endpoints

```
POST /api/ai/embed
  Input: { imageUrl: string }
  Output: { embedding: number[], species: string, confidence: number }

POST /api/ai/match
  Input: { imageUrl: string, filters?: { species, location, dateRange } }
  Output: {
    matches: [
      {
        missionId, petName, photoUrl,
        score: { visual, metadata, combined },
        confidence: number
      }
    ]
  }

POST /api/ai/compare
  Input: { imageUrl1: string, imageUrl2: string }
  Output: { similarity: number, confidence: number, details: {} }

GET /api/ai/search?lostMissionId=xxx
  Output: { potentialMatches: [...], shelterMatches: [...] }
```

### 6.3 Vector Search (Efficient Matching)

```javascript
// For efficient similarity search across thousands of pets

// Option 1: pgvector (PostgreSQL extension)
// Store embeddings directly in Postgres with vector similarity search
// Good for < 100k vectors

// Option 2: Pinecone / Weaviate / Qdrant
// Dedicated vector database for large scale
// Better for 100k+ vectors

// Implementation with pgvector:
await prisma.$executeRaw`
  CREATE EXTENSION IF NOT EXISTS vector;
  ALTER TABLE "PetPhoto" ADD COLUMN embedding_vec vector(512);
`;

// Query similar pets:
const similar = await prisma.$queryRaw`
  SELECT id, "petId", "imageUrl",
         1 - (embedding_vec <=> ${queryVector}::vector) as similarity
  FROM "PetPhoto"
  WHERE embedding_vec IS NOT NULL
    AND species = ${targetSpecies}
  ORDER BY embedding_vec <=> ${queryVector}::vector
  LIMIT 20
`;
```

### 6.4 Deliverables
- [ ] Embedding generation service
- [ ] ONNX model loading
- [ ] Image preprocessing pipeline
- [ ] Match API endpoints
- [ ] Vector similarity search (pgvector)
- [ ] Caching layer for embeddings

---

## Phase 7: Public Matching Page (Week 10-12)

### 7.1 Pet Matching Search Page

```
Location: /app/find-my-pet/page.jsx

User Flow:
1. Upload photo of lost/found pet
2. System generates embedding
3. Search against database
4. Show top matches with confidence scores
5. User can report sighting or contact owner

UI Layout:
┌─────────────────────────────────────────────────────────────────────┐
│                      🔍 Find My Pet                                  │
│                                                                      │
│  Upload a photo of your lost pet to search our database            │
│  of found pets, shelter intakes, and sightings.                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                                                            │    │
│  │     [Drag & drop or click to upload]                      │    │
│  │                                                            │    │
│  │     📷 Upload Pet Photo                                    │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Optional Filters:                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ ┌───────────────┐  │
│  │ Species ▼│ │ Color   ▼│ │ Location (ZIP)   │ │ Date Range   │  │
│  └──────────┘ └──────────┘ └──────────────────┘ └───────────────┘  │
│                                                                      │
│                         [🔍 Search]                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

Results View:
┌─────────────────────────────────────────────────────────────────────┐
│  Found 12 Potential Matches                    [Sort: Best Match ▼] │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🏆 94% Match                                    FOUND PET   │   │
│  │ ┌────────┐                                                  │   │
│  │ │ [Photo]│  Max - Golden Retriever                          │   │
│  │ │        │  Found: Dec 8, 2024 • Oak Park, IL               │   │
│  │ └────────┘  "Found wandering on Main St, very friendly"     │   │
│  │                                                              │   │
│  │  Visual: 96% | Breed: 100% | Color: 95% | Location: 85%     │   │
│  │                                                              │   │
│  │  [👀 View Details]  [📧 Contact Finder]  [✓ This is my pet] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🥈 87% Match                                    SHELTER     │   │
│  │ ┌────────┐                                                  │   │
│  │ │ [Photo]│  Unknown - Golden Mix                            │   │
│  │ │        │  Chicago Animal Care • Intake: Dec 7, 2024       │   │
│  │ └────────┘  Stray intake, no collar or microchip            │   │
│  │                                                              │   │
│  │  Visual: 89% | Breed: 90% | Color: 88% | Location: 80%      │   │
│  │                                                              │   │
│  │  [👀 View Details]  [📞 Call Shelter]  [✓ This is my pet]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Components

```
/components/matching/
├── PhotoUploader.jsx        - Drag & drop upload
├── SearchFilters.jsx        - Species, color, location, date
├── MatchResultCard.jsx      - Individual match display
├── MatchScoreBreakdown.jsx  - Visual/breed/color scores
├── ConfidenceBadge.jsx      - 94% match badge
├── MatchCompareModal.jsx    - Side-by-side comparison
├── ContactOwnerModal.jsx    - Send message to finder
├── ClaimPetFlow.jsx         - "This is my pet" workflow
└── NoMatchesFound.jsx       - Empty state with suggestions
```

### 7.3 Deliverables
- [ ] Find My Pet page
- [ ] Photo upload with preview
- [ ] Search filters (species, location, date)
- [ ] Match results display
- [ ] Score breakdown visualization
- [ ] Side-by-side comparison modal
- [ ] Contact/claim workflow
- [ ] Mobile-responsive design

---

## Phase 8: Feedback Loop & Continuous Learning (Week 12-14)

### 8.1 User Feedback Collection

```javascript
// Collect feedback on match quality

// When user clicks "This is my pet" or "Not my pet"
POST /api/ai/feedback
{
  matchResultId: "xxx",
  isCorrectMatch: true/false,
  actualPetId: "xxx" // if they found their pet elsewhere
}

// This feedback:
// 1. Updates AIMatchResult.isCorrectMatch
// 2. Creates/updates TrainingPair with ground truth
// 3. Triggers model performance recalculation
```

### 8.2 Automatic Pair Generation

```javascript
// Sources of high-quality training pairs:

1. Confirmed Reunions
   - Lost pet marked as REUNITED
   - Match the lost pet photos with found/sighting photos
   - Label as isSamePet = true

2. User Feedback
   - "This is my pet" on match result
   - Create positive pair

3. Shelter Matches
   - Owner claims pet from shelter
   - Match profile photos with intake photos

4. Negative Mining
   - Similar-looking pets (high visual score)
   - But confirmed different (different owners)
   - Create hard negative pairs
```

### 8.3 Model Retraining Triggers

```javascript
// Automatically retrain when:

const RETRAIN_TRIGGERS = {
  newLabeledPairs: 5000,      // Every 5k new pairs
  accuracyDrop: 0.05,         // If accuracy drops 5%
  timeBased: '1 month',       // Monthly minimum
  manualTrigger: true,        // Admin can force
};

// Retraining workflow:
1. Export new training data
2. Combine with existing data
3. Train new model version
4. Validate on test set
5. If better, deploy; else alert admin
```

### 8.4 Deliverables
- [ ] Feedback collection API
- [ ] Automatic pair generation from reunions
- [ ] Hard negative mining
- [ ] Model performance monitoring
- [ ] Automated retraining pipeline
- [ ] A/B testing for new models

---

## Phase 9: External Data Sources (Week 14-16)

### 9.1 Shelter API Integration

```javascript
// Connect to shelter databases for matching

// PetFinder API
GET https://api.petfinder.com/v2/animals
- Search by location, species, breed
- Get intake photos
- Run through matching pipeline

// Shelter APIs to integrate:
- PetFinder (national)
- Petango (national)
- Local shelter systems (varies by city)
- ASPCA partner shelters
```

### 9.2 Social Media Monitoring (Future)

```javascript
// Monitor for lost/found pet posts

// Facebook Groups (with proper authorization)
- "Lost and Found Pets [City]"
- Community groups

// Nextdoor (API partnership needed)
- Lost pet posts in area

// Instagram/Twitter
- Hashtag monitoring
- #lostdog #foundcat etc.

// Workflow:
1. Detect lost/found pet post
2. Extract images
3. Run through matcher
4. Alert potential matches
```

### 9.3 Deliverables
- [ ] PetFinder API integration
- [ ] Shelter intake auto-matching
- [ ] Social media monitoring (design doc)
- [ ] Cross-platform match alerts

---

## Phase 10: Production Hardening (Week 16+)

### 10.1 Performance Optimization

```
- Embedding caching (Redis)
- Batch inference for efficiency
- CDN for model weights
- Query optimization for vector search
- Rate limiting for API endpoints
```

### 10.2 Monitoring & Alerting

```
- Model accuracy dashboards
- Inference latency tracking
- Error rate monitoring
- Daily match quality reports
- Alert on accuracy degradation
```

### 10.3 Security

```
- Input validation (file types, sizes)
- Rate limiting (prevent abuse)
- API key management
- Audit logging
- GDPR compliance for pet photos
```

---

## Data Collection Strategy

### Target: 10,000+ Labeled Pairs in 6 Months

| Source | Estimated Pairs | Quality |
|--------|-----------------|---------|
| User pet profiles (3+ photos each) | 3,000 | High |
| Confirmed reunions | 500 | Very High |
| Crowdsourced labeling | 5,000 | Medium |
| Shelter intake matching | 1,000 | High |
| Synthetic augmentation | 2,000 | Medium |
| **Total** | **11,500** | - |

### Incentives for Data Collection

1. **Pet Profile Photos**
   - "Complete your pet's profile" prompt
   - Show "matching readiness" score
   - Gamify with badges

2. **Labeling Game**
   - Points toward rescue levels
   - Weekly leaderboard prizes
   - "Help find lost pets" messaging

3. **Reunion Stories**
   - Feature reunited pets on homepage
   - Ask for before/after photos
   - Share success stories

---

## Cost Estimates

### Infrastructure (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| GPU Inference (AWS/GCP) | $200-500 | Or use CPU with latency tradeoff |
| Vector Database | $50-100 | pgvector free, Pinecone paid |
| Additional Storage | $20-50 | Pet photos |
| Training (occasional) | $50-200 | Per training run |
| **Total** | **$320-850/mo** | Scale with usage |

### One-Time Costs

| Item | Cost | Notes |
|------|------|-------|
| Initial model training | $100-500 | Cloud GPU time |
| External datasets (optional) | $0-1000 | Open datasets free |
| Consulting (optional) | Variable | ML expertise |

---

## Success Metrics

### Phase 1-4 (Foundation)
- [ ] 1,000+ pet photos uploaded
- [ ] 500+ training pairs created
- [ ] 100+ active labelers
- [ ] Admin dashboard functional

### Phase 5-7 (Core ML)
- [ ] Model trained with 70%+ accuracy
- [ ] Inference latency < 500ms
- [ ] Public matching page live
- [ ] First AI-assisted reunion

### Phase 8-10 (Scale)
- [ ] 85%+ model accuracy
- [ ] 10,000+ training pairs
- [ ] 1,000+ matches made
- [ ] Shelter integration live
- [ ] < 2s end-to-end search time

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Insufficient training data | Start with pre-trained model, focus on data collection incentives |
| Low labeling participation | Gamification, link to rescue levels, weekly rewards |
| Model accuracy plateau | Hard negative mining, data augmentation, architecture experiments |
| Compute costs | Start with CPU inference, optimize batch processing |
| User trust in AI | Show confidence scores, allow human verification, explain matching |

---

## Next Steps (Immediate Actions)

1. **This Week:**
   - [ ] Add database models (Phase 1.1)
   - [ ] Create basic photo gallery component (Phase 2.1)
   - [ ] Design labeling game mockups (Phase 3.1)

2. **Next 2 Weeks:**
   - [ ] Implement multi-photo upload
   - [ ] Build labeling game MVP
   - [ ] Start collecting training pairs

3. **Month 1:**
   - [ ] Admin dashboard basic version
   - [ ] 500+ training pairs collected
   - [ ] Evaluate pre-trained models for fine-tuning

---

## Appendix: File Structure

```
frontend/
├── app/
│   ├── find-my-pet/            # Public matching page
│   │   └── page.jsx
│   ├── match-game/             # Crowdsourced labeling
│   │   └── page.jsx
│   ├── admin/
│   │   └── ai/                 # Admin AI dashboard
│   │       ├── page.jsx        # Main dashboard
│   │       ├── data/           # Training data management
│   │       ├── labelers/       # Labeler management
│   │       ├── models/         # Model management
│   │       └── training/       # Training control
│   ├── api/
│   │   ├── ai/
│   │   │   ├── embed/          # Generate embedding
│   │   │   ├── match/          # Find matches
│   │   │   ├── compare/        # Compare two images
│   │   │   └── feedback/       # User feedback
│   │   ├── training/
│   │   │   ├── next-pair/      # Get pair to label
│   │   │   ├── label/          # Submit label
│   │   │   └── leaderboard/    # Top labelers
│   │   └── admin/ai/
│   │       ├── stats/          # Dashboard stats
│   │       ├── pairs/          # Manage pairs
│   │       ├── labelers/       # Manage labelers
│   │       ├── models/         # Manage models
│   │       └── training/       # Control training
│   └── lib/
│       ├── ai/
│       │   ├── embeddingService.js
│       │   ├── matchingService.js
│       │   └── imageProcessor.js
│       └── ml/
│           ├── model.py        # PyTorch model
│           ├── train.py        # Training script
│           └── inference.py    # Inference wrapper
├── components/
│   ├── pet/
│   │   └── PetPhotoGallery.jsx
│   ├── training/
│   │   ├── PetMatchGame.jsx
│   │   ├── PhotoPairCard.jsx
│   │   └── Leaderboard.jsx
│   └── matching/
│       ├── PhotoUploader.jsx
│       ├── MatchResultCard.jsx
│       └── MatchScoreBreakdown.jsx
└── prisma/
    └── schema.prisma           # + new AI models
```

---

**Document Status:** Ready for Implementation
**Primary Author:** AI Assistant
**Review Required:** Technical Lead, Product Owner
