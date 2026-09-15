import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { DeploymentHostsSheet } from '../../src/features/deployments/DeploymentHostsSheet';
import { useApp } from '../../src/shell/AppContext';
import type { DeploymentID } from '../../src/domain/models/ids';
import { colors } from '../../src/design-system/theme';

export default function DeploymentHostsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectDeployment, selectedDeployment } = useApp();

  useEffect(() => {
    if (id && selectedDeployment?.id !== id) {
      void selectDeployment(id as DeploymentID);
    }
  }, [id, selectDeployment, selectedDeployment?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundElevated }}>
      <DeploymentHostsSheet deploymentId={id} />
    </View>
  );
}
