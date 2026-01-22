/**
 * Sarama Chat Engine - Core conversation logic
 * 
 * Sarama is the empathetic AI companion for ReunitePets.org.
 * Named after the divine dog from the Rig Veda who tracked and found what was lost.
 */

// Emotional states Sarama can detect and respond to
export const EMOTIONAL_STATES = {
    DISTRESSED: 'distressed',
    ANXIOUS: 'anxious',
    CALM: 'calm',
    HOPEFUL: 'hopeful',
    URGENT: 'urgent'
};

// Context types for different reporting flows
export const CONTEXT_TYPES = {
    LOST_PET: 'lost_pet',
    FOUND_PET: 'found_pet',
    FOLLOW_UP: 'follow_up',
    GENERAL: 'general'
};

/**
 * Detect emotional state from user message
 */
export function detectEmotionalState(message) {
    const text = message.toLowerCase();

    // High distress indicators
    const distressPatterns = [
        /don'?t know what to do/,
        /so scared/,
        /panicking/,
        /please help/,
        /desperate/,
        /can'?t stop crying/,
        /heart is breaking/
    ];

    // Urgency indicators
    const urgencyPatterns = [
        /injured/,
        /bleeding/,
        /hit by/,
        /accident/,
        /dangerous/,
        /emergency/,
        /critical/,
        /dying/
    ];

    // Hopelessness indicators  
    const hopelessPatterns = [
        /give up/,
        /no hope/,
        /never find/,
        /it'?s been too long/,
        /lost cause/,
        /pointless/
    ];

    // Check patterns
    for (const pattern of urgencyPatterns) {
        if (pattern.test(text)) return EMOTIONAL_STATES.URGENT;
    }

    for (const pattern of distressPatterns) {
        if (pattern.test(text)) return EMOTIONAL_STATES.DISTRESSED;
    }

    for (const pattern of hopelessPatterns) {
        if (pattern.test(text)) return EMOTIONAL_STATES.ANXIOUS;
    }

    // Positive indicators
    if (/thank|hopeful|better|okay|fine/.test(text)) {
        return EMOTIONAL_STATES.HOPEFUL;
    }

    return EMOTIONAL_STATES.CALM;
}

/**
 * Build the system prompt for Sarama based on context
 */
export function buildSystemPrompt(context = {}) {
    const {
        contextType = CONTEXT_TYPES.LOST_PET,
        petName = null,
        emotionalState = EMOTIONAL_STATES.CALM,
        collectedData = {},
        currentStep = null
    } = context;

    const missingFields = getMissingFields(collectedData);

    return `You are Sarama, a caring AI companion for ReunitePets.org. Your name comes from the divine dog in the Rig Veda who tracked and found what was lost.

PERSONALITY:
- Warm, empathetic, and patient
- Never use corporate jargon
- Keep responses to 2-4 sentences
- Ask ONE question at a time
- If user seems in crisis, offer human support hotline: 1-888-PETFIND

CURRENT CONTEXT:
- Flow: ${contextType}
${petName ? `- Pet name: ${petName}` : ''}
- User emotional state: ${emotionalState}
- Step: ${currentStep || 'introduction'}
- Data collected: ${Object.keys(collectedData).filter(k => collectedData[k]).join(', ') || 'none yet'}
- Still needed: ${missingFields.join(', ') || 'all collected!'}

RESPONSE STYLE BASED ON EMOTION:
${emotionalState === EMOTIONAL_STATES.URGENT ? '- This is URGENT. Offer emergency contacts immediately.' : ''}
${emotionalState === EMOTIONAL_STATES.DISTRESSED ? '- Extra reassurance and slower pace. Validate feelings.' : ''}
${emotionalState === EMOTIONAL_STATES.ANXIOUS ? '- Share success stories. Remind them most pets are found.' : ''}
${emotionalState === EMOTIONAL_STATES.CALM ? '- Normal conversational flow.' : ''}
${emotionalState === EMOTIONAL_STATES.HOPEFUL ? '- Match their energy positively.' : ''}

IMPORTANT: Guide them through the lost pet report naturally. Collect information conversationally, not like a form.`;
}

/**
 * Get list of fields still needed for report
 */
function getMissingFields(collectedData) {
    const requiredFields = ['petType', 'petName', 'color', 'location', 'timeElapsed'];
    return requiredFields.filter(f => !collectedData[f]);
}

/**
 * Generate conversation templates for common scenarios
 */
export const TEMPLATES = {
    greeting: {
        lost_pet: "I'm so sorry to hear your pet is missing. I'm Sarama, and I'm here to help you find them. Let's create an alert right away - what's your pet's name?",
        found_pet: "That's wonderful that you're helping a lost pet! I'm Sarama. Let's get this little one home safely. What kind of animal did you find?"
    },

    encouragement: [
        "You're doing everything right. Let's keep going.",
        "Many pets are found within the first 48 hours. We're going to do everything we can.",
        "I know this is hard, but you're taking the right steps."
    ],

    crisis: "I can hear how worried you are. If this is an emergency with an injured pet, please call animal control at your local number immediately. Would you like me to help you find that number?",

    success: (petName) => `Perfect! I've sent alerts for ${petName} to local rescue teams. Your case number is now active. I'll check in with you tomorrow to see how things are going.`
};

/**
 * Format a message from Sarama with metadata
 */
export function formatSaramaMessage(content, metadata = {}) {
    return {
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        sender: 'sarama',
        ...metadata
    };
}

/**
 * Format a user message
 */
export function formatUserMessage(content) {
    return {
        role: 'user',
        content,
        timestamp: new Date().toISOString()
    };
}

export default {
    detectEmotionalState,
    buildSystemPrompt,
    TEMPLATES,
    EMOTIONAL_STATES,
    CONTEXT_TYPES,
    formatSaramaMessage,
    formatUserMessage
};
