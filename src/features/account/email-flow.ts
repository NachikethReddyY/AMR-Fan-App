import type { AccountApi } from './api.ts';
import type { AuthenticatedSession } from './session.ts';
import {
  type createSupabaseAuth,
  type ProviderSession,
  EmailConfirmationRequired,
  validateEmail,
} from './supabase.ts';

type Confirmation = { kind: 'confirmation'; email: string };
export function createEmailFlow(
  auth: ReturnType<typeof createSupabaseAuth>,
  api: Pick<AccountApi, 'signIn'>,
  now: () => number = Date.now,
) {
  let lastSend: { email: string; until: number } | null = null;
  function resendWait(email: string) {
    return lastSend?.email === validateEmail(email)
      ? Math.max(0, Math.ceil((lastSend.until - now()) / 1000))
      : 0;
  }
  function reserveSend(email: string) {
    const wait = resendWait(email);
    if (wait)
      throw new Error(`Wait ${wait} seconds before requesting another code.`);
    // Reserve before network I/O so double taps cannot dispatch two sends.
    // Supabase remains authoritative across app restarts and other devices.
    lastSend = { email: validateEmail(email), until: now() + 60_000 };
  }
  async function exchange(
    provider: ProviderSession,
  ): Promise<AuthenticatedSession> {
    try {
      const session = await api.signIn(provider.accessToken);
      return { ...session, provider };
    } catch (error) {
      await auth.revoke(provider);
      throw error;
    }
  }
  return {
    resendWait,
    authenticate: async (
      mode: 'signIn' | 'signUp',
      email: string,
      password: string,
    ): Promise<AuthenticatedSession | Confirmation> => {
      try {
        if (mode === 'signUp') {
          reserveSend(email);
          const result = await auth.signUp(email, password);
          return result.kind === 'confirmation'
            ? result
            : exchange(result.provider);
        }
        return exchange(await auth.signIn(email, password));
      } catch (error) {
        if (error instanceof EmailConfirmationRequired)
          return { kind: 'confirmation', email: validateEmail(email) };
        throw error;
      }
    },
    verify: async (email: string, code: string) =>
      exchange(await auth.verifyCode(email, code)),
    resend: async (email: string): Promise<Confirmation> => {
      reserveSend(email);
      await auth.resendCode(email);
      return { kind: 'confirmation', email: validateEmail(email) };
    },
  };
}
