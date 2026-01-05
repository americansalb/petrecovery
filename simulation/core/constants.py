"""
Constants and Parameters for Pet Recovery Simulation

Based on BEHAVIORAL_PROFILES.md research-backed parameters.
Provenance: [R] Research-backed, [P] Practitioner, [A] Assumption, [C] Calculated
"""

from typing import Dict, Any

# =============================================================================
# DOG TEMPERAMENT PARAMETERS
# =============================================================================

DOG_TEMPERAMENT_PARAMS = {
    "G": {  # Gregarious
        "name": "gregarious",
        "description": "Approaches strangers readily, high social drive",
        "flight_distance_m": {"min": 10, "max": 50},
        "approach_stranger_prob": 0.85,
        "approach_owner_prob": 0.95,
        "flee_probability": 0.1,
        "hiding_tendency": 0.2,
        "fear_decay_rate": 0.15,  # Fast recovery [P]
        "detection_visibility": 1.2,
        "trap_susceptibility": 0.8,
        "recall_response": 0.9,
    },
    "C": {  # Confident
        "name": "confident",
        "description": "Curious but cautious, may investigate then retreat",
        "flight_distance_m": {"min": 30, "max": 100},
        "approach_stranger_prob": 0.5,
        "approach_owner_prob": 0.85,
        "flee_probability": 0.3,
        "hiding_tendency": 0.3,
        "fear_decay_rate": 0.12,
        "detection_visibility": 1.0,
        "trap_susceptibility": 0.6,
        "recall_response": 0.75,
    },
    "A": {  # Aloof
        "name": "aloof",
        "description": "Avoids contact but doesn't flee in panic",
        "flight_distance_m": {"min": 50, "max": 200},
        "approach_stranger_prob": 0.2,
        "approach_owner_prob": 0.7,
        "flee_probability": 0.5,
        "hiding_tendency": 0.5,
        "fear_decay_rate": 0.08,
        "detection_visibility": 0.8,
        "trap_susceptibility": 0.4,
        "recall_response": 0.5,
    },
    "X": {  # Xenophobic
        "name": "xenophobic",
        "description": "Flees from all humans including owner when stressed",
        "flight_distance_m": {"min": 100, "max": 500},
        "approach_stranger_prob": 0.02,
        "approach_owner_prob": 0.3,
        "flee_probability": 0.9,
        "hiding_tendency": 0.8,
        "fear_decay_rate": 0.03,  # Slow recovery [P]
        "detection_visibility": 0.5,
        "trap_susceptibility": 0.2,
        "recall_response": 0.2,
    },
    "B": {  # Bonded
        "name": "bonded",
        "description": "Only trusts owner/household, fearful of all others",
        "flight_distance_m": {"min": 80, "max": 300},
        "approach_stranger_prob": 0.05,
        "approach_owner_prob": 0.8,
        "flee_probability": 0.7,
        "hiding_tendency": 0.6,
        "fear_decay_rate": 0.05,
        "detection_visibility": 0.6,
        "trap_susceptibility": 0.3,
        "recall_response": 0.7,  # Responds to owner but not others
    },
}

# =============================================================================
# CAT TEMPERAMENT PARAMETERS
# =============================================================================

