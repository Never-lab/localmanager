# Cassa clarity + soft budget — design

Approved 2026-08-29 (branch `feat/cassa-clarity`). Educational mayor sim: cash always felt inevitably red and opaque.

## Goals

1. **Playable monthly net** after BDAP hydrate (soft debt + surplus floor).
2. **Clear Cassa UI**: month forecast breakdown + actionable hint.

## Model

Constants (in `packages/comuni-data`, next to BDAP mapping — no sim↔comuni-data dependency):

| Constant | Value | Rule |
| --- | --- | --- |
| `MIN_MONTHLY_SURPLUS` | `5_000` | After computing income/maintenance from yearly BDAP, if `income - maintenance < 5000`, set `maintenance = max(0, income - 5000)`. Do not inflate income. |
| `DEBT_CAP_MONTHS` | `36` | After `mapBdapOpeningDebt`, `openingDebt = min(raw, monthlyBaseIncome * 36)`. |

Debt **service** formula unchanged: `ceil(debt / 240)` in `packages/sim` (`DEBT_HORIZON_MONTHS`).

Apply surplus floor inside `mapBdapToBudget`. Apply debt cap in both hydrate paths (`hydrateComune` + `buildSeedFromRows`) after assigning `openingDebt`.

Fixture Santa Maria Imbaro already has positive surplus and debt 0 — unchanged.

## UI

Cassa side panel:

- Available cash (existing)
- Residual debt if `> 0` (existing)
- **Previsione mese**: entrate base +, manutenzione −, personale assunti −, rata mutuo − (0 if no debt), **netto** highlighted
- Hint only if `net < 0`:
  - with hired staff → «Congeda personale o chiedi fondi alla Provincia»
  - else → «Chiedi fondi alla Provincia (esito in ~2 mesi)»

`forecastMonthCash(state)` in `packages/sim`: same structural cash math as `advanceMonth` (income − maintenance − staff − debt service), no RNG / province / events. Sticky header stays cash-only.

## Out of scope

Income-generating projects, runtime bailouts, balance history charts, project/event cost rebalance.

## Tests

- `mapBdapToBudget` lowers maintenance when surplus would be &lt; 5k; income unchanged
- Debt cap: raw debt above `income × 36` → capped
- `forecastMonthCash` net matches structural portion of `advanceMonth`
- Light UI: Cassa shows «Previsione mese» / netto after starting a game
