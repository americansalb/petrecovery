'use client';

/**
 * SaramaChat - AI-powered guide component
 *
 * Features:
 * - Conversational interface for lost pet wizard
 * - Quick reply buttons + free text input
 * - Clicking a button fills the text input
 * - Sarama mascot representation
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { SARAMA_AVATAR } from '@/lib/brandAssets';

// Sarama's avatar - official mascot logo
function SaramaAvatar({ size = 'md', isThinking = false }) {
  const sizes = {
    sm: 32,
    md: 40,
    lg: 56,
  };

  return (
    <div className="relative">
      <img
        src={SARAMA_AVATAR}
        alt="Sarama"
        width={sizes[size]}
        height={sizes[size]}
        className={isThinking ? 'animate-pulse' : ''}
        style={{ width: sizes[size], height: sizes[size] }}
      />
      {isThinking && (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
          <Loader2 size={10} className="text-amber-500 animate-spin" />
        </div>
      )}
    </div>
  );
}

// Initial greeting message
const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Hi, I'm Sarama! I'm here to help you get your lost pet alert out as fast as possible. What kind of pet went missing?",
  quickReplies: ["Dog", "Cat", "Bird", "Other"],
};

export default function SaramaChat({
  onDataCollected,
  onWizardComplete,
  initialData = {},
  className = '',
}) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [collectedData, setCollectedData] = useState(initialData);
  const [currentQuickReplies, setCurrentQuickReplies] = useState(INITIAL_MESSAGE.quickReplies);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle quick reply click - fills the text input
  const handleQuickReplyClick = (text) => {
    setInputValue(text);
    inputRef.current?.focus();
  };

  // Handle sending a message
  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;

    // Add user message to chat
    const userMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setCurrentQuickReplies([]);
    setIsLoading(true);

    try {
      // Build conversation history (exclude the latest user message)
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/sarama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory,
          mode: 'wizard',
          collectedData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Add Sarama's response
      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        quickReplies: data.quickReplies || [],
      };
      setMessages(prev => [...prev, assistantMessage]);
      setCurrentQuickReplies(data.quickReplies || []);

      // Update collected data
      if (data.extractedData) {
        const newData = { ...collectedData, ...data.extractedData };
        setCollectedData(newData);
        onDataCollected?.(newData);
      }

      // Check if wizard is complete
      if (data.wizardComplete && data.extractedData) {
        onWizardComplete?.(data.extractedData);
      }

    } catch (error) {
      console.error('Sarama error:', error);
      // Add error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having a little trouble right now. Let me try a different approach - can you tell me what type of pet is missing?",
        quickReplies: ["Dog", "Cat", "Bird", "Other"],
        isError: true,
      }]);
      setCurrentQuickReplies(["Dog", "Cat", "Bird", "Other"]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-gradient-to-br from-amber-50 via-white to-orange-50 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-100 bg-white/80 backdrop-blur-sm">
        <SaramaAvatar size="md" isThinking={isLoading} />
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-1.5">
            Sarama
            <Sparkles size={14} className="text-amber-500" />
          </h2>
          <p className="text-xs text-gray-500">Your pet recovery guide</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0">
                <SaramaAvatar size="sm" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-md'
                  : msg.isError
                    ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-md'
                    : 'bg-white border border-amber-100 text-gray-800 shadow-sm rounded-bl-md'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <SaramaAvatar size="sm" isThinking />
            </div>
            <div className="bg-white border border-amber-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {currentQuickReplies.length > 0 && !isLoading && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {currentQuickReplies.map((reply, index) => (
              <button
                key={index}
                onClick={() => handleQuickReplyClick(reply)}
                className="px-4 py-2 bg-white border-2 border-amber-200 text-amber-700 rounded-full text-sm font-medium hover:bg-amber-50 hover:border-amber-300 transition-all active:scale-95"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-amber-100 bg-white/80 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message or tap a suggestion..."
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:border-amber-400 focus:bg-white focus:outline-none transition-all"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={`p-3 rounded-2xl transition-all ${
              inputValue.trim() && !isLoading
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            <Send size={20} />
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-2">
          Ask Sarama anything or use the quick suggestions above
        </p>
      </div>
    </div>
  );
}
