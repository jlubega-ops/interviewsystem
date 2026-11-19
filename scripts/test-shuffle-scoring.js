/**
 * End-to-end shuffle + scoring harness.
 * Creates a sample cohort, aptitude interview, questions, candidates,
 * then submits shuffled attempts for all-correct, all-wrong, mixed,
 * unanswered, and "always pick displayed A" scenarios.
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const prisma = new PrismaClient();
const ACCESS_KEY_SAFE_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";

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

function createAttemptShuffle(questions = []) {
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

function applyAttemptShuffle(questions = [], layout) {
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
  const optionOrders =
    layout?.options && typeof layout.options === "object" ? layout.options : {};
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
    return { ...question, options, orderIndex: index + 1 };
  });
}

function scoreObjectiveAttempt(questions, answers = {}) {
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
  return { score, correctAnswers, answeredCount, totalPoints, questionResults };
}

function identityLetterFromDisplayChoice(shuffledQuestion, displayLetter) {
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

function assert(condition, message, extra) {
  if (!condition) {
    const err = new Error(message);
    err.extra = extra;
    throw err;
  }
}

async function uniqueAccessKey() {
  for (let i = 0; i < 80; i += 1) {
    let suffix = "";
    for (let j = 0; j < 6; j += 1) {
      suffix += ACCESS_KEY_SAFE_CHARS.charAt(
        Math.floor(Math.random() * ACCESS_KEY_SAFE_CHARS.length)
      );
    }
    const accessKey = `MUBEIIC/${new Date().getFullYear()}/${suffix}`;
    const existing = await prisma.cohortEnrollment.findFirst({
      where: { accessKey },
    });
    if (!existing) return accessKey;
  }
  throw new Error("Could not generate a unique access key");
}

function firstWrongLetter(question) {
  const correct = String(question.correctAnswer || "")
    .trim()
    .toUpperCase()
    .slice(0, 1);
  const letters = copyOptions(question.options).map(optionLetter).filter(Boolean);
  return letters.find((letter) => letter !== correct) || "";
}

function answersByIdentity(questions, pickFn) {
  const answers = {};
  for (const question of questions) {
    const value = pickFn(question);
    if (value) answers[question.id] = value;
  }
  return answers;
}

function answersByDisplayedChoice(originalQuestions, shuffledQuestions, displayLetter) {
  const answers = {};
  for (const shuffled of shuffledQuestions) {
    const identity = identityLetterFromDisplayChoice(shuffled, displayLetter);
    if (identity) answers[shuffled.id] = identity;
  }
  return answers;
}

function expectedScoreForLetters(questions, answers) {
  return scoreObjectiveAttempt(questions, answers);
}

async function persistAttempt({
  interviewId,
  candidate,
  accessKey,
  questions,
  shuffleLayout,
  answers,
  scored,
}) {
  const session = await prisma.candidateSession.create({
    data: {
      interviewId,
      candidateName: candidate.fullName,
      candidateEmail: candidate.email,
      accessKey,
      status: "COMPLETED",
      completedAt: new Date(),
      score: scored.score,
      totalQuestions: questions.length,
      answeredQuestions: scored.answeredCount,
      submissionReason: "SELF_SUBMITTED",
      shuffleLayout,
    },
  });
  for (const row of scored.questionResults) {
    await prisma.candidateAnswer.create({
      data: {
        sessionId: session.id,
        questionId: row.questionId,
        answer: row.userAnswer,
        isCorrect: row.isCorrect,
      },
    });
  }
  return session;
}

async function main() {
  const failures = [];
  const stamp = Date.now();
  console.log("Creating sample cohort, aptitude interview, questions, and candidates...");

  const admin =
    (await prisma.user.findFirst({
      where: { isSuperadmin: true, isActive: true },
    })) ||
    (await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
    }));
  if (!admin) {
    throw new Error("No admin user found. Create an admin first.");
  }

  const orgName = admin.organisation || "MUBS EIIC";
  const now = new Date();
  const close = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const interview = await prisma.interview.create({
    data: {
      description: `Shuffle scoring aptitude test ${stamp}`,
      createdBy: admin.id,
      durationMinutes: 20,
      totalQuestions: 4,
      isActive: true,
      isHidden: false,
      type: "APTITUDE",
      instructions: "<p>Sample aptitude interview for shuffle scoring tests.</p>",
    },
  });

  const questionDefs = [
    {
      questionText: "What is the capital of France?",
      questionType: "MULTIPLE_CHOICE",
      options: [
        { letter: "A", text: "Paris" },
        { letter: "B", text: "London" },
        { letter: "C", text: "Berlin" },
        { letter: "D", text: "Madrid" },
      ],
      correctAnswer: "A",
      points: 2,
      orderIndex: 1,
    },
    {
      questionText: "What is 2 + 2?",
      questionType: "MULTIPLE_CHOICE",
      options: [
        { letter: "A", text: "3" },
        { letter: "B", text: "4" },
        { letter: "C", text: "5" },
        { letter: "D", text: "22" },
      ],
      correctAnswer: "B",
      points: 3,
      orderIndex: 2,
    },
    {
      questionText: "The Earth is roughly spherical.",
      questionType: "TRUE_FALSE",
      options: [
        { letter: "A", text: "True" },
        { letter: "B", text: "False" },
      ],
      correctAnswer: "A",
      points: 1,
      orderIndex: 3,
    },
    {
      questionText: "Which color is the clear daytime sky typically?",
      questionType: "MULTIPLE_CHOICE",
      options: [
        { letter: "A", text: "Green" },
        { letter: "B", text: "Red" },
        { letter: "C", text: "Blue" },
        { letter: "D", text: "Yellow" },
      ],
      correctAnswer: "C",
      points: 4,
      orderIndex: 4,
    },
  ];

  const questions = [];
  for (const def of questionDefs) {
    const created = await prisma.question.create({
      data: { ...def, interviewId: interview.id },
    });
    questions.push(created);
  }
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  assert(totalPoints === 10, `Expected 10 total points, got ${totalPoints}`);

  const cohort = await prisma.cohort.create({
    data: {
      name: `Shuffle Scoring Sample ${stamp}`,
      description: "<p>Automated sample cohort for aptitude shuffle scoring.</p>",
      instructions:
        "<ol><li>Read every question.</li><li>Select one option.</li><li>Submit when done.</li></ol>",
      organisation: orgName,
      openTime: now,
      closeTime: close,
      createdBy: admin.id,
      isActive: true,
      isPublished: true,
      resultsPublished: true,
    },
  });

  await prisma.cohortInterview.create({
    data: {
      cohortId: cohort.id,
      interviewId: interview.id,
      interviewType: "APTITUDE",
    },
  });

  const candidatePlans = [
    {
      key: "all-correct",
      fullName: "Alice Allcorrect",
      email: `alice.allcorrect.${stamp}@test.mubs.ac.ug`,
      pick: (q) => String(q.correctAnswer).trim().toUpperCase(),
      expectedScore: 10,
      expectedCorrect: 4,
      expectedAnswered: 4,
    },
    {
      key: "all-wrong",
      fullName: "Bob Allwrong",
      email: `bob.allwrong.${stamp}@test.mubs.ac.ug`,
      pick: (q) => firstWrongLetter(q),
      expectedScore: 0,
      expectedCorrect: 0,
      expectedAnswered: 4,
    },
    {
      key: "mixed-first-half",
      fullName: "Carol Mixedfirst",
      email: `carol.mixedfirst.${stamp}@test.mubs.ac.ug`,
      pick: (q) =>
        q.orderIndex <= 2
          ? String(q.correctAnswer).trim().toUpperCase()
          : firstWrongLetter(q),
      expectedScore: 5,
      expectedCorrect: 2,
      expectedAnswered: 4,
    },
    {
      key: "mixed-second-half",
      fullName: "Dan Mixedsecond",
      email: `dan.mixedsecond.${stamp}@test.mubs.ac.ug`,
      pick: (q) =>
        q.orderIndex >= 3
          ? String(q.correctAnswer).trim().toUpperCase()
          : firstWrongLetter(q),
      expectedScore: 5,
      expectedCorrect: 2,
      expectedAnswered: 4,
    },
    {
      key: "mixed-q1-q4",
      fullName: "Elena Mixedends",
      email: `elena.mixedends.${stamp}@test.mubs.ac.ug`,
      pick: (q) =>
        q.orderIndex === 1 || q.orderIndex === 4
          ? String(q.correctAnswer).trim().toUpperCase()
          : firstWrongLetter(q),
      expectedScore: 6,
      expectedCorrect: 2,
      expectedAnswered: 4,
    },
    {
      key: "unanswered-all",
      fullName: "Frank Unanswered",
      email: `frank.unanswered.${stamp}@test.mubs.ac.ug`,
      pick: () => "",
      expectedScore: 0,
      expectedCorrect: 0,
      expectedAnswered: 0,
    },
    {
      key: "partial-skip",
      fullName: "Grace Partialskip",
      email: `grace.partialskip.${stamp}@test.mubs.ac.ug`,
      pick: (q) =>
        q.orderIndex === 2 || q.orderIndex === 3
          ? ""
          : String(q.correctAnswer).trim().toUpperCase(),
      expectedScore: 6,
      expectedCorrect: 2,
      expectedAnswered: 2,
    },
  ];

  const createdCandidates = [];
  for (const plan of candidatePlans) {
    const candidate = await prisma.candidate.create({
      data: {
        fullName: plan.fullName,
        email: plan.email,
        isActive: true,
      },
    });
    const accessKey = await uniqueAccessKey();
    await prisma.cohortEnrollment.create({
      data: {
        cohortId: cohort.id,
        candidateId: candidate.id,
        accessKey,
        status: "ENROLLED",
      },
    });
    createdCandidates.push({ ...plan, candidate, accessKey });
  }

  // Extra candidate: always pick the option shown as display A after shuffle.
  const displayACandidate = await prisma.candidate.create({
    data: {
      fullName: "Hugo DisplayA",
      email: `hugo.displaya.${stamp}@test.mubs.ac.ug`,
      isActive: true,
    },
  });
  const displayAKey = await uniqueAccessKey();
  await prisma.cohortEnrollment.create({
    data: {
      cohortId: cohort.id,
      candidateId: displayACandidate.id,
      accessKey: displayAKey,
      status: "ENROLLED",
    },
  });

  console.log(`Cohort: ${cohort.name}`);
  console.log(`Interview: ${interview.description}`);
  console.log(`Questions: ${questions.length}  Total points: ${totalPoints}`);
  console.log("");

  const results = [];

  for (const row of createdCandidates) {
    const layout = createAttemptShuffle(questions);
    const shuffled = applyAttemptShuffle(questions, layout);
    const shuffledAgain = applyAttemptShuffle(questions, layout);
    try {
      assert(
        shuffled.map((q) => q.id).join(",") ===
          shuffledAgain.map((q) => q.id).join(","),
        `${row.key}: shuffle layout was not stable on resume`
      );
      for (let i = 0; i < shuffled.length; i += 1) {
        const a = shuffled[i].options.map(optionLetter).join("");
        const b = shuffledAgain[i].options.map(optionLetter).join("");
        assert(a === b, `${row.key}: option order changed on resume for ${shuffled[i].id}`);
      }
      const originalLetters = new Set(questions.map((q) => q.id));
      assert(
        shuffled.length === questions.length,
        `${row.key}: shuffled question count mismatch`
      );
      assert(
        shuffled.every((q) => originalLetters.has(q.id)),
        `${row.key}: shuffle invented unknown question ids`
      );
      for (const q of shuffled) {
        const original = questions.find((item) => item.id === q.id);
        const origLetters = copyOptions(original.options).map(optionLetter).sort().join("");
        const shuffledLetters = copyOptions(q.options).map(optionLetter).sort().join("");
        assert(
          origLetters === shuffledLetters,
          `${row.key}: option identities lost after shuffle`,
          { origLetters, shuffledLetters, questionId: q.id }
        );
      }
    } catch (error) {
      failures.push(error.message);
      console.error(`FAIL ${row.key}: ${error.message}`);
      continue;
    }

    const answers = answersByIdentity(questions, row.pick);
    const scored = expectedScoreForLetters(questions, answers);
    const session = await persistAttempt({
      interviewId: interview.id,
      candidate: row.candidate,
      accessKey: row.accessKey,
      questions,
      shuffleLayout: layout,
      answers,
      scored,
    });

    const stored = await prisma.candidateSession.findUnique({
      where: { id: session.id },
      include: { candidateAnswers: true },
    });

    try {
      assert(
        scored.score === row.expectedScore,
        `${row.key}: expected score ${row.expectedScore}, got ${scored.score}`,
        scored
      );
      assert(
        scored.correctAnswers === row.expectedCorrect,
        `${row.key}: expected ${row.expectedCorrect} correct, got ${scored.correctAnswers}`
      );
      assert(
        scored.answeredCount === row.expectedAnswered,
        `${row.key}: expected ${row.expectedAnswered} answered, got ${scored.answeredCount}`
      );
      assert(stored.score === scored.score, `${row.key}: stored session score mismatch`);
      assert(
        stored.answeredQuestions === scored.answeredCount,
        `${row.key}: stored answeredQuestions mismatch`
      );
      assert(
        stored.candidateAnswers.length === questions.length,
        `${row.key}: expected one stored answer row per question`
      );
      for (const q of questions) {
        const answerRow = stored.candidateAnswers.find((a) => a.questionId === q.id);
        const resultRow = scored.questionResults.find((r) => r.questionId === q.id);
        assert(answerRow, `${row.key}: missing stored answer for ${q.id}`);
        assert(
          String(answerRow.answer || "") === resultRow.userAnswer,
          `${row.key}: stored letter ${answerRow.answer} != scored ${resultRow.userAnswer} for ${q.id}`
        );
        assert(
          Boolean(answerRow.isCorrect) === Boolean(resultRow.isCorrect),
          `${row.key}: stored isCorrect mismatch for ${q.id}`
        );
        if (resultRow.userAnswer) {
          assert(
            resultRow.userAnswer === String(q.correctAnswer).toUpperCase().slice(0, 1)
              ? resultRow.isCorrect
              : true,
            `${row.key}: correctness vs canonical letter failed for ${q.id}`
          );
          const canonical = String(q.correctAnswer).trim().toUpperCase().slice(0, 1);
          assert(
            resultRow.isCorrect === (resultRow.userAnswer === canonical),
            `${row.key}: identity scoring failed for ${q.id} (answered ${resultRow.userAnswer}, correct ${canonical})`
          );
        } else {
          assert(!resultRow.isCorrect, `${row.key}: unanswered marked correct for ${q.id}`);
          assert(resultRow.unanswered, `${row.key}: unanswered flag missing for ${q.id}`);
        }
      }
      const unansweredCount = scored.questionResults.filter((r) => r.unanswered).length;
      assert(
        unansweredCount === questions.length - scored.answeredCount,
        `${row.key}: unanswered count mismatch`
      );
      console.log(
        `PASS ${row.key.padEnd(20)} ${row.fullName.padEnd(22)} score ${String(scored.score).padStart(2)}/${totalPoints}  correct ${scored.correctAnswers}/${questions.length}  answered ${scored.answeredCount}  key ${row.accessKey}`
      );
      results.push({ key: row.key, ok: true, score: scored.score });
    } catch (error) {
      failures.push(error.message);
      console.error(`FAIL ${row.key}: ${error.message}`);
      results.push({ key: row.key, ok: false });
    }
  }

  {
    const layout = createAttemptShuffle(questions);
    const shuffled = applyAttemptShuffle(questions, layout);
    const answers = answersByDisplayedChoice(questions, shuffled, "A");
    const scored = expectedScoreForLetters(questions, answers);
    let expected = 0;
    let expectedCorrect = 0;
    for (const q of shuffled) {
      const identity = identityLetterFromDisplayChoice(q, "A");
      const canonical = String(q.correctAnswer).trim().toUpperCase().slice(0, 1);
      if (identity === canonical) {
        expected += q.points;
        expectedCorrect += 1;
      }
    }
    try {
      assert(
        scored.score === expected,
        `display-A: expected ${expected} from shuffled first options, got ${scored.score}`
      );
      assert(
        scored.correctAnswers === expectedCorrect,
        `display-A: expected ${expectedCorrect} correct, got ${scored.correctAnswers}`
      );
      const session = await persistAttempt({
        interviewId: interview.id,
        candidate: displayACandidate,
        accessKey: displayAKey,
        questions,
        shuffleLayout: layout,
        answers,
        scored,
      });
      const stored = await prisma.candidateSession.findUnique({
        where: { id: session.id },
        include: { candidateAnswers: true },
      });
      assert(stored.score === expected, "display-A stored score mismatch");
      for (const q of shuffled) {
        const storedAnswer = stored.candidateAnswers.find((a) => a.questionId === q.id);
        const identity = identityLetterFromDisplayChoice(q, "A");
        assert(
          storedAnswer.answer === identity,
          `display-A stored ${storedAnswer.answer} but first displayed option identity is ${identity}`
        );
      }
      console.log(
        `PASS ${"display-A".padEnd(20)} ${displayACandidate.fullName.padEnd(22)} score ${String(scored.score).padStart(2)}/${totalPoints}  correct ${scored.correctAnswers}/${questions.length}  (first displayed option only)  key ${displayAKey}`
      );
    } catch (error) {
      failures.push(error.message);
      console.error(`FAIL display-A: ${error.message}`);
    }
  }

  console.log("");
  console.log("Running 40 randomised shuffle trials (no extra DB rows)...");
  for (let i = 0; i < 40; i += 1) {
    const layout = createAttemptShuffle(questions);
    const shuffled = applyAttemptShuffle(questions, layout);
    const allCorrect = answersByIdentity(questions, (q) =>
      String(q.correctAnswer).trim().toUpperCase()
    );
    const allWrong = answersByIdentity(questions, (q) => firstWrongLetter(q));
    const mixed = answersByIdentity(questions, (q, idx) =>
      q.orderIndex % 2 === 1
        ? String(q.correctAnswer).trim().toUpperCase()
        : firstWrongLetter(q)
    );
    const scoredCorrect = scoreObjectiveAttempt(questions, allCorrect);
    const scoredWrong = scoreObjectiveAttempt(questions, allWrong);
    const scoredMixed = scoreObjectiveAttempt(questions, mixed);
    const displayA = answersByDisplayedChoice(questions, shuffled, "A");
    const scoredDisplay = scoreObjectiveAttempt(questions, displayA);
    try {
      assert(scoredCorrect.score === 10, `trial ${i}: all-correct was ${scoredCorrect.score}`);
      assert(scoredWrong.score === 0, `trial ${i}: all-wrong was ${scoredWrong.score}`);
      assert(scoredMixed.score === 3, `trial ${i}: mixed odd questions should be 2+1=3, got ${scoredMixed.score}`);
      let displayExpected = 0;
      for (const q of shuffled) {
        if (identityLetterFromDisplayChoice(q, "A") === String(q.correctAnswer).trim().toUpperCase()) {
          displayExpected += q.points;
        }
      }
      assert(
        scoredDisplay.score === displayExpected,
        `trial ${i}: display-A expected ${displayExpected}, got ${scoredDisplay.score}`
      );
      const buggyDisplayLetters = {};
      for (const q of shuffled) buggyDisplayLetters[q.id] = "A";
      const buggy = scoreObjectiveAttempt(questions, buggyDisplayLetters);
      const alwaysACanonical = questions
        .filter((q) => String(q.correctAnswer).trim().toUpperCase() === "A")
        .reduce((sum, q) => sum + q.points, 0);
      assert(
        buggy.score === alwaysACanonical,
        `trial ${i}: sending display letter A (not identity) should only mark canonical-A questions, expected ${alwaysACanonical} got ${buggy.score}`
      );
    } catch (error) {
      failures.push(error.message);
      console.error(`FAIL trial ${i}: ${error.message}`);
    }
  }
  if (!failures.length) {
    console.log("PASS 40 randomised shuffle trials");
  }

  console.log("");
  console.log("Sample data (open in admin results):");
  console.log(`  Cohort ID:    ${cohort.id}`);
  console.log(`  Interview ID: ${interview.id}`);
  for (const row of createdCandidates) {
    console.log(`  ${row.fullName}  ${row.accessKey}  ${row.email}`);
  }
  console.log(`  ${displayACandidate.fullName}  ${displayAKey}  ${displayACandidate.email}`);

  if (failures.length) {
    console.error("");
    console.error(`${failures.length} failure(s):`);
    for (const failure of failures) console.error(` - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("");
    console.log("All shuffle scoring scenarios passed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
