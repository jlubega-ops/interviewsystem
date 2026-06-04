-- Migration: Add user auth and profile fields (firstName, lastName, organisation, suspend, lastLogin)
-- Run each statement in your MySQL database. If a column already exists, skip that statement.

ALTER TABLE `users` ADD COLUMN `first_name` VARCHAR(191) NULL AFTER `full_name`;
ALTER TABLE `users` ADD COLUMN `middle_name` VARCHAR(191) NULL AFTER `first_name`;
ALTER TABLE `users` ADD COLUMN `last_name` VARCHAR(191) NULL AFTER `middle_name`;
ALTER TABLE `users` ADD COLUMN `organisation` VARCHAR(255) NULL AFTER `last_name`;
ALTER TABLE `users` ADD COLUMN `is_suspended` BOOLEAN NOT NULL DEFAULT FALSE AFTER `is_activated`;
ALTER TABLE `users` ADD COLUMN `suspension_reason` TEXT NULL AFTER `is_suspended`;
ALTER TABLE `users` ADD COLUMN `last_login_at` DATETIME(3) NULL AFTER `suspension_reason`;
