export type Identity = { issuer: string; subject: string };
export type Profile = {
  id: string;
  kind: 'real' | 'demo';
  displayName: string;
  balance: number;
};
export type Account = {
  id: string;
  role: 'fan' | 'admin';
  profiles: Profile[];
};

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function parseProfile(value: Record<string, unknown>): Profile {
  if (
    typeof value.id !== 'string' ||
    (value.kind !== 'real' && value.kind !== 'demo') ||
    typeof value.display_name !== 'string' ||
    typeof value.balance !== 'number' ||
    !Number.isSafeInteger(value.balance) ||
    value.balance < 0
  )
    throw new Error('Invalid stored profile.');
  return {
    id: value.id,
    kind: value.kind,
    displayName: value.display_name,
    balance: value.balance,
  };
}
