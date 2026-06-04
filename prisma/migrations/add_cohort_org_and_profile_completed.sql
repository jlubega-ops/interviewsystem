-- Cohort organisation; User profile completed timestamp
ALTER TABLE `cohorts` ADD COLUMN `organisation` VARCHAR(255) NULL AFTER `instructions`;
ALTER TABLE `users` ADD COLUMN `profile_completed_at` DATETIME(3) NULL AFTER `last_login_at`;
