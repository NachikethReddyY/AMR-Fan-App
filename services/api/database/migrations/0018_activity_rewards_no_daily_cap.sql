-- Activity rewards have no calendar-day allowance. Remove the index that only
-- supported the former daily-cap query from installations that already ran 0016.
DROP INDEX IF EXISTS app.activity_reward_daily;
