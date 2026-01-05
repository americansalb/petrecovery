"""
Monte Carlo Orchestrator

Runs batches of simulations and aggregates results for statistical analysis.
Based on BEHAVIORAL_PROFILES.md validation framework.
"""

import random
import statistics
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

from ..core.types import (
    AnimalProfile, SimulationConfig, SimulationResult,
    OutcomeType, BatchResult, Species
)
from ..core.engine import SimulationEngine
from ..core.constants import BASELINE_OUTCOMES


@dataclass
class MonteCarloConfig:
    """Configuration for Monte Carlo batch runs."""
    num_simulations: int = 100
    parallel_workers: int = 4
    base_seed: Optional[int] = None
    progress_callback: Optional[Callable[[int, int], None]] = None
    save_paths: bool = False  # Whether to save full path data (memory intensive)


class MonteCarloOrchestrator:
    """
    Orchestrates batch Monte Carlo simulations.

    Features:
    - Parallel execution
    - Progress tracking
    - Statistical aggregation
    - Baseline comparison
    """

    def __init__(
        self,
        profile: AnimalProfile,
        sim_config: SimulationConfig,
        mc_config: MonteCarloConfig
    ):
        self.profile = profile
        self.sim_config = sim_config
        self.mc_config = mc_config

        # Initialize RNG for seed generation
        self.base_seed = mc_config.base_seed if mc_config.base_seed else random.randint(0, 2**31)
        self.rng = random.Random(self.base_seed)

        # Results storage
        self.results: List[SimulationResult] = []
        self.completed = 0
        self.start_time = None

    def run(self) -> BatchResult:
        """
        Run the full batch of simulations.
        """
        self.start_time = time.time()
        self.completed = 0
        self.results = []

        num_sims = self.mc_config.num_simulations

        # Generate seeds
        seeds = [self.rng.randint(0, 2**31) for _ in range(num_sims)]

        # Run simulations
        if self.mc_config.parallel_workers > 1:
            self._run_parallel(seeds)
        else:
            self._run_sequential(seeds)

        # Aggregate results
        return self._aggregate_results()

    def _run_sequential(self, seeds: List[int]):
        """Run simulations sequentially."""
        for i, seed in enumerate(seeds):
            result = self._run_single(seed)
            self.results.append(result)
            self.completed += 1

            if self.mc_config.progress_callback:
                self.mc_config.progress_callback(self.completed, len(seeds))

    def _run_parallel(self, seeds: List[int]):
        """Run simulations in parallel."""
        with ThreadPoolExecutor(max_workers=self.mc_config.parallel_workers) as executor:
            futures = {executor.submit(self._run_single, seed): seed for seed in seeds}

            for future in as_completed(futures):
                result = future.result()
                self.results.append(result)
                self.completed += 1

                if self.mc_config.progress_callback:
                    self.mc_config.progress_callback(self.completed, len(seeds))

    def _run_single(self, seed: int) -> SimulationResult:
        """Run a single simulation."""
        engine = SimulationEngine(self.profile, self.sim_config, seed)
        result = engine.run()

        # Optionally clear path data to save memory
        if not self.mc_config.save_paths:
            result.path = []

        return result

    def _aggregate_results(self) -> BatchResult:
        """Aggregate results into statistical summary."""
        num_results = len(self.results)

        if num_results == 0:
            return BatchResult(total_runs=0)

        # Count outcomes
        outcome_counts: Dict[OutcomeType, int] = {}
        for result in self.results:
            outcome = result.outcome
            outcome_counts[outcome] = outcome_counts.get(outcome, 0) + 1

        # Calculate rates
        outcome_rates = {k: v / num_results for k, v in outcome_counts.items()}

        # Recovery metrics
        recovery_outcomes = [
            OutcomeType.SELF_RETURN,
            OutcomeType.FOUND_BY_OWNER,
            OutcomeType.FOUND_BY_SEARCHER,
            OutcomeType.STRANGER_RETURN,
            OutcomeType.AT_SHELTER,
            OutcomeType.TRAPPED,
        ]
        recovery_count = sum(outcome_counts.get(o, 0) for o in recovery_outcomes)
        recovery_rate = recovery_count / num_results

        # Mortality metrics
        mortality_outcomes = [
            OutcomeType.DECEASED_TRAFFIC,
            OutcomeType.DECEASED_PREDATOR,
            OutcomeType.DECEASED_EXPOSURE,
            OutcomeType.DECEASED_DEHYDRATION,
            OutcomeType.DECEASED_STARVATION,
            OutcomeType.DECEASED_INJURY,
        ]
        mortality_count = sum(outcome_counts.get(o, 0) for o in mortality_outcomes)
        mortality_rate = mortality_count / num_results

        # Recovery time statistics
        recovery_times = [
            r.outcome_hours for r in self.results
            if r.outcome in recovery_outcomes and r.outcome_hours is not None
        ]

        avg_recovery_hours = statistics.mean(recovery_times) if recovery_times else None
        median_recovery_hours = statistics.median(recovery_times) if recovery_times else None

        # Distance statistics
        distances = [r.total_distance_traveled_m for r in self.results]
        max_distances = [r.max_distance_from_home_m for r in self.results]

        avg_distance = statistics.mean(distances) if distances else 0
        median_max_distance = statistics.median(max_distances) if max_distances else 0

        # Calculate confidence intervals (95%)
        confidence_intervals = self._calculate_confidence_intervals(
            outcome_counts, num_results
        )

        return BatchResult(
            total_runs=num_results,
            outcome_counts=outcome_counts,
            outcome_rates=outcome_rates,
            recovery_rate=recovery_rate,
            mortality_rate=mortality_rate,
            avg_recovery_hours=avg_recovery_hours,
            median_recovery_hours=median_recovery_hours,
            avg_distance_traveled_m=avg_distance,
            median_max_distance_m=median_max_distance,
            confidence_intervals=confidence_intervals
        )

    def _calculate_confidence_intervals(
        self,
        outcome_counts: Dict[OutcomeType, int],
        n: int
    ) -> Dict[str, tuple]:
        """Calculate 95% confidence intervals for key metrics."""
        import math

        intervals = {}

        # Wilson score interval for proportions
        def wilson_ci(successes: int, trials: int, z: float = 1.96) -> tuple:
            if trials == 0:
                return (0, 0)
            p = successes / trials
            denominator = 1 + z**2 / trials
            center = (p + z**2 / (2 * trials)) / denominator
            margin = z * math.sqrt((p * (1 - p) + z**2 / (4 * trials)) / trials) / denominator
            return (max(0, center - margin), min(1, center + margin))

        # Recovery rate CI
        recovery_count = sum(
            outcome_counts.get(o, 0) for o in [
                OutcomeType.SELF_RETURN, OutcomeType.FOUND_BY_OWNER,
                OutcomeType.FOUND_BY_SEARCHER, OutcomeType.STRANGER_RETURN,
                OutcomeType.AT_SHELTER, OutcomeType.TRAPPED
            ]
        )
        intervals["recovery_rate"] = wilson_ci(recovery_count, n)

        # Self-return rate CI
        self_return_count = outcome_counts.get(OutcomeType.SELF_RETURN, 0)
        intervals["self_return_rate"] = wilson_ci(self_return_count, n)

        # Mortality rate CI
        mortality_count = sum(
            outcome_counts.get(o, 0) for o in [
                OutcomeType.DECEASED_TRAFFIC, OutcomeType.DECEASED_PREDATOR,
                OutcomeType.DECEASED_EXPOSURE, OutcomeType.DECEASED_DEHYDRATION,
                OutcomeType.DECEASED_STARVATION
            ]
        )
        intervals["mortality_rate"] = wilson_ci(mortality_count, n)

        return intervals

    def compare_to_baseline(self) -> Dict[str, Any]:
        """
        Compare results to research-backed baseline outcomes.

        Based on Weiss 2012 and other studies.
        """
        if not self.results:
            return {"error": "No results to compare"}

        species_key = "dog" if self.profile.species == Species.DOG else "cat"
        baseline = BASELINE_OUTCOMES.get(species_key, {})

        batch_result = self._aggregate_results()

        comparison = {
            "species": species_key,
            "num_simulations": len(self.results),
            "baseline": baseline,
            "simulated": {
                "recovery_rate": batch_result.recovery_rate,
                "self_return_rate": batch_result.outcome_rates.get(OutcomeType.SELF_RETURN, 0),
            },
            "differences": {},
            "within_acceptable_range": True
        }

        # Compare recovery rate
        if "overall_recovery_rate" in baseline:
            sim_rate = batch_result.recovery_rate
            base_rate = baseline["overall_recovery_rate"]
            diff = abs(sim_rate - base_rate)
            comparison["differences"]["recovery_rate"] = {
                "simulated": sim_rate,
                "baseline": base_rate,
                "difference": diff,
                "acceptable": diff < 0.15  # Within 15% is acceptable
            }
            if diff >= 0.15:
                comparison["within_acceptable_range"] = False

        # Compare self-return rate
        if "self_return_rate" in baseline:
            sim_rate = batch_result.outcome_rates.get(OutcomeType.SELF_RETURN, 0)
            base_rate = baseline["self_return_rate"]
            diff = abs(sim_rate - base_rate)
            comparison["differences"]["self_return_rate"] = {
                "simulated": sim_rate,
                "baseline": base_rate,
                "difference": diff,
                "acceptable": diff < 0.15
            }
            if diff >= 0.15:
                comparison["within_acceptable_range"] = False

        return comparison


