# Lost Pet Actions - Decision Logic Flowchart

Paste the mermaid blocks into https://mermaid.live to visualize.

---

## UI Design: Shared Mission Board

### Main View (List)
```
┌─────────────────────────────────────────────────┐
│  ACTIONS                          [+ Add Task]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  OWNER TASKS (only owner can do these)          │
│  sorted by algorithm priority ↓                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 1. ⚪ Put litter box outside            │   │
│  │ 2. 🟡 Search inside     [Sarah - 5m]    │   │
│  │ 3. ⚪ Set up camera trap                │   │
│  │ 4. ✅ Called HomeAgain  [Sarah - 1h]    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  SQUAD TASKS (anyone can help)                  │
│  sorted by algorithm priority ↓                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 1. ⚪ Call Austin Animal Shelter        │   │  ← Highest priority
│  │ 2. ⚪ Call Town Lake Animal Center      │   │
│  │ 3. 🟡 Search Oak Park    [Mike - 10m]   │   │  ← Someone's on it
│  │ 4. ⚪ Search Zilker area                │   │
│  │ 5. ⚪ Post flyers - Main St             │   │
│  │ 6. ✅ Called Emancipet   [Jen - 2h]     │   │  ← Done
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Legend: ⚪ Available  🟡 In Progress  ✅ Done  │
└─────────────────────────────────────────────────┘
```

### Full-Screen Task View (tap to expand)
```
┌─────────────────────────────────────────────────┐
│  ← Back                              Priority 1 │
├─────────────────────────────────────────────────┤
│                                                 │
│  📞 Call Austin Animal Shelter                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                 │
│  WHY THIS IS #1 RIGHT NOW                       │
│  ┌─────────────────────────────────────────┐   │
│  │ • It's been 6 hours - shelters are key  │   │
│  │ • This shelter is closest (2.3 mi)      │   │
│  │ • They're open now (closes 7pm)         │   │
│  │ • No one has called them yet            │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  WHAT TO SAY                                    │
│  ┌─────────────────────────────────────────┐   │
│  │ "Hi, I'm looking for a lost cat.        │   │
│  │  Orange tabby, male, about 2 years old, │   │
│  │  no collar. Lost near 45th & Duval      │   │
│  │  around 2pm today. Have you had any     │   │
│  │  cats brought in today?"                │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  CONTACT                                        │
│  📞 (512) 978-0500                              │
│  📍 7201 Levander Loop, Austin TX               │
│  🕐 Open 11am-7pm (Open now)                    │
│  ℹ️  Data last updated: Dec 1, 2025             │
│                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │         📞 TAP TO CALL                   │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │     🟡 I'M CALLING NOW                   │   │
│  │     (others will see you're on it)      │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │     ✅ DONE - NO MATCH                   │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │     ✅ DONE - POSSIBLE MATCH!            │   │
│  │     (alert owner immediately)           │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Task States
```
⚪ AVAILABLE    → Anyone can claim it
🟡 IN_PROGRESS  → Someone's working on it (shows who + duration)
✅ COMPLETED    → Done (shows who + when + result)
🔴 BLOCKED      → Can't do yet (e.g., shelter closed, waiting on owner)
```

### Priority Algorithm (simplified)
```
score = base_priority
      + time_urgency_bonus      (first 24hrs = +100)
      + time_of_day_bonus       (shelter open now = +50)
      + not_done_yet_bonus      (never called = +30)
      + proximity_bonus         (user is nearby = +20)
      - already_in_progress     (someone on it = -1000)
      - recently_completed      (done <4hrs ago = -500)
```

---

## Role-Based Split (CRITICAL)

```mermaid
flowchart TD
    START([User Opens Actions Tab]) --> ROLE{User Role?}

    ROLE -->|Owner| OWNER_PATH[Owner Actions Path]
    ROLE -->|Squad Member| SQUAD_PATH[Squad Actions Path]

    OWNER_PATH --> OWNER_DESC[Owner has:<br/>- Access to home<br/>- Pet's belongings<br/>- Microchip info<br/>- Knowledge of pet's habits<br/>- Decision-making authority]

    SQUAD_PATH --> SQUAD_DESC[Squad can:<br/>- Search assigned areas<br/>- Distribute flyers<br/>- Call shelters on behalf<br/>- Knock on doors<br/>- Report sightings]

    OWNER_DESC --> OWNER_PHASE{Check Phase}
    SQUAD_DESC --> SQUAD_PHASE{Check Phase}
