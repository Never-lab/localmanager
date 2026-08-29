# Cassa Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soften BDAP cash collapse (surplus floor + debt cap) and show a clear monthly Cassa forecast with hints so the player knows how to stay solvent.

**Architecture:** Educational budget clamps live in `comuni-data` next to BDAP mapping. Structural month cash math is exposed as `forecastMonthCash` in `sim` (same formula as `advanceMonth` without RNG/events). Web Cassa panel renders that forecast.

**Tech Stack:** TypeScript monorepo (`comuni-data`, `sim`, `web`), Vitest, React.

**Spec:** `docs/superpowers/specs/2026-08-29-cassa-clarity-design.md`

## Global Constraints

- Player-facing UI copy: Italian; identifiers / PR text: English
- Do not invent sim balances beyond the approved constants (`MIN_MONTHLY_SURPLUS = 5000`, `DEBT_CAP_MONTHS = 36`)
- No new dependencies; no `comuni-data` → `sim` import
- Commit steps below are **suggested messages** — commit only when the user asks
- No `Co-authored-by: Cursor`
- Out of scope: income-generating projects, runtime bailouts, history charts

## File structure

| Path | Responsibility |
| --- | --- |
| `packages/comuni-data/src/mapSeed.ts` | `MIN_MONTHLY_SURPLUS`, surplus floor in `mapBdapToBudget`; `DEBT_CAP_MONTHS`, `capOpeningDebt` |
| `packages/comuni-data/src/index.ts` | Export `capOpeningDebt` (+ constants if useful for tests) |
| `packages/comuni-data/src/hydrate.ts` | Cap debt after `mapBdapOpeningDebt` (both paths) |
| `packages/comuni-data/src/mapSeed.test.ts` | Floor + cap tests |
| `packages/sim/src/forecastMonthCash.ts` | Pure structural month forecast |
| `packages/sim/src/forecastMonthCash.test.ts` | Align with `advanceMonth` structural delta |
| `packages/sim/src/index.ts` | Re-export forecast |
| `apps/web/src/App.tsx` | Cassa mini-bilancio + hint |
| `apps/web/src/styles.css` | Minimal forecast list styles |
| `apps/web/src/App.test.tsx` | Smoke: «Previsione mese» visible in game |

---

### Task 1: BDAP surplus floor + debt cap

**Files:**
- Modify: `packages/comuni-data/src/mapSeed.ts`
- Modify: `packages/comuni-data/src/index.ts`
- Modify: `packages/comuni-data/src/hydrate.ts`
- Modify: `packages/comuni-data/src/mapSeed.test.ts`

**Interfaces:**
- Produces:
  - `export const MIN_MONTHLY_SURPLUS = 5_000`
  - `export const DEBT_CAP_MONTHS = 36`
  - `export function capOpeningDebt(rawDebt: number, monthlyBaseIncome: number): number` → `Math.min(rawDebt, Math.max(0, monthlyBaseIncome) * DEBT_CAP_MONTHS)` (if income is 0, cap is 0)
  - `mapBdapToBudget`: after monthly fields, if `monthlyBaseIncome - monthlyMaintenance < MIN_MONTHLY_SURPLUS`, set `monthlyMaintenance = Math.max(0, monthlyBaseIncome - MIN_MONTHLY_SURPLUS)`

- [ ] **Step 1: Write failing tests**

Add to `packages/comuni-data/src/mapSeed.test.ts`:

```ts
import { capOpeningDebt, DEBT_CAP_MONTHS, MIN_MONTHLY_SURPLUS } from "./index.js";

it("lowers maintenance to keep a minimum monthly surplus", () => {
  const budget = mapBdapToBudget(
    [{ Accertamenti: "120.000", "Esercizio finanziario": "2023" }],
    [{ Impegni: "600.000" }],
    ["https://example.test/e", "https://example.test/s"],
  );
  expect(budget).not.toBeNull();
  // yearly 120k → monthly income 10_000; yearly 600k → raw maintenance 50_000
  expect(budget!.monthlyBaseIncome).toBe(10_000);
  expect(budget!.monthlyMaintenance).toBe(10_000 - MIN_MONTHLY_SURPLUS);
});

it("does not raise income when surplus is already enough", () => {
  const budget = mapBdapToBudget(
    [{ Accertamenti: "1.200.000", "Esercizio finanziario": "2023" }],
    [{ Impegni: "960.000" }],
    ["https://example.test/e", "https://example.test/s"],
  );
  expect(budget!.monthlyBaseIncome).toBe(100_000);
  expect(budget!.monthlyMaintenance).toBe(80_000);
});

describe("capOpeningDebt", () => {
  it("caps raw debt at income × DEBT_CAP_MONTHS", () => {
    expect(capOpeningDebt(10_000_000, 100_000)).toBe(100_000 * DEBT_CAP_MONTHS);
  });

  it("leaves smaller debt unchanged", () => {
    expect(capOpeningDebt(50_000, 100_000)).toBe(50_000);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -w @localmanager/comuni-data -- mapSeed.test.ts`

