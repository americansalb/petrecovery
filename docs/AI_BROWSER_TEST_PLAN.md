# AI Browser Test Plan - PetRecovery.org

**Purpose:** Step-by-step testing instructions for an AI browser agent
**Target URL:** https://petrecovery.onrender.com (or production URL)
**Test Account:** Create fresh account during testing

---

## Pre-Test Setup

1. Clear all cookies and local storage
2. Set viewport to 1280x720 (desktop) initially
3. Note: Some tests require mobile viewport (375x667)

---

## TEST SUITE 1: Public Pages (No Auth Required)

### Test 1.1: Homepage Load
```
URL: /
Expected:
- Page loads within 5 seconds
- Hero section visible with "Bring Them Home" heading
- Background image loads (Unsplash dog image)
- Three action cards visible: "I Lost My Pet", "I Found a Pet", "Join the Patrol"
- Live ticker at top shows rotating messages
- No console errors
- Navigation bar present

Actions:
1. Navigate to homepage
2. Wait for page load
3. Verify heading text contains "Bring Them Home"
4. Verify three cards are clickable
5. Scroll down to verify "Stories of Hope" section loads
6. Check browser console for errors

Pass Criteria:
- All elements render
- No JavaScript errors in console
- Page is responsive (no horizontal scroll)
```

### Test 1.2: Homepage Navigation
```
URL: /
Actions:
1. Click "Report Lost Pet" button in hero
2. Verify redirect to /report/new
3. Go back to homepage
4. Click "Search Database" button
5. Verify redirect to /database
6. Go back to homepage
7. Click "I Found a Pet" card
8. Verify redirect to /report/found

Pass Criteria:
- All navigation links work
- No 404 errors
```

### Test 1.3: Public Database Page
```
URL: /database
Expected:
- Page loads with search/filter UI
- Grid or list of lost pets displays (may be empty)
- Filter controls visible (species, location, date range)
- No login required to view

Actions:
1. Navigate to /database
2. Verify page title indicates "Lost Pets" or "Pet Database"
3. If pets exist, verify each card shows: image, name, species, location, date
4. Try filter by species (select "Dog" if available)
5. Try filter by location (enter a city name)
6. Click on a pet card if available
7. Verify pet detail page loads

Pass Criteria:
- Page loads without auth
- Filters respond to input
- Pet cards are clickable
```

### Test 1.4: Rescue Squads Page
```
URL: /rescue-squads
Expected:
- Page loads showing rescue squad information
- Search functionality visible
- List of squads or empty state message

Actions:
1. Navigate to /rescue-squads
2. Verify page loads without error
3. Look for search input field
4. If squads exist, verify they show: name, location, member count
5. Click on a squad if available

Pass Criteria:
- Page accessible without login
- No crash on empty state
```

---

## TEST SUITE 2: Authentication Flow

### Test 2.1: Registration Page Load
```
URL: /register
Expected:
- Registration form visible
- Fields: First Name, Email, Phone (optional), Password, Confirm Password
- "Create Account" button
- Link to login page

Actions:
1. Navigate to /register
2. Verify all form fields are present
3. Verify password requirements shown (8+ characters)
4. Verify link to /login exists

Pass Criteria:
- Form renders completely
- All inputs are interactable
```

### Test 2.2: Registration - Validation Errors
```
URL: /register
Actions:
1. Click "Create Account" without filling any fields
2. Verify error messages appear for required fields
3. Enter invalid email (e.g., "notanemail")
4. Verify email validation error
5. Enter password less than 8 characters
6. Verify password length error
7. Enter mismatched passwords
8. Verify passwords don't match error

Pass Criteria:
- Client-side validation works
- Clear error messages displayed
- Form does not submit with invalid data
```

### Test 2.3: Registration - Success
```
URL: /register
Test Data:
- First Name: "TestUser" + timestamp (e.g., TestUser1701234567)
- Email: "testuser" + timestamp + "@test.com"
- Phone: (leave empty)
- Password: "TestPassword123!"
- Confirm Password: "TestPassword123!"

Actions:
1. Fill in all fields with test data
2. Click "Create Account"
3. Wait for response (up to 10 seconds)
4. Check for success message or redirect

Expected Outcomes (one of):
- Redirect to /dashboard (auto-login)
- Redirect to /login with success message
- Success toast/message displayed

Pass Criteria:
- Account created successfully
- No server error (500)
- User can proceed to login
```

### Test 2.4: Login Page Load
```
URL: /login
Expected:
- Login form visible
- Fields: Email, Password
- "Sign In" button
- "Forgot Password?" link
- Link to register page

Actions:
1. Navigate to /login
2. Verify email and password fields present
3. Verify "Forgot Password?" link exists
4. Verify link to /register exists

Pass Criteria:
- Form renders completely
```

