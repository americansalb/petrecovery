# PetRecovery.org - Project Roadmap

**Last Updated:** November 27, 2025
**Status:** Pre-MVP (Development Phase)
**Honest Assessment:** ~50% complete for a true MVP (Phase 0 completed)

---

## Executive Summary

PetRecovery.org is a community-powered platform to help reunite lost pets with their families. While significant backend infrastructure has been built, **this project is NOT at MVP status**. Critical user-facing features are missing, and several documented features exist only as database schema or API stubs without functional UI.

---

## Current State Assessment

### What's Actually Built and Working

| Feature | Status | Notes |
|---------|--------|-------|
| User Authentication | **Working** | Email/password with password reset |
| Password Reset | **NEW** | Forgot password flow with email tokens |
| User Registration | **Working** | Basic registration with email verification |
| Rescue Squad CRUD | **Working** | Create, search, join, leave squads |
| Squad Search by ZIP | **Working** | Haversine distance calculation |
| Lost Pet Case Admin | **Working** | Admin can create/manage cases |
| Public Case Portal | **Working** | List, view, submit public reports |
| Public Metrics API | **NEW** | Real platform metrics with caching |
| Legal Consent Flow | **Working** | ToS and waiver acceptance |
| Admin Health Dashboard | **Working** | Comprehensive monitoring |
| Event Logging | **Working** | Structured logging throughout |
| Email Notifications | **Partial** | Basic templates, Gmail/SMTP only |
| Admin QA Harness | **Working** | Browser-based smoke tests |
| Error Handling | **NEW** | Error boundary, 404 page, loading states |

### What's NOT Built (Despite Documentation Claims)

| Feature | Actual Status | Documentation Claims |
|---------|---------------|---------------------|
| Image Upload | **NOT IMPLEMENTED** | Schema has URL fields, no upload functionality |
| Case Coordination UI | **NOT IMPLEMENTED** | APIs exist, zero frontend UI |
| Squad Chat Interface | **NOT IMPLEMENTED** | API exists, no React component |
| Search Area Mapping | **NOT IMPLEMENTED** | API exists, no interactive map UI |
| Sighting Submission UI | **NOT IMPLEMENTED** | API exists, no user-facing form |
| SMS Notifications | **NOT IMPLEMENTED** | Schema field only |
| Push Notifications | **NOT IMPLEMENTED** | Schema field only |
| Social Login | **NOT IMPLEMENTED** | Credentials only |
| Pet Profile Management | **NOT IMPLEMENTED** | Pet model exists, no UI |
| Lost/Found Matching | **NOT IMPLEMENTED** | No matching algorithm |
| Meta Ads Integration | **NOT IMPLEMENTED** | Schema fields only |
| Sighting Verification | **NOT IMPLEMENTED** | Schema fields only |
| Mobile Responsiveness | **LIMITED** | Basic responsive, not tested |
| Automated Tests | **NOT IMPLEMENTED** | QA harness only (manual) |

### Known Bugs and Issues

1. ~~**Home page displays fake statistic**~~ - **FIXED**: Now shows real metrics from database
2. ~~**No error boundary components**~~ - **FIXED**: ErrorBoundary added to root layout
3. ~~**No loading states on many pages**~~ - **FIXED**: Global loading.js and LoadingSpinner added
4. **Cities database is 29k entries**: Performance concern, no pagination
5. **Inline CSS throughout**: Inconsistent styling, no design system

---

## Phase 0: Pre-MVP Critical Fixes ✅ COMPLETED (2025-11-27)

### 0.1 Authentication Essentials ✅
- [x] **Password reset flow** - Users can now recover accounts
  - Added `/forgot-password` page with email input
  - Added `/reset-password?token=` page with password form
  - Added `POST /api/auth/forgot-password` endpoint (generates token, sends email)
  - Added `POST /api/auth/reset-password` endpoint (validates token, updates password)
  - Professional email template for password reset link
  - Token expiration (1 hour) with secure random generation
  - Added "Forgot Password?" link to login page
  - Added `resetToken` and `resetTokenExpiry` fields to User model
  - Extensive logging throughout for debugging

### 0.2 Remove Fake Data ✅
- [x] Removed hardcoded "847 pets reunited" from home page
- [x] Added `GET /api/public/metrics` endpoint with 5-minute caching
- [x] Home page now fetches and displays real metrics from database
- [x] Graceful fallbacks for loading/empty states

### 0.3 Basic Error Handling ✅
- [x] Added ErrorBoundary component (`/components/ErrorBoundary.js`)
- [x] Added 404 page (`/not-found.js`) with helpful navigation
- [x] Added generic error page (`/error.js`) with retry functionality
- [x] Added global loading component (`/loading.js`)
- [x] Added reusable LoadingSpinner component with Skeleton loaders
- [x] Wrapped entire app in ErrorBoundary in root layout

---

## Phase 1: True MVP Features

### 1.1 Image Upload (CRITICAL)
Pet recovery requires photos. Currently, the system only stores URLs but provides no upload mechanism.