def run_monte_carlo(
    profile: AnimalProfile,
    sim_config: SimulationConfig,
    num_simulations: int = 100,
    parallel_workers: int = 4,
    seed: Optional[int] = None,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> BatchResult:
    """
    Convenience function to run a Monte Carlo batch.
    """
    mc_config = MonteCarloConfig(
        num_simulations=num_simulations,
        parallel_workers=parallel_workers,
        base_seed=seed,
        progress_callback=progress_callback
    )

    orchestrator = MonteCarloOrchestrator(profile, sim_config, mc_config)
    return orchestrator.run()


def sensitivity_analysis(
    profile: AnimalProfile,
    sim_config: SimulationConfig,
    parameter_ranges: Dict[str, List[Any]],
    num_simulations_per_value: int = 50,
    seed: Optional[int] = None
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Run sensitivity analysis on specified parameters.

    Returns results for each parameter value tested.
    """
    results = {}
    rng = random.Random(seed)

    for param_name, values in parameter_ranges.items():
        param_results = []

        for value in values:
            # Create modified profile/config
            modified_profile = profile
            modified_config = sim_config

            # Apply parameter change
            if hasattr(profile, param_name):
                modified_profile = AnimalProfile(**{
                    **profile.__dict__,
                    param_name: value
                })
            elif hasattr(sim_config, param_name):
                modified_config = SimulationConfig(**{
                    **sim_config.__dict__,
                    param_name: value
                })

            # Run batch
            batch_result = run_monte_carlo(
                modified_profile,
                modified_config,
                num_simulations=num_simulations_per_value,
                parallel_workers=4,
                seed=rng.randint(0, 2**31)
            )

            param_results.append({
                "value": value,
                "recovery_rate": batch_result.recovery_rate,
                "self_return_rate": batch_result.outcome_rates.get(OutcomeType.SELF_RETURN, 0),
                "mortality_rate": batch_result.mortality_rate,
                "avg_recovery_hours": batch_result.avg_recovery_hours
            })

        results[param_name] = param_results

    return results
