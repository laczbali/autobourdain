import { z } from 'zod';

/** How many suggestions one ask comes back with. */
export const SUGGESTION_COUNT = 3;

/**
 * One line of an ingredient list. `quantity` is per the recipe's own portions,
 * so the app can rescale it. It is null for anything unmeasured, in which case
 * `unit` carries the wording instead - "to taste", "a handful".
 */
export const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().nullable(),
  unit: z.string().min(1).nullable(),
});

export type Ingredient = z.infer<typeof ingredientSchema>;

/** A suggested meal, complete enough to cook from. */
export const suggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** A line or two, for the card. */
  description: z.string().min(1),
  /** There is no photo store yet, so this is null more often than not. */
  imageUrl: z.url().nullable(),
  /** How many the quantities below are for. */
  portions: z.number().int().positive(),
  ingredients: z.array(ingredientSchema).min(1),
  /** The steps, in order. */
  method: z.array(z.string().min(1)).min(1),
});

export type Suggestion = z.infer<typeof suggestionSchema>;

/**
 * The body of `POST /api/suggest`. The meal type is a free string rather than
 * an enum, because the list will be the user's to edit.
 */
export const suggestRequestSchema = z
  .object({
    /** Free text, and allowed to be empty. */
    ask: z.string().trim().max(500),
    mealType: z.string().trim().min(1),
  })
  .strict();

export type SuggestRequest = z.infer<typeof suggestRequestSchema>;

export const suggestResponseSchema = z.object({
  suggestions: z.array(suggestionSchema).length(SUGGESTION_COUNT),
});

export type SuggestResponse = z.infer<typeof suggestResponseSchema>;
