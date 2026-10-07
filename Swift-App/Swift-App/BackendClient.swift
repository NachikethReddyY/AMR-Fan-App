import SwiftUI
import Foundation
import UIKit
import Combine
import AuthenticationServices

struct BackendProfile: Codable, Equatable {
    let id: String
    let kind: String
    let displayName: String
    let balance: Int
    let email: String?
    let birthday: String?

    var needsProfileSetup: Bool {
        let name = displayName.trimmingCharacters(in: .whitespaces)
        return name.isEmpty || name == "Fan" || name == "Unknown" || (birthday?.isEmpty ?? true)
    }
}

struct BackendAccount: Codable, Equatable {
    let id: String
    let role: String
    let profiles: [BackendProfile]

    var realProfile: BackendProfile? { profiles.first(where: { $0.kind == "real" }) }
}

struct BackendHistoryEntry: Decodable, Identifiable {
    let id: String
    let sequence: String
    let profileId: String
    let actorId: String
    let kind: String
    let delta: Int
    let balanceAfter: Int
    let reason: String
    let recordedAt: String
}

struct BackendHistoryPage: Decodable {
    let profile: BackendProfile
    let balance: Int
    let entries: [BackendHistoryEntry]
    let nextCursor: String?
}

struct BackendImpactTotal: Decodable {
    let kind: String
    let savingsKg: String?
    let journeyCount: Int?
    let excludedJourneys: Int?
    let reasons: [String]?
}

struct BackendParticipation: Decodable {
    let kind: String
    let activityCount: Int?
    let missionsCompleted: Int?
    let pointsEarned: Int?
    let reason: String?
}

struct BackendImpactOverview: Decodable {
    let personal: BackendImpactTotal
    let community: BackendImpactTotal
    let personalParticipation: BackendParticipation
    let communityParticipation: BackendParticipation
    let officialStatus: String

    init(from decoder: Decoder) throws {
        let root = try decoder.container(keyedBy: CodingKeys.self)
        let fan = try root.nestedContainer(keyedBy: FanKeys.self, forKey: .fan)
        let personal = try fan.nestedContainer(keyedBy: ImpactKeys.self, forKey: .personal)
        let community = try fan.nestedContainer(keyedBy: ImpactKeys.self, forKey: .community)
        self.personal = try personal.decode(BackendImpactTotal.self, forKey: .travel)
        self.community = try community.decode(BackendImpactTotal.self, forKey: .travel)
        self.personalParticipation = try personal.decode(BackendParticipation.self, forKey: .participation)
        self.communityParticipation = try community.decode(BackendParticipation.self, forKey: .participation)
        let official = try root.nestedContainer(keyedBy: OfficialKeys.self, forKey: .official)
        officialStatus = try official.decode(String.self, forKey: .status)
    }

    private enum CodingKeys: String, CodingKey { case fan, official }
    private enum FanKeys: String, CodingKey { case personal, community }
    private enum ImpactKeys: String, CodingKey { case travel, participation }
    private enum OfficialKeys: String, CodingKey { case status }
}

struct BackendSessionResponse: Codable {
    let token: String
    let expiresAt: String
    let account: BackendAccount
}

enum BackendActivityKind: String, Codable {
    case accepted
    case uncertain
    case rejected
    case cancelled
    case expired
    case unavailable
}

struct BackendRouteLeg: Decodable, Identifiable {
    let mode: String
    let distanceMeters: Double
    let durationSeconds: Double
    let description: String
    var id: String { "\(mode)-\(description)-\(durationSeconds)" }
}

struct BackendRouteOption: Decodable, Identifiable {
    let id: String
    let mode: String
    let availability: BackendRouteAvailability
    let legs: [BackendRouteLeg]
    let distanceMeters: Double?
    let durationSeconds: Double?
}

struct BackendRouteAvailability: Decodable {
    let kind: String
    let reason: String?
}

struct BackendRouteResponse: Decodable {
    let result: BackendRouteResult
    let estimates: [BackendRouteEstimate]
    let recommendation: BackendRouteRecommendation?
    let jev: BackendJevRank?
}

struct BackendJevRank: Decodable {
    let kind: String
    let orderedRouteIds: [String]?
    let reason: String?
}

struct BackendTransportCoordinate: Codable {
    let latitude: Double
    let longitude: Double
}

