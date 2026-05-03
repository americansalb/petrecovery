import Foundation
import CoreLocation
import Combine

enum LocationAuthorizationState {
    case notDetermined
    case denied
    case whenInUse
    case always
}

@MainActor
final class LocationManager: NSObject, ObservableObject {
    @Published private(set) var authorization: LocationAuthorizationState = .notDetermined
    @Published private(set) var lastLocation: CLLocation?
    @Published private(set) var isTracking = false

    let locationPublisher = PassthroughSubject<CLLocation, Never>()

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        manager.activityType = .fitness
        manager.pausesLocationUpdatesAutomatically = false
        syncAuthorization()
    }

    func requestWhenInUse() {
        manager.requestWhenInUseAuthorization()
    }

    /// Call this AFTER whenInUse has been granted to upgrade to always.
    /// iOS only allows the always prompt once whenInUse is already authorized.
    func requestAlways() {
        manager.requestAlwaysAuthorization()
    }

    func startTracking() {
        guard authorization == .whenInUse || authorization == .always else { return }
        // Background updates only work with `always` plus the location background mode.
        manager.allowsBackgroundLocationUpdates = (authorization == .always)
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
        isTracking = true
    }

    func stopTracking() {
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        isTracking = false
    }

    private func syncAuthorization() {
        authorization = Self.map(manager.authorizationStatus)
    }

    private static func map(_ status: CLAuthorizationStatus) -> LocationAuthorizationState {
        switch status {
        case .notDetermined: return .notDetermined
        case .restricted, .denied: return .denied
        case .authorizedWhenInUse: return .whenInUse
        case .authorizedAlways: return .always
        @unknown default: return .denied
        }
    }
}

extension LocationManager: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.syncAuthorization()
            // If user upgraded to always while we're tracking, enable background updates.
            if self.isTracking, self.authorization == .always {
                manager.allowsBackgroundLocationUpdates = true
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        // Filter out coarse and stale fixes before publishing.
        let now = Date()
        let valid = locations.filter { loc in
            loc.horizontalAccuracy >= 0 &&
            loc.horizontalAccuracy < 50 &&
            abs(loc.timestamp.timeIntervalSince(now)) < 15
        }
        guard let latest = valid.last else { return }
        Task { @MainActor in
            self.lastLocation = latest
            self.locationPublisher.send(latest)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Transient errors are common (kCLErrorLocationUnknown). We just ignore and wait.
    }
}
