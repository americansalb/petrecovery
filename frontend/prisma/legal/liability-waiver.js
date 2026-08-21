/**
 * Liability Waiver, single source of truth.
 *
 * Lived inline in prisma/seed.js, which production never runs - so the
 * text people were agreeing to could not be changed by a deploy. Now it
 * sits beside the Terms and is picked up by prisma/sync-legal-docs.js,
 * the same version-aware path.
 *
 * v1.1.0: renamed the released party from PetRecovery.org to
 * ReunitePets. Nothing else changed - no obligation added, removed or
 * reworded. The site had been renamed and this document still released
 * a party under a name the site no longer uses, which is a poor thing to
 * ask someone to sign.
 */

const LIABILITY_WAIVER_DOC = {
  slug: 'liability-waiver',
  type: 'LIABILITY_WAIVER',
  version: '1.1.0',
  title: 'Liability Waiver for Rescue Force Participation',
  summary: 'Required before joining rescue forces or participating in searches',
  content: `# Liability Waiver for Rescue Force Participation

**Last Updated:** November 24, 2025
**Version:** 1.0.0

## ⚠️ IMPORTANT: READ CAREFULLY BEFORE PARTICIPATING

By joining a rescue force or participating in pet searches through ReunitePets, you acknowledge and agree to the following terms:

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
You release, waive, discharge, and covenant not to sue ReunitePets, its operators, officers, employees, volunteers, and fellow rescue force members (collectively "Released Parties") from any and all liability, claims, demands, actions, and causes of action whatsoever arising out of or related to:

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

- Follow all safety guidelines provided by squad leaders
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
- You will inform squad leaders of any relevant medical conditions or limitations

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
- Email: legal@petrecovery.org
- Website: petrecovery.org

**For emergency situations during searches, call 911 immediately.**`
};

module.exports = { LIABILITY_WAIVER_DOC };
