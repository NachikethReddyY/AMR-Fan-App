ALTER TABLE app.profiles
  ADD COLUMN email text CHECK (email IS NULL OR (length(email) BETWEEN 3 AND 254)),
  ADD COLUMN birthday text CHECK (birthday IS NULL OR birthday ~ '^\d{4}-\d{2}-\d{2}$');
