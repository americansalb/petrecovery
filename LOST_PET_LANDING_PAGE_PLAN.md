# The Perfect Lost Pet Case Landing Page

## Deep Analysis & Implementation Plan

---

## Part 1: Understanding the Mission

### The Two Users, One Page

This page serves **two audiences** with **different needs** but **one goal**:

| Audience | Mindset | Primary Need | Action We Want |
|----------|---------|--------------|----------------|
| **Pet Owner** | Anxious, desperate, checking obsessively | "Is there news? What else can I do?" | Stay engaged, share more, add details |
| **Community Stranger** | Curious, empathetic, might help if easy | "Can I actually help? Is this near me?" | Report sighting, share, join search |

**The Key Insight:** The owner visits 50 times. The stranger visits once. The page must serve both - but the stranger's single visit is what finds the pet.

---

## Part 2: What I Learned from Research

### The Science of Crisis Landing Pages

**The 8-Second Rule:** You have 8 seconds to capture attention. 57% of viewing time is above the fold.

**What AMBER Alerts Teach Us:**
1. Source (who is this from?)
2. Situation (what happened?)
3. Location (where?)
4. Guidance (what should I do?)
5. Time (when was this updated?)

**What GoFundMe Teaches Us:**
- Emotional storytelling raises 40% more funds
- Vulnerability + specificity + hope = action
- Progress bars increase completion by 18%
- The "66% rule" - campaigns at 66%+ toward goal succeed more

**What Mobile UX Teaches Us:**
- Primary CTA belongs in thumb zone (bottom center)
- 54% more leads when optimized for thumb zone
- Touch targets must be 44x44px minimum
- Maps need "gutters" to prevent scroll hijacking

**What Lost Pet Experts Say:**
- Clear, high-quality photo is #1 priority
- Pet looking at camera creates emotional connection
- Unique identifying features save lives
- Time is critical - first 24-48 hours are golden

---

## Part 3: Critical Problems with Current Page

### Data That Exists But Isn't Shown

| Missing Data | Why It Matters | Impact |
|--------------|----------------|--------|
| **Sightings** | People don't know if pet has been spotted | Kills momentum, no sense of progress |
| **Reward** | Financial incentive motivates action | Missing the #1 motivator for strangers |
| **Escape Scenario** | How pet escaped affects search strategy | "Bolted from car" vs "slipped out door" = different search patterns |
| **Case Updates** | No visible timeline of activity | No sense of progress or urgency |
| **Search Radius** | Where to actually look | Strangers don't know their proximity |
| **Active Searchers** | Who else is helping | No social proof of community involvement |
| **Microchip Status** | What finder should do | "Take to vet to scan" is critical guidance |

### UX Problems

1. **Ad Fund is FAKE** - Hardcoded $45/$100. This is deceptive.
2. **4-column stats unreadable on mobile** - 97px per column is too small
3. **"Check Shelters" buried as 5th button** - Should be top 3 (many pets end up there)
4. **No reward visibility** - Monetary incentive hidden
5. **Pulsing badge causes seizure risk** - WCAG violation
6. **No page-specific SEO** - All cases show generic title
7. **Time format unclear** - "3 days ago" without actual date

### What's Actually Working

- Clear visual hierarchy with hero section
- Color-coded action buttons
- Mobile-first responsive layout
- Native sharing API integration
- Dynamic map loading (lazy)

---

## Part 4: The Perfect Lost Pet Landing Page

### Design Philosophy

**"Make the Pet Undeniable"**

When someone lands on this page, they should:
1. Instantly feel they KNOW this pet
2. Understand exactly how to help
3. Feel the urgency without panic
4. See that others are already helping
5. Take action within 30 seconds