- [ ] Set up cloud storage (AWS S3 or Cloudinary)
- [ ] Create image upload API endpoint
- [ ] Add image upload component
- [ ] Update case creation forms to support photo upload
- [ ] Update report forms (lost/found) to support photo upload
- [ ] Add image optimization/compression
- [ ] Add image size limits and validation

### 1.2 Case Coordination UI (CRITICAL)
APIs exist but users have no way to use them. This is the core value proposition.

**Squad Chat Interface:**
- [ ] Create `/cases/[id]/coordinate` page
- [ ] Build real-time chat component
- [ ] Add message list with author info
- [ ] Add message input with send button
- [ ] Support photo attachments in messages
- [ ] Support location sharing in messages
- [ ] Add announcement highlighting for leaders

**Search Area Mapping:**
- [ ] Build interactive map component using Leaflet
- [ ] Add polygon drawing for search areas
- [ ] Display existing search areas with colors
- [ ] Show who searched which area and when
- [ ] Calculate and display total acreage searched

**Sighting Reports:**
- [ ] Create sighting submission form
- [ ] Add map pin placement for sighting location
- [ ] Add confidence level selector (1-10)
- [ ] Add photo upload for sighting
- [ ] Display sightings on case map
- [ ] Add sighting timeline/history

**Participant Management:**
- [ ] Show list of opted-in volunteers
- [ ] Add opt-in/opt-out buttons
- [ ] Display participant stats

### 1.3 Pet Profile Management
Users should be able to pre-register pets before losing them.

- [ ] Create `/pets` page - list user's pets
- [ ] Create `/pets/new` page - add a pet
- [ ] Create `/pets/[id]` page - view/edit pet
- [ ] Link pets to lost pet reports
- [ ] Quick report generation from existing pet profile

### 1.4 Lost/Found Matching Algorithm
When someone reports a found pet, it should match against lost pets.

- [ ] Define matching criteria (species, breed, color, location, time)
- [ ] Implement matching score calculation
- [ ] Show potential matches when submitting found report
- [ ] Notify lost pet owners of potential matches
- [ ] Create match review interface

---

## Phase 2: User Experience Improvements

### 2.1 Mobile Responsiveness
- [ ] Audit all pages on mobile viewports
- [ ] Fix navigation menu for mobile
- [ ] Ensure maps work on touch devices
- [ ] Test forms on mobile keyboards
- [ ] Add mobile-specific UI improvements

### 2.2 User Dashboard Improvements
- [ ] Show user's squad memberships
- [ ] Show cases user is participating in
- [ ] Show user's sighting reports
- [ ] Add notification center
- [ ] Add quick actions (report lost pet, join search, etc.)

### 2.3 Squad Detail Improvements
- [ ] Show active cases with quick join
- [ ] Show recent activity feed
- [ ] Show member directory
- [ ] Add squad statistics visualization
- [ ] Enable squad messaging (not just case-specific)

### 2.4 Case Detail Improvements
- [ ] Add case timeline/history
- [ ] Show all sightings on map
- [ ] Show search coverage visualization
- [ ] Add share buttons for social media
- [ ] Add printable flyer generation

---

## Phase 3: Communication Enhancements

### 3.1 SMS Notifications
- [ ] Integrate Twilio or similar provider
- [ ] Add phone number verification
- [ ] Enable SMS for case alerts
- [ ] Enable SMS for sighting notifications
- [ ] Add SMS preferences to user settings

### 3.2 Push Notifications
- [ ] Implement service worker
- [ ] Add browser push notification support
- [ ] Enable push for real-time case updates
- [ ] Enable push for new squad messages
- [ ] Add push preferences to user settings

### 3.3 Email Improvements
- [ ] Add unsubscribe mechanism
- [ ] Add email preference management
- [ ] Create digest option (daily summary)
- [ ] Improve email templates with better branding
- [ ] Add email tracking (opens, clicks)

---

## Phase 4: Platform Integrity

### 4.1 Automated Testing
- [ ] Set up Jest testing framework
- [ ] Add unit tests for utility functions
- [ ] Add API route tests
- [ ] Add React component tests
- [ ] Set up CI/CD pipeline with test runs
- [ ] Add E2E tests with Playwright or Cypress

### 4.2 Security Hardening
- [ ] Add rate limiting to API routes
- [ ] Add CAPTCHA to public forms
- [ ] Audit for SQL injection vulnerabilities
- [ ] Audit for XSS vulnerabilities
- [ ] Add CSRF protection
- [ ] Security review of authentication flow

### 4.3 Performance Optimization
- [ ] Add database indexes review
- [ ] Implement API response caching
- [ ] Add lazy loading for images
- [ ] Optimize cities database lookup
- [ ] Add pagination to all list endpoints
- [ ] Profile and optimize slow queries

---

## Phase 5: Growth Features

### 5.1 Social Login
- [ ] Add Google OAuth
- [ ] Add Facebook OAuth
- [ ] Add Apple Sign-In
- [ ] Link social accounts to existing accounts

