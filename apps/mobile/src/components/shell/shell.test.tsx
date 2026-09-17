import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useSession } from '@/lib/auth-client';
import { ThemeProvider } from '@/theme/theme-provider';

import { DESTINATIONS } from './destinations';

// The shell reads the session and the top bar signs out. Neither wants a real
// better-auth client, SecureStore or a network in a unit test.
jest.mock('@/lib/auth-client', () => ({
  useSession: jest.fn(),
  authClient: { signOut: jest.fn() },
}));

const mockUseSession = useSession as unknown as jest.Mock;

function signedIn() {
  mockUseSession.mockReturnValue({
    data: { user: { name: 'Bourdain', email: 'a@b.c' } },
    isPending: false,
  });
}

// The real root layout loads fonts and hides the splash screen, neither of
// which belongs here. What it has to keep is the ThemeProvider: the top bar's
// Button reads the palette off it.
function RootLayout() {
  return (
    <ThemeProvider initialTheme="cocoa-plum" initialMode="light">
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

// Required rather than imported, so the mock above is in place before the
// layout pulls in the auth client.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ShellLayout = require('@/app/(shell)/_layout').default as () => React.ReactElement;

/**
 * The result is kept and boxed rather than returned bare: renderRouter assigns
 * getPathname and friends onto RNTL's render result, and that result is a
 * thenable which resolves to something else - so awaiting it anywhere, an
 * async return included, hands back an object without them.
 */
async function renderShell(initialUrl = '/') {
  const router = renderRouter(
    {
      _layout: RootLayout,
      '(shell)/_layout': ShellLayout,
      '(shell)/index': () => <Text>Today screen</Text>,
      '(shell)/week': () => <Text>Week plan screen</Text>,
      '(shell)/kitchen': () => <Text>Kitchen screen</Text>,
      '(shell)/recipes': () => <Text>Recipes screen</Text>,
      '(shell)/settings': () => <Text>Settings screen</Text>,
      'sign-in': () => <Text>Sign in screen</Text>,
    },
    { initialUrl },
  );

  // Awaiting the render is what completes it - RNTL 14 renders asynchronously.
  // The type does not admit to being thenable, hence the cast.
  await (router as unknown as PromiseLike<unknown>);
  return { router };
}

describe('the shell', () => {
  afterEach(() => mockUseSession.mockReset());

  it('sends a signed-out visitor to sign-in', async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });
    const { router } = await renderShell();

    expect(router.getPathname()).toBe('/sign-in');
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows neither the shell nor sign-in while the session resolves', async () => {
    mockUseSession.mockReturnValue({ data: undefined, isPending: true });
    const { router } = await renderShell();

    expect(router.getPathname()).toBe('/');
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText('Sign in screen')).toBeNull();
  });

  it('renders every destination once signed in', async () => {
    signedIn();
    await renderShell();

    for (const destination of DESTINATIONS) {
      expect(screen.getByRole('tab', { name: destination.label })).toBeTruthy();
    }
    expect(screen.getByText('Today screen')).toBeTruthy();
  });

  it('marks the destination it is on', async () => {
    signedIn();
    await renderShell('/week');

    const selected = screen.getByRole('tab', { selected: true });
    expect(within(selected).getByText('Week plan')).toBeTruthy();
  });

  it('carries the wordmark', async () => {
    signedIn();
    await renderShell();

    expect(screen.getByText('autobourdain')).toBeTruthy();
  });

  it('navigates when a destination is pressed', async () => {
    signedIn();
    const { router } = await renderShell();

    await fireEvent.press(screen.getByRole('tab', { name: 'Kitchen' }));

    expect(router.getPathname()).toBe('/kitchen');
    expect(screen.getByText('Kitchen screen')).toBeTruthy();
  });
});
