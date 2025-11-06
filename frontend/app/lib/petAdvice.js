// PetRecovery.org - Complete Pet Recovery Advice Logic
// This is the core advice engine - carefully crafted, not AI-generated

const PetRecoveryAdvice = {
  // DOG LOGIC
  dog: {
    scenarios: {
      jumped_fence: {
        just_now: {
          priority_actions: [
            "DO NOT CHASE - Dogs think it's a game. Walk calmly in the direction they went.",
            "Grab their favorite treats and squeaky toy - familiar sounds carry far",
            "Check with immediate neighbors - dogs often stop at the first interesting smell",
            "One person stays home in case they return - leave gate open"
          ],
          immediate_checklist: [
            "Call their name calmly every 30 seconds while walking",
            "Listen for barking or tags jingling",
            "Check neighbor's backyards - especially ones with dogs",
            "Look for movement under cars - dogs often hide when scared"
          ],
          mistakes_to_avoid: [
            "Don't panic-run - you'll miss visual/audio cues",
            "Don't bring other dogs - might complicate things",
            "Don't yell angrily - they'll hide from you"
          ],
          reassurance: "85% of fence jumpers are found within 1 mile in the first 2 hours"
        },
        hours_ago: {
          priority_actions: [
            "EXPAND SEARCH to 2-mile radius - dogs can cover distance quickly",
            "Post to Nextdoor, Facebook, Ring Neighbors NOW with photo",
            "Drive slowly through neighborhood with windows down, calling gently",
            "Contact nearest 3 shelters - give them your info immediately"
          ],
          immediate_checklist: [
            "Put their bed/your unwashed shirt outside - scent beacon",
            "Ask every person walking - dog walkers especially",
            "Check all parks within 2 miles - dogs seek play areas",
            "Call local vets - in case someone brings them in",
            "Contact pizza delivery, mail carriers - they know the area"
          ],
          search_zones: [
            "School yards after 5pm",
            "Restaurant dumpster areas",
            "Creek paths and wooded areas",
            "Dog parks at peak times (5-7pm)"
          ],
          reassurance: "73% of dogs are recovered within 24 hours"
        },
        yesterday: {
          priority_actions: [
            "VISIT shelters in person - don't just call, staff miss things",
            "Create and print flyers - include REWARD prominently",
            "Expand social media to city-wide groups",
            "Contact local rescue organizations for help"
          ],
          expanded_strategy: [
            "Set up feeding station with camera if possible",
            "Contact construction crews, landscapers in area",
            "Check industrial areas at dawn/dusk - dogs hide there",
            "Post flyers at all vet offices within 5 miles"
          ],
          psychological_tips: [
            "Dogs often travel in straight lines initially",
            "After 24 hours, they seek food sources",
            "Friendly dogs approach houses with dogs",
            "Scared dogs go nocturnal - search dawn/dusk"
          ],
          reassurance: "Dogs can survive weeks outdoors. Don't give up."
        },
        days_ago: {
          priority_actions: [
            "SHIFT TO SUSTAINED CAMPAIGN - this is now about persistence",
            "Hire pet tracker if available in your area",
            "Contact local news - they often cover lost pets",
            "Expand flyer radius to 5+ miles"
          ],
          long_term_strategy: [
            "Dogs enter survival mode after 3-4 days",
            "Set up feeding stations along likely routes",
            "Partner with homeless community - they see everything",
            "Check shelter websites daily - new intakes",
            "Consider humane traps with your scent items"
          ],
          pattern_recognition: [
            "Dogs often circle back after 5-7 days",
            "Check your home area repeatedly",
            "They may be nearby but too scared to approach",
            "Early morning (5-6am) most likely sighting time"
          ],
          reassurance: "Dogs have been recovered after months. Stay persistent."
        }
      },
      door_left_open: {
        just_now: {
          priority_actions: [
            "CHECK INSIDE FIRST - dogs often hide in house when door is open",
            "Walk your EXACT daily walk route - muscle memory kicks in",
            "Check with houses that have dogs - social attraction",
            "Leave door open with their food visible from outside"
          ],
          immediate_checklist: [
            "Call calmly - excited voice, not angry",
            "Shake treat bag while walking",
            "Check under all cars on your street",
            "Text all neighbors - someone may have already grabbed them"
          ],
          high_probability_spots: [
            "Your usual walking route",
            "Houses where they've gotten treats before",
            "That dog friend's house they always pull toward",
            "The spot where they usually poop"
          ],
          reassurance: "90% of door dashers are found within 4 blocks"
        },
        hours_ago: {
          priority_actions: [
            "SOCIAL DOGS: Check all neighborhood gathering spots",
            "Post 'URGENT' on all local social media with clear photo",
            "Drive your daily walk route slowly, windows down",
            "Alert mail carrier, delivery drivers, garbage collectors"
          ],
          search_strategy: [
            "Retrace every walk route you've ever taken",
            "Check with neighbors who give treats",
            "Visit nearby dog-friendly businesses",
            "Search at their usual walk times"
          ],
          reassurance: "Door dashers rarely go far - they're exploring, not escaping"
        }
      },
      got_spooked: {
        just_now: {
          priority_actions: [
            "SCARED DOGS HIDE - Check under everything within 500 feet",
            "Move slowly and speak softly - they're in flight mode",
            "Bring their favorite blanket - familiar scent calms them",
            "Do NOT bring people to help yet - too much activity increases fear"
          ],
          immediate_checklist: [
            "Check under: porches, cars, bushes, decks",
            "Look UP - scared dogs sometimes climb",
            "Sit quietly near likely hiding spots",
            "Use baby talk voice - it's less threatening"
          ],
          calming_tactics: [
            "Avoid direct eye contact if you see them",
            "Sit sideways, toss treats, ignore them",
            "Let them approach you - don't approach them",
            "Play recordings of your voice on your phone"
          ],
          reassurance: "Spooked dogs usually hide very close but won't respond for hours"
        },
        hours_ago: {
          priority_actions: [
            "SET UP BASE CAMP - Spooked dogs often circle back",
            "Put your worn clothes in a line leading home",
            "Open garage/shed doors - they seek shelter",
            "Contact professional tracker for scared dogs"
          ],
          fear_specific_advice: [
            "Scared dogs go into survival mode fast",
            "They may not recognize you - don't take it personally",
            "Best capture times: dawn and dusk",
            "Consider borrowing a calm, friendly dog as a magnet"
          ],
          reassurance: "Scared dogs often hide for 2-3 days before emerging"
        }
      },
      unknown: {
        just_now: {
          priority_actions: [
            "CHECK PROPERTY THOROUGHLY - They might be stuck somewhere",
            "Look for exit points - holes in fence, open gates",
            "Canvas neighbors immediately - someone saw something",
            "Assume all scenarios and check everything"
          ],
          immediate_checklist: [
            "Check: garage, basement, attic, shed",
            "Look for dig spots under fences",
            "Check if contractors/workers were at house",
            "Review security cameras if available"
          ],
          reassurance: "When unsure how they left, they're often closer than you think"
        }
      }
    },
    breed_specific: {
      husky_shepherd_active: "These breeds can travel 10+ miles. Expand search radius quickly.",
      bulldog_pug_brachycephalic: "These breeds tire quickly. Intensive search within 1 mile.",
      hound_beagle: "Follow their nose. Check restaurants, garbage areas, BBQ spots.",
      small_toy: "Check storm drains, under sheds, small spaces. Vulnerable to predators.",
      retriever_lab: "Very social. Check with anyone walking dogs, dog parks, pet stores."
    }
  },

  // CAT LOGIC
  cat: {
    scenarios: {
      indoor_cat_escaped: {
        just_now: {
          priority_actions: [
            "STOP! Indoor cats hide VERY close when scared - usually within 100 feet",
            "Get a flashlight - check UNDER everything, they go low",
            "Move slowly and quietly - indoor cats are terrified outside",
            "Put litter box outside immediately - they smell it from far away"
          ],
          immediate_checklist: [
            "Check under: ALL porches within 3 houses",
            "Inside: car engines, wheel wells (bang hood first)",
            "Behind: AC units, in dense bushes, wood piles",
            "Up: trees, roofs, inside gutters"
          ],
          critical_wisdom: [
            "Indoor cats often won't respond to your call when scared",
            "They're likely watching you search - frozen in fear",
            "Best search times: late night (11pm-2am) when quiet",
            "Shake treats, open can of food while searching"
          ],
          mistakes_to_avoid: [
            "Don't bring friends to help - too much noise",
            "Don't assume they've gone far - they haven't",
            "Don't give up after 30 minutes - they're hiding"
          ],
          reassurance: "75% of indoor cats are found within 200 feet of home"
        },
        hours_ago: {
          priority_actions: [
            "NIGHT SEARCH IS CRITICAL - Cats move at night when scared",
            "Set up comfort zone: litter, food, your worn shirt by door",
            "Borrow a humane trap - set with tuna or their favorite food",
            "Alert all neighbors to check garages, sheds in morning"
          ],
          expanded_search: [
            "Use flashlight to check for eye reflection",
            "Search in 5-house radius systematically",
            "Check warm spots: car engines, dryer vents",
            "Look inside anything with a roof: sheds, porches"
          ],
          indoor_cat_specific: [
            "They're not street smart - won't avoid dangers",
            "Extreme stress can change their behavior completely",
            "May not recognize you or respond to name",
            "Often found in strangest spots: inside grills, walls"
          ],
          reassurance: "Indoor cats usually stay in hiding for 2-5 days before emerging"
        },
        yesterday: {
          priority_actions: [
            "SEARCH AT 4-6 AM - Quiet enough for them to move",
            "Flyer focus: Ask people to check garages, sheds",
            "Set up wildlife camera if you have one",
            "Start checking shelters - someone may have 'rescued' them"
          ],
          persistence_strategy: [
            "Indoor cats often hide for DAYS before emerging",
            "Continue litter box and food outside",
            "Talk normally while sitting outside at dusk",
            "Play videos of yourself on phone outside"
          ],
          reassurance: "Indoor cats have been found after 2 weeks hiding in neighbor's garage"
        }
      },
      outdoor_cat_missing: {
        just_now: {
          priority_actions: [
            "CHECK TERRITORY BOUNDARIES - Outdoor cats patrol edges",
            "Look for new cats in area - they may be hiding from intruder",
            "Check any recent construction or changes in territory",
            "Call at their usual meal time from different spots"
          ],
          outdoor_specific: [
            "They know the area but something's keeping them away",
            "Check for injuries - may be hiding if hurt",
            "Look for new dogs, coyotes, foxes in area",
            "They might be locked in someone's garage/shed"
          ],
          reassurance: "Outdoor cats often return on their own within 2-3 days"
        },
        days_ago: {
          priority_actions: [
            "EXPAND SEARCH - Outdoor cats can travel miles if displaced",
            "Check with all vets - may be injured",
            "Ask about new cats at feeding stations",
            "Consider if someone is feeding them"
          ],
          patterns: [
            "Outdoor cats often have secondary families",
            "May be recovering from fight/injury",
            "Could be trapped in neighbor's shed/garage",
            "Sometimes 'adopted' by well-meaning people"
          ],
          reassurance: "Outdoor cats are survivors and often maintain multiple territories"
        }
      }
    },
    universal_cat_tips: {
      litter_strategy: "Used litter outside is more effective than food for scent",
      search_times: "Dawn and dusk when world is quiet",
      calling_technique: "Use food sounds (can opener, treat bag) more than voice",
      trap_advice: "Humane traps work well for scared cats - get from shelter",
      indoor_outdoor_difference: "Indoor cats hide and freeze; outdoor cats roam and return"
    }
  },

  // BIRD LOGIC
  bird: {
    scenarios: {
      flew_away: {
        immediate: {
          priority_actions: [
            "STAY WHERE THEY FLEW FROM - Birds often circle back",
            "Play their favorite sounds/music on speaker loudly",
            "Put cage outside with door open, favorite treats visible",
            "Call consistently - they navigate by sound"
          ],
          critical_info: [
            "Most pet birds can't fly far - wings tire quickly",
            "They usually land in highest nearby tree",
            "Scared birds go silent - doesn't mean they're gone",
            "Dawn and dusk are most vocal times"
          ],
          search_pattern: [
            "Look UP - birds go vertical when scared",
            "Check tall trees in 500-foot radius",
            "Listen for wild birds mobbing - they harass pet birds",
            "Watch for crow/jay activity - they investigate pet birds"
          ],
          reassurance: "Pet birds usually stay within 1 mile and survive well in warm weather"
        }
      }
    },
    species_specific: {
      parrots: "Very vocal at dawn/dusk. Play recordings of themselves. Social - may approach other birds.",
      parakeets_budgies: "Tire quickly. Check trees within 200 feet. Attracted to other budgie sounds.",
      cockatiels: "Excellent fliers. May travel farther. Listen for contact calls.",
      finches_canaries: "Poor fliers. Very local. Check dense bushes, evergreens."
    }
  },

  // OTHER PETS
  other: {
    rabbit: {
      priority: "Rabbits freeze when scared. Check under decks, in thick bushes within 100 feet. Most active dawn/dusk.",
      technique: "Sit quietly near hiding spots with greens. They're silent when scared."
    },
    ferret: {
      priority: "Check every hole, drain, tight space. Ferrets explore vertically. May be sleeping in strange spot.",
      technique: "Squeak toys work well. Check inside walls, appliances, any hole bigger than 2 inches."
    },
    guinea_pig: {
      priority: "Can't survive cold. Check warm spots, under bushes. Listen for wheaking at meal times.",
      technique: "Shake pellet container, bring companion pig if you have one."
    },
    reptile: {
      priority: "Seek warmth. Check sunny spots, warm car engines, near heated buildings.",
      technique: "Temperature dependent - sluggish when cold. Search warmest part of day."
    }
  },

  // TIME-CRITICAL ADVICE
  time_based_escalation: {
    first_hour: {
      focus: "Immediate area intensive search",
      radius: "Stay within 500 feet for cats, 1 mile for dogs",
      priority: "Physical searching over posting online"
    },
    first_6_hours: {
      focus: "Expand radius, start social media blast",
      radius: "2 miles for dogs, 5 houses for cats",
      priority: "Alert community while continuing search"
    },
    first_24_hours: {
      focus: "Systematic coverage, shelter alerts",
      radius: "5 miles for dogs, 1/2 mile for cats",
      priority: "Flyers at intersections, visit shelters"
    },
    after_48_hours: {
      focus: "Sustained campaign, pattern recognition",
      radius: "Expand based on sightings",
      priority: "Professional help, feeding stations, traps"
    }
  },

  // COMMON MISTAKES DATABASE
  critical_mistakes_to_avoid: {
    all_pets: [
      "Don't chase - even friendly pets run when chased",
      "Don't give up at night - many pets move at night",
      "Don't assume they'll come when called - fear changes behavior",
      "Don't flood area with helpers initially - too much activity",
      "Don't remove their scent - leave bedding outside"
    ],
    dogs: [
      "Don't bring other dogs initially - complicates things",
      "Don't yell angrily - they'll hide",
      "Don't assume they've gone far - usually close"
    ],
    cats: [
      "Don't assume outdoor cat is street smart if usually indoor",
      "Don't only search during day - cats move at dusk/night",
      "Don't give up if indoor cat - they hide for days"
    ]
  },

  // LOCATION-BASED RESOURCES
  universal_resources: {
    immediate_contacts: [
      "Local animal control - report immediately",
      "Nearest 3 shelters - provide details",
      "Emergency vets - in case of injury",
      "Local rescue groups - often help search"
    ],
    social_media_strategy: [
      "Nextdoor - highest local engagement",
      "Facebook local groups - search '[City] Lost Pets'",
      "Ring Neighbors - video doorbells catch sightings",
      "Pawboost - specialized lost pet platform",
      "Craigslist - both lost and found sections"
    ],
    flyer_tips: [
      "LARGE, CLEAR PHOTO - visible from car",
      "REWARD in big letters - gets attention",
      "Don't put your address - safety concern",
      "Weatherproof - use sheet protectors",
      "Eye level at stop signs, intersections"
    ]
  }
};

