import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import { DEFAULT_PREFERENCES } from '@autobourdain/shared';

import Account from '@/app/(shell)/settings/account';
import Users from '@/app/(shell)/settings/admin/users';
import AiSettings from '@/app/(shell)/settings/ai';
import Appearance from '@/app/(shell)/settings/appearance';
import SettingsIndex from '@/app/(shell)/settings/index';
import LikesAndDislikes from '@/app/(shell)/settings/likes-and-dislikes';
import SettingsLayout from '@/app/(shell)/settings/_layout';
import { measureTriggers } from '@/components/ui/select.testing';
import { useAdminUsers, useSetRole } from '@/lib/admin';
import {
  useAiKey,
  useAiModels,
  useDeleteAiKey,
  useRefreshAiModels,
  useSaveAiKey,
  useTestAiKey,
  useUpdateAiModel,
} from '@/lib/ai';
import { ApiError } from '@/lib/api-error';
import { authClient, useSession } from '@/lib/auth-client';
import { usePreferences, useUpdatePreferences } from '@/lib/preferences';
import { ThemeProvider } from '@/theme/theme-provider';

// No better-auth client, query client or network: the screens are tested
// against what they ask for, not what the server does with it.
jest.mock('@/lib/auth-client', () => ({
  useSession: jest.fn(),
  authClient: { signOut: jest.fn() },
}));
jest.mock('@/lib/preferences', () => ({
  usePreferences: jest.fn(),
  useUpdatePreferences: jest.fn(),
}));
// useRole is the real thing, reading the faked session.
jest.mock('@/lib/admin', () => ({
  ...jest.requireActual('@/lib/admin'),
  useAdminUsers: jest.fn(),
  useSetRole: jest.fn(),
}));
// The hooks are faked; the error wording is the real thing.
jest.mock('@/lib/ai', () => ({
  ...jest.requireActual('@/lib/ai'),
  useAiKey: jest.fn(),
  useAiModels: jest.fn(),
  useSaveAiKey: jest.fn(),
  useUpdateAiModel: jest.fn(),
  useDeleteAiKey: jest.fn(),
  useRefreshAiModels: jest.fn(),
  useTestAiKey: jest.fn(),
}));

const mockUseSession = useSession as unknown as jest.Mock;
const mockUsePreferences = usePreferences as unknown as jest.Mock;
const mockUseUpdatePreferences = useUpdatePreferences as unknown as jest.Mock;
const mockSignOut = authClient.signOut as unknown as jest.Mock;
const mockMutate = jest.fn();

const mockUseAiKey = useAiKey as unknown as jest.Mock;
const mockUseAiModels = useAiModels as unknown as jest.Mock;
const mockUseSaveAiKey = useSaveAiKey as unknown as jest.Mock;
const mockUseUpdateAiModel = useUpdateAiModel as unknown as jest.Mock;
const mockUseDeleteAiKey = useDeleteAiKey as unknown as jest.Mock;
const mockUseRefreshAiModels = useRefreshAiModels as unknown as jest.Mock;
const mockUseTestAiKey = useTestAiKey as unknown as jest.Mock;
const mockTestKey = jest.fn();
const mockSaveKey = jest.fn();
const mockUpdateModel = jest.fn();
const mockDeleteKey = jest.fn();

const mockUseAdminUsers = useAdminUsers as unknown as jest.Mock;
const mockUseSetRole = useSetRole as unknown as jest.Mock;
const mockSetRole = jest.fn();

/** A mutation hook's result, idle unless told otherwise. */
function mutation(mutate: jest.Mock, overrides: Record<string, unknown> = {}) {
  return {
    mutate,
    reset: jest.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    variables: undefined,
    ...overrides,
  };
}

const STORED_KEY = { provider: 'anthropic', model: 'claude-newest', keyHint: 'abcd' };

const SIGNED_IN = { id: 'u1', name: 'Bourdain', email: 'a@b.c' };

/** Signs the faked session in with a role. */
function signInAs(role: string) {
  mockUseSession.mockReturnValue({ data: { user: { ...SIGNED_IN, role } }, isPending: false });
}

const USERS = [
  {
    id: 'u1',
    name: 'Bourdain',
    email: 'a@b.c',
    role: 'admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    locked: 'self',
  },
  {
    id: 'u2',
    name: 'Listed',
    email: 'listed@b.c',
    role: 'admin',
    createdAt: '2026-10-02T09:00:00.000Z',
    locked: 'admin_emails',
  },
  {
    id: 'u3',
    name: 'Julia',
    email: 'julia@b.c',
    role: 'normal',
    createdAt: '2026-10-03T09:00:00.000Z',
    locked: null,
  },
];

measureTriggers();

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
      '(shell)/settings/likes-and-dislikes': LikesAndDislikes,
      '(shell)/settings/appearance': Appearance,
      '(shell)/settings/ai': AiSettings,
      '(shell)/settings/account': Account,
      '(shell)/settings/admin/users': Users,
    },
    { initialUrl },
  );
  await (router as unknown as PromiseLike<unknown>);
  return { router };
}

