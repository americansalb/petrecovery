'use client';

import React, { useState } from 'react';
import GlassCard from '@/app/components/ui/GlassCard';
import StatusBadge from '@/app/components/ui/StatusBadge';
import ChatBubble from '@/app/components/ui/ChatBubble';
import ActionFab from '@/app/components/ui/ActionFab';

// Mock Data for "Cooper" Case
const MOCK_CASE = {
    petName: 'Cooper',
    petPhotoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80',
    status: 'ACTIVE_SEARCH',
    breed: 'Golden Retriever',
    lastSeen: '2 hours ago',
    location: 'Lincoln Park, near Zoo entrance',
    description: 'Friendly but skittish. Wearing a blue collar with tags. Loves cheese.',
};

const MOCK_MESSAGES = [
    { id: 1, sender: 'Sarah (Leader)', text: 'Team, we have a confirmed sighting near the North Pond.', timestamp: '10:42 AM', isSelf: false },
    { id: 2, sender: 'Mike', text: 'I am heading there now. ETA 5 mins.', timestamp: '10:43 AM', isSelf: true },
    { id: 3, sender: 'Sarah (Leader)', text: 'Great. Keep an eye out for the blue collar.', timestamp: '10:44 AM', isSelf: false },
    { id: 4, sender: 'Jen', text: 'I am covering the south entrance. No sign yet.', timestamp: '10:45 AM', isSelf: false },
];

const MOCK_TIMELINE = [
    { id: 1, type: 'sighting', text: 'Sighting reported at North Pond', time: '10:40 AM', verified: true },
    { id: 2, type: 'sector', text: 'Sector 4 (Zoo Parking) cleared', time: '10:15 AM', verified: true },
    { id: 3, type: 'join', text: 'Mike joined the search', time: '09:55 AM', verified: false },
    { id: 4, type: 'start', text: 'Search operation started', time: '09:30 AM', verified: true },
];

export default function CoordinationDashboard() {
    const [messageInput, setMessageInput] = useState('');

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* LEFT COLUMN: SQUAD COMMS (25%) */}
            <div className="w-1/4 p-4 flex flex-col gap-4 z-10">
                <GlassCard className="flex-1 flex flex-col min-h-0" padding="p-0">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur-sm rounded-t-2xl">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-xl">💬</span> Squad Comms
                        </h2>
                        <div className="text-xs text-slate-500 mt-1">4 members online</div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                        {MOCK_MESSAGES.map((msg) => (
                            <ChatBubble
                                key={msg.id}
                                message={msg.text}
                                senderName={msg.sender}
                                timestamp={msg.timestamp}
                                isSelf={msg.isSelf}
                            />
                        ))}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-slate-100 rounded-b-2xl">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 px-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* CENTER COLUMN: MAP (50%) */}
            <div className="w-1/2 py-4 relative">
                <div className="absolute inset-4 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-200 group">
                    {/* Map Placeholder Image/Component */}
                    <div className="w-full h-full bg-[url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/-87.6359,41.9214,14,0/800x600?access_token=pk.mock')] bg-cover bg-center relative">
                        {/* Fallback pattern if image fails */}
                        <div className="absolute inset-0 bg-slate-100 opacity-50 pattern-grid-lg text-slate-300" />

                        {/* Mock Map Markers */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                            <div className="relative">
                                <div className="w-16 h-16 bg-rose-500/20 rounded-full animate-ping absolute inset-0" />
                                <div className="w-16 h-16 border-4 border-white shadow-lg rounded-full overflow-hidden relative z-10">
                                    <img src={MOCK_CASE.petPhotoUrl} className="w-full h-full object-cover" alt="Pet" />
                                </div>
                                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap z-20">
                                    Last Seen
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Action Buttons */}
                    <div className="absolute bottom-8 right-8 flex flex-col gap-3">
                        <ActionFab icon="👁️" label="Report Sighting" variant="urgent" onClick={() => alert('Report Sighting Clicked')} />
                        <ActionFab icon="📍" label="Mark Area" variant="primary" onClick={() => alert('Mark Area Clicked')} />
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: CASE INTEL (25%) */}
            <div className="w-1/4 p-4 flex flex-col gap-4 z-10">
                {/* Pet Profile Card */}
                <GlassCard className="flex flex-col items-center text-center">
                    <div className="relative w-32 h-32 mb-4">
                        <img
                            src={MOCK_CASE.petPhotoUrl}
                            alt={MOCK_CASE.petName}
                            className="w-full h-full object-cover rounded-full border-4 border-white shadow-md"
                        />
                        <div className="absolute bottom-0 right-0">
                            <StatusBadge status="MISSING" variant="urgent" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">{MOCK_CASE.petName}</h1>
                    <p className="text-slate-500 text-sm mb-4">{MOCK_CASE.breed}</p>

                    <div className="w-full space-y-3 text-left bg-white/50 p-4 rounded-xl text-sm">
                        <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase">Last Seen</div>
                            <div className="font-medium text-slate-700">{MOCK_CASE.location}</div>
                            <div className="text-xs text-slate-500">{MOCK_CASE.lastSeen}</div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase">Description</div>
                            <div className="text-slate-600 leading-relaxed">{MOCK_CASE.description}</div>
                        </div>
                    </div>
                </GlassCard>

                {/* Timeline Card */}
                <GlassCard className="flex-1 min-h-0 flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="text-xl">⏱️</span> Activity Log
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {MOCK_TIMELINE.map((event) => (
                            <div key={event.id} className="flex gap-3 relative">
                                {/* Timeline Line */}
                                <div className="absolute left-[11px] top-6 bottom-[-16px] w-0.5 bg-slate-200 last:hidden" />

                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${event.type === 'sighting' ? 'bg-rose-100 text-rose-600' :
                                        event.type === 'sector' ? 'bg-emerald-100 text-emerald-600' :
                                            'bg-slate-100 text-slate-500'
                                    }`}>
                                    <div className="w-2 h-2 rounded-full bg-current" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-700">{event.text}</div>
                                    <div className="text-xs text-slate-400">{event.time}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
