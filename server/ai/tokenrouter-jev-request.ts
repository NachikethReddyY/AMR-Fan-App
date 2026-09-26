import type {
  prepareJevActivityChoice,
  prepareJevRouteChoice,
} from './jev-decisions.ts';

type PreparedDecision = Extract<
  ReturnType<typeof prepareJevRouteChoice | typeof prepareJevActivityChoice>,
  { kind: 'prepared' }
>;
type ChoiceQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
};
type RequestPreparation =
  | { kind: 'unavailable'; reason: 'request-too-large' }
  | {
      kind: 'request-only';
      method: 'POST';
      url: 'https://api.tokenrouter.com/api/alpha/decisions';
      body: {
        model: 'typesafe/jev-1.13';
        state: string;
        questions: Record<string, ChoiceQuestion>;
      };
      requestBytes: number;
    };

/** Pure mapping of an internally validated decision to the console's documented
 * string-state/string-criteria request. No credentials, dispatch or response parser:
 * model echo, confidence, usage and billable bounds remain unverified.
 */
export function prepareTokenRouterJevRequest(
  prepared: PreparedDecision,
): RequestPreparation {
  const sourceQuestions: Record<
    string,
    {
      type: 'choice';
      instructions: string;
      criteria: Record<string, string | null>;
    }
  > = prepared.request.questions;
  const questions: Record<string, ChoiceQuestion> = {};
  for (const [name, question] of Object.entries(sourceQuestions)) {
    questions[name] = {
      type: 'choice',
      instructions: question.instructions,
      // Route IDs name the same options in serialized state; never invent metrics.
      criteria: Object.fromEntries(
        Object.entries(question.criteria).map(([option, description]) => [
          option,
          description ?? option,
        ]),
      ),
    };
  }
  const body: Extract<RequestPreparation, { kind: 'request-only' }>['body'] = {
    model: 'typesafe/jev-1.13',
    state: JSON.stringify(prepared.request.state),
    questions,
  };
  const requestBytes = Buffer.byteLength(JSON.stringify(body));
  if (requestBytes > 60000)
    return { kind: 'unavailable', reason: 'request-too-large' };
  return {
    kind: 'request-only',
    method: 'POST',
    url: 'https://api.tokenrouter.com/api/alpha/decisions',
    body,
    requestBytes,
  };
}