### Information Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ABOVE THE FOLD                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  HERO: Pet Photo + Identity + Urgency Signal              │  │
│  │  - Large, clear photo (pet looking at camera if possible) │  │
│  │  - Name + Species + Breed prominently                     │  │
│  │  - "MISSING 3 DAYS" with actual date                      │  │
│  │  - Reward badge if applicable ("$500 REWARD")             │  │
│  │  - Location: "Last seen: Oak Park, Chicago"               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PRIMARY CTA: "I've Seen [PetName]" - HUGE, Rose/Red      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SOCIAL PROOF BAR: "347 people searching · 12 sightings" │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        BELOW THE FOLD                           │
│                                                                 │
│  SECTION 1: Identifying Features (How to Recognize)            │
│  - Unique markings with photos                                  │
│  - Personality/behavior ("Shy, may hide under porches")        │
│  - Medical needs if any ("Needs daily medication")             │
│  - Microchip status                                             │
│                                                                 │
│  SECTION 2: Where to Look (Interactive Map)                    │
│  - Last seen location (pin)                                     │
│  - Sighting locations (different colored pins)                  │
│  - Search radius circle                                         │
│  - "You are here" if geolocation available                     │
│                                                                 │
│  SECTION 3: Activity Timeline                                   │
│  - Recent sightings with photos                                 │
│  - Owner updates                                                │
│  - Search party activity                                        │
│  - "Live" feel - "2 minutes ago: Sarah reported sighting"      │
│                                                                 │
│  SECTION 4: How You Can Help                                    │
│  - Report a Sighting (primary)                                  │
│  - Share This Alert                                             │
│  - Check Local Shelters (with direct links)                    │
│  - Print Flyers (one-click PDF)                                │
│  - Join Search Party                                            │
│                                                                 │
│  SECTION 5: The Story (Emotional Connection)                   │
│  - How pet was lost (escape scenario)                          │
│  - Owner's message                                              │
│  - Family photo with pet (if available)                        │
│                                                                 │
│  FOOTER: Contact + Case Info + Legal                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    FLOATING/STICKY ELEMENTS                     │
│                                                                 │
│  MOBILE: Sticky bottom bar with primary CTA                    │
│  "I've Seen Fluffy" button always visible while scrolling      │
│                                                                 │
│  DESKTOP: Floating sidebar with key actions                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Detailed Component Specifications

### 5.1 Hero Section

**Purpose:** Make the pet unforgettable in 3 seconds

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│ ┌─────────────┐  ┌──────────────────────────────────┐ │
│ │             │  │ 🔴 LOST DOG                       │ │
│ │   [PHOTO]   │  │                                  │ │
│ │   320x320   │  │ FLUFFY                           │ │
│ │             │  │ Golden Retriever · Female · Large │ │
│ │             │  │                                  │ │
│ │             │  │ 📍 Last seen: 123 Oak St, Chicago│ │
│ │             │  │ 🕐 Missing since Dec 28, 2025    │ │
│ │             │  │    (3 days ago)                  │ │
│ │             │  │                                  │ │
│ │             │  │ 💰 $500 REWARD                   │ │
│ └─────────────┘  └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

**Photo Requirements:**
- Minimum 320x320px, preferably square
- Object-fit: cover with rounded corners
- Fallback gradient with paw icon if no photo
- Optional: Gallery of 2-3 photos on desktop

**Urgency Indicator:**
```javascript
// Time-based urgency levels
const getUrgencyLevel = (lastSeenAt) => {
  const hoursAgo = differenceInHours(new Date(), lastSeenAt);
  if (hoursAgo < 24) return { level: 'CRITICAL', color: 'red', pulse: true };
  if (hoursAgo < 72) return { level: 'HIGH', color: 'orange', pulse: false };
  if (hoursAgo < 168) return { level: 'MODERATE', color: 'yellow', pulse: false };
  return { level: 'ACTIVE', color: 'blue', pulse: false };
};
```

**Reward Badge:**
- Only show if `hasReward === true`
- Prominent gold/yellow badge
- Format: "$500 REWARD" or "REWARD OFFERED"

