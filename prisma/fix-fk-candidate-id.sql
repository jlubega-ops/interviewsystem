-- Run this only if migration fails with "candidate_id and id are incompatible".
-- Ensures candidate_id and candidates.id match (VARCHAR(36) for UUID).
-- Execute against your database, e.g. mysql -u root -p mubseiic < prisma/fix-fk-candidate-id.sql

-- Drop the FK if it exists (MySQL may have created it with wrong types)
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE cohort_enrollments
  MODIFY COLUMN candidate_id VARCHAR(36) NOT NULL,
  MODIFY COLUMN cohort_id VARCHAR(36) NOT NULL;

ALTER TABLE candidates
  MODIFY COLUMN id VARCHAR(36) NOT NULL;

ALTER TABLE cohorts
  MODIFY COLUMN id VARCHAR(36) NOT NULL,
  MODIFY COLUMN created_by VARCHAR(36) NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- Then run: npx prisma db push
-- or: npx prisma migrate dev
