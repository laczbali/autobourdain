import { View, type ViewProps } from 'react-native';

type Props = ViewProps & { className?: string };

/** A panel sitting on the canvas. */
export function Card({ className = '', ...rest }: Props) {
  return (
    <View className={`rounded-card border border-hairline bg-raised p-4 ${className}`} {...rest} />
  );
}

/** A well sitting inside a panel: fields, read-only values, wells of detail. */
export function Inset({ className = '', ...rest }: Props) {
  return <View className={`rounded-card bg-inset p-4 ${className}`} {...rest} />;
}
