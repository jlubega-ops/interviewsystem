/**
 * Deterministic shuffle utilities for exam fairness.
 * - Different candidates get different question and option orders (each attempt has unique id).
 * - Same candidate sees the same order on refresh or resume after logout (seed = attempt.id).
 * Options keep their .letter for marking; UI can display A,B,C,D by position.
 */

/**
 * Simple 32-bit hash from a string (e.g. UUID) for use as a numeric seed.
 * @param {string} str
 * @returns {number}
 */
export function hashStringToSeed(str) {
  if (typeof str !== "string") return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h >>> 0;
  }
  return h;
}

/**
 * Seeded pseudo-random number in [0, 1). Uses LCG; state is mutated.
 * @param {{ state: number }} stateObj
 * @returns {number}
 */
function nextSeeded(stateObj) {
  const a = 1103515245;
  const c = 12345;
  const m = 2 ** 31;
  stateObj.state = (a * stateObj.state + c) % m;
  return (stateObj.state >>> 0) / m;
}

/**
 * Deterministic shuffle of an array using Fisher-Yates and a seed.
 * Same seed always produces the same permutation.
 * @param {Array<T>} array
 * @param {number} seed - numeric seed (e.g. from hashStringToSeed(attemptId))
 * @returns {Array<T>} new array with same elements in shuffled order
 */
export function shuffleWithSeed(array, seed) {
  if (!Array.isArray(array) || array.length <= 1) return [...array];
  const out = [...array];
  const stateObj = { state: seed >>> 0 };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(nextSeeded(stateObj) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Get the display letter (A/B/C/D) that the candidate saw for an option, given
 * the attempt's option shuffle. Use when showing results/export so "Student Answer"
 * and "Correct Answer" match what the candidate saw.
 * @param {string} attemptId - CandidateSession id
 * @param {{ id: string, options?: Array<{ letter: string }> }} question - question with options (JSON)
 * @param {string} optionLetter - stored option.letter (e.g. "A", "C")
 * @returns {string} display letter "A".."D" or optionLetter if not found
 */
export function getDisplayLetterForOption(attemptId, question, optionLetter) {
  if (!optionLetter || !question) return optionLetter || "";
  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length === 0) return optionLetter;
  const seed = hashStringToSeed(String(attemptId) + String(question.id));
  const shuffled = shuffleWithSeed([...options], seed);
  const index = shuffled.findIndex(
    (opt) => String(opt?.letter).toUpperCase() === String(optionLetter).toUpperCase()
  );
  if (index === -1) return optionLetter;
  return String.fromCharCode(65 + index);
}
