import { Text } from '../points/controls';
import type { SharedSubmission } from './participation-contracts';

export function ParticipationStatus({ item }: { item: SharedSubmission }) {
  return (
    <>
      <Text>{item.rankingPoints} ranking points</Text>
      {item.status === 'backlog' && (
        <Text>Backlog · Open for contributions</Text>
      )}
      {item.status === 'selected' && (
        <Text>
          Selected · Contributions closed. Fulfilment is not guaranteed.
        </Text>
      )}
      {item.status === 'fulfilled' && (
        <Text>Fulfilled (demonstration) · Contributions closed.</Text>
      )}
    </>
  );
}