### Test 2.5: Login - Invalid Credentials
```
URL: /login
Actions:
1. Enter email: "nonexistent@fake.com"
2. Enter password: "wrongpassword"
3. Click "Sign In"
4. Verify error message appears

Pass Criteria:
- Error message displayed (e.g., "Invalid credentials")
- No server crash
- User remains on login page
```

### Test 2.6: Login - Success
```
URL: /login
Test Data:
- Use credentials from Test 2.3

Actions:
1. Enter registered email
2. Enter password
3. Click "Sign In"
4. Wait for redirect (up to 10 seconds)

Expected:
- Redirect to /dashboard
- Navigation shows logged-in state
- User name or email visible in nav

Pass Criteria:
- Successful authentication
- Session established
- Dashboard accessible
```

### Test 2.7: Session Persistence
```
Prerequisite: Logged in from Test 2.6

Actions:
1. Note current URL (should be /dashboard)
2. Open new tab
3. Navigate to /dashboard in new tab
4. Verify still logged in
5. Close tab
6. Refresh original tab
7. Verify still logged in

Pass Criteria:
- Session persists across tabs
- Session persists after refresh
```

### Test 2.8: Logout
```
Prerequisite: Logged in

Actions:
1. Find logout button/link in navigation
2. Click logout
3. Verify redirect to homepage or login
4. Try to navigate to /dashboard
5. Verify redirect to login (protected route)

Pass Criteria:
- Session cleared
- Protected routes inaccessible
- User can log in again
```

### Test 2.9: Forgot Password
```
URL: /forgot-password
Actions:
1. Navigate to /forgot-password
2. Verify form with email field exists
3. Enter test email
4. Submit form
5. Verify success message (email sent)

Pass Criteria:
- Page loads
- Form submits without error
- User notified about email
```

---

## TEST SUITE 3: Dashboard (Authenticated)

### Test 3.1: Dashboard Load
```
URL: /dashboard
Prerequisite: Logged in

Expected:
- Welcome message with user name
- Section for "My Cases" (lost pets reported)
- Section for "My Pets" (registered pets)
- Quick action buttons
- No console errors

Actions:
1. Navigate to /dashboard
2. Verify personalized greeting
3. Verify cases section exists (may be empty)
4. Verify pets section exists (may be empty)
5. Look for "Report Lost Pet" CTA

Pass Criteria:
- Page loads for authenticated user
- Empty states handled gracefully
- Navigation works
```

### Test 3.2: Dashboard - Empty State
```
URL: /dashboard
Prerequisite: New account with no data

Expected:
- Friendly empty state messages
- CTAs to add first pet or report lost pet
- No errors or broken layouts

Pass Criteria:
- Empty state is helpful, not broken
```

---

## TEST SUITE 4: Report Lost Pet Flow

### Test 4.1: Report Form Load
```
URL: /report/new
Prerequisite: Logged in

Expected Form Fields:
- Pet Name (text)
- Species (select: Dog, Cat, Bird, Other)
- Breed (text)
- Color (text)
- Size (select: Small, Medium, Large)
- Age (text or number)
- Gender (select: Male, Female, Unknown)
- Last Seen Date (date picker)
- Last Seen Location (text or map picker)
- Description (textarea)
- Photo Upload (file input)
- Contact Info (may auto-fill from account)
- Submit button

Actions:
1. Navigate to /report/new
2. Verify all form fields present
3. Verify file upload accepts images
4. Verify date picker works

Pass Criteria:
- All fields render
- Form is usable
```

### Test 4.2: Report Lost Pet - Validation
```
URL: /report/new
Actions:
1. Try to submit empty form
2. Verify required field errors
3. Try invalid date (future date for "last seen")
4. Verify date validation

Pass Criteria:
- Required fields enforced
- Helpful error messages
```

### Test 4.3: Report Lost Pet - Success (Without Image)
```
URL: /report/new
Test Data:
- Pet Name: "TestDog" + timestamp
- Species: Dog
- Breed: Labrador
- Color: Golden
- Size: Large
- Age: 3
- Gender: Male
- Last Seen Date: Yesterday's date
- Last Seen Location: "123 Test Street, Austin, TX"
- Description: "Friendly golden lab, responds to name"

Actions:
1. Fill all required fields
2. Skip image upload for now
3. Click Submit
4. Wait for response (up to 15 seconds)

Expected:
- Success message
- Redirect to case detail page OR dashboard
- Case visible in dashboard

Pass Criteria:
- Case created in database
- User can view their case
```

