import js from '@eslint/js';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Build output and generated declarations. Everything here is gitignored
    // or written by a generator, so linting it only produces noise.
    ignores: [
      'apps/mobile/dist/**',
      'apps/mobile/.expo/**',
      'apps/mobile/expo-env.d.ts',
      'apps/mobile/nativewind-env.d.ts',
      'apps/api/migrations/**',
      'worker-configuration.d.ts',
      '.wrangler/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        // projectService picks the nearest tsconfig per file, which is what
        // three workspaces with three different tsconfigs need.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The type-aware handful. These are the async mistakes tsc compiles
      // happily - an unawaited promise in a Worker handler is a dropped write.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },

  {
    // Expo / React Native / react-hooks rules, mobile only. The API and shared
    // packages are neither React nor React Native.
    files: ['apps/mobile/**/*.{js,jsx,ts,tsx}'],
    extends: [expoConfig],
  },

  {
    // TS only - the type-aware rule cannot run on the CommonJS config files.
    // `onPress={submit}` with an async submit is idiomatic React Native, and
    // the auth client resolves with {data, error} rather than rejecting. The
    // rule stays at full strength everywhere else, including the Worker.
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },

  {
    // After the Expo config, which points `import/resolver` at the node
    // resolver and so cannot see the `@/*` paths in apps/mobile/tsconfig.json.
    files: ['**/*.ts', '**/*.tsx'],
    settings: {
      'import/resolver': {
        typescript: {
          project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
          // Three workspaces means three tsconfigs; that is the layout, not a
          // mistake to warn about on every run.
          noWarnOnMultipleProjects: true,
        },
      },
    },
  },

  {
    // Expo's generated config files are CommonJS running under Node, not
    // React Native modules - require() is the only thing they can use.
    files: ['**/*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Last, so it wins: switches off every rule that would argue with Prettier.
  prettierConfig,
);
