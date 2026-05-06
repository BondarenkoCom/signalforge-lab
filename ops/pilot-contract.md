# Pilot Contract

SignalForge is a first-pass planning tool for authorized security review.

## Free Sanity Check

- Input: one non-confidential scope note.
- Output: high-level review queue and obvious risk areas.
- Boundary: no private credentials, secrets, or target testing.
- Acceptance: best effort only.

## Paid Quick Triage

- Budget filter: `$49-$99`.
- Input: authorized scope, roles, object model, and safe test constraints.
- Output: focused authorization matrix and two or three highest-signal checks.
- Boundary: no destructive testing, no third-party data access, no spam, no persistence.

## Paid Review Plan

- Budget filter: `$150-$300`.
- Input: authorized scope, workflows, API notes, object states, and role model.
- Output: fuller control model, prioritized test plan, report skeleton, and safe validation notes.
- Boundary: planning and safe validation only unless a separate explicit agreement expands scope.

## Refusal Conditions

- No clear authorization.
- Request requires stealth, spam, social engineering, credential attacks, DoS, persistence, or third-party data access.
- Request asks for exploitation without a defensible security boundary and safe proof path.

## Current Intake

- Public issue form: `https://github.com/BondarenkoCom/signalforge-lab/issues/new?template=review-request.yml`
- Live tool: `https://signalforge-lab.onrender.com`
- Public offer page: `https://signalforge-lab.onrender.com/pilot.html`
- Payment rail is selected only after authorization, scope, and deliverable are accepted.
