import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useHistory } from './provider';
import { Action, Text } from './controls';

export function Balance({ prominent = false }: { prominent?: boolean }) {
  const { state, account, controller } = useHistory();
  const { fontScale } = useWindowDimensions();
  if (account.kind === 'signedOut')
    return <Text>Sign in to see your points.</Text>;
  if (account.kind === 'unavailable')
    return <Text>Account connection unavailable.</Text>;
  return (
    <View style={styles.container}>
      {state.kind === 'ready' ? (
        <>
          <Text
            style={[
              styles.balance,
              prominent && styles.prominent,
              fontScale > 1.3 && styles.accessibleDisplay,
            ]}
            accessibilityLabel={`${state.page.balance} available points`}
          >
            {state.page.balance.toLocaleString()}
            {!prominent && <Text> available points</Text>}
          </Text>
          {prominent && <Text style={styles.unit}>pts</Text>}
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
  prominent: { fontSize: 60, lineHeight: 68 },
  accessibleDisplay: { fontSize: 24, lineHeight: 32 },
  unit: { color: '#CEDC00', fontSize: 17, lineHeight: 25 },
});
