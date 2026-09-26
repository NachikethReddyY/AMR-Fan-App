import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { Action, Text } from '../points/controls';
import { api } from '../account/native-auth';
import { useResource } from '../account/useResource';
import { useContributions } from './useContributions';
import { contributionText } from './presentation';
import { createOfficialApi } from './api';
const read = createOfficialApi(api.request);
export function ImpactScreen() {
  const { state, controller } = useResource(read);
  const impact = useContributions();
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Impact
      </Text>
      <View style={styles.summary}>
        <Text accessibilityRole="header" style={styles.heading}>
          Your contribution
        </Text>
        <Text>{contributionText(impact.state, 'personal')}</Text>
      </View>
      <View style={styles.community}>
        <Text accessibilityRole="header" style={styles.heading}>
          Community impact
        </Text>
        <Text>{contributionText(impact.state, 'community')}</Text>
      </View>
      <Text style={styles.caption}>
        Lifetime estimates compare recorded journeys with one person driving a
        conventional car between the same endpoints. Points and official team
        figures are separate. These are estimates, not measured savings or
        carbon offsets.
      </Text>
      <Action
        secondary
        label={
          impact.state?.kind === 'loading'
            ? 'Loading impact…'
            : 'Refresh impact'
        }
        disabled={impact.state?.kind === 'loading'}
        onPress={() => {
          void impact.controller.refresh();
        }}
      />
      {impact.state?.kind === 'ready' && (
        <>
          {impact.state.items[0]?.validation.includes(
            'unvalidated_estimate',
          ) && (
            <Text style={styles.caption}>
              Includes estimates using unvalidated journey calibration.
            </Text>
          )}
          {impact.state.items[0]?.validation.includes('reviewed_release') && (
            <Text style={styles.caption}>
              Uses retained reviewed journey rules and emissions factors.
            </Text>
          )}
          {(['personal', 'community'] as const).map((scope) => {
            const total =
              impact.state?.kind === 'ready'
                ? impact.state.items[0]?.[scope]
                : null;
            return total?.kind === 'available' ? (
              <Text key={scope} style={styles.caption}>
                {scope === 'personal'
                  ? 'Your contribution'
                  : 'Community impact'}
                : {total.journeyCount} qualifying journeys.
                {total.excludedJourneys > 0
                  ? ` ${total.excludedJourneys} journeys await sufficient evidence or approved calculation data.`
                  : ''}
              </Text>
            ) : null;
          })}
          {impact.state.items[0]?.sources.map((source) => (
            <View key={JSON.stringify(source)} style={styles.row}>
              <Text selectable>Emissions source: {source.source}</Text>
              <Text>
                Factor {source.id} · {source.period}
              </Text>
              <Text>{source.method}</Text>
              <Text>{source.assumptions}</Text>
            </View>
          ))}
        </>
      )}
      <Text accessibilityRole="header" style={styles.heading}>
        Official team figures
      </Text>
      <Action
        secondary
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${row.fields.name.text}, ${row.fields.value.text} ${row.fields.unit.text}, ${row.fields.period.text}${row.sourceKind === 'synthetic' ? ', sample report' : ''}, source details`}
                accessibilityState={{ expanded: expanded === row.id }}
                onPress={() => setExpanded(expanded === row.id ? null : row.id)}
                style={({ pressed }) => [
                  styles.figureSummary,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={styles.figureText}>
                  <Text style={styles.heading}>
                    {row.fields.value.text} {row.fields.unit.text}
                  </Text>
                  <Text>{row.fields.name.text}</Text>
                  <Text style={styles.caption}>{row.fields.period.text}</Text>
                  {row.sourceKind === 'synthetic' && (
                    <Text style={styles.caption}>Sample report</Text>
                  )}
                  <Text style={styles.detailsLabel}>
                    {expanded === row.id
                      ? 'Hide source details'
                      : 'View source details'}
                  </Text>
                </View>
                {expanded === row.id ? (
                  <ChevronDown size={20} color="#F5F5F3" accessible={false} />
                ) : (
                  <ChevronRight size={20} color="#F5F5F3" accessible={false} />
                )}
              </Pressable>
              {expanded === row.id && (
                <>
                  <Text selectable>
                    {row.fields.value.text} {row.fields.unit.text}
                  </Text>
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
                  <Text>
                    Approved {new Date(row.approvedAt).toLocaleString()}
                  </Text>
                  <Text selectable>Reviewer: {row.reviewerId}</Text>
                </>
              )}
            </View>
          ))}
          {state.items.length > 0 && (
            <Text style={styles.caption}>
              Up to 100 approved figures, reported by the source.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { marginHorizontal: 20, gap: 16 },
  summary: {
    padding: 20,
    gap: 12,
    backgroundColor: '#004A4D',
    borderRadius: 12,
  },
  community: { gap: 12, paddingVertical: 12 },
  caption: { color: '#A9A9A3', fontSize: 14, lineHeight: 20 },
  figureSummary: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  figureText: { flex: 1, gap: 6 },
  detailsLabel: { color: '#CEDC00', fontSize: 14, lineHeight: 20 },
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
