<div align="center">

# 🔫 GunMaker3D — VR Gunsmith Simulator

<b>Build. Weld. Customize. Test. Collect.</b><br />
<i>A hands-first VR gunsmith experience powered by IWSDK and WebXR.</i>

<br />

[![Platform](https://img.shields.io/badge/Platform-Meta%20Quest%203-blue?style=for-the-badge&logo=meta)](https://developer.meta.com/)
[![Experience](https://img.shields.io/badge/Experience-VR%20Only-purple?style=for-the-badge)](https://webxr.info/)
[![Input](https://img.shields.io/badge/Input-Hand%20Tracking-green?style=for-the-badge)](https://developer.meta.com/)
[![Engine](https://img.shields.io/badge/Engine-IWSDK-black?style=for-the-badge)](https://iwsdk.dev/)

<br />

| Workshop UI & Assembly | Radial Menu Selection |
| :---: | :---: |
| <img src="https://github.com/user-attachments/assets/eca59b07-1ed0-498e-a51c-d2170e729a8d" width="100%" alt="GunMaker3D Workshop UI" /> | <img src="https://github.com/user-attachments/assets/09a15069-9f78-4b3f-bc45-6395309abaad" width="100%" alt="Radial Weapon Menu" /> |

| Workbench Assembly View | Left Equipment Wall | Modular Weapons Library |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/79e318ef-ebd5-4b4d-858f-6ad205e40e4e" width="100%" alt="Assembly View" /> | <img src="https://github.com/user-attachments/assets/25598566-4f67-48ee-9684-5fd4c41df962" width="100%" alt="Equipment Wall" /> | <img src="https://github.com/user-attachments/assets/06aa68fc-5b89-46a1-8b05-87c3c3a45b8e" width="100%" alt="Weapons Preview" /> |

</div>

---

## 🎮 About the Game

**GunMaker3D** is an immersive, seated-optimized VR gunsmith simulator designed specifically for Meta Quest devices[cite: 14]. Players take on the role of a master gunsmith, building firearms from modular components, welding seams, inspecting parts, and testing creations at an interactive shooting range.

Every interaction is engineered around natural **controller-free hand tracking** and **diegetic spatial 3D UI**, maximizing physical immersion without complex walls of text.

> **Your workshop. Your craftsmanship. Your collection.**

---

## ⚙️ Architecture & Execution Pipeline

The architecture strictly follows the **Entity Component System (ECS)** design pattern powered by Meta's Immersive Web SDK (IWSDK) and Havok Physics for WebXR.

<img width="1036" height="1440" alt="image" src="https://github.com/user-attachments/assets/aefda436-5b39-47b3-8e18-cd1a615208b7" />


### 1. Seated Calibration Phase (Airplane Seat Test)
- **Palm Surface Gesture:** Player places both palms flat on the physical desk for 4–5 seconds.
- **Radial Accumulation:** Glowing calibration rings expand and merge across the surface.
- **Workspace Anchoring:** Spawns the main workbench at `(0, 0.75, -0.5)` and the left wall rack within a strict **0.6m (2-foot)** interactive radius.

### 2. ECS System Runtime Loop
- **XR Input & Tracking System:** Computes real-time hand joint transforms, pinch gestures, and raycast interactions for both 3D world geometry and `.uikitml` spatial panels.
- **Physics & Snap-Target System:** Calculates distance vectors between held sub-parts and receiver target sockets. If distance is under `0.05m`, the outline shader switches to **Neon Green (`#00FF66`)** and locks physics coordinates.
- **Visual Feedback Pipeline:** Applies dynamic material outlines across 3D meshes:
  - **Sky Blue (`#00D2FF`):** Hover or active selection from wall/bench.
  - **Neon Green (`#00FF66`):** Valid assembly snap-point alignment.
  - **Alert Red (`#FF3333`):** Invalid placement or active disassembly mode.

---

## ✨ Core Features

### 🔧 1. Modular Weapon Assembly
- Build 5 signature firearms using interchangeable modular components (Receivers, Barrels, Stocks, Scopes, Magazines)[cite: 9, 15].
- Visual snapping feedback with dynamic neon outline shaders.
- Instant weapon-stat updates as components are added.

### 🔥 2. Interactive Weld Forge & Torch
- Precision hands-first torch welding along physical seams.
- Dynamic spark emitters, heat glow, and cooling bead trails.
- Real-time heat calculation (Perfect, Weak, or Burn ratings).

### 🎯 3. Interactive Shooting Range
- Hand-aiming physics with true recoil, bullet drop, and shot spread.
- Interactive targets (static, sliding, popup) with accuracy multiplier rewards.

### 💰 4. Economy & Progression
- Earn credits and XP to unlock new blueprints, component skins, and customer orders[cite: 14, 16].
- Dynamic reward triggers and coin animations.

### 🔐 5. Personal Weapon Safe
- Interactive safe door animations and 3D display racks.
- Store completed builds and track full collection statistics[cite: 14].

---

## 🖐️ Hand-First VR Experience

| Gesture / Input | Action Description | Visual Feedback |
|---|---|---|
| **Palms Flat** | Workspace boundary calibration | Merging glowing rings |
| **Pinch & Drag** | Grab and position 3D gun components | Sky Blue outline (`#00D2FF`) |
| **Snap Alignment** | Intersect part with receiver socket | Neon Green outline (`#00FF66`) |
| **Palm Hold / Joystick** | Trigger floating 3D Radial Weapon Wheel | Holographic 8-slice menu[cite: 5, 15] |
| **Torch Grip** | Fuse components along welding seams | Spark particles & heat glow |

---

## 🥽 Platform Compatibility

| Device | Support Level | Mode |
|---|---|---|
| **Meta Quest 3** | Target / Optimized | WebXR Standalone |
| **Meta Quest 2** | Supported | WebXR Standalone |
| **Quest Browser** | Supported | Native WebXR |
| **Desktop / Dev** | Testing Fallback | Mouse Drag/Spin Pointer-Lock |

---

## 🏆 Meta VR Start Developer Competition 2026

Designed strictly to excel in the **Gaming** and **New Experience** tracks under three key Meta Quest design rules:

- ✈️ **Airplane Seat Test:** Seated-optimized inside a 0.6m (2-foot) interactive radius.
- 🚌 **One Bus Stop Test:** Complete, satisfying gameplay loops delivered in 10 minutes or less.
- 📦 **Take-It-Away Test:** 100% self-contained, standalone experience with zero third-party cloud dependencies.

---

## 🧱 Tech Stack

- **Framework:** Meta Immersive Web SDK (IWSDK)
- **Runtime:** WebXR Device API
- **Language:** TypeScript
- **Graphics Engine:** Three.js / WebGL
- **Physics Engine:** Havok Physics for WebXR
- **UI Architecture:** Spatial UIKitML (`.uikitml`)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm / pnpm
- Meta Quest 2 / 3 or Meta Quest Developer Hub (MQDH) for headset testing

### Installation

```bash
# Clone the repository
git clone [https://github.com/your-username/gunmaker3d.git](https://github.com/your-username/gunmaker3d.git)
cd gunmaker3d

# Install dependencies
npm install

# Start local dev server with IWSDK live reloading
npm run dev
