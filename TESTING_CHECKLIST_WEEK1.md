# Week 1 Manual Testing Checklist

## Overview

Before recruiting beta users, we need to manually test all critical user flows to ensure zero critical bugs. This checklist covers the core functionality of the pet recovery platform.

**Target**: Complete all tests with 0 critical bugs before beta launch

---

## Setup Requirements

### Environment
- [ ] Local development server running (`npm run dev`)
- [ ] Database seeded with test data
- [ ] `.env.local` configured with all required variables
- [ ] VAPID keys configured for push notifications
- [ ] Sentry DSN configured (optional for local testing)

### Test Accounts
- [ ] Create test pet owner account
- [ ] Create test volunteer account #1
- [ ] Create test volunteer account #2
- [ ] Create test admin account

### Test Data
- [ ] At least 1 rescue force created
- [ ] At least 2-3 volunteers in the force
- [ ] At least 1 test lost pet case

---

## Critical User Flow 1: Report Lost Pet

### As a Pet Owner (Public Report)

**Test Case 1.1: Complete Lost Pet Report**
- [ ] Navigate to public lost pet report form
- [ ] Fill out all required fields:
  - [ ] Pet name
  - [ ] Pet species (dog/cat)
  - [ ] Pet breed
  - [ ] Last seen location (use map)
  - [ ] Last seen date/time
  - [ ] Contact information
  - [ ] Upload at least 1 photo
- [ ] Submit form
- [ ] Verify confirmation email received
- [ ] Verify admin alert email sent
- [ ] Verify case created in database with status PENDING_APPROVAL

**Expected Result**: Form submits successfully, emails sent, case created

**Test Case 1.2: Report with Missing Required Fields**
- [ ] Try submitting with missing pet species
- [ ] Try submitting with missing location
- [ ] Try submitting with missing contact info
- [ ] Verify validation errors shown
- [ ] Verify form does not submit

**Expected Result**: Validation prevents submission, clear error messages

**Test Case 1.3: Photo Upload**
- [ ] Upload JPEG image
- [ ] Upload PNG image
- [ ] Try uploading invalid file type (PDF, txt)
- [ ] Upload image larger than size limit
- [ ] Verify errors handled gracefully

**Expected Result**: Valid images upload, invalid files rejected with clear messages

---

## Critical User Flow 2: Join Rescue Force

### As a Volunteer

**Test Case 2.1: Find and Join Force**
- [ ] Navigate to rescue forces page
- [ ] Search for forces in your city
- [ ] Click on a force to view details
- [ ] Click "Join Force" button
- [ ] Accept liability waiver
- [ ] Accept Terms of Service
- [ ] Verify membership created with status ACTIVE
- [ ] Verify notification sent to force leaders

**Expected Result**: Successfully join force, legal tracking recorded

**Test Case 2.2: Cannot Join Without Legal Acceptance**
- [ ] Try joining without accepting waiver
- [ ] Verify blocked by API
- [ ] Verify error message shown

**Expected Result**: Cannot join without legal consent

**Test Case 2.3: View Force Dashboard**
- [ ] After joining, navigate to force dashboard
- [ ] Verify member count updated
- [ ] Verify your profile appears in members list
- [ ] Verify force stats displayed

**Expected Result**: Dashboard shows correct data

---

## Critical User Flow 3: Mission Assignment

### As a Force Leader

**Test Case 3.1: Accept New Case**
- [ ] View available nearby cases
- [ ] Click on a case to view details
- [ ] Review pet information
- [ ] Click "Accept Case" button
- [ ] Verify case assignment created
- [ ] **NEW**: Verify push notifications sent to all force members
- [ ] **NEW**: Verify email notifications sent to all force members
- [ ] Verify force stats updated (total missions +1)

**Expected Result**: Case accepted, all members notified via push + email

**Test Case 3.2: Push Notification Received**
- [ ] On a second device/browser, login as force member
- [ ] Enable push notifications
- [ ] Wait for leader to accept case
- [ ] Verify push notification received within 5 minutes
- [ ] Click notification
- [ ] Verify redirected to mission page

**Expected Result**: Push notification arrives, click works

---

## Critical User Flow 4: Volunteer Participation

### As a Force Member

**Test Case 4.1: Opt Into Mission**
- [ ] Navigate to active mission
- [ ] Click "I Can Help" / "Join Search"
- [ ] Verify participant record created
- [ ] Verify participant list updated
- [ ] Verify access granted to Mission Control

**Expected Result**: Successfully opted in, Mission Control accessible

**Test Case 4.2: Mission Control Access**
- [ ] Open Mission Control for accepted case
- [ ] Verify map loads
- [ ] Verify pet details displayed
- [ ] Verify squad chat visible
- [ ] Verify search area tools available

**Expected Result**: Mission Control fully functional

---

## Critical User Flow 5: Sighting Reports

### As a Volunteer in the Field

