# Assets used in the 3D view

Everything here is CC0 (public domain) or made for this project. Nothing comes from Rockstar or any game: no logos, names, map imagery, models, textures, fonts or music.

## v4 street view (chase camera)

| What | File | Where it came from | License |
| --- | --- | --- | --- |
| Walker, the wedding guest (`character_a` in `channels.py`) | `web/static/models/v4/hero_casual.glb` | Quaternius, Ultimate Modular Men pack, "Casual 2", https://quaternius.com/packs/ultimatemodularcharacters.html | CC0 1.0 |
| Walker, the mango seller, and the jet ski rider (`character_d`) | `web/static/models/v4/hero_beach.glb` | Quaternius, Ultimate Modular Men pack, "Beach". The top gets a shirt print drawn in code (`street/textures.ts`) | CC0 1.0 |
| Police car (`police`) | `web/static/models/v4/car_cop.glb` | Quaternius, Cars pack, https://quaternius.com/packs/cars.html | CC0 1.0 |
| Sedan (`sedan`) | `web/static/models/v4/car_normal_car1.glb` | Quaternius, Cars pack | CC0 1.0 |
| SUV (`suv`) | `web/static/models/v4/car_suv.glb` | Quaternius, Cars pack | CC0 1.0 |
| Taxi (`taxi`) | `web/static/models/v4/car_taxi.glb` | Quaternius, Cars pack | CC0 1.0 |
| Sports hatch (`hatchback_sports`) | `web/static/models/v4/car_sports_car.glb` | Quaternius, Cars pack | CC0 1.0 |
| Box truck (`truck`) | `web/static/models/truck.glb` | Kenney, Car Kit, https://kenney.nl/assets/car-kit | CC0 1.0 |
| Marine Two (`boat_speed_a`) | `web/static/models/boat_speed_a.glb` | Kenney, Watercraft Kit, https://kenney.nl/assets/watercraft-kit | CC0 1.0 |
| Sky and reflections | `web/static/models/v4/sky_2k.jpg`, `sky_1k.jpg` (phones) | Poly Haven, "Kloofendal 48d Partly Cloudy (Pure Sky)" by Greg Zaal, https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky. Tone-mapped from the 2k HDR to JPG, saturation raised | CC0 1.0 |
| Jet ski hull, helicopter | built in code, `web/src/lib/components/scene/street/units.ts` | Original | Original |
| Port Ibis at street level: land and seawalls, roads, lane paint, crossings, sidewalks, the arched causeway bridge, deco buildings, glass towers, palms, signal mast arms, street lights, marina pontoons, the far skyline | built in code from the map and sim data, `street/city.ts`, `street/geo.ts`, `street/space.ts` | Original | Original |
| Asphalt, concrete, seawall, grass, facade bay, glass bay, palm frond, bark, shirt print, wake foam | drawn on a canvas in code, `street/textures.ts` | Original | Original |
| Water | shader written for this project, `street/water.ts` | Original | Original |

How the models were fetched: the Quaternius and Kenney packs are published as glTF in the community mirror https://github.com/Papyszoo/CC0-Public-Domain-Models (`packs/quaternius-ultimatemodularcharacters`, `packs/quaternius-cars`, plus the Kenney packs used in v3). Each pack's `pack.json` (name, creator, website, license) is kept in `web/static/models/licenses/` with the CC0 text. The two characters were trimmed to three animation clips (Idle, Walk, Run) with glTF Transform (MIT); no geometry was changed. No mesh compression, so no WebAssembly decoder is needed under the app's CSP.

Weight: `web/static/models` is about 3.6 MB in total (characters about 1.2 MB each, cars about 170 KB each, sky 120 KB or 38 KB). Everything else in the street view is generated at load.

## v3 assets still in use

| What | Where it came from | License |
| --- | --- | --- |
| `truck.glb`, `boat_speed_a.glb` | Kenney, Car Kit and Watercraft Kit (see above) | CC0 1.0 |

The v3 Kenney cars, blocky characters and the `boat_speed_c` jet ski stand-in were removed in v4. The 2D map (`map/geometry.ts`) is original hand-drawn path data, unchanged.

Libraries: three (MIT), Threlte core and extras (MIT).

CC0 does not require credit. Credit is given anyway: models by Quaternius (quaternius.com) and Kenney (kenney.nl), sky by Greg Zaal on Poly Haven (polyhaven.com).
