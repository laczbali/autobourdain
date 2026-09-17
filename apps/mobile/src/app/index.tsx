import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Body, Button, Card, Eyebrow, Heading } from '@/components/ui';
import { getHealth } from '@/lib/api';
import { authClient, useSession } from '@/lib/auth-client';
import { useTheme } from '@/theme/theme-provider';

export default function Home() {
  const { data: session, isPending: sessionPending } = useSession();
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth });
  const { palette } = useTheme();

  return (
    <ScrollView
      contentContainerClassName="min-h-full items-center justify-center gap-6 p-6"
      className="flex-1 bg-canvas"
    >
      <View className="w-full max-w-md gap-6">
        <View className="gap-1">
          <Heading level={1}>autobourdain</Heading>
          <Body tone="secondary" large>
            Expo + Hono on Cloudflare Workers, backed by D1.
          </Body>
        </View>

        <Card className="gap-2">
          <Eyebrow>API</Eyebrow>
          {health.isPending ? (
            <ActivityIndicator color={palette.accent} />
          ) : health.isError ? (
            <Body tone="accent">Unreachable — is `npm run dev:api` running?</Body>
          ) : (
            <Body tone="secondary">
              {health.data.service} ok at {health.data.time}
            </Body>
          )}
        </Card>

        <Card className="gap-3">
          <Eyebrow>Session</Eyebrow>
          {sessionPending ? (
            <ActivityIndicator color={palette.accent} />
          ) : session?.user ? (
            <>
              <Body tone="secondary">Signed in as {session.user.email}</Body>
              <Button title="Sign out" variant="secondary" onPress={() => authClient.signOut()} />
            </>
          ) : (
            <>
              <Body tone="secondary">Not signed in.</Body>
              {/* asChild hands the navigation props to the Button's Pressable. */}
              <Link href="/sign-in" asChild>
                <Button title="Sign in" />
              </Link>
            </>
          )}
        </Card>
      </View>
    </ScrollView>
  );
}
