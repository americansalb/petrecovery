# Report Lost/Found Pet - UX Redesign Plan

## Current Problems

The current flow has **5-6 steps** with multiple friction points:

1. **Step 1 (Pet Type)** - Forces choice before seeing anything useful
2. **Step 2 (Time + Location Method)** - Two decisions crammed together:
   - 7 time options to scroll through
   - "City/Postal Code" vs "Use My Location" - unnecessary binary choice
3. **Step 3 (Map Confirmation)** - Separate step just to confirm a pin
4. **Step 4 (Contact Info)** - Only if not logged in
5. **Step 5 (Pet Details)** - Multiple form fields: name, breed, color, size, photos, marks

**Key issues:**
- Feels like a government form, not a quick action
- Can't see the map until step 3
- Too many required decisions upfront
- Location entry is overly complicated (choose method → enter → confirm)

---

## Proposed Redesign: "Map-First, Single-Page Flow"

### Core Principle
**Show the map immediately. Let users drop a pin and add details naturally.**

### New Flow: 2 Phases (Not 5 Steps)

#### Phase 1: Location (Map-Centric)
The page loads with:
- **Full-screen map** that immediately tries to get user's location
- **Floating search bar** at top for city/address/postal code search
- **Draggable pin** - user can refine location by dragging
- Pet type icons floating on the side (one tap to select)

User actions:
1. Map auto-centers on their GPS location (or prompts)
2. They can drag the pin OR type a location to search
3. Tap pet type icon (dog/cat/bird/other)
4. Tap "Next" or swipe up to add details

#### Phase 2: Quick Details (Bottom Sheet / Slide-Up Panel)
A bottom sheet slides up with:
- **Pet name** (required) - single text field
- **When missing** - simple pill buttons: "Today" | "Yesterday" | "This Week" | "Earlier"
- **Color** - visual color picker (already exists)
- **Photo** - big tap-to-upload area
- **Optional expandable section**: breed, size, distinctive marks

Contact info auto-filled if logged in, or minimal email field if not.

**Submit button always visible at bottom**

---

## Visual Layout

```
┌─────────────────────────────────────┐
│  🔍 Search location...              │  ← Floating search bar
├─────────────────────────────────────┤
│                                     │
│              MAP                    │  ← Full height map
│         📍 (draggable pin)          │
│                                     │
│   [🐕] [🐈] [🐦] [🐰]              │  ← Floating pet type selector
│                                     │
├─────────────────────────────────────┤
│  ▔▔▔▔▔▔▔▔  (drag handle)           │  ← Bottom sheet
│  Pet's name: [Max____________]      │
│                                     │
│  When: [Today] [Yesterday] [Week]   │
│                                     │
│  Color: [● ● ● ● ● ●]              │
│                                     │
│  📷 Add photo (tap)                 │
│                                     │
│  ▼ More details (optional)          │
│                                     │
│  [🔔 Create Alert]                  │  ← Always visible submit
└─────────────────────────────────────┘
```

---

## Location Input Strategy

**One unified search that handles everything:**

The search bar accepts:
- City name: "Los Angeles" → centers map on city, user refines with pin
- Address: "123 Main St, Chicago" → geocodes and pins exact location
- Postal code: "90210" → centers on that area
- Landmarks: "Central Park" → searches and centers

**No more choosing between "City" and "Use My Location"** - GPS runs automatically, search is always available as override.

If GPS fails or is denied:
- Show search bar prominently
- Default to a sensible location or ask them to search

---

## Implementation Steps

### Step 1: Create Map-First Layout Component
- Full-viewport map with floating UI elements
- GPS auto-detection on mount
- Floating search bar using CitySearchInput
- Floating pet type selector

### Step 2: Implement Unified Location Search
- Combine city search + address geocoding
- Type anything → get a pin on map
- Clicking map = moving pin
- Dragging pin = fine-tuning location

### Step 3: Build Bottom Sheet Details Panel
- Slide-up panel with essential fields only
- Simplified time selector (4 options not 7)
- Required: pet name, color
- Optional: breed, size, marks, photos

### Step 4: Streamline Submission
- Auto-fill contact from session
- Minimal validation
- Instant feedback on success

---

## What We're Removing/Simplifying

| Before | After |
|--------|-------|
| 5 separate steps | 2 fluid phases |
| Location method choice | Auto-GPS + universal search |
| 7 time options | 4 simple pills |
| Separate map confirmation step | Map is always visible |
| Multi-field forms | Essential fields + expandable |

---

## Questions for Approval

1. **Time options**: Is "Today / Yesterday / This Week / Earlier" sufficient, or do we need more granularity?

2. **Required fields**: Currently thinking just pet name + color. Should we require photo?

3. **Mobile-first**: This design is very mobile-friendly. On desktop, should the bottom sheet be a side panel instead?

4. **Found pets**: Should "Report Found Pet" use the same flow? (I assume yes)

---

## Files to Modify

1. `frontend/app/report/new/page.js` - Complete rewrite
2. `frontend/components/CitySearchInput.js` - May need styling updates
3. Possibly create new components:
   - `MapLocationPicker.js` - Full-screen map with floating controls
   - `ReportBottomSheet.js` - Slide-up details panel

---

**Ready to implement once you approve the direction.**
