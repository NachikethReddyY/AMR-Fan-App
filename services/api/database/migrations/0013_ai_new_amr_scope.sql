-- Forward-only scope transition. Preserve legacy amounts, operations and holds.
-- The new row requires a separate reviewed operator action; do not seed it here.
ALTER TABLE app.ai_cost_budget DROP CONSTRAINT ai_cost_budget_scope_check;
ALTER TABLE app.ai_cost_budget ADD CONSTRAINT ai_cost_budget_scope_check
  CHECK (scope IN ('amr-tokenrouter-dev-and-demo', 'amr-new-calls-20260927-v1'));
UPDATE app.ai_cost_budget SET suspended = true
  WHERE scope = 'amr-tokenrouter-dev-and-demo';
-- No grants change. Runtime still cannot insert a budget row or change its scope/cap.
