# DeskHelper — brainstorming notes

Recorded: 19 October 2026

Status: idea exploration only. The user explicitly requested no implementation yet. No stack, scope, or design has been approved. This document records possibilities; it does not authorize starting development.

Update, 19 October 2026: the user subsequently requested "start building step by step". Implementation is now authorized. The original brainstorming is preserved below; current scope, decisions, and evidence live in the four project-context files at the repository root. This document was grouped under docs/ for the authorized source publication on 20 October 2026.

## Original idea

A Windows desktop helper, accessed through a floating mascot, dot, icon, or taskbar/tray presence, for small everyday tasks such as keeping clipboard items and temporarily storing information.

## Proposed product direction

A small desktop pocket: park something now and retrieve it when needed. Bring together temporary text, links, notes, and eventually file references in a compact panel.

Example: save a copied address, add a quick note, return to another app, and retrieve either item through a shortcut. Temporary entries can expire; pinned entries stay until removed.

The useful workflow should be accessible through a tray icon and keyboard shortcut. A floating dot or mascot could be an optional second entry point, opening the same panel. Mascot animation and personality remain exploratory.

## Possible features

| Feature | Example | Suggested stage |
| --- | --- | --- |
| Temporary text/link shelf | Save a URL or paragraph for the current task | First version |
| Quick scratchpad | Jot down a thought without opening a separate document | First version |
| Search, pin, copy, delete | Find a saved item and copy it back | First version |
| Expiration | Remove unpinned items after a chosen duration | First version |
| Opt-in clipboard history | Keep recent copied text, deduplicate, pause capture | After manual capture works |
| Reusable snippets | Save frequently used replies or commands | Later |
| File shelf | Park references to files for later opening or dragging | Later |
| Text cleanup | Remove formatting, trim whitespace, change case | Later |
| Screenshot text extraction | Turn an image into reusable text | Later |
| Small reminders | Attach a reminder to a saved item | Later |
| Floating mascot | Optional movable character with subtle feedback | After core workflow is useful |

For a future file shelf, distinguish a reference from a managed copy. Removing a shelf entry must not delete the original file. References can break when the original is moved.

## Additional utility ideas — 19 October 2026

These are brainstorming candidates, not approved scope. The strongest theme is helping people carry small pieces of work across app switches and interruptions.

| Utility | Concrete interaction | Product fit / complexity considerations |
| --- | --- | --- |
| Task pockets | Group links, notes, file references, and a small checklist under a task such as "Job application" | Strong fit; builds on the proposed shelf and storage model |
| Return cards | Before switching tasks, save "Stopped at slide 8; next add the chart" alongside a file or link | Strong fit; manual capture can work without activity monitoring |
| Paste queue | Collect several copied values, reorder them, then copy the next value on each user action | Strong fit; copying the next item is simpler than reliably pasting into the previous app |
| Gather-and-drag basket | Gather files from multiple folders and drag the collection to another app | Strong fit; true file drag/drop needs Windows and destination-app compatibility validation |
| Reference pin | Keep a small screenshot or note visible beside the app being used | Useful while following instructions or comparing a reference; static images are simpler than live window mirroring |
| Quick text comparison | Select two saved entries and highlight differences | Useful for URLs, addresses, configuration snippets, or edited paragraphs; a focused standalone action |
| Clipboard-to-file | Turn saved text into .txt/.md or a captured image into .png at a chosen destination | Makes temporary content usable by apps that require attachments; explicit save destination |
| Fill-in templates | Choose "Meeting follow-up," fill recipient/date/action fields, and copy the result | Extends reusable snippets while keeping each output under user control |
| Quick calculations | Type "1440 / 3", "250 cm in m", or a time-zone conversion in the panel | Convenient secondary utility; date-aware time-zone handling needs care; no live currency rates implied |
| Image preparation | Drop an image, resize or compress it, and save a separate output | Useful before uploads; show dimensions and file size; preserve the source |
| Download triage | Review recent downloads and choose labels, destinations, or a filing rule | Larger feature; preview moves/renames and support undo; no automatic cleanup assumed |
| Personal app cheat sheets | Keep a few shortcuts or notes associated with a chosen application | A small personal memory aid; manual app selection can precede automatic active-app detection |
| QR handoff | Turn a selected URL or short text into a QR code for scanning on a phone | Lightweight handoff; a local file path or raw image is not a transferable file without additional hosting/transfer infrastructure |
| Task launch kits | Reopen the chosen links, files, and apps belonging to a pocket | Useful extension of task pockets; do not promise restoration of unsaved app state |

Recommended candidates to discuss first:

1. Task pockets: organize temporary material around what the user is doing.
2. Return cards: make it easy to resume after interruptions.
3. Paste queue: reduce repetitive switching during forms and other copy/paste tasks. Start with explicit "copy next"; consider direct paste only after focus handling is validated.

Possible mascot interactions: drop an item onto it to open a pocket, click it to retrieve items, show a small pending-item badge, and display a subtle reminder indicator. Keyboard access should provide equivalent operations. Animation behavior and drag/drop feasibility remain unvalidated.

