import Foundation
import CoreLocation

/// Pure functions enforcing the validation rules from
/// `docs/GPS_Search_Feature_Spec.md` §5: proximity, speed, minimums.
enum SearchValidator {
    static let maxWalkingSpeedMps: Double = 5 * 1609.344 / 3600   // 5 mph
    static let minMovementSpeedMps: Double = 0.1 * 1609.344 / 3600 // 0.1 mph (filter GPS drift)

    static let minSessionDuration: TimeInterval = 5 * 60
    static let minSessionDistanceMeters: Double = GeoMath.milesToMeters(0.1)
    static let minUniqueCells: Int = 3

    enum SegmentResult {
        case counted(distanceMeters: Double)
        case rejectedTooFast
        case rejectedTooSlow
        case rejectedOutsideZone
    }

    /// Decide whether to count the segment between two pings.
    /// - Parameter lastSeen: The pet's last-known location.
    /// - Parameter searchRadiusMeters: Radius around `lastSeen` that counts.
    static func evaluate(
        from previous: LocationPing,
        to current: LocationPing,
        lastSeen: CLLocationCoordinate2D,
        searchRadiusMeters: Double
    ) -> SegmentResult {
        let segmentMeters = GeoMath.distanceMeters(previous.coordinate, current.coordinate)
        let dt = current.timestamp.timeIntervalSince(previous.timestamp)
        guard dt > 0 else { return .rejectedTooSlow }

        let speed = segmentMeters / dt
        if speed > maxWalkingSpeedMps { return .rejectedTooFast }
        if speed < minMovementSpeedMps { return .rejectedTooSlow }

        // Both endpoints must be within the search zone for the segment to count.
        let prevInZone = GeoMath.distanceMeters(previous.coordinate, lastSeen) <= searchRadiusMeters
        let currInZone = GeoMath.distanceMeters(current.coordinate, lastSeen) <= searchRadiusMeters
        guard prevInZone && currInZone else { return .rejectedOutsideZone }

        return .counted(distanceMeters: segmentMeters)
    }

    static func meetsMinimums(_ state: ActiveSearchState, now: Date) -> Bool {
        let duration = now.timeIntervalSince(state.startedAt)
        return duration >= minSessionDuration
            && state.validatedDistanceMeters >= minSessionDistanceMeters
            && state.visitedCells.count >= minUniqueCells
    }
}
