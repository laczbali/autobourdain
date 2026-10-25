import { parseCachedAppearance } from './preference-cache.shared';

describe('parseCachedAppearance', () => {
  it('reads back what was written', () => {
    expect(parseCachedAppearance(JSON.stringify({ theme: 'warm-ink', mode: 'dark' }))).toEqual({
      theme: 'warm-ink',
      mode: 'dark',
    });
  });

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['broken JSON', '{"theme":'],
    ['a theme that no longer exists', JSON.stringify({ theme: 'cool-sage', mode: 'dark' })],
    ['a missing mode', JSON.stringify({ theme: 'warm-ink' })],
  ])('gives up on %s', (_, raw) => {
    expect(parseCachedAppearance(raw)).toBeNull();
  });
});
