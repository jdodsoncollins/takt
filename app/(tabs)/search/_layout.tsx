import { Redirect, Stack } from 'expo-router';
import { tabStackScreenOptions } from '../../../src/shell/tabStackOptions';
import { useApp } from '../../../src/shell/AppContext';

export default function SearchStack() {
  const { onDeviceAvailable } = useApp();
  if (!onDeviceAvailable) {
    return <Redirect href="/home" />;
  }
  return <Stack screenOptions={tabStackScreenOptions} />;
}