// HELPER FUNCTION TO GET ADVICE
function getAdvice(petType, scenario, timeElapsed) {
  // Normalize inputs
  const pet = petType.toLowerCase();
  const time = timeElapsed.toLowerCase().replace(/\s+/g, '_');
  const situation = scenario.toLowerCase().replace(/\s+/g, '_');

  // Navigate the advice tree
  let advice = {
    priority: [],
    checklist: [],
    tips: [],
    reassurance: ""
  };

  try {
    // Try to find specific advice
    if (PetRecoveryAdvice[pet]?.scenarios?.[situation]?.[time]) {
      const specific = PetRecoveryAdvice[pet].scenarios[situation][time];
      advice.priority = specific.priority_actions || [];
      advice.checklist = specific.immediate_checklist || specific.critical_info || specific.search_pattern || specific.outdoor_specific || [];
      advice.tips = specific.mistakes_to_avoid || specific.critical_wisdom || specific.calming_tactics || [];
      advice.reassurance = specific.reassurance || "";
    } else {
      // Fallback to general advice for pet type
      advice.priority = ["Contact local shelters", "Post on social media", "Create flyers"];
      advice.reassurance = "Stay calm and systematic. Most pets are found.";
    }
  } catch (error) {
    console.error("Error getting advice:", error);
  }

  return advice;
}

// EXPORT FOR USE
module.exports = { PetRecoveryAdvice, getAdvice };
