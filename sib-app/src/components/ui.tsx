import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSIB } from '@/lib/store';

export const colors = {
  bg: '#f2f5f8',
  card: '#ffffff',
  text: '#16212b',
  muted: '#64707c',
  border: '#dde3e8',
  accent: '#3f6d8f',
  accentSoft: '#e3edf4',
  danger: '#c0392b',
  success: '#1f9d63',
  warning: '#e0902a',
};

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Stor trykkvennlig knapp. `onPress` kan være async – knappen dimmes mens den jobber. */
export function BigButton({
  title,
  icon,
  onPress,
  variant = 'default',
  compact = false,
  disabled = false,
  grow = 1,
  style,
}: {
  title: string;
  icon?: IconName;
  onPress: () => unknown;
  variant?: 'default' | 'primary' | 'danger';
  compact?: boolean;
  disabled?: boolean;
  /** Andel av ledig plass i en rad. 0 = bare så bred som innholdet. */
  grow?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [busy, setBusy] = useState(false);
  const filled = variant !== 'default';
  const bg = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : colors.card;
  const fg = filled ? '#fff' : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={async () => {
        setBusy(true);
        try {
          await onPress();
        } finally {
          setBusy(false);
        }
      }}
      style={({ pressed }) => [
        styles.bigButton,
        grow > 0 ? { flexGrow: grow, flexBasis: 0 } : { paddingHorizontal: 20 },
        {
          backgroundColor: bg,
          minHeight: compact ? 48 : 68,
          borderWidth: filled ? 0 : StyleSheet.hairlineWidth,
          opacity: disabled || busy ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}>
      {icon && <Ionicons name={icon} size={compact ? 18 : 22} color={fg} />}
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.bigButtonText, { color: fg, fontSize: compact ? 15 : 18 }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function EmptyState({ text, icon = 'warning-outline' }: { text: string; icon?: IconName }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.muted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function ConnectionBadge() {
  const { connection } = useSIB();
  const [color, label] =
    connection.kind === 'online'
      ? [colors.success, 'Tilkoblet SIB']
      : connection.kind === 'offline'
        ? [colors.danger, 'SIB svarer ikke']
        : connection.kind === 'notConfigured'
          ? [colors.warning, 'Ikke satt opp']
          : [colors.muted, 'Kobler til…'];
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function HeaderRight({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <View style={styles.headerRight}>
      <ConnectionBadge />
      {onRefresh && (
        <Pressable accessibilityLabel="Oppdater" hitSlop={10} onPress={onRefresh} style={styles.refresh}>
          <Ionicons name="refresh" size={22} color={colors.accent} />
        </Pressable>
      )}
    </View>
  );
}

/** Legger til oppdater-knapp ved siden av tilkoblingsstatusen i headeren. */
export function useHeaderRefresh(onRefresh: () => void) {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <HeaderRight onRefresh={onRefresh} /> });
  }, [navigation, onRefresh]);
}

/** Vises når SIB-adressen ikke er lagt inn ennå. */
export function NotConfigured() {
  const router = useRouter();
  return (
    <View style={styles.empty}>
      <Ionicons name="settings-outline" size={40} color={colors.muted} />
      <Text style={styles.emptyText}>Legg inn adressen til Sport In The Box-PC-en for å komme i gang.</Text>
      <BigButton title="Gå til Innstillinger" icon="arrow-forward" variant="primary" compact onPress={() => router.navigate('/settings')} grow={0} />
    </View>
  );
}

/** Scrollbar skjerm med dra-for-å-oppdatere. */
export function Screen({
  children,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.screen}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export function ToastView() {
  const { toast } = useSIB();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.toastWrap, { bottom: insets.bottom + 70 }]}>
      <View style={[styles.toast, { backgroundColor: toast.isError ? colors.danger : 'rgba(22,33,43,0.92)' }]}>
        <Text style={styles.toastText}>{toast.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderColor: colors.border,
  },
  bigButtonText: { fontWeight: '600', flexShrink: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 16, maxWidth: 520 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  badgeText: { fontSize: 13, fontWeight: '500', color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 16 },
  refresh: { padding: 2 },
  screen: { padding: 16, paddingBottom: 40, gap: 12 },
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 15, textAlign: 'center' },
});
