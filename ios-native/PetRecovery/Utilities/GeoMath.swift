import Foundation
import CoreLocation

enum GeoMath {
    static let earthRadiusMeters: Double = 6_371_000

    /// Haversine great-circle distance in meters.
    static func distanceMeters(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let dLat = (b.latitude - a.latitude) * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180

        let h = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        let c = 2 * atan2(sqrt(h), sqrt(1 - h))
        return earthRadiusMeters * c
    }

    static func metersToMiles(_ meters: Double) -> Double {
        meters / 1609.344
    }

    static func milesToMeters(_ miles: Double) -> Double {
        miles * 1609.344
    }

    /// Returns a stable identifier for the 100m grid cell containing `point`,
    /// anchored on `origin`. Used to count unique covered cells.
    static func gridCellId(
        for point: CLLocationCoordinate2D,
        origin: CLLocationCoordinate2D,
        cellSizeMeters: Double = 100
    ) -> String {
        let metersPerDegLat = 111_000.0
        let metersPerDegLon = 111_000.0 * cos(origin.latitude * .pi / 180)
        let latIdx = Int(floor((point.latitude - origin.latitude) * metersPerDegLat / cellSizeMeters))
        let lonIdx = Int(floor((point.longitude - origin.longitude) * metersPerDegLon / cellSizeMeters))
        return "\(latIdx)_\(lonIdx)"
    }
}