### 5.2 Primary CTA: Report Sighting

**Design Principles:**
- Largest button on page
- High contrast (rose/red on light, or light on dark)
- Personalized: "I've Seen Fluffy" not "Report Sighting"
- Touch target: 56px minimum height
- Mobile: Full width, sticky at bottom

**Interaction Flow:**
```
User clicks "I've Seen Fluffy"
    ↓
Modal opens with 3 options:
    ↓
┌─────────────────────────────────────────────┐
│  Where did you see Fluffy?                  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 📍 Use My Current Location          │   │
│  │    Tap to share where you are now   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 📝 Enter Address/Description        │   │
│  │    Type where you saw them          │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 📞 Call Owner Directly              │   │
│  │    Speak with them now              │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ────────────────────────────────────────  │
│  Not sure if it was Fluffy?                │
│  [See identifying features ↓]              │
└─────────────────────────────────────────────┘
```

### 5.3 Social Proof Bar

**Purpose:** Show momentum, build trust, inspire action

**Design:**
```
┌──────────────────────────────────────────────────────────────┐
│  👥 347 searching  ·  👀 1.2K views  ·  📍 12 sightings     │
│  ─────────────────────────────────────────────────────────── │
│  💬 "Just spotted near Whole Foods!" - Sarah, 5 min ago     │
└──────────────────────────────────────────────────────────────┘
```

**Elements:**
1. **Active Searchers** - Real count from CaseAssignment
2. **Views** - Total page views
3. **Sightings** - Count of CaseSighting records
4. **Latest Activity** - Most recent sighting or update (ticker)

**Animation:** Subtle count-up animation on first load. New activity indicator pulses once.

### 5.4 Identifying Features Section