beforeEach(() => {
  signInAs('normal');
  mockUsePreferences.mockReturnValue({ data: DEFAULT_PREFERENCES });
  mockUseUpdatePreferences.mockReturnValue(mutation(mockMutate));
  mockUseAiKey.mockReturnValue({ data: null, isPending: false, isError: false });
  mockUseAiModels.mockReturnValue({
    data: {
      models: [
        { id: 'claude-newest', label: 'Claude Newest' },
        { id: 'claude-older', label: 'Claude Older' },
      ],
      fetchedAt: '2026-10-25T12:00:00.000Z',
    },
    isPending: false,
    error: null,
  });
  mockUseSaveAiKey.mockReturnValue(mutation(mockSaveKey));
  mockUseUpdateAiModel.mockReturnValue(mutation(mockUpdateModel));
  mockUseDeleteAiKey.mockReturnValue(mutation(mockDeleteKey));
  mockUseRefreshAiModels.mockReturnValue(mutation(jest.fn()));
  mockUseTestAiKey.mockReturnValue(mutation(mockTestKey));
  mockUseAdminUsers.mockReturnValue({ data: { users: USERS }, isPending: false, isError: false });
  mockUseSetRole.mockReturnValue(mutation(mockSetRole));
});

afterEach(() => jest.clearAllMocks());

