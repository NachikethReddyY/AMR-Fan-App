import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { Route, Gift, Leaf } from 'lucide-react-native';
import { useAccount } from '../account/provider';
import { AccountPanel } from '../account/AccountPanel';
import { privateStorage } from '../account/storage';
import { Action, Text } from '../points/controls';
import { onboardingStage, progressFraction } from './progress';

const introKey = 'amr.onboarding.introduction.v1';
const pages = [
  {
    title: 'Make your journey count',
    body: 'Compare travel time and estimated emissions. Choose a route, then complete the journey checks to earn points.',
    Icon: Route,
  },
  {
    title: 'Choose your reward',
    body: 'Browse offers before signing in. Use earned points for rewards and fan questions. History keeps track of every point change.',
    Icon: Gift,
  },
  {
    title: 'See your contribution',
    body: 'Home shows your balance. Travel plans your route. Rewards uses your points. Impact keeps your contribution separate from sourced team figures.',
    Icon: Leaf,
  },
];

export function Onboarding({ children }: { children: React.ReactNode }) {
  const { controller, state } = useAccount();
  const reducedMotion = useReducedMotion();
  const [introduced, setIntroduced] = useState<boolean | null>(null);
  const [page, setPage] = useState(0);
  const [entered, setEntered] = useState(false);
  const [finishing, setFinishing] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [namedAccount, setNamedAccount] = useState<string | null>(null);
  const [checkedAccount, setCheckedAccount] = useState<string | null>(null);
  const [name, setName] = useState('');
  const draftOwner = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const accountId = state.kind === 'signedIn' ? state.account.id : null;
  useEffect(() => {
    let active = true;
    privateStorage
      .read(introKey)
      .then((value) => {
        if (active) setIntroduced(value === 'done');
      })
      .catch(() => {
        if (active) {
          setIntroduced(false);
          setError('Setup could not be restored. You can try again.');
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    privateStorage
      .read(`amr.onboarding.account.${accountId}`)
      .then((value) => {
        if (!active) return;
        if (draftOwner.current !== accountId) {
          setName('');
          setError('');
          draftOwner.current = accountId;
        }
        setNamedAccount(value === 'done' ? accountId : null);
        if (value === 'done') setEntered(true);
        setCheckedAccount(accountId);
      })
      .catch(() => {
        if (active) setCheckedAccount(accountId);
      });
    return () => {
      active = false;
    };
  }, [accountId]);
  useEffect(() => {
    if (!finishing) return;
    const timer = setTimeout(
      () => {
        setNamedAccount(finishing);
        setEntered(true);
        setFinishing(null);
      },
      reducedMotion ? 0 : 220,
    );
    return () => clearTimeout(timer);
  }, [finishing, reducedMotion]);
  const stage = onboardingStage(
    introduced === true,
    !!accountId && !modalOpen,
    namedAccount === accountId && !!accountId,
  );
  if (
    introduced &&
    entered &&
    !finishing &&
    (!accountId || namedAccount === accountId)
  )
    return <>{children}</>;
  if (
    introduced === null ||
    (accountId && checkedAccount !== accountId && !modalOpen)
  ) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.loading}>Opening your app…</Text>
      </SafeAreaView>
    );
  }
  const completed = finishing
    ? 5
    : stage === 'intro'
      ? page
      : stage === 'account'
        ? 3
        : 4;
  const current = pages[page];
  async function next() {
    if (page < pages.length - 1) {
      setPage(page + 1);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await privateStorage.write(introKey, 'done');
      setIntroduced(true);
    } catch {
      setError('Could not save setup. Try again.');
    } finally {
      setSaving(false);
    }
  }
  async function saveName() {
    if (state.kind !== 'signedIn') return;
    const owner = state.account.id;
    const token = state.token;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter your name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await controller.rename(trimmed);
      const latest = controller.getState();
      if (latest.kind !== 'signedIn' || latest.token !== token) return;
      await privateStorage.write(`amr.onboarding.account.${owner}`, 'done');
      const savedState = controller.getState();
      if (savedState.kind !== 'signedIn' || savedState.token !== token) return;
      setFinishing(owner);
    } catch {
      setError('Could not save your name. Try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Setup progress"
        accessibilityValue={{ min: 0, max: 5, now: completed }}
        style={styles.track}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: `${progressFraction(completed) * 100}%`,
              transitionProperty: 'width',
              transitionDuration: reducedMotion ? 0 : 200,
              transitionTimingFunction: 'ease-out',
            },
          ]}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
      >
        <Text style={styles.step}>
          {finishing ? 'Setup complete' : `Step ${completed + 1} of 5`}
        </Text>
        {stage === 'intro' ? (
          <>
            <View style={styles.illustration}>
              <current.Icon size={64} color="#F5F5F3" accessible={false} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {current.title}
            </Text>
            <Text>{current.body}</Text>
            <View style={styles.actions}>
              <Action
                label={page === 2 ? 'Continue' : 'Next'}
                onPress={() => {
                  void next();
                }}
                disabled={saving}
              />
              {page > 0 && (
                <Action
                  secondary
                  label="Back"
                  onPress={() => setPage(page - 1)}
                  disabled={saving}
                />
              )}
            </View>
          </>
        ) : stage === 'account' ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              Keep your points with you
            </Text>
            <Text>
              Sign in or create an account to save your journeys and rewards.
            </Text>
            <AccountPanel onOpenChange={setModalOpen} />
            <Action
              secondary
              label="Browse first"
              onPress={() => setEntered(true)}
            />
          </>
        ) : (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              What should we call you?
            </Text>
            <Text>You can change your name in Account.</Text>
            <TextInput
              accessibilityLabel="Name"
              autoComplete="given-name"
              textContentType="givenName"
              value={name}
              onChangeText={setName}
              maxLength={80}
              style={styles.input}
              editable={!saving && !finishing}
              returnKeyType="done"
              onSubmitEditing={() => {
                void saveName();
              }}
            />
            <Action
              label={
                finishing
                  ? 'Opening app…'
                  : saving
                    ? 'Saving…'
                    : 'Save and continue'
              }
              disabled={saving || !!finishing}
              onPress={() => {
                void saveName();
              }}
            />
          </>
        )}
        {!!error && <Text accessibilityLiveRegion="polite">{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#081310' },
  content: { flexGrow: 1, padding: 24, gap: 24 },
  loading: { padding: 24 },
  track: {
    height: 4,
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: '#344C40',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#CEDC00',
    borderRadius: 2,
  },
  step: { color: '#ADBDB3', fontSize: 14 },
  title: { fontSize: 30, lineHeight: 36, fontFamily: 'Geist_600SemiBold' },
  illustration: {
    backgroundColor: '#004A4D',
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    borderRadius: 24,
  },
  actions: { gap: 12, marginTop: 'auto', paddingTop: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#ADBDB3',
    borderRadius: 16,
    color: '#F5F5F3',
    fontSize: 17,
    padding: 16,
    minHeight: 52,
  },
});
