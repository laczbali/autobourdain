import { fireEvent, render, screen } from '@testing-library/react-native';

import { NavItem } from './nav-item';

// @testing-library/react-native 14 renders and fires events asynchronously,
// so every call here is awaited.
describe('NavItem', () => {
  it('is a tab, and unselected unless the trigger says otherwise', async () => {
    await render(<NavItem label="Kitchen" />);
    const item = screen.getByRole('tab');
    expect(item.props.accessibilityState).toMatchObject({ selected: false });
  });

  it('reports itself selected when the trigger hands it focus', async () => {
    await render(<NavItem label="Kitchen" isFocused />);
    expect(screen.getByRole('tab', { selected: true })).toBeTruthy();
  });

  it('reports itself disabled, and does not press', async () => {
    const onPress = jest.fn();
    await render(<NavItem label="Kitchen" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('tab', { disabled: true }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