describe('settings', () => {
  it('opens on the first section', async () => {
    const { router } = await renderSettings('/settings');
    expect(router.getPathname()).toBe('/settings/likes-and-dislikes');
  });

  it('lists only the built sections, under their group', async () => {
    await renderSettings('/settings/appearance');

    expect(screen.getByText('Preferences')).toBeTruthy();
    expect(screen.getByText('App')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    ['Likes & dislikes', 'Appearance', 'AI', 'Account'].forEach((label, index) =>
      expect(within(tabs[index]).getByText(label)).toBeTruthy(),
    );
  });

  it('hides the Admin group from everyone but admins', async () => {
    await renderSettings('/settings/appearance');
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Users' })).toBeNull();
  });

  it('shows admins the Admin group, last', async () => {
    signInAs('admin');
    await renderSettings('/settings/appearance');

    expect(screen.getByText('Admin')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(within(tabs[4]).getByText('Users')).toBeTruthy();
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
    mockUseUpdatePreferences.mockReturnValue(mutation(mockMutate, { isError: true }));
    await renderSettings('/settings/appearance');
    expect(screen.getByText(/did not save/)).toBeTruthy();
  });
});

describe('Account', () => {
  it('shows who is signed in', async () => {
    await renderSettings('/settings/account');
    expect(screen.getByText('Bourdain')).toBeTruthy();
    expect(screen.getByText('a@b.c')).toBeTruthy();
    expect(screen.getByText('Normal')).toBeTruthy();
  });

  it('shows the role', async () => {
    signInAs('pro');
    await renderSettings('/settings/account');
    expect(screen.getByText('Pro')).toBeTruthy();
  });

  it('signs out', async () => {
    await renderSettings('/settings/account');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe('Users', () => {
  it('sends anyone but an admin away', async () => {
    const { router } = await renderSettings('/settings/admin/users');
    expect(router.getPathname()).toBe('/settings/likes-and-dislikes');
  });

  it('lists every user, with locked roles as plain text', async () => {
    signInAs('admin');
    await renderSettings('/settings/admin/users');

    expect(screen.getByText('julia@b.c')).toBeTruthy();
    expect(screen.getByText('Joined 2026-10-03')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Set by ADMIN_EMAILS')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Role for a@b\.c/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Role for listed@b\.c/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Role for julia@b.c: Normal' })).toBeTruthy();
  });

  it('changes a role', async () => {
    signInAs('admin');
    await renderSettings('/settings/admin/users');

    await fireEvent.press(screen.getByRole('button', { name: 'Role for julia@b.c: Normal' }));
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Pro' }));

    expect(mockSetRole).toHaveBeenCalledWith({ id: 'u3', role: 'pro' });
  });

  it('saves nothing when the same role is picked again', async () => {
    signInAs('admin');
    await renderSettings('/settings/admin/users');

    await fireEvent.press(screen.getByRole('button', { name: 'Role for julia@b.c: Normal' }));
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Normal' }));

    expect(mockSetRole).not.toHaveBeenCalled();
  });

  it('says so when a change did not save', async () => {
    signInAs('admin');
    mockUseSetRole.mockReturnValue(mutation(mockSetRole, { isError: true }));
    await renderSettings('/settings/admin/users');
    expect(screen.getByText(/did not save/)).toBeTruthy();
  });
});

describe('Likes & dislikes', () => {
  it('shows what is stored', async () => {
    mockUsePreferences.mockReturnValue({
      data: { ...DEFAULT_PREFERENCES, recipePreferences: 'No mushrooms.' },
    });
    await renderSettings('/settings/likes-and-dislikes');

    expect(screen.getByLabelText('Likes & dislikes').props.value).toBe('No mushrooms.');
    expect(screen.getByText('13 / 2000')).toBeTruthy();
  });

  it('saves nothing until something changed', async () => {
    await renderSettings('/settings/likes-and-dislikes');

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('saves what was typed', async () => {
    await renderSettings('/settings/likes-and-dislikes');

    await fireEvent.changeText(screen.getByLabelText('Likes & dislikes'), 'Loves leeks.');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(mockMutate).toHaveBeenCalledWith(
      { recipePreferences: 'Loves leeks.' },
      expect.anything(),
    );
    expect(screen.getByText('12 / 2000')).toBeTruthy();
  });

  it('says so when it did not save', async () => {
    mockUseUpdatePreferences.mockReturnValue(mutation(mockMutate, { isError: true }));
    await renderSettings('/settings/likes-and-dislikes');
    expect(screen.getByText(/did not save/)).toBeTruthy();
  });
});

describe('AI', () => {
  it('asks for a key when none is stored, and offers no model yet', async () => {
    await renderSettings('/settings/ai');

    expect(screen.getByRole('button', { name: 'Anthropic', selected: true })).toBeTruthy();
    expect(screen.getByPlaceholderText('Your Anthropic API key')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Model:/ })).toBeNull();
  });

  it('saves a key', async () => {
    await renderSettings('/settings/ai');

    await fireEvent.press(screen.getByRole('button', { name: 'Save key' }));
    expect(mockSaveKey).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByPlaceholderText('Your Anthropic API key'), ' sk-ant-1 ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save key' }));

    expect(mockSaveKey).toHaveBeenCalledWith(
      { provider: 'anthropic', apiKey: 'sk-ant-1' },
      expect.anything(),
    );
  });

  it('says so when the provider turned the key down', async () => {
    mockUseSaveAiKey.mockReturnValue(
      mutation(mockSaveKey, {
        isError: true,
        error: new ApiError(422, 'The API key was not accepted', 'ai_key_invalid'),
      }),
    );
    await renderSettings('/settings/ai');

    expect(screen.getByText('Anthropic did not accept the API key.')).toBeTruthy();
  });

  it('shows only the end of a stored key, and its model', async () => {
    mockUseAiKey.mockReturnValue({ data: STORED_KEY, isPending: false, isError: false });
    await renderSettings('/settings/ai');

    expect(screen.getByText('....abcd')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Model: Claude Newest' })).toBeTruthy();
    expect(screen.queryByPlaceholderText('Your Anthropic API key')).toBeNull();
  });

  it('changes the model', async () => {
    mockUseAiKey.mockReturnValue({ data: STORED_KEY, isPending: false, isError: false });
    await renderSettings('/settings/ai');

    await fireEvent.press(screen.getByRole('button', { name: 'Model: Claude Newest' }));
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Claude Older' }));

    expect(mockUpdateModel).toHaveBeenCalledWith({ model: 'claude-older' });
  });

  it('asks before removing the key', async () => {
    mockUseAiKey.mockReturnValue({ data: STORED_KEY, isPending: false, isError: false });
    await renderSettings('/settings/ai');

    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(mockDeleteKey).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove key' }));
    expect(mockDeleteKey).toHaveBeenCalled();
  });

  it('can keep the key after all', async () => {
    mockUseAiKey.mockReturnValue({ data: STORED_KEY, isPending: false, isError: false });
    await renderSettings('/settings/ai');

    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep it' }));

    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
    expect(mockDeleteKey).not.toHaveBeenCalled();
  });

  it('offers no connection test without a key', async () => {
    await renderSettings('/settings/ai');
    expect(screen.queryByRole('button', { name: 'Test connection' })).toBeNull();
  });

  it('tests the connection', async () => {
    mockUseAiKey.mockReturnValue({ data: STORED_KEY, isPending: false, isError: false });
    await renderSettings('/settings/ai');

    await fireEvent.press(screen.getByRole('button', { name: 'Test connection' }));

    expect(mockTestKey).toHaveBeenCalled();
  });

  it('says so when the connection works', async () => {
    mockUseAiKey.mockReturnValue({ data: STORED_KEY, isPending: false, isError: false });
    mockUseTestAiKey.mockReturnValue(mutation(mockTestKey, { isSuccess: true }));
    await renderSettings('/settings/ai');

    expect(screen.getByText('It works - the model answered.')).toBeTruthy();
  });

  it("shows the provider's reason when the connection fails", async () => {
    mockUseAiKey.mockReturnValue({ data: STORED_KEY, isPending: false, isError: false });
    mockUseTestAiKey.mockReturnValue(
      mutation(mockTestKey, {
        isError: true,
        error: new ApiError(422, 'Your credit balance is too low', 'ai_rejected'),
      }),
    );
    await renderSettings('/settings/ai');

    expect(screen.getByText('Anthropic: Your credit balance is too low')).toBeTruthy();
  });

  it('replaces a stored key', async () => {
    mockUseAiKey.mockReturnValue({ data: STORED_KEY, isPending: false, isError: false });
    await renderSettings('/settings/ai');

    await fireEvent.press(screen.getByRole('button', { name: 'Replace' }));

    expect(screen.getByPlaceholderText('Your Anthropic API key')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });
});
