# ReunitePets.org - Complete Ad Automation & Monetization Specification

**Document Purpose:** Complete specification capturing all research, decisions, technical architecture, and implementation details for the ad automation monetization system.

**Created:** December 2024

---

## Part 1: Business Philosophy & Core Principles

### The Guiding Philosophy

> "Give away everything that can be free. Only monetize where there are real external costs, and take a small margin on top."

This is the foundation of ReunitePets.org's approach:

- **Free forever:** Visibility/priority (based on urgency, recency, proximity - never money), reward facilitation, poster generation, shelter tools, all core features for finding pets
- **Monetize only:** Things with unavoidable external costs (ad spend) where we provide real value (campaign management)
- **Graceful optional revenue:** Tips after successful reunions (GiveButter-style gratitude, not obligation)

### What This Means Practically

| Feature | Cost to Us | Monetized? |
|---------|-----------|------------|
| Lost pet listings | ~$0 | No - Free |
| Search priority/visibility | ~$0 | No - Free (urgency-based, not money-based) |
| Volunteer coordination | ~$0 | No - Free |
| Printable flyers (PDF) | ~$0 | No - Free |
| AI pet matching | ~$0 | No - Free |
| Shelter management tools | ~$0 | No - Free |
| Facebook/Instagram ad campaigns | Real $ to Meta | Yes - We take 15% margin |
| Google ad campaigns | Real $ to Google | Yes - We take 15% margin |
| Post-reunion tips | ~$0 | Optional - 100% voluntary |

---

## Part 2: Market Research - Does This Actually Work?

### PawBoost: The Proven Model

PawBoost has operated for 10+ years, proving the market exists.

| Metric | Data | Source |
|--------|------|--------|
| Overall reunion rate | 48% of posted pets marked "reunited" | PawBoost |
| Attributed to PawBoost specifically | 29% of reunions | PawBoost FAQ |
| Total reunions | 2+ million pets | PawBoost |
| Monthly reach | 35 million on Facebook, 25 million email/push | PawBoost |
| Pricing | $29.99 - $99.99 per boost | PawBoost website |

### Real User Testimonials (from Trustpilot, 5 stars, 350+ reviews)

- "Posted on PawBoost and received a call in less than 12 hours"
- "Within 2 hours of posting, I was receiving calls. Within 6 hours we had our dog back"
- "Reunited the same day we used PawBoost"

### Negative Feedback (from PissedConsumer)

- "Paid for all the extras... only received scam artists claiming to have my cat"
- Issues with email contact system not working

### Scientific Research on Finding Lost Pets

From ASPCA research and peer-reviewed studies:

| Method | Success Rate |
|--------|-------------|
| Searching neighborhood | 49% (dogs) |
| Pet returned on its own | 59% (cats) |
| ID tags / microchip | 15% of recoveries |
| **Social media** | **14-15% of recoveries** |
| Shelters | Only 2-6% |

**Key insight:** Social media IS a legitimate recovery method - responsible for ~1 in 7 reunions.

### Microchip Statistics (from Dogster)

- Dogs WITHOUT microchip: 21.9% returned
- Dogs WITH microchip: 52.2% returned
- **3x more likely to be reunited with a microchip**

### The Honest Assessment

Social media ads are ONE tool in a toolkit, not magic. The honest pitch is:

> "Ads increase your chances. They're not guaranteed, but they put your pet in front of thousands of local eyes who might have seen something. Combined with physical searching, flyers, and shelter checks, you maximize your odds."

ReunitePets.org is better positioned than PawBoost because we also have:
- Volunteer search coordination (physical searching - the #1 method)
- AI matching with found pets
- Shelter integration
- Multi-platform posting

---

## Part 3: Platform Analysis - Where to Run Ads

### Complete Platform Comparison

| Platform | Radius Targeting | API Automation | Large Image Format | PawBoost Uses? | Our Decision |
|----------|-----------------|----------------|-------------------|----------------|--------------|
| Meta (Facebook/Instagram) | ✅ Yes (1+ miles) | ✅ Yes | ✅ Yes (feed ads) | ✅ Yes | ✅ **USE** |
| Google Demand Gen (YouTube/Gmail/Discover) | ✅ Yes (1+ miles) | ✅ Yes | ✅ Yes (feed-style) | ❌ No | ✅ **USE** |
| Google Display Network | ✅ Yes | ✅ Yes | ❌ No (tiny banners) | ❌ No | ❌ **SKIP** |
| TikTok | ❌ City/region only | ✅ Yes | ✅ Yes | ❌ No | ❌ **SKIP** |
| Reddit Ads | ❌ City only | ✅ Yes | Variable | ❌ No | ❌ **SKIP** |

### Why We're Only Using Meta + Google Demand Gen

**Meta (Facebook + Instagram):**
- Proven by PawBoost (10 years, 2M reunions)
- Radius targeting down to 1 mile
- Feed-style ads with large, prominent pet photos
- Full API automation
- Largest social audience

**Google Demand Gen (formerly Discovery Ads):**
- Appears on YouTube Home Feed, Gmail Promotions, Google Discover
- Radius targeting down to 1 mile
- Large, feed-style image placements (not tiny banners)
- Full API automation
- **PawBoost doesn't use this - competitive advantage**

### Why TikTok Is Dropped

TikTok only supports city/region targeting, not radius. For a cat that wandered 2 blocks, showing ads to an entire metro area is:
- Wasteful (paying to reach people 30 miles away)
- Less effective (dilutes the local signal)
- Not worth the engineering complexity

### Why Google Display Network Is Dropped

Standard Display Network often renders ads as tiny banners (300x250, etc.) on random websites. For lost pet ads:
- Pet photo gets shrunk to thumbnail size
- Less emotional impact
- Lower click-through rates
- Demand Gen (feed-style) is better for visual/emotional content

### Google Ads Policy Clarification

There was confusion about whether Google allows "non-business" ads.

**What's NOT allowed:** Soliciting donations via Google Ads (unless you're a 501(c)(3))

**What IS allowed:** Awareness ads ("Have you seen this dog? Click to report") - this is just advertising, not fundraising. The crowdfunding happens on OUR platform, not in the ad.

---

## Part 4: Distribution Channels Beyond Paid Ads

### Free Distribution Opportunities

| Channel | API Status | Automation Possible? | Notes |
|---------|-----------|---------------------|-------|
| Reddit Local Subreddits | ✅ Bot-friendly API | Yes, with mod approval | r/austin, r/chicago, etc. |
| X/Twitter | ✅ API available | Yes | Use local hashtags |
| Petco Love Lost | ✅ Integration exists | Yes | Syncs with Nextdoor |
| Nextdoor | ⚠️ Partner API only | Requires partnership | PawBoost has this |
| Your own push/email/SMS | ✅ Already built | Yes | Twilio/Resend |

