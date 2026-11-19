"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Calendar,
  FileText,
  Play,
  AlertCircle,
  Timer,
  Phone,
  Mail,
  Key,
  LogOut,
  Loader2,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { useMessages, MessageDisplay } from "./MessageSystem";
import { format } from "date-fns";
import { htmlToPlainText } from "../lib/sanitize";
import RichTextDisplay from "./RichTextDisplay";
import InstructionListDisplay from "./InstructionListDisplay";
import QuestionOptionsPanel from "./QuestionOptionsPanel";
import { useExpandableIds } from "../hooks/useExpandableIds";
import { getSubmissionReasonLabel } from "../lib/submissionReasons";
import { useServerTime } from "../hooks/useServerTime";
import { useCandidateIdleLogout } from "../hooks/useCandidateIdleLogout";

export default function CandidateWelcome() {
  const { serverNow } = useServerTime();
  useCandidateIdleLogout();
  const [candidate, setCandidate] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isCohortOpen, setIsCohortOpen] = useState(false);
  const [sessionValid, setSessionValid] = useState(true);
  const [interviewAttempts, setInterviewAttempts] = useState({});
  const [resultsPublished, setResultsPublished] = useState(false);
  const [resultsShowAttempt, setResultsShowAttempt] = useState(false);
  const [resultsShowCorrect, setResultsShowCorrect] = useState(false);
  const [attemptResults, setAttemptResults] = useState([]);
  const [attemptResultsLoading, setAttemptResultsLoading] = useState(false);
  const [isCheckingAttempts, setIsCheckingAttempts] = useState(false);
  const [startingInterviewId, setStartingInterviewId] = useState(null);
  const router = useRouter();
  const { showError } = useMessages();
  const checkingAttemptsRef = useRef(false);
  const lastCheckTimeRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const attemptQuestionIds = (attemptResults || []).flatMap((attempt) =>
    (attempt.questions || []).map((q) => `${attempt.sessionId}-${q.questionId}`)
  );
  const attemptOptionsExpand = useExpandableIds(attemptQuestionIds);

  useEffect(() => {
    // Check if candidate data exists in session
    const candidateData = sessionStorage.getItem("candidate_data");
    if (!candidateData) {
      router.push("/candidate");
      return;
    }

    try {
      const parsedCandidate = JSON.parse(candidateData);
      setCandidate(parsedCandidate);

      // Get the first active enrollment's cohort
      if (
        parsedCandidate.enrollments &&
        parsedCandidate.enrollments.length > 0
      ) {
        const nextCohort = parsedCandidate.enrollments[0].cohort;
        setCohort(nextCohort);
        setResultsPublished(nextCohort?.resultsPublished === true);
        setResultsShowAttempt(nextCohort?.resultsShowAttempt === true);
        setResultsShowCorrect(nextCohort?.resultsShowCorrect === true);
      }

      // Session is already verified when accessing the page
      // No need to verify again to prevent multiple toasts
    } catch (error) {
      console.error("Error parsing candidate data:", error);
      showError("Invalid session data. Please try again.");
      router.push("/candidate");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const verifySession = useCallback(
    async (candidateData) => {
      try {
        const response = await fetch("/api/candidate/verify-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidateId: candidateData.id,
            accessKey: candidateData.accessKey,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setSessionValid(false);
          // Clear session data immediately
          sessionStorage.removeItem("candidate_data");
          sessionStorage.removeItem("current_interview");
          // Redirect after a short delay to show the session expired message
          setTimeout(() => {
            router.push("/candidate");
          }, 2000);
          return;
        }
      } catch (error) {
        console.error("Error verifying session:", error);
        setSessionValid(false);
        // Clear session data immediately
        sessionStorage.removeItem("candidate_data");
        sessionStorage.removeItem("current_interview");
        // Redirect after a short delay
        setTimeout(() => {
          router.push("/candidate");
        }, 2000);
      }
    },
    [router]
  );

  useEffect(() => {
    if (!cohort || !serverNow) return;

    const openTime = new Date(cohort.openTime);
    const closeTime = new Date(cohort.closeTime);

    if (serverNow < openTime) {
      const diff = openTime.getTime() - serverNow.getTime();
      setTimeRemaining(diff);
      setIsCohortOpen(false);
    } else if (serverNow >= openTime && serverNow <= closeTime) {
      setIsCohortOpen(true);
      setTimeRemaining(null);
    } else {
      setIsCohortOpen(false);
      setTimeRemaining(null);
    }
  }, [cohort, serverNow]);

  const formatTimeRemaining = (milliseconds) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleLogout = useCallback(async () => {
    try {
      // Call logout API
      await fetch("/api/candidate/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId: candidate.id,
          accessKey: candidate.accessKey,
        }),
      });
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      // Clear session data
      sessionStorage.removeItem("candidate_data");
      sessionStorage.removeItem("current_interview");
      router.push("/candidate");
    }
  }, [candidate, router]);

  const handleStartInterview = useCallback(
    async (interview) => {
      // Handle start interview

      if (!serverNow) {
        showError("Please wait a moment for the system to sync.");
        return;
      }
      if (!isCohortOpen) {
        showError("The cohort is not yet open or has closed");
        return;
      }
      const closeTime = new Date(cohort.closeTime);
      if (serverNow > closeTime) {
        showError("The interview period has ended");
        return;
      }

      // Check if this interview is already completed
      const attemptStatus = interviewAttempts?.[interview.id]?.status;
      if (attemptStatus === "COMPLETED") {
        showError("You have already completed this interview");
        return;
      }

      // Set loading state for this specific interview
      setStartingInterviewId(interview.id);

      // Proceeding to start interview

      // First, create the attempt via API
      try {
        const startResponse = await fetch("/api/candidate/start-attempt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidateId: candidate.id,
            interviewId: interview.id,
            accessKey: candidate.accessKey,
          }),
        });

        const result = await startResponse.json();

        if (startResponse.ok) {
          // Store interview data and navigate to attempt page
          sessionStorage.setItem(
            "current_interview",
            JSON.stringify(interview)
          );
          router.push(`/candidate/attempt/${interview.id}`);
        } else {
          showError(result.error || "Failed to start interview");
        }
      } catch (error) {
        console.error("Error starting interview:", error);
        showError("Failed to start interview");
      } finally {
        // Clear loading state
        setStartingInterviewId(null);
      }
    },
    [isCohortOpen, cohort, showError, router, interviewAttempts, candidate, serverNow]
  );

  const getInterviewStatus = useCallback(
    (interview, allInterviews) => {
      if (!serverNow) return "waiting";
      const closeTime = new Date(cohort.closeTime);
      if (serverNow > closeTime) {
        return "closed";
      }

      if (!isCohortOpen) {
        return "waiting";
      }

      // Check if aptitude interview exists and is not completed
      const aptitudeInterview = allInterviews.find(
        (ci) => ci.interview.type === "APTITUDE"
      );
      const aptitudeAttempt = aptitudeInterview
        ? interviewAttempts?.[aptitudeInterview.interview.id]
        : null;

      // If this is not the aptitude interview and aptitude exists but is not completed
      if (
        interview.type !== "APTITUDE" &&
        aptitudeInterview &&
        aptitudeAttempt?.status !== "COMPLETED"
      ) {
        return "locked";
      }

      return "available";
    },
    [cohort, isCohortOpen, interviewAttempts, serverNow]
  );

  const checkInterviewAttempts = useCallback(async () => {
    if (checkingAttemptsRef.current) return {};
    if (!candidate || !cohort?.interviews) return {};

    // Debounce: only allow one request per 5 seconds
    const now = Date.now();
    if (now - lastCheckTimeRef.current < 5000) {
      return {};
    }
    lastCheckTimeRef.current = now;

    try {
      checkingAttemptsRef.current = true;
      // Check which interviews have been attempted
      const interviewIds = cohort.interviews.map((ci) => ci.interview.id);

      // Check interview attempts
      const attempts = await fetch("/api/candidate/check-attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId: candidate.id,
          accessKey: candidate.accessKey,
          interviewIds: interviewIds,
        }),
      });

      if (attempts.ok) {
        const result = await attempts.json();
        return {
          attempts: result.attempts || {},
          resultsPublished: result.resultsPublished === true,
          resultsShowAttempt: result.resultsShowAttempt === true,
          resultsShowCorrect: result.resultsShowCorrect === true,
        };
      }
    } catch (error) {
      console.error("Error checking interview attempts:", error);
    } finally {
      checkingAttemptsRef.current = false;
    }

    return {
      attempts: {},
      resultsPublished: false,
      resultsShowAttempt: false,
      resultsShowCorrect: false,
    };
  }, [candidate, cohort]);

  // Check interview attempts when component loads
  useEffect(() => {
    if (candidate && cohort?.interviews && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setIsCheckingAttempts(true);
      checkInterviewAttempts().then(
        ({
          attempts,
          resultsPublished: rp,
          resultsShowAttempt: ra,
          resultsShowCorrect: rc,
        }) => {
          setInterviewAttempts(attempts ?? {});
          setResultsPublished(rp);
          setResultsShowAttempt(ra);
          setResultsShowCorrect(rc);
          setIsCheckingAttempts(false);
        }
      );
    }
  }, [candidate, cohort, checkInterviewAttempts]);

  // Fetch detailed attempt results when results are published and all completed
  useEffect(() => {
    if (!candidate || !cohort?.interviews || !resultsPublished || !resultsShowAttempt) return;
    const allCompleted = cohort.interviews.every(
      (ci) => interviewAttempts?.[ci.interview?.id]?.status === "COMPLETED"
    );
    if (!allCompleted) return;

    let cancelled = false;
    setAttemptResultsLoading(true);
    fetch("/api/candidate/attempt-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId: candidate.id,
        accessKey: candidate.accessKey,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success && Array.isArray(data.attempts)) {
          setAttemptResults(data.attempts);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAttemptResultsLoading(false);
      });
    return () => { cancelled = true; };
  }, [candidate, cohort?.interviews, resultsPublished, resultsShowAttempt, interviewAttempts]);

  // Refresh attempts when user returns to the page (after completing an interview)
  useEffect(() => {
    const applyAttemptCheck = ({
      attempts,
      resultsPublished: rp,
      resultsShowAttempt: ra,
      resultsShowCorrect: rc,
    }) => {
      setInterviewAttempts(attempts ?? {});
      setResultsPublished(rp);
      setResultsShowAttempt(ra);
      setResultsShowCorrect(rc);
    };

    const handleFocus = () => {
      if (candidate && cohort?.interviews && hasInitializedRef.current) {
        checkInterviewAttempts().then(applyAttemptCheck);
      }
    };

    const handleVisibilityChange = () => {
      if (
        !document.hidden &&
        candidate &&
        cohort?.interviews &&
        hasInitializedRef.current
      ) {
        checkInterviewAttempts().then(applyAttemptCheck);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [candidate, cohort, checkInterviewAttempts]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your interview details...</p>
        </div>
      </div>
    );
  }

  if (!candidate || !cohort) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Error
          </h2>
          <p className="text-gray-600 mb-4">
            Unable to load your interview details.
          </p>
          <button
            onClick={() => router.push("/candidate")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Session Expired
          </h2>
          <p className="text-gray-600 mb-4">
            Your session has expired. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_summary]:cursor-pointer">
      <MessageDisplay />

      <div className="flex-1 min-h-0 overflow-auto max-w-6xl mx-auto w-full px-4 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {candidate.name}
            </h1>
            <p className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {candidate.email}
              </span>
              {candidate.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {candidate.phone}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 font-mono">
                <Key className="w-3 h-3" />
                {candidate.accessKey}
              </span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{cohort.name}</p>
              <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(cohort.openTime), "PPp")} –{" "}
                {format(new Date(cohort.closeTime), "PPp")}
              </p>
            </div>
            {timeRemaining !== null && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-1.5 text-sm">
                <Timer className="w-4 h-4 text-blue-600" />
                <span className="text-blue-800">
                  {isCohortOpen ? "Time left" : "Starts in"}
                </span>
                <span className="font-mono font-semibold text-blue-900">
                  {formatTimeRemaining(timeRemaining)}
                </span>
              </div>
            )}
          </div>
          {cohort.description ? (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-blue-700 hover:text-blue-900">
                Cohort description
              </summary>
              <div className="mt-2 text-gray-600">
                <RichTextDisplay html={cohort.description} />
              </div>
            </details>
          ) : null}
        </div>

        <InstructionListDisplay html={cohort.instructions} />

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">
              Available interviews
            </h2>
          </div>

          {cohort.interviews && cohort.interviews.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2">Interview</th>
                    <th className="px-4 py-2">Duration</th>
                    <th className="px-4 py-2 hidden sm:table-cell">Questions</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cohort.interviews.map((cohortInterview) => {
                    const interview = cohortInterview.interview;
                    const baseStatus = getInterviewStatus(
                      interview,
                      cohort.interviews
                    );
                    const attemptStatus = interviewAttempts?.[interview.id]?.status;

                    let status;
                    if (attemptStatus === "COMPLETED") {
                      status = "attempted";
                    } else if (attemptStatus === "IN_PROGRESS") {
                      status = "in_progress";
                    } else {
                      status = baseStatus;
                    }

                    const statusLabel =
                      status === "available"
                        ? "Ready to start"
                        : status === "attempted"
                          ? "Submitted"
                          : status === "in_progress"
                            ? "In progress"
                            : status === "waiting"
                              ? "Waiting to open"
                              : status === "locked"
                                ? "Complete aptitude first"
                                : "Closed";

                    return (
                      <tr key={interview.id} className="align-top">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">
                            {interview.type} Assessment
                          </p>
                          {interview.instructions ? (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-blue-700">
                                Instructions
                              </summary>
                              <RichTextDisplay
                                html={interview.instructions}
                                className="text-xs text-gray-600 mt-1"
                              />
                            </details>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                          {interview.durationMinutes} min
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">
                          {interview.totalQuestions}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              status === "available"
                                ? "text-green-700"
                                : status === "attempted"
                                  ? "text-blue-700"
                                  : status === "in_progress"
                                    ? "text-orange-700"
                                    : status === "waiting"
                                      ? "text-amber-700"
                                      : "text-gray-600"
                            }`}
                          >
                            {statusLabel}
                          </span>
                          {status === "attempted" &&
                            interviewAttempts?.[interview.id]?.submissionReason && (
                              <p className="text-xs text-gray-500">
                                {getSubmissionReasonLabel(
                                  interviewAttempts?.[interview.id].submissionReason
                                )}
                              </p>
                            )}
                          {status === "attempted" &&
                            resultsPublished &&
                            interviewAttempts?.[interview.id]?.score != null && (
                              <p className="text-xs font-semibold text-blue-700">
                                Score: {interviewAttempts?.[interview.id].score}
                                {interview.totalQuestions > 0
                                  ? `/${interview.totalQuestions}`
                                  : ""}
                              </p>
                            )}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {status === "available" ? (
                            <button
                              onClick={() => handleStartInterview(interview)}
                              disabled={startingInterviewId === interview.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              {startingInterviewId === interview.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                              {startingInterviewId === interview.id
                                ? "Starting..."
                                : "Start"}
                            </button>
                          ) : status === "in_progress" ? (
                            <button
                              onClick={() => handleStartInterview(interview)}
                              disabled={startingInterviewId === interview.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
                            >
                              {startingInterviewId === interview.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                              {startingInterviewId === interview.id
                                ? "Resuming..."
                                : "Continue"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500">
                              {status === "attempted"
                                ? "Submitted"
                                : status === "waiting"
                                  ? "Waiting"
                                  : status === "locked"
                                    ? "Locked"
                                    : "Closed"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">
                There are no interviews assigned to this cohort yet.
              </p>
            </div>
          )}

          {/* Completion Message */}
          {cohort.interviews &&
            cohort.interviews.length > 0 &&
            Object.keys(interviewAttempts).length > 0 &&
            cohort.interviews.every(
              (ci) => interviewAttempts?.[ci.interview?.id]?.status === "COMPLETED"
            ) && (
              <div className="m-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <h3 className="text-sm font-semibold text-green-900 mb-1">
                    All interviews completed
                  </h3>
                  <p className="text-green-800 text-sm mb-2">
                    You have finished every interview in this cohort.
                  </p>
                  {resultsPublished ? (
                    <>
                      <div className="mb-2 text-left">
                        <h4 className="text-sm font-semibold text-green-900 mb-2">Your results</h4>
                        <ul className="space-y-1 text-sm text-green-800">
                          {cohort.interviews.map((ci) => {
                            const att = interviewAttempts?.[ci.interview?.id];
                            return (
                              <li key={ci.interview.id} className="flex justify-between">
                                <span>{ci.interview.type}</span>
                                <span className="font-medium">
                                  {att?.score != null ? `${att.score}/${ci.interview.totalQuestions || "—"}` : "—"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <p className="text-green-700 text-sm">
                        You can logout. You will also receive communication from the
                        MUBS EIIC team regarding your results.
                      </p>
                    </>
                  ) : (
                    <p className="text-green-700 text-sm">
                      You can now logout. You will receive communication from the
                      MUBS EIIC team regarding your results.
                    </p>
                  )}
                </div>
              </div>
            )}

          {/* Detailed result cards per interview (when attempt details are published) */}
          {resultsPublished && resultsShowAttempt &&
            cohort.interviews &&
            cohort.interviews.length > 0 &&
            cohort.interviews.every(
              (ci) => interviewAttempts?.[ci.interview?.id]?.status === "COMPLETED"
            ) && (
              <div className="mt-6 space-y-6">
                {attemptResultsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Loading your attempt details...</span>
                  </div>
                ) : (
                  attemptResults.map((attempt) => {
                    const isTyping = attempt.interviewType === "TYPING";
                    const ts = attempt.typingStats || (attempt.questions.find((q) => q.typingStats)?.typingStats);
                    return (
                    <div
                      key={attempt.sessionId}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="border-b border-gray-100 pb-3 mb-3">
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          {attempt.interviewType} — Attempt details
                        </h3>
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span><Clock className="w-3 h-3 inline mr-1" />Started: {format(new Date(attempt.startedAt), "PPp")}</span>
                          <span><Clock className="w-3 h-3 inline mr-1" />Ended: {attempt.completedAt ? format(new Date(attempt.completedAt), "PPp") : "—"}</span>
                          {attempt.durationSeconds != null && (
                            <span><Timer className="w-3 h-3 inline mr-1" />Duration: {Math.floor(attempt.durationSeconds / 60)}m {attempt.durationSeconds % 60}s</span>
                          )}
                          {isTyping && ts ? (
                            <>
                              <span>Score: {attempt.score ?? "—"}</span>
                              <span>WPM: {ts.netWordsPerMinute ?? ts.wordsPerMinute ?? "—"}</span>
                              <span>Accuracy: {ts.accuracy != null ? `${ts.accuracy}%` : "—"}</span>
                              {ts.wordsTyped != null && <span>Words: {ts.wordsTyped}</span>}
                              {ts.charactersTyped != null && <span>Characters: {ts.charactersTyped}</span>}
                            </>
                          ) : (
                            <span>
                              Total marks: {attempt.score}/{attempt.totalPoints || attempt.totalQuestions}
                            </span>
                          )}
                        </div>
                        {attempt.submissionReason && (
                          <p className="mt-1.5 text-xs text-amber-800 bg-amber-50 rounded px-2 py-0.5 inline-block">
                            Submission: {getSubmissionReasonLabel(attempt.submissionReason)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-gray-700">Questions and your answers</h4>
                        <button
                          type="button"
                          onClick={attemptOptionsExpand.toggleAll}
                          className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 cursor-pointer"
                        >
                          {attemptOptionsExpand.allExpanded ? (
                            <ChevronsDownUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                          )}
                          {attemptOptionsExpand.allExpanded ? "Collapse all options" : "Expand all options"}
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto rounded border border-gray-200 overflow-hidden">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-700 w-12">QN</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Question</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Answer</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attempt.questions
                              .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                              .map((q, idx) => {
                                const qKey = `${attempt.sessionId}-${q.questionId}`;
                                return (
                                <tr key={q.questionId} className="border-b border-gray-100 hover:bg-gray-50/50">
                                  <td className="py-2 px-3 text-gray-600 font-medium align-top">{idx + 1}</td>
                                  <td className="py-2 px-3 text-gray-800 align-top">
                                    <RichTextDisplay html={q.questionText || ""} />
                                    <QuestionOptionsPanel
                                      options={q.options}
                                      candidateAnswer={q.unanswered ? "" : q.yourAnswer}
                                      correctAnswer={q.correctAnswer}
                                      showCorrect={resultsShowCorrect}
                                      expanded={attemptOptionsExpand.isExpanded(qKey)}
                                      onToggle={() => attemptOptionsExpand.toggle(qKey)}
                                    />
                                  </td>
                                  <td className="py-2 px-3 text-gray-700 align-top">
                                    {q.unanswered ? (
                                      <span className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                        Not answered
                                      </span>
                                    ) : q.questionType === "TYPING" && q.typingStats ? (
                                      <div>
                                        <p className="whitespace-pre-wrap break-words">{q.yourAnswer || "(no text)"}</p>
                                        <p className="text-gray-500 mt-1">
                                          WPM {q.typingStats?.netWordsPerMinute ?? q.typingStats?.wordsPerMinute ?? "—"} · Accuracy {q.typingStats?.accuracy != null ? `${q.typingStats.accuracy}%` : "—"}
                                          {q.typingStats?.wordsTyped != null ? ` · Words ${q.typingStats.wordsTyped}` : ""}
                                        </p>
                                      </div>
                                    ) : (
                                      <span className="whitespace-pre-wrap break-words">
                                        {q.yourAnswerText ||
                                          htmlToPlainText(String(q.yourAnswer ?? "")) ||
                                          "—"}
                                        {resultsShowCorrect && !q.unanswered ? (
                                          <span
                                            className={`ml-2 inline-flex px-2 py-0.5 rounded ${
                                              q.isCorrect
                                                ? "bg-green-100 text-green-800"
                                                : "bg-red-100 text-red-800"
                                            }`}
                                          >
                                            {q.isCorrect ? "Correct" : "Incorrect"}
                                          </span>
                                        ) : null}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
