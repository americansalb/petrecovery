import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { assignmentDoor, cleanPlace } from '@/app/lib/missionControl/guard';
import { safeWebUrl } from '@/app/lib/safeUrl';
import { onlyText, hasText, cut, firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 12, blockDurationMs: 60 * 1000 };
const MESSAGE_MAX = 1000;
const PHOTOS_MAX = 5;

// GET /api/assignments/[id]/messages - Get all messages for a case
export async function GET(request, { params }) {
  try {
    // A force's talk about one pet: for the owner, the forces looking for the pet and staff. It took no sign-in,
    // and sent each writer's account id and last name. A writer is a first name here.
    const { id: assignmentId } = await params;
    const door = await assignmentDoor(request, assignmentId);
    if (door.status !== 200) {
      return NextResponse.json({ error: door.status === 404 ? 'Assignment not found' : 'Only the owner and the forces looking for this pet can see this.', code: door.status === 404 ? 'NOT_FOUND' : 'NOT_ALLOWED' }, { status: door.status });
    }
    const viewerId = door.who.searcher?.userId || null;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit'), 10) || 50, 1), 200);
    const beforeAt = new Date(searchParams.get('before') || ''); // For pagination
    const before = Number.isNaN(beforeAt.getTime()) ? null : beforeAt;

    const rows = await prisma.squadMessage.findMany({
      where: {
        assignmentId: door.assignment.id,
        ...(before && { createdAt: { lt: before } }),
      },
      include: {
        author: {
          select: {
            firstName: true,
            rescueLevel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const messages = rows.reverse().map(({ authorId, author, ...message }) => ({
      ...message,
      mine: Boolean(viewerId && authorId === viewerId),
      author: { firstName: firstWord(author?.firstName) || 'A helper', rescueLevel: author?.rescueLevel || null },
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/assignments/[id]/messages - Send a message
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'assignment:message');
    if (!limited.success) return rateLimitResponse(limited);

    const { id: assignmentId } = await params;
    const sent = await request.json().catch(() => null);
    const body = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};

    // A message is text held to a length. Its kind is a chat message or, from a leader, an announcement: the
    // kind used to be whatever the request said, so anyone on the search could write one that read as the
    // system's own. Pictures are https addresses, a few of them, and a place is a place on the globe.
    const content = typeof body.content === 'string' ? cut(onlyText(body.content).replace(/\n{3,}/g, '\n\n').trim(), MESSAGE_MAX) : '';
    const type = body.type === 'ANNOUNCEMENT' ? 'ANNOUNCEMENT' : 'CHAT';
    const photoUrls = (Array.isArray(body.photoUrls) ? body.photoUrls : []).map((url) => safeWebUrl(url)).filter((url) => url && url.startsWith('https://')).slice(0, PHOTOS_MAX);
    const spot = cleanPlace(body.location);
    const location = spot ? { lat: spot.lat, lng: spot.lng, ...(typeof body.location.address === 'string' ? { address: cut(onlyText(body.location.address).replace(/\s+/g, ' ').trim(), 200) } : {}) } : null;

    if (!hasText(content)) {
      return NextResponse.json(
        { error: 'Message content required' },
        { status: 400 }
      );
    }
    if (typeof assignmentId !== 'string' || !assignmentId) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Verify user is a participant or squad leader
    const assignment = await prisma.caseAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        participants: {
          where: {
            userId: session.user.id,
            isActive: true,
          },
        },
        rescueSquad: {
          include: {
            members: {
              where: {
                userId: session.user.id,
                role: { in: ['FOUNDER', 'LEADER', 'COORDINATOR'] },
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const isParticipant = assignment.participants.length > 0;
    const isLeader = assignment.rescueSquad.members.length > 0;

    if (!isParticipant && !isLeader) {
      return NextResponse.json(
        { error: 'You must be participating in this case to send messages' },
        { status: 403 }
      );
    }

    // Only leaders can send ANNOUNCEMENT type messages
    if (type === 'ANNOUNCEMENT' && !isLeader) {
      return NextResponse.json(
        { error: 'Only rescue force leaders can send announcements' },
        { status: 403 }
      );
    }

    const created = await prisma.squadMessage.create({
      data: {
        assignmentId,
        authorId: session.user.id,
        content,
        type,
        photoUrls: JSON.stringify(photoUrls),
        location: location ? JSON.stringify(location) : null,
      },
      include: {
        author: {
          select: {
            firstName: true,
            rescueLevel: true,
          },
        },
      },
    });
    // The writer's own message, back to them: a first name, no account id.
    const { authorId, author, ...rest } = created;
    const message = { ...rest, mine: true, author: { firstName: firstWord(author?.firstName) || 'A helper', rescueLevel: author?.rescueLevel || null } };

    // TODO: Send push notifications to other participants
    // - Real-time chat notifications
    // - Email digest for offline users

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
