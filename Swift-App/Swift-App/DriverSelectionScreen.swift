import SwiftUI

struct DriverSelectionScreen: View {
    let select: (Driver) -> Void
    let openAccount: () -> Void
    @State private var appeared = false

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("I / AM")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                        .tracking(5)
                        .foregroundStyle(FanStyle.teal)
                        .padding(.top, 18)

                    Text("Choose your\nTeam.")
                        .font(.system(size: 43, weight: .bold, design: .rounded))
                        .tracking(-2)
                        .lineSpacing(-2)
                        .padding(.top, 28)

                    Text("Every fan has a side. Who's yours?")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                        .padding(.top, 9)
                        .padding(.bottom, 32)

                    ForEach(Driver.allCases) { driver in
                        Button {
                            select(driver)
                        } label: {
                            ZStack(alignment: .bottomLeading) {
                                Image(driver.imageName)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: min(geometry.size.width - 44, 476),
                                           height: min(geometry.size.width * 0.73, 290))
                                    .clipped()

                                LinearGradient(colors: [.clear, .black.opacity(0.45)], startPoint: .center, endPoint: .bottom)

                                HStack {
                                    Text("TEAM \(driver.rawValue.uppercased())")
                                        .font(.system(size: 11, weight: .heavy))
                                        .tracking(2)
                                    Spacer()
                                    Image(systemName: "arrow.up.right")
                                        .foregroundStyle(FanStyle.teal)
                                }
                                .padding(22)
                            }
                            .frame(width: min(geometry.size.width - 44, 476),
                                   height: min(geometry.size.width * 0.73, 290))
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Support \(driver.firstName) \(driver.rawValue)")
                        .padding(.bottom, 20)
                    }

                    Text("You can switch drivers anytime in your profile.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 15)

                    Button(action: openAccount) {
                        Text("Already a fan? Sign in")
                            .font(.subheadline.bold())
                            .foregroundStyle(FanStyle.teal)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .padding(.bottom, 20)
                }
                .padding(.horizontal, 22)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 20)
            }
        }
        .onAppear { withAnimation(.easeOut(duration: 0.65)) { appeared = true } }
    }
}
