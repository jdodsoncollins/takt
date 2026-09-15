import { router } from 'expo-router';
import { SettingsSheet } from '../src/features/settings/SettingsSheet';

export default function SettingsRoute() {
  return <SettingsSheet onClose={() => router.back()} />;
}
