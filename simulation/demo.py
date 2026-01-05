#!/usr/bin/env python3
"""
Demo script for Pet Recovery Monte Carlo Simulation

This script demonstrates how to use the simulation engine
to run Monte Carlo simulations for lost pet recovery scenarios.
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from simulation import (
    Species, AnimalProfile, SimulationConfig,
    run_single_simulation, run_monte_carlo, OutcomeType
)


def demo_single_simulation():
    """Run a single simulation and print results."""
    print("=" * 60)
    print("SINGLE SIMULATION DEMO")
    print("=" * 60)

    # Create a lost dog profile
    profile = AnimalProfile(
        species=Species.DOG,
        temperament="C",  # Confident
        size_class="MED",
        age_class="ADT",
        escape_type="D1",  # Door dash
        escape_location=(40.7128, -74.0060),  # NYC
        home_location=(40.7128, -74.0060),
        microchipped=True,
        has_collar=True,
        has_collar_with_id=True,
        recall_training=0.7,
    )

    # Create simulation config
    config = SimulationConfig(
        max_simulation_hours=168,  # 7 days
        tick_duration_minutes=5,
        num_searchers=2,
        search_radius_m=2000,
    )

    # Run simulation
    print(f"\nRunning simulation for a {profile.temperament} {profile.species.value}...")
    result = run_single_simulation(profile, config, seed=42)

    print(f"\nResults:")
    print(f"  Outcome: {result.outcome.value}")
    print(f"  Time to outcome: {result.outcome_hours:.1f} hours" if result.outcome_hours else "  Time: N/A")
    print(f"  Total distance traveled: {result.total_distance_traveled_m:.0f} m")
    print(f"  Max distance from home: {result.max_distance_from_home_m:.0f} m")
    print(f"  Final distance from home: {result.final_distance_from_home_m:.0f} m")
    print(f"  Sightings: {len(result.sightings)}")


def demo_monte_carlo():
    """Run a Monte Carlo batch and print aggregate results."""
    print("\n" + "=" * 60)
    print("MONTE CARLO SIMULATION DEMO")
    print("=" * 60)

    # Create profiles for both dog and cat
    dog_profile = AnimalProfile(
        species=Species.DOG,
        temperament="A",  # Aloof
        size_class="MED",
        age_class="ADT",
        escape_type="ST1",  # Startle - thunder
        escape_location=(40.7128, -74.0060),
        home_location=(40.7128, -74.0060),
        microchipped=True,
    )

    cat_profile = AnimalProfile(
        species=Species.CAT,
        temperament="CAU",  # Cautious
        size_class="MED",
        age_class="ADT",
        indoor_outdoor="IO",  # Indoor only
        escape_type="D1",  # Door dash
        escape_location=(40.7128, -74.0060),
        home_location=(40.7128, -74.0060),
    )

    config = SimulationConfig(
        max_simulation_hours=168,
        num_searchers=2,
    )

    num_sims = 50  # Keep small for demo

    # Progress callback
    def progress(completed, total):
        pct = completed / total * 100
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"\r  Progress: [{bar}] {pct:.0f}%", end="", flush=True)

    # Run for dog
    print(f"\nRunning {num_sims} simulations for DOG (Aloof, thunder startle)...")
    dog_results = run_monte_carlo(
        dog_profile, config,
        num_simulations=num_sims,
        parallel_workers=1,  # Single-threaded for demo
        seed=12345,
        progress_callback=progress
    )
    print()

    print(f"\nDog Results:")
    print(f"  Recovery rate: {dog_results.recovery_rate:.1%}")
    print(f"  Self-return rate: {dog_results.outcome_rates.get(OutcomeType.SELF_RETURN, 0):.1%}")
    print(f"  Mortality rate: {dog_results.mortality_rate:.1%}")
    if dog_results.avg_recovery_hours:
        print(f"  Avg recovery time: {dog_results.avg_recovery_hours:.1f} hours")
    print(f"  Median max distance: {dog_results.median_max_distance_m:.0f} m")

    # Run for cat
    print(f"\nRunning {num_sims} simulations for CAT (Cautious, indoor-only)...")
    cat_results = run_monte_carlo(
        cat_profile, config,
        num_simulations=num_sims,
        parallel_workers=1,
        seed=12345,
        progress_callback=progress
    )
    print()

    print(f"\nCat Results:")
    print(f"  Recovery rate: {cat_results.recovery_rate:.1%}")
    print(f"  Self-return rate: {cat_results.outcome_rates.get(OutcomeType.SELF_RETURN, 0):.1%}")
    print(f"  Mortality rate: {cat_results.mortality_rate:.1%}")
    if cat_results.avg_recovery_hours:
        print(f"  Avg recovery time: {cat_results.avg_recovery_hours:.1f} hours")
    print(f"  Median max distance: {cat_results.median_max_distance_m:.0f} m")

    # Outcome breakdown
    print("\n" + "-" * 40)
    print("Outcome Distribution:")
    print("-" * 40)

    print("\nDog outcomes:")
    for outcome, rate in sorted(dog_results.outcome_rates.items(), key=lambda x: -x[1]):
        if rate > 0:
            print(f"  {outcome.value}: {rate:.1%}")

    print("\nCat outcomes:")
    for outcome, rate in sorted(cat_results.outcome_rates.items(), key=lambda x: -x[1]):
        if rate > 0:
            print(f"  {outcome.value}: {rate:.1%}")


def demo_temperament_comparison():
    """Compare outcomes across different temperaments."""
    print("\n" + "=" * 60)
    print("TEMPERAMENT COMPARISON DEMO")
    print("=" * 60)

    config = SimulationConfig(
        max_simulation_hours=168,
        num_searchers=2,
    )

    temperaments = ["G", "C", "A", "X", "B"]
    num_sims = 30

    print(f"\nComparing {len(temperaments)} dog temperaments ({num_sims} simulations each)...")

    results = {}
    for temp in temperaments:
        profile = AnimalProfile(
            species=Species.DOG,
            temperament=temp,
            size_class="MED",
            age_class="ADT",
            escape_type="D1",
            escape_location=(40.7128, -74.0060),
            home_location=(40.7128, -74.0060),
        )

        batch = run_monte_carlo(
            profile, config,
            num_simulations=num_sims,
            parallel_workers=1,
            seed=42
        )
        results[temp] = batch
        print(f"  {temp}: Recovery {batch.recovery_rate:.0%}, Self-return {batch.outcome_rates.get(OutcomeType.SELF_RETURN, 0):.0%}")

    print("\nTemperament codes:")
    print("  G = Gregarious (approaches strangers)")
    print("  C = Confident (curious but cautious)")
    print("  A = Aloof (avoids contact)")
    print("  X = Xenophobic (flees from all)")
    print("  B = Bonded (only trusts owner)")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("PET RECOVERY MONTE CARLO SIMULATION")
    print("Based on BEHAVIORAL_PROFILES.md")
    print("=" * 60)

    demo_single_simulation()
    demo_monte_carlo()
    demo_temperament_comparison()

    print("\n" + "=" * 60)
    print("Demo complete!")
    print("=" * 60)
