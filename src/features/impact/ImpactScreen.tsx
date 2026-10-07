import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { Action, Text } from '../points/controls';
import { api } from '../account/native-auth';
import { useProfileContext, useResource } from '../account/useResource';
import { createOverviewApi } from './api';
import type { ImpactOverview } from './contracts';

const read = createOverviewApi(api.request);

function travelText(total: ImpactOverview['fan']['personal']['travel']) {
  if (total.kind === 'empty') return 'No qualifying journeys yet.';
  if (total.kind === 'unavailable') {
    return total.reasons.includes('source_unavailable')
      ? 'Travel estimate unavailable. Retry to refresh the reviewed methodology.'
      : 'Travel estimate unavailable until the journey evidence is ready.';
  }
  return `Estimated travel savings: ${total.savingsKg} kgCO2 · Lifetime`;
}

function participationText(
  participation:
    | ImpactOverview['fan']['personal']['participation']
    | ImpactOverview['fan']['community']['participation'],
) {
  if (participation.kind === 'unavailable') {
    return participation.reason === 'demo_profile'
      ? 'Participation is unavailable for demo profiles.'
      : 'Participation data unavailable. Retry to refresh.';
  }
  return `${participation.activityCount} credited photo activities · ${participation.missionsCompleted} missions completed`;
}

export function ImpactScreen() {
  const { state: resourceState, controller } = useResource(read);
  const profile = useProfileContext();
  const state = !profile
    ? null
    : resourceState.kind === 'ready' &&
        resourceState.items[0]?.id !== profile.profileId
      ? ({ kind: 'loading' } as const)
      : resourceState;
  const [expanded, setExpanded] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      void controller.refresh();
    }, [controller]),
  );
  const overview = state?.kind === 'ready' ? state.items[0] : null;
  const official = overview?.official;
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Impact
      </Text>
      {!profile && <Text>Sign in to view impact.</Text>}
      {state?.kind === 'loading' && (
        <Text accessibilityLiveRegion="polite">Loading impact...</Text>
      )}
      {state?.kind === 'error' && (
        <Text accessibilityLiveRegion="polite">
          Impact unavailable. Open Impact to retry.
        </Text>
      )}
      {overview && (
        <>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.heading}>
              Aston Martin reported impact
            </Text>
            {official?.status === 'unavailable' && (
              <Text accessibilityLiveRegion="polite">
                Reported figures unavailable (source_unavailable). Retry to
                refresh.
              </Text>
            )}
            {official?.status === 'empty' && (
              <Text>No approved Aston Martin figures have been published.</Text>
            )}
            {official?.status === 'available' &&
              official.metrics.map((row) => (
                <View key={row.id} style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${row.fields.name.text}, ${row.fields.value.text} ${row.fields.unit.text}, ${row.fields.period.text}, source details`}
                    accessibilityState={{ expanded: expanded === row.id }}
                    onPress={() =>
                      setExpanded(expanded === row.id ? null : row.id)
                    }
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
                      <Text style={styles.caption}>
                        {row.fields.period.text}
                      </Text>
                      <Text style={styles.detailsLabel}>
                        {expanded === row.id
                          ? 'Hide source details'
                          : 'View source details'}
                      </Text>
                    </View>
                    {expanded === row.id ? (
                      <ChevronDown
                        size={20}
                        color="#F5F5F3"
                        accessible={false}
                      />
                    ) : (
                      <ChevronRight
                        size={20}
                        color="#F5F5F3"
                        accessible={false}
                      />
                    )}
                  </Pressable>
                  {expanded === row.id && (
                    <View style={styles.details}>
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
                        Source: {row.title}, page {row.evidence.page}; source
                        kind: {row.sourceKind}
                      </Text>
                      <Text selectable>Document: {row.documentId}</Text>
                      <Text selectable>
                        Approval status: approved - {row.approvalId}
                      </Text>
                      <Text selectable>{row.evidence.quote}</Text>
                      <Text>
                        Approved {new Date(row.approvedAt).toLocaleString()}
                      </Text>
                      <Text selectable>Reviewer: {row.reviewerId}</Text>
                    </View>
                  )}
                </View>
              ))}
          </View>

          <View style={styles.summary}>
            <Text accessibilityRole="header" style={styles.heading}>
              Your contribution
            </Text>
            <Text>
              {participationText(overview.fan.personal.participation)}
            </Text>
            {overview.fan.personal.participation.kind === 'available' && (
              <Text style={styles.caption}>
                Photo activity points earned:{' '}
                {overview.fan.personal.participation.pointsEarned}
              </Text>
            )}
            <Text>{travelText(overview.fan.personal.travel)}</Text>
          </View>

          <View style={styles.community}>
            <Text accessibilityRole="header" style={styles.heading}>
              AMR fan community
            </Text>
            <Text>
              {participationText(overview.fan.community.participation)}
            </Text>
            <Text>{travelText(overview.fan.community.travel)}</Text>
          </View>

          <Text style={styles.caption}>
            Participation counts and points are separate from estimated travel
            savings and Aston Martin reported figures. Travel estimates use the
            reviewed journey factor receipt method; they are not measured
            savings or carbon offsets.
          </Text>
          <Text accessibilityRole="header" style={styles.heading}>
            Travel methodology
          </Text>
          {overview.travelMethodology.kind === 'unavailable' ? (
            <Text>Travel methodology unavailable. Retry to refresh.</Text>
          ) : (
            <>
              <Text style={styles.caption}>
                {overview.travelMethodology.period} ·{' '}
                {overview.travelMethodology.unit}
              </Text>
              {overview.travelMethodology.sources.map((source) => (
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
          {overview.methodology.map((entry) => (
            <View key={entry.label} style={styles.row}>
              <Text>{entry.label}</Text>
              {entry.unit && entry.period && (
                <Text style={styles.caption}>
                  {entry.unit} - {entry.period}
                </Text>
              )}
              {entry.method && <Text>{entry.method}</Text>}
              {entry.assumptions && (
                <Text style={styles.caption}>{entry.assumptions}</Text>
              )}
            </View>
          ))}
        </>
      )}
      {profile && (
        <Action
          secondary
          label={
            state?.kind === 'loading' ? 'Loading impact...' : 'Refresh impact'
          }
          disabled={state?.kind === 'loading'}
          onPress={() => {
            void controller.refresh();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { marginHorizontal: 20, gap: 16 },
  section: { gap: 12 },
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
  details: { gap: 8, paddingTop: 12 },
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
