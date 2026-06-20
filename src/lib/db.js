import { promises as fs } from 'fs';
import path from 'path';
import { Pool } from 'pg';

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
  plans: [],
  meals: [],
  groceryItems: [],
  substitutions: []
};

// Global in-memory fallback state
let memoryDb = null;
let useMemoryDb = false;

// Postgres Connection Pool Setup
let pgPool = null;
let pgInitialized = false;

function getPgPool() {
  if (isTest || !process.env.DATABASE_URL) return null;
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    pgPool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false 
        : { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

// Automatically create tables on database init if using Postgres
async function initPgTables(pool) {
  if (pgInitialized) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS savor_users (
        id VARCHAR(50) PRIMARY KEY,
        dietary_restrictions JSONB,
        household_size INTEGER,
        default_budget NUMERIC(10, 2),
        gemini_api_key VARCHAR(255)
      );
      CREATE TABLE IF NOT EXISTS savor_plans (
        id VARCHAR(50) PRIMARY KEY,
        date VARCHAR(20),
        status VARCHAR(20)
      );
      CREATE TABLE IF NOT EXISTS savor_meals (
        id VARCHAR(50) PRIMARY KEY,
        plan_id VARCHAR(50),
        type VARCHAR(20),
        name VARCHAR(255),
        description TEXT,
        cook_time VARCHAR(20)
      );
      CREATE TABLE IF NOT EXISTS savor_grocery_items (
        id VARCHAR(50) PRIMARY KEY,
        plan_id VARCHAR(50),
        meal_id VARCHAR(50),
        category VARCHAR(50),
        item VARCHAR(255),
        est_cost NUMERIC(10, 2),
        checked BOOLEAN,
        source VARCHAR(20)
      );
      CREATE TABLE IF NOT EXISTS savor_substitutions (
        id VARCHAR(50) PRIMARY KEY,
        meal_id VARCHAR(50),
        original VARCHAR(255),
        substitute VARCHAR(255),
        reason TEXT
      );
    `);
    pgInitialized = true;
  } catch (err) {
    console.error('Failed to initialize PostgreSQL tables', err);
  } finally {
    client.release();
  }
}

// Local File Helper to ensure database file exists
async function ensureDb() {
  if (useMemoryDb) return;
  const dir = path.dirname(DB_FILE);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    // Already exists
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

// Read database (JSON fallback helper)
export async function readDb() {
  if (useMemoryDb) {
    return memoryDb;
  }

  try {
    await ensureDb();
    if (useMemoryDb) return memoryDb;
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.warn('Failed to read database file. Falling back to in-memory database.', err);
    useMemoryDb = true;
    memoryDb = JSON.parse(JSON.stringify(DEFAULT_DB));
    return memoryDb;
  }
}

// Write database (JSON fallback helper)
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

// ==========================================
// Persistent User Profile Operations
// ==========================================
export async function getUserProfile() {
  const pool = getPgPool();
  if (pool) {
    await initPgTables(pool);
    const res = await pool.query('SELECT * FROM savor_users WHERE id = $1', ['default_user']);
    if (res.rows.length > 0) {
      return {
        dietary_restrictions: res.rows[0].dietary_restrictions || [],
        household_size: Number(res.rows[0].household_size) || 1,
        default_budget: Number(res.rows[0].default_budget) || 30.00,
        gemini_api_key: res.rows[0].gemini_api_key || ''
      };
    }
    return DEFAULT_DB.user;
  }

  const db = await readDb();
  return db.user;
}

export async function updateUserProfile(profile) {
  const pool = getPgPool();
  if (pool) {
    await initPgTables(pool);
    const restrictions = JSON.stringify(profile.dietary_restrictions || []);
    const size = profile.household_size || 1;
    const budget = profile.default_budget || 30.00;
    const key = profile.gemini_api_key || '';

    await pool.query(`
      INSERT INTO savor_users (id, dietary_restrictions, household_size, default_budget, gemini_api_key)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE 
      SET dietary_restrictions = $2, household_size = $3, default_budget = $4, gemini_api_key = $5
    `, ['default_user', restrictions, size, budget, key]);

    return {
      dietary_restrictions: profile.dietary_restrictions || [],
      household_size: size,
      default_budget: budget,
      gemini_api_key: key
    };
  }

  const db = await readDb();
  db.user = {
    ...db.user,
    ...profile
  };
  await writeDb(db);
  return db.user;
}

// ==========================================
// Persistent Meal Plan Operations
// ==========================================
export async function getActivePlan() {
  const pool = getPgPool();
  if (pool) {
    await initPgTables(pool);
    const planRes = await pool.query("SELECT * FROM savor_plans WHERE status = 'active' LIMIT 1");
    if (planRes.rows.length === 0) return null;

    const plan = planRes.rows[0];
    const mealsRes = await pool.query('SELECT * FROM savor_meals WHERE plan_id = $1', [plan.id]);
    const groceriesRes = await pool.query('SELECT * FROM savor_grocery_items WHERE plan_id = $1', [plan.id]);
    
    const meals = mealsRes.rows;
    const groceryItems = groceriesRes.rows.map(g => ({ ...g, est_cost: Number(g.est_cost) }));

    const substitutionsRes = await pool.query(
      'SELECT * FROM savor_substitutions WHERE meal_id = ANY($1)',
      [meals.map(m => m.id)]
    );
    const substitutions = substitutionsRes.rows;

    return {
      id: plan.id,
      date: plan.date,
      status: plan.status,
      meals,
      groceryItems,
      substitutions
    };
  }

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
  const pool = getPgPool();
  if (pool) {
    await initPgTables(pool);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Mark old active plans as completed
      await client.query("UPDATE savor_plans SET status = 'completed' WHERE status = 'active'");

      const newPlanId = plan?.id || `plan_${Date.now()}`;
      const date = plan?.date || new Date().toISOString().split('T')[0];

      // Save plan
      await client.query(
        "INSERT INTO savor_plans (id, date, status) VALUES ($1, $2, 'active')",
        [newPlanId, date]
      );

      // Save meals
      const savedMeals = [];
      for (const m of meals) {
        const id = m.id || `meal_${Math.random().toString(36).substring(2, 9)}`;
        await client.query(
          'INSERT INTO savor_meals (id, plan_id, type, name, description, cook_time) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, newPlanId, m.type, m.name, m.description, m.cook_time]
        );
        savedMeals.push({ ...m, id, plan_id: newPlanId });
      }

      // Save groceries
      const savedGroceries = [];
      for (const g of groceryItems) {
        const id = g.id || `grocery_${Math.random().toString(36).substring(2, 9)}`;
        const matchedMeal = savedMeals.find(m => m.name === g.meal_name || m.type === g.meal_type);
        const mealId = matchedMeal ? matchedMeal.id : (g.meal_id || null);
        const cost = g.est_cost || 0.00;
        
        await client.query(
          'INSERT INTO savor_grocery_items (id, plan_id, meal_id, category, item, est_cost, checked, source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [id, newPlanId, mealId, g.category, g.item, cost, false, g.source || 'needed']
        );
        savedGroceries.push({ ...g, id, plan_id: newPlanId, meal_id: mealId, checked: false, source: g.source || 'needed', est_cost: Number(cost) });
      }

      // Save substitutions
      const savedSubs = [];
      for (const s of substitutions) {
        const id = s.id || `sub_${Math.random().toString(36).substring(2, 9)}`;
        const matchedMeal = savedMeals.find(m => m.name === s.meal_name || m.type === s.meal_type);
        const mealId = matchedMeal ? matchedMeal.id : (s.meal_id || null);

        await client.query(
          'INSERT INTO savor_substitutions (id, meal_id, original, substitute, reason) VALUES ($1, $2, $3, $4, $5)',
          [id, mealId, s.original, s.substitute, s.reason]
        );
        savedSubs.push({ ...s, id, meal_id: mealId });
      }

      await client.query('COMMIT');
      return { id: newPlanId, date, status: 'active', meals: savedMeals, groceryItems: savedGroceries, substitutions: savedSubs };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

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

  db.meals = db.meals.filter(m => m.plan_id !== newPlan.id);
  db.groceryItems = db.groceryItems.filter(g => g.plan_id !== newPlan.id);
  
  const savedMeals = meals.map(m => ({
    ...m,
    id: m.id || `meal_${Math.random().toString(36).substring(2, 9)}`,
    plan_id: newPlan.id
  }));
  db.meals.push(...savedMeals);

  const savedGroceries = groceryItems.map(g => {
    const matchedMeal = savedMeals.find(m => m.name === g.meal_name || m.type === g.meal_type);
    return {
      ...g,
      id: g.id || `grocery_${Math.random().toString(36).substring(2, 9)}`,
      plan_id: newPlan.id,
      meal_id: matchedMeal ? matchedMeal.id : (g.meal_id || null),
      checked: g.checked || false,
      source: g.source || 'needed'
    };
  });
  db.groceryItems.push(...savedGroceries);

  const savedSubs = substitutions.map(s => {
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

// Toggle Grocery Item Checked State
export async function toggleGroceryItem(itemId, checked) {
  const pool = getPgPool();
  if (pool) {
    await initPgTables(pool);
    await pool.query('UPDATE savor_grocery_items SET checked = $1 WHERE id = $2', [checked, itemId]);
    const res = await pool.query('SELECT * FROM savor_grocery_items WHERE id = $1', [itemId]);
    return res.rows[0];
  }

  const db = await readDb();
  db.groceryItems = db.groceryItems.map(g => 
    g.id === itemId ? { ...g, checked } : g
  );
  await writeDb(db);
  return db.groceryItems.find(g => g.id === itemId);
}

// Toggle Grocery Item Source (pantry/needed)
export async function toggleGroceryItemSource(itemId, source) {
  const pool = getPgPool();
  if (pool) {
    await initPgTables(pool);
    await pool.query('UPDATE savor_grocery_items SET source = $1 WHERE id = $2', [source, itemId]);
    const res = await pool.query('SELECT * FROM savor_grocery_items WHERE id = $1', [itemId]);
    return res.rows[0];
  }

  const db = await readDb();
  db.groceryItems = db.groceryItems.map(g => 
    g.id === itemId ? { ...g, source } : g
  );
  await writeDb(db);
  return db.groceryItems.find(g => g.id === itemId);
}

// Swap a Single Meal
export async function swapMealInPlan(mealId, newMeal, newGroceries, newSubs) {
  const pool = getPgPool();
  if (pool) {
    await initPgTables(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update meal
      await client.query(
        'UPDATE savor_meals SET name = $1, description = $2, cook_time = $3 WHERE id = $4',
        [newMeal.name, newMeal.description, newMeal.cook_time, mealId]
      );

      // Remove old groceries belonging to this meal
      await client.query('DELETE FROM savor_grocery_items WHERE meal_id = $1', [mealId]);

      // Get plan_id
      const mealRes = await client.query('SELECT plan_id FROM savor_meals WHERE id = $1', [mealId]);
      const planId = mealRes.rows[0].plan_id;

      // Add new groceries
      if (newGroceries && newGroceries.length > 0) {
        for (const g of newGroceries) {
          const id = g.id || `grocery_${Math.random().toString(36).substring(2, 9)}`;
          await client.query(
            'INSERT INTO savor_grocery_items (id, plan_id, meal_id, category, item, est_cost, checked, source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, planId, mealId, g.category, g.item, g.est_cost || 0.00, false, 'needed']
          );
        }
      }

      // Remove old substitutions
      await client.query('DELETE FROM savor_substitutions WHERE meal_id = $1', [mealId]);

      // Add new substitutions
      if (newSubs && newSubs.length > 0) {
        for (const s of newSubs) {
          const id = s.id || `sub_${Math.random().toString(36).substring(2, 9)}`;
          await client.query(
            'INSERT INTO savor_substitutions (id, meal_id, original, substitute, reason) VALUES ($1, $2, $3, $4, $5)',
            [id, mealId, s.original, s.substitute, s.reason]
          );
        }
      }

      await client.query('COMMIT');
      return getActivePlan();
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const db = await readDb();
  
  const mealIndex = db.meals.findIndex(m => m.id === mealId);
  if (mealIndex === -1) return null;
  const planId = db.meals[mealIndex].plan_id;

  db.meals[mealIndex] = {
    ...newMeal,
    id: mealId,
    plan_id: planId
  };

  db.groceryItems = db.groceryItems.filter(g => g.meal_id !== mealId);

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

  db.substitutions = db.substitutions.filter(s => s.meal_id !== mealId);

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
  const pool = getPgPool();
  if (pool) {
    await initPgTables(pool);
    await pool.query('TRUNCATE savor_users, savor_plans, savor_meals, savor_grocery_items, savor_substitutions CASCADE');
    return;
  }
  await writeDb(DEFAULT_DB);
}
