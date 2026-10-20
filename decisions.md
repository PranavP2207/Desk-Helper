# Decisions: DeskHelper

Last updated: 2026-10-20

## D-001: Electron for the first desktop milestone

- Date: 2026-10-19
- Status: accepted
- Source: Agent implementation choice within the user's request to begin building step by step.
- Decision: Electron with React, TypeScript, and Vite; one main process owns native operations and saved data, with a narrow isolated preload bridge.
- Reason: Node is installed and Rust is absent. This supports validating a working native tray/clipboard experience without installing a compiler toolchain.
- Alternatives: Tauri/Rust was a brainstorming preference, never an approved mandate. C#/WinUI would require a newer .NET setup here.
- Consequences: Electron runtime overhead; measure later. Renderer has no Node access, uses no remote content, and cannot access arbitrary IPC or files.

## D-002: Local file storage and manual capture first

- Date: 2026-10-19
- Status: accepted for storage; manual-only capture superseded by D-006
- Source: Agent implementation choice within delegated first-milestone scope.
- Decision: Store a versioned, validated JSON document through a serialized, atomic main-process store. Start with manual capture, without clipboard polling. SQLite remains an option if data volume or feature needs justify it.
- Reason: A small text shelf does not need native database bindings. Keeping all data access behind the main process permits a later migration.
- Alternatives: SQLite immediately; browser localStorage; automatic clipboard recording.
- Consequences: No accounts, server, or cloud dependency for this milestone. Data is local plaintext, not a secret vault. App and user actions must not log saved content. Tests use a workspace-local data directory.
- Development location: All normal source-checkout launch methods share .local-data/user. Future packaged builds use the OS app-data directory and will need a migration before release.

## D-003: First milestone and incremental roadmap

- Date: 2026-10-19
- Status: superseded by D-004
- Source: Agent scoping choice under the user's "step by step" instruction.
- Decision: Deliver text/link capture, notes, search, pin/delete/undo, expiration, tray, and a shortcut before task pockets, automatic history, file handling, or a floating mascot.
- Reason: Establish one useful complete workflow before expanding utilities.
- Consequences: Later ideas remain exploratory. Closing the panel hides it to the tray; explicit Quit exits. Pinning protects against expiration; unpinning restarts the chosen retention period.

## Decision history

D-003 established the first library milestone. D-004 supersedes its deferment of the floating interaction after the user clarified the intended product.

## D-004: Corner widget is the primary interface

- Date: 2026-10-19
- Status: accepted
- Source: Explicit user clarification and authorization to build the updated version.
- Decision: A small transparent, frameless, always-on-top corner widget expands into a compact panel. Tray and Ctrl+Shift+Space restore it; the existing library opens only on demand.
- Reason: The user's main workflow belongs in a small corner window, not the full app window.
- Alternatives: Full-library-first startup (superseded); a large permanently transparent hit area (avoided because it would intercept other apps).
- Consequences: Resize the real native bounds between dot/panel states. Mouse proximity is checked without recording activity. Hover uses showInactive; explicit interaction enables focus. Use display work areas and selectable corners/monitors. Drafts and pending operations protect against automatic collapse.
- Supersedes: D-003's primary interaction and mascot deferment; existing library/storage remain useful.

## D-005: Explicit screenshots and locally stored images

- Date: 2026-10-19
- Status: superseded in part by D-006 (screen capture removed; PNG storage retained)
- Source: User asked for clipboard/screenshots in the corner surface; implementation details chosen within that scope.
- Decision: Capture screen frames only after the screenshot action, show a region-selection overlay, and persist only a confirmed crop. Store PNG files with validated metadata beside the existing shelf; text items remain readable without migration.
- Reason: Screenshots and clipboard images need image storage and copying, without bloating the JSON document with image data.
- Alternatives: Opening the OS snipping tool and waiting for clipboard changes; full-screen captures saved automatically; base64 embedded in JSON.
- Consequences: Bound image size/storage, serve only validated app-owned image IDs, preserve files during undo, and clean orphan/expired image files. Capture tests use generated images and a private clipboard, never the user's actual desktop/clipboard.

## D-006: Automatic clipboard history replaces screen capture

- Date: 2026-10-19
- Status: accepted
- Source: Explicit user request to remove screenshot capture and update history automatically on copy.
- Decision: Remove capture overlays and APIs; watch text/image clipboard payloads with a sequential 750ms async check, hashes for duplicate/self-copy suppression, a persisted pause toggle, and bounded content sizes. Respect Windows' exclude-from-monitoring clipboard format where provided.
- Reason: Print Screen/Snipping Tool already place screenshots on the clipboard. Electron exposes clipboard reads/writes without a portable changed event; this avoids a new native compiler/FFI dependency.
- Alternatives: Win32 listener via a native dependency; retaining manual-only capture.
- Consequences: Collects new/current supported clipboard contents while running, not historical Win+V entries. Extremely short-lived clipboard changes between checks may be missed. No content is logged or uploaded. Automated tests use a private ClipboardItem boundary.
- Supersedes: D-002's manual-only capture and D-005's built-in screenshot sessions.

## D-007: Persistent organization, queue, reminders, and recovery

- Date: 2026-10-19
- Status: accepted
- Source: User-selected utility list; detailed retention/UX chosen within delegated scope.
- Decision: Version-2 shelf stores task pockets, item assignments, ordered queue IDs, reminder metadata, monitoring preference, and seven-day soft-deleted items. Back up version-1 data before the first migrated write.
- Reason: The selected utilities must survive restart and share one consistent transaction boundary.
- Alternatives: Separate independent state files; in-memory-only queue/trash.
- Consequences: Delete removes items from the queue; deleting a pocket moves its items back to Inbox. Expiration remains permanent; manual deletion goes to Recently deleted. Reminders run while the app is open and overdue reminders surface on next launch. Queue actions copy the next value; users paste with Ctrl+V.

## D-008: Copy/drag/summon interactions

- Date: 2026-10-19
- Status: accepted
- Source: Explicit user-selected interactions.
- Decision: Widget item-body click copies and collapses; separate Details controls expose editing/cleanup/assignment/reminders. Native drag-out accepts only saved image IDs and app-owned PNG paths. Ctrl+Alt+Space summons near the cursor; collapsing returns to the saved corner. Ctrl+Alt+V copies the next queued item when available.
- Reason: Keep daily work in the small window while preserving focused controls and a safe native boundary.
- Consequences: Shortcut conflicts are reported. Drag/drop behavior in specific external apps remains an OS integration check. The larger library remains available for browsing.

## D-009: Source repository and community documentation

- Date: 2026-10-20
- Status: accepted
- Source: Explicit user request to push to PranavP2207/Desk-Helper, organize necessary folders, and add a community-friendly README; explicit choice to leave it unlicensed.
- Decision: Publish the working version-0.3 sources on main, with logical existing core/electron/src/scripts/tests folders, docs for user material/demo images, and .github for contribution guidance/templates/CI. Keep the four canonical context files at the root. Set package metadata to UNLICENSED and do not add a license grant.
- Reason: Make the project understandable and reproducible without mixing source with personal clipboard data or generated files.
- Alternatives: A binary/installer release (not requested); numbered folder prefixes (unnecessary); selecting a permissive license without the owner's decision (declined).
- Consequences: Exclude .local-data, .cache, dependencies, builds, test output, and local credentials. Use reviewed demo-only previews. Windows CI runs unit checks, type checks, and the production build; native GUI checks remain an explicit local Windows command. Existing remote commits must be preserved; never force-push as part of the initial publication.
