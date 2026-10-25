import {
  suggestResponseSchema,
  type SuggestRequest,
  type SuggestResponse,
} from '@autobourdain/shared';

import { AiError } from '../ai/errors';
import type { AiAccess, AiProviderAdapter } from '../ai/types';
import { buildPrompt, buildSystem } from './prompt';
import { modelOutputSchema, type ModelOutput } from './schema';

/**
 * Asks the model for suggestions and turns its reply into the API's response.
 *
 * A reply that does not fit the schema gets one more try, unannounced. A
 * second miss is passed on as `bad_output`. Any other failure is passed on as
 * it is - retrying a refused key or a refusal would not change the answer.
 */
export async function generateSuggestions(
  adapter: AiProviderAdapter,
  call: { access: AiAccess; model: string },
  request: SuggestRequest,
  recipePreferences: string,
): Promise<SuggestResponse> {
  const generate = () =>
    adapter.generate<ModelOutput>({
      ...call,
      system: buildSystem(recipePreferences),
      prompt: buildPrompt(request),
      schema: modelOutputSchema,
    });

  let output: ModelOutput;
  try {
    output = await generate();
  } catch (error) {
    if (!(error instanceof AiError && error.code === 'bad_output')) throw error;
    output = await generate();
  }

  return suggestResponseSchema.parse({
    suggestions: output.suggestions.map((suggestion) => ({
      ...suggestion,
      id: crypto.randomUUID(),
      imageUrl: null,
    })),
  });
}