struct BackendTransportLeg: Decodable, Identifiable {
    let kind: String
    let mode: String
    let from: String
    let to: String
    let startsAt: String
    let endsAt: String
    let durationSeconds: Double
    let description: String
    let instruction: String?
    let fromCoordinate: BackendTransportCoordinate?
    let toCoordinate: BackendTransportCoordinate?
    let path: [BackendTransportCoordinate]?
    var id: String { "\(kind)-\(from)-\(to)-\(startsAt)" }
}

struct BackendTransportRoute: Decodable, Identifiable {
    let id: String
    let mode: String
    let legs: [BackendTransportLeg]
    let durationSeconds: Double
    let waitSeconds: Double
    let transfers: Int
    let arrivesAt: String
    let meetsDeadline: Bool
    let distanceMeters: Double?

    var displayTitle: String {
        let modes = Set(legs.map(\.mode))
        return modes.contains("train") && modes.contains("bus") || mode == "transit" ? "Train + bus" : mode.capitalized
    }
}

struct BackendTransportUnavailable: Decodable {
    let mode: String
    let reason: String
}

struct BackendTransportRecommendation: Decodable {
    let kind: String
    let routeId: String?
    let reason: String
}

struct BackendTransportPlan: Decodable {
    let routes: [BackendTransportRoute]
    let unavailable: [BackendTransportUnavailable]
    let estimates: [BackendTransportEstimate]?
    let recommendation: BackendTransportRecommendation
    let jev: BackendJevRank?
    let awardEligible: Bool
}

struct BackendTransportEstimate: Decodable {
    let routeId: String
    let estimate: BackendEstimate
    let distanceMethod: String?
}

struct BackendRouteResult: Decodable {
    let kind: String
    let routes: [BackendRouteOption]?
    let reason: String?
}

struct BackendRouteEstimate: Decodable {
    let routeId: String
    let estimate: BackendEstimate
}

struct BackendEstimate: Decodable {
    let kind: String
    let kgCo2e: Double?
    let kg: Double?
    let reason: String?
}

struct BackendRouteRecommendation: Decodable {
    let kind: String
    let route: BackendRouteOption?
    let avoidedKgCo2e: Double?
    let avoidedKg: Double?
    let reason: String?
}

private struct RouteRequest: Encodable {
    let origin: String
    let destination: String
    let extraMinutes: Int
    let modes: [String]
}

private enum BackendTransportPlace: Encodable {
    case name(String)
    case coordinate(BackendTransportCoordinate)

    func encode(to encoder: Encoder) throws {
        switch self {
        case .name(let value):
            var container = encoder.singleValueContainer()
            try container.encode(value)
        case .coordinate(let value):
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(value.latitude, forKey: .latitude)
            try container.encode(value.longitude, forKey: .longitude)
        }
    }

    private enum CodingKeys: String, CodingKey { case latitude, longitude }
}

private struct TransportRequest: Encodable {
    let origin: BackendTransportPlace
    let destination: BackendTransportPlace
    let departAt: String
    let modes: [String] = ["train", "bus", "walk", "car"]
    let extraMinutes: Int = 15
}

struct BackendActivityReward: Decodable {
    let kind: String
    let points: Int
    let receiptId: String?
    let balanceAfter: Int?
    let policyVersion: String?
    let reason: String?
}

struct BackendActivityResponse: Decodable {
    let kind: BackendActivityKind
    let assessmentId: String?
    let category: String?
    let evidenceScore: Int?
    let confidence: Double?
    let rationale: String?
    let reason: String?
    let reward: BackendActivityReward?

    var activity: String? { category }
    var object: String? { category }
    var creditedPoints: Int { reward?.points ?? 0 }
    var receiptId: String? { reward?.receiptId }
    var message: String? { rationale ?? reason?.replacingOccurrences(of: "_", with: " ").capitalized }
}

private struct BackendActivityAvailability: Decodable {
    let kind: String
}

enum PhotoCapture: String {
    case camera
    case gallery
}

@MainActor
final class BackendSession: ObservableObject {
    @Published private(set) var account: BackendAccount?
    @Published private(set) var isBusy = false
    @Published var errorMessage: String?
    @Published private(set) var history: BackendHistoryPage?
    @Published private(set) var impact: BackendImpactOverview?
    @Published private(set) var isDemoMode = false

