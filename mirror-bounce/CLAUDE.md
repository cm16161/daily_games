Project: a set of small daily puzzle games, each a static, client-only web app (no backend).

Constraints for all games:
- TypeScript + Vite, no UI framework unless needed, no runtime dependencies beyond what's essential.
- Mobile-first, works with touch and mouse. Keyboard-accessible.
- The daily puzzle is derived deterministically from the local calendar date (YYYY-MM-DD) via a seeded PRNG, so every player gets the same puzzle. Put the seed/PRNG in a shared module.
- One play per day. Persist today's result, streak and best score in localStorage. Wrap all storage access in try/catch.
- On completion, show a score breakdown and a "Copy result" button that copies a spoiler-free emoji/text summary to the clipboard.
- Unit tests (Vitest) for scoring and puzzle generation. Pure logic must be separate from DOM code.
- Before writing code, give me a short plan: file layout, data model, scoring function signatures. Wait for my approval.
