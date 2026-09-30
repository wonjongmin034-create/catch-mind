import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BoardModel } from './boardModel'
import { DRAW_FLUSH_MS, supabase } from './net'
import { sfx } from './sfx'
import type { ChatMsg, DrawOp, GameState, Player, Settings, Stroke } from './types'
import { isClose, norm, pickWords, type Word } from './words'

const CHOOSE_MS = 12_000
const REVEAL_MS = 5_000
const RANK_PTS = [10, 8, 7, 6] // 맞힌 순서별 점수, 그 뒤로는 5점
const DRAWER_PTS = 3 // 누가 맞힐 때마다 그린 사람에게
const HARD_DRAWER_PTS = 5 // 어려운 단어일 때 (맞힌 사람 점수는 1.5배)
export const MAX_CHAT = 40

const rid = () => Math.random().toString(36).slice(2, 10)

function lobby(prev?: GameState | null): GameState {
  return {
    from: '',
    v: 0,
    gid: rid(),
    phase: 'lobby',
    settings: prev?.settings ?? { rounds: 2, drawTime: 100, level: 'hard' },
    round: 0,
    queue: [],
    turnNo: 0,
    drawerId: '',
    choices: [],
    word: '',
    cat: '',
    hard: false,
    hints: [],
    endsIn: 0,
    scores: {},
    names: {},
    guessed: [],
    gained: {},
    note: '',
  }
}

export const boardKey = (s: GameState) => `${s.gid}:${s.turnNo}`

/**
 * 모둠 방 하나.
 * - 모두가 같은 Realtime 채널에 접속 (presence = 누가 있는지, broadcast = 메시지)
 * - 가장 먼저 들어온 사람이 "방장": 게임 진행(차례·타이머·채점)을 맡고 상태를 뿌림
 * - 방장이 나가면 다음 사람이 마지막 상태를 이어받아 계속 진행
 */
