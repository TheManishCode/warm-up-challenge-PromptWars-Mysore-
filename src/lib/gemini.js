import { GoogleGenerativeAI } from '@google/generative-ai';

// Generation Schema for Structured JSON Output
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    meals: {
      type: 'ARRAY',
      description: 'The list of planned meals',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['breakfast', 'lunch', 'dinner'], description: 'Meal type' },
          name: { type: 'STRING', description: 'Name of the meal' },
          description: { type: 'STRING', description: 'A short appetizing description of the meal' },
          cook_time: { type: 'STRING', description: 'Estimated cook time, e.g. 15m' }
        },
        required: ['type', 'name', 'description', 'cook_time']
      }
    },
    groceryItems: {
      type: 'ARRAY',
      description: 'The list of grocery ingredients needed for these meals',
      items: {
        type: 'OBJECT',
        properties: {
          item: { type: 'STRING', description: 'Name of the ingredient item' },
          category: { type: 'STRING', enum: ['Produce', 'Meat', 'Dairy', 'Bakery', 'Pantry', 'Canned', 'Frozen', 'Refrigerated', 'Other'], description: 'Supermarket aisle category' },
          est_cost: { type: 'NUMBER', description: 'Estimated cost in USD, e.g. 3.50' },
          meal_type: { type: 'STRING', enum: ['breakfast', 'lunch', 'dinner'], description: 'Which meal type this ingredient is for' }
        },
        required: ['item', 'category', 'est_cost', 'meal_type']
      }
    },
    substitutions: {
      type: 'ARRAY',
      description: 'Common ingredient substitutions for dietary or cost optimization reasons',
      items: {
        type: 'OBJECT',
        properties: {
          meal_type: { type: 'STRING', enum: ['breakfast', 'lunch', 'dinner'], description: 'Meal type associated' },
          original: { type: 'STRING', description: 'Original ingredient' },
          substitute: { type: 'STRING', description: 'Suggested replacement' },
          reason: { type: 'STRING', description: 'Why this is a good alternative' }
        },
        required: ['meal_type', 'original', 'substitute', 'reason']
      }
    }
  },
  required: ['meals', 'groceryItems', 'substitutions']
};

/**
 * Calls Gemini API to generate a structured meal plan.
 * Throws an error if API key is not configured.
 */
export async function generateAISuggestedPlan(userProfile, customPrompt = '') {
  const apiKey = userProfile.gemini_api_key || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key is required. Please set GEMINI_API_KEY or update settings.');
  }

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const dietList = (userProfile.dietary_restrictions || []).join(', ') || 'none';
  const householdSize = userProfile.household_size || 1;
  const budget = userProfile.default_budget || 50;

  const systemPrompt = `You are a professional meal planner assistant.
Your goal is to build a structured 1-day meal plan (Breakfast, Lunch, Dinner) based on the user's settings.
User Settings:
- Dietary restrictions: ${dietList}
- Household size: ${householdSize} people
- Daily target budget for all ingredients combined: $${budget}
${customPrompt ? `Additional User Request: "${customPrompt}"` : ''}

Crucial Rules:
1. All estimated ingredient costs MUST reflect the household size of ${householdSize} people.
2. Ensure ingredients in the grocery list correspond exactly to the recipe requirements.
3. Offer at least one practical, cost-effective substitution per meal.
4. Keep the output fully aligned with the requested JSON schema.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA
    }
  });

  const text = result.response.text();
  return JSON.parse(text);
}

/**
 * Calls Gemini to generate a single replaced meal based on a user's swap request.
 */
export async function generateAISingleMealSwap(userProfile, mealType, requestText) {
  const apiKey = userProfile.gemini_api_key || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key is required. Please set GEMINI_API_KEY or update settings.');
  }

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const dietList = (userProfile.dietary_restrictions || []).join(', ') || 'none';
  const size = userProfile.household_size || 1;

  const systemPrompt = `You are a meal planning helper.
The user wants to replace their current "${mealType}" meal with a request/preference: "${requestText}".
Suggest a suitable replacement meal, its aisle grocery ingredients, and any logical ingredient substitutions.

User Profile:
- Dietary restrictions: ${dietList}
- Household size: ${size} people

Ensure that estimated grocery item costs are scaled for ${size} people.
Format the output to fit this JSON schema:
{
  "meal": {
    "type": "${mealType}",
    "name": "name of the meal",
    "description": "short recipe description",
    "cook_time": "time estimate, e.g. 15m"
  },
  "groceryItems": [
    { "item": "name of ingredient", "category": "Produce|Meat|Dairy|Bakery|Pantry|Canned|Frozen|Refrigerated|Other", "est_cost": estimated_cost_number }
  ],
  "substitutions": [
    { "original": "original ingredient", "substitute": "suggested replacement", "reason": "why" }
  ]
}`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const text = result.response.text();
  const data = JSON.parse(text);
  
  if (!data.meal || !data.groceryItems) {
    throw new Error('Invalid schema from Gemini');
  }

  return {
    meal: { ...data.meal, type: mealType },
    groceryItems: data.groceryItems.map(g => ({ ...g, meal_type: mealType })),
    substitutions: (data.substitutions || []).map(s => ({ ...s, meal_type: mealType }))
  };
}