**Purpose:** Help strangers confirm it's the right pet

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  HOW TO RECOGNIZE FLUFFY                                     │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│  │ [photo] │ │ [photo] │ │ [photo] │                        │
│  │ Front   │ │ Side    │ │ Marking │                        │
│  └─────────┘ └─────────┘ └─────────┘                        │
│                                                              │
│  🎨 Colors: Golden, white chest                              │
│  📏 Size: Large (65 lbs)                                     │
│  ⭐ Unique: White star shape on forehead                     │
│  🏷️ Collar: Red collar with bone-shaped tag                 │
│  💉 Microchipped: Yes (take to any vet to scan)             │
│                                                              │
│  BEHAVIOR TIPS                                               │
│  • Friendly but may be scared - approach slowly              │
│  • Loves treats - try offering food                          │
│  • Responds to "Fluffy" and "Good girl"                      │
│  • If frightened, may hide under cars or porches             │
└──────────────────────────────────────────────────────────────┘
```

**Critical Innovation - "Approach Guide":**
```
┌──────────────────────────────────────────────────────────────┐
│  ⚠️ IF YOU SEE FLUFFY                                        │
│                                                              │
│  DO:                           DON'T:                        │
│  ✓ Stay calm, move slowly      ✗ Chase or run toward        │
│  ✓ Crouch down to seem small   ✗ Make loud noises           │
│  ✓ Offer treats if you have    ✗ Corner or trap             │
│  ✓ Call owner immediately      ✗ Grab collar suddenly       │
│                                                              │
│  Fluffy is: [Friendly/Shy/Nervous/May bite if scared]       │
└──────────────────────────────────────────────────────────────┘
```

This is **critical data that doesn't exist in the schema** - we need to collect:
- `approachBehavior`: FRIENDLY | SHY | NERVOUS | AGGRESSIVE_WHEN_SCARED
- `approachTips`: String (freeform tips from owner)
- `respondsTo`: String[] (names, commands pet responds to)

### 5.5 Interactive Sightings Map

**Purpose:** Show where pet has been spotted, help strangers orient

**Design:**
```
┌──────────────────────────────────────────────────────────────┐
│  WHERE FLUFFY HAS BEEN SEEN                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │    🔴 Last seen location (Dec 28)                      │ │
│  │                                                        │ │
│  │         🟡─────🟡 Sighting path                        │ │
│  │              🟡                                        │ │
│  │                    🟢 Most recent sighting (2hrs ago)  │ │
│  │                                                        │ │
│  │    ┌─────────────────────┐                            │ │
│  │    │ 🔵 You are here     │                            │ │
│  │    │    0.3 miles away   │                            │ │
│  │    └─────────────────────┘                            │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  📍 3 sightings in last 24 hours                            │
│  [View all sightings →]                                      │
└──────────────────────────────────────────────────────────────┘
```

**Map Markers:**
- 🔴 Red: Last seen by owner (origin point)
- 🟡 Yellow: Previous sightings (with timestamp on hover)
- 🟢 Green: Most recent sighting
- 🔵 Blue: User's current location (if geo allowed)
- Circle: Search radius overlay

**Mobile Optimization:**
- Default height: 250px (not 300px)
- Gutters on left/right for scroll passthrough
- Expandable to full screen on tap
- List view toggle option

### 5.6 Activity Timeline

**Purpose:** Show momentum, make it feel "live"

**Design:**
```
┌──────────────────────────────────────────────────────────────┐
│  LATEST ACTIVITY                                   [Live 🔴] │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📍 SIGHTING · 2 hours ago                              │ │
│  │ Sarah M. spotted Fluffy near Whole Foods on Oak St     │ │
│  │ "Saw a golden retriever matching description running   │ │
│  │  east toward the park. Looked scared but healthy."     │ │
│  │ [📷 View Photo] [📍 See on Map]                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 👥 SEARCH UPDATE · 5 hours ago                         │ │
│  │ Oak Park Rescue Squad completed grid search of         │ │
│  │ Lincoln Park area. No sighting, moving to north zone.  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📢 OWNER UPDATE · Yesterday                            │ │
│  │ "We've increased the reward to $500. Please help us    │ │
│  │  bring Fluffy home. She's never been outside alone."   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Load more activity ↓]                                      │
└──────────────────────────────────────────────────────────────┘
```

**Entry Types:**
1. **SIGHTING** - From CaseSighting model
2. **OWNER_UPDATE** - From CaseUpdate where isUpdate=true
3. **SEARCH_UPDATE** - From CaseAssignment activity
4. **SHARE_MILESTONE** - "This alert has been shared 1,000 times!"
5. **SYSTEM** - "Case created", "Rescue squad assigned"

### 5.7 Action Cards (How You Can Help)

**Purpose:** Clear hierarchy of ways to help

**Priority Order (based on research):**
1. **Report Sighting** - Primary conversion (already in hero)
2. **Share Alert** - Amplification is critical
3. **Check Shelters** - Many pets end up here (currently buried!)
4. **Print Flyers** - Physical distribution
5. **Join Search** - Deeper commitment
6. **Contribute to Ads** - Financial support (only if real, not mocked)

**Card Design:**
```
┌──────────────────────────────────────────────────────────────┐
│  HOW YOU CAN HELP                                            │
│                                                              │
│  ┌─────────────────────────┐ ┌─────────────────────────┐    │
│  │ 📢 SHARE ALERT          │ │ 🏥 CHECK SHELTERS       │    │
│  │                         │ │                         │    │
│  │ Help spread the word    │ │ Many lost pets end up   │    │
│  │ to your neighborhood    │ │ at local shelters       │    │
│  │                         │ │                         │    │
│  │ Shared 1,243 times      │ │ 3 shelters nearby       │    │
│  │                         │ │                         │    │
│  │ [Share Now]             │ │ [Check Shelters]        │    │
│  └─────────────────────────┘ └─────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────┐ ┌─────────────────────────┐    │
│  │ 🖨️ PRINT FLYERS         │ │ 🔍 JOIN SEARCH          │    │
│  │                         │ │                         │    │
│  │ Download ready-to-print │ │ Coordinate with the     │    │
│  │ flyers with QR code     │ │ rescue squad            │    │
│  │                         │ │                         │    │
│  │ [Download PDF]          │ │ 12 active searchers     │    │
│  │                         │ │                         │    │
│  │                         │ │ [Join Search Party]     │    │
│  └─────────────────────────┘ └─────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 5.8 The Story Section

