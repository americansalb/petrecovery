"""Environment grid, terrain, and recovery tools."""
from .grid import EnvironmentGrid, create_simple_environment
from .traps import TrapManager, TrapType, BaitType, TrapState, calculate_optimal_trap_placement
from .scent import ScentArticleManager, ScentArticleType, WindState, optimal_scent_article_placement
from .osm import (
    OSMTerrainLoader,
    create_environment_from_osm,
    osm_to_environment_grid,
    TerrainCell,
    OverpassClient,
)
