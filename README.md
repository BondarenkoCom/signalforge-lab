# SignalForge

[![CI](https://github.com/BondarenkoCom/signalforge-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/BondarenkoCom/signalforge-lab/actions/workflows/ci.yml)

Local experiment workspace for a narrow revenue probe.

Live URL:

```text
https://signalforge-lab.onrender.com
```

## Boundaries

- Runs inside `D:\aya-9x-lab\signalforge`.
- Does not require external accounts, tokens, payments, or third-party writes.
- Does not test third-party targets. It only transforms user-provided scope/rules text into a review plan.
- Incoming requests can be opened as GitHub issues in this new repository without deploying server-side secrets.
- Public issue intake must not receive secrets, private tokens, third-party personal data, or confidential program details.

## Commands

```powershell
npm test
npm start
```

Default local URL:

```text
http://127.0.0.1:4177
```

## Deployment Notes

The included `render.yaml` is a blueprint for a future new Render service only. It must not be applied to existing services.