### Platforms WITHOUT Automation (Manual Only)

| Platform | Why No Automation |
|----------|------------------|
| Facebook Groups | Meta killed the API in April 2024 |
| Ring Neighbors | No public API |
| Citizen App | No public API |
| Craigslist | No API, anti-bot measures |

### The Facebook Groups Reality

> "Facebook completely deprecated the Groups API in April 2024... No tools including Buffer, Hootsuite, or any other service can post to Facebook groups via API."

This means:
- PawBoost built their Facebook Group network BEFORE the API was killed
- They likely have staff/volunteers who manually post to hundreds of local "Lost Pets of [City]" groups
- This is a defensible moat - it takes time and humans to build
- We can't just automate our way into this

**Our approach:** Build the "Copy & Share" feature - generate perfect posts that users can copy/paste into their local Facebook Groups.

### Reddit Bot Strategy (Free, Automatable)

Reddit's API is bot-friendly. The legitimate approach:

1. Identify top 50 local subreddits by population (r/chicago, r/nyc, r/losangeles, etc.)
2. Message each mod team: "We're ReunitePets.org - can we post lost pet alerts for your area?"
3. Track which subs approve us
4. Build bot to only post to approved subs
5. Expand over time

**This becomes a moat** - a network of approved subreddits that competitors can't easily replicate.

### The "Copy & Share" Free Feature

Build this for free distribution without needing APIs:

```
User reports lost pet
       ↓
We generate:
├── Shareable link to your platform
├── Perfect Facebook post (copy/paste ready)
├── Perfect Instagram caption + hashtags
├── Perfect X/Twitter post with hashtags
├── Perfect Reddit post for their local subreddit
├── Perfect Nextdoor post (copy/paste)
├── Perfect Craigslist post
├── Printable flyer PDF
├── QR code linking to pet's page
       ↓
User clicks "Share to [Platform]" buttons
       ↓
We track which platforms they shared to
```

---

## Part 5: The Crowdfunding Model (AdFund)

### Why Crowdfunding Instead of Direct Payment

