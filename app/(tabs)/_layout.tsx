import { DynamicColorIOS, Platform } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useApp } from '../../src/shell/AppContext';

export const unstable_settings = {
  initialRouteName: 'home',
};

const tint =
  Platform.OS === 'ios'
    ? DynamicColorIOS({ dark: '#F7F1EA', light: '#1A1410' })
    : '#F7F1EA';

export default function TabsLayout() {
  const { pollingDeploymentId, onDeviceAvailable } = useApp();

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={tint}
      labelStyle={{ color: tint }}
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="deployments">
        <NativeTabs.Trigger.Label>Deploys</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'arrow.up.forward.app',
            selected: 'arrow.up.forward.app.fill',
          }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'clock', selected: 'clock.fill' }}
        />
        {pollingDeploymentId ? <NativeTabs.Trigger.Badge /> : null}
      </NativeTabs.Trigger>
      {onDeviceAvailable ? (
        <NativeTabs.Trigger name="search" role="search">
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="sparkles" />
        </NativeTabs.Trigger>
      ) : (
        <NativeTabs.Trigger name="search" hidden>
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}