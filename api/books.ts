import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib';

// GET /api/books  ->  the autocomplete list (titles only; never reveals today's answer)
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { data, error } = await db.from('books').select('id,title,author,aliases').order('title');
  if (error) return res.status(500).json({ error: 'Could not load books' });
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.json(data);
}