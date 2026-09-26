import { StyleSheet, View } from 'react-native';
import { Action, Text } from '../points/controls';
import { api } from '../account/native-auth';
import { useResource } from '../account/useResource';
import { createOfficialApi } from './api';
const read = createOfficialApi(api.request);
export function ImpactScreen() {
  const { state, controller } = useResource(read);
  return (
    <View style={styles.content}>
      <Text style={styles.title}>Impact</Text>
      <Text>
        Personal and community travel impact are not available yet. Points and
        official team figures are separate records.
      </Text>
      <Text style={styles.heading}>Official team figures</Text>
      <Action
        label={
          state.kind === 'loading'
            ? 'Loading approved figures…'
            : 'Refresh approved figures'
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
          {state.items.length === 0 && (
            <Text>No approved figures have been published.</Text>
          )}
          {state.items.map((row) => (
            <View key={row.id} style={styles.row}>
              <Text style={styles.heading}>{row.fields.name.text}</Text>
              <Text selectable>
                {row.fields.value.text} {row.fields.unit.text}
              </Text>
              <Text>Period: {row.fields.period.text}</Text>
              <Text>{row.fields.meaning.text}</Text>
              {row.fields.category && (
                <Text>Category: {row.fields.category.text}</Text>
              )}
              <Text>
                Method:{' '}
                {row.fields.method?.text ??
                  'Not supplied in the approved source'}
              </Text>
              <Text>
                Source: {row.title}, page {row.evidence.page}
                {row.sourceKind === 'synthetic'
                  ? ' · Synthetic demonstration report'
                  : ''}
              </Text>
              <Text selectable>{row.evidence.quote}</Text>
              <Text>Approved {new Date(row.approvedAt).toLocaleString()}</Text>
              <Text selectable>Reviewer: {row.reviewerId}</Text>
            </View>
          ))}
          <Text>
            Showing up to 100 current approved figures. These are
            source-reported figures, not your travel savings.
          </Text>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { marginHorizontal: 20, gap: 16 },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'Geist_600SemiBold',
    color: '#F5F5F3',
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Geist_600SemiBold',
    color: '#F5F5F3',
  },
  row: {
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
  },
});
