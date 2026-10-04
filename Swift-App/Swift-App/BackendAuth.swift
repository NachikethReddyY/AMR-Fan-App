import CryptoKit
import Foundation
import Security

struct OIDCConfiguration: Equatable {
    let authority: URL
    let clientID: String
    let apiScope: String
    let redirectURI: String
    let callbackScheme: String

    static let staging = OIDCConfiguration(
        authority: URL(string: "https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774")!,
        clientID: "616286cc-a22b-49a2-b5a3-27011fd615a1",
        apiScope: "api://f278be1f-21a5-455b-bb14-b2fc60373939/account.access",
        redirectURI: "msauth.com.amr.fanapp://auth",
        callbackScheme: "msauth.com.amr.fanapp"
    )

    var authorizeURL: URL { authority.appendingPathComponent("oauth2/v2.0/authorize") }
    var tokenURL: URL { authority.appendingPathComponent("oauth2/v2.0/token") }

    func authorizationURL(state: String, codeChallenge: String) -> URL? {
        var components = URLComponents(url: authorizeURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_mode", value: "query"),
            URLQueryItem(name: "scope", value: "openid profile email offline_access \(apiScope)"),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]
        return components?.url
    }
}

struct OIDCTokenResponse: Decodable {
    let accessToken: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
    }
}

struct PKCECodePair: Equatable {
    let verifier: String
    let challenge: String

    static func make(verifier: String? = nil) throws -> PKCECodePair {
        let verifier = try verifier ?? SecureRandom.token(byteCount: 32)
        return PKCECodePair(verifier: verifier, challenge: base64URL(Data(SHA256.hash(data: Data(verifier.utf8)))))
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

enum FormURLEncoder {
    static func encode(_ values: [String: String]) -> String {
        values
            .map { key, value in "\(encodeComponent(key))=\(encodeComponent(value))" }
            .sorted()
            .joined(separator: "&")
    }

    private static func encodeComponent(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}

enum SecureRandom {
    static func token(byteCount: Int) throws -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        let status = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        guard status == errSecSuccess else { throw SessionStoreError.random(status) }
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

protocol SessionTokenStore {
    func read() -> String?
    func write(_ value: String) throws
    func delete() throws
}

enum SessionStoreError: LocalizedError {
    case random(OSStatus)
    case keychain(OSStatus)

    var errorDescription: String? {
        "The device could not save the account session. Please try again."
    }
}

final class KeychainSessionStore: SessionTokenStore {
    private let account: String

    init(account: String = "amr.session") {
        self.account = account
    }

    private var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account
        ]
    }

    func read() -> String? {
        var query = query
        query.merge([
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]) { _, new in new }
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func write(_ value: String) throws {
        let data = Data(value.utf8)
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let addStatus = SecItemAdd(item as CFDictionary, nil)
        if addStatus == errSecSuccess { return }
        guard addStatus == errSecDuplicateItem else {
            throw SessionStoreError.keychain(addStatus)
        }

        let updateStatus = SecItemUpdate(
            query as CFDictionary,
            [
                kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            ] as CFDictionary
        )
        guard updateStatus == errSecSuccess else {
            throw SessionStoreError.keychain(updateStatus)
        }
    }

    func delete() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SessionStoreError.keychain(status)
        }
    }
}
