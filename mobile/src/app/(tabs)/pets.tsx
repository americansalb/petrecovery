import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function PetsScreen() {
  return (
    <Screen>
      <ThemedText type="title">My Pets</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        Your pets and their health books will live here — pulled live from your account.
        This is the next screen we build.
      </ThemedText>
    </Screen>
  );
}
