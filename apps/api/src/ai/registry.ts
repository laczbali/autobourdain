import type { AiProvider } from '@autobourdain/shared';

import { anthropic } from './anthropic';
import type { AiProviderAdapter } from './types';

/** Every provider in `AI_PROVIDERS`, and the adapter that talks to it. */
export const ADAPTERS: Record<AiProvider, AiProviderAdapter> = {
  anthropic,
};
