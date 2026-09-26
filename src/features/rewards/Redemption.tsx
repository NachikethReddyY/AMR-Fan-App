import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Action, Text } from '../points/controls';
import { useHistory } from '../points/provider';
import { useAccount } from '../account/provider';
import { AccountError } from '../account/api';
import { api } from '../account/native-auth';
import { privateStorage } from '../account/storage';
import { useProfileContext, useResource } from '../account/useResource';
import { createRewardsApi } from './api';
import { createPurchaseController } from './state';
import type { Offer } from './contracts';
import { ReceiptDetail } from './ReceiptDetail';
const rewards = createRewardsApi(api.request);
export function Redemption() {
  const ctx = useProfileContext();
  const { controller: session } = useAccount();
  const { controller: history } = useHistory();
  const catalogue = useResource(rewards.offers);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [purchase] = useState(() =>
    createPurchaseController(rewards, privateStorage, session.expire),
  );
  const state = useSyncExternalStore(purchase.subscribe, purchase.getState);
  useEffect(() => {
    void purchase.setContext(ctx);
    return () => {
      void purchase.setContext(null);
    };
  }, [purchase, ctx?.token, ctx?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () =>
      purchase.subscribe(() => {
        const state = purchase.getState();
        if (state.kind === 'success') {
          setSelected(null);
          void history.refresh();
        }
        if (state.kind === 'rejected') setSelected(null);
      }),
    [purchase, history],
  );
  async function choose(id: string) {
    if (!ctx) return;
    setReading(true);
    setError(null);
    setSelected(null);
    try {
      const current = await rewards.offer(ctx, id);
      setSelected(current);
    } catch (e) {
      if (e instanceof AccountError && e.status === 401)
        await session.expire(ctx.token);
      else setError('Offer unavailable. Refresh the catalogue.');
    } finally {
      setReading(false);
    }
  }
  const locked = state.kind === 'loading' || state.kind === 'retry';
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Rewards to redeem</Text>
      {state.kind === 'retry' && (
        <>
          <Text accessibilityLiveRegion="polite">{state.error}</Text>
          <Action
            label="Retry same purchase"
            onPress={() => {
              void purchase.retry();
            }}
          />
        </>
      )}
      {state.kind === 'rejected' && (
        <Text accessibilityLiveRegion="polite">{state.error}</Text>
      )}
      {state.kind === 'loading' && (
        <Text accessibilityLiveRegion="polite">Checking purchase…</Text>
      )}
      {state.kind === 'success' && (
        <>
          <Text accessibilityLiveRegion="polite">Purchase confirmed</Text>
          <ReceiptDetail receipt={state.result} />
        </>
      )}
      {selected && (
        <View style={styles.confirm}>
          <Text style={styles.title}>Confirm {selected.product.title}</Text>
          <Text>{selected.product.description}</Text>
          <Text>
            {selected.product.pointsPrice.toLocaleString()} points · Offer
            version {selected.version}
          </Text>
          {selected.product.kind === 'tree' && (
            <Text>Demonstration dedication in your current profile name.</Text>
          )}
          {selected.product.kind === 'discount' && (
            <Text>
              {selected.product.percentage}% demonstration voucher, without a
              redeemable code.
            </Text>
          )}
          <Action
            label={`Confirm ${selected.product.pointsPrice.toLocaleString()} points`}
            disabled={locked || !selected.enabled}
            onPress={() => {
              void purchase.submit({
                requestId: randomUUID(),
                offerId: selected.id,
                offerVersion: selected.version,
              });
            }}
          />
          {!selected.enabled && <Text>This offer is unavailable.</Text>}
          <Action
            label="Cancel confirmation"
            disabled={locked}
            onPress={() => setSelected(null)}
          />
        </View>
      )}
      {error && <Text accessibilityLiveRegion="polite">{error}</Text>}
      <Action
        label={
          catalogue.state.kind === 'loading'
            ? 'Loading offers…'
            : 'Refresh offers'
        }
        disabled={catalogue.state.kind === 'loading' || locked}
        onPress={() => {
          setSelected(null);
          void catalogue.controller.refresh();
        }}
      />
      {catalogue.state.kind === 'error' && <Text>{catalogue.state.error}</Text>}
      {catalogue.state.kind === 'ready' && (
        <>
          {catalogue.state.items.length === 0 && (
            <Text>No offers available.</Text>
          )}
          {catalogue.state.items.map((o) => (
            <View key={o.id} style={styles.row}>
              <Text style={styles.title}>{o.product.title}</Text>
              <Text>{o.product.description}</Text>
              <Text>{o.product.pointsPrice.toLocaleString()} points</Text>
              <Action
                label={`Review ${o.product.title}`}
                disabled={locked || reading}
                onPress={() => {
                  void choose(o.id);
                }}
              />
            </View>
          ))}
          {catalogue.state.error && <Text>{catalogue.state.error}</Text>}
          {catalogue.state.nextCursor && (
            <Action
              label="Load more offers"
              disabled={locked || catalogue.state.busy}
              onPress={() => {
                void catalogue.controller.more();
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
  title: { fontFamily: 'Geist_600SemiBold', color: '#F5F5F3' },
  row: {
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
  },
  confirm: { gap: 12, padding: 16, backgroundColor: '#2B2B2B' },
});