    private let client = BackendClient()
    private let sessionStore: SessionTokenStore
    private(set) var token: String?
    private var demoProfile: BackendProfile?

    var isConnected: Bool { (token != nil && account != nil) || isDemoMode }
    var realProfile: BackendProfile? { isDemoMode ? demoProfile : account?.realProfile }

    init(sessionStore: SessionTokenStore? = nil) {
        let sessionStore = sessionStore ?? KeychainSessionStore()
        self.sessionStore = sessionStore
        token = sessionStore.read()
    }

    func resume() async {
        guard let token else { return }
        await run { self.account = try await self.client.account(token: token) }
    }

    #if DEBUG
    func signInForLocalDemo() async {
        await run {
            let session = try await self.client.syntheticSignIn(fixture: "fan-a")
            self.token = session.token
            self.account = session.account
            try self.sessionStore.write(session.token)
        }
    }
    #endif

    func signIn() async {
        await run {
            let providerToken = try await self.client.authorize()
            let session = try await self.client.exchange(providerAccessToken: providerToken)
            try self.sessionStore.write(session.token)
            self.token = session.token
            self.account = session.account
        }
        if errorMessage != nil {
            await enterDemoMode()
        }
    }

    private func enterDemoMode() async {
        isDemoMode = true
        isBusy = false
        errorMessage = nil
        demoProfile = BackendProfile(
            id: "demo-profile",
            kind: "real",
            displayName: "Demo Fan",
            balance: 1000,
            email: "demo@amr.fan",
            birthday: "2000-01-01"
        )
        account = BackendAccount(
            id: "demo-account",
            role: "fan",
            profiles: [demoProfile!]
        )
    }

    func signOut() async {
        if isDemoMode {
            isDemoMode = false
            demoProfile = nil
            account = nil
            return
        }
        guard let token else { return }
        await run {
            try await self.client.logout(token: token)
            self.token = nil
            self.account = nil
            self.history = nil
            self.impact = nil
            try self.sessionStore.delete()
        }
    }

    func updateProfile(displayName: String?, email: String?, birthday: String?) async {
        if isDemoMode {
            if let profile = demoProfile {
                demoProfile = BackendProfile(
                    id: profile.id,
                    kind: profile.kind,
                    displayName: displayName ?? profile.displayName,
                    balance: profile.balance,
                    email: email ?? profile.email,
                    birthday: birthday ?? profile.birthday
                )
                account = BackendAccount(
                    id: account?.id ?? "demo-account",
                    role: account?.role ?? "fan",
                    profiles: [demoProfile!]
                )
            }
            return
        }
        guard let token, let profile = realProfile else { errorMessage = BackendError.notSignedIn.errorDescription; return }
        await run {
            _ = try await self.client.updateProfile(token: token, profileId: profile.id, displayName: displayName, email: email, birthday: birthday)
            self.account = try await self.client.account(token: token)
        }
    }

    func routes(origin: String, destination: String) async throws -> BackendRouteResponse {
        guard let token else { throw BackendError.notSignedIn }
        return try await client.routes(token: token, origin: origin, destination: destination)
    }

    func loadHistory() async {
        guard let token, let profile = realProfile else { return }
        do { history = try await client.history(token: token, profileId: profile.id) }
        catch { errorMessage = error.localizedDescription }
    }

    func loadImpact() async {
        guard let token, let profile = realProfile else { return }
        do { impact = try await client.impact(token: token, profileId: profile.id) }
        catch { errorMessage = error.localizedDescription }
    }

    func transportPlan(origin: String, destination: String) async throws -> BackendTransportPlan {
        return try await client.transportPlan(token: token, origin: origin, destination: destination)
    }

    func transportPlan(origin: BackendTransportCoordinate, destination: BackendTransportCoordinate) async throws -> BackendTransportPlan {
        return try await client.transportPlan(token: token, origin: origin, destination: destination)
    }

    func verify(image: UIImage, capture: PhotoCapture) async throws -> BackendActivityResponse {
        guard let token, let profile = realProfile else { throw BackendError.notSignedIn }
        guard try await client.activityAvailable(token: token, profileId: profile.id) else {
            throw BackendError.verificationUnavailable
        }
        let result = try await client.uploadActivity(
            token: token,
            profileId: profile.id,
            image: image,
            capture: capture
        )
        if result.creditedPoints > 0 { account = try? await client.account(token: token) }
        return result
    }

