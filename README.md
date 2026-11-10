# 🔫 GunMaker3D — VR Gunsmith Simulator

<p align="center">
  <b>Build. Weld. Customize. Test. Collect.</b>
  <br />
  A hands-first VR gunsmith experience powered by IWSDK and WebXR.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Meta%20Quest-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Experience-VR%20Only-purple?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Input-Hand%20Tracking-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Engine-IWSDK-black?style=for-the-badge" />
</p>

---

## 🎮 About the Game

**GunMaker3D** is an immersive VR gunsmith simulator where players become master gunsmiths.

Build firearms from modular components, connect parts, weld mechanical seams, repair damaged weapons, and test your creations at an interactive shooting range.

Earn coins and XP, unlock new components and skins, complete customer orders, and build your personal collection of five signature firearms.

Every interaction is designed around natural hand tracking, making the experience accessible without requiring physical controllers.

**Your workshop. Your craftsmanship. Your collection.**

## 🖼️ Game Preview

> Screenshots and UI previews will be added as development progresses.

<!-- Replace the placeholders with your actual screenshots -->

<p align="center">
  <img src="docs/images/workshop-preview.png" width="90%" alt="GunMaker3D Workshop Preview" />
</p>

<p align="center">
  <i>Main Workshop — Interactive 3D Gunsmith Environment</i>
</p>

### Interface & Gameplay Screenshots

| Workshop | Weapon Assembly |
|:---:|:---:|
| ![Workshop](docs/images/workshop.png) | ![Assembly](docs/images/assembly.png) |
| **Weld Forge** | **Shooting Range** |
| ![Welding](docs/images/welding.png) | ![Range](docs/images/range.png) |
| **Weapon Collection** | **Progression System** |
| ![Safe](docs/images/safe.png) | ![Progression](docs/images/progression.png) |

*Image paths are placeholders. Add your screenshots to `docs/images/` using these filenames.*

---

## ✨ Core Features

### 🔧 1. Modular Weapon Assembly
- Build weapons using interchangeable components.
- Discover compatible attachment sockets.
- Get visual feedback when attaching parts.
- Receive instant weapon-stat updates.
- Remove attached physics bodies to ensure stable assembly.

### 🔥 2. Interactive Weld Forge
A hands-on welding system where precision matters.

- Follow visible welding seams.
- Maintain the correct torch movement speed.
- Experience realistic heat and cooling effects.
- Earn welding quality ratings:
  - **Perfect:** Consistent movement and precision.
  - **Weak:** Torch moves too quickly.
  - **Burn:** Excessive heat from moving too slowly.
- Dynamic sparks, heat glow, and welding bead trails.

### 🛠️ 3. Disassembly & Repair
- Place weapons inside the repair vise.
- Remove components using screwdriver and hammer interactions.
- Inspect weapon durability, rust, and cracks.
- Repair damaged components through a progress-based repair system.

### 🎯 4. Interactive Shooting Range
Test your custom-built weapons.

- Hand-direction-based aiming.
- Recoil and weapon kickback.
- Bullet drop and shot spread.
- Muzzle flashes and bullet tracers.
- Static, sliding, and popup targets.
- Earn rewards for accuracy, distance, and shooting streaks.

### 💰 5. Economy & Progression
- Earn coins from successful activities.
- Gain XP through building, welding, repairing, and shooting.
- Level up to unlock new content.
- Discover new weapon components, skins, and customer orders.
- Watch coins fly during reward animations.

### 📋 6. Customer Orders
Fulfil blueprint-based customer requests.

Example:
- Accuracy: 70+
- Magazine Capacity: 12+
- Required components: Based on blueprint.

Complete orders to earn bonus cash and reputation.

### 🔐 7. Personal Weapon Safe
Build your own firearm collection.

- Place completed weapons inside your safe.
- Interactive safe door animations.
- Miniature weapon display rack.
- Weapon statistics and collection tracking.
- Collect five signature firearms.

### 💡 8. Contextual Guide System
- Floating instruction cards.
- Simple icons and short instructions.
- Guides appear near relevant workshop objects.
- Automatically hide after successful interactions.
- Use the `?` help pad to restore instructions.

### ⏸️ 9. Smart Pause & Resume
- Detect VR visibility changes.
- Detect lost hand tracking.
- Preserve the current gameplay state.
- Resume exactly where the player left off.

---

## 🖐️ Hand-First VR Experience

GunMaker3D is designed around natural hand interactions.

**No controllers required.**

| Interaction | Description |
|---|---|
| Hand Tracking | Primary input method |
| Palm Calibration | Both palms rest flat on the surface |
| Grab & Move | Pick up and position components |
| Snap System | Attach compatible components |
| Torch Movement | Perform precision welding |
| Tool Interaction | Repair and disassemble weapons |
| Hand Aiming | Aim weapons using hand direction |

