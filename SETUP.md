# PetRecovery.org - Database Setup Guide

This guide will help you connect the application to a real database and implement auto-account creation.

## ✅ What's Complete

- **Clean UI**: All pages use modern, map-based flows with white backgrounds
- **Report Flow**: Pet type → Location/Time → Map radius → Contact → Pet details → Success
- **Patrol Flow**: Intro → Zip code → Map radius → Notifications → Liability waiver → Success
- **Dashboard**: Clean owner/patrol views (ready for real data)
- **Advice Page**: Standalone advice without account requirement
- **Prisma Schema**: Complete database schema with all models

## ⏳ What Needs Setup

- **Database Connection**: Prisma generate + migrate
- **Auto-Account Creation**: Create accounts when users submit reports/join patrol
- **Email Integration**: Send login credentials to new users
- **Real Data**: Connect dashboard and pages to Prisma queries

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- SQLite (included) or PostgreSQL

---

## Step 1: Install Dependencies

```bash
cd frontend
npm install
npm install bcryptjs nodemailer @prisma/client
```

---

## Step 2: Environment Variables

Create `/frontend/.env.local`:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Email (for sending login credentials)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-gmail-app-password"
SMTP_FROM="PetRecovery <noreply@petrecovery.org>"
```

**Gmail App Password Setup:**
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Generate App Password for "Mail"
4. Use that password in SMTP_PASSWORD

---

## Step 2b: Notification System Configuration (Phase 25-26)

**⚠️ Updated Email Configuration (Current Implementation)**

The application now uses a simplified email configuration. Update your `/frontend/.env.local`:

```env
# Email Configuration (Phase 25-26)
EMAIL_SERVICE="gmail"                    # or "sendgrid", "mailgun", etc.
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-gmail-app-password"
EMAIL_FROM="PetRecovery <noreply@petrecovery.org>"

# Admin Notifications
ADMIN_NOTIFICATION_EMAIL="admin@petrecovery.org"  # Receives alerts for new public reports
```

### Email Service Setup

**Option 1: Gmail (Recommended for Development)**

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication (required)
3. Navigate to "App passwords" under Security settings
4. Select "Mail" and generate an app password
5. Use generated password in `EMAIL_PASSWORD`

Example configuration:
```env
EMAIL_SERVICE="gmail"
EMAIL_USER="youremail@gmail.com"
EMAIL_PASSWORD="abcd efgh ijkl mnop"  # 16-character app password
EMAIL_FROM="PetRecovery <noreply@petrecovery.org>"
ADMIN_NOTIFICATION_EMAIL="youremail@gmail.com"
```

**Option 2: SendGrid (Recommended for Production)**

1. Sign up at [SendGrid](https://sendgrid.com)
2. Create an API key with "Mail Send" permissions
3. Verify your sender email domain
4. Use API key as password

Example configuration:
```env
EMAIL_SERVICE="sendgrid"
EMAIL_USER="apikey"                    # Literally the word "apikey"
EMAIL_PASSWORD="SG.xxxxxxxxxxxxxxxx"   # Your SendGrid API key
EMAIL_FROM="PetRecovery <noreply@petrecovery.org>"
ADMIN_NOTIFICATION_EMAIL="admin@petrecovery.org"
```

**Option 3: Other Providers**

Nodemailer supports [many email services](https://nodemailer.com/smtp/well-known/):
- `EMAIL_SERVICE="mailgun"` - Mailgun
- `EMAIL_SERVICE="outlook"` - Outlook/Hotmail
- `EMAIL_SERVICE="yahoo"` - Yahoo Mail
- Custom SMTP (see Advanced Configuration below)

### Admin Notification Email

The `ADMIN_NOTIFICATION_EMAIL` receives urgent alerts when:
- Public lost pet reports are submitted
- Cases require review or approval

**Best practices:**
- Use a monitored email address (checked frequently)
- Consider using a distribution list for teams
- Set up email filters to prioritize PetRecovery alerts

### Testing Email Configuration

Test your email setup from the Admin Health Dashboard:

1. Start the dev server: `npm run dev`
2. Login as admin
3. Navigate to `/admin/health`
4. Scroll to "Service Health Checks" section
5. Click "Test Email" button
6. Check your inbox for test email

### Advanced Configuration (Custom SMTP)

If your provider isn't supported, use custom SMTP settings:

```env
# Custom SMTP (instead of EMAIL_SERVICE)
EMAIL_HOST="smtp.example.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"                   # true for port 465, false for other ports
EMAIL_USER="your-username"
EMAIL_PASSWORD="your-password"
EMAIL_FROM="PetRecovery <noreply@petrecovery.org>"
ADMIN_NOTIFICATION_EMAIL="admin@example.com"
```

Update `/frontend/app/lib/email.js` to use these variables if needed.

### Notification Types

The system sends three types of emails:

1. **Case Report Confirmation** - Sent to contact when public report submitted
2. **Admin Alert** - Sent to `ADMIN_NOTIFICATION_EMAIL` when public report needs review
3. **Status Update** - Sent to contact when case status changes (ACTIVE_SEARCH, RESOLVED, CLOSED_OTHER)

All notification attempts are logged to the EventLog database and visible in `/admin/health`.

### Future Enhancement

Currently, admin notifications use an environment variable. A future phase will add:
- Admin settings UI at `/admin/settings`
- Configure notification preferences without server restart
- Multiple admin recipients with roles
- Email templates customization

---

## Step 3: Generate Prisma Client & Migrate

```bash
cd frontend

