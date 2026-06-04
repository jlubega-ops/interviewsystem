"use client";

import { useState, useEffect } from "react";
import SuperAdminSetup from "./SuperAdminSetup";

export default function SetupDetector({ children }) {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (has auth token)
    const authToken = localStorage.getItem("token");
    if (authToken) {
      console.log("User is already logged in, skipping database check");
      setNeedsSetup(false);
      setIsLoading(false);
      return;
    }

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log("Database check timeout, assuming setup not needed");
      setNeedsSetup(false);
      setIsLoading(false);
    }, 15000); // 15 second timeout

    checkDatabaseStatus().finally(() => {
      clearTimeout(timeout);
    });
  }, []);

  const checkDatabaseStatus = async () => {
    try {
      console.log("Checking database status...");

      // Check if database is empty
      const response = await fetch("/api/setup/check-database", {
        method: "GET",
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      console.log("Database check response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("Database status:", result);

        if (result.isEmpty) {
          console.log("Database is empty, needs super admin setup");
          setNeedsSetup(true);
        } else {
          console.log("Database has data, setup not needed");
          setNeedsSetup(false);
        }
      } else {
        console.log("Database check failed with status:", response.status);
        // If API fails, assume setup is not needed (database exists)
        setNeedsSetup(false);
      }
    } catch (error) {
      console.error("Error checking database status:", error);
      // If there's an error, assume setup is not needed (database exists)
      setNeedsSetup(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking system status...</p>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <SuperAdminSetup />;
  }

  return <>{children}</>;
}
