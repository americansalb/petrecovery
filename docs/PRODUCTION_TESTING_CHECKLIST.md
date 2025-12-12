# Production Testing Checklist

**Created:** November 27, 2025
**Purpose:** Verify all critical flows work in production before launch
**Target:** 100 users can use the app with no issues

---

## Pre-Testing Checklist

### Environment Verification
- [ ] Deploy passes on Render (no build errors)
- [ ] All environment variables set:
  - [ ] `DATABASE_URL` - PostgreSQL connection string
  - [ ] `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
  - [ ] `NEXTAUTH_URL` - Production URL (https://yourdomain.com)
  - [ ] `BUNNY_STORAGE_ZONE` - Bunny.net storage zone
  - [ ] `BUNNY_API_KEY` - Bunny.net API key
  - [ ] `BUNNY_CDN_URL` - Bunny.net CDN URL
  - [ ] `EMAIL_USER` - Email service username
  - [ ] `EMAIL_PASSWORD` - Email service password/app password
  - [ ] `ADMIN_NOTIFICATION_EMAIL` - Admin alert recipient

### Health Checks
- [ ] Visit `/admin/health` - All services green
- [ ] Database connection working
- [ ] Geocoding service responding
- [ ] Email service configured

---

## Critical User Flows

### Flow 1: New User Registration
**Priority: CRITICAL**

1. [ ] Visit `/register`
2. [ ] Fill in: email, password (8+ chars), first name
3. [ ] Submit form
4. [ ] Verify: No error message, redirect to login or dashboard
5. [ ] Check: User appears in database

**Test edge missions:**
- [ ] Invalid email format → Shows validation error
- [ ] Short password (<8 chars) → Shows validation error
- [ ] Duplicate email → Shows generic error (no email enumeration)
- [ ] Rate limit (6+ attempts) → Shows "Too many requests"

---

### Flow 2: User Login & Session
**Priority: CRITICAL**

1. [ ] Visit `/login`
2. [ ] Enter registered email/password
3. [ ] Submit form
4. [ ] Verify: Redirect to `/dashboard`
5. [ ] Verify: Navigation shows logged-in state
6. [ ] Refresh page → Session persists
7. [ ] Close browser, reopen → Session persists (within 30 days)
8. [ ] Click logout → Redirects to home, session cleared

**Test edge missions:**
- [ ] Wrong password → Shows error (no account lockout yet)
- [ ] Non-existent email → Shows generic error
- [ ] Rate limit (6+ attempts) → Shows "Too many requests"

---

### Flow 3: Password Reset
**Priority: HIGH**

1. [ ] Visit `/forgot-password`
2. [ ] Enter registered email
3. [ ] Submit form
4. [ ] Verify: Success message (even if email not found - security)
5. [ ] Check email inbox for reset link
6. [ ] Click reset link
7. [ ] Enter new password (8+ chars)
8. [ ] Submit form
9. [ ] Verify: Success message
10. [ ] Login with new password → Works

**Test edge missions:**
- [ ] Non-existent email → Shows same success message (security)
- [ ] Expired token (wait 1 hour) → Shows expired error
- [ ] Invalid token → Shows invalid error
- [ ] Rate limit (6+ attempts) → Shows "Too many requests"

---

### Flow 4: Report Lost Pet
**Priority: CRITICAL**

1. [ ] Login as registered user
2. [ ] Navigate to `/report/new` or click "Report Lost Pet"
3. [ ] Fill in required fields:
   - [ ] Pet species (dog/cat/bird/other)
   - [ ] City, State
   - [ ] Contact name
   - [ ] Contact email or phone
4. [ ] Upload pet photo (optional)
5. [ ] Submit form
6. [ ] Verify: Success message with mission number
7. [ ] Verify: Redirects to mission detail page
8. [ ] Verify: Mission appears in dashboard

**Test edge missions:**
- [ ] Missing required fields → Validation errors
- [ ] Invalid photo type → Shows file type error
- [ ] Large photo (>10MB) → Shows size error

---

### Flow 5: Public Lost Pet Report (No Account)
**Priority: CRITICAL**

1. [ ] Visit `/missions/report` (not logged in)
2. [ ] Fill in required fields
3. [ ] Check "Agree to terms" checkbox
4. [ ] Submit form
5. [ ] Verify: Success message with mission number
6. [ ] Verify: Confirmation email sent to contact email
7. [ ] Verify: Admin notification sent (check admin email)
8. [ ] Verify: Mission is NOT public (requires admin approval)

**Test edge missions:**
- [ ] Missing terms agreement → Shows error
- [ ] Rate limit (11+ reports) → Shows "Too many requests"

---

### Flow 6: Report Found Pet
**Priority: HIGH**

1. [ ] Visit `/report/found` or `/missions/report` (select "Found")
2. [ ] Fill in required fields:
   - [ ] Pet species
   - [ ] Location (city, state)
   - [ ] Contact info
3. [ ] Upload photo of found pet (optional)
4. [ ] Submit form
5. [ ] Verify: Success with mission number
6. [ ] Verify: Matches displayed if any high-scoring matches
7. [ ] Verify: Owner notifications sent for matches

---

### Flow 7: Browse Public Database
**Priority: HIGH**

1. [ ] Visit `/database` (not logged in)
2. [ ] Verify: Public missions displayed
3. [ ] Use filters: Species, location
4. [ ] Click on a mission → Detail page loads
5. [ ] Verify: Contact info hidden (unless publicContactOk)
6. [ ] Login → Contact info visible (if publicContactOk)

---

### Flow 8: Rescue Squad Flow
**Priority: MEDIUM**

1. [ ] Login as user
2. [ ] Visit `/rescue-squads/search`
3. [ ] Search by ZIP code
4. [ ] View squad details
5. [ ] Join a squad (must accept waiver)
6. [ ] Verify: Waiver consent page appears
7. [ ] Accept waiver
8. [ ] Verify: Member of squad
9. [ ] Leave squad → Removed from squad

---

### Flow 9: Mission Coordination (Squad Members)
**Priority: MEDIUM**

1. [ ] Login as squad member
2. [ ] Navigate to active mission coordination page
3. [ ] Test chat: Send message → Appears in chat
4. [ ] Test map: Add search area polygon → Saves
5. [ ] Test sighting: Add sighting with location → Saves
6. [ ] Verify: Other squad members can see updates (use incognito)

---

### Flow 10: Pet Profile Management
**Priority: MEDIUM**

1. [ ] Login as user
2. [ ] Visit `/pets`
3. [ ] Click "Add Pet"
4. [ ] Fill in pet details with photo
5. [ ] Save pet
6. [ ] Edit pet → Changes saved
7. [ ] Report pet as lost → Creates mission linked to pet

---

## Admin Verification

### Admin Dashboard
- [ ] Login as admin user
- [ ] Visit `/admin/health` → Dashboard loads
- [ ] Visit `/admin/missions` → Missions list loads
- [ ] Approve a pending mission → Mission becomes public
- [ ] Visit `/admin/qa` → QA harness loads
- [ ] Run smoke tests → All pass

---

## Email Verification

### Email Delivery
- [ ] Password reset email: Delivered (not spam)
- [ ] Mission confirmation email: Delivered
- [ ] Admin alert email: Delivered
- [ ] Found pet match notification: Delivered

### Email Content
- [ ] Links in emails work
- [ ] Emails render correctly in Gmail, Outlook
- [ ] No broken images

---

## Mobile Testing

### Responsive Design
- [ ] Homepage: Readable on mobile
- [ ] Navigation: Hamburger menu works
- [ ] Forms: Inputs usable (no zoom on focus)
- [ ] Maps: Touch-friendly zoom/pan
- [ ] Touch targets: At least 44px

### Test Devices
- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] iPad (tablet view)

---

## Security Verification

### Rate Limiting
Test each by making rapid requests:
- [ ] `/api/auth/register` - Blocks after 5 attempts
- [ ] `/api/auth/forgot-password` - Blocks after 5 attempts
- [ ] `/api/public/missions` POST - Blocks after 10 attempts
- [ ] `/api/upload` - Blocks after 20 attempts

### Input Validation
- [ ] XSS attempt in pet name → Sanitized
- [ ] SQL injection in search → No error
- [ ] Path traversal in upload delete → Rejected

### Authorization
- [ ] Non-owner can't edit others' missions
- [ ] Non-admin can't access `/admin/*`
- [ ] Mission matches require authentication

---

## Performance Baseline

### Page Load Times (Target: <3s)
- [ ] Homepage: ___s
- [ ] Dashboard: ___s
- [ ] Mission list: ___s
- [ ] Mission detail: ___s

### API Response Times (Target: <500ms)
- [ ] GET /api/public/missions: ___ms
- [ ] POST /api/missions: ___ms
- [ ] GET /api/public/metrics: ___ms

---

## Known Issues to Monitor

| Issue | Severity | Workaround |
|-------|----------|------------|
| No automated tests | Medium | Manual QA before deploys |
| Session 30 days | Low | Acceptable for MVP |
| No SMS notifications | Low | Email only for now |

---

## Post-Testing Checklist

After all tests pass:
- [ ] All critical flows verified
- [ ] No console errors on main pages
- [ ] No 500 errors in logs
- [ ] Metrics displaying correctly on homepage
- [ ] Admin can manage missions

---

## Launch Readiness Criteria

**Ready for beta when ALL are true:**
- [x] Registration works
- [x] Login/logout works
- [x] Password reset works (emails deliver)
- [x] Report lost pet works
- [x] Report found pet works
- [x] Public database accessible
- [x] Mobile responsive
- [x] Rate limiting active
- [x] Admin dashboard functional
- [x] No critical security issues

---

*Checklist version 1.0 - November 27, 2025*
