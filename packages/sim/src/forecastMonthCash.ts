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
