/**
 * Shared typing test scoring (used by submit-attempt and expired-attempt completion).
 * Map Net WPM to 0–100% speed score (Testlify/eSkill-style). 40–50 WPM = 70%, 50–60 = 80%, 60–75 = 90%, 75+ = 100%.
 */
export function speedScoreFromWpm(netWpm) {
  const wpm = Math.max(0, Number(netWpm) || 0);
  if (wpm < 40) return Math.min(70, Math.round((wpm / 40) * 70));
  if (wpm < 50) return 70;
  if (wpm < 60) return 80;
  if (wpm < 75) return 90;
  return 100;
}

/**
 * Compute typing score and pass flag from typingStats and question points.
 * @param {{ accuracy?: number, netWordsPerMinute?: number, wordsPerMinute?: number }} typingStats
 * @param {number} questionPoints
 * @returns {{ score: number, isPassing: boolean }}
 */
export function computeTypingScore(typingStats, questionPoints) {
  const accuracyPercent = Math.min(
    100,
    Math.max(0, typingStats?.accuracy ?? 0)
  );
  const netWpm =
    typingStats?.netWordsPerMinute ?? typingStats?.wordsPerMinute ?? 0;
  const speedPercent = speedScoreFromWpm(netWpm);
  const combinedPercent = accuracyPercent * 0.6 + speedPercent * 0.4;
  const score = Math.round(
    (combinedPercent / 100) * (questionPoints ?? 1)
  );
  const isPassing = combinedPercent >= 60;
  return {
    score: Math.min(score, questionPoints ?? 1),
    isPassing,
  };
}
