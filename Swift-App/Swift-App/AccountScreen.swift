import SwiftUI

struct AccountScreen: View {
    @ObservedObject var backend: BackendSession
    @State private var name = ""
    @State private var email = ""
    @State private var birthday = ""
    @State private var saving = false
    @State private var savedMessage: String?

    private func syncFrom(_ profile: BackendProfile) {
        name = profile.displayName
        email = profile.email ?? ""
        birthday = profile.birthday ?? ""
    }

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
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Name").font(.subheadline).foregroundStyle(FanStyle.muted)
                            TextField("Name", text: $name)
                                .textContentType(.name)
                                .padding(14)
                                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Email").font(.subheadline).foregroundStyle(FanStyle.muted)
                            TextField("Email", text: $email)
                                .keyboardType(.emailAddress)
                                .textContentType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(14)
                                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Birthday").font(.subheadline).foregroundStyle(FanStyle.muted)
                            TextField("YYYY-MM-DD", text: $birthday)
                                .keyboardType(.numbersAndPunctuation)
                                .padding(14)
                                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))
                        }
                    }
                    Button {
                        Task {
                            saving = true
                            savedMessage = nil
                            await backend.updateProfile(
                                displayName: name.trimmingCharacters(in: .whitespaces).isEmpty ? nil : name.trimmingCharacters(in: .whitespaces),
                                email: email.trimmingCharacters(in: .whitespaces).isEmpty ? nil : email.trimmingCharacters(in: .whitespaces),
                                birthday: birthday.trimmingCharacters(in: .whitespaces).isEmpty ? nil : birthday.trimmingCharacters(in: .whitespaces)
                            )
                            saving = false
                            savedMessage = backend.errorMessage ?? "Saved."
                        }
                    } label: {
                        Text(saving ? "Saving…" : "Save profile")
                            .font(.headline)
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity)
                            .padding(17)
                            .background(FanStyle.teal, in: RoundedRectangle(cornerRadius: 2))
                    }
                    .disabled(saving)
                    .onAppear { syncFrom(profile) }
                    if let savedMessage {
                        Text(savedMessage).font(.footnote).foregroundStyle(FanStyle.muted)
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
