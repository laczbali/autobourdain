import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme/theme-provider';

import { Button, type ButtonVariant } from './button';

// @testing-library/react-native 14 renders and fires events asynchronously,
// so every call here is awaited.
function renderButton(props: Parameters<typeof Button>[0]) {
  return render(
    <ThemeProvider initialTheme="cocoa-plum" initialMode="light">
      <Button {...props} />
    </ThemeProvider>,
  );
}

describe('Button', () => {
  it.each<ButtonVariant>(['primary', 'secondary', 'ghost'])(
    'renders the %s variant',
    async (variant) => {
      await renderButton({ title: 'Suggest a meal', variant });
      expect(screen.getByText('Suggest a meal')).toBeTruthy();
    },
  );

  it('presses', async () => {
    const onPress = jest.fn();
    await renderButton({ title: 'Suggest a meal', onPress });
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not press while disabled', async () => {
    const onPress = jest.fn();
    await renderButton({ title: 'Suggest a meal', onPress, disabled: true });
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('swaps the label for a spinner while pending, and blocks the press', async () => {
    const onPress = jest.fn();
    await renderButton({ title: 'Suggest a meal', onPress, pending: true });
    expect(screen.queryByText('Suggest a meal')).toBeNull();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
