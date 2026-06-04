import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  calculateTimeRemaining,
  logTimeValidation,
} from "../../../../lib/timeValidation";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";
import { computeTypingScore } from "../../../../lib/typingScore.js";
// Scoring should be independent of shuffling: compare stable option letters.

export const runtime = "nodejs";

// POST /api/candidate/submit-attempt - Submit interview attempt
export async function POST(request) {
  try {
    const body = await request.json();

    const { attemptId, answers, finalAnswer, typingStats, timeSpent, submissionReason } = body;

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    // For typing interviews we need finalAnswer (can be empty string on time-up); for others we need answers
    if (!answers && finalAnswer === undefined) {
      return NextResponse.json(
        { success: false, error: "Answers or final answer is required" },
        { status: 400 }
      );
    }

    // Validate attemptId is a valid string (UUID)
    if (typeof attemptId !== "string" || attemptId.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Invalid attempt ID format" },
        { status: 400 }
      );
    }

    const parsedAttemptId = attemptId.trim();

    // Get the attempt
    const attempt = await prisma.candidateSession.findUnique({
      where: { id: parsedAttemptId },
      include: {
        interview: {
          include: {
            questions: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.status === "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Attempt already submitted" },
        { status: 400 }
      );
    }

    // Server-side time validation - check if time has expired
    const timeData = calculateTimeRemaining(
      attempt.startedAt,
      attempt.interview.durationMinutes
    );

    // Log for security monitoring
    logTimeValidation(parsedAttemptId, timeData, "SUBMIT_ATTEMPT");

    // When time has expired, still accept the submission so the candidate's typed
    // text so far is saved (auto-submit on timeout). We process normally and use
    // submissionReason "TIME_UP" when updating to COMPLETED.
    const isTimeUpSubmission = timeData.isExpired;

    // Processing submission

    // Calculate score
    let score = 0;
    let correctAnswers = 0;
    let answeredCount = 0; // aptitude: only questions with a selected answer
    const questionResults = [];

    // Check if this is a typing interview
    const isTypingInterview = attempt.interview.type === "TYPING";

    if (isTypingInterview && (finalAnswer !== undefined && finalAnswer !== null)) {
      // Typing score: combined accuracy + speed (benchmark: Testlify 60% accuracy, 40% speed). finalAnswer may be "" on time-up.
      const question = attempt.interview.questions[0];
      if (question) {
        const { score: typingScore, isPassing } = computeTypingScore(
          typingStats ?? {},
          question.points
        );
        score = typingScore;
        correctAnswers = isPassing ? 1 : 0; // Pass threshold for "attempt counted"

        // Store candidate answer with typing stats
        const existingAnswer = await prisma.candidateAnswer.findFirst({
          where: {
            sessionId: parsedAttemptId,
            questionId: question.id,
          },
        });

        if (existingAnswer) {
          await prisma.candidateAnswer.update({
            where: { id: existingAnswer.id },
            data: {
              answer: finalAnswer,
              isCorrect: isPassing,
              typingStats: typingStats ?? undefined,
            },
          });
        } else {
          await prisma.candidateAnswer.create({
            data: {
              sessionId: parsedAttemptId,
              questionId: question.id,
              answer: finalAnswer,
              isCorrect: isPassing,
              typingStats: typingStats ?? undefined,
            },
          });
        }

        questionResults.push({
          questionId: question.id,
          userAnswer: finalAnswer,
          correctAnswer: "N/A (Typing Test)",
          isCorrect: isPassing,
          points: question.points,
          pointsEarned: score,
          typingStats: typingStats,
        });
      }
    } else {
      // Handle regular (objective) interview scoring
      // MULTIPLE_CHOICE / TRUE_FALSE: compare by option letter (e.g. "A", "B"); support correctAnswer stored as letter or option text
      // TEXT: compare normalized (trim, case-insensitive) to reference
      const questionsOrdered = [...attempt.interview.questions].sort(
        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      );

      for (let i = 0; i < questionsOrdered.length; i++) {
        const question = questionsOrdered[i];
        const rawUserAnswer =
          answers[question.id] ?? answers[i] ?? answers[String(i)];
        const rawCorrect = question.correctAnswer;

        // Client sends stable option.letter (e.g. "A","B","C","D").
        const userAnswer =
          rawUserAnswer != null
            ? String(rawUserAnswer).trim().toUpperCase().slice(0, 1)
            : "";

        if (userAnswer !== "") answeredCount++;

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
            // Resolve correct answer to option letter (DB may store letter or option text)
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

        if (isCorrect) {
          score += question.points;
          correctAnswers++;
        }

        // Store candidate answer (update if exists, create if not)
        const existingAnswer = await prisma.candidateAnswer.findFirst({
          where: {
            sessionId: parsedAttemptId,
            questionId: question.id,
          },
        });

        if (existingAnswer) {
          // Update existing answer
          await prisma.candidateAnswer.update({
            where: { id: existingAnswer.id },
            data: {
              answer: userAnswer,
              isCorrect: isCorrect,
            },
          });
        } else {
          // Create new answer
          await prisma.candidateAnswer.create({
            data: {
              sessionId: parsedAttemptId,
              questionId: question.id,
              answer: userAnswer,
              isCorrect: isCorrect,
            },
          });
        }

        questionResults.push({
          questionId: question.id,
          userAnswer: userAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect: isCorrect,
          points: question.points,
          pointsEarned: isCorrect ? question.points : 0,
        });
      }
    }

    // Normalize and store submission reason (client-sent or default; use TIME_UP when time had already expired)
    const reason = isTimeUpSubmission ? "TIME_UP" : (submissionReason && String(submissionReason).trim() ? String(submissionReason).trim().toUpperCase() : "SELF_SUBMITTED");

    // Update attempt (answeredQuestions = only questions the candidate actually selected/ticked an answer for)
    const updatedAttempt = await prisma.candidateSession.update({
      where: { id: parsedAttemptId },
      data: {
        status: "COMPLETED",
        completedAt: isTimeUpSubmission ? timeData.serverNow : new Date(),
        score: score,
        answeredQuestions: isTypingInterview
          ? finalAnswer
            ? 1
            : 0
          : answeredCount,
        submissionReason: reason,
      },
    });

    // Attempt submitted successfully
    await createLog({
      actorType: "CANDIDATE",
      actorName: attempt.candidateName,
      actorEmail: attempt.candidateEmail ?? null,
      actorRole: "CANDIDATE",
      actionType: ACTION_TYPES.CANDIDATE_INTERVIEW_SUBMITTED,
      resource: "interview",
      description: `Candidate "${attempt.candidateName}" submitted ${attempt.interview.type} interview. Reason: ${reason}. Score: ${score}/${attempt.interview.questions.length}`,
      targetInterviewId: attempt.interviewId,
      targetInterviewType: attempt.interview?.type ?? null,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      attempt: updatedAttempt,
      score: score,
      totalQuestions: attempt.interview.questions.length,
      correctAnswers: correctAnswers,
      message: "Interview submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting attempt:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to submit interview attempt",
      },
      { status: 500 }
    );
  }
}
