/**
 * Computes the total shopping cost by summing ingredients that the user needs to buy
 * (i.e. source is 'needed'), ignoring items already in their pantry.
 */
export function calculateGroceryTotal(groceryItems) {
  if (!Array.isArray(groceryItems)) return 0;
  return groceryItems
    .filter(g => g.source === 'needed')
    .reduce((sum, item) => sum + (item.est_cost || 0), 0);
}

/**
 * Evaluates whether the shopping total fits within the target budget.
 */
export function evaluateBudget(totalCost, budget) {
  const costVal = Number(totalCost) || 0;
  const budgetVal = Number(budget) || 0;
  const diff = costVal - budgetVal;

  return {
    feasible: costVal <= budgetVal,
    diff: Number(Math.abs(diff).toFixed(2)),
    totalCost: Number(costVal.toFixed(2)),
    budget: Number(budgetVal.toFixed(2))
  };
}