**Test Case 5.1: Report Sighting**
- [ ] In Mission Control, click "Report Sighting"
- [ ] Drop pin on map where pet was seen
- [ ] Set confidence level (1-10)
- [ ] Add description
- [ ] Upload photo (optional)
- [ ] Submit sighting
- [ ] **NEW**: Verify push notification sent to owner
- [ ] **NEW**: Verify push notification sent to participants
- [ ] **NEW**: Verify email sent to owner
- [ ] Verify sighting appears on map
- [ ] Verify mission status updated to SIGHTING_REPORTED

**Expected Result**: Sighting recorded, owner + team notified immediately

**Test Case 5.2: Push Notification for Sighting**
- [ ] As pet owner, enable push notifications
- [ ] Wait for volunteer to report sighting
- [ ] Verify push notification received within 30 seconds
- [ ] Verify notification marked as urgent (confidence >= 7)
- [ ] Click notification
- [ ] Verify redirected to sighting on map

**Expected Result**: Instant push notification with accurate information

**Test Case 5.3: High Confidence Sighting**
- [ ] Report sighting with confidence 8-10
- [ ] Verify notification marked as urgent (requiresInteraction: true)
- [ ] Verify stays on screen until dismissed

**Expected Result**: High confidence sightings get urgent treatment

---

## Critical User Flow 6: Squad Chat

### As Mission Participants

**Test Case 6.1: Send Chat Message**
- [ ] Open Mission Control
- [ ] Navigate to Chat tab
- [ ] Type message
- [ ] Send message
- [ ] Verify message appears in chat
- [ ] **NEW**: Verify push notification sent to other participants
- [ ] **NEW**: Verify sender does NOT receive their own push

**Expected Result**: Message sent, others notified, sender excluded

**Test Case 6.2: Receive Chat Notification**
- [ ] On second device, login as different participant
- [ ] Enable push notifications
- [ ] Wait for message from first participant
- [ ] Verify push notification received
- [ ] Verify notification shows sender name + message preview
- [ ] Click notification
- [ ] Verify redirected to Mission Control chat

**Expected Result**: Real-time chat notifications working

**Test Case 6.3: System Messages**
- [ ] Report sighting (triggers system message)
- [ ] Verify system message appears in chat
- [ ] Verify formatted differently than user messages
- [ ] Verify no push notification for system messages

**Expected Result**: System messages appear but don't spam notifications

---

## Critical User Flow 7: Push Notification Subscription

### As Any User

**Test Case 7.1: Enable Notifications**
- [ ] Navigate to Mission Control
- [ ] Click "Enable Notifications" button
- [ ] Grant browser permission
- [ ] Verify subscription saved to database
- [ ] Verify subscription includes device info
- [ ] Verify subscription linked to user account

**Expected Result**: Push subscription created and stored

**Test Case 7.2: Browser Permission Denied**
- [ ] Reset browser notifications for localhost
- [ ] Try to enable notifications
- [ ] Deny permission
- [ ] Verify graceful error message
- [ ] Verify user can retry

**Expected Result**: Handles denial gracefully with clear message

**Test Case 7.3: Multiple Devices**
- [ ] Enable notifications on desktop browser
- [ ] Enable notifications on mobile browser
- [ ] Verify 2 separate subscriptions created
- [ ] Trigger notification
- [ ] Verify both devices receive push

**Expected Result**: Multi-device support works

**Test Case 7.4: Unsubscribe**
- [ ] Disable notifications
- [ ] Verify subscription removed from database
- [ ] Verify no longer receives push
- [ ] Verify can re-subscribe later

**Expected Result**: Unsubscribe works cleanly

---

## Critical User Flow 8: Error Handling (Sentry)

### Trigger Test Errors

**Test Case 8.1: Client-Side Error**
- [ ] Add test error to a page: `throw new Error("Test client error");`
- [ ] Navigate to that page
- [ ] Verify error boundary catches it
- [ ] Verify error page displays
- [ ] **NEW**: Check Sentry dashboard for error report
- [ ] **NEW**: Verify session replay captured
- [ ] **NEW**: Verify breadcrumbs show user actions before error

**Expected Result**: Error caught, logged to Sentry with full context

**Test Case 8.2: API Error**
- [ ] Cause API error (invalid data, missing auth, etc.)
- [ ] Verify error response returned to client
- [ ] **NEW**: Check Sentry for server-side error
- [ ] **NEW**: Verify sensitive data filtered (no cookies, passwords, tokens)

**Expected Result**: API errors logged to Sentry, privacy protected

**Test Case 8.3: Network Error**
- [ ] Disconnect internet
- [ ] Try to submit form
- [ ] Verify graceful error message
- [ ] Reconnect
- [ ] Verify can retry

**Expected Result**: Network errors handled gracefully

---

## Critical User Flow 9: Mission Resolution

### As Pet Owner

