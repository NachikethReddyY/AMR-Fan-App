import SwiftUI

struct AccountScreen: View {
    @ObservedObject var backend: BackendSession
    @State private var name = ""
    @State private var email = ""
    @State private var birthday = ""
    @State private var saving = false
    @State private var savedMessage: String?
    @State private var editingEmail = false
    @State private var badgeSlot = 0
    @State private var choosingBadge = false
    @AppStorage("showcaseBadges") private var showcaseBadges = "first-race,green-trip,seven-day"

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
                    description: backend.isConnected ? "" : "Sign in securely with your AMR Fan account."
                )

                if backend.isDemoMode {
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                        Text("Demo mode. Sign-in could not be verified by the server. Your data is saved on this device only.")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                    .padding(12)
                    .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 12))
                }

                if let profile = backend.realProfile {
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Name").font(.subheadline).foregroundStyle(FanStyle.muted)
                            TextField("Name", text: $name)
                                .textContentType(.name)
                                .padding(14)
                                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("Email").font(.subheadline).foregroundStyle(FanStyle.muted)
                                Spacer()
                                Button {
                                    if !editingEmail {
                                        email = profile.email ?? ""
                                    }
                                    editingEmail.toggle()
                                } label: {
                                    Image(systemName: editingEmail ? "checkmark" : "pencil")
                                        .font(.subheadline)
                                        .foregroundStyle(FanStyle.teal)
                                }
                                .accessibilityLabel(editingEmail ? "Done editing email" : "Change email")
                            }
                            if editingEmail {
                                TextField("Email", text: $email)
                                    .keyboardType(.emailAddress)
                                    .textContentType(.emailAddress)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .padding(14)
                                    .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))
                            } else if let currentEmail = profile.email, !currentEmail.isEmpty {
                                Text(currentEmail)
                                    .padding(14)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))
                            } else {
                                Text("Not set")
                                    .foregroundStyle(FanStyle.muted)
                                    .padding(14)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))
                            }
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Birthday").font(.subheadline).foregroundStyle(FanStyle.muted)
                            TextField("YYYY-MM-DD", text: $birthday)
                                .keyboardType(.numbersAndPunctuation)
                                .padding(14)
                                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Profile badges").font(.subheadline).foregroundStyle(FanStyle.muted)
                            HStack(spacing: 14) {
                                ForEach(Array(showcasedBadgeIDs(from: showcaseBadges).enumerated()), id: \.offset) { index, id in
                                    let badge = achievement(for: id)
                                    Button {
                                        badgeSlot = index
                                        choosingBadge = true
                                    } label: {
                                        Image(systemName: badge?.symbol ?? "plus")
                                            .font(.headline)
                                            .foregroundStyle(badge == nil ? FanStyle.muted : .white)
                                            .frame(width: 52, height: 52)
                                            .background(badge?.earned == true ? FanStyle.teal : FanStyle.panel, in: Circle())
                                    }
                                    .accessibilityLabel("Choose badge for slot \(index + 1)")
                                }
                            }
                            Text("Tap a slot to choose which earned badge appears on your profile.")
                                .font(.caption).foregroundStyle(FanStyle.muted)
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
        .confirmationDialog("Showcase badge", isPresented: $choosingBadge, titleVisibility: .visible) {
            ForEach(fanAchievements.filter(\.earned)) { badge in
                Button(badge.title) {
                    var ids = showcasedBadgeIDs(from: showcaseBadges)
                    ids[badgeSlot] = badge.id
                    showcaseBadges = ids.joined(separator: ",")
                }
            }
            Button("Remove", role: .destructive) {
                var ids = showcasedBadgeIDs(from: showcaseBadges)
                ids[badgeSlot] = ""
                showcaseBadges = ids.joined(separator: ",")
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Choose which earned badge appears in this profile slot.")
        }
    }
}
