import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Ref,
} from 'react';
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
import {
  AccountEditError,
  validateCredentials,
  type AccountDetails,
  type AccountChange,
} from './supabase';
import { useHistory } from '../points/provider';

const BoldText = createContext(false);
function Text(props: TextProps & { ref?: Ref<NativeText> }) {
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
type CredentialDraft = {
  editor: 'email' | 'password' | null;
  email: string | null;
  needsCode: boolean;
};
const emptyCredentialDraft: CredentialDraft = {
  editor: null,
  email: null,
  needsCode: false,
};
function CredentialsEditor({
  draft,
  onDraftChange,
}: {
  draft: CredentialDraft;
  onDraftChange: (draft: CredentialDraft) => void;
}) {
  const { controller } = useAccount();
  const [details, setDetails] = useState<AccountDetails | null>(null);
  const { editor, email, needsCode } = draft;
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nonce, setNonce] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const attempt = useRef(0);
  useEffect(
    () => () => {
      attempt.current++;
    },
    [],
  );
  async function load() {
    const current = ++attempt.current;
    try {
      const next = await controller.readAccountDetails();
      if (attempt.current === current) setDetails(next);
    } catch (error) {
      if (attempt.current === current)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not load your email. Try again.',
        );
    } finally {
      if (attempt.current === current) setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    controller.readAccountDetails().then(
      (next) => {
        if (active) {
          setDetails(next);
          setBusy(false);
        }
      },
      (error: unknown) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not load your email. Try again.',
          );
          setBusy(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [controller]);
  function reload() {
    setBusy(true);
    setMessage('');
    void load();
  }
  async function save() {
    if (!editor || !details) return;
    const current = ++attempt.current;
    const change: AccountChange =
      editor === 'email'
        ? { kind: 'email', email: email ?? details.email }
        : {
            kind: 'password',
            password,
            currentPassword,
            ...(nonce ? { nonce } : {}),
          };
    setBusy(true);
    setMessage('');
    setPassword('');
    setCurrentPassword('');
    setNonce('');
    try {
      const next = await controller.updateAccount(change);
      if (attempt.current !== current) return;
      setDetails(next);
      onDraftChange({ ...draft, editor: null, needsCode: false });
      setMessage(
        change.kind === 'password'
          ? 'Password updated.'
          : next.pendingEmail
            ? ''
            : 'Email updated.',
      );
    } catch (error) {
      if (attempt.current !== current) return;
      if (
        error instanceof AccountEditError &&
        error.kind === 'reauthenticationRequired'
      )
        onDraftChange({ ...draft, needsCode: true });
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save. Check your connection and try again.',
      );
    } finally {
      if (attempt.current === current) setBusy(false);
    }
  }
  async function sendCode() {
    const current = ++attempt.current;
    setBusy(true);
    setMessage('');
    try {
      await controller.requestAccountCode();
      if (attempt.current === current)
        setMessage('Code requested. Check your email, then enter it below.');
    } catch (error) {
      if (attempt.current === current)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not request a code. Try again.',
        );
    } finally {
      if (attempt.current === current) setBusy(false);
    }
  }
  return (
    <View style={styles.credentials}>
      {details ? (
        <>
          <Text style={styles.body}>Email</Text>
          <Text style={styles.body}>{details.email}</Text>
          {details.pendingEmail && (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              Confirmation pending: {details.pendingEmail}. Follow the
              confirmation email instructions, then check again.
            </Text>
          )}
          {editor === 'email' ? (
            <>
              <Text style={styles.body}>New email</Text>
              <TextInput
                accessibilityLabel="New email"
                value={email ?? details.email}
                onChangeText={(email) => onDraftChange({ ...draft, email })}
                editable={!busy}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={254}
                style={styles.input}
              />
              <Action
                label={busy ? 'Saving…' : 'Save email'}
                onPress={() => {
                  void save();
                }}
                disabled={busy}
              />
            </>
          ) : editor === 'password' ? (
            <>
              <Text style={styles.body}>Current password</Text>
              <TextInput
                accessibilityLabel="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                editable={!busy}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={1024}
                style={styles.input}
              />
              <Text style={styles.body}>New password</Text>
              <TextInput
                accessibilityLabel="New password"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={1024}
                style={styles.input}
              />
              {needsCode && (
                <>
                  <Action
                    secondary
                    label="Send verification code"
                    disabled={busy}
                    onPress={() => {
                      void sendCode();
                    }}
                  />
                  <Text style={styles.body}>Verification code</Text>
                  <TextInput
                    accessibilityLabel="Verification code"
                    value={nonce}
                    onChangeText={setNonce}
                    editable={!busy}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={10}
                    style={styles.input}
                  />
                </>
              )}
              <Action
                label={busy ? 'Saving…' : 'Save password'}
                onPress={() => {
                  void save();
                }}
                disabled={busy}
              />
            </>
          ) : (
            <>
              <Action
                secondary
                label="Edit email"
                disabled={busy}
                onPress={() => {
                  onDraftChange({ ...draft, editor: 'email' });
                  setMessage('');
                }}
              />
              <Action
                secondary
                label="Change password"
                disabled={busy}
                onPress={() => {
                  onDraftChange({ ...draft, editor: 'password' });
                  setMessage('');
                }}
              />
              {details.pendingEmail && (
                <Action
                  secondary
                  label="Check email confirmation"
                  disabled={busy}
                  onPress={reload}
                />
              )}
            </>
          )}
          {editor && (
            <Action
              secondary
              label="Back to account"
              disabled={busy}
              onPress={() => {
                onDraftChange({ ...draft, editor: null });
                setPassword('');
                setCurrentPassword('');
                setNonce('');
                setMessage('');
              }}
            />
          )}
        </>
      ) : (
        <Action
          secondary
          label={busy ? 'Loading email…' : 'Retry account details'}
          disabled={busy}
          onPress={reload}
        />
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {message}
        </Text>
      )}
    </View>
  );
}
export function AccountPanel({
  compact = false,
  onOpenChange,
}: {
  compact?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
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
  const [credentialDraft, setCredentialDraft] = useState<{
    owner: string;
    draft: CredentialDraft;
  } | null>(null);
  useEffect(
    () =>
      controller.subscribeIdentityInvalidation(() => setCredentialDraft(null)),
    [controller],
  );
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const authHeading = useRef<NativeText>(null);
  const focusAuthHeading = useRef(false);
  useEffect(() => {
    if (!focusAuthHeading.current) return;
    focusAuthHeading.current = false;
    if (authHeading.current)
      AccessibilityInfo.sendAccessibilityEvent(authHeading.current, 'focus');
  }, [authMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const authAttempt = useRef(0);
  useEffect(
    () => () => {
      authAttempt.current++;
    },
    [],
  );
  const [editOwner, setEditOwner] = useState<{
    token: string;
    profileId: string;
  } | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const profile =
    state.kind === 'signedIn'
      ? state.account.profiles.find((p) => p.kind === 'real')
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
    setCredentialDraft(null);
    authAttempt.current++;
    controller.cancelSignIn();
    setPassword('');
    setAuthError('');
    setOpen(false);
    onOpenChange?.(false);
  }
  function openAccount(mode: 'signIn' | 'signUp' = 'signIn') {
    setAuthMode(mode);
    setPassword('');
    setAuthError('');
    setOpen(true);
    onOpenChange?.(true);
    void history.refresh();
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
    const attempt = ++authAttempt.current;
    await controller.signIn(() =>
      authenticateEmail(authMode, email, submitted),
    );
    if (
      attempt === authAttempt.current &&
      controller.getState().kind === 'signedIn'
    )
      close();
  }
  async function save() {
    setSaving(true);
    setError('');
    try {
      await controller.rename(name, 'real');
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
            onPress={() => openAccount()}
            style={({ pressed }) => [
              styles.accountButton,
              pressed && { opacity: 0.75 },
            ]}
          >
            <UserRound size={22} color="#F5F5F3" accessible={false} />
          </Pressable>
        ) : profile ? (
          <Action
            secondary
            label={`${profile.displayName}, account`}
            onPress={() => openAccount()}
          />
        ) : (
          <View style={styles.authEntries}>
            <View style={styles.authEntry}>
              <Action secondary label="Log in" onPress={() => openAccount()} />
            </View>
            <View style={styles.authEntry}>
              <Action label="Sign up" onPress={() => openAccount('signUp')} />
            </View>
          </View>
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
              <Text
                ref={authHeading}
                accessible
                accessibilityRole="header"
                style={styles.title}
              >
                {state.kind === 'signedOut'
                  ? authMode === 'signUp'
                    ? 'Create account'
                    : 'Sign in'
                  : 'Your account'}
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
                  {authMode === 'signUp'
                    ? 'Choose an email and password for your new account.'
                    : 'Enter your email and password to sign in to your account.'}
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
                    authAttempt.current++;
                    focusAuthHeading.current = true;
                    setAuthMode(authMode === 'signUp' ? 'signIn' : 'signUp');
                    setPassword('');
                    setAuthError('');
                    controller.cancelSignIn();
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
                {state.selected === 'demo' && (
                  <Text style={styles.caption}>
                    Test data is selected. Your real account stays unchanged.
                  </Text>
                )}
                {open && (
                  <CredentialsEditor
                    key={`${state.account.id}:${state.token}`}
                    draft={
                      credentialDraft?.owner ===
                      `${state.account.id}:${state.token}`
                        ? credentialDraft.draft
                        : emptyCredentialDraft
                    }
                    onDraftChange={(draft) =>
                      setCredentialDraft({
                        owner: `${state.account.id}:${state.token}`,
                        draft,
                      })
                    }
                  />
                )}
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
                            state.selected === 'real'
                              ? 'Use sample profile'
                              : 'Return to real data'
                          }
                          onPress={() => {
                            void controller
                              .select(
                                state.selected === 'real' ? 'demo' : 'real',
                              )
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
  credentials: { gap: 12 },
  authEntries: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  authEntry: { flexGrow: 1, flexBasis: 120 },
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
  modal: { flex: 1, backgroundColor: '#081310' },
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
    backgroundColor: '#004A4D',
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
