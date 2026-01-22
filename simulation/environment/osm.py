"""
OpenStreetMap Integration for Pet Recovery Simulation

Fetches real terrain data from OSM to create realistic environments.
Uses Overpass API for querying map features.
"""

import math
import json
import urllib.request
import urllib.parse
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import time


class OSMFeatureType(Enum):
    """Categories of OSM features relevant to pet recovery."""
    ROAD_PRIMARY = "road_primary"
    ROAD_SECONDARY = "road_secondary"
    ROAD_RESIDENTIAL = "road_residential"
    HIGHWAY = "highway"
    WATER_BODY = "water_body"
    WATER_STREAM = "water_stream"
    PARK = "park"
    FOREST = "forest"
    BUILDING_RESIDENTIAL = "building_residential"
    BUILDING_COMMERCIAL = "building_commercial"
    BUILDING_INDUSTRIAL = "building_industrial"
    BARRIER_FENCE = "barrier_fence"
    BARRIER_WALL = "barrier_wall"
    RAILWAY = "railway"
    PARKING = "parking"
    SHELTER = "shelter"  # Bus stops, gazebos, etc.


@dataclass
class OSMNode:
    """A single point from OSM."""
    id: int
    lat: float
    lon: float
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class OSMWay:
    """A line or polygon from OSM."""
    id: int
    nodes: List[Tuple[float, float]]  # List of (lat, lon)
    tags: Dict[str, str] = field(default_factory=dict)
    is_closed: bool = False


@dataclass
class OSMArea:
    """A bounded area derived from OSM data."""
    feature_type: OSMFeatureType
    bounds: Tuple[float, float, float, float]  # min_lat, min_lon, max_lat, max_lon
    geometry: List[Tuple[float, float]]  # Polygon vertices
    center: Tuple[float, float]
    area_sqm: float
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TerrainCell:
    """A single cell in the terrain grid derived from OSM."""
    lat: float
    lon: float
    primary_type: str  # URBAN, SUBURBAN, RURAL, etc.
    features: List[OSMFeatureType]
    road_density: float  # 0-1
    building_density: float  # 0-1
    vegetation_density: float  # 0-1
    water_nearby: bool
    hiding_quality: float  # 0-1
    traffic_risk: float  # 0-1


class OverpassClient:
    """Client for Overpass API queries."""

    OVERPASS_URL = "https://overpass-api.de/api/interpreter"
    BACKUP_URLS = [
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]

    def __init__(self, timeout: int = 60):
        self.timeout = timeout
        self._last_request_time = 0
        self._min_interval = 1.0  # Minimum seconds between requests

    def _rate_limit(self):
        """Ensure we don't overwhelm the API."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request_time = time.time()

    def query(self, overpass_query: str, retries: int = 3) -> Optional[Dict]:
        """Execute an Overpass QL query."""
        self._rate_limit()

        urls = [self.OVERPASS_URL] + self.BACKUP_URLS

        for attempt in range(retries):
            url = urls[attempt % len(urls)]

            try:
                data = urllib.parse.urlencode({"data": overpass_query}).encode()
                req = urllib.request.Request(url, data=data)
                req.add_header("User-Agent", "ReunitePetsSimulation/1.0")

                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    result = json.loads(response.read().decode())
                    return result

            except Exception as e:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                else:
                    raise RuntimeError(f"Overpass query failed after {retries} attempts: {e}")

        return None


class OSMTerrainLoader:
    """
    Loads and processes OSM data to create simulation terrain.

    Features extracted:
    - Roads (traffic risk, barriers)
    - Buildings (urban density, hiding spots)
    - Parks and forests (hiding spots, movement)
    - Water bodies (barriers, water sources)
    - Railways (barriers)
    """

    def __init__(self, client: Optional[OverpassClient] = None):
        self.client = client or OverpassClient()
        self.cache: Dict[str, Any] = {}

    def _build_query(
        self,
        center_lat: float,
        center_lon: float,
        radius_m: float
    ) -> str:
        """Build Overpass query for area around center point."""

        # Overpass uses bounding box or around filter
        query = f"""
