# Using DeskHelper

[Back to README](../README.md)

## Open and tuck away

DeskHelper starts as a floating dot inside the screen work area. Hover near it for about 300 ms to peek without taking keyboard focus. Click it or use Ctrl + Shift + Space to interact. The real native window resizes between dot and panel, so a large invisible overlay does not block other apps.

Move away to collapse after about 900 ms when the panel is unfocused and idle. Drafts, open item details/settings, pending actions, and the keep-open pin protect your interaction. The dot or Escape explicitly tucks the pocket away; an unfinished note remains in memory while tucked away, but is not saved across app exit.

The crossed-eye control hides the widget to the system tray near the clock. Tray controls restore it or open the optional library. **Quit DeskHelper** fully exits.

## Clipboard history and screenshots

New supported clipboard contents appear automatically while history is live. Use **Pause/Resume** in the pocket, library, or tray menu; the setting survives restart. Resuming reads the current clipboard contents. Copies made by DeskHelper and unchanged/duplicate content do not add extra entries.

Use Print Screen or Snipping Tool to put a screenshot on the clipboard. DeskHelper has no built-in screen-capture overlay. PNG/JPEG images are saved as PNG files. Complete HTTP(S) URLs are classified as links.

History collects current/new contents while running, not historical Win+V entries. A 750 ms sequential poll can miss very short-lived changes. Windows exclude-from-monitoring hints are respected where a source supplies them; pause for private copying.

Click an item to copy and collapse, then paste normally in your destination. Open **ⓘ Details** to inspect full content and access its utilities. Drag an image thumbnail or detail image into an app that accepts file drops. Compatibility depends on the receiving app; DeskHelper hands over an app-owned PNG file.

## Notes, task pockets, and queue

- Use **+ Quick note** or Ctrl + N. Select a keep duration, then save with the button or Ctrl + Enter.
- The folder button creates, renames, or removes task pockets. Choose one from the dropdown to filter; notes created there join it. Assign existing items through Details. Removing a pocket returns active and deleted items to Inbox without deleting them.
- The numbered-list button adds/removes an item from the paste queue. **Queue** shows the full ordered queue, independent of the selected task-pocket filter or search. Move entries up/down, then choose **Copy next** or Ctrl + Alt + V. Paste with Ctrl + V in your form. Queue advancement leaves the saved item intact and happens only after copying succeeds.
- Search matches item titles/content. Recent, Pinned, Images, Queue, and Deleted provide focused views.

## Reminders and cleanup

Details provides **In 15 min**, **In 1 hour**, or a date/time picker for reminders. Due content moves to the front, gains a banner/dot badge, and requests a Windows notification. Clicking a notification opens the attached item. Windows must allow notifications and the app must be running for delivery; overdue reminders resurface on next launch. Pending reminders preserve temporary content, then refresh its retention when delivered. Clear or dismiss a reminder when finished.

Text cleanup offers plain text, whitespace trimming, upper/lower/title case, and exact duplicate-line removal. Inspect the preview, copy it, or save a cleaned copy. The original stays saved. Text copies contain plain text rather than source formatting.

## Retention and recovery

New clipboard entries default to 24 hours. Notes can last 24 hours, seven days, or until deleted. Pinning prevents expiration; unpinning restarts the chosen keep duration.

Manual deletion moves an item to **Deleted / Recently deleted** for seven days. The short Undo restores the latest deletion for 15 seconds. Recover older deletions through Deleted; permanent removal requires a second confirming click. Naturally expired entries are permanently removed and do not go to Deleted.

Deleted images stay available while their metadata is recoverable. Permanent removal, expiration, and orphan cleanup delete only owned image files. A brief file lease protects native image drags during cleanup.

## Placement and shortcuts

The location-pin button chooses a display/corner and reports shortcut availability. The preference survives restart. Ctrl + Alt + Space or **Summon beside cursor** temporarily opens near the mouse and clamps the panel to that display's work area. Collapsing returns to the saved corner.

Global shortcuts can conflict with other apps. Use the visible buttons or tray when unavailable. [Shortcut reference](../README.md#shortcuts).

## Data, backups, and limits

App content stays local, with no accounts, cloud, analytics, or uploads. Text/metadata are plaintext JSON; images are PNG files. Saved content is not logged or executed as HTML. Pause before copying secrets.

All checkout launch methods use `.local-data/user/`:

| Path | Contents |
| --- | --- |
| shelf.json | Items, pockets, queue, reminders, deleted items, and monitoring preference |
| images/ | App-owned PNG images |
| widget.json | Saved display and corner |
| shelf.json.v1-backup | Non-overwriting backup before the first changed version-one migration write |

Back up the whole folder, preferably after quitting the app. A future packaged build uses `%APPDATA%\DeskHelper`; checkout-to-installer migration remains future work.

Writes are validated, serialized, and atomic. Failed commits do not enter memory. Unreadable/unsupported data is preserved and reported; do not blindly replace the original. Retention/cleanup runs during data operations and approximately every minute.

Limits: 1,000 active items, 1,000 deleted items, 100 task pockets, 50,000 characters per text item, 64 MiB JSON, 12 MiB per PNG, and 200 MiB total image files. Dimensions are capped at 16,384 per side / 80 million pixels. Permanently remove images from Deleted to reclaim space early.

For unresolved integration checks, see [known-issues.md](../known-issues.md).
