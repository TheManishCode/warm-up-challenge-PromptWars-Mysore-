import { describe, it, expect } from 'vitest';
import { calculateGroceryTotal, evaluateBudget } from '../lib/utils.js';

describe('Budget Calculation & Feasibility Tests', () => {
  it('should sum only items that need to be bought (source: needed)', () => {
    const items = [
      { item: 'Eggs', est_cost: 2.50, source: 'needed' },
      { item: 'Bacon', est_cost: 4.80, source: 'needed' },
      { item: 'Salt', est_cost: 1.00, source: 'pantry' }, // Already in pantry, should be excluded
      { item: 'Sugar', est_cost: 2.00, source: 'pantry' } // Already in pantry, should be excluded
    ];

    const total = calculateGroceryTotal(items);
    expect(total).toBe(7.30); // 2.50 + 4.80
  });

  it('should return 0 for empty lists or invalid items', () => {
    expect(calculateGroceryTotal([])).toBe(0);
    expect(calculateGroceryTotal(null)).toBe(0);
    expect(calculateGroceryTotal([{ item: 'Pancakes', est_cost: null, source: 'needed' }])).toBe(0);
  });

  it('should evaluate budget feasibility correctly', () => {
    // Under budget
    const result1 = evaluateBudget(15.50, 30.00);
    expect(result1.feasible).toBe(true);
    expect(result1.diff).toBe(14.50);
    expect(result1.totalCost).toBe(15.50);
    expect(result1.budget).toBe(30.00);

    // Over budget
    const result2 = evaluateBudget(45.20, 30.00);
    expect(result2.feasible).toBe(false);
    expect(result2.diff).toBe(15.20);

    // Exactly at budget
    const result3 = evaluateBudget(30.00, 30.00);
    expect(result3.feasible).toBe(true);
    expect(result3.diff).toBe(0.00);
  });
});
