# LMS // Dev Hub — Developer Reference

> Quick guide to the refactored codebase. Every JS file maps to something
> you can actually see and click in the app. Use this to know exactly where
> to go when you need to change something.

---

## Folder Structure

```
lms-dev/
├── index.html                    ← Main entry point (~750 lines, was 9,444)
├── README.md
│
├── css/
│   ├── themes.css                ← All theme CSS variables
│   └── main.css                  ← Animations, layout, components
│
└── js/                           ← Loaded in order — DO NOT reorder
    ├── config.js
    ├── settings.js
    ├── roots.js
    ├── updates.js
    ├── export.js
    ├── phases.js
    ├── nav.js
    ├── analytics.js
    ├── scene.js
    ├── gdd.js
    ├── assets.js
    ├── bugs.js
    ├── supabase.js
    ├── account.js
    ├── ratelimit.js
    ├── db-adapter.js
    ├── server-hub.js
    ├── server-project-editor.js
    ├── server-root.js
    ├── sql-panel.js
    └── init.js                   ← Always last
```

---

## CSS Files

### `css/themes.css`
All the CSS variable definitions for every theme the app ships with.

Contains the `:root` block (default **Obsidian** theme) plus one `[data-theme="..."]`
block for every other theme: Slate, Midnight, Abyss, Forest, Ember, Void, Steel,
Matrix, Sakura, Solar, Nord, Dracula (dark), Parchment, Chalk, Linen, Arctic (light),
and YouTube, Discord, Twitter, SpaceX (brand).

**Edit this file if you want to:**
- Change a colour in an existing theme (find the `[data-theme]` block, tweak the var)
- Add a brand new theme (copy any existing block, change the id and colours)
- Change the default Obsidian colours (edit the `:root` block)

### `css/main.css`
Everything that isn't a CSS variable: keyframe animations, base resets, layout rules,
sidebar, nav, cards, buttons, form inputs, phase cards, modals, and all other component
styles.

**Edit this file if you want to:**
- Adjust spacing, font sizes, or component look
- Add new component CSS for a feature you're building
- Change the sidebar width default or animation timings

---

## JS Files

> Scripts are loaded synchronously at the bottom of `index.html`.
> Order matters — each file can use globals defined by files before it.

---

### `js/config.js` — Constants & Global State
**~50 lines**

Defines every `localStorage` key the app uses and the initial global state variables.

| Constant / Variable | What it is |
|---|---|
| `ROOT_SK` | Key for the project list (`lms_roots_v2`) |
| `SETTINGS_SK` | Key for user settings (`lms_settings_v1`) |
| `SAVED_THEMES_SK` | Key for saved custom themes |
| `roots` | Array of all local projects shown on the home screen |
| `activeRootId` | ID of whichever project is currently open in the editor |
| `D` | The active project's full data object (tasks, notes, scripts, etc.) |
| `SETTINGS` | The user's current preferences (theme, font, sidebar, etc.) |
| `THEME_DEFS` | The swatch data for the theme picker grid (labels, preview colours) |
| `ACCENT_COLORS` | The 8 accent colour presets shown as dots in Settings |
| `PHASE_COLORS` | The 6 colours available when creating a new phase |

