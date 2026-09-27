import { StyleSheet, View } from 'react-native';
import { Action, Text } from '../points/controls';
import type { TestDataView } from '../test-data';

export function TestDataScreen({
  data,
  onClose,
  onReturnToReal,
  onSavedData,
  busy,
  error,
}: {
  data: TestDataView;
  onClose: () => void;
  onReturnToReal: () => void;
  onSavedData?: () => void;
  busy: boolean;
  error: string;
}) {
  return (
    <View style={styles.screen}>
      <Action quiet label="Back to Home" onPress={onClose} disabled={busy} />
      <Text accessibilityRole="header" style={styles.title}>
        {data.label}
      </Text>
      <Text>{data.notice}</Text>
      <Action
        secondary
        label="Return to real data"
        onPress={onReturnToReal}
        disabled={busy}
      />
      {!!error && <Text accessibilityLiveRegion="polite">{error}</Text>}
      {onSavedData && (
        <View style={styles.row}>
          <Text accessibilityRole="header" style={styles.heading}>
            Saved test data
          </Text>
          <Text style={styles.muted}>
            Open your existing test profile and History.
          </Text>
          <Action
            secondary
            label="Use saved test data"
            onPress={onSavedData}
            disabled={busy}
          />
        </View>
      )}
      <View style={styles.summary}>
        <Text style={styles.title}>{data.summary.pointsLabel}</Text>
        <Text>{data.summary.impactLabel}</Text>
      </View>
      <Text accessibilityRole="header" style={styles.heading}>
        Example activity
      </Text>
      {data.activity.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text>{row.label}</Text>
          <Text>{row.pointsLabel}</Text>
          <Text style={styles.muted}>{row.balanceLabel}</Text>
          <Text style={styles.muted}>{row.detail}</Text>
        </View>
      ))}
      <Text accessibilityRole="header" style={styles.heading}>
        Example rewards
      </Text>
      {data.rewards.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text>{row.label}</Text>
          <Text>{row.priceLabel}</Text>
          <Text style={styles.muted}>{row.detail}</Text>
        </View>
      ))}
      <Text accessibilityRole="header" style={styles.heading}>
        Example travel
      </Text>
      <Text style={styles.muted}>{data.travelNotice}</Text>
      {data.travel.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text>{row.label}</Text>
          <Text>
            {row.durationLabel} · {row.distanceLabel}
          </Text>
          <Text>{row.emissionsLabel}</Text>
          <Text style={styles.muted}>{row.detail}</Text>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { marginHorizontal: 20, gap: 16, paddingBottom: 24 },
  title: { fontFamily: 'Geist_600SemiBold', fontSize: 24, lineHeight: 32 },
  heading: { fontFamily: 'Geist_600SemiBold', fontSize: 20, lineHeight: 28 },
  summary: {
    backgroundColor: '#004A4D',
    borderRadius: 12,
    padding: 20,
    gap: 8,
  },
  row: { borderTopWidth: 1, borderTopColor: '#344C40', paddingTop: 16, gap: 8 },
  muted: { color: '#A9A9A3' },
});
