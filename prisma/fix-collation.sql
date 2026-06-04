-- Fix MySQL "Illegal mix of collations" (utf8mb4_0900_ai_ci vs utf8mb4_unicode_ci).
-- Run from project root (no mysql CLI needed):
--   npm run fix-collation
-- Or with Node: node scripts/fix-collation.js
--
-- Optional: add to DATABASE_URL so the connection uses the same collation:
--   ?collation=utf8mb4_unicode_ci

SET FOREIGN_KEY_CHECKS = 0;

-- Normalize tables involved in cohort/interview queries to utf8mb4_unicode_ci
ALTER TABLE cohort_interviews CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE cohorts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE interviews CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