**Edit this file if you want to:**
- Add a new `localStorage` key (define it here so it's easy to find)
- Add a new global flag used across multiple files
- Add a new theme to the theme picker swatch grid (add to `THEME_DEFS`)

---

### `js/settings.js` — Settings, Theme Picker, Custom Theme Builder
**~350 lines**

Powers the entire **Settings** page (the gear icon in the sidebar).

**What you can see on screen that lives here:**

- **Theme grid** — the swatch cards for Obsidian, Slate, Midnight, etc. Clicking one
  calls `setTheme()`.
- **Light / Brand tabs** in the theme grid — same render function, different data.
- **Accent colour picker** — the colour dot row + hex input that overrides just
  `--accent` without changing the whole theme. Calls `setAccent()`.
- **Scanlines toggle** — the CRT scanline overlay switch. Calls `toggleScanlines()`.
- **Compact sidebar toggle** — squishes the sidebar to 170 px. Calls `toggleCompact()`.
- **Font selector** — Mono / VT323 / System buttons. Calls `setFont()`.
- **Custom Theme Builder** — the full colour picker grid (bg, text, accent rows) with
  live preview card. `previewCustomTheme()`, `applyCustomTheme()`, `saveCustomTheme()`.
- **Saved Custom Themes** — the list of named custom themes you've saved with a
  "Load" button. `loadSavedThemesFromStorage()`, `renderSavedThemes()`.
- **Palette Importer** — the drag-or-click area that accepts a `.json` colour palette
  file and auto-fills the custom theme pickers. `handlePaletteFile()`.

**Key functions:**

```
loadSettings()      — reads localStorage and applies everything on page load
saveSettings()      — writes SETTINGS back to localStorage
applySettings()     — pushes SETTINGS onto the DOM (data-theme, CSS vars, etc.)
renderThemeGrid()   — builds the clickable theme swatch cards
```

---

### `js/roots.js` — Project Management (Home Screen)
**~550 lines**

Everything related to **local projects** — the cards you see on the home screen
when you first log in.

**What you can see on screen:**

- **Project cards grid** — each card shows project name, engine, genre, a progress
  ring, and colour accent. Created by `renderRootGrid()`.
- **"New Project" button** (+ card) — opens the create modal. `openCreateRoot()`.
- **Project colour picker, engine, genre** fields — saved to `roots[]`.
- **"Open" button on a card** — calls `openRoot(id)` which loads that project's data
  into `D` and switches to the editor shell.
- **Progress ring** — calculated by `calcProgress()` from task completion counts.
- **Sidebar server list** — the server slots shown on the home screen sidebar when
  you're connected to a server. `renderServerSidebar()`.

**Key functions:**

```
loadRoots()         — reads roots[] from localStorage
saveRoots()         — writes roots[] back to localStorage
getRootData(id)     — loads a project's full data object from lms_proj_<id>
saveRootData(id,d)  — saves a project's full data object
newProjectData()    — returns a blank project data template with all keys
renderRootGrid()    — renders all project cards on the home screen
openRoot(id)        — activates a project and switches to the editor
save()              — saves D (active project data) back to localStorage
```

---

### `js/updates.js` — Site Updates Panel
**~535 lines**

The **"Updates"** button in the top-left of the home screen (the tag icon with a
dot indicator). Clicking it drops down a panel showing changelogs.

Updates are fetched from the **config Supabase project** (`CFG_URL` / `CFG_KEY`
in `supabase.js`) — specifically the `site_updates` table. This means you publish
new updates just by inserting a row in that table. Users see them automatically
without any code changes.

**What you can see on screen:**

- **Updates button** with animated dot when new content exists
- **Dropdown panel** with dated entries, version tags, and descriptions
- **"New" badges** on entries the user hasn't dismissed
- **Timer tick** counting up on the most recent update

**Key functions:**

```
toggleSiteUpdates()   — opens/closes the panel
fetchSiteUpdates()    — hits CFG_URL/rest/v1/site_updates and renders results
renderSiteUpdates()   — builds the list of update entries in the panel
markUpdatesRead()     — records dismissed update IDs to localStorage
```

---

### `js/export.js` — Export / Import / Community
**~450 lines**

The export and import system for moving project data in and out as `.lmsroot` files.

**What you can see on screen:**

- **Export button** on each project card (downloads a `.lmsroot` JSON file).
  `exportRoot(id)`.
- **Import button** on the home screen — accepts a `.lmsroot` file drag or click.
- **Import modal** — the dialog that appears asking whether to **Overwrite** or
  **Append** when importing into an existing project. `showImportModal()`.
- **Import into existing project** picker — lets you choose which local project to
  merge into. `openImportToProjectPicker()`.
- **Community button** — opens a modal with a placeholder for the community hub.
  `openCommunity()`.
- **Server project export** — "Export" button inside a server project. `exportServerRoot()`.

**Key functions:**

```
exportRoot(id)              — downloads local project as .lmsroot
exportServerRoot(projId)    — fetches server project data then downloads it
importRoot(blob)            — handles the parsed .lmsroot object
showImportModal()           — the overwrite/append choice dialog
openImportToProjectPicker() — lets user pick which local project to import into
```

---

### `js/phases.js` — Development Phases & Custom Sections
**~120 lines**

The checkbox task system on the **Main Phases** and **Sub Phases** pages.

**What you can see on screen:**

- **Phase cards** — coloured header cards with a list of checkboxes (e.g. "Pre-production",
  "Core Gameplay Loop"). Clicking a checkbox marks the task done. `buildPhaseCard()`.
- **Progress counter** on each card (e.g. "3/7").
- **Add custom task** button at the bottom of each phase card.
- **Remove task** × button on individual tasks.
- **Completion sound** — a short tone plays when a task is checked (if enabled in settings).
- **Custom sections** — the user-created pages that appear below the built-in pages in
  the sidebar. Each has subsections with content blocks (textarea, checklist, links, etc.).

**Key functions:**

```
getPhases()           — returns {main, sub} phase arrays for the active project
mkCheckbox()          — builds a single animated checkbox element
buildPhaseCard()      — builds a full phase card with all its tasks
renderMainPhases()    — renders the Main Phases page
renderSubPhases()     — renders the Sub Phases page
```

---

### `js/nav.js` — Navigation, Script Vault, Versions, Notes, Modal, Misc
**~200 lines**

The sidebar navigation system plus several smaller features that don't warrant their
own file.

**What you can see on screen:**

- **Sidebar nav items** — Dashboard, Main Phases, Sub Phases, Script Vault, Versions,
  Settings, Analytics, Scene Tree, GDD, Assets, Bugs, and any custom section pages.
  `nav(page)` switches between them.
- **Script Vault page** — folder list on the left, script editor on the right.
  `renderVault()`, `selectFolder()`, `openScript()`, `saveScript()`.
- **Versions page** — list of version entries (v0.1, v0.2…) with notes and dates.
  `renderVersions()`, `addVersion()`.
- **Survivors / Characters panel** — the character tracker block in the sidebar.
  `renderSurvivors()`.
- **Notes & Lore** — the notes list with inline editing. `renderNotes()`.
- **Activity Log** — the timeline of recent actions shown in the dashboard. `renderActivity()`.
- **Modal system** — `openModal(title, html)` / `closeModal()`. Every confirmation
  dialog and form popup in the app goes through this.
- **Toast notifications** — `toast(msg)`. The small pop-up banner at the bottom.

**Key functions:**

```
nav(page)           — switches the visible page in the editor shell
openModal(t, html)  — renders content into the shared modal overlay
closeModal()        — closes it
toast(msg)          — shows a brief notification banner
escHtml(str)        — HTML-escapes a string (used everywhere)
downloadFile()      — triggers a file download in the browser
```

---

### `js/analytics.js` — Dev Time Tracker
**~140 lines**

The **Dev Time Tracker** page (clock icon in the sidebar).

**What you can see on screen:**

- **Big timer display** — shows 00:00:00, goes green and counting when running.
- **Start / Stop Session button** — `timerToggle()`. Sessions under 10 seconds are
  discarded.
- **Session log table** — all past sessions for this project with date, duration, and
  who logged it. `renderAnalytics()`.
- **Total time** summary row at the top of the table.
- **Log Session manually** button — lets you record a duration without using the timer.
- **Clear sessions** button.
- **Horizontal bar chart** — shows time per day over the last 7 days.

**Key functions:**

```
timerToggle()       — starts or stops the live timer
renderAnalytics()   — draws the session log table and bar chart
speRenderAnalytics()— same thing but for the server project editor version
```

---

### `js/scene.js` — Scene Tree (Godot-style)
**~490 lines**

The **Scene Tree** page — a Godot-inspired node hierarchy editor for planning your
game scenes.

**What you can see on screen:**

- **Scene file list** (left panel) — scenes listed as "files" with folder grouping.
  `renderSceneFileTree()`.
- **Node tree** (centre panel) — the expandable tree of nodes in the selected scene
  (Node2D, Sprite2D, CharacterBody2D, etc.). `renderNodeTree()`.
- **Inspector** (right panel) — when a node is selected, shows its name, type, and
  editable properties. `renderInspector()`.
- **New Scene modal** — `speNewSceneModal()` / `newSceneModal()`.
- **Add Node modal** — dropdown of all supported node types. `speAddNodeModal()`.
- **Node types supported:** Node2D, Sprite2D, AnimatedSprite2D, StaticBody2D,
  RigidBody2D, CharacterBody2D, Area2D, CollisionShape2D, Label, Button, Panel,
  HBoxContainer, VBoxContainer, Camera2D, AudioStreamPlayer, AnimationPlayer, Timer,
  TileMapLayer, CanvasLayer, ParallaxBackground, and more.

**Key functions:**

```
renderSceneTree()       — draws the full scene tree page
renderSceneFileTree()   — draws the left file panel
renderNodeTree()        — draws the node hierarchy in the centre
selectScene(id)         — activates a scene and re-renders
selectNode(id)          — activates a node and shows its inspector
saveNode(nodeId)        — saves node property edits back to D
```

---

### `js/gdd.js` — Game Design Doc
**~45 lines**

The **GDD** page — a simple structured notes editor for your game design document.

**What you can see on screen:**

- **Section cards** — each one has an editable title and a large freeform textarea.
  Sections auto-save as you type.
- **Add Section button** — appends a blank section.
- **Generate Default Sections button** (shown when GDD is empty) — pre-fills 8
  standard GDD headings: Game Concept, Core Mechanics, Player Experience, Art Direction,
  Audio Design, Level Design, Progression System, Technical Notes.
- **Export GDD button** — downloads the content as a `.txt` file.
- **Delete section** × button.

**Key functions:**

```
renderGDD()         — draws all GDD sections
addGDDSection()     — appends a new blank section
deleteGDDSection(i) — removes a section by index
exportGDD()         — downloads content as plain text
```

---

### `js/assets.js` — Asset Tracker
**~55 lines**

The **Asset Tracker** page — for tracking the production status of your game's assets.

**What you can see on screen:**

- **Asset cards grid** — each card shows asset name, type badge (Sprite, Audio, 3D Model,
  VFX/Shader, Animation, UI, Tileset, Font), status pill, and notes.
- **Status cycling** — Cycle Status button rotates through `todo → in-progress → done → todo`.
- **Type filter** dropdown — filter by asset type.
- **Status filter** dropdown — filter by todo / in-progress / done.
- **Add Asset modal** — name, type, status, notes fields.

**Key functions:**

```
renderAssets()      — draws the asset grid with active filters
openAddAsset()      — opens the add asset modal
cycleAssetStatus(i) — rotates through status values
deleteAsset(i)      — removes an asset
```

---

### `js/bugs.js` — Bug Tracker
**~150 lines**

The **Bug Tracker** page — for logging and tracking bugs during development.

**What you can see on screen:**

- **Bug cards** — each shows a `#001` ID, severity badge (CRITICAL / HIGH / MEDIUM / LOW)
  with matching colour, title, description, status pill (open / inprogress / resolved),
  report date, and associated scene name.
- **Severity colour coding:** Critical = red, High = orange, Medium = yellow, Low = blue.
- **Status cycling button** — "Mark In Progress" → "Mark Resolved" → "Reopen".
- **Severity filter** and **status filter** dropdowns.
- **Report Bug modal** — title, severity, description, scene fields.
- **Resolved bugs** are visually de-emphasised.

**Key functions:**

```
renderBugs()        — draws the bug list with active filters
openAddBug()        — opens the report bug modal
cycleBugStatus(i)   — advances the status
deleteBug(i)        — removes a bug
```

---

### `js/supabase.js` — Database Configuration
**~170 lines**

Manages the Supabase connection credentials and the **DB Setup modal**.

**What you can see on screen:**

- **"Setup DB" button** on the login screen (glows accent colour if no DB is configured).
- **Supabase Setup modal** — the form where users paste their Project URL and Anon Key
  to connect. Also shows the SQL schemas needed to initialise the database.
- **"Fetch SQL" / copy buttons** in the setup modal — pulls the latest schema SQL from
  the config project so users always get the correct, up-to-date setup scripts.
- **DB warning banner** on the login screen when no DB is configured.

Two credential contexts exist:
1. **Config project** (`CFG_URL` / `CFG_KEY`) — hardcoded, yours. Holds `site_updates`
   and `sql_scripts`. Never exposed to users.
2. **User's server DB** (`SRV_DB_URL` / `SRV_ANON_KEY`) — set by the user in the setup
   modal, stored in localStorage.

**Key functions:**

```
openSupabaseSetup()   — shows the DB setup modal
saveSupabaseUrl()     — validates and saves the URL + key to localStorage
clearSupabaseUrl()    — wipes the stored credentials
fetchSqlScripts()     — fetches the latest SQL from the config project
getSrvDbUrl()         — returns the user's configured DB URL
sbHeaders(extra)      — returns the auth headers for Supabase REST calls
_activeSrvCreds()     — returns {url, key} for the currently active server context
```

---

### `js/account.js` — Account System, Login, Email Verification
**~645 lines**

Handles everything to do with **user accounts**: signing up, signing in, email
verification, account settings, and password recovery.

**What you can see on screen:**

- **Login screen** — the first thing you see. Has "Sign In" and "Create Account" tabs.
  Username/password fields, a submit button. Calls `loginUser()` / `createAccount()`.
- **Password strength bar** — appears on the Create Account tab as you type. Shows
  a coloured fill bar and hint text.
- **"Forgot password?" link** — swaps the login panel for a forgot-password flow.
  `showForgotPassword()`.
- **Email verification panel** — after creating an account or resetting a password,
  a 6-digit code input appears. Code is sent via EmailJS. `sendEmailVerification()`,
  `verifyEmailCode()`.
- **Account chip** (top-left of home screen) — your avatar (initials), display name,
  and `@handle`. Clicking it opens the Account Settings modal.
- **Account Settings modal** — change display name, change password (with re-verification),
  view email. `openAccountSettings()`.
- **Sign Out** — wipes the local session.

**Key functions:**

```
loginUser()                 — authenticates against Supabase accounts table
createAccount()             — registers a new user (with email verification)
sendEmailVerification()     — generates a code, stores in DB, sends via EmailJS
verifyEmailCode()           — checks the entered code against the stored one
showForgotPassword()        — swaps login screen to the password reset flow
openAccountSettings()       — renders the account settings modal
updateAccountChip()         — refreshes the avatar/name in the top-left chip
logoutUser()                — clears session and reloads to login screen
```

---

### `js/ratelimit.js` — Rate Limiting
**~175 lines**

Client-side rate limiting stored in `localStorage`. Used to prevent login/account
creation/verification spam.

There is nothing visible here — it runs silently in the background whenever a
user tries to log in, create an account, send a verification email, or reset a
password.

**How it works:** Every attempt is timestamped. `checkRateLimit(key, max, days)` counts
how many attempts fall within the time window. If over the limit, it returns `allowed: false`
and `daysLeft` so the UI can show a message like "Too many attempts. Try again in 2 days."

**Key functions:**

```
checkRateLimit(key, max, days)  — returns {allowed, used, max, daysLeft}
bumpRateLimit(key, max, days)   — records a new attempt
clearRateLimit(key)             — resets the counter (used after successful action)
```

---

### `js/db-adapter.js` — Supabase REST Adapter
**~390 lines**

The translation layer between how JavaScript thinks about data (camelCase objects)
and how the Supabase database stores it (snake_case columns).

**Nothing in here is visible on screen** — it's pure data plumbing. Every database
read/write in the app goes through these functions.

The adapter handles four DB tables:

| Table | JS model | Translator functions |
|---|---|---|
| `servers` | `{key, name, passHash, hostId, shortId, ...}` | `_serverToDb()` / `_serverFromDb()` |
| `members` | `{uid, serverKey, name, isHost, lastSeen, ...}` | `_memberToDb()` / `_memberFromDb()` |
| `projects` | `{id, serverKey, name, engine, data, ...}` | `_projectToDb()` / `_projectFromDb()` |
| `chat` | `{id, serverKey, projId, sender, text, ts}` | `_chatToDb()` / `_chatFromDb()` |

**Path system:** The app uses Firebase-style paths like `/servers/KEY/members/UID`. The
`_pathToSupabase(path)` function parses these paths and translates them into the correct
Supabase REST endpoint + query params.

**Key functions:**

```
fbGet(path)         — reads one or many rows from Supabase
fbSet(path, data)   — upserts (insert or update) a row
fbPatch(path, data) — partial update (PATCH) on an existing row
fbPush(path, data)  — inserts a new row, returns the generated ID
fbDelete(path)      — deletes a row
```

---

### `js/server-hub.js` — Server Hub: Join, Host, Projects
**~1,030 lines**

The **Server Hub** modal — the multiplayer layer. This is the big overlay that
appears when you click the "Server Hub" or plug icon on the home screen.

**What you can see on screen:**

- **Server Hub overlay** — full-screen modal with Host / Join / My Servers tabs.
- **Host tab** — fields for server name, password, visibility (public/private/invite-only),
  description, tags. Clicking Host creates a new server record in Supabase.
  `hostServer()`.
- **Join tab** — server name + password fields, or paste an invite code. Invite codes
  are decoded from the `LMXv1...` scrambled format. `joinServer()`.
- **My Servers tab** — lists servers the user has created or recently joined, with
  quick-connect buttons and status indicators (online members count, your role).
  `loadCreatedServers()`, `renderSrvStatus()`.
- **Join by Server ID** — the short `XK9-4TM` style ID lookup. `joinServerById()`.
- **Active server sidebar** (shown when connected) — server name, member presence dots,
  list of server projects. `renderActiveServer()`.
- **Server project list** — cards for each project on the connected server.
  `renderSrvProjectsList()`.
- **Create Server Project** button — `openCreateServerProject()`.
- **Disconnect button** — `disconnectServer()`.
- **Change server password** (host only) — `promptChangeServerPassword()`.
- **Delete server** (host only) — `confirmDeleteServer()`.
- **Invite link** — "Copy Invite Link" button generates the encoded `LMXv1...` string
  that auto-fills another user's Join form. `copyServerInvite()`.
- **Heartbeat** — a background interval that pings the member's `last_seen` to Supabase
  every 30 seconds so presence dots stay accurate. `startSrvHeartbeat()`.

**Key functions:**

```
hostServer()                — creates server in DB, connects host
joinServer()                — looks up server by name, verifies password hash, joins
joinServerById()            — looks up server by short ID (XK9-4TM format)
disconnectServer()          — removes member record, clears srvState
renderActiveServer()        — draws the connected-server sidebar
renderSrvProjectsList()     — draws the project cards for the active server
lmsEncodeInvite()           — encodes URL+key+name into LMXv1 scrambled string
lmsDecodeInvite()           — decodes the invite string back to {url, key, name}
startSrvHeartbeat()         — kicks off the 30s presence ping loop
```

---

### `js/server-project-editor.js` — Server Project Editor (SPE)
**~1,070 lines**

When you open a project while connected to a server, the app switches into the
**Server Project Editor** (SPE). This is basically the same editor as the local version
but data reads/writes go to Supabase instead of `localStorage`.

**What you can see on screen (all the same pages as solo, but live/synced):**

- **Dashboard** — task summary, activity feed, online members. `renderSpeDash()`.
- **Main Phases** — same phase cards as solo. `speRenderMainPhases()`.
- **Sub Phases** — `speRenderSubPhases()`.
- **Script Vault** — `speRenderVault()`. Scripts are stored in the server project's data.
- **Versions** — `speRenderVersions()`.
- **Analytics** — session timer and log, synced to server. `speRenderAnalytics()`.
- **Scene Tree** — `speRenderSceneTree()`.
- **GDD** — `speRenderGDD()`.
- **Assets** — `speRenderAssets()`.
- **Bugs** — `speRenderBugs()`.
- **Team Chat** — a real-time chat panel (polls every few seconds). `renderSpeChat()`,
  `sendSrvMsg()`.
- **LIVE badge** — shown in the top-left of the editor when in server mode.
- **Presence activity feed** — shows who's online and what they're doing (e.g.
  "Alex is on Dashboard"). `renderSpeActivityFeed()`.
- **Sync** — every save broadcasts to Supabase. `syncProjData()` polls for remote
  changes and re-renders if something changed.

**Key functions:**

```
openSrvProject(projId)      — loads project from Supabase into D, shows editor
speNav(page)                — switches pages inside the server project editor
syncProjData()              — polls Supabase for changes, re-renders if needed
srvBroadcastActivity(act)   — writes current user's activity to the members table
renderSpeChat()             — loads and renders team chat messages
sendSrvMsg()                — posts a chat message to Supabase
closeSrvProjEditor()        — exits back to the home screen
```

---

### `js/server-root.js` — Home Screen Server Sections
**~415 lines**

The server-related sections rendered **on the home screen** (not inside the hub
overlay or the project editor).

**What you can see on screen:**

- **"My Servers" section** — the grid of server cards shown below the local projects
  on the home screen when you've connected to servers before. Each card shows server
  name, your role (Host / Member), member count, and a Quick Connect button.
  `renderRootMyServers()`.
- **Quick Connect** — connects to a remembered server without opening the full hub.
  `rsQuickConnectServer()`.
- **Server projects section** — when connected, the home screen shows that server's
  projects in their own section. `renderRootServerProjects()`.
- **Recent servers list** — the last 5 servers joined, shown in the Join tab of the
  hub. `loadRecentServers()`.
- **Multi-server support** — up to 3 server connections simultaneously. The server
  slot bar (pip indicators) and server switcher live here. `loadMultiServers()`,
  `switchActiveServer()`.

**Key functions:**

```
renderRootMyServers()       — draws the "My Servers" grid on the home screen
renderRootServerProjects()  — draws connected server's projects on the home screen
rsQuickConnectServer()      — one-click reconnect to a known server
saveRecentServer()          — records a server to the recent list
loadCreatedServers()        — loads servers the user has hosted, verifies they exist
loadMultiServers()          — restores up to 3 server connections from localStorage
switchActiveServer()        — makes a different connected server the "active" one
```

---

### `js/sql-panel.js` — SQL Schema Setup UI
**~75 lines**

The two-tab SQL panel inside the **DB Setup modal** (accessible from the login
screen's Setup DB button or from Settings → Data).

**What you can see on screen:**

- **"Fresh Install" tab** — shows the full `CREATE TABLE` SQL for a brand new Supabase
  project. Copy button copies it to clipboard.
- **"Update Existing" tab** — shows the `ALTER TABLE` / migration SQL for users
  upgrading from an older schema.
- SQL is fetched live from the config project by `supabase.js` so it's always current.

**Key functions:**

```
switchSqlTab(tab)   — toggles between Fresh / Update tabs
renderSqlPanels()   — populates the code blocks with fetched SQL
copySql(which)      — copies the relevant SQL to clipboard
```

---

### `js/init.js` — App Initialisation *(must be loaded last)*
**~95 lines**

The boot sequence. This is the only file that runs code at the top level on page
load (everything else just defines functions).

**What happens on boot:**

1. `loadSettings()` — applies saved theme/font/etc.
2. `loadRoots()` — loads the project list from localStorage.
3. Checks `lms_session` in localStorage for a saved login.
4. If session exists: verifies it against Supabase (if a DB is configured), refreshes
   the display name, then shows the home screen.
5. If no session: shows the login screen. If no DB is configured, automatically
   opens the Setup DB modal.
6. Attempts to restore any active server connection from the previous session.
7. Loads multi-server state.

Also defines a handful of pure utility functions used across many files:

```
hashStr(str)            — deterministic hash of a string → short alphanumeric key
                          (used to derive a stable server key from a server name)
genServerId()           — generates a random XK9-4TM style short server ID
findServerByShortId()   — looks up a server key from its short ID in Supabase
hashPass(pass)          — SHA-256 hashes a password string (async, Web Crypto API)
```

---

## localStorage Keys Reference

| Key | File | What it stores |
|---|---|---|
| `lms_roots_v2` | config.js | Array of all local project metadata objects |
| `lms_proj_<id>` | roots.js | Full data object for a single project (tasks, notes, etc.) |
| `lms_settings_v1` | settings.js | User preferences (theme, font, accent, etc.) |
| `lms_saved_themes_v1` | settings.js | Array of saved custom themes |
| `lms_session` | account.js | The logged-in user object (uid, username, email) |
| `lms_db_url` | supabase.js | The user's Supabase project URL |
| `lms_anon_key` | supabase.js | The user's Supabase anon key |
| `lms_recent_servers` | server-root.js | Last 5 servers joined (name, pass, URL) |
| `lms_created_servers` | server-root.js | Servers the user has hosted |
| `lms_active_server` | init.js | The last connected server (for session restore) |
| `lms_rl_<key>` | ratelimit.js | Rate limit attempt timestamps for login/auth actions |
| `lms_multi_servers` | server-root.js | Up to 3 simultaneous server connections |

---

## Supabase Tables Reference

These are the tables your Supabase project needs (SQL is in the Setup DB modal):

| Table | Used by | What it holds |
|---|---|---|
| `accounts` | account.js | User records: uid, username, displayName, email, passHash |
| `emailCodes` | account.js | 6-digit verification codes with expiry timestamps |
| `servers` | server-hub.js | Server records: name, passHash, hostId, visibility, tags |
| `members` | server-hub.js | Per-server member presence: uid, lastSeen, activity, isHost |
| `projects` | server-hub.js | Server project records with full data JSONB blob |
| `chat` | server-project-editor.js | Chat messages: sender, text, timestamp, serverKey, projId |
| `serverIds` | init.js | Maps short IDs (XK9-4TM) → full server keys |
| `site_updates` | updates.js | Changelog entries shown in the updates panel (config project) |
| `sql_scripts` | supabase.js | The setup SQL shown in the DB modal (config project) |

---

## JS Load Order (from index.html)

```
1.  config.js                  — globals & constants (no deps)
2.  settings.js                — needs SETTINGS, THEME_DEFS from config
3.  roots.js                   — needs ROOT_SK, roots, D from config
4.  updates.js                 — needs CFG_URL/CFG_KEY from supabase
5.  export.js                  — needs roots, D, fbGet from db-adapter
6.  phases.js                  — needs D, save from roots
7.  nav.js                     — needs D, all page render functions
8.  analytics.js               — needs D, save, currentUser
9.  scene.js                   — needs D, save, openModal
10. gdd.js                     — needs D, save
11. assets.js                  — needs D, save
12. bugs.js                    — needs D, save
13. supabase.js                — needs localStorage only (no prior JS deps)
14. account.js                 — needs fbGet/fbSet from db-adapter, emailjs
15. ratelimit.js               — needs localStorage only (no prior JS deps)
16. db-adapter.js              — needs SRV_DB_URL, SRV_ANON_KEY from supabase
17. server-hub.js              — needs fbGet/fbSet, account, roots, supabase
18. server-project-editor.js   — needs srvState from server-hub, all page renderers
19. server-root.js             — needs srvState, fbGet, roots
20. sql-panel.js               — needs _cfgSql from supabase
21. init.js                    — runs the boot sequence using everything above
```

> ⚠️ **Do not add `defer` to these script tags.** The files use synchronous globals
> and must run in order. `init.js` must always be last.