**Purpose:** Emotional connection, make it personal

**Design:**
```
┌──────────────────────────────────────────────────────────────┐
│  ABOUT FLUFFY                                                │
│                                                              │
│  ┌─────────┐                                                │
│  │ [photo] │  "Fluffy has been part of our family for 7     │
│  │ family  │   years. She escaped when a delivery person    │
│  │ w/ pet  │   left the gate open. She's never been         │
│  └─────────┘   outside alone and must be so scared.         │
│                                                              │
│                Please help us bring her home.                │
│                                                              │
│                - The Johnson Family"                         │
│                                                              │
│  ────────────────────────────────────────────────────────── │
│                                                              │
│  HOW FLUFFY GOT LOST                                         │
│  🚪 Escape type: Slipped out open gate                      │
│  📅 Date: December 28, 2025 around 3:00 PM                  │
│  📍 Location: Backyard of 123 Oak Street                    │
│  🏃 Direction: Ran toward Lincoln Park                       │
└──────────────────────────────────────────────────────────────┘
```

### 5.9 Sticky Mobile CTA

**Purpose:** Primary action always accessible

**Design:**
```
┌──────────────────────────────────────────────────────────────┐
│  Phone screen                                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │              [Scrollable content]                      │ │
│  │                                                        │ │
│  │                                                        │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ ┌────────────────────────────────────────────────────┐│ │
│  │ │       🐕 I'VE SEEN FLUFFY                          ││ │
│  │ └────────────────────────────────────────────────────┘│ │
│  │              [Share] [Call]                           │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Fixed to bottom of viewport
- 56px height minimum (thumb-friendly)
- Appears after scrolling past hero
- Semi-transparent background with blur
- Secondary actions (share, call) as icon buttons

---

## Part 6: Data Model Changes Required

### New Fields for Case Model

```prisma
model Case {
  // ... existing fields ...

  // Reward Information
  hasReward         Boolean   @default(false)
  rewardAmount      Float?
  rewardCurrency    String?   @default("USD")

  // Escape Details (for search strategy)
  escapeType        EscapeType?
  escapeDirection   String?   // "Ran north toward park"
  escapeDetails     String?   // Freeform details

  // Pet Behavior (for approach guidance)
  approachBehavior  ApproachBehavior?
  approachTips      String?   // "Loves cheese, approach slowly"
  respondsToNames   String[]  // ["Fluffy", "Good girl"]

  // Medical Urgency
  needsMedication   Boolean   @default(false)
  medicationDetails String?   // "Needs insulin twice daily"

  // Owner Message
  ownerMessage      String?   // Personal plea to community
  familyPhotoUrl    String?   // Photo of family with pet
}

enum EscapeType {
  DOOR_DASH        // Ran out open door
  GATE_LEFT_OPEN   // Gate left open
  FENCE_JUMP       // Jumped/climbed fence
  LEASH_BREAK      // Broke free from leash
  CAR_ESCAPE       // Jumped out of car
  WINDOW           // Escaped through window
  STOLEN           // Possibly stolen
  OTHER
}