```

---

## Owner vs Squad - Action Ownership

| Action | Owner | Squad | Notes |
|--------|:-----:|:-----:|-------|
| Search inside home | ✅ | ❌ | Only owner has access |
| Put litter box outside | ✅ | ❌ | Owner has the litter box |
| Leave scent items outside | ✅ | ❌ | Owner's scent matters |
| Set up camera at home | ✅ | ❌ | Owner's property |
| Notify microchip company | ✅ | ❌ | Owner has the info |
| Set humane trap at home | ✅ | ❌ | Owner's property |
| Call shelters | ✅ | ✅ | Squad can help call |
| Call vet clinics | ✅ | ✅ | Squad can help call |
| Physical search | ✅ | ✅ | Coordinate areas |
| Post flyers | ✅ | ✅ | Owner prints, squad distributes |
| Knock on doors | ✅ | ✅ | Squad can cover more ground |
| Alert delivery people | ✅ | ✅ | Anyone can do |
| Check hiding spots | ✅ | ✅ | Squad checks other areas |
| Report sighting | ✅ | ✅ | Anyone can report |
| Share on social media | ✅ | ✅ | More shares = better |

---

## Owner-Specific Flow

```mermaid
flowchart TD
    OWNER([Owner Actions]) --> O_CRITICAL{Critical First?}

    O_CRITICAL -->|Health condition| O_URGENT[🚨 Your pet needs medication<br/>Time is critical - expand search NOW]
    O_CRITICAL -->|New sighting| O_SIGHTING[🏃 Go to sighting location<br/>Bring treats, favorite toy]
    O_CRITICAL -->|No| O_PHASE{Phase?}

    O_PHASE -->|0-2 hrs| O_P1[Phase 1: YOU must do these]
    O_PHASE -->|2-24 hrs| O_P2[Phase 2: Home setup + coordination]
    O_PHASE -->|1+ days| O_P3[Phase 3: Persistence + delegation]

    O_P1 --> O_P1_ACTIONS[1. Search inside thoroughly<br/>2. Search immediate yard<br/>3. Put litter box outside 🐱<br/>4. Leave your worn clothes out<br/>5. Tell immediate neighbors]

    O_P2 --> O_P2_ACTIONS[1. Set up food station + camera<br/>2. Call YOUR microchip company<br/>3. Print flyers from our generator<br/>4. Assign search areas to squad<br/>5. Review squad activity]

    O_P3 --> O_P3_ACTIONS[1. Consider humane trap 🐱<br/>2. Check squad coverage gaps<br/>3. Expand flyer radius<br/>4. Daily shelter follow-up<br/>5. Keep scent items fresh]
