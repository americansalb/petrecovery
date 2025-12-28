# AdFund Implementation Plan
## ReunitePets.org - Crowdfunded Ad Automation

**Created:** December 2024
**Status:** Draft - Awaiting Approval

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Key Decisions (Confirmed)](#2-key-decisions-confirmed)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [Service Layer](#5-service-layer)
6. [API Endpoints](#6-api-endpoints)
7. [Frontend Components](#7-frontend-components)
8. [Payment & Refund Flows](#8-payment--refund-flows)
9. [Ad Platform Integration](#9-ad-platform-integration)
10. [Ad Creative Specifications](#10-ad-creative-specifications)
11. [Implementation Phases](#11-implementation-phases)
12. [Open Items & Risks](#12-open-items--risks)

---

## 1. Executive Summary

### What We're Building

A crowdfunded ad automation system that allows pet owners to raise money from friends/family/community to run targeted Meta (Facebook/Instagram) and Google Demand Gen (YouTube/Gmail/Discover) ads for their lost pet.

### Core Philosophy
- **Instant launch** - No delays, time is critical
- **Full transparency** - Users see exactly how money is spent
- **Fee on spend only** - We take 15% of what's actually spent on ads, not what's raised
- **Community engagement** - Ads encourage sharing and mission participation
- **Front-loaded spending** - More budget early when it matters most
- **FIFO refunds** - Later contributors refunded first if pet found early

### Revenue Model
- 15% platform fee on ad spend (only on amount actually spent)
- Contributors cover Stripe processing fees (~3%)

---

## 2. Key Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Launch delay | **None (instant)** | Urgency > fraud risk; protected by Stripe Chargeback Protection + 3DS + consent |
| Minimum contribution | **$5** | Balances accessibility with transaction cost efficiency (9% fee at $5) |
| Fund minimum to launch | **$20** | Enough for ~1,000-1,500 reach; accessible price point |
| Fee basis | **Amount SPENT** | Only monetize where we provide value |
| Fee percentage | **15%** | Competitive, sustainable |
| Processing fees | **Contributor pays** | Transparent; contributor sees "$5 + $0.45 processing" |
| Campaign duration | **5 days default** | Owner can choose 3, 5, or 7 days |
| Budget distribution | **Declining daily** | Day 1: 30%, Day 2: 25%, Day 3: 20%, Day 4: 15%, Day 5: 10% |
| Platform split | **70% Meta / 30% Google** | Meta better for social sharing; will A/B test |
| Top-ups | **Allowed** | May reset learning phase; worth it for extra reach |
| Refund order | **LIFO** | Last contributor in = first refunded out |
| Ad creative | **Single large image** | Pet photo dominant, MISSING badge, share CTA |

### Budget Distribution Schedule (5-day campaign)

| Day | Percentage | Cumulative | Example ($100 budget) |
|-----|------------|------------|----------------------|
| 1 | 30% | 30% | $30 |
| 2 | 25% | 55% | $25 |
| 3 | 20% | 75% | $20 |
| 4 | 15% | 90% | $15 |
| 5 | 10% | 100% | $10 |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Frontend                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ AdFund Page │  │ Contribute  │  │  Campaign   │  │   Refund    │  │
│  │  (Create)   │  │    Modal    │  │  Dashboard  │  │   Status    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                            API Layer                                  │
│  /api/adfund/*           /api/campaigns/*          /api/webhooks/*   │
│  - create                - status                  - stripe          │
│  - contribute            - metrics                 - meta            │
│  - cancel                - pause/resume            - google          │
│  - refund                                                            │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          Service Layer                                │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │
│  │ AdFundService  │  │ AdOrchestrator │  │ RefundService  │          │
│  │ - createFund   │  │ - launchAds    │  │ - calculate    │          │
│  │ - addContrib   │  │ - pauseAds     │  │ - process      │          │
│  │ - getFund      │  │ - stopAds      │  │ - notify       │          │
│  └────────────────┘  └────────────────┘  └────────────────┘          │
│                             │                                         │
│            ┌────────────────┼────────────────┐                       │
│            ▼                ▼                ▼                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │
│  │ MetaAdService  │  │GoogleAdService │  │RadiusCalculator│          │
│  │ - createCamp   │  │ - createCamp   │  │ - calculate    │          │
│  │ - getReach     │  │ - getReach     │  │ - getFactors   │          │
│  │ - getMetrics   │  │ - getMetrics   │  │                │          │
│  └────────────────┘  └────────────────┘  └────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          External Services                            │
│     Stripe              Meta Marketing API       Google Ads API       │
│  - Payments             - Campaign CRUD          - Campaign CRUD      │
│  - Refunds              - Reach Estimates        - Reach Estimates    │
│  - Webhooks             - Metrics                - Metrics            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### New Models

```prisma
// ============================================
// AD FUND SYSTEM
// ============================================

enum AdFundStatus {
  RAISING           // Accepting contributions, not yet at minimum
  READY             // At minimum, ready to launch
  LAUNCHING         // Ads being created on platforms
  ACTIVE            // Ads running
  PAUSED            // Owner paused the campaign
  COMPLETED         // Budget exhausted or campaign ended
  CANCELLED         // Owner cancelled before launch
  REFUNDING         // Processing refunds
  REFUNDED          // All refunds complete
}

enum ContributionStatus {
  PENDING           // Payment initiated
  SUCCEEDED         // Payment confirmed
  FAILED            // Payment failed
  REFUNDED          // Full refund processed
  PARTIALLY_REFUNDED // Partial refund (some spend occurred)
}

enum CampaignStatus {
  PENDING           // Waiting to launch
  LAUNCHING         // API calls in progress
  LEARNING          // In Meta/Google learning phase
  ACTIVE            // Running normally
  PAUSED            // Temporarily paused
  COMPLETED         // Finished (budget or time)
  FAILED            // Platform error
}

model AdFund {
  id                    String          @id @default(cuid())
  caseId                String          @unique
  case                  Case            @relation(fields: [caseId], references: [id])

  // Funding Status
  status                AdFundStatus    @default(RAISING)
  minimumAmount         Int             @default(2000)  // $20.00 in cents
  goalAmount            Int?            // Optional stretch goal

  // Money Tracking (all in cents)
  totalRaised           Int             @default(0)     // Sum of successful contributions
  totalFees             Int             @default(0)     // Sum of Stripe fees paid
  netAvailable          Int             @default(0)     // totalRaised - totalFees (available for ads)
  amountSpent           Int             @default(0)     // Actually spent on ads
  platformFee           Int             @default(0)     // 15% of amountSpent (our revenue)
  amountRefunded        Int             @default(0)     // Returned to contributors

  // Campaign Settings
  durationDays          Int             @default(5)     // 3, 5, or 7
  metaSplit             Int             @default(70)    // Percentage to Meta (0-100)
  googleSplit           Int             @default(30)    // Percentage to Google (0-100)

  // Targeting (from RadiusCalculator)
  searchRadius          Float                           // Miles
  radiusFactors         Json                            // Calculation breakdown
  targetLatitude        Float
  targetLongitude       Float

  // Reach Estimates (from platform APIs)
  estimatedReachMeta    Int?
  estimatedReachGoogle  Int?
  estimatedReachTotal   Int?

  // Consent & Legal
  ownerConsentAt        DateTime?                       // E-sign timestamp
  ownerConsentIp        String?                         // IP for records
  termsVersion          String          @default("1.0") // Terms version accepted

  // Timestamps
  createdAt             DateTime        @default(now())
  launchedAt            DateTime?
  pausedAt              DateTime?
  completedAt           DateTime?
  cancelledAt           DateTime?

  // Relations
  contributions         AdFundContribution[]
  campaign              AdCampaign?
  refunds               AdFundRefund[]

  @@index([caseId])
  @@index([status])
  @@index([createdAt])
}

model AdFundContribution {
  id                    String              @id @default(cuid())
  fundId                String
  fund                  AdFund              @relation(fields: [fundId], references: [id])

  // Contributor Info
  email                 String
  name                  String?
  message               String?             // "Hope you find Max soon!"
  isAnonymous           Boolean             @default(false)
  isOwner               Boolean             @default(false) // Owner's own contribution

  // Payment Details (all in cents)
  amount                Int                 // What they intended to contribute
  processingFee         Int                 // Stripe fee they paid
  totalCharged          Int                 // amount + processingFee
  netContribution       Int                 // What goes to the fund (= amount)

  // Stripe
  stripePaymentIntentId String              @unique
  stripeChargeId        String?
  status                ContributionStatus  @default(PENDING)

  // Spend Tracking (for refunds)
  amountUsed            Int                 @default(0)  // How much of this was spent
  amountRefunded        Int                 @default(0)  // How much refunded

  // Order Tracking (for LIFO refunds)
  sequence              Int                 // 1, 2, 3... order received

  // Timestamps
  createdAt             DateTime            @default(now())
  succeededAt           DateTime?
  refundedAt            DateTime?

  refunds               AdFundRefund[]

  @@index([fundId])
  @@index([stripePaymentIntentId])
  @@index([fundId, sequence])
}

model AdCampaign {
  id                    String          @id @default(cuid())
  fundId                String          @unique
  fund                  AdFund          @relation(fields: [fundId], references: [id])

  // Budget Allocation (cents)
  totalBudget           Int             // Net available from fund
  platformFee           Int             // 15% reserved for us
  adBudget              Int             // 85% for actual ads
  metaBudget            Int             // metaSplit % of adBudget
  googleBudget          Int             // googleSplit % of adBudget

  // Daily Budget Schedule (cents) - for 5-day: [30%, 25%, 20%, 15%, 10%]
  dailyBudgets          Json            // [{ day: 1, meta: X, google: Y }, ...]
  currentDay            Int             @default(1)

  // Platform Campaign IDs
  metaCampaignId        String?
  metaAdSetId           String?
  metaAdId              String?
  googleCampaignId      String?
  googleAdGroupId       String?
  googleAdId            String?

  // Status
  status                CampaignStatus  @default(PENDING)
  metaStatus            String?         // LEARNING, ACTIVE, etc.
  googleStatus          String?
  lastError             String?

  // Real Metrics (updated via polling/webhooks)
  metaReach             Int             @default(0)
  metaImpressions       Int             @default(0)
  metaClicks            Int             @default(0)
  metaSpent             Int             @default(0)  // cents
  metaShares            Int             @default(0)
  metaComments          Int             @default(0)

  googleReach           Int             @default(0)
  googleImpressions     Int             @default(0)
  googleClicks          Int             @default(0)
  googleSpent           Int             @default(0)  // cents

  // Timestamps
  createdAt             DateTime        @default(now())
  launchedAt            DateTime?
  scheduledEndAt        DateTime?       // Based on durationDays
  actualEndAt           DateTime?
  lastMetricsUpdate     DateTime?

  // Metrics History (for graphs)
  metricsHistory        Json?           // [{ timestamp, reach, spent, ... }, ...]

  @@index([fundId])
  @@index([status])
}

model AdFundRefund {
  id                    String          @id @default(cuid())
  fundId                String
  fund                  AdFund          @relation(fields: [fundId], references: [id])
  contributionId        String
  contribution          AdFundContribution @relation(fields: [contributionId], references: [id])

  // Refund Details (cents)
  amount                Int             // Amount being refunded
  reason                String          // "pet_found", "campaign_cancelled", "partial_unused"

  // Stripe
  stripeRefundId        String?         @unique
  status                String          @default("pending") // pending, succeeded, failed

  // Timestamps
  createdAt             DateTime        @default(now())
  processedAt           DateTime?

  @@index([fundId])
  @@index([contributionId])
}

// Extend existing Case model
model Case {
  // ... existing fields ...

  // Add relation to AdFund
  adFund                AdFund?
}
```

### Indexes for Performance

```prisma
// Already included above, but critical ones:
@@index([caseId])           // Find fund by case
@@index([status])           // Query by status
@@index([fundId, sequence]) // LIFO refund ordering
```

---

## 5. Service Layer

### 5.1 AdFundService

**Location:** `/lib/actions/adFundService.ts`

```typescript
class AdFundService {
  constructor(private prisma: PrismaClient) {}

  // === FUND LIFECYCLE ===

  async createFund(params: {
    caseId: string;
    durationDays: 3 | 5 | 7;
    ownerIp: string;
  }): Promise<AdFund>
  // - Validates case exists and is ACTIVE
  // - Calculates search radius via RadiusCalculator
  // - Fetches reach estimates from Meta/Google APIs
  // - Creates fund in RAISING status
  // - Returns fund with transparent calculation data

  async recordConsent(params: {
    fundId: string;
    ip: string;
    termsVersion: string;
  }): Promise<AdFund>
  // - Records e-sign consent timestamp and IP
  // - Required before launch

  async getFund(fundId: string): Promise<AdFundWithDetails>
  // - Returns fund with contributions, campaign, case info
  // - Calculates real-time progress percentage

  async getFundByCase(caseId: string): Promise<AdFund | null>
  // - Get active fund for a case

  // === CONTRIBUTIONS ===

  async createContribution(params: {
    fundId: string;
    amount: number;        // cents
    email: string;
    name?: string;
    message?: string;
    isAnonymous?: boolean;
    isOwner?: boolean;
  }): Promise<{ contribution: AdFundContribution; clientSecret: string }>
  // - Calculates processing fee
  // - Creates Stripe PaymentIntent with 3D Secure
  // - Creates contribution in PENDING status
  // - Returns client secret for Stripe Elements

  async confirmContribution(paymentIntentId: string): Promise<AdFundContribution>
  // - Called by Stripe webhook on payment_intent.succeeded
  // - Updates contribution to SUCCEEDED
  // - Updates fund totals
  // - Checks if fund reached minimum → trigger launch

  async getContributions(fundId: string): Promise<AdFundContribution[]>
  // - Returns contributions ordered by sequence (for display)

  // === FUND STATE CHANGES ===

  async checkAndLaunch(fundId: string): Promise<void>
  // - Called when contribution confirmed
  // - If totalRaised >= minimumAmount && consent given → launch

  async cancelFund(fundId: string, reason: string): Promise<void>
  // - Only allowed before launch
  // - Refunds all contributions
  // - Updates status to CANCELLED

  async pauseCampaign(fundId: string): Promise<void>
  // - Pauses ads on Meta/Google
  // - Updates status to PAUSED

  async resumeCampaign(fundId: string): Promise<void>
  // - Resumes ads on Meta/Google
  // - Updates status to ACTIVE

  async stopCampaign(fundId: string, reason: 'pet_found' | 'owner_request'): Promise<void>
  // - Stops ads on Meta/Google
  // - Triggers refund calculation
  // - Updates fund and case status

  // === TOP-UPS ===

  async addTopUp(params: {
    fundId: string;
    amount: number;
    email: string;
    // ... same as createContribution
  }): Promise<{ contribution: AdFundContribution; clientSecret: string }>
  // - Adds contribution to active campaign
  // - If campaign exists, increases budget (may reset learning)
  // - Extends campaign if needed
}
```

### 5.2 AdOrchestrator

**Location:** `/lib/actions/adOrchestrator.ts`

```typescript
class AdOrchestrator {
  constructor(
    private prisma: PrismaClient,
    private metaService: MetaAdService,
    private googleService: GoogleAdService,
  ) {}

  async launchCampaign(fundId: string): Promise<AdCampaign>
  // - Calculates budget split (70/30)
  // - Calculates daily budget schedule
  // - Creates campaigns on both platforms in parallel
  // - Creates AdCampaign record
  // - Updates fund status to ACTIVE
  // - Sends notification to owner + contributors

  async pauseCampaign(campaignId: string): Promise<void>
  // - Pauses on both platforms
  // - Updates statuses

  async resumeCampaign(campaignId: string): Promise<void>
  // - Resumes on both platforms
  // - Updates statuses

  async stopCampaign(campaignId: string): Promise<void>
  // - Stops on both platforms
  // - Fetches final metrics
  // - Calculates final spend
  // - Updates fund.amountSpent and fund.platformFee
  // - Triggers refund flow if applicable

  async increaseBudget(campaignId: string, additionalBudget: number): Promise<void>
  // - Increases budget on platforms
  // - Recalculates daily schedule for remaining days
  // - Note: May reset learning phase

  async updateMetrics(campaignId: string): Promise<void>
  // - Fetches latest metrics from both platforms
  // - Updates campaign record
  // - Appends to metricsHistory

  async checkDailyBudgets(): Promise<void>
  // - Called by cron job daily
  // - Updates daily budgets on platforms according to schedule
  // - Uses declining budget strategy

  calculateDailyBudgetSchedule(
    totalBudget: number,
    durationDays: number,
    metaSplit: number
  ): DailyBudget[]
  // - Returns array of daily budgets per platform
  // - Implements declining strategy (30%, 25%, 20%, 15%, 10%)
}
```

### 5.3 MetaAdService

**Location:** `/lib/actions/metaAdService.ts`

```typescript
class MetaAdService {
  constructor(private accessToken: string, private adAccountId: string) {}

  // === REACH ESTIMATION ===

  async getReachEstimate(params: {
    latitude: number;
    longitude: number;
    radiusMiles: number;
    dailyBudget: number;
  }): Promise<{ reach: number; cpm: number }>
  // - Uses Marketing API delivery_estimate endpoint
  // - Returns estimated unique reach for budget

  // === CAMPAIGN MANAGEMENT ===

  async createCampaign(params: {
    name: string;           // "ReunitePets - Max #12345"
    objective: 'REACH';
    dailyBudget: number;    // cents
    lifetimeBudget?: number;
  }): Promise<{ campaignId: string }>

  async createAdSet(params: {
    campaignId: string;
    name: string;
    targeting: {
      geoLocations: {
        customLocations: [{ latitude, longitude, radius, distanceUnit: 'mile' }]
      };
      ageMin: 18;
      ageMax: 65;
    };
    optimizationGoal: 'REACH';
    billingEvent: 'IMPRESSIONS';
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP';
  }): Promise<{ adSetId: string }>

  async createAd(params: {
    adSetId: string;
    name: string;
    creative: {
      imageUrl: string;     // Pet photo with overlay
      primaryText: string;  // Main ad copy
      linkUrl: string;      // reunitepets.org/case/xxx
      callToAction: 'LEARN_MORE';
    };
  }): Promise<{ adId: string }>

  async pauseCampaign(campaignId: string): Promise<void>
  async resumeCampaign(campaignId: string): Promise<void>
  async deleteCampaign(campaignId: string): Promise<void>

  async updateBudget(campaignId: string, dailyBudget: number): Promise<void>
  // - For daily budget updates (declining strategy)
  // - Small decreases don't reset learning

  // === METRICS ===

  async getMetrics(campaignId: string): Promise<{
    reach: number;
    impressions: number;
    clicks: number;
    spend: number;         // cents
    shares: number;
    comments: number;
    frequency: number;     // avg times each person saw ad
  }>
  // - Uses Insights API
  // - Returns cumulative metrics

  async getCampaignStatus(campaignId: string): Promise<string>
  // - ACTIVE, PAUSED, PENDING_REVIEW, LEARNING, etc.
}
```

### 5.4 GoogleAdService

**Location:** `/lib/actions/googleAdService.ts`

```typescript
class GoogleAdService {
  constructor(
    private clientId: string,
    private customerId: string,
    private developerToken: string,
  ) {}

  // === REACH ESTIMATION ===

  async getReachEstimate(params: {
    latitude: number;
    longitude: number;
    radiusMiles: number;
    budget: number;
  }): Promise<{ reach: number }>
  // - Uses Reach Planner API
  // - Returns estimated reach for Demand Gen

  // === CAMPAIGN MANAGEMENT ===

  async createDemandGenCampaign(params: {
    name: string;
    budget: number;         // Daily budget in micros
    geoTargeting: {
      latitude: number;
      longitude: number;
      radiusMeters: number;
    };
  }): Promise<{ campaignId: string }>

  async createAdGroup(params: {
    campaignId: string;
    name: string;
  }): Promise<{ adGroupId: string }>

  async createDemandGenAd(params: {
    adGroupId: string;
    headline: string;
    description: string;
    imageAsset: string;     // Asset resource name
    logoAsset: string;
    finalUrl: string;       // reunitepets.org/case/xxx
  }): Promise<{ adId: string }>

  async uploadImageAsset(imageUrl: string): Promise<{ assetResourceName: string }>

  async pauseCampaign(campaignId: string): Promise<void>
  async resumeCampaign(campaignId: string): Promise<void>
  async removeCampaign(campaignId: string): Promise<void>

  async updateBudget(campaignId: string, dailyBudget: number): Promise<void>

  // === METRICS ===

  async getMetrics(campaignId: string): Promise<{
    reach: number;          // Unique users
    impressions: number;
    clicks: number;
    spend: number;          // cents (converted from micros)
  }>
}
```

### 5.5 RefundService

**Location:** `/lib/actions/refundService.ts`

```typescript
class RefundService {
  constructor(private prisma: PrismaClient) {}

  async calculateRefunds(fundId: string): Promise<RefundCalculation>
  // - Gets total spent from campaign
  // - Calculates 15% platform fee on spent amount
  // - Calculates remaining to refund
  // - Distributes refunds LIFO (last contributor first)
  // - Returns breakdown per contributor

  async processRefunds(fundId: string): Promise<void>
  // - Creates Stripe refunds for each contributor
  // - Updates contribution.amountRefunded
  // - Creates AdFundRefund records
  // - Updates fund.amountRefunded
  // - Sends email notifications to contributors

  async processIndividualRefund(
    contributionId: string,
    amount: number,
    reason: string
  ): Promise<AdFundRefund>
  // - Process single refund via Stripe
  // - Create refund record
  // - Send notification
}

interface RefundCalculation {
  totalRaised: number;
  totalSpent: number;
  platformFee: number;      // 15% of spent
  totalToRefund: number;
  contributors: Array<{
    contributionId: string;
    email: string;
    originalAmount: number;
    amountUsed: number;
    amountToRefund: number;
  }>;
}
```

### 5.6 RadiusCalculator

**Location:** `/lib/actions/radiusCalculator.ts`

```typescript
class RadiusCalculator {
  calculate(params: {
    petType: 'dog' | 'cat' | 'bird' | 'other';
    petSize?: 'small' | 'medium' | 'large';
    breed?: string;
    hoursMissing: number;
    isIndoorOnly?: boolean;
    areaType?: 'urban' | 'suburban' | 'rural';
  }): RadiusResult

  interface RadiusResult {
    radiusMiles: number;
    confidence: number;      // 0.90 = 90% likely within radius
    factors: Array<{
      name: string;
      effect: string;        // "+0.5 miles" or "+20%"
      description: string;   // "Large breed dogs travel further"
    }>;
    calculation: string;     // Human-readable breakdown
  }
}

// Base radii (from research)
const BASE_RADIUS = {
  dog: 1.0,    // miles
  cat: 0.25,   // cats stay closer
  bird: 5.0,   // can fly far
  other: 0.5,
};

// Time factor: +0.5 miles per 12 hours for dogs, less for cats
// Size factor: Large +20%, Small -10%
// Indoor only: -30% (they hide close)
// Urban: -20% (more obstacles), Rural: +30% (open space)
```

---

## 6. API Endpoints

### 6.1 AdFund Endpoints

```
POST   /api/adfund/create
  Body: { caseId, durationDays }
  Returns: { fund, reachEstimates, radiusCalculation }

GET    /api/adfund/[fundId]
  Returns: { fund, contributions, campaign, case }

POST   /api/adfund/[fundId]/consent
  Body: { termsVersion }
  Returns: { fund }

POST   /api/adfund/[fundId]/contribute
  Body: { amount, email, name?, message?, isAnonymous?, isOwner? }
  Returns: { contribution, clientSecret }

POST   /api/adfund/[fundId]/cancel
  Body: { reason }
  Returns: { fund }

POST   /api/adfund/[fundId]/pause
  Returns: { fund, campaign }

POST   /api/adfund/[fundId]/resume
  Returns: { fund, campaign }

POST   /api/adfund/[fundId]/stop
  Body: { reason: 'pet_found' | 'owner_request' }
  Returns: { fund, refundCalculation }
```

### 6.2 Campaign Endpoints

```
GET    /api/campaigns/[campaignId]
  Returns: { campaign, metrics, metricsHistory }

GET    /api/campaigns/[campaignId]/metrics
  Returns: { meta: {...}, google: {...}, combined: {...} }

POST   /api/campaigns/[campaignId]/topup
  Body: { amount, email, ... }
  Returns: { contribution, clientSecret, updatedCampaign }
```

### 6.3 Webhook Endpoints

```
POST   /api/webhooks/stripe
  - payment_intent.succeeded → confirmContribution
  - payment_intent.failed → mark contribution failed
  - charge.refunded → update refund status

POST   /api/webhooks/meta
  - Ad status changes
  - Spend updates
  - (May not be real-time, rely on polling)

POST   /api/webhooks/google
  - Similar to Meta
```

### 6.4 Internal/Cron Endpoints

```
POST   /api/internal/campaigns/update-metrics
  - Called every 15 minutes by cron
  - Updates metrics for all active campaigns

POST   /api/internal/campaigns/update-daily-budgets
  - Called daily at midnight
  - Adjusts budgets according to declining schedule
```

---

## 7. Frontend Components

### 7.1 Component Tree

```
/app/case/[caseId]/adfund/
├── page.tsx                    # Main AdFund page
├── create/
│   └── page.tsx                # Create new fund
├── contribute/
│   └── page.tsx                # Contribution flow
└── dashboard/
    └── page.tsx                # Campaign metrics

/components/adfund/
├── AdFundCard.tsx              # Summary card for case page
├── CreateFundForm.tsx          # Fund creation with settings
├── TransparentCalculation.tsx  # Shows radius/budget breakdown
├── ContributorsList.tsx        # Shows who contributed
├── ContributionModal.tsx       # Payment modal with Stripe
├── ProgressBar.tsx             # Funding progress
├── CampaignDashboard.tsx       # Metrics display
├── MetricsChart.tsx            # Reach/spend over time
├── RefundStatus.tsx            # Refund breakdown display
└── ShareButtons.tsx            # Share the fund page
```

### 7.2 Key UI Flows

#### Flow 1: Create Fund

```
Case Page
    ↓ Owner clicks "Boost with Ads"
Create Fund Page
    ├── See transparent radius calculation
    ├── See estimated reach for their budget
    ├── Choose duration (3/5/7 days)
    ├── Review terms + e-sign consent
    └── Create fund (status: RAISING)
    ↓
Fund Page (shareable link)
    ├── Pet photo + story
    ├── Progress bar: "$0 of $20 minimum"
    ├── Contribute button
    ├── Share buttons (FB, Twitter, Copy Link)
    └── "Recent supporters" section
```

#### Flow 2: Contribute

```
Fund Page
    ↓ Click "Contribute"
Contribution Modal
    ├── Amount selection: $5, $10, $25, Custom
    ├── Shows: "$10 + $0.59 processing = $10.59"
    ├── Name (optional)
    ├── Message (optional)
    ├── Anonymous checkbox
    └── Stripe Elements (card input with 3DS)
    ↓ Submit
Processing...
    ↓ 3D Secure if required
Success!
    ├── "Thank you! You'll receive updates."
    ├── Updated progress bar
    └── Prompt to share
```

#### Flow 3: Campaign Dashboard (Owner)

```
Fund Page (after launch)
    ↓
Campaign Dashboard
    ├── Status: "🟢 Active - Day 2 of 5"
    ├── Hero Metrics
    │   ├── 2,847 people reached
    │   ├── 127 clicks to Max's page
    │   └── 23 shares
    ├── Budget Breakdown
    │   ├── Total raised: $65
    │   ├── Spent so far: $28
    │   ├── Remaining: $37
    │   └── Daily budget today: $12
    ├── Platform Split
    │   ├── Meta: 1,924 reach, $19 spent
    │   └── Google: 923 reach, $9 spent
    ├── Chart: Reach over time
    ├── Top Up button
    ├── Pause/Resume button
    └── "Pet Found - End Campaign" button
```

#### Flow 4: Pet Found → Refunds

```
Owner clicks "Pet Found"
    ↓
Confirmation Modal
    ├── "Ads will stop immediately"
    ├── Shows refund calculation:
    │   ├── Total raised: $65
    │   ├── Total spent: $42
    │   ├── Platform fee (15%): $6.30
    │   ├── To refund: $16.70
    │   └── "3 contributors will receive refunds"
    └── Confirm button
    ↓
Processing...
    ↓
Success!
    ├── "Max has been marked as REUNITED!"
    ├── Ads stopped
    ├── Refunds processing (1-5 business days)
    └── Optional: "Leave a tip for ReunitePets"
```

### 7.3 Transparent Calculation Component

This is key to the UX - showing exactly how we calculate things:

```tsx
// TransparentCalculation.tsx

<div className="border rounded-lg p-4 bg-gray-50">
  <h3 className="font-semibold mb-3">📐 How We Calculate Your Search Radius</h3>

  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span>Base radius (dog):</span>
      <span>1.0 miles</span>
    </div>
    <div className="flex justify-between text-green-600">
      <span>+ Time missing (18 hrs):</span>
      <span>+0.75 miles</span>
    </div>
    <div className="flex justify-between text-green-600">
      <span>+ Large breed:</span>
      <span>+20%</span>
    </div>
    <div className="flex justify-between text-red-600">
      <span>− Suburban area:</span>
      <span>−10%</span>
    </div>
    <div className="border-t pt-2 flex justify-between font-semibold">
      <span>Calculated radius:</span>
      <span>1.9 miles</span>
    </div>
  </div>

  <p className="text-xs text-gray-500 mt-2">
    ⭕ 90% probability your pet is within this radius
  </p>
</div>

<div className="border rounded-lg p-4 bg-gray-50 mt-4">
  <h3 className="font-semibold mb-3">💰 Where Your Money Goes</h3>

  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span>Total raised:</span>
      <span>$50.00</span>
    </div>
    <div className="flex justify-between text-gray-600">
      <span>Platform fee (15%):</span>
      <span>−$7.50</span>
    </div>
    <div className="flex justify-between font-semibold border-t pt-2">
      <span>To ads:</span>
      <span>$42.50</span>
    </div>
  </div>

  <div className="mt-3 space-y-1 text-sm">
    <div className="flex justify-between">
      <span>├── Facebook/Instagram (70%):</span>
      <span>$29.75 → ~2,100 people</span>
    </div>
    <div className="flex justify-between">
      <span>└── YouTube/Gmail/Discover (30%):</span>
      <span>$12.75 → ~900 people</span>
    </div>
  </div>

  <p className="text-xs text-gray-500 mt-2">
    Estimated total reach: ~3,000 unique local people
  </p>
</div>
```

---

## 8. Payment & Refund Flows

### 8.1 Contribution Flow

```
1. User selects amount ($10)
2. We calculate processing fee ($0.59)
3. Create Stripe PaymentIntent for $10.59
   - Enable 3D Secure
   - Enable Chargeback Protection
   - Metadata: { fundId, contributionId }
4. User completes payment in Stripe Elements
5. Stripe webhook: payment_intent.succeeded
6. We confirm contribution:
   a. Update contribution status → SUCCEEDED
   b. Update fund.totalRaised += $10
   c. Update fund.totalFees += $0.59
   d. Update fund.netAvailable += $10
   e. If fund.netAvailable >= fund.minimumAmount → launch
7. Send thank you email to contributor
8. If launched: send "Ads are live!" email to all contributors
```

### 8.2 Refund Flow (Pet Found)

```
1. Owner marks pet as found
2. Stop ads on Meta + Google
3. Fetch final metrics (actual spend)
4. Calculate:
   - amountSpent = actual ad spend
   - platformFee = amountSpent * 0.15
   - toRefund = netAvailable - amountSpent - platformFee

5. Distribute refunds LIFO:
   - Get contributions ordered by sequence DESC
   - For each contribution (newest first):
     - If toRefund <= 0: break
     - refundAmount = min(contribution.netContribution - contribution.amountUsed, toRefund)
     - Process Stripe refund
     - Update contribution.amountRefunded
     - toRefund -= refundAmount

6. Update fund:
   - amountSpent = final
   - platformFee = final
   - amountRefunded = total refunded
   - status = REFUNDED

7. Send emails:
   - To contributors who got refunds: "Max was found! You're receiving a refund of $X"
   - To contributors who didn't: "Max was found! Your full contribution helped reach 2,847 people"
   - To owner: "Congratulations! Max is marked as reunited"
```

### 8.3 Example Refund Calculation

```
Fund raised: $65.00 (after fees)
Contributors (in order):
  1. Owner: $20.00 (sequence 1)
  2. Friend A: $25.00 (sequence 2)
  3. Friend B: $20.00 (sequence 3)

Pet found after $42.00 spent
Platform fee: $42.00 × 15% = $6.30
To refund: $65.00 - $42.00 - $6.30 = $16.70

Refund distribution (LIFO):
  - Friend B (sequence 3): Gets $16.70 refund (of their $20)
  - Friend A (sequence 2): Gets $0 (their money was fully used)
  - Owner (sequence 1): Gets $0 (their money was fully used)

Stripe fees on original contributions are NOT refunded
(contributors paid $X + processing fee, fee stays with Stripe)
```

---

## 9. Ad Platform Integration

### 9.1 Meta Marketing API

**Required:**
- Facebook Business Manager account
- Business verification (2-4 weeks)
- Marketing API access
- Ad Account

**Key API Calls:**

```typescript
// Create Campaign
POST /v18.0/act_{AD_ACCOUNT_ID}/campaigns
{
  name: "ReunitePets - Max #12345",
  objective: "OUTCOME_AWARENESS",  // For reach optimization
  special_ad_categories: [],
  status: "ACTIVE",
  daily_budget: 2500,  // $25 in cents
}

// Create Ad Set
POST /v18.0/act_{AD_ACCOUNT_ID}/adsets
{
  campaign_id: "...",
  name: "Max - Oak Park 2mi radius",
  optimization_goal: "REACH",
  billing_event: "IMPRESSIONS",
  bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  targeting: {
    geo_locations: {
      custom_locations: [{
        latitude: 41.8856,
        longitude: -87.7916,
        radius: 2,
        distance_unit: "mile"
      }]
    },
    age_min: 18,
    age_max: 65
  }
}

// Create Ad
POST /v18.0/act_{AD_ACCOUNT_ID}/ads
{
  adset_id: "...",
  creative: {
    object_story_spec: {
      page_id: "PAGE_ID",
      link_data: {
        link: "https://reunitepets.org/case/max-12345",
        message: "🔴 MISSING: Max, Golden Retriever...",
        picture: "https://cdn.reunitepets.org/max-ad-creative.jpg",
        call_to_action: { type: "LEARN_MORE" }
      }
    }
  }
}

// Get Reach Estimate
GET /v18.0/act_{AD_ACCOUNT_ID}/delivery_estimate
{
  targeting_spec: { geo_locations: {...} },
  optimization_goal: "REACH"
}

// Get Metrics
GET /v18.0/{CAMPAIGN_ID}/insights
{
  fields: "reach,impressions,clicks,spend,actions"
}
```

### 9.2 Google Ads API

**Required:**
- Google Ads account
- Developer token (2-8 weeks approval)
- OAuth credentials

**Key API Calls:**

```typescript
// Create Demand Gen Campaign
mutation createCampaign {
  campaignOperation: {
    create: {
      name: "ReunitePets - Max #12345"
      advertisingChannelType: DEMAND_GEN
      biddingStrategyType: MAXIMIZE_CONVERSIONS
      campaignBudget: "customers/{CUSTOMER_ID}/campaignBudgets/{BUDGET_ID}"
      geoTargetTypeSetting: {
        positiveGeoTargetType: PRESENCE
      }
    }
  }
}

// Create Location Target
mutation createGeoTarget {
  campaignCriterionOperation: {
    create: {
      campaign: "customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
      proximity: {
        geoPoint: {
          latitudeInMicroDegrees: 41885600
          longitudeInMicroDegrees: -87791600
        }
        radius: 3218.69  // 2 miles in meters
        radiusUnits: METERS
      }
    }
  }
}

// Get Reach Estimate
reachPlanService.generateReachForecast({
  customerId: "...",
  plannableLocationId: "...",
  currencyCode: "USD",
  campaignDuration: { startDate: "...", endDate: "..." },
  plannedProducts: [{
    plannableProductCode: "DEMAND_GEN",
    budgetMicros: 2500000000  // $25
  }]
})
```

### 9.3 Environment Variables

```env
# Meta (Facebook/Instagram)
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=           # Long-lived token
META_AD_ACCOUNT_ID=
META_PAGE_ID=
META_BUSINESS_ID=

# Google Ads
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=  # If using MCC

# Stripe (additions to existing)
STRIPE_CHARGEBACK_PROTECTION=true
```

---

## 10. Ad Creative Specifications

### 10.1 Design Philosophy

Every ad is BOTH:
1. A missing pet alert
2. Marketing for ReunitePets.org

The ad should inspire ACTION:
- Share this post
- Join the search mission
- Visit the case page

### 10.2 Meta Ad Specifications

**Image Dimensions:**
- Feed: 1080x1080 (1:1) or 1200x628 (1.91:1)
- Stories: 1080x1920 (9:16)

**Recommended: 1080x1080 square** (works everywhere)

**Image Composition:**
```
┌────────────────────────────────────┐
│ ┌──────────────────────────────┐  │
│ │                              │  │
│ │      [PET PHOTO]             │  │
│ │      (80% of image)          │  │
│ │                              │  │
│ │                              │  │
│ └──────────────────────────────┘  │
│                                    │
│ 🔴 MISSING                         │
│ MAX • Golden Retriever             │
│ Oak Park, IL • 6 hours ago         │
│                                    │
│ reunitepets.org                    │
└────────────────────────────────────┘
```

**Primary Text (appears above image):**
```
🔴 MISSING in [NEIGHBORHOOD]

[PET_NAME] the [BREED] has been missing since [TIME].

Last seen: [LOCATION]

Please SHARE this post - it only takes a second and could bring [PET_NAME] home.

See more details and join the search: [LINK]

#MissingPet #[CITY] #ReunitePets
```

**Headline:** "Help Find [PET_NAME]"

**Description:** "Click to see full details and join the search mission"

**CTA Button:** "Learn More"

### 10.3 Google Demand Gen Specifications

**Image Assets:**
- Landscape: 1200x628
- Square: 1200x1200
- Portrait: 960x1200 (optional)

**Headlines (max 40 chars):**
- "Help Find [PET_NAME] 🔴"
- "Missing [BREED] - [AREA]"
- "[PET_NAME] Needs Your Help"

**Descriptions (max 90 chars):**
- "Last seen in [NEIGHBORHOOD]. Share to help bring [PET_NAME] home. 🐕"
- "[PET_NAME] has been missing for [TIME]. Join the search mission."

**Long Headline (max 90 chars):**
- "🔴 MISSING: [PET_NAME] the [BREED] - Last Seen in [NEIGHBORHOOD]"

### 10.4 Dynamic Creative Generation

```typescript
interface AdCreativeParams {
  petName: string;
  petType: 'dog' | 'cat' | 'bird' | 'other';
  breed: string;
  photoUrl: string;
  neighborhood: string;
  city: string;
  state: string;
  timeMissing: string;      // "6 hours ago", "2 days ago"
  caseUrl: string;
}

function generateAdCreative(params: AdCreativeParams): AdCreative {
  return {
    imageOverlay: {
      badge: "MISSING",
      petName: params.petName,
      breed: params.breed,
      location: `${params.neighborhood}, ${params.city}`,
      time: params.timeMissing,
      branding: "reunitepets.org"
    },
    primaryText: `🔴 MISSING in ${params.neighborhood}\n\n${params.petName} the ${params.breed} has been missing since ${params.timeMissing}.\n\nPlease SHARE this post - it only takes a second and could bring ${params.petName} home.\n\n#MissingPet #${params.city.replace(/\s/g, '')} #ReunitePets`,
    headline: `Help Find ${params.petName}`,
    description: "Click to see full details and join the search mission",
    link: params.caseUrl
  };
}
```

### 10.5 Image Processing Pipeline

```
1. Owner uploads pet photo
2. We validate: minimum 600x600, clear subject
3. Generate ad-ready images:
   a. Square (1080x1080) with overlay
   b. Landscape (1200x628) with overlay
   c. Portrait (960x1200) with overlay (optional)
4. Upload to CDN (Bunny)
5. Store asset URLs in case record
6. Use these URLs when creating ads
```

**Overlay Design:**
- Semi-transparent black bar at bottom (20% of height)
- "MISSING" badge in red (top-left corner)
- Pet name + breed in white
- Location + time in lighter gray
- ReunitePets.org logo/text (bottom-right, subtle)

---

## 11. Implementation Phases

### Phase 0: Platform Approvals (Start Immediately, Parallel)

**Week 0:**
- [ ] Apply for Meta Business Manager verification
- [ ] Apply for Google Ads developer token
- [ ] Enable Stripe Chargeback Protection
- [ ] Set up Meta Ad Account for testing
- [ ] Create Google Ads account for testing

**Timeline:** 2-8 weeks (out of our control)

### Phase 1: Core Infrastructure (Weeks 1-2)

**Database:**
- [ ] Add AdFund, AdFundContribution, AdCampaign, AdFundRefund models
- [ ] Add relation to Case model
- [ ] Run migration
- [ ] Add indexes

**Services (stubs first, then implementation):**
- [ ] RadiusCalculator (complete implementation)
- [ ] AdFundService (complete implementation)
- [ ] RefundService (complete implementation)
- [ ] AdOrchestrator (stub - no platform calls yet)
- [ ] MetaAdService (stub)
- [ ] GoogleAdService (stub)

**APIs:**
- [ ] POST /api/adfund/create
- [ ] GET /api/adfund/[fundId]
- [ ] POST /api/adfund/[fundId]/consent
- [ ] POST /api/adfund/[fundId]/contribute
- [ ] POST /api/webhooks/stripe (extend existing)

### Phase 2: Contribution Flow UI (Weeks 2-3)

**Pages:**
- [ ] /case/[caseId]/adfund/create - Fund creation
- [ ] /case/[caseId]/adfund - Fund page (public, shareable)
- [ ] /case/[caseId]/adfund/contribute - Contribution modal

**Components:**
- [ ] CreateFundForm
- [ ] TransparentCalculation
- [ ] ProgressBar
- [ ] ContributorsList
- [ ] ContributionModal (Stripe Elements)
- [ ] ShareButtons

**Integration:**
- [ ] Add "Boost with Ads" button to case page
- [ ] Add AdFund status indicator to case dashboard

### Phase 3: Meta Integration (Weeks 3-5)

**MetaAdService (full implementation):**
- [ ] OAuth flow / token management
- [ ] getReachEstimate
- [ ] createCampaign
- [ ] createAdSet
- [ ] createAd
- [ ] updateBudget
- [ ] pauseCampaign / resumeCampaign
- [ ] getMetrics

**Image Processing:**
- [ ] Ad creative overlay generation
- [ ] Multi-format image generation
- [ ] CDN upload integration

**AdOrchestrator (Meta only):**
- [ ] Launch flow with Meta
- [ ] Daily budget update cron
- [ ] Metrics polling cron

**Testing:**
- [ ] Test with real Meta Ad Account (small budget)
- [ ] Verify radius targeting
- [ ] Verify reach estimates accuracy

### Phase 4: Campaign Dashboard (Week 5-6)

**Pages:**
- [ ] /case/[caseId]/adfund/dashboard - Owner dashboard

**Components:**
- [ ] CampaignDashboard
- [ ] MetricsChart (reach/spend over time)
- [ ] PlatformBreakdown
- [ ] TopUpButton
- [ ] PauseResumeButton
- [ ] PetFoundButton

**Notifications:**
- [ ] "Ads are live" email to contributors
- [ ] Daily metrics email to owner (optional)
- [ ] "Campaign complete" email

### Phase 5: Refund & Stop Flow (Week 6-7)

**APIs:**
- [ ] POST /api/adfund/[fundId]/pause
- [ ] POST /api/adfund/[fundId]/resume
- [ ] POST /api/adfund/[fundId]/stop

**RefundService (full implementation):**
- [ ] LIFO refund calculation
- [ ] Stripe refund processing
- [ ] Contributor notification

**UI:**
- [ ] Stop campaign confirmation modal
- [ ] Refund status display
- [ ] Contributor refund notifications

### Phase 6: Google Demand Gen (Weeks 7-9)

**GoogleAdService (full implementation):**
- [ ] OAuth / credential management
- [ ] Asset upload
- [ ] Campaign creation
- [ ] Metrics retrieval

**AdOrchestrator (multi-platform):**
- [ ] Launch on both platforms
- [ ] Budget split (70/30)
- [ ] Combined metrics aggregation

**UI Updates:**
- [ ] Show platform breakdown in dashboard
- [ ] Separate metrics per platform

### Phase 7: Polish & Launch (Week 10+)

**Performance:**
- [ ] Optimize metrics polling
- [ ] Add caching where appropriate
- [ ] Error retry logic

**Monitoring:**
- [ ] Set up alerts for failed campaigns
- [ ] Track conversion metrics
- [ ] Dashboard for internal monitoring

**A/B Testing Framework:**
- [ ] Meta vs Google split testing
- [ ] Creative variations
- [ ] Metrics comparison

**Launch:**
- [ ] Beta with 20-50 real campaigns
- [ ] Gather feedback
- [ ] Iterate on creative
- [ ] Full launch

---

## 12. Open Items & Risks

### Blocking Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Meta verification takes >4 weeks | Can't launch Meta ads | Apply immediately; build everything else first |
| Google token takes >8 weeks | Can't launch Google ads | Launch with Meta only; add Google later |
| Meta rejects ad category | Ads rejected | Work with Meta support; adjust creative |

### Technical Decisions Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Image overlay generation | Server-side (Sharp) vs Client-side (Canvas) | Server-side for consistency |
| Metrics polling frequency | 5min / 15min / 1hr | 15min (balance accuracy vs API limits) |
| Daily budget update timing | Midnight local / Midnight UTC / Pet timezone | Owner's timezone based on case location |

### Open Questions

1. **Post-reunion tips** - Should we prompt for tips immediately after marking found, or later via email?

2. **Reddit bot** - Is this worth building in parallel, or defer to later phase?

3. **Copy & Share feature** - Build before or after ad automation?

4. **Minimum contribution display** - Show "$5 minimum" or "Suggested: $5, $10, $25"?

---

## Appendix: Quick Reference

### Status State Machine

```
AdFund:
  RAISING → READY (when minimum reached)
  READY → LAUNCHING (when owner confirms)
  LAUNCHING → ACTIVE (when ads live)
  ACTIVE → PAUSED (owner pauses)
  PAUSED → ACTIVE (owner resumes)
  ACTIVE → COMPLETED (budget exhausted or time ended)
  ACTIVE → REFUNDING (pet found, processing refunds)
  REFUNDING → REFUNDED (all refunds complete)
  RAISING → CANCELLED (owner cancels before launch)
  READY → CANCELLED (owner cancels before launch)
```

### Fee Calculation Examples

| Raised | Spent | Platform Fee (15%) | Refund |
|--------|-------|-------------------|--------|
| $50 | $50 | $7.50 | $0 |
| $50 | $30 | $4.50 | $15.50 |
| $50 | $0 | $0 | $50 |
| $100 | $65 | $9.75 | $25.25 |

### Daily Budget Schedule

**5-Day Campaign:**
| Day | % | $50 budget | $100 budget |
|-----|---|------------|-------------|
| 1 | 30% | $15.00 | $30.00 |
| 2 | 25% | $12.50 | $25.00 |
| 3 | 20% | $10.00 | $20.00 |
| 4 | 15% | $7.50 | $15.00 |
| 5 | 10% | $5.00 | $10.00 |

---

*Document created: December 2024*
*Status: Awaiting approval before implementation*
