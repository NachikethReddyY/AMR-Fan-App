import Foundation
import SwiftUI

struct NewsFeedItem: Identifiable, Sendable {
    let id: String
    let title: String
    let summary: String
    let articleURL: URL
    let imageURL: URL?
    let publishedAt: Date?

    var dateLabel: String {
        guard let publishedAt else { return "Latest" }
        return publishedAt.formatted(.dateTime.day().month(.abbreviated).year())
    }
}

enum NewsFeedState {
    case loading
    case loaded([NewsFeedItem])
    case empty
    case failed
}

struct NewsFeedScreen: View {
    private static let feedURL = URL(string: "https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml")
    @State private var state: NewsFeedState = .loading

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                feedHeader
                content
            }
            .padding(.horizontal, 20)
            .padding(.top, 22)
            .padding(.bottom, 32)
            .frame(maxWidth: 620)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background(FanStyle.background.ignoresSafeArea())
        .navigationTitle("News")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadFeed() }
        .refreshable { await loadFeed() }
    }

    private var feedHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Latest")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .tracking(-1.5)
                .foregroundStyle(.white)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            VStack(spacing: 14) {
                ProgressView().tint(FanStyle.teal)
                Text("Loading the latest stories…")
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)
            }
            .frame(maxWidth: .infinity, minHeight: 180)
        case .loaded(let items):
            LazyVStack(spacing: 18) {
                ForEach(items) { item in
                    Link(destination: item.articleURL) {
                        NewsFeedCard(item: item)
                    }
                    .buttonStyle(FanPressStyle())
                }
            }
        case .empty:
            FeatureCard {
                VStack(alignment: .leading, spacing: 14) {
                    Label("No stories yet", systemImage: "newspaper")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("There are no stories in the feed right now. Pull down to check again.")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                }
            }
        case .failed:
            FeatureCard {
                VStack(alignment: .leading, spacing: 14) {
                    Label("News unavailable", systemImage: "wifi.exclamationmark")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("We couldn’t reach the team feed. Check your connection and try again.")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                    Button("Try again", systemImage: "arrow.clockwise") {
                        Task { await loadFeed() }
                    }
                    .buttonStyle(FanButtonStyle())
                }
            }
        }
    }

    @MainActor
    private func loadFeed() async {
        state = .loading
        do {
            guard let feedURL = Self.feedURL else { throw URLError(.badURL) }
            let (data, response) = try await URLSession.shared.data(from: feedURL)
            guard let httpResponse = response as? HTTPURLResponse,
                  200..<300 ~= httpResponse.statusCode else {
                throw URLError(.badServerResponse)
            }
            let items = try RSSFeedParser().parse(data: data)
            state = items.isEmpty ? .empty : .loaded(items)
        } catch {
            state = .failed
        }
    }
}

private struct NewsFeedCard: View {
    let item: NewsFeedItem

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: item.imageURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    ZStack {
                        LinearGradient(colors: [FanStyle.darkTeal, FanStyle.panel], startPoint: .topLeading, endPoint: .bottomTrailing)
                        Image(systemName: "newspaper.fill")
                            .font(.system(size: 34))
                            .foregroundStyle(FanStyle.teal)
                    }
                }
            }
            .frame(height: 218)
            .frame(maxWidth: .infinity)
            .clipped()

            VStack(alignment: .leading, spacing: 9) {
                Text(item.dateLabel.uppercased())
                    .font(.caption.weight(.semibold))
                    .tracking(1)
                    .foregroundStyle(FanStyle.teal)
                Text(item.title)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                Text(item.summary)
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)
                    .lineLimit(3)
                HStack(spacing: 6) {
                    Text("Read story")
                    Image(systemName: "arrow.up.right")
                }
                .font(.footnote.weight(.bold))
                .foregroundStyle(.white)
                .padding(.top, 3)
            }
            .padding(18)
        }
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 22))
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(.white.opacity(0.07)))
    }
}

private final class RSSFeedParser: NSObject, XMLParserDelegate {
    private var items: [NewsFeedItem] = []
    private var currentElement = ""
    private var currentText = ""
    private var title = ""
    private var summary = ""
    private var link = ""
    private var guid = ""
    private var image = ""
    private var date = ""
    private var isInsideItem = false

    func parse(data: Data) throws -> [NewsFeedItem] {
        let parser = XMLParser(data: data)
        parser.delegate = self
        guard parser.parse() else {
            throw parser.parserError ?? URLError(.cannotParseResponse)
        }
        return items
    }

    private func resetItem() {
        title = ""
        summary = ""
        link = ""
        guid = ""
        image = ""
        date = ""
    }

    private func finishItem() {
        guard let articleURL = URL(string: link), articleURL.scheme == "https", !title.isEmpty else { return }
        let imageURL = URL(string: image).flatMap { $0.scheme == "https" ? $0 : nil }
        let formatter = RSSFeedParser.dateFormatter
        items.append(NewsFeedItem(id: guid.isEmpty ? link : guid, title: title, summary: summary, articleURL: articleURL, imageURL: imageURL, publishedAt: formatter.date(from: date)))
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        return formatter
    }()

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName qName: String?, attributes attributeDict: [String: String] = [:]) {
        currentElement = elementName
        currentText = ""
        if elementName == "item" {
            isInsideItem = true
            resetItem()
        } else if isInsideItem, elementName == "media:content" || qName == "media:content" {
            image = attributeDict["url"] ?? ""
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        currentText += string
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        guard isInsideItem else { return }
        switch elementName {
        case "title": title = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
        case "description": summary = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
        case "link": link = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
        case "guid": guid = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
        case "pubDate": date = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
        case "item": finishItem(); isInsideItem = false
        default: break
        }
        currentText = ""
    }
}

private struct FanButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 15)
            .padding(.vertical, 11)
            .background(FanStyle.darkTeal, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(FanStyle.teal.opacity(0.5)))
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}
