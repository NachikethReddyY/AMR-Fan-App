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
) {
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
    authenticate: async (
      mode: 'signIn' | 'signUp',
      email: string,
      password: string,
    ): Promise<AuthenticatedSession | Confirmation> => {
      try {
        if (mode === 'signUp') {
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
      await auth.resendCode(email);
      return { kind: 'confirmation', email: validateEmail(email) };
    },
  };
}
