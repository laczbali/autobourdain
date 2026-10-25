import { formatIngredientAmount, formatNumber, roundQuantity } from './scale';

describe('roundQuantity', () => {
  it('takes large amounts to the nearest 5', () => {
    expect(roundQuantity(333.3, 'g')).toBe(335);
  });

  it('takes mid-sized amounts to a whole number', () => {
    expect(roundQuantity(13.4, 'g')).toBe(13);
  });

  it('takes small measured amounts to a quarter', () => {
    expect(roundQuantity(0.7, 'tsp')).toBe(0.75);
  });

  it('takes counted things to a half', () => {
    expect(roundQuantity(1.3, null)).toBe(1.5);
  });

  it('never rounds down to zero', () => {
    expect(roundQuantity(0.05, 'tsp')).toBe(0.25);
    expect(roundQuantity(0.1, null)).toBe(0.5);
  });
});

describe('formatNumber', () => {
  it.each([
    [3, '3'],
    [0.5, '1/2'],
    [0.25, '1/4'],
    [1.75, '1 3/4'],
    [335, '335'],
  ])('writes %p as %p', (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });
});

describe('formatIngredientAmount', () => {
  it('scales by the ratio of portions', () => {
    expect(formatIngredientAmount({ name: 'Spinach', quantity: 200, unit: 'g' }, 2, 3)).toBe(
      '300 g',
    );
  });

  it('leaves the amount alone at the base portions', () => {
    expect(formatIngredientAmount({ name: 'Eggs', quantity: 6, unit: null }, 2, 2)).toBe('6');
  });

  it('writes counted things without a unit', () => {
    expect(formatIngredientAmount({ name: 'Onion', quantity: 1, unit: null }, 4, 2)).toBe('1/2');
  });

  it('keeps the wording of an unmeasured ingredient', () => {
    expect(formatIngredientAmount({ name: 'Salt', quantity: null, unit: 'to taste' }, 2, 6)).toBe(
      'to taste',
    );
  });
});
