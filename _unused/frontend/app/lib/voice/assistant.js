/**
 * Phase 23: Voice & Conversational UI
 * Voice commands, AI chatbot, Alexa/Google integration
 */

// Intent definitions for voice commands
export const VOICE_INTENTS = {
  REPORT_SIGHTING: {
    id: 'report_sighting',
    phrases: [
      'I saw a lost pet',
      'I found a dog',
      'I found a cat',
      'Report a sighting',
      'I spotted a lost animal',
    ],
    slots: ['species', 'color', 'location'],
  },
  SEARCH_STATUS: {
    id: 'search_status',
    phrases: [
      'What is the status of my search',
      'Any updates on my pet',
      'Have you found my dog',
      'Status update',
    ],
    slots: ['petName', 'missionNumber'],
  },
  START_SEARCH: {
    id: 'start_search',
    phrases: [
      'Start searching',
      'Begin search session',
      'I want to help search',
      'Join the search',
    ],
    slots: ['missionNumber', 'location'],
  },
  GET_DIRECTIONS: {
    id: 'get_directions',
    phrases: [
      'Navigate to search area',
      'Get directions to the search',
      'How do I get to the search location',
    ],
    slots: ['missionNumber'],
  },
  REPORT_FOUND: {
    id: 'report_found',
    phrases: [
      'I found the pet',
      'The pet has been found',
      'We found the dog',
      'Mission accomplished',
    ],
    slots: ['missionNumber', 'location'],
  },
};

/**
 * Process voice command and extract intent
 */
export function processVoiceCommand(transcript) {
  const normalizedTranscript = transcript.toLowerCase().trim();

  let bestMatch = null;
  let highestScore = 0;

  for (const [intentName, intent] of Object.entries(VOICE_INTENTS)) {
    for (const phrase of intent.phrases) {
      const score = calculateSimilarity(normalizedTranscript, phrase.toLowerCase());
      if (score > highestScore && score > 0.5) {
        highestScore = score;
        bestMatch = {
          intent: intentName,
          confidence: score,
          originalPhrase: phrase,
        };
      }
    }
  }

  if (!bestMatch) {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      suggestion: 'Try saying: "Report a sighting" or "Start searching"',
    };
  }

  // Extract slots from transcript
  const slots = extractSlots(normalizedTranscript, VOICE_INTENTS[bestMatch.intent].slots);

  return {
    ...bestMatch,
    slots,
    transcript: normalizedTranscript,
  };
}

/**
 * Generate voice response for intent
 */
export function generateVoiceResponse(intent, context = {}) {
  const responses = {
    REPORT_SIGHTING: {
      prompt: `I'll help you report a sighting. What type of animal did you see?`,
      followUp: ['What color was the animal?', 'Where did you see it?'],
    },
    SEARCH_STATUS: {
      prompt: context.missionStatus
        ? `Your case ${context.missionNumber} is currently ${context.missionStatus}. ${context.lastUpdate || ''}`
        : `I couldn't find your case. Please provide a case number.`,
      followUp: [],
    },
    START_SEARCH: {
      prompt: `Great! I'll start your search session. You're searching for ${context.petName || 'the lost pet'} near ${context.location || 'your current location'}.`,
      followUp: ['Say "end search" when you\'re done.'],
    },
    GET_DIRECTIONS: {
      prompt: `Opening navigation to the search area at ${context.address || 'the designated location'}.`,
      followUp: [],
    },
    REPORT_FOUND: {
      prompt: `Wonderful news! I'll notify the pet owner immediately. Can you confirm the location?`,
      followUp: ['The owner will be contacted right away.'],
    },
    UNKNOWN: {
      prompt: `I didn't understand that. You can say things like "Report a sighting" or "Start searching".`,
      followUp: [],
    },
  };

  return responses[intent] || responses.UNKNOWN;
}

/**
 * AI Chatbot conversation handler
 */
export class ChatBot {
  constructor() {
    this.conversationState = {};
    this.maxHistory = 10;
  }

  async processMessage(userId, message, context = {}) {
    // Get or create conversation state
    const state = this.conversationState[userId] || {
      history: [],
      currentIntent: null,
      slots: {},
    };

    // Add message to history
    state.history.push({ role: 'user', content: message, timestamp: Date.now() });
    if (state.history.length > this.maxHistory * 2) {
      state.history = state.history.slice(-this.maxHistory * 2);
    }

    // Process message
    const intent = this.detectIntent(message, state);
    const response = await this.generateResponse(intent, state, context);

    // Update state
    state.currentIntent = intent.name;
    Object.assign(state.slots, intent.slots);
    state.history.push({ role: 'assistant', content: response.text, timestamp: Date.now() });

    this.conversationState[userId] = state;

    return {
      text: response.text,
      actions: response.actions,
      suggestions: response.suggestions,
      intent: intent.name,
    };
  }

