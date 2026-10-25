import type { Suggestion } from '@autobourdain/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Today from '@/app/(shell)/index';
import { useStacked } from '@/components/today/layout';
import { measureTriggers } from '@/components/ui/select.testing';
import { suggestMeals } from '@/lib/api';
import { ThemeProvider } from '@/theme/theme-provider';

// The screen is tested against what it asks for and what comes back, not the
// mock's delay and randomness. The shell barrel pulls in the auth client,
// which wants no better-auth here either.
jest.mock('@/lib/api', () => ({ suggestMeals: jest.fn() }));
jest.mock('@/lib/auth-client', () => ({ useSession: jest.fn() }));
// Every case runs in both layouts, rather than at whatever width jest reports.
jest.mock('@/components/today/layout', () => ({ useStacked: jest.fn() }));

const mockSuggestMeals = suggestMeals as jest.Mock;
const mockUseStacked = useStacked as jest.Mock;

measureTriggers();

function suggestion(id: string, title: string, overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id,
    title,
    description: `A description of ${title}.`,
    imageUrl: null,
    portions: 2,
    ingredients: [{ name: 'Rice', quantity: 150, unit: 'g' }],
    method: ['Cook it.'],
    ...overrides,
  };
}

const SUGGESTIONS = [
  suggestion('frittata', 'Spinach frittata', {
    ingredients: [
      { name: 'Spinach', quantity: 200, unit: 'g' },
      { name: 'Salt', quantity: null, unit: 'to taste' },
    ],
    method: ['Wilt the spinach.', 'Add the eggs and set under the grill.'],
  }),
  suggestion('salmon', 'Miso salmon bowl'),
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

    expect(screen.getByText('what it takes')).toBeTruthy();
    expect(screen.getByText('200 g')).toBeTruthy();
    expect(screen.getByText('to taste')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'More portions' }));

    expect(screen.getByText('300 g')).toBeTruthy();
    expect(screen.getByText('to taste')).toBeTruthy();
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
