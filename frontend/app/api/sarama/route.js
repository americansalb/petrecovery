import { NextResponse } from 'next/server';

/**
 * Sarama AI Guide - Anthropic Claude Haiku Integration
 *
 * Modes:
 * - wizard: Guides user through lost pet report creation
 * - companion: Open-ended support after report is created (future)
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-3-haiku-20240307';

// Wizard mode system prompt - focused on fast report creation
const WIZARD_SYSTEM_PROMPT = `You are Sarama, a compassionate dog guide helping someone report their lost pet on ReunitePets.org. Your mission is to collect the required information to create their alert AS FAST AS POSSIBLE - every minute counts!

PERSONALITY:
- Warm, reassuring, and focused
- Use short, clear messages (2-3 sentences max)
- Don't use emojis excessively - one per message maximum
- Be empathetic but efficient

YOUR GOAL:
Guide the user to provide ALL of this information in order:
1. Pet type (dog, cat, bird, other)
2. Pet name
3. For dogs: size (tiny/small/medium/large/giant)
   For cats: indoor-only or goes outside
4. When they went missing (just now, few hours, today, few days, this week, longer)
5. Color/appearance
6. Location where last seen (address or description)

INFORMATION EXTRACTION:
- If the user provides information naturally in their response, acknowledge it and extract it
- Example: "My golden retriever Max ran away from 123 Main St" → Extract: dog, Max, large size likely, location 123 Main St
- Move on to the NEXT missing piece of information

HANDLING OFF-TOPIC:
If the user asks questions or goes off-topic:
- Briefly acknowledge their concern (one sentence)
- Gently redirect: "Let's get your alert posted first so people can start looking. Then I can help with that."
- Ask the next required question

QUICK REPLIES:
After each of your messages, suggest 2-4 quick reply options as a JSON array in this exact format at the END of your message:
[QUICK_REPLIES]
["Option 1", "Option 2", "Option 3"]
[/QUICK_REPLIES]

CURRENT STATE:
The user has provided this information so far:
{collected_data}

Missing information needed:
{missing_fields}

Guide them to provide the next missing piece of information. Be conversational but efficient.

IMPORTANT: When ALL required information is collected, respond with:
[WIZARD_COMPLETE]
{collected_json}
[/WIZARD_COMPLETE]

Where collected_json contains: petType, petName, petSize (dogs), isIndoorCat (cats), timeElapsed, color, location`;

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Sarama is not configured. Please add ANTHROPIC_API_KEY to environment.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      message,
      conversationHistory = [],
      mode = 'wizard',
      collectedData = {},
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build the system prompt based on mode
    let systemPrompt;

    if (mode === 'wizard') {
      // Determine what's been collected and what's missing
      const collected = [];
      const missing = [];

      if (collectedData.petType) {
        collected.push(`Pet type: ${collectedData.petType}`);
      } else {
        missing.push('Pet type (dog, cat, bird, or other)');
      }

      if (collectedData.petName) {
        collected.push(`Pet name: ${collectedData.petName}`);
      } else if (collectedData.petType) {
        missing.push('Pet name');
      }

      if (collectedData.petType === 'dog') {
        if (collectedData.petSize) {
          collected.push(`Size: ${collectedData.petSize}`);
        } else if (collectedData.petName) {
          missing.push('Size (tiny, small, medium, large, or giant)');
        }
      } else if (collectedData.petType === 'cat') {
        if (collectedData.isIndoorCat !== undefined) {
          collected.push(`Indoor cat: ${collectedData.isIndoorCat ? 'Yes' : 'No'}`);
        } else if (collectedData.petName) {
          missing.push('Whether they are indoor-only or go outside');
        }
      }

      if (collectedData.timeElapsed) {
        collected.push(`Missing since: ${collectedData.timeElapsed}`);
      } else if (collectedData.petName) {
        missing.push('When they went missing');
      }

      if (collectedData.color) {
        collected.push(`Color: ${collectedData.color}`);
      } else if (collectedData.timeElapsed) {
        missing.push('Color/appearance');
      }

      if (collectedData.location) {
        collected.push(`Location: ${collectedData.location}`);
      } else if (collectedData.color) {
        missing.push('Location where last seen');
      }

      systemPrompt = WIZARD_SYSTEM_PROMPT
        .replace('{collected_data}', collected.length > 0 ? collected.join('\n') : 'Nothing yet - this is the start of the conversation')
        .replace('{missing_fields}', missing.length > 0 ? missing.join('\n') : 'All information collected!');
    } else {
      // Companion mode - future implementation
      systemPrompt = `You are Sarama, a helpful guide on ReunitePets.org. Help the user with their questions about finding their lost pet.`;
    }

    // Build messages array for Anthropic format
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call Anthropic API
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', response.status, errorData);
      return NextResponse.json(
        { error: 'Failed to get response from Sarama', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || '';

    // Parse quick replies from the response
    let quickReplies = [];
    let cleanMessage = assistantMessage;

    const quickReplyMatch = assistantMessage.match(/\[QUICK_REPLIES\]\s*([\s\S]*?)\s*\[\/QUICK_REPLIES\]/);
    if (quickReplyMatch) {
      try {
        quickReplies = JSON.parse(quickReplyMatch[1].trim());
        cleanMessage = assistantMessage.replace(/\[QUICK_REPLIES\][\s\S]*?\[\/QUICK_REPLIES\]/, '').trim();
      } catch (e) {
        console.error('Failed to parse quick replies:', e);
      }
    }

    // Check for wizard completion
    let wizardComplete = false;
    let extractedData = null;

    const completeMatch = assistantMessage.match(/\[WIZARD_COMPLETE\]\s*([\s\S]*?)\s*\[\/WIZARD_COMPLETE\]/);
    if (completeMatch) {
      try {
        extractedData = JSON.parse(completeMatch[1].trim());
        wizardComplete = true;
        cleanMessage = assistantMessage.replace(/\[WIZARD_COMPLETE\][\s\S]*?\[\/WIZARD_COMPLETE\]/, '').trim();
      } catch (e) {
        console.error('Failed to parse wizard complete data:', e);
      }
    }

    // Extract any new data from the conversation using simple heuristics
    const newData = extractDataFromConversation(message, collectedData);

    return NextResponse.json({
      message: cleanMessage,
      quickReplies,
      wizardComplete,
      extractedData: wizardComplete ? extractedData : newData,
      usage: data.usage,
    });

  } catch (error) {
    console.error('Sarama API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Simple heuristic extraction from user messages
 * This helps update collectedData between turns
 */
