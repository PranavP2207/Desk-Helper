# Developing DeskHelper

[Back to README](../README.md) · [Contributing](../.github/CONTRIBUTING.md)

## Prerequisites and setup

Use Windows, Git, and Node.js 24 with npm. Versions and dependencies are pinned in package.json/package-lock.json; `npm ci` reproduces that dependency graph. No account, API key, database server, Rust compiler, or environment file is required.

```powershell
git clone https://github.com/PranavP2207/Desk-Helper.git
cd Desk-Helper
npm ci
npm run dev
```

Electron's runtime is downloaded during dependency installation. Main-process changes require restarting the development command. Vite binds to `127.0.0.1:5173`; the browser alone cannot use native clipboard/tray features.

## Commands

| Command | Purpose |
| --- | --- |
| npm run dev | Compile the main process, start Vite, and launch Electron |
| npm run build | Strict type checks, renderer bundle, main-process compilation, preload copy |
| npm start | Production build, then launch from this checkout |
| npm test | Logic/storage/image/geometry regression checks |
| npm run check | Logic tests, strict types, and production build |
| npm run test:desktop | Build and run seven isolated native Electron scenarios |
| node scripts/smoke-desktop.mjs | Normal-mode startup/global-shortcut check with a paused, isolated shelf |
| Start DeskHelper.cmd | Launch an existing build without recompiling |

Normal launchers explicitly clear `ELECTRON_RUN_AS_NODE`, which some coding environments set. Prefer these launchers over directly executing the Electron binary.

## Source layout

| Folder | Responsibility |
| --- | --- |
| .github/ | Community guidance/templates and Windows CI |
| core/ | Model/schema validation, atomic shelf storage, clipboard change detection, cleanup, image lifecycle, and geometry |
| docs/ | Public usage/development material, original ideas, and reviewed demo images |
| electron/ | Native windows/tray/shortcuts, clipboard boundary, protocol, notifications, and narrow preload bridge |
| scripts/ | Development/build/start/smoke helpers |
| src/ | React corner pocket, optional library, and styles |
| tests/ | Node logic/storage tests and Playwright desktop scenarios |

Keep privileged behavior in the main process. Production renderer isolation uses sandboxing, disabled Node integration, blocked navigation/new windows/permissions, and exact caller/frame validation for IPC. The app protocol serves bundled content and validated app-owned image IDs. Development-only CSP allowances support Vite and are absent from production builds.

The root current-state.md, decisions.md, instructions.md, and known-issues.md files remain the canonical project context. Refresh affected files when requirements, decisions, behavior, or validation change. Brainstorming in docs/brainstorm.md is historical, not an implementation mandate.

## Tests and CI

`npm run check` exercises persistence/reload, migration backups, expiration boundaries, pins, concurrency, failed-write recovery, malformed data preservation, task/queue references, overdue reminders, deleted-item recovery, cleanup outputs, clipboard pause/deduplication/races, PNG lifecycle, and corner/cursor geometry.

Desktop tests launch real Electron windows on an interactive Windows desktop with a **private ClipboardItem-backed clipboard** and generated PNG images. They use unique fixture directories under `.local-data/desktop-tests`. They must never read/write the OS clipboard or capture personal desktop content.

GUI coverage includes hover/focus/collapse, draft protection, shared library, task pockets, queue reorder/advancement, failed-copy preservation, cleanup, reminders, recovery/restart, placement, native file-drag handoff, and renderer isolation. Native receiving-app drag/drop and actual Windows toast delivery remain integration checks.

The GitHub **Checks** workflow runs `npm ci` and `npm run check` on Windows/Node 24 for main pushes and pull requests. GUI tests are intentionally local because they need an interactive desktop. GitHub Actions are pinned to immutable upstream commits with read-only repository permissions.

## Local and generated files

`.local-data/` contains user data and isolated test fixtures. `.cache/`, node_modules/, dist/, dist-electron/, artifacts/, test-results/, and playwright-report/ are local/generated. None belong in commits. Do not add clipboard history, data backups, environment values, credentials, or personal screenshots to issues or pull requests.

Documentation previews under docs/images/ are deliberately selected, reviewed demo images. Regenerating test screenshots does not automatically replace those public assets.

An unpackaged app can set DESKHELPER_DATA_DIR to an isolated absolute data directory. Packaged builds ignore that override. There is no installer or packaged release pipeline yet.
