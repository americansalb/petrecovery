"""
Simulation Engine for Pet Recovery Monte Carlo

The main simulation loop that orchestrates:
- Pet agent behavior
- Searcher agent behavior
- Environment interactions
- Outcome determination

Based on BEHAVIORAL_PROFILES.md simulation mechanics.
"""

import random
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from .types import (
    AnimalProfile, AnimalState, AnimalStatus, Species,
    SimulationConfig, SimulationResult, OutcomeType,
    SightingReport, SearcherType, SearchStrategy
)
from .constants import BASELINE_OUTCOMES
from .utils import distance, get_time_period

from ..agents.dog_agent import DogAgent
from ..agents.cat_agent import CatAgent
from ..agents.searcher_agent import SearcherAgent, create_search_team
from ..environment.grid import EnvironmentGrid, create_simple_environment


class SimulationEngine:
    """
    Main simulation engine.

    Runs a single simulation from pet escape to outcome.
    Outcomes emerge from agent interactions, not predetermined probabilities.
    """

    def __init__(
        self,
        profile: AnimalProfile,
        config: SimulationConfig,
        seed: Optional[int] = None
    ):
        self.profile = profile
        self.config = config
        self.seed = seed if seed is not None else random.randint(0, 2**31)
        self.rng = random.Random(self.seed)

        # Create pet agent
        if profile.species == Species.DOG:
            self.pet = DogAgent(profile, seed=self.rng.randint(0, 2**31))
        else:
            self.pet = CatAgent(profile, seed=self.rng.randint(0, 2**31))

        # Create environment
        self.environment = create_simple_environment(
            center_lat=profile.escape_location[0],
            center_lon=profile.escape_location[1],
            radius_m=config.search_radius_m,
            terrain="SUBURBAN",  # Could be parameterized
            seed=self.rng.randint(0, 2**31)
        )

        # Create searcher team
        self.searchers = create_search_team(
            num_searchers=config.num_searchers,
            home_position=profile.home_location,
            search_radius_m=config.search_radius_m,
            include_owner=True,
            seed=self.rng.randint(0, 2**31)
        )

        # Simulation state
        self.current_hour = 0
        self.current_day = 0
        self.total_hours = 0
        self.tick_hours = config.tick_duration_minutes / 60

        # Tracking
        self.sightings: List[SightingReport] = []
        self.events: List[Dict[str, Any]] = []
        self.outcome: Optional[OutcomeType] = None
        self.outcome_hour: Optional[float] = None

    def run(self) -> SimulationResult:
        """
        Run the simulation until an outcome is reached or time expires.
        """
        max_hours = self.config.max_simulation_hours

        while self.total_hours < max_hours and self.outcome is None:
            self.tick()

        # Determine final outcome if not already set
        if self.outcome is None:
            self.outcome = OutcomeType.STILL_MISSING

        return self._build_result()

    def tick(self):
        """Execute one simulation tick."""
        # Update time
        self.total_hours += self.tick_hours
        self.current_hour = int(self.total_hours) % 24

        # Check for day change
        new_day = int(self.total_hours / 24)
        if new_day > self.current_day:
            self.current_day = new_day
            self._on_new_day()

        # 1. Update pet
        self.pet.tick(self.tick_hours, self.environment, self.current_hour)

        # Check pet status
        if self.pet.state.status == AnimalStatus.DECEASED:
            self._set_outcome(OutcomeType(f"DECEASED_{self.pet.state.death_cause.upper()}"))
            return

        if self.pet.state.status == AnimalStatus.RECOVERED:
            self._set_outcome(OutcomeType.SELF_RETURN)
            return

        # 2. Check for self-return
        if self.pet.check_self_return():
            self._set_outcome(OutcomeType.SELF_RETURN)
            return

        # 3. Update searchers and check detection
        for searcher in self.searchers:
            searcher.tick(
                self.tick_hours,
                self.environment,
                self.current_hour,
                self.sightings
            )

            if searcher.state.is_active:
                detected, dist = searcher.check_detection(
                    self.pet.state.position,
                    self.pet.state.status.value,
                    self.current_hour
                )

                if detected:
                    self._record_sighting(searcher, dist)

                    # Attempt capture
                    if searcher.attempt_capture(self.pet, dist):
                        if searcher.is_owner:
                            self._set_outcome(OutcomeType.FOUND_BY_OWNER)
                        else:
                            self._set_outcome(OutcomeType.FOUND_BY_SEARCHER)
                        return

        # 4. Check stranger encounters
        self._check_stranger_encounter()

    def _on_new_day(self):
        """Handle start of new day."""
        # Reset searcher daily limits
        for searcher in self.searchers:
            searcher.reset_daily()

        self._log_event("NEW_DAY", {"day": self.current_day})

    def _check_stranger_encounter(self):
        """Check for chance encounter with a stranger."""
        # Probability based on human activity and pet visibility
        human_activity = self.environment.get_human_activity(
            self.pet.state.position,
            self.current_hour
        )

        # Pet visibility
        if self.pet.state.status == AnimalStatus.HIDING:
            visibility = 0.1
        elif self.pet.state.status == AnimalStatus.FLEEING:
            visibility = 0.7
        else:
            visibility = 0.4

        # Species affects visibility
        if self.profile.species == Species.DOG:
            visibility *= 1.3
        else:
            visibility *= 0.7

        # Encounter probability per tick
        encounter_prob = human_activity * visibility * 0.01 * self.tick_hours

        if self.rng.random() < encounter_prob:
            self._handle_stranger_encounter()

    def _handle_stranger_encounter(self):
        """Handle a stranger encounter."""
        # Does stranger notice/approach?
        notice_prob = 0.5 if self.profile.species == Species.DOG else 0.3

        if self.rng.random() > notice_prob:
            return  # Stranger didn't notice

        # Does pet approach stranger?
        if self.profile.species == Species.DOG:
            from ..core.constants import DOG_TEMPERAMENT_PARAMS
            temp_params = DOG_TEMPERAMENT_PARAMS.get(self.profile.temperament, {})
        else:
            from ..core.constants import CAT_TEMPERAMENT_PARAMS
            temp_params = CAT_TEMPERAMENT_PARAMS.get(self.profile.temperament, {})

        approach_prob = temp_params.get("approach_stranger_prob", 0.2)
        approach_prob *= (1 - self.pet.state.fear_level * 0.7)

        if self.rng.random() < approach_prob:
            # Pet approached - stranger may capture
            capture_prob = temp_params.get("stranger_capture_success", 0.5) if "stranger_capture_success" in temp_params else 0.5

            if self.rng.random() < capture_prob:
                # What does stranger do?
                action = self.rng.random()

                if action < 0.1:
                    # Takes to shelter
                    self._set_outcome(OutcomeType.AT_SHELTER)
                elif action < 0.6 and (self.profile.has_collar_with_id or self.profile.microchipped):
                    # Returns to owner (via ID)
                    self._set_outcome(OutcomeType.STRANGER_RETURN)
                elif action < 0.8:
                    # Tries to find owner (social media, etc.)
                    # For now, treat as stranger return with delay
                    self._set_outcome(OutcomeType.STRANGER_RETURN)
                else:
                    # Keeps pet or pet escapes again
                    self._set_outcome(OutcomeType.ADOPTED_BY_NEIGHBOR)
            else:
                # Pet escaped from stranger
                self.pet.apply_fear_spike(0.3)
                self._record_sighting_by_stranger()
        else:
            # Pet fled - record as sighting only
            self.pet.apply_fear_spike(0.2)
            self._record_sighting_by_stranger()

    def _record_sighting(self, searcher: SearcherAgent, distance_m: float):
        """Record a sighting by a searcher."""
        sighting = SightingReport(
            location=self.pet.state.position,
            timestamp=datetime.now(),  # Would be sim time
            confidence=0.9 if searcher.is_owner else 0.7,
            direction_of_travel=self.pet.heading if hasattr(self.pet, 'heading') else None,
            behavior_observed=self.pet.state.status.value,
            reporter_type="owner" if searcher.is_owner else "searcher"
        )
        self.sightings.append(sighting)
        self._log_event("SIGHTING", {
            "location": sighting.location,
            "by": sighting.reporter_type,
            "distance_m": distance_m
        })

    def _record_sighting_by_stranger(self):
        """Record a sighting by a stranger."""
        sighting = SightingReport(
            location=self.pet.state.position,
            timestamp=datetime.now(),
            confidence=0.5,
            behavior_observed=self.pet.state.status.value,
            reporter_type="stranger"
        )
        self.sightings.append(sighting)
        self._log_event("STRANGER_SIGHTING", {"location": sighting.location})

    def _set_outcome(self, outcome: OutcomeType):
        """Set the simulation outcome."""
        self.outcome = outcome
        self.outcome_hour = self.total_hours
        self.pet.state.status = AnimalStatus.RECOVERED if "DECEASED" not in outcome.value else AnimalStatus.DECEASED
        self.pet.state.recovery_method = outcome.value
        self._log_event("OUTCOME", {"outcome": outcome.value, "hour": self.total_hours})

    def _log_event(self, event_type: str, data: Dict[str, Any]):
        """Log a simulation event."""
        self.events.append({
            "type": event_type,
            "hour": self.total_hours,
            "data": data
        })

    def _build_result(self) -> SimulationResult:
        """Build the simulation result object."""
        return SimulationResult(
            outcome=self.outcome,
            outcome_hours=self.outcome_hour,
            outcome_location=self.pet.state.position if self.outcome else None,
            total_distance_traveled_m=self.pet.total_distance_m,
            max_distance_from_home_m=self.pet.max_distance_from_home_m,
            final_distance_from_home_m=self.pet.get_current_distance_from_home(),
            path=self.pet.path,
            sightings=self.sightings,
            state_history=[],  # Could record state snapshots
            seed=self.seed
        )


def run_single_simulation(
    profile: AnimalProfile,
    config: SimulationConfig,
    seed: Optional[int] = None
) -> SimulationResult:
    """
    Run a single simulation and return the result.

    Convenience function for running one simulation.
    """
    engine = SimulationEngine(profile, config, seed)
    return engine.run()
