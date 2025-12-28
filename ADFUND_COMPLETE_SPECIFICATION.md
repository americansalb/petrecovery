# AdFund Complete Specification
## ReunitePets.org - Crowdfunded Ad Automation

**Purpose:** This is the complete, detailed specification for building the AdFund system. Every screen, every click, every edge case, every error message. A developer should be able to build this without asking questions.

---

# Part 1: User Journeys

## 1.1 The Pet Owner's Complete Journey

### Context: The Emotional State
Sarah's golden retriever Max escaped 3 hours ago. She's panicking. She's already:
- Walked the neighborhood calling his name
- Posted on Nextdoor
- Called the local shelter
- Created a case on ReunitePets

She's on the case page and sees a button that could help reach thousands of people. She's desperate but also broke - vet bills last month wiped her savings. But her mom, her sister, her coworkers - they'd all chip in.

### Screen 1: The Case Page (Entry Point)

**What Sarah sees on her case page:**

```
┌─────────────────────────────────────────────────────────────┐
│  🔴 ACTIVE CASE #CHI-2024-001847                            │
│                                                             │
│  ┌─────────────┐                                            │
│  │             │  MAX                                       │
│  │  [Photo]    │  Golden Retriever • Male • 3 years         │
│  │             │  Last seen: Oak Park, IL                   │
│  └─────────────┘  3 hours ago                               │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📍 12 volunteers searching                                 │
│  👁 847 people have seen this case                          │
│  🔔 34 neighbors alerted                                    │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📢 BOOST WITH ADS                                   │   │
│  │                                                      │   │
│  │  Reach 3,000+ people on Facebook, Instagram,        │   │
│  │  YouTube, and Gmail in Max's area.                  │   │
│  │                                                      │   │
│  │  Crowdfund with friends & family - campaigns        │   │
│  │  start at just $20.                                 │   │
│  │                                                      │   │
│  │  [        Start an Ad Campaign        ]             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Button states:**
- Default: Blue background, white text
- Hover: Darker blue, slight scale up (1.02)
- If fund already exists: Button says "View Ad Campaign →" instead

**Click action:** Navigate to `/case/[caseId]/adfund/create`

---

### Screen 2: Create Ad Campaign

**URL:** `/case/[caseId]/adfund/create`

**What Sarah sees:**

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Max's Case                                       │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📢 Create an Ad Campaign for Max                           │
│                                                             │
│  Reach thousands of people in Max's area on Facebook,       │
│  Instagram, YouTube, and Gmail. Crowdfund the cost with     │
│  friends and family.                                        │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📐 YOUR SEARCH AREA                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Based on Max's details, we recommend searching:    │   │
│  │                                                      │   │
│  │  ⭕ 1.9 mile radius around Oak Park, IL             │   │
│  │                                                      │   │
│  │  How we calculated this:                            │   │
│  │  ┌────────────────────────────────────────────┐    │   │
│  │  │ Base radius (dog):              1.0 miles  │    │   │
│  │  │ + Missing 3 hours:             +0.1 miles  │    │   │
│  │  │ + Large breed:                      +20%   │    │   │
│  │  │ + Suburban area:                    −10%   │    │   │
│  │  │ ─────────────────────────────────────────  │    │   │
│  │  │ Calculated radius:              1.9 miles  │    │   │
│  │  └────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  │  90% of lost dogs are found within this radius.     │   │
│  │                                                      │   │
│  │  [Adjust radius ▾]                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📅 CAMPAIGN LENGTH                                         │
│                                                             │
│  How long should ads run? (You can always stop early        │
│  if Max is found)                                           │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │ 3 days  │  │ 5 days  │  │ 7 days  │                     │
│  │         │  │    ✓    │  │         │                     │
│  │ Best if │  │  Recom- │  │ For     │                     │
│  │ Max is  │  │  mended │  │ longer  │                     │
│  │ nearby  │  │         │  │ searches│                     │
│  └─────────┘  └─────────┘  └─────────┘                     │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  👥 ESTIMATED REACH                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Based on your area and a 5-day campaign:           │   │
│  │                                                      │   │
│  │  $20 minimum  →  ~1,200 people                      │   │
│  │  $50          →  ~3,500 people                      │   │
│  │  $100         →  ~7,500 people                      │   │
│  │                                                      │   │
│  │  These are unique local people who will see Max's   │   │
│  │  photo in their Facebook, Instagram, YouTube, or    │   │
│  │  Gmail feeds.                                       │   │
│  │                                                      │   │
│  │  ℹ️ Estimates from Meta and Google. Actual reach    │   │
│  │  may vary based on competition and engagement.      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  💰 HOW THE MONEY WORKS                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  When people contribute:                            │   │
│  │                                                      │   │
│  │  ├── 85% goes directly to Facebook/Google ads      │   │
│  │  ├── 15% platform fee (keeps ReunitePets running)  │   │
│  │  └── ~3% payment processing (Stripe)               │   │
│  │                                                      │   │
│  │  Example: $10 contribution                          │   │
│  │  ├── $8.50 → ads reaching ~600 people              │   │
│  │  ├── $1.50 → ReunitePets platform                  │   │
│  │  └── $0.59 → payment processing (paid by giver)   │   │
│  │                                                      │   │
│  │  If Max is found early:                             │   │
│  │  We stop the ads and refund unused money to        │   │
│  │  contributors (minus the portion already spent).   │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  ☑️ I understand that:                                      │
│     • Ads will launch immediately when $20 is raised       │
│     • The 15% platform fee is charged on money spent       │
│     • I can stop the campaign anytime if Max is found      │
│     • Unused funds will be refunded to contributors        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  [       Create Campaign & Get Shareable Link      ] │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  By creating this campaign, you agree to our               │
│  Terms of Service and Ad Campaign Terms.                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**"Adjust radius" dropdown options:**
- 1 mile (local neighborhood)
- 2 miles (recommended) ← shown if calculated is ~2
- 3 miles (wider search)
- 5 miles (expanded search)
- Custom: [____] miles

**Validation:**
- Checkbox must be checked
- Radius must be 0.5 - 10 miles
- Duration must be selected (default: 5 days)

**On Submit:**
1. Create AdFund record with status: RAISING
2. Record consent timestamp + IP
3. Calculate reach estimates (show loading state)
4. Navigate to fund page

**Error states:**
- Network error: "Something went wrong. Please try again."
- Case not active: "This case is no longer active."
- Fund already exists: Redirect to existing fund page

---

### Screen 3: The Fund Page (Shareable)

**URL:** `/case/[caseId]/adfund` (public, shareable)

This is the page Sarah shares with friends and family. It must be:
- Mobile-first (most shares happen via text/social)
- Emotionally compelling
- Dead simple to contribute
- Trustworthy (show where money goes)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │                    [MAX'S PHOTO]                    │   │
│  │                    (full width)                     │   │
│  │                                                      │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🔴 MISSING                                                 │
│                                                             │
│  Help bring MAX home                                        │
│                                                             │
│  Max, a 3-year-old Golden Retriever, has been missing      │
│  from Oak Park, IL since December 28, 2024 at 2:30 PM.     │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📢 AD CAMPAIGN                                             │
│                                                             │
│  We're raising money to show Max's photo to thousands      │
│  of people on Facebook, Instagram, YouTube, and Gmail      │
│  in the Oak Park area.                                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  ████████████████████░░░░░░░░░░  $32 of $50 goal   │   │
│  │                                                      │   │
│  │  64% funded • 4 contributors                        │   │
│  │                                                      │   │
│  │  🟢 $20 minimum reached - Ads launching!            │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  [    💳 Contribute to Help Find Max    ]           │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  👥 CONTRIBUTORS                                            │
│                                                             │
│  Sarah M. (Max's owner)               $20                  │
│  "Please help me find my best friend"                      │
│                                                             │
│  Jennifer L.                          $5                   │
│  "Hoping Max comes home soon! 🐕"                          │
│                                                             │
│  Anonymous                            $5                   │
│                                                             │
│  Mike T.                              $2                   │
│  "Shared on my Facebook too!"                              │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📊 WHERE THE MONEY GOES                                    │
│                                                             │
│  ├── 85% ($27.20) → Facebook, Instagram, YouTube ads      │
│  ├── 15% ($4.80) → ReunitePets platform                   │
│  └── Processing fees paid by contributors                  │
│                                                             │
│  Estimated reach: ~2,200 people in Oak Park area          │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📤 SHARE THIS CAMPAIGN                                     │
│                                                             │
│  The more people who see this, the better chance          │
│  of finding Max.                                           │
│                                                             │
│  [Facebook] [Twitter] [Copy Link] [Text Message]          │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  ℹ️ About ReunitePets                                       │
│                                                             │
│  ReunitePets.org is a nonprofit platform dedicated to     │
│  reuniting lost pets with their families. We've helped    │
│  bring home over 10,000 pets.                             │
│                                                             │
│  Questions? help@reunitepets.org                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Progress bar states:**

State 1: RAISING (below minimum)
```
████░░░░░░░░░░░░░░░░░░░░░░░░░░  $8 of $20 minimum
40% to launch • 2 contributors
⏳ Ads will launch when $20 is raised
```

State 2: RAISING (at/above minimum, launching)
```
████████████████████░░░░░░░░░░  $32 of $50 goal
🟢 $20 minimum reached - Ads launching!
```

State 3: ACTIVE (ads running)
```
████████████████████░░░░░░░░░░  $32 raised
🟢 Ads are LIVE • Reaching people now
📊 1,247 people reached so far
```

State 4: COMPLETED
```
████████████████████████████████  $32 raised
✅ Campaign complete • 3,421 people reached
```

State 5: PET FOUND
```
🎉 MAX HAS BEEN FOUND!
Thank you to everyone who contributed and shared.
```

---

### Screen 4: Contribution Modal

When someone clicks "Contribute to Help Find Max":

```
┌─────────────────────────────────────────────────────────────┐
│                                                    [✕]      │
│                                                             │
│  💳 Contribute to Help Find Max                             │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  SELECT AMOUNT                                              │
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐            │
│  │   $5   │  │  $10   │  │  $25   │  │ Other  │            │
│  └────────┘  └────────┘  └────────┘  └────────┘            │
│                                                             │
│  [Other selected shows input: $ _______]                   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  YOUR INFORMATION                                           │
│                                                             │
│  Email *                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ jennifer@example.com                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Name (optional - shown to Max's owner)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Jennifer L.                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Message (optional)                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Hoping Max comes home soon! 🐕                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ☐ Make my contribution anonymous                          │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  PAYMENT                                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  [    Stripe Card Element    ]                      │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  SUMMARY                                                    │
│                                                             │
│  Contribution                              $10.00          │
│  Processing fee                            + $0.59         │
│  ──────────────────────────────────────────────────        │
│  Total                                     $10.59          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  [      Complete $10.59 Contribution      ]         │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🔒 Secure payment powered by Stripe                       │
│                                                             │
│  By contributing, you agree to the Terms of Service.       │
│  Contributions are non-refundable once ads have run,       │
│  but unused portions are refunded if the pet is found.     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Amount button behavior:**
- Click → selected (blue border)
- Other → reveals input field
- Minimum: $5 (show error if less: "Minimum contribution is $5")
- Maximum: $500 (show error if more: "Maximum single contribution is $500")

**Processing fee calculation:**
```
fee = (amount * 0.029) + 0.30
fee = Math.ceil(fee * 100) / 100  // Round up to nearest cent

Examples:
$5.00  → $0.45 fee → $5.45 total
$10.00 → $0.59 fee → $10.59 total
$25.00 → $1.03 fee → $26.03 total
$50.00 → $1.75 fee → $51.75 total
$100.00 → $3.20 fee → $103.20 total
```

**Validation:**
- Email: Required, valid format
- Name: Optional, max 50 chars
- Message: Optional, max 200 chars
- Amount: $5-500
- Card: Valid via Stripe

**Submit flow:**
1. Disable button, show spinner
2. Create PaymentIntent on server
3. Confirm with Stripe Elements (handles 3D Secure)
4. On success → show success state
5. On failure → show error, re-enable form

**Error messages:**
- Card declined: "Your card was declined. Please try a different card."
- Insufficient funds: "Insufficient funds. Please try a different card."
- 3DS failed: "Authentication failed. Please try again."
- Network error: "Connection error. Please check your internet and try again."
- Generic: "Something went wrong. Please try again."

---

### Screen 5: Contribution Success

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         ✅                                  │
│                                                             │
│  Thank you, Jennifer!                                       │
│                                                             │
│  Your $10 contribution is helping find Max.                │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  WHAT HAPPENS NEXT                                          │
│                                                             │
│  📧 You'll receive email updates when:                      │
│     • Ads go live                                          │
│     • There's a sighting of Max                            │
│     • Max is found                                         │
│                                                             │
│  💰 If Max is found and money remains unspent,             │
│     you'll receive a refund for your portion.              │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📤 HELP SPREAD THE WORD                                    │
│                                                             │
│  Sharing is free and just as important as contributing.   │
│                                                             │
│  [Facebook] [Twitter] [Copy Link] [Text]                   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  [      View Max's Campaign      ]                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Screen 6: Owner's Campaign Dashboard

**URL:** `/case/[caseId]/adfund/dashboard` (authenticated, owner only)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Max's Case                                       │
│                                                             │
│  📢 MAX'S AD CAMPAIGN                                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  🟢 ACTIVE - Day 2 of 5                             │   │
│  │                                                      │   │
│  │  Ads are running on Facebook, Instagram, YouTube,   │   │
│  │  and Gmail in the Oak Park area.                    │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📊 PERFORMANCE                                             │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   2,847     │  │    127      │  │     23      │         │
│  │  people     │  │   clicks    │  │   shares    │         │
│  │  reached    │  │  to case    │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  Last updated: 2 minutes ago                               │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  💰 BUDGET                                                  │
│                                                             │
│  Total raised                             $65.00           │
│  Platform fee (15%)                      −$9.75            │
│  Available for ads                        $55.25           │
│                                                             │
│  ├── Spent so far                         $28.40           │
│  └── Remaining                            $26.85           │
│                                                             │
│  Today's budget: $12.50 (Day 2 of 5)                       │
│                                                             │
│  [Show daily breakdown ▾]                                  │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📈 REACH OVER TIME                                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  [Line chart showing cumulative reach]              │   │
│  │                                              ●2,847 │   │
│  │                                         ●           │   │
│  │                                    ●                │   │
│  │                               ●                     │   │
│  │                          ●                          │   │
│  │                     ●                               │   │
│  │                ●                                    │   │
│  │  ●────────●                                         │   │
│  │  Day 1        Day 2                                 │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📱 PLATFORM BREAKDOWN                                      │
│                                                             │
│  Facebook/Instagram                                        │
│  ████████████████████░░░░░░  1,924 reached • $19.80 spent │
│                                                             │
│  YouTube/Gmail/Discover                                    │
│  ██████████░░░░░░░░░░░░░░░░    923 reached • $8.60 spent  │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  👥 CONTRIBUTORS (5)                                        │
│                                                             │
│  You                                      $25.00           │
│  Jennifer L.                              $15.00           │
│  Mom                                      $10.00           │
│  Mike T.                                  $10.00           │
│  Anonymous                                 $5.00           │
│                                                             │
│  [View all messages]                                       │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  🎯 ACTIONS                                                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [    ➕ Add More Funds    ]                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [    📤 Share Campaign    ]                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [    ⏸️ Pause Ads    ]                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [    🎉 Max Was Found! Stop Campaign    ]          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Daily breakdown (expanded):**
```
Day 1 (yesterday):  $16.50 budget • $16.48 spent • 1,247 reached
Day 2 (today):      $13.75 budget • $11.92 spent • 1,600 reached
Day 3 (tomorrow):   $11.00 budget
Day 4:               $8.25 budget
Day 5:               $5.50 budget
```

---

### Screen 7: "Pet Found" Confirmation

When owner clicks "Max Was Found! Stop Campaign":

```
┌─────────────────────────────────────────────────────────────┐
│                                                    [✕]      │
│                                                             │
│  🎉 Amazing news! Max was found!                           │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  WHAT HAPPENS NEXT                                          │
│                                                             │
│  1. We'll stop all ads immediately                         │
│                                                             │
│  2. We'll notify all contributors with the good news       │
│                                                             │
│  3. We'll refund unused funds to contributors:             │
│                                                             │
│     ┌───────────────────────────────────────────────┐      │
│     │                                                │      │
│     │  Total raised:                      $65.00    │      │
│     │  Already spent on ads:             −$28.40    │      │
│     │  Platform fee (15% of spent):       −$4.26    │      │
│     │  ─────────────────────────────────────────    │      │
│     │  To be refunded:                    $32.34    │      │
│     │                                                │      │
│     │  Refunds go to contributors in reverse       │      │
│     │  order (most recent first). Processing       │      │
│     │  takes 5-10 business days.                   │      │
│     │                                                │      │
│     └───────────────────────────────────────────────┘      │
│                                                             │
│  4. Max's case will be marked as REUNITED 🎉               │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📝 SHARE YOUR REUNION STORY (OPTIONAL)                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ How was Max found?                                   │   │
│  │                                                      │   │
│  │ A neighbor saw the Facebook ad and recognized Max   │   │
│  │ in their backyard! They called immediately.         │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [     Confirm: Max Was Found     ]                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ Cancel - Max is still missing ]                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Screen 8: Post-Reunion (Optional Tip)

After confirming pet found, show once (don't nag):

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         🎉                                  │
│                                                             │
│  MAX IS HOME!                                               │
│                                                             │
│  We're so happy Max is back with you, Sarah.               │
│                                                             │
│  Your campaign reached 2,847 people and had 23 shares.     │
│  This community helped bring Max home.                     │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  WOULD YOU LIKE TO SUPPORT REUNITEPETS?                    │
│                                                             │
│  ReunitePets is free for all pet owners. Tips from         │
│  happy families like yours help us stay that way.          │
│                                                             │
│  100% optional - no pressure at all.                       │
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │
│  │   $5   │  │  $10   │  │  $25   │  │ Other  │           │
│  └────────┘  └────────┘  └────────┘  └────────┘           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [     Leave a Tip for ReunitePets     ]            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ No thanks, just take me to Max's reunion page ]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Important UX rules:**
- Show this ONCE, immediately after confirming pet found
- If they click "No thanks", never show again for this user
- Don't send follow-up emails asking for tips
- Default to "No thanks" if they close the modal

---

## 1.2 The Contributor's Complete Journey

### Context: The Emotional State
Jennifer is Sarah's coworker. She got a text: "My dog Max is missing, can you help spread the word? [link]". Jennifer loves dogs. She has $10 she can spare. She wants to help.

### Mobile Experience (Most Common)

Jennifer opens the link on her iPhone. The page must:
- Load in under 2 seconds
- Be immediately understandable
- Have a prominent "Contribute" button visible without scrolling
- Work perfectly on a 375px wide screen

**Mobile fund page (above the fold):**

```
┌─────────────────────────┐
│                         │
│    [MAX'S PHOTO]        │
│    (full width)         │
│                         │
│  🔴 MISSING             │
│                         │
│  Help bring MAX home    │
│                         │
│  ████████████░░░░░░░░░  │
│  $32 of $50 • 4 people  │
│                         │
│  ┌─────────────────────┐│
│  │  💳 Contribute $10  ││
│  └─────────────────────┘│
│                         │
│  ↓ Scroll for details   │
│                         │
└─────────────────────────┘
```

**Key mobile optimizations:**
- Touch targets: Minimum 44x44px
- Buttons: Full width on mobile
- Forms: Large input fields, appropriate keyboard types
- 3D Secure: Works in-app browser and standalone

---

## 1.3 The Ad Viewer's Journey

### Context
Mike is scrolling Facebook on his lunch break. He lives in Oak Park. An ad appears in his feed with a photo of a golden retriever.

### What Mike Sees (Facebook Feed)

```
┌─────────────────────────────────────────────────────────────┐
│  ReunitePets.org                                    ...     │
│  Sponsored                                                  │
│                                                             │
│  🔴 MISSING in Oak Park                                     │
│                                                             │
│  MAX has been missing since yesterday afternoon.           │
│  Last seen near Oak Park Ave & Lake St.                    │
│                                                             │
│  Please SHARE this post - someone in our community         │
│  may have seen Max. Every share helps.                     │
│                                                             │
│  See details and join the search →                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │                                                      │   │
│  │               [MAX'S PHOTO]                         │   │
│  │               Large, eye-catching                   │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ 🔴 MISSING                                    │  │   │
│  │  │ MAX • Golden Retriever                       │  │   │
│  │  │ Oak Park, IL • Since Dec 28                  │  │   │
│  │  │                                               │  │   │
│  │  │ reunitepets.org                              │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐                                          │
│  │  Learn More  │                                          │
│  └──────────────┘                                          │
│                                                             │
│  👍 Like    💬 Comment    ↗️ Share                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Image overlay specifications:**
```
┌────────────────────────────────────┐
│                                    │
│  🔴 MISSING        [TOP LEFT]      │
│                                    │
│                                    │
│       [PET PHOTO]                  │
│       (80% of image height)        │
│                                    │
│                                    │
│                                    │
├────────────────────────────────────┤
│ MAX • Golden Retriever             │  ← White text
│ Oak Park, IL • Since Dec 28        │  ← Gray text
│                              logo  │  ← ReunitePets logo
└────────────────────────────────────┘
     ↑ Semi-transparent black bar (rgba(0,0,0,0.7))
```

### Click Destination

Mike clicks "Learn More" and lands on the case page:
`https://reunitepets.org/case/max-12345`

The case page shows:
- Full pet details
- Map of last seen location
- "I've Seen This Pet" button
- "Join the Search" button
- "Share" buttons
- If ad campaign exists: link to contribute

**UTM tracking for ads:**
```
?utm_source=meta&utm_medium=paid&utm_campaign=adfund-{fundId}&utm_content={adId}
```

---

# Part 2: Complete Data Model

## 2.1 Enum Definitions

```prisma
enum AdFundStatus {
  DRAFT             // Created but owner hasn't confirmed (not used in MVP)
  RAISING           // Accepting contributions, below minimum
  FUNDED            // Reached minimum, ready to launch
  LAUNCHING         // Ads being created (in progress)
  ACTIVE            // Ads running
  PAUSED            // Owner paused
  STOPPING          // Pet found, stopping ads
  COMPLETED         // Budget exhausted or time ended
  REFUNDING         // Processing refunds
  REFUNDED          // All refunds complete
  CANCELLED         // Cancelled before launch
  FAILED            // Failed to launch (platform error)
}

enum ContributionStatus {
  PENDING           // PaymentIntent created, awaiting confirmation
  PROCESSING        // 3D Secure in progress
  SUCCEEDED         // Payment confirmed
  FAILED            // Payment failed
  REFUNDED          // Fully refunded
  PARTIALLY_REFUNDED // Partially refunded (some was spent)
}

enum CampaignStatus {
  PENDING           // Waiting to launch
  CREATING_META     // Creating Meta campaign
  CREATING_GOOGLE   // Creating Google campaign
  LEARNING          // In learning phase
  ACTIVE            // Running normally
  PAUSED            // Temporarily paused
  STOPPING          // Being stopped
  COMPLETED         // Finished
  FAILED            // Platform error
}

enum RefundStatus {
  PENDING           // Queued for processing
  PROCESSING        // Stripe refund initiated
  SUCCEEDED         // Refund complete
  FAILED            // Refund failed (will retry)
}

enum Platform {
  META              // Facebook + Instagram
  GOOGLE            // YouTube + Gmail + Discover
}
```

## 2.2 Complete Model Definitions

```prisma
model AdFund {
  id                    String          @id @default(cuid())

  // === CASE RELATIONSHIP ===
  caseId                String          @unique
  case                  Case            @relation(fields: [caseId], references: [id], onDelete: Cascade)

  // === STATUS ===
  status                AdFundStatus    @default(RAISING)
  statusMessage         String?         // Human-readable status detail

  // === FUNDING THRESHOLDS (cents) ===
  minimumAmount         Int             @default(2000)  // $20 - triggers launch
  goalAmount            Int?            // Optional stretch goal for display

  // === MONEY TRACKING (all cents) ===
  // Contributions
  totalContributed      Int             @default(0)     // Sum of contribution amounts (excl. fees)
  totalProcessingFees   Int             @default(0)     // Sum of Stripe fees paid by contributors
  contributorCount      Int             @default(0)     // Count of successful contributions

  // Ad Spend
  totalAdBudget         Int             @default(0)     // totalContributed (what goes to ads + our fee)
  platformFeeAmount     Int             @default(0)     // 15% of what's SPENT (not raised)
  totalAdSpend          Int             @default(0)     // Actual spend on platforms

  // Refunds
  totalRefunded         Int             @default(0)     // Total refunded to contributors

  // === CAMPAIGN SETTINGS ===
  durationDays          Int             @default(5)     // 3, 5, or 7
  platformSplit         Json            // { "meta": 70, "google": 30 }

  // === TARGETING ===
  targetLatitude        Float
  targetLongitude       Float
  searchRadiusMiles     Float
  radiusCalculation     Json            // Full breakdown for transparency

  // === REACH ESTIMATES ===
  estimatedReach        Json?           // { "meta": 2100, "google": 900, "total": 3000 }
  reachLastUpdated      DateTime?

  // === CONSENT ===
  consentGiven          Boolean         @default(false)
  consentTimestamp      DateTime?
  consentIp             String?
  consentUserAgent      String?
  termsVersion          String          @default("2024-12-01")

  // === TIMESTAMPS ===
  createdAt             DateTime        @default(now())
  fundedAt              DateTime?       // When minimum was reached
  launchedAt            DateTime?       // When ads went live
  scheduledEndAt        DateTime?       // When campaign should end
  actualEndAt           DateTime?       // When it actually ended
  pausedAt              DateTime?
  cancelledAt           DateTime?

  // === ERROR TRACKING ===
  lastError             String?
  lastErrorAt           DateTime?
  errorCount            Int             @default(0)

  // === RELATIONS ===
  contributions         AdFundContribution[]
  campaign              AdCampaign?
  refunds               AdFundRefund[]
  notifications         AdFundNotification[]

  // === INDEXES ===
  @@index([caseId])
  @@index([status])
  @@index([createdAt])
  @@index([status, createdAt])
}

model AdFundContribution {
  id                    String              @id @default(cuid())

  // === FUND RELATIONSHIP ===
  fundId                String
  fund                  AdFund              @relation(fields: [fundId], references: [id], onDelete: Cascade)

  // === CONTRIBUTOR INFO ===
  email                 String
  name                  String?
  message               String?             @db.Text
  isAnonymous           Boolean             @default(false)
  isOwner               Boolean             @default(false)

  // === ORDERING (for LIFO refunds) ===
  sequence              Int                 // 1, 2, 3... in order received

  // === AMOUNTS (cents) ===
  amount                Int                 // What they wanted to give (e.g., 1000 = $10)
  processingFee         Int                 // Stripe fee (e.g., 59 = $0.59)
  totalCharged          Int                 // amount + processingFee (e.g., 1059 = $10.59)

  // === STRIPE ===
  stripePaymentIntentId String              @unique
  stripeChargeId        String?
  stripeCustomerId      String?             // If we create/reuse customer
  paymentMethod         String?             // "card", "apple_pay", etc.
  cardBrand             String?             // "visa", "mastercard", etc.
  cardLast4             String?             // "4242"

  // === STATUS ===
  status                ContributionStatus  @default(PENDING)
  failureReason         String?

  // === SPEND TRACKING (for partial refunds) ===
  amountAllocated       Int                 @default(0)  // How much allocated to ads
  amountSpent           Int                 @default(0)  // How much actually spent
  amountRefunded        Int                 @default(0)  // How much refunded

  // === TIMESTAMPS ===
  createdAt             DateTime            @default(now())
  succeededAt           DateTime?
  failedAt              DateTime?

  // === RELATIONS ===
  refunds               AdFundRefund[]

  // === INDEXES ===
  @@index([fundId])
  @@index([fundId, sequence])
  @@index([stripePaymentIntentId])
  @@index([email])
  @@index([status])
}

model AdCampaign {
  id                    String          @id @default(cuid())

  // === FUND RELATIONSHIP ===
  fundId                String          @unique
  fund                  AdFund          @relation(fields: [fundId], references: [id], onDelete: Cascade)

  // === STATUS ===
  status                CampaignStatus  @default(PENDING)

  // === BUDGET ALLOCATION (cents) ===
  totalBudget           Int             // From fund (totalContributed)
  platformFeeReserved   Int             // 15% reserved for us (calculated on spend)
  adBudget              Int             // 85% for ads

  metaBudget            Int             // meta% of adBudget
  googleBudget          Int             // google% of adBudget

  // === DAILY BUDGETS ===
  // Declining: Day 1=30%, Day 2=25%, Day 3=20%, Day 4=15%, Day 5=10%
  dailyBudgetSchedule   Json            // [{ day: 1, date: "2024-12-28", meta: 850, google: 365 }, ...]
  currentDay            Int             @default(0)  // 0 = not started, 1-7 = running

  // === META CAMPAIGN ===
  metaCampaignId        String?
  metaAdSetId           String?
  metaAdId              String?
  metaStatus            String?         // "ACTIVE", "PAUSED", "PENDING_REVIEW", etc.
  metaCreativeUrl       String?         // CDN URL of processed image

  // === GOOGLE CAMPAIGN ===
  googleCampaignId      String?
  googleAdGroupId       String?
  googleAdId            String?
  googleAssetId         String?         // Uploaded image asset
  googleStatus          String?
  googleCreativeUrl     String?

  // === REAL-TIME METRICS ===
  // Meta
  metaReach             Int             @default(0)
  metaImpressions       Int             @default(0)
  metaClicks            Int             @default(0)
  metaSpend             Int             @default(0)  // cents, from API
  metaShares            Int             @default(0)
  metaComments          Int             @default(0)
  metaReactions         Int             @default(0)
  metaFrequency         Float           @default(0)  // avg times shown per person

  // Google
  googleReach           Int             @default(0)
  googleImpressions     Int             @default(0)
  googleClicks          Int             @default(0)
  googleSpend           Int             @default(0)  // cents
  googleVideoViews      Int             @default(0)

  // Combined (calculated)
  totalReach            Int             @default(0)
  totalSpend            Int             @default(0)

  // === METRICS HISTORY (for charts) ===
  metricsHistory        Json?           // [{ ts: "...", metaReach: X, googleReach: Y, ... }, ...]
  lastMetricsSync       DateTime?

  // === TIMESTAMPS ===
  createdAt             DateTime        @default(now())
  launchedAt            DateTime?
  pausedAt              DateTime?
  stoppedAt             DateTime?
  completedAt           DateTime?

  // === ERROR TRACKING ===
  lastError             String?
  lastErrorAt           DateTime?

  // === INDEXES ===
  @@index([fundId])
  @@index([status])
  @@index([metaCampaignId])
  @@index([googleCampaignId])
}

model AdFundRefund {
  id                    String          @id @default(cuid())

  // === RELATIONSHIPS ===
  fundId                String
  fund                  AdFund          @relation(fields: [fundId], references: [id], onDelete: Cascade)
  contributionId        String
  contribution          AdFundContribution @relation(fields: [contributionId], references: [id])

  // === AMOUNTS (cents) ===
  amount                Int             // Amount to refund

  // === STRIPE ===
  stripeRefundId        String?         @unique
  stripeStatus          String?         // "pending", "succeeded", "failed"

  // === STATUS ===
  status                RefundStatus    @default(PENDING)
  reason                String          // "pet_found", "campaign_cancelled", "overage", etc.
  failureReason         String?

  // === TIMESTAMPS ===
  createdAt             DateTime        @default(now())
  processedAt           DateTime?
  failedAt              DateTime?

  // === RETRY TRACKING ===
  retryCount            Int             @default(0)
  nextRetryAt           DateTime?

  // === INDEXES ===
  @@index([fundId])
  @@index([contributionId])
  @@index([status])
  @@index([status, nextRetryAt])
}

model AdFundNotification {
  id                    String          @id @default(cuid())

  // === RELATIONSHIPS ===
  fundId                String
  fund                  AdFund          @relation(fields: [fundId], references: [id], onDelete: Cascade)

  // === RECIPIENT ===
  recipientEmail        String
  recipientType         String          // "owner", "contributor"

  // === NOTIFICATION TYPE ===
  type                  String          // See notification types below

  // === DELIVERY ===
  channel               String          // "email", "push", "sms"
  status                String          @default("pending")  // "pending", "sent", "delivered", "failed"

  // === CONTENT ===
  subject               String?
  body                  String?         @db.Text
  metadata              Json?           // Additional data for template

  // === TIMESTAMPS ===
  createdAt             DateTime        @default(now())
  sentAt                DateTime?
  deliveredAt           DateTime?
  openedAt              DateTime?
  clickedAt             DateTime?

  // === EXTERNAL IDS ===
  externalId            String?         // Resend message ID, etc.

  // === INDEXES ===
  @@index([fundId])
  @@index([recipientEmail])
  @@index([type])
  @@index([status])
}
```

---

# Part 3: Business Logic Specifications

## 3.1 Fee Calculations

### Processing Fee (Stripe)
```typescript
function calculateProcessingFee(amountCents: number): number {
  // Stripe: 2.9% + $0.30
  // With Chargeback Protection: +0.4%
  // Total: 3.3% + $0.30

  const percentageFee = Math.ceil(amountCents * 0.033);
  const fixedFee = 30; // 30 cents

  return percentageFee + fixedFee;
}

// Examples:
// $5.00 (500 cents) → 17 + 30 = 47 cents ($0.47) → Total: $5.47
// $10.00 (1000 cents) → 33 + 30 = 63 cents ($0.63) → Total: $10.63
// $25.00 (2500 cents) → 83 + 30 = 113 cents ($1.13) → Total: $26.13
// $50.00 (5000 cents) → 165 + 30 = 195 cents ($1.95) → Total: $51.95
// $100.00 (10000 cents) → 330 + 30 = 360 cents ($3.60) → Total: $103.60
```

### Platform Fee (Our Revenue)
```typescript
function calculatePlatformFee(amountSpentCents: number): number {
  // 15% of amount actually SPENT on ads
  return Math.floor(amountSpentCents * 0.15);
}

// Examples (on spend, not on raised):
// $20 spent → $3.00 platform fee
// $50 spent → $7.50 platform fee
// $100 spent → $15.00 platform fee
```

### Budget Allocation
```typescript
interface BudgetAllocation {
  totalContributed: number;    // What contributors gave (excl. processing fees)
  platformFee: number;         // 15% (calculated on spend, reserved)
  adBudget: number;            // 85%
  metaBudget: number;          // 70% of adBudget
  googleBudget: number;        // 30% of adBudget
}

function allocateBudget(totalContributedCents: number, platformSplit: { meta: number; google: number }): BudgetAllocation {
  const platformFee = Math.floor(totalContributedCents * 0.15);
  const adBudget = totalContributedCents - platformFee;

  const metaBudget = Math.floor(adBudget * (platformSplit.meta / 100));
  const googleBudget = adBudget - metaBudget; // Remainder to avoid rounding issues

  return {
    totalContributed: totalContributedCents,
    platformFee,
    adBudget,
    metaBudget,
    googleBudget,
  };
}

// Example: $50.00 raised, 70/30 split
// platformFee: $7.50 (750 cents)
// adBudget: $42.50 (4250 cents)
// metaBudget: $29.75 (2975 cents)
// googleBudget: $12.75 (1275 cents)
```

### Daily Budget Schedule (Declining)
```typescript
const DAILY_PERCENTAGES = {
  3: [40, 35, 25],                    // 3-day campaign
  5: [30, 25, 20, 15, 10],            // 5-day campaign
  7: [25, 20, 17, 14, 11, 8, 5],      // 7-day campaign
};

interface DailyBudget {
  day: number;
  date: string;          // ISO date
  metaBudget: number;    // cents
  googleBudget: number;  // cents
  totalBudget: number;   // cents
  percentOfTotal: number;
}

function calculateDailyBudgets(
  metaBudget: number,
  googleBudget: number,
  durationDays: 3 | 5 | 7,
  startDate: Date
): DailyBudget[] {
  const percentages = DAILY_PERCENTAGES[durationDays];
  const budgets: DailyBudget[] = [];

  let remainingMeta = metaBudget;
  let remainingGoogle = googleBudget;

  for (let i = 0; i < durationDays; i++) {
    const percent = percentages[i];
    const isLastDay = i === durationDays - 1;

    // On last day, use remaining to avoid rounding errors
    const dayMeta = isLastDay ? remainingMeta : Math.floor(metaBudget * (percent / 100));
    const dayGoogle = isLastDay ? remainingGoogle : Math.floor(googleBudget * (percent / 100));

    remainingMeta -= dayMeta;
    remainingGoogle -= dayGoogle;

    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    budgets.push({
      day: i + 1,
      date: date.toISOString().split('T')[0],
      metaBudget: dayMeta,
      googleBudget: dayGoogle,
      totalBudget: dayMeta + dayGoogle,
      percentOfTotal: percent,
    });
  }

  return budgets;
}

// Example: $42.50 ad budget (70/30 split), 5 days
// Meta: $29.75, Google: $12.75
//
// Day 1 (30%): Meta $8.93, Google $3.83 = $12.76
// Day 2 (25%): Meta $7.44, Google $3.19 = $10.63
// Day 3 (20%): Meta $5.95, Google $2.55 = $8.50
// Day 4 (15%): Meta $4.46, Google $1.91 = $6.37
// Day 5 (10%): Meta $2.97, Google $1.27 = $4.24 (adjusted for rounding)
```

---

## 3.2 Radius Calculation Algorithm

```typescript
interface RadiusInput {
  petType: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  petSize?: 'small' | 'medium' | 'large';
  breed?: string;
  hoursMissing: number;
  isIndoorOnly: boolean;
  areaType: 'urban' | 'suburban' | 'rural';
  hasCollar: boolean;
  isSkittish: boolean;
}

interface RadiusFactor {
  name: string;
  value: string;        // e.g., "+0.5 miles" or "+20%"
  isMultiplier: boolean;
  amount: number;       // The actual number
  description: string;
}

interface RadiusResult {
  radiusMiles: number;
  factors: RadiusFactor[];
  confidence: number;   // 0.9 = 90% likely within radius
  explanation: string;  // Human-readable
}

// Base radii by pet type (from lost pet research)
const BASE_RADIUS: Record<string, number> = {
  dog: 1.0,
  cat: 0.3,
  bird: 3.0,    // Can fly
  rabbit: 0.2,
  other: 0.5,
};

// Time factors: pets travel further over time
const TIME_FACTOR_PER_12_HOURS: Record<string, number> = {
  dog: 0.5,     // Dogs roam
  cat: 0.1,     // Cats hide nearby
  bird: 1.0,    // Birds can go far
  rabbit: 0.05, // Rabbits stay close
  other: 0.2,
};

// Maximum reasonable radius by type
const MAX_RADIUS: Record<string, number> = {
  dog: 10,
  cat: 2,
  bird: 20,
  rabbit: 1,
  other: 5,
};

function calculateSearchRadius(input: RadiusInput): RadiusResult {
  const factors: RadiusFactor[] = [];

  // Start with base radius
  let radius = BASE_RADIUS[input.petType] || 0.5;
  factors.push({
    name: 'Base radius',
    value: `${radius.toFixed(1)} miles`,
    isMultiplier: false,
    amount: radius,
    description: `Typical search radius for ${input.petType}s`,
  });

  // Add time factor
  const timePeriods = input.hoursMissing / 12;
  const timeAddition = timePeriods * (TIME_FACTOR_PER_12_HOURS[input.petType] || 0.2);
  if (timeAddition > 0) {
    radius += timeAddition;
    factors.push({
      name: 'Time missing',
      value: `+${timeAddition.toFixed(2)} miles`,
      isMultiplier: false,
      amount: timeAddition,
      description: `${input.hoursMissing} hours @ ${(TIME_FACTOR_PER_12_HOURS[input.petType] || 0.2).toFixed(1)} mi/12hr`,
    });
  }

  // Size multiplier (dogs only)
  if (input.petType === 'dog' && input.petSize) {
    let sizeMultiplier = 1;
    if (input.petSize === 'large') {
      sizeMultiplier = 1.2;
      factors.push({
        name: 'Large breed',
        value: '+20%',
        isMultiplier: true,
        amount: 0.2,
        description: 'Large dogs travel further',
      });
    } else if (input.petSize === 'small') {
      sizeMultiplier = 0.85;
      factors.push({
        name: 'Small breed',
        value: '−15%',
        isMultiplier: true,
        amount: -0.15,
        description: 'Small dogs stay closer',
      });
    }
    radius *= sizeMultiplier;
  }

  // Indoor-only pets hide nearby
  if (input.isIndoorOnly) {
    radius *= 0.6;
    factors.push({
      name: 'Indoor-only pet',
      value: '−40%',
      isMultiplier: true,
      amount: -0.4,
      description: 'Indoor pets tend to hide nearby when scared',
    });
  }

  // Area type
  if (input.areaType === 'urban') {
    radius *= 0.8;
    factors.push({
      name: 'Urban area',
      value: '−20%',
      isMultiplier: true,
      amount: -0.2,
      description: 'Buildings and traffic limit movement',
    });
  } else if (input.areaType === 'rural') {
    radius *= 1.4;
    factors.push({
      name: 'Rural area',
      value: '+40%',
      isMultiplier: true,
      amount: 0.4,
      description: 'Open space allows further travel',
    });
  }

  // Skittish pets may run further
  if (input.isSkittish) {
    radius *= 1.25;
    factors.push({
      name: 'Skittish temperament',
      value: '+25%',
      isMultiplier: true,
      amount: 0.25,
      description: 'Nervous pets may run further when scared',
    });
  }

  // Apply max radius
  const maxRadius = MAX_RADIUS[input.petType] || 5;
  if (radius > maxRadius) {
    radius = maxRadius;
    factors.push({
      name: 'Maximum cap',
      value: `${maxRadius} miles`,
      isMultiplier: false,
      amount: 0,
      description: `Capped at reasonable maximum for ${input.petType}s`,
    });
  }

  // Round to 1 decimal
  radius = Math.round(radius * 10) / 10;

  // Confidence (decreases with time)
  let confidence = 0.9;
  if (input.hoursMissing > 24) confidence = 0.85;
  if (input.hoursMissing > 48) confidence = 0.8;
  if (input.hoursMissing > 72) confidence = 0.7;

  return {
    radiusMiles: radius,
    factors,
    confidence,
    explanation: `Based on ${input.petType} behavior patterns, ${input.hoursMissing} hours missing, and ${input.areaType} environment, there's a ${Math.round(confidence * 100)}% probability your pet is within ${radius} miles.`,
  };
}
```

---

## 3.3 LIFO Refund Calculation

```typescript
interface RefundCalculation {
  totalRaised: number;
  totalSpent: number;
  platformFee: number;
  totalToRefund: number;
  refundBreakdown: RefundItem[];
}

interface RefundItem {
  contributionId: string;
  contributorEmail: string;
  contributorName: string | null;
  originalAmount: number;
  amountSpent: number;
  amountToRefund: number;
  sequence: number;
}

function calculateRefunds(
  contributions: Array<{
    id: string;
    email: string;
    name: string | null;
    amount: number;       // cents
    sequence: number;
  }>,
  totalSpentOnAds: number  // cents
): RefundCalculation {
  // Sort by sequence DESC (last in, first out)
  const sorted = [...contributions].sort((a, b) => b.sequence - a.sequence);

  const totalRaised = contributions.reduce((sum, c) => sum + c.amount, 0);
  const platformFee = Math.floor(totalSpentOnAds * 0.15);
  const totalUsed = totalSpentOnAds + platformFee;
  let remainingToSpend = totalUsed;
  let totalToRefund = 0;

  const refundBreakdown: RefundItem[] = [];

  // Allocate spending from oldest to newest (FIFO for spending)
  // Then refund from newest to oldest (LIFO for refunds)

  // First pass: calculate how much of each contribution was used
  // Spending happens in order received (sequence ASC)
  const spendingOrder = [...contributions].sort((a, b) => a.sequence - b.sequence);
  let spentSoFar = 0;
  const spentByContribution: Map<string, number> = new Map();

  for (const contrib of spendingOrder) {
    if (spentSoFar >= totalUsed) {
      // This contribution wasn't touched
      spentByContribution.set(contrib.id, 0);
    } else if (spentSoFar + contrib.amount <= totalUsed) {
      // This contribution was fully used
      spentByContribution.set(contrib.id, contrib.amount);
      spentSoFar += contrib.amount;
    } else {
      // This contribution was partially used
      const partialSpend = totalUsed - spentSoFar;
      spentByContribution.set(contrib.id, partialSpend);
      spentSoFar += partialSpend;
    }
  }

  // Build refund breakdown
  for (const contrib of sorted) {
    const amountSpent = spentByContribution.get(contrib.id) || 0;
    const amountToRefund = contrib.amount - amountSpent;

    refundBreakdown.push({
      contributionId: contrib.id,
      contributorEmail: contrib.email,
      contributorName: contrib.name,
      originalAmount: contrib.amount,
      amountSpent,
      amountToRefund,
      sequence: contrib.sequence,
    });

    totalToRefund += amountToRefund;
  }

  return {
    totalRaised,
    totalSpent: totalSpentOnAds,
    platformFee,
    totalToRefund,
    refundBreakdown,
  };
}

// Example:
// Contributions:
//   1. Sarah (owner): $25 (sequence 1)
//   2. Jennifer: $15 (sequence 2)
//   3. Mike: $15 (sequence 3)
//   4. Mom: $10 (sequence 4)
//   Total: $65
//
// Pet found after $30 spent on ads
// Platform fee: $30 * 15% = $4.50
// Total used: $34.50
//
// Spending allocation (FIFO - oldest first):
//   Sarah: $25 used (fully used)
//   Jennifer: $9.50 used (partially used, $5.50 remains)
//   Mike: $0 used
//   Mom: $0 used
//
// Refunds (LIFO - newest first):
//   Mom: $10 refund (nothing was used)
//   Mike: $15 refund (nothing was used)
//   Jennifer: $5.50 refund (partial)
//   Sarah: $0 refund (fully used)
//
// Total refunds: $30.50
// We keep: $4.50 (platform fee)
// Total: $30 + $4.50 + $30.50 = $65 ✓
```

---

## 3.4 State Machine: AdFund Lifecycle

```
                                    ┌─────────────┐
                                    │   DRAFT     │  (reserved for future)
                                    └──────┬──────┘
                                           │ owner confirms
                                           ▼
┌─────────────┐                     ┌─────────────┐
│  CANCELLED  │◄────────────────────│   RAISING   │
└─────────────┘   owner cancels     └──────┬──────┘
                  before minimum           │ minimum reached
                                           ▼
┌─────────────┐                     ┌─────────────┐
│   FAILED    │◄────────────────────│   FUNDED    │
└─────────────┘   platform error    └──────┬──────┘
      │                                    │ auto-launch
      │ retry                              ▼
      └─────────────────────────────►┌─────────────┐
                                     │  LAUNCHING  │
                                     └──────┬──────┘
                                            │ ads created
                                            ▼
                                     ┌─────────────┐◄────┐
                            ┌───────►│   ACTIVE    │     │
                            │        └──────┬──────┘     │
                            │               │            │
                     resume │               │ pause      │ resume
                            │               ▼            │
                            │        ┌─────────────┐     │
                            └────────│   PAUSED    │─────┘
                                     └──────┬──────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        │                                   │                                   │
        │ budget exhausted                  │ pet found                         │ time ended
        │ or time ended                     │                                   │
        ▼                                   ▼                                   ▼
 ┌─────────────┐                     ┌─────────────┐                     ┌─────────────┐
 │  COMPLETED  │                     │  STOPPING   │                     │  COMPLETED  │
 └─────────────┘                     └──────┬──────┘                     └─────────────┘
                                            │ ads stopped
                                            ▼
                                     ┌─────────────┐
                                     │  REFUNDING  │
                                     └──────┬──────┘
                                            │ all refunds processed
                                            ▼
                                     ┌─────────────┐
                                     │  REFUNDED   │
                                     └─────────────┘
```

**State Transitions:**

| From | To | Trigger | Actions |
|------|----|---------|---------|
| RAISING | FUNDED | totalContributed >= minimumAmount | Set fundedAt, trigger launch |
| RAISING | CANCELLED | Owner clicks cancel | Refund all contributions |
| FUNDED | LAUNCHING | Automatic | Create campaigns on platforms |
| LAUNCHING | ACTIVE | Both platforms confirm | Set launchedAt, notify contributors |
| LAUNCHING | FAILED | Platform error | Set lastError, notify owner |
| FAILED | LAUNCHING | Retry (manual or auto) | Retry campaign creation |
| ACTIVE | PAUSED | Owner clicks pause | Pause campaigns on platforms |
| PAUSED | ACTIVE | Owner clicks resume | Resume campaigns on platforms |
| ACTIVE | STOPPING | Owner marks pet found | Stop campaigns, fetch final metrics |
| ACTIVE | COMPLETED | Budget exhausted or scheduledEndAt | Fetch final metrics, notify all |
| PAUSED | STOPPING | Owner marks pet found | Stop campaigns, fetch final metrics |
| STOPPING | REFUNDING | Campaigns stopped | Calculate refunds, start processing |
| REFUNDING | REFUNDED | All refunds succeeded | Update case status to REUNITED |

---

# Part 4: API Specifications

## 4.1 Create AdFund

**Endpoint:** `POST /api/adfund`

**Authentication:** Required (owner of case)

**Request:**
```typescript
interface CreateAdFundRequest {
  caseId: string;
  durationDays: 3 | 5 | 7;
  radiusMiles?: number;     // Override calculated radius
  platformSplit?: {
    meta: number;           // 0-100, default 70
    google: number;         // 0-100, default 30
  };
}
```

**Response:**
```typescript
interface CreateAdFundResponse {
  success: true;
  fund: {
    id: string;
    caseId: string;
    status: 'RAISING';
    minimumAmount: number;
    goalAmount: number | null;
    totalContributed: number;
    contributorCount: number;
    durationDays: number;
    targetLatitude: number;
    targetLongitude: number;
    searchRadiusMiles: number;
    radiusCalculation: RadiusFactor[];
    estimatedReach: {
      meta: number;
      google: number;
      total: number;
    };
    createdAt: string;
  };
  shareUrl: string;
}
```

**Error Responses:**
```typescript
// 400: Bad Request
{ error: "CASE_NOT_FOUND", message: "Case not found" }
{ error: "CASE_NOT_ACTIVE", message: "Case must be active to create an ad fund" }
{ error: "FUND_EXISTS", message: "An ad fund already exists for this case" }
{ error: "INVALID_DURATION", message: "Duration must be 3, 5, or 7 days" }

// 401: Unauthorized
{ error: "UNAUTHORIZED", message: "You must be logged in" }

// 403: Forbidden
{ error: "NOT_OWNER", message: "Only the case owner can create an ad fund" }

// 500: Server Error
{ error: "REACH_ESTIMATE_FAILED", message: "Failed to get reach estimates. Please try again." }
```

---

## 4.2 Record Consent

**Endpoint:** `POST /api/adfund/[fundId]/consent`

**Authentication:** Required (owner of case)

**Request:**
```typescript
interface RecordConsentRequest {
  termsVersion: string;     // "2024-12-01"
  acceptedTerms: boolean;   // Must be true
}
```

**Server captures:**
- IP address from request headers
- User agent from request headers
- Timestamp

**Response:**
```typescript
interface RecordConsentResponse {
  success: true;
  fund: {
    id: string;
    consentGiven: true;
    consentTimestamp: string;
  };
}
```

---

## 4.3 Create Contribution

**Endpoint:** `POST /api/adfund/[fundId]/contribute`

**Authentication:** Not required (public)

**Request:**
```typescript
interface CreateContributionRequest {
  amount: number;           // Cents, min 500 ($5), max 50000 ($500)
  email: string;
  name?: string;            // Max 50 chars
  message?: string;         // Max 200 chars
  isAnonymous?: boolean;    // Default false
  isOwner?: boolean;        // True if logged in owner
}
```

**Response:**
```typescript
interface CreateContributionResponse {
  success: true;
  contribution: {
    id: string;
    amount: number;
    processingFee: number;
    totalCharged: number;
    status: 'PENDING';
  };
  paymentIntent: {
    clientSecret: string;   // For Stripe Elements
  };
}
```

**Error Responses:**
```typescript
// 400: Bad Request
{ error: "FUND_NOT_FOUND", message: "Ad fund not found" }
{ error: "FUND_NOT_RAISING", message: "This fund is no longer accepting contributions" }
{ error: "AMOUNT_TOO_LOW", message: "Minimum contribution is $5" }
{ error: "AMOUNT_TOO_HIGH", message: "Maximum contribution is $500" }
{ error: "INVALID_EMAIL", message: "Please enter a valid email address" }

// 500: Server Error
{ error: "PAYMENT_FAILED", message: "Failed to create payment. Please try again." }
```

---

## 4.4 Confirm Contribution (Webhook)

**Endpoint:** `POST /api/webhooks/stripe`

**Authentication:** Stripe signature verification

**Event:** `payment_intent.succeeded`

**Actions:**
1. Verify webhook signature
2. Find contribution by stripePaymentIntentId
3. Update contribution:
   - status → SUCCEEDED
   - succeededAt → now
   - stripeChargeId from event
4. Update fund:
   - totalContributed += amount
   - contributorCount += 1
5. Check if totalContributed >= minimumAmount
   - If yes AND consentGiven → trigger launch
6. Send thank-you email to contributor
7. If launched → send "ads launching" email to all contributors

---

## 4.5 Get Fund Status

**Endpoint:** `GET /api/adfund/[fundId]`

**Authentication:** Not required (public)

**Response:**
```typescript
interface GetFundResponse {
  success: true;
  fund: {
    id: string;
    status: AdFundStatus;

    // Case info (for display)
    case: {
      id: string;
      petName: string;
      petType: string;
      petBreed: string;
      petPhotoUrl: string;
      lastSeenAddress: string;
      lastSeenAt: string;
    };

    // Funding
    minimumAmount: number;
    goalAmount: number | null;
    totalContributed: number;
    contributorCount: number;
    percentFunded: number;

    // Transparency
    budgetBreakdown: {
      totalContributed: number;
      platformFee: number;        // 15%
      adBudget: number;           // 85%
      metaBudget: number;
      googleBudget: number;
    };
    estimatedReach: {
      meta: number;
      google: number;
      total: number;
    };
    searchRadiusMiles: number;

    // Contributors (public info only)
    contributors: Array<{
      name: string | null;        // null if anonymous
      amount: number;
      message: string | null;
      createdAt: string;
    }>;

    // Campaign (if launched)
    campaign?: {
      status: CampaignStatus;
      currentDay: number;
      totalDays: number;
      metrics: {
        reach: number;
        clicks: number;
        shares: number;
      };
      amountSpent: number;
    };

    // Timestamps
    createdAt: string;
    launchedAt: string | null;
  };

  // Owner-only data (if authenticated as owner)
  ownerData?: {
    contributions: Array<{
      id: string;
      email: string;
      name: string | null;
      amount: number;
      message: string | null;
      status: ContributionStatus;
      createdAt: string;
    }>;
    campaign?: {
      metaReach: number;
      metaClicks: number;
      metaSpend: number;
      googleReach: number;
      googleClicks: number;
      googleSpend: number;
      metricsHistory: Array<MetricsSnapshot>;
    };
  };
}
```

---

## 4.6 Stop Campaign (Pet Found)

**Endpoint:** `POST /api/adfund/[fundId]/stop`

**Authentication:** Required (owner of case)

**Request:**
```typescript
interface StopCampaignRequest {
  reason: 'pet_found' | 'owner_request';
  reunionStory?: string;    // Optional, for pet_found
}
```

**Response:**
```typescript
interface StopCampaignResponse {
  success: true;
  fund: {
    id: string;
    status: 'STOPPING' | 'REFUNDING';
  };
  refundCalculation: {
    totalRaised: number;
    totalSpent: number;
    platformFee: number;
    totalToRefund: number;
    refundBreakdown: Array<{
      contributorName: string | null;
      originalAmount: number;
      amountToRefund: number;
    }>;
  };
  message: string;
}
```

**Actions:**
1. Verify owner
2. Update fund status → STOPPING
3. Stop Meta campaign (API call)
4. Stop Google campaign (API call)
5. Fetch final metrics from both platforms
6. Calculate refunds
7. Update fund status → REFUNDING
8. Queue refund jobs
9. If reason is 'pet_found':
   - Update case status → REUNITED
   - Store reunion story
10. Send notifications to all contributors

---

# Part 5: Email & Notification Specifications

## 5.1 Notification Types

| Type | Recipient | Trigger | Channel |
|------|-----------|---------|---------|
| `contribution_received` | Contributor | Payment succeeded | Email |
| `fund_launched` | All contributors | Ads go live | Email |
| `daily_update` | Owner | Each day of campaign | Email (optional) |
| `pet_found` | All contributors | Owner marks found | Email |
| `refund_processed` | Contributor | Refund succeeded | Email |
| `campaign_complete` | Owner + contributors | Budget/time ended | Email |

## 5.2 Email Templates

### Contribution Received

**Subject:** `Your contribution to help find Max`

**Body:**
```
Hi Jennifer,

Thank you for your $10 contribution to help find Max!

Your contribution will help show Max's photo to people on Facebook, Instagram, YouTube, and Gmail in the Oak Park area.

WHAT HAPPENS NEXT
• Ads will launch once $20 total is raised (currently at $32)
• You'll receive updates on the campaign's progress
• If Max is found before all funds are used, you'll receive a refund for your portion

You can view the campaign anytime:
https://reunitepets.org/case/max-12345/adfund

Thank you for helping bring Max home.

The ReunitePets Team

---

You received this email because you contributed to Max's ad campaign.
Unsubscribe: https://reunitepets.org/unsubscribe?token=xxx
```

### Ads Launched

**Subject:** `Max's ads are now live! 🎉`

**Body:**
```
Hi Jennifer,

Great news! Max's ad campaign is now live.

CAMPAIGN STATUS
• Ads are running on Facebook, Instagram, YouTube, and Gmail
• Targeting: 1.9 mile radius around Oak Park, IL
• Campaign length: 5 days

YOUR IMPACT
Thanks to you and 4 other contributors, Max's photo is being shown to thousands of people in the area.

Total raised: $65
Estimated reach: 3,200 people

You can track the campaign's progress:
https://reunitepets.org/case/max-12345/adfund

If you know anyone in the Oak Park area, please share Max's page:
https://reunitepets.org/case/max-12345

Thank you for helping,

The ReunitePets Team
```

### Pet Found!

**Subject:** `🎉 MAX HAS BEEN FOUND!`

**Body:**
```
Hi Jennifer,

AMAZING NEWS - Max has been found and is back home!

THE REUNION STORY
"A neighbor saw the Facebook ad and recognized Max in their backyard! They called immediately and Max was home within an hour."

YOUR CONTRIBUTION MADE A DIFFERENCE
The campaign reached 2,847 people and had 23 shares. Your contribution was part of the community effort that brought Max home.

REFUND INFORMATION
Since Max was found before all the ad budget was spent, you'll receive a refund of $8.50. This will appear on your card within 5-10 business days.

Campaign summary:
• Total raised: $65.00
• Amount spent on ads: $28.40
• Platform fee (15%): $4.26
• Total refunded: $32.34

Thank you for being part of this reunion.

With gratitude,

The ReunitePets Team
```

### Refund Processed

**Subject:** `Your refund of $8.50 has been processed`

**Body:**
```
Hi Jennifer,

Your refund of $8.50 from Max's ad campaign has been processed.

This refund is for the unused portion of your contribution after Max was found.

REFUND DETAILS
• Original contribution: $10.00
• Amount used for ads: $1.50
• Refund amount: $8.50
• Expected arrival: 5-10 business days

The refund will appear on the same card you used to contribute.

Thank you again for helping bring Max home!

The ReunitePets Team
```

---

# Part 6: Ad Creative Specifications

## 6.1 Image Generation Pipeline

```typescript
interface AdCreativeInput {
  petPhotoUrl: string;
  petName: string;
  petType: string;
  petBreed: string;
  lastSeenLocation: string;    // "Oak Park, IL"
  timeMissing: string;         // "Since Dec 28" or "Missing 6 hours"
  caseUrl: string;
}

interface GeneratedCreatives {
  square: string;      // 1080x1080 - Feed, Stories
  landscape: string;   // 1200x628 - Feed, Google
  portrait: string;    // 1080x1920 - Stories, Reels
}

async function generateAdCreatives(input: AdCreativeInput): Promise<GeneratedCreatives> {
  // 1. Download and validate pet photo
  const photo = await downloadImage(input.petPhotoUrl);
  validateImage(photo);  // Min 600x600, max 10MB, jpg/png

  // 2. Process for each format
  const square = await generateSquareCreative(photo, input);
  const landscape = await generateLandscapeCreative(photo, input);
  const portrait = await generatePortraitCreative(photo, input);

  // 3. Upload to CDN
  const urls = await uploadToCDN([square, landscape, portrait]);

  return {
    square: urls[0],
    landscape: urls[1],
    portrait: urls[2],
  };
}
```

## 6.2 Square Creative (1080x1080)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🔴 MISSING                                            │ │
│  │      ↑                                                │ │
│  │      Red circle (24px) + "MISSING" in white          │ │
│  │      Font: Inter Bold, 28px                          │ │
│  │      Position: 40px from top-left                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│                                                            │
│                                                            │
│                     [PET PHOTO]                            │
│                                                            │
│                  Scaled to fill top 75%                    │
│                  Object-fit: cover                         │
│                  Object-position: center                   │
│                                                            │
│                                                            │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │  ← Bottom 25%
│  MAX                                                       │  ← Inter Bold, 36px, white
│  Golden Retriever                                          │  ← Inter Regular, 24px, #E0E0E0
│                                                            │
│  Oak Park, IL • Since Dec 28                               │  ← Inter Regular, 20px, #A0A0A0
│                                                            │
│                                    reunitepets.org  [logo] │  ← Right-aligned, 18px
│                                                            │
└────────────────────────────────────────────────────────────┘

Background of bottom bar: Linear gradient
  from: rgba(0, 0, 0, 0.85)
  to: rgba(0, 0, 0, 0.95)
```

## 6.3 Meta Ad Copy

**Primary Text (appears above image):**
```
🔴 MISSING in {neighborhood}

{petName} the {breed} has been missing since {timeMissing}.

Last seen near {lastSeenLocation}.

Please SHARE this post - someone in our community may have seen {petName}. It only takes a second and could help bring {petName} home.

See full details and join the search: {caseUrl}

#MissingPet #{cityNoSpaces} #LostDog #ReunitePets
```

**Character limits:**
- Primary text: 125 chars (before "See more")
- Headline: 40 chars
- Description: 30 chars

**Headline:** `Help Find {petName}`

**Description:** `See details • Share • Join search`

**Call to Action:** `Learn More`

## 6.4 Google Demand Gen Creative

**Headlines (up to 5, max 40 chars each):**
```
1. Help Find {petName} 🔴
2. Missing {breed} - {city}
3. {petName} Needs Your Help
4. Lost Pet Alert: {city}
5. Have You Seen {petName}?
```

**Descriptions (up to 5, max 90 chars each):**
```
1. Last seen in {neighborhood}. Share to help bring {petName} home. Please help!
2. {petName} has been missing since {timeMissing}. Join the search mission.
3. Missing {breed} in {city}. Someone in your community may have seen {petName}.
4. Help reunite {petName} with their family. Share this with your neighbors.
5. {petName} was last seen near {lastSeenAddress}. Every share helps.
```

**Long Headline (max 90 chars):**
```
🔴 MISSING: {petName} the {breed} - Last Seen in {neighborhood}
```

---

# Part 7: Testing Strategy

## 7.1 Unit Tests

```typescript
// Fee calculations
describe('calculateProcessingFee', () => {
  test('$5 contribution = $0.47 fee', () => {
    expect(calculateProcessingFee(500)).toBe(47);
  });

  test('$10 contribution = $0.63 fee', () => {
    expect(calculateProcessingFee(1000)).toBe(63);
  });

  test('$100 contribution = $3.60 fee', () => {
    expect(calculateProcessingFee(10000)).toBe(360);
  });
});

// Radius calculation
describe('calculateSearchRadius', () => {
  test('dog missing 3 hours in suburban area', () => {
    const result = calculateSearchRadius({
      petType: 'dog',
      petSize: 'large',
      hoursMissing: 3,
      isIndoorOnly: false,
      areaType: 'suburban',
    });
    expect(result.radiusMiles).toBeCloseTo(1.2, 1);
    expect(result.confidence).toBe(0.9);
  });

  test('indoor cat missing 24 hours', () => {
    const result = calculateSearchRadius({
      petType: 'cat',
      hoursMissing: 24,
      isIndoorOnly: true,
      areaType: 'suburban',
    });
    expect(result.radiusMiles).toBeLessThan(0.5);
  });
});

// LIFO refund calculation
describe('calculateRefunds', () => {
  test('partial spend with 4 contributors', () => {
    const contributions = [
      { id: '1', email: 'a@a.com', name: 'A', amount: 2500, sequence: 1 },
      { id: '2', email: 'b@b.com', name: 'B', amount: 1500, sequence: 2 },
      { id: '3', email: 'c@c.com', name: 'C', amount: 1500, sequence: 3 },
      { id: '4', email: 'd@d.com', name: 'D', amount: 1000, sequence: 4 },
    ];

    const result = calculateRefunds(contributions, 3000); // $30 spent

    // Platform fee: $4.50, Total used: $34.50
    // Spending: A=$25 (full), B=$9.50 (partial), C=$0, D=$0
    // Refunds: D=$10, C=$15, B=$5.50, A=$0

    expect(result.platformFee).toBe(450);
    expect(result.totalToRefund).toBe(3050);
    expect(result.refundBreakdown[0].amountToRefund).toBe(1000); // D
    expect(result.refundBreakdown[1].amountToRefund).toBe(1500); // C
    expect(result.refundBreakdown[2].amountToRefund).toBe(550);  // B
    expect(result.refundBreakdown[3].amountToRefund).toBe(0);    // A
  });
});
```

## 7.2 Integration Tests

```typescript
describe('AdFund E2E Flow', () => {
  test('full flow: create → contribute → launch → stop → refund', async () => {
    // 1. Create fund
    const fund = await createAdFund({
      caseId: testCase.id,
      durationDays: 5,
    });
    expect(fund.status).toBe('RAISING');

    // 2. Record consent
    await recordConsent(fund.id, { termsVersion: '2024-12-01' });

    // 3. Contribute $25 (above minimum)
    const contribution = await createContribution(fund.id, {
      amount: 2500,
      email: 'test@test.com',
    });

    // 4. Simulate Stripe webhook
    await handleStripeWebhook({
      type: 'payment_intent.succeeded',
      data: { object: { id: contribution.stripePaymentIntentId } },
    });

    // 5. Verify fund launched
    const updatedFund = await getFund(fund.id);
    expect(updatedFund.status).toBe('ACTIVE');

    // 6. Stop campaign (pet found)
    await stopCampaign(fund.id, { reason: 'pet_found' });

    // 7. Verify refund processed
    const finalFund = await getFund(fund.id);
    expect(finalFund.status).toBe('REFUNDED');
  });
});
```

## 7.3 Meta/Google Sandbox Testing

**Meta:**
- Use Meta's Marketing API Sandbox mode
- Test with `access_token` from test app
- Ads won't actually run but API calls will succeed

**Google:**
- Use Google Ads API test account
- Set `login-customer-id` to test MCC
- Use `validate_only: true` for mutation requests

---

# Part 8: Monitoring & Alerts

## 8.1 Key Metrics to Track

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Campaign launch failure rate | > 5% | Page oncall |
| Refund failure rate | > 1% | Page oncall |
| Meta API errors | > 10/hour | Alert Slack |
| Google API errors | > 10/hour | Alert Slack |
| Stripe webhook failures | Any | Page oncall |
| Contribution success rate | < 95% | Alert Slack |
| Average time to launch | > 5 min | Investigate |

## 8.2 Logging

```typescript
// Structured logging for all ad fund operations
interface AdFundLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  fundId: string;
  caseId: string;

  // Context
  userId?: string;
  contributionId?: string;
  campaignId?: string;

  // Details
  amount?: number;
  status?: string;
  error?: string;
  duration?: number;

  // Platform-specific
  platform?: 'meta' | 'google';
  platformRequestId?: string;
  platformError?: string;
}

// Example log entries:
{ event: 'fund_created', fundId: 'xxx', caseId: 'yyy', status: 'RAISING' }
{ event: 'contribution_received', fundId: 'xxx', contributionId: 'zzz', amount: 2500 }
{ event: 'fund_launched', fundId: 'xxx', duration: 3400 }
{ event: 'meta_campaign_created', fundId: 'xxx', platform: 'meta', platformRequestId: 'abc' }
{ event: 'refund_processed', fundId: 'xxx', contributionId: 'zzz', amount: 850 }
{ event: 'meta_api_error', fundId: 'xxx', platform: 'meta', error: 'Rate limited', level: 'error' }
```

---

# Part 9: Security Considerations

## 9.1 Fraud Prevention

| Risk | Prevention |
|------|------------|
| Stolen cards | 3D Secure required, Stripe Radar, Chargeback Protection |
| Self-funding scam | Pattern detection (same IP, similar emails), manual review for large amounts |
| Fake pet cases | Case must be active and verified, photo required |
| Refund abuse | Refunds only go to original payment method |
| Bot contributions | reCAPTCHA on contribution form |

## 9.2 Data Protection

- PII (email, name) encrypted at rest
- Payment info never stored (Stripe handles)
- IP addresses stored for fraud detection, deleted after 90 days
- GDPR: Delete contributor data on request (after refund period)

## 9.3 Rate Limiting

| Endpoint | Limit |
|----------|-------|
| POST /api/adfund | 5/hour per user |
| POST /api/adfund/[id]/contribute | 10/minute per IP |
| GET /api/adfund/[id] | 60/minute per IP |

---

# Part 10: Implementation Checklist

## Phase 1: Foundation (Week 1-2)

### Database
- [ ] Create migration for AdFund model
- [ ] Create migration for AdFundContribution model
- [ ] Create migration for AdCampaign model
- [ ] Create migration for AdFundRefund model
- [ ] Create migration for AdFundNotification model
- [ ] Add AdFund relation to Case model
- [ ] Verify indexes created
- [ ] Test migration rollback

### Services
- [ ] Implement RadiusCalculator with all factors
- [ ] Implement fee calculation functions
- [ ] Implement daily budget schedule calculator
- [ ] Implement LIFO refund calculator
- [ ] Write unit tests for all calculations
- [ ] Implement AdFundService (CRUD operations)
- [ ] Implement contribution sequence numbering

### Stripe Integration
- [ ] Create PaymentIntent with 3D Secure
- [ ] Enable Chargeback Protection
- [ ] Handle payment_intent.succeeded webhook
- [ ] Handle payment_intent.failed webhook
- [ ] Implement refund processing
- [ ] Handle charge.refunded webhook
- [ ] Test with Stripe test cards

## Phase 2: UI (Week 2-3)

### Pages
- [ ] Create fund page (`/case/[id]/adfund/create`)
- [ ] Fund public page (`/case/[id]/adfund`)
- [ ] Owner dashboard (`/case/[id]/adfund/dashboard`)

### Components
- [ ] Radius calculation display
- [ ] Budget breakdown display
- [ ] Progress bar with states
- [ ] Contributor list
- [ ] Contribution modal with Stripe Elements
- [ ] Share buttons (Facebook, Twitter, Copy Link, Text)
- [ ] Campaign metrics display
- [ ] Metrics chart (reach over time)
- [ ] Refund breakdown display

### Mobile Optimization
- [ ] Test on iPhone Safari
- [ ] Test on Android Chrome
- [ ] Verify touch targets 44px+
- [ ] Test 3D Secure in-app browser
- [ ] Test contribution flow end-to-end

## Phase 3: Platform Integration (Week 3-5)

### Meta Integration
- [ ] Implement OAuth token management
- [ ] Implement reach estimate API
- [ ] Implement campaign creation
- [ ] Implement ad set creation with radius targeting
- [ ] Implement ad creation with creative
- [ ] Implement campaign pause/resume
- [ ] Implement campaign deletion
- [ ] Implement metrics fetching
- [ ] Test with sandbox account
- [ ] Test with real account (small budget)

### Google Integration
- [ ] Implement OAuth token management
- [ ] Implement reach estimate (Reach Planner)
- [ ] Implement image asset upload
- [ ] Implement Demand Gen campaign creation
- [ ] Implement ad group creation
- [ ] Implement responsive ad creation
- [ ] Implement campaign pause/resume
- [ ] Implement campaign deletion
- [ ] Implement metrics fetching
- [ ] Test with test account

### Creative Generation
- [ ] Implement image download and validation
- [ ] Implement square creative generation (1080x1080)
- [ ] Implement landscape creative generation (1200x628)
- [ ] Implement portrait creative generation (1080x1920)
- [ ] Implement CDN upload
- [ ] Test with various pet photos

## Phase 4: Orchestration (Week 5-6)

### AdOrchestrator
- [ ] Implement launch flow (Meta + Google in parallel)
- [ ] Implement daily budget update cron job
- [ ] Implement metrics sync cron job (every 15 min)
- [ ] Implement campaign stop flow
- [ ] Implement error handling and retries
- [ ] Implement status webhooks from platforms

### Refund Processing
- [ ] Implement refund queue
- [ ] Implement Stripe refund processing
- [ ] Implement retry logic for failed refunds
- [ ] Implement contributor notifications
- [ ] Test partial refund scenarios
- [ ] Test full refund scenarios

## Phase 5: Notifications (Week 6-7)

### Email Templates
- [ ] Contribution received
- [ ] Fund launched
- [ ] Daily update (optional)
- [ ] Pet found
- [ ] Refund processed
- [ ] Campaign complete

### Email Service
- [ ] Implement email sending via Resend
- [ ] Implement email tracking (opens, clicks)
- [ ] Implement unsubscribe handling
- [ ] Test all email templates

## Phase 6: Polish (Week 7-8)

### Error Handling
- [ ] Graceful degradation if Meta fails
- [ ] Graceful degradation if Google fails
- [ ] User-friendly error messages
- [ ] Retry logic for transient failures
- [ ] Admin alerts for critical failures

### Monitoring
- [ ] Set up logging for all operations
- [ ] Set up metrics dashboards
- [ ] Set up alerts for failures
- [ ] Set up anomaly detection

### Testing
- [ ] End-to-end test full flow
- [ ] Load testing (100 concurrent contributions)
- [ ] Security audit
- [ ] Accessibility audit

## Phase 7: Launch (Week 8+)

### Beta
- [ ] Internal testing with real money
- [ ] Beta with 10-20 real campaigns
- [ ] Gather feedback
- [ ] Fix critical issues

### Launch
- [ ] Documentation for support team
- [ ] Marketing materials
- [ ] Press release
- [ ] Full launch

---

*Document Version: 1.0*
*Created: December 2024*
*This is the complete specification. Build exactly this.*
