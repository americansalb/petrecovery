# PetRecovery.org - Setup Guide

## What's Been Built

### Phase 1: Core Advice System ✅
- Lost pet recovery advice logic system
- Multi-step form for pet type, time elapsed, and scenario
- Comprehensive, detailed advice display
- Mobile-first responsive design

### Phase 2: Community Foundation (In Progress) 🚧
- Database schema with Prisma ORM
- Patrol system API endpoints
- Patrol signup UI flow
- User authentication structure (ready for NextAuth)

## Current Project Structure

```
frontend/
├── app/
│   ├── api/
│   │   ├── health/
│   │   │   └── route.js              # Health check endpoint
│   │   └── patrol/
│   │       └── join/
│   │           └── route.js          # Patrol signup API
│   ├── lib/
│   │   ├── petAdvice.js              # Pet recovery advice logic
│   │   └── prisma.js                 # Prisma client singleton
│   ├── patrol/
│   │   └── join/
│   │       └── page.js               # Patrol signup UI
│   ├── report/
│   │   └── new/
│   │       └── page.js               # Lost pet report wizard
│   ├── layout.js                     # Root layout
│   └── page.js                       # Landing page
├── prisma/
│   └── schema.prisma                 # Database schema
├── .env.local                        # Environment variables
└── package.json
```

## Database Schema

The database includes these core models:
- **User**: Basic user information and auth
- **UserProfile**: Location and preferences
- **PatrolProfile**: Recovery patrol member data
- **Pet**: Pet information
- **LostReport**: Lost pet reports
- **Alert**: Patrol alerts
- **Sighting**: Pet sighting reports
- **Comment**: Comments and updates

## Setup Instructions

### 1. Install Dependencies

Already done:
```bash
npm install
```

Installed packages:
- Prisma + Prisma Client
- NextAuth.js + Prisma adapter
- Zod (validation)
- bcryptjs (password hashing)

### 2. Database Setup

#### Option A: Local SQLite (Current - For Development)

The project is currently configured to use SQLite for local development.

**To initialize the database:**
```bash
# In the frontend directory
npx prisma migrate dev --name init
npx prisma generate
```

Note: If you encounter network errors downloading Prisma engines, try:
```bash
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate dev --name init
```

#### Option B: PostgreSQL (Recommended for Production)

1. Set up a PostgreSQL database (local or hosted)
2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Update `.env.local`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/petrecovery"
   ```
4. Run migrations:
   ```bash
   npx prisma migrate dev --name init
   ```

#### Option C: Render PostgreSQL (For Deployment)

1. Create a PostgreSQL database on Render
2. Copy the internal connection string
3. Add to Render environment variables as `DATABASE_URL`
4. Migrations will run automatically on deploy

### 3. Environment Variables

Create or update `.env.local`:

```bash
# Database
DATABASE_URL="file:./dev.db"  # SQLite for local dev
# or
DATABASE_URL="postgresql://..."  # PostgreSQL

# Auth (generate a secure random string)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-32-character-secret-here"

# Future additions:
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_PHONE_NUMBER=
# RESEND_API_KEY=
# NEXT_PUBLIC_MAPBOX_TOKEN=
```

### 4. Run Development Server

```bash
npm run dev
```

Visit:
- Landing page: http://localhost:3000
- Lost pet report: http://localhost:3000/report/new
- Join patrol: http://localhost:3000/patrol/join
- Health check: http://localhost:3000/api/health

### 5. Test the Patrol System

Currently, the patrol system uses a temporary user ID. To test:

1. Go to `/patrol/join`
2. Fill out the 3-step form:
   - Step 1: Coverage area and pet types
   - Step 2: Availability and transportation
   - Step 3: Notification preferences
3. Submit to create a patrol profile

Note: Full auth integration with NextAuth is pending.

## API Endpoints

### Currently Implemented

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/patrol/join` | POST | Join recovery patrol |
| `/api/patrol/join?userId={id}` | GET | Check patrol status |

### Planned (Next Phase)

- `/api/users/quick-register` - Quick user signup
- `/api/reports` - Create lost pet reports
- `/api/reports/nearby` - Get nearby reports
- `/api/patrol/alerts` - Send patrol alerts
- `/api/sightings` - Report sightings

## What Works Now

✅ **Advice System**
- Complete pet recovery advice for dogs, cats, birds
- Time-based guidance (< 1 day, 1-3 days, 3-7 days, 1-2 weeks, 2+ weeks)
- Scenario-specific instructions
- Mobile-optimized UI

✅ **Patrol Signup**
- Three-step signup flow
- Coverage area selection
- Availability preferences
- Transportation options
- Notification preferences

✅ **Database Ready**
- Complete schema defined
- Models for users, pets, reports, patrol, alerts
- Ready for data

## What's Next

### Immediate Todo (Week 1)
1. ✅ Set up database schema
2. ✅ Create patrol signup API
3. ✅ Create patrol signup UI
4. ⏳ Integrate NextAuth for authentication
5. ⏳ Create user quick-registration flow
6. ⏳ Build lost pet report submission API
7. ⏳ Connect report wizard to database

### Phase 2 (Week 2)
- Alert sending system (email/SMS)
- Patrol dashboard
- Active searches view
- Response handling

### Phase 3 (Week 3)
- Map integration (Mapbox)
- Location-based queries
- Sighting reports
- Search coordination

## Troubleshooting

### Prisma Issues

**"Cannot find module '@prisma/client'"**
```bash
npx prisma generate
```

**"Database connection error"**
- Check DATABASE_URL in `.env.local`
- For SQLite, ensure file path is correct
- For PostgreSQL, verify connection string

**"Migration failed"**
- Delete `prisma/migrations` folder
- Delete database file (if SQLite)
- Run `npx prisma migrate reset`

### Build Issues

**"Module not found"**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**Port already in use**
```bash
# Kill process on port 3000
npx kill-port 3000
# or use different port
PORT=3001 npm run dev
```

## Architecture Decisions

### Why SQLite for Development?
- Zero configuration
- File-based (easy to reset)
- Perfect for local testing
- Switch to PostgreSQL for production

### Why Prisma?
- Type-safe database access
- Automatic migrations
- Great DX with autocomplete
- Easy to switch databases

### Why Next.js API Routes?
- Unified codebase
- No CORS issues
- Easy deployment
- Server-side rendering ready

## Contributing

When adding new features:

1. Update database schema in `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description`
3. Create API route in `app/api/`
4. Create UI component in `app/`
5. Test thoroughly
6. Update this README

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Zod Validation](https://zod.dev)

---

Last Updated: 2025-01-06
