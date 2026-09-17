/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class', not the default 'media'. Under 'media', react-native-css-interop's
  // stylesheet observer calls colorScheme.set() once Metro injects the CSS, and
  // that setter rejects 'media' - which surfaces as an uncaught error overlay on
  // every dev page load. Under 'class' the OS preference is pushed in by
  // src/theme/theme-provider.tsx, which is also what holds the manual override.
  darkMode: 'class',
  theme: {
    extend: {
      // One entry per token in src/theme/tokens.ts. The values are supplied by
      // the ThemeProvider through NativeWind's vars(), which is what keeps mode
      // and theme independent - a stylesheet could only carry one of them.
      //
      // Channels rather than hex, so the alpha modifiers still work: `bg-raised`
      // and `bg-raised/60` both compile.
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        inset: 'rgb(var(--inset) / <alpha-value>)',
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
        rule: 'rgb(var(--rule) / <alpha-value>)',
        control: 'rgb(var(--control) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'in-stock': 'rgb(var(--in-stock) / <alpha-value>)',
        'to-buy': 'rgb(var(--to-buy) / <alpha-value>)',
      },
      // A family per weight, because that is how fonts work on native: there is
      // no synthesis and no weight axis to ask for, just the family that was
      // loaded. The same names are registered on web by the useFonts call in
      // src/app/_layout.tsx, so one className works on both.
      fontFamily: {
        display: ['Newsreader_400Regular', 'Georgia', 'serif'],
        'display-italic': ['Newsreader_400Regular_Italic', 'Georgia', 'serif'],
        'display-semibold': ['Newsreader_600SemiBold', 'Georgia', 'serif'],
        sans: ['DMSans_400Regular', 'system-ui', 'sans-serif'],
        'sans-medium': ['DMSans_500Medium', 'system-ui', 'sans-serif'],
        'sans-bold': ['DMSans_700Bold', 'system-ui', 'sans-serif'],
      },
      // The radius the hi-fi frames use on every panel, card and control.
      borderRadius: {
        card: '9px',
      },
    },
  },
  plugins: [],
};
