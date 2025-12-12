'use client';

/**
 * FeedbackWidget Component
 *
 * Collects user feedback for continuous improvement.
 * Features:
 * - Quick emoji reactions
 * - Detailed feedback form
 * - Context-aware (knows which feature user is providing feedback on)
 * - Bug report option
 *
 * Per Actions_Guide.md Phase 7 specification.
 */

import { useState, useCallback } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, Meh, Bug, X, Send, Loader2 } from 'lucide-react';

// =============================================================================
// FEEDBACK HOOK
// =============================================================================

export function useFeedback(options = {}) {
  const { missionId, feature, userId } = options;

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const submitFeedback = useCallback(async (feedback) => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...feedback,
          missionId,
          feature,
          userId,
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSubmitted(true);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSubmitting(false);
    }
  }, [missionId, feature, userId]);

  const reset = useCallback(() => {
    setSubmitted(false);
    setError(null);
  }, []);

  return {
    submitting,
    submitted,
    error,
    submitFeedback,
    reset,
  };
}

// =============================================================================
// FEEDBACK WIDGET COMPONENT
// =============================================================================

export default function FeedbackWidget({
  missionId,
  feature = 'general',
  userId,
  variant = 'floating', // 'floating' | 'inline' | 'modal'
  onClose,
  className = '',
}) {
  const { submitting, submitted, error, submitFeedback, reset } = useFeedback({
    missionId,
    feature,
    userId,
  });

  const [isOpen, setIsOpen] = useState(variant !== 'floating');
  const [step, setStep] = useState('rating'); // 'rating' | 'details' | 'done'
  const [rating, setRating] = useState(null); // 'positive' | 'neutral' | 'negative' | 'bug'
  const [feedbackText, setFeedbackText] = useState('');
  const [category, setCategory] = useState('general');

  // Handle rating selection
  const handleRating = (ratingValue) => {
    setRating(ratingValue);
    if (ratingValue === 'bug') {
      setCategory('bug');
    }
    setStep('details');
  };

  // Handle submit
  const handleSubmit = async () => {
    const result = await submitFeedback({
      rating,
      category,
      message: feedbackText,
      feature,
    });

    if (result.success) {
      setStep('done');
    }
  };

  // Handle close
  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  // Success state
  if (submitted || step === 'done') {
    return (
      <FeedbackContainer variant={variant} className={className}>
        <div className="text-center py-6">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-lg font-bold text-white mb-1">Thank you!</h3>
          <p className="text-slate-400 text-sm">Your feedback helps us improve.</p>
          <button
            onClick={() => {
              reset();
              setStep('rating');
              setRating(null);
              setFeedbackText('');
              if (variant === 'floating') setIsOpen(false);
            }}
            className="mt-4 text-flash-400 text-sm hover:underline"
          >
            Submit more feedback
          </button>
        </div>
      </FeedbackContainer>
    );
  }

  // Floating button (collapsed state)
  if (variant === 'floating' && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 z-50 p-3 bg-slate-800 border border-slate-700 rounded-full shadow-lg hover:bg-slate-700 transition group ${className}`}
        title="Send feedback"
      >
        <MessageSquare size={20} className="text-slate-400 group-hover:text-flash-400" />
      </button>
    );
  }

  return (
    <FeedbackContainer variant={variant} onClose={handleClose} className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Send Feedback</h3>
        {(variant === 'floating' || variant === 'modal') && (
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Rating step */}
      {step === 'rating' && (
        <div>
          <p className="text-slate-400 text-sm mb-4">How is your experience?</p>
          <div className="flex justify-center gap-4">
            <RatingButton
              icon={<ThumbsUp size={24} />}
              label="Good"
              color="emerald"
              onClick={() => handleRating('positive')}
            />
            <RatingButton
              icon={<Meh size={24} />}
              label="Okay"
              color="amber"
              onClick={() => handleRating('neutral')}
            />
            <RatingButton
              icon={<ThumbsDown size={24} />}
              label="Bad"
              color="red"
              onClick={() => handleRating('negative')}
            />
            <RatingButton
              icon={<Bug size={24} />}
              label="Bug"
              color="purple"
              onClick={() => handleRating('bug')}
            />
          </div>
        </div>
      )}

      {/* Details step */}
      {step === 'details' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setStep('rating')}
              className="text-slate-500 hover:text-white text-sm"
            >
              ← Back
            </button>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 text-sm">
              {rating === 'positive' && '👍 Positive feedback'}
              {rating === 'neutral' && '😐 Neutral feedback'}
              {rating === 'negative' && '👎 Negative feedback'}
              {rating === 'bug' && '🐛 Bug report'}
            </span>
          </div>

          {/* Category selector (for non-bug) */}
          {rating !== 'bug' && (
            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-flash-500"
              >
                <option value="general">General</option>
                <option value="tasks">Tasks & Actions</option>
                <option value="search">Search & GPS</option>
                <option value="flyers">Flyers</option>
                <option value="shelters">Shelter Contacts</option>
                <option value="scout">Scout Tips</option>
                <option value="points">Points & Rewards</option>
                <option value="design">Design & UI</option>
                <option value="performance">Performance</option>
              </select>
            </div>
          )}

          {/* Feedback text */}
          <div className="mb-4">
            <label className="block text-slate-400 text-sm mb-2">
              {rating === 'bug' ? 'Describe the bug' : 'Tell us more (optional)'}
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={
                rating === 'bug'
                  ? 'What happened? What did you expect to happen?'
                  : 'Share your thoughts...'
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-flash-500 resize-none"
              rows={4}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || (rating === 'bug' && !feedbackText.trim())}
            className="w-full py-2 px-4 bg-flash-500 text-white rounded-lg font-semibold hover:bg-flash-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={16} />
                Send Feedback
              </>
            )}
          </button>
        </div>
      )}

      {/* Feature tag */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <p className="text-slate-600 text-xs text-center">
          Feedback about: <span className="text-slate-500">{feature}</span>
        </p>
      </div>
    </FeedbackContainer>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function FeedbackContainer({ variant, onClose, className, children }) {
  if (variant === 'floating') {
    return (
      <div className={`fixed bottom-4 right-4 z-50 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 ${className}`}>
        {children}
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className={`w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 ${className}`}>
          {children}
        </div>
      </div>
    );
  }

  // Inline variant
  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function RatingButton({ icon, label, color, onClick }) {
  const colorClasses = {
    emerald: 'hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-400',
    amber: 'hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-400',
    red: 'hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400',
    purple: 'hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-purple-400',
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-700 text-slate-400 transition ${colorClasses[color]}`}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}

// =============================================================================
// QUICK FEEDBACK BUTTON
// =============================================================================

export function QuickFeedbackButton({ feature, missionId, userId, className = '' }) {
  const [showWidget, setShowWidget] = useState(false);

  if (showWidget) {
    return (
      <FeedbackWidget
        feature={feature}
        missionId={missionId}
        userId={userId}
        variant="modal"
        onClose={() => setShowWidget(false)}
      />
    );
  }

  return (
    <button
      onClick={() => setShowWidget(true)}
      className={`flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-white text-sm hover:bg-slate-800 rounded-lg transition ${className}`}
    >
      <MessageSquare size={14} />
      Feedback
    </button>
  );
}
