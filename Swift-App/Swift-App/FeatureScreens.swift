import SwiftUI

struct ChallengesScreen: View {
    @State private var idea = ""
    @State private var showComposer = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeader(title: "Challenges.",
                              description: "Your idea. The team's stage.")

                FeatureCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("500 points to submit", systemImage: "bolt.fill")
                        Label("10+ points to support", systemImage: "heart.fill")
                        Label("Top 3 ideas selected", systemImage: "flag.checkered")
                        Text("Submission fees aren't refunded. Selection doesn't guarantee a performance.")
                            .font(.caption).foregroundStyle(FanStyle.muted)
                    }
                }

                FanButton(title: showComposer ? "Close draft" : "Draft your idea", symbol: showComposer ? "xmark" : "plus") {
                    withAnimation(.easeInOut(duration: 0.3)) { showComposer.toggle() }
                }

                if showComposer {
                    FeatureCard {
                        VStack(alignment: .leading, spacing: 15) {
                            Text("What's your idea?").font(.headline)
                            TextField("A challenge for the team…", text: $idea, axis: .vertical)
                                .lineLimit(3...6)
                                .padding(14)
                                .background(FanStyle.background, in: RoundedRectangle(cornerRadius: 12))
                            Text("Draft only · Submissions and points spending will be enabled after accounts and approval are connected.")
                                .font(.caption).foregroundStyle(FanStyle.muted)
                        }
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }

                FeatureCard {
                    Text("No approved ideas yet.")
                        .font(.headline)
                    Text("Check back soon.")
                        .font(.subheadline).foregroundStyle(FanStyle.muted).padding(.top, 6)
                }
            }
            .padding(22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background(FanStyle.background)
    }
}

struct TreeScreen: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeader(title: "Trees.",
                              description: "A planting request in your name.")

                FeatureCard {
                    HStack(spacing: 16) {
                        Image(systemName: "tree.fill")
                            .font(.title2)
                            .foregroundStyle(.white)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("0 confirmed planted").font(.headline)
                            Text("No requests yet").font(.caption).foregroundStyle(FanStyle.muted)
                        }
                    }
                }

                FeatureCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Image(systemName: "tree.fill")
                            .font(.system(size: 72)).foregroundStyle(.white.opacity(0.85))
                            .frame(maxWidth: .infinity).padding(.vertical, 25)
                        Text("A personal planting request").font(.title2.bold())
                        Text("Requested isn't planted. Follow each stage when the programme goes live.")
                            .font(.subheadline).foregroundStyle(FanStyle.muted)
                    }
                }
                Text("DEMONSTRATION · No planting, carbon removal, partner fulfilment or redemption is currently offered. Point prices will be set by the team.")
                    .font(.caption).foregroundStyle(FanStyle.muted)
            }
            .padding(22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
    }
}

struct ProfileScreen: View {
    let driver: Driver
    let changeDriver: () -> Void
    let showTour: () -> Void
    @State private var showAccount = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeader(title: "Profile.",
                              description: "Your driver. Your journey.")

                Image(driver.imageName)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 235)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 22))

                FeatureCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("Your driver", systemImage: "flag.checkered")
                            .font(.caption.bold()).foregroundStyle(FanStyle.teal)
                        Text("\(driver.firstName) \(driver.rawValue) · #\(driver.number)")
                            .font(.title3.bold())
                        Text("Your choice is saved on this device.")
                            .font(.caption).foregroundStyle(FanStyle.muted)
                    }
                }

                FanButton(title: "Change your driver", symbol: "arrow.left.arrow.right") {
                    dismiss()
                    changeDriver()
                }

                FanButton(title: "Sign in or create account", symbol: "person.crop.circle") {
                    showAccount = true
                }

                FanButton(title: "Explore app features", symbol: "questionmark.circle") {
                    dismiss()
                    showTour()
                }

                Text("Account sign-in, sync and personal history will be added when the backend is connected. No live account is active.")
                    .font(.caption).foregroundStyle(FanStyle.muted)
            }
            .padding(22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
        .sheet(isPresented: $showAccount) {
            NavigationStack {
                AccountScreen()
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            Button("Close", systemImage: "xmark") { showAccount = false }
                                .labelStyle(.iconOnly)
                        }
                    }
            }
            .preferredColorScheme(.dark)
        }
    }
}

