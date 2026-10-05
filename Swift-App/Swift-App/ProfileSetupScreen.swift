import SwiftUI

struct ProfileSetupScreen: View {
    let profile: BackendProfile?
    let save: (String, String, String) async -> String?
    let skip: () -> Void

    @State private var name: String
    @State private var email: String
    @State private var birthday: String
    @State private var saving = false
    @State private var error: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(profile: BackendProfile?, save: @escaping (String, String, String) async -> String?, skip: @escaping () -> Void) {
        self.profile = profile
        self.save = save
        self.skip = skip
        let current = profile?.displayName ?? ""
        _name = State(initialValue: (current == "Fan" || current == "Unknown") ? "" : current)
        _email = State(initialValue: profile?.email ?? "")
        _birthday = State(initialValue: profile?.birthday ?? "")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 45))
                    .foregroundStyle(FanStyle.teal)
                    .padding(.top, 24)

                SectionHeader(
                    title: "Set up your profile.",
                    description: "Your name appears on Home. Add your birthday so we can celebrate with you."
                )

                VStack(alignment: .leading, spacing: 6) {
                    Text("Name").font(.subheadline).foregroundStyle(FanStyle.muted)
                    TextField("Your name", text: $name)
                        .textContentType(.name)
                        .autocorrectionDisabled()
                        .padding(14)
                        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Email").font(.subheadline).foregroundStyle(FanStyle.muted)
                    TextField("you@example.com", text: $email)
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

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.orange)
                }

                Button {
                    Task {
                        saving = true
                        error = await save(name.trimmingCharacters(in: .whitespaces), email.trimmingCharacters(in: .whitespaces), birthday.trimmingCharacters(in: .whitespaces))
                        saving = false
                    }
                } label: {
                    Text(saving ? "Saving…" : "Save and continue")
                        .font(.headline)
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(17)
                        .background(FanStyle.teal, in: RoundedRectangle(cornerRadius: 2))
                }
                .disabled(saving)

                Button("Skip for now", action: skip)
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)
            }
            .padding(25)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
    }
}
