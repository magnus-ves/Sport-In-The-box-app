import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BigButton, colors, EmptyState, Loading, NotConfigured, Screen, useHeaderRefresh } from '@/components/ui';
import { SIBPath, type SIBStream } from '@/lib/sib';
import { useSIB } from '@/lib/store';

function confirmStop(name: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`Stoppe «${name}»?`));
  return new Promise((resolve) =>
    Alert.alert('Stoppe strømmen?', `«${name}» slutter å sende.`, [
      { text: 'Avbryt', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Stopp', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function StreamsScreen() {
  const { get, run, settings } = useSIB();
  const [streams, setStreams] = useState<SIBStream[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    if (!settings.baseUrl) return;
    try {
      setStreams(await get<SIBStream[]>(SIBPath.streams()));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [get, settings.baseUrl]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useHeaderRefresh(refresh);
  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 5000);
      return () => clearInterval(interval);
    }, [load]),
  );

  if (!settings.baseUrl) return <NotConfigured />;

  const toggle = async (s: SIBStream) => {
    const name = s.Name ?? `Strøm ${s.Id}`;
    const live = !!s.IsStreaming;
    if (live && !(await confirmStop(name))) return;
    const ok = await run(SIBPath.streamControl(s.Id, live ? 'STOP' : 'START'), live ? `Stoppet ${name}` : `Startet ${name}`);
    if (ok) setTimeout(load, 600);
  };

  const columns = Math.max(1, Math.floor((width - 32 + 16) / (300 + 16)));
  const cardWidth = (width - 32 - 16 * (columns - 1)) / columns;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error && !streams ? (
        <EmptyState text={error} />
      ) : !streams ? (
        <Loading />
      ) : streams.length === 0 ? (
        <EmptyState text="Ingen strømmer satt opp i Sport In The Box." icon="radio-outline" />
      ) : (
        <View style={styles.grid}>
          {streams.map((s) => {
            const live = !!s.IsStreaming;
            return (
              <View key={s.Id} style={[styles.card, { width: cardWidth }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.Name ?? `Strøm ${s.Id}`}</Text>
                  <View style={styles.state}>
                    <View style={[styles.dot, { backgroundColor: live ? colors.danger : colors.border }]} />
                    <Text style={[styles.stateText, live && { color: colors.danger, fontWeight: '700' }]}>
                      {live ? 'Sender direkte' : 'Stoppet'}
                    </Text>
                  </View>
                </View>
                <BigButton
                  title={live ? 'Stopp' : 'Start'}
                  icon={live ? 'stop' : 'radio'}
                  variant={live ? 'danger' : 'primary'}
                  grow={0}
                  onPress={() => toggle(s)}
                />
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 16, padding: 16 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  stateText: { color: colors.muted, fontSize: 13 },
});
