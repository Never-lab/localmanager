# LocalManager — agent brief (CLAUDE.md)

Concise rules for agents working in this repo. [`AGENTS.md`](./AGENTS.md) is a stub pointer (Cursor loads it); edit this file only.

## Product

- Educational Italian **mayor sim**: manage a real municipality from a desk, grow it, survive politics, see the town map evolve. **Player-facing UI copy is Italian.**
- Not administrative or political advice — keep didactic tone; don’t invent legal or policy claims.
- Prefer clarity over cleverness: disabled controls must say **why** + **what to do** (hint, `title`, or visible label).

## Orientation

1. Approved design: [`docs/superpowers/specs/2026-08-29-localmanager-v0-skeleton-design.md`](docs/superpowers/specs/2026-08-29-localmanager-v0-skeleton-design.md).
2. Implementation plans (when used): `docs/superpowers/plans/`.
3. Monorepo layout: `apps/web`, `apps/api`, `packages/sim`, `packages/shared`, `services/maps`, `data/comuni/`.

## Creative / multi-step work (Superpowers)

For new features or non-trivial UX (not typo fixes):

1. **Brainstorm** — clarify scope; get approval before coding.
2. **Design** — store the approved design in **claude-mem** (project `localmanager`, type `decision`). Formal spec/plan files only if the user explicitly asks or SDD requires them.
3. **Implement** task-by-task (TDD where logic exists); verify; PR. Pull design from mem if needed.

Do not skip to implementation on ambiguous “build X” requests.

## Git & PRs

1. Branch from updated `main`: `feat/…`, `fix/…`, or `docs/…`. One concern per PR.
2. Before opening/asking to merge: `npm run lint && npm test && npm run build` (once packages exist).
3. PR against `main`; wait for **CI / check** green; do not merge while red/pending.
4. Never push straight to `main`. No force-push to `main`.
5. Commit only when the user asks (or explicitly says “vai / fai commit / apri PR”).
6. **Do not commit:** `.superpowers/sdd/*`, local session diffs/reports, secrets, `.env`.
7. Never `Co-authored-by: Cursor`.

## Code & tests

- **Sim numbers:** take from `packages/sim` config and existing tests — do not invent balances, multipliers, or cooldowns.
- **No silent formula changes** without spec + tests.
- Vitest on pure sim logic; UI wiring verified by lint/tsc/build.
- Match existing patterns (Zustand store, Italian logs/toasts).
- Keep diffs surgical; no drive-by refactors.

## Stack

- **Postgres only** for cloud saves (no SQLite or dual backends in v0).
- **Auth:** guest local slots + account cloud saves; HMAC sessions (Floatdesk-like).
- **Maps:** Python prettymaps worker; PNG crossfade on month close when overlay dirty.

## Language

- If the user writes in Italian, respond in Italian (unless they ask otherwise).
- Code identifiers stay English; user-visible strings Italian.

## Execution preferences

- Default: work on a feature branch in this checkout (worktrees under `.worktrees/` if isolation is requested).
- Prefer one clear clarifying question over speculative multi-path implementation when scope is huge.
- If the design is already approved in this chat (or the user says «ok / procedi / implementa come approvato»): skip Superpowers brainstorm and implement from this thread.

## Shared agent block (Never-lab)

- Chat: Italian. Code/PR/issue text: English (LocalManager player UI: Italian).
- Before posting PR bodies or issue comments: skill **`no-ai-slop`**.
- Never `Co-authored-by: Cursor`.
- Prefer `ponytail` + Karpathy; Superpowers only when the slice is new/ambiguous.
