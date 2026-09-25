import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BigButton, colors, EmptyState, NotConfigured, Screen, useHeaderRefresh } from '@/components/ui';
import { SIBPath, type PlaylistFile } from '@/lib/sib';
import { isValidPlaylist, useSIB, type PlaylistRef } from '@/lib/store';

const titleOf = (p: PlaylistRef) => p.name || `Spilleliste ${p.oid}`;

export default function PlaylistsScreen() {
  const { settings } = useSIB();
  const [reloadToken, setReloadToken] = useState(0);
  const { width } = useWindowDimensions();
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useHeaderRefresh(reload);
  useFocusEffect(reload);

  if (!settings.baseUrl) return <NotConfigured />;

  const lists = settings.playlists.filter(isValidPlaylist);
  const columns = Math.max(1, Math.floor((width - 32 + 16) / (320 + 16)));
  const cardWidth = (width - 32 - 16 * (columns - 1)) / columns;

  return (
    <Screen onRefresh={reload}>
      {lists.length === 0 ? (
        <EmptyState
          icon="musical-notes-outline"
          text={
            'Ingen spillelister lagt inn ennå.\nSport In The Box-API-et kan ikke liste spillelister, så legg inn ID-ene (medialistOid) under Innstillinger.'
          }
        />
      ) : (
        <View style={styles.grid}>
          {lists.map((ref) => (
            <PlaylistCard key={ref.key} playlist={ref} width={cardWidth} reloadToken={reloadToken} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function PlaylistCard({ playlist, width, reloadToken }: { playlist: PlaylistRef; width: number; reloadToken: number }) {
  const { get, run } = useSIB();
  const [files, setFiles] = useState<PlaylistFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = titleOf(playlist);

  useEffect(() => {
    let cancelled = false;
    get<PlaylistFile[]>(SIBPath.playlist(playlist.oid))
      .then((f) => {
        if (cancelled) return;
        setFiles(f);
        setError(null);
      })
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, [get, playlist.oid, reloadToken]);

  return (
    <View style={[styles.card, { width }]}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.muted}>ID {playlist.oid}</Text>
      </View>
      <View style={styles.row}>
        <BigButton title="Fra start" icon="play" variant="primary" compact onPress={() => run(SIBPath.playFromStart(playlist.oid), `Starter ${title}`)} />
        <BigButton title="Fortsett" icon="play-forward" compact onPress={() => run(SIBPath.playFromLast(playlist.oid), `Fortsetter ${title}`)} />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !files ? (
        <Text style={styles.muted}>Laster filer…</Text>
      ) : files.length === 0 ? (
        <Text style={styles.muted}>Ingen filer i spillelisten.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {files.map((file, i) => (
            <Pressable
              key={file.MedialistItemOid}
              accessibilityRole="button"
              onPress={() => run(SIBPath.playFromItem(playlist.oid, file.MedialistItemOid), `Spiller ${file.MedialistItemName ?? 'fil'}`)}
              style={({ pressed }) => [styles.file, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <Text style={styles.fileNo}>{i + 1}.</Text>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.MedialistItemName ?? `Fil ${file.MedialistItemOid}`}
              </Text>
              <Ionicons name="play-circle-outline" size={22} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 12 },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger },
  row: { flexDirection: 'row', gap: 8 },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.bg,
  },
  fileNo: { color: colors.muted, fontVariant: ['tabular-nums'] },
  fileName: { flex: 1, color: colors.text, fontSize: 15 },
});
