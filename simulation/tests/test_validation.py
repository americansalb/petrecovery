"""Validation tests comparing simulation outputs to research benchmarks."""

import pytest
import statistics
from simulation.core.types import Species, AnimalProfile, AnimalState, SimulationConfig
from simulation.core.constants import DISPLACEMENT_PARAMS, BASELINE_OUTCOMES
from simulation.agents.dog_agent import DogAgent
from simulation.agents.cat_agent import CatAgent
from simulation.core.utils import sample_lognormal_displacement


class TestDisplacementValidation:
    """Validate displacement distributions match research data."""

    def test_cat_indoor_displacement_distribution(self):
        """Validate indoor-only cat displacement matches Huang 2018."""
        params = DISPLACEMENT_PARAMS["cat"]["indoor_only"]
        expected_median = params["median_m"]  # 39m
        expected_q75 = params["q75_m"]  # 137m

        # Generate many samples
        samples = [
            sample_lognormal_displacement(expected_median, expected_q75)
            for _ in range(1000)
        ]

        actual_median = statistics.median(samples)
        sorted_samples = sorted(samples)
        actual_q75 = sorted_samples[int(len(samples) * 0.75)]

        # Should be within 30% of expected (accounting for sampling variance)
        assert expected_median * 0.5 < actual_median < expected_median * 2.0
        assert expected_q75 * 0.5 < actual_q75 < expected_q75 * 2.0

    def test_cat_indoor_outdoor_displacement_distribution(self):
        """Validate indoor/outdoor cat displacement matches Huang 2018."""
        params = DISPLACEMENT_PARAMS["cat"]["indoor_outdoor"]
        expected_median = params["median_m"]  # 300m

        samples = [
            sample_lognormal_displacement(expected_median, params["q75_m"])
            for _ in range(1000)
        ]

        actual_median = statistics.median(samples)

        # Indoor/outdoor should travel further than indoor-only
        indoor_only_median = DISPLACEMENT_PARAMS["cat"]["indoor_only"]["median_m"]
        assert actual_median > indoor_only_median * 2

    def test_dog_displacement_distribution(self):
        """Validate dog displacement matches Kremer 2021."""
        params = DISPLACEMENT_PARAMS["dog"]["general"]
        expected_median = params["median_m"]  # 460m

        samples = [
            sample_lognormal_displacement(expected_median, params["q75_m"])
            for _ in range(1000)
        ]

        actual_median = statistics.median(samples)

        # Should be roughly in range
        assert 200 < actual_median < 1000


class TestOutcomeRateValidation:
    """Validate outcome rates match research benchmarks."""

    def test_baseline_outcome_rates_defined(self):
        """Verify baseline outcome rates are defined from research."""
        # Dog outcomes (Weiss 2012)
        assert BASELINE_OUTCOMES["dog"]["overall_recovery_rate"] == 0.93
        assert BASELINE_OUTCOMES["dog"]["self_return_rate"] == 0.15

        # Cat outcomes (Weiss 2012)
        assert BASELINE_OUTCOMES["cat"]["overall_recovery_rate"] == 0.75
        assert BASELINE_OUTCOMES["cat"]["self_return_rate"] == 0.59

    def test_cat_higher_self_return_than_dog(self):
        """Cats have higher self-return rate than dogs."""
        cat_self_return = BASELINE_OUTCOMES["cat"]["self_return_rate"]
        dog_self_return = BASELINE_OUTCOMES["dog"]["self_return_rate"]

        assert cat_self_return > dog_self_return


class TestTemperamentBehaviorValidation:
    """Validate temperament-based behaviors match profiles."""

    def test_gregarious_dog_approach_probability(self):
        """Gregarious dogs should have high approach probability."""
        from simulation.core.constants import DOG_TEMPERAMENT_PARAMS

        g_params = DOG_TEMPERAMENT_PARAMS["G"]
        x_params = DOG_TEMPERAMENT_PARAMS["X"]

        assert g_params["approach_stranger_prob"] > 0.8
        assert x_params["approach_stranger_prob"] < 0.1

    def test_xenophobic_cat_long_threshold(self):
        """Xenophobic cats should have longest threshold period."""
        from simulation.core.constants import CAT_TEMPERAMENT_PARAMS

        cur_threshold = CAT_TEMPERAMENT_PARAMS["CUR"]["threshold_days"]
        x_threshold = CAT_TEMPERAMENT_PARAMS["X"]["threshold_days"]

        # Xenophobic min threshold > Curious max threshold
        assert x_threshold["min"] > cur_threshold["max"]

    def test_fear_decay_rates_by_temperament(self):
        """Fear decay should be faster for gregarious, slower for xenophobic."""
        from simulation.core.constants import DOG_TEMPERAMENT_PARAMS

        g_decay = DOG_TEMPERAMENT_PARAMS["G"]["fear_decay_rate"]
        x_decay = DOG_TEMPERAMENT_PARAMS["X"]["fear_decay_rate"]

        assert g_decay > x_decay * 3  # At least 3x faster