# Generate Prisma client
npx prisma generate

# Create database with all tables
npx prisma migrate dev --name init

# (Optional) View database
npx prisma studio
```

---

## Step 4: Create Prisma Client Singleton

Create `/frontend/app/lib/prisma.js`:

```javascript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

---

## Step 5: Create Email Utility

Create `/frontend/app/lib/email.js`:

```javascript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail({ to, subject, html }) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error };
  }
}
```

---

## Step 6: Implement Report Submission with Auto-Account

Create `/frontend/app/api/reports/create/route.js`:

```javascript
import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../../lib/email';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      email, phone, firstName,
      petName, breed, color, size, distinctiveMarks,
      lastSeenAddress, center, radiusMiles, timeElapsed, petType
    } = body;

    // 1. Check if user exists
    let user = await prisma.user.findUnique({
      where: { email }
    });

    let accountCreated = false;

    // 2. Create account if doesn't exist
    if (!user) {
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      user = await prisma.user.create({
        data: {
          email,
          phone,
          firstName,
          passwordHash,
          role: 'USER',
        }
      });

      accountCreated = true;

      // Send email with login credentials
      await sendEmail({
        to: email,
        subject: 'Your PetRecovery.org Account - Lost Pet Alert Created',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">🚨 Lost Pet Alert Created</h2>
            <p>Hi ${firstName},</p>
            <p>Your lost pet alert for <strong>${petName}</strong> has been created and your community has been notified.</p>

            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Account</h3>
              <p>We've created an account for you:</p>
              <p><strong>Email:</strong> ${email}<br/>
              <strong>Temporary Password:</strong> <code style="background: #fee2e2; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
            </div>

            <p><a href="http://localhost:3000/login" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Dashboard</a></p>

            <p><small style="color: #6b7280;">We recommend changing your password after logging in.</small></p>
          </div>
        `
      });
    }

    // 3. Create pet record
    const pet = await prisma.pet.create({
      data: {
        ownerId: user.id,
        name: petName,
        species: petType.toUpperCase(),
        breed: breed || '',
        color,
        size,
        distinctiveMarks: distinctiveMarks || '',
        primaryPhotoUrl: '',
        photos: [],
        personality: [],
      }
    });

    // 4. Create lost report
    const lastSeenAt = calculateLastSeenTime(timeElapsed);

    const report = await prisma.lostReport.create({
      data: {
        petId: pet.id,
        reporterId: user.id,
        lastSeenAt,
        lastSeenLatitude: center[0],
        lastSeenLongitude: center[1],
        lastSeenAddress,
        escapeScenario: 'unknown',
        searchRadius: radiusMiles,
        status: 'ACTIVE',
        priority: timeElapsed === 'less_than_hour' ? 'URGENT' : 'NORMAL',
      }
    });

    // 5. Find nearby patrol members
    const patrolMembers = await prisma.user.findMany({
      where: {
        patrolProfile: {
          isActive: true,
          isPaused: false,
        }
      },
      include: {
        profile: true,
        patrolProfile: true,
      }
    });

    // Filter by distance and send alerts
    const nearbyPatrol = patrolMembers.filter(member => {
      if (!member.profile?.latitude || !member.profile?.longitude) return false;
      const distance = calculateDistance(
        center[0], center[1],
        member.profile.latitude, member.profile.longitude
      );
      return distance <= member.patrolProfile.radiusMiles;
    });

    await Promise.all(
      nearbyPatrol.map(member =>
        prisma.alert.create({
          data: {
            reportId: report.id,
            userId: member.id,
            method: member.patrolProfile.alertMethod,
          }
        })
      )
    );

    return NextResponse.json({
      success: true,
      reportId: report.id,
      accountCreated,
      patrolAlerted: nearbyPatrol.length,
    });

  } catch (error) {
    console.error('Report creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create report', details: error.message },
      { status: 500 }
    );
  }
}

