import { Redirect } from 'expo-router';

/** Settings has no page of its own - it opens on the first section. */
export default function SettingsIndex() {
  return <Redirect href="/settings/appearance" />;
}
