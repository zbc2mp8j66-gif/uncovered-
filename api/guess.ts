import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, MAX_GUESSES, today, validAnon, loadPuzzle, getOrCreatePlay, buildState } from './_lib.js';

// POST /api/guess  { anon: "<uuid>", bookId: 12 }   (bookId 0 = skip)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { anon, bookId } = req.body ?? {};
  if (!validAnon(anon) || !Number.isInteger(bookId) || bookId < 0) return res.status(400).json({ error: 'Bad request' });

  const loaded = await loadPuzzle(today());
  if (!loaded) return res.status(404).json({ error: 'No puzzle scheduled for today' });
  const { puzzle, answer } = loaded;
  const play = await getOrCreatePlay(puzzle.puzzle_date, anon);

  res.setHeader('Cache-Control', 'no-store');
  if (play.done) return res.json(await buildState(puzzle, answer, play));        // already finished: just return state

  if (bookId > 0) {
    if (play.guess_ids.includes(bookId)) return res.status(400).json({ error: 'Already guessed that book' });
    const { data: exists } = await db.from('books').select('id').eq('id', bookId).maybeSingle();
    if (!exists) return res.status(400).json({ error: 'Unknown book' });
  }

  const guess_ids = [...play.guess_ids, bookId];
  const solved = bookId === puzzle.book_id;
  const done = solved || guess_ids.length >= MAX_GUESSES;

  // Only update if nobody else changed this row in the meantime (guards double-taps and replays).
  const { data: updated } = await db.from('plays')
    .update({ guess_ids, guess_count: guess_ids.length, done, solved })
    .eq('puzzle_date', puzzle.puzzle_date).eq('anon_id', anon).eq('guess_count', play.guess_count)
    .select().maybeSingle();
  if (!updated) return res.status(409).json({ error: 'Out of sync, reload state' });

  res.json(await buildState(puzzle, answer, updated));
}