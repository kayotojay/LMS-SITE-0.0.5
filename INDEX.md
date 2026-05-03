# LMS DEV HUB — AI FILE INDEX
# Read this first. Then read ONLY the file(s) needed. Never read the full zip.

## CSS
themes.css      — all theme CSS vars (add/edit themes, colours)
main.css        — layout, components, animations, sidebar, cards, buttons

## JS (load order matters, never reorder)
config.js       — global constants, localStorage keys, THEME_DEFS, ACCENT_COLORS
settings.js     — Settings page: theme grid, accent picker, scanlines, compact, font, custom theme builder, palette importer
roots.js        — home screen project cards, create/open/delete project, progress ring, save(), renderRootGrid()
updates.js      — Updates panel (top-left bell), fetches from config Supabase project site_updates table
export.js       — export/import .lmsroot files, overwrite/append modal, community modal
phases.js       — Main Phases + Sub Phases pages: checkbox cards, task add/remove, completion sound
nav.js          — sidebar nav(), modal system openModal/closeModal, toast(), Script Vault, Versions, Notes, Activity Log
analytics.js    — Dev Time Tracker page: timer, session log table, bar chart
scene.js        — Scene Tree page: file list, node tree, inspector, node types, new scene/node modals
gdd.js          — GDD page: section cards, auto-save textareas, export, default sections
assets.js       — Asset Tracker page: cards, type/status filters, cycle status, add modal
bugs.js         — Bug Tracker page: cards, severity colours, status cycling, report modal
supabase.js     — DB Setup modal, Supabase credentials (SRV_DB_URL/SRV_ANON_KEY), CFG_URL/CFG_KEY hardcoded, sbHeaders()
account.js      — login screen, signup, email verification (EmailJS), account chip, account settings modal, forgot password
ratelimit.js    — silent rate limiting via localStorage, checkRateLimit(), bumpRateLimit()
db-adapter.js   — ALL Supabase reads/writes: fbGet/fbSet/fbPatch/fbPush/fbDelete, camelCase<->snake_case translation
server-hub.js   — Server Hub overlay: host, join, invite encode/decode (LMXv1), heartbeat, project list, disconnect
server-project-editor.js — Server Project Editor: all SPE pages (dash/phases/vault/chat/analytics/scene/gdd/assets/bugs), syncProjData(), LIVE badge
server-root.js  — home screen server sections: My Servers grid, Quick Connect, multi-server slots, recent servers
sql-panel.js    — SQL schema tabs (Fresh Install / Update Existing) inside DB Setup modal
init.js         — boot sequence ONLY, runs last: loadSettings, loadRoots, session restore, hashPass, hashStr, genServerId

## Supabase Tables
accounts / emailCodes           — account.js
servers / members / projects    — server-hub.js + db-adapter.js
chat                            — server-project-editor.js
serverIds                       — init.js
site_updates / sql_scripts      — updates.js / supabase.js (config project, not user DB)

## Rules
- Return ONLY changed file(s), never the full zip
- D = active project data object (lives in roots.js / RAM)
- save() = saves D to localStorage (defined in roots.js)
- srvState = active server connection state (defined in server-hub.js)
- All DB calls go through db-adapter.js fbGet/fbSet etc
