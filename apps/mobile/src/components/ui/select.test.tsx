import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { ThemeProvider } from '@/theme/theme-provider';

import { Select } from './select';
import { measureTriggers } from './select.testing';

const OPTIONS = ['Breakfast', 'Dinner', 'Snack'] as const;

measureTriggers();

/** Holds the value, so a pick shows up in the trigger the way it would on screen. */
function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState<(typeof OPTIONS)[number] | null>(null);
  return (
    <ThemeProvider initialTheme="cocoa-plum" initialMode="light">
      <Select
        label="Meal"
        placeholder="Pick a meal"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </ThemeProvider>
  );
}

describe('Select', () => {
  it('shows the placeholder while nothing is picked, and keeps the list closed', async () => {
    await render(<Harness />);
    expect(screen.getByText('Pick a meal')).toBeTruthy();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('opens on press and lists every option', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByRole('button', { name: 'Meal: Pick a meal' }));
    for (const option of OPTIONS) {
      expect(screen.getByRole('menuitem', { name: option })).toBeTruthy();
    }
  });

  it('picks an option, closes, and shows it in the trigger', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Meal: Pick a meal' }));
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Dinner' }));

    expect(onChange).toHaveBeenCalledWith('Dinner');
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.getByRole('button', { name: 'Meal: Dinner' })).toBeTruthy();
  });

  it('closes without a change when the backdrop is pressed', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Meal: Pick a meal' }));
    await fireEvent.press(screen.getByLabelText('Close'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