    private func run(_ operation: @escaping () async throws -> Void) async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do { try await operation() }
        catch { errorMessage = error.localizedDescription }
    }
}

enum BackendError: LocalizedError {
    case notSignedIn
    case invalidResponse
    case server(Int, String)
    case unsupportedImage
    case verificationUnavailable
    case authFailed

    var errorDescription: String? {
        switch self {
        case .notSignedIn: "Connect a fan account before verifying a photo."
        case .invalidResponse: "The backend returned an invalid response."
        case .server(_, let message): message
        case .unsupportedImage: "Choose a photo smaller than 2 MB after compression."
        case .verificationUnavailable: "Photo analysis is not available on this backend yet. Your photo was not uploaded."
        case .authFailed: "Sign-in could not be completed. Please try again."
        }
    }
}

private final class AuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = AuthPresentationContext()

    func presentationAnchor(for _: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}

private struct ActivityRequest: Encodable {
    let requestId: String
    let description: String
    let photos: [ActivityPhoto]
    let missionId: String?
    let journeyId: String?
}

private struct ActivityPhoto: Encodable {
    let mime: String
    let base64: String
}

private final class BackendClient {
    private let baseURL: URL
    private let oidc: OIDCConfiguration
    private let urlSession: URLSession
    private var authenticationSession: ASWebAuthenticationSession?

    init(
        baseURL: URL? = nil,
        oidc: OIDCConfiguration = .staging,
        urlSession: URLSession = .shared
    ) {
        let configured = UserDefaults.standard.string(forKey: "amr.apiBaseURL")
            ?? ProcessInfo.processInfo.environment["AMR_API_URL"]
            ?? "https://amr-fan-api-x324zttj6p6tg.greenmeadow-563586c6.southeastasia.azurecontainerapps.io/"
        self.baseURL = baseURL ?? URL(string: configured.hasSuffix("/") ? configured : configured + "/")!
        self.oidc = oidc
        self.urlSession = urlSession
    }

