import WidgetKit
import SwiftUI

// MARK: - Constants & Phrases
struct SalahPhrases {
    static let arabic: [String] = [
        "اللهم صلِّ وسلم وبارك على سيدنا محمد وعلى آله كما صليت وباركت على سيدنا إبراهيم وعلى آله",
        "اللهم صلِّ وسلم وبارك على سيدنا محمد وعلى آله عدد كمال الله وكما يليق بكماله",
        "اللهم صلِّ وسلم وبارك على سيدنا محمد وعلى آله عدد ما ذكره الذاكرون وغفل عن ذكره الغافلون",
        "اللهم صلِّ وسلم على سيدنا محمد طب القلوب ودوائها وعافية الابدان وشفائها ونور الابصار وضيائها"
    ]
    
    static let english: [String] = [
        "O Allah, bless Muhammad & his family as You blessed Ibrahim and his family",
        "O Allah, bless Muhammad & his family with a blessing matching Your perfection",
        "O Allah, bless Muhammad & his family by the count of those who remember and those who forget.",
        "O Allah, bless Muhammad, the medicine for hearts and health for bodies"
    ]
}

// MARK: - Family-aware phrase selection
extension SalahPhrases {
    /// Longest phrase that stays legible in a Lock Screen accessory.
    private static let accessoryMaxLength = 70
    /// Inline sits on one line beside the clock — it has room for almost nothing.
    private static let inlineMaxLength = 32

    static func pool(for family: WidgetFamily, from full: [String]) -> [String] {
        let limit: Int
        switch family {
        case .accessoryInline:
            limit = inlineMaxLength
        case .accessoryRectangular, .accessoryCircular:
            limit = accessoryMaxLength
        default:
            return full
        }

        let short = full.filter { $0.count <= limit }
        // Never hand back an empty pool — getTimeline indexes into it unguarded.
        return short.isEmpty ? [full.min(by: { $0.count < $1.count }) ?? ""] : short
    }
}

// MARK: - Entry
struct SimpleEntry: TimelineEntry {
    let date: Date
    let text: String
    let isRtl: Bool
}

// MARK: - Provider
struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), text: "اللهم صل وسلم على نبينا محمد \u{FDFA}", isRtl: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), text: "اللهم صل وسلم على نبينا محمد \u{FDFA}", isRtl: true)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        var entries: [SimpleEntry] = []
        let currentDate = Date()

        // Load User Preference
        let sharedDefaults = UserDefaults(suiteName: "group.com.salo.alahmuhammed")
        let lang = sharedDefaults?.string(forKey: "user_lang") ?? "ar"
        let isArabic = lang == "ar"

        let fullPool = isArabic ? SalahPhrases.arabic : SalahPhrases.english
        // Lock Screen accessories get only a few square millimetres — long phrases
        // scale down to unreadable. Draw from the short end of the same pool so the
        // content stays authentic rather than truncated mid-sentence.
        let pool = SalahPhrases.pool(for: context.family, from: fullPool)

        // Generate entries for the next 24 hours (one every hour)
        for hourOffset in 0 ..< 24 {
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!

            // Infinity loop logic: pick index based on total hours since a fixed start point
            // This ensures all 330+ phrases are shown over time
            let totalHours = Int(entryDate.timeIntervalSince1970 / 3600)
            let index = totalHours % pool.count
            let phrase = pool[index]

            let entry = SimpleEntry(date: entryDate, text: phrase, isRtl: isArabic)
            entries.append(entry)
        }

        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

// MARK: - UI Components
struct PremiumBackground: View {
    var body: some View {
        ZStack {
            // Deep surface gradient
            LinearGradient(
                colors: [Color(hex: "07090f"), Color(hex: "0d1220")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            // Subtle inner glow/border
            RoundedRectangle(cornerRadius: 18)
                .stroke(
                    LinearGradient(
                        colors: [Color(hex: "e8c96a").opacity(0.4), Color(hex: "c9a84c").opacity(0.1)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.5
                )
                .padding(2)
        }
    }
}

struct WidgetExtensionEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    private var isAccessory: Bool {
        switch family {
        case .accessoryRectangular, .accessoryInline, .accessoryCircular:
            return true
        default:
            return false
        }
    }

    var body: some View {
        Group {
            if isAccessory {
                accessoryBody
            } else {
                homeScreenBody
            }
        }
        .environment(\.layoutDirection, entry.isRtl ? .rightToLeft : .leftToRight)
    }

    // Lock Screen: the system renders accessories in a vibrant monochrome material.
    // Custom colours and backgrounds are ignored there, so don't fight it — keep the
    // glyph count low and let the material do the work.
    @ViewBuilder
    private var accessoryBody: some View {
        switch family {
        case .accessoryInline:
            Text(entry.text)
        default:
            Text(entry.text)
                .font(.system(size: 13, weight: .medium, design: .serif))
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .minimumScaleFactor(0.6)
                .widgetAccentable()
        }
    }

    @ViewBuilder
    private var homeScreenBody: some View {
        // containerBackground is iOS 17+; the extension still supports 16, where the
        // ZStack's own background is what shows.
        if #available(iOS 17.0, *) {
            homeScreenContent
                .containerBackground(for: .widget) {
                    Color(hex: "07090f")
                }
        } else {
            homeScreenContent
        }
    }

    private var homeScreenContent: some View {
        ZStack {
            PremiumBackground()

            VStack(spacing: 8) {
                // Ornament / Icon
                Image(systemName: "star.fill")
                    .font(.system(size: 10))
                    .foregroundColor(Color(hex: "c9a84c"))
                    .opacity(0.6)

                Text(entry.text)
                    .font(.system(size: family == .systemSmall ? 14 : 16, weight: .medium, design: .serif))
                    .foregroundColor(Color(hex: "e8c96a"))
                    .multilineTextAlignment(.center)
                    .lineLimit(4)
                    .minimumScaleFactor(0.7)
                    .padding(.horizontal, 10)
            }
            .padding(12)
        }
    }
}

// MARK: - Widget Configuration
@main
struct ProphetSalahWidget: Widget {
    let kind: String = "ProphetSalahWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WidgetExtensionEntryView(entry: entry)
        }
        .configurationDisplayName("Salah Reminder")
        .description("A premium reminder to send blessings on the Prophet.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            // Lock Screen — the whole point: visible the moment the screen wakes,
            // and permanently on Always-On Display devices.
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

// MARK: - Helpers
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
