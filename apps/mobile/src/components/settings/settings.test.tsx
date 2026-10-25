import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import Account from '@/app/(shell)/settings/account';
import Appearance from '@/app/(shell)/settings/appearance';
import SettingsIndex from '@/app/(shell)/settings/index';
import SettingsLayout from '@/app/(shell)/settings/_layout';
import { authClient, useSession } from '@/lib/auth-client';
import { useUpdatePreferences } from '@/lib/preferences';
import { ThemeProvider } from '@/theme/theme-provider';

// No better-auth client, query client or network: the screens are tested
// against what they ask for, not what the server does with it.
jest.mock('@/lib/auth-client', () => ({
  useSession: jest.fn(),
  authClient: { signOut: jest.fn() },
}));
jest.mock('@/lib/preferences', () => ({
  useUpdatePreferences: jest.fn(),
}));

const mockUseSession = useSession as unknown as jest.Mock;
const mockUseUpdatePreferences = useUpdatePreferences as unknown as jest.Mock;
const mockSignOut = authClient.signOut as unknown as jest.Mock;
const mockMutate = jest.fn();

function RootLayout() {
  return (
    <ThemeProvider initialTheme="cocoa-plum" initialMode="light">
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

/** Boxed rather than returned bare - see renderShell in the shell test. */
async function renderSettings(initialUrl: string) {
  const router = renderRouter(
    {
      _layout: RootLayout,
      '(shell)/settings/_layout': SettingsLayout,
      '(shell)/settings/index': SettingsIndex,
      '(shell)/settings/appearance': Appearance,
      '(shell)/settings/account': Account,
    },
    { initialUrl },
  );
  await (router as unknown as PromiseLike<unknown>);
  return { router };
}

beforeEach(() => {
  mockUseSession.mockReturnValue({
    data: { user: { id: 'u1', name: 'Bourdain', email: 'a@b.c' } },
    isPending: false,
  });
  mockUseUpdatePreferences.mockReturnValue({ mutate: mockMutate, isError: false });
});

afterEach(() => jest.clearAllMocks());

describe('settings', () => {
  it('opens on Appearance', async () => {
    const { router } = await renderSettings('/settings');
    expect(router.getPathname()).toBe('/settings/appearance');
  });

  it('lists only the built sections, under their group', async () => {
    await renderSettings('/settings/appearance');

    expect(screen.getByText('App')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(within(tabs[0]).getByText('Appearance')).toBeTruthy();
    expect(within(tabs[1]).getByText('Account')).toBeTruthy();
  });

  it('marks the section it is on, and moves between them', async () => {
    const { router } = await renderSettings('/settings/appearance');
    expect(
      within(screen.getByRole('tab', { selected: true })).getByText('Appearance'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Account' }));

    expect(router.getPathname()).toBe('/settings/account');
    expect(within(screen.getByRole('tab', { selected: true })).getByText('Account')).toBeTruthy();
  });
});

describe('Appearance', () => {
  it('shows the current mode and theme as selected', async () => {
    await renderSettings('/settings/appearance');

    expect(screen.getByRole('button', { name: 'Light', selected: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Cocoa plum', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Warm ink', checked: false })).toBeTruthy();
  });

  it('saves a mode', async () => {
    await renderSettings('/settings/appearance');
    await fireEvent.press(screen.getByRole('button', { name: 'Dark' }));
    expect(mockMutate).toHaveBeenCalledWith({ mode: 'dark' });
  });

  it('saves a theme', async () => {
    await renderSettings('/settings/appearance');
    await fireEvent.press(screen.getByRole('radio', { name: 'Warm ink' }));
    expect(mockMutate).toHaveBeenCalledWith({ theme: 'warm-ink' });
  });

  it('says so when a change did not save', async () => {
    mockUseUpdatePreferences.mockReturnValue({ mutate: mockMutate, isError: true });
    await renderSettings('/settings/appearance');
    expect(screen.getByText(/did not save/)).toBeTruthy();
  });
});

describe('Account', () => {
  it('shows who is signed in', async () => {
    await renderSettings('/settings/account');
    expect(screen.getByText('Bourdain')).toBeTruthy();
    expect(screen.getByText('a@b.c')).toBeTruthy();
  });

  it('signs out', async () => {
    await renderSettings('/settings/account');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
