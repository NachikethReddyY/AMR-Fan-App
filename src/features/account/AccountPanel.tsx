import { createContext, useContext, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  type TextProps,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from './provider';
import { api, localSignInEnabled, signInWithProvider } from './native-auth';
import { Balance } from '../points/Balance';
import { useHistory } from '../points/provider';

const BoldText = createContext(false);
function Text(props: TextProps) {
  const bold = useContext(BoldText);
  const { fontScale } = useWindowDimensions();
  return (
    <NativeText
      key={fontScale}
      {...props}
      style={[props.style, bold && { fontFamily: 'Geist_600SemiBold' }]}
    />
  );
}

function Action({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}
export function AccountPanel() {
  const { controller, state } = useAccount();
  const { controller: history } = useHistory();
  const [bold, setBold] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isBoldTextEnabled().then(setBold);
    const listener = AccessibilityInfo.addEventListener(
      'boldTextChanged',
      setBold,
    );
    return () => listener.remove();
  }, []);
  const [open, setOpen] = useState(false);
  const [editOwner, setEditOwner] = useState<{
    token: string;
    profileId: string;
  } | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const profile =
    state.kind === 'signedIn'
      ? state.account.profiles.find((p) => p.kind === state.selected)
      : undefined;
  const editing =
    state.kind === 'signedIn' &&
    editOwner?.token === state.token &&
    editOwner.profileId === profile?.id;
  useEffect(
    () =>
      controller.subscribe(() => {
        setEditOwner(null);
        setName('');
        setError('');
      }),
    [controller],
  );
  async function save() {
    setSaving(true);
    setError('');
    try {
      await controller.rename(name);
      setEditOwner(null);
    } catch {
      setError('Could not save your name. Try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <BoldText.Provider value={bold}>
      <View style={styles.entry}>
        <Action
          secondary
          label={
            profile
              ? `${profile.displayName} · ${profile.kind === 'demo' ? 'Demo profile' : 'Your account'}`
              : 'Sign in'
          }
          onPress={() => {
            setOpen(true);
            void history.refresh();
          }}
        />
      </View>
      <Modal
        visible={open}
        animationType="none"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.modal}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.section}
          >
            <Action secondary label="Close" onPress={() => setOpen(false)} />
            <Text style={styles.title}>Your account</Text>
            {state.kind === 'loading' && (
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                Connecting…
              </Text>
            )}
            {state.kind === 'unavailable' && (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.body}>
                  {state.message}
                </Text>
                <Action
                  label="Retry"
                  onPress={() => {
                    void controller.resume();
                  }}
                />
              </>
            )}
            {state.kind === 'signedOut' && (
              <>
                <Text style={styles.body}>
                  Sign in to keep your profile across devices.
                </Text>
                {state.error && (
                  <Text accessibilityLiveRegion="polite" style={styles.body}>
                    {state.error}
                  </Text>
                )}
                <Action
                  label="Sign in with email"
                  onPress={() => {
                    void controller.signIn(signInWithProvider);
                  }}
                />
                {localSignInEnabled && (
                  <>
                    <Text style={styles.caption}>
                      Local test accounts. No real email sign-in.
                    </Text>
                    <Action
                      secondary
                      label="Use test account A"
                      onPress={() => {
                        void controller.signIn(() =>
                          api.syntheticSignIn('fan-a'),
                        );
                      }}
                    />
                    <Action
                      secondary
                      label="Use test account B"
                      onPress={() => {
                        void controller.signIn(() =>
                          api.syntheticSignIn('fan-b'),
                        );
                      }}
                    />
                  </>
                )}
              </>
            )}
            {state.kind === 'signedIn' && profile && (
              <>
                {error && !editing ? (
                  <Text accessibilityLiveRegion="polite" style={styles.body}>
                    {error}
                  </Text>
                ) : null}
                <Text style={styles.name}>{profile.displayName}</Text>
                <Text style={styles.body}>
                  {profile.kind === 'demo'
                    ? 'Demo profile · simulated activity'
                    : 'Real profile'}
                </Text>
                <Balance />
                {state.account.role === 'admin' && (
                  <Text style={styles.caption}>Assigned admin</Text>
                )}
                {editing ? (
                  <>
                    <Text accessibilityRole="text" style={styles.body}>
                      Profile name
                    </Text>
                    <TextInput
                      accessibilityLabel="Profile name"
                      value={name}
                      onChangeText={setName}
                      maxLength={80}
                      editable={!saving}
                      style={styles.input}
                      autoComplete="name"
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        void save();
                      }}
                    />
                    {error ? (
                      <Text
                        accessibilityLiveRegion="polite"
                        style={styles.body}
                      >
                        {error}
                      </Text>
                    ) : null}
                    <Action
                      label={saving ? 'Saving…' : 'Save name'}
                      disabled={saving || !name.trim()}
                      onPress={() => {
                        void save();
                      }}
                    />
                    <Action
                      secondary
                      label="Cancel"
                      disabled={saving}
                      onPress={() => setEditOwner(null)}
                    />
                  </>
                ) : (
                  <>
                    <Action
                      secondary
                      label="Edit name"
                      onPress={() => {
                        setName(profile.displayName);
                        setEditOwner({
                          token: state.token,
                          profileId: profile.id,
                        });
                        setError('');
                      }}
                    />
                    <Action
                      secondary
                      label={
                        profile.kind === 'real'
                          ? 'Use demo profile'
                          : 'Use real profile'
                      }
                      onPress={() => {
                        void controller
                          .select(profile.kind === 'real' ? 'demo' : 'real')
                          .catch(() =>
                            setError('Could not switch profiles. Try again.'),
                          );
                      }}
                    />
                    <Action
                      secondary
                      label="Sign out"
                      onPress={() => {
                        setEditOwner(null);
                        void controller.logout();
                      }}
                    />
                  </>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </BoldText.Provider>
  );
}
const styles = StyleSheet.create({
  entry: { marginHorizontal: 20, marginBottom: 20 },
  modal: { flex: 1, backgroundColor: '#121212' },
  section: {
    marginHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
  },
  title: { color: '#F5F5F3', fontSize: 20, fontFamily: 'Geist_600SemiBold' },
  name: { color: '#F5F5F3', fontSize: 24, fontFamily: 'Geist_600SemiBold' },
  body: {
    color: '#E0E0DC',
    fontSize: 17,
    lineHeight: 25,
    fontFamily: 'Geist_400Regular',
  },
  caption: {
    color: '#A9A9A3',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Geist_400Regular',
  },
  balance: { color: '#F5F5F3', fontSize: 32, fontFamily: 'Geist_600SemiBold' },
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#04524B',
    borderRadius: 2,
  },
  secondary: {
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: '#3D3D3D',
  },
  buttonText: {
    color: '#F5F5F3',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Geist_600SemiBold',
  },
  input: {
    color: '#F5F5F3',
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A9A9A3',
    fontSize: 17,
    fontFamily: 'Geist_400Regular',
  },
});
