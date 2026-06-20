import { describe, it, expect, beforeEach } from 'vitest';
import { 
  resetDatabase, 
  getUserProfile, 
  updateUserProfile, 
  getActivePlan, 
  saveActivePlan, 
  toggleGroceryItem, 
  toggleGroceryItemSource,
  swapMealInPlan 
} from '../lib/db.js';

describe('JSON Database Controller Tests', () => {
  beforeEach(async () => {
    // Reset database to clean default state before each test
    await resetDatabase();
  });

  it('should get and update the user profile', async () => {
    const defaultProfile = await getUserProfile();
    expect(defaultProfile.household_size).toBe(1);
    expect(defaultProfile.dietary_restrictions).toEqual([]);

    const updatedProfile = await updateUserProfile({
      dietary_restrictions: ['vegan', 'gluten-free'],
      household_size: 4,
      default_budget: 120.00
    });

    expect(updatedProfile.household_size).toBe(4);
    expect(updatedProfile.dietary_restrictions).toEqual(['vegan', 'gluten-free']);
    expect(updatedProfile.default_budget).toBe(120.00);

    const fetchedProfile = await getUserProfile();
    expect(fetchedProfile.household_size).toBe(4);
  });

  it('should save and get active plan details', async () => {
    const initialPlan = await getActivePlan();
    expect(initialPlan).toBeNull();

    const planData = {
      plan: { id: 'test_plan_123', date: '2026-06-20' },
      meals: [
        { type: 'breakfast', name: 'Oatmeal', description: 'Oatmeal with berries', cook_time: '10m' },
        { type: 'lunch', name: 'Salad', description: 'Green salad with chickpeas', cook_time: '15m' },
        { type: 'dinner', name: 'Tofu stir fry', description: 'Tofu and veggies with rice', cook_time: '25m' }
      ],
      groceryItems: [
        { item: 'Oats', category: 'Pantry', est_cost: 3.50, meal_type: 'breakfast' },
        { item: 'Berries', category: 'Produce', est_cost: 4.00, meal_type: 'breakfast' },
        { item: 'Chickpeas', category: 'Canned', est_cost: 1.50, meal_type: 'lunch' },
        { item: 'Tofu', category: 'Refrigerated', est_cost: 2.00, meal_type: 'dinner' }
      ],
      substitutions: [
        { meal_type: 'breakfast', original: 'Berries', substitute: 'Banana', reason: 'Lower cost alternative' }
      ]
    };

    const saved = await saveActivePlan(planData);
    expect(saved.id).toBe('test_plan_123');
    expect(saved.meals.length).toBe(3);
    expect(saved.groceryItems.length).toBe(4);
    expect(saved.substitutions.length).toBe(1);

    const activePlan = await getActivePlan();
    expect(activePlan).not.toBeNull();
    expect(activePlan.id).toBe('test_plan_123');
    expect(activePlan.meals[0].name).toBe('Oatmeal');
    expect(activePlan.groceryItems[0].checked).toBe(false);
    expect(activePlan.groceryItems[0].source).toBe('needed');
  });

  it('should check/uncheck grocery items and change source', async () => {
    const planData = {
      plan: { id: 'test_plan_123' },
      meals: [{ type: 'breakfast', name: 'Oatmeal' }],
      groceryItems: [{ item: 'Oats', category: 'Pantry', est_cost: 3.50, meal_type: 'breakfast' }],
      substitutions: []
    };
    await saveActivePlan(planData);

    const activePlan = await getActivePlan();
    const itemId = activePlan.groceryItems[0].id;

    // Toggle checked
    const updatedItem = await toggleGroceryItem(itemId, true);
    expect(updatedItem.checked).toBe(true);

    const recheckedPlan = await getActivePlan();
    expect(recheckedPlan.groceryItems[0].checked).toBe(true);

    // Toggle source
    const updatedSource = await toggleGroceryItemSource(itemId, 'pantry');
    expect(updatedSource.source).toBe('pantry');

    const resourcePlan = await getActivePlan();
    expect(resourcePlan.groceryItems[0].source).toBe('pantry');
  });

  it('should swap a meal in the plan', async () => {
    const planData = {
      plan: { id: 'test_plan_123' },
      meals: [
        { id: 'meal_breakfast_1', type: 'breakfast', name: 'Oatmeal', description: 'Oatmeal with berries' }
      ],
      groceryItems: [
        { item: 'Oats', category: 'Pantry', est_cost: 3.50, checked: false, meal_type: 'breakfast' },
        { item: 'Berries', category: 'Produce', est_cost: 4.00, checked: false, meal_type: 'breakfast' }
      ],
      substitutions: []
    };
    await saveActivePlan(planData);

    const newMeal = { type: 'breakfast', name: 'Pancakes', description: 'Pancakes with maple syrup' };
    const newGroceries = [
      { item: 'Flour', category: 'Pantry', est_cost: 2.00 },
      { item: 'Maple syrup', category: 'Pantry', est_cost: 5.00 }
    ];
    const newSubs = [
      { original: 'Maple syrup', substitute: 'Honey', reason: 'Already in pantry' }
    ];

    const resultPlan = await swapMealInPlan('meal_breakfast_1', newMeal, newGroceries, newSubs);
    expect(resultPlan.meals[0].name).toBe('Pancakes');
    
    // Checked items (if any, like Oats) remain, but Oats/Berries are filtered out since they are unchecked and replaced
    const items = resultPlan.groceryItems.map(g => g.item);
    expect(items).toContain('Flour');
    expect(items).toContain('Maple syrup');
    expect(items).not.toContain('Berries'); // Cleaned up old meal's unchecked items

    expect(resultPlan.substitutions[0].substitute).toBe('Honey');
  });
});
