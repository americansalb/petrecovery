# Lost Pet Actions - Decision Logic Flowchart

Paste the mermaid blocks into https://mermaid.live to visualize.

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

## Variables Reference

```mermaid
flowchart LR
    subgraph INPUTS[Input Variables]
        PET_TYPE[Pet Type<br/>Cat / Dog]
        TIME_MISSING[Time Missing<br/>hours/days]
        CURRENT_TIME[Current Time<br/>hour of day]
        INDOOR_OUTDOOR[Indoor/Outdoor<br/>pet lifestyle]
        TEMPERAMENT[Temperament<br/>Friendly / Skittish]
        HEALTH[Health Conditions<br/>Needs medication?]
        MICROCHIP[Microchipped<br/>Yes / No]
        SIGHTING[Recent Sighting<br/>Location + time]
        LOCATION[Location Type<br/>Urban/Suburban/Rural]
        WEATHER[Weather<br/>Affects urgency]
    end

    subgraph OUTPUTS[Output]
        NEXT_ACTION[Next Best Action<br/>+ Why<br/>+ How to do it<br/>+ Specific details]
    end

    INPUTS --> ALGORITHM((Algorithm))
    ALGORITHM --> OUTPUTS
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

| ID | Action | Pet | Phase | Requires |
|----|--------|-----|-------|----------|
| `search_inside` | Search inside home thoroughly | Cat | 1 | - |
| `search_yard` | Search yard + 3-house radius | Both | 1 | - |
| `litter_outside` | Put litter box outside | Cat | 1 | - |
| `scent_clothes` | Leave worn clothes outside | Both | 1 | - |
| `call_shelters` | Call nearby shelters | Both | 2 | Shelter data |
| `call_vets` | Call local vet clinics | Both | 2 | Vet data |
| `notify_microchip` | Notify microchip company | Both | 2 | isMicrochipped |
| `post_flyers` | Print and post flyers | Both | 2 | Flyer generator |
| `dawn_search` | Physical search at dawn | Both | 2+ | Time = 5-7am |
| `dusk_search` | Physical search at dusk | Both | 2+ | Time = 5-8pm |
| `night_flashlight` | Flashlight search for eye reflection | Cat | 2+ | Time = night |
| `setup_camera` | Food station with camera | Both | 2 | - |
| `check_hiding` | Check sheds, garages, under decks | Cat | 2 | - |
| `alert_delivery` | Alert mail/delivery people | Both | 2 | - |
| `humane_trap` | Set up humane trap | Cat | 3 | Skittish cat |
| `expand_flyers` | Expand flyer radius | Both | 3 | - |
| `check_online` | Check shelter sites, Craigslist | Both | 3+ | - |
