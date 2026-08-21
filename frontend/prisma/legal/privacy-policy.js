/**
 * Privacy Policy, single source of truth.
 *
 * Same story as the waiver: it lived inline in prisma/seed.js, which
 * production never runs, so the policy could never be updated on a
 * deploy. Now synced through prisma/sync-legal-docs.js.
 *
 * v1.1.0: renamed the controller from PetRecovery.org to ReunitePets.
 * No commitment changed. The contact addresses are deliberately
 * untouched - a privacy policy that lists a mailbox nobody reads is
 * worse than one naming the old domain.
 */

const PRIVACY_POLICY_DOC = {
  slug: 'privacy-policy',
  type: 'PRIVACY_POLICY',
  version: '1.1.0',
  title: 'Privacy Policy',
  summary: 'How we collect, use, and protect your personal information',
  content: `# Privacy Policy

**Last Updated:** November 24, 2025
**Version:** 1.0.0

ReunitePets ("we," "us," or "our") respects your privacy and is committed to protecting your personal information.

## 1. Information We Collect

### Personal Information
- **Account Data**: Email address, name, phone number (optional)
- **Location Data**: Address, city, state, ZIP code (for rescue force matching)
- **Profile Information**: User preferences, rescue force memberships
- **Activity Data**: Search participation, cases created, sightings reported

### Pet Information
- **Lost Pet Details**: Pet name, species, breed, photos, description
- **Case Information**: Last seen location, search area, case updates
- **Sighting Data**: Location and time of pet sightings

### Technical Information
- **Usage Data**: Pages visited, features used, time on platform
- **Device Information**: Browser type, IP address, device type
- **Cookies**: Session cookies for authentication and preferences

## 2. How We Use Your Information

### Primary Uses
- **Pet Recovery**: Coordinate search efforts and notify relevant rescue forces
- **Communication**: Send case updates, notifications, and platform announcements
- **Matching**: Connect lost pet cases with nearby rescue force volunteers
- **Platform Improvement**: Analyze usage patterns to improve features

### Secondary Uses
- **Safety**: Maintain platform security and prevent abuse
- **Legal Compliance**: Respond to legal requests and enforce our terms
- **Analytics**: Understand user behavior and platform effectiveness (aggregated data only)

## 3. Information Sharing

### Who We Share With

**Rescue Force Members**
- When you create a lost pet case, your contact information is shared with rescue force members who accept the case
- Your search activity is visible to other squad members during active cases

**Pet Owners**
- When you report a sighting, your contact information is shared with the pet owner

**Public Information**
- Lost pet cases are public and visible to all platform users
- Your rescue force membership and general activity may be visible to other users

### Who We DO NOT Share With
- ❌ We DO NOT sell your personal information to third parties
- ❌ We DO NOT share your data with advertisers
- ❌ We DO NOT disclose your location to unauthorized users

### Legal Exceptions
We may disclose your information if required by:
- Court order or subpoena
- Law enforcement investigation
- Protection of our rights or safety of users
- Legal obligation or emergency situation

## 4. Data Security

### Security Measures
- **Encryption**: All data transmitted over HTTPS/TLS
- **Authentication**: Secure password hashing with industry-standard algorithms
- **Access Control**: Limited employee access to personal data
- **Monitoring**: Regular security audits and vulnerability scanning

### Your Responsibility
- Keep your password secure and confidential
- Log out from shared devices
- Report suspicious activity immediately

## 5. Data Retention

### How Long We Keep Your Data
- **Active Accounts**: Data retained as long as your account is active
- **Deleted Accounts**: Most data deleted within 30 days of account deletion
- **Legal Requirements**: Some data retained longer for legal compliance
- **Case History**: Archived cases may be retained for platform statistics (anonymized)

### Automated Deletion
- Expired cases (90 days after resolution) may be automatically archived
- Unused accounts (1 year of inactivity) may be flagged for deletion

## 6. Your Rights

You have the right to:

### Access & Control
- **View**: Access all personal data we have about you
- **Update**: Correct inaccurate information through your account settings
- **Delete**: Request deletion of your account and associated data
- **Export**: Download your data in a portable format

### Communication Preferences
- **Opt-Out**: Unsubscribe from marketing emails
- **Notification Settings**: Control which alerts you receive
- **Communication Channels**: Choose email, SMS, or push notifications

### Exercise Your Rights
To exercise these rights, contact us at:
- Email: privacy@petrecovery.org
- Account Settings: petrecovery.org/settings/privacy

## 7. Cookies & Tracking

### What We Use
- **Session Cookies**: Maintain your login state (required)
- **Preference Cookies**: Remember your settings (optional)
- **Analytics Cookies**: Understand platform usage (optional)

### Your Choices
- Disable non-essential cookies in your account settings
- Use browser settings to block or delete cookies
- Note: Blocking required cookies may limit platform functionality

## 8. Third-Party Services

### Services We Use
- **Hosting**: Cloud infrastructure providers (with data encryption)
- **Email**: Email delivery services (for notifications)
- **Maps**: Geocoding and mapping services (for location features)

### Their Privacy Practices
Third-party services have their own privacy policies. We carefully select partners who meet our privacy standards.

## 9. Children's Privacy

- ReunitePets is not intended for users under 18
- We do not knowingly collect information from children
- If we discover underage users, we will delete their accounts promptly
- Parents concerned about underage access should contact us immediately

## 10. International Users

- Our servers are located in the United States
- By using ReunitePets, you consent to data transfer to the US
- We comply with applicable international data protection laws

## 11. Changes to This Policy

### Notification of Changes
- Material changes will be posted on this page
- You will be notified via email for significant changes
- Continued use after changes constitutes acceptance

### Version History
- You can view previous versions by contacting us
- Current version always available at: petrecovery.org/legal/privacy-policy

## 12. Contact Us

### Privacy Questions
Email: privacy@petrecovery.org

### Data Requests
Email: data-requests@petrecovery.org

### General Inquiries
Website: petrecovery.org/contact

### Mailing Address
ReunitePets
[Address to be added]
United States

---

**By using ReunitePets, you acknowledge that you have read and understood this Privacy Policy.**

**Last updated: November 24, 2025**`
};

module.exports = { PRIVACY_POLICY_DOC };
