import type { Suggestion } from '@autobourdain/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Today from '@/app/(shell)/index';
import { useStacked } from '@/components/today/layout';
import { measureTriggers } from '@/components/ui/select.testing';
import { useAiSettings } from '@/lib/ai';
import { suggestMeals } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import { ThemeProvider } from '@/theme/theme-provider';

// The screen is tested against what it asks for and what comes back. The
// shell barrel pulls in the auth client, which wants no better-auth here either.
jest.mock('@/lib/api', () => ({ suggestMeals: jest.fn() }));
jest.mock('@/lib/auth-client', () => ({ useSession: jest.fn() }));
// The settings query is faked; the error wording is the real thing.
jest.mock('@/lib/ai', () => ({ ...jest.requireActual('@/lib/ai'), useAiSettings: jest.fn() }));
// Every case runs in both layouts, rather than at whatever width jest reports.
jest.mock('@/components/today/layout', () => ({ useStacked: jest.fn() }));

const mockSuggestMeals = suggestMeals as jest.Mock;
const mockUseAiSettings = useAiSettings as jest.Mock;

/** Settings with one provider set up and active. */
function activeOn(provider: string) {
  return {
    data: { connections: [{ provider, model: 'some-model', keyHint: null, active: true }] },
  };
}
const mockUseStacked = useStacked as jest.Mock;

measureTriggers();

function suggestion(id: string, title: string, overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id,
    title,
    description: `A description of ${title}.`,
    imageUrl: null,
    portions: 2,
    totalMinutes: 30,
    ingredients: [{ name: 'Rice', quantity: 150, unit: 'g' }],
    method: ['Cook it.'],
    ...overrides,
  };
}

const SUGGESTIONS = [
  suggestion('frittata', 'Spinach frittata', {
    totalMinutes: 20,
    ingredients: [
      { name: 'Spinach', quantity: 200, unit: 'g' },
      { name: 'Salt', quantity: null, unit: 'to taste' },
    ],
    method: ['Wilt the spinach.', 'Add the eggs and set under the grill.'],
  }),
  suggestion('salmon', 'Miso salmon bowl', { totalMinutes: 75 }),
  suggestion('pasta', 'Pasta with greens'),
];

