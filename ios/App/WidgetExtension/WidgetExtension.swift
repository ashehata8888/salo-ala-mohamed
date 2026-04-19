import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), text: "اللهم صل وسلم على نبينا محمد \u{FDDF}")
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), text: "اللهم صل وسلم على نبينا محمد \u{FDDF}")
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        var entries: [SimpleEntry] = []
        let currentDate = Date()
        
        // Fetch User Preference safely (Needs App Group matching the one in Capacitor)
        // If App Group is not configured, fallback to Arabic.
        // E.g., App Group ID: group.com.salo.alahmoha
        let sharedDefaults = UserDefaults(suiteName: "group.com.salo.alahmoha")
        let lang = sharedDefaults?.string(forKey: "user_lang") ?? "ar"
        let text = lang == "en" ? "Peace be upon Prophet Muhammad \u{FDDF}" : "اللهم صل وسلم على نبينا محمد \u{FDDF}"

        for hourOffset in 0 ..< 5 {
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            let entry = SimpleEntry(date: entryDate, text: text)
            entries.append(entry)
        }

        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let text: String
}

struct WidgetExtensionEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        ZStack {
            Color(red: 0.04, green: 0.06, blue: 0.1).ignoresSafeArea() // Matches #0b0f19
            
            VStack {
                Text(entry.text)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(Color(red: 0.83, green: 0.68, blue: 0.21)) // Matches #d4af37
                    .multilineTextAlignment(.center)
                    .environment(\.layoutDirection, entry.text.contains("Peace") ? .leftToRight : .rightToLeft)
            }
            .padding(12)
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
}

@main
struct ProphetSalahWidget: Widget {
    let kind: String = "ProphetSalahWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WidgetExtensionEntryView(entry: entry)
        }
        .configurationDisplayName("Salah Reminder")
        .description("A subtle reminder to send blessings on the Prophet.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