| Problem with Owner-Pays | How Crowdfunding Solves It |
|------------------------|---------------------------|
| Owner stressed, might not afford $50 | Friends/family/community contribute |
| Feels transactional/extractive | Feels like community support |
| Chargeback risk on large payments | Smaller contributions = smaller exposure |
| Refund complexity | Small donations feel like gifts |
| Limited reach (only owner's budget) | Viral potential - people share to raise more |

### The Complete Flow

```
Pet Owner Reports Lost Pet (FREE - always free)
              ↓
Owner clicks "Launch Ad Fund"
              ↓
Creates shareable fundraiser page:
├── Pet photo + story
├── "Help find [Pet Name]!"
├── Progress bar: "$15 of $45 raised"
├── Contribute buttons: $5, $10, $25, Custom
├── Recent contributors + messages
              ↓
Owner shares link (Facebook, text, Nextdoor, etc.)
              ↓
Fund reaches $25 minimum
              ↓
6-hour verification window
              ↓
Ads launch automatically on Meta + Google
              ↓
Contributors receive email updates:
"Your donation reached 2,847 people!"
              ↓
Pet found!
              ↓
"Max is home! Thank you to 12 contributors!"
              ↓
Optional: Gratitude tip to ReunitePets
```

### Pricing Structure

| Contribution | Platform Fee (15%) | To Ads (85%) | Stripe (~3%) | Net to Ads |
|--------------|-------------------|--------------|--------------|------------|
| $25 (minimum) | $3.75 | $21.25 | $0.77 | $20.48 |
| $40 | $6.00 | $34.00 | $1.23 | $32.77 |
| $50 | $7.50 | $42.50 | $1.53 | $40.97 |
| $100 | $15.00 | $85.00 | $3.05 | $81.95 |

### Why 15% Fee

| Platform | Fee |
|----------|-----|
| GoFundMe | 0% (tips only, ~3% payment processing) |
| Managed ad agencies | 20-30% |
| PawBoost | ~25-30% (estimated) |
| **Us** | **15%** |

15% is defensible because:
- We're not just transferring money (like GoFundMe)
- We're running actual ad campaigns with targeting, creative, optimization
- We're lower than agencies and competitors
- Could consider tiered: 15% under $100, 12% over $100, 10% over $250

### Minimum: $25

- Lower amounts (like $10) deliver only ~500-1000 impressions over 2-3 days
- At $25, you can run a 3-5 day campaign with meaningful reach
- Low enough to not feel like a barrier
- Community can always boost it higher

---

## Part 6: Transparent Algorithms

### Core Principle

> "People should see exactly how we calculate everything - the radius, the reach, the budget breakdown. No black boxes."

### Transparent Search Radius

Users see exactly how we calculate the search area:

```
📐 SEARCH RADIUS CALCULATION

Pet Info:
  🐕 Dog (Golden Retriever, Large)
  ⏱️ Missing 18 hours
  🏠 Indoor/outdoor pet
  📍 Austin, TX (Suburban)

Calculation:
  Base radius (dog):                    1.0 miles
  + Time missing (18 hrs @ 0.5mi/12hr): +0.75 miles
  + Large breed adjustment:             +20%
  − Suburban area (obstacles):          −10%
                                        ──────────
  Calculated radius:                    1.9 miles

  ⭕ 90% probability Max is within this radius
```

### Radius Calculation Algorithm

```javascript
function calculateSearchRadius({
  petType,
  breed,
  size,
  hoursMissing,
  isIndoorPet,
  hasFencedYard,
  areaType,
  petAge,
  weatherConditions
}) {
  // Base radius by pet type (miles)
  const baseRadius = {
    cat: 0.25,    // Cats stay close (84% found within 5 houses)
    dog: 1.0,     // Dogs roam more
    bird: 5.0,    // Birds can fly far
    rabbit: 0.1,  // Rabbits stay very close
  };

  let radius = baseRadius[petType] || 1.0;
  const factors = [];

  // Time expansion
  if (petType === 'dog') {
    // Dogs: ~0.5 miles per 12 hours, max +5 miles
    const timeExpansion = Math.min((hoursMissing / 12) * 0.5, 5);
    radius += timeExpansion;
    factors.push({
      name: `Time missing (${hoursMissing} hours)`,
      effect: `+${timeExpansion.toFixed(1)} miles`
    });
  } else if (petType === 'cat') {
    // Cats: ~0.1 miles per 24 hours, max +1 mile
    const timeExpansion = Math.min((hoursMissing / 24) * 0.1, 1);
    radius += timeExpansion;
    factors.push({
      name: `Time missing (${hoursMissing} hours)`,
      effect: `+${timeExpansion.toFixed(1)} miles`
    });
  }

  // Size adjustment (dogs)
  if (petType === 'dog') {
    if (size === 'large') {
      radius *= 1.2;
      factors.push({ name: 'Large breed', effect: '+20%' });
    } else if (size === 'small') {
      radius *= 0.8;
      factors.push({ name: 'Small breed', effect: '-20%' });
    }
  }

  // Indoor pet (less street-smart, stays closer)
  if (isIndoorPet) {
    radius *= 0.7;
    factors.push({ name: 'Indoor pet (tends to hide nearby)', effect: '-30%' });
  }

  // Fenced yard (initial containment)
  if (hasFencedYard && hoursMissing < 6) {
    radius *= 0.8;
    factors.push({ name: 'Escaped from fenced yard recently', effect: '-20%' });
  }

  // Area type
  if (areaType === 'urban') {
    radius *= 0.85;
    factors.push({ name: 'Urban area (obstacles slow travel)', effect: '-15%' });
  } else if (areaType === 'rural') {
    radius *= 1.3;
    factors.push({ name: 'Rural area (open space)', effect: '+30%' });
  }

  // Senior pet
  if (petAge === 'senior') {
    radius *= 0.7;
    factors.push({ name: 'Senior pet (limited mobility)', effect: '-30%' });
  }

  // Weather
  if (weatherConditions === 'rain' || weatherConditions === 'cold') {
    radius *= 0.8;
    factors.push({ name: 'Poor weather (seeks shelter)', effect: '-20%' });
  }

  return {
    radius: Math.round(radius * 10) / 10, // Round to 0.1
    confidence: 0.9, // 90% confidence interval
    factors,
    baseRadius: baseRadius[petType],
  };
}
```

### Reach Estimation: Platform APIs, NOT Population Density

**Important:** We do NOT use population density as a proxy for reach. The platforms know their own audience better than census data.

```javascript
// WRONG approach - population density
const population = areaSqMiles * densityPerSqMile;
const estimatedReach = population * 0.3; // ❌ Guessing

// RIGHT approach - ask the platforms directly
const metaReach = await metaApi.getReachEstimate({
  targeting: {
    geo_locations: {
      custom_locations: [{
        latitude: lat,
        longitude: lng,
        radius: radiusMiles,
        distance_unit: 'mile',
      }]
    }
  },
  optimization_goal: 'REACH',
});

const googleReach = await googleApi.reachPlanService.generateReachForecast({
  customerId,
  campaignDuration: 7,
  targeting: { proximity: { lat, lng, radiusMiles } },
});

const totalEstimatedReach = metaReach.estimate + googleReach.estimate; // ✅ Actual data
```

### CRITICAL: Reach vs Impressions

| Term | Definition | What We Optimize For |
|------|-----------|---------------------|
| Impressions | Total times ad is shown (same person can see it 5x) | ❌ NOT this |
| Reach | Unique people who see the ad | ✅ THIS |

For lost pets, we care about **unique eyeballs**, not repeat views. If 1,000 people see the ad 5 times each, that's 5,000 impressions but only 1,000 potential witnesses.

**In Meta API:**
```javascript
optimization_goal: 'REACH'  // Optimize for unique people, not impressions
```

**How we display:**
```
👥 2,847 people reached        ← UNIQUE PEOPLE (hero metric)
👁 8,234 total impressions     ← (avg 2.9 views/person)
👆 127 clicks to Max's page
```

### Transparent Budget Breakdown

Users see exactly where their money goes:

```
💰 YOUR $40 CAMPAIGN

Platform fee (15%):           $6.00  → Keeps ReunitePets running
Ad spend:                    $34.00

Where ads will run:
├── Facebook/Instagram:      $20.40  → ~1,800 unique people (Meta estimate)
└── YouTube/Gmail/Discover:  $13.60  → ~950 unique people (Google estimate)

Estimated total reach: ~2,750 unique local people
```

### Goal-Based Funding

Instead of arbitrary amounts, we calculate goals based on reaching a meaningful percentage of the area:

```
🎯 CAMPAIGN GOAL

Search radius: 1.9 miles
Estimated reachable people: ~8,500 (from platform APIs)
Target: Reach 5% (425 unique people)
Budget needed: $32

[=========>          ] $18 of $32 raised

Minimum to launch: $25
Goal for 5% reach: $32
Stretch (10% reach): $58
```

**Why 5%?**

Statistical intuition: If we assume 1 in 100 people (1%) in the area might have noticed a loose pet:
- Reachable population: ~8,500
- Potential witnesses among them: ~85 people
- If we reach 5% (425 people):
- Expected witnesses reached: ~4 people
- That's enough to likely get at least one sighting report

---

## Part 7: Fraud & Chargeback Protection

### The Chargeback Problem

| Scenario | Your Loss |
|----------|----------|
| $25 charge, chargeback filed, you win dispute | $15 (dispute fee only) |
| $25 charge, chargeback filed, you lose | $25 + $15 = $40 |
| Ads already spent $20, chargeback, you lose | $20 (ad spend) + $25 (refund) + $15 (fee) = $60 |

Worst case: You're out more than 2x the original charge.

### 5-Layer Protection Stack

| Layer | Protection | Cost |
|-------|-----------|------|
| 1. Stripe Radar | Block obvious fraud patterns | Free (included) |
| 2. 3D Secure | Shift liability for fraud to bank | Free |
| 3. 6-hour delay | Catch fraud before ad spend | Free |
| 4. Clear terms | "Non-refundable once ads launch" checkbox | Free |
| 5. Chargeback Protection | Stripe covers fraud disputes + $15 fee | 0.4% per transaction |

### Stripe Chargeback Protection Details

From Stripe's policy:
> "If a customer files a fraudulent dispute on a protected transaction, Stripe will cover the full disputed amount and waive the $15 dispute fee."

| Contribution | Protection Cost (0.4%) | Covered If Fraud |
|--------------|----------------------|------------------|
| $25 | $0.10 | Full $25 + $15 fee |
| $50 | $0.20 | Full $50 + $15 fee |
| $100 | $0.40 | Full $100 + $15 fee |

**Recommendation:** Enable this for all transactions. $0.10-0.40 per contribution for full fraud coverage is worth it.

### Implementation

```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2500, // $25.00
  currency: 'usd',
  payment_method_types: ['card'],
  payment_method_options: {
    card: {
      request_three_d_secure: 'always' // Force 3DS - shifts liability
    }
  },
  metadata: {
    fund_id: fundId,
    case_id: caseId,
  }
});
```

### 6-Hour Launch Delay

```
Payment received
       ↓
Wait 6 hours (fraud window)
       ↓
No dispute filed? → Launch ads
Dispute filed? → Cancel, no ad spend lost
```

**Why 6 hours, not immediately?**
- Payment processing edge cases need buffer
- Gives time to catch obvious fraud
- Still fast enough for urgency (pet is still missing)
- Can reduce to 2-4 hours once we have automation confidence

### Clear Terms (Required Checkbox)

Before payment, user must check:

> ☑️ I understand that once ads launch (approximately 6 hours after funding is complete), this contribution is non-refundable. If the pet is found before ads launch, contributors receive full refunds.

This helps win disputes when you submit evidence.

### Crowdfunding Reduces Risk

| Model | Chargeback Scenario | Your Loss |
|-------|--------------------| ----------|
| Owner pays $50 | Owner chargebacks | $50 + $15 = $65 |
| 10 people pay $5 each | 1 person chargebacks | $5 + $15 = $20 |

Smaller contributions = smaller individual chargeback damage.

---

## Part 8: Technical Architecture

### Database Schema

```prisma
// New models for ad automation

model AdFund {
  id              String   @id @default(cuid())
  caseId          String   @unique
  case            Case     @relation(fields: [caseId], references: [id])

  // Funding
  goalAmount      Int      // Target in cents (calculated from 5% reach)
  currentAmount   Int      @default(0) // Raised so far
  minimumAmount   Int      @default(2500) // $25 minimum in cents
  contributorCount Int     @default(0)

  // Status
  status          AdFundStatus @default(RAISING)
  // RAISING - accepting contributions
  // FUNDED - minimum reached, waiting for launch
  // LAUNCHING - 6-hour verification window
  // ADS_RUNNING - campaigns live
  // COMPLETED - pet found or campaign ended
  // CANCELLED - refunded

  // Transparent calculation data
  searchRadius    Float    // Calculated radius in miles
  radiusFactors   Json     // Array of { name, effect } for transparency
  estimatedReach  Int      // From platform APIs (unique people)
  reachBreakdown  Json     // { meta: X, google: Y }

  // Timing
  createdAt       DateTime @default(now())
  fundedAt        DateTime? // When minimum was reached
  launchAt        DateTime? // Scheduled launch (fundedAt + 6 hours)
  launchedAt      DateTime? // Actual launch time
  completedAt     DateTime?

  // Relations
  contributions   AdFundContribution[]
  campaign        AdCampaign?
}

enum AdFundStatus {
  RAISING
  FUNDED
  LAUNCHING
  ADS_RUNNING
  COMPLETED
  CANCELLED
}

model AdFundContribution {
  id              String   @id @default(cuid())
  fundId          String
  fund            AdFund   @relation(fields: [fundId], references: [id])

  // Payment
  amount          Int      // In cents
  stripePaymentId String   @unique
  status          PaymentStatus @default(PENDING)
  // PENDING, COMPLETED, REFUNDED, DISPUTED

  // Contributor info
  email           String
  name            String?
  message         String?  // "Hope you find Max!"
  isAnonymous     Boolean  @default(false)

  // Tracking
  createdAt       DateTime @default(now())
  refundedAt      DateTime?
}

enum PaymentStatus {
  PENDING
  COMPLETED
  REFUNDED
  DISPUTED
}

model AdCampaign {
  id              String   @id @default(cuid())
  fundId          String   @unique
  fund            AdFund   @relation(fields: [fundId], references: [id])

  // Budget breakdown
  totalBudget     Int      // Total collected (cents)
  platformFee     Int      // 15% to us (cents)
  adSpend         Int      // 85% to platforms (cents)
  metaBudget      Int      // Portion to Meta
  googleBudget    Int      // Portion to Google

  // Platform campaign IDs
  metaCampaignId  String?
  metaAdSetId     String?
  metaAdId        String?
  googleCampaignId String?
  googleAdGroupId String?

  // Status
  status          CampaignStatus @default(PENDING)
  // PENDING, LAUNCHING, ACTIVE, PAUSED, COMPLETED, FAILED

  // Real-time metrics (updated via webhooks/polling)
  metaReach       Int      @default(0) // Unique people
  metaImpressions Int      @default(0)
  metaClicks      Int      @default(0)
  metaSpent       Int      @default(0) // Cents

  googleReach     Int      @default(0)
  googleImpressions Int    @default(0)
  googleClicks    Int      @default(0)
  googleSpent     Int      @default(0)

  // Timing
  createdAt       DateTime @default(now())
  launchedAt      DateTime?
  completedAt     DateTime?

  // Error handling
  lastError       String?
  retryCount      Int      @default(0)
}

enum CampaignStatus {
  PENDING
  LAUNCHING
  ACTIVE
  PAUSED
  COMPLETED
  FAILED
}

model ReunionTip {
  id              String   @id @default(cuid())
  caseId          String
  case            Case     @relation(fields: [caseId], references: [id])

  amount          Int      // Cents
  stripePaymentId String   @unique
  message         String?

  createdAt       DateTime @default(now())
}
```

### Service Layer Architecture

```javascript
// /app/lib/adAutomation/AdOrchestrator.js

import { MetaAdService } from './MetaAdService';
import { GoogleAdService } from './GoogleAdService';
import { prisma } from '@/lib/prisma';

export class AdOrchestrator {
  constructor() {
    this.meta = new MetaAdService();
    this.google = new GoogleAdService();
  }

  /**
   * Calculate search radius with full transparency
   */
  async calculateSearchRadius(caseData) {
    const { petType, breed, size, hoursMissing, isIndoorPet, hasFencedYard, petAge } = caseData;
    const { lat, lng } = caseData.lastSeenLocation;

    // Get area type from geocoding
    const areaType = await this.getAreaType(lat, lng);

    // Get weather (optional enhancement)
    const weather = await this.getWeather(lat, lng).catch(() => null);

    // Calculate with all factors
    const result = calculateSearchRadius({
      petType,
      breed,
      size,
      hoursMissing,
      isIndoorPet,
      hasFencedYard,
      areaType,
      petAge,
      weatherConditions: weather?.condition,
    });

    return result; // { radius, confidence, factors, baseRadius }
  }

  /**
   * Get reach estimates from actual platform APIs
   */
  async getReachEstimates(lat, lng, radiusMiles, budget) {
    const adSpend = Math.floor(budget * 0.85); // After 15% platform fee
    const metaBudget = Math.floor(adSpend * 0.6); // 60% to Meta
    const googleBudget = adSpend - metaBudget; // 40% to Google

    const [metaEstimate, googleEstimate] = await Promise.all([
      this.meta.getReachEstimate(lat, lng, radiusMiles, metaBudget),
      this.google.getReachEstimate(lat, lng, radiusMiles, googleBudget),
    ]);

    return {
      breakdown: {
        platformFee: budget - adSpend,
        metaBudget,
        googleBudget,
      },
      reach: {
        meta: metaEstimate.reach,
        google: googleEstimate.reach,
        total: metaEstimate.reach + googleEstimate.reach,
      },
      // For transparency display
      metaDetails: metaEstimate,
      googleDetails: googleEstimate,
    };
  }

  /**
   * Calculate goal amount based on 5% reach target
   */
  async calculateGoal(caseData) {
    const radiusResult = await this.calculateSearchRadius(caseData);
    const { lat, lng } = caseData.lastSeenLocation;

    // Get total reachable audience from platforms
    // Use a reference budget to estimate reach per dollar
    const referenceEstimate = await this.getReachEstimates(lat, lng, radiusResult.radius, 10000); // $100 reference

    const reachPerDollar = referenceEstimate.reach.total / 100;
    const targetReachPercent = 0.05; // 5%
    const targetReach = Math.round(referenceEstimate.reach.total * targetReachPercent);
    const goalBudget = Math.round(targetReach / reachPerDollar);

    return {
      radius: radiusResult.radius,
      radiusFactors: radiusResult.factors,
      estimatedReachableAudience: referenceEstimate.reach.total,
      targetReach,
      targetReachPercent: 5,
      goalAmount: Math.max(goalBudget, 2500), // Minimum $25
      minimumAmount: 2500,
    };
  }

  /**
   * Launch campaigns on all platforms
   */
  async launchCampaigns(fundId) {
    const fund = await prisma.adFund.findUnique({
      where: { id: fundId },
      include: { case: true },
    });

    if (!fund || fund.status !== 'LAUNCHING') {
      throw new Error('Fund not ready to launch');
    }

    const caseData = fund.case;
    const { lat, lng } = caseData.lastSeenLocation;

    // Calculate budgets
    const totalBudget = fund.currentAmount;
    const platformFee = Math.floor(totalBudget * 0.15);
    const adSpend = totalBudget - platformFee;
    const metaBudget = Math.floor(adSpend * 0.6);
    const googleBudget = adSpend - metaBudget;

    // Generate creative
    const creative = this.generateCreative(caseData);

    // Create campaign record
    const campaign = await prisma.adCampaign.create({
      data: {
        fundId,
        totalBudget,
        platformFee,
        adSpend,
        metaBudget,
        googleBudget,
        status: 'LAUNCHING',
      },
    });

    // Launch on both platforms in parallel
    const [metaResult, googleResult] = await Promise.allSettled([
      this.meta.createCampaign({
        caseId: caseData.id,
        budget: metaBudget,
        lat,
        lng,
        radius: fund.searchRadius,
        creative,
        duration: 7, // days
      }),
      this.google.createCampaign({
        caseId: caseData.id,
        budget: googleBudget,
        lat,
        lng,
        radius: fund.searchRadius,
        creative,
        duration: 7,
      }),
    ]);

    // Update campaign with platform IDs
    const updates = { status: 'ACTIVE', launchedAt: new Date() };

    if (metaResult.status === 'fulfilled') {
      updates.metaCampaignId = metaResult.value.campaignId;
      updates.metaAdSetId = metaResult.value.adSetId;
      updates.metaAdId = metaResult.value.adId;
    } else {
      console.error('Meta campaign failed:', metaResult.reason);
      updates.lastError = `Meta: ${metaResult.reason.message}`;
    }

    if (googleResult.status === 'fulfilled') {
      updates.googleCampaignId = googleResult.value.campaignId;
      updates.googleAdGroupId = googleResult.value.adGroupId;
    } else {
      console.error('Google campaign failed:', googleResult.reason);
      updates.lastError = (updates.lastError || '') + ` Google: ${googleResult.reason.message}`;
    }

    // If both failed, mark as failed
    if (metaResult.status === 'rejected' && googleResult.status === 'rejected') {
      updates.status = 'FAILED';
    }

    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: updates,
    });

    // Update fund status
    await prisma.adFund.update({
      where: { id: fundId },
      data: {
        status: updates.status === 'FAILED' ? 'FAILED' : 'ADS_RUNNING',
        launchedAt: new Date(),
      },
    });

    return campaign;
  }

  /**
   * Generate ad creative from case data
   */
  generateCreative(caseData) {
    const petName = caseData.petName || 'Pet';
    const petType = caseData.petType || 'pet';
    const breed = caseData.breed || '';
    const neighborhood = caseData.neighborhood || caseData.city || 'your area';

    return {
      headline: `LOST ${petType.toUpperCase()}: ${petName}`,
      primaryText: `Have you seen ${petName}? ${breed ? `${breed} ` : ''}${petType} last seen near ${neighborhood}. Please help us bring ${petName} home!`,
      description: `Click to see more details and report a sighting. Any information helps!`,
      callToAction: 'LEARN_MORE',
      imageUrl: caseData.photos?.[0]?.url || caseData.imageUrl,
      linkUrl: `${process.env.NEXT_PUBLIC_APP_URL}/lost/${caseData.id}`,
    };
  }

  /**
   * Pause all campaigns (when pet is found)
   */
  async pauseCampaigns(fundId) {
    const campaign = await prisma.adCampaign.findUnique({
      where: { fundId },
    });

    if (!campaign || campaign.status !== 'ACTIVE') return;

    await Promise.allSettled([
      campaign.metaCampaignId && this.meta.pauseCampaign(campaign.metaCampaignId),
      campaign.googleCampaignId && this.google.pauseCampaign(campaign.googleCampaignId),
    ]);

    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { status: 'PAUSED', completedAt: new Date() },
    });

    await prisma.adFund.update({
      where: { id: fundId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}
```

### Meta Ads Service

```javascript
// /app/lib/adAutomation/MetaAdService.js

export class MetaAdService {
  constructor() {
    this.accessToken = process.env.META_ACCESS_TOKEN;
    this.adAccountId = process.env.META_AD_ACCOUNT_ID;
    this.pageId = process.env.META_PAGE_ID;
    this.apiVersion = 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  async getReachEstimate(lat, lng, radiusMiles, budgetCents) {
    const response = await fetch(
      `${this.baseUrl}/act_${this.adAccountId}/reachestimate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: this.accessToken,
          targeting_spec: JSON.stringify({
            geo_locations: {
              custom_locations: [{
                latitude: lat,
                longitude: lng,
                radius: radiusMiles,
                distance_unit: 'mile',
              }],
            },
            age_min: 18,
            age_max: 65,
          }),
          optimization_goal: 'REACH',
        }),
      }
    );

    const data = await response.json();

    return {
      reach: data.data?.users_lower_bound || 0, // Conservative estimate
      upperBound: data.data?.users_upper_bound || 0,
    };
  }

  async createCampaign({ caseId, budget, lat, lng, radius, creative, duration }) {
    // 1. Create Campaign
    const campaignResponse = await fetch(
      `${this.baseUrl}/act_${this.adAccountId}/campaigns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: this.accessToken,
          name: `ReunitePets - ${caseId}`,
          objective: 'OUTCOME_AWARENESS',
          status: 'ACTIVE',
          special_ad_categories: [], // Lost pet ads don't fall under special categories
        }),
      }
    );
    const campaign = await campaignResponse.json();

    // 2. Create Ad Set with targeting
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    const adSetResponse = await fetch(
      `${this.baseUrl}/act_${this.adAccountId}/adsets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: this.accessToken,
          name: `ReunitePets AdSet - ${caseId}`,
          campaign_id: campaign.id,
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'REACH',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          daily_budget: Math.floor(budget / duration), // Spread across days
          targeting: JSON.stringify({
            geo_locations: {
              custom_locations: [{
                latitude: lat,
                longitude: lng,
                radius: radius,
                distance_unit: 'mile',
              }],
            },
            age_min: 18,
            age_max: 65,
          }),
          start_time: new Date().toISOString(),
          end_time: endDate.toISOString(),
          status: 'ACTIVE',
        }),
      }
    );
    const adSet = await adSetResponse.json();

    // 3. Create Ad Creative
    const creativeResponse = await fetch(
      `${this.baseUrl}/act_${this.adAccountId}/adcreatives`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: this.accessToken,
          name: `ReunitePets Creative - ${caseId}`,
          object_story_spec: JSON.stringify({
            page_id: this.pageId,
            link_data: {
              image_url: creative.imageUrl,
              link: creative.linkUrl,
              message: creative.primaryText,
              name: creative.headline,
              description: creative.description,
              call_to_action: {
                type: creative.callToAction,
                value: { link: creative.linkUrl },
              },
            },
          }),
        }),
      }
    );
    const adCreative = await creativeResponse.json();

    // 4. Create Ad
    const adResponse = await fetch(
      `${this.baseUrl}/act_${this.adAccountId}/ads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: this.accessToken,
          name: `ReunitePets Ad - ${caseId}`,
          adset_id: adSet.id,
          creative: JSON.stringify({ creative_id: adCreative.id }),
          status: 'ACTIVE',
        }),
      }
    );
    const ad = await adResponse.json();

    return {
      campaignId: campaign.id,
      adSetId: adSet.id,
      creativeId: adCreative.id,
      adId: ad.id,
    };
  }

  async pauseCampaign(campaignId) {
    await fetch(
      `${this.baseUrl}/${campaignId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: this.accessToken,
          status: 'PAUSED',
        }),
      }
    );
  }

  async getCampaignMetrics(campaignId) {
    const response = await fetch(
      `${this.baseUrl}/${campaignId}/insights?fields=reach,impressions,clicks,spend&access_token=${this.accessToken}`
    );
    const data = await response.json();

    return {
      reach: parseInt(data.data?.[0]?.reach || 0),
      impressions: parseInt(data.data?.[0]?.impressions || 0),
      clicks: parseInt(data.data?.[0]?.clicks || 0),
      spent: Math.round(parseFloat(data.data?.[0]?.spend || 0) * 100), // Convert to cents
    };
  }
}
```

### Google Demand Gen Service

```javascript
// /app/lib/adAutomation/GoogleAdService.js

