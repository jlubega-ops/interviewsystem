"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Calendar,
  FileText,
  Play,
  AlertCircle,
  CheckCircle,
  User,
  Timer,
  Phone,
  Mail,
  Key,
  LogOut,
  Loader2,
} from "lucide-react";
import { useMessages, MessageDisplay } from "./MessageSystem";
import { format } from "date-fns";
import { sanitizeHtml } from "../lib/sanitize";
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
  const [attemptResults, setAttemptResults] = useState([]);
  const [attemptResultsLoading, setAttemptResultsLoading] = useState(false);
  const [isCheckingAttempts, setIsCheckingAttempts] = useState(false);
  const [startingInterviewId, setStartingInterviewId] = useState(null);
  const router = useRouter();
  const { showError } = useMessages();
  const checkingAttemptsRef = useRef(false);
  const lastCheckTimeRef = useRef(0);
  const hasInitializedRef = useRef(false);

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
        setCohort(parsedCandidate.enrollments[0].cohort);
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
        return { attempts: result.attempts || {}, resultsPublished: result.resultsPublished === true };
      }
    } catch (error) {
      console.error("Error checking interview attempts:", error);
    } finally {
      checkingAttemptsRef.current = false;
    }

    return { attempts: {}, resultsPublished: false };
  }, [candidate, cohort]);

  // Check interview attempts when component loads
  useEffect(() => {
    if (candidate && cohort?.interviews && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setIsCheckingAttempts(true);
      checkInterviewAttempts().then(({ attempts, resultsPublished: rp }) => {
        setInterviewAttempts(attempts ?? {});
        setResultsPublished(rp);
        setIsCheckingAttempts(false);
      });
    }
  }, [candidate, cohort, checkInterviewAttempts]);

  // Fetch detailed attempt results when results are published and all completed
  useEffect(() => {
    if (!candidate || !cohort?.interviews || !resultsPublished) return;
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
  }, [candidate, cohort?.interviews, resultsPublished, interviewAttempts]);

  // Refresh attempts when user returns to the page (after completing an interview)
  useEffect(() => {
    const handleFocus = () => {
      if (candidate && cohort?.interviews && hasInitializedRef.current) {
        checkInterviewAttempts().then(({ attempts, resultsPublished: rp }) => {
          setInterviewAttempts(attempts ?? {});
          setResultsPublished(rp);
        });
      }
    };

    const handleVisibilityChange = () => {
      if (
        !document.hidden &&
        candidate &&
        cohort?.interviews &&
        hasInitializedRef.current
      ) {
        checkInterviewAttempts().then(({ attempts, resultsPublished: rp }) => {
          setInterviewAttempts(attempts ?? {});
          setResultsPublished(rp);
        });
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
    <div className="min-h-screen flex flex-col">
      <MessageDisplay />

      <div className="flex-1 min-h-0 overflow-auto max-w-6xl mx-auto w-full px-4 py-8">
        {/* Header with Logout */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Candidate Dashboard
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>

        {/* Candidate Information */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Your Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Name</p>
                <p className="text-lg font-semibold text-gray-900">
                  {candidate.name}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-lg font-semibold text-gray-900">
                  {candidate.email}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Phone className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Phone</p>
                <p className="text-lg font-semibold text-gray-900">
                  {candidate.phone || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Key className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Access Key</p>
                <p className="text-lg font-semibold text-gray-900 font-mono">
                  {candidate.accessKey}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cohort Information */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Cohort Details
          </h2>

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {cohort.name}
            </h3>
            {cohort.description && (
              <div
                className="text-gray-600 mb-4 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(cohort.description),
                }}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Start Time</p>
                <p className="text-gray-900">
                  {format(new Date(cohort.openTime), "PPP 'at' p")}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">End Time</p>
                <p className="text-gray-900">
                  {format(new Date(cohort.closeTime), "PPP 'at' p")}
                </p>
              </div>
            </div>
          </div>

          {/* Countdown Timer */}
          {timeRemaining !== null && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                <Timer className="w-5 h-5 text-blue-600" />
                <span className="text-blue-800 font-medium">
                  {isCohortOpen
                    ? "Interview in progress"
                    : "Interview starts in:"}
                </span>
                <span className="text-2xl font-mono font-bold text-blue-900">
                  {formatTimeRemaining(timeRemaining)}
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Cohort Instructions
            </h3>
            {cohort.instructions && (
              <div
                className="prose max-w-none text-gray-700 prose-sm mb-4"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(cohort.instructions),
                }}
              />
            )}
            <p className="text-gray-700 text-sm font-medium bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Do not leave or close this page during an exam. If you switch tabs, close the browser, or leave the exam window, your attempt may be submitted automatically.
            </p>
          </div>
        </div>

        {/* Interviews */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Available Interviews
          </h2>

          {cohort.interviews && cohort.interviews.length > 0 ? (
            <div className="space-y-4">
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
                  // No attempt found - use base status (available, waiting, closed, locked)
                  status = baseStatus;
                }

                return (
                  <div
                    key={interview.id}
                    className={`border rounded-lg p-6 ${
                      status === "available"
                        ? "border-green-200 bg-green-50"
                        : status === "attempted"
                        ? "border-blue-200 bg-blue-50"
                        : status === "in_progress"
                        ? "border-orange-200 bg-orange-50"
                        : status === "waiting"
                        ? "border-yellow-200 bg-yellow-50"
                        : status === "locked"
                        ? "border-gray-200 bg-gray-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {interview.type} Assessment
                          </h3>
                          {status === "available" && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                          {status === "attempted" && (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          )}
                          {status === "in_progress" && (
                            <Clock className="w-5 h-5 text-orange-600" />
                          )}
                          {status === "waiting" && (
                            <Clock className="w-5 h-5 text-yellow-600" />
                          )}
                          {status === "locked" && (
                            <AlertCircle className="w-5 h-5 text-gray-600" />
                          )}
                          {status === "closed" && (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>{interview.durationMinutes} minutes</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4" />
                            <span>{interview.totalQuestions} questions</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {status === "available" && "Ready to start"}
                              {status === "attempted" && "Submitted"}
                              {status === "in_progress" && "In progress"}
                              {status === "waiting" &&
                                "Waiting for cohort to open"}
                              {status === "locked" &&
                                "Complete aptitude test first"}
                              {status === "closed" && "Interview closed"}
                            </span>
                            {status === "attempted" &&
                              interviewAttempts?.[interview.id]?.submissionReason && (
                              <span className="text-xs text-gray-500 mt-0.5">
                                {getSubmissionReasonLabel(
                                  interviewAttempts?.[interview.id].submissionReason
                                )}
                              </span>
                            )}
                            {status === "attempted" &&
                              resultsPublished &&
                              interviewAttempts?.[interview.id]?.score != null && (
                              <span className="text-sm font-semibold text-blue-700 mt-1 block">
                                Score: {interviewAttempts?.[interview.id].score}
                                {interview.totalQuestions > 0 && (
                                  <span className="text-gray-600 font-normal">
                                    {" "}/ {interview.totalQuestions}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {interview.instructions && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                              Instructions:
                            </h4>
                            <div
                              className="text-sm text-gray-600 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(interview.instructions),
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="ml-6">
                        {status === "available" ? (
                          <button
                            onClick={() => handleStartInterview(interview)}
                            disabled={startingInterviewId === interview.id}
                            className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {startingInterviewId === interview.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            <span>
                              {startingInterviewId === interview.id
                                ? "Starting..."
                                : "Start Interview"}
                            </span>
                          </button>
                        ) : status === "attempted" ? (
                          <button
                            disabled
                            className="flex items-center space-x-2 px-6 py-3 bg-blue-400 text-white rounded-lg cursor-not-allowed"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Submitted</span>
                          </button>
                        ) : status === "in_progress" ? (
                          <button
                            onClick={() => handleStartInterview(interview)}
                            disabled={startingInterviewId === interview.id}
                            className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {startingInterviewId === interview.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                            <span>
                              {startingInterviewId === interview.id
                                ? "Resuming..."
                                : "Continue Interview"}
                            </span>
                          </button>
                        ) : status === "waiting" ? (
                          <button
                            disabled
                            className="flex items-center space-x-2 px-6 py-3 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                          >
                            <Clock className="w-4 h-4" />
                            <span>Waiting</span>
                          </button>
                        ) : status === "locked" ? (
                          <button
                            disabled
                            className="flex items-center space-x-2 px-6 py-3 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                          >
                            <AlertCircle className="w-4 h-4" />
                            <span>Locked</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex items-center space-x-2 px-6 py-3 bg-red-400 text-white rounded-lg cursor-not-allowed"
                          >
                            <AlertCircle className="w-4 h-4" />
                            <span>Closed</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No interviews available
              </h3>
              <p className="text-gray-600">
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
              <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl">
                <div className="text-center">
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-900 mb-2">
                    All Interviews Completed!
                  </h3>
                  <p className="text-green-800 mb-4">
                    You have successfully completed all interviews in this
                    cohort.
                  </p>
                  {resultsPublished ? (
                    <>
                      <div className="mb-4 text-left max-w-md mx-auto">
                        <h4 className="text-sm font-semibold text-green-900 mb-2">Your results</h4>
                        <ul className="space-y-1 text-sm text-green-800">
                          {cohort.interviews.map((ci) => {
                            const att = interviewAttempts?.[ci.interview?.id];
                            return (
                              <li key={ci.interview.id} className="flex justify-between">
                                <span>{ci.interview.type}</span>
                                <span className="font-medium">
                                  {att?.score != null ? `${att.score} / ${ci.interview.totalQuestions || "—"}` : "—"}
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

          {/* Detailed result cards per interview (when results published) */}
          {resultsPublished &&
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
                            <span>Total marks: {attempt.score} / {attempt.totalQuestions}</span>
                          )}
                        </div>
                        {attempt.submissionReason && (
                          <p className="mt-1.5 text-xs text-amber-800 bg-amber-50 rounded px-2 py-0.5 inline-block">
                            Submission: {getSubmissionReasonLabel(attempt.submissionReason)}
                          </p>
                        )}
                      </div>

                      <h4 className="text-xs font-semibold text-gray-700 mb-2">Questions and your answers</h4>
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
                              .map((q, idx) => (
                                <tr key={q.questionId} className="border-b border-gray-100 hover:bg-gray-50/50">
                                  <td className="py-2 px-3 text-gray-600 font-medium align-top">{idx + 1}</td>
                                  <td className="py-2 px-3 text-gray-800 align-top">
                                    <div
                                      className="prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{
                                        __html: sanitizeHtml(q.questionText || ""),
                                      }}
                                    />
                                  </td>
                                  <td className="py-2 px-3 text-gray-700 align-top">
                                    {q.questionType === "TYPING" && q.typingStats ? (
                                      <div>
                                        <p className="whitespace-pre-wrap break-words">{q.yourAnswer || "(no text)"}</p>
                                        <p className="text-gray-500 mt-1">
                                          WPM {q.typingStats?.netWordsPerMinute ?? q.typingStats?.wordsPerMinute ?? "—"} · Accuracy {q.typingStats?.accuracy != null ? `${q.typingStats.accuracy}%` : "—"}
                                          {q.typingStats?.wordsTyped != null ? ` · Words ${q.typingStats.wordsTyped}` : ""}
                                        </p>
                                      </div>
                                    ) : (
                                      <div
                                        dangerouslySetInnerHTML={{
                                          __html: sanitizeHtml(String(q.yourAnswer ?? "") || "—"),
                                        }}
                                      />
                                    )}
                                  </td>
                                </tr>
                              ))}
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
