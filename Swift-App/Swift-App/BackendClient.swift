import SwiftUI
import Foundation
import UIKit
import Combine
import AuthenticationServices
<<<<<<< Updated upstream
=======
import CryptoKit
>>>>>>> Stashed changes

struct BackendProfile: Codable, Equatable {
    let id: String
    let kind: String
    let displayName: String
    let balance: Int
}

struct BackendAccount: Codable, Equatable {
    let id: String
    let role: String
    let profiles: [BackendProfile]

    var realProfile: BackendProfile? { profiles.first(where: { $0.kind == "real" }) }
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

private struct RouteRequest: Encodable {
    let origin: String
    let destination: String
    let extraMinutes: Int
    let modes: [String]
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

    private let client = BackendClient()
    private let sessionStore: SessionTokenStore
    private(set) var token: String?

    var isConnected: Bool { token != nil && account != nil }
    var realProfile: BackendProfile? { account?.realProfile }

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
    }

    func signIn() async {
        await run {
            let providerToken = try await self.client.authorize()
            let session = try await self.client.exchange(providerAccessToken: providerToken)
            self.token = session.token
            self.account = session.account
            KeychainStore.write(session.token, key: "amr.session")
        }
    }

    func signOut() async {
        guard let token else { return }
        await run {
            try await self.client.logout(token: token)
            self.token = nil
            self.account = nil
            try self.sessionStore.delete()
        }
    }

    func routes(origin: String, destination: String) async throws -> BackendRouteResponse {
        guard let token else { throw BackendError.notSignedIn }
        return try await client.routes(token: token, origin: origin, destination: destination)
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
<<<<<<< Updated upstream
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
=======
        baseURL = URL(string: configured.hasSuffix("/") ? configured : configured + "/")!
    }

    private let authority = URL(string: "https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774")!
    private let clientID = "616286cc-a22b-49a2-b5a3-27011fd615a1"
    private let apiScope = "api://f278be1f-21a5-455b-bb14-b2fc60373939/account.access"
    private let redirectURI = "msauth.com.amr.fanapp://auth"

    @MainActor
    func authorize() async throws -> String {
        let verifier = Self.randomString()
        let challenge = Self.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        var components = URLComponents(url: authority.appendingPathComponent("oauth2/v2.0/authorize"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_mode", value: "query"),
            URLQueryItem(name: "scope", value: "openid profile email offline_access \(apiScope)"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]
        guard let url = components.url else { throw BackendError.authFailed }

        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "msauth.com.amr.fanapp") { callback, error in
>>>>>>> Stashed changes
                if let error { continuation.resume(throwing: error); return }
                guard let callback else { continuation.resume(throwing: BackendError.authFailed); return }
                continuation.resume(returning: callback)
            }
            session.presentationContextProvider = AuthPresentationContext.shared
            session.prefersEphemeralWebBrowserSession = false
<<<<<<< Updated upstream
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
=======
            guard session.start() else { continuation.resume(throwing: BackendError.authFailed); return }
        }
        guard let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value else {
            throw BackendError.authFailed
        }
        return try await exchangeCode(code, verifier: verifier)
    }

    private func exchangeCode(_ code: String, verifier: String) async throws -> String {
        var request = URLRequest(url: authority.appendingPathComponent("oauth2/v2.0/token"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = [
            "client_id": clientID, "grant_type": "authorization_code", "code": code,
            "redirect_uri": redirectURI, "code_verifier": verifier, "scope": "openid profile email offline_access \(apiScope)"
        ].map { pair in
            let encoded = pair.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? pair.value
            return "\(pair.key)=\(encoded)"
        }.joined(separator: "&").data(using: .utf8)
        let (data, response) = try await URLSession.shared.data(for: request)
>>>>>>> Stashed changes
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let payload = try? JSONDecoder().decode(OIDCTokenResponse.self, from: data) else { throw BackendError.authFailed }
        return payload.accessToken
    }

    func exchange(providerAccessToken: String) async throws -> BackendSessionResponse {
        try await request(path: "v1/session", method: "POST", token: providerAccessToken, body: EmptyBody())
    }

<<<<<<< Updated upstream
    #if DEBUG
=======
    private struct OIDCTokenResponse: Decodable { let accessToken: String
        enum CodingKeys: String, CodingKey { case accessToken = "access_token" }
    }

    private static func randomString() -> String {
        base64URL(Data((0..<32).map { _ in UInt8.random(in: 0...255) }))
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

>>>>>>> Stashed changes
    func syntheticSignIn(fixture: String) async throws -> BackendSessionResponse {
        try await request(path: "v1/dev/session", method: "POST", token: nil, body: ["fixture": fixture])
    }
    #endif

    func routes(token: String, origin: String, destination: String) async throws -> BackendRouteResponse {
        try await request(path: "v1/routes/query", method: "POST", token: token, body: RouteRequest(origin: origin, destination: destination, extraMinutes: 15, modes: ["DRIVE", "TRANSIT", "WALK", "BICYCLE"]))
    }

    func account(token: String) async throws -> BackendAccount {
        try await request(path: "v1/me", method: "GET", token: token, body: EmptyBody())
    }

    func logout(token: String) async throws {
        _ = try await request(path: "v1/session", method: "DELETE", token: token, body: EmptyBody()) as EmptyResponse
    }


    func activityAvailable(token: String, profileId: String) async throws -> Bool {
        let response: BackendActivityAvailability = try await request(
            path: "v1/profiles/\(profileId)/activity-submissions/availability", method: "GET", token: token, body: EmptyBody()
        )
        return response.kind == "available"
    }

<<<<<<< Updated upstream
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
=======
    func uploadActivity(token: String, profileId: String, image: UIImage, capture: PhotoCapture) async throws -> BackendActivityResponse {
        guard let data = image.jpegData(compressionQuality: 0.82) else { throw BackendError.unsupportedImage }
        guard data.count <= 2_000_000 else { throw BackendError.unsupportedImage }
        let payload = ActivityRequest(requestId: UUID().uuidString.lowercased(), description: "Identify the sustainable activity visible in this photo.", photos: [ActivityPhoto(mime: "image/jpeg", base64: data.base64EncodedString())], missionId: nil, journeyId: nil)
        return try await request(path: "v1/profiles/\(profileId)/activity-submissions", method: "POST", token: token, body: payload)
>>>>>>> Stashed changes
    }

    private func request<T: Decodable, Body: Encodable>(path: String, method: String, token: String?, body: Body?) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { request.httpBody = try JSONEncoder().encode(body) }
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