export function useRoom(room: string, me: { id: string; name: string }) {
  const board = useMemo(() => new BoardModel(), [])
  const [players, setPlayers] = useState<Player[]>([])
  const [state, setState] = useState<GameState | null>(null)
  const [deadline, setDeadline] = useState(0)
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [status, setStatus] = useState<'connecting' | 'online' | 'error'>('connecting')

  const chanRef = useRef<RealtimeChannel | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const playersRef = useRef<Player[]>([])
  const deadlineRef = useRef(0)
  const readyRef = useRef(false)
  const recentWords = useRef<string[]>([])
  const opBuf = useRef<DrawOp[]>([])
  const flushTimer = useRef<number | null>(null)
  const chatSeq = useRef(0)
  const lastHello = useRef(0)

  const isHost = () => playersRef.current[0]?.id === me.id

  const addChat = (m: Omit<ChatMsg, 'id'>) =>
    setChat((c) => [...c.slice(-80), { ...m, id: ++chatSeq.current }])

  const send = (event: string, payload: object) =>
    chanRef.current?.send({ type: 'broadcast', event, payload })

  const nameOf = (s: GameState, id: string) =>
    playersRef.current.find((p) => p.id === id)?.name ?? s.names[id] ?? '누군가'

  // ─── 상태 반영 (모두) ───────────────────────────────────────────
  const applyState = (s: GameState) => {
    const prev = stateRef.current
    stateRef.current = s
    deadlineRef.current = Date.now() + s.endsIn
    setDeadline(deadlineRef.current)
    setState(s)

    const key = boardKey(s)
    if (board.key !== key) {
      board.reset(key)
      opBuf.current = []
    }

    const sameTurn = prev && boardKey(prev) === key
    if (!sameTurn && s.phase === 'choosing') {
      addChat({ kind: 'system', text: `${s.round}라운드 · ${nameOf(s, s.drawerId)}님이 그릴 차례예요 ✏️` })
      if (s.drawerId === me.id) sfx.myTurn()
    }
    if (sameTurn && s.guessed.length > prev.guessed.length) {
      for (const id of s.guessed.slice(prev.guessed.length)) {
        addChat({ kind: 'correct', text: `${nameOf(s, id)}님 정답! 🎉 +${s.gained[id] ?? 0}` })
      }
      sfx.correct()
    }
    if (s.phase === 'reveal' && prev?.phase !== 'reveal') {
      addChat({ kind: 'system', text: `정답은 "${s.word}"! ${s.note}` })
      sfx.reveal()
    }
    if (s.phase === 'over' && prev?.phase !== 'over') sfx.fanfare()
  }

  // ─── 방장 전용 ──────────────────────────────────────────────────
  const commit = (next: GameState, durMs?: number) => {
    if (durMs !== undefined) deadlineRef.current = Date.now() + durMs
    next.from = me.id
    next.v = (stateRef.current?.v ?? 0) + 1
    next.endsIn = Math.max(0, deadlineRef.current - Date.now())
    applyState(next)
    send('state', next)
  }

  const nextTurn = (s: GameState, note = '') => {
    const ps = playersRef.current
    const ids = ps.map((p) => p.id)
    if (ids.length < 2) {
      commit({ ...lobby(s), note: '2명 이상 있어야 게임을 할 수 있어요' }, 0)
      return
    }
    let round = s.round
    let queue = s.queue.filter((id) => ids.includes(id))
    if (!queue.length) {
      round++
      if (round > s.settings.rounds) {
        commit({ ...s, phase: 'over', drawerId: '', word: s.word, note: '' }, 0)
        return
      }
      queue = ids // 새로 들어온 사람도 다음 라운드부터 참여
    }
    const names = { ...s.names }
    const scores = { ...s.scores }
    for (const p of ps) {
      names[p.id] = p.name
      scores[p.id] ??= 0
    }
    commit(
      {
        ...s,
        phase: 'choosing',
        round,
        drawerId: queue[0],
        queue: queue.slice(1),
        turnNo: s.turnNo + 1,
        choices: pickWords(3, new Set(recentWords.current), s.settings.level ?? 'hard'),
        word: '',
        cat: '',
        hard: false,
        hints: [],
        guessed: [],
        gained: {},
        names,
        scores,
        note,
      },
      CHOOSE_MS,
    )
  }

  const chooseWord = (s: GameState, w: Word) => {
    recentWords.current = [...recentWords.current, w.w].slice(-80)
    commit({ ...s, phase: 'drawing', word: w.w, cat: w.c, hard: !!w.h, choices: [] }, s.settings.drawTime * 1000)
  }

  const reveal = (s: GameState, note: string) => commit({ ...s, phase: 'reveal', note }, REVEAL_MS)

  const judgeGuess = (id: string, text: string) => {
    const s = stateRef.current
    if (!s || s.phase !== 'drawing' || id === s.drawerId || s.guessed.includes(id)) return
    if (!playersRef.current.some((p) => p.id === id)) return
    if (norm(text) !== norm(s.word)) return
    const base = RANK_PTS[s.guessed.length] ?? 5
    const pts = s.hard ? Math.round(base * 1.5) : base
    const dp = s.hard ? HARD_DRAWER_PTS : DRAWER_PTS
    const d = s.drawerId
    commit({
      ...s,
      guessed: [...s.guessed, id],
      names: { ...s.names, [id]: nameOf(s, id) },
      scores: { ...s.scores, [id]: (s.scores[id] ?? 0) + pts, [d]: (s.scores[d] ?? 0) + dp },
      gained: { ...s.gained, [id]: pts, [d]: (s.gained[d] ?? 0) + dp },
    })
  }

  const hostTick = () => {
    const s = stateRef.current
    if (!s) {
      commit(lobby())
      return
    }
    const now = Date.now()
    const ids = new Set(playersRef.current.map((p) => p.id))
    const over = now >= deadlineRef.current
    switch (s.phase) {
      case 'choosing':
        if (!ids.has(s.drawerId)) return nextTurn(s, '(그릴 사람이 나갔어요)')
        if (over) return chooseWord(s, s.choices[Math.floor(Math.random() * s.choices.length)])
        return
      case 'drawing': {
        if (!ids.has(s.drawerId)) return reveal(s, '그린 사람이 나갔어요')
        const guessers = [...ids].filter((id) => id !== s.drawerId)
        if (guessers.length && guessers.every((id) => s.guessed.includes(id)))
          return reveal(s, '모두 맞혔어요! 👏')
        if (over) return reveal(s, s.guessed.length ? '' : '아무도 못 맞혔어요 😢')
        // 시간이 지나면 글자 힌트 공개
        const chars = [...s.word]
        const f = 1 - (deadlineRef.current - now) / (s.settings.drawTime * 1000)
        const max = chars.length < 2 ? 0 : Math.max(1, Math.floor((chars.length - 1) / 2))
        const want = Math.min(max, f >= 0.75 ? 2 : f >= 0.5 ? 1 : 0)
        if (want > s.hints.length) {
          const left = chars.map((_, i) => i).filter((i) => !s.hints.includes(i))
          const i = left[Math.floor(Math.random() * left.length)]
          commit({ ...s, hints: [...s.hints, i] })
        }
        return
      }
      case 'reveal':
        if (over) return nextTurn(s)
        return
    }
  }

  // ─── 메시지 처리 ────────────────────────────────────────────────
  const onChat = (p: { id: string; name: string; text: string }) => {
    if (isHost()) judgeGuess(p.id, p.text)
    const s = stateRef.current
    if (s?.phase === 'drawing' && s.word) {
      const n = norm(p.text)
      const w = norm(s.word)
      if (n === w) return // 정답 그대로는 채팅에 안 띄움 (맞힌 알림은 상태로 옴)
      if (n.includes(w)) {
        addChat({ kind: 'hidden', name: p.name, text: '(정답이 들어간 말은 가려져요 🤫)' })
        return
      }
      addChat({ kind: 'chat', name: p.name, text: p.text })
      if (p.id === me.id && isClose(p.text, s.word)) {
        addChat({ kind: 'close', text: '아깝다! 거의 맞았어요 🔥' })
        sfx.close()
      }
      return
    }
    addChat({ kind: 'chat', name: p.name, text: p.text })
  }

  const onHello = (id: string) => {
    const s = stateRef.current
    if (!s) return
    if (isHost()) send('state', { ...s, endsIn: Math.max(0, deadlineRef.current - Date.now()) })
    if (s.drawerId === me.id && s.phase === 'drawing')
      send('sync', { to: id, key: board.key, strokes: board.snapshot() })
  }

  // ─── 채널 연결 ──────────────────────────────────────────────────
  useEffect(() => {
    const joinedAt = Date.now()
    readyRef.current = false
    const ch = supabase.channel(`catchmind:${room}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    })
    chanRef.current = ch

    ch.on('presence', { event: 'sync' }, () => {
      const ps = ch.presenceState<{ name: string; joinedAt: number }>()
      const list: Player[] = Object.entries(ps)
        .map(([id, metas]) => ({
          id,
          name: metas[0]?.name ?? '?',
          joinedAt: Math.min(...metas.map((m) => m.joinedAt)),
        }))
        .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
      playersRef.current = list
      setPlayers(list)
    })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        const s = payload as GameState
        const cur = stateRef.current
        if (!cur || s.v > cur.v || s.from === playersRef.current[0]?.id) applyState(s)
      })
      .on('broadcast', { event: 'hello' }, ({ payload }) => onHello(payload.id))
      .on('broadcast', { event: 'chat' }, ({ payload }) => onChat(payload))
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        if (payload.key !== board.key) return
        for (const op of payload.ops as DrawOp[]) board.apply(op)
      })
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        if (payload.to === me.id && payload.key === board.key) board.load(payload.key, payload.strokes as Stroke[])
      })
      .on('broadcast', { event: 'choose' }, ({ payload }) => {
        const s = stateRef.current
        if (!isHost() || !s || s.phase !== 'choosing' || payload.id !== s.drawerId) return
        const w = s.choices[payload.i]
        if (w) chooseWord(s, w)
      })
      .subscribe(async (st) => {
        if (st === 'SUBSCRIBED') {
          setStatus('online')
          await ch.track({ name: me.name, joinedAt })
          lastHello.current = Date.now()
          send('hello', { id: me.id })
          // 다른 사람들 정보가 도착할 시간을 준 뒤에 방장 역할 시작
          setTimeout(() => (readyRef.current = true), 1500)
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
          setStatus('error')
        }
      })

    const tick = window.setInterval(() => {
      if (!readyRef.current) return
      if (isHost()) hostTick()
      else if (!stateRef.current && Date.now() - lastHello.current > 3000) {
        lastHello.current = Date.now()
        send('hello', { id: me.id })
      }
    }, 300)

    return () => {
      window.clearInterval(tick)
      if (flushTimer.current) window.clearTimeout(flushTimer.current)
      supabase.removeChannel(ch)
      chanRef.current = null
      stateRef.current = null
      playersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, me.id, me.name])

  // ─── 화면에서 쓰는 동작 ─────────────────────────────────────────
  const flush = () => {
    flushTimer.current = null
    if (!opBuf.current.length) return
    send('draw', { key: board.key, ops: opBuf.current })
    opBuf.current = []
  }

  const drawOp = (op: DrawOp) => {
    const buf = opBuf.current
    const last = buf[buf.length - 1]
    if (op.t === 'a' && last && (last.t === 's' || last.t === 'a') && last.id === op.id) last.p.push(...op.p)
    else buf.push(op.t === 's' || op.t === 'a' ? { ...op, p: [...op.p] } : op)
    flushTimer.current ??= window.setTimeout(flush, DRAW_FLUSH_MS)
  }

  const tool = (t: 'u' | 'x') => {
    const op: DrawOp = { t }
    board.apply(op)
    drawOp(op)
  }

  const sendChat = (raw: string) => {
    const text = raw.trim().slice(0, MAX_CHAT)
    const s = stateRef.current
    if (!text || (s?.phase === 'drawing' && s.drawerId === me.id)) return
    const p = { id: me.id, name: me.name, text }
    send('chat', p)
    onChat(p)
  }

  const choose = (i: number) => {
    const s = stateRef.current
    if (!s || s.phase !== 'choosing' || s.drawerId !== me.id) return
    if (isHost()) chooseWord(s, s.choices[i])
    else send('choose', { id: me.id, i })
  }

  const start = () => {
    const s = stateRef.current
    if (!isHost() || !s || playersRef.current.length < 2) return
    nextTurn({ ...lobby(s), gid: rid() })
  }

  const setSettings = (settings: Settings) => {
    const s = stateRef.current
    if (isHost() && s?.phase === 'lobby') commit({ ...s, settings })
  }

  const toLobby = () => {
    const s = stateRef.current
    if (isHost() && s) commit(lobby(s), 0)
  }

  return {
    board,
    players,
    state,
    deadline,
    chat,
    status,
    isHost: players[0]?.id === me.id,
    hostId: players[0]?.id,
    drawOp,
    undo: () => tool('u'),
    clear: () => tool('x'),
    sendChat,
    choose,
    start,
    setSettings,
    toLobby,
  }
}
