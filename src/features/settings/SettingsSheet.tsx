import { useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../shell/AppContext';
import {
  colors,
  isIOS,
  radii,
  spacing,
  touch,
  typography,
} from '../../design-system/theme';
import {
  ContentCard,
  PrimaryButton,
  SectionLabel,
} from '../../design-system/GlassChrome';
import { OnDevicePrivacyNote } from '../../design-system/OnDevicePrivacyNote';
import { connectionIsConnected } from '../../domain/models/vercelModels';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import type { TeamID } from '../../domain/models/ids';
import {
  otherAppBlurb,
  otherAppName,
  otherAppStoreUrl,
  privacyPolicyUrl,
} from './otherApps';

export function SettingsSheet({
  onClose,
}: {
  onClose: () => void;
}) {
  const {
    connection,
    connectWithToken,
    disconnect,
    selectTeam,
    isBusy,
  } = useApp();
  const [token, setToken] = useState('');
  const connected = connectionIsConnected(connection);
  const insets = useSafeAreaInsets();
  const privacyUrl = privacyPolicyUrl();
  const otherUrl = otherAppStoreUrl();
  const otherName = otherAppName();
  const otherBlurb = otherAppBlurb();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.body,
        { paddingBottom: spacing.xxxl + insets.bottom + spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustsScrollIndicatorInsets
      alwaysBounceVertical
    >
            <ContentCard>
              <SectionLabel>Personal access token</SectionLabel>
              <Text style={styles.help}>
                Create a token at vercel.com/account/tokens. Stored only on this
                device (Secure Store on native).
              </Text>
              <TextInput
                testID={AccessibilityIDs.tokenInput}
                style={styles.input}
                value={token}
                onChangeText={setToken}
                placeholder="vercel_… or account token"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                accessibilityLabel="Vercel access token"
              />
              <PrimaryButton
                title={connected ? 'Update token' : 'Connect with token'}
                onPress={() => {
                  if (!token.trim()) {
                    AccessibilityInfo.announceForAccessibility(
                      'Paste a personal access token, then connect.',
                    );
                    return;
                  }
                  void connectWithToken(token).then((result) => {
                    if (result.status === 'connected') {
                      setToken('');
                      AccessibilityInfo.announceForAccessibility(
                        'Connected to Vercel',
                      );
                      onClose();
                    } else {
                      AccessibilityInfo.announceForAccessibility(result.message);
                    }
                  });
                }}
                loading={isBusy}
                testID={AccessibilityIDs.connectButton}
              />
              {connected ? (
                  <PrimaryButton
                    title="Disconnect and erase local data"
                    onPress={() => {
                      Alert.alert(
                        'Disconnect and erase local data?',
                        'This removes Vercel credentials, team and project selections, every cached project snapshot, and all local activity from this device.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Disconnect and erase',
                            style: 'destructive',
                            onPress: () => void disconnect(),
                          },
                        ],
                      );
                    }}
                    variant="danger"
                  />
              ) : null}
            </ContentCard>

            {connected && connection.teams.length > 0 ? (
              <ContentCard>
                <SectionLabel>Team</SectionLabel>
                <PrimaryButton
                  title={
                    connection.selectedTeamId == null
                      ? '● Personal / default'
                      : 'Personal / default'
                  }
                  onPress={() => void selectTeam(null)}
                  variant="ghost"
                  selected={connection.selectedTeamId == null}
                  accessibilityHint="Uses your personal Vercel account"
                />
                {connection.teams.map((t) => (
                  <PrimaryButton
                    key={t.id}
                    title={
                      connection.selectedTeamId === t.id
                        ? `● ${t.name} (${t.slug})`
                        : `${t.name} (${t.slug})`
                    }
                    onPress={() => void selectTeam(t.id as TeamID)}
                    variant="ghost"
                    selected={connection.selectedTeamId === t.id}
                    accessibilityHint={`Uses the ${t.name} team`}
                  />
                ))}
              </ContentCard>
            ) : null}

            <ContentCard>
              <SectionLabel>About</SectionLabel>
              <Text style={styles.help}>
                Taktung translates from German as putting work on a beat. The
                name is a reference to ZEIT, Vercel's original name.{'\n'}
                Taktung is a local-first Vercel operations assistant. It is not
                affiliated with Vercel in any way.
              </Text>
              {privacyUrl ? (
              <Pressable
                onPress={() => void Linking.openURL(privacyUrl)}
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
                accessibilityHint="Opens the Taktung privacy policy in the browser"
                testID="takt.privacyPolicy"
                style={({ pressed }) => [
                  styles.aboutLink,
                  pressed && styles.privacyLinkPressed,
                ]}
              >
                <Text style={styles.privacyLinkText}>Privacy Policy</Text>
              </Pressable>
              ) : null}
              {isIOS && otherUrl && otherName && otherBlurb ? (
                <View style={styles.otherApps}>
                  <Text style={styles.otherAppsLabel}>My other apps</Text>
                  <Pressable
                    onPress={() => void Linking.openURL(otherUrl)}
                    accessibilityRole="link"
                    accessibilityLabel={`${otherName}, ${otherBlurb}`}
                    accessibilityHint={`Opens ${otherName} on the App Store`}
                    testID="takt.otherAppStore"
                    style={({ pressed }) => [
                      styles.appRow,
                      pressed && styles.privacyLinkPressed,
                    ]}
                  >
                    <Image
                      source={require('../../../assets/other-app-icon.png')}
                      style={styles.appIcon}
                      contentFit="cover"
                      accessibilityIgnoresInvertColors
                    />
                    <View style={styles.appCopy}>
                      <Text style={styles.appName}>{otherName}</Text>
                      <Text style={styles.appBlurb}>{otherBlurb}</Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}
            </ContentCard>

            <ContentCard>
              <SectionLabel>Privacy and local data</SectionLabel>
              <Text style={styles.help}>
                Credentials remain in native Secure Store until you disconnect.
                Project snapshots and up to 100 activity metadata entries remain
                in local app storage until replaced, cleared, or disconnected.
                Disconnect removes credentials, team and project selections,
                snapshots, and activity from this device. Taktung sends requests
                directly to Vercel and has no separate analytics or telemetry.
              </Text>
              <OnDevicePrivacyNote />
            </ContentCard>

            <ContentCard>
              <SectionLabel>Safety</SectionLabel>
              <Text style={styles.help}>
                · Env values never load into UI or brief{'\n'}
                · Redeploy / promote / rollback require hard confirmation{'\n'}
                · READY is only claimed after Vercel confirms{'\n'}
                · Ops brief uses loaded signals only (no secret fields)
              </Text>
            </ContentCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  help: { ...typography.footnote },
  privacyLink: {
    minHeight: touch.min,
    justifyContent: 'center',
  },
  aboutLink: {
    paddingVertical: 6,
    justifyContent: 'center',
  },
  otherApps: {
    gap: spacing.sm,
  },
  otherAppsLabel: {
    ...typography.footnote,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touch.min,
  },
  appIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  appCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  appName: {
    ...typography.headline,
  },
  appBlurb: {
    ...typography.footnote,
  },
  privacyLinkPressed: { opacity: 0.7 },
  privacyLinkText: {
    ...typography.body,
    color: colors.accent,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    minHeight: 48,
    fontFamily: typography.mono.fontFamily,
  },
});
