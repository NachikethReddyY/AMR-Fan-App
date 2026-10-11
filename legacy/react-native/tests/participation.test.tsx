import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { FanVoting } from '../src/features/submissions/FanVoting';
import { ParticipationHistory } from '../src/features/submissions/ParticipationHistory';
import { AccountError, type Request } from '../src/features/account/api';
import type { SharedSubmission } from '../src/features/submissions/participation-contracts';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  value: true,
  configurable: true,
});
const profileId = '10000000-0000-4000-8000-000000000001';
const submissionId = '10000000-0000-4000-8000-000000000002';
const operationId = '10000000-0000-4000-8000-000000000004';
let mockContext = { token: 'session-a', profileId };
const mockRequest = jest.fn<Request>();
const mockRefresh = jest.fn(async () => {});
const mockHistory = { refresh: mockRefresh };
const mockExpire = jest.fn(async () => {});
const mockSaved = new Map<string, string>();
jest.mock('../src/features/account/native-auth', () => ({
  api: { request: (...args: Parameters<Request>) => mockRequest(...args) },
}));
jest.mock('../src/features/account/storage', () => ({
  privateStorage: {
    read: async (key: string) => mockSaved.get(key) ?? null,
    write: async (key: string, value: string) => {
      mockSaved.set(key, value);
    },
    clear: async (key: string) => {
      mockSaved.delete(key);
    },
  },
}));
jest.mock('../src/features/account/provider', () => ({
  useAccount: () => ({
    controller: { expire: mockExpire },
    state: {
      kind: 'signedIn',
      token: mockContext.token,
      selected: 'real',
      account: { profiles: [{ id: mockContext.profileId, kind: 'real' }] },
    },
  }),
}));
jest.mock('../src/features/account/useResource', () => ({
  ...jest.requireActual<typeof import('../src/features/account/useResource')>(
    '../src/features/account/useResource',
  ),
  useProfileContext: () => mockContext,
}));
jest.mock('../src/features/points/provider', () => ({
  useHistory: () => ({ controller: mockHistory }),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '10000000-0000-4000-8000-000000000003',
}));
jest.mock('../src/features/points/controls', () => ({
  Text: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Action: ({
    label,
    disabled,
    onPress,
  }: {
    label: string;
    disabled?: boolean;
    onPress: () => void;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (value: unknown) => value },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TextInput: ({
    value,
    editable,
    onChangeText,
    accessibilityLabel,
  }: {
    value: string;
    editable?: boolean;
    onChangeText: (value: string) => void;
    accessibilityLabel: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      value={value}
      disabled={editable === false}
      onChange={(e) => onChangeText(e.target.value)}
    />
  ),
}));
const item: SharedSubmission = {
  id: submissionId,
  text: 'How does the team reduce waste?',
  tag: 'question',
  rankingPoints: '9007199254740993',
  approvedAt: '2026-09-26T12:00:00.000001Z',
  status: 'backlog',
  fulfilment: 'demonstration',
};
let rows: SharedSubmission[];
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  rows = [
    item,
    { ...item, id: operationId, text: 'Selected activity', status: 'selected' },
  ];
  mockContext = { token: 'session-a', profileId };
  mockSaved.clear();
  mockRequest.mockReset();
  mockRefresh.mockClear();
  mockExpire.mockClear();
  mockRequest.mockImplementation(async (_path, _token, method, body) =>
    method === 'POST'
      ? {
          outcome: {
            pointsOperationId: operationId,
            submissionId,
            points: 10,
            rankingPointsAfter: '9007199254741003',
            approvedAt: item.approvedAt,
          },
        }
      : { items: rows, nextCursor: null },
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function mount() {
  await act(async () => root.render(<FanVoting />));
}
function button(label: string) {
  const found = [...host.querySelectorAll('button')].find(
    (b) => b.textContent === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
function posts() {
  return mockRequest.mock.calls.filter((call) => call[2] === 'POST');
}

test('B replaces only ranking with review; cancel returns without a debit', async () => {
  await mount();
  expect(host.textContent).toContain('9007199254740993');
  await click('Review contribution');
  expect(host.textContent).toContain('How does the team reduce waste?');
  expect(host.textContent).not.toContain('Selected activity');
  expect(host.textContent).toContain('non-refundable');
  expect(posts()).toHaveLength(0);
  await click('Back to fan voting');
  expect(host.textContent).toContain('Selected activity');
  expect(posts()).toHaveLength(0);
});
test('explicit confirmation sends once, returns to ranking and refreshes balance', async () => {
  await mount();
  await click('Review contribution');
  await click('Confirm contribution: 10 points');
  expect(posts()).toHaveLength(1);
  expect(host.textContent).toContain('10 points contributed');
  expect(host.textContent).toContain('Selected activity');
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});
test('lost response stays recoverable after remount, uses original key and blocks new review', async () => {
  let lost = true;
  const normal = mockRequest.getMockImplementation()!;
  mockRequest.mockImplementation(async (...args) => {
    if (args[2] === 'POST' && lost) {
      lost = false;
      throw new Error('lost response');
    }
    return normal(...args);
  });
  await mount();
  await click('Review contribution');
  await click('Confirm contribution: 10 points');
  expect(host.textContent).toContain('Retry same contribution');
  await act(async () => root.render(<div />));
  await mount();
  expect(
    [...host.querySelectorAll('button')].some(
      (b) => b.textContent === 'Review contribution',
    ),
  ).toBe(false);
  await click('Retry same contribution');
  expect(posts()).toHaveLength(2);
  expect(posts()[1]).toEqual(posts()[0]);
  expect(host.textContent).toContain('10 points contributed');
});
test('server refusal refreshes frozen state with no automatic debit retry', async () => {
  const normal = mockRequest.getMockImplementation()!;
  mockRequest.mockImplementation(async (...args) => {
    if (args[2] === 'POST') {
      rows = rows.map((row) => ({ ...row, status: 'selected' }));
      throw new AccountError(409, 'closed');
    }
    return normal(...args);
  });
  await mount();
  await click('Review contribution');
  await click('Confirm contribution: 10 points');
  expect(posts()).toHaveLength(1);
  expect(host.textContent).toContain('Request declined');
  expect(host.textContent).toContain('Contributions closed');
  expect(
    [...host.querySelectorAll('button')].some(
      (b) => b.textContent === 'Review contribution',
    ),
  ).toBe(false);
});
test('pending outcome remains isolated when profile changes', async () => {
  const normal = mockRequest.getMockImplementation()!;
  mockRequest.mockImplementation(async (...args) => {
    if (args[2] === 'POST') throw new Error('lost');
    return normal(...args);
  });
  await mount();
  await click('Review contribution');
  await click('Confirm contribution: 10 points');
  mockContext = { token: 'session-b', profileId: operationId };
  await mount();
  expect(host.textContent).not.toContain('Retry same contribution');
  expect(posts()).toHaveLength(1);
});
test('unavailable ranking is honest and retryable, not synthetic content', async () => {
  mockRequest.mockRejectedValue(new Error('backend not deployed'));
  await mount();
  expect(host.textContent).toContain('Data unavailable');
  expect(host.textContent).not.toContain(item.text);
  expect(button('Refresh fan voting')).toBeDefined();
});
test('History shows selected and demonstration fulfilled status using operation-linked reads', async () => {
  mockRequest.mockResolvedValue({
    items: [
      {
        pointsOperationId: operationId,
        sequence: '2',
        submissionId,
        moderation: 'approved',
        participation: { ...item, status: 'selected' },
      },
      {
        pointsOperationId: submissionId,
        sequence: '1',
        submissionId: operationId,
        moderation: 'approved',
        participation: { ...item, id: operationId, status: 'fulfilled' },
      },
    ],
    nextCursor: null,
  });
  await act(async () => root.render(<ParticipationHistory />));
  expect(host.textContent).toContain('Selected');
  expect(host.textContent).toContain('Fulfilled (demonstration)');
  expect(host.textContent).toContain('Contributions closed');
});

test('confirmed receipt stays visible if its follow-up ranking refresh fails', async () => {
  let posted = false;
  const normal = mockRequest.getMockImplementation()!;
  mockRequest.mockImplementation(async (...args) => {
    if (args[2] === 'POST') {
      posted = true;
      return normal(...args);
    }
    if (posted) throw new Error('refresh unavailable');
    return normal(...args);
  });
  await mount();
  await click('Review contribution');
  await click('Confirm contribution: 10 points');
  expect(host.textContent).toContain('10 points contributed');
  expect(host.textContent).toContain('Data unavailable');
  expect(posts()).toHaveLength(1);
});
test('empty shared ranking does not invent submissions or a spend control', async () => {
  rows = [];
  await mount();
  expect(host.textContent).toContain('No approved submissions yet.');
  expect(
    [...host.querySelectorAll('button')].some(
      (b) => b.textContent === 'Review contribution',
    ),
  ).toBe(false);
});

async function amount(value: string) {
  const input = host.querySelector('input');
  if (!input) throw new Error('Missing amount field');
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!set) throw new Error('Missing native value setter');
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
test('amount must be a whole contribution of at least ten and exact spend is visible before confirmation', async () => {
  await mount();
  await click('Review contribution');
  await amount('9');
  await click('Confirm contribution: 9 points');
  expect(posts()).toHaveLength(0);
  expect(host.textContent).toContain('Enter a whole number');
  await amount('25');
  expect(button('Confirm contribution: 25 points')).toBeDefined();
  expect(posts()).toHaveLength(0);
  await click('Confirm contribution: 25 points');
  expect(posts()[0][3]).toEqual({
    requestId: '10000000-0000-4000-8000-000000000003',
    points: 25,
  });
});