Expected: FAIL (`capOpeningDebt` missing and/or maintenance still 50_000).

- [ ] **Step 3: Implement floor + cap**

In `mapSeed.ts`, after computing `monthlyBaseIncome` / `monthlyMaintenance` and before `openingCash`:

```ts
export const MIN_MONTHLY_SURPLUS = 5_000;
export const DEBT_CAP_MONTHS = 36;

if (monthlyBaseIncome - monthlyMaintenance < MIN_MONTHLY_SURPLUS) {
  monthlyMaintenance = Math.max(0, monthlyBaseIncome - MIN_MONTHLY_SURPLUS);
}

export function capOpeningDebt(
  rawDebt: number,
  monthlyBaseIncome: number,
): number {
  const cap = Math.max(0, monthlyBaseIncome) * DEBT_CAP_MONTHS;
  return Math.min(Math.max(0, rawDebt), cap);
}
```

Use `let monthlyMaintenance` (not `const`) for the adjustment.

Export from `index.ts`.

In `hydrate.ts` (both places that set `budget.openingDebt`):

```ts
budget.openingDebt = capOpeningDebt(
  mapBdapOpeningDebt(patrimonio),
  budget.monthlyBaseIncome,
);
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -w @localmanager/comuni-data -- mapSeed.test.ts`

Expected: PASS (existing mapping tests still pass).

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add packages/comuni-data
git commit -m "feat(comuni-data): educational surplus floor and debt cap"
```

---

### Task 2: `forecastMonthCash` in sim

**Files:**
- Create: `packages/sim/src/forecastMonthCash.ts`
- Create: `packages/sim/src/forecastMonthCash.test.ts`
- Modify: `packages/sim/src/index.ts`

**Interfaces:**
- Consumes: `GameState` from `@localmanager/shared`; `DEBT_HORIZON_MONTHS` from `./config.js`
- Produces:
  ```ts
  export type MonthCashForecast = {
    income: number;
    maintenance: number;
    staffCost: number;
    debtService: number;
    net: number;
  };
  export function forecastMonthCash(state: GameState): MonthCashForecast;
  ```
  `debtService` = `0` if `debt <= 0`, else `Math.min(debt, Math.max(1, Math.ceil(debt / DEBT_HORIZON_MONTHS)))`  
  `staffCost` = sum of `monthlyCost` for hired staff  
  `net` = `income - maintenance - staffCost - debtService`

- [ ] **Step 1: Write failing test**

Create `packages/sim/src/forecastMonthCash.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { advanceMonth } from "./advanceMonth.js";
import { createInitialGameState } from "./createInitial.js";
import { DEBT_HORIZON_MONTHS, STAFF_COSTS } from "./config.js";
import { forecastMonthCash } from "./forecastMonthCash.js";

function withEmptyQueue(state: ReturnType<typeof createInitialGameState>) {
  return { ...state, pendingEvents: [] };
}

