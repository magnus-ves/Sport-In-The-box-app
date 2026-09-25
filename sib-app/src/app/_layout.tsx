import { Stack } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { ToastView } from '@/components/ui';
import { SIBProvider, useSIB } from '@/lib/store';

function KeepAwake() {
  useKeepAwake();
  return null;
}

function Root() {
  const { ready, settings } = useSIB();
  if (!ready) return null;
  return (
    <View style={{ flex: 1 }}>
      {settings.keepAwake && <KeepAwake />}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <ToastView />
      <StatusBar style="dark" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SIBProvider>
      <Root />
    </SIBProvider>
  );
}
