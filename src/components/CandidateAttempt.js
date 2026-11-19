"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import { useMessages, MessageDisplay } from "./MessageSystem";
import RichTextDisplay from "./RichTextDisplay";
import { useServerTime } from "../hooks/useServerTime";
import { useCandidateIdleLogout } from "../hooks/useCandidateIdleLogout";
import { useOfflineDetection } from "../hooks/useOfflineDetection";
import OfflineOverlay from "./OfflineOverlay";
import { getCandidateCredentials } from "../lib/candidateCredentials";

export default function CandidateAttempt() {
  const { serverNow } = useServerTime();
  useCandidateIdleLogout();
  const { isOffline } = useOfflineDetection();
  const [questions, setQuestions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
  const router = useRouter();
  const { showError, showSuccess } = useMessages();
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const initializingRef = useRef(false);
  const loadingAnswersRef = useRef(false);
  const [showLeaveWarningModal, setShowLeaveWarningModal] = useState(false);
  const [showInitialSwitchWarning, setShowInitialSwitchWarning] = useState(false);
  const initialSwitchWarningShownRef = useRef(false);
  const leaveWarningAcknowledgedRef = useRef(false);
  const hasLeftOnceRef = useRef(false);
  const leaveSubmitRequestedRef = useRef(false);
  const attemptIdRef = useRef(null);
  const handleAutoSubmitRef = useRef(null);
  attemptIdRef.current = attemptId;

  const initializeAttemptOrResume = async () => {
    if (initializingRef.current || isAutoSubmitting || autoSubmitTriggered)
      return;

    try {
      initializingRef.current = true;
      setIsLoading(true);

      const candidateData = JSON.parse(
        sessionStorage.getItem("candidate_data")
      );
      const interviewData = JSON.parse(
        sessionStorage.getItem("current_interview")
      );

      // Check if we already have an attemptId (prevent starting new attempt if one exists)
      if (attemptId) {
        // We already have an attempt, just resume it
        const resumeResponse = await fetch("/api/candidate/resume-attempt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidateId: candidateData.id,
            accessKey: candidateData.accessKey,
            interviewId: interviewData.id,
          }),
        });

        if (resumeResponse.ok) {
          const result = await resumeResponse.json();
          setAttemptId(result.attemptId);
          setQuestions(result.questions);
          setAnswers(result.answers || {});
          setTimeRemaining(result.timeRemaining);
          startTimeRef.current = new Date(result.startedAt);
          startTimer();
          setIsLoading(false);
          return;
        } else {
          // If resume fails, the attempt might be completed or expired
          const errorData = await resumeResponse.json().catch(() => ({}));
          if (
            errorData.error === "Time has expired" ||
            errorData.error === "Attempt already completed"
          ) {
            showSuccess("Your interview has been automatically submitted.");
            sessionStorage.removeItem("current_interview");
            router.push("/candidate/welcome");
            return;
          }
        }
      }

      // Try to resume existing attempt first
      const resumeResponse = await fetch("/api/candidate/resume-attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId: candidateData.id,
          accessKey: candidateData.accessKey,
          interviewId: interviewData.id,
        }),
      });

      if (resumeResponse.ok) {
        // Resume existing attempt
        const result = await resumeResponse.json();
        setAttemptId(result.attemptId);
        setQuestions(result.questions);
        setAnswers(result.answers || {});
        setTimeRemaining(result.timeRemaining);
        startTimeRef.current = new Date(result.startedAt);
        startTimer();
        setIsLoading(false);
        return;
      } else {
        // No existing attempt found - start a new attempt
        const startResponse = await fetch("/api/candidate/start-attempt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidateId: candidateData.id,
            accessKey: candidateData.accessKey,
            interviewId: interviewData.id,
          }),
        });

        if (startResponse.ok) {
          const startResult = await startResponse.json();
          setAttemptId(startResult.attemptId);
          setQuestions(startResult.questions);
          setAnswers({});
          setTimeRemaining(startResult.timeRemaining ?? startResult.durationMinutes * 60);
          startTimeRef.current = new Date(startResult.startedAt);
          startTimer();
          setIsLoading(false);
          return;
        } else {
          const startError = await startResponse.json();
          showError(startError.error || "Failed to start interview");
          router.push("/candidate/welcome");
          return;
        }
      }
    } catch (error) {
      console.error("Error initializing attempt:", error);
      showError("Failed to start interview");
      router.push("/candidate/welcome");
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  };

  const QUESTIONS_PER_PAGE = 5;
  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const currentQuestions = questions.slice(
    (currentPage - 1) * QUESTIONS_PER_PAGE,
    currentPage * QUESTIONS_PER_PAGE
  );

  const handleAutoSubmit = async () => {
    // Prevent double submission
    if (isAutoSubmitting || autoSubmitTriggered) {
      return;
    }

    // Mark as triggered to prevent multiple calls
    setAutoSubmitTriggered(true);

    // Auto-submit triggered

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set auto-submitting state to prevent further interactions
    setIsAutoSubmitting(true);

    // Use setTimeout to defer the error message and submission to avoid setState during render
    setTimeout(async () => {
      try {
        const submittedBecauseLeft = leaveSubmitRequestedRef.current;
        leaveSubmitRequestedRef.current = false;
        const message = submittedBecauseLeft
          ? "You left the exam. Your attempt has been automatically submitted."
          : "Time's up! Your interview has been automatically submitted.";
        showError(message);

        // Validate required data
        if (!attemptId) {
          // Try to get attemptId from sessionStorage as fallback
          const candidateData = sessionStorage.getItem("candidate_data");
          const interviewData = sessionStorage.getItem("current_interview");

          if (candidateData && interviewData) {
            try {
              const candidate = JSON.parse(candidateData);
              const interview = JSON.parse(interviewData);

              // Try to resume the attempt to get the attemptId
              const resumeResponse = await fetch(
                "/api/candidate/resume-attempt",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    candidateId: candidate.id,
                    accessKey: candidate.accessKey,
                    interviewId: interview.id,
                  }),
                }
              );

              if (resumeResponse.ok) {
                const result = await resumeResponse.json();

                if (result.attemptId) {
                  // Update the state with the retrieved attemptId
                  setAttemptId(result.attemptId);
                  // Continue with the submission using the retrieved attemptId
                  const now = serverNow || new Date();
                  const requestData = {
                    attemptId: result.attemptId,
                    answers: answers || {},
                    timeSpent: Math.floor((now - startTimeRef.current) / 1000),
                    submissionReason: submittedBecauseLeft ? "LEFT_APPLICATION" : "TIME_UP",
                    ...getCandidateCredentials(),
                  };

                  // Auto-submitting with retrieved attemptId

                  const response = await fetch(
                    "/api/candidate/submit-attempt",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify(requestData),
                    }
                  );

                  if (response.ok) {
                    const result = await response.json();
                  } else {
                    const errorData = await response.json().catch(() => ({}));
                    console.error(
                      "Auto-submit failed with retrieved attemptId:",
                      errorData
                    );
                  }

                  // Clear session data and redirect
                  sessionStorage.removeItem("current_interview");
                  router.push("/candidate/welcome");
                  return;
                } else {
                  // The attempt is already completed by the server, which is fine
                  showSuccess(
                    "Your interview has been automatically submitted."
                  );
                  sessionStorage.removeItem("current_interview");
                  router.push("/candidate/welcome");
                  return;
                }
              } else {
                const errorData = await resumeResponse.json().catch(() => ({}));

                // If no active attempt found or time has expired, it means the server already completed it
                if (
                  errorData.error === "No active attempt found" ||
                  errorData.error === "Time has expired"
                ) {
                  showSuccess(
                    "Your interview has been automatically submitted."
                  );
                  sessionStorage.removeItem("current_interview");
                  router.push("/candidate/welcome");
                  return;
                }

                console.error(
                  "Failed to resume attempt for auto-submit:",
                  errorData
                );
              }
            } catch (error) {
              console.error(
                "Error trying to get attemptId from session:",
                error
              );
            }
          }

          // No attemptId available - attempt already completed by server
          // Since the attempt is already completed by the server, just show success and redirect
          showSuccess("Your interview has been automatically submitted.");
          sessionStorage.removeItem("current_interview");
          router.push("/candidate/welcome");
          return;
        }

        if (!startTimeRef.current) {
          startTimeRef.current = (serverNow || new Date());
        }

        const now = serverNow || new Date();
        const requestData = {
          attemptId: attemptId,
          answers: answers || {},
          timeSpent: Math.floor((now - startTimeRef.current) / 1000),
          submissionReason: submittedBecauseLeft ? "LEFT_APPLICATION" : "TIME_UP",
          ...getCandidateCredentials(),
        };

        // Auto-submitting attempt

        const response = await fetch("/api/candidate/submit-attempt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });

        if (response.ok) {
          const result = await response.json();
        } else {
          let errorData;
          try {
            errorData = await response.json();
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
            errorData = { error: "Failed to parse error response" };
          }

          console.error("Auto-submit failed:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });

          // If the attempt is already completed, that's actually fine
          if (errorData?.error === "Attempt already submitted") {
            // Attempt was already completed by server, this is expected
          }
        }

        // Clear session data and redirect to welcome page
        sessionStorage.removeItem("current_interview");
        router.push("/candidate/welcome");
      } catch (error) {
        console.error("Error during auto-submit:", error);
        // Still redirect even if submit fails
        sessionStorage.removeItem("current_interview");
        router.push("/candidate/welcome");
      }
    }, 100);
  };

  useEffect(() => {
    handleAutoSubmitRef.current = handleAutoSubmit;
  });

  const startTimer = () => {
    // Clear any existing timer first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    let ticksSinceSync = 0;
    const SYNC_INTERVAL_SECONDS = 30;

    intervalRef.current = setInterval(async () => {
      ticksSinceSync += 1;
      // Sync with server every 30 seconds so timer is not affected by wrong client clock
      if (attemptId && ticksSinceSync >= SYNC_INTERVAL_SECONDS) {
        ticksSinceSync = 0;
        try {
          const response = await fetch("/api/candidate/check-time", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ attemptId, ...getCandidateCredentials() }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.expired) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              handleAutoSubmit();
              return;
            }
            if (typeof result.timeRemaining === "number") {
              setTimeRemaining(result.timeRemaining);
              return;
            }
          }
        } catch (error) {
          console.error("Error checking server time:", error);
        }
      }

      setTimeRemaining((prev) => {
        if (prev <= 1 && !isAutoSubmitting && !autoSubmitTriggered) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const loadAnswersForCurrentPage = useCallback(async () => {
    if (!attemptId || loadingAnswersRef.current) return;

    try {
      loadingAnswersRef.current = true;
      const currentPageQuestionIds = questions
        .slice(
          (currentPage - 1) * QUESTIONS_PER_PAGE,
          currentPage * QUESTIONS_PER_PAGE
        )
        .map((q) => q.id);

      const response = await fetch("/api/candidate/get-answers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attemptId: attemptId,
          questionIds: currentPageQuestionIds,
          ...getCandidateCredentials(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.answers) {
          // Update answers state with loaded answers
          setAnswers((prev) => ({
            ...prev,
            ...result.answers,
          }));
        }
      }
    } catch (error) {
      console.error("Error loading answers:", error);
    } finally {
      loadingAnswersRef.current = false;
    }
  }, [attemptId, currentPage, questions]);

  useEffect(() => {
    // Check if candidate data exists
    const candidateData = sessionStorage.getItem("candidate_data");
    const interviewData = sessionStorage.getItem("current_interview");

    if (!candidateData || !interviewData) {
      router.push("/candidate");
      return;
    }

    // Check if this is a refresh
    const isRefresh = sessionStorage.getItem("interview_refresh");
    if (isRefresh) {
      setIsRefreshing(true);
      sessionStorage.removeItem("interview_refresh");
    }

    // Initialize attempt (either new or resume existing)
    initializeAttemptOrResume();

    // Security: Prevent copy, paste, right-click, etc.
    const preventActions = (e) => {
      e.preventDefault();
      return false;
    };

    // Detect leaving tab/window: Page Visibility API (tab switch, minimize) + blur (other app/window).
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
      if (!attemptIdRef.current) return;
      if (document.hidden) {
        if (leaveWarningAcknowledgedRef.current) {
          leaveSubmitRequestedRef.current = true;
          handleAutoSubmitRef.current?.();
        } else {
          hasLeftOnceRef.current = true;
        }
      } else {
        if (hasLeftOnceRef.current && !leaveWarningAcknowledgedRef.current) {
          setShowLeaveWarningModal(true);
          leaveWarningAcknowledgedRef.current = true;
          hasLeftOnceRef.current = false;
        }
      }
    };

    const handleWindowBlur = () => {
      if (!attemptIdRef.current) return;
      if (leaveWarningAcknowledgedRef.current) {
        leaveSubmitRequestedRef.current = true;
        handleAutoSubmitRef.current?.();
      } else {
        hasLeftOnceRef.current = true;
      }
    };

    const handleWindowFocus = () => {
      if (!attemptIdRef.current) return;
      if (hasLeftOnceRef.current && !leaveWarningAcknowledgedRef.current) {
        setShowLeaveWarningModal(true);
        leaveWarningAcknowledgedRef.current = true;
        hasLeftOnceRef.current = false;
      }
    };

    // Security: Detect beforeunload
    const handleBeforeUnload = (e) => {
      // Set refresh flag for next page load
      sessionStorage.setItem("interview_refresh", "true");

      e.preventDefault();
      e.returnValue =
        "You are not allowed to leave this page. Your attempt will be submitted if you try again.";
      return e.returnValue;
    };

    // Add event listeners
    document.addEventListener("contextmenu", preventActions);
    document.addEventListener("selectstart", preventActions);
    document.addEventListener("dragstart", preventActions);
    document.addEventListener("keydown", (e) => {
      // Prevent F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S, Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.key === "u") ||
        (e.ctrlKey && e.key === "s") ||
        (e.ctrlKey && e.key === "a") ||
        (e.ctrlKey && e.key === "c") ||
        (e.ctrlKey && e.key === "v") ||
        (e.ctrlKey && e.key === "x")
      ) {
        e.preventDefault();
        showError("This action is not allowed during the interview");
      }
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Prevent new tab/window attempts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && (e.key === "t" || e.key === "n")) {
        e.preventDefault();
      }
    });

    // Prevent middle-click on links
    document.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        // Middle click
        e.preventDefault();
      }
    });

    return () => {
      document.removeEventListener("contextmenu", preventActions);
      document.removeEventListener("selectstart", preventActions);
      document.removeEventListener("dragstart", preventActions);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Clean up new tab prevention listeners
      document.removeEventListener("keydown", (e) => {
        if (e.ctrlKey && (e.key === "t" || e.key === "n")) {
          e.preventDefault();
        }
      });
      document.removeEventListener("auxclick", (e) => {
        if (e.button === 1) {
          e.preventDefault();
        }
      });
    };
  }, []);

  // Load answers when page changes
  useEffect(() => {
    if (attemptId && questions.length > 0) {
      loadAnswersForCurrentPage();
    }
  }, [currentPage, attemptId, questions.length]);

  // Show upfront warning once when attempt is ready: if they switch, attempt will be submitted
  useEffect(() => {
    if (
      !isLoading &&
      questions.length > 0 &&
      attemptId &&
      !initialSwitchWarningShownRef.current
    ) {
      initialSwitchWarningShownRef.current = true;
      setShowInitialSwitchWarning(true);
    }
  }, [isLoading, questions.length, attemptId]);

  // Monitor attemptId changes
  useEffect(() => {
    // Track attemptId changes for debugging
  }, [attemptId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleAnswerChange = async (questionId, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));

    // Auto-save the answer immediately
    if (attemptId) {
      try {
        await fetch("/api/candidate/save-answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attemptId: attemptId,
            questionId: questionId,
            answer: answer,
            ...getCandidateCredentials(),
          }),
        });
      } catch (error) {
        console.error("Error auto-saving answer:", error);
      }
    }
  };

  const saveCurrentPageAnswers = async () => {
    if (!attemptId) return;

    try {
      // Get answers for current page questions
      const currentPageQuestionIds = currentQuestions.map((q) => q.id);
      const answersToSave = {};

      currentPageQuestionIds.forEach((questionId) => {
        if (answers[questionId] !== undefined) {
          answersToSave[questionId] = answers[questionId];
        }
      });

      // Save each answer individually
      for (const [questionId, answer] of Object.entries(answersToSave)) {
        await fetch("/api/candidate/save-answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attemptId: attemptId,
            questionId: questionId,
            answer: answer,
            ...getCandidateCredentials(),
          }),
        });
      }
    } catch (error) {
      console.error("Error saving answers:", error);
    }
  };

  const handleNextPage = async () => {
    if (currentPage < totalPages && !isNavigating && !isAutoSubmitting) {
      setIsNavigating(true);
      try {
        // Save current page answers before navigating
        await saveCurrentPageAnswers();
        setCurrentPage((prev) => prev + 1);
      } catch (error) {
        console.error("Error navigating to next page:", error);
        showError("Failed to navigate to next page");
      } finally {
        setIsNavigating(false);
      }
    }
  };

  const handlePrevPage = async () => {
    if (currentPage > 1 && !isNavigating && !isAutoSubmitting) {
      setIsNavigating(true);
      try {
        // Save current page answers before navigating
        await saveCurrentPageAnswers();
        setCurrentPage((prev) => prev - 1);
      } catch (error) {
        console.error("Error navigating to previous page:", error);
        showError("Failed to navigate to previous page");
      } finally {
        setIsNavigating(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || isAutoSubmitting) return;

    setIsSubmitting(true);

    // Submit attempt with answers

    try {
      const response = await fetch("/api/candidate/submit-attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attemptId: attemptId,
          answers: answers,
          timeSpent: Math.floor(((serverNow || new Date()) - startTimeRef.current) / 1000),
          submissionReason: "SELF_SUBMITTED",
          ...getCandidateCredentials(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showSuccess("Interview submitted successfully!");
        // Clear session data
        sessionStorage.removeItem("current_interview");
        router.push("/candidate/welcome");
      } else {
        showError(result.error || "Failed to submit interview");
      }
    } catch (error) {
      console.error("Error submitting attempt:", error);
      showError("Failed to submit interview");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = () => {
    const answeredQuestions = Object.values(answers).filter(
      (a) => a != null && String(a).trim() !== ""
    ).length;
    return questions.length > 0 ? (answeredQuestions / questions.length) * 100 : 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <MessageDisplay />
      <OfflineOverlay isOffline={isOffline} />

      {/* Auto-submit overlay - portaled to body */}
      {isAutoSubmitting && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4 text-center">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Time&apos;s Up!
            </h3>
            <p className="text-gray-600">
              Your interview is being automatically submitted...
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/candidate/welcome")}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Interview in Progress
                </h1>
                <p className="text-sm text-gray-600">
                  Question {currentPage} of {totalPages} pages
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Timer */}
              <div
                className={`flex items-center space-x-2 ${
                  timeRemaining <= 300 ? "animate-pulse" : ""
                }`}
              >
                <Clock
                  className={`w-5 h-5 ${
                    timeRemaining <= 300 ? "text-red-600" : "text-blue-600"
                  }`}
                />
                <span
                  className={`text-lg font-mono font-bold ${
                    timeRemaining <= 300 ? "text-red-600" : "text-gray-900"
                  }`}
                >
                  {formatTime(timeRemaining)}
                </span>
              </div>

              {/* Progress */}
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">
                  {Object.keys(answers).length}/{questions.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Questions */}
          <div className="space-y-6">
            {currentQuestions.map((question, index) => (
              <div
                key={question.id}
                className="border-b border-gray-200 pb-6 last:border-b-0"
              >
                <div className="flex items-start space-x-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    {(currentPage - 1) * QUESTIONS_PER_PAGE + index + 1}
                  </span>
                  <div className="flex-1">
                    <RichTextDisplay
                      html={question.questionText}
                      className="text-lg font-medium text-gray-900 mb-4"
                    />

                    <div className="space-y-3">
                      {question.options.map((option, optIndex) => {
                        const displayLetter = String.fromCharCode(65 + optIndex);
                        // Store the stable option identity (option.letter) so scoring is shuffle-proof.
                        // displayLetter is only for what the candidate sees on screen.
                        const storedValue =
                          typeof option?.letter === "string"
                            ? option.letter.trim().toUpperCase()
                            : "";
                        const isSelected = answers[question.id] === storedValue;
                        return (
                          <label
                            key={optIndex}
                            className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? "border-blue-500 bg-blue-50 shadow-md"
                                : "border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question_${question.id}`}
                              value={storedValue}
                              checked={isSelected}
                              onChange={(e) =>
                                handleAnswerChange(question.id, e.target.value)
                              }
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {displayLetter}
                            </span>
                            <RichTextDisplay
                              html={option.text}
                              className={`flex-1 ${
                                isSelected
                                  ? "text-blue-900 font-medium"
                                  : "text-gray-900"
                              }`}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1 || isNavigating || isAutoSubmitting}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNavigating ? (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowLeft className="w-4 h-4" />
              )}
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-2 pointer-events-none" aria-hidden="true">
              {Array.from({ length: totalPages }, (_, i) => (
                <span
                  key={i}
                  className={`w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center ${
                    currentPage === i + 1
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {i + 1}
                </span>
              ))}
            </div>

            {currentPage === totalPages ? (
              <button
                onClick={() => setShowConfirmSubmit(true)}
                disabled={isNavigating || isAutoSubmitting}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>Submit Interview</span>
              </button>
            ) : (
              <button
                onClick={handleNextPage}
                disabled={isNavigating || isAutoSubmitting}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isNavigating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>Next</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Initial warning before attempt: if you switch, attempt will be submitted - portaled to body */}
      {showInitialSwitchWarning && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border-l-4 border-amber-500">
            <div className="text-center">
              <AlertTriangle className="w-14 h-14 text-amber-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Before you begin
              </h3>
              <p className="text-gray-700 mb-2">
                Please stay on this page for the duration of the exam.
              </p>
              <p className="text-gray-700 mb-6">
                If you switch to another tab, window, or application, your attempt will be submitted automatically and you will not be able to continue.
              </p>
              <button
                type="button"
                onClick={() => setShowInitialSwitchWarning(false)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                I understand — Start exam
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Leave tab/window warning - portaled to body */}
      {showLeaveWarningModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border-l-4 border-amber-500">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                You left the exam
              </h3>
              <p className="text-gray-600 mb-6">
                You switched to another tab, window, or application. If you leave again, your attempt will be submitted automatically and you will not be able to continue.
              </p>
              <button
                type="button"
                onClick={() => setShowLeaveWarningModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                I understand
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Submit Modal - portaled to body */}
      {showConfirmSubmit && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Submit Interview?
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to submit your interview? You cannot
                return to make changes after submission.
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setShowConfirmSubmit(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? "Submitting..." : "Submit"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