import { GoogleAdsApi } from 'google-ads-api';

export class GoogleAdService {
  constructor() {
    this.client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    this.customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    this.refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  }

  async getCustomer() {
    return this.client.Customer({
      customer_id: this.customerId,
      refresh_token: this.refreshToken,
    });
  }

  async getReachEstimate(lat, lng, radiusMiles, budgetCents) {
    const customer = await this.getCustomer();

    // Use ReachPlanService for reach forecasting
    const reachPlan = await customer.reachPlanService.generateReachForecast({
      customer_id: this.customerId,
      campaign_duration: { duration_in_days: 7 },
      targeting: {
        plannable_location_ids: [], // We'll use proximity instead
        proximity_location: {
          geo_point: {
            latitude_in_micro_degrees: lat * 1e6,
            longitude_in_micro_degrees: lng * 1e6,
          },
          radius: radiusMiles,
          radius_unit: 'MILES',
        },
      },
      planned_products: [{
        plannable_product_code: 'DEMAND_GEN_VIDEO_ADS',
        budget_micros: budgetCents * 10000, // Convert cents to micros
      }],
    });

    return {
      reach: reachPlan.reach_curve?.reach_forecasts?.[0]?.on_target_reach || 0,
    };
  }

  async createCampaign({ caseId, budget, lat, lng, radius, creative, duration }) {
    const customer = await this.getCustomer();

    // 1. Create Campaign (Demand Gen type)
    const campaign = await customer.campaigns.create({
      name: `ReunitePets - ${caseId}`,
      advertising_channel_type: 'DEMAND_GEN', // This is for Discovery/YouTube/Gmail
      status: 'ENABLED',
      campaign_budget: {
        amount_micros: budget * 10000, // cents to micros
        delivery_method: 'STANDARD',
      },
      start_date: this.formatDate(new Date()),
      end_date: this.formatDate(new Date(Date.now() + duration * 24 * 60 * 60 * 1000)),
    });

    // 2. Create Ad Group with targeting
    const adGroup = await customer.adGroups.create({
      campaign: campaign.resource_name,
      name: `ReunitePets AdGroup - ${caseId}`,
      status: 'ENABLED',
      type: 'DEMAND_GEN_PRODUCT_AD',
    });

    // 3. Set location targeting (radius)
    await customer.campaignCriteria.create({
      campaign: campaign.resource_name,
      proximity: {
        geo_point: {
          latitude_in_micro_degrees: lat * 1e6,
          longitude_in_micro_degrees: lng * 1e6,
        },
        radius: radius,
        radius_unit: 'MILES',
      },
    });

    // 4. Create Asset (image)
    const imageAsset = await customer.assets.create({
      name: `ReunitePets Image - ${caseId}`,
      type: 'IMAGE',
      image_asset: {
        data: await this.fetchImageAsBase64(creative.imageUrl),
      },
    });

    // 5. Create Demand Gen Ad
    const ad = await customer.ads.create({
      ad_group: adGroup.resource_name,
      demand_gen_product_ad: {
        headline: { text: creative.headline },
        description: { text: creative.description },
        logo: { asset: imageAsset.resource_name },
        marketing_image: { asset: imageAsset.resource_name },
        business_name: 'ReunitePets',
        call_to_action_text: 'Learn More',
        final_urls: [creative.linkUrl],
      },
    });

    return {
      campaignId: campaign.id,
      adGroupId: adGroup.id,
      adId: ad.id,
    };
  }

