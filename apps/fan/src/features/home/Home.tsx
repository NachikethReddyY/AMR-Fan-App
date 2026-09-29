import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Camera,
  Route,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import { useAccount } from '../account/provider';
import { useHistory } from '../points/provider';
import { Balance } from '../points/Balance';
import { Action, Text } from '../points/controls';
import { usePhotoActivity } from '../activity/usePhotoActivity';
import { PhotoActivitySession } from '../activity/PhotoActivitySession';
import { useContributions } from '../impact/useContributions';
import { contributionText } from '../impact/presentation';
import { getTestDataView } from '../test-data';
import { TestDataScreen } from './TestDataScreen';
import { TestDataNotice } from './TestDataNotice';

export function Home({
  onTravel,
  onRewards,
  onHistory,
  onImpact,
}: {
  onTravel: () => void;
  onRewards: () => void;
  onHistory: () => void;
  onImpact: () => void;
}) {
  const { controller: accountController, state: account } = useAccount();
  const [testDataOpen, setTestDataOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  async function selectData(selected: 'real' | 'demo') {
    setSwitching(true);
    setSwitchError('');
    try {
      await accountController.select(selected);
      setTestDataOpen(false);
    } catch {
      setSwitchError('Could not switch data. Try again.');
    } finally {
      setSwitching(false);
    }
  }
  const photo = usePhotoActivity(accountController);
  const impact = useContributions();
  const { controller } = useHistory();
  useFocusEffect(
    useCallback(() => {
      void controller.refresh();
    }, [controller]),
  );
  if (testDataOpen)
    return (
      <TestDataScreen
        data={getTestDataView()}
        busy={switching}
        error={switchError}
        onClose={() => setTestDataOpen(false)}
        onReturnToReal={() => {
          void selectData('real');
        }}
        onSavedData={
          account.kind === 'signedIn'
            ? () => {
                void selectData('demo');
              }
            : undefined
        }
      />
    );
  if (photo.owner) {
    return (
      <PhotoActivitySession
        owner={photo.owner}
        session={accountController}
        onClose={photo.close}
        check={photo.check}
      />
    );
  }
  return (
    <>
      <TestDataNotice />
      <View style={styles.balancePanel}>
        <Text style={styles.balanceLabel}>Available points</Text>
        <Balance prominent />
        <Text>Use earned points in Rewards.</Text>
        <View style={styles.balanceActions}>
          <Action
            quiet
            label="View rewards"
            icon={ChevronRight}
            onPress={onRewards}
          />
          <Action
            quiet
            label="History"
            icon={ChevronRight}
            onPress={onHistory}
          />
        </View>
      </View>
      <View style={styles.homeContent}>
        <View style={styles.entries}>
          <Entry
            label="Photo activity"
            detail="Take a photo for review."
            Icon={Camera}
            disabled={!photo.canOpen}
            onPress={photo.open}
          />
          <Entry
            label="Plan a journey"
            detail="Compare time and emissions."
            Icon={Route}
            onPress={onTravel}
          />
        </View>
        {photo.cleanupError ? <Text>{photo.cleanupError}</Text> : null}
        <View style={styles.impactGroup}>
          <View style={styles.impactItem}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Your impact
            </Text>
            <Text style={styles.muted}>
              {contributionText(impact.state, 'personal')}
            </Text>
          </View>
          <View style={styles.impactItem}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Community impact
            </Text>
            <Text style={styles.muted}>
              {contributionText(impact.state, 'community')}
            </Text>
          </View>
        </View>
        <Action
          quiet
          label="View impact"
          icon={ChevronRight}
          onPress={onImpact}
        />
        <Action
          quiet
          label="View test data"
          icon={ChevronRight}
          onPress={() => {
            setSwitchError('');
            setTestDataOpen(true);
          }}
        />
      </View>
    </>
  );
}

function Entry({
  label,
  detail,
  Icon,
  disabled = false,
  onPress,
}: {
  label: string;
  detail: string;
  Icon: LucideIcon;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.entry,
        (disabled || pressed) && { opacity: 0.6 },
      ]}
    >
      <Icon size={22} color="#CEDC00" accessible={false} />
      <View style={styles.entryCopy}>
        <Text style={styles.entryTitle}>{label}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <ChevronRight size={20} color="#ADBDB3" accessible={false} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  balanceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  entries: { borderTopWidth: 1, borderTopColor: '#344C40' },
  entry: {
    minHeight: 80,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#344C40',
  },
  entryCopy: { flex: 1, gap: 4 },
  entryTitle: { fontFamily: 'Geist_600SemiBold', fontSize: 19, lineHeight: 26 },
  balancePanel: {
    backgroundColor: '#004A4D',
    marginHorizontal: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#344C40',
    borderRadius: 12,
  },
  balanceLabel: { color: '#ADBDB3', fontSize: 17 },
  homeContent: { marginHorizontal: 20, paddingVertical: 20, gap: 20 },
  impactGroup: {
    flexDirection: 'column',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: '#3D3D3D',
    paddingTop: 20,
  },
  impactItem: { flex: 1, gap: 8 },
  sectionTitle: {
    color: '#F5F5F3',
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Geist_600SemiBold',
  },
  muted: { color: '#A9A9A3', fontSize: 17, lineHeight: 25 },
});
