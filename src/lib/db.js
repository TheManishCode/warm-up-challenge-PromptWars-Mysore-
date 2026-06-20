import { promises as fs } from 'fs';
import path from 'path';

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const DB_FILE = path.join(process.cwd(), 'data', isTest ? 'db.test.json' : 'db.json');

// Initialize database template
const DEFAULT_DB = {
  user: {
    dietary_restrictions: [],
    household_size: 1,
    default_budget: 30.00,
    gemini_api_key: ''
  },
  plans: [], // Array of plans: { id, date, status }
  meals: [], // Array of meals: { id, plan_id, type (breakfast/lunch/dinner), name, description, cook_time }
  groceryItems: [], // Array of items: { id, plan_id, category, item, est_cost, checked (bool), source (pantry/needed) }
  substitutions: [] // Array of subs: { id, meal_id, original, substitute, reason }
};

// Global in-memory fallback state for read-only serverless platforms like Vercel
let memoryDb = null;
let useMemoryDb = false;

// Helper to ensure database file exists
async function ensureDb() {
  if (useMemoryDb) return;
  const dir = path.dirname(DB_FILE);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    // Already exists or can't create
  }

  try {
    await fs.access(DB_FILE);
  } catch (err) {
    try {
      await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    } catch (writeErr) {
      console.warn('Failed to write database file. Falling back to in-memory database.', writeErr);
      useMemoryDb = true;
      memoryDb = JSON.parse(JSON.stringify(DEFAULT_DB));
    }
  }
}

// Read database
export async function readDb() {
  if (useMemoryDb) {
    return memoryDb;
  }

  try {
    await ensureDb();
    if (useMemoryDb) return memoryDb; // Check if fell back during ensureDb
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.warn('Failed to read database file. Falling back to in-memory database.', err);
    useMemoryDb = true;
    memoryDb = JSON.parse(JSON.stringify(DEFAULT_DB));
    return memoryDb;
  }
}

// Write database
export async function writeDb(data) {
  if (useMemoryDb) {
    memoryDb = data;
    return true;
  }

  try {
    await ensureDb();
    if (useMemoryDb) {
      memoryDb = data;
      return true;
    }
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn('Failed to write database file. Falling back to in-memory database.', err);
    useMemoryDb = true;
    memoryDb = data;
    return true;
  }
}

// User Profile Operations
export async function getUserProfile() {
  const db = await readDb();
  return db.user;
}

export async function updateUserProfile(profile) {
  const db = await readDb();
  db.user = {
    ...db.user,
    ...profile
  };
  await writeDb(db);
  return db.user;
}

// Plan Operations
export async function getActivePlan() {
  const db = await readDb();
  const activePlan = db.plans.find(p => p.status === 'active');
  if (!activePlan) return null;

  const planId = activePlan.id;
  const meals = db.meals.filter(m => m.plan_id === planId);
  const groceryItems = db.groceryItems.filter(g => g.plan_id === planId);
  const substitutions = db.substitutions.filter(s => meals.some(m => m.id === s.meal_id));

  return {
    ...activePlan,
    meals,
    groceryItems,
    substitutions
  };
}

export async function saveActivePlan({ plan, meals, groceryItems, substitutions }) {
  const db = await readDb();

  // Mark all old active plans as completed
  db.plans = db.plans.map(p => p.status === 'active' ? { ...p, status: 'completed' } : p);

  // Add new plan
  const newPlan = {
    id: plan?.id || `plan_${Date.now()}`,
    date: plan?.date || new Date().toISOString().split('T')[0],
    status: 'active'
  };
  db.plans.push(newPlan);

  // Filter out old meals/groceryItems/substitutions for this plan_id if overwritten
  db.meals = db.meals.filter(m => m.plan_id !== newPlan.id);
  db.groceryItems = db.groceryItems.filter(g => g.plan_id !== newPlan.id);
  
  // Save meals
  const savedMeals = meals.map(m => ({
    ...m,
    id: m.id || `meal_${Math.random().toString(36).substring(2, 9)}`,
    plan_id: newPlan.id
  }));
  db.meals.push(...savedMeals);

  // Save groceries
  const savedGroceries = groceryItems.map(g => {
    const matchedMeal = savedMeals.find(m => m.name === g.meal_name || m.type === g.meal_type);
    return {
      ...g,
      id: g.id || `grocery_${Math.random().toString(36).substring(2, 9)}`,
      plan_id: newPlan.id,
      meal_id: matchedMeal ? matchedMeal.id : (g.meal_id || null),
      checked: g.checked || false,
      source: g.source || 'needed' // 'needed' or 'pantry'
    };
  });
  db.groceryItems.push(...savedGroceries);

  // Save substitutions
  const savedSubs = substitutions.map(s => {
    // Find matching meal name and map to savedMeals id
    const matchedMeal = savedMeals.find(m => m.name === s.meal_name || m.type === s.meal_type);
    return {
      ...s,
      id: s.id || `sub_${Math.random().toString(36).substring(2, 9)}`,
      meal_id: matchedMeal ? matchedMeal.id : (s.meal_id || '')
    };
  });
  db.substitutions.push(...savedSubs);

  await writeDb(db);

  return {
    ...newPlan,
    meals: savedMeals,
    groceryItems: savedGroceries,
    substitutions: savedSubs
  };
}

// Update Grocery Item Checked State
export async function toggleGroceryItem(itemId, checked) {
  const db = await readDb();
  db.groceryItems = db.groceryItems.map(g => 
    g.id === itemId ? { ...g, checked } : g
  );
  await writeDb(db);
  return db.groceryItems.find(g => g.id === itemId);
}

// Update Grocery Item Source (pantry/needed)
export async function toggleGroceryItemSource(itemId, source) {
  const db = await readDb();
  db.groceryItems = db.groceryItems.map(g => 
    g.id === itemId ? { ...g, source } : g
  );
  await writeDb(db);
  return db.groceryItems.find(g => g.id === itemId);
}

// Swap a Single Meal
export async function swapMealInPlan(mealId, newMeal, newGroceries, newSubs) {
  const db = await readDb();
  
  // Find meal
  const mealIndex = db.meals.findIndex(m => m.id === mealId);
  if (mealIndex === -1) return null;
  const planId = db.meals[mealIndex].plan_id;

  // Replace meal
  db.meals[mealIndex] = {
    ...newMeal,
    id: mealId,
    plan_id: planId
  };

  // Remove old grocery items belonging to this meal
  db.groceryItems = db.groceryItems.filter(g => g.meal_id !== mealId);

  // Add new grocery items
  if (newGroceries && newGroceries.length > 0) {
    const savedGroceries = newGroceries.map(g => ({
      ...g,
      id: g.id || `grocery_${Math.random().toString(36).substring(2, 9)}`,
      plan_id: planId,
      meal_id: mealId,
      checked: false,
      source: 'needed'
    }));
    db.groceryItems.push(...savedGroceries);
  }

  // Remove old substitutions for this meal
  db.substitutions = db.substitutions.filter(s => s.meal_id !== mealId);

  // Add new substitutions
  if (newSubs && newSubs.length > 0) {
    const savedSubs = newSubs.map(s => ({
      ...s,
      id: s.id || `sub_${Math.random().toString(36).substring(2, 9)}`,
      meal_id: mealId
    }));
    db.substitutions.push(...savedSubs);
  }

  await writeDb(db);
  return getActivePlan();
}

// Reset Database (for clean tests)
export async function resetDatabase() {
  await writeDb(DEFAULT_DB);
}