enum ApproachBehavior {
  FRIENDLY         // Will come to anyone
  SHY              // Needs patience, won't approach
  NERVOUS          // May run if approached quickly
  SCARED_AGGRESSIVE // May bite if cornered
}
```

### New Fields for Pet Model

```prisma
model Pet {
  // ... existing fields ...

  // Identification
  hasCollar         Boolean   @default(false)
  collarDescription String?   // "Red collar with bone tag"
  hasMicrochip      Boolean   @default(false)
  microchipRegistry String?   // "HomeAgain", "AVID", etc.

  // Distinguishing Features
  uniqueMarkings    String?   // "White star on forehead"
  scarsOrInjuries   String?   // "Small scar on left ear"

  // Behavior
  temperament       String?   // "Friendly", "Shy with strangers"
  fears             String[]  // ["loud noises", "men with hats"]
  favoriteTreats    String[]  // ["cheese", "hot dogs"]
}
```

---

## Part 7: API Changes Required

### Update Public Case Endpoint

**File:** `/frontend/app/api/public/missions/[caseNumber]/route.js`

**Current:** Returns 16 fields, no relations

**Needed:** Include sightings, updates, and new fields

```javascript
// Add to Prisma query
include: {
  sightings: {
    where: { isVerified: true },
    orderBy: { sightedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      sightedAt: true,
      latitude: true,
      longitude: true,
      address: true,
      description: true,
      certaintyLevel: true,
      photoUrls: true,
      reporter: {
        select: { firstName: true }
      }
    }
  },
  updates: {
    where: { isUpdate: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  },
  assignments: {
    where: { status: 'ACTIVE' },
    include: {
      rescueSquad: {
        select: { name: true, city: true }
      }
    }
  }
}
```

---

## Part 8: Component Architecture

```
app/cases/[caseNumber]/
├── page.js                    # Main page component
├── components/
│   ├── HeroSection.jsx        # Pet photo, name, urgency, reward
│   ├── SocialProofBar.jsx     # Stats + latest activity ticker
│   ├── IdentifyingFeatures.jsx # How to recognize + approach guide
│   ├── SightingsMap.jsx       # Interactive map with all markers
│   ├── ActivityTimeline.jsx   # Chronological activity feed
│   ├── ActionCards.jsx        # Ways to help grid
│   ├── StorySection.jsx       # Emotional narrative
│   ├── StickyMobileCTA.jsx    # Fixed bottom bar
│   └── modals/
│       ├── ReportSightingModal.jsx
│       ├── ShareModal.jsx
│       ├── ContactOwnerModal.jsx
│       └── ShelterFinderModal.jsx
├── hooks/
│   ├── useCaseData.js         # SWR hook for case data
│   └── useGeolocation.js      # User location hook
└── utils/
    ├── urgencyLevel.js        # Calculate urgency from time
    └── shareUtils.js          # Sharing helpers
```

---

## Part 9: Mobile-First Responsive Strategy

### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, sticky CTA |
| Tablet | 640-1024px | Two column where appropriate |
| Desktop | > 1024px | Full three-column layout |

### Mobile-Specific Adaptations

1. **Hero:** Photo above text (stacked), smaller text
2. **Stats:** 2x2 grid instead of 4-column
3. **Map:** 200px height, tap to expand fullscreen
4. **Action Cards:** Full-width stacked buttons
5. **Timeline:** Collapsed by default, tap to expand
6. **Sticky CTA:** Always visible at bottom

---

## Part 10: Accessibility Checklist

- [ ] Page title includes pet name and location
- [ ] All images have descriptive alt text
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] No content relies solely on color
- [ ] Touch targets minimum 44x44px
- [ ] Focus indicators visible on all interactive elements
- [ ] Modals trap focus and close on Escape
- [ ] Reduced motion respects `prefers-reduced-motion`
- [ ] Screen reader announces dynamic content updates
- [ ] Form fields have associated labels

---

## Part 11: SEO & Social Sharing

### Dynamic Metadata

```javascript
export async function generateMetadata({ params }) {
  const caseData = await getCaseData(params.caseNumber);

  return {
    title: `Help Find ${caseData.petName} - Lost ${caseData.petSpecies} in ${caseData.cityName}`,
    description: `${caseData.petName} is a ${caseData.petColor} ${caseData.petBreed} last seen ${formatDate(caseData.lastSeenAt)}. ${caseData.hasReward ? `$${caseData.rewardAmount} reward offered.` : ''}`,
    openGraph: {
      title: `LOST: ${caseData.petName} - ${caseData.cityName}`,
      description: caseData.petDescription,
      images: [caseData.petPhotoUrl],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title: `Help Find ${caseData.petName}!`,
      description: `Lost ${caseData.petBreed} in ${caseData.cityName}. Last seen ${formatTimeAgo(caseData.lastSeenAt)}.`,
      images: [caseData.petPhotoUrl]
    }
  };
}
```

### Structured Data (JSON-LD)

```javascript
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": `Lost Pet: ${petName}`,
  "image": petPhotoUrl,
  "datePublished": createdAt,
  "dateModified": updatedAt,
  "author": {
    "@type": "Person",
    "name": ownerName
  },
  "publisher": {
    "@type": "Organization",
    "name": "ReunitePets.org"
  }
};
```

---

## Part 12: Performance Optimization

1. **Image Optimization**
   - Use Next.js Image component with srcset
   - Blur placeholder for hero image
   - Lazy load timeline images

2. **Map Optimization**
   - Lazy load Leaflet only when map is in viewport
   - Show static image placeholder during load
   - Cluster markers if > 20 sightings

3. **Data Fetching**
   - SWR for client-side caching and revalidation
   - Stale-while-revalidate strategy
   - Optimistic updates for share count

4. **Bundle Size**
   - Dynamic imports for modals
   - Tree-shake Framer Motion (only import needed)
   - Defer non-critical animations

---

## Part 13: Implementation Phases

### Phase 1: Foundation (Core Experience)
- [ ] New component architecture
- [ ] Hero section with all data
- [ ] Primary CTA with modal
- [ ] Mobile-first responsive layout
- [ ] Sticky mobile CTA

### Phase 2: Social Proof & Activity
- [ ] Social proof bar
- [ ] Activity timeline component
- [ ] Real-time sightings integration
- [ ] API updates for sightings/updates

### Phase 3: Enhanced Features
- [ ] Interactive sightings map
- [ ] Identifying features section
- [ ] Approach guide
- [ ] Story section

### Phase 4: Polish & Optimization
- [ ] SEO metadata
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Animation refinement

---

## Part 14: Questions for User

After this deep analysis, I have several questions:

1. **Reward System:** Do you want to implement reward tracking now, or should I mock it until the feature is built?

2. **Pet Behavior Data:** The "approach guide" requires new data fields (approachBehavior, respondsToNames, etc.). Should I add these to the case creation flow, or is this a later phase?

3. **Real-Time Updates:** Should the activity timeline poll for updates, use WebSockets, or be static on load?

4. **Shelter Integration:** The "Check Shelters" feature - should this link to an external site, or do you have a shelter database integration planned?

5. **Flyer Generation:** Should the print flyer include a QR code linking back to this page?

6. **Owner vs. Public View:** Should the owner see additional controls (edit, mark resolved, add update) or is that handled elsewhere?

---

## Summary

The current page is functional but misses critical opportunities:

1. **Sightings are invisible** - The most valuable data isn't shown
2. **Reward is hidden** - The #1 motivator for strangers
3. **No activity timeline** - Feels static, not alive
4. **Approach guidance missing** - Critical for safe recovery
5. **Mobile CTA not sticky** - Primary action scrolls away
6. **Fake data displayed** - Ad fund is mocked

The redesign transforms this from a "flyer on a webpage" to a **living command center** that:
- Makes the pet unforgettable in 3 seconds
- Shows real activity and momentum
- Guides strangers on how to help safely
- Keeps the primary action always accessible
- Connects emotionally while driving action

This is the page that brings pets home.
