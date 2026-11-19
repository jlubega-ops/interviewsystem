"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Send,
  Eye,
  EyeOff,
  Type,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMessages, MessageDisplay } from "./MessageSystem";
import { useServerTime } from "../hooks/useServerTime";
import { useCandidateIdleLogout } from "../hooks/useCandidateIdleLogout";
import { useOfflineDetection } from "../hooks/useOfflineDetection";
import OfflineOverlay from "./OfflineOverlay";
import { getCandidateCredentials } from "../lib/candidateCredentials";

export default function TypingAttempt() {
  const { serverNow } = useServerTime();
  useCandidateIdleLogout();
  const { isOffline } = useOfflineDetection();
  const [question, setQuestion] = useState(null);
  const [typedText, setTypedText] = useState("");
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
  const [startTime, setStartTime] = useState(null);
  const [typingStats, setTypingStats] = useState({
    wordsPerMinute: 0,
    netWordsPerMinute: 0,
    accuracy: 0,
    accuracyOnTyped: 100,
    wordsTyped: 0,
    charactersTyped: 0,
  });
  const [progress, setProgress] = useState(0);
  const [originalText, setOriginalText] = useState("");
  const [showAutoSubmitDialog, setShowAutoSubmitDialog] = useState(false);
  const textDisplayRef = useRef(null);
  const submitInProgressRef = useRef(false);
  const initializingRef = useRef(false);
  const router = useRouter();
  const { showError, showSuccess } = useMessages();
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const typingStartTimeRef = useRef(null);
  const typedTextRef = useRef("");
  const questionRef = useRef(null);
  const textareaRef = useRef(null);

  const handleAutoSubmit = async () => {
    // Prevent double submission
    if (isAutoSubmitting || autoSubmitTriggered) {
      return;
    }

    // Capture typed text immediately (before any setState) from ref or textarea DOM so it can't be lost
    const capturedText =
      typedTextRef.current ||
      (textareaRef.current && textareaRef.current.value) ||
      "";

    const capturedQuestion = questionRef.current;

    // Mark as triggered to prevent multiple calls
    setAutoSubmitTriggered(true);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set auto-submitting state to prevent further interactions
    setIsAutoSubmitting(true);

    // Use setTimeout to defer the error message and submission to avoid setState during render
    setTimeout(async () => {
      try {
        showError(
          "Time's up! Your interview has been automatically submitted."
        );

        // Re-read typed text from textarea DOM right before submit (single source of truth; refs can be stale from interval closure)
        const textareaEl =
          textareaRef.current ||
          (typeof document !== "undefined" &&
            document.querySelector("[data-typing-attempt-textarea]"));
        const textFromDom =
          textareaEl && typeof textareaEl.value === "string"
            ? textareaEl.value
            : "";
        const textToSubmit = textFromDom || capturedText || "";

        const questionForStats = capturedQuestion || questionRef.current;

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
                  const now = serverNow || new Date();
                  const requestData = {
                    attemptId: result.attemptId,
                    finalAnswer: textToSubmit,
                    timeSpent: Math.floor((now - startTimeRef.current) / 1000),
                    typingStats: calculateTypingStats(
                      textToSubmit,
                      typingStartTimeRef.current,
                      questionForStats,
                      now
                    ),
                    submissionReason: "TIME_UP",
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
          startTimeRef.current = serverNow || new Date();
        }

        const now = serverNow || new Date();
        const requestData = {
          attemptId: attemptId,
          finalAnswer: textToSubmit,
          timeSpent: Math.floor((now - startTimeRef.current) / 1000),
          typingStats: calculateTypingStats(
            textToSubmit,
            typingStartTimeRef.current,
            questionForStats,
            now
          ),
          submissionReason: "TIME_UP",
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
            showSuccess("Your interview has been automatically submitted.");
            sessionStorage.removeItem("current_interview");
            router.push("/candidate/welcome");
            return;
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

  const startTimer = () => {
    // Clear any existing timer first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    let ticksSinceSync = 0;
    const SYNC_INTERVAL_SECONDS = 30;

    intervalRef.current = setInterval(async () => {
      ticksSinceSync += 1;
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
        const newTime = prev - 1;
        return newTime;
      });
    }, 1000);
  };

  const initializeAttemptOrResume = async () => {
    if (isAutoSubmitting || autoSubmitTriggered) return;

    // Prevent multiple simultaneous calls
    if (initializingRef.current) return;

    // Add a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.log("Loading timeout - forcing loading to false");
      setIsLoading(false);
    }, 10000); // 10 second timeout

    try {
      console.log("Starting initialization...");
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
          setTypedText(result.typedText || "");
          setTimeRemaining(result.timeRemaining);
          setStartTime(new Date(result.startedAt));
          startTimeRef.current = new Date(result.startedAt);
          typingStartTimeRef.current = new Date(result.startedAt);

          // Check if questions exist and set the first question
          console.log("Resume attempt - questions received:", result.questions);
          if (result.questions && result.questions.length > 0) {
            console.log(
              "Setting question from resume attempt:",
              result.questions[0]
            );
            setQuestion(result.questions[0]); // Typing interviews have only one question
            // Clean HTML tags from question text
            const cleanText = result.questions[0].questionText
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
            setOriginalText(cleanText);
          }
          startTimer();
          clearTimeout(loadingTimeout);
          console.log("Resume attempt successful - setting loading to false");
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
        setTypedText(result.typedText || "");
        setTimeRemaining(result.timeRemaining);
        setStartTime(new Date(result.startedAt));
        startTimeRef.current = new Date(result.startedAt);
        typingStartTimeRef.current = new Date(result.startedAt);

        // Check if questions exist and set the first question
        console.log(
          "Resume attempt (second) - questions received:",
          result.questions
        );
        if (result.questions && result.questions.length > 0) {
          console.log(
            "Setting question from resume attempt (second):",
            result.questions[0]
          );
          setQuestion(result.questions[0]); // Typing interviews have only one question
          // Clean HTML tags from question text
          const cleanText = result.questions[0].questionText
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
          setOriginalText(cleanText);
        }
        startTimer();
        clearTimeout(loadingTimeout);
        console.log(
          "Resume attempt (second) successful - setting loading to false"
        );
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
          setTypedText("");
          setTimeRemaining(startResult.timeRemaining ?? startResult.durationMinutes * 60);
          setStartTime(new Date(startResult.startedAt));
          startTimeRef.current = new Date(startResult.startedAt);
          typingStartTimeRef.current = new Date(startResult.startedAt);

          // Check if questions exist and set the first question
          console.log(
            "Start attempt - questions received:",
            startResult.questions
          );
          if (startResult.questions && startResult.questions.length > 0) {
            console.log(
              "Setting question from start attempt:",
              startResult.questions[0]
            );
            setQuestion(startResult.questions[0]); // Typing interviews have only one question
            // Clean HTML tags from question text
            const cleanText = startResult.questions[0].questionText
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
            setOriginalText(cleanText);
          }
          startTimer();
          clearTimeout(loadingTimeout);
          console.log("Start attempt successful - setting loading to false");
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
      console.log(
        "Finally block - clearing timeout and setting loading to false"
      );
      clearTimeout(loadingTimeout);
      setIsLoading(false);
      initializingRef.current = false;
    }
  };

  useEffect(() => {
    // Check if candidate data exists
    const candidateData = sessionStorage.getItem("candidate_data");
    const interviewData = sessionStorage.getItem("current_interview");

    if (!candidateData || !interviewData) {
      showError("Session data not found. Please start the interview again.");
      router.push("/candidate/welcome");
      return;
    }

    // Only initialize if not already initializing and not already loaded
    if (!initializingRef.current && !question) {
      console.log("useEffect - calling initializeAttemptOrResume");
      console.log("Current question state:", question);
      console.log("Current loading state:", isLoading);
      initializeAttemptOrResume();
    } else {
      console.log("useEffect - NOT calling initializeAttemptOrResume");
      console.log("initializingRef.current:", initializingRef.current);
      console.log("question:", question);
    }
  }, [router]);

  // Debug useEffect to monitor question state changes
  useEffect(() => {
    console.log("Question state changed:", question);
    console.log("Loading state changed:", isLoading);
  }, [question, isLoading]);

  useEffect(() => {
    // Disable page leave warnings for typing interviews
    const handleBeforeUnload = (e) => {
      if (!isAutoSubmitting && !isNavigating) {
        e.preventDefault();
        e.returnValue =
          "Are you sure you want to leave? Your progress will be lost.";
        return "Are you sure you want to leave? Your progress will be lost.";
      }
    };

    // Disable copy, paste, and other shortcuts
    const handleKeyDown = (e) => {
      // Disable Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+Z, Ctrl+Y, Ctrl+X
      if (
        e.ctrlKey &&
        ["c", "v", "a", "z", "y", "x"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        return false;
      }

      // Disable F5, Ctrl+R
      if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
        e.preventDefault();
        return false;
      }

      // Disable right-click context menu
      if (e.key === "ContextMenu") {
        e.preventDefault();
        return false;
      }
    };

    // Disable right-click
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Disable text selection
    const handleSelectStart = (e) => {
      e.preventDefault();
      return false;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("selectstart", handleSelectStart);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("selectstart", handleSelectStart);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoSubmitting, isNavigating]);

  // Keep refs in sync so auto-submit (timer/setTimeout) always has current typed text and question
  useEffect(() => {
    typedTextRef.current = typedText;
    questionRef.current = question;
  }, [typedText, question]);

  /**
   * Typing stats aligned with accredited / professional systems (Testlify, eSkill, etc.):
   * - Standard word = 5 characters (including spaces).
   * - Gross WPM = (characters typed / 5) / minutes; Net WPM = Gross − (uncorrected errors / minutes).
   * - Accuracy = (correct characters / total characters in REFERENCE passage) × 100.
   *   Scale is out of the full passage: typing only 10 words correctly in a 100-word passage = 10%, not 100%.
   */
  const calculateTypingStats = (text, startTime, questionOverride, nowOverride) => {
    const q = questionOverride ?? question;
    const originalTextClean =
      q && q.questionText
        ? q.questionText.replace(/<[^>]*>/g, "").trim()
        : "";
    const totalReferenceChars = originalTextClean.length;

    if (!startTime) {
      return {
        wordsPerMinute: 0,
        netWordsPerMinute: 0,
        accuracy: totalReferenceChars > 0 ? 0 : 100,
        accuracyOnTyped: 100,
        wordsTyped: 0,
        charactersTyped: 0,
      };
    }

    const typedText = text || "";
    const charactersTyped = typedText.length;
    const now = nowOverride || new Date();
    const timeElapsedMinutes =
      (now.getTime() - startTime.getTime()) / 1000 / 60;

    // Standard: 1 word = 5 characters
    const standardWordsTyped = charactersTyped / 5;
    const grossWPM =
      timeElapsedMinutes > 0
        ? standardWordsTyped / timeElapsedMinutes
        : 0;

    // Correct chars = position-by-position match with reference (only in the span they typed)
    let correctKeystrokes = 0;
    const minLen = Math.min(totalReferenceChars, typedText.length);
    for (let i = 0; i < minLen; i++) {
      if (originalTextClean[i] === typedText[i]) correctKeystrokes++;
    }

    // Accuracy = out of FULL REFERENCE (so partial completion cannot get 100%)
    const accuracy =
      totalReferenceChars > 0
        ? Math.round((correctKeystrokes / totalReferenceChars) * 100)
        : 100;

    // Accuracy of typed portion only (for display/transparency)
    const accuracyOnTyped =
      charactersTyped > 0
        ? Math.round((correctKeystrokes / charactersTyped) * 100)
        : 100;

    // Net WPM = Gross WPM − (uncorrected errors / minutes); floor at 0
    const uncorrectedErrors = charactersTyped - correctKeystrokes;
    const errorsPerMinute =
      timeElapsedMinutes > 0 ? uncorrectedErrors / timeElapsedMinutes : 0;
    const netWPM = Math.max(0, Math.round(grossWPM - errorsPerMinute));
    const wordsPerMinute = Math.round(grossWPM);

    return {
      wordsPerMinute,
      netWordsPerMinute: netWPM,
      accuracy,
      accuracyOnTyped,
      wordsTyped: Math.round(standardWordsTyped),
      charactersTyped,
    };
  };

  const handleTextChange = (e) => {
    const text = e.target.value;
    setTypedText(text);
    typedTextRef.current = text; // Keep ref in sync so auto-submit on time-out always has latest text

    // Calculate progress
    if (originalText.length > 0) {
      const progressPercent = Math.min(
        (text.length / originalText.length) * 100,
        100
      );
      setProgress(progressPercent);
    }

    // Auto-scroll the text display to show current position
    if (textDisplayRef.current && text.length > 0) {
      const currentChar = text.length - 1;
      const charElement = textDisplayRef.current.querySelector(
        `[data-char-index="${currentChar}"]`
      );
      if (charElement) {
        charElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    // Calculate typing stats (use server time when available)
    if (typingStartTimeRef.current) {
      const stats = calculateTypingStats(text, typingStartTimeRef.current, undefined, serverNow || undefined);
      setTypingStats(stats);
    } else {
      typingStartTimeRef.current = serverNow || new Date();
    }
  };

  const saveAnswer = useCallback(
    async (text) => {
      if (!attemptId || !question || !question.id) {
        console.log("Cannot save answer: missing required data", {
          attemptId,
          question,
        });
        return;
      }

      try {
        const saveData = {
          attemptId: attemptId,
          questionId: question.id,
          answer: text || "",
          typingStats: typingStats,
          ...getCandidateCredentials(),
        };

        console.log("Saving answer with data:", saveData);

        const response = await fetch("/api/candidate/save-answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(saveData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Save answer failed:", errorData);
        }
      } catch (error) {
        console.error("Error saving answer:", error);
      }
    },
    [attemptId, question, showError]
  );

  // Periodically save typed text to the server every 5 seconds (even before submit).
  // So if time runs out or the user disconnects, the last saved content is used when we auto-complete the attempt.
  useEffect(() => {
    if (
      typedText &&
      attemptId &&
      question &&
      question.id &&
      !isAutoSubmitting
    ) {
      const saveInterval = setInterval(() => {
        saveAnswer(typedText);
      }, 5000);

      return () => clearInterval(saveInterval);
    }
  }, [typedText, attemptId, question, isAutoSubmitting, saveAnswer]);

  const submitAttempt = async () => {
    // Prevent multiple submissions
    if (submitInProgressRef.current) {
      console.log("Submit already in progress, skipping...");
      return;
    }

    try {
      submitInProgressRef.current = true;
      setIsSubmitting(true);

      // Save final answer
      if (typedText && attemptId && question) {
        await saveAnswer(typedText);
      }

      const now = serverNow || new Date();
      const submitData = {
        attemptId: attemptId,
        finalAnswer: typedText,
        timeSpent: startTimeRef.current
          ? Math.floor((now - startTimeRef.current) / 1000)
          : 0,
        typingStats:
          typingStartTimeRef.current
            ? calculateTypingStats(
                typedText,
                typingStartTimeRef.current,
                undefined,
                now
              )
            : typingStats,
        submissionReason: "SELF_SUBMITTED",
        ...getCandidateCredentials(),
      };

      console.log("Submitting typing attempt with data:", submitData);

      const response = await fetch("/api/candidate/submit-attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (response.ok) {
        if (isAutoSubmitting) {
          showSuccess(
            "Time's up! Your interview has been automatically submitted."
          );
        } else {
          showSuccess("Interview submitted successfully!");
        }
        setIsNavigating(true);
        sessionStorage.removeItem("current_interview");
        router.push("/candidate/welcome");
      } else {
        console.error("Submit attempt failed:", result);
        showError(result.error || "Failed to submit interview");
      }
    } catch (error) {
      console.error("Error submitting interview:", error);
      if (isAutoSubmitting) {
        showError(
          "Time's up! Your interview has been automatically submitted."
        );
        sessionStorage.removeItem("current_interview");
        router.push("/candidate/welcome");
      } else {
        showError("Failed to submit interview");
      }
    } finally {
      setIsSubmitting(false);
      submitInProgressRef.current = false;
    }
  };

  const handleSubmit = () => {
    setShowConfirmSubmit(true);
  };

  const confirmSubmit = () => {
    setShowConfirmSubmit(false);
    submitAttempt();
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

  const renderHighlightedText = () => {
    if (!originalText) return originalText;

    const originalChars = originalText.split("");
    const typedChars = typedText ? typedText.split("") : [];

    return originalChars.map((char, index) => {
      const typedChar = typedChars[index];
      let className = "text-gray-400"; // Default color for untyped text

      if (typedChar !== undefined) {
        if (char === typedChar) {
          className = "text-green-600 bg-green-100"; // Correct character
        } else {
          className = "text-red-600 bg-red-100"; // Incorrect character
        }
      }

      return (
        <span key={index} className={className} data-char-index={index}>
          {char}
        </span>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview...</p>
          <p className="text-sm text-gray-500 mt-2">
            Question: {question ? "Loaded" : "Not loaded"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Loading state: {isLoading ? "true" : "false"}
          </p>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No Question Found
          </h2>
          <p className="text-gray-600 mb-4">
            The typing question could not be loaded.
          </p>
          <p className="text-sm text-gray-500 mb-2">
            Debug: Question state is null
          </p>
          <p className="text-sm text-gray-500 mb-2">
            Loading: {isLoading ? "true" : "false"}
          </p>
          <button
            onClick={() => router.push("/candidate/welcome")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MessageDisplay />
      <OfflineOverlay isOffline={isOffline} />

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Type className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Typing Test
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Timer */}
              <div
                className={`flex items-center space-x-2 ${
                  timeRemaining <= 300 ? "animate-pulse" : ""
                }`}
              >
                <Clock
                  className={`w-5 h-5 ${
                    timeRemaining <= 300 ? "text-red-600" : "text-green-600"
                  }`}
                />
                <span
                  className={`text-lg font-mono font-bold ${
                    timeRemaining <= 300 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {formatTime(timeRemaining)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 font-medium">
                  {Math.round(progress)}%
                </span>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isAutoSubmitting}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? "Submitting..." : "Submit"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Text to Type */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Text to Type
            </h2>
            <p className="text-xs text-gray-500 mb-2">
              Accuracy is scored against the full passage: correct characters ÷ total characters. Your final score combines accuracy (60%) and typing speed (40%).
            </p>
            <div className="bg-gray-50 rounded-lg p-4 min-h-64 max-h-96 overflow-y-auto">
              <div
                ref={textDisplayRef}
                className="font-mono text-lg leading-relaxed whitespace-pre-wrap"
              >
                {renderHighlightedText()}
              </div>
            </div>
          </div>

          {/* Typing Area */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Type Here
            </h2>
            <textarea
              ref={textareaRef}
              data-typing-attempt-textarea
              value={typedText}
              onChange={handleTextChange}
              placeholder="Start typing here..."
              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-lg leading-relaxed text-gray-900 bg-white placeholder-gray-500"
              disabled={isSubmitting || isAutoSubmitting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>
        </div>
      </div>

      {/* Auto-Submit Dialogue - portaled to body */}
      {showAutoSubmitDialog && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Time&apos;s Up!
              </h3>
              <p className="text-gray-600">
                Your interview is being automatically submitted...
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Submit Confirmation Modal - portaled to body */}
      {showConfirmSubmit && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Submit Interview
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to submit your typing test? This action
              cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
