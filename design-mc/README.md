# Mission Control redesign — design source

Working files for the Mission Control redesign canvas, published at
https://claude.ai/code/artifact/65a41fce-6990-460a-ab0a-dccdbd5a8563

These four `.dc.html` files ARE the design. The published page is generated
from them and is deliberately not committed (see `.gitignore`).

| file | artboard |
|---|---|
| `Main.dc.html` | Owner's view, moments after a sighting lands |
| `Claiming.dc.html` | Volunteer claiming a search block |
| `Field.dc.html` | Searcher outdoors, 390px |
| `Language.dc.html` | The board's visual vocabulary |
| `canvas.json` | Layout, titles, sticky notes |

## What this proposes

The map stops being wallpaper and becomes the document. Today Mission
Control sits it between two panels that duplicate each other's content,
and it draws a house and one sighting pin.

The collaborative board this proposes is already modelled in the database
and rendered nowhere:

- `GridCell` — bounds, `status` (UNSEARCHED / IN_PROGRESS / SEARCHED /
  CLUE_FOUND / NEEDS_REVISIT / PET_FOUND / CLOSED), `priority`,
  `claimedById`, `searchedById`, `searchCount`
- `SearchArea` — GeoJSON polygons with acreage
- `FlyerPosting`, `PetSpotting` — lat/lng pins
- `MissionVolunteer.currentLocation`, `.assignedZoneId`

At the time of writing all five tables held zero rows and no Mission
Control component referenced any of them.

Three ideas carried by the artboards:

1. **One command card that asks a different question depending on who you
   are.** The owner is told where the pet was just seen; a volunteer
   standing in an unsearched block is asked to claim it.
2. **Coverage is a fill, events are pins.** A block's tint answers only
   "has anyone walked this". Anything found rides on top, so a clue
   survives the block later being marked searched.
3. **Mobile is one job and one button.** Searchers are outdoors,
   one-handed, in bad light.

## Rebuilding the canvas

Re-run the `/design` skill's helper against these files; it seeds a fresh
copy of the editor payload and writes `mission-control-redesign.html`.
Publishing that file to the artifact URL above keeps the same link.

Status: a design proposal. No application code has been changed.