async function renderToday() {
  // gcTime: Infinity schedules no cache timers, which would otherwise hold jest
  // open after the run.
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialTheme="cocoa-plum" initialMode="light">
        <Today />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

async function pickMeal(mealType: string) {
  await fireEvent.press(screen.getByRole('button', { name: /^Meal:/ }));
  await fireEvent.press(screen.getByRole('menuitem', { name: mealType }));
}

async function askFor(mealType: string, ask = '') {
  await pickMeal(mealType);
  if (ask) await fireEvent.changeText(screen.getByLabelText('Ask'), ask);
  await fireEvent.press(screen.getByRole('button', { name: 'Suggest a meal' }));
}

beforeEach(() => {
  mockSuggestMeals.mockResolvedValue({ suggestions: SUGGESTIONS });
  mockUseAiSettings.mockReturnValue(activeOn('anthropic'));
});

afterEach(() => jest.clearAllMocks());

describe.each([
  ['side by side', false],
  ['stacked', true],
])('Today, %s', (_layout, stacked) => {
  beforeEach(() => mockUseStacked.mockReturnValue(stacked));

  it('asks for nothing until a meal type is picked', async () => {
    await renderToday();

    expect(screen.getByText('Pick one to get suggestions.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Suggest a meal' }));
    expect(mockSuggestMeals).not.toHaveBeenCalled();
  });

  it('sends the ask and the meal type, and shows the three that come back', async () => {
    await renderToday();
    await askFor('Dinner', 'use the spinach');

    expect(mockSuggestMeals.mock.calls[0][0]).toEqual({
      ask: 'use the spinach',
      mealType: 'Dinner',
    });
    for (const { title } of SUGGESTIONS) {
      expect(await screen.findByText(title)).toBeTruthy();
    }
    expect(screen.getByText('Choose one to see what it takes.')).toBeTruthy();
  });

  it('shows where the cards will be while waiting', async () => {
    mockSuggestMeals.mockReturnValue(new Promise(() => {}));
    await renderToday();
    await askFor('Breakfast');

    expect(screen.getByLabelText('Finding suggestions')).toBeTruthy();
  });

  it('says so when the ask fails', async () => {
    mockSuggestMeals.mockRejectedValue(new Error('POST /api/suggest failed: 500'));
    await renderToday();
    await askFor('Snack');

    expect(
      await screen.findByText('Those suggestions did not come through. Try again.'),
    ).toBeTruthy();
  });

  it('asks for a provider before anything else, and asks nothing without one', async () => {
    mockUseAiSettings.mockReturnValue({ data: { connections: [] } });
    await renderToday();
    await askFor('Dinner');

    expect(screen.getByText('Set up an AI provider to get suggestions.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open AI settings' })).toBeTruthy();
    expect(mockSuggestMeals).not.toHaveBeenCalled();
  });

  it('asks for a provider when the one set up is not active', async () => {
    mockUseAiSettings.mockReturnValue({
      data: {
        connections: [{ provider: 'anthropic', model: 'm', keyHint: 'abcd', active: false }],
      },
    });
    await renderToday();

    expect(screen.getByText('Set up an AI provider to get suggestions.')).toBeTruthy();
  });

  it('does not ask for a provider while the settings are still loading', async () => {
    mockUseAiSettings.mockReturnValue({ data: undefined });
    await renderToday();

    expect(screen.queryByText('Set up an AI provider to get suggestions.')).toBeNull();
  });

  it.each([
    ['no_ai_key', 'Set up an AI provider to get suggestions.', true],
    ['ai_key_invalid', 'Anthropic did not accept the API key.', true],
    ['ai_model_unavailable', 'The chosen model is not available any more.', true],
    ['ai_rate_limited', 'Anthropic is limiting requests. Wait a moment.', false],
    ['ai_unavailable', 'Could not reach Anthropic. Try again.', false],
    ['ai_refused', 'The model declined that ask. Try putting it another way.', false],
  ] as const)('explains a %s failure', async (code, message, toSettings) => {
    mockSuggestMeals.mockRejectedValue(new ApiError(422, 'from the server', code));
    await renderToday();
    await askFor('Dinner');

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open AI settings' }) !== null).toBe(toSettings);
  });

  it("passes on the provider's own reason", async () => {
    mockSuggestMeals.mockRejectedValue(
      new ApiError(422, 'Your credit balance is too low', 'ai_rejected'),
    );
    await renderToday();
    await askFor('Dinner');

    expect(await screen.findByText('Anthropic: Your credit balance is too low')).toBeTruthy();
  });

  it('names Workers AI when that is the provider, and points a demoted user to settings', async () => {
    mockUseAiSettings.mockReturnValue(activeOn('workers-ai'));
    mockSuggestMeals.mockRejectedValue(new ApiError(403, 'from the server', 'ai_not_allowed'));
    await renderToday();
    await askFor('Dinner');

    expect(
      await screen.findByText(
        'Workers AI is for Pro and Admin users only. Choose another provider.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open AI settings' })).toBeTruthy();
  });

  it('shows the method of the chosen one beside its ingredients', async () => {
    await renderToday();
    await askFor('Dinner');
    await screen.findByText('Spinach frittata');

    expect(screen.queryByText('Method')).toBeNull();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Choose' })[0]);

    expect(screen.getByText('Ingredients')).toBeTruthy();
    expect(screen.getByText('Method')).toBeTruthy();
    expect(screen.getByText('Wilt the spinach.')).toBeTruthy();
    expect(screen.getByText('Add the eggs and set under the grill.')).toBeTruthy();
  });

  it('lists what the chosen one takes, and rescales it with the portions', async () => {
    await renderToday();
    await askFor('Dinner');
    await screen.findByText('Spinach frittata');

    await fireEvent.press(screen.getAllByRole('button', { name: 'Choose' })[0]);

    expect(screen.getByText('Ingredients')).toBeTruthy();
    expect(screen.getByText('200 g')).toBeTruthy();
    expect(screen.getByText('to taste')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'More portions' }));

    expect(screen.getByText('300 g')).toBeTruthy();
    expect(screen.getByText('to taste')).toBeTruthy();
  });

  it('shows how long each one takes, on the card and once chosen', async () => {
    await renderToday();
    await askFor('Dinner');
    await screen.findByText('Spinach frittata');

    expect(screen.getByText('20 min')).toBeTruthy();
    expect(screen.getByText('1 h 15 min')).toBeTruthy();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Choose' })[0]);

    expect(screen.getAllByText('20 min')).toHaveLength(2);
  });

  it('forgets the choice when asked again', async () => {
    await renderToday();
    await askFor('Dinner');
    await screen.findByText('Spinach frittata');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Choose' })[0]);
    expect(screen.getByRole('button', { name: 'Chosen' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Suggest a meal' }));

    expect(await screen.findByText('Choose one to see what it takes.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chosen' })).toBeNull();
  });
});
