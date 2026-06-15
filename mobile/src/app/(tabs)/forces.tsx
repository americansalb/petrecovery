import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function ForcesScreen() {
  return (
    <Screen>
      <ThemedText type="title">Rescue Forces</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        The neighborhood teams that search for missing pets. This is also where the
        on-the-field rescuer mode will live.
      </ThemedText>
    </Screen>
  );
}
