# Security Policy

SignalForge is a planning tool for authorized security review work.

## In Scope

- The SignalForge application and repository.
- Safe reports about the application itself, including API behavior, static UI behavior, and issue-template behavior.

## Out of Scope

- Testing third-party targets through SignalForge without explicit authorization.
- Denial-of-service, spam, social engineering, persistence, credential attacks, destructive actions, or third-party data access.
- Reports based only on guessable identifiers, prompt changes, version strings, or cosmetic differences without a broken security boundary.

## Data Handling

- `/api/analyze` returns a plan from submitted text and does not intentionally persist request bodies.
- GitHub issue intake is public by default. Do not submit secrets, private tokens, third-party personal data, or confidential program details there.
- If private context is required, submit only a minimal contact handle first.

## Reporting

Open a GitHub issue with:

- affected endpoint or feature
- identity used
- expected result
- observed result
- minimal safe reproduction steps
- impact in one plain-English sentence