[out:json][timeout:60];
(
  // Roads
  way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service"](around:{radius_m},{center_lat},{center_lon});

  // Buildings
  way["building"](around:{radius_m},{center_lat},{center_lon});

  // Parks and recreation
  way["leisure"~"park|garden|playground"](around:{radius_m},{center_lat},{center_lon});
  relation["leisure"~"park|garden"](around:{radius_m},{center_lat},{center_lon});

  // Natural features
  way["natural"~"wood|water|wetland|scrub"](around:{radius_m},{center_lat},{center_lon});
  way["landuse"~"forest|meadow|grass|farmland"](around:{radius_m},{center_lat},{center_lon});

  // Water
  way["waterway"](around:{radius_m},{center_lat},{center_lon});
  way["natural"="water"](around:{radius_m},{center_lat},{center_lon});

  // Barriers
  way["barrier"~"fence|wall|hedge"](around:{radius_m},{center_lat},{center_lon});
  way["railway"](around:{radius_m},{center_lat},{center_lon});

  // Shelters (potential hiding spots)
  node["amenity"~"shelter|bus_station"](around:{radius_m},{center_lat},{center_lon});
  way["building"~"shed|garage|barn"](around:{radius_m},{center_lat},{center_lon});
);
out body geom;
"""
        return query

    def load_area(
        self,
        center_lat: float,
        center_lon: float,
        radius_m: float = 1000
    ) -> Dict[str, List[Any]]:
        """
        Load OSM data for an area.

        Returns dict with categorized features.
        """
        cache_key = f"{center_lat:.4f},{center_lon:.4f},{radius_m}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        query = self._build_query(center_lat, center_lon, radius_m)
        result = self.client.query(query)

        if not result or "elements" not in result:
            return {"roads": [], "buildings": [], "parks": [], "water": [], "barriers": [], "shelters": []}

        features = self._categorize_elements(result["elements"])
        self.cache[cache_key] = features

        return features

    def _categorize_elements(self, elements: List[Dict]) -> Dict[str, List[Any]]:
        """Categorize OSM elements by type."""
        categorized = {
            "roads": [],
            "buildings": [],
            "parks": [],
            "water": [],
            "barriers": [],
            "shelters": [],
            "natural": [],
        }

        for elem in elements:
            tags = elem.get("tags", {})
            elem_type = elem.get("type")

            # Extract geometry
            if elem_type == "way" and "geometry" in elem:
                geometry = [(g["lat"], g["lon"]) for g in elem["geometry"]]
            elif elem_type == "node":
                geometry = [(elem["lat"], elem["lon"])]
            else:
                geometry = []

            if not geometry:
                continue

            feature = {
                "id": elem.get("id"),
                "geometry": geometry,
                "tags": tags,
            }

            # Categorize by tags
            if "highway" in tags:
                highway_type = tags["highway"]
                feature["highway_type"] = highway_type
                feature["is_major"] = highway_type in ["motorway", "trunk", "primary"]
                categorized["roads"].append(feature)

            elif "building" in tags:
                building_type = tags.get("building", "yes")
                feature["building_type"] = building_type
                categorized["buildings"].append(feature)

            elif "leisure" in tags and tags["leisure"] in ["park", "garden", "playground"]:
                categorized["parks"].append(feature)

            elif "waterway" in tags or tags.get("natural") == "water":
                categorized["water"].append(feature)

            elif "barrier" in tags or "railway" in tags:
                categorized["barriers"].append(feature)

            elif tags.get("natural") in ["wood", "scrub"] or tags.get("landuse") in ["forest", "meadow"]:
                categorized["natural"].append(feature)

            elif tags.get("amenity") in ["shelter", "bus_station"] or tags.get("building") in ["shed", "garage", "barn"]:
                categorized["shelters"].append(feature)

        return categorized

    def create_terrain_grid(
        self,
        center_lat: float,
        center_lon: float,
        radius_m: float = 1000,
        cell_size_m: float = 50
    ) -> List[List[TerrainCell]]:
        """
        Create a terrain grid from OSM data.

        Each cell contains aggregated information about the terrain.
        """
        features = self.load_area(center_lat, center_lon, radius_m)

        # Calculate grid dimensions
        cells_per_side = int(2 * radius_m / cell_size_m)

        grid = []

        # Approximate degrees per meter
        lat_per_m = 1 / 111000
        lon_per_m = 1 / (111000 * math.cos(math.radians(center_lat)))

        half_cells = cells_per_side // 2

        for row in range(cells_per_side):
            grid_row = []
            for col in range(cells_per_side):
                # Calculate cell center
                row_offset = (row - half_cells) * cell_size_m
                col_offset = (col - half_cells) * cell_size_m

                cell_lat = center_lat + row_offset * lat_per_m
                cell_lon = center_lon + col_offset * lon_per_m

                # Analyze cell
                cell = self._analyze_cell(
                    cell_lat, cell_lon, cell_size_m,
                    features
                )
                grid_row.append(cell)

            grid.append(grid_row)

        return grid

    def _analyze_cell(
        self,
        lat: float,
        lon: float,
        cell_size_m: float,
        features: Dict[str, List[Any]]
    ) -> TerrainCell:
        """Analyze a single grid cell based on nearby features."""

        cell_radius = cell_size_m / 2

        # Count features near this cell
        road_count = 0
        major_road = False
        building_count = 0
        park_nearby = False
        forest_nearby = False
        water_nearby = False
        shelter_nearby = False
        barrier_nearby = False

        for road in features["roads"]:
            if self._feature_near_point(road["geometry"], lat, lon, cell_radius * 2):
                road_count += 1
                if road.get("is_major"):
                    major_road = True

        for building in features["buildings"]:
            if self._feature_near_point(building["geometry"], lat, lon, cell_radius * 2):
                building_count += 1

        for park in features["parks"]:
            if self._feature_near_point(park["geometry"], lat, lon, cell_radius * 3):
                park_nearby = True

        for natural in features["natural"]:
            if self._feature_near_point(natural["geometry"], lat, lon, cell_radius * 3):
                forest_nearby = True

        for water in features["water"]:
            if self._feature_near_point(water["geometry"], lat, lon, cell_radius * 3):
                water_nearby = True

        for shelter in features["shelters"]:
            if self._feature_near_point(shelter["geometry"], lat, lon, cell_radius * 2):
                shelter_nearby = True

        for barrier in features["barriers"]:
            if self._feature_near_point(barrier["geometry"], lat, lon, cell_radius):
                barrier_nearby = True

        # Calculate densities
        max_roads = 5
        max_buildings = 10

        road_density = min(1.0, road_count / max_roads)
        building_density = min(1.0, building_count / max_buildings)
        vegetation_density = 0.7 if forest_nearby else (0.4 if park_nearby else 0.1)

        # Determine primary terrain type
        if major_road:
            primary_type = "HIGHWAY"
        elif building_density > 0.7:
            primary_type = "URBAN"
        elif building_density > 0.3:
            primary_type = "SUBURBAN"
        elif forest_nearby:
            primary_type = "WOODED"
        elif park_nearby:
            primary_type = "PARK"
        else:
            primary_type = "RURAL"

        # Calculate hiding quality
        hiding_quality = 0.1
        if shelter_nearby:
            hiding_quality += 0.4
        if forest_nearby:
            hiding_quality += 0.3
        if building_density > 0.3:
            hiding_quality += 0.2  # Sheds, under porches, etc.
        hiding_quality = min(1.0, hiding_quality)

        # Calculate traffic risk
        traffic_risk = 0.0
        if major_road:
            traffic_risk = 0.8
        elif road_density > 0.5:
            traffic_risk = 0.4
        elif road_density > 0.2:
            traffic_risk = 0.2

        # Collect features
        cell_features = []
        if road_count > 0:
            cell_features.append(OSMFeatureType.ROAD_RESIDENTIAL)
        if major_road:
            cell_features.append(OSMFeatureType.HIGHWAY)
        if building_count > 0:
            cell_features.append(OSMFeatureType.BUILDING_RESIDENTIAL)
        if park_nearby:
            cell_features.append(OSMFeatureType.PARK)
        if forest_nearby:
            cell_features.append(OSMFeatureType.FOREST)
        if water_nearby:
            cell_features.append(OSMFeatureType.WATER_BODY)
        if barrier_nearby:
            cell_features.append(OSMFeatureType.BARRIER_FENCE)

        return TerrainCell(
            lat=lat,
            lon=lon,
            primary_type=primary_type,
            features=cell_features,
            road_density=road_density,
            building_density=building_density,
            vegetation_density=vegetation_density,
            water_nearby=water_nearby,
            hiding_quality=hiding_quality,
            traffic_risk=traffic_risk,
        )

    def _feature_near_point(
        self,
        geometry: List[Tuple[float, float]],
        lat: float,
        lon: float,
        radius_m: float
    ) -> bool:
        """Check if any point of a feature is within radius of a point."""
        radius_deg = radius_m / 111000  # Approximate

        for point_lat, point_lon in geometry:
            dlat = abs(point_lat - lat)
            dlon = abs(point_lon - lon)

            if dlat < radius_deg and dlon < radius_deg * 1.5:  # Rough check
                # More precise distance
                dist_m = math.sqrt(
                    ((point_lat - lat) * 111000) ** 2 +
                    ((point_lon - lon) * 111000 * math.cos(math.radians(lat))) ** 2
                )
                if dist_m <= radius_m:
                    return True

        return False

    def find_hiding_spots(
        self,
        features: Dict[str, List[Any]],
        min_quality: float = 0.5
    ) -> List[Tuple[float, float, float]]:
        """
        Find potential hiding spots from OSM data.

        Returns: List of (lat, lon, quality)
        """
        hiding_spots = []

        # Shelters are high-quality hiding spots
        for shelter in features["shelters"]:
            if shelter["geometry"]:
                lat, lon = shelter["geometry"][0]
                hiding_spots.append((lat, lon, 0.9))

        # Parks and forests have moderate hiding potential
        for park in features["parks"]:
            if park["geometry"]:
                # Use centroid
                lats = [p[0] for p in park["geometry"]]
                lons = [p[1] for p in park["geometry"]]
                center_lat = sum(lats) / len(lats)
                center_lon = sum(lons) / len(lons)
                hiding_spots.append((center_lat, center_lon, 0.6))

        for natural in features["natural"]:
            if natural["geometry"]:
                lats = [p[0] for p in natural["geometry"]]
                lons = [p[1] for p in natural["geometry"]]
                center_lat = sum(lats) / len(lats)
                center_lon = sum(lons) / len(lons)
                hiding_spots.append((center_lat, center_lon, 0.7))

        return [(lat, lon, q) for lat, lon, q in hiding_spots if q >= min_quality]

    def find_water_sources(
        self,
        features: Dict[str, List[Any]]
    ) -> List[Tuple[float, float, str]]:
        """
        Find water sources from OSM data.

        Returns: List of (lat, lon, water_type)
        """
        water_sources = []

        for water in features["water"]:
            if water["geometry"]:
                tags = water.get("tags", {})
                water_type = tags.get("waterway", tags.get("natural", "water"))

                # Use first point for streams, centroid for bodies
                if tags.get("waterway"):
                    lat, lon = water["geometry"][0]
                else:
                    lats = [p[0] for p in water["geometry"]]
                    lons = [p[1] for p in water["geometry"]]
                    lat = sum(lats) / len(lats)
                    lon = sum(lons) / len(lons)

                water_sources.append((lat, lon, water_type))

        return water_sources


def create_environment_from_osm(
    center_lat: float,
    center_lon: float,
    radius_m: float = 1000,
    cell_size_m: float = 50
) -> Dict[str, Any]:
    """
    Create a complete simulation environment from OSM data.

    This is the main entry point for OSM-based environment creation.

    Returns:
        Dict containing:
        - terrain_grid: 2D grid of TerrainCell objects
        - hiding_spots: List of (lat, lon, quality)
        - water_sources: List of (lat, lon, type)
        - barriers: List of barrier line segments
        - bounds: (min_lat, min_lon, max_lat, max_lon)
    """
    loader = OSMTerrainLoader()

    # Load OSM data
    features = loader.load_area(center_lat, center_lon, radius_m)

    # Create terrain grid
    terrain_grid = loader.create_terrain_grid(
        center_lat, center_lon, radius_m, cell_size_m
    )

    # Find special features
    hiding_spots = loader.find_hiding_spots(features)
    water_sources = loader.find_water_sources(features)

    # Extract barriers (roads, railways, fences)
    barriers = []
    for barrier in features["barriers"]:
        if len(barrier["geometry"]) >= 2:
            barriers.append(barrier["geometry"])

    # Major roads as barriers
    for road in features["roads"]:
        if road.get("is_major") and len(road["geometry"]) >= 2:
            barriers.append(road["geometry"])

    # Calculate bounds
    lat_offset = radius_m / 111000
    lon_offset = radius_m / (111000 * math.cos(math.radians(center_lat)))

    bounds = (
        center_lat - lat_offset,
        center_lon - lon_offset,
        center_lat + lat_offset,
        center_lon + lon_offset,
    )

    return {
        "terrain_grid": terrain_grid,
        "hiding_spots": hiding_spots,
        "water_sources": water_sources,
        "barriers": barriers,
        "bounds": bounds,
        "center": (center_lat, center_lon),
        "radius_m": radius_m,
        "cell_size_m": cell_size_m,
    }


def osm_to_environment_grid(osm_env: Dict[str, Any]):
    """
    Convert OSM environment data to EnvironmentGrid format.

    This bridges OSM data with the existing simulation environment.
    """
    from .grid import EnvironmentGrid, TerrainType, HidingSpot, WaterSource

    terrain_grid = osm_env["terrain_grid"]
    bounds = osm_env["bounds"]

    if not terrain_grid or not terrain_grid[0]:
        raise ValueError("Empty terrain grid")

    grid_height = len(terrain_grid)
    grid_width = len(terrain_grid[0])

    # Create environment grid
    env = EnvironmentGrid(
        bounds=bounds,
        grid_width=grid_width,
        grid_height=grid_height,
    )

    # Map OSM terrain types to simulation terrain types
    type_mapping = {
        "URBAN": TerrainType.URBAN,
        "SUBURBAN": TerrainType.SUBURBAN,
        "RURAL": TerrainType.RURAL,
        "WOODED": TerrainType.WOODED,
        "PARK": TerrainType.PARK,
        "HIGHWAY": TerrainType.HIGHWAY,
    }

    # Populate terrain grid
    for row_idx, row in enumerate(terrain_grid):
        for col_idx, cell in enumerate(row):
            terrain_type = type_mapping.get(cell.primary_type, TerrainType.SUBURBAN)
            env.set_terrain(row_idx, col_idx, terrain_type)

    # Add hiding spots
    for lat, lon, quality in osm_env["hiding_spots"]:
        env.add_hiding_spot(HidingSpot(
            location=(lat, lon),
            quality=quality,
            capacity=3,
            visibility=1.0 - quality * 0.5,
        ))

    # Add water sources
    for lat, lon, water_type in osm_env["water_sources"]:
        env.add_water_source(WaterSource(
            location=(lat, lon),
            reliability=0.9 if "river" in water_type.lower() else 0.7,
        ))

    return env
