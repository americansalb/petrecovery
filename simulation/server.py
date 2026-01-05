"""
FastAPI Server for Pet Recovery Monte Carlo Simulation

Exposes the simulation engine as REST API endpoints.
Deploy to Render as a separate Python service.
"""

import os
import json
import random
from typing import Optional, List, Dict, Any
from dataclasses import asdict

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from core.types import Species, AnimalProfile, SimulationConfig
from agents.dog_agent import DogAgent
from agents.cat_agent import CatAgent
from agents.searcher_agent import create_search_team
from environment.grid import create_simple_environment
from environment.traps import TrapManager, TrapType, BaitType
from environment.scent import ScentArticleManager, ScentArticleType
from monte_carlo.orchestrator import MonteCarloOrchestrator, MonteCarloConfig
from api.bridge import (
    SimulationAPIBridge,
    ConfigConverter,
    FrontendSimulationConfig,
    FrontendBatchResult,
)

# Create FastAPI app
app = FastAPI(
    title="Pet Recovery Simulation API",
    description="Monte Carlo simulation engine for lost pet recovery based on behavioral research",
    version="1.0.0",
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://reunitepets.org",
        "https://www.reunitepets.org",
        "http://localhost:3000",
        "http://localhost:3001",
        "*",  # For development - restrict in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize simulation bridge
simulation_bridge = SimulationAPIBridge(use_osm=True)

# Store running batches
running_batches: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# Pydantic Models for API
# =============================================================================

class SimulationRequest(BaseModel):
    """Request to run a single simulation."""
    id: str = Field(default="sim_1")
    pet_species: str = Field(default="DOG", description="DOG or CAT")
    pet_size: str = Field(default="MEDIUM", description="SMALL, MEDIUM, LARGE")
    pet_personality: str = Field(default="NEUTRAL", description="FRIENDLY, NEUTRAL, SHY")
    is_indoor_pet: bool = Field(default=False)
    has_microchip: bool = Field(default=False)
    has_collar: bool = Field(default=True)
    start_latitude: float = Field(default=37.7749)
    start_longitude: float = Field(default=-122.4194)
    search_radius_miles: float = Field(default=1.0)
    num_searchers: int = Field(default=2)
    search_strategy: str = Field(default="MODERATE", description="PASSIVE, MODERATE, AGGRESSIVE")
    using_traps: bool = Field(default=False)
    using_scent_articles: bool = Field(default=False)
    max_simulation_hours: int = Field(default=72)
    time_step_minutes: int = Field(default=5)
    start_hour_of_day: int = Field(default=8)


class BatchRequest(BaseModel):
    """Request to run a batch of simulations."""
    config: SimulationRequest
    num_runs: int = Field(default=100, ge=1, le=1000)


class QuickSimRequest(BaseModel):
    """Simplified request for quick simulations."""
    species: str = Field(default="dog", description="dog or cat")
    temperament: str = Field(default="C", description="Dog: G/C/A/X/B, Cat: CUR/CL/CAU/X/B")
    latitude: float
    longitude: float
    hours: int = Field(default=72, ge=1, le=168)


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Health check and API info."""
    return {
        "status": "healthy",
        "service": "Pet Recovery Monte Carlo Simulation",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "simulate": "/api/simulate",
            "batch": "/api/batch",
            "quick": "/api/quick",
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for Render."""
    return {"status": "healthy"}


@app.post("/api/simulate")
async def run_simulation(request: SimulationRequest):
    """
    Run a single simulation with full configuration.

    Returns detailed results including pet path and searcher paths.
    """
    try:
        # Convert to frontend config format
        config = FrontendSimulationConfig(
            id=request.id,
            pet_species=request.pet_species,
            pet_size=request.pet_size,
            pet_personality=request.pet_personality,
            is_indoor_pet=request.is_indoor_pet,
            has_microchip=request.has_microchip,
            has_collar=request.has_collar,
            start_latitude=request.start_latitude,
            start_longitude=request.start_longitude,
            search_radius_miles=request.search_radius_miles,
            num_searchers=request.num_searchers,
            search_strategy=request.search_strategy,
            using_traps=request.using_traps,
            using_scent_articles=request.using_scent_articles,
            max_simulation_hours=request.max_simulation_hours,
            time_step_minutes=request.time_step_minutes,
            start_hour_of_day=request.start_hour_of_day,
        )

        result = simulation_bridge.run_simulation(config)
        return asdict(result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/batch")
async def run_batch(request: BatchRequest, background_tasks: BackgroundTasks):
    """
    Run a batch of simulations for Monte Carlo analysis.

    Returns aggregate statistics and individual results.
    """
    try:
        config = FrontendSimulationConfig(
            id=request.config.id,
            pet_species=request.config.pet_species,
            pet_size=request.config.pet_size,
            pet_personality=request.config.pet_personality,
            is_indoor_pet=request.config.is_indoor_pet,
            has_microchip=request.config.has_microchip,
            has_collar=request.config.has_collar,
            start_latitude=request.config.start_latitude,
            start_longitude=request.config.start_longitude,
            search_radius_miles=request.config.search_radius_miles,
            num_searchers=request.config.num_searchers,
            search_strategy=request.config.search_strategy,
            using_traps=request.config.using_traps,
            using_scent_articles=request.config.using_scent_articles,
            max_simulation_hours=request.config.max_simulation_hours,
            time_step_minutes=request.config.time_step_minutes,
            start_hour_of_day=request.config.start_hour_of_day,
        )

        batch_result, sim_results = simulation_bridge.run_batch(
            config,
            num_runs=request.num_runs,
            parallel=True
        )

        return {
            "batch": asdict(batch_result),
            "simulations": [asdict(r) for r in sim_results[:10]],  # Limit detail
            "summary": {
                "total_runs": request.num_runs,
                "success_rate": batch_result.success_rate,
                "avg_time_to_find_mins": batch_result.avg_time_to_find_mins,
                "outcomes": {
                    "found_by_searcher": batch_result.found_by_searcher_count,
                    "returned_home": batch_result.returned_home_count,
                    "timeout": batch_result.timeout_searching_count,
                }
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/quick")
async def quick_simulation(request: QuickSimRequest):
    """
    Run a quick simulation with minimal configuration.

    Good for testing and simple predictions.
    """
    try:
        # Map species
        species = Species.DOG if request.species.lower() == "dog" else Species.CAT

        # Create profile
        profile = AnimalProfile(
            species=species,
            temperament=request.temperament,
            size_class="MED",
            age_class="ADT",
            escape_location=(request.latitude, request.longitude),
            home_location=(request.latitude, request.longitude),
        )

        # Create environment (simple, no OSM for speed)
        env = create_simple_environment(
            center_lat=request.latitude,
            center_lon=request.longitude,
            radius_m=2000,
        )

        # Create pet
        if species == Species.DOG:
            pet = DogAgent(profile, seed=random.randint(1, 100000))
        else:
            pet = CatAgent(profile, seed=random.randint(1, 100000))

        # Create searchers
        searchers = create_search_team(
            num_searchers=2,
            home_position=(request.latitude, request.longitude),
            search_radius_m=2000,
        )

        # Run simulation
        path = []
        current_hour = 8

        for hour in range(request.hours):
            pet.move(hours_delta=1, environment=env, current_hour=current_hour)
            pet.update_fear(hours_delta=1)
            pet.update_physiology(hours_delta=1, environment=env)

            path.append({
                "hour": hour,
                "lat": pet.state.position[0],
                "lng": pet.state.position[1],
                "fear": round(pet.state.fear_level, 3),
                "hunger": round(pet.state.hunger_level, 3),
                "status": pet.state.status.value if pet.state.status else "unknown",
            })

            current_hour = (current_hour + 1) % 24

            # Check if pet is deceased
            if pet.state.is_deceased:
                break

        return {
            "species": request.species,
            "temperament": request.temperament,
            "start_location": {"lat": request.latitude, "lng": request.longitude},
            "final_location": {"lat": pet.state.position[0], "lng": pet.state.position[1]},
            "hours_simulated": len(path),
            "final_fear": round(pet.state.fear_level, 3),
            "total_distance_m": round(pet.total_distance_m, 1),
            "max_distance_from_home_m": round(pet.max_distance_from_home_m, 1),
            "path": path,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/temperaments")
async def get_temperaments():
    """Get available temperament profiles for dogs and cats."""
    from core.constants import DOG_TEMPERAMENT_PARAMS, CAT_TEMPERAMENT_PARAMS

    return {
        "dog": {
            code: {
                "name": params["name"],
                "description": params["description"],
                "approach_stranger_prob": params["approach_stranger_prob"],
            }
            for code, params in DOG_TEMPERAMENT_PARAMS.items()
        },
        "cat": {
            code: {
                "name": params["name"],
                "description": params["description"],
                "threshold_days": params["threshold_days"],
            }
            for code, params in CAT_TEMPERAMENT_PARAMS.items()
        }
    }


@app.get("/api/strategies")
async def get_strategies():
    """Get available search strategies."""
    return {
        "PASSIVE": {
            "name": "Passive",
            "description": "Basic expanding circle search, minimal coordination",
        },
        "MODERATE": {
            "name": "Profile-Aware",
            "description": "Searches based on pet temperament and likely behavior",
        },
        "AGGRESSIVE": {
            "name": "Coordinated Grid",
            "description": "Multiple searchers in coordinated grid pattern",
        },
    }


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
