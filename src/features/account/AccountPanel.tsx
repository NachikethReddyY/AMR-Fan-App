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
import {
  UserRound,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
} from 'lucide-react-native';
import { useAccount } from './provider';
import {
  api,
  localSignInEnabled,
  authenticateEmail,
  syntheticEmailAuth,
} from './native-auth';
import { validateCredentials } from './supabase';
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
        disabled && { backgroundColor: '#3A3A3A' },
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}
export function AccountPanel({ compact = false }: { compact?: boolean }) {
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
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
  function close() {
    setPassword('');
    setAuthError('');
    setOpen(false);
  }
  async function submitEmail() {
    try {
      validateCredentials(email, password);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Check your details.',
      );
      return;
    }
    setAuthError('');
    const submitted = password;
    setPassword('');
    await controller.signIn(() =>
      authenticateEmail(authMode, email, submitted),
    );
  }
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
      <View style={compact ? styles.compactEntry : styles.entry}>
        {compact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              profile ? `${profile.displayName}, account` : 'Sign in'
            }
            onPress={() => {
              setOpen(true);
              void history.refresh();
            }}
            style={({ pressed }) => [
              styles.accountButton,
              pressed && { opacity: 0.75 },
            ]}
          >
            <UserRound size={22} color="#F5F5F3" accessible={false} />
          </Pressable>
        ) : (
          <Action
            secondary
            label={profile ? `${profile.displayName}, account` : 'Sign in'}
            onPress={() => {
              setOpen(true);
              void history.refresh();
            }}
          />
        )}
      </View>
      <Modal
        visible={open}
        animationType="none"
        presentationStyle="pageSheet"
        onRequestClose={close}
        onDismiss={close}
      >
        <SafeAreaView style={styles.modal}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.section}
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.headingRow}>
              <Text accessibilityRole="header" style={styles.title}>
                Your account
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close account"
                onPress={close}
                style={({ pressed }) => [
                  styles.accountButton,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <X size={22} color="#F5F5F3" accessible={false} />
              </Pressable>
            </View>
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
                {syntheticEmailAuth && (
                  <Text style={styles.caption}>
                    Synthetic email/password fixture. No email is sent.
                  </Text>
                )}
                <Text style={styles.body}>Email</Text>
                <TextInput
                  accessibilityLabel="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  maxLength={254}
                  style={styles.input}
                />
                <Text style={styles.body}>Password</Text>
                <TextInput
                  accessibilityLabel="Password"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  autoComplete={
                    authMode === 'signUp' ? 'new-password' : 'current-password'
                  }
                  textContentType={
                    authMode === 'signUp' ? 'newPassword' : 'password'
                  }
                  maxLength={1024}
                  style={styles.input}
                  returnKeyType="go"
                  onSubmitEditing={() => {
                    void submitEmail();
                  }}
                />
                {authError ? (
                  <Text accessibilityLiveRegion="polite" style={styles.body}>
                    {authError}
                  </Text>
                ) : null}
                <Action
                  label={
                    authMode === 'signUp'
                      ? 'Create account'
                      : 'Sign in with email'
                  }
                  onPress={() => {
                    void submitEmail();
                  }}
                />
                <Action
                  secondary
                  label={
                    authMode === 'signUp'
                      ? 'Already have an account? Sign in'
                      : 'Create an account'
                  }
                  onPress={() => {
                    setAuthMode(authMode === 'signUp' ? 'signIn' : 'signUp');
                    setPassword('');
                    setAuthError('');
                    controller.dismissSignInMessage();
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
                <View style={styles.headingRow}>
                  <Text style={styles.name}>{profile.displayName}</Text>
                  {!editing && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit name"
                      style={({ pressed }) => [
                        styles.accountButton,
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={() => {
                        setName(profile.displayName);
                        setEditOwner({
                          token: state.token,
                          profileId: profile.id,
                        });
                        setError('');
                      }}
                    >
                      <Pencil size={20} color="#F5F5F3" accessible={false} />
                    </Pressable>
                  )}
                </View>
                {profile.kind === 'demo' && (
                  <Text style={styles.caption}>
                    This profile uses sample data. Its points and activity stay
                    separate from your account.
                  </Text>
                )}
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
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: settingsOpen }}
                      onPress={() => setSettingsOpen(!settingsOpen)}
                      style={({ pressed }) => [
                        styles.settingsRow,
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Text style={[styles.body, { flex: 1 }]}>
                        Account settings
                      </Text>
                      {settingsOpen ? (
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
                    {settingsOpen && (
                      <>
                        <Action
                          secondary
                          label={
                            profile.kind === 'real'
                              ? 'Use sample profile'
                              : 'Use my account'
                          }
                          onPress={() => {
                            void controller
                              .select(profile.kind === 'real' ? 'demo' : 'real')
                              .catch(() =>
                                setError(
                                  'Could not switch profiles. Try again.',
                                ),
                              );
                          }}
                        />
                        <Action
                          secondary
                          label="Refresh session"
                          onPress={() => {
                            void controller.resume();
                          }}
                        />
                      </>
                    )}
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
  compactEntry: { flexShrink: 0 },
  accountButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#191919',
    borderWidth: 1,
    borderColor: '#3D3D3D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: { flex: 1, backgroundColor: '#091410' },
  section: {
    marginHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  settingsRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  title: {
    flex: 1,
    color: '#F5F5F3',
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'Geist_600SemiBold',
  },
  name: {
    flex: 1,
    lineHeight: 32,
    color: '#F5F5F3',
    fontSize: 24,
    fontFamily: 'Geist_600SemiBold',
  },
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
    borderRadius: 26,
  },
  secondary: {
    borderRadius: 26,
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
