# Beta Testing Guide - ReunitePets.org

## Welcome Beta Testers! 🐾

Thank you for helping us test ReunitePets.org, a community-powered platform to help reunite lost pets with their families. Your feedback will directly shape how we help thousands of pets find their way home.

---

## What We're Testing (Week 1)

We just completed two major features and need your help testing them:

### 1. **Push Notifications** 🔔
- Instant alerts when pets are sighted nearby
- Real-time squad coordination messages
- Mission assignment notifications

### 2. **Error Tracking** 🐛
- Automatic bug reporting
- Session replay for reproducing issues
- Better debugging for the development team

---

## How to Participate

### Time Commitment
- **Initial setup**: 15-20 minutes
- **Testing session**: 30-60 minutes
- **Feedback**: 10-15 minutes

### What You'll Do
1. Create an account on the platform
2. Enable push notifications
3. Test key features (detailed below)
4. Report any bugs or issues you find
5. Share your overall experience

---

## Getting Started

### Step 1: Access the Platform

**Development URL**: `http://localhost:3000` (or provided URL)

**First Time Setup**:
1. Create your account (email + password or Google/Facebook)
2. Verify your email
3. Accept Terms of Service
4. Accept Liability Waiver (for field testing)

### Step 2: Choose Your Role

You can test as one or both:

**Option A: Pet Owner** (report a lost pet)
- Simulate reporting your pet as lost
- Receive sighting notifications
- Coordinate with volunteers

**Option B: Volunteer** (help search)
- Join a local rescue force
- Accept mission assignments
- Report sightings and coordinate searches

---

## Testing Scenarios

### Scenario 1: Report a Lost Pet (Pet Owner)

**Objective**: Test the lost pet reporting flow

**Steps**:
1. Go to "Report Lost Pet" page
2. Fill out the form with test data:
   - Pet name: "TestDog" or "TestCat"
   - Species: Dog or Cat
   - Breed: Any breed
   - Last seen location: Use your actual location or pick a spot on the map
   - Upload a photo (can be any pet photo)
3. Submit the report
4. Check your email for confirmation
5. **Note any issues or confusion**

**What to watch for**:
- Is the form easy to understand?
- Does the map work smoothly?
- Did you receive the confirmation email?
- Any errors or bugs?

---

### Scenario 2: Enable Push Notifications

**Objective**: Test push notification setup

**Steps**:
1. After creating an account, look for "Enable Notifications" prompt
2. Click it and grant browser permission
3. Verify you see a success message

**What to watch for**:
- Was it clear how to enable notifications?
- Did the browser permission prompt appear?
- Any errors during setup?

---

### Scenario 3: Join a Rescue Force (Volunteer)

**Objective**: Test volunteer recruitment

**Steps**:
1. Navigate to "Rescue Forces" page
2. Search for forces in your area
3. Click on a force to view details
4. Click "Join Force"
5. Accept the liability waiver
6. Accept Terms of Service

**What to watch for**:
- Was it easy to find a force near you?
- Were the legal agreements clear?
- Did you successfully join?

---

### Scenario 4: Test Mission Control (Volunteer)

**Objective**: Test the coordination workspace

**Steps**:
1. Navigate to an active mission (case)
2. Click "I Can Help" to opt in
3. Open Mission Control
4. Explore the features:
   - View the map
   - Check the chat
   - Look at sighting reports
   - Try marking a search area (optional)

**What to watch for**:
- Is Mission Control intuitive?
- Does the map load quickly?
- Can you see the chat clearly?
- Any confusing elements?

---

### Scenario 5: Report a Sighting (Volunteer)

**Objective**: Test the sighting reporting + push notifications

**Steps**:
1. In Mission Control, click "Report Sighting"
2. Drop a pin on the map where you "saw" the pet
3. Set confidence level (try 8/10 for high confidence)
4. Add a description
5. Submit sighting
6. **If testing with a partner**: Have them check if they received a push notification

**What to watch for**:
- Was reporting a sighting easy?
- Did the push notification arrive (if testing with partner)?
- How long did it take for notification to arrive?
- Any errors?

---

### Scenario 6: Test Squad Chat

**Objective**: Test real-time messaging

