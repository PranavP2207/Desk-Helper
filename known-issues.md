# Known issues: DeskHelper

Last updated: 2026-10-19

## Active issues

No confirmed unresolved application defects after the version 0.3 checks. This is an early development build, not an installer release.

## Environment and delivery limits

- Rust/cargo are absent. This is accounted for by D-001; the first milestone uses Electron.
- Production packaging, startup-at-login, automatic updates, code signing, and installer validation are later work, not verified capabilities.
- Tests use a private ClipboardItem-backed clipboard and generated images, not personal desktop/clipboard content. Native image drag tests verify the file handoff boundary; delivery into specific email/chat/upload apps, physical global keystrokes, tray interactions, and extra monitor configurations remain daily-use checks.
- Native window interactions are checked at this machine's 125% scale. Pure geometry tests cover negative monitor origins, cursor-edge clamping, and small work areas; simultaneous physical multi-monitor operation has not been exercised.
- Automatic history checks supported text/PNG/JPEG payloads every 750 ms while running, skips Windows exclude-from-monitoring hints, and offers persisted pause/resume. It does not import historical Win+V entries and can miss shorter clipboard changes. Source-app privacy hints are not universally provided.
- Windows notification delivery depends on Windows settings and the app running. Overdue content resurfaces on next launch. Native scheduling/banner behavior is tested; actual Windows toast display and click delivery need daily-use validation for this unpackaged checkout.
- Built-in screenshot capture was intentionally removed. Print Screen/Snipping Tool must place an image on the clipboard for automatic saving. OCR, annotation, and recording remain future work.
- Electron process launch is blocked by this session's command sandbox; native tests pass when run with approved execution outside it. This is an environment constraint, not a reproduced app defect.
- This coding environment can pass Electron's Node-mode flag to direct shell launches, producing a ClipboardItem export error before startup. The documented `npm start` / `node scripts/start.mjs` launcher clears the flag in its explicit child environment; normal startup and all three shortcuts passed, and the user app is running through that launcher.

## Resolved issues

### I-001: Official runtime download stalled on large responses

- Status: resolved for this checkout
- Impact: Development setup could not reach native desktop validation.
- First observed: 2026-10-19
- Evidence: The normal installer and large ranged responses stalled; official endpoint HEAD and 64 KiB transfers succeeded.
- Cause: Large-transfer behavior in this environment; underlying network cause unconfirmed.
- Workaround/resolution: Downloaded the official v44.9.0 Windows x64 asset in bounded 64 KiB ranges. Full reconstructed SHA-256 matched the checksum in the pinned Electron package before extraction.
- Validation: All three native Electron scenarios and a normal-mode smoke launch passed on 2026-10-19.
- Next action: No action for this checkout. Use the standard Electron installer on other machines unless the same symptom is observed.

### I-002: Short-window sidebar overflow

- Status: resolved
- Impact: At a 760 × 620 viewport, the sidebar overflowed and created an extra document scrollbar.
- First observed: 2026-10-19
- Cause: Decorative sidebar content and footer exceeded the short window's available height.
- Resolution: Added contained sidebar scrolling, prevented document overflow, and hid the decorative card in short windows.
- Validation: Narrow-window desktop scenario passed and artifacts/narrow-desktop.png was visually reviewed on 2026-10-19; navigation and settings remain accessible.
- Next action: Recheck if the navigation or minimum window size changes.
