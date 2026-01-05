"""Tests for environment, traps, and scent mechanics."""

import pytest
import math
from simulation.environment.grid import EnvironmentGrid, TerrainType, create_simple_environment
from simulation.environment.traps import (
    TrapManager, TrapType, BaitType, calculate_optimal_trap_placement
)
from simulation.environment.scent import (
    ScentArticleManager, ScentArticleType, WindState, WindCondition,
    optimal_scent_article_placement
)


class TestEnvironmentGrid:
    """Tests for environment grid."""

    def test_create_simple_environment(self):
        env = create_simple_environment(
            center=(37.7749, -122.4194),
            radius_m=1000,
        )
        assert env is not None
        assert env.bounds is not None

    def test_terrain_types(self):
        assert TerrainType.URBAN.value == "URBAN"
        assert TerrainType.SUBURBAN.value == "SUBURBAN"
        assert TerrainType.WOODED.value == "WOODED"

    def test_get_terrain_at_position(self):
        env = create_simple_environment(
            center=(37.7749, -122.4194),
            radius_m=1000,
        )
        terrain = env.get_terrain_at((37.7749, -122.4194))
        assert terrain is not None

    def test_find_hiding_spots(self):
        env = create_simple_environment(
            center=(37.7749, -122.4194),
            radius_m=1000,
        )
        spots = env.get_nearby_hiding_spots((37.7749, -122.4194), radius_m=500)
        # Should have some hiding spots in simple environment
        assert isinstance(spots, list)


class TestTrapManager:
    """Tests for trap mechanics."""

    def test_place_trap(self):
        manager = TrapManager(seed=42)
        trap_id = manager.place_trap(
            location=(37.7749, -122.4194),
            trap_type=TrapType.BOX_TRAP_SMALL,
            bait_type=BaitType.ROTISSERIE_CHICKEN,
        )
        assert trap_id is not None
        assert trap_id in manager.traps

    def test_trap_types(self):
        assert TrapType.BOX_TRAP_SMALL.value == "box_trap_small"
        assert TrapType.MISSY_TRAP.value == "missy_trap"
        assert TrapType.DROP_TRAP.value == "drop_trap"

    def test_bait_types(self):
        assert BaitType.ROTISSERIE_CHICKEN.value == "rotisserie_chicken"
        assert BaitType.SARDINES.value == "sardines"
        assert BaitType.KFC_ORIGINAL.value == "kfc_original"

    def test_bait_freshness_decay(self):
        manager = TrapManager(seed=42)
        trap_id = manager.place_trap(
            location=(37.7749, -122.4194),
            trap_type=TrapType.BOX_TRAP_SMALL,
        )

        initial_freshness = manager.traps[trap_id].bait_freshness
        manager.update_bait_freshness(hours_delta=24)

        assert manager.traps[trap_id].bait_freshness < initial_freshness
        assert manager.traps[trap_id].bait_freshness > 0

    def test_trap_attraction_radius(self):
        manager = TrapManager(seed=42)
        trap_id = manager.place_trap(
            location=(37.7749, -122.4194),
        )
        trap = manager.traps[trap_id]

        # No wind
        radius, direction = manager.calculate_attraction_radius(trap)
        assert radius > 0
        assert direction is None

        # With wind
        radius_wind, direction_wind = manager.calculate_attraction_radius(
            trap, wind_speed_mps=5, wind_direction=90
        )
        assert radius_wind > radius
        assert direction_wind == 90

    def test_nearby_traps(self):
        manager = TrapManager(seed=42)
        center = (37.7749, -122.4194)

        # Place traps at various distances
        manager.place_trap((37.7749, -122.4194))  # At center
        manager.place_trap((37.7750, -122.4194))  # ~110m north
        manager.place_trap((37.7760, -122.4194))  # ~1.1km north

        nearby = manager.get_nearby_traps(center, radius_m=500)
        assert len(nearby) == 2  # Only two within 500m

    def test_optimal_trap_placement_cat(self):
        last_known = (37.7749, -122.4194)
        hiding_spots = [
            (37.7750, -122.4195, 0.8),
            (37.7748, -122.4193, 0.6),
            (37.7751, -122.4196, 0.9),
        ]
        placements = calculate_optimal_trap_placement(
            last_known, [], "cat", hiding_spots, num_traps=3
        )
        assert len(placements) == 3
        # Should be near hiding spots
        for placement in placements:
            assert isinstance(placement, tuple)
            assert len(placement) == 2


