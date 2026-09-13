import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const systemScheme = useColorScheme();

  // Tailwind runs in darkMode: 'class', so the OS preference has to be pushed
  // into NativeWind rather than picked up by a media query. On web this also
  // puts the `dark` class on <html>; on native it drives NativeWind directly.
  useEffect(() => {
    // react-native can also report 'unspecified'; 'system' lets NativeWind fall
    // back to Appearance itself.
    colorScheme.set(
      systemScheme === 'dark' || systemScheme === 'light' ? systemScheme : 'system',
    );
  }, [systemScheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'autobourdain' }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      </Stack>
    </QueryClientProvider>
  );
}
