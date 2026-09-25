import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { SIBError, SIBPath, sibGet, sibRequest, type Connection } from './sib';

export type PlaylistRef = { key: string; oid: string; name: string };
export const isValidPlaylist = (p: PlaylistRef) => /^\d+$/.test(p.oid);
export type ConnectionState =
  | { kind: 'unknown' }
  | { kind: 'notConfigured' }
  | { kind: 'online'; ms: number }
  | { kind: 'offline'; reason: string };
export type Toast = { id: number; text: string; isError: boolean };

type Settings = { baseUrl: string; playlists: PlaylistRef[]; keepAwake: boolean };

const SETTINGS_KEY = 'sib.settings';
const PASSWORD_KEY = 'sib.password';
const DEFAULT_SETTINGS: Settings = { baseUrl: '', playlists: [], keepAwake: true };

// Passordet lagres i nøkkelringen (SecureStore). SecureStore finnes ikke på web.
const passwordStore = {
  get: () => (Platform.OS === 'web' ? AsyncStorage.getItem(PASSWORD_KEY) : SecureStore.getItemAsync(PASSWORD_KEY)),
  set: (value: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(PASSWORD_KEY, value) : SecureStore.setItemAsync(PASSWORD_KEY, value),
};

type SIBContextValue = {
  ready: boolean;
  conn: Connection;
  settings: Settings;
  connection: ConnectionState;
  toast: Toast | null;
  updateSettings: (patch: Partial<Settings>) => void;
  setPassword: (password: string) => void;
  checkConnection: () => Promise<ConnectionState>;
  /** Sender en kommando til SIB, med haptikk og toast. Returnerer true ved suksess. */
  run: (path: string, label?: string | null) => Promise<boolean>;
  get: <T>(path: string) => Promise<T>;
  request: (path: string, opts?: Parameters<typeof sibRequest>[2]) => Promise<string>;
  showToast: (text: string, isError?: boolean) => void;
};

const SIBContext = createContext<SIBContextValue | null>(null);

export function SIBProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [password, setPasswordState] = useState('');
  const [connection, setConnection] = useState<ConnectionState>({ kind: 'unknown' });
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Last inn lagrede innstillinger
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
        setPasswordState((await passwordStore.get()) ?? '');
      } catch {
        // Første oppstart eller skadet lagring – bruk standardverdier.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setPassword = useCallback((value: string) => {
    setPasswordState(value);
    passwordStore.set(value).catch(() => {});
  }, []);

  const conn = useMemo<Connection>(() => ({ baseUrl: settings.baseUrl, password }), [settings.baseUrl, password]);

  const showToast = useCallback((text: string, isError = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, isError });
    toastTimer.current = setTimeout(() => setToast(null), isError ? 4000 : 1600);
  }, []);

  // "Tilkoblet" = SIB svarer med hva som helst (også 404). Bare nettverksfeil regnes som frakoblet.
  const checkConnection = useCallback(async (): Promise<ConnectionState> => {
    let state: ConnectionState;
    if (!conn.baseUrl.trim()) {
      state = { kind: 'notConfigured' };
    } else {
      const started = Date.now();
      try {
        await sibRequest(conn, SIBPath.selection(), { timeoutMs: 2500 });
        state = { kind: 'online', ms: Date.now() - started };
      } catch (err) {
        if (err instanceof SIBError && (err.kind === 'unreachable' || err.kind === 'badUrl')) {
          state = { kind: 'offline', reason: err.message };
        } else {
          state = { kind: 'online', ms: Date.now() - started };
        }
      }
    }
    setConnection(state);
    return state;
  }, [conn]);

  // Sjekk tilkoblingen hvert 5. sekund mens appen er i forgrunnen.
  useEffect(() => {
    if (!ready) return;
    let active = AppState.currentState === 'active';
    const first = setTimeout(checkConnection, 0);
    const interval = setInterval(() => {
      if (active) checkConnection();
    }, 5000);
    const sub = AppState.addEventListener('change', (s) => {
      active = s === 'active';
      if (active) checkConnection();
    });
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      sub.remove();
    };
  }, [ready, checkConnection]);

  const run = useCallback(
    async (path: string, label?: string | null) => {
      try {
        await sibRequest(conn, path);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (label) showToast(label);
        return true;
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        showToast(err instanceof Error ? err.message : String(err), true);
        return false;
      }
    },
    [conn, showToast],
  );

  const get = useCallback(<T,>(path: string) => sibGet<T>(conn, path), [conn]);
  const request = useCallback(
    (path: string, opts?: Parameters<typeof sibRequest>[2]) => sibRequest(conn, path, opts),
    [conn],
  );

  const value: SIBContextValue = {
    ready,
    conn,
    settings,
    connection,
    toast,
    updateSettings,
    setPassword,
    checkConnection,
    run,
    get,
    request,
    showToast,
  };

  return <SIBContext.Provider value={value}>{children}</SIBContext.Provider>;
}

export function useSIB() {
  const ctx = useContext(SIBContext);
  if (!ctx) throw new Error('useSIB må brukes innenfor <SIBProvider>');
  return ctx;
}

export function useConnectionPassword() {
  // Eget hook så innstillingssiden kan vise/endre passordet.
  const { conn, setPassword } = useSIB();
  return [conn.password, setPassword] as const;
}
