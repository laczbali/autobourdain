import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { getHealth } from '@/lib/api';
import { authClient, useSession } from '@/lib/auth-client';

export default function Home() {
  const { data: session, isPending: sessionPending } = useSession();
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth });

  return (
    <ScrollView
      contentContainerClassName="min-h-full items-center justify-center gap-6 p-6"
      className="flex-1 bg-white dark:bg-neutral-950"
    >
      <View className="w-full max-w-md gap-6">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
            autobourdain
          </Text>
          <Text className="text-base text-neutral-500 dark:text-neutral-400">
            Expo + Hono on Cloudflare Workers, backed by D1.
          </Text>
        </View>

        <View className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            API
          </Text>
          {health.isPending ? (
            <ActivityIndicator />
          ) : health.isError ? (
            <Text className="text-red-600 dark:text-red-400">
              Unreachable — is `npm run dev:api` running?
            </Text>
          ) : (
            <Text className="text-neutral-700 dark:text-neutral-300">
              {health.data.service} ok at {health.data.time}
            </Text>
          )}
        </View>

        <View className="gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Session
          </Text>
          {sessionPending ? (
            <ActivityIndicator />
          ) : session?.user ? (
            <>
              <Text className="text-neutral-700 dark:text-neutral-300">
                Signed in as {session.user.email}
              </Text>
              <Pressable
                onPress={() => authClient.signOut()}
                className="items-center rounded-lg border border-neutral-300 px-4 py-3 active:opacity-70 dark:border-neutral-700"
              >
                <Text className="font-medium text-neutral-900 dark:text-neutral-100">Sign out</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="text-neutral-700 dark:text-neutral-300">Not signed in.</Text>
              <Link href="/sign-in" asChild>
                <Pressable className="items-center rounded-lg bg-neutral-900 px-4 py-3 active:opacity-70 dark:bg-neutral-100">
                  <Text className="font-medium text-white dark:text-neutral-900">Sign in</Text>
                </Pressable>
              </Link>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