function extractDataFromConversation(message, currentData) {
  const extracted = { ...currentData };
  const lowerMessage = message.toLowerCase();

  // Pet type detection
  if (!extracted.petType) {
    if (lowerMessage.includes('dog') || lowerMessage.includes('puppy') || lowerMessage.includes('pup')) {
      extracted.petType = 'dog';
    } else if (lowerMessage.includes('cat') || lowerMessage.includes('kitten') || lowerMessage.includes('kitty')) {
      extracted.petType = 'cat';
    } else if (lowerMessage.includes('bird') || lowerMessage.includes('parrot') || lowerMessage.includes('parakeet')) {
      extracted.petType = 'bird';
    }
  }

  // Size detection for dogs
  if (extracted.petType === 'dog' && !extracted.petSize) {
    if (lowerMessage.includes('tiny') || lowerMessage.includes('teacup')) {
      extracted.petSize = 'TINY';
    } else if (lowerMessage.includes('small') || lowerMessage.includes('little')) {
      extracted.petSize = 'SMALL';
    } else if (lowerMessage.includes('medium')) {
      extracted.petSize = 'MEDIUM';
    } else if (lowerMessage.includes('large') || lowerMessage.includes('big')) {
      extracted.petSize = 'LARGE';
    } else if (lowerMessage.includes('giant') || lowerMessage.includes('huge') || lowerMessage.includes('great dane') || lowerMessage.includes('mastiff')) {
      extracted.petSize = 'GIANT';
    }
    // Breed-based size inference
    if (!extracted.petSize) {
      if (lowerMessage.includes('chihuahua') || lowerMessage.includes('yorkie') || lowerMessage.includes('pomeranian')) {
        extracted.petSize = 'TINY';
      } else if (lowerMessage.includes('beagle') || lowerMessage.includes('pug') || lowerMessage.includes('corgi') || lowerMessage.includes('shih tzu')) {
        extracted.petSize = 'SMALL';
      } else if (lowerMessage.includes('border collie') || lowerMessage.includes('bulldog') || lowerMessage.includes('cocker spaniel')) {
        extracted.petSize = 'MEDIUM';
      } else if (lowerMessage.includes('labrador') || lowerMessage.includes('golden retriever') || lowerMessage.includes('german shepherd') || lowerMessage.includes('husky')) {
        extracted.petSize = 'LARGE';
      } else if (lowerMessage.includes('great dane') || lowerMessage.includes('mastiff') || lowerMessage.includes('saint bernard') || lowerMessage.includes('newfoundland')) {
        extracted.petSize = 'GIANT';
      }
    }
  }

  // Indoor cat detection
  if (extracted.petType === 'cat' && extracted.isIndoorCat === undefined) {
    if (lowerMessage.includes('indoor only') || lowerMessage.includes('indoor cat') || lowerMessage.includes('stays inside') || lowerMessage.includes('never goes out')) {
      extracted.isIndoorCat = true;
    } else if (lowerMessage.includes('goes outside') || lowerMessage.includes('outdoor') || lowerMessage.includes('outside access')) {
      extracted.isIndoorCat = false;
    }
  }

  // Time elapsed detection
  if (!extracted.timeElapsed) {
    if (lowerMessage.includes('just now') || lowerMessage.includes('just happened') || lowerMessage.includes('minutes ago') || lowerMessage.includes('less than an hour')) {
      extracted.timeElapsed = 'less_than_hour';
    } else if (lowerMessage.includes('few hours') || lowerMessage.includes('couple hours') || lowerMessage.includes('this morning') || lowerMessage.includes('this afternoon')) {
      extracted.timeElapsed = '1_to_6_hours';
    } else if (lowerMessage.includes('today') || lowerMessage.includes('earlier today') || lowerMessage.includes('last night')) {
      extracted.timeElapsed = '6_to_24_hours';
    } else if (lowerMessage.includes('few days') || lowerMessage.includes('couple days') || lowerMessage.includes('yesterday')) {
      extracted.timeElapsed = '1_to_3_days';
    } else if (lowerMessage.includes('this week') || lowerMessage.includes('several days')) {
      extracted.timeElapsed = '3_to_7_days';
    } else if (lowerMessage.includes('week') || lowerMessage.includes('longer') || lowerMessage.includes('a while')) {
      extracted.timeElapsed = 'more_than_2_weeks';
    }
  }

  // Color detection
  if (!extracted.color) {
    const colors = ['black', 'white', 'brown', 'golden', 'tan', 'cream', 'orange', 'red', 'gray', 'grey', 'silver', 'brindle', 'spotted', 'tabby', 'calico', 'tuxedo'];
    for (const color of colors) {
      if (lowerMessage.includes(color)) {
        extracted.color = color.charAt(0).toUpperCase() + color.slice(1);
        break;
      }
    }
  }

  // Pet name detection - look for capitalized words or quoted names
  if (!extracted.petName) {
    // Look for "named X" or "called X" patterns
    const namedMatch = message.match(/(?:named?|called?|is|her name is|his name is)\s+([A-Z][a-z]+)/i);
    if (namedMatch) {
      extracted.petName = namedMatch[1];
    }
    // Look for "X is missing" or "X ran away" patterns
    const missingMatch = message.match(/^([A-Z][a-z]+)\s+(?:is missing|ran away|got out|escaped|went missing)/i);
    if (missingMatch && !['My', 'The', 'Our', 'His', 'Her', 'A'].includes(missingMatch[1])) {
      extracted.petName = missingMatch[1];
    }
  }

  return extracted;
}
