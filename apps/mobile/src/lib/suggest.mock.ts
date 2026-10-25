import {
  SUGGESTION_COUNT,
  suggestResponseSchema,
  type SuggestRequest,
  type SuggestResponse,
  type Suggestion,
} from '@autobourdain/shared';

/** Roughly what a model call will take, so the pending state is visible. */
export const MOCK_DELAY_MS = 1500;

/**
 * Stands in for `POST /api/suggest` until the backend lands, and goes when it
 * does. Picks three fixtures for the meal type at random, and validates them
 * against the shared schema, so the fixtures cannot drift from the contract.
 *
 * An ask containing the word "fail" rejects, to show the error state.
 */
export async function mockSuggestMeals(request: SuggestRequest): Promise<SuggestResponse> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

  if (/\bfail\b/i.test(request.ask)) {
    throw new Error('POST /api/suggest failed: 500');
  }

  const forMeal = FIXTURES.filter((fixture) => fixture.meals.includes(request.mealType));
  // A meal type with too few fixtures - a custom one, later - draws from all.
  const pool = forMeal.length >= SUGGESTION_COUNT ? forMeal : FIXTURES;
  const suggestions = shuffle(pool)
    .slice(0, SUGGESTION_COUNT)
    .map(({ meals: _meals, ...suggestion }) => suggestion);

  return suggestResponseSchema.parse({ suggestions });
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A canned suggestion, and which meal types it can be handed out for. */
type Fixture = Suggestion & { meals: readonly string[] };

