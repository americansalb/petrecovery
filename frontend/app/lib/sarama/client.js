/**
 * Sarama API Client
 * 
 * Client-side functions for interacting with the Sarama API endpoint.
 * Handles streaming responses and conversation state.
 */

/**
 * Send a message to Sarama and get a response
 * @param {Object} params - Message parameters
 * @returns {Promise<Object>} - Sarama's response
 */
export async function sendMessage({ message, conversationHistory = [], context = {} }) {
    const response = await fetch('/api/sarama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            history: conversationHistory,
            context
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to get response from Sarama');
    }

    return response.json();
}

/**
 * Send a message with streaming response
 * @param {Object} params - Message parameters  
 * @param {Function} onChunk - Callback for each streamed chunk
 * @returns {Promise<string>} - Complete response
 */
export async function sendMessageStream({ message, conversationHistory = [], context = {} }, onChunk) {
    const response = await fetch('/api/sarama/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            history: conversationHistory,
            context
        })
    });

    if (!response.ok) {
        throw new Error('Failed to connect to Sarama');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullResponse += chunk;
        onChunk?.(chunk, fullResponse);
    }

    return fullResponse;
}

/**
 * Initialize a new conversation with Sarama
 * @param {string} contextType - 'lost_pet', 'found_pet', etc.
 * @returns {Promise<Object>} - Initial greeting and conversation ID
 */
export async function startConversation(contextType = 'lost_pet') {
    const response = await fetch('/api/sarama/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextType })
    });

    if (!response.ok) {
        throw new Error('Failed to start conversation');
    }

    return response.json();
}

/**
 * Save conversation state (for resume functionality)
 */
export async function saveConversationState(conversationId, state) {
    // Store in localStorage for now, can extend to server-side later
    if (typeof window !== 'undefined') {
        localStorage.setItem(`sarama_conv_${conversationId}`, JSON.stringify({
            ...state,
            savedAt: new Date().toISOString()
        }));
    }
}

/**
 * Resume a saved conversation
 */
export function resumeConversation(conversationId) {
    if (typeof window === 'undefined') return null;

    const saved = localStorage.getItem(`sarama_conv_${conversationId}`);
    if (!saved) return null;

    try {
        const state = JSON.parse(saved);
        // Check if conversation is less than 7 days old
        const savedAt = new Date(state.savedAt);
        const now = new Date();
        const daysDiff = (now - savedAt) / (1000 * 60 * 60 * 24);

        if (daysDiff > 7) {
            localStorage.removeItem(`sarama_conv_${conversationId}`);
            return null;
        }

        return state;
    } catch {
        return null;
    }
}

export default {
    sendMessage,
    sendMessageStream,
    startConversation,
    saveConversationState,
    resumeConversation
};
