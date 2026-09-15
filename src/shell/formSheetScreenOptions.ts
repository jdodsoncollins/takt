import { colors } from '../design-system/theme';
import { SheetDoneButton } from './formSheetOptions';

/** Native form-sheet chrome: grabber + title + Done. Do not draw a second header. */
export const formSheetScreenOptions = {
  presentation: 'formSheet' as const,
  headerShown: true,
  headerShadowVisible: false,
  headerTransparent: false,
  headerTintColor: colors.text,
  headerStyle: { backgroundColor: colors.backgroundElevated },
  headerTitleStyle: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  headerTitleAlign: 'center' as const,
  headerBackVisible: false,
  headerLeft: () => null,
  headerRight: SheetDoneButton,
  headerRightContainerStyle: { justifyContent: 'center' },
  headerTitleContainerStyle: { justifyContent: 'center' },
  contentStyle: { backgroundColor: colors.backgroundElevated },
  sheetGrabberVisible: true,
  sheetAllowedDetents: [0.92],
};

/** iPhone portrait: 50% list peek + full. Drag the grabber to snap. */
export const inspectSheetDetents = {
  sheetAllowedDetents: [0.5, 1] as number[],
  sheetInitialDetentIndex: 0,
  sheetLargestUndimmedDetentIndex: 0 as const,
  sheetExpandsWhenScrolledToEdge: false,
};
