import SwiftUI

struct AccountScreen: View {
    @ObservedObject var backend: BackendSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 45))
                    .foregroundStyle(FanStyle.teal)
                    .padding(.top, 24)

                SectionHeader(
                    title: backend.isConnected ? "Your account." : "Connect your account.",
                    description: backend.isConnected ? "Your backend profile and earned balance." : "Sign in securely with your AMR Fan account."
                )

                if let profile = backend.realProfile {
                    FeatureCard {
                        Text(profile.displayName)
                            .font(.title3.bold())
                        Text("\(profile.balance) earned points")
                            .font(.headline)
                            .foregroundStyle(FanStyle.teal)
                        Text("This balance is stored by the backend. Local demo Green Points remain separate.")
                            .font(.footnote)
                            .foregroundStyle(FanStyle.muted)
                    }
                    Button("Sign out") { Task { await backend.signOut() } }
                        .foregroundStyle(FanStyle.teal)
                } else {
                    Button {
                        Task { await backend.signIn() }
                    } label: {
                        Text(backend.isBusy ? "Connecting…" : "Sign in")
                            .font(.headline)
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity)
                            .padding(17)
                            .background(FanStyle.teal, in: RoundedRectangle(cornerRadius: 16))
                    }
                    .disabled(backend.isBusy)
                }

                if let error = backend.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            }
            .padding(24)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
    }
}
