import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Turnstile, type TurnstileHandle } from '@/components/turnstile';
import { authClient } from '@/lib/auth-client';

type Mode = 'sign-in' | 'sign-up';

export default function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  async function submit() {
    if (!captchaToken) {
      setError('Please complete the verification below.');
      return;
    }

    setPending(true);
    setError(null);

    // The captcha plugin reads this header and verifies with Cloudflare before
    // the request reaches better-auth's handler.
    const fetchOptions = { headers: { 'x-captcha-response': captchaToken } };
    const result =
      mode === 'sign-in'
        ? await authClient.signIn.email({ email, password, fetchOptions })
        : await authClient.signUp.email({ name, email, password, fetchOptions });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? 'Something went wrong.');
      // Turnstile tokens are single-use, so a retry with the same one fails.
      turnstile.current?.reset();
      return;
    }
    router.replace('/');
  }

  async function signInWithGithub() {
    setError(null);
    const result = await authClient.signIn.social({ provider: 'github', callbackURL: '/' });
    if (result.error) setError(result.error.message ?? 'GitHub sign-in failed.');
  }

  return (
    <ScrollView
      contentContainerClassName="min-h-full items-center justify-center p-6"
      className="flex-1 bg-white dark:bg-neutral-950"
    >
      <View className="w-full max-w-sm gap-4">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
          {mode === 'sign-in' ? 'Sign in' : 'Create an account'}
        </Text>

        {mode === 'sign-up' && (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            autoComplete="name"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
          />
        )}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
        />

        <Turnstile ref={turnstile} onToken={setCaptchaToken} />

        {error && <Text className="text-red-600 dark:text-red-400">{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={pending}
          className="items-center rounded-lg bg-neutral-900 px-4 py-3 active:opacity-70 disabled:opacity-50 dark:bg-neutral-100"
        >
          {pending ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-medium text-white dark:text-neutral-900">
              {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={signInWithGithub}
          className="items-center rounded-lg border border-neutral-300 px-4 py-3 active:opacity-70 dark:border-neutral-700"
        >
          <Text className="font-medium text-neutral-900 dark:text-neutral-100">
            Continue with GitHub
          </Text>
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
          <Text className="text-center text-neutral-500 dark:text-neutral-400">
            {mode === 'sign-in' ? 'No account? Create one' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
