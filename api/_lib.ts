import { createClient } from '@supabase/supabase-js';

export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // server only: never expose this key to the browser
  { auth: { persistSession: false } }
);

export const MAX_GUESSES = 6;
export const BANDS = ['Under 50,000 words', '50,000–80,000', '80,000–120,000', '120,000–180,000', 'Over 180,000'];

export type Book = { id: number; title: string; author: string; year: number; genre: string; word_count: number; word_band: number };
export type Puzzle = { puzzle_date: string; book_id: number; hints: string[] };
export type Play = { puzzle_date: string; anon_id: string; guess_ids: number[]; guess_count: number; done: boolean; solved: boolean };

// The puzzle day rolls over at midnight US Eastern for everyone.
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export const validAnon = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// Compare a guess to the answer. Structured data: the client chooses the wording.
export function feedback(g: Book, a: Book) {
  const bandGap = Math.abs(g.word_band - a.word_band);
  return {
    author: { match: g.author === a.author },
    year: { match: g.year === a.year, near: Math.abs(g.year - a.year) <= 15, answerIs: a.year > g.year ? 'later' : a.year < g.year ? 'earlier' : 'same', guessed: g.year },
    genre: { match: g.genre === a.genre, guessed: g.genre },
    words: { match: bandGap === 0, near: bandGap === 1, answerIs: a.word_band > g.word_band ? 'longer' : a.word_band < g.word_band ? 'shorter' : 'same', guessed: BANDS[g.word_band] },
  };
}

export async function loadPuzzle(date: string) {
  const { data: puzzle } = await db.from('puzzles').select('*').eq('puzzle_date', date).maybeSingle<Puzzle>();
  if (!puzzle) return null;
  const { data: answer } = await db.from('books').select('*').eq('id', puzzle.book_id).single<Book>();
  return answer ? { puzzle, answer } : null;
}

export async function getOrCreatePlay(date: string, anon: string) {
  await db.from('plays').upsert({ puzzle_date: date, anon_id: anon }, { onConflict: 'puzzle_date,anon_id', ignoreDuplicates: true });
  const { data } = await db.from('plays').select('*').eq('puzzle_date', date).eq('anon_id', anon).single<Play>();
  return data!;
}

// Everything the browser may know right now. Hints beyond what the player has earned never leave the server.
export async function buildState(puzzle: Puzzle, answer: Book, play: Play) {
  const ids = play.guess_ids.filter((id) => id > 0);
  const { data: books } = ids.length ? await db.from('books').select('*').in('id', ids) : { data: [] as Book[] };
  const byId = new Map((books ?? []).map((b: Book) => [b.id, b]));
  const guesses = play.guess_ids.map((id) => {
    const b = byId.get(id);
    return b ? { bookId: b.id, title: b.title, author: b.author, feedback: feedback(b, answer) } : { skipped: true };
  });
  const unlocked = play.done ? 6 : Math.min(play.guess_count + 1, 6);
  let percentile: number | undefined;
  if (play.done) {
    const score = play.solved ? play.guess_count : MAX_GUESSES + 1;
    const { data } = await db.rpc('play_percentile', { p_date: puzzle.puzzle_date, p_score: score });
    percentile = data ?? undefined;
  }
  return {
    date: puzzle.puzzle_date, maxGuesses: MAX_GUESSES, guessesUsed: play.guess_count,
    hints: puzzle.hints.slice(0, unlocked), guesses, done: play.done, solved: play.solved,
    answer: play.done ? { title: answer.title, author: answer.author, year: answer.year, words: BANDS[answer.word_band] } : undefined,
    percentile,
  };
}