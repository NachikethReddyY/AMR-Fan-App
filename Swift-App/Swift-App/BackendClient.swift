import SwiftUI
import Foundation
import UIKit
import Security
import Combine

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
    case verified
    case rejected
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

struct BackendActivityResponse: Codable {
    let kind: BackendActivityKind
    let activity: String?
    let object: String?
    let creditedPoints: Int
    let receiptId: String?
    let confidence: Double?
    let message: String?
}

@MainActor
final class BackendSession: ObservableObject {
    @Published private(set) var account: BackendAccount?
    @Published private(set) var isBusy = false
    @Published var errorMessage: String?

    private let client = BackendClient()
    private(set) var token: String?

    var isConnected: Bool { token != nil && account != nil }
    var realProfile: BackendProfile? { account?.realProfile }

    init() {
        token = KeychainStore.read("amr.session")
    }

    func resume() async {
        guard let token else { return }
        await run { self.account = try await self.client.account(token: token) }
    }

    func signInForLocalDemo() async {
        await run {
            let session = try await self.client.syntheticSignIn(fixture: "fan-a")
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
            KeychainStore.delete("amr.session")
        }
    }

    func routes(origin: String, destination: String) async throws -> BackendRouteResponse {
        guard let token else { throw BackendError.notSignedIn }
        return try await client.routes(token: token, origin: origin, destination: destination)
    }

    func verifyFixture() async throws -> BackendActivityResponse {
        guard let token, let profile = realProfile else { throw BackendError.notSignedIn }
        let result = try await client.uploadFixtureActivity(token: token, profileId: profile.id)
        if result.creditedPoints > 0 { account = try await client.account(token: token) }
        return result
    }

    func verify(image: UIImage, action: SustainabilityAction) async throws -> BackendActivityResponse {
        guard let token, let profile = realProfile else { throw BackendError.notSignedIn }
        let result = try await client.uploadActivity(
            token: token,
            profileId: profile.id,
            image: image,
            action: action
        )
        if result.creditedPoints > 0 { account = try await client.account(token: token) }
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

    var errorDescription: String? {
        switch self {
        case .notSignedIn: "Connect a fan account before verifying a photo."
        case .invalidResponse: "The backend returned an invalid response."
        case .server(_, let message): message
        case .unsupportedImage: "Choose a JPEG or PNG image."
        }
    }
}

private struct ActivityRequest: Encodable {
    let profileId: String
    let capture: String
    let mime: String
    let photoBase64: String
    let description: String
    let requestId: String
    let activity: String
}

enum BackendFixture {
    static let jpegBase64 = "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oKSj/2wBDAQcHBwoIChMKGhMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCNAEEq/9k="
}

private final class BackendClient {
    private let baseURL: URL

    init() {
        let configured = UserDefaults.standard.string(forKey: "amr.apiBaseURL")
            ?? ProcessInfo.processInfo.environment["AMR_API_URL"]
            ?? "http://127.0.0.1:8787/"
        baseURL = URL(string: configured.hasSuffix("/") ? configured : configured + "/")!
    }

    func syntheticSignIn(fixture: String) async throws -> BackendSessionResponse {
        try await request(path: "v1/dev/session", method: "POST", token: nil, body: ["fixture": fixture])
    }

    func routes(token: String, origin: String, destination: String) async throws -> BackendRouteResponse {
        try await request(path: "v1/routes/query", method: "POST", token: token, body: RouteRequest(origin: origin, destination: destination, extraMinutes: 15, modes: ["DRIVE", "TRANSIT", "WALK", "BICYCLE"]))
    }

    func account(token: String) async throws -> BackendAccount {
        try await request(path: "v1/me", method: "GET", token: token, body: EmptyBody())
    }

    func logout(token: String) async throws {
        _ = try await request(path: "v1/session", method: "DELETE", token: token, body: EmptyBody()) as EmptyResponse
    }


    func uploadActivity(token: String, profileId: String, image: UIImage, action: SustainabilityAction) async throws -> BackendActivityResponse {
        guard let data = image.jpegData(compressionQuality: 0.82) else { throw BackendError.unsupportedImage }
        return try await uploadActivityData(token: token, profileId: profileId, data: data, action: action)
    }

    func uploadFixtureActivity(token: String, profileId: String) async throws -> BackendActivityResponse {
        guard let data = Data(base64Encoded: BackendFixture.jpegBase64) else { throw BackendError.unsupportedImage }
        return try await uploadActivityData(token: token, profileId: profileId, data: data, action: .publicTransport)
    }

    private func uploadActivityData(token: String, profileId: String, data: Data, action: SustainabilityAction) async throws -> BackendActivityResponse {
        guard data.count <= 2_000_000 else { throw BackendError.unsupportedImage }
        let payload = ActivityRequest(
            profileId: profileId,
            capture: "camera",
            mime: "image/jpeg",
            photoBase64: data.base64EncodedString(),
            description: action.rawValue,
            requestId: UUID().uuidString.lowercased(),
            activity: action == .publicTransport ? "bus-trip" : "other"
        )
        return try await request(path: "v1/profiles/\(profileId)/activity/photos", method: "POST", token: token, body: payload)
    }

    private func request<T: Decodable, Body: Encodable>(path: String, method: String, token: String?, body: Body?) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { request.httpBody = try JSONEncoder().encode(body) }
        let (data, response) = try await URLSession.shared.data(for: request)
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

private enum KeychainStore {
    static func write(_ value: String, key: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query.merging([kSecValueData as String: data]) { _, new in new } as CFDictionary, nil)
    }
    static func read(_ key: String) -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    static func delete(_ key: String) {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key] as CFDictionary)
    }
}
