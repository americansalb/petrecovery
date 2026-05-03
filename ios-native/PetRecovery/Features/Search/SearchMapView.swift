import SwiftUI
import MapKit

/// MapKit map showing the user's breadcrumb path, the last-seen pin, and the
/// search radius. Wrapped in UIViewRepresentable because SwiftUI's `Map` API
/// can't draw `MKPolyline` overlays with custom styling on iOS 16.
struct SearchMapView: UIViewRepresentable {
    let path: [LocationPing]
    let lastSeen: CLLocationCoordinate2D
    let searchRadiusMeters: Double
    let userLocation: CLLocationCoordinate2D?

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.showsUserLocation = true
        map.userTrackingMode = .follow
        map.pointOfInterestFilter = .excludingAll

        let pin = MKPointAnnotation()
        pin.coordinate = lastSeen
        pin.title = "Last Seen"
        map.addAnnotation(pin)

        let circle = MKCircle(center: lastSeen, radius: searchRadiusMeters)
        map.addOverlay(circle)

        let initialRegion = MKCoordinateRegion(
            center: lastSeen,
            latitudinalMeters: searchRadiusMeters * 2.5,
            longitudinalMeters: searchRadiusMeters * 2.5
        )
        map.setRegion(initialRegion, animated: false)

        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        // Replace the breadcrumb polyline whenever the path grows.
        let existing = map.overlays.compactMap { $0 as? MKPolyline }
        map.removeOverlays(existing)

        guard path.count >= 2 else { return }
        let coords = path.map(\.coordinate)
        let line = MKPolyline(coordinates: coords, count: coords.count)
        map.addOverlay(line)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let line = overlay as? MKPolyline {
                let r = MKPolylineRenderer(polyline: line)
                r.strokeColor = UIColor(named: "AccentColor") ?? .systemPurple
                r.lineWidth = 5
                r.lineCap = .round
                return r
            }
            if let circle = overlay as? MKCircle {
                let r = MKCircleRenderer(circle: circle)
                r.strokeColor = UIColor(named: "AccentColor")?.withAlphaComponent(0.7) ?? .systemPurple
                r.fillColor = UIColor.systemGreen.withAlphaComponent(0.08)
                r.lineWidth = 1.5
                return r
            }
            return MKOverlayRenderer(overlay: overlay)
        }
    }
}
