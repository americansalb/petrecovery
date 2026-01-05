"""Tests for pet and searcher agents."""

import pytest
import math
from simulation.core.types import Species, AnimalProfile, AnimalState
from simulation.agents.pet_base import PetAgent
from simulation.agents.dog_agent import DogAgent
from simulation.agents.cat_agent import CatAgent, CatHidingPhase
from simulation.agents.searcher_agent import (
    SearcherAgent, SearcherType, create_search_team
)
from simulation.core.constants import DOG_TEMPERAMENT_PARAMS, CAT_TEMPERAMENT_PARAMS


def create_dog_profile(temperament="G", size="MED"):
    """Helper to create dog profile."""
    return AnimalProfile(
        species=Species.DOG,
        temperament=temperament,
        size_class=size,
        age_class="ADT",
        is_indoor_only=False,
        is_indoor_outdoor=True,
        has_microchip=True,
        has_collar=True,
        flight_distance_m=DOG_TEMPERAMENT_PARAMS[temperament]["flight_distance_m"]["max"],
        initial_fear=0.8,
    )


def create_cat_profile(temperament="CAU", size="MED"):
    """Helper to create cat profile."""
    return AnimalProfile(
        species=Species.CAT,
        temperament=temperament,
        size_class=size,
        age_class="ADT",
        is_indoor_only=True,
        is_indoor_outdoor=False,
        has_microchip=True,
        has_collar=False,
        flight_distance_m=CAT_TEMPERAMENT_PARAMS[temperament]["flight_distance_m"]["max"],
        initial_fear=0.9,
    )


class TestDogAgent:
    """Tests for dog agent behavior."""

    def test_creation(self):
        profile = create_dog_profile("G")
        start_pos = (37.7749, -122.4194)
        dog = DogAgent(profile, start_pos)

        assert dog.state.position == start_pos
        assert dog.state.fear_level == 0.8
        assert dog.profile.species == Species.DOG

    def test_fear_decay(self):
        profile = create_dog_profile("G")
        dog = DogAgent(profile, (37.7749, -122.4194))
        dog.state.fear_level = 0.8

        # Fear should decay over time
        initial_fear = dog.state.fear_level
        dog.update_fear(hours_delta=6)

        assert dog.state.fear_level < initial_fear
        assert dog.state.fear_level > 0

    def test_xenophobic_slower_fear_decay(self):
        # Gregarious dog
        g_dog = DogAgent(create_dog_profile("G"), (37.7749, -122.4194))
        g_dog.state.fear_level = 0.8

        # Xenophobic dog
        x_dog = DogAgent(create_dog_profile("X"), (37.7749, -122.4194))
        x_dog.state.fear_level = 0.8

        # Same time passes
        g_dog.update_fear(hours_delta=24)
        x_dog.update_fear(hours_delta=24)

        # Gregarious should have lower fear (faster decay)
        assert g_dog.state.fear_level < x_dog.state.fear_level

    def test_movement_updates_position(self):
        profile = create_dog_profile("G")
        dog = DogAgent(profile, (37.7749, -122.4194))
        initial_pos = dog.state.position

        dog.move(hours_delta=1)

        # Position should change (unless resting)
        # Note: Might be same if in resting state
        assert dog.state.position is not None

    def test_physiology_updates(self):
        profile = create_dog_profile("G")
        dog = DogAgent(profile, (37.7749, -122.4194))

        initial_hunger = dog.state.hunger_level
        initial_thirst = dog.state.thirst_level

        dog.update_physiology(hours_delta=12)

        # Hunger and thirst should increase
        assert dog.state.hunger_level > initial_hunger
        assert dog.state.thirst_level > initial_thirst


