import { SUGGESTION_COUNT, suggestionSchema } from '@autobourdain/shared';
import { z } from 'zod';

const { shape } = suggestionSchema;

/**
 * One suggestion as the model writes it: the contract's, minus what the server
 * owns. The id is made here, and there are no images yet. Built from the
 * shared schema, so the two cannot drift apart.
 *
 * The descriptions end up in the JSON schema the provider is sent.
 */
export const modelSuggestionSchema = suggestionSchema.omit({ id: true, imageUrl: true }).extend({
  description: shape.description.describe('A line or two for the card: what it is, not how.'),
  portions: shape.portions.describe('How many people the quantities feed.'),
  totalMinutes: shape.totalMinutes.describe('Minutes from starting to eating, waiting included.'),
  method: shape.method.describe('The steps, in order, one action each.'),
});

/** The whole reply the model is asked for. */
export const modelOutputSchema = z.object({
  suggestions: z.array(modelSuggestionSchema).length(SUGGESTION_COUNT),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;
