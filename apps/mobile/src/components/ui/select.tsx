import { useRef, useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { paletteVars } from '@/theme/palettes';
import { useTheme } from '@/theme/theme-provider';
import { typeScale } from '@/theme/tokens';

import { Caption, Label } from './text';

type Props<T extends string> = {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  /** Shown in the trigger while nothing is picked. */
  placeholder: string;
  label?: string;
  hint?: string;
  className?: string;
};

/** Where the trigger sat when the list opened, and the window it sat in. */
type Anchor = { x: number; y: number; width: number; height: number; window: string };

/**
 * A dropdown. The trigger is drawn like a `Field`, and the options open in a
 * panel just under it, the current one marked with the accent rule.
 *
 * The panel lives in a transparent Modal, positioned from where the trigger
 * measures in the window. That is what lets it float over whatever is below
 * on web and native alike. A tap outside closes it, as does Escape on web.
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  label,
  hint,
  className = '',
}: Props<T>) {
  const { theme, resolvedMode } = useTheme();
  const dimensions = useWindowDimensions();
  const windowKey = `${dimensions.width}x${dimensions.height}`;
  const trigger = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  // A resize while the list is open would leave it floating somewhere else,
  // so it only counts as open in the window it was opened in.
  const open = anchor !== null && anchor.window === windowKey;

  const show = () =>
    trigger.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y, width, height, window: windowKey }),
    );
  const close = () => setAnchor(null);

  return (
    <View className={`gap-1.5 ${className}`}>
      {label && <Label tone="secondary">{label}</Label>}
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value ?? placeholder}` : undefined}
        accessibilityState={{ expanded: open }}
        onPress={show}
        className={`flex-row items-center justify-between gap-3 rounded-card border bg-inset px-4 py-3 active:opacity-70 ${open ? 'border-accent' : 'border-control'}`}
      >
        <Text className={`${typeScale.body} ${value ? 'text-text' : 'text-muted'}`}>
          {value ?? placeholder}
        </Text>
        <Chevron />
      </Pressable>
      {hint && <Caption>{hint}</Caption>}

      <Modal transparent visible={open} animationType="none" onRequestClose={close}>
        {/* On web the Modal is portalled to the end of the document, outside
            the ThemeProvider's View - so the palette is applied again here, or
            every token in the panel would be unresolved. */}
        <View className="flex-1" style={paletteVars[theme][resolvedMode]}>
          <Pressable accessibilityLabel="Close" onPress={close} className="absolute inset-0" />
          {anchor && (
            <View
              accessibilityRole="menu"
              // Not a className: the position is only known once measured.
              style={{ top: anchor.y + anchor.height + 4, left: anchor.x, width: anchor.width }}
              className="absolute rounded-card border border-hairline bg-raised py-1"
            >
              {options.map((option) => {
                const selected = option === value;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(option);
                      close();
                    }}
                    className={`border-l-2 px-4 py-2.5 active:bg-inset ${selected ? 'border-accent' : 'border-transparent'}`}
                  >
                    <Text
                      className={
                        selected
                          ? `${typeScale.label} text-text`
                          : `${typeScale.body} text-secondary`
                      }
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

/** A small down chevron, drawn as two borders of a rotated square. */
function Chevron() {
  return <View className="mb-1 h-[7px] w-[7px] rotate-45 border-b border-r border-secondary" />;
}