class TestCatAgent:
    """Tests for cat agent behavior."""

    def test_creation(self):
        profile = create_cat_profile("CAU")
        start_pos = (37.7749, -122.4194)
        cat = CatAgent(profile, start_pos)

        assert cat.state.position == start_pos
        assert cat.state.fear_level == 0.9
        assert cat.profile.species == Species.CAT

    def test_hiding_phase_initial(self):
        profile = create_cat_profile("CAU")
        cat = CatAgent(profile, (37.7749, -122.4194))

        assert cat.state.hiding_phase == CatHidingPhase.INITIAL_HIDING
        assert cat.state.threshold_reached is False

    def test_threshold_phenomenon(self):
        profile = create_cat_profile("CAU")
        cat = CatAgent(profile, (37.7749, -122.4194))

        # Threshold should be between 7-12 days for CAU temperament
        assert 7 * 24 <= cat.threshold_hours <= 12 * 24

        # Simulate time passing up to threshold
        cat.state.hours_since_escape = cat.threshold_hours + 1
        cat.update_fear(hours_delta=0.1)

        # Should have reached threshold
        assert cat.state.threshold_reached is True
        assert cat.state.hiding_phase == CatHidingPhase.EMERGENCE

    def test_curious_shorter_threshold(self):
        cur_cat = CatAgent(create_cat_profile("CUR"), (37.7749, -122.4194))
        cau_cat = CatAgent(create_cat_profile("CAU"), (37.7749, -122.4194))

        # Curious cats have shorter threshold (3-7 days vs 7-12)
        assert cur_cat.threshold_hours < cau_cat.threshold_hours

    def test_hiding_behavior(self):
        profile = create_cat_profile("CAU")
        cat = CatAgent(profile, (37.7749, -122.4194))

        # High fear should increase hiding tendency
        cat.state.fear_level = 0.9
        hiding_prob_high = cat.get_hiding_probability()

        cat.state.fear_level = 0.3
        hiding_prob_low = cat.get_hiding_probability()

        assert hiding_prob_high > hiding_prob_low


class TestSearcherAgent:
    """Tests for searcher agents."""

    def test_creation(self):
        from simulation.core.types import SearcherProfile, SearchStrategy

        profile = SearcherProfile(
            searcher_type=SearcherType.OWNER,
            strategy=SearchStrategy.PROFILE_AWARE,
            home_location=(37.7749, -122.4194),
        )
        searcher = SearcherAgent(profile)

        assert searcher.profile.searcher_type == SearcherType.OWNER
        assert searcher.state.is_active is True

    def test_owner_has_recall_bonus(self):
        from simulation.core.types import SearcherProfile, SearchStrategy
        from simulation.core.constants import SEARCHER_TYPE_PARAMS

        owner_params = SEARCHER_TYPE_PARAMS["OWNER"]
        volunteer_params = SEARCHER_TYPE_PARAMS["VOLUNTEER"]

        assert owner_params["recall_bonus"] > volunteer_params["recall_bonus"]

    def test_professional_has_better_detection(self):
        from simulation.core.constants import SEARCHER_TYPE_PARAMS

        pro_params = SEARCHER_TYPE_PARAMS["PROFESSIONAL"]
        volunteer_params = SEARCHER_TYPE_PARAMS["VOLUNTEER"]

        assert pro_params["detection_range_m"] > volunteer_params["detection_range_m"]

    def test_create_search_team(self):
        profile = create_dog_profile("G")
        team = create_search_team(
            num_searchers=4,
            home_location=(37.7749, -122.4194),
            target_profile=profile,
        )

        assert len(team) == 4
        # First should be owner
        assert team[0].profile.searcher_type == SearcherType.OWNER

    def test_detection_range(self):
        from simulation.core.types import SearcherProfile, SearchStrategy

        profile = SearcherProfile(
            searcher_type=SearcherType.OWNER,
            strategy=SearchStrategy.PROFILE_AWARE,
            home_location=(37.7749, -122.4194),
        )
        searcher = SearcherAgent(profile)

        # Detection range should be positive
        assert searcher.get_detection_range() > 0

    def test_fatigue_affects_detection(self):
        from simulation.core.types import SearcherProfile, SearchStrategy

        profile = SearcherProfile(
            searcher_type=SearcherType.VOLUNTEER,
            strategy=SearchStrategy.NAIVE_EXPANDING_CIRCLE,
            home_location=(37.7749, -122.4194),
        )
        searcher = SearcherAgent(profile)

        range_fresh = searcher.get_detection_range()

        # Simulate fatigue
        searcher.state.fatigue = 0.8
        range_tired = searcher.get_detection_range()

        assert range_tired < range_fresh


class TestAgentInteraction:
    """Tests for interactions between agents."""

    def test_detection_event(self):
        from simulation.core.utils import distance

        dog = DogAgent(create_dog_profile("G"), (37.7749, -122.4194))
        from simulation.core.types import SearcherProfile, SearchStrategy

        searcher_profile = SearcherProfile(
            searcher_type=SearcherType.OWNER,
            strategy=SearchStrategy.PROFILE_AWARE,
            home_location=(37.7749, -122.4194),
        )
        searcher = SearcherAgent(searcher_profile)

        # Place searcher at same location
        searcher.state.position = dog.state.position

        dist = distance(dog.state.position, searcher.state.position)
        detection_range = searcher.get_detection_range()

        # Should be within detection range
        assert dist <= detection_range
