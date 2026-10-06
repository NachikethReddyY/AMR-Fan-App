import SwiftUI

struct DriverSelectionScreen: View {
    let select: (Driver) -> Void
    @State private var appeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("I / AM")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                        .tracking(5)
                        .foregroundStyle(FanStyle.teal)
                        .padding(.top, 18)

                    Text("On this team.")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .tracking(-2)
                        .lineSpacing(-2)
                        .padding(.top, 28)

                    Text("Choose the driver you support.")
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
                                }
                                .padding(22)
                            }
                            .frame(width: min(geometry.size.width - 44, 476),
                                   height: min(geometry.size.width * 0.73, 290))
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                        }
                        .buttonStyle(FanPressStyle())
                        .accessibilityLabel("Support \(driver.firstName) \(driver.rawValue)")
                        .padding(.bottom, 20)
                    }

                }
                .padding(.horizontal, 22)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 20)
            }
        }
        .onAppear {
            if reduceMotion {
                appeared = true
            } else {
                withAnimation(FanMotion.page) { appeared = true }
            }
        }
    }
}
