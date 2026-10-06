import CoreLocation
import Observation

@MainActor
@Observable
final class NavigationGuidance: NSObject, CLLocationManagerDelegate {
    enum State: Equatable {
        case idle
        case requesting
        case active
        case offRoute
        case arrived
        case denied
    }

    private(set) var state: State = .idle
    private(set) var route: BackendTransportRoute?
    private(set) var stepIndex = 0
    private(set) var location: CLLocation?
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
    }

    func start(route: BackendTransportRoute) {
        self.route = route
        stepIndex = 0
        state = .requesting
        manager.requestWhenInUseAuthorization()
        if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
            manager.startUpdatingLocation()
            state = .active
        }
    }

    func stop() {
        manager.stopUpdatingLocation()
        state = .idle
        route = nil
        location = nil
        stepIndex = 0
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.startUpdatingLocation()
            state = .active
        case .denied, .restricted:
            state = .denied
        default:
            state = .requesting
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let current = locations.last, let route else { return }
        location = current
        guard let target = route.legs[safe: stepIndex]?.toCoordinate else { return }
        let targetLocation = CLLocation(latitude: target.latitude, longitude: target.longitude)
        let distance = current.distance(from: targetLocation)
        if distance <= 50 {
            if stepIndex < route.legs.count - 1 {
                stepIndex += 1
                state = .active
            } else {
                state = .arrived
                manager.stopUpdatingLocation()
            }
        } else if distance > 2_000 {
            state = .offRoute
        } else {
            state = .active
        }
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
