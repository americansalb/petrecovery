"""Tests for core simulation components."""

import pytest
import math
from simulation.core.types import (
    Species, AnimalProfile, AnimalState, SimulationConfig
)
from simulation.core.constants import (
    DOG_TEMPERAMENT_PARAMS, CAT_TEMPERAMENT_PARAMS,
    DISPLACEMENT_PARAMS, FEAR_PARAMS
)
from simulation.core.utils import (
    distance, haversine, offset_position, get_time_period,
    sample_lognormal_displacement, exponential_decay, clamp
)


class TestTypes:
    """Tests for type definitions."""

    def test_species_enum(self):
        assert Species.DOG.value == "dog"
        assert Species.CAT.value == "cat"

    def test_animal_profile_creation(self):
        profile = AnimalProfile(
            species=Species.DOG,
            temperament="G",
            size_class="MED",
            age_class="ADT",
            is_indoor_only=False,
            is_indoor_outdoor=True,
            has_microchip=True,
            has_collar=True,
            flight_distance_m=50,
            initial_fear=0.8,
        )
        assert profile.species == Species.DOG
        assert profile.temperament == "G"
        assert profile.has_microchip is True

    def test_animal_state_defaults(self):
        state = AnimalState(
            position=(37.7749, -122.4194),
            fear_level=0.8,
        )
        assert state.hunger_level == 0.0
        assert state.thirst_level == 0.0
        assert state.stamina == 1.0
        assert state.is_hiding is False


class TestConstants:
    """Tests for constant definitions."""

    def test_dog_temperaments_complete(self):
        expected = ["G", "C", "A", "X", "B"]
        for temp in expected:
            assert temp in DOG_TEMPERAMENT_PARAMS
            params = DOG_TEMPERAMENT_PARAMS[temp]
            assert "flight_distance_m" in params
            assert "approach_stranger_prob" in params
            assert "fear_decay_rate" in params

    def test_cat_temperaments_complete(self):
        expected = ["CUR", "CL", "CAU", "X", "B"]
        for temp in expected:
            assert temp in CAT_TEMPERAMENT_PARAMS
            params = CAT_TEMPERAMENT_PARAMS[temp]
            assert "threshold_days" in params
            assert "emergence_probability" in params

    def test_displacement_params(self):
        assert "cat" in DISPLACEMENT_PARAMS
        assert "dog" in DISPLACEMENT_PARAMS
        assert "indoor_only" in DISPLACEMENT_PARAMS["cat"]
        assert "indoor_outdoor" in DISPLACEMENT_PARAMS["cat"]

    def test_fear_params(self):
        assert FEAR_PARAMS["dog"]["decay_type"] == "exponential"
        assert FEAR_PARAMS["cat"]["decay_type"] == "threshold"


class TestUtils:
    """Tests for utility functions."""

    def test_distance_same_point(self):
        pos = (37.7749, -122.4194)
        assert distance(pos, pos) == pytest.approx(0, abs=0.1)

    def test_distance_known_values(self):
        # San Francisco to Oakland (~12 km)
        sf = (37.7749, -122.4194)
        oakland = (37.8044, -122.2712)
        dist = distance(sf, oakland)
        assert 10000 < dist < 20000  # Between 10 and 20 km

    def test_haversine_symmetry(self):
        pos1 = (37.7749, -122.4194)
        pos2 = (37.8044, -122.2712)
        assert haversine(pos1, pos2) == pytest.approx(haversine(pos2, pos1), rel=1e-6)

    def test_offset_position(self):
        start = (37.7749, -122.4194)
        # Offset 1000m north
        new_pos = offset_position(start, 1000, 0)
        dist = distance(start, new_pos)
        assert dist == pytest.approx(1000, rel=0.01)

    def test_offset_position_directions(self):
        start = (37.7749, -122.4194)
        # North should increase latitude
        north = offset_position(start, 100, 0)
        assert north[0] > start[0]

        # East should increase longitude (in northern hemisphere)
        east = offset_position(start, 100, 90)
        assert east[1] > start[1]

    def test_get_time_period(self):
        assert get_time_period(6) == "dawn"
        assert get_time_period(10) == "morning"
        assert get_time_period(14) == "afternoon"
        assert get_time_period(18) == "dusk"
        assert get_time_period(23) == "night"
        assert get_time_period(2) == "night"

    def test_sample_lognormal_displacement(self):
        # Should return positive values
        for _ in range(100):
            displacement = sample_lognormal_displacement(
                median=100, q75=300
            )
            assert displacement > 0

    def test_exponential_decay(self):
        # At t=0, value should be initial
        assert exponential_decay(1.0, 0.1, 0) == pytest.approx(1.0)

        # Should decrease over time
        v1 = exponential_decay(1.0, 0.1, 1)
        v2 = exponential_decay(1.0, 0.1, 2)
        assert v2 < v1 < 1.0

    def test_clamp(self):
        assert clamp(5, 0, 10) == 5
        assert clamp(-5, 0, 10) == 0
        assert clamp(15, 0, 10) == 10


class TestSimulationConfig:
    """Tests for simulation configuration."""

    def test_config_defaults(self):
        config = SimulationConfig(
            seed=42,
            start_location=(37.7749, -122.4194),
            animal_profile=AnimalProfile(
                species=Species.DOG,
                temperament="G",
                size_class="MED",
                age_class="ADT",
                is_indoor_only=False,
                is_indoor_outdoor=True,
                has_microchip=True,
                has_collar=True,
                flight_distance_m=50,
                initial_fear=0.8,
            ),
        )
        assert config.max_simulation_hours == 72
        assert config.time_step_minutes == 5
        assert config.num_searchers == 2