  detectIntent(message, state) {
    const lowerMessage = message.toLowerCase();

    // Check for follow-up based on current intent
    if (state.currentIntent === 'REPORT_SIGHTING') {
      // Looking for species, color, location
      if (lowerMessage.includes('dog') || lowerMessage.includes('cat')) {
        return { name: 'SIGHTING_SPECIES', slots: { species: lowerMessage.includes('dog') ? 'dog' : 'cat' } };
      }
    }

    // Greeting
    if (/^(hi|hello|hey|good morning|good afternoon)/i.test(message)) {
      return { name: 'GREETING', slots: {} };
    }

    // Help
    if (/help|what can you do|how do i/i.test(message)) {
      return { name: 'HELP', slots: {} };
    }

    // Report sighting
    if (/sighting|saw a|found a|spotted/i.test(message)) {
      return { name: 'REPORT_SIGHTING', slots: {} };
    }

    // Status check
    if (/status|update|progress|found yet/i.test(message)) {
      return { name: 'CHECK_STATUS', slots: {} };
    }

    // Join search
    if (/join|help search|volunteer|participate/i.test(message)) {
      return { name: 'JOIN_SEARCH', slots: {} };
    }

    // Report lost pet
    if (/lost my|missing|can't find my pet/i.test(message)) {
      return { name: 'REPORT_LOST', slots: {} };
    }

    return { name: 'GENERAL', slots: {} };
  }

  async generateResponse(intent, state, context) {
    const responses = {
      GREETING: {
        text: `Hello! I'm the ReunitePets assistant. I can help you report sightings, check on lost pet cases, or join search efforts. What would you like to do?`,
        suggestions: ['Report a sighting', 'Check my case status', 'Join a search'],
      },
      HELP: {
        text: `I can help you with:\n• Report a lost pet\n• Report a sighting\n• Check case status\n• Join a search party\n• Get directions to search areas\n\nJust ask me anything!`,
        suggestions: ['Report lost pet', 'I saw a lost dog', 'How do searches work?'],
      },
      REPORT_SIGHTING: {
        text: `I'll help you report a sighting! First, what type of animal did you see - a dog, cat, or something else?`,
        suggestions: ['Dog', 'Cat', 'Other animal'],
        actions: [{ type: 'start_flow', flow: 'sighting_report' }],
      },
      SIGHTING_SPECIES: {
        text: `Got it, a ${state.slots.species}! Can you describe its color and any distinctive markings?`,
        suggestions: ['Brown and white', 'Black', 'Gray tabby'],
      },
      CHECK_STATUS: {
        text: context.missionNumber
          ? `Case ${context.missionNumber}: ${context.status || 'Active'}. ${context.lastUpdate || 'No recent updates.'}`
          : `I'd be happy to check on your case. What's your case number? You can find it in your email or dashboard.`,
        suggestions: ['Show my cases', 'Latest sightings'],
      },
      JOIN_SEARCH: {
        text: `That's wonderful that you want to help! There are currently ${context.activeMissions || 'several'} active searches near you. Would you like to see nearby cases or join a rescue force?`,
        suggestions: ['Show nearby cases', 'Join a force', 'How does searching work?'],
        actions: [{ type: 'show_map', filter: 'active_cases' }],
      },
      REPORT_LOST: {
        text: `I'm so sorry to hear your pet is missing. Let's get a search started right away. First, is your pet a dog, cat, or another type of animal?`,
        suggestions: ['Dog', 'Cat', 'Other'],
        actions: [{ type: 'start_flow', flow: 'lost_pet_report' }],
      },
      GENERAL: {
        text: `I'm not sure I understood that. Could you try rephrasing, or pick one of these options?`,
        suggestions: ['Report a sighting', 'Check status', 'Get help'],
      },
    };

    return responses[intent.name] || responses.GENERAL;
  }

  clearConversation(userId) {
    delete this.conversationState[userId];
  }
}

/**
 * Generate Alexa skill response
 */