CAT_TEMPERAMENT_PARAMS = {
    "CUR": {  # Curious
        "name": "curious",
        "description": "Investigates environment, may approach strangers",
        "flight_distance_m": {"min": 5, "max": 30},
        "approach_stranger_prob": 0.4,
        "approach_owner_prob": 0.8,
        "flee_probability": 0.3,
        "hiding_tendency": 0.4,
        "threshold_days": {"min": 3, "max": 7},  # Shorter threshold [P]
        "emergence_probability": 0.4,
        "detection_visibility": 0.9,
        "trap_susceptibility": 0.7,
    },
    "CL": {  # Careless (Care-less)
        "name": "careless",
        "description": "Indoor/outdoor cat, street-smart, less fearful",
        "flight_distance_m": {"min": 10, "max": 50},
        "approach_stranger_prob": 0.3,
        "approach_owner_prob": 0.7,
        "flee_probability": 0.4,
        "hiding_tendency": 0.3,
        "threshold_days": {"min": 2, "max": 5},
        "emergence_probability": 0.5,
        "detection_visibility": 1.0,
        "trap_susceptibility": 0.6,
    },
    "CAU": {  # Cautious
        "name": "cautious",
        "description": "Hides initially but may emerge after threshold",
        "flight_distance_m": {"min": 20, "max": 100},
        "approach_stranger_prob": 0.1,
        "approach_owner_prob": 0.5,
        "flee_probability": 0.6,
        "hiding_tendency": 0.7,
        "threshold_days": {"min": 7, "max": 12},  # Standard threshold [R]
        "emergence_probability": 0.3,
        "detection_visibility": 0.6,
        "trap_susceptibility": 0.4,
    },
    "X": {  # Xenophobic
        "name": "xenophobic",
        "description": "Flees from all, deep hiding, may never emerge",
        "flight_distance_m": {"min": 50, "max": 300},
        "approach_stranger_prob": 0.01,
        "approach_owner_prob": 0.15,
        "flee_probability": 0.95,
        "hiding_tendency": 0.95,
        "threshold_days": {"min": 14, "max": 30},  # Very long threshold
        "emergence_probability": 0.1,
        "detection_visibility": 0.3,
        "trap_susceptibility": 0.15,
    },
    "B": {  # Bonded
        "name": "bonded",
        "description": "Only trusts owner, fearful of all others",
        "flight_distance_m": {"min": 30, "max": 150},
        "approach_stranger_prob": 0.02,
        "approach_owner_prob": 0.6,
        "flee_probability": 0.8,
        "hiding_tendency": 0.8,
        "threshold_days": {"min": 10, "max": 18},
        "emergence_probability": 0.2,
        "detection_visibility": 0.4,
        "trap_susceptibility": 0.25,
    },
}

# =============================================================================
# SIZE MODIFIERS
# =============================================================================

DOG_SIZE_PARAMS = {
    "TOY": {
        "speed_multiplier": 0.6,
        "stamina_multiplier": 0.7,
        "predator_vulnerability": 0.9,
        "visibility_multiplier": 0.7,
        "typical_weight_kg": 3.0,
    },
    "SML": {
        "speed_multiplier": 0.8,
        "stamina_multiplier": 0.85,
        "predator_vulnerability": 0.6,
        "visibility_multiplier": 0.85,
        "typical_weight_kg": 8.0,
    },
    "MED": {
        "speed_multiplier": 1.0,
        "stamina_multiplier": 1.0,
        "predator_vulnerability": 0.3,
        "visibility_multiplier": 1.0,
        "typical_weight_kg": 18.0,
    },
    "LRG": {
        "speed_multiplier": 1.1,
        "stamina_multiplier": 1.1,
        "predator_vulnerability": 0.1,
        "visibility_multiplier": 1.2,
        "typical_weight_kg": 32.0,
    },
    "GNT": {
        "speed_multiplier": 0.9,  # Mass limits sustained speed
        "stamina_multiplier": 0.9,
        "predator_vulnerability": 0.02,
        "visibility_multiplier": 1.4,
        "typical_weight_kg": 55.0,
    },
}

CAT_SIZE_PARAMS = {
    "SML": {
        "speed_multiplier": 0.9,
        "stamina_multiplier": 0.9,
        "predator_vulnerability": 0.7,
        "visibility_multiplier": 0.8,
        "typical_weight_kg": 3.5,
    },
    "MED": {
        "speed_multiplier": 1.0,
        "stamina_multiplier": 1.0,
        "predator_vulnerability": 0.5,
        "visibility_multiplier": 1.0,
        "typical_weight_kg": 5.0,
    },
    "LRG": {
        "speed_multiplier": 0.95,
        "stamina_multiplier": 1.05,
        "predator_vulnerability": 0.3,
        "visibility_multiplier": 1.1,
        "typical_weight_kg": 7.0,
    },
}

# =============================================================================
# AGE MODIFIERS
# =============================================================================

DOG_AGE_PARAMS = {
    "PUP": {
        "speed_multiplier": 0.7,
        "stamina_multiplier": 0.6,
        "fear_decay_multiplier": 1.3,  # Faster fear decay
        "survival_multiplier": 0.6,
        "homing_instinct": 0.3,
    },
    "YNG": {
        "speed_multiplier": 1.1,
        "stamina_multiplier": 1.1,
        "fear_decay_multiplier": 1.1,
        "survival_multiplier": 1.0,
        "homing_instinct": 0.6,
    },
    "ADT": {
        "speed_multiplier": 1.0,
        "stamina_multiplier": 1.0,
        "fear_decay_multiplier": 1.0,
        "survival_multiplier": 1.0,
        "homing_instinct": 0.8,
    },
    "SEN": {
        "speed_multiplier": 0.7,
        "stamina_multiplier": 0.7,
        "fear_decay_multiplier": 0.8,
        "survival_multiplier": 0.7,
        "homing_instinct": 0.9,  # Strong homing in seniors
    },
}

CAT_AGE_PARAMS = {
    "KIT": {
        "speed_multiplier": 0.6,
        "stamina_multiplier": 0.5,
        "fear_decay_multiplier": 1.4,
        "survival_multiplier": 0.4,
        "threshold_multiplier": 0.5,  # Shorter threshold
    },
    "JUV": {
        "speed_multiplier": 1.1,
        "stamina_multiplier": 0.9,
        "fear_decay_multiplier": 1.2,
        "survival_multiplier": 0.8,
        "threshold_multiplier": 0.7,
    },
    "YNG": {
        "speed_multiplier": 1.1,
        "stamina_multiplier": 1.1,
        "fear_decay_multiplier": 1.1,
        "survival_multiplier": 1.0,
        "threshold_multiplier": 0.9,
    },
    "ADT": {
        "speed_multiplier": 1.0,
        "stamina_multiplier": 1.0,
        "fear_decay_multiplier": 1.0,
        "survival_multiplier": 1.0,
        "threshold_multiplier": 1.0,
    },
    "SEN": {
        "speed_multiplier": 0.6,
        "stamina_multiplier": 0.6,
        "fear_decay_multiplier": 0.7,
        "survival_multiplier": 0.6,
        "threshold_multiplier": 1.3,  # Longer threshold in seniors
    },
}

# =============================================================================
# MOVEMENT PARAMETERS
# =============================================================================

# Base movement speeds in meters per hour
MOVEMENT_SPEEDS = {
    "dog": {
        "fleeing": 8000,      # ~5 mph sprint
        "traveling": 4000,    # ~2.5 mph walk
        "foraging": 1500,     # Slow, investigative
        "resting": 0,
    },
    "cat": {
        "fleeing": 6000,      # ~3.7 mph
        "traveling": 2000,    # ~1.2 mph
        "foraging": 800,      # Very cautious
        "resting": 0,
    },
}

# Displacement distributions [R] - Based on Huang 2018 (cats), Kremer 2021 (dogs)
DISPLACEMENT_PARAMS = {
    "cat": {
        "indoor_only": {
            "median_m": 39,       # [R] Huang 2018
            "q75_m": 137,         # [R] Huang 2018
            "distribution": "lognormal",
        },
        "indoor_outdoor": {
            "median_m": 300,      # [R] Huang 2018
            "q75_m": 1609,        # [R] Huang 2018
            "distribution": "lognormal",
        },
    },
    "dog": {
        "general": {
            "median_m": 460,      # [C] Derived from Kremer 2021
            "q75_m": 1200,        # [C] Derived from Kremer 2021
            "within_122m_pct": 0.42,  # [R] 42% within 400ft
            "within_1609m_pct": 0.70, # [R] 70% within 1 mile
            "distribution": "lognormal",
        },
    },
}

# =============================================================================
# FEAR DYNAMICS
# =============================================================================

FEAR_PARAMS = {
    "dog": {
        # Continuous exponential decay
        "decay_type": "exponential",
        "base_decay_rate_per_hour": 0.02,  # λ for e^(-λt)
        "half_life_hours": 35,             # ln(2)/λ ≈ 35 hours
        "fear_spike_on_threat": 0.3,
        "fear_spike_on_failed_capture": 0.4,
    },
    "cat": {
        # Threshold phenomenon - minimal decay until threshold reached
        "decay_type": "threshold",
        "base_threshold_days": 10,         # [P] Albrecht research
        "threshold_range_days": (7, 14),
        "pre_threshold_decay_rate": 0.001, # Almost no decay
        "post_threshold_decay_rate": 0.05,
        "fear_spike_on_threat": 0.4,
        "fear_spike_on_failed_capture": 0.5,
    },
}

# =============================================================================
# PHYSIOLOGICAL PARAMETERS
# =============================================================================

PHYSIOLOGY_PARAMS = {
    "hunger": {
        "rate_per_hour": 0.015,  # ~66 hours to reach 1.0
        "foraging_relief": 0.4,
        "critical_threshold": 0.9,
        "days_to_starvation": 7,
    },
    "thirst": {
        "rate_per_hour": 0.025,  # ~40 hours to reach 1.0
        "water_relief": 0.6,
        "critical_threshold": 0.85,
        "days_to_dehydration": 3,
    },
    "stamina": {
        "drain_rate_fleeing_per_hour": 0.3,
        "drain_rate_traveling_per_hour": 0.1,
        "recovery_rate_resting_per_hour": 0.15,
        "exhaustion_threshold": 0.1,
    },
}

# =============================================================================
# TERRAIN PARAMETERS
# =============================================================================

TERRAIN_PARAMS = {
    "URBAN": {
        "traffic_risk_per_hour": 0.002,
        "predator_risk_per_hour": 0.0001,
        "hiding_spot_density": 0.7,
        "human_activity": 0.9,
        "speed_modifier": 0.8,
    },
    "SUBURBAN": {
        "traffic_risk_per_hour": 0.001,
        "predator_risk_per_hour": 0.0005,
        "hiding_spot_density": 0.6,
        "human_activity": 0.6,
        "speed_modifier": 1.0,
    },
    "RURAL": {
        "traffic_risk_per_hour": 0.0003,
        "predator_risk_per_hour": 0.002,
        "hiding_spot_density": 0.4,
        "human_activity": 0.2,
        "speed_modifier": 1.1,
    },
    "WOODED": {
        "traffic_risk_per_hour": 0.0001,
        "predator_risk_per_hour": 0.005,
        "hiding_spot_density": 0.9,
        "human_activity": 0.1,
        "speed_modifier": 0.7,
    },
    "PARK": {
        "traffic_risk_per_hour": 0.0001,
        "predator_risk_per_hour": 0.001,
        "hiding_spot_density": 0.5,
        "human_activity": 0.5,
        "speed_modifier": 1.0,
    },
    "HIGHWAY": {
        "traffic_risk_per_hour": 0.02,
        "predator_risk_per_hour": 0.0001,
        "hiding_spot_density": 0.1,
        "human_activity": 0.05,
        "speed_modifier": 0.5,
        "is_barrier": True,
    },
}

# =============================================================================
# SEARCHER PARAMETERS
# =============================================================================

SEARCHER_TYPE_PARAMS = {
    "OWNER": {
        "detection_range_m": 50,
        "recall_bonus": 0.4,
        "dedication": 1.0,
        "hours_per_day": 8,
        "fatigue_resistance": 0.8,
        "capture_skill": 0.7,
    },
    "HOUSEHOLD": {
        "detection_range_m": 40,
        "recall_bonus": 0.3,
        "dedication": 0.9,
        "hours_per_day": 6,
        "fatigue_resistance": 0.7,
        "capture_skill": 0.6,
    },
    "FRIEND": {
        "detection_range_m": 30,
        "recall_bonus": 0.1,
        "dedication": 0.7,
        "hours_per_day": 4,
        "fatigue_resistance": 0.6,
        "capture_skill": 0.4,
    },
    "VOLUNTEER": {
        "detection_range_m": 30,
        "recall_bonus": 0.0,
        "dedication": 0.6,
        "hours_per_day": 3,
        "fatigue_resistance": 0.5,
        "capture_skill": 0.3,
    },
    "PROFESSIONAL": {
        "detection_range_m": 60,
        "recall_bonus": 0.1,
        "dedication": 0.95,
        "hours_per_day": 10,
        "fatigue_resistance": 0.9,
        "capture_skill": 0.9,
    },
    "SHELTER_STAFF": {
        "detection_range_m": 35,
        "recall_bonus": 0.0,
        "dedication": 0.5,
        "hours_per_day": 2,
        "fatigue_resistance": 0.5,
        "capture_skill": 0.6,
    },
    "ACO": {
        "detection_range_m": 45,
        "recall_bonus": 0.0,
        "dedication": 0.6,
        "hours_per_day": 4,
        "fatigue_resistance": 0.7,
        "capture_skill": 0.8,
    },
}

# =============================================================================
# TRAP AND SCENT ARTICLE PARAMETERS
# =============================================================================

TRAP_PARAMS = {
    "box_trap_small": {
        "suitable_for": ["cat", "dog_small"],
        "base_capture_prob": 0.3,
        "habituation_decay_per_visit": 0.1,
        "setup_time_hours": 0.5,
    },
    "box_trap_large": {
        "suitable_for": ["dog_medium", "dog_large"],
        "base_capture_prob": 0.25,
        "habituation_decay_per_visit": 0.08,
        "setup_time_hours": 1.0,
    },
    "missy_trap": {
        "suitable_for": ["cat"],
        "base_capture_prob": 0.35,
        "habituation_decay_per_visit": 0.12,
        "setup_time_hours": 0.75,
    },
}

BAIT_EFFECTIVENESS = {
    "standard_dog_food": {"dog": 1.0, "cat": 0.3},
    "high_value_dog_treat": {"dog": 1.5, "cat": 0.4},
    "canned_cat_food": {"dog": 0.6, "cat": 1.2},
    "tuna": {"dog": 0.7, "cat": 1.4},
    "rotisserie_chicken": {"dog": 1.3, "cat": 1.3},
    "sardines": {"dog": 0.8, "cat": 1.5},
    "kfc_original": {"dog": 1.4, "cat": 1.0},  # [P] Known effective
}

SCENT_ARTICLE_PARAMS = {
    "worn_clothing": {"effectiveness": 1.0, "duration_hours": 48},
    "bedding": {"effectiveness": 1.2, "duration_hours": 72},
    "litter_box": {"effectiveness": 1.5, "duration_hours": 96},  # Cat only
    "toy": {"effectiveness": 0.8, "duration_hours": 36},
    "food_bowl": {"effectiveness": 0.9, "duration_hours": 24},
}

# Wind effects on scent articles
WIND_EFFECTS = {
    "calm": {"radius_multiplier": 1.0, "downwind_angle": 360},      # 0-5 mph
    "light": {"radius_multiplier": 1.5, "downwind_angle": 120},     # 5-10 mph
    "moderate": {"radius_multiplier": 2.0, "downwind_angle": 60},   # 10-20 mph
    "strong": {"radius_multiplier": 2.5, "downwind_angle": 30},     # 20+ mph
}

# =============================================================================
# DETECTION PROBABILITIES
# =============================================================================

DETECTION_PROBABILITY = {
    "physical_search_day": {
        "dog": {"G": 0.7, "C": 0.5, "A": 0.3, "X": 0.1, "B": 0.4},
        "cat": {"CUR": 0.5, "CL": 0.3, "CAU": 0.2, "X": 0.05, "B": 0.15},
    },
    "physical_search_night": {
        "dog": {"G": 0.5, "C": 0.4, "A": 0.4, "X": 0.15, "B": 0.35},
        "cat": {"CUR": 0.4, "CL": 0.35, "CAU": 0.3, "X": 0.1, "B": 0.2},
    },
    "calling": {
        "dog": {"G": 0.6, "C": 0.4, "A": 0.2, "X": 0.02, "B": 0.5},
        "cat": {"CUR": 0.3, "CL": 0.15, "CAU": 0.1, "X": 0.01, "B": 0.2},
    },
}

# =============================================================================
# TIME OF DAY EFFECTS
# =============================================================================

TIME_OF_DAY_ACTIVITY = {
    "dog": {
        # Dogs are diurnal but adjust to situation
        "dawn": 1.2,      # 5-8
        "morning": 1.0,   # 8-12
        "afternoon": 0.9, # 12-17
        "dusk": 1.3,      # 17-20
        "night": 0.5,     # 20-5
    },
    "cat": {
        # Cats are crepuscular (dawn/dusk active)
        "dawn": 1.5,
        "morning": 0.6,
        "afternoon": 0.4,
        "dusk": 1.5,
        "night": 0.8,
    },
}

# =============================================================================
# OUTCOME BASE RATES (from research) [R]
# =============================================================================

# Weiss 2012 study outcomes
BASELINE_OUTCOMES = {
    "dog": {
        "overall_recovery_rate": 0.93,
        "self_return_rate": 0.15,
        "found_by_search_rate": 0.03,  # [A] Estimate
        "shelter_recovery_rate": 0.15,
        "stranger_return_rate": 0.40,  # [A] Estimate
    },
    "cat": {
        "overall_recovery_rate": 0.75,
        "self_return_rate": 0.59,
        "found_by_search_rate": 0.02,  # [A] Estimate
        "shelter_recovery_rate": 0.05,
        "stranger_return_rate": 0.08,  # [A] Estimate
    },
}
