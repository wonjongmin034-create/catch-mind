// 짧은 효과음 (WebAudio, 파일 없음)
let ac: AudioContext | null = null

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  try {
    ac ??= new AudioContext()
    const t = ac.currentTime + at
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g).connect(ac.destination)
    o.start(t)
    o.stop(t + dur)
  } catch {
    /* 소리 못 내도 게임은 계속 */
  }
}

export const sfx = {
  correct: () => [660, 880, 1320].forEach((f, i) => tone(f, i * 0.08, 0.18, 'triangle')),
  myTurn: () => [523, 659].forEach((f, i) => tone(f, i * 0.12, 0.2, 'square', 0.06)),
  close: () => tone(330, 0, 0.15, 'triangle'),
  tick: () => tone(1000, 0, 0.05, 'square', 0.04),
  reveal: () => [392, 330].forEach((f, i) => tone(f, i * 0.14, 0.22, 'triangle')),
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle')),
}
