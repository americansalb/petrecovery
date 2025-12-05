'use client';

/**
 * CustomActionModal - Log a custom action
 *
 * Features preserved from original:
 * - Action name input
 * - Details/notes input
 * - Submit callback with action data
 */

import { useState } from 'react';

export default function CustomActionModal({ onClose, onComplete }) {
  const [actionName, setActionName] = useState('');
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    if (!actionName.trim()) return;
    onComplete({ actionName: actionName.trim(), details: details.trim() });
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-t sm:border border-flash-500/30 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Log Custom Action</h2>
          <p className="text-slate-400 text-sm mt-1">Record something you did to help the search</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Action Name */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">
              What did you do?
            </label>
            <input
              type="text"
              value={actionName}
              onChange={(e) => setActionName(e.target.value)}
              placeholder="e.g., Posted on community board, Called pet stores..."
              className="w-full bg-slate-800 text-white rounded-xl p-4 border border-slate-700 focus:border-flash-500 focus:outline-none placeholder-slate-500"
              autoFocus
            />
          </div>

          {/* Details */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">
              Details <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Any additional notes or details..."
              className="w-full bg-slate-800 text-white rounded-xl p-4 border border-slate-700 focus:border-flash-500 focus:outline-none resize-none placeholder-slate-500"
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!actionName.trim()}
            className={`flex-1 py-3 font-bold rounded-xl transition ${
              actionName.trim()
                ? 'bg-gradient-to-r from-flash-500 to-flash-400 text-slate-900 hover:scale-105'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            Log Action
          </button>
        </div>
      </div>
    </div>
  );
}
