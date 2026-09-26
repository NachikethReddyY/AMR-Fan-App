import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Action, Text } from '../points/controls';
import { api } from '../account/native-auth';
import { AccountError } from '../account/api';
import { useAccount } from '../account/provider';
import { useProfileContext, useResource } from '../account/useResource';
import { createRewardsApi } from './api';
import type { Receipt } from './contracts';
const rewards = createRewardsApi(api.request);
export function ReceiptDetail({ receipt }: { receipt: Receipt }) {
  const ctx = useProfileContext();
  const { controller } = useAccount();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function open() {
    if (!ctx || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await rewards.content(ctx, receipt.offerId);
      setText(result.text);
    } catch (e) {
      if (e instanceof AccountError && e.status === 401)
        await controller.expire(ctx.token);
      else setError('Content unavailable. Retry opening it.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{receipt.title}</Text>
      <Text>
        {receipt.paidPoints.toLocaleString()} points paid ·{' '}
        {new Date(receipt.purchasedAt).toLocaleString()}
      </Text>
      {receipt.kind === 'tree' && (
        <>
          <Text>Dedication for {receipt.accountName}</Text>
          <Text>
            Demonstration dedication. No real tree allocation is claimed.
          </Text>
        </>
      )}
      {receipt.kind === 'discount' && (
        <>
          <Text>{receipt.percentage}% merchandise discount</Text>
          <Text>
            Demonstration voucher. No redeemable retailer code is available.
          </Text>
        </>
      )}
      {receipt.kind === 'content' && (
        <>
          <Text>Content unlocked</Text>
          {text === null ? (
            <Action
              label={busy ? 'Opening content…' : 'Open retained content'}
              disabled={busy}
              onPress={() => {
                void open();
              }}
            />
          ) : (
            <Text selectable>{text}</Text>
          )}
        </>
      )}
      {error && <Text accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}
export function ReceiptHistory() {
  const { state, controller } = useResource(rewards.receipts);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Retained rewards</Text>
      <Action
        label={
          state.kind === 'loading'
            ? 'Loading rewards…'
            : 'Refresh retained rewards'
        }
        disabled={state.kind === 'loading'}
        onPress={() => {
          void controller.refresh();
        }}
      />
      {state.kind === 'error' && (
        <Text accessibilityLiveRegion="polite">{state.error}</Text>
      )}
      {state.kind === 'ready' && (
        <>
          {state.items.length === 0 && <Text>No retained rewards yet.</Text>}
          {state.items.map((r) => (
            <ReceiptDetail key={r.id} receipt={r} />
          ))}
          {state.error && <Text>{state.error}</Text>}
          {state.nextCursor && (
            <Action
              label={state.busy ? 'Loading…' : 'Load more retained rewards'}
              disabled={state.busy}
              onPress={() => {
                void controller.more();
              }}
            />
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 16 },
  row: {
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
  },
  title: { fontFamily: 'Geist_600SemiBold', color: '#F5F5F3' },
});
