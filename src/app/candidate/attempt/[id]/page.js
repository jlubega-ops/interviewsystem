"use client";

import CandidateAttempt from "../../../../components/CandidateAttempt";
import TypingAttempt from "../../../../components/TypingAttempt";
import { useState, useEffect } from "react";

// Disable caching for candidate attempt page
export const dynamic = "force-dynamic";

export default function CandidateAttemptPage({ params }) {
  const [interviewType, setInterviewType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get interview type from session storage
    const interviewData = sessionStorage.getItem("current_interview");
    if (interviewData) {
      try {
        const interview = JSON.parse(interviewData);
        setInterviewType(interview.type);
      } catch (error) {
        console.error("Error parsing interview data:", error);
      }
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {interviewType === "TYPING" ? <TypingAttempt /> : <CandidateAttempt />}
    </div>
  );
}
