import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import {
  processVoiceCommand,
  generateVoiceResponse,
  ChatBot,
  transcribeAudio,
} from '@/app/lib/voice/assistant';

const chatBot = new ChatBot();

/**
 * POST /api/voice/command
 * Process voice commands and chatbot messages
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, transcript, message, audioData } = body;

    switch (type) {
      case 'voice': {
        // Process voice command
        const command = processVoiceCommand(transcript);
        const response = generateVoiceResponse(command.intent, body.context);
        return NextResponse.json({ command, response });
      }

      case 'chat': {
        // Process chatbot message
        const response = await chatBot.processMessage(
          session.user.id,
          message,
          body.context
        );
        return NextResponse.json(response);
      }

      case 'transcribe': {
        // Transcribe audio to text
        const result = await transcribeAudio(
          Buffer.from(audioData, 'base64'),
          body.options
        );
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Voice command error:', error);
    return NextResponse.json(
      { error: 'Command processing failed' },
      { status: 500 }
    );
  }
}
