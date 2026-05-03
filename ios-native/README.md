# PetRecovery iOS (Native)

Native SwiftUI iOS app for PetRecovery.org. This is a fresh native target — separate from the Capacitor wrapper at `frontend/ios/`.

The first feature implemented is the **GPS Search** core, per `docs/GPS_Search_Feature_Spec.md`.

## What's in this scaffold

- **SwiftUI app** targeting iOS 16+
- **CoreLocation** wrapper with foreground + background tracking
- **MapKit** breadcrumb path with the search-radius zone overlay
- **Validation** (proximity, walking-speed, minimum session) per spec §5
- **Points calculator** per spec §6
- **Home → Active Search → Summary** navigation flow
- `Info.plist` with the three location usage strings and `UIBackgroundModes: location`

## Layout

```
ios-native/
├── project.yml                           # XcodeGen spec (generates the .xcodeproj)
└── PetRecovery/
    ├── PetRecoveryApp.swift              # @main
    ├── RootView.swift                    # NavigationStack + destinations
    ├── Features/
    │   ├── Home/HomeView.swift
    │   └── Search/
    │       ├── ActiveSearchView.swift
    │       ├── SearchMapView.swift       # MKMapView wrapper
    │       ├── SearchSummaryView.swift
    │       └── SearchViewModel.swift
    ├── Services/
    │   ├── LocationManager.swift
    │   ├── PointsCalculator.swift
    │   └── SearchValidator.swift
    ├── Models/SearchSession.swift
    ├── Utilities/GeoMath.swift           # Haversine, grid cell IDs
    └── Resources/
        ├── Info.plist
        └── Assets.xcassets/
```

## Building

The Xcode project is generated from `project.yml` using [XcodeGen](https://github.com/yonaskolb/XcodeGen) so the `.xcodeproj` doesn't have to be hand-maintained.

```bash
brew install xcodegen
cd ios-native
xcodegen generate
open PetRecovery.xcodeproj
```

Then in Xcode:

1. Select the **PetRecovery** target → **Signing & Capabilities** → set your Team and a unique Bundle Identifier (replace `org.petrecovery.PetRecovery`).
2. Verify **Background Modes → Location updates** is checked. (XcodeGen wires it via `Info.plist`; Xcode may also surface it as a capability.)
3. Run on a real device — the simulator's GPS is mocked and won't exercise background tracking realistically.

## Testing background GPS

1. Launch, tap **Start Searching**, grant **While Using App**.
2. The Home screen will then prompt to upgrade to **Always**. Accept.
3. Lock the phone. The blue background-location indicator should appear in the status bar.
4. Walk around. When you re-open the app, the breadcrumb path and distance should reflect what you walked while locked.

## What's not done yet

This is the GPS-search base layer. Still to build:

- Auth / account / mission feed (currently a hard-coded "Max" mission with SF coordinates)
- Real backend integration — distance, points, and session results are computed locally and not yet POSTed
- Report Sighting flow (placeholder button)
- Push notifications, App Store assets, app icon artwork
- Unit tests for `GeoMath`, `SearchValidator`, `PointsCalculator`

## Spec references

- User journey & UI: `docs/GPS_Search_Feature_Spec.md` §1–4, §7
- Validation rules: `docs/GPS_Search_Feature_Spec.md` §5
- Points formula: `docs/GPS_Search_Feature_Spec.md` §6