  async pauseCampaign(campaignId) {
    const customer = await this.getCustomer();
    await customer.campaigns.update({
      resource_name: `customers/${this.customerId}/campaigns/${campaignId}`,
      status: 'PAUSED',
    });
  }

  async getCampaignMetrics(campaignId) {
    const customer = await this.getCustomer();

    const query = `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.unique_users
      FROM campaign
      WHERE campaign.id = ${campaignId}
    `;

    const [result] = await customer.query(query);

    return {
      reach: result?.metrics?.unique_users || 0,
      impressions: result?.metrics?.impressions || 0,
      clicks: result?.metrics?.clicks || 0,
      spent: Math.round((result?.metrics?.cost_micros || 0) / 10000), // micros to cents
    };
  }

  formatDate(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  async fetchImageAsBase64(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}
```

### API Endpoints

```javascript
// /app/api/cases/[caseId]/ad-fund/route.js

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { AdOrchestrator } from '@/lib/adAutomation/AdOrchestrator';

const orchestrator = new AdOrchestrator();

// GET - Get ad fund details with transparent calculations
export async function GET(request, { params }) {
  const { caseId } = params;

  const fund = await prisma.adFund.findUnique({
    where: { caseId },
    include: {
      contributions: {
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: {
          amount: true,
          name: true,
          message: true,
          isAnonymous: true,
          createdAt: true,
        },
      },
      campaign: {
        select: {
          status: true,
          metaReach: true,
          googleReach: true,
          metaClicks: true,
          googleClicks: true,
          metaSpent: true,
          googleSpent: true,
          launchedAt: true,
        },
      },
    },
  });

  if (!fund) {
    return NextResponse.json({ fund: null });
  }

  // Format contributions for display
  const contributions = fund.contributions.map(c => ({
    amount: c.amount,
    name: c.isAnonymous ? 'Anonymous' : c.name,
    message: c.message,
    createdAt: c.createdAt,
  }));

  return NextResponse.json({
    fund: {
      id: fund.id,
      status: fund.status,
      goalAmount: fund.goalAmount,
      currentAmount: fund.currentAmount,
      minimumAmount: fund.minimumAmount,
      contributorCount: fund.contributorCount,
      searchRadius: fund.searchRadius,
      radiusFactors: fund.radiusFactors,
      estimatedReach: fund.estimatedReach,
      reachBreakdown: fund.reachBreakdown,
      contributions,
      campaign: fund.campaign,
      launchAt: fund.launchAt,
    },
  });
}

// POST - Create ad fund for a case
export async function POST(request, { params }) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { caseId } = params;

  // Get case data
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!caseData) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  // Check if fund already exists
  const existingFund = await prisma.adFund.findUnique({
    where: { caseId },
  });