Existing-tool context: PowerToys already covers utilities including always-on-top windows, OCR, file previews, app workspaces, and bulk renaming; Windows provides Focus sessions. These can inform design, but duplicating many standalone utilities could distract from the temporary-work flow.

Sources for that comparison:

- [Microsoft: PowerToys utilities](https://learn.microsoft.com/en-us/windows/powertoys)
- [Microsoft: Windows Focus](https://support.microsoft.com/en-us/windows/experience/focus-stay-on-task-without-distractions-in-windows)

## Product positioning

Windows already provides clipboard history and pinned items through Win+V. PowerToys Advanced Paste provides clipboard transformations. The proposed differentiator is a cohesive temporary-storage workflow with expiration, quick capture/retrieval, and optional visual personality. Individual utility features should not be assumed unique.

Worth pursuing as a learning, portfolio, and open-source project if it solves a real daily annoyance. Commercial demand and adoption are unvalidated.

## Technology options — proposals only

Preferred starting point if comfortable with web UI and willing to learn some Rust:

- Tauri 2 desktop shell.
- React and TypeScript for the panel and settings UI; plain CSS is sufficient initially.
- Rust for Windows integration, clipboard event handling, retention rules, and storage access.
- SQLite for saved entries; a small settings store for preferences.
- Local operation initially; accounts, hosted services, and cloud sync are unnecessary for the proposed first version.

Tauri uses WebView2 on Windows and documents tray, clipboard, global-shortcut, and SQLite support. Clipboard read/write support does not by itself implement automatic history: a Windows listener and capture policy still need to be designed. Windows exposes AddClipboardFormatListener and WM_CLIPBOARDUPDATE for clipboard changes.

Alternatives:

- Electron + TypeScript: appealing when staying in JavaScript is the priority. It bundles Chromium and Node.js, a runtime tradeoff for a small background utility. Actual resource use would need measurement.
- C# + WinUI 3 / Windows App SDK: consider when native Windows development and C# familiarity matter most; this is Microsoft's recommended framework for new native Windows apps.

Keep one background process responsible for capture and storage. Tray, shortcut, and optional mascot should all use the same app logic and open the same panel. A separate server is unnecessary.

## Suggested process once implementation is explicitly requested

1. List three recurring situations where information gets lost or requires an unnecessary app switch. Compare those tasks with Win+V and PowerToys.
2. Sketch the capture/retrieve flow and choose manual saving versus automatic clipboard capture for the first release.
3. Check desktop feasibility: tray lifecycle, hotkey conflicts, window focus, clipboard events, and idle resource use. Treat a floating overlay as a separate feasibility question.
4. Build one complete flow: open panel, save text, find it, copy it back, then remove or expire it. Add a quick note using the same storage model.
5. Use it during everyday work. Evaluate usefulness, accidental capture, panel speed, and whether a mascot helps or obstructs work.
6. Harden restart behavior, single-instance operation, retention, keyboard access, DPI/multiple monitors, and optional startup behavior. Add meaningful checks for these behaviors.
7. Prepare a GitHub release with a short demo, installation/build instructions, license, privacy/retention explanation, and documented limitations. Publish only when requested.

## Design decisions still open

- Tray-only, floating dot, or mascot as the preferred everyday entry point.
- Manual capture first versus opt-in automatic text history.
- Whether temporary entries survive app restarts and the default expiration period.
- Existing familiarity with TypeScript, Rust, or C#.
- Windows-only scope versus possible cross-platform expansion.
- Whether the file shelf stores references or copies, if pursued.

For automatic clipboard capture, plan local storage, a visible pause control, clear/delete controls, and expiration. Sensitive-content filtering cannot be assumed perfect. Keep saved content out of logs and treat captured text as untrusted display content.

## Sources checked

- [Microsoft: Using the clipboard](https://support.microsoft.com/en-US/Windows/Apps/using-the-clipboard)
- [Microsoft: PowerToys Advanced Paste](https://learn.microsoft.com/en-us/windows/powertoys/advanced-paste)
- [Tauri: System tray](https://v2.tauri.app/learn/system-tray/)
- [Tauri: Clipboard](https://v2.tauri.app/plugin/clipboard/)
- [Tauri: Global shortcuts](https://v2.tauri.app/plugin/global-shortcut/)
- [Tauri: SQL](https://v2.tauri.app/plugin/sql/)
- [Tauri: Webview versions](https://v2.tauri.app/reference/webview-versions/)
- [Microsoft: AddClipboardFormatListener](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-addclipboardformatlistener)
- [Electron: Introduction](https://www.electronjs.org/docs/latest/)
- [Microsoft: Windows app development](https://learn.microsoft.com/windows/apps/desktop)

## Next action

Build the first incremental milestone under the user's subsequent implementation request. Follow current-state.md, decisions.md, instructions.md, and known-issues.md for the current plan and verification; this brainstorming document remains a catalog of possible future utilities.
