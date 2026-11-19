function copyOptions(options) {
  return Array.isArray(options) ? JSON.parse(JSON.stringify(options)) : [];
}

function fisherYates(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function optionLetter(option) {
  return typeof option?.letter === "string"
    ? option.letter.trim().toUpperCase()
    : "";
}

export function createAttemptShuffle(questions = []) {
  const list = Array.isArray(questions) ? questions : [];
  const questionIds = fisherYates(list.map((q) => q.id));
  const options = {};
  for (const question of list) {
    if (question.questionType === "TYPING") continue;
    const letters = copyOptions(question.options)
      .map(optionLetter)
      .filter(Boolean);
    if (letters.length > 1) {
      options[question.id] = fisherYates(letters);
    }
  }
  return { questionIds, options };
}

export function applyAttemptShuffle(questions = [], layout) {
  const list = Array.isArray(questions) ? questions : [];
  const byId = new Map(list.map((q) => [q.id, q]));
  const ordered = [];
  const seen = new Set();

  const layoutIds = Array.isArray(layout?.questionIds) ? layout.questionIds : [];
  for (const id of layoutIds) {
    const question = byId.get(id);
    if (!question || seen.has(id)) continue;
    ordered.push(question);
    seen.add(id);
  }
  for (const question of list) {
    if (seen.has(question.id)) continue;
    ordered.push(question);
  }

  const optionOrders = layout?.options && typeof layout.options === "object"
    ? layout.options
    : {};

  return ordered.map((question, index) => {
    const originalOptions = copyOptions(question.options);
    const letterOrder = Array.isArray(optionOrders[question.id])
      ? optionOrders[question.id]
      : null;
    let options = originalOptions;
    if (letterOrder?.length) {
      const byLetter = new Map(
        originalOptions.map((opt) => [optionLetter(opt), opt])
      );
      const shuffled = [];
      const used = new Set();
      for (const letter of letterOrder) {
        const key = String(letter || "").trim().toUpperCase();
        const opt = byLetter.get(key);
        if (!opt || used.has(key)) continue;
        shuffled.push(opt);
        used.add(key);
      }
      for (const opt of originalOptions) {
        const key = optionLetter(opt);
        if (!key || used.has(key)) continue;
        shuffled.push(opt);
      }
      options = shuffled;
    }
    return {
      ...question,
      options,
      orderIndex: index + 1,
    };
  });
}