function calculateLastSeenTime(timeElapsed) {
  const now = new Date();
  const hours = {
    'less_than_hour': 0.5,
    '1_to_6_hours': 3,
    '6_to_24_hours': 12,
    '1_to_3_days': 48,
    '3_to_7_days': 120,
    '1_to_2_weeks': 240,
    'more_than_2_weeks': 360,
  };
  const hoursAgo = hours[timeElapsed] || 12;
  return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

---

## Step 7: Update Report Page to Submit to API

In `/frontend/app/report/new/page.js`, update `handleSubmit`:

```javascript
const handleSubmit = async () => {
  setIsSubmitting(true);
  setError(null);

  try {
    const response = await fetch('/api/reports/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: reportData.email,
        phone: reportData.phone,
        firstName: reportData.firstName,
        petName: reportData.petName,
        breed: reportData.breed,
        color: reportData.color,
        size: reportData.size,
        distinctiveMarks: reportData.distinctiveMarks,
        lastSeenAddress,
        center,
        radiusMiles,
        timeElapsed,
        petType,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create report');
    }

    setReportId(data.reportId);
    setStep(6); // Success step
  } catch (err) {
    setError(err.message);
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## Step 8: Update Patrol Join API

In `/frontend/app/api/patrol/join/route.js`, add account creation:

```javascript
import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../../lib/email';
import { z } from 'zod';

const PatrolSignupSchema = z.object({
  userId: z.string().min(1), // Will be email for now
  zipCode: z.string().length(5),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusMiles: z.number().min(1).max(25).default(5),
  notifications: z.object({
    text: z.boolean().default(true),
    email: z.boolean().default(true),
    push: z.boolean().default(true),
  }),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const validatedData = PatrolSignupSchema.parse(body);

    const { userId: email, zipCode, centerLat, centerLng, radiusMiles, notifications } = validatedData;

    // 1. Check if user exists
    let user = await prisma.user.findUnique({
      where: { email }
    });

    let accountCreated = false;

    // 2. Create account if doesn't exist
    if (!user) {
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      user = await prisma.user.create({
        data: {
          email,
          firstName: email.split('@')[0],
          passwordHash,
          role: 'PATROL',
        }
      });

      accountCreated = true;

      // Send welcome email
      await sendEmail({
        to: email,
        subject: 'Welcome to Pet Patrol - Your Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0ea5e9;">🦸 Welcome to Pet Patrol!</h2>
            <p>Thank you for joining the community to help reunite lost pets with their families.</p>

            <div style="background: #eff6ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Account</h3>
              <p><strong>Email:</strong> ${email}<br/>
              <strong>Temporary Password:</strong> <code style="background: #dbeafe; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
            </div>

            <p><a href="http://localhost:3000/login" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Dashboard</a></p>

            <p><small style="color: #6b7280;">Please change your password after logging in.</small></p>
          </div>
        `
      });
    }

    // 3. Create user profile
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        latitude: centerLat,
        longitude: centerLng,
        zip: zipCode,
      },
      update: {
        latitude: centerLat,
        longitude: centerLng,
        zip: zipCode,
      }
    });

    // 4. Create patrol profile
    const alertMethod = notifications.text && notifications.email && notifications.push
      ? 'ALL'
      : notifications.email
      ? 'EMAIL'
      : notifications.text
      ? 'SMS'
      : 'PUSH';

    await prisma.patrolProfile.create({
      data: {
        userId: user.id,
        radiusMiles,
        alertMethod,
        instantAlerts: true,
      }
    });

    return NextResponse.json({
      success: true,
      accountCreated,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Patrol signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create patrol profile', details: error.message },
      { status: 500 }
    );
  }
}
```

---

## Step 9: Connect Dashboard to Real Data

Create `/frontend/app/api/dashboard/route.js`:

```javascript
import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { getServerSession } from 'next-auth';

export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        patrolProfile: true,
        lostReports: {
          where: { status: 'ACTIVE' },
          include: {
            pet: true,
            sightings: true,
          }
        },
        profile: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Format reports for display
    const reports = user.lostReports.map(report => ({
      id: report.id,
      petName: report.pet.name,
      species: report.pet.species.toLowerCase(),
      lastSeen: formatTime(report.lastSeenAt),
      sightings: report.sightings.length,
      status: report.status,
    }));

    // If patrol member, find nearby alerts
    let nearbyAlerts = [];
    if (user.patrolProfile && user.profile) {
      const { latitude, longitude } = user.profile;
      const { radiusMiles } = user.patrolProfile;

      // Get all active reports
      const allReports = await prisma.lostReport.findMany({
        where: {
          status: 'ACTIVE',
          reporterId: { not: user.id }, // Don't show own reports
        },
        include: {
          pet: true,
        },
      });

      // Filter by distance
      nearbyAlerts = allReports
        .map(report => {
          const distance = calculateDistance(
            latitude, longitude,
            report.lastSeenLatitude, report.lastSeenLongitude
          );
          return { ...report, distance };
        })
        .filter(report => report.distance <= radiusMiles)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10)
        .map(report => ({
          id: report.id,
          petName: report.pet.name,
          species: report.pet.species.toLowerCase(),
          lastSeen: formatTime(report.lastSeenAt),
          distance: `${report.distance.toFixed(1)} miles`,
        }));
    }

    return NextResponse.json({
      mode: user.patrolProfile ? 'patrol' : 'owner',
      reports,
      nearbyAlerts,
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}

function formatTime(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Less than an hour ago';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

Update dashboard page to use real data (uncomment TODO sections in `/frontend/app/dashboard/page.js`).

---

## Step 10: Test End-to-End

```bash
# Start dev server
npm run dev

# Test flow:
1. Report lost pet at /report/new
   - Use new email
   - Check email for credentials
2. Login with credentials
3. View dashboard (should show your report)
4. Join patrol at /patrol/join
   - Dashboard should switch to patrol view
```

---

## Troubleshooting

### Prisma Generate Fails
```bash
rm -rf node_modules/.prisma
npx prisma generate
```

### Database Issues
```bash
# Reset (deletes all data!)
npx prisma migrate reset

# View database
npx prisma studio
```

### Email Not Sending
- Enable Gmail "App Passwords" (requires 2FA)
- Test: `node` then `require('./app/lib/email').sendEmail({to:'test@test.com',subject:'Test',html:'Test'})`

---

## Database Schema Summary

```
User (accounts)
  ├─ UserProfile (location)
  ├─ PatrolProfile (if patrol member)
  ├─ Pet[] (their pets)
  ├─ LostReport[] (reports filed)
  └─ Alert[] (notifications)

Pet
  └─ LostReport[] (reports)

LostReport (active searches)
  ├─ Pet
  ├─ Alert[] (sent to patrol)
  └─ Sighting[] (community)
```

---

## Next Features

- Photo uploads for pets
- Sighting reports from patrol
- Real-time notifications
- Map view with all markers
- Reward system
- Patrol leaderboard

---

For help: Check Prisma docs, NextAuth docs, Nodemailer docs
