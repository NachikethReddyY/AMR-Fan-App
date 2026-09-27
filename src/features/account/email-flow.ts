import type { AccountApi } from './api.ts';
import type { AuthenticatedSession } from './session.ts';
import {
  type createSupabaseAuth,
  type ProviderSession,
  EmailConfirmationRequired,
} from './supabase.ts';

const confirmationHelp =
  'Check your email. If you received a confirmation link, open it, then return here to sign in.';

export function createEmailFlow(
  auth: Pick<
    ReturnType<typeof createSupabaseAuth>,
    'signIn' | 'signUp' | 'revoke'
  >,
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
    ): Promise<AuthenticatedSession> => {
      try {
        if (mode === 'signUp') {
          const result = await auth.signUp(email, password);
          // Supabase can return a sanitized duplicate user here as well.
          // This result proves neither account creation nor email delivery.
          if (result.kind === 'confirmation') throw new Error(confirmationHelp);
          return exchange(result.provider);
        }
        return exchange(await auth.signIn(email, password));
      } catch (error) {
        if (error instanceof EmailConfirmationRequired)
          throw new Error(confirmationHelp);
        throw error;
      }
    },
  };
}
