# Tidekin · Your Little World, Together

**Tidekin** is an original cozy **2.5D social-world alpha**. Built with a hand-drawn Canvas 2D rendering engine, no Three.js, no 3D objects, no external image assets.

## What's playable in alpha 0.1

- Create a browser-local guest identity and a personal room identified by a shareable code.
- Wander through your handmade isometric room with a tiny animated avatar.
- Change hairstyle, skin, hair color, clothing, room walls, floor color, activity, and room name.
- Choose from 11 furniture pieces; tap to place, drag to move, rotate, remove; autosaved.
- Invite a friend with a URL or room code, see one another's positions and online/idle presence in real time.
- Wave to others, export a room screenshot, and use responsive desktop/mobile controls.

## Run locally

Requirements: Node.js 22 or newer.

```sh
npm install
npm start
```

Open http://localhost:3000. For development, `npm run dev`. Run tests with `npm test`.

Railway: connect GitHub repository `LouKang09/Tidekin`, attach a persistent volume at `/data` and set `DATA_DIR=/data`; make a public service domain. The app listens on `PORT`.

## Current limitations and safety

This is a **web alpha**, not a native APK. **Guest identity is browser-bound** without email/password: clearing browser storage loses the account token; the alpha has no account recovery. Sharing a room URL or code allows anyone possessing it to enter the room, though only the owner can edit its furniture. Formal friends, blocking, privacy controls, chat, couples' shared houses, the ocean, and bottle letters are later milestones. Avoid putting private information in guest names. The alpha should not be marketed as a safe child-oriented chat product.

The renderer uses Canvas 2D with procedural illustrations, not 3D models. Camera viewpoint is fixed. Room state persists as an atomic JSON file under `DATA_DIR` (defaults to `.local-data`) and supports one backend replica. Move to PostgreSQL + Redis before scaling.

## Architecture

- Frontend: HTML/CSS/JS, custom Canvas 2D sprites, isometric projection, pointer gestures.
- Backend: Node.js HTTP server and `ws` for multiplayer movement, presence, idle state and waves.
- Guest tokens: cryptographically random, hashed server-side, retained in browser localStorage.
- API: `POST /api/guest`, `GET /api/me`, `PUT /api/me`, `GET /api/rooms/:code`; live socket `/live`.
- Security: same-origin validation, server-side action whitelists, strict editing ownership checks, input validation, rate limiting.

Copyright 2026 Tidekin contributors. Original game concept.
