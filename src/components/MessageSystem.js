"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export const MessageTypes = {
  SUCCESS: "success",
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
};

export const MessageSystem = {
  // Global message state
  messages: [],
  listeners: new Set(),

  // Add a message
  addMessage: (message, type = MessageTypes.INFO, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 15);
    const newMessage = {
      id,
      message,
      type,
      timestamp: Date.now(),
      duration,
    };

    MessageSystem.messages.push(newMessage);
    MessageSystem.notifyListeners();

    // Auto-remove message after duration
    if (duration > 0) {
      setTimeout(() => {
        MessageSystem.removeMessage(id);
      }, duration);
    }

    return id;
  },

  // Remove a message
  removeMessage: (id) => {
    MessageSystem.messages = MessageSystem.messages.filter(
      (msg) => msg.id !== id
    );
    MessageSystem.notifyListeners();
  },

  // Clear all messages
  clearMessages: () => {
    MessageSystem.messages = [];
    MessageSystem.notifyListeners();
  },

  // Subscribe to message changes
  subscribe: (callback) => {
    MessageSystem.listeners.add(callback);
    return () => MessageSystem.listeners.delete(callback);
  },

  // Notify all listeners
  notifyListeners: () => {
    MessageSystem.listeners.forEach((callback) =>
      callback(MessageSystem.messages)
    );
  },
};

// Message Display Component
export function MessageDisplay() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const unsubscribe = MessageSystem.subscribe(setMessages);
    return unsubscribe;
  }, []);

  if (messages.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
}

// Individual Message Component
function MessageItem({ message }) {
  const getIcon = () => {
    switch (message.type) {
      case MessageTypes.SUCCESS:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case MessageTypes.ERROR:
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case MessageTypes.WARNING:
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case MessageTypes.INFO:
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStyles = () => {
    switch (message.type) {
      case MessageTypes.SUCCESS:
        return "bg-green-50 border-green-200 text-green-800";
      case MessageTypes.ERROR:
        return "bg-red-50 border-red-200 text-red-800";
      case MessageTypes.WARNING:
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case MessageTypes.INFO:
        return "bg-blue-50 border-blue-200 text-blue-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  return (
    <div
      className={`max-w-sm p-4 rounded-lg border shadow-lg backdrop-blur-sm ${getStyles()} animate-in slide-in-from-right duration-300`}
    >
      <div className="flex items-start space-x-3">
        {getIcon()}
        <div className="flex-1">
          <p className="text-sm font-medium">{message.message}</p>
        </div>
        <button
          onClick={() => MessageSystem.removeMessage(message.id)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Hook for using messages in components
export function useMessages() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const unsubscribe = MessageSystem.subscribe(setMessages);
    return unsubscribe;
  }, []);

  const showSuccess = (message, duration = 5000) => {
    return MessageSystem.addMessage(message, MessageTypes.SUCCESS, duration);
  };

  const showError = (message, duration = 7000) => {
    return MessageSystem.addMessage(message, MessageTypes.ERROR, duration);
  };

  const showWarning = (message, duration = 6000) => {
    return MessageSystem.addMessage(message, MessageTypes.WARNING, duration);
  };

  const showInfo = (message, duration = 5000) => {
    return MessageSystem.addMessage(message, MessageTypes.INFO, duration);
  };

  const removeMessage = (id) => {
    MessageSystem.removeMessage(id);
  };

  const clearMessages = () => {
    MessageSystem.clearMessages();
  };

  return {
    messages,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeMessage,
    clearMessages,
  };
}

// API Response Handler
export function handleApiResponse(response, showMessage) {
  if (response.ok) {
    showMessage("Operation completed successfully", MessageTypes.SUCCESS);
    return true;
  } else {
    showMessage(response.error || "Operation failed", MessageTypes.ERROR);
    return false;
  }
}

// Form Validation Messages
export const ValidationMessages = {
  REQUIRED: "This field is required",
  EMAIL_INVALID: "Please enter a valid email address",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters long",
  PASSWORDS_DONT_MATCH: "Passwords do not match",
  ACCESS_KEY_INVALID: "Invalid access key. Please check and try again.",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
};

// Success Messages
export const SuccessMessages = {
  LOGIN_SUCCESS: "Login successful! Redirecting...",
  LOGOUT_SUCCESS: "Logged out successfully",
  ACCESS_VERIFIED: "Access key verified! Redirecting to interview...",
  SESSION_RENEWED: "Session renewed successfully",
  SETUP_COMPLETE: "System setup completed successfully",
  COHORT_CREATED: "Cohort created successfully!",
  COHORT_UPDATED: "Cohort updated successfully!",
  COHORT_DELETED: "Cohort deleted successfully!",
};

// Error Messages
export const ErrorMessages = {
  LOGIN_FAILED: "Login failed. Please check your credentials.",
  SESSION_INVALID: "Invalid session. Please log in again.",
  ACCESS_DENIED:
    "Access denied. You don't have permission to perform this action.",
  SYSTEM_ERROR: "System error. Please try again later.",
  DATABASE_ERROR: "Database connection failed. Please contact support.",
};
