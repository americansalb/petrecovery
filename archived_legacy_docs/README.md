# Archived Legacy Documentation

## Why These Files Are Here

These files represent an older "Community" system design that was **never fully implemented** in the production schema. They are kept here for historical reference only.

## What Was the Community System?

The Community system was an early design concept that included:
- **Metro Areas** - Large metropolitan regions (e.g., "Chicago Metro")
- **Counties** - County-level organization for rural areas
- **Subcommunities** - Neighborhoods within metros/counties

This hierarchical approach was later replaced by a simpler, more effective model.

## Current System: Rescue Squads + Divisions

The production system now uses:
- **Rescue Squads** - City-level volunteer teams (replaces Communities/Metro Areas)
- **Divisions** - Neighborhood subdivisions within large city squads (replaces Subcommunities)

See `/frontend/prisma/schema.prisma` for the current implementation.

## Files Archived

1. `COMMUNITY_SCHEMA_SUMMARY.md` - Old Community model specifications
2. `COMMUNITY_API_ENDPOINTS.md` - Planned API endpoints (never built)
3. `COMMUNITY_IMPLEMENTATION_PLAN.md` - Implementation roadmap (obsolete)
4. `COMMUNITY_UI_STRUCTURE.md` - UI design for Community features (superseded)

## Migration Notes

The legacy Community models still exist in `schema.prisma` marked as "LEGACY - Keeping for backwards compatibility", but they are not integrated with the active Rescue Squad system.

**Date Archived:** 2025-11-20
**Replaced By:** Rescue Squad + Division system