### Test 4.4: Report Lost Pet - With Image Upload
```
URL: /report/new
Prerequisite: Have test image ready (JPG/PNG, under 5MB)

Actions:
1. Fill all required fields (same as 4.3)
2. Click image upload input
3. Select test image
4. Verify image preview shows
5. Submit form
6. Wait for upload + submission (up to 30 seconds)

Expected:
- Image uploads to CDN (Bunny.net)
- Case created with image URL
- Image visible on case detail page

Pass Criteria:
- Image upload works
- Image displays on case page
```

---

## TEST SUITE 5: Report Found Pet Flow

### Test 5.1: Found Pet Form Load
```
URL: /report/found
Note: May or may not require login

Expected Form Fields:
- Species (select)
- Breed (text, optional)
- Color (text)
- Size (select)
- Found Date (date picker)
- Found Location (text or map)
- Current Status (select: Still There, Secured, Taken to Shelter)
- Description (textarea)
- Photo Upload (file)
- Your Contact Info
- Submit button

Actions:
1. Navigate to /report/found
2. Verify form loads
3. Check all fields present

Pass Criteria:
- Form accessible
- All fields work
```

### Test 5.2: Report Found Pet - Success
```
URL: /report/found
Test Data:
- Species: Dog
- Color: Brown
- Size: Medium
- Found Date: Today
- Found Location: "456 Found Ave, Austin, TX"
- Status: Secured
- Description: "Found this dog wandering, now safe in my yard"

Actions:
1. Fill all fields
2. Submit form
3. Wait for response

Expected:
- Success confirmation
- May show potential matches
- Report saved to database

Pass Criteria:
- Report submitted successfully
- Matching logic runs (may show matches or "no matches")
```

---

## TEST SUITE 6: Pet Profiles

### Test 6.1: My Pets Page
```
URL: /pets
Prerequisite: Logged in

Expected:
- List of user's registered pets
- "Add Pet" button
- Empty state if no pets

Actions:
1. Navigate to /pets
2. Verify page loads
3. Look for add pet CTA

Pass Criteria:
- Page accessible
- Add pet option visible
```

### Test 6.2: Add New Pet
```
URL: /pets/new
Test Data:
- Name: "Buddy" + timestamp
- Species: Dog
- Breed: Golden Retriever
- Color: Golden
- Age: 2
- Gender: Male
- Microchip Number: (optional) "123456789"
- Photo: (optional)

Actions:
1. Navigate to /pets/new
2. Fill form fields
3. Submit
4. Verify redirect to pet list or detail

Pass Criteria:
- Pet created
- Pet visible in /pets list
```

### Test 6.3: View Pet Detail
```
URL: /pets/[id]
Prerequisite: Pet created in 6.2

Actions:
1. Navigate to /pets
2. Click on pet card
3. Verify detail page loads
4. Verify all pet info displayed
5. Look for "Edit" and "Delete" options
6. Look for "Report Lost" button

Pass Criteria:
- Detail page shows all info
- Edit/Delete options available
```

### Test 6.4: Edit Pet
```
URL: /pets/[id]/edit or edit button on detail page

Actions:
1. Go to pet detail page
2. Click "Edit"
3. Modify a field (e.g., age)
4. Save
5. Verify change persisted

Pass Criteria:
- Edit form pre-filled
- Changes save successfully
```

### Test 6.5: Delete Pet
```
URL: /pets/[id]

Actions:
1. Go to pet detail page
2. Click "Delete"
3. Confirm deletion (if prompted)
4. Verify redirect to /pets
5. Verify pet removed from list

Pass Criteria:
- Confirmation prompt shown
- Pet deleted
- No orphaned data
```

### Test 6.6: Report Lost from Pet Profile
```
URL: /pets/[id]
Prerequisite: Have a pet in profile

Actions:
1. Go to pet detail page
2. Click "Report Lost" button
3. Verify redirect to report form
4. Verify form pre-filled with pet data

Pass Criteria:
- Quick path to report lost pet
- Data carries over to report form
```

---

## TEST SUITE 7: Case Management

### Test 7.1: View My Cases
```
URL: /dashboard or /cases
Prerequisite: Have created a case in Test 4.3

Actions:
1. Navigate to dashboard
2. Find cases section
3. Verify case from Test 4.3 visible
4. Verify status shown (Active/Open)

Pass Criteria:
- Cases display
- Status accurate
```

