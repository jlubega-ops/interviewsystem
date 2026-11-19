"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, FileCheck } from "lucide-react";
import ResultsPublishOptions from "./ResultsPublishOptions";
import { cascadeResultsFlags } from "../lib/resultsPublish";

export default function PublishResultsModal({
  isOpen,
  onClose,
  cohort,
  saving,
  onSave,
}) {
  const [mounted, setMounted] = useState(false);
  const [options, setOptions] = useState({
    showScore: true,
    showAttempt: false,
    showCorrect: false,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const flags = cascadeResultsFlags({
      showScore: cohort?.resultsPublished === true,
      showAttempt: cohort?.resultsShowAttempt === true,
      showCorrect: cohort?.resultsShowCorrect === true,
    });
    setOptions({
      showScore: flags.resultsPublished || cohort?.resultsPublished !== true,
      showAttempt: flags.resultsShowAttempt,
      showCorrect: flags.resultsShowCorrect,
    });
  }, [isOpen, cohort]);

  if (!isOpen || !mounted) return null;

  const currentlyPublished = cohort?.resultsPublished === true;
  const handleClose = () => {
    if (!saving) onClose();
  };

  const modal = (
    <div className="fixed inset-0 bg-gray-600/30 overflow-y-auto h-full w-full flex justify-center items-center z-[9999] p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileCheck className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <h3 className="text-lg font-semibold text-gray-900">
              {currentlyPublished ? "Update published results" : "Publish results"}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            disabled={saving}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Choose what candidates can see after they complete interviews.
            Checking a deeper option also turns on the ones above it.
          </p>
          <ResultsPublishOptions
            value={options}
            onChange={setOptions}
            disabled={saving}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {currentlyPublished ? (
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                onSave({
                  showScore: false,
                  showAttempt: false,
                  showCorrect: false,
                })
              }
              className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Unpublish"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(options)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {currentlyPublished ? "Save" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
