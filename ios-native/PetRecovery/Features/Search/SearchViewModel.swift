import Foundation
import CoreLocation
import Combine
import SwiftUI

@MainActor
final class SearchViewModel: ObservableObject {
    // Published UI state
    @Published var isSearchActive: Bool = false
    @Published var completedSession: SearchSession?
    @Published private(set) var elapsed: TimeInterval = 0
    @Published private(set) var validatedDistanceMeters: Double = 0
    @Published private(set) var uniqueCellsCount: Int = 0
    @Published private(set) var pathPings: [LocationPing] = []
    @Published private(set) var lastValidationWarning: ValidationWarning?
    @Published private(set) var permissionState: LocationAuthorizationState = .notDetermined

    enum ValidationWarning: Equatable {
        case outsideZone
        case tooFast
    }

    let locationManager = LocationManager()

    /// Demo defaults. In production these would come from the active mission.
    /// (37.7749, -122.4194) is San Francisco; replace when wiring real cases.
    private(set) var lastSeen = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
    private(set) var searchRadiusMeters: Double = GeoMath.milesToMeters(2)

    private var state: ActiveSearchState?
    private var timer: Timer?
    private var locationSub: AnyCancellable?
    private var authSub: AnyCancellable?

    init() {
        permissionState = locationManager.authorization
        authSub = locationManager.$authorization
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in self?.permissionState = $0 }
    }

    // MARK: - Permissions

    func requestWhenInUse() { locationManager.requestWhenInUse() }
    func requestAlways() { locationManager.requestAlways() }

    // MARK: - Mission configuration

    func configureMission(lastSeen: CLLocationCoordinate2D, radiusMiles: Double) {
        self.lastSeen = lastSeen
        self.searchRadiusMeters = GeoMath.milesToMeters(radiusMiles)
    }

    // MARK: - Lifecycle

    func startSearch() {
        guard !isSearchActive else { return }
        guard permissionState == .whenInUse || permissionState == .always else {
            requestWhenInUse()
            return
        }

        state = ActiveSearchState(
            startedAt: Date(),
            lastSeen: lastSeen,
            searchRadiusMeters: searchRadiusMeters
        )
        validatedDistanceMeters = 0
        uniqueCellsCount = 0
        pathPings = []
        elapsed = 0
        lastValidationWarning = nil

        locationManager.startTracking()
        subscribeToLocations()
        startTimer()

        isSearchActive = true
    }

    func endSearch() {
        guard isSearchActive, let state else { return }
        stopTimer()
        locationSub?.cancel()
        locationManager.stopTracking()

        let now = Date()
        let breakdown = PointsCalculator.breakdown(
            validatedDistanceMiles: state.validatedDistanceMiles,
            uniqueCells: state.visitedCells.count,
            durationSeconds: now.timeIntervalSince(state.startedAt),
            startedAt: state.startedAt
        )

        let session = SearchSession(
            startedAt: state.startedAt,
            endedAt: now,
            path: state.path,
            validatedDistanceMeters: state.validatedDistanceMeters,
            uniqueCellsVisited: state.visitedCells.count,
            pointsAwarded: breakdown.total,
            lastSeen: state.lastSeen,
            searchRadiusMeters: state.searchRadiusMeters
        )

        self.state = nil
        isSearchActive = false
        completedSession = session
    }

    func dismissSummary() {
        completedSession = nil
    }

    // MARK: - Location feed

    private func subscribeToLocations() {
        locationSub = locationManager.locationPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] location in self?.ingest(location) }
    }

    private func ingest(_ location: CLLocation) {
        guard var state = self.state else { return }

        let ping = LocationPing(
            coordinate: location.coordinate,
            timestamp: location.timestamp,
            horizontalAccuracy: location.horizontalAccuracy
        )

        if let previous = state.path.last {
            let result = SearchValidator.evaluate(
                from: previous,
                to: ping,
                lastSeen: state.lastSeen,
                searchRadiusMeters: state.searchRadiusMeters
            )
            switch result {
            case .counted(let meters):
                state.validatedDistanceMeters += meters
                lastValidationWarning = nil
            case .rejectedTooFast:
                lastValidationWarning = .tooFast
            case .rejectedOutsideZone:
                lastValidationWarning = .outsideZone
            case .rejectedTooSlow:
                break // GPS drift; silently ignore
            }
        }

        // Always record the ping (even rejected segments) so we draw the full path.
        state.path.append(ping)

        // Track unique grid cells inside the zone.
        if GeoMath.distanceMeters(ping.coordinate, state.lastSeen) <= state.searchRadiusMeters {
            let cellId = GeoMath.gridCellId(for: ping.coordinate, origin: state.lastSeen)
            state.visitedCells.insert(cellId)
        }

        self.state = state
        pathPings = state.path
        validatedDistanceMeters = state.validatedDistanceMeters
        uniqueCellsCount = state.visitedCells.count
    }

    // MARK: - Timer

    private func startTimer() {
        let start = Date()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.elapsed = Date().timeIntervalSince(start)
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    // MARK: - Derived

    var validatedDistanceMiles: Double {
        GeoMath.metersToMiles(validatedDistanceMeters)
    }

    /// Live point estimate, shown in the active search HUD.
    var estimatedPoints: Int {
        PointsCalculator.breakdown(
            validatedDistanceMiles: validatedDistanceMiles,
            uniqueCells: uniqueCellsCount,
            durationSeconds: elapsed,
            startedAt: state?.startedAt ?? Date()
        ).total
    }

    var canEarnPoints: Bool {
        guard let state else { return false }
        return SearchValidator.meetsMinimums(state, now: Date())
    }
}
