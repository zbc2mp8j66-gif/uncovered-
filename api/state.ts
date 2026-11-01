import type { VercelRequest, VercelResponse } from '@vercel/node';
import { today, validAnon, loadPuzzle, getOrCreatePlay, buildState } from './_lib.js';

// GET /api/state?anon=<uuid>  ->  today's hints (only those earned), guesses so far, and result if finished
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const anon = req.query.anon;
  if (!validAnon(anon)) return res.status(400).json({ error: 'Missing or invalid anon id' });
  const loaded = await loadPuzzle(today());
  if (!loaded) return res.status(404).json({ error: 'No puzzle scheduled for today' });
  const play = await getOrCreatePlay(loaded.puzzle.puzzle_date, anon);
  res.setHeader('Cache-Control', 'no-store');
  res.json(await buildState(loaded.puzzle, loaded.answer, play));
}