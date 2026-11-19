"use client";

import { Plus, Trash2 } from "lucide-react";

export default function InstructionListEditor({ items = [], onChange }) {
  const updateItem = (index, value) => {
    onChange(items.map((item, i) => (i === index ? value : item)));
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, ""]);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Numbered rules shown to candidates. Edit, delete, or add items.
      </p>
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-2 w-6 shrink-0 text-sm font-semibold text-gray-500">
            {index + 1}.
          </span>
          <textarea
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            rows={2}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            placeholder="Enter an instruction"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="mt-1 p-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete instruction"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900"
      >
        <Plus className="w-4 h-4" />
        Add instruction
      </button>
    </div>
  );
}
