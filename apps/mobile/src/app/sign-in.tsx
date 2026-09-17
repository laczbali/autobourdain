import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Turnstile, type TurnstileHandle } from '@/components/turnstile';
import { Body, Button, Field, Heading } from '@/components/ui';
import { authClient, useSession } from '@/lib/auth-client';
import { APP_URL } from '@/lib/config';

type Mode = 'sign-in' | 'sign-up';

export default function SignIn() {
  const router = useRouter();
  const { data: session } = useSession();
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
    const result = await authClient.signIn.social({
      provider: 'github',
      // Absolute, not '/'. better-auth keeps this string as given and the
      // Worker redirects to it once GitHub has come back, so a relative path
      // resolves against whoever is responding - the API. Same origin in
      // production, the wrong server in development.
      callbackURL: APP_URL ? `${APP_URL}/` : '/',
    });
    if (result.error) setError(result.error.message ?? 'GitHub sign-in failed.');
  }

  // The other half of the shell's gate: nobody signed in has any business on
  // this screen, whether they typed the URL or came back to a live session.
  if (session?.user) return <Redirect href="/" />;

  return (
    <ScrollView
      contentContainerClassName="min-h-full items-center justify-center p-6"
      className="flex-1 bg-canvas"
    >
      <View className="w-full max-w-sm gap-4">
        <Heading level={1}>{mode === 'sign-in' ? 'Sign in' : 'Create an account'}</Heading>

        {mode === 'sign-up' && (
          <Field value={name} onChangeText={setName} placeholder="Name" autoComplete="name" />
        )}

        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Field
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        />

        <Turnstile ref={turnstile} onToken={setCaptchaToken} />

        {/* One line for the lot: a failure here can belong to any of the three
            fields or to the captcha, so it does not hang off one of them. */}
        {error && <Body tone="accent">{error}</Body>}

        <Button
          title={mode === 'sign-in' ? 'Sign in' : 'Sign up'}
          onPress={submit}
          pending={pending}
        />

        <Button title="Continue with GitHub" variant="secondary" onPress={signInWithGithub} />

        <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
          <Body tone="secondary" className="text-center">
            {mode === 'sign-in' ? 'No account? Create one' : 'Already have an account? Sign in'}
          </Body>
        </Pressable>
      </View>
    </ScrollView>
  );
}
