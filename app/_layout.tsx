import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AppProvider } from '../src/shell/AppContext';
import { ChromeCanvas } from '../src/design-system/GlassChrome';
import { colors } from '../src/design-system/theme';
import {
  formSheetScreenOptions,
  inspectSheetDetents,
} from '../src/shell/formSheetScreenOptions';
import { DeploymentPreviewCaptureHost } from '../src/services/preview/DeploymentPreviewCaptureHost';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    primary: '#C4784A',
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <AppProvider>
      <ThemeProvider value={theme}>
        <ChromeCanvas>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DeploymentPreviewCaptureHost />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings"
            options={{
              ...formSheetScreenOptions,
              title: 'Settings',
              sheetAllowedDetents: [1],
            }}
          />
          <Stack.Screen
            name="sites"
            options={{
              ...formSheetScreenOptions,
              title: 'Sites',
              sheetAllowedDetents: [0.7, 1],
            }}
          />
          <Stack.Screen
            name="deployment/[id]"
            options={{
              ...formSheetScreenOptions,
              ...inspectSheetDetents,
              title: 'Deployment',
            }}
          />
          <Stack.Screen
            name="hosts/[id]"
            options={{
              ...formSheetScreenOptions,
              ...inspectSheetDetents,
              title: 'Hosts',
            }}
          />
          <Stack.Screen
            name="functions/[id]"
            options={{
              ...formSheetScreenOptions,
              ...inspectSheetDetents,
              title: 'Functions',
            }}
          />
        </Stack>
        </View>
        </ChromeCanvas>
      </ThemeProvider>
    </AppProvider>
  );
}