import { toggleGroceryItem, toggleGroceryItemSource } from '@/lib/db';

export async function POST(request) {
  try {
    const { itemId, checked } = await request.json();
    if (!itemId || checked === undefined) {
      return Response.json({ error: 'Missing itemId or checked value' }, { status: 400 });
    }

    const updated = await toggleGroceryItem(itemId, checked);
    if (!updated) {
      return Response.json({ error: 'Grocery item not found' }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: 'Failed to update checked status' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { itemId, source } = await request.json();
    if (!itemId || !source) {
      return Response.json({ error: 'Missing itemId or source value' }, { status: 400 });
    }

    if (source !== 'pantry' && source !== 'needed') {
      return Response.json({ error: 'Source must be either pantry or needed' }, { status: 400 });
    }

    const updated = await toggleGroceryItemSource(itemId, source);
    if (!updated) {
      return Response.json({ error: 'Grocery item not found' }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: 'Failed to update item source' }, { status: 500 });
  }
}
