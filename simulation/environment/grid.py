"""
Environment Grid for Monte Carlo Simulation

Based on BEHAVIORAL_PROFILES.md Part 10 - Environment Integration.
Provides terrain, hiding spots, water sources, and hazards.
"""

import math
import random
from typing import Tuple, Optional, Dict, Any, List
from dataclasses import dataclass, field

from ..core.types import TerrainType, EnvironmentCell, GridMetadata
from ..core.constants import TERRAIN_PARAMS
from ..core.utils import distance, haversine


class EnvironmentGrid:
    """
    Grid-based environment representation.

    Can be initialized with:
    - Default terrain type (for simple simulations)
    - OSM data (for realistic simulations)
    """

    def __init__(
        self,
        center_lat: float,
        center_lon: float,
        radius_m: float = 2000,
        cell_size_m: float = 50,
        default_terrain: TerrainType = TerrainType.SUBURBAN,
        seed: Optional[int] = None
    ):
        self.center = (center_lat, center_lon)
        self.radius_m = radius_m
        self.cell_size_m = cell_size_m
        self.default_terrain = default_terrain
        self.rng = random.Random(seed)

        # Calculate grid dimensions
        self.grid_width = int(2 * radius_m / cell_size_m)
        self.grid_height = int(2 * radius_m / cell_size_m)

        # Create metadata
        self.metadata = GridMetadata(
            cell_size_m=cell_size_m,
            origin_lat=center_lat - (radius_m / 111000),
            origin_lon=center_lon - (radius_m / (111000 * math.cos(math.radians(center_lat)))),
            grid_width=self.grid_width,
            grid_height=self.grid_height
        )

        # Initialize grid
        self.cells: Dict[Tuple[int, int], EnvironmentCell] = {}
        self._initialize_grid()

        # Track special locations
        self.water_sources: List[Tuple[float, float]] = []
        self.hiding_spots: List[Tuple[float, float, float]] = []  # (lat, lon, quality)
        self.shelters: List[Tuple[float, float]] = []
        self.roads: List[Tuple[Tuple[float, float], Tuple[float, float]]] = []

    def _initialize_grid(self):
        """Initialize grid with default values."""
        terrain_params = TERRAIN_PARAMS.get(self.default_terrain.value.upper(), TERRAIN_PARAMS["SUBURBAN"])

        for i in range(self.grid_height):
            for j in range(self.grid_width):
                lat, lon = self.metadata.grid_to_coords(i, j)

                # Add some variation
                hiding_density = terrain_params.get("hiding_spot_density", 0.5)
                hiding_spots = int(self.rng.gauss(hiding_density * 3, 1))

                cell = EnvironmentCell(
                    grid_x=j,
                    grid_y=i,
                    lat=lat,
                    lon=lon,
                    terrain_type=self.default_terrain,
                    hiding_spots=max(0, hiding_spots),
                    hiding_spot_quality=self.rng.uniform(0.3, 0.8),
                    water_sources=1 if self.rng.random() < 0.05 else 0,
                    food_sources=1 if self.rng.random() < 0.1 else 0,
                    human_activity=terrain_params.get("human_activity", 0.5) * self.rng.uniform(0.8, 1.2),
                    traffic_risk=terrain_params.get("traffic_risk_per_hour", 0.001),
                    predator_risk=terrain_params.get("predator_risk_per_hour", 0.0005),
                    is_barrier=False,
                    weather_protection=self.rng.uniform(0.1, 0.5) if hiding_spots > 0 else 0
                )

                self.cells[(i, j)] = cell

                # Track water sources
                if cell.water_sources > 0:
                    self.water_sources.append((lat, lon))

                # Track hiding spots
                if cell.hiding_spots > 0:
                    self.hiding_spots.append((lat, lon, cell.hiding_spot_quality))

    def get_cell_at(self, position: Tuple[float, float]) -> Optional[EnvironmentCell]:
        """Get the cell containing the given position."""
        i, j = self.metadata.coords_to_grid(position[0], position[1])
        return self.cells.get((i, j))

    def get_terrain_at(self, position: Tuple[float, float]) -> str:
        """Get terrain type at position."""
        cell = self.get_cell_at(position)
        if cell:
            return cell.terrain_type.value.upper()
        return self.default_terrain.value.upper()

    def is_passable(self, position: Tuple[float, float]) -> bool:
        """Check if position is passable."""
        cell = self.get_cell_at(position)
        if cell:
            return not cell.is_barrier
        return True

    def has_water_nearby(self, position: Tuple[float, float], radius_m: float = 100) -> bool:
        """Check if there's water within radius."""
        for water_pos in self.water_sources:
            if distance(position, water_pos) < radius_m:
                return True
        return False

    def get_hiding_quality(self, position: Tuple[float, float]) -> float:
        """Get hiding spot quality at position."""
        cell = self.get_cell_at(position)
        if cell and cell.hiding_spots > 0:
            return cell.hiding_spot_quality
        return 0.0

    def get_nearby_hiding_spots(
        self,
        position: Tuple[float, float],
        radius_m: float = 200,
        min_quality: float = 0.3
    ) -> List[Tuple[float, float, float]]:
        """Get nearby hiding spots above minimum quality."""
        nearby = []
        for spot in self.hiding_spots:
            if spot[2] >= min_quality:
                if distance(position, (spot[0], spot[1])) < radius_m:
                    nearby.append(spot)
        return sorted(nearby, key=lambda x: -x[2])  # Sort by quality

    def get_traffic_risk(self, position: Tuple[float, float]) -> float:
        """Get traffic risk at position."""
        cell = self.get_cell_at(position)
        if cell:
            return cell.traffic_risk
        return TERRAIN_PARAMS["SUBURBAN"]["traffic_risk_per_hour"]

    def get_predator_risk(self, position: Tuple[float, float]) -> float:
        """Get predator risk at position."""
        cell = self.get_cell_at(position)
        if cell:
            return cell.predator_risk
        return TERRAIN_PARAMS["SUBURBAN"]["predator_risk_per_hour"]

    def get_human_activity(self, position: Tuple[float, float], hour: int) -> float:
        """Get human activity level at position and time."""
        cell = self.get_cell_at(position)
        base_activity = cell.human_activity if cell else 0.5

        # Time of day modifier
        if 8 <= hour <= 18:
            time_mod = 1.2  # Peak during day
        elif 22 <= hour or hour <= 5:
            time_mod = 0.1  # Low at night
        else:
            time_mod = 0.8  # Moderate dawn/dusk

        return base_activity * time_mod

    def add_barrier(self, position: Tuple[float, float]):
        """Mark a position as a barrier."""
        i, j = self.metadata.coords_to_grid(position[0], position[1])
        if (i, j) in self.cells:
            self.cells[(i, j)].is_barrier = True

    def set_terrain(self, position: Tuple[float, float], terrain: TerrainType):
        """Set terrain type at position."""
        i, j = self.metadata.coords_to_grid(position[0], position[1])
        if (i, j) in self.cells:
            self.cells[(i, j)].terrain_type = terrain
            # Update cell properties based on terrain
            terrain_params = TERRAIN_PARAMS.get(terrain.value.upper(), {})
            self.cells[(i, j)].traffic_risk = terrain_params.get("traffic_risk_per_hour", 0.001)
            self.cells[(i, j)].predator_risk = terrain_params.get("predator_risk_per_hour", 0.0005)
            self.cells[(i, j)].human_activity = terrain_params.get("human_activity", 0.5)

    def get_best_hiding_direction(
        self,
        position: Tuple[float, float],
        current_heading: float
    ) -> Optional[float]:
        """Get direction to nearest high-quality hiding spot."""
        nearby = self.get_nearby_hiding_spots(position, 500, 0.5)
        if nearby:
            best = nearby[0]
            return math.atan2(
                best[0] - position[0],
                best[1] - position[1]
            )
        return None

    def generate_sighting_probability_grid(
        self,
        last_known_position: Tuple[float, float],
        hours_since_escape: float,
        species: str,
        indoor_outdoor: str = "IO"
    ) -> Dict[Tuple[int, int], float]:
        """
        Generate a probability grid for where the pet might be.

        Uses Rayleigh distribution based on displacement data.
        """
        from ..core.constants import DISPLACEMENT_PARAMS

        # Get displacement parameters
        if species == "cat":
            if indoor_outdoor in ["IO", "IOP"]:
                params = DISPLACEMENT_PARAMS["cat"]["indoor_only"]
            else:
                params = DISPLACEMENT_PARAMS["cat"]["indoor_outdoor"]
        else:
            params = DISPLACEMENT_PARAMS["dog"]["general"]

        # Time-adjusted displacement
        time_factor = min(1.0, hours_since_escape / 72)  # Saturates at 72 hours
        median = params["median_m"] * (1 + time_factor * 0.5)

        # Calculate sigma for Rayleigh distribution
        # For Rayleigh: median = sigma * sqrt(2 * ln(2))
        sigma = median / math.sqrt(2 * math.log(2))

        probability_grid = {}
        total_prob = 0

        for (i, j), cell in self.cells.items():
            dist = distance(last_known_position, (cell.lat, cell.lon))

            # Rayleigh probability
            if sigma > 0:
                prob = (dist / (sigma ** 2)) * math.exp(-(dist ** 2) / (2 * sigma ** 2))
            else:
                prob = 1.0 if dist < 10 else 0.0

            # Terrain modifier
            if cell.hiding_spots > 0:
                prob *= 1.5  # More likely in hiding spots
            if cell.is_barrier:
                prob = 0  # Can't be in barrier

            probability_grid[(i, j)] = prob
            total_prob += prob

        # Normalize
        if total_prob > 0:
            for key in probability_grid:
                probability_grid[key] /= total_prob

        return probability_grid


def create_simple_environment(
    center_lat: float,
    center_lon: float,
    radius_m: float = 2000,
    terrain: str = "SUBURBAN",
    seed: Optional[int] = None
) -> EnvironmentGrid:
    """Create a simple environment with uniform terrain."""
    terrain_type = TerrainType(terrain.lower()) if hasattr(TerrainType, terrain.upper()) else TerrainType.SUBURBAN

    return EnvironmentGrid(
        center_lat=center_lat,
        center_lon=center_lon,
        radius_m=radius_m,
        cell_size_m=50,
        default_terrain=terrain_type,
        seed=seed
    )
