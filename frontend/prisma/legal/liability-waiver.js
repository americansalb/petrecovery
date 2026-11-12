/**
 * Liability Waiver, single source of truth.
 *
 * Lived inline in prisma/seed.js, which production never runs - so the
 * text people were agreeing to could not be changed by a deploy. Now it
 * sits beside the Terms and is picked up by prisma/sync-legal-docs.js,
 * the same version-aware path.
 *
 * v1.1.0: renamed the released party from PetRecovery.org to
 * ReunitePets. Nothing else changed.
 *
 * v2.0.0 (2026-11-12): rewritten. Founder: "We need to find a stronger
 * way to remove any liability." What v1 did not say, and this does:
 *
 *  - what ReunitePets is and is not: it checks no ground, the map it
 *    shows can be wrong, a warning list is never complete, nobody is
 *    watching where a helper is, and it is not an emergency service;
 *  - that a helper is a volunteer acting on their own, who chooses
 *    whether, where and how to search, and is nobody's employee or agent;
 *  - the risks by name: roads, water, rail lines, the dark, animals,
 *    other people, private property, the phone, driving;
 *  - that it is for adults, and a child comes only with their own parent
 *    or guardian;
 *  - that the pet's owner and the other helpers are released too.
 *
 * It keeps v1's release, indemnity, medical, photo and severability
 * terms. It is written to be read as plain text as well as rendered
 * (the join screen shows it raw), so it uses headings and lists only.
 *
 * A version change asks everyone again: app/lib/waiver.js counts an
 * acceptance only when it is of the version in this file. NOT REVIEWED
 * BY A LAWYER. It is a stronger draft, and what a waiver can release
 * differs by state and by country.
 */

const LIABILITY_WAIVER_DOC = {
  slug: 'liability-waiver',
  type: 'LIABILITY_WAIVER',
  version: '2.0.0',
  title: 'Liability Waiver and Assumption of Risk',
  summary: 'Required before joining a Rescue Force or taking part in a search',
  content: `# Liability Waiver and Assumption of Risk

Version 2.0.0. Last updated November 12, 2026.

## In short

- You search at your own risk.
- ReunitePets does not check any ground, and nobody is watching where you are.
- You give up the right to sue ReunitePets, the owner of the pet and the other people helping, if you are hurt or lose something while you take part.
- The full terms are below. Read all of them before you agree.

## 1. You take part by your own choice

- You are a volunteer. Nobody is paying you, and you are not an employee, agent or contractor of ReunitePets, of the owner of the pet, or of a Rescue Force.
- You decide whether to help, where you go, when, how, and for how long.
- An area, a street or a job that the site or another person offers you is a suggestion. You may turn any of it down, swap it, or stop at any time, without giving a reason.
- Nobody supervises you while you search.

## 2. What ReunitePets is, and is not

- ReunitePets is a website and app that passes messages between people and shows a map.
- It does not inspect, visit or know the condition of any place. It does not know who or what is there.
- The map and anything read from it, including any main road, rail line or water that the site names in an area, comes from other sources and can be wrong, out of date or incomplete. A list of things to take care near is never a complete list.
- An area with no warning on it is not safe ground. Nothing on the site says, or should be read as saying, that a place is safe.
- ReunitePets is not an emergency service. In an emergency, call your local emergency number.

## 3. The risks you accept

Looking for a lost animal outdoors can injure or kill you, and can damage or lose your property. You understand and accept all of the risks, including these:

- Roads and traffic, including being hit by a vehicle, and the risks of driving.
- Water of any kind: rivers, creeks, canals, ponds, lakes, drains, ice and flooding.
- Rail lines and trains.
- Rough, steep, slippery or unlit ground, and searching in the dark.
- Weather: heat, cold, rain, snow, lightning.
- Animals, including the pet you are looking for: bites, scratches, attacks and disease.
- Other people, including confrontation, assault and other crime.
- Going onto land or into a building that is not yours.
- Physical effort, and any health condition you have.
- Being distracted by your phone while you walk or drive.
- Loss of or damage to your belongings.
- Distress at what you see or at how a search ends.
- The acts or mistakes of other people, including the Released Parties named in section 6.

## 4. What you promise

- You are 18 or older. Someone under 18 takes part only with their own parent or legal guardian, who has accepted this waiver themselves, accepts it for the child, and stays with the child the whole time.
- You are fit to take part, and you will not search while affected by alcohol or drugs.
- You will follow the safety rules shown when you join.
- You will obey the law, including traffic law.
- You will stay off private property unless the person in charge of it says you may go on.
- You will stay out of the road, out of water and drains, and off rail lines.
- You will look at your phone only when you are standing still, and will pull over before you use it if you are driving.
- You will not chase, corner or try to catch an animal, and you will keep away from any animal that seems aggressive or sick.
- You will stop and leave if you feel unsafe.

## 5. Medical care and insurance

- ReunitePets provides no insurance of any kind for you: no medical, accident, liability or workers' compensation cover.
- You are responsible for your own insurance and for the cost of any medical or emergency care you receive.
- If you cannot consent, you agree to emergency medical treatment being given to you.

## 6. Release

To the fullest extent the law allows, you release and agree not to sue:

- ReunitePets and its owners, operators, officers, staff, contractors and volunteers;
- the owner of any pet you help look for, and anyone running that search;
- every Rescue Force and its members; and
- everyone else helping in a search,

(together, the "Released Parties") for any claim, loss, injury, death, damage or cost that arises from or relates to your taking part, however caused, INCLUDING WHERE IT IS CAUSED BY THE NEGLIGENCE OF A RELEASED PARTY.

This release covers claims of every kind, including negligence, breach of contract or warranty, and breach of any statute, and claims brought by your family, heirs, estate or anyone else on your behalf.

It does not apply to gross negligence, recklessness or intentional misconduct, or to any liability that the law does not allow to be released.

## 7. Indemnity

You will pay for and defend the Released Parties against any claim, loss or cost (including reasonable legal fees) that arises from what you do or fail to do while taking part, including trespass, damage to property, injury to another person or to an animal, and any breach of this waiver or of the law.

## 8. Photographs

You agree that photographs or video taken during a search may be used to document it, to teach, and to promote ReunitePets.

## 9. General

- The ReunitePets Terms of Service also apply to you, including what they say about the law that governs.
- If part of this waiver cannot be enforced, the rest still applies, and that part applies as far as the law allows.
- Agreeing on a screen is your signature. This waiver binds you and your heirs, estate and representatives.
- It applies to every search you take part in through ReunitePets, now and later, until a new version replaces it.

## 10. Your agreement

BY AGREEING, YOU CONFIRM THAT YOU HAVE READ THIS WAIVER, THAT YOU UNDERSTAND IT, THAT YOU ARE GIVING UP LEGAL RIGHTS INCLUDING THE RIGHT TO SUE, AND THAT YOU AGREE TO IT FREELY.

If you do not agree, do not join a Rescue Force or take part in a search.

Questions about this waiver: support@petrecovery.org`,
};

module.exports = { LIABILITY_WAIVER_DOC };
