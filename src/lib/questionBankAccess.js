/**
 * Question bank access control by scope.
 * ALL_USERS: admin and examiners can access
 * ADMIN_ONLY: only admin and superadmin
 * PRIVATE: only the creator
 */
export function canAccessQuestionBank(userId, userRole, bank) {
  if (!userId || !bank) return false;
  if (bank.scope === "PRIVATE") return bank.createdBy === userId;
  if (bank.scope === "ADMIN_ONLY") return userRole === "ADMIN" || userRole === "SUPERADMIN";
  if (bank.scope === "ALL_USERS") return ["ADMIN", "SUPERADMIN", "EXAMINER"].includes(userRole);
  return false;
}

export function canEditQuestionBank(userId, userRole, bank) {
  return canAccessQuestionBank(userId, userRole, bank);
}
