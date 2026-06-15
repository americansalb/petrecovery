import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/screen';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen scroll>
      <View style={styles.brandRow}>
        <View style={[styles.logo, { backgroundColor: theme.accent }]}>
          <Ionicons name="paw" size={22} color={theme.accentText} />
        </View>
        <ThemedText type="smallBold" themeColor="textSecondary">
          REUNITEPETS
        </ThemedText>
      </View>

      <ThemedText type="title" style={styles.h1}>
        Your pet&apos;s home,{'\n'}every day.
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        Keep their health book close — and rally a search the moment they go missing.
      </ThemedText>

      <Card style={styles.firstCard}>
        <ThemedText style={styles.cardTitle}>My Pets</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Meds, vaccines, weight, and records — all in one place.
        </ThemedText>
        <Button
          label="View my pets"
          style={styles.cardBtn}
          onPress={() => router.navigate('/pets')}
        />
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Lost a pet?</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Start a search and bring the whole neighborhood in.
        </ThemedText>
        <Button
          label="Lost & Found"
          variant="secondary"
          style={styles.cardBtn}
          onPress={() => router.navigate('/lost')}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { marginTop: Spacing.three },
  firstCard: { marginTop: Spacing.three },
  cardTitle: { fontSize: 20, fontWeight: '700' },
  cardBtn: { marginTop: Spacing.two },
});
