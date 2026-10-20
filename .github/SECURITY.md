# Security and privacy

DeskHelper is an early development build. There is no published long-term-support or security-response schedule. Reports about the current default branch are welcome; no response-time guarantee is made.

## Reporting a vulnerability

Do not post exploit instructions, tokens, personal clipboard history, or saved data in public issues.

If the repository offers GitHub's **Report a vulnerability** option in its Security tab, use that private channel. Otherwise, open an issue titled **Security contact request**, containing only a request for a private reporting route. Wait for the maintainer to arrange a channel before sharing sensitive details. No dedicated private contact address is published yet.

For an ordinary bug, use the bug-report template with synthetic reproduction data.

## Current data boundaries

- Clipboard collection is automatic while the app is running and history is live. Pause before copying sensitive content.
- Saved text and images are local and unencrypted. DeskHelper is not a password manager or a secret vault.
- Windows exclude-from-monitoring clipboard hints are respected where present, but source apps do not always supply them.
- User data, backups, caches, generated files, and credentials must stay outside commits and issue attachments.
- The renderer is sandboxed. Native IPC validates the sending surface, frame, and inputs; image drag paths come from the app-owned image store.
