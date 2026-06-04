"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Save, Loader2 } from "lucide-react";
import { useMessages } from "./MessageSystem";
import { stripHtmlToText } from "../lib/sanitize";
import RichTextEditor from "./RichTextEditor";

const defaultOptions = [
  { letter: "A", text: "" },
  { letter: "B", text: "" },
  { letter: "C", text: "" },
  { letter: "D", text: "" },
];

export default function QuestionBankQuestionForm({
  isOpen,
  onClose,
  questionBankId,
  onQuestionSuccess,
  question = null,
  isEditing = false,
}) {
  const [formData, setFormData] = useState({
    questionText: "",
    questionType: "MULTIPLE_CHOICE",
    options: defaultOptions.map((o) => ({ ...o })),
    correctAnswer: "",
    points: 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { showSuccess, showError } = useMessages();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!isOpen) return;
    if (question && isEditing) {
      const options =
        Array.isArray(question.options) && question.options.length > 0
          ? question.options.map((opt) => ({ letter: opt.letter ?? "", text: opt.text ?? "" }))
          : defaultOptions;
      let correctAnswer = (question.correctAnswer || "").toString().trim();
      if (correctAnswer && options.length) {
        const byLetter = options.find((o) => String(o.letter).toUpperCase() === correctAnswer.toUpperCase());
        if (byLetter) correctAnswer = byLetter.letter;
        else {
          const match = options.find((o) => stripHtmlToText(o.text || "").trim() === correctAnswer);
          if (match) correctAnswer = match.letter;
        }
      }
      setFormData({
        questionText: question.questionText || "",
        questionType: question.questionType || "MULTIPLE_CHOICE",
        options,
        correctAnswer,
        points: question.points ?? 1,
      });
    } else {
      setFormData({
        questionText: "",
        questionType: "MULTIPLE_CHOICE",
        options: defaultOptions.map((o) => ({ ...o })),
        correctAnswer: "",
        points: 1,
      });
    }
  }, [isOpen, question, isEditing]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index].text = value;
    setFormData((prev) => ({ ...prev, options: newOptions }));
  };
  const addOption = () => {
    if (formData.options.length < 6) {
      const newLetter = String.fromCharCode(65 + formData.options.length);
      setFormData((prev) => ({ ...prev, options: [...prev.options, { letter: newLetter, text: "" }] }));
    }
  };
  const removeOption = (index) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index).map((opt, i) => ({ ...opt, letter: String.fromCharCode(65 + i) }));
      setFormData((prev) => ({
        ...prev,
        options: newOptions,
        correctAnswer: prev.correctAnswer === formData.options[index].letter ? "" : prev.correctAnswer,
      }));
    }
  };

  const validateForm = () => {
    if (!formData.questionText.trim()) { showError("Question text is required"); return false; }
    if (formData.options.filter((o) => o.text.trim()).length < 2) { showError("At least 2 options must be filled"); return false; }
    if (!formData.correctAnswer) { showError("Correct answer is required"); return false; }
    if (!formData.points || formData.points < 1) { showError("Points must be at least 1"); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm() || !questionBankId) return;
    setIsLoading(true);
    try {
      const url = isEditing
        ? `/api/question-banks/${questionBankId}/questions/${question.id}`
        : `/api/question-banks/${questionBankId}/questions`;
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questionText: formData.questionText.trim(),
          questionType: formData.questionType,
          options: formData.options.filter((o) => o.text.trim()),
          correctAnswer: formData.correctAnswer,
          points: parseInt(formData.points, 10),
        }),
      });
      const result = await res.json();
      if (res.ok) {
        showSuccess(result.message);
        onQuestionSuccess(result.question);
        onClose();
      } else {
        showError(result.error || "Failed to save question");
      }
    } catch (err) {
      showError("Failed to save question");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const formModal = (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">{isEditing ? "Edit Question" : "Add Question"}</h2>
            <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
              <RichTextEditor value={formData.questionText} onChange={(v) => handleInputChange("questionText", v)} height={150} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
              <div className="space-y-3">
                {formData.options.map((opt, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">{opt.letter}</span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${opt.letter}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    {formData.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {formData.options.length < 6 && (
                  <button type="button" onClick={addOption} className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Plus className="w-4 h-4" /> Add Option
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
              <select
                value={formData.correctAnswer}
                onChange={(e) => handleInputChange("correctAnswer", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">Select correct answer</option>
                {formData.options.filter((o) => o.text.trim()).map((opt) => (
                  <option key={opt.letter} value={opt.letter}>{opt.letter}: {stripHtmlToText(opt.text)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
              <input
                type="number"
                min="1"
                value={formData.points}
                onChange={(e) => handleInputChange("points", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isEditing ? "Update" : "Add"} Question
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
  return createPortal(formModal, document.body);
}