### Test 7.2: Case Detail Page
```
URL: /cases/[id]

Actions:
1. Click on case from dashboard
2. Verify detail page loads
3. Expected info:
   - Pet photo (if uploaded)
   - Pet details
   - Last seen info
   - Status
   - Map (if location based)
   - Contact options
   - Activity timeline

Pass Criteria:
- All info displays
- Map renders (if applicable)
```

### Test 7.3: Update Case Status
```
URL: /cases/[id]

Actions:
1. Go to case detail
2. Find status update option
3. Change status to "Reunited" (or similar)
4. Save
5. Verify status updated

Pass Criteria:
- Status can be changed
- Change persists
```

### Test 7.4: Case Coordination Page
```
URL: /cases/[id]/coordinate
Prerequisite: Active case

Expected:
- Chat/message area
- Map with sightings
- Participant list
- Add sighting form

Actions:
1. Navigate to coordination page
2. Verify all components load
3. Try sending a message (if chat exists)
4. Try adding a sighting location

Pass Criteria:
- Page loads
- Interactive features work
```

---

## TEST SUITE 8: Mobile Responsiveness

### Test 8.1: Homepage Mobile
```
Viewport: 375x667 (iPhone SE)
URL: /

Actions:
1. Set mobile viewport
2. Load homepage
3. Verify hamburger menu appears
4. Open mobile menu
5. Verify navigation items accessible
6. Verify hero section readable
7. Verify cards stack vertically
8. Verify no horizontal scroll

Pass Criteria:
- Responsive layout
- Touch-friendly buttons
- Readable text
```

### Test 8.2: Forms on Mobile
```
Viewport: 375x667
URLs: /login, /register, /report/new

Actions:
1. Test login form on mobile
2. Verify inputs are full-width
3. Verify keyboard doesn't break layout
4. Test report form
5. Verify all fields accessible via scroll

Pass Criteria:
- Forms usable on mobile
- No cut-off content
```

---

## TEST SUITE 9: Error Handling

### Test 9.1: 404 Page
```
URL: /nonexistent-page-xyz

Actions:
1. Navigate to fake URL
2. Verify custom 404 page shows
3. Verify link back to homepage

Pass Criteria:
- Custom 404 (not browser default)
- Helpful message
```

### Test 9.2: Protected Route Without Auth
```
URL: /dashboard (when logged out)

Actions:
1. Ensure logged out
2. Navigate directly to /dashboard
3. Verify redirect to /login
4. Verify return URL preserved (optional)

Pass Criteria:
- Protected routes secure
- Graceful redirect
```

### Test 9.3: Invalid Case ID
```
URL: /cases/invalid-id-12345

Actions:
1. Navigate to invalid case URL
2. Verify error message or 404
3. No server crash

Pass Criteria:
- Handles invalid IDs gracefully
```

---

## TEST SUITE 10: Performance

### Test 10.1: Page Load Times
```
Measure load time for:
- / (homepage): Should be < 3 seconds
- /database: Should be < 5 seconds
- /dashboard: Should be < 3 seconds
- /report/new: Should be < 3 seconds

Actions:
1. Use browser performance API
2. Measure DOMContentLoaded
3. Measure full load

Pass Criteria:
- Core pages under 5 seconds
- No infinite loading states
```

### Test 10.2: Image Loading
```
URL: /database (with images)

Actions:
1. Load database page
2. Verify images load progressively
3. Verify no broken image icons
4. Check lazy loading implemented

Pass Criteria:
- Images load
- Placeholders shown while loading
```

---

## Error Reporting Format

When a test fails, report:

```
TEST FAILED: [Test ID] [Test Name]
URL: [URL tested]
Expected: [What should happen]
Actual: [What actually happened]
Console Errors: [Any JS errors]
Screenshot: [If possible]
Steps to Reproduce:
1. [Step 1]
2. [Step 2]
...
```

---

## Test Completion Checklist

After all tests, verify:

- [ ] All public pages accessible
- [ ] Registration works
- [ ] Login/Logout works
- [ ] Dashboard loads for authenticated users
- [ ] Can report lost pet
- [ ] Can report found pet
- [ ] Can manage pet profiles
- [ ] Cases display correctly
- [ ] Mobile responsive
- [ ] No critical console errors
- [ ] Error pages work

---

## Notes for AI Browser Agent

1. **Timing:** Add wait times after form submissions (5-10 seconds)
2. **Screenshots:** Capture screenshots at key steps
3. **Cookies:** Track authentication cookies
4. **Console:** Monitor console for errors throughout
5. **Network:** Note any failed API calls (4xx, 5xx errors)
6. **Clean State:** Create fresh test account for each full run
7. **Data Cleanup:** Note that test data may persist in database

---

*Last Updated: November 27, 2025*
