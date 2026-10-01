import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAccount } from '../account/provider';
import { Action, Text } from '../points/controls';

export function TestDataNotice() {
  const { state, controller } = useAccount();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (state.kind !== 'signedIn' || state.selected !== 'demo') return null;
  return (
    <View style={styles.notice}>
      <Text style={styles.title}>Test data</Text>
      <Text>Saved test profile. Your real data is unchanged.</Text>
      <Action
        quiet
        label="Return to real data"
        disabled={busy}
        onPress={() => {
          setBusy(true);
          setError('');
          void controller
            .select('real')
            .catch(() => setError('Could not return to real data. Try again.'))
            .finally(() => setBusy(false));
        }}
      />
      {!!error && <Text accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  notice: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#344C40',
    borderRadius: 12,
  },
  title: { fontFamily: 'Geist_600SemiBold' },
});
