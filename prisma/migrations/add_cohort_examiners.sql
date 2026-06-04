-- Cohort examiners: assign examiners to cohorts
CREATE TABLE IF NOT EXISTS `cohort_examiners` (
  `id` VARCHAR(191) NOT NULL,
  `cohort_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `cohort_examiners_cohort_id_user_id_key` (`cohort_id`, `user_id`),
  KEY `idx_cohort_examiners_cohort_id` (`cohort_id`),
  KEY `idx_cohort_examiners_user_id` (`user_id`),
  CONSTRAINT `cohort_examiners_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `cohort_examiners_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
