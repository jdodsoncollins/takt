import { Stack } from 'expo-router';
import { View } from 'react-native';
import { HomeScreen } from '../../../src/features/home/HomeScreen';
import { HeaderIconButton } from '../../../src/design-system/HeaderIconButton';
import { SiteScopeTitle } from '../../../src/features/sites/SiteScopeTitle';
import { useApp } from '../../../src/shell/AppContext';
import { connectionIsConnected } from '../../../src/domain/models/vercelModels';
import { siteTitle } from '../../../src/domain/models/siteScope';
import { AccessibilityIDs } from '../../../src/support/accessibilityIDs';

export default function HomeRoute() {
  const { setSettingsOpen, refreshProjects, connection, selectedProject } =
    useApp();
  const connected = connectionIsConnected(connection);
  const title = selectedProject ? siteTitle(selectedProject) : 'Taktung';

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerTitle: () => <SiteScopeTitle />,
          headerLeft: () => (
            <HeaderIconButton
              name="gearshape"
              label="Settings"
              testID={AccessibilityIDs.tabSettings}
              onPress={() => setSettingsOpen(true)}
            />
          ),
          headerRight: () => (
            <HeaderIconButton
              name="arrow.clockwise"
              label="Refresh projects"
              onPress={() => {
                if (connected) void refreshProjects();
              }}
              disabled={!connected}
            />
          ),
        }}
      />
      <View collapsable={false} style={{ flex: 1 }} testID={AccessibilityIDs.root}>
        <HomeScreen />
      </View>
    </>
  );
}