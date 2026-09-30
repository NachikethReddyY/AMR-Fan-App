import SwiftUI

struct LoginGateScreen: View {
    let openAuthentication: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Spacer()
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 46))
                .foregroundStyle(FanStyle.teal)

            Text("Your fan experience starts here.")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .fixedSize(horizontal: false, vertical: true)

            Text("Create an account or sign in to save your driver, points, journeys and rewards.")
                .font(.body)
                .foregroundStyle(FanStyle.muted)
                .fixedSize(horizontal: false, vertical: true)

            Spacer()

            Button(action: openAuthentication) {
                HStack {
                    Text("Sign in or create account")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
                .font(.headline)
                .foregroundStyle(.black)
                .padding(17)
                .background(FanStyle.teal, in: RoundedRectangle(cornerRadius: 15))
            }
            .buttonStyle(FanPressStyle())

            Text("Sign-in and sign-up pages will be connected here.")
                .font(.footnote)
                .foregroundStyle(FanStyle.muted)
        }
        .padding(25)
        .background(FanStyle.background.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

#Preview {
    LoginGateScreen(openAuthentication: {})
}
