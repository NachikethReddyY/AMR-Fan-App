import SwiftUI

struct AccountScreen: View {
    @State private var isCreatingAccount = false
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var showsPassword = false
    @State private var showsUnavailableNotice = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 45))
                    .foregroundStyle(FanStyle.teal)
                    .padding(.top, 24)

                SectionHeader(title: isCreatingAccount ? "Join the team." : "Welcome back.",
                              description: isCreatingAccount ? "Create your fan account." : "Sign in to your fan account.")

                HStack(spacing: 8) {
                    modeButton("Sign in", isSelected: !isCreatingAccount) { isCreatingAccount = false }
                    modeButton("Create account", isSelected: isCreatingAccount) { isCreatingAccount = true }
                }

                VStack(spacing: 12) {
                    if isCreatingAccount {
                        TextField("Name", text: $displayName)
                            .textContentType(.name)
                            .textInputAutocapitalization(.words)
                            .accountField()
                    }

                    TextField("Email address", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accountField()

                    HStack {
                        Group {
                            if showsPassword {
                                TextField("Password", text: $password)
                            } else {
                                SecureField("Password", text: $password)
                            }
                        }
                        .textContentType(isCreatingAccount ? .newPassword : .password)

                        Button(showsPassword ? "Hide password" : "Show password",
                               systemImage: showsPassword ? "eye.slash" : "eye") {
                            showsPassword.toggle()
                        }
                        .labelStyle(.iconOnly)
                        .tint(FanStyle.muted)
                    }
                    .accountField()
                }

                Button {
                    showsUnavailableNotice = true
                } label: {
                    Text(isCreatingAccount ? "Create account" : "Sign in")
                        .font(.headline)
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(17)
                        .background(FanStyle.teal, in: RoundedRectangle(cornerRadius: 16))
                }
                .disabled(email.isEmpty || password.isEmpty || (isCreatingAccount && displayName.isEmpty))
                .opacity(email.isEmpty || password.isEmpty || (isCreatingAccount && displayName.isEmpty) ? 0.55 : 1)

                Label("Account access will be available when connected.", systemImage: "info.circle")
                    .font(.caption)
                    .foregroundStyle(FanStyle.muted)
            }
            .padding(24)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FanStyle.background)
        .alert("Account unavailable", isPresented: $showsUnavailableNotice) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("Sign-in and account creation will be available when the authentication service is connected. No account was created.")
        }
    }

    private func modeButton(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline.bold())
                .foregroundStyle(isSelected ? .white : FanStyle.muted)
                .frame(maxWidth: .infinity)
                .padding(13)
                .background(isSelected ? FanStyle.darkTeal : FanStyle.panel, in: Capsule())
                .overlay(Capsule().strokeBorder(isSelected ? FanStyle.teal : .clear))
        }
        .buttonStyle(.plain)
    }
}

private extension View {
    func accountField() -> some View {
        self
            .padding(16)
            .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 15))
    }
}
