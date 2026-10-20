# Current state: DeskHelper

Last updated: 2026-10-20

## Scope and implemented behavior

- Version 0.3: Windows corner pocket remains the primary interface, with a floating dot, hover expansion without focus, explicit keyboard interaction, draft protection, delayed collapse, keep-open mode, tray fallback, and saved monitor/corner. Library is optional.
- Automatic clipboard history now collects supported text/images while running, with a persisted Pause/Resume control, duplicate detection, and suppression of app-originated copies. Built-in screen capture and its overlay/API were removed. Print Screen/Snipping Tool images arrive through the clipboard.
- All eight selected utilities are implemented: copy-and-tuck; native image-file drag; persistent reorderable paste queue; task pockets; item reminders; cleanup preview/copy/save; seven-day Recently deleted; cursor summon and return to saved corner.
- Item Details owns pinning, assignment, reminders, and cleanup. Queue copies one value and advances only after a successful clipboard write; it never injects paste keystrokes. Expiration is permanent; manual deletion is recoverable. Deleting a pocket unassigns its items.
- Version-two validated shelf stores all state. First changed write of a version-one shelf makes a non-overwriting .v1-backup. PNG files remain referenced while in trash; native drags lease files briefly during cleanup.
- Reminders preserve pending content even through a long closed period. Delivery marks them once, refreshes temporary retention, and resurfaces them on the dot/banner; Windows notifications request attention while running.
- App data remains local with no accounts, telemetry, or content upload. Source publication to the user-specified GitHub repository is now authorized; repository preparation is in progress. No installer/release exists.

## Verified evidence

- 2026-10-19: `npm run check` passed all 31 logic/storage/image/geometry checks, strict renderer/main TypeScript, and the production build.
- 2026-10-20 publication preparation: `npm run check` again passed all 31 checks, strict types, and the build. Reviewed/staged 55 source/documentation/config files (about 364 KB including a 44 KB synthetic preview); 30 relative documentation links resolved, the staged secret-pattern/path scan found no credential or private/generated files, and `git diff --cached --check` passed. App behavior was unchanged, so the seven-scenario GUI suite was not repeated for this documentation/metadata-only preparation.
- Final version-0.3 native pass: `npx playwright test` passed all seven Electron scenarios. Coverage includes automatic text/image arrival without capture buttons, pause persistence, own-copy suppression, image preview/native file handoff, hover/focus/collapse, drafts, shared library, pin/search, queue reorder/copy advancement, task assignment, cleanup, due reminders, recovery across restart, saved placement, cursor summon, corrupt-file preservation, and renderer isolation. The seventh scenario verifies a failed image copy reports its error and leaves the next queue entry intact.
- Normal-mode smoke passed: version 0.3.0, one native window, expandedAtStartup=false, all three global shortcuts registered. The isolated smoke shelf had monitoring=false throughout, so it did not read the actual clipboard.
- Normal app is running through `node scripts/start.mjs` against the existing user shelf; confirmed process 3700, version-two data, monitoring=true, and both pre-update/migration backups present. No saved content was displayed by the verification. A direct PowerShell launch retained Electron's Node-mode behavior; the documented Node launcher clears that flag and started successfully.
- Migration tests compare the backup to the exact original file. Storage tests cover reload, expiration boundaries, old pinned-item re-copy, overdue reminders after four days, trash expiry, pocket reference integrity, concurrent saves, failed commits/recovery, malformed data preservation, and independent cleanup expected values.
- Tests use private clipboard contents/generated images and unique fixture directories; they never read/write the OS clipboard or screenshot the personal desktop. Native drag checks intercept only the OS handoff boundary; receiving-app compatibility remains a manual integration check.
- Visually reviewed current artifacts/corner-dot.png, corner-populated.png, corner-images.png, and saved-desktop.png. Full detail/queue/recovery flows pass native interaction checks.
- Earlier version-0.2 milestone passed 19 unit checks, five native scenarios, and a dot-only normal-mode/hotkey smoke; that version’s built-in screenshot capability is now intentionally removed.

## Sources and environment

- Stack: Electron 44.9.0, React 19.3.1, TypeScript 7.0.2, Vite 8.3.4. Node 24.19.0/npm 11.17.0 available. Rust/cargo absent; no new dependencies needed for 0.3.
- Core: model.ts, store.ts, images.ts, widget.ts, clipboard-watcher.ts, cleanup.ts. Native: electron/main.ts, clipboard.ts, preload.cjs. UI: src/Widget.tsx, App.tsx, widget.css, styles.css.
- Checkout data: .local-data/user/shelf.json, images/, widget.json. All normal launch methods use this same location. Fixtures are isolated beneath .local-data/unit and .local-data/desktop-tests.
- Commands: npm install; npm start; npm run dev; npm run check; npm run test:desktop. Start DeskHelper.cmd launches the built checkout. scripts/smoke-desktop.mjs checks normal-mode startup with an isolated paused shelf.
- Canonical context: the four root Markdown files. D-006–D-008 record the newly accepted behavior; earlier decisions preserve its history.

## Work in progress / next action

0. Source and community documentation are prepared for the first push to PranavP2207/Desk-Helper (confirmed empty/public). Logical source folders remain in place; user documentation/previews are in docs/ and community guidance/templates/Windows CI in .github/. Root context is retained. User explicitly chose no license; metadata says UNLICENSED. Next: commit/push main without force, verify the remote commit and hosted CI, then record publication evidence.
1. Try the running version-0.3 dot: copy text or a Print Screen image, open Details for the item utilities, and use Queue/Deleted for ordered copying and recovery. Existing data and images remain in .local-data/user; shelf.before-utilities-20261019.json and shelf.json.v1-backup preserve the prior schema/data. No test data was inserted into the user shelf.
2. Daily-use validation remains for receiving-app drag/drop, physical clipboard/global shortcuts/tray, Windows notification delivery/settings, and additional monitor/DPI setups. See known-issues.md.
3. Future work only when requested: installer/data migration, signing/updates, startup-at-login, mascot animation, and licensing/public release.
