/**
 * Terms of Service — single source of truth.
 *
 * Consumed by prisma/seed.js (fresh installs) and
 * prisma/sync-legal-docs.js (version-aware upgrade on boot), so a
 * version bump here reaches production on the next deploy.
 *
 * v1.1.0: added section 5, "Pet Care Tools" — a plain-language
 * responsibility note for the free medication/care tracker (helper,
 * not veterinary advice; release folded in once, calmly).
 */

const TERMS_OF_SERVICE_DOC = {
  slug: 'terms-of-service',
  type: 'TERMS_OF_SERVICE',
  version: '1.1.0',
  title: 'Terms of Service',
  summary: 'Platform usage rules and guidelines',
  content: `# Terms of Service

**Last Updated:** June 12, 2026
**Version:** 1.1.0

By using PetRecovery.org, you agree to the following terms:

## 1. Account Responsibilities

- **Accuracy**: You agree to provide accurate information about lost pets and your identity
- **Account Security**: You are responsible for maintaining the security of your account credentials
- **Age Requirement**: You must be at least 18 years old to create an account

## 2. Acceptable Use

- **Respectful Conduct**: Treat all volunteers, pet owners, and community members with respect
- **Truthful Information**: All pet information, sightings, and case updates must be truthful and accurate
- **No Misuse**: Do not use the platform for spam, harassment, or any illegal activities
- **Safety First**: Follow all safety protocols during searches and rescues

## 3. Privacy & Data

- **Data Collection**: We collect information necessary to coordinate pet searches (see Privacy Policy)
- **Communication**: We may contact you via email regarding your cases and rescue force activities
- **Data Sharing**: Your information is only shared with rescue force members for active cases

## 4. Rescue Force Participation

- **Liability**: See our separate Liability Waiver for terms regarding rescue force participation
- **Voluntary**: All rescue force participation is voluntary
- **Coordination**: Follow instructions from squad leaders and coordinators

## 5. Pet Care Tools

ReunitePets includes free tools for everyday pet care — medication schedules, dose logging, care routines, and shareable care pages.

- **A helper, not a vet**: These tools help you remember and organize. They do not provide veterinary or medical advice, and they never replace guidance from your veterinarian or a medication's label.
- **Your judgment leads**: You are responsible for the information you enter (medications, doses, times) and for the care decisions you make for your pet.
- **Reminders can fail**: Notifications depend on devices and networks. Please don't rely on them alone for critical care.
- **Shared access**: When you invite caregivers or share a view link, you choose who can see your pet's care record. You can change or revoke sharing anytime.
- **Release**: To the fullest extent permitted by law, you agree that PetRecovery.org and the Released Parties named in our Liability Waiver are not liable for outcomes related to use of the care tools, including missed, late, or incorrect doses.

## 6. Content & Intellectual Property

- **Your Content**: You retain ownership of photos and content you upload
- **License**: You grant us a license to display and distribute your content for pet recovery purposes
- **Platform Content**: PetRecovery.org branding and platform features are our intellectual property

## 7. Disclaimers

- **No Guarantee**: We cannot guarantee that lost pets will be found
- **Third-Party Actions**: We are not responsible for the actions of volunteers or other users
- **Service Availability**: We strive for 24/7 availability but cannot guarantee uninterrupted service

## 8. Termination

- We reserve the right to terminate accounts that violate these terms
- You may delete your account at any time through your account settings

## 9. Changes to Terms

- We may update these terms from time to time
- Material changes will require re-acceptance
- Continued use after changes constitutes acceptance

## 10. Contact

If you have questions about these terms, please contact us at:
- Email: legal@petrecovery.org
- Website: petrecovery.org

## 11. Governing Law

These terms are governed by the laws of the United States and the state in which our headquarters are located.

---

**By using PetRecovery.org, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.**`,
};

module.exports = { TERMS_OF_SERVICE_DOC };
