import { View } from 'react-native';

/**
 * Makes `measureInWindow` answer in tests, so a `Select` can open. The jest
 * preset's mocked View carries it as a bare `jest.fn()` on its prototype,
 * which never calls back - and the list only opens once it knows where the
 * trigger is. Call it at the top of a test file.
 */
export function measureTriggers() {
  beforeEach(() => {
    jest
      .spyOn(View.prototype, 'measureInWindow')
      .mockImplementation((callback) => callback(0, 0, 240, 44));
  });
  afterEach(() => jest.restoreAllMocks());
}