### 5.2 Meta/Facebook Ads Integration
- [ ] Implement Facebook Marketing API
- [ ] Add campaign creation from case
- [ ] Add budget management
- [ ] Add campaign status tracking
- [ ] Add performance metrics display

### 5.3 Shelter Integration
- [ ] Partner with local shelters
- [ ] Build shelter data import API
- [ ] Cross-reference found pets with shelter intakes
- [ ] Automated shelter notifications

### 5.4 Gamification Enhancements
- [ ] Award badges for achievements
- [ ] Create leaderboards (users, squads)
- [ ] Add level-up celebrations
- [ ] Create volunteer recognition system

---

## Phase 6: Scale and Enterprise

### 6.1 Multi-region Support
- [ ] Add timezone handling
- [ ] Support international phone formats
- [ ] Consider language localization
- [ ] Regional legal compliance

### 6.2 API for Partners
- [ ] Design public API
- [ ] Implement API key authentication
- [ ] Create API documentation
- [ ] Rate limiting per partner
- [ ] Partner dashboard

### 6.3 Analytics Dashboard
- [ ] Track case outcomes
- [ ] Measure time to recovery
- [ ] Geographic heat maps
- [ ] Volunteer engagement metrics
- [ ] Squad performance analytics

---

## Technical Debt

### High Priority
1. **Remove inline styles** - Migrate to consistent CSS approach
2. **Add TypeScript** - Current JS is error-prone
3. **Add input validation** - Many forms lack proper validation
4. **Centralize error handling** - Inconsistent error responses
5. **Add logging levels** - Currently all console.log

### Medium Priority
1. **Refactor large components** - Some pages are 500+ lines
2. **Extract shared UI components** - Button, Input, Card, etc.
3. **Add proper loading states** - Skeleton loaders
4. **Implement optimistic updates** - Better UX
5. **Add request deduplication** - Prevent double submissions

### Low Priority
1. **Add dark mode** - User preference
2. **Improve accessibility** - ARIA labels, keyboard navigation
3. **Add animations** - Page transitions, micro-interactions
4. **Performance monitoring** - Add APM tool
5. **Add feature flags** - For gradual rollouts

---

## Milestones

### Milestone 1: Pre-Alpha ✅ COMPLETE
- Basic authentication
- Rescue squad creation/joining
- Admin case management
- Public case listing
- Password reset (**NEW**)
- Real statistics on home page (**NEW**)
- Error handling (**NEW**)

### Milestone 2: Alpha (Target: +4 weeks) - IN PROGRESS
- ~~Password reset~~ ✅
- Image upload
- Case coordination UI (basic)
- ~~Real statistics on home page~~ ✅
- ~~Error handling~~ ✅

### Milestone 3: Beta (Target: +8 weeks)
- Full case coordination features
- Pet profile management
- Lost/found matching
- Mobile responsive
- SMS notifications

### Milestone 4: MVP Launch (Target: +12 weeks)
- All Phase 1 complete
- Phase 2 UI improvements
- Basic email notifications
- Security audit passed
- Performance acceptable

### Milestone 5: Growth (Post-MVP)
- Social login
- Meta ads integration
- Shelter partnerships
- Automated testing
- API for partners

---

## Resources Required

### Development
- Full-stack developer (primary)
- Frontend developer (React/Next.js)
- Mobile/responsive specialist (part-time)
- QA engineer (part-time)

### Infrastructure
- Cloud storage for images (AWS S3 or Cloudinary)
- SMS provider (Twilio)
- Email provider upgrade (SendGrid recommended)
- Monitoring/APM tool

### Design
- UI/UX designer for coordination features
- Mobile design review
- Brand/marketing assets

---

## Risk Assessment

### High Risk
1. **No image upload** - Pet recovery without photos is nearly useless
2. ~~**No password reset**~~ - ✅ RESOLVED: Users can now reset passwords
3. **No coordination UI** - Core value prop is unavailable

### Medium Risk
1. **No automated tests** - Regressions likely as development continues
2. **No mobile testing** - Unknown user experience on phones
3. **Single developer dependency** - Knowledge concentrated

### Low Risk
1. **No social login** - Users can still use email/password
2. **No Meta ads** - Manual advertising still works
3. **Performance** - Current scale is manageable

---

## Conclusion

This project has a solid database schema, good API structure, and working admin tools. Phase 0 critical fixes are now complete, including password reset, real metrics, and error handling. However, critical user-facing features remain unbuilt.

**Current Priority (Phase 1):**
1. ~~Fix critical authentication gaps (password reset)~~ ✅
2. Build image upload capability
3. Build case coordination UI
4. Test thoroughly on mobile
5. Only then consider launch

Estimated time to true MVP: **6-10 weeks of focused development** (reduced from 8-12 due to Phase 0 completion)

---

*This roadmap was created after a thorough code review on November 27, 2025.*
*Phase 0 completed on November 27, 2025.*
