import { useEffect, useMemo, useState } from 'react'
import './App.css'

const SPINES = ['#7a2e3a', '#2f5d3a', '#c98a2b', '#3b4f7a', '#8a5a33', '#5a2f6b', '#a8442e', '#2c6b6b']

// Each browser gets a random ID (kept in localStorage) so the server can remember your guesses.
function getAnonId() {
  try {
    let id = localStorage.getItem('uncovered-anon')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('uncovered-anon', id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

const normalize = (s) => s.toLowerCase().replace(/[’']/g, '')

// Turn the server's feedback data into the colored labels under each guess.
function chipsFor(f) {
  return [
    f.author.match ? ['ok', 'Same author'] : ['miss', 'Different author'],
    f.year.match
      ? ['ok', 'Same year']
      : [f.year.near ? 'near' : 'miss', `Answer is ${f.year.answerIs} (${f.year.guessed})`],
    f.genre.match ? ['ok', 'Same genre'] : ['miss', `Genre: ${f.genre.guessed}`],
    f.words.match
      ? ['ok', `Same word range (${f.words.guessed})`]
      : [f.words.near ? 'near' : 'miss', `Answer is ${f.words.answerIs} than ${f.words.guessed}`],
  ]
}
// Seconds until the next puzzle (midnight US Eastern)
function msUntilEasternMidnight() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date())
  const get = (t) => Number(parts.find((p) => p.type === t).value)
  const secs = (get('hour') % 24) * 3600 + get('minute') * 60 + get('second')
  return (86400 - secs) * 1000
}

function Countdown() {
  const [ms, setMs] = useState(msUntilEasternMidnight)
  useEffect(() => {
    let last = msUntilEasternMidnight()
    const id = setInterval(() => {
      const next = msUntilEasternMidnight()
      if (next > last) window.location.reload() // midnight passed: load the new puzzle
      last = next
      setMs(next)
    }, 1000)
    return () => clearInterval(id)
  }, [])
  const s = Math.floor(ms / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return <p className="note">Next book in {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}</p>
}

export default function App() {
  const [anon] = useState(getAnonId)
  const [state, setState] = useState(null)
  const [books, setBooks] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // Load today's puzzle state and the list of books when the page opens.
  useEffect(() => {
    async function load() {
      try {
        const [s, b] = await Promise.all([fetch(`/api/state?anon=${anon}`), fetch('/api/books')])
        if (!s.ok) throw new Error((await s.json()).error || 'Could not load today’s puzzle.')
        if (!b.ok) throw new Error('Could not load the book list.')
        setState(await s.json())
        setBooks(await b.json())
      } catch (e) {
        setError(
          e.message === 'Failed to fetch' || e instanceof SyntaxError
            ? 'Can’t reach the game server. Run the site with "vercel dev" instead of "npm run dev".'
            : e.message
        )
      }
    }
    load()
  }, [anon])

  // bookId 0 means "skip"
  async function guess(bookId) {
    if (busy || !state || state.done) return
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anon, bookId }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Something went wrong.')
      setState(data)
      setQuery('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const suggestions = useMemo(() => {
    const q = normalize(query.trim())
    if (!q || !state) return []
    const used = new Set(state.guesses.map((g) => g.bookId))
    return books
      .filter((b) => !used.has(b.id))
      .filter((b) => [b.title, ...(b.aliases || [])].some((n) => normalize(n).includes(q)))
      .slice(0, 8)
  }, [query, books, state])

  const shareText = state?.done
    ? `Uncovered ${state.solved ? state.guessesUsed : 'X'}/${state.maxGuesses}\n` +
      state.guesses
        .map((g, i) =>
          g.skipped ? '⬜' : state.solved && i === state.guesses.length - 1 ? '🟩' : '🟥'
        )
        .join('')
    : ''

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const left = state ? state.maxGuesses - state.guessesUsed : 0

  return (
    <main>
      <div className="shelf" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ height: 26 + ((i * 7) % 24), background: SPINES[i % SPINES.length] }} />
        ))}
      </div>
      <h1>UNCOVERED</h1>
      <p className="sub">The Reading Room: one mystery book a day. Each miss lights another hint.</p>

      {error && <p className="error">{error}</p>}
      {!state && !error && <p className="sub">Opening the book…</p>}

      {state && (
        <>
          <ul className="hints">
            {Array.from({ length: 6 }, (_, i) =>
              i < state.hints.length ? (
                <li key={i} className="box">
                  <b>HINT {i + 1}</b>
                  {state.hints[i]}
                </li>
              ) : (
                <li key={i} className="locked">Hint {i + 1} is still on the shelf</li>
              )
            )}
          </ul>

          {!state.done && (
            <>
              <div className="row">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the stacks"
                  aria-label="Search for a title"
                  autoComplete="off"
                />
                <button className="ghost" disabled={busy} onClick={() => guess(0)}>Skip</button>
              </div>
              {query.trim() && (
                <ul className="sug box">
                  {suggestions.length ? (
                    suggestions.map((b) => (
                      <li key={b.id}>
                        <button disabled={busy} onClick={() => guess(b.id)}>
                          {b.title} <i>– {b.author}</i>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li><button disabled>No match in the library</button></li>
                  )}
                </ul>
              )}
            </>
          )}

          <div className="meta">
            <span>
              {!state.done && (
                <>
                  <span className="hearts" aria-hidden="true">
                    {'♥'.repeat(left)}{'♡'.repeat(state.guessesUsed)}
                  </span>{' '}
                  {left} guesses left
                </>
              )}
            </span>
            <span>{state.date}</span>
          </div>

          {[...state.guesses].reverse().map((g, i) =>
            g.skipped ? (
              <div className="g box" key={i}><h3>Skipped</h3></div>
            ) : (
              <div className="g box" key={i}>
                <h3>{g.title}</h3>
                <div className="chips">
                  {chipsFor(g.feedback).map(([kind, text]) => (
                    <span key={text} className={`chip ${kind}`}>{text}</span>
                  ))}
                </div>
              </div>
            )
          )}

          {state.done && (
            <div className="end box">
              <h2>{state.solved ? `SOLVED IN ${state.guessesUsed} OF ${state.maxGuesses}` : 'BOOK CLOSED'}</h2>
              <p>
                The book was <b>{state.answer.title}</b> by {state.answer.author} ({state.answer.year}).
              </p>
              {state.percentile !== undefined && <p>You beat {state.percentile}% of players today.</p>}
              <pre>{shareText}</pre>
              <button onClick={copyResult}>{copied ? 'Copied' : 'Copy result'}</button>
                            <Countdown />
            </div>
          )}
        </>
      )}

      <p className="note">Word counts are approximate and shown as ranges, so editions and translations barely change them.</p>
    </main>
  )
}