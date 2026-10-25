import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { typeScale } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const container: Record<ButtonVariant, string> = {
  primary: 'bg-accent',
  secondary: 'border border-control',
  ghost: '',
  // Outlined rather than filled, to stay as quiet as `secondary`.
  danger: 'border border-danger',
};

const label: Record<ButtonVariant, string> = {
  primary: 'text-on-accent',
  secondary: 'text-text',
  ghost: 'text-secondary',
  danger: 'text-danger',
};

const padding: Record<ButtonSize, string> = {
  sm: 'px-3 py-2',
  md: 'px-5 py-3',
};

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks presses. */
  pending?: boolean;
  className?: string;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  pending = false,
  disabled = false,
  className = '',
  ...rest
}: Props) {
  const { palette } = useTheme();
  const spinnerColor =
    variant === 'primary'
      ? palette['on-accent']
      : variant === 'danger'
        ? palette.danger
        : palette.accent;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || pending}
      className={`items-center justify-center rounded-card active:opacity-70 ${container[variant]} ${padding[size]} ${disabled || pending ? 'opacity-50' : ''} ${className}`}
      {...rest}
    >
      {pending ? (
        // Not a className: ActivityIndicator takes a colour prop.
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text className={`${typeScale.button} ${label[variant]}`}>{title}</Text>
      )}
    </Pressable>
  );
}
