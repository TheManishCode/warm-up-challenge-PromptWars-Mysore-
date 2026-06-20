import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the Gemini SDK using a proper constructor class.
// We export `_generateContentMock` so we can configure it within our tests.
vi.mock('@google/generative-ai', () => {
  const generateContentMock = vi.fn();

  class GoogleGenerativeAI {
    constructor(apiKey) {
      this.apiKey = apiKey;
    }
    getGenerativeModel(config) {
      return {
        generateContent: generateContentMock
      };
    }
  }

  return {
    GoogleGenerativeAI,
    _generateContentMock: generateContentMock
  };
});

// Now import the mock and the functions to test
import { GoogleGenerativeAI, _generateContentMock } from '@google/generative-ai';
import { generateAISuggestedPlan, generateAISingleMealSwap } from '../lib/gemini.js';

describe('Gemini AI Service Tests (Mocked API)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw an error if no API key is provided', async () => {
    const userProfile = {
      dietary_restrictions: [],
      household_size: 1,
      default_budget: 30.00,
      gemini_api_key: '' // Empty key
    };

    // Temporarily clear environment variables to verify check
    const originalEnvKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(generateAISuggestedPlan(userProfile)).rejects.toThrow(
      'Gemini API key is required'
    );

    await expect(generateAISingleMealSwap(userProfile, 'breakfast', 'pasta')).rejects.toThrow(
      'Gemini API key is required'
    );

    // Restore environment variable
    process.env.GEMINI_API_KEY = originalEnvKey;
  });

  it('should query Gemini and parse dynamic meal plans', async () => {
    const mockOutput = {
      meals: [
        { type: 'breakfast', name: 'Oats with Fruit', description: 'Fresh oats', cook_time: '10m' },
        { type: 'lunch', name: 'Chickpea Salad', description: 'Crisp green salad', cook_time: '15m' },
        { type: 'dinner', name: 'Curried Tofu', description: 'Warm tofu curry', cook_time: '25m' }
      ],
      groceryItems: [
        { item: 'Oats', category: 'Pantry', est_cost: 3.50, meal_type: 'breakfast' },
        { item: 'Chickpeas', category: 'Canned', est_cost: 1.50, meal_type: 'lunch' }
      ],
      substitutions: [
        { meal_type: 'breakfast', original: 'Berries', substitute: 'Apples', reason: 'Seasonal cost save' }
      ]
    };

    _generateContentMock.mockResolvedValue({
      response: {
        text: () => JSON.stringify(mockOutput)
      }
    });

    const userProfile = {
      dietary_restrictions: ['Vegetarian'],
      household_size: 2,
      default_budget: 45.00,
      gemini_api_key: 'fake_test_key'
    };

    const result = await generateAISuggestedPlan(userProfile, 'Make it simple');
    expect(result.meals.length).toBe(3);
    expect(result.meals[0].name).toBe('Oats with Fruit');
    expect(result.groceryItems.length).toBe(2);
    expect(result.substitutions[0].substitute).toBe('Apples');
  });

  it('should query Gemini and parse meal swaps', async () => {
    const mockSwapOutput = {
      meal: {
        name: 'Veggie Tacos',
        description: 'Tacos filled with fresh black beans',
        cook_time: '15m'
      },
      groceryItems: [
        { item: 'Taco Shells', category: 'Pantry', est_cost: 2.00 },
        { item: 'Black Beans', category: 'Canned', est_cost: 1.20 }
      ],
      substitutions: [
        { original: 'Black Beans', substitute: 'Lentils', reason: 'Alternative legume' }
      ]
    };

    _generateContentMock.mockResolvedValue({
      response: {
        text: () => JSON.stringify(mockSwapOutput)
      }
    });

    const userProfile = {
      dietary_restrictions: ['Vegan'],
      household_size: 1,
      default_budget: 20.00,
      gemini_api_key: 'fake_test_key'
    };

    const result = await generateAISingleMealSwap(userProfile, 'dinner', 'tacos');
    expect(result.meal.name).toBe('Veggie Tacos');
    expect(result.groceryItems[0].meal_type).toBe('dinner');
    expect(result.substitutions[0].original).toBe('Black Beans');
  });
});
