import { Stack } from 'expo-router';
import { View } from 'react-native';
import { DeploymentsScreen } from '../../../src/features/deployments/DeploymentsScreen';
import { SiteScopeTitle } from '../../../src/features/sites/SiteScopeTitle';
import { useApp } from '../../../src/shell/AppContext';
import { siteTitle } from '../../../src/domain/models/siteScope';
import { AccessibilityIDs } from '../../../src/support/accessibilityIDs';

export default function DeploymentsRoute() {
  const { selectedProject } = useApp();
  const title = selectedProject ? siteTitle(selectedProject) : 'Choose a site';

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerTitle: () => <SiteScopeTitle />,
        }}
      />
      <View collapsable={false} style={{ flex: 1 }} testID={AccessibilityIDs.tabDeployments}>
        <DeploymentsScreen />
      </View>
    </>
  );
}