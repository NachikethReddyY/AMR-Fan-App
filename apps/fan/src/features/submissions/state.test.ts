import { submissionInput, ownedSubmission } from './contracts';
import { createSubmissionsApi } from './api';
const id = '10000000-0000-4000-8000-000000000001';
test('submission confirmation keeps nonrefundable fixed fee and rejects client status/ranking', () => {
  const input = {
    requestId: id,
    text: 'Question',
    tag: null,
    confirmedFee: 500,
    resubmissionOf: null,
  };
  expect(submissionInput.parse(input)).toEqual(input);
  expect(() => submissionInput.parse({ ...input, confirmedFee: 0 })).toThrow();
  expect(() =>
    submissionInput.parse({ ...input, status: 'approved' }),
  ).toThrow();
});
test('submission list preserves opaque numeric cursor and rejects owner mismatch', async () => {
  const request = jest.fn(async () => ({ submissions: [], nextCursor: null }));
  await createSubmissionsApi(request).list(
    { token: 'A', profileId: id },
    '9007199254740993',
  );
  expect(request.mock.calls[0]).toEqual([
    `/v1/profiles/${id}/submissions?limit=25&before=9007199254740993`,
    'A',
  ]);
  expect(() => ownedSubmission({}, id)).toThrow();
});
