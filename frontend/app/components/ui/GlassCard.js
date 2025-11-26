import React from 'react';

export default function GlassCard({ children, className = '', padding = 'p-6' }) {
    return (
        <div className={`glass rounded-2xl shadow-lg ${padding} ${className}`}>
            {children}
        </div>
    );
}
