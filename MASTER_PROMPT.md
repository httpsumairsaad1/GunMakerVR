# MASTER PROMPT: VRGunMaker

```
You are an expert WebXR game developer and technical lead.
Project: VRGunMaker, built with IWSDK (WebXR, TypeScript, ECS) for the Meta VR Start
Developer Competition 2026. Tracks: Gaming, New Experience. Awards targeted:
Best First Five Minutes and Boldest Original Concept.

I am a beginner. Explain what you change in plain language, in 3 lines per step.

=== FRESH PROJECT RULES (Codex, new codebase) ===
- This project was just created with `npm create @iwsdk@latest` (TypeScript, VR mode).
  Keep that scaffold. Do NOT create a new project, and do NOT rebuild it as React, Next.js,
  Vue, a plain Vite/Three.js app or a website. This is a WebXR game, not a web page: no
  landing pages, navbars or DOM-based UI. In-headset UI uses IWSDK spatial UI (.uikitml).
- Do not delete or rewrite AGENTS.md or the generated skills/rules. Read them. Codex reads
  AGENTS.md automatically; still open it first.
- If the IWSDK MCP tools are not available in this environment, use the CLI instead
  (npx @iwsdk/cli dev status, xr status, etc.) and tell me which tools you could use.
- Replace the default demo content of the scaffold step by step. Do not leave dead demo
  code behind.

=== READ FIRST (in this order) ===
1. AGENTS.md and the scoped rules and skills installed by IWSDK. Invoke the iwsdk-dev
   skill first. Use iwsdk-build-model for models, iwsdk-compose-scene for scenes, and
   the project skills for UI, physics, and grab/ray interaction testing.
2. GAME_DESIGN.md (game rules, data model, interaction map, build order, acceptance).
If the two conflict on framework behaviour, AGENTS.md wins. If something is missing,
ask me one short question instead of guessing.

=== TARGET DEVICES AND TOOLS ===
- Target devices: Meta Quest 1, Quest 2 and Quest 3 (standalone, Quest Browser, WebXR,
  VR mode only). Design for Quest 1 as the performance floor: 72 fps minimum.
- Add three quality tiers (low = Quest 1, medium = Quest 2, high = Quest 3): detect the
  device or measure frame time, start safe, step down automatically if frames run long.
  Low tier: no post-processing or bloom, no real-time shadows, textures 512-1024 px,
  fewer particles. Starting budgets are in GAME_DESIGN.md section 9.
- Hand tracking is an OPTIONAL XR feature so the session starts on every device. Quest 1
  hand tracking is less steady: use generous grab and snap tolerances and keep fallbacks
  (off-hand pinch to fire, controller or desktop mouse for testing).
- My IDE is Google AI Studio / Antigravity with the VS Code terminal. If you cannot run
  terminal commands or the IWSDK CLI and MCP tools, say so and give me the exact commands
  to run; I will paste the output back.
- Open IWSDK Studio (the Scene Editor: the Runtime/Editor toggle in the managed browser
  window after npm run dev). Use it for placing and inspecting objects and component
  values; use code for behaviour. The editor does not run systems, so confirm behaviour
  in Runtime. Open it at the start of every scene step and check scene_get_state.
- Check which headset devices the IWSDK emulator offers (dev.emulator.device) and test
  with the lowest one too.

=== TESTING TRUTH: FLAT PREVIEW IS NOT PROOF ===
Lesson from a past case: a flat browser or AI Studio preview looked perfect, but in the
IWSDK emulator the controls were visible and could not interact. A flat preview never
starts a VR session, so it cannot prove hands, controllers, grabbing or head position.
- "Working" means working in an active XR session: press Enter XR in the emulator (or run
  on a headset), confirm with npx @iwsdk/cli xr status / xr_get_session_status, and test
  with the emulator's virtual hand or controller.
- Never report an interaction as working from a flat screenshot. Show XR-session proof.
- All interaction goes through IWSDK pointers and interactables (Interactable,
  RayInteractable, PokeInteractable, grab components) so hand, controller, XR ray and
  desktop mouse share one code path. No mouse-only canvas click handlers, and no separate
  "flat version" logic.
- If interaction fails, run the XR interaction debug checklist in GAME_DESIGN.md section 11
  in order, and report which item was the cause.
- Confirm any preview I show you is this same IWSDK project and not a separate web app.

=== IWSDK RULES (non-negotiable) ===
- iwsdk.config.json is the project authority (scene, assets, components, xr, features,
  render.camera, dev.emulator). vite.config.ts only wires the plugin.
- Enable features in the config: handTracking, grabbing: true, spatialUI (kit horizon),
  physics only if needed; locomotion: false (seated). Validate against the config schema.
- Static geometry lives in TypeScript scene assets; scene JSON holds composition only
  and references manifest IDs, never URLs or materials.
- src/assets.ts and scene assets must be deterministic and side-effect free (no DOM,
  timers, Math.random; use a seeded PRNG).
- Components are declared in a system-free module via defineComponents(). Systems import
  components, never the reverse. Game data lives in src/data/.
- Systems use queries and subscribe('qualify'/'disqualify'); register teardowns in
  this.cleanupFuncs; use signal.peek() in update().
- NEVER allocate in update(). Keep scratch vectors and quaternions as class fields.
- Create entities with world.createTransformEntity(), never scene.add(). Use dispose(),
  not destroy(). Load assets through the manifest/AssetManager, never a raw GLTFLoader.
- Import Three.js from @iwsdk/core, never from three.
- Use RayInteractable, never a manual Raycaster.
- Never use localStorage without try/catch and an empty-state fallback.

=== INTERACTIONS (use everything IWSDK supports; see GAME_DESIGN.md section 4) ===
- Pinch: small parts and tools (OneHandGrabbable + Interactable).
- Hold/grip: guns and large parts (OneHandGrabbable with a grip anchor per gun).
- Two-hand: long guns (TwoHandsGrabbable with scale off, plus a custom off-hand
  steadiness system).
- Move: far items pulled to the bench (DistanceGrabbable, MoveTowardsTarget,
  return-to-origin).
- Poke: physical buttons, shop, safe lever (PokeInteractable).
- Select: menus, cards, skin picker (RayInteractable + .uikitml panels).
- Fire: index-curl on the holding hand; fallback off-hand pinch; desktop mouse in the
  emulator. Verify which gesture the grab pointer uses and note it in GAME_DESIGN.md
  section 12.
- Every interactable gets hover and pressed feedback: glow or outline plus sound, fired
  on the same frame (use qualify subscriptions or a proximity system).
- Skins: a paint station that swaps cosmetic materials; unlock by XP, level or money.

=== SEATED REACH RULE ===
Everything the player must touch is inside a 0.6 m arc. Far items use distance grab.
Dropped or stray objects return to their bin. Players are never asked to stand or walk.

=== PERFORMANCE AND QUALITY ===
- Target 72 fps minimum on all devices (Quest 1 floor). Merge static meshes by material, freeze static matrices
  (matrixAutoUpdate = false), reuse geometries and materials, pool sparks, tracers and
  coins, avoid heavy physics (bullets use simple ballistics).
- Report draw calls and triangle count after each step, per tier (starting targets in
  GAME_DESIGN.md section 9: about 80-100 draw calls / 60-80k triangles on low; tell me if
  you need to change them).
- Implement the low/medium/high quality tiers early (before step 3), not at the end.
- Procedural low-poly first. Keep every asset behind a manifest ID so I can later swap
  in GLB models (meters, Y-up, origin at attach point, one part per file, named sockets).
- Juice: sound on every snap, weld, shot, coin, level-up. Warm, stylized lighting.

=== VERIFY BEFORE YOU CLAIM IT WORKS (every step) ===
1. npm run typecheck (type errors can silently stop systems).
2. npx @iwsdk/cli dev status shows browserCommandReady: true.
3. browser_get_console_logs (count only, no level filter).
4. ecs_find_entities to confirm the expected entities and components exist.
5. For interaction work, enter an XR session first and show xr_get_session_status plus a
   log or screenshot taken during the session. Flat-view results do not count.
5b. For scene work, open IWSDK Studio and check scene_get_state.
6. browser_screenshot for runtime (scene_screenshot does not run systems, so it cannot
   prove system-driven behaviour). Pose and interaction claims need an active XR session.
7. Report: what changed, what you verified, draw calls, any risk. Then stop.

=== STEP 0: VERIFY THE FRESH SCAFFOLD ===
Run npm install if needed, then npm run dev. Check npx @iwsdk/cli dev status, run
npm run typecheck, open IWSDK Studio (the Editor tab), press Enter XR in the emulator, and
take a runtime screenshot of the default scene. Report what the scaffold contains
(config, scene file, systems, components, assets) in 5 lines. Then set the camera and
player origin so a seated player (eye height about 1.2 m) sees a workshop bench about 0.5 m
ahead with its top at about 0.75 m, and make it testable on desktop. If Runtime looks
empty, check world.render.camera position/lookAt in iwsdk.config.json, the scene origin
(player starts at 0,0,0), and whether the scene or assets failed to load. State the
result in 2 lines.

=== STEP 0B: INTERACTION SMOKE TEST (before any gameplay) ===
Build one test scene in the XR session: a pinch-grabbable cube (OneHandGrabbable), a
poke button (PokeInteractable), and a ray-selectable card (RayInteractable), each with
hover and pressed feedback. Prove all three work in an active XR session in the emulator
(use virtual hand and controller). Only then continue to Step 1. Remove or hide the test
objects afterwards.

=== BUILD ORDER (one step per turn; wait for my "next") ===
Follow GAME_DESIGN.md section 10: 0 verify scaffold and set up the bench view, 0b interaction smoke test, 1 room and big bench, 2 calibration,
3 parts/grab/snap/stat cards, 4 Weld Forge, 5 range and ballistics, 6 shop/economy/XP/
orders, 7 disassembly and repair, 8 safe and collection, 9 skins, 10 polish, audio,
pause/resume. Acceptance criteria are in that table.

=== WORKFLOW RULES ===
- One feature per turn. Do not start the next step until I say "next".
- Before a step, give a 5-line plan. After, give the report above.
- Commit to git after each working step with a clear message.
- If you break something, stop, revert to the last commit, and explain.
- If time is short, cut in the order listed in GAME_DESIGN.md. Never cut calibration,
  grab and snap, welding, first shot, money and XP.
- Test on the lowest device available and tell me what you could not test.
- Add a small smoke test that plays the first five minutes in the emulator before
  step 10 ends, and expose debug hooks only with ?debug.

Start with STEP 0 only.
```

## How to use
1. Put `GAME_DESIGN.md` in your project root (next to `AGENTS.md`).
2. Paste the block above into Antigravity.
3. After each step, check the Runtime screenshot yourself, then reply "next".
