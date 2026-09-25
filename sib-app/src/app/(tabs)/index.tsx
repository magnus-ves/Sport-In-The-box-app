import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, EmptyState, Loading, NotConfigured, Screen, useHeaderRefresh } from '@/components/ui';
import { base64Image, isLight, shortcutLabel, sibColor, SIBPath, type QuickButton, type QuickButtonGroup } from '@/lib/sib';
import { useSIB } from '@/lib/store';

const GAP = 12;

export default function QuickButtonsScreen() {
  const { get, settings } = useSIB();
  const [groups, setGroups] = useState<QuickButtonGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    if (!settings.baseUrl) return;
    try {
      setGroups(await get<QuickButtonGroup[]>(SIBPath.quickButtons()));
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
    }, [load]),
  );

  if (!settings.baseUrl) return <NotConfigured />;

  // Så mange kolonner som får plass med minst ~160 pt bredde.
  const columns = Math.max(2, Math.floor((width - 32 + GAP) / (160 + GAP)));
  const tileWidth = (width - 32 - GAP * (columns - 1)) / columns;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error && !groups ? (
        <EmptyState text={error} />
      ) : !groups ? (
        <Loading />
      ) : groups.length === 0 ? (
        <EmptyState text="Ingen hurtigknapper funnet i Sport In The Box." icon="grid-outline" />
      ) : (
        groups.map((group) => (
          <View key={group.QuickButtonGroupOid} style={styles.group}>
            <View style={styles.groupHead}>
              <View style={[styles.swatch, { backgroundColor: sibColor(group.BackgroundColor) ?? 'transparent' }]} />
              <Text style={styles.groupTitle}>{group.ButtonText || 'Gruppe'}</Text>
            </View>
            {group.Buttons?.length ? (
              <View style={styles.grid}>
                {group.Buttons.map((button) => (
                  <QuickButtonTile key={button.QuickButtonOid ?? button.TriggerId} button={button} width={tileWidth} />
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Tom gruppe</Text>
            )}
          </View>
        ))
      )}
    </Screen>
  );
}

function QuickButtonTile({ button, width }: { button: QuickButton; width: number }) {
  const { run } = useSIB();
  const [busy, setBusy] = useState(false);
  const bg = sibColor(button.BackgroundColor) ?? colors.accent;
  const fg = isLight(bg) ? colors.text : '#fff';
  const image = base64Image(button.Icon);
  const shortcut = shortcutLabel(button.Shortcut);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={button.ButtonText}
      accessibilityHint={`Trigger-ID ${button.TriggerId}`}
      onPress={async () => {
        setBusy(true);
        await run(SIBPath.quickTrigger(button.TriggerId), button.ButtonText);
        setBusy(false);
      }}
      style={({ pressed }) => [
        styles.tile,
        { width, backgroundColor: bg, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}>
      {image && <Image source={{ uri: image }} style={styles.icon} resizeMode="contain" />}
      <Text style={[styles.tileText, { color: fg }]} numberOfLines={3}>
        {button.ButtonText || `Knapp ${button.TriggerId}`}
      </Text>
      {shortcut && <Text style={[styles.shortcut, { color: fg }]}>{shortcut}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12, marginBottom: 14 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  groupTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    minHeight: 110,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  icon: { width: 48, height: 48 },
  tileText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  shortcut: { position: 'absolute', top: 6, right: 9, fontSize: 11, fontWeight: '600', opacity: 0.8 },
  muted: { color: colors.muted },
});
