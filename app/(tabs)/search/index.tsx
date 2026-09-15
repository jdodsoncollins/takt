import { useRef } from 'react';
import { Platform, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import {
  CommandSheet,
  type CommandHandle,
} from '../../../src/features/command/CommandSheet';
import { AccessibilityIDs } from '../../../src/support/accessibilityIDs';
import { useApp } from '../../../src/shell/AppContext';
import { SiteScopeTitle } from '../../../src/features/sites/SiteScopeTitle';
import { siteTitle } from '../../../src/domain/models/siteScope';
import { colors } from '../../../src/design-system/theme';

export default function SearchRoute() {
  const handleRef = useRef<CommandHandle | null>(null);
  const nativeSearch = Platform.OS === 'ios';
  const { onDeviceAvailable, selectedProject } = useApp();
  const title = selectedProject ? siteTitle(selectedProject) : 'Choose a site';

  if (!onDeviceAvailable) {
    return <Redirect href="/home" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerTitle: () => <SiteScopeTitle />,
          headerSearchBarOptions: nativeSearch
            ? {
                placeholder: 'Ask Taktung…',
                hideWhenScrolling: false,
                autoCapitalize: 'none',
                onChangeText: (e) => {
                  const text = e.nativeEvent.text;
                  handleRef.current?.setQuery(text);
                  if (!text.trim()) handleRef.current?.clear();
                },
                onSearchButtonPress: (e) =>
                  handleRef.current?.run(
                    (e as { nativeEvent?: { text?: string } })?.nativeEvent
                      ?.text,
                  ),
              }
            : undefined,
        }}
      />
      <View
        collapsable={false}
        style={{ flex: 1, backgroundColor: colors.background }}
        testID={AccessibilityIDs.commandOpen}
      >
        <CommandSheet hideComposer={nativeSearch} handleRef={handleRef} />
      </View>
    </>
  );
}
