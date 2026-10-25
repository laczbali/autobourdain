import { expoClient } from '@better-auth/expo/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { API_URL } from './config';

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/api/auth',
  plugins: [
    expoClient({
      scheme: 'autobourdain',
      storagePrefix: 'autobourdain',
      // Ignored on web, where the session is a normal cookie.
      storage: SecureStore,
    }),
    // The API's own field on the user, so the session carries it typed. Read
    // it through parseRole - the server is the one that enforces it.
    inferAdditionalFields({ user: { role: { type: 'string', required: false, input: false } } }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
