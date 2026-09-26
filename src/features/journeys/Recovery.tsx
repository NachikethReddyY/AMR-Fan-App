import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Action, Text } from '../points/controls';
import { AccountError } from '../account/api';
import { useSessionController } from '../account/provider';
import type { Context } from '../account/resource';
import type { JourneyList } from './contracts';
import { journeyApi, recorder } from './runtime';

export function Recovery({ context }: { context: Context }) {
  const session = useSessionController();
  const [items, setItems] = useState<JourneyList['items']>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [revision, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    void journeyApi
      .list(context)
      .then((list) => {
        if (current) {
          setItems(list.items.filter((j) => j.state === 'active'));
          setMessage(null);
        }
      })
      .catch(async (e: unknown) => {
        if (!current) return;
        if (e instanceof AccountError && e.status === 401)
          await session.expire(context.token);
        else setMessage('Could not check for an active journey.');
      });
    return () => {
      current = false;
    };
  }, [context.token, context.profileId, session, revision]); // eslint-disable-line react-hooks/exhaustive-deps
  async function resume(id: string) {
    setBusy(true);
    try {
      const journey = await journeyApi.read(context, id);
      const state = session.getState();
      if (
        state.kind !== 'signedIn' ||
        state.token !== context.token ||
        state.account.profiles.find((p) => p.kind === state.selected)?.id !==
          context.profileId
      )
        return;
      await recorder.resume(context, journey);
    } catch (e) {
      if (e instanceof AccountError && e.status === 401)
        await session.expire(context.token);
      else setMessage('Could not resume this journey. Retry when connected.');
    } finally {
      setBusy(false);
    }
  }
  if (!items.length && !message) return null;
  return (
    <View style={{ gap: 12, marginBottom: 20 }}>
      {items.map((item) => (
        <Action
          key={item.id}
          secondary
          disabled={busy}
          label={`Resume ${item.mode.replaceAll('_', ' ')} journey${item.startedAtMs ? ` · ${new Date(item.startedAtMs).toLocaleString()}` : ''}`}
          onPress={() => {
            void resume(item.id);
          }}
        />
      ))}
      {message && (
        <>
          <Text>{message}</Text>
          <Action
            label="Check active journeys"
            secondary
            onPress={() => refresh((v) => v + 1)}
          />
        </>
      )}
    </View>
  );
}
