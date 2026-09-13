/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class', not the default 'media'. Under 'media', react-native-css-interop's
  // stylesheet observer calls colorScheme.set() once Metro injects the CSS, and
  // that setter rejects 'media' - which surfaces as an uncaught error overlay on
  // every dev page load. Under 'class' the OS preference is pushed in by the
  // effect in src/app/_layout.tsx, which also gives us a place to hang a manual
  // theme toggle later.
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