/** Every meal type has more than three, so asking again comes back different. */
export const FIXTURES: readonly Fixture[] = [
  {
    id: 'spinach-frittata',
    meals: ['Breakfast', 'Dinner'],
    title: 'Spinach frittata',
    description: 'Eggs, wilted spinach and parmesan, set in one pan and finished under the grill.',
    imageUrl: null,
    portions: 2,
    ingredients: [
      { name: 'Eggs', quantity: 6, unit: null },
      { name: 'Spinach', quantity: 200, unit: 'g' },
      { name: 'Parmesan', quantity: 40, unit: 'g' },
      { name: 'Butter', quantity: 15, unit: 'g' },
      { name: 'Salt and pepper', quantity: null, unit: 'to taste' },
    ],
    method: [
      'Wilt the spinach in the butter, then squeeze out the water.',
      'Beat the eggs with half the parmesan and season.',
      'Pour over the spinach and cook gently until the edges set.',
      'Top with the rest of the parmesan and finish under the grill.',
    ],
  },
  {
    id: 'overnight-oats',
    meals: ['Breakfast'],
    title: 'Overnight oats with berries',
    description: 'Oats soaked in milk and yoghurt overnight, topped with berries in the morning.',
    imageUrl: null,
    portions: 1,
    ingredients: [
      { name: 'Rolled oats', quantity: 50, unit: 'g' },
      { name: 'Milk', quantity: 120, unit: 'ml' },
      { name: 'Greek yoghurt', quantity: 2, unit: 'tbsp' },
      { name: 'Honey', quantity: 1, unit: 'tsp' },
      { name: 'Mixed berries', quantity: 80, unit: 'g' },
    ],
    method: [
      'Stir the oats, milk, yoghurt and honey together in a jar.',
      'Cover and leave in the fridge overnight.',
      'Top with the berries before eating.',
    ],
  },
  {
    id: 'shakshuka',
    meals: ['Breakfast', 'Dinner'],
    title: 'Shakshuka',
    description: 'Eggs poached in a spiced tomato and pepper sauce. Bread for the pan.',
    imageUrl: null,
    portions: 2,
    ingredients: [
      { name: 'Eggs', quantity: 4, unit: null },
      { name: 'Chopped tomatoes', quantity: 400, unit: 'g' },
      { name: 'Red pepper', quantity: 1, unit: null },
      { name: 'Onion', quantity: 1, unit: null },
      { name: 'Ground cumin', quantity: 1, unit: 'tsp' },
      { name: 'Smoked paprika', quantity: 1, unit: 'tsp' },
      { name: 'Olive oil', quantity: 2, unit: 'tbsp' },
    ],
    method: [
      'Soften the onion and pepper in the oil.',
      'Add the spices, then the tomatoes, and simmer for 10 minutes.',
      'Make four wells, crack in the eggs, cover and cook until just set.',
    ],
  },
  {
    id: 'banana-pancakes',
    meals: ['Breakfast'],
    title: 'Banana pancakes',
    description: 'Small, thick pancakes sweetened with ripe banana. No sugar needed.',
    imageUrl: null,
    portions: 2,
    ingredients: [
      { name: 'Ripe bananas', quantity: 2, unit: null },
      { name: 'Eggs', quantity: 2, unit: null },
      { name: 'Plain flour', quantity: 100, unit: 'g' },
      { name: 'Milk', quantity: 100, unit: 'ml' },
      { name: 'Baking powder', quantity: 1, unit: 'tsp' },
      { name: 'Butter', quantity: null, unit: 'for the pan' },
    ],
    method: [
      'Mash the bananas, then whisk in the eggs and milk.',
      'Fold in the flour and baking powder.',
      'Fry spoonfuls in butter over a medium heat, two minutes a side.',
    ],
  },
  {
    id: 'yoghurt-honey-walnuts',
    meals: ['Breakfast', 'Snack'],
    title: 'Yoghurt with honey and walnuts',
    description: 'Thick yoghurt, toasted walnuts and a drizzle of honey. Two minutes.',
    imageUrl: null,
    portions: 1,
    ingredients: [
      { name: 'Greek yoghurt', quantity: 150, unit: 'g' },
      { name: 'Walnuts', quantity: 25, unit: 'g' },
      { name: 'Honey', quantity: 2, unit: 'tsp' },
    ],
    method: [
      'Toast the walnuts in a dry pan until fragrant.',
      'Spoon the yoghurt into a bowl and top with the walnuts and honey.',
    ],
  },
  {
    id: 'miso-salmon-bowl',
    meals: ['Dinner'],
    title: 'Miso salmon bowl',
    description: 'Miso-glazed salmon over rice, with quick-pickled cucumber and spring onion.',
    imageUrl: null,
    portions: 2,
    ingredients: [
      { name: 'Salmon fillets', quantity: 2, unit: null },
      { name: 'White miso', quantity: 2, unit: 'tbsp' },
      { name: 'Rice', quantity: 150, unit: 'g' },
      { name: 'Cucumber', quantity: 0.5, unit: null },
      { name: 'Rice vinegar', quantity: 2, unit: 'tbsp' },
      { name: 'Spring onions', quantity: 2, unit: null },
    ],
    method: [
      'Cook the rice.',
      'Slice the cucumber thinly and toss with the vinegar.',
      'Brush the salmon with the miso and roast at 200C for 12 minutes.',
      'Serve over the rice with the cucumber and sliced spring onion.',
    ],
  },
  {
    id: 'lemon-chicken-traybake',
    meals: ['Dinner'],
    title: 'Lemon chicken traybake',
    description: 'Chicken thighs, potatoes and lemon roasted together in one tray.',
    imageUrl: null,
    portions: 4,
    ingredients: [
      { name: 'Chicken thighs', quantity: 8, unit: null },
      { name: 'Small potatoes', quantity: 750, unit: 'g' },
      { name: 'Lemons', quantity: 2, unit: null },
      { name: 'Garlic cloves', quantity: 6, unit: null },
      { name: 'Olive oil', quantity: 3, unit: 'tbsp' },
      { name: 'Thyme', quantity: null, unit: 'a few sprigs' },
    ],
    method: [
      'Halve the potatoes and quarter the lemons.',
      'Toss everything in a tray with the oil, garlic and thyme, and season.',
      'Roast at 200C for 45 minutes, turning once.',
    ],
  },
  {
    id: 'pasta-with-greens',
    meals: ['Dinner'],
    title: 'Pasta with greens',
    description: 'Short pasta with garlicky greens, chilli and plenty of parmesan.',
    imageUrl: null,
    portions: 2,
    ingredients: [
      { name: 'Short pasta', quantity: 200, unit: 'g' },
      { name: 'Cavolo nero or kale', quantity: 150, unit: 'g' },
      { name: 'Garlic cloves', quantity: 2, unit: null },
      { name: 'Chilli flakes', quantity: 0.5, unit: 'tsp' },
      { name: 'Parmesan', quantity: 30, unit: 'g' },
      { name: 'Olive oil', quantity: 3, unit: 'tbsp' },
    ],
    method: [
      'Cook the pasta, adding the greens for the last three minutes.',
      'Warm the garlic and chilli in the oil.',
      'Drain, toss everything together with a splash of the pasta water and the parmesan.',
    ],
  },
  {
    id: 'chickpea-curry',
    meals: ['Dinner'],
    title: 'Chickpea and spinach curry',
    description: 'A quick tomato and coconut curry. Good with rice or flatbread.',
    imageUrl: null,
    portions: 4,
    ingredients: [
      { name: 'Chickpeas, drained', quantity: 800, unit: 'g' },
      { name: 'Coconut milk', quantity: 400, unit: 'ml' },
      { name: 'Chopped tomatoes', quantity: 400, unit: 'g' },
      { name: 'Spinach', quantity: 100, unit: 'g' },
      { name: 'Onion', quantity: 1, unit: null },
      { name: 'Curry paste', quantity: 3, unit: 'tbsp' },
    ],
    method: [
      'Soften the onion, then fry the curry paste for a minute.',
      'Add the tomatoes, coconut milk and chickpeas, and simmer for 15 minutes.',
      'Stir in the spinach until it wilts.',
    ],
  },
  {
    id: 'hummus-crudites',
    meals: ['Snack'],
    title: 'Hummus and crudites',
    description: 'A fast blender hummus with whatever raw vegetables are around.',
    imageUrl: null,
    portions: 4,
    ingredients: [
      { name: 'Chickpeas, drained', quantity: 400, unit: 'g' },
      { name: 'Tahini', quantity: 3, unit: 'tbsp' },
      { name: 'Lemon', quantity: 1, unit: null },
      { name: 'Garlic clove', quantity: 1, unit: null },
      { name: 'Carrots, cucumber, peppers', quantity: null, unit: 'to dip' },
    ],
    method: [
      'Blend the chickpeas, tahini, lemon juice and garlic with a splash of cold water.',
      'Season, and cut the vegetables into sticks.',
    ],
  },
  {
    id: 'roasted-chickpeas',
    meals: ['Snack'],
    title: 'Spiced roasted chickpeas',
    description: 'Crunchy chickpeas roasted with smoked paprika and a little salt.',
    imageUrl: null,
    portions: 2,
    ingredients: [
      { name: 'Chickpeas, drained', quantity: 400, unit: 'g' },
      { name: 'Olive oil', quantity: 1, unit: 'tbsp' },
      { name: 'Smoked paprika', quantity: 1, unit: 'tsp' },
      { name: 'Salt', quantity: null, unit: 'to taste' },
    ],
    method: [
      'Dry the chickpeas well and toss with the oil and paprika.',
      'Roast at 200C for 25 minutes, shaking halfway, then salt.',
    ],
  },
  {
    id: 'avocado-toast',
    meals: ['Snack', 'Breakfast'],
    title: 'Avocado toast',
    description: 'Crushed avocado on sourdough, with lemon and chilli flakes.',
    imageUrl: null,
    portions: 1,
    ingredients: [
      { name: 'Sourdough slices', quantity: 2, unit: null },
      { name: 'Avocado', quantity: 1, unit: null },
      { name: 'Lemon juice', quantity: 1, unit: 'tsp' },
      { name: 'Chilli flakes', quantity: null, unit: 'a pinch' },
    ],
    method: [
      'Toast the bread.',
      'Crush the avocado with the lemon juice and season.',
      'Pile onto the toast and finish with the chilli.',
    ],
  },
];