### Initial Calibration

The workshop starts with a simple calibration sequence:

1. Place both palms flat on the calibration surface.
2. Hold for approximately 4–5 seconds.
3. Watch the two calibration rings expand and merge.
4. The workshop bench builds into the scene.

Lifting either hand early reverses the calibration progress.

---

## 🥽 Target Platforms

**Primary Target:** Meta Quest standalone VR.

| Device | Target |
|---|---|
| Meta Quest 1 | Supported target |
| Meta Quest 2 | Supported target |
| Meta Quest 3 | Supported target |
| Quest Browser | WebXR |
| Desktop | Development and testing fallback |

The experience is designed around the weakest target device to maintain performance across the supported hardware range.

**Experience Mode:** VR only. Passthrough and scene understanding are not required.

---

## 🏆 Competition Goals

**Meta VR Start Developer Competition 2026**

Target tracks:
- Gaming
- New Experience

Target awards:
- 🥇 Best First Five Minutes
- 🥇 Boldest Original Concept

### Design Principles

Every feature must pass three experience tests:

**✈️ Airplane Seat Test**
Every interaction should work within approximately 0.6 metres (2 feet), while seated.

**🚌 Bus Stop Test**
Players should experience a complete and satisfying gameplay moment in under 10 minutes.

**📦 Take-It-Away Test**
No third-party service dependencies. Everything required for the experience is built into the project.

---

## 📈 Gameplay Progression

The progression system is designed to provide an immediate reward while encouraging long-term collection.

| Stage | Gameplay |
|---|---|
| 01 | Calibrate and enter the workshop |
| 02 | Assemble your first firearm |
| 03 | Weld and finish the weapon |
| 04 | Test it at the shooting range |
| 05 | Earn coins and XP |
| 06 | Complete customer orders |
| 07 | Unlock components and skins |
| 08 | Build your five-gun collection |

**Target session:** First weapon quickly; complete five-gun collection in approximately 30–45 minutes.

---

## 🧱 Technology Stack

| Technology | Purpose |
|---|---|
| IWSDK | 3D scene and XR application framework |
| WebXR | Browser-based VR experience |
| Meta Quest | Target hardware |
| Hand Tracking | Primary interaction system |
| TypeScript | Application logic |
| Three.js / IWSDK rendering | 3D scene rendering |

---

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- Git
- A compatible browser
- Meta Quest headset for VR testing

### Installation

Clone the repository:

```bash
git clone <YOUR_REPOSITORY_URL>
cd gunmaker3d
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the managed browser experience and use the Runtime and Editor controls to switch between the running application and its authored scene.

### Development Configuration

The project uses:

- `iwsdk.config.json` — Declarative scene, asset, component, XR, and emulator configuration.
- `src/index.ts` — Application entry point and runtime systems.
- `src/components.ts` — Component registrations.
- `src/scene-assets/` — Procedurally authored scene assets.

Runtime application systems remain explicitly registered in the application entry point.

---

## 📁 Project Structure

```text
gunmaker3d/
│
├── public/
│   └── ui/
│
├── src/
│   ├── index.ts
│   ├── components.ts
│   │
│   ├── scene-assets/
│   │   ├── studio.scene-asset.ts
│   │   └── decor.scene-asset.ts
│   │
│   ├── components/
│   └── systems/
│
├── docs/
│   └── images/
│       ├── workshop-preview.png
│       ├── workshop.png
│       ├── assembly.png
│       ├── welding.png
│       ├── range.png
│       ├── safe.png
│       └── progression.png
│
├── iwsdk.config.json
├── package.json
└── README.md
```

*The structure above is a documentation example; actual folders may evolve during development.*

---

## 📚 Documentation & Resources

- [IWSDK Documentation](https://iwsdk.dev/)
- [Minimal Scene Walkthrough](https://iwsdk.dev/guides/01b-minimal-scene.html)
- [XR Testing & IWER Emulator Controls](https://iwsdk.dev/guides/02-testing-experience.html#iwer-controls)
- [WebXR Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)

---

## 🛠️ Development Philosophy

GunMaker3D focuses on:

- Natural, controller-free interactions.
- Responsive and intuitive 3D mechanics.
- Optimized performance for standalone VR.
- Meaningful feedback through visual and audio effects.
- Short, rewarding gameplay sessions.
- A complete experience without external service dependencies.

---

## 📌 Project Status

<sub>Active Development — Meta VR Start Developer Competition 2026</sub>

Gameplay systems, workshop interactions, weapon assembly, welding, shooting, and progression are developed as part of the GunMaker3D experience.

---

<p align="center">
  <b>🔫 GunMaker3D</b>
  <br />
  <i>Build Your Weapon. Master Your Craft.</i>
  <br /><br />
  Made with passion for immersive VR experiences.
</p>
