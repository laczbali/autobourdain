import { useMutation } from '@tanstack/react-query';

import { suggestMeals } from './api';

/** The meal types on offer. Fixed for now - the list becomes the user's to edit. */
export const MEAL_TYPES = ['Breakfast', 'Dinner', 'Snack'] as const;

/**
 * Asks for suggestions. A mutation rather than a query: every press is a fresh
 * ask, and the same ask twice should come back different.
 */
export function useSuggest() {
  return useMutation({ mutationFn: suggestMeals });
}
