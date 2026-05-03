import Foundation
import CoreLocation

struct LocationPing: Identifiable, Hashable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
    let timestamp: Date
    let horizontalAccuracy: CLLocationAccuracy

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: LocationPing, rhs: LocationPing) -> Bool {
        lhs.id == rhs.id
    }
}

/// A completed search session, used by the summary screen.
struct SearchSession: Identifiable, Hashable {
    let id = UUID()
    let startedAt: Date
    let endedAt: Date
    let path: [LocationPing]
    let validatedDistanceMeters: Double
    let uniqueCellsVisited: Int
    let pointsAwarded: Int
    let lastSeen: CLLocationCoordinate2D
    let searchRadiusMeters: Double

    var durationSeconds: TimeInterval { endedAt.timeIntervalSince(startedAt) }
    var validatedDistanceMiles: Double { GeoMath.metersToMiles(validatedDistanceMeters) }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: SearchSession, rhs: SearchSession) -> Bool { lhs.id == rhs.id }
}

/// Live state for an in-progress session. Mutable; held by the view model.
struct ActiveSearchState {
    var startedAt: Date
    var path: [LocationPing] = []
    var validatedDistanceMeters: Double = 0
    var visitedCells: Set<String> = []
    var lastSeen: CLLocationCoordinate2D
    var searchRadiusMeters: Double

    var validatedDistanceMiles: Double { GeoMath.metersToMiles(validatedDistanceMeters) }
}
