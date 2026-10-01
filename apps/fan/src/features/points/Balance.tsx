import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useHistory } from './provider';
import { Text } from './controls';
import { RotateCw } from 'lucide-react-native';

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry balance and History"
            style={({ pressed }) => [
              styles.retry,
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => {
              void controller.refresh();
            }}
          >
            <RotateCw size={20} color="#F5F5F3" accessible={false} />
          </Pressable>
        </>
      ) : (
        <Text accessibilityLiveRegion="polite">Loading balance…</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 8 },
  retry: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222222',
    borderColor: '#3D3D3D',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
