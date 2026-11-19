export function coerceFlag(value) {
  if (typeof value === "number") return value !== 0;
  if (typeof value === "bigint") return value !== 0n;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  }
  return Boolean(value);
}

export function cascadeResultsFlags({
  showScore = false,
  showAttempt = false,
  showCorrect = false,
} = {}) {
  let score = Boolean(showScore);
  let attempt = Boolean(showAttempt);
  let correct = Boolean(showCorrect);
  if (correct) {
    attempt = true;
    score = true;
  } else if (attempt) {
    score = true;
  }
  return {
    resultsPublished: score,
    resultsShowAttempt: attempt,
    resultsShowCorrect: correct,
  };
}

export function flagsFromCohortRow(row = {}) {
  return cascadeResultsFlags({
    showScore: coerceFlag(
      row.results_published ?? row.resultsPublished ?? row.Results_Published
    ),
    showAttempt: coerceFlag(
      row.results_show_attempt ??
        row.resultsShowAttempt ??
        row.Results_Show_Attempt
    ),
    showCorrect: coerceFlag(
      row.results_show_correct ??
        row.resultsShowCorrect ??
        row.Results_Show_Correct
    ),
  });
}

export async function readCohortResultFlags(prisma, cohortId) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT results_published, results_show_attempt, results_show_correct FROM cohorts WHERE id = ? LIMIT 1",
      cohortId
    );
    if (rows?.[0]) return flagsFromCohortRow(rows[0]);
  } catch (_) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT results_published FROM cohorts WHERE id = ? LIMIT 1",
        cohortId
      );
      if (rows?.[0]) return flagsFromCohortRow(rows[0]);
    } catch (__) {}
  }
  return cascadeResultsFlags();
}

export async function writeCohortResultFlags(prisma, cohortId, flags) {
  const next = cascadeResultsFlags({
    showScore: flags.resultsPublished,
    showAttempt: flags.resultsShowAttempt,
    showCorrect: flags.resultsShowCorrect,
  });
  await prisma.$executeRawUnsafe(
    "UPDATE cohorts SET results_published = ?, results_show_attempt = ?, results_show_correct = ? WHERE id = ?",
    next.resultsPublished ? 1 : 0,
    next.resultsShowAttempt ? 1 : 0,
    next.resultsShowCorrect ? 1 : 0,
    cohortId
  );
  return next;
}

export function applyCascadeChange(current, key, checked) {
  const next = {
    showScore: current.showScore,
    showAttempt: current.showAttempt,
    showCorrect: current.showCorrect,
  };
  if (key === "showScore") {
    next.showScore = checked;
    if (!checked) {
      next.showAttempt = false;
      next.showCorrect = false;
    }
  } else if (key === "showAttempt") {
    next.showAttempt = checked;
    if (checked) next.showScore = true;
    else next.showCorrect = false;
  } else if (key === "showCorrect") {
    next.showCorrect = checked;
    if (checked) {
      next.showAttempt = true;
      next.showScore = true;
    }
  }
  return next;
}