class TestScentArticleManager:
    """Tests for scent article mechanics."""

    def test_place_article(self):
        manager = ScentArticleManager(seed=42)
        article_id = manager.place_article(
            location=(37.7749, -122.4194),
            article_type=ScentArticleType.BEDDING,
        )
        assert article_id is not None
        assert article_id in manager.articles

    def test_article_types(self):
        assert ScentArticleType.WORN_CLOTHING.value == "worn_clothing"
        assert ScentArticleType.LITTER_BOX.value == "litter_box"
        assert ScentArticleType.BEDDING.value == "bedding"

    def test_scent_degradation(self):
        manager = ScentArticleManager(seed=42)
        article_id = manager.place_article(
            location=(37.7749, -122.4194),
            article_type=ScentArticleType.WORN_CLOTHING,
            current_hour=0,
        )

        initial_strength = manager.articles[article_id].owner_scent_strength
        manager.update_degradation(hours_delta=24, current_hour=24)

        assert manager.articles[article_id].owner_scent_strength < initial_strength

    def test_wind_state(self):
        # Calm wind
        calm = WindState.from_speed_mps(1.0)
        assert calm.condition == WindCondition.CALM

        # Light wind
        light = WindState.from_speed_mps(3.5)  # ~8 mph
        assert light.condition == WindCondition.LIGHT

        # Strong wind
        strong = WindState.from_speed_mps(12.0)  # ~27 mph
        assert strong.condition == WindCondition.STRONG

    def test_wind_affects_detection_zone(self):
        manager = ScentArticleManager(seed=42)
        article_id = manager.place_article(
            location=(37.7749, -122.4194),
            article_type=ScentArticleType.BEDDING,
        )
        article = manager.articles[article_id]

        # No wind
        manager.set_wind(0, 0)
        base, effective_no_wind, _ = manager.calculate_detection_zone(article)

        # With wind
        manager.set_wind(8.0, 90)  # ~18 mph from east
        _, effective_wind, direction = manager.calculate_detection_zone(article)

        assert effective_wind > effective_no_wind
        assert direction is not None

    def test_detection_zone_check(self):
        manager = ScentArticleManager(seed=42)
        article_id = manager.place_article(
            location=(37.7749, -122.4194),
            article_type=ScentArticleType.BEDDING,
        )

        # Pet at same location
        is_detected, strength = manager.is_in_detection_zone(
            (37.7749, -122.4194),
            manager.articles[article_id],
            "cat"
        )
        assert is_detected is True
        assert strength > 0.5

        # Pet far away
        is_detected_far, strength_far = manager.is_in_detection_zone(
            (37.7849, -122.4294),  # ~1km away
            manager.articles[article_id],
            "cat"
        )
        assert is_detected_far is False

    def test_optimal_scent_placement(self):
        home = (37.7749, -122.4194)
        placements = optimal_scent_article_placement(
            home, None, wind_direction=90, num_articles=3
        )
        assert len(placements) == 3
        # First should be at home with bedding
        assert placements[0][0] == home[0]
        assert placements[0][1] == home[1]
        assert placements[0][2] == "bedding"


class TestIntegration:
    """Integration tests for environment components."""

    def test_trap_and_scent_together(self):
        trap_mgr = TrapManager(seed=42)
        scent_mgr = ScentArticleManager(seed=42)

        center = (37.7749, -122.4194)

        # Set up traps
        trap_id = trap_mgr.place_trap(center, bait_type=BaitType.ROTISSERIE_CHICKEN)

        # Set up scent articles
        scent_id = scent_mgr.place_article(center, ScentArticleType.BEDDING)

        # Both should exist
        assert trap_id in trap_mgr.traps
        assert scent_id in scent_mgr.articles

        # Simulate time
        trap_mgr.update_bait_freshness(12)
        scent_mgr.update_degradation(12, 12)

        # Both should still be active
        assert not trap_mgr.traps[trap_id].is_triggered
        assert not scent_mgr.articles[scent_id].is_depleted
