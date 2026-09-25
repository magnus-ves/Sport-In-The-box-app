import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BigButton, colors, Screen } from '@/components/ui';
import { normalizeBaseUrl } from '@/lib/sib';
import { isValidPlaylist, useSIB, type PlaylistRef } from '@/lib/store';

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function SettingsScreen() {
  const { settings, updateSettings, conn, setPassword, checkConnection, request } = useSIB();

  const [url, setUrl] = useState(settings.baseUrl);
  const [password, setPasswordDraft] = useState(conn.password);
  const [playlists, setPlaylists] = useState<PlaylistRef[]>(settings.playlists);
  const [status, setStatus] = useState<string | null>(null);

  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [customPath, setCustomPath] = useState('/api/rundown/selection');
  const [customBody, setCustomBody] = useState('');
  const [customOutput, setCustomOutput] = useState('');

  const dirty =
    url.trim() !== settings.baseUrl ||
    password !== conn.password ||
    JSON.stringify(playlists) !== JSON.stringify(settings.playlists);

  const save = async () => {
    const trimmed = url.trim();
    const normalized = trimmed ? normalizeBaseUrl(trimmed) : '';
    if (normalized === null) {
      setStatus('Ugyldig adresse. Eksempel: 192.168.1.50:8080');
      return;
    }
    const invalid = playlists.find((p) => p.oid && !isValidPlaylist(p));
    if (invalid) {
      setStatus(`Ugyldig spilleliste-ID «${invalid.oid}» – må være et tall.`);
      return;
    }
    setUrl(normalized);
    updateSettings({ baseUrl: normalized, playlists: playlists.filter((p) => p.oid) });
    setPassword(password);
    setStatus('Lagret. Tester tilkoblingen…');
  };

  // Test etter lagring, når conn er oppdatert.
  useEffect(() => {
    if (status !== 'Lagret. Tester tilkoblingen…') return;
    checkConnection().then((s) =>
      setStatus(
        s.kind === 'online'
          ? `Lagret – tilkoblet Sport In The Box (${s.ms} ms).`
          : s.kind === 'offline'
            ? `Lagret, men: ${s.reason}`
            : 'Lagret.',
      ),
    );
  }, [conn, status, checkConnection]);

  const test = async () => {
    setStatus('Tester…');
    const s = await checkConnection();
    setStatus(
      s.kind === 'online'
        ? `Tilkoblet Sport In The Box (${s.ms} ms).`
        : s.kind === 'offline'
          ? s.reason
          : 'Legg inn adressen og trykk Lagre først.',
    );
  };

  const sendCustom = async () => {
    let path = customPath.trim().replace(/^https?:\/\/[^/]+/i, ''); // godta hele URL-er fra dokumentasjonen
    if (!path) return;
    if (!path.startsWith('/')) path = '/' + path;
    setCustomOutput(`${method} ${path} …`);
    try {
      const text = await request(path, method === 'POST' ? { method, body: customBody || '[]' } : undefined);
      let out = text;
      try {
        out = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // ikke JSON
      }
      setCustomOutput(out ? out.slice(0, 20000) : 'OK (tomt svar)');
    } catch (err) {
      setCustomOutput(`Feil: ${(err as Error).message}`);
    }
  };

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.h2}>Sport In The Box</Text>
        <Text style={styles.label}>Adresse</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="192.168.1.50:8080"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <Text style={styles.help}>
          IP-adressen til PC-en som kjører SIB, med port 8080 (standard). iPaden må være på samme nettverk, og
          REST-API-et må være skrudd på i SIB.
        </Text>

        <Text style={styles.label}>API-passord (valgfritt)</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPasswordDraft}
          placeholder="Ingen passord"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.help}>Lagres i iPadens nøkkelring og legges automatisk til i alle kall.</Text>

        <View style={styles.row}>
          <BigButton title="Lagre" icon="checkmark" variant="primary" compact disabled={!dirty} onPress={save} />
          <BigButton title="Test tilkobling" icon="pulse" compact onPress={test} />
        </View>
        {status && <Text style={styles.status}>{status}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Spillelister</Text>
        <Text style={styles.help}>
          SIB-API-et kan ikke liste spillelister. Legg inn ID-en (medialistOid) fra Sport In The Box, og trykk Lagre.
        </Text>
        {playlists.map((p, i) => (
          <View key={p.key} style={styles.playlistRow}>
            <TextInput
              style={[styles.input, { width: 90 }]}
              value={p.oid}
              onChangeText={(oid) => setPlaylists((list) => list.map((x, j) => (j === i ? { ...x, oid: oid.trim() } : x)))}
              placeholder="ID"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={p.name}
              onChangeText={(name) => setPlaylists((list) => list.map((x, j) => (j === i ? { ...x, name } : x)))}
              placeholder="Navn (valgfritt)"
              placeholderTextColor={colors.muted}
            />
            <Pressable
              accessibilityLabel="Fjern spilleliste"
              hitSlop={8}
              onPress={() => setPlaylists((list) => list.filter((_, j) => j !== i))}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        <View style={styles.row}>
          <BigButton
            title="Legg til spilleliste"
            icon="add"
            compact
            onPress={() => setPlaylists((list) => [...list, { key: newKey(), oid: '', name: '' }])}
          />
          <BigButton title="Lagre" icon="checkmark" variant="primary" compact disabled={!dirty} onPress={save} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Under arrangement</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Hold skjermen våken</Text>
          <Switch
            value={settings.keepAwake}
            onValueChange={(keepAwake) => updateSettings({ keepAwake })}
            trackColor={{ true: colors.accent }}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Egendefinert API-kall</Text>
        <Text style={styles.help}>
          For funksjoner uten egen fane, f.eks. ishockey, lag og opptak. Passordet legges til automatisk.
        </Text>
        <View style={styles.row}>
          {(['GET', 'POST'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMethod(m)} style={[styles.segment, method === m && styles.segmentActive]}>
              <Text style={[styles.segmentText, method === m && { color: '#fff' }]}>{m}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, styles.mono]}
          value={customPath}
          onChangeText={setCustomPath}
          placeholder="/api/..."
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {method === 'POST' && (
          <TextInput
            style={[styles.input, styles.mono, { minHeight: 80, textAlignVertical: 'top' }]}
            value={customBody}
            onChangeText={setCustomBody}
            placeholder='JSON-body, f.eks. [{"...": 1}]'
            placeholderTextColor={colors.muted}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        <View style={styles.row}>
          <BigButton title="Send" icon="send" variant="primary" compact onPress={sendCustom} />
        </View>
        {!!customOutput && (
          <Text selectable style={styles.output}>
            {customOutput}
          </Text>
        )}
      </View>

      <Text style={styles.footer}>
        Får ikke appen kontakt? Sjekk at «Lokalt nettverk» er slått på for SIB Kontroll (eller Expo Go) under
        Innstillinger → Personvern og sikkerhet → Lokalt nettverk på iPaden.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 8 },
  h2: { fontSize: 19, fontWeight: '700', color: colors.text, marginBottom: 4 },
  label: { fontWeight: '600', color: colors.text, marginTop: 6 },
  help: { color: colors.muted, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  mono: { fontFamily: 'Menlo', fontSize: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  status: { color: colors.text, marginTop: 4 },
  playlistRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16, color: colors.text },
  segment: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segmentText: { fontWeight: '600', color: colors.text },
  output: {
    backgroundColor: '#1c3a53',
    color: '#e8f0f6',
    borderRadius: 10,
    padding: 12,
    fontFamily: 'Menlo',
    fontSize: 12.5,
    marginTop: 6,
  },
  footer: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
});
