import { Stack } from 'expo-router';
import { tabStackScreenOptions } from '../../../src/shell/tabStackOptions';

export default function DeploymentsStack() {
  return <Stack screenOptions={tabStackScreenOptions} />;
}