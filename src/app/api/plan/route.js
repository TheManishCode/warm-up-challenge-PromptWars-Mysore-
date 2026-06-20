import { getActivePlan, getUserProfile, saveActivePlan } from '@/lib/db';
import { generateAISuggestedPlan } from '@/lib/gemini';

export async function GET() {
  try {
    const plan = await getActivePlan();
    return Response.json(plan || { message: 'No active plan' }, { status: plan ? 200 : 404 });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch plan' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { customPrompt } = body;

    const profile = await getUserProfile();
    const generated = await generateAISuggestedPlan(profile, customPrompt);

    const savedPlan = await saveActivePlan({
      plan: { date: new Date().toISOString().split('T')[0] },
      meals: generated.meals,
      groceryItems: generated.groceryItems,
      substitutions: generated.substitutions
    });

    return Response.json(savedPlan);
  } catch (error) {
    console.error('Plan generation route failed', error);
    return Response.json({ error: 'Failed to generate meal plan' }, { status: 500 });
  }
}
