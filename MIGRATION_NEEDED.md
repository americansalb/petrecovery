# Database Migration Required

## Changes Made

The database schema has been updated to support dual-view system (Owner vs Patrol). The following changes were made:

### Schema Changes

1. **Added `accountType` field to User model**:
   - Type: `AccountType` enum (optional)
   - Values: `OWNER` | `PATROL`
   - Purpose: Track primary account type based on how user created account

2. **Added phone index to User model**:
   - Index on `phone` field for faster lookups

3. **Added `AccountType` enum**:
   - `OWNER`: Created account by reporting a lost pet
   - `PATROL`: Created account by joining patrol or finding a pet

## How to Run Migration

Run the following command to apply the database changes:

```bash
cd frontend
npx prisma migrate dev --name add-account-type
```

If you encounter network issues with Prisma engines, use:

```bash
cd frontend
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate dev --name add-account-type
```

Or use db push for development:

```bash
cd frontend
npx prisma db push
```

## What These Changes Fix

1. **Phone number registration conflicts**: Better handling of phone/email uniqueness
2. **Account type tracking**: Users are categorized as OWNER or PATROL based on first action
3. **Dual-view dashboard**: Different views for pet owners vs patrol members
4. **View switcher**: Users can switch between Owner and Patrol views with explanation modal
5. **Different questions for found vs lost pets**: Found pet reports ask appropriate questions
6. **Patrol join loop fixed**: Prevents duplicate patrol join buttons after already joined

## API Changes

### Updated APIs:
- `/api/reports/create` - Sets accountType to OWNER when creating lost pet report
- `/api/reports/found-pet` - Sets accountType to PATROL when reporting found pet
- `/api/patrol/join` - Sets accountType to PATROL when joining patrol
- `/api/dashboard` - Returns user accountType and hasPatrolProfile flag

## Frontend Changes

### Updated Components:
- `app/dashboard/page.js` - Complete rewrite with dual-view system and view switcher
- `app/report/found/page.js` - Updated questions for found pet flow
- `app/patrol/join/page.js` - Fixed to work with session instead of userId

## Testing Checklist

After running migration, test the following flows:

- [ ] Report lost pet (should set accountType to OWNER)
- [ ] Report found pet (should set accountType to PATROL)
- [ ] Join patrol (should set accountType to PATROL and create patrol profile)
- [ ] Login and view dashboard (should show appropriate view based on accountType)
- [ ] Switch between Owner and Patrol views (should show modal explanation)
- [ ] Verify no duplicate "Join Patrol" buttons appear after joining
- [ ] Verify phone number validation works correctly
