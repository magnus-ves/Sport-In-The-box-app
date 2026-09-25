import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BigButton, colors, EmptyState, Loading, NotConfigured, Screen, useHeaderRefresh } from '@/components/ui';
import { formatClock, sibColor, SIBPath, type Rundown, type RundownItem, type RundownSelection } from '@/lib/sib';
import { useSIB } from '@/lib/store';

const RUNDOWN_KEY = 'sib.rundownId';

export default function RundownScreen() {
  const { get, run, settings } = useSIB();
  const [rundowns, setRundowns] = useState<Rundown[] | null>(null);
  const [selection, setSelection] = useState<RundownSelection | null>(null);
  const [rundownId, setRundownId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const selectionJson = useRef('');

  const refreshSelection = useCallback(async () => {
    try {
      const s = await get<RundownSelection>(SIBPath.selection());
      const json = JSON.stringify(s);
      if (json !== selectionJson.current) {
        selectionJson.current = json;
        setSelection(s);
      }
    } catch {
      // Vises via tilkoblingsstatusen.
    }
  }, [get]);

  const load = useCallback(async () => {
    if (!settings.baseUrl) return;
    try {
      const all = await get<Rundown[]>(SIBPath.rundownsWithItems());
      const sel = await get<RundownSelection>(SIBPath.selection()).catch(() => null);
      const sorted = [...all].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));
      setRundowns(sorted);
      if (sel) {
        selectionJson.current = JSON.stringify(sel);
        setSelection(sel);
      }
      setError(null);
      const saved = Number(await AsyncStorage.getItem(RUNDOWN_KEY).catch(() => null));
      setRundownId((current) => {
        const exists = (id: number | null | undefined) => id != null && sorted.some((r) => r.Id === id);
        if (exists(current)) return current;
        if (exists(saved)) return saved;
        if (exists(sel?.SelectedRundown)) return sel!.SelectedRundown!;
        return sorted[0]?.Id ?? null;
      });
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

  // Last inn når fanen åpnes, og hold markeringen i synk med SIB mens den er åpen.
  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(refreshSelection, 2000);
      return () => clearInterval(interval);
    }, [load, refreshSelection]),
  );

  useEffect(() => {
    if (rundownId != null) AsyncStorage.setItem(RUNDOWN_KEY, String(rundownId)).catch(() => {});
  }, [rundownId]);

  if (!settings.baseUrl) return <NotConfigured />;

  const current = rundowns?.find((r) => r.Id === rundownId) ?? null;
  const selectedItemId = rundownId != null ? selection?.SelectedItems?.[String(rundownId)] : undefined;
  const items = [...(current?.Items ?? [])].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));
  const showClock = width >= 600;

  const act = async (path: string, label: string | null) => {
    if (await run(path, label)) await refreshSelection();
  };

  if (error && !rundowns) return <EmptyState text={error} />;
  if (!rundowns) return <Loading />;
  if (rundowns.length === 0) return <EmptyState text="Ingen rundowns funnet i Sport In The Box." icon="list-outline" />;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {/* Velg rundown */}
      <View style={styles.pickerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {rundowns.map((r) => {
            const active = r.Id === rundownId;
            return (
              <Pressable
                key={r.Id}
                onPress={() => setRundownId(r.Id)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityState={{ selected: active }}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.Name || `Rundown ${r.Id}`}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <BigButton
          title="Vis i SIB"
          icon="tv-outline"
          compact
          disabled={!current}
          grow={0}
          onPress={() => current && act(SIBPath.selectRundown(current.Id), 'Rundown vist i SIB')}
        />
      </View>

      {/* Transport */}
      <View style={styles.row}>
        <BigButton title="Forrige" icon="play-skip-back" disabled={!current} onPress={() => current && act(SIBPath.previousRun(current.Id), 'Kjører forrige')} />
        <BigButton title="Kjør valgt" icon="play" variant="primary" disabled={!current} grow={1.3} onPress={() => current && act(SIBPath.selectedRun(current.Id), 'Kjører valgt element')} />
        <BigButton title="Neste" icon="play-skip-forward" disabled={!current} onPress={() => current && act(SIBPath.nextRun(current.Id), 'Kjører neste')} />
      </View>
      <View style={styles.row}>
        <BigButton title="Velg forrige" icon="chevron-up" compact onPress={() => act(SIBPath.selectPrevious(), null)} />
        <BigButton title="Velg neste" icon="chevron-down" compact onPress={() => act(SIBPath.selectNext(), null)} />
      </View>
      <Text style={styles.hint}>Trykk på en rad for å kjøre elementet direkte. Raden som er valgt i SIB er markert.</Text>

      {items.length === 0 ? (
        <EmptyState text="Denne rundownen har ingen elementer." icon="list-outline" />
      ) : (
        <View style={{ gap: 6 }}>
          {items.map((item) => (
            <RundownRow
              key={item.Id}
              item={item}
              selected={item.Id === selectedItemId}
              showClock={showClock}
              onPress={() => act(SIBPath.itemRun(current!.Id, item.Id), `Kjører ${item.Ident ?? ''} ${item.Name ?? ''}`.trim())}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function RundownRow({
  item,
  selected,
  showClock,
  onPress,
}: {
  item: RundownItem;
  selected: boolean;
  showClock: boolean;
  onPress: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={async () => {
        setBusy(true);
        await onPress();
        setBusy(false);
      }}
      style={({ pressed }) => [
        styles.item,
        selected && styles.itemSelected,
        { opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}>
      <View style={[styles.bar, { backgroundColor: sibColor(item.ColorHex) ?? colors.border }]} />
      <Text style={styles.ident}>{item.Ident}</Text>
      {showClock && <Text style={styles.clock}>{formatClock(item.Clock)}</Text>}
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.Name}</Text>
        {!!item.Description && <Text style={styles.desc}>{item.Description}</Text>}
      </View>
      {item.HasEvents && (
        <View style={styles.eventBadge}>
          <Text style={styles.eventText}>Hendelser</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontWeight: '600', color: colors.text, fontSize: 15 },
  chipTextActive: { color: '#fff' },
  row: { flexDirection: 'row', gap: 10 },
  hint: { color: colors.muted, fontSize: 13 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 12,
    paddingRight: 14,
    overflow: 'hidden',
  },
  itemSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  ident: { marginLeft: 20, width: 48, fontSize: 18, fontWeight: '700', color: colors.text },
  clock: { width: 70, color: colors.muted, fontVariant: ['tabular-nums'] },
  name: { fontWeight: '600', fontSize: 16, color: colors.text },
  desc: { color: colors.muted, fontSize: 14, marginTop: 2 },
  eventBadge: { backgroundColor: colors.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  eventText: { color: colors.accent, fontSize: 12 },
});
