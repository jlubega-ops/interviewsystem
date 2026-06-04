-- Fix "candidate_id and id are incompatible" by making all FK-related columns the same type.
-- Run this ONCE before `npx prisma db push`. Use your DB name instead of mubseiic if different.
--
-- From project root:
--   mysql -u root -p1234 mubseiic < prisma/fix-fk-column-types.sql
-- Then:
--   npx prisma db push

SET FOREIGN_KEY_CHECKS = 0;

-- Use VARCHAR(191) and utf8mb4 so all columns match (Prisma default for String in MySQL)
ALTER TABLE users
  MODIFY COLUMN id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE candidates
  MODIFY COLUMN id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE cohorts
  MODIFY COLUMN id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN created_by VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE cohort_enrollments
  MODIFY COLUMN id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN cohort_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN candidate_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- cohort_interviews: FK columns must match cohorts.id and interviews.id (VARCHAR(191))
ALTER TABLE cohort_interviews
  MODIFY COLUMN id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN cohort_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN interview_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- User FK columns (must match users.id)
ALTER TABLE system_settings
  MODIFY COLUMN updated_by VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE interviews
  MODIFY COLUMN created_by VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE user_sessions
  MODIFY COLUMN user_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE password_reset_tokens
  MODIFY COLUMN user_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE account_activation_tokens
  MODIFY COLUMN user_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;
