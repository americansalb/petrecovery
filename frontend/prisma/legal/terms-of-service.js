/**
 * Terms of Service, single source of truth.
 *
 * Consumed by prisma/seed.js (fresh installs) and
 * prisma/sync-legal-docs.js (version-aware upgrade on boot), so a
 * version bump here reaches production on the next deploy.
 *
 * v1.1.0: added section 5, "Pet Care Tools", a plain-language
 * responsibility note for the free medication/care tracker (helper,
 * not veterinary advice; release folded in once, calmly).
 *
 * v1.3.0: renamed the party throughout from PetRecovery.org to
 * ReunitePets. No obligation added, removed or reworded - the site had
 * been renamed and the Terms still bound users to a name the site no
 * longer uses.
 *
 * v1.2.0: section 5 grew to cover the Health Book (vaccination records,
 * weight log, vet info, health share pages): owner-kept record, not a
 * verified medical record or proof of vaccination; statuses are date
 * math; emergencies go to a vet; share-link visibility; release
 * extended to health records. Same calm register: disclose clearly,
 * don't scare.
 */

const TERMS_OF_SERVICE_DOC = {
  slug: 'terms-of-service',
  type: 'TERMS_OF_SERVICE',
  version: '1.3.0',
  title: 'Terms of Service',
  summary: 'Platform usage rules and guidelines',
  content: `# Terms of Service

**Last Updated:** July 27, 2026
**Version:** 1.2.0

By using ReunitePets, you agree to the following terms:

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

## 5. Pet Care Tools & Your Pet's Health Book

ReunitePets includes free tools for everyday pet care: medication schedules, dose logging, care routines, a Health Book (vaccination records, weight history, and your vet's contact info), and shareable care and health pages. Here's the honest, common-sense version of how to hold them:

- **A helper, not a vet**: These tools help you remember and organize. They do not provide veterinary or medical advice, they do not create a veterinarian-client-patient relationship, and they never replace guidance from your veterinarian or a medication's label.
- **A record you keep**: The Health Book shows exactly what you (and caregivers you invite) enter. Nothing in it is verified by a clinic. Labels like "current," "due soon," or "expired" are simple date arithmetic on the dates you typed: helpful nudges, not medical judgments.
- **Not an official document**: The Health Book is not proof of vaccination and not a substitute for official records. For anything formal (travel, boarding, grooming, licensing, or a rabies certificate), the paperwork from your vet is the document that counts. A good habit: double-check what you enter against the certificate it came from.
- **Emergencies are for vets**: If your pet seems sick, hurt, or off, contact a veterinarian or emergency clinic right away. Never wait on an app, including this one.
- **Your judgment leads**: You are responsible for the information you enter (medications, doses, dates, records) and for the care decisions you make for your pet.
- **Reminders can fail**: Notifications depend on devices and networks. Please don't rely on them alone for critical care.
- **Shared access**: When you invite caregivers or share a view link, anyone who has that link can see your pet's care and health record. Share thoughtfully; you can change or revoke sharing anytime from your pet's pages.
- **Release**: To the fullest extent permitted by law, you agree that ReunitePets and the Released Parties named in our Liability Waiver are not liable for outcomes related to use of the care tools or the Health Book, including missed, late, or incorrect doses, inaccurate or incomplete records, or decisions made in reliance on statuses, records, or reminders shown by the service.

## 6. Content & Intellectual Property

- **Your Content**: You retain ownership of photos and content you upload
- **License**: You grant us a license to display and distribute your content for pet recovery purposes
- **Platform Content**: ReunitePets branding and platform features are our intellectual property

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

**By using ReunitePets, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.**`,
};

module.exports = { TERMS_OF_SERVICE_DOC };
