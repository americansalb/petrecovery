import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function LostScreen() {
  return (
    <Screen>
      <ThemedText type="title">Lost & Found</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        Nearby lost and found pets, and the place to start a search. Wired to the live
        feed next.
      </ThemedText>
    </Screen>
  );
}
