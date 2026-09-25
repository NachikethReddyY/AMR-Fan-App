import { StyleSheet, View } from 'react-native';
import { useHistory } from './provider';
import { Action, Text } from './controls';

export function Balance() {
  const { state, account, profile, controller } = useHistory();
  if (account.kind === 'signedOut')
    return <Text>Sign in to see your points.</Text>;
  if (account.kind === 'unavailable')
    return <Text>Account connection unavailable.</Text>;
  return (
    <View style={styles.container}>
      {state.kind === 'ready' ? (
        <>
          <Text
            style={styles.balance}
            accessibilityLabel={`${state.page.balance} available points, ${profile?.kind === 'demo' ? 'demo profile' : 'real profile'}`}
          >
            {state.page.balance.toLocaleString()} <Text>available points</Text>
          </Text>
          <Text style={styles.caption}>
            {profile?.kind === 'demo' ? 'Demo profile' : 'Real profile'}
          </Text>
        </>
      ) : state.kind === 'unavailable' ? (
        <>
          <Text accessibilityLiveRegion="polite">{state.message}</Text>
          <Action
            label="Retry balance and History"
            onPress={() => {
              void controller.refresh();
            }}
          />
        </>
      ) : (
        <Text accessibilityLiveRegion="polite">Loading balance…</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 8 },
  balance: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 32,
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  caption: { color: '#A9A9A3', fontSize: 14, lineHeight: 20 },
});
