/**
 * Score aptitude / objective questions by stable option identity (letter),
 * independent of per-attempt shuffle of question or option order.
 */
export function scoreObjectiveAttempt(questions, answers = {}) {
  const questionsOrdered = [...(questions || [])].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  );

  let score = 0;
  let correctAnswers = 0;
  let answeredCount = 0;
  const questionResults = [];

  for (let i = 0; i < questionsOrdered.length; i++) {
    const question = questionsOrdered[i];
    const rawUserAnswer =
      answers[question.id] ?? answers[i] ?? answers[String(i)];
    const rawCorrect = question.correctAnswer;

    const userAnswer =
      rawUserAnswer != null
        ? String(rawUserAnswer).trim().toUpperCase().slice(0, 1)
        : "";

    if (userAnswer !== "") answeredCount += 1;

    const correctAnswerRaw =
      rawCorrect != null
        ? typeof rawCorrect === "string"
          ? rawCorrect.trim()
          : String(rawCorrect ?? "").trim()
        : "";

    let isCorrect = false;
    if (userAnswer !== "" || correctAnswerRaw !== "") {
      if (question.questionType === "TEXT") {
        isCorrect =
          userAnswer.length > 0 &&
          correctAnswerRaw.length > 0 &&
          userAnswer.toLowerCase() === correctAnswerRaw.toLowerCase();
      } else {
        let referenceLetter = correctAnswerRaw.toUpperCase();
        const options = Array.isArray(question.options) ? question.options : [];
        if (options.length > 0) {
          const singleLetter = /^[A-Z]$/i.test(referenceLetter);
          if (!singleLetter) {
            const byText = options.find(
              (opt) =>
                opt &&
                typeof opt.text === "string" &&
                opt.text.trim().toLowerCase() === correctAnswerRaw.toLowerCase()
            );
            if (byText && typeof byText.letter === "string") {
              referenceLetter = byText.letter.trim().toUpperCase();
            }
          } else {
            referenceLetter = referenceLetter.slice(0, 1);
          }
        } else {
          referenceLetter = referenceLetter.slice(0, 1);
        }
        isCorrect =
          userAnswer.length > 0 &&
          referenceLetter.length > 0 &&
          userAnswer === referenceLetter;
      }
    }

    const points = Number(question.points) || 0;
    if (isCorrect) {
      score += points;
      correctAnswers += 1;
    }

    questionResults.push({
      questionId: question.id,
      userAnswer,
      isCorrect,
      points,
      pointsEarned: isCorrect ? points : 0,
      unanswered: userAnswer === "",
    });
  }

  const totalPoints = questionsOrdered.reduce(
    (sum, q) => sum + (Number(q.points) || 0),
    0
  );

  return {
    score,
    correctAnswers,
    answeredCount,
    totalPoints,
    questionResults,
  };
}

export function identityLetterFromDisplayChoice(shuffledQuestion, displayLetter) {
  const letter = String(displayLetter || "")
    .trim()
    .toUpperCase()
    .slice(0, 1);
  const options = Array.isArray(shuffledQuestion?.options)
    ? shuffledQuestion.options
    : [];
  const index = letter.charCodeAt(0) - 65;
  if (index < 0 || index >= options.length) return "";
  const identity = options[index]?.letter;
  return typeof identity === "string" ? identity.trim().toUpperCase() : "";
}
