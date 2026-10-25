import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { typeScale } from '@/theme/tokens';

import { Caption, Label } from './text';

type Props = TextInputProps & {
  label?: string;
  /** Replaces the hint and turns the border, when set. */
  error?: string;
  hint?: string;
  className?: string;
  /** Extra classes for the input itself - a taller box, say. */
  inputClassName?: string;
};

export function Field({ label, error, hint, className = '', inputClassName = '', ...rest }: Props) {
  const { palette } = useTheme();

  return (
    <View className={`gap-1.5 ${className}`}>
      {label && <Label tone="secondary">{label}</Label>}
      <TextInput
        // The placeholder is not a className either - RN styles it by prop.
        placeholderTextColor={palette.muted}
        className={`rounded-card border bg-inset px-4 py-3 text-text ${typeScale.body} ${error ? 'border-danger' : 'border-control'} ${inputClassName}`}
        {...rest}
      />
      {(error ?? hint) && <Caption tone={error ? 'danger' : 'muted'}>{error ?? hint}</Caption>}
    </View>
  );
}
