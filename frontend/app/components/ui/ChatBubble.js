import React from 'react';

export default function ChatBubble({ message, isSelf, senderName, timestamp }) {
    return (
        <div className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} mb-4`}>
            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-600">{senderName}</span>
                <span className="text-[10px] text-slate-400">{timestamp}</span>
            </div>
            <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm ${isSelf
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                    }`}
            >
                {message}
            </div>
        </div>
    );
}
