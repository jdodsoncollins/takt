import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DeploymentDetailSheet } from '../../src/features/deployments/DeploymentDetailSheet';
import { useApp } from '../../src/shell/AppContext';
import type { DeploymentID } from '../../src/domain/models/ids';
import { colors } from '../../src/design-system/theme';
import { View } from 'react-native';

export default function DeploymentRoute() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { selectDeployment } = useApp();

  useEffect(() => {
    if (id) void selectDeployment(id as DeploymentID);
  }, [id, selectDeployment]);

  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: colors.backgroundElevated,
      }}
    >
      <DeploymentDetailSheet
        key={id}
        deploymentId={id}
        onClose={() => undefined}
      />
    </View>
  );
}
