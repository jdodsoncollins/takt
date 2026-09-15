import { Stack } from 'expo-router';
import { tabStackScreenOptions } from '../../../src/shell/tabStackOptions';

export default function ActivityStack() {
  return <Stack screenOptions={tabStackScreenOptions} />;
}