# VRGunMaker: 5 low-poly modular guns (GLB)

Original low-poly designs inspired by the style of your reference image (chunky steel and wood, drum magazines, perforated shrouds, grooved handguards). Not traced from the image. Built procedurally, so every part is a separate, clean mesh made for assembly and disassembly.

| Gun | id | Parts | Triangles | Length |
|---|---|---|---|---|
| Bolt Sniper | `bolt_sniper` | 7 | 1,416 | 1.016 m |
| Drum Pump Shotgun | `drum_shotgun` | 6 | 1,528 | 0.934 m |
| Assault Rifle | `assault_rifle` | 7 | 1,320 | 0.879 m |
| Revolver Grenade Launcher | `grenade_launcher` | 6 | 1,432 | 0.806 m |
| Drum Pistol | `drum_pistol` | 7 | 1,040 | 0.329 m |

## Files
- `<gun>/<gun>_assembled.glb`: the full gun, with each part as a named node plus sockets and anchors.
- `<gun>/parts/<gun>_<part>.glb`: each part on its own, ready to spawn on the bench.
- `manifest.json`: every part's slot, assembled position, detach direction and distance, triangle count and size.
- `previews/`: software-rendered previews (assembled and exploded). They are not in-engine screenshots.

## Parts
- **Bolt Sniper** (`bolt_sniper`): `receiver` (receiver), `barrel` (barrel), `handguard` (handguard), `stock` (stock), `magazine` (magazine), `scope` (sight), `bolt` (bolt)
- **Drum Pump Shotgun** (`drum_shotgun`): `receiver` (receiver), `barrel_shroud` (barrel), `pump_forend` (handguard), `drum_magazine` (magazine), `stock` (stock), `front_sight` (sight)
- **Assault Rifle** (`assault_rifle`): `receiver` (receiver), `barrel` (barrel), `handguard` (handguard), `magazine` (magazine), `stock` (stock), `grip` (grip), `rear_sight` (sight)
- **Revolver Grenade Launcher** (`grenade_launcher`): `receiver` (receiver), `cylinder` (cylinder), `barrel` (barrel), `forend` (handguard), `stock` (stock), `sight` (sight)
- **Drum Pistol** (`drum_pistol`): `frame` (receiver), `slide` (slide), `barrel` (barrel), `forend` (handguard), `drum` (magazine), `grip` (grip), `rear_sight` (sight)

## Conventions (important for the agent)
- Units: metres. Y up. The muzzle points toward **-Z** (glTF/three.js forward).
- **Every part GLB has its origin at its own attach point.** In the assembled file each part node sits at that point, so snapping a part = move its origin onto the matching `socket_<slot>` empty and match the rotation (identity).
- Empties in the assembled GLB (node names): `socket_<slot>` (one per part), `grip_anchor` (primary hand), `support_anchor` (off-hand, long guns only), `muzzle` (bullet spawn and muzzle flash; also inside the barrel part files).
- `manifest.json` gives `detach_direction` (a unit vector in model space) and `detach_distance` for the pull-off animation when disassembling.
- Material names are shared across all files so you can restyle or add skins by name: `steel`, `dark_steel`, `wood`, `dark`, `glass`. Colours are plain PBR factors (no textures).
- Part meshes are separate nodes with `extras: {slot, type}` (three.js exposes this as `userData`).
- Receiver/frame parts are the base of each gun: build everything else onto them.

## Using them in VRGunMaker (IWSDK)
1. Copy the folders to `public/models/guns/` in your project.
2. Register each GLB in `src/assets.ts` with a manifest ID (for example `gun.bolt_sniper.barrel`), following the pattern in AGENTS.md. Do not load them with a raw loader.
3. Read `manifest.json` into `src/data/` to build part stats, slots and snap positions.
4. The guns are chunky and about 0.3 to 1.0 m long. For a seated 0.6 m reach, display them on the bench at a smaller scale (try 0.6 for the long guns) and tune in the emulator.
5. Keep the low tier budget in mind: each gun is about 1,000 to 1,500 triangles, so the whole set is cheap.

## Checks done
- All 38 GLB files pass the Khronos glTF validator with 0 errors and 0 warnings and load in trimesh.
- Not tested inside IWSDK or on a headset.

## Not included (yet)
- Textures or normal maps (plain colours only), internal mechanisms, animations (the cylinder spin, slide, bolt and pump motions are for you to animate in code using the part nodes), and collision shapes.
