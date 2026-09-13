/**
 * The native preset: tests render the React Native tree, which is what the app
 * is written in and what React Native Testing Library drives. The web preset
 * swaps react-native for react-native-web and renders DOM, which RNTL cannot
 * drive - that combination needs @testing-library/react instead.
 *
 * 'jest-expo/universal' runs ios, android, web and node as separate projects,
 * and is the thing to reach for once native builds exist.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
};