export function generateAlexaResponse(intent, slots, session) {
  const responses = {
    LaunchRequest: {
      speech: 'Welcome to Pet Recovery. You can report a sighting, check on a lost pet case, or ask for help. What would you like to do?',
      reprompt: 'Say "report sighting" to report seeing a lost pet, or "help" for more options.',
      shouldEndSession: false,
    },
    ReportSightingIntent: {
      speech: `I'll help you report a ${slots.species || 'pet'} sighting. What color was the animal?`,
      reprompt: 'What color was the animal you saw?',
      shouldEndSession: false,
    },
    CheckStatusIntent: {
      speech: `Checking on case ${slots.missionNumber || 'your case'}. Please wait while I retrieve the latest information.`,
      shouldEndSession: false,
    },
    HelpIntent: {
      speech: 'You can say: report a sighting, check my case status, or start searching. What would you like to do?',
      reprompt: 'Say "report sighting" or "check status" to continue.',
      shouldEndSession: false,
    },
    StopIntent: {
      speech: 'Thank you for helping lost pets find their way home. Goodbye!',
      shouldEndSession: true,
    },
  };

  return responses[intent] || responses.HelpIntent;
}

/**
 * Generate Google Assistant response
 */
export function generateGoogleAssistantResponse(intent, parameters, context) {
  const responses = {
    'actions.intent.MAIN': {
      speech: 'Welcome to Pet Recovery! I can help you report sightings of lost pets or check on active cases. What would you like to do?',
      displayText: 'Welcome! Report a sighting or check case status.',
      suggestions: ['Report sighting', 'Case status', 'Help'],
    },
    'report_sighting': {
      speech: `I'll record a ${parameters.species || 'pet'} sighting at ${parameters.location || 'your location'}. Can you describe what the animal looks like?`,
      displayText: 'Describe the animal you saw.',
    },
    'check_status': {
      speech: `Looking up case ${parameters.case_number}...`,
      displayText: `Case ${parameters.case_number} status`,
    },
  };

  return responses[intent] || {
    speech: 'I can help you report a pet sighting or check on a case. What would you like to do?',
    suggestions: ['Report sighting', 'Check status'],
  };
}

/**
 * Transcribe voice to text (wrapper for external service)
 */
export async function transcribeAudio(audioBuffer, options = {}) {
  const { language = 'en-US', sampleRate = 16000 } = options;

  // In production, integrate with:
  // - Google Cloud Speech-to-Text
  // - AWS Transcribe
  // - Azure Speech Services

  // Simulated response
  return {
    transcript: 'I saw a brown dog near the park',
    confidence: 0.92,
    language,
    duration: audioBuffer.length / sampleRate,
  };
}

/**
 * Convert text to speech (wrapper for external service)
 */
export async function synthesizeSpeech(text, options = {}) {
  const { voice = 'en-US-Wavenet-D', speed = 1.0 } = options;

  // In production, integrate with:
  // - Google Cloud Text-to-Speech
  // - AWS Polly
  // - Azure Speech Services

  // Simulated response
  return {
    audioContent: Buffer.from([]), // Would be actual audio data
    duration: text.length * 0.05, // Rough estimate
    format: 'mp3',
  };
}

// Helper functions

function calculateSimilarity(str1, str2) {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);

  const commonWords = words1.filter(w => words2.includes(w));
  return commonWords.length / Math.max(words1.length, words2.length);
}

function extractSlots(transcript, slotTypes) {
  const slots = {};

  // Species extraction
  if (slotTypes.includes('species')) {
    if (transcript.includes('dog')) slots.species = 'dog';
    else if (transcript.includes('cat')) slots.species = 'cat';
    else if (transcript.includes('bird')) slots.species = 'bird';
  }

  // Color extraction
  if (slotTypes.includes('color')) {
    const colors = ['black', 'white', 'brown', 'gray', 'orange', 'tan', 'golden', 'spotted'];
    for (const color of colors) {
      if (transcript.includes(color)) {
        slots.color = color;
        break;
      }
    }
  }

  // Location extraction (simplified)
  if (slotTypes.includes('location')) {
    const locationMatch = transcript.match(/(?:at|near|by|on)\s+(.+?)(?:\.|$)/i);
    if (locationMatch) {
      slots.location = locationMatch[1].trim();
    }
  }

  return slots;
}

export default {
  VOICE_INTENTS,
  processVoiceCommand,
  generateVoiceResponse,
  ChatBot,
  generateAlexaResponse,
  generateGoogleAssistantResponse,
  transcribeAudio,
  synthesizeSpeech,
};
