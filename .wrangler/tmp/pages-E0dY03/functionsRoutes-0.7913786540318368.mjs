import { onRequestDelete as __api_budgets__year__ts_onRequestDelete } from "/Users/tobias/Documents/Repositories/tobiasbay.me/budget.tobiasbay.me/functions/api/budgets/[year].ts"
import { onRequest as __api_budgets_ts_onRequest } from "/Users/tobias/Documents/Repositories/tobiasbay.me/budget.tobiasbay.me/functions/api/budgets.ts"

export const routes = [
    {
      routePath: "/api/budgets/:year",
      mountPath: "/api/budgets",
      method: "DELETE",
      middlewares: [],
      modules: [__api_budgets__year__ts_onRequestDelete],
    },
  {
      routePath: "/api/budgets",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_budgets_ts_onRequest],
    },
  ]