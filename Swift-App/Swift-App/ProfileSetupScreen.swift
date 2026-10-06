import Foundation
import SwiftUI
import UIKit

struct ProfileSetupScreen: View {
    let profile: BackendProfile?
    let save: (String, String, String) async -> String?
    let skip: () -> Void

    @State private var name: String
    @State private var email: String
    @State private var birthday: String
    @State private var saving = false
    @State private var error: String?
    @State private var hasSubmitted = false

    init(profile: BackendProfile?, save: @escaping (String, String, String) async -> String?, skip: @escaping () -> Void) {
        self.profile = profile
        self.save = save
        self.skip = skip
        let current = profile?.displayName ?? ""
        _name = State(initialValue: (current == "Fan" || current == "Unknown") ? "" : current)
        _email = State(initialValue: profile?.email ?? "")
        _birthday = State(initialValue: profile?.birthday ?? "")
    }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedBirthday: String { birthday.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var nameError: String? {
        trimmedName.isEmpty ? "Enter your name to continue." : nil
    }

    private var emailError: String? {
        guard !trimmedEmail.isEmpty else { return nil }
        let pattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        return trimmedEmail.range(of: pattern, options: .regularExpression) == nil
            ? "Enter a valid email address or leave it blank."
            : nil
    }

    private var birthdayError: String? {
        guard !trimmedBirthday.isEmpty else { return "Enter your birthday to continue." }
        guard let date = ISO8601DateFormatter.profileBirthday.date(from: trimmedBirthday) else {
            return "Use your birthday in YYYY-MM-DD format."
        }
        return date > Calendar.current.startOfDay(for: Date())
            ? "Birthday cannot be in the future."
            : nil
    }

    private var formError: String? { nameError ?? emailError ?? birthdayError }
    private var canSave: Bool { formError == nil && !saving }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 40))
                    .foregroundStyle(FanStyle.teal)
                    .padding(.top, 8)

                SectionHeader(
                    title: "Set up your profile.",
                    description: "Your name appears on Home. Add your birthday so we can celebrate with you."
                )

                profileField(title: "Name", placeholder: "Your name", text: $name, contentType: .name, keyboard: .default, isEmail: false, error: hasSubmitted ? nameError : nil)
                profileField(title: "Email (optional)", placeholder: "you@example.com", text: $email, contentType: .emailAddress, keyboard: .emailAddress, isEmail: true, error: hasSubmitted ? emailError : nil)
                profileField(title: "Birthday", placeholder: "YYYY-MM-DD", text: $birthday, contentType: nil, keyboard: .numbersAndPunctuation, isEmail: false, error: hasSubmitted ? birthdayError : nil)

                if hasSubmitted, formError != nil {
                    Text("Please correct the highlighted fields.")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                } else if !canSave {
                    Text("Enter your name and birthday to continue, or skip for now.")
                        .font(.footnote)
                        .foregroundStyle(FanStyle.muted)
                }

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }

                Button {
                    hasSubmitted = true
                    guard canSave else { return }
                    Task {
                        saving = true
                        error = await save(trimmedName, trimmedEmail, trimmedBirthday)
                        if let error, error.localizedCaseInsensitiveContains("displayName") {
                            self.error = "We couldn’t save your profile. Please try again."
                        }
                        saving = false
                    }
                } label: {
                    Text(saving ? "Saving…" : "Save and continue")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(canSave ? .white : FanStyle.muted)
                        .frame(maxWidth: .infinity)
                        .padding(17)
                        .background(canSave ? FanStyle.astonGreen : FanStyle.panel, in: RoundedRectangle(cornerRadius: 2))
                }
                .disabled(!canSave)
                .accessibilityHint(canSave ? "Saves your profile details." : "Enter a name and birthday first.")

                Button("Skip for now", action: skip)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(FanStyle.muted)
                    .frame(minHeight: 44)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
    }

    @ViewBuilder
    private func profileField(title: String, placeholder: String, text: Binding<String>, contentType: UITextContentType?, keyboard: UIKeyboardType, isEmail: Bool, error: String?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(FanStyle.muted)
            TextField(placeholder, text: text)
                .textContentType(contentType)
                .keyboardType(keyboard)
                .textInputAutocapitalization(isEmail ? .never : .sentences)
                .autocorrectionDisabled(isEmail)
                .padding(14)
                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 12))
                .overlay {
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(error == nil ? .clear : .orange.opacity(0.8), lineWidth: 1)
                }
            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
    }
}

private extension ISO8601DateFormatter {
    static let profileBirthday: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter
    }()
}