    @MainActor
    func authorize() async throws -> String {
        let pkce = try PKCECodePair.make()
        let state = try SecureRandom.token(byteCount: 32)
        guard let url = oidc.authorizationURL(state: state, codeChallenge: pkce.challenge) else { throw BackendError.authFailed }

        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: oidc.callbackScheme) { [weak self] callback, error in
                self?.authenticationSession = nil
                if let error { continuation.resume(throwing: error); return }
                guard let callback else { continuation.resume(throwing: BackendError.authFailed); return }
                continuation.resume(returning: callback)
            }
            session.presentationContextProvider = AuthPresentationContext.shared
            session.prefersEphemeralWebBrowserSession = false
            authenticationSession = session
            guard session.start() else {
                authenticationSession = nil
                continuation.resume(throwing: BackendError.authFailed)
                return
            }
        }
        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
            throw BackendError.authFailed
        }
        if components.queryItems?.contains(where: { $0.name == "error" }) == true { throw BackendError.authFailed }
        guard let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
            throw BackendError.authFailed
        }
        guard components.queryItems?.first(where: { $0.name == "state" })?.value == state else {
            throw BackendError.authFailed
        }
        return try await exchangeCode(code, verifier: pkce.verifier)
    }

    private func exchangeCode(_ code: String, verifier: String) async throws -> String {
        var request = URLRequest(url: oidc.tokenURL)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = FormURLEncoder.encode([
            "client_id": oidc.clientID, "grant_type": "authorization_code", "code": code,
            "redirect_uri": oidc.redirectURI, "code_verifier": verifier, "scope": "openid profile email offline_access \(oidc.apiScope)"
        ]).data(using: .utf8)
        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let payload = try? JSONDecoder().decode(OIDCTokenResponse.self, from: data) else { throw BackendError.authFailed }
        return payload.accessToken
    }

    func exchange(providerAccessToken: String) async throws -> BackendSessionResponse {
        try await request(path: "v1/session", method: "POST", token: providerAccessToken, body: EmptyBody())
    }

    #if DEBUG
    func syntheticSignIn(fixture: String) async throws -> BackendSessionResponse {
        try await request(path: "v1/dev/session", method: "POST", token: nil, body: ["fixture": fixture])
    }
    #endif

    func routes(token: String, origin: String, destination: String) async throws -> BackendRouteResponse {
        try await request(path: "v1/routes/query", method: "POST", token: token, body: RouteRequest(origin: origin, destination: destination, extraMinutes: 15, modes: ["DRIVE", "TRANSIT", "WALK", "BICYCLE"]))
    }

    func history(token: String, profileId: String) async throws -> BackendHistoryPage {
        try await request(path: "v1/profiles/\(profileId)/points/history?limit=25", method: "GET", token: token, body: EmptyBody())
    }

    func impact(token: String, profileId: String) async throws -> BackendImpactOverview {
        try await request(path: "v1/impact/overview?profileId=\(profileId)", method: "GET", token: token, body: EmptyBody())
    }

    func transportPlan(token: String?, origin: String, destination: String) async throws -> BackendTransportPlan {
        try await transportPlan(token: token, origin: .name(origin), destination: .name(destination))
    }

    func transportPlan(token: String?, origin: BackendTransportCoordinate, destination: BackendTransportCoordinate) async throws -> BackendTransportPlan {
        try await transportPlan(token: token, origin: .coordinate(origin), destination: .coordinate(destination))
    }

    private func transportPlan(token: String?, origin: BackendTransportPlace, destination: BackendTransportPlace) async throws -> BackendTransportPlan {
        try await request(path: "v1/transport/plan", method: "POST", token: token, body: TransportRequest(origin: origin, destination: destination, departAt: ISO8601DateFormatter().string(from: Date())))
    }

    func account(token: String) async throws -> BackendAccount {
        try await request(path: "v1/me", method: "GET", token: token, body: EmptyBody())
    }

    func logout(token: String) async throws {
        _ = try await request(path: "v1/session", method: "DELETE", token: token, body: EmptyBody()) as EmptyResponse
    }


    private struct ProfileUpdatePayload: Encodable {
        var displayName: String?
        var email: String?
        var birthday: String?
    }

    func updateProfile(token: String, profileId: String, displayName: String?, email: String?, birthday: String?) async throws -> BackendProfile {
        try await request(path: "v1/profiles/\(profileId)", method: "PATCH", token: token, body: ProfileUpdatePayload(displayName: displayName, email: email, birthday: birthday))
    }

    func activityAvailable(token: String, profileId: String) async throws -> Bool {
        let response: BackendActivityAvailability = try await request(
            path: "v1/profiles/\(profileId)/activity-submissions/availability", method: "GET", token: token, body: EmptyBody()
        )
        return response.kind == "available"
    }

    func uploadActivity(token: String, profileId: String, image: UIImage, capture _: PhotoCapture) async throws -> BackendActivityResponse {
        guard let data = PhotoUploadEncoder.jpegData(for: image) else { throw BackendError.unsupportedImage }
        let payload = ActivityRequest(requestId: UUID().uuidString.lowercased(), description: "Identify the sustainable activity visible in this photo.", photos: [ActivityPhoto(mime: "image/jpeg", base64: data.base64EncodedString())], missionId: nil, journeyId: nil)
        do {
            return try await request(path: "v1/profiles/\(profileId)/activity-submissions", method: "POST", token: token, body: payload)
        } catch BackendError.server(503, _) {
            throw BackendError.verificationUnavailable
        } catch BackendError.server(413, _) {
            throw BackendError.unsupportedImage
        }
    }

    private func request<T: Decodable, Body: Encodable>(path: String, method: String, token: String?, body: Body?) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body, HTTPRequestBodyPolicy.shouldEncodeBody(for: method) {
            request.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw BackendError.invalidResponse }
        if !(200..<300).contains(http.statusCode) {
            let message = (try? JSONDecoder().decode(ErrorResponse.self, from: data).error) ?? "The backend could not complete the request."
            throw BackendError.server(http.statusCode, message)
        }
        guard let result = try? JSONDecoder().decode(T.self, from: data) else { throw BackendError.invalidResponse }
        return result
    }

    private struct ErrorResponse: Decodable { let error: String }
    private struct EmptyResponse: Decodable { }
    private struct EmptyBody: Encodable { }
}
