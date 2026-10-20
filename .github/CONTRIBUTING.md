# Contributing to DeskHelper

Thanks for helping improve DeskHelper. Bug reports, documentation fixes, accessibility feedback, and focused pull requests are welcome. The project is currently unlicensed; see the [README license notice](../README.md#license) before reusing or contributing code. Contributions do not establish an open-source license.

## Before you start

- Search [existing issues](https://github.com/PranavP2207/Desk-Helper/issues) for the same problem or idea.
- Discuss larger features or architectural changes in a feature request before implementing them.
- Keep the everyday workflow in the compact corner pocket. The full library is optional.
- Use fabricated clipboard contents in reports, previews, and tests. Do not upload your .local-data folder or personal clipboard history.

## Local setup

Use Windows, Node.js 24 LTS, and npm. From your clone:

```powershell
npm ci
npm run dev
```

For a production build and launch, use `npm start`. More setup details are in the [development guide](../docs/development.md).

## Validation

```powershell
npm run check
npm run test:desktop
```

The first command runs logic/storage tests, strict type checks, and the production build. The second launches real Electron windows with a private test clipboard. It requires an interactive Windows desktop and must never use the system clipboard for fixtures.

Add meaningful regression coverage for behavior changes. Documentation-only edits need working links and accurate commands, not extra unit tests. For UI changes, include a screenshot made with synthetic data.

## Pull requests

- Keep each change focused and explain the user-visible result.
- Describe how you verified it and any remaining platform limitations.
- Keep native operations in electron/, shared domain logic in core/, and UI work in src/.
- Preserve data compatibility. Do not silently replace unreadable saved files.
- Refresh the four root project-context files when requirements, decisions, behavior, or validation change.
- Follow the [community guidelines](CODE_OF_CONDUCT.md).

Security-sensitive reports should follow [SECURITY.md](SECURITY.md), without posting exploit details or private content in public issues.