```

---

## Squad Member Flow

```mermaid
flowchart TD
    SQUAD([Squad Member Actions]) --> S_CRITICAL{Critical Alert?}

    S_CRITICAL -->|New sighting nearby| S_SIGHTING[🏃 You're closest!<br/>Go check the sighting area]
    S_CRITICAL -->|Area unassigned| S_ASSIGN[📍 Claim this search area<br/>No one has covered it yet]
    S_CRITICAL -->|No| S_PHASE{What can you do?}

    S_PHASE --> S_AVAILABLE{Your availability?}

    S_AVAILABLE -->|Can search now| S_SEARCH[🔍 Search Actions]
    S_AVAILABLE -->|Can make calls| S_CALLS[📞 Call Actions]
    S_AVAILABLE -->|Can distribute| S_FLYERS[📄 Flyer Actions]

    S_SEARCH --> S_SEARCH_ACTIONS[1. Claim an uncovered area<br/>2. Search systematically<br/>3. Check hiding spots<br/>4. Talk to people you see<br/>5. Log your search when done]

    S_CALLS --> S_CALL_ACTIONS[1. Call assigned shelters<br/>2. Call assigned vet clinics<br/>3. Log results for team<br/>4. Note: Already called today?]

    S_FLYERS --> S_FLYER_ACTIONS[1. Get flyers from owner<br/>2. Claim distribution zone<br/>3. Post in high-traffic spots<br/>4. Log locations posted]
```

---

## Squad: "What Can I Do Right Now?"

```mermaid
flowchart TD
    SQUAD_NOW([Squad: What should I do?]) --> LOCATION{Where are you?}

    LOCATION -->|Near search area| NEAR_SEARCH{Area searched today?}
    LOCATION -->|Near shelters| NEAR_SHELTER{Shelter called today?}
    LOCATION -->|At home| AT_HOME[Make calls or share online]

    NEAR_SEARCH -->|No| DO_SEARCH[🔍 SEARCH THIS AREA<br/>You're already here!<br/>Log start → Search → Log end]
    NEAR_SEARCH -->|Yes, <4hrs ago| MOVE_ON[Move to adjacent uncovered area]
    NEAR_SEARCH -->|Yes, >4hrs ago| RE_SEARCH[Worth re-checking<br/>Pets move around]

    NEAR_SHELTER -->|No| DO_CALL[📞 CALL THIS SHELTER<br/>Ask about new intakes<br/>Describe the pet<br/>Log the result]
    NEAR_SHELTER -->|Yes| NEXT_SHELTER[Try next nearest shelter]

    AT_HOME --> SHARE[📱 Share the case<br/>Every share helps]
```

---

## Master Flow

```mermaid
flowchart TD
    START([Pet Reported Missing]) --> CHECK_CRITICAL{Critical Override?}

    CHECK_CRITICAL -->|Health condition + >12hrs| URGENT_MEDICAL[🚨 URGENT: Pet needs medication]
    CHECK_CRITICAL -->|New sighting <2hrs ago| GO_TO_SIGHTING[🏃 Search sighting area NOW]
    CHECK_CRITICAL -->|No| CHECK_TIME{Time Missing?}

    CHECK_TIME -->|0-2 hours| PHASE_1[Phase 1: Immediate]
    CHECK_TIME -->|2-24 hours| PHASE_2[Phase 2: First Day]
    CHECK_TIME -->|1-3 days| PHASE_3[Phase 3: Expansion]
    CHECK_TIME -->|3-7 days| PHASE_4[Phase 4: Persistence]
    CHECK_TIME -->|7+ days| PHASE_5[Phase 5: Long-term]

    PHASE_1 --> PET_TYPE_1{Pet Type?}
    PHASE_2 --> PET_TYPE_2{Pet Type?}
    PHASE_3 --> PET_TYPE_3{Pet Type?}

    PET_TYPE_1 -->|Cat| CAT_PHASE_1[Cat: Phase 1 Actions]
    PET_TYPE_1 -->|Dog| DOG_PHASE_1[Dog: Phase 1 Actions]

    PET_TYPE_2 -->|Cat| CAT_PHASE_2[Cat: Phase 2 Actions]
    PET_TYPE_2 -->|Dog| DOG_PHASE_2[Dog: Phase 2 Actions]
```

---

## Phase 1: Immediate (0-2 hours)

### CAT - Phase 1
```mermaid
flowchart TD
    CAT_P1([CAT: 0-2 hours]) --> INDOOR{Indoor-only cat?}

    INDOOR -->|Yes| SEARCH_INSIDE[1. Search INSIDE thoroughly<br/>Closets, under beds, in boxes,<br/>behind appliances, in walls]
    INDOOR -->|No| SEARCH_YARD[1. Search yard + neighbors' yards]

    SEARCH_INSIDE --> YARD_CLOSE[2. Search within 3-house radius<br/>Cats hide CLOSE - under porches,<br/>in bushes, under cars]
    SEARCH_YARD --> YARD_CLOSE

    YARD_CLOSE --> LITTER[3. Put litter box outside<br/>Familiar scent - 1 mile range]

    LITTER --> SCENT[4. Leave worn clothing outside<br/>Your scent near entry points]

    SCENT --> QUIET[5. Search QUIETLY<br/>Scared cats hide from voices]

    QUIET --> NIGHT_NOTE[⚠️ If evening: Plan flashlight<br/>search - cat eyes reflect]
```

### DOG - Phase 1
```mermaid
flowchart TD
    DOG_P1([DOG: 0-2 hours]) --> ESCAPE{How did they escape?}

    ESCAPE -->|Door/Gate| DIRECTION[1. Check direction they ran<br/>Ask anyone who saw]
    ESCAPE -->|Jumped fence| PATTERN[1. Check their usual walk route<br/>Dogs follow familiar paths]
    ESCAPE -->|During walk/Spooked| LAST_SEEN[1. Return to exact spot<br/>They may come back]

    DIRECTION --> SEARCH_ROUTE[2. Search walking routes<br/>Parks, favorite spots]
    PATTERN --> SEARCH_ROUTE
    LAST_SEEN --> SEARCH_ROUTE

    SEARCH_ROUTE --> NEIGHBORS[3. Alert neighbors LOUDLY<br/>Dogs respond to calls]

    NEIGHBORS --> TREATS[4. Carry treats + favorite toy<br/>Shake treat bag while calling]

    TREATS --> CHECK_ROADS[5. Check busy roads nearby<br/>Time-sensitive safety check]
```

---

## Phase 2: First Day (2-24 hours)

### Time-of-Day Logic
```mermaid
flowchart TD
    P2([Phase 2: 2-24 hours]) --> TIME{Current Time?}

    TIME -->|5-7 AM| DAWN[🌅 DAWN SEARCH<br/>Pets most active now - GO SEARCH]
    TIME -->|7 AM - 5 PM| DAYTIME[☀️ Daytime Actions]
    TIME -->|5-8 PM| DUSK[🌆 DUSK SEARCH<br/>Second active window - GO SEARCH]
    TIME -->|8 PM - 5 AM| NIGHT[🌙 Night Actions]

    DAYTIME --> SHELTERS_OPEN{Shelters open?}
    SHELTERS_OPEN -->|Yes| CALL_SHELTERS[📞 Call these shelters:<br/>- Shelter 1: 555-1234<br/>- Shelter 2: 555-5678<br/>Last updated: date]
    SHELTERS_OPEN -->|No| FLYERS[📄 Print & post flyers<br/>Within 1-mile radius]

    CALL_SHELTERS --> VETS[📞 Call local vet clinics<br/>People bring found pets there]
    VETS --> MICROCHIP{Microchipped?}
    MICROCHIP -->|Yes| NOTIFY_CHIP[📞 Notify microchip company<br/>Mark as lost in their system]
    MICROCHIP -->|No| FLYERS

    NIGHT --> NIGHT_CAT{Cat?}
    NIGHT_CAT -->|Yes| FLASHLIGHT[🔦 Flashlight search<br/>Cat eyes reflect green/yellow]
    NIGHT_CAT -->|No| WAIT_DAWN[Wait for dawn search<br/>Prep flyers, plan route]
```

### CAT - Phase 2 Specifics
```mermaid
flowchart TD
    CAT_P2([CAT: 2-24 hours]) --> STILL_CLOSE[Remember: Cat is likely<br/>within 500m of home]

    STILL_CLOSE --> HIDING_SPOTS[1. Check ALL hiding spots<br/>- Under porches/decks<br/>- In sheds/garages<br/>- Under cars<br/>- In dense bushes<br/>- Up in trees]

    HIDING_SPOTS --> ASK_NEIGHBORS[2. Ask neighbors to check<br/>their garages/sheds<br/>Cats get trapped inside]

    ASK_NEIGHBORS --> CAMERA[3. Set up camera at food station<br/>They may return at night]

    CAMERA --> NO_CHASE[⚠️ DO NOT CHASE if spotted<br/>Approach slowly, low to ground]
```

### DOG - Phase 2 Specifics
```mermaid
flowchart TD
    DOG_P2([DOG: 2-24 hours]) --> EXPAND[Dogs travel farther than cats<br/>Expand search radius]

    EXPAND --> SEARCH_RADIUS[1. Search 2-mile radius<br/>Focus on parks, trails, water]

    SEARCH_RADIUS --> SOCIAL[2. Post to local Facebook groups<br/>Neighborhood apps<br/>- Include: photo, location, contact]

    SOCIAL --> DELIVERY[3. Alert regular visitors<br/>- Mail carrier<br/>- Delivery drivers<br/>- Dog walkers in area]

    DELIVERY --> FOOD_WATER[4. Leave food + water outside<br/>With an item that smells like you]
```

---

## Phase 3: Expansion (1-3 days)

```mermaid
flowchart TD
    P3([Phase 3: 1-3 days]) --> SHELTERS_DAILY[1. Call shelters DAILY<br/>New animals arrive constantly]

    SHELTERS_DAILY --> EXPAND_FLYERS[2. Expand flyer radius<br/>High-traffic areas:<br/>- Grocery stores<br/>- Gas stations<br/>- Vet offices<br/>- Dog parks]

    EXPAND_FLYERS --> TRAP{Cat + Skittish?}
    TRAP -->|Yes| HUMANE_TRAP[3. Consider humane trap<br/>Near last sighting<br/>With smelly food]
    TRAP -->|No| KEEP_SEARCHING[3. Continue physical searches<br/>Dawn and dusk]

    HUMANE_TRAP --> ONLINE[4. Check online daily<br/>- Shelter websites<br/>- Craigslist lost & found<br/>- Facebook lost pet groups]
    KEEP_SEARCHING --> ONLINE
```

---

## Backend Data Model

```mermaid
erDiagram
    CASE ||--o{ ACTION_LOG : has
    CASE ||--o{ SIGHTING : has
    CASE {
        string id
        string petType
        string petName
        boolean isIndoorPet
        string temperament
        boolean hasMedicalNeeds
        string medicalDetails
        boolean isMicrochipped
        string microchipCompany
        datetime missingAt
        point lastSeenLocation
        string status
    }

    ACTION_LOG {
        string id
        string caseId
        string actionType
        string actionId
        datetime completedAt
        string completedBy
        point location
        string notes
    }

    LOCAL_RESOURCE {
        string id
        string type
        string name
        string phone
        string address
        point location
        string hours
        string regionKey
        datetime lastVerified
        string source
    }

    SIGHTING {
        string id
        string caseId
        point location
        datetime seenAt
        string description
        string reportedBy
    }
```

---

## Action Types Master List

| ID | Action | Pet | Phase | Role | Requires |
|----|--------|-----|-------|------|----------|
| `search_inside` | Search inside home thoroughly | Cat | 1 | Owner | - |
| `search_yard` | Search yard + 3-house radius | Both | 1 | Owner | - |
| `search_area` | Search assigned area | Both | 1+ | Squad | Claimed area |
| `litter_outside` | Put litter box outside | Cat | 1 | Owner | - |
| `scent_clothes` | Leave worn clothes outside | Both | 1 | Owner | - |
| `call_shelter` | Call specific shelter | Both | 2 | Both | Shelter data |
| `call_vet` | Call specific vet clinic | Both | 2 | Both | Vet data |
| `notify_microchip` | Notify microchip company | Both | 2 | Owner | isMicrochipped |
| `print_flyers` | Print flyers | Both | 2 | Owner | Flyer generator |
| `post_flyers` | Distribute flyers in zone | Both | 2 | Squad | Flyers from owner |
| `dawn_search` | Physical search at dawn | Both | 2+ | Both | Time = 5-7am |
| `dusk_search` | Physical search at dusk | Both | 2+ | Both | Time = 5-8pm |
| `night_flashlight` | Flashlight search | Cat | 2+ | Both | Time = night |
| `setup_camera` | Food station with camera | Both | 2 | Owner | At home |
| `check_hiding` | Check sheds, garages, decks | Cat | 2 | Both | - |
| `alert_delivery` | Alert mail/delivery people | Both | 2 | Both | - |
| `knock_doors` | Knock on doors in area | Both | 2 | Squad | Assigned zone |
| `humane_trap` | Set up humane trap | Cat | 3 | Owner | Skittish cat |
| `expand_flyers` | Expand flyer radius | Both | 3 | Both | - |
| `check_online` | Check shelter sites daily | Both | 3+ | Both | - |
| `review_coverage` | Review squad search coverage | Both | 2+ | Owner | Has squad |
| `claim_area` | Claim uncovered search area | Both | 1+ | Squad | GPS |
| `report_sighting` | Report a sighting | Both | Any | Both | - |
| `share_case` | Share case on social media | Both | Any | Both | - |

---

## Variables Reference (Updated)

```mermaid
flowchart LR
    subgraph INPUTS[Input Variables]
        USER_ROLE[User Role<br/>Owner / Squad]
        PET_TYPE[Pet Type<br/>Cat / Dog]
        TIME_MISSING[Time Missing<br/>hours/days]
        CURRENT_TIME[Current Time<br/>hour of day]
        INDOOR_OUTDOOR[Indoor/Outdoor<br/>pet lifestyle]
        TEMPERAMENT[Temperament<br/>Friendly / Skittish]
        HEALTH[Health Conditions<br/>Needs medication?]
        MICROCHIP[Microchipped<br/>Yes / No]
        SIGHTING[Recent Sighting<br/>Location + time]
        USER_LOCATION[User Location<br/>GPS coordinates]
        SQUAD_ACTIVITY[Squad Activity<br/>What's been done]
    end

    subgraph OUTPUTS[Output]
        NEXT_ACTION[Next Best Action<br/>+ Why this matters<br/>+ Specific instructions<br/>+ Required resources]
    end

    INPUTS --> ALGORITHM((Role-Based<br/>Algorithm))
    ALGORITHM --> OUTPUTS
```
