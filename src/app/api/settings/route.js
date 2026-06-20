import { getUserProfile, updateUserProfile } from '@/lib/db';

export async function GET() {
  try {
    const profile = await getUserProfile();
    return Response.json(profile);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const updated = await updateUserProfile(body);
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
