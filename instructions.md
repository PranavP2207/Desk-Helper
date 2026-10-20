# Instructions: DeskHelper

Last updated: 2026-10-20

## Product goal

Build a Windows desktop helper whose main everyday interface is a small corner widget. It expands on mouse proximity or a hotkey for clipboard text/images, quick notes, and saved items. The larger window is an optional library/settings surface. Screenshot images come from the OS clipboard.

## User direction and sources

- Original conversation: brainstorm first; record ideas without building. Preserved in docs/brainstorm.md.
- Current user instruction: "start building step by step". Implementation is now authorized.
- Superseding direction: the user clarified that the small floating corner window must be primary, expanding on proximity/hotkey and otherwise staying unobtrusive, with a tray fallback. After a no-change discussion, the user explicitly authorized "start building the updated version".
- User-provided AGENTS.md instruction: apply project-context before implementation and maintain its four canonical context files at meaningful checkpoints and handoff.
- More utility ideas are recorded in docs/brainstorm.md and do not all constitute required first-version scope.
- New explicit scope: add copy-and-tuck-away, native screenshot/image drag-out, paste queue, task pockets, item reminders, text cleanup, persistent Recently deleted, and a near-cursor summon shortcut. Remove built-in screenshot capture; automatically update history from new text/image clipboard contents without a capture button.
- Publication request, 2026-10-20: organize necessary repository folders, add a community-friendly README, and push the project to https://github.com/PranavP2207/Desk-Helper. The user chose to leave it unlicensed for now.

## Implementation scope and acceptance

Current acceptance criteria combine the user's clarified interaction with implementation choices D-004 and D-006–D-008:

- Start as a small floating dot near a screen corner, without opening the full library.
- Expand after a short hover/proximity delay or a hotkey. Hover must not steal focus; mouse/keyboard interaction can focus the panel.
- Collapse after leaving with a delay; keep it open during a draft, pending action, focused interaction, or explicit keep-open mode.
- Automatically collect new copied text/images while running, with pause/resume, duplicate suppression, and suppression of app-originated clipboard writes. No built-in screen capture or capture button remains. Print Screen/Snipping Tool images arrive through the clipboard.
- Provide all eight newly requested utilities inside the compact surface; keep stored data and optional library compatible through a backed-up schema migration.
- Hide the widget to the system tray, restore it, and choose a monitor/corner. The optional library shares the same saved data.

- A working Windows desktop panel saves manually entered notes/text and automatically collected clipboard text/images.
- Existing library functions and text-only saved items must continue to work while the widget becomes primary.
- Users can search, filter, pin, copy, delete, and undo deletion.
- Saved items persist across app restarts. Unpinned temporary entries expire according to their selected retention; pinned entries remain.
- Tray and a global shortcut can reopen the panel; users can explicitly quit.
- Local operations only; the user now explicitly authorizes automatic clipboard history. No upload or account setup.
- Empty, loading, success, and failure states communicate what actually happened.
- Keyboard-accessible controls, visible focus, labeled icon buttons, readable contrast, and a usable narrow window.
- Captured content is displayed as text. Privileged operations validate IPC callers and input; the renderer has no filesystem/Node access.

## Working conventions

- Keep context in the project root. Preserve brainstorming history while recording its superseding authorization.
- Keep domain/storage logic independent of the UI and Electron where practical.
- Use lockfile-pinned dependencies and documented npm scripts.
- Verify critical persistence, expiration, and clipboard behavior with meaningful checks. Never use the user's real clipboard/history for automated tests; isolate test data and stub the clipboard in the test-launched app.
- For this checkout, use the same .local-data/user shelf from npm start, npm run dev, and the convenience launcher. Keep automated fixtures isolated in their own directories.
- Do not publish, upload, or push to GitHub without a user request.
- The requested initial push to PranavP2207/Desk-Helper is authorized. Exclude actual clipboard data, local backups, credentials, dependencies, caches, generated builds, and test output; public previews must contain only reviewed synthetic/demo content. Keep the four canonical context files at the root.

## Open product questions

- A simple dot with the existing friendly face is the implementation choice for now; detailed mascot animation remains optional future work.
- Future utilities beyond the eight selected ones remain ideas. Additional app-specific clipboard exclusions can be considered later; pause/resume is required now.
