const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================================================
  // ADMIN USER
  // ============================================================================

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'contact@aalb.org' }
  });

  if (!existingAdmin) {
    // Hash the admin password
    const passwordHash = await bcrypt.hash('winner', 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'contact@aalb.org',
        passwordHash,
        firstName: 'Admin',
        role: 'ADMIN',
        emailVerified: new Date(), // Admin is pre-verified
      }
    });

    console.log('✅ Admin user created successfully');
    console.log('   Email: contact@aalb.org');
    console.log('   Password: winner');
    console.log('   Role: ADMIN');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // ============================================================================
  // LEGAL DOCUMENTS (Phase 0)
  // ============================================================================

  const legalDocuments = [
    {
      slug: 'terms-of-service',
      type: 'TERMS_OF_SERVICE',
      version: '1.0.0',
      title: 'Terms of Service',
      summary: 'Platform usage rules and guidelines',
      content: `# Terms of Service

**Last Updated:** November 24, 2025
**Version:** 1.0.0

By using ReunitePets.org, you agree to the following terms:

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
- **Coordination**: Follow instructions from force leaders and coordinators

## 5. Content & Intellectual Property

- **Your Content**: You retain ownership of photos and content you upload
- **License**: You grant us a license to display and distribute your content for pet recovery purposes
- **Platform Content**: ReunitePets.org branding and platform features are our intellectual property

## 6. Disclaimers

- **No Guarantee**: We cannot guarantee that lost pets will be found
- **Third-Party Actions**: We are not responsible for the actions of volunteers or other users
- **Service Availability**: We strive for 24/7 availability but cannot guarantee uninterrupted service

## 7. Termination

- We reserve the right to terminate accounts that violate these terms
- You may delete your account at any time through your account settings

## 8. Changes to Terms

- We may update these terms from time to time
- Material changes will require re-acceptance
- Continued use after changes constitutes acceptance

## 9. Contact

If you have questions about these terms, please contact us at:
- Email: legal@reunitepets.org
- Website: reunitepets.org

## 10. Governing Law

These terms are governed by the laws of the United States and the state in which our headquarters are located.

---

**By using ReunitePets.org, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.**`
    },
    {
      slug: 'liability-waiver',
      type: 'LIABILITY_WAIVER',
      version: '1.0.0',
      title: 'Liability Waiver for Rescue Force Participation',
      summary: 'Required before joining rescue forces or participating in searches',
      content: `# Liability Waiver for Rescue Force Participation

**Last Updated:** November 24, 2025
**Version:** 1.0.0

## ⚠️ IMPORTANT: READ CAREFULLY BEFORE PARTICIPATING

By joining a rescue force or participating in pet searches through ReunitePets.org, you acknowledge and agree to the following terms:

## 1. Voluntary Participation

- You are participating **voluntarily** and at your own risk
- You are under no obligation to participate in any search or rescue activity
- You may withdraw from participation at any time

## 2. Assumption of Risk

You understand and acknowledge that participating in pet search and rescue activities involves inherent risks, including but not limited to:

### Physical Risks
- **Outdoor Hazards**: Uneven terrain, slippery surfaces, obstacles, debris
- **Weather Exposure**: Heat, cold, rain, snow, lightning
- **Wildlife Encounters**: Dogs, cats, wild animals, insects, snakes
- **Traffic**: Searching near roads, parking lots, and vehicle traffic
- **Physical Exertion**: Walking, running, climbing, lifting

### Other Risks
- **Property Damage**: Potential damage to personal belongings or equipment
- **Illness**: Exposure to allergens, diseases, or infections
- **Emotional Stress**: Exposure to distressed pets or unsuccessful search outcomes

## 3. Release of Liability

In consideration for being allowed to participate in rescue force activities, you hereby:

### Release and Hold Harmless
You release, waive, discharge, and covenant not to sue ReunitePets.org, its operators, officers, employees, volunteers, and fellow rescue force members (collectively "Released Parties") from any and all liability, claims, demands, actions, and causes of action whatsoever arising out of or related to:

- Any loss, damage, or injury (including death) that may be sustained by you
- Any property damage or loss
- Any actions or omissions of the Released Parties

### Scope of Release
This release applies to claims based on:
- Negligence of the Released Parties
- Defective equipment or property
- Breach of contract or warranty
- Violation of any statute or regulation

**Exception**: This release does not apply to claims arising from gross negligence or willful misconduct.

## 4. Medical Insurance & Treatment

- **Insurance**: You are responsible for maintaining your own medical/health insurance
- **Medical Costs**: You agree to be solely responsible for any medical or emergency costs
- **Emergency Treatment**: You authorize emergency medical treatment if you are unable to consent

## 5. Safety Protocols

You agree to:

- Follow all safety guidelines provided by force leaders
- Use appropriate safety equipment when recommended
- Report any hazards or unsafe conditions immediately
- Stop participation if you feel unsafe or unwell
- Follow traffic laws and property rights
- Avoid trespassing on private property without permission

## 6. Fitness to Participate

You represent and warrant that:

- You are physically and mentally fit to participate in search activities
- You have no medical conditions that would prevent safe participation
- You will not participate if under the influence of drugs or alcohol
- You will inform force leaders of any relevant medical conditions or limitations

## 7. Indemnification

You agree to **indemnify and hold harmless** the Released Parties from:

- Any claims brought against them by third parties
- Any costs, damages, or expenses (including attorney fees) resulting from your participation
- Any claims arising from your violation of these terms or applicable laws

## 8. Photographic Release

You grant permission for photographs or videos taken during rescue activities to be used for:
- Documentation purposes
- Platform promotion and awareness
- Educational materials

## 9. Acknowledgment of Understanding

By accepting this waiver, you acknowledge that:

- ✅ You have read this entire waiver
- ✅ You understand all terms and conditions
- ✅ You are voluntarily waiving legal rights
- ✅ You have had opportunity to ask questions and seek legal counsel
- ✅ You understand this is a legal document binding you and your heirs

## 10. Severability

If any provision of this waiver is found to be unenforceable, the remaining provisions shall remain in full force and effect.

## 11. Governing Law

This waiver is governed by the laws of the United States and the state in which our headquarters are located.

---

## ⚠️ FINAL ACKNOWLEDGMENT

**I HAVE READ THIS WAIVER OF LIABILITY, ASSUMPTION OF RISK, AND INDEMNITY AGREEMENT. I FULLY UNDERSTAND ITS TERMS AND UNDERSTAND THAT I AM GIVING UP SUBSTANTIAL RIGHTS, INCLUDING MY RIGHT TO SUE.**

**I ACKNOWLEDGE THAT I AM SIGNING THIS AGREEMENT FREELY AND VOLUNTARILY, AND INTEND MY ACCEPTANCE TO BE A COMPLETE AND UNCONDITIONAL RELEASE OF ALL LIABILITY TO THE GREATEST EXTENT ALLOWED BY LAW.**

---

**If you do not agree to these terms, you may NOT join rescue forces or participate in search activities.**

**If you have questions about this waiver, please contact:**
- Email: legal@reunitepets.org
- Website: reunitepets.org

**For emergency situations during searches, call 911 immediately.**`
    },
    {
      slug: 'privacy-policy',
      type: 'PRIVACY_POLICY',
      version: '1.0.0',
      title: 'Privacy Policy',
      summary: 'How we collect, use, and protect your personal information',
      content: `# Privacy Policy

**Last Updated:** November 24, 2025
**Version:** 1.0.0

ReunitePets.org ("we," "us," or "our") respects your privacy and is committed to protecting your personal information.

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
- Your search activity is visible to other force members during active cases

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
- Email: privacy@reunitepets.org
- Account Settings: reunitepets.org/settings/privacy

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

- ReunitePets.org is not intended for users under 18
- We do not knowingly collect information from children
- If we discover underage users, we will delete their accounts promptly
- Parents concerned about underage access should contact us immediately

## 10. International Users

- Our servers are located in the United States
- By using ReunitePets.org, you consent to data transfer to the US
- We comply with applicable international data protection laws

## 11. Changes to This Policy

### Notification of Changes
- Material changes will be posted on this page
- You will be notified via email for significant changes
- Continued use after changes constitutes acceptance

### Version History
- You can view previous versions by contacting us
- Current version always available at: reunitepets.org/legal/privacy-policy

## 12. Contact Us

### Privacy Questions
Email: privacy@reunitepets.org

### Data Requests
Email: data-requests@reunitepets.org

### General Inquiries
Website: reunitepets.org/contact

### Mailing Address
ReunitePets.org
[Address to be added]
United States

---

**By using ReunitePets.org, you acknowledge that you have read and understood this Privacy Policy.**

**Last updated: November 24, 2025**`
    }
  ];

  console.log('📄 Seeding legal documents...');

  for (const doc of legalDocuments) {
    const existing = await prisma.legalDocument.findUnique({
      where: { slug: doc.slug }
    });

    if (!existing) {
      await prisma.legalDocument.create({ data: doc });
      console.log(`✅ Created ${doc.title} (v${doc.version})`);
    } else {
      console.log(`ℹ️  ${doc.title} already exists`);
    }
  }

  console.log('🌱 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
