"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
} from "lucide-react";
import { useMessages } from "./MessageSystem";

export default function BulkCandidateUpload({ cohortId, onUploadComplete }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef(null);
  const { showError, showSuccess } = useMessages();

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];

    if (!validTypes.includes(file.type)) {
      showError("Please select a valid Excel file (.xlsx, .xls) or CSV file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError("File size must be less than 5MB");
      return;
    }

    handleFileUpload(file);
  };

  const handleFileUpload = async (file) => {
    setIsUploading(true);
    setUploadResults(null);
    setShowResults(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cohortId", cohortId);

      const response = await fetch("/api/cohorts/upload-candidates", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResults(result);
        setShowResults(true);
        showSuccess(
          `Upload completed! ${result.successCount} candidates processed successfully.`
        );
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        showError(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      showError("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    // Create template data
    const templateData = [
      ["Name", "Email", "Phone", "Access Code"],
      ["John Doe", "john@example.com", "+1234567890", "ABC123"],
      ["Jane Smith", "jane@example.com", "+0987654321", ""],
    ];

    // Convert to CSV
    const csvContent = templateData.map((row) => row.join(",")).join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "candidate_upload_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setUploadResults(null);
    setShowResults(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Bulk Upload Candidates
        </h3>
        <button
          onClick={downloadTemplate}
          className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download Template</span>
        </button>
      </div>

      <div className="space-y-4">
        {/* Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          <div className="space-y-3">
            <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-sm text-gray-600">
                {isUploading
                  ? "Processing file..."
                  : "Click to select Excel file or drag and drop"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: .xlsx, .xls, .csv (Max 5MB)
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{isUploading ? "Processing..." : "Select File"}</span>
            </button>
          </div>
        </div>

        {/* Template Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Template Format
          </h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>
              <strong>Required columns:</strong> Name, Email, Phone
            </p>
            <p>
              <strong>Optional column:</strong> Access Code (leave empty to
              auto-generate)
            </p>
            <p>
              <strong>Note:</strong> If a candidate with the same email exists,
              they will be enrolled without creating a duplicate
            </p>
          </div>
        </div>

        {/* Upload Results */}
        {showResults && uploadResults && (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">
                Upload Results
              </h4>
              <button
                onClick={resetUpload}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="text-green-600 font-semibold">
                    {uploadResults.successCount}
                  </div>
                  <div className="text-green-800">Success</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 rounded">
                  <div className="text-yellow-600 font-semibold">
                    {uploadResults.skippedCount}
                  </div>
                  <div className="text-yellow-800">Skipped</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <div className="text-red-600 font-semibold">
                    {uploadResults.errorCount}
                  </div>
                  <div className="text-red-800">Errors</div>
                </div>
              </div>

              {/* Success Messages */}
              {uploadResults.successMessages &&
                uploadResults.successMessages.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-green-800 mb-2">
                      Successfully Processed:
                    </h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {uploadResults.successMessages.map((message, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 text-sm text-green-700"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>{message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Error Messages */}
              {uploadResults.errorMessages &&
                uploadResults.errorMessages.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-red-800 mb-2">
                      Errors:
                    </h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {uploadResults.errorMessages.map((message, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 text-sm text-red-700"
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>{message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