**Test Case 9.1: Mark Pet Found**
- [ ] Navigate to your case
- [ ] Click "Mark as Found"
- [ ] Select resolution reason (reunited via platform, found independently, etc.)
- [ ] Add resolution notes
- [ ] Submit
- [ ] Verify status changed to RESOLVED
- [ ] Verify participants notified
- [ ] Verify force stats updated (reunions +1)

**Expected Result**: Case resolved, stats updated, team notified

---

## Critical User Flow 10: Admin Approval

### As Admin

**Test Case 10.1: Approve Public Report**
- [ ] Login as admin
- [ ] Navigate to pending cases
- [ ] View public report details
- [ ] Review contact information
- [ ] Set privacy settings (publicContactOk)
- [ ] Approve case (set isPublic=true)
- [ ] Verify case now visible on public portal
- [ ] Verify nearby forces notified

**Expected Result**: Case approved and visible publicly

---

## Performance Tests

**Test Case P.1: Notification Delivery Speed**
- [ ] Trigger sighting notification
- [ ] Time from API call to push received
- [ ] **Target**: < 5 seconds
- [ ] Record actual time: _______

**Test Case P.2: Page Load Times**
- [ ] Mission Control initial load
- [ ] **Target**: < 3 seconds
- [ ] Record actual time: _______

**Test Case P.3: Map Performance**
- [ ] Load map with 10+ sightings
- [ ] Verify smooth panning/zooming
- [ ] Verify no lag

---

## Security Tests

**Test Case S.1: Unauthorized Access**
- [ ] Try accessing Mission Control without being participant
- [ ] Verify blocked by API
- [ ] Verify redirected or error shown

**Test Case S.2: VAPID Key Security**
- [ ] Verify VAPID private key NOT exposed in browser
- [ ] Verify only public key in client code

**Test Case S.3: Sentry Privacy**
- [ ] Trigger error with sensitive data in request
- [ ] Check Sentry event
- [ ] Verify cookies removed
- [ ] Verify auth headers removed
- [ ] Verify DATABASE_URL not in context

---

## Mobile Responsiveness Tests

**Test Case M.1: Mobile Report Form**
- [ ] Open report form on mobile device
- [ ] Verify all fields accessible
- [ ] Verify map is touch-friendly
- [ ] Verify photo upload works from camera
- [ ] Verify can submit

**Test Case M.2: Mobile Mission Control**
- [ ] Open Mission Control on mobile
- [ ] Verify hamburger menu works
- [ ] Verify tabs are touch-friendly
- [ ] Verify map controls reachable
- [ ] Verify chat usable

**Test Case M.3: Mobile Notifications**
- [ ] Enable push on mobile browser
- [ ] Receive notification
- [ ] Verify displays correctly
- [ ] Verify tap works

---

## Edge Cases & Error Scenarios

**Test Case E.1: Expired Subscription**
- [ ] Manually delete subscription from database
- [ ] Trigger notification for that user
- [ ] Verify graceful handling (no crash)
- [ ] Verify subscription removed from system

**Test Case E.2: Invalid VAPID Keys**
- [ ] Temporarily set invalid VAPID key
- [ ] Try to send notification
- [ ] Verify graceful error
- [ ] Verify logged to console
- [ ] Restore valid key

**Test Case E.3: Sentry Disabled**
- [ ] Remove SENTRY_DSN from environment
- [ ] Trigger error
- [ ] Verify app still works
- [ ] Verify no crashes

**Test Case E.4: Offline Mode**
- [ ] Disconnect internet
- [ ] Try to use Mission Control
- [ ] Verify graceful error messages
- [ ] Verify no data loss when reconnected

---

## Test Results Summary

### Critical Bugs Found (Blockers)
<!-- List any critical bugs that must be fixed before beta -->

1.
2.
3.

### Medium Priority Bugs
<!-- List bugs that should be fixed but aren't blockers -->

1.
2.
3.

### Low Priority / Nice-to-Have
<!-- List minor issues or improvements -->

1.
2.
3.

---

## Sign-Off

- [ ] All critical user flows tested
- [ ] Push notifications working end-to-end
- [ ] Sentry error tracking verified
- [ ] Zero critical bugs remaining
- [ ] Medium bugs documented
- [ ] Ready for beta user testing

**Tested By**: _________________
**Date**: _________________
**Environment**: _________________
**Browser(s)**: _________________
**Notes**:

---

## Next Steps After Testing

Once all tests pass:

1. [ ] Fix all critical bugs
2. [ ] Document known medium/low priority issues
3. [ ] Create beta testing guide for users
4. [ ] Recruit 10-20 beta users (friends, local pet rescue volunteers)
5. [ ] Set up feedback collection system
6. [ ] Monitor Sentry dashboard for production errors
7. [ ] Week 2: Add SMS notifications (Twilio)
8. [ ] Week 2: Create automated E2E test suite
