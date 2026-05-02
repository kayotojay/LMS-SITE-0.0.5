# LMS — Local-first Management System
### A free, browser-based project management hub built for game developers.

> Built by **Jason K. Gonzales** — solo dev tool that grew into something more.

---

## What is LMS?

**LMS (Local-first Management System)** is an all-in-one game dev project manager that runs entirely in your browser. No installs, no subscriptions, no bloat. Plan your game, track your progress, manage your team, and ship — all from a single hub.

Your data is stored **locally on your device** by default, with optional real-time team sync powered by your own free Supabase database.

---

## Features

### Project Management
- **Project Roots** — Separate workspaces per game, importable/exportable as `.lmsroot` files
- **Main & Sub Phases** — Milestone-based task tracking with progress bars
- **Version Log** — Build history with version tags

### Dev Tools
- **Script Vault** — Organize scripts and code snippets in folders, version-tagged
- **Scene Tree** — Godot-inspired node hierarchy editor
- **Dev Time Tracker** — Session timer, 52-week heatmap, streaks, and session history

### Design & Docs
- **Game Design Doc** — Collapsible GDD sections, built right in
- **Asset Tracker** — Track sprites, audio, models, shaders, animations, UI elements
- **Bug Tracker** — Severity-rated issue tracking (Critical → Low) with status management

### Team & Server Mode *(requires free Supabase setup)*
- Host or join servers with a password
- Real-time project sync across your team
- Live team chat
- Online presence indicators
- One-click invite codes
- Up to 5 servers per account

### Theming
- 13+ dark themes, 4 light themes, and brand themes (Discord, Matrix, Dracula, Nord, SpaceX, and more)
- Full custom theme builder with live preview
- Import hex palettes or `.json` theme files
- Export your own theme files
- Multiple font modes and home layout styles

---

## Getting Started

**No install required.** Just open the site:

🔗 **[https://kayotojay.github.io/LMS-SITE-0.0.5/](https://kayotojay.github.io/LMS-SITE-0.0.5/)**

### Local Projects (No setup needed)
1. Open the site
2. Click **New Project**
3. Start adding phases and tasks

### Team / Server Mode (Free setup ~2 mins)
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Run the provided SQL script in the Supabase SQL Editor
4. Paste your **Project URL** and **anon public key** into the DB Setup panel in LMS
5. Create an account and host or join a server

> Full step-by-step instructions are available inside the app under **⚙ DB Setup**.

---

## Exporting & Importing Data

| Action | Format |
|---|---|
| Export full backup | `.json` |
| Import backup | `.json` |
| Export project root | `.lmsroot` |
| Import tasks | `.lmstasks` |
| Export theme | `.json` |
| Export GDD | Text |

---

## License

This project is protected under a custom license.  
**You may use LMS freely for personal and team purposes.**  
You may **not** copy, modify, redistribute, or sell the source files.

See [`LICENSE`](./LICENSE) for full terms.  
© 2025 Jason K. Gonzales — All rights reserved.

---

## Contact & Support

📧 support@lmsdevhub.com

---

*LMS started as a planning tool for a game called Last Man Standing. It became something every indie dev can use.*
