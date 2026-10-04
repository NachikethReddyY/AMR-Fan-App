import Foundation

@main
struct BackendAuthChecks {
    static func main() throws {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        let pair = try PKCECodePair.make(verifier: verifier)
        precondition(pair.verifier == verifier)
        precondition(pair.challenge == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")

        let configuration = OIDCConfiguration.staging
        let url = configuration.authorizationURL(state: "state-value", codeChallenge: pair.challenge)!
        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems!
        let values = Dictionary(uniqueKeysWithValues: query.map { ($0.name, $0.value ?? "") })
        precondition(values["client_id"] == "616286cc-a22b-49a2-b5a3-27011fd615a1")
        precondition(values["redirect_uri"] == "msauth.com.amr.fanapp://auth")
        precondition(values["code_challenge_method"] == "S256")
        precondition(values["code_challenge"] == pair.challenge)
        precondition(values["state"] == "state-value")

        let form = FormURLEncoder.encode(["scope": "openid profile email api://example/access", "code": "a+b&c=d"])
        precondition(form == "code=a%2Bb%26c%3Dd&scope=openid%20profile%20email%20api%3A%2F%2Fexample%2Faccess")

        let token = try JSONDecoder().decode(OIDCTokenResponse.self, from: Data(#"{"access_token":"provider-token"}"#.utf8))
        precondition(token.accessToken == "provider-token")

        let key = "amr.backend-auth-check.\(UUID().uuidString)"
        let store = KeychainSessionStore(account: key)
        defer { try? store.delete() }
        try store.write("opaque-session")
        precondition(store.read() == "opaque-session")
        try store.write("rotated-session")
        precondition(store.read() == "rotated-session")
        try store.delete()
        precondition(store.read() == nil)

        print("BackendAuthChecks passed")
    }
}
