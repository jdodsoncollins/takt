const {
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
  withEntitlementsPlist,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * App Intents (iOS 16+, Siri AI on iOS 27) for Taktung.
 *
 * These intents only open existing screens. They never mutate Vercel state.
 * App Shortcuts do not use SiriKit, so we do not set com.apple.developer.siri.
 */

const SWIFT = `import AppIntents
import Foundation

/// Custom-scheme URLs Expo Router already handles (\`takt://…\`).
private enum TaktungLink {
  static func url(_ path: String) -> URL {
    URL(string: "takt:/" + path)!
  }
}

@available(iOS 18.0, *)
struct OpenHomeIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Home"
  static var description = IntentDescription("Opens the selected site briefing.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(TaktungLink.url("/home")))
  }
}

@available(iOS 18.0, *)
struct OpenDeploymentsIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Deploys"
  static var description = IntentDescription("Opens the deployment list for the selected site.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(TaktungLink.url("/deployments")))
  }
}

@available(iOS 18.0, *)
struct OpenActivityIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Activity"
  static var description = IntentDescription("Opens the activity log.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(TaktungLink.url("/activity")))
  }
}

@available(iOS 18.0, *)
struct OpenAssistantIntent: AppIntent {
  static var title: LocalizedStringResource = "Ask Taktung"
  static var description = IntentDescription("Opens on-device search. Hidden in-app when Apple Intelligence is unavailable.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(TaktungLink.url("/search")))
  }
}

@available(iOS 18.0, *)
struct OpenSettingsIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Settings"
  static var description = IntentDescription("Opens Taktung settings.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(TaktungLink.url("/settings")))
  }
}

@available(iOS 18.0, *)
struct TaktungShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: OpenHomeIntent(),
      phrases: [
        "Open \\(.applicationName)",
        "Show my sites in \\(.applicationName)",
        "Open home in \\(.applicationName)",
      ],
      shortTitle: "Home",
      systemImageName: "house"
    )
    AppShortcut(
      intent: OpenDeploymentsIntent(),
      phrases: [
        "Show deploys in \\(.applicationName)",
        "Open deployments in \\(.applicationName)",
      ],
      shortTitle: "Deploys",
      systemImageName: "arrow.up.forward.app"
    )
    AppShortcut(
      intent: OpenActivityIntent(),
      phrases: [
        "Show activity in \\(.applicationName)",
        "Open activity in \\(.applicationName)",
      ],
      shortTitle: "Activity",
      systemImageName: "clock"
    )
    AppShortcut(
      intent: OpenAssistantIntent(),
      phrases: [
        "Ask \\(.applicationName)",
        "Search in \\(.applicationName)",
      ],
      shortTitle: "Ask",
      systemImageName: "sparkles"
    )
    AppShortcut(
      intent: OpenSettingsIntent(),
      phrases: [
        "Open settings in \\(.applicationName)",
      ],
      shortTitle: "Settings",
      systemImageName: "gear"
    )
  }
}
`;

const SIRI_KIT_KEYS = [
  'com.apple.developer.siri',
  'com.apple.developer.side-button-access.allow',
];

module.exports = function withAppIntents(config) {
  const scheme =
    typeof config.scheme === 'string' && config.scheme.length > 0
      ? config.scheme
      : 'takt';
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = cfg.modRequest.projectName ?? 'Taktung';
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        projectName,
        'TaktungAppIntents.swift',
      );
      fs.writeFileSync(dest, SWIFT.replaceAll('takt:/', `${scheme}:/`));
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = cfg.modRequest.projectName ?? 'Taktung';
    const filePath = `${projectName}/TaktungAppIntents.swift`;
    if (!project.hasFile(filePath)) {
      project.addSourceFile(
        filePath,
        null,
        project.findPBXGroupKey({ name: projectName }),
      );
    }
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    delete cfg.modResults.NSMicrophoneUsageDescription;
    delete cfg.modResults.NSFaceIDUsageDescription;
    delete cfg.modResults.NSSiriUsageDescription;
    delete cfg.modResults.NSSpeechRecognitionUsageDescription;
    return cfg;
  });

  config = withEntitlementsPlist(config, (cfg) => {
    for (const key of SIRI_KIT_KEYS) {
      delete cfg.modResults[key];
    }
    return cfg;
  });

  return config;
};