describe("forecastMonthCash", () => {
  it("matches structural cash delta of advanceMonth (no province)", () => {
    let state = withEmptyQueue(
      createInitialGameState({ mayorName: "Test", seed: 1 }),
    );
    state = {
      ...state,
      debt: 240_000,
      staff: state.staff.map((m) =>
        m.role === "secretary" ? { ...m, hired: true } : { ...m, hired: false },
      ),
    };
    const forecast = forecastMonthCash(state);
    expect(forecast.debtService).toBe(Math.ceil(240_000 / DEBT_HORIZON_MONTHS));
    expect(forecast.staffCost).toBe(STAFF_COSTS.secretary);
    expect(forecast.net).toBe(
      forecast.income -
        forecast.maintenance -
        forecast.staffCost -
        forecast.debtService,
    );

    const before = state.cash;
    const next = advanceMonth(state);
    // Structural only: ignore log/events; cash change equals forecast.net
    // when no province resolution and no same-month cash from events (events are pending, not applied in advanceMonth)
    expect(next.cash - before).toBe(forecast.net);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -w @localmanager/sim -- forecastMonthCash.test.ts`

Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

Create `packages/sim/src/forecastMonthCash.ts`:

```ts
import type { GameState } from "@localmanager/shared";
import { DEBT_HORIZON_MONTHS } from "./config.js";

export type MonthCashForecast = {
  income: number;
  maintenance: number;
  staffCost: number;
  debtService: number;
  net: number;
};

export function forecastMonthCash(state: GameState): MonthCashForecast {
  const income = state.comune.monthlyBaseIncome;
  const maintenance = state.comune.monthlyMaintenance;
  const staffCost = state.staff
    .filter((m) => m.hired)
    .reduce((sum, m) => sum + m.monthlyCost, 0);
  const debtService =
    state.debt > 0
      ? Math.min(
          state.debt,
          Math.max(1, Math.ceil(state.debt / DEBT_HORIZON_MONTHS)),
        )
      : 0;
  return {
    income,
    maintenance,
    staffCost,
    debtService,
    net: income - maintenance - staffCost - debtService,
  };
}
```

Export from `packages/sim/src/index.ts`: `export * from "./forecastMonthCash.js";`

Optional ponytail follow-up (same PR if tiny): extract debt-service helper used by both `advanceMonth` and `forecastMonthCash` to avoid drift — only if both call sites stay one-liners.

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -w @localmanager/sim -- forecastMonthCash.test.ts`

Expected: PASS. Also run full sim suite: `npm test -w @localmanager/sim`

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add packages/sim
git commit -m "feat(sim): expose structural month cash forecast"
```

---

### Task 3: Cassa panel mini-bilancio

**Files:**
- Modify: `apps/web/src/App.tsx` (Cassa `<section className="panel">` ~lines 787–798)
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `forecastMonthCash` from `@localmanager/sim`
- Produces: Italian UI strings only (no new store fields)

- [ ] **Step 1: Extend UI smoke test**

In the existing guest-mandate flow test (or a focused follow-up), after reaching the desk, assert:

```ts
expect(await screen.findByText("Previsione mese")).toBeTruthy();
expect(screen.getByText("Netto previsto")).toBeTruthy();
```

(Adjust if the entry flow test already ends on the desk; otherwise add a small test that `startGame`s with `fixtureSeed()` and renders `GameScreen` path.)

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -w @localmanager/web -- App.test.tsx`

Expected: FAIL (text missing).

- [ ] **Step 3: Implement panel**

In `GameScreen`, compute once:

```ts
const cashForecast = forecastMonthCash(state);
const cashHint =
  cashForecast.net < 0
    ? state.staff.some((m) => m.hired)
      ? "Congeda personale o chiedi fondi alla Provincia"
      : "Chiedi fondi alla Provincia (esito in ~2 mesi)"
    : null;
```

Replace Cassa section body with:

```tsx
<section className="panel">
  <div className="panel-head">
    <PanelTitle icon="wallet">Cassa</PanelTitle>
  </div>
  <p className="cash">{money.format(state.cash)}</p>
  <span className="eyebrow">Disponibile</span>
  {state.debt > 0 && (
    <>
      <p className="cash">{money.format(state.debt)}</p>
      <span className="eyebrow">Debito residuo</span>
    </>
  )}
  <div className="cash-forecast">
    <span className="eyebrow">Previsione mese</span>
    <ul>
      <li>
        <span>Entrate base</span>
        <strong>+{money.format(cashForecast.income)}</strong>
      </li>
      <li>
        <span>Manutenzione</span>
        <strong>−{money.format(cashForecast.maintenance)}</strong>
      </li>
      <li>
        <span>Personale</span>
        <strong>−{money.format(cashForecast.staffCost)}</strong>
      </li>
      <li>
        <span>Rata mutuo</span>
        <strong>−{money.format(cashForecast.debtService)}</strong>
      </li>
      <li className="cash-forecast-net">
        <span>Netto previsto</span>
        <strong>
          {cashForecast.net >= 0 ? "+" : "−"}
          {money.format(Math.abs(cashForecast.net))}
        </strong>
      </li>
    </ul>
    {cashHint && <p className="close-hint">{cashHint}</p>}
  </div>
</section>
```

Add minimal CSS (reuse existing panel spacing; avoid new card chrome):

```css
.cash-forecast ul {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
}
.cash-forecast li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.9rem;
}
.cash-forecast-net {
  margin-top: 0.25rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border, currentColor);
}
```

(Use an existing CSS variable if the theme already has one for borders; otherwise a subtle `color-mix` / currentColor opacity is fine.)

- [ ] **Step 4: Run tests — expect PASS**

Run:

```bash
npm test -w @localmanager/comuni-data
npm test -w @localmanager/sim
npm test -w @localmanager/web -- App.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/web packages/sim packages/comuni-data docs/superpowers
git commit -m "feat(web): show monthly cassa forecast and solvency hint"
```

---

## Self-review

1. **Spec coverage:** surplus floor → Task 1; debt cap → Task 1; forecast helper → Task 2; Cassa UI + hint → Task 3; out-of-scope items not tasked.
2. **Placeholders:** none.
3. **Types:** `MonthCashForecast` / `forecastMonthCash` / `capOpeningDebt` / `MIN_MONTHLY_SURPLUS` / `DEBT_CAP_MONTHS` consistent across tasks.
