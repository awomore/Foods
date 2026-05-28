-- Allow new users to be created without a role (role is assigned on the role-selection screen)
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
