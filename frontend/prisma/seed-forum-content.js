/**
 * Seed Forum Content
 *
 * Creates sample threads and posts from community members including Sarama.
 * Run: node prisma/seed-forum-content.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Sample user: Sarama - experienced rescue volunteer
const SARAMA_PROFILE = {
  email: 'sarama@petrecovery.org',
  firstName: 'Sarama',
  lastName: 'Volunteer',
  bio: 'Rescue volunteer since 2018. Specializing in scared/shy dogs. Based in Texas but help coordinate transports nationwide.',
  location: 'Austin, TX',
  trustLevel: 4,
  reputation: 850,
};

// Additional community members
const COMMUNITY_MEMBERS = [
  { email: 'maria.foster@example.com', firstName: 'Maria', lastName: 'F', bio: 'Foster mom to 30+ dogs and counting!', location: 'Denver, CO', trustLevel: 3 },
  { email: 'john.transporter@example.com', firstName: 'John', lastName: 'T', bio: 'Long haul trucker, happy to help with pet transport.', location: 'On the road', trustLevel: 2 },
  { email: 'dr.lisa.vet@example.com', firstName: 'Dr. Lisa', lastName: 'M', bio: 'Veterinarian, here to answer medical questions.', location: 'Chicago, IL', trustLevel: 3, isVerifiedShelter: true },
  { email: 'newbie.rescuer@example.com', firstName: 'Alex', lastName: 'N', bio: 'New to rescue, learning the ropes!', location: 'Portland, OR', trustLevel: 1 },
];

// Sample threads from Sarama
const SARAMA_THREADS = [
  {
    category: 'welcome',
    title: 'Welcome! Start here if you\'re new to rescue',
    isPinned: true,
    content: `Hey everyone! I'm Sarama, and I've been volunteering in pet rescue for about 6 years now. I wanted to create a quick guide for anyone who's new to this community or to rescue work in general.

**Why We're Here**
This community exists to help reunite lost pets with their families and support the broader rescue network. Whether you've lost a pet, found one, or just want to help - you're in the right place.

**How to Use This Forum**
- 🚨 **Lost a pet?** Use the "Report Lost Pet" template. Include photos, last known location, and contact info.
- 🔍 **Found a pet?** Use the "Report Found Pet" template. Get them scanned for a microchip at any vet (it's free!).
- 🚗 **Can help transport?** Check the Transport category. Even driving 1 hour helps!
- 💬 **Have questions?** Ask! There are no dumb questions here.

**Community Values**
1. We assume good intentions
2. We keep information confidential when needed
3. We support each other, even when things don't go as planned
4. We celebrate every reunion, big or small

**My Tips for New Rescuers**
- Start small. Sharing posts on social media is valuable!
- Learn your local resources (shelters, rescues, vets)
- Don't be afraid to ask for help
- Self-care matters. Rescue burnout is real.

Feel free to reply with your own tips or just to say hi! Looking forward to working with all of you.

---
*"Every pet deserves to find their way home."* 🏠`,
  },
  {
    category: 'training',
    title: 'Guide: How to safely approach a scared stray dog',
    isPinned: true,
    content: `One of the most common questions I get is: "I found a stray dog, but it runs away when I approach. What do I do?"

This is SO important because approaching wrong can make the situation worse. Let me share what I've learned.

**First: Safety**
- Never corner a scared dog
- Watch for warning signs (growling, stiff body, whale eye)
- Have an escape route for yourself
- Don't reach over their head

**The Approach**
1. **Get low.** Sit or squat at their level.
2. **Turn sideways.** Direct eye contact is threatening.
3. **Be boring.** Scroll on your phone. Read a book. Just... exist near them.
4. **Let them come to you.** This is the hardest part. It can take hours or days.

**Food Lures**
- Smelly is best (hot dogs, rotisserie chicken, sardines)
- Create a trail leading to you
- Toss food BEHIND them so they move toward you
- Never hand-feed until they're comfortable

**What NOT to Do**
- Chase them (they're faster than you)
- Use a catch pole unless you're trained
- Corner them (panic bites happen)
- Give up after 10 minutes

**The Feeding Station Technique**
For very scared dogs:
1. Set up food and water at the same spot, same time daily
2. Sit nearby (far at first, closer each day)
3. Let them associate you with food
4. This can take a week. Be patient.

**When to Call for Help**
- Dog is injured
- Dog is in immediate danger (traffic)
- Dog is aggressive
- You've been trying for 3+ days with no progress

Local rescues often have humane traps and experienced handlers.

---
Questions? Drop them below. And share your own tips! Different dogs need different approaches.`,
  },
  {
    category: 'transport',
    title: 'TRANSPORT NEEDED: Houston, TX to Denver, CO',
    content: `**Transport Details:**
- Animal: Sweet senior dog named Mabel, 9 years old
- Breed/Size: Beagle mix, about 30 lbs
- Temperament: Calm, loves car rides, crate trained

**Route:**
- From: Houston, TX
- To: Denver, CO (her foster home is waiting!)
- Deadline: January 15th
- Flexible on dates: Yes, anytime in the next 2 weeks works

**Requirements:**
- Crate provided: Yes (will meet with crate and supplies)
- Special needs: Needs her thyroid medication 2x daily (very easy)
- Vet records available: Yes, fully vetted

**Legs Needed:**
Looking for drivers who can cover any portion:
- Houston to Dallas (~240 mi)
- Dallas to Amarillo (~360 mi)
- Amarillo to Denver (~290 mi)

Or any combination! Even partial legs help.

**Coordinator Contact:**
- Sarama
- Best to message me here on the forum

---
Mabel was surrendered when her elderly owner passed away. She's been in the shelter for 2 months and really needs to get to her foster home. Any help is SO appreciated! 💜

Photo of Mabel: She's a tricolor beagle with the sweetest face. A bit overweight but we're working on that!`,
  },
  {
    category: 'lost-pet-support',
    title: 'Tips: What to do in the first 24 hours when your pet goes missing',
    isPinned: true,
    content: `When a pet goes missing, those first 24 hours are critical. I've helped with hundreds of lost pet cases, and here's what I've learned.

**IMMEDIATELY (First 2 Hours)**

1. **Search your home thoroughly**
   - Check inside appliances (dryers, under recliners)
   - Look UP - cats especially climb
   - Shake treat bags, open canned food loudly

2. **Walk your neighborhood**
   - Call their name calmly (panicked voice scares them)
   - Bring treats and a favorite toy
   - Ask every person you see

3. **Alert your local community**
   - Post on Nextdoor
   - Post in local Facebook groups
   - Put out the word at local businesses

**Within 24 Hours**

4. **Contact shelters and vets**
   - Call every shelter within 30 miles
   - Call all 24-hour emergency vets
   - File a lost pet report (don't just call - GO IN PERSON)

5. **Create flyers**
   - Large, clear photo
   - The word "LOST" in big letters
   - Distinctive features
   - Your phone number (not your address)
   - "REWARD" if you can offer one

6. **Set up a scent trail**
   - Put their bed, your worn clothes, and their litter box (for cats) outside
   - Dogs can smell this from miles away

7. **File reports online**
   - PetRecovery.org (here!)
   - Petfinder
   - PawBoost
   - Local lost pet Facebook groups

**For Scared/Shy Pets**
- Set up a humane trap with food
- Put up trail cameras if you can
- Search at dawn and dusk (they're more active)
- DON'T CHASE - it makes them run further

**For Indoor Cats**
- They usually don't go far (often within 3 houses)
- Search at night with a flashlight (their eyes reflect)
- Leave a garage or window cracked open

**Don't Give Up**
Pets have been found weeks, months, even YEARS later. Keep those flyers up. Keep checking shelters. Keep hope alive.

---
Feel free to ask questions. We're all here to help each other bring pets home. 🏠`,
  },
  {
    category: 'success-stories',
    title: 'REUNITED: After 47 days, Cooper is home! 🎉',
    content: `I have to share this because it's one of the most incredible reunions I've been part of.

**The Story**
Cooper, a 4-year-old Golden Retriever, escaped during a thunderstorm on October 15th. His family was devastated. They did everything right - flyers, social media, shelters - but no sightings.

**The Journey**
For 47 days, nothing. The family was losing hope.

Then, a sighting was reported 15 miles from home. Then another. We set up feeding stations and trail cameras.

On Day 44, we got a clear photo - it was definitely Cooper. But he was scared and wouldn't let anyone near him.

**The Reunion**
We set up a humane trap with his owner's worn t-shirt and his favorite treats. On Day 47, at 3 AM, we got the alert - Cooper was in the trap!

When his owner arrived, Cooper's tail started wagging so hard his whole body shook. There wasn't a dry eye in the parking lot.

**What Worked**
- Never giving up
- Trail cameras to confirm location
- Using the owner's scent
- Patience with the trap
- This community sharing sightings

**Thank You**
To everyone who shared posts, drove out to look, or sent encouraging messages - THANK YOU. This is what community looks like.

**Cooper's Owner's Message**
"I thought I'd never see him again. Thank you to everyone who helped bring my boy home. I can't stop hugging him."

---
Never. Give. Up. 💛

Photos available if anyone wants to see Cooper's happy face (now 10 lbs heavier from all the reunion treats 😄)`,
  },
  {
    category: 'general',
    title: 'Self-care check-in: How are you doing? 💜',
    content: `Hey rescue family,

I know we spend so much time helping animals and other people, but I wanted to check in on YOU.

**Rescue work is hard.** We see neglect, abuse, heartbreak. We lose animals we've grown to love. We deal with frustrating systems and sometimes frustrating people. We often use our own money and sacrifice our personal time.

**It's okay to:**
- Take a break
- Say no to a transport or foster request
- Feel sad when things don't work out
- Step back when you're burned out
- Cry (I do, often)
- Ask for help

**Some things that help me:**
1. Setting boundaries (I don't answer rescue messages after 9 PM)
2. Focusing on the wins (I keep a folder of happy adoption photos)
3. Connecting with other rescuers who GET IT
4. Taking actual days off
5. Remembering that I can't save every animal, but I can make a difference

**So tell me - how are you doing?**

Not with rescue, with YOU. What's one thing that's been hard lately? What's one thing that's been good?

This is a judgment-free zone. Let's support each other the way we support the animals.

---
*You can't pour from an empty cup.* 🫶`,
  },
];

// Sample replies to Sarama's posts
const SAMPLE_REPLIES = {
  'welcome': [
    { author: 'Maria', content: 'This is perfect! I\'ve been in rescue for 3 years and still learned something. Can we pin this?' },
    { author: 'Alex', content: 'Thank you so much for this! I literally just found this community yesterday after fostering my first dog. Feeling overwhelmed but excited!' },
    { author: 'Sarama', content: '@Alex Welcome!! Don\'t hesitate to ask questions. We were all new once. What kind of dog are you fostering?' },
    { author: 'Alex', content: '@Sarama He\'s a 2-year-old pit mix. Super sweet but I have no idea what I\'m doing 😅' },
    { author: 'Maria', content: '@Alex You\'re already doing great just by caring enough to ask! Pit mixes are the best cuddle bugs.' },
  ],
  'approach-scared-dog': [
    { author: 'John', content: 'Great tips! I once sat in a field for 4 hours before a scared dog approached me. Worth every minute.' },
    { author: 'Dr. Lisa', content: 'As a vet, I want to add - if you do get bitten, please seek medical attention even if it seems minor. And always check for rabies vaccination status if possible.' },
    { author: 'Alex', content: 'The feeding station technique worked for me! It took 5 days but finally caught a stray who\'s now living his best life in his forever home.' },
  ],
  'mabel-transport': [
    { author: 'John', content: 'I can do Houston to Dallas! I\'m driving that way on the 10th anyway. DM me the details.' },
    { author: 'Maria', content: 'I know someone in Amarillo who might be able to help with the last leg. Let me reach out!' },
    { author: 'Sarama', content: '@John That would be amazing!! DMing you now. @Maria yes please! We\'re so close to getting this girl to safety.' },
  ],
};

async function seedForumContent() {
  console.log('🌱 Seeding forum content...\n');

  try {
    // Create or get Sarama user
    let sarama = await prisma.user.findUnique({
      where: { email: SARAMA_PROFILE.email },
    });

    if (!sarama) {
      sarama = await prisma.user.create({
        data: {
          email: SARAMA_PROFILE.email,
          firstName: SARAMA_PROFILE.firstName,
          lastName: SARAMA_PROFILE.lastName,
          emailVerified: new Date(),
        },
      });
      console.log('✅ Created Sarama user');
    }

    // Create forum profile for Sarama
    await prisma.forumProfile.upsert({
      where: { userId: sarama.id },
      update: {
        bio: SARAMA_PROFILE.bio,
        location: SARAMA_PROFILE.location,
        trustLevel: SARAMA_PROFILE.trustLevel,
        reputation: SARAMA_PROFILE.reputation,
      },
      create: {
        userId: sarama.id,
        bio: SARAMA_PROFILE.bio,
        location: SARAMA_PROFILE.location,
        trustLevel: SARAMA_PROFILE.trustLevel,
        reputation: SARAMA_PROFILE.reputation,
      },
    });
    console.log('✅ Created Sarama forum profile');

    // Create community members
    const members = {};
    for (const member of COMMUNITY_MEMBERS) {
      let user = await prisma.user.findUnique({
        where: { email: member.email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: member.email,
            firstName: member.firstName,
            lastName: member.lastName,
            emailVerified: new Date(),
          },
        });
      }

      await prisma.forumProfile.upsert({
        where: { userId: user.id },
        update: {
          bio: member.bio,
          location: member.location,
          trustLevel: member.trustLevel,
          isVerifiedShelter: member.isVerifiedShelter || false,
        },
        create: {
          userId: user.id,
          bio: member.bio,
          location: member.location,
          trustLevel: member.trustLevel,
          isVerifiedShelter: member.isVerifiedShelter || false,
        },
      });

      members[member.firstName] = user;
    }
    members['Sarama'] = sarama;
    console.log('✅ Created community members');

    // Get categories
    const categories = await prisma.forumCategory.findMany();
    const categoryMap = {};
    categories.forEach(c => categoryMap[c.slug] = c);

    // Create threads
    for (const threadData of SARAMA_THREADS) {
      const category = categoryMap[threadData.category];
      if (!category) {
        console.log(`⚠️ Category not found: ${threadData.category}`);
        continue;
      }

      // Check if thread already exists
      const existingThread = await prisma.forumThread.findFirst({
        where: { title: threadData.title },
      });

      if (existingThread) {
        console.log(`⏭️ Thread already exists: ${threadData.title.slice(0, 40)}...`);
        continue;
      }

      const slug = threadData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80) + '-' + Date.now().toString(36);

      const thread = await prisma.forumThread.create({
        data: {
          title: threadData.title,
          slug,
          content: threadData.content,
          categoryId: category.id,
          authorId: sarama.id,
          isPinned: threadData.isPinned || false,
          urgencyLevel: threadData.urgencyLevel || 'NORMAL',
          replyCount: 0,
          viewCount: Math.floor(Math.random() * 500) + 50,
        },
      });

      // Update category thread count
      await prisma.forumCategory.update({
        where: { id: category.id },
        data: { threadCount: { increment: 1 } },
      });

      console.log(`✅ Created thread: ${threadData.title.slice(0, 50)}...`);

      // Add sample replies if available
      const replyKey = threadData.title.includes('Welcome') ? 'welcome' :
                       threadData.title.includes('approach') ? 'approach-scared-dog' :
                       threadData.title.includes('Mabel') ? 'mabel-transport' : null;

      if (replyKey && SAMPLE_REPLIES[replyKey]) {
        let replyCount = 0;
        for (const reply of SAMPLE_REPLIES[replyKey]) {
          const author = members[reply.author];
          if (!author) continue;

          await prisma.forumPost.create({
            data: {
              threadId: thread.id,
              authorId: author.id,
              content: reply.content,
              helpfulCount: Math.floor(Math.random() * 10),
              heartCount: Math.floor(Math.random() * 5),
            },
          });
          replyCount++;
        }

        // Update thread reply count
        await prisma.forumThread.update({
          where: { id: thread.id },
          data: { replyCount },
        });

        console.log(`   ↳ Added ${replyCount} replies`);
      }
    }

    // Award badges to Sarama
    const badges = await prisma.badge.findMany({
      where: {
        slug: {
          in: ['first-post', 'helper', 'transport-hero', 'reunion-champion', 'trusted-member'],
        },
      },
    });

    for (const badge of badges) {
      await prisma.userBadge.upsert({
        where: {
          userId_badgeId: {
            userId: sarama.id,
            badgeId: badge.id,
          },
        },
        update: {},
        create: {
          userId: sarama.id,
          badgeId: badge.id,
        },
      });
    }
    console.log(`✅ Awarded ${badges.length} badges to Sarama`);

    console.log('\n🎉 Forum content seeding complete!');
    console.log('   View the community at /hub');

  } catch (error) {
    console.error('❌ Error seeding forum content:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedForumContent();
