import { Stack } from 'expo-router';
import { tabStackScreenOptions } from '../../../src/shell/tabStackOptions';

export default function HomeStack() {
  return <Stack screenOptions={tabStackScreenOptions} />;
}