import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { createMissionsApi, type Mission } from '../missions/api';

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
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionsMessage, setMissionsMessage] = useState('');
  const missionsApi = useMemo(
    () => createMissionsApi(process.env.EXPO_PUBLIC_API_URL ?? '', __DEV__),
    [],
  );
  const realProfile =
    account.kind === 'signedIn' && account.selected === 'real'
      ? account.account.profiles.find((profile) => profile.kind === 'real')
      : undefined;
  const missionToken =
    account.kind === 'signedIn' && account.selected === 'real'
      ? account.token
      : null;
  const demoMissions =
    account.kind === 'signedIn' && account.selected === 'demo';
  const missionProfileId = realProfile?.id ?? null;
  const missionIdentity =
    account.kind === 'signedIn' && missionToken && missionProfileId
      ? `${missionToken}:${missionProfileId}:${account.selected}`
      : null;
  const [missionSelection, setMissionSelection] = useState<{
    identity: string;
    id: string;
  } | null>(null);
  const selectedMissionId =
    missionSelection?.identity === missionIdentity ? missionSelection.id : null;
  const selectMission = useCallback(
    (id: string | null) => {
      if (id === null) setMissionSelection(null);
      else if (missionIdentity)
        setMissionSelection({ identity: missionIdentity, id });
    },
    [missionIdentity],
  );
  const refreshMissions = useCallback(
    async (signal: AbortSignal) => {
      if (!missionToken || !missionProfileId) {
        setMissions([]);
        setMissionsMessage(
          demoMissions ? 'Missions unavailable for demo data.' : '',
        );
        return;
      }
      const isCurrent = () => {
        const current = accountController.getState();
        return (
          current.kind === 'signedIn' &&
          current.selected === 'real' &&
          current.token === missionToken &&
          current.account.profiles.some(
            (profile) =>
              profile.kind === 'real' && profile.id === missionProfileId,
          )
        );
      };
      try {
        const result = await missionsApi.list(
          missionToken,
          missionProfileId,
          signal,
        );
        if (signal.aborted || !isCurrent()) return;
        if (result.kind === 'available') {
          setMissions(result.missions);
          setMissionsMessage('');
        } else {
          setMissions([]);
          setMissionsMessage(
            result.reason === 'demo_profile'
              ? 'Missions unavailable for demo data.'
              : 'Missions unavailable. Retry.',
          );
        }
      } catch {
        if (!signal.aborted && isCurrent()) {
          setMissions([]);
          setMissionsMessage('Missions unavailable. Retry.');
        }
      }
    },
    [
      accountController,
      demoMissions,
      missionProfileId,
      missionToken,
      missionsApi,
    ],
  );
  const isMissionContextCurrent = useCallback(
    (token: string, profileId: string) => {
      const current = accountController.getState();
      return (
        current.kind === 'signedIn' &&
        current.selected === 'real' &&
        current.token === token &&
        current.account.profiles.some(
          (profile) => profile.kind === 'real' && profile.id === profileId,
        )
      );
    },
    [accountController],
  );
  const displayedMissions = demoMissions ? [] : missions;
  const displayedMissionsMessage = demoMissions
    ? 'Missions unavailable for demo data.'
    : account.kind === 'signedOut'
      ? 'Sign in to view missions.'
      : missionsMessage;
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void refreshMissions(controller.signal);
      return () => controller.abort();
    }, [refreshMissions]),
  );
  async function selectData(selected: 'real' | 'demo') {
    setSwitching(true);
    setSwitchError('');
    try {
      await accountController.select(selected);
      setMissionSelection(null);
      setTestDataOpen(false);
    } catch {
      setSwitchError('Could not switch data. Try again.');
    } finally {
      setSwitching(false);
    }
  }
  const photo = usePhotoActivity(accountController);
  const photoClose = photo.close;
  const impact = useContributions();
  const { controller } = useHistory();
  const closePhoto = useCallback(() => {
    setMissionSelection(null);
    photoClose();
  }, [photoClose]);
  const settleActivity = useCallback(() => {
    setMissionSelection(null);
    void controller.refresh();
    void refreshMissions(new AbortController().signal);
  }, [controller, refreshMissions]);
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
        onClose={closePhoto}
        capability={photo.capability}
        submit={photo.submit}
        recover={photo.recover}
        onSettled={settleActivity}
        missionId={selectedMissionId}
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
        <MissionsSection
          missions={displayedMissions}
          message={displayedMissionsMessage}
          token={missionToken}
          profileId={missionProfileId}
          api={missionsApi}
          isContextCurrent={isMissionContextCurrent}
          onUse={selectMission}
          onRefresh={() => void refreshMissions(new AbortController().signal)}
        />
        {selectedMissionId ? (
          <View style={styles.selectedMission}>
            <Text accessibilityLiveRegion="polite">
              Selected mission:{' '}
              {missions.find((mission) => mission.id === selectedMissionId)
                ?.title ?? 'ready for this activity'}
            </Text>
            <Action
              label="Clear selected mission"
              secondary
              onPress={() => selectMission(null)}
            />
          </View>
        ) : null}
        {photo.cleanupError ? (
          <>
            <Text accessibilityLiveRegion="polite">{photo.cleanupError}</Text>
            <Action label="Retry photo cleanup" onPress={photo.retryCleanup} />
          </>
        ) : null}
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

function MissionsSection({
  missions,
  message,
  token,
  profileId,
  api,
  isContextCurrent,
  onRefresh,
  onUse,
}: {
  missions: Mission[];
  message: string;
  token: string | null;
  profileId: string | null;
  api: ReturnType<typeof createMissionsApi>;
  isContextCurrent: (token: string, profileId: string) => boolean;
  onRefresh: () => void;
  onUse: (id: string) => void;
}) {
  const [busy, setBusy] = useState<{
    missionId: string;
    token: string;
    profileId: string;
  } | null>(null);
  const [enrollmentError, setEnrollmentError] = useState<{
    message: string;
    token: string;
    profileId: string;
  } | null>(null);
  const enrollmentRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    enrollmentRequest.current?.abort();
    enrollmentRequest.current = null;
    return () => enrollmentRequest.current?.abort();
  }, [profileId, token]);
  const busyMissionId =
    busy?.token === token && busy.profileId === profileId
      ? busy.missionId
      : null;
  const visibleEnrollmentError =
    enrollmentError?.token === token && enrollmentError.profileId === profileId
      ? enrollmentError.message
      : '';
  return (
    <View style={styles.missions}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Missions
      </Text>
      {visibleEnrollmentError ? (
        <Text accessibilityLiveRegion="polite">{visibleEnrollmentError}</Text>
      ) : null}
      {message ? (
        <Text accessibilityLiveRegion="polite">{message}</Text>
      ) : missions.length === 0 ? (
        <Text style={styles.muted}>No missions available right now.</Text>
      ) : (
        missions.slice(0, 3).map((mission) => (
          <View key={mission.id} style={styles.missionRow}>
            <Text style={styles.entryTitle}>{mission.title}</Text>
            <Text style={styles.muted}>
              {mission.kind === 'race_week' ? 'Race week' : 'Personal'} ·{' '}
              {mission.progress.kind === 'completed'
                ? 'Completed'
                : `${mission.progress.count} of ${mission.target}`}
            </Text>
            <Text style={styles.muted}>{mission.attribution.sourceLabel}</Text>
            {mission.availability === 'active' &&
            mission.progress.kind === 'not_enrolled' &&
            token &&
            profileId ? (
              <Action
                label={busyMissionId === mission.id ? 'Enrolling…' : 'Enroll'}
                disabled={busyMissionId === mission.id}
                onPress={() => {
                  if (!token || !profileId) return;
                  const submittedFor = { token, profileId };
                  const controller = new AbortController();
                  enrollmentRequest.current?.abort();
                  enrollmentRequest.current = controller;
                  setBusy({ missionId: mission.id, token, profileId });
                  setEnrollmentError(null);
                  const stillCurrent = () =>
                    !controller.signal.aborted &&
                    isContextCurrent(
                      submittedFor.token,
                      submittedFor.profileId,
                    );
                  void api
                    .enroll(token, mission.id, profileId, controller.signal)
                    .then(() => {
                      if (stillCurrent()) onRefresh();
                    })
                    .catch(() => {
                      if (stillCurrent())
                        setEnrollmentError({
                          message: 'Could not enroll. Try again.',
                          token: submittedFor.token,
                          profileId: submittedFor.profileId,
                        });
                    })
                    .finally(() => {
                      if (stillCurrent()) {
                        enrollmentRequest.current = null;
                        setBusy(null);
                      }
                    });
                }}
              />
            ) : mission.availability === 'active' &&
              mission.progress.kind !== 'completed' ? (
              <Action
                label="Use this mission"
                secondary
                onPress={() => onUse(mission.id)}
              />
            ) : (
              <Text style={styles.muted}>
                {mission.availability === 'upcoming'
                  ? `Starts ${new Date(mission.startsAt).toLocaleString()} (${mission.timezone})`
                  : mission.availability === 'expired'
                    ? 'Expired'
                    : mission.progress.kind === 'completed'
                      ? 'Completed'
                      : 'Unavailable'}
              </Text>
            )}
          </View>
        ))
      )}
    </View>
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
  missions: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#344C40',
    paddingTop: 20,
  },
  selectedMission: { gap: 8 },
  missionRow: {
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#344C40',
    paddingBottom: 16,
  },
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