  if (existingFund) {
    return NextResponse.json({ error: 'Ad fund already exists' }, { status: 400 });
  }

  // Calculate goal with transparent algorithm
  const goalData = await orchestrator.calculateGoal(caseData);

  // Create fund
  const fund = await prisma.adFund.create({
    data: {
      caseId,
      goalAmount: goalData.goalAmount,
      minimumAmount: goalData.minimumAmount,
      searchRadius: goalData.radius,
      radiusFactors: goalData.radiusFactors,
      estimatedReach: goalData.targetReach,
      reachBreakdown: {
        target: goalData.targetReach,
        percent: goalData.targetReachPercent,
      },
      status: 'RAISING',
    },
  });

  return NextResponse.json({ fund });
}
```

```javascript
// /app/api/cases/[caseId]/ad-fund/contribute/route.js

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST - Create payment intent for contribution
export async function POST(request, { params }) {
  const { caseId } = params;
  const { amount, email, name, message, isAnonymous } = await request.json();

  // Validate amount (minimum $5)
  if (amount < 500) {
    return NextResponse.json({ error: 'Minimum contribution is $5' }, { status: 400 });
  }

  // Get fund
  const fund = await prisma.adFund.findUnique({
    where: { caseId },
  });

  if (!fund || fund.status === 'COMPLETED' || fund.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Fund not accepting contributions' }, { status: 400 });
  }

  // Create payment intent with 3D Secure required
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method_types: ['card'],
    payment_method_options: {
      card: {
        request_three_d_secure: 'always', // Fraud protection - shifts liability
      },
    },
    metadata: {
      fund_id: fund.id,
      case_id: caseId,
      contributor_email: email,
    },
  });

  // Create pending contribution record
  await prisma.adFundContribution.create({
    data: {
      fundId: fund.id,
      amount,
      email,
      name,
      message,
      isAnonymous,
      stripePaymentId: paymentIntent.id,
      status: 'PENDING',
    },
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
  });
}
```

```javascript
// /app/api/webhooks/stripe/route.js

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { AdOrchestrator } from '@/lib/adAutomation/AdOrchestrator';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const orchestrator = new AdOrchestrator();

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      const fundId = paymentIntent.metadata.fund_id;

      // Update contribution status
      await prisma.adFundContribution.update({
        where: { stripePaymentId: paymentIntent.id },
        data: { status: 'COMPLETED' },
      });

      // Update fund totals
      const fund = await prisma.adFund.update({
        where: { id: fundId },
        data: {
          currentAmount: { increment: paymentIntent.amount },
          contributorCount: { increment: 1 },
        },
      });

      // Check if minimum reached and not already funded
      if (fund.currentAmount >= fund.minimumAmount && fund.status === 'RAISING') {
        // Schedule launch for 6 hours from now
        const launchAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

        await prisma.adFund.update({
          where: { id: fundId },
          data: {
            status: 'FUNDED',
            fundedAt: new Date(),
            launchAt,
          },
        });

        // TODO: Send emails to contributors that launch is scheduled
        // TODO: Schedule job to launch at launchAt
      }
      break;
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object;

      // Mark contribution as disputed
      await prisma.adFundContribution.updateMany({
        where: { stripePaymentId: dispute.payment_intent },
        data: { status: 'DISPUTED' },
      });

      // Log for monitoring
      console.warn('Dispute created:', dispute.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

### Environment Variables Required

```env
# Meta (Facebook) Ads
META_ACCESS_TOKEN=           # Long-lived access token from Business Manager
META_AD_ACCOUNT_ID=          # Your ad account ID (without 'act_' prefix)
META_PAGE_ID=                # Facebook Page ID for ads
META_APP_ID=                 # App ID for API access
META_APP_SECRET=             # App secret

# Google Ads
GOOGLE_ADS_CLIENT_ID=        # OAuth client ID
GOOGLE_ADS_CLIENT_SECRET=    # OAuth client secret
GOOGLE_ADS_DEVELOPER_TOKEN=  # Developer token from Google Ads API Center
GOOGLE_ADS_CUSTOMER_ID=      # Your Google Ads customer ID
GOOGLE_ADS_REFRESH_TOKEN=    # OAuth refresh token

# Stripe (already have most of these)
STRIPE_SECRET_KEY=           # Already configured
STRIPE_WEBHOOK_SECRET=       # For webhook verification
STRIPE_CHARGEBACK_PROTECTION=true  # Enable 0.4% protection
```

---

## Part 9: Implementation Plan

### Phase 0: Platform Approvals (Start Immediately)

**Meta Business Manager:**
- Apply for verification (2-4 weeks)
- Set up Ad Account
- Create Page for ads
- Generate long-lived access token

**Google Ads API:**
- Apply for developer token (2-8 weeks for Standard access)
- Set up OAuth credentials
- Apply for Demand Gen access

**Action items:**
- [ ] Apply for Meta Business Manager verification
- [ ] Apply for Google Ads API developer token
- [ ] Enable Stripe Chargeback Protection

### Phase 1: Meta Integration + Crowdfunding UI (Weeks 1-5)

**Database:**
- [ ] Create AdFund model migration
- [ ] Create AdFundContribution model migration
- [ ] Create AdCampaign model migration

**Backend:**
- [ ] Implement AdOrchestrator
- [ ] Implement MetaAdService
- [ ] Implement radius calculation algorithm
- [ ] Implement contribution API endpoints
- [ ] Implement Stripe webhook handlers
- [ ] Implement 6-hour launch scheduler

**Frontend:**
- [ ] Create AdFund page with transparent calculations
- [ ] Create contribution flow with Stripe Elements
- [ ] Create campaign dashboard with real-time metrics
- [ ] Create contributor notification emails

### Phase 2: Validate with Real Campaigns (Weeks 6-8)

- [ ] Run 20-50 real campaigns
- [ ] Measure: reunion correlation, click rates, reach accuracy
- [ ] Gather user feedback
- [ ] Iterate on creative templates
- [ ] Adjust pricing/fees if needed

### Phase 3: Google Demand Gen Integration (Weeks 9-11)

- [ ] Implement GoogleAdService
- [ ] Add to AdOrchestrator
- [ ] Update UI to show both platforms
- [ ] Test end-to-end
- [ ] Launch combined campaigns

### Phase 4: Polish & Full Launch (Weeks 12+)

- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Advanced metrics dashboard
- [ ] A/B testing ad creative
- [ ] Scale marketing

---

## Part 10: Revenue Projections

### Conservative Scenario

| Metric | Value |
|--------|-------|
| Campaigns per month | 50 |
| Average campaign size | $40 |
| Total GMV | $2,000 |
| Platform fee (15%) | $300 |
| Stripe fees (~3%) | $60 |
| Net revenue | $240/month |

### Moderate Scenario

| Metric | Value |
|--------|-------|
| Campaigns per month | 200 |
| Average campaign size | $50 |
| Total GMV | $10,000 |
| Platform fee (15%) | $1,500 |
| Stripe fees (~3%) | $300 |
| Net revenue | $1,200/month |

### Growth Scenario (12+ months)

| Metric | Value |
|--------|-------|
| Campaigns per month | 1,000 |
| Average campaign size | $60 |
| Total GMV | $60,000 |
| Platform fee (15%) | $9,000 |
| Stripe fees (~3%) | $1,800 |
| Net revenue | $7,200/month |

### Additional Revenue Streams (Not Covered Here)

- Shelter CRM SaaS (freemium)
- Optional post-reunion tips
- General donations

---

## Part 11: Competitive Advantages Over PawBoost

| Feature | PawBoost | ReunitePets |
|---------|----------|-------------|
| Facebook/Instagram ads | ✅ | ✅ |
| YouTube/Gmail/Discover ads | ❌ | ✅ |
| Crowdfunded campaigns | ❌ | ✅ |
| Transparent radius calculation | ❌ | ✅ |
| Transparent budget breakdown | ❌ | ✅ |
| Volunteer search coordination | ❌ | ✅ |
| AI pet matching | ❌ | ✅ |
| Shelter integration | ❌ | ✅ |
| Points/gamification | ❌ | ✅ |
| Community feel | ❌ (transactional) | ✅ |

---

## Part 12: Open Questions (For Discussion)

1. **6-hour launch delay** - Is this acceptable given urgency, or should we reduce to 2-3 hours?

2. **$25 minimum** - Right balance of accessibility vs meaningful reach?

3. **15% platform fee** - Fair given we're running actual campaigns? Should we tier it?

4. **5% reach goal** - Is this the right statistical target for the "goal" calculation?

5. **Reddit bot** - Worth the mod outreach effort for free distribution?

6. **"Copy & Share" feature** - Priority for free distribution before paid ads work?

---

## Summary

This document captures the complete monetization strategy for ReunitePets.org:

**Core model:** Crowdfunded ad campaigns with 15% platform fee, $25 minimum

**Platforms:** Meta (Facebook/Instagram) + Google Demand Gen only

**Philosophy:** Free everything that can be free, monetize only where there are real external costs

**Differentiation:** Transparency (radius calculation, reach estimates, budget breakdown), multi-platform (Google Demand Gen), community-powered (crowdfunding vs owner-pays)

**Technical approach:** Full API automation, 6-hour fraud window, 3D Secure + Chargeback Protection

**Timeline:** 11+ weeks phased implementation, Meta first then Google

---

*Document created: December 2024*
*Ready for dev team review and implementation kickoff*
