-- Migration: Add is_activated column to users table
-- Run this SQL directly in your MySQL database

ALTER TABLE `users` 
ADD COLUMN `is_activated` BOOLEAN NOT NULL DEFAULT FALSE 
AFTER `is_active`;

