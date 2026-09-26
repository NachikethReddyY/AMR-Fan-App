import type { AccountApi } from './api.ts';
import type { AuthenticatedSession } from './session.ts';
import {
  type createSupabaseAuth,
  type ProviderSession,
  EmailConfirmationRequired,
} from './supabase.ts';

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
    ): Promise<AuthenticatedSession> => {
      try {
        if (mode === 'signUp') {
          const result = await auth.signUp(email, password);
          if (result.kind === 'confirmation')
            throw new Error(
              'Account creation could not finish. Try again later.',
            );
          return exchange(result.provider);
        }
        return exchange(await auth.signIn(email, password));
      } catch (error) {
        if (error instanceof EmailConfirmationRequired)
          throw new Error(
            'Sign-in could not finish for this account. Try again later.',
          );
        throw error;
      }
    },
  };
}
