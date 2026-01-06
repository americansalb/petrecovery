'use client';

/**
 * SaramaTab - Sarama AI Companion Tab for Mission Control
 *
 * Sarama is everyone's first rescue squad member - automatically assigned
 * to every case from the moment it's created.
 *
 * Features:
 * - Conversational chat interface
 * - Daily check-ins with tips
 * - Action checklists
 * - Emotional support
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Loader2, Check, Heart, Sparkles, Clock, Phone } from 'lucide-react';
import { SARAMA_AVATAR } from '@/lib/brandAssets';

// Daily tips based on days since pet went missing
const DAILY_TIPS = {
    0: {
        title: "First hours are critical",
        tips: [
            "Walk your neighborhood calling their name",
            "Put their bed or your worn shirt outside",
            "Leave water and food by your door",
            "Check under porches, decks, and bushes nearby"
        ],
        message: "I know you're worried. The first 24 hours are actually your best chance - most pets are found close to home. Let's focus on the immediate area."
    },
    1: {
        title: "Expand your search",
        tips: [
            "Post in neighborhood Facebook groups",
            "Call the 3 closest animal shelters",
            "Put up flyers within 1 mile radius",
            "Walk the route at dawn and dusk"
        ],
        message: "Day 2 can feel harder, but you're doing everything right. Today let's widen the net and get more eyes looking."
    },
    2: {
        title: "Keep the momentum",
        tips: [
            "Revisit shelters in person (websites lag behind)",
            "Leave scent items at your last-seen location",
            "Ask mail carriers and delivery drivers - they cover every street",
            "Post in lost pet Facebook groups"
        ],
        message: "By day 3, many pets start to settle in a hiding spot. They might be closer than you think, just scared. Keep calling softly."
    },
    7: {
        title: "Don't lose hope",
        tips: [
            "Pets have been found weeks and even months later",
            "Set humane traps if your pet is skittish",
            "Keep checking shelters weekly",
            "Consider hiring a pet detective or tracker"
        ],
        message: "A week feels like forever, I know. But pets are found every day after much longer. Stay strong - I'm still here with you."
    },
    default: {
        title: "Still searching together",
        tips: [
            "Refresh your flyers - they weather over time",
            "Post on Craigslist, Nextdoor, and Pawboost",
            "Consider motion-activated cameras in your yard",
            "Keep your scent items fresh at the last-seen spot"
        ],
        message: "Time doesn't change what's possible. Pets have been reunited after months - even years. Every day is a new chance."
    }
};

// Get tips for current day
function getTipsForDay(daysMissing) {
    if (daysMissing <= 0) return DAILY_TIPS[0];
    if (daysMissing === 1) return DAILY_TIPS[1];
    if (daysMissing <= 3) return DAILY_TIPS[2];
    if (daysMissing <= 7) return DAILY_TIPS[7];
    return DAILY_TIPS.default;
}

export default function SaramaTab({ mission, showNotification, session }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [completedTips, setCompletedTips] = useState([]);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Calculate days missing
    const daysMissing = useMemo(() => {
        if (!mission?.createdAt) return 0;
        const created = new Date(mission.createdAt);
        const now = new Date();
        return Math.floor((now - created) / (1000 * 60 * 60 * 24));
    }, [mission?.createdAt]);

    // Get today's tips
    const todaysTips = useMemo(() => getTipsForDay(daysMissing), [daysMissing]);

    // Load completed tips from localStorage
    useEffect(() => {
        if (mission?.id) {
            const saved = localStorage.getItem(`sarama_tips_${mission.id}`);
            if (saved) {
                try {
                    setCompletedTips(JSON.parse(saved));
                } catch { }
            }
        }
    }, [mission?.id]);

    // Save completed tips
    const toggleTip = (tipIndex) => {
        const newCompleted = completedTips.includes(tipIndex)
            ? completedTips.filter(i => i !== tipIndex)
            : [...completedTips, tipIndex];

        setCompletedTips(newCompleted);
        if (mission?.id) {
            localStorage.setItem(`sarama_tips_${mission.id}`, JSON.stringify(newCompleted));
        }

        // Show encouragement on completion
        if (!completedTips.includes(tipIndex)) {
            showNotification?.('success', 'Nice work! Keep it up 💪');
        }
    };

    // Initial greeting
    useEffect(() => {
        if (messages.length === 0) {
            const petName = mission?.petName || 'your pet';
            setMessages([{
                role: 'assistant',
                content: todaysTips.message.replace('{petName}', petName),
                timestamp: new Date().toISOString()
            }]);
        }
    }, [todaysTips.message, mission?.petName]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle send
    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/sarama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input.trim(),
                    conversationHistory: messages,
                    mode: 'companion',
                    collectedData: {
                        petName: mission?.petName,
                        petType: mission?.petSpecies,
                        daysMissing,
                    }
                })
            });

            const data = await response.json();

            if (response.ok && data.message) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message,
                    timestamp: new Date().toISOString()
                }]);
            } else {
                throw new Error(data.error || 'Failed to respond');
            }
        } catch (error) {
            console.error('Sarama error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm having a moment - let me try again. In the meantime, check the tips below or ask me anything about finding your pet.",
                timestamp: new Date().toISOString(),
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const completedCount = completedTips.length;
    const totalTips = todaysTips.tips.length;

    return (
        <div className="flex flex-col h-full min-h-[500px]">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-700/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                <div className="relative">
                    <img
                        src={SARAMA_AVATAR}
                        alt="Sarama"
                        className="w-12 h-12"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900" />
                </div>
                <div className="flex-1">
                    <h2 className="font-bold text-white flex items-center gap-2">
                        Sarama
                        <Sparkles size={14} className="text-amber-400" />
                    </h2>
                    <p className="text-xs text-slate-400">Your guide • Day {daysMissing + 1} of search</p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold text-amber-400">{completedCount}/{totalTips}</div>
                    <div className="text-xs text-slate-500">today's tasks</div>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        {msg.role === 'assistant' && (
                            <img
                                src={SARAMA_AVATAR}
                                alt=""
                                className="w-8 h-8 flex-shrink-0"
                            />
                        )}
                        <div
                            className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.role === 'user'
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-br-md'
                                    : msg.isError
                                        ? 'bg-red-500/10 border border-red-500/30 text-slate-300 rounded-bl-md'
                                        : 'bg-slate-800 border border-slate-700/50 text-slate-200 rounded-bl-md'
                                }`}
                        >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                    <div className="flex gap-3">
                        <img src={SARAMA_AVATAR} alt="" className="w-8 h-8" />
                        <div className="bg-slate-800 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-bl-md">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Today's Actions Checklist */}
            <div className="border-t border-slate-700/50 bg-slate-800/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Clock size={16} className="text-amber-400" />
                    <h3 className="text-white font-semibold text-sm">{todaysTips.title}</h3>
                </div>
                <div className="space-y-2">
                    {todaysTips.tips.map((tip, idx) => {
                        const isCompleted = completedTips.includes(idx);
                        return (
                            <button
                                key={idx}
                                onClick={() => toggleTip(idx)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${isCompleted
                                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                                        : 'bg-slate-700/30 border border-slate-700/50 hover:border-amber-500/50'
                                    }`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-emerald-500' : 'bg-slate-700'
                                    }`}>
                                    {isCompleted ? (
                                        <Check size={14} className="text-white" />
                                    ) : (
                                        <span className="w-2 h-2 bg-slate-500 rounded-full" />
                                    )}
                                </div>
                                <span className={`text-sm ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                                    {tip}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-900">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask Sarama anything..."
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Send size={20} />
                        )}
                    </button>
                </div>

                {/* Emergency contact */}
                <div className="flex items-center justify-center gap-2 mt-3 text-slate-500 text-xs">
                    <Phone size={12} />
                    <span>Need urgent help? Call <a href="tel:1-888-738-3463" className="text-amber-400 hover:underline">1-888-PETFIND</a></span>
                </div>
            </div>
        </div>
    );
}
