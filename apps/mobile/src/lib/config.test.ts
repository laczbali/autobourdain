/**
 * API_URL is resolved once, when the module is first imported, so every case
 * here builds the world it wants and then loads config.ts fresh.
 */

type World = {
  /** Metro's "host:port", as Expo reports it for the running dev server. */
  hostUri?: string;
  dev?: boolean;
  apiUrl?: string;
};

function apiUrlWith({ hostUri, dev = true, apiUrl }: World): string {
  jest.resetModules();
  (globalThis as { __DEV__?: boolean }).__DEV__ = dev;

  if (apiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = apiUrl;

  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: hostUri ? { hostUri } : {} },
  }));

  return jest.requireActual<typeof import('./config')>('./config').API_URL;
}

describe('API_URL on native', () => {
  it('puts the Worker on the host that served the bundle', () => {
    // What a phone running Expo Go sees: Metro on the machine's LAN address,
    // and the Worker on the same machine a port along. This is the case that
    // means nobody has to write their own IP into a config file.
    expect(apiUrlWith({ hostUri: '192.168.0.16:8081' })).toBe('http://192.168.0.16:8787');
  });

  it('falls back to localhost when there is no dev server to ask', () => {
    expect(apiUrlWith({ hostUri: undefined })).toBe('http://localhost:8787');
  });

  it('never derives a dev server address outside development', () => {
    // A release build has no Metro. Reaching for one would be a bug that only
    // shows up in a store build, which is the worst place to find it.
    expect(apiUrlWith({ hostUri: '192.168.0.16:8081', dev: false })).not.toContain('192.168.0.16');
  });

  it('lets EXPO_PUBLIC_API_URL win, which is how a build reaches production', () => {
    expect(
      apiUrlWith({ hostUri: '192.168.0.16:8081', apiUrl: 'https://autobourdain.blaczko.com' }),
    ).toBe('https://autobourdain.blaczko.com');
  });
});