struct HistoryScreen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            SectionHeader(title: "History.",
                          description: "Your journeys and points.")
            FeatureCard {
                Label("No activity yet", systemImage: "clock.arrow.circlepath")
                    .font(.headline)
                Text("Every great journey begins somewhere.")
                    .font(.subheadline).foregroundStyle(FanStyle.muted).padding(.top, 10)
            }
            Spacer()
        }
        .padding(22)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .background(FanStyle.background)
    }
}

struct EditorialScreen: View {
    let title: String
    let symbol: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            SectionHeader(title: title, description: description)
            FeatureCard {
                VStack(alignment: .leading, spacing: 18) {
                    Image(systemName: symbol)
                        .font(.system(size: 54))
                        .foregroundStyle(FanStyle.teal)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 46)
                    Text("Something exciting is on its way.")
                        .font(.title3.bold())
                    Text("This preview is ready for live content when your backend is connected.")
                        .font(.subheadline).foregroundStyle(FanStyle.muted)
                }
            }
            Spacer()
        }
        .padding(22)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .background(FanStyle.background)
    }
}

struct QuizScreen: View {
    @State private var questionIndex = 0
    @State private var selectedAnswer: Int?
    @State private var correctCount = 0

    private let questions: [(prompt: String, answers: [String], correct: Int)] = [
        ("What does the chequered flag mean?", ["The race is over", "A safety car is out", "The pits are open"], 0),
        ("Where does the driver on pole position start?", ["At the back", "At the front", "From the pit lane"], 1),
        ("What does a red flag mean?", ["One lap left", "The session is stopped", "A driver has won"], 1)
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionHeader(title: "Race IQ.",
                              description: "Three quick questions. Just for fun.")

                if questionIndex < questions.count {
                    let question = questions[questionIndex]
                    Text("QUESTION \(questionIndex + 1) / \(questions.count)")
                        .font(.system(size: 11, weight: .heavy)).tracking(2)
                        .foregroundStyle(FanStyle.teal)

                    FeatureCard {
                        Text(question.prompt)
                            .font(.system(size: 27, weight: .bold, design: .rounded))
                            .padding(.vertical, 15)
                    }

                    ForEach(question.answers.indices, id: \.self) { answerIndex in
                        Button {
                            guard selectedAnswer == nil else { return }
                            withAnimation(.easeInOut(duration: 0.25)) {
                                selectedAnswer = answerIndex
                                if answerIndex == question.correct { correctCount += 1 }
                            }
                        } label: {
                            HStack {
                                Text(question.answers[answerIndex])
                                Spacer()
                                if selectedAnswer != nil && answerIndex == question.correct {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(FanStyle.teal)
                                } else if selectedAnswer == answerIndex {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(FanStyle.teal)
                                }
                            }
                            .font(.subheadline.bold())
                            .padding(19)
                            .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 17))
                            .overlay(RoundedRectangle(cornerRadius: 17)
                                .strokeBorder(selectedAnswer != nil && answerIndex == question.correct ? FanStyle.teal : .clear))
                        }
                        .buttonStyle(.plain)
                    }

                    if selectedAnswer != nil {
                        FanButton(title: questionIndex + 1 == questions.count ? "See results" : "Next question",
                                  symbol: "arrow.right") {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                questionIndex += 1
                                selectedAnswer = nil
                            }
                        }
                    }
                } else {
                    FeatureCard {
                        VStack(alignment: .leading, spacing: 16) {
                            Image(systemName: "flag.checkered")
                                .font(.system(size: 52)).foregroundStyle(FanStyle.teal)
                            Text("\(correctCount) out of \(questions.count)")
                                .font(.system(size: 35, weight: .bold, design: .rounded))
                            Text("Nice lap! This is a just-for-fun preview, not a points-earning activity.")
                                .font(.subheadline).foregroundStyle(FanStyle.muted)
                        }
                    }
                    FanButton(title: "Play again", symbol: "arrow.clockwise") {
                        withAnimation {
                            questionIndex = 0
                            selectedAnswer = nil
                            correctCount = 0
                        }
                    }
                }
            }
            .padding(22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
    }
}
