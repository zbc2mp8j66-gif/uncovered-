// Retro beeps made from scratch in the browser. There are no sound files to download or license.
let ctx = null
let muted = false
try {
  muted = localStorage.getItem('uncovered-muted') === '1'
} catch {
  // ignore: private browsing can block storage
}

function audio() {
  if (muted) return null
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// One short beep: pitch, delay before it starts, length, wave shape, loudness
function beep(freq, delay, length, type = 'square', volume = 0.05) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + delay
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
  osc.connect(gain).connect(a.destination)
  osc.start(t)
  osc.stop(t + length + 0.02)
}

export const unlockAudio = () => {
  audio()
}
export const playCorrect = () => [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.09, 0.14))
export const playWrong = () => {
  beep(220, 0, 0.12, 'sawtooth')
  beep(165, 0.12, 0.22, 'sawtooth')
}
export const playSkip = () => beep(330, 0, 0.1, 'triangle')
export const playLose = () => [392, 330, 262, 196].forEach((f, i) => beep(f, i * 0.16, 0.2, 'triangle', 0.06))
export const isMuted = () => muted
export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem('uncovered-muted', value ? '1' : '0')
  } catch {
    // ignore
  }
}
