import { Text as RNText, type TextProps } from 'react-native';

import { typeScale } from '@/theme/tokens';

export type Tone = 'text' | 'secondary' | 'muted' | 'accent' | 'on-accent' | 'in-stock' | 'to-buy';

// Written out rather than built from the token names, so the Tailwind compiler
// can see every class it has to emit.
const toneClass: Record<Tone, string> = {
  text: 'text-text',
  secondary: 'text-secondary',
  muted: 'text-muted',
  accent: 'text-accent',
  'on-accent': 'text-on-accent',
  'in-stock': 'text-in-stock',
  'to-buy': 'text-to-buy',
};

type Props = TextProps & { tone?: Tone; className?: string };

/** Newsreader, three steps. Level 1 is a page title, 3 a section heading. */
export function Heading({
  level = 2,
  tone = 'text',
  className = '',
  ...rest
}: Props & { level?: 1 | 2 | 3 }) {
  const size = level === 1 ? typeScale.h1 : level === 2 ? typeScale.h2 : typeScale.h3;
  return <RNText className={`${size} ${toneClass[tone]} ${className}`} {...rest} />;
}

/** A number meant to be read as one: portions, minutes, counts. */
export function Numeral({ tone = 'text', className = '', ...rest }: Props) {
  return <RNText className={`${typeScale.numeral} ${toneClass[tone]} ${className}`} {...rest} />;
}

export function Body({
  tone = 'text',
  large = false,
  className = '',
  ...rest
}: Props & { large?: boolean }) {
  const size = large ? typeScale.bodyLarge : typeScale.body;
  return <RNText className={`${size} ${toneClass[tone]} ${className}`} {...rest} />;
}

/** The name of a control or a value. */
export function Label({ tone = 'text', className = '', ...rest }: Props) {
  return <RNText className={`${typeScale.label} ${toneClass[tone]} ${className}`} {...rest} />;
}

/** Small print: asides, counts, the line under a field. */
export function Caption({ tone = 'muted', className = '', ...rest }: Props) {
  return <RNText className={`${typeScale.caption} ${toneClass[tone]} ${className}`} {...rest} />;
}

/** The uppercase section marker the frames put above a list. */
export function Eyebrow({ tone = 'secondary', className = '', ...rest }: Props) {
  return <RNText className={`${typeScale.eyebrow} ${toneClass[tone]} ${className}`} {...rest} />;
}