**Steps**:
1. In Mission Control, go to Chat tab
2. Send a message: "Testing chat system"
3. **If testing with a partner**: Have them check for push notification

**What to watch for**:
- Did your message appear in chat?
- Did others receive push notifications?
- Is the chat easy to use?
- Any lag or delays?

---

### Scenario 7: Trigger an Error (Intentional)

**Objective**: Test error tracking system

**We'll provide a specific action that triggers a test error**

**Steps**:
1. [Specific action will be provided]
2. Note what happened
3. Take a screenshot if possible

**What to watch for**:
- Did you see an error page?
- Was it clear what went wrong?
- Could you recover (go back home, retry)?

---

## What to Test For

### User Experience
- [ ] Is it clear what to do at each step?
- [ ] Are buttons and links easy to find?
- [ ] Is the language easy to understand?
- [ ] Does it feel professional and trustworthy?
- [ ] Would you use this in a real emergency?

### Functionality
- [ ] Do all features work as expected?
- [ ] Are there any bugs or errors?
- [ ] Does everything load quickly?
- [ ] Do push notifications arrive?
- [ ] Does the map work smoothly?

### Mobile Experience (if testing on phone)
- [ ] Is everything readable on small screen?
- [ ] Are buttons easy to tap?
- [ ] Does the map work with touch gestures?
- [ ] Can you use it one-handed?

---

## How to Report Issues

### Bug Report Template

**What happened?**
<!-- Describe the bug in detail -->

**Steps to reproduce**:
1. Go to...
2. Click on...
3. See error...

**Expected behavior**:
<!-- What should have happened? -->

**Screenshots**:
<!-- Paste screenshots if possible -->

**Device & Browser**:
<!-- e.g., "iPhone 14, Safari" or "Windows PC, Chrome" -->

**Severity**:
- [ ] Critical (can't continue testing)
- [ ] High (major feature broken)
- [ ] Medium (annoying but can work around)
- [ ] Low (minor cosmetic issue)

### Where to Report

**Email**: [Your email address for bug reports]

**Or use our feedback form**: [Link to feedback form]

---

## Feedback Questions

After testing, please answer these questions:

### Overall Experience
1. On a scale of 1-10, how easy was it to use the platform?
2. What was the most confusing part?
3. What did you like most?
4. What would you change?
5. Would you use this if your pet went missing? Why or why not?

### Push Notifications
1. Did you receive push notifications?
2. How quickly did they arrive?
3. Were they helpful or annoying?
4. Did clicking them take you to the right place?

### For Pet Owners
1. Was reporting your lost pet straightforward?
2. Did you feel confident the system would help?
3. What information was hard to provide?

### For Volunteers
1. Was it clear how to help search?
2. Did Mission Control give you the tools you need?
3. Would you actually volunteer in real life?

### Open Feedback
What else should we know?

---

## Important Notes

### This is a TEST Environment
- **Do NOT report real lost pets** (unless you're okay with test data)
- Feel free to create fake data
- It's okay to break things - that's why we're testing!

### Your Privacy
- Your data will only be used for testing
- We won't share your information
- You can delete your account anytime

### Time-Sensitive Testing
Please complete testing within **[X days]** so we can incorporate your feedback before the next phase.

---

## What Happens Next

### After Your Testing Session
1. We'll review all feedback
2. Fix critical bugs
3. Implement suggested improvements
4. Prepare for public beta

### You'll Receive
- Early access to new features
- Recognition as a founding beta tester
- Our eternal gratitude 🙏

---

## Questions During Testing?

**Contact**: [Your contact method]
**Available**: [Your availability]

**Don't hesitate to reach out!** No question is too small.

---

## Thank You!

Your help is invaluable in making ReunitePets.org the best possible platform for reuniting lost pets with their families. Every bug you find and every suggestion you make helps us save more pets.

Together, we're building something that will make a real difference in the lives of pets and their families. ❤️🐾

---

## Quick Reference

### Test Account Details
**Email**: [Provided by testing coordinator]
**Password**: [Provided by testing coordinator]
**Test Force**: [Name of test rescue force]

### URLs
- Platform: [URL]
- Feedback Form: [URL]
- Bug Tracker: [URL]

### Support
- Email: [Email]
- Discord/Slack: [Link if available]
- Phone: [Phone if available]
