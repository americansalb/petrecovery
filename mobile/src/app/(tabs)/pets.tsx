import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type Pet = {
  id: string;
  name: string;
  species?: string;
  breed?: string | null;
  primaryPhotoUrl?: string | null;
  photos?: string[];
};

function speciesLabel(s?: string) {
  if (!s) return 'Pet';
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function PetRow({ pet }: { pet: Pet }) {
  const theme = useTheme();
  const photo = pet.primaryPhotoUrl || pet.photos?.[0] || null;
  const subtitle = [pet.breed, speciesLabel(pet.species)].filter(Boolean).join(' · ');

  return (
    <Card style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatarImg} contentFit="cover" transition={150} />
        ) : (
          <ThemedText style={styles.avatarFallback}>🐾</ThemedText>
        )}
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.name}>{pet.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
    </Card>
  );
}

export default function PetsScreen() {
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get('/api/pets');
      const owned: Pet[] = data?.pets || [];
      const shared: Pet[] = (data?.sharedPets || []).map((s: { pet: Pet }) => s.pet);
      setPets([...owned, ...shared]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your pets');
      setPets([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (pets === null) {
    return (
      <Screen>
        <ThemedText type="title">My Pets</ThemedText>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={styles.fill}>
      <FlatList
        style={styles.fill}
        data={pets}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PetRow pet={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <ThemedText type="title" style={styles.header}>
            My Pets
          </ThemedText>
        }
        ListEmptyComponent={
          error ? (
            <Card>
              <ThemedText themeColor="danger">{error}</ThemedText>
            </Card>
          ) : (
            <Card>
              <ThemedText style={styles.name}>No pets yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Add a pet on the website and it&apos;ll show up here — same account, same data.
              </ThemedText>
            </Card>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { paddingTop: Spacing.six, alignItems: 'center' },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
  header: { marginBottom: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowText: { flex: 1, gap: 2 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 56, height: 56 },
  avatarFallback: { fontSize: 24 },
  name: { fontSize: 17, fontWeight: '700' },
});
