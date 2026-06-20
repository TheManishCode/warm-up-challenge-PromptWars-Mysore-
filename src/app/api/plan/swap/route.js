import { getActivePlan, getUserProfile, swapMealInPlan, readDb } from '@/lib/db';
import { generateAISingleMealSwap } from '@/lib/gemini';

export async function POST(request) {
  try {
    const { mealId, requestText } = await request.json();
    if (!mealId || !requestText) {
      return Response.json({ error: 'Missing mealId or requestText' }, { status: 400 });
    }

    const db = await readDb();
    const oldMeal = db.meals.find(m => m.id === mealId);
    if (!oldMeal) {
      return Response.json({ error: 'Meal not found in database' }, { status: 404 });
    }

    const profile = await getUserProfile();
    const swapData = await generateAISingleMealSwap(profile, oldMeal.type, requestText);

    const updatedPlan = await swapMealInPlan(
      mealId,
      swapData.meal,
      swapData.groceryItems,
      swapData.substitutions
    );

    return Response.json(updatedPlan);
  } catch (error) {
    console.error('Failed to swap meal', error);
    return Response.json({ error: 'Failed to swap meal' }, { status: 500 });
  }
}