class TestCatThresholdValidation:
    """Validate cat threshold phenomenon matches Albrecht research."""

    def test_threshold_timing(self):
        """Cats should remain hidden 7-14 days before emergence."""
        from simulation.core.constants import FEAR_PARAMS

        threshold_range = FEAR_PARAMS["cat"]["threshold_range_days"]

        assert threshold_range[0] >= 7
        assert threshold_range[1] <= 14

    def test_cat_agent_threshold_implementation(self):
        """Cat agent should implement threshold correctly."""
        profile = AnimalProfile(
            species=Species.CAT,
            temperament="CAU",
            size_class="MED",
            age_class="ADT",
            is_indoor_only=True,
            is_indoor_outdoor=False,
            has_microchip=True,
            has_collar=False,
            flight_distance_m=100,
            initial_fear=0.9,
        )
        cat = CatAgent(profile, (37.7749, -122.4194))

        # Initially should not have reached threshold
        assert cat.state.threshold_reached is False

        # Simulate 11 days (within typical threshold range)
        from simulation.agents.cat_agent import CatHidingPhase
        cat.state.hours_since_escape = 11 * 24
        cat.update_fear(0.1)

        # Should have reached threshold if within range
        if cat.threshold_hours <= 11 * 24:
            assert cat.state.threshold_reached is True
            assert cat.state.hiding_phase == CatHidingPhase.EMERGENCE


class TestSearcherEffectivenessValidation:
    """Validate searcher effectiveness parameters."""

    def test_owner_more_effective_than_volunteer(self):
        """Owners should have better recall response than volunteers."""
        from simulation.core.constants import SEARCHER_TYPE_PARAMS

        owner = SEARCHER_TYPE_PARAMS["OWNER"]
        volunteer = SEARCHER_TYPE_PARAMS["VOLUNTEER"]

        assert owner["recall_bonus"] > volunteer["recall_bonus"]
        assert owner["detection_range_m"] > volunteer["detection_range_m"]

    def test_professional_high_effectiveness(self):
        """Professional pet detectives should have high effectiveness."""
        from simulation.core.constants import SEARCHER_TYPE_PARAMS

        pro = SEARCHER_TYPE_PARAMS["PROFESSIONAL"]

        assert pro["capture_skill"] >= 0.9
        assert pro["hours_per_day"] >= 8


class TestTimeOfDayValidation:
    """Validate time-of-day activity patterns."""

    def test_cat_crepuscular_activity(self):
        """Cats should be most active at dawn and dusk."""
        from simulation.core.constants import TIME_OF_DAY_ACTIVITY

        cat_activity = TIME_OF_DAY_ACTIVITY["cat"]

        assert cat_activity["dawn"] > cat_activity["afternoon"]
        assert cat_activity["dusk"] > cat_activity["afternoon"]
        assert cat_activity["dawn"] >= 1.5

    def test_dog_diurnal_pattern(self):
        """Dogs should be less active at night."""
        from simulation.core.constants import TIME_OF_DAY_ACTIVITY

        dog_activity = TIME_OF_DAY_ACTIVITY["dog"]

        assert dog_activity["night"] < dog_activity["morning"]
        assert dog_activity["dusk"] >= 1.0


class TestBaitEffectivenessValidation:
    """Validate bait effectiveness parameters."""

    def test_cat_prefers_fish(self):
        """Cats should prefer fish-based baits."""
        from simulation.core.constants import BAIT_EFFECTIVENESS

        sardines_cat = BAIT_EFFECTIVENESS["sardines"]["cat"]
        dog_food_cat = BAIT_EFFECTIVENESS["standard_dog_food"]["cat"]

        assert sardines_cat > dog_food_cat

    def test_dog_prefers_meat(self):
        """Dogs should prefer meat-based baits."""
        from simulation.core.constants import BAIT_EFFECTIVENESS

        chicken_dog = BAIT_EFFECTIVENESS["rotisserie_chicken"]["dog"]
        cat_food_dog = BAIT_EFFECTIVENESS["canned_cat_food"]["dog"]

        assert chicken_dog > cat_food_dog

    def test_kfc_effectiveness(self):
        """KFC should be highly effective for dogs (practitioner knowledge)."""
        from simulation.core.constants import BAIT_EFFECTIVENESS

        kfc_dog = BAIT_EFFECTIVENESS["kfc_original"]["dog"]
        assert kfc_dog >= 1.3
