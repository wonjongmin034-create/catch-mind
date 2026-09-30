import { useEffect, useRef, useState } from 'react'
import Board from './Board'
import { sfx } from './sfx'
import type { GameState, Player } from './types'
import { MAX_CHAT, useRoom } from './useRoom'

const COLORS = [
  '#222222', '#8a8a8a', '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#29b6f6', '#1e5bd8', '#8e44ad', '#f06292', '#8d5a2b',
]
const SIZES = [5, 12, 26]
const ERASER = '#ffffff'

interface Props {
  room: string
  label: string
  me: { id: string; name: string }
  onLeave: () => void
}

export default function Room({ room, label, me, onLeave }: Props) {
  const r = useRoom(room, me)
  const s = r.state
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(1)
  const [eraser, setEraser] = useState(false)

  const drawing = s?.phase === 'drawing'
  const iDraw = !!s && s.drawerId === me.id
  const canDraw = drawing && iDraw

  return (
    <div className="room">
      <header className="topbar">
        <button className="leave" onClick={onLeave}>
          ← 나가기
        </button>
        <div className="room-label">{label}</div>
        {s && s.phase !== 'lobby' && s.phase !== 'over' && (
          <div className="round">
            {s.round}/{s.settings.rounds} 라운드
          </div>
        )}
        <WordBar s={s} meId={me.id} />
        {s && (s.phase === 'drawing' || s.phase === 'choosing') && <Timer deadline={r.deadline} total={s.phase === 'drawing' ? s.settings.drawTime : 12} />}
      </header>

      <main className="stage">
        <Board
          model={r.board}
          canDraw={canDraw}
          color={eraser ? ERASER : color}
          width={eraser ? SIZES[size] * 2 : SIZES[size]}
          onOp={r.drawOp}
        >
          <Overlay r={r} meId={me.id} />
        </Board>

        {canDraw ? (
          <div className="tools">
            <div className="colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={'swatch' + (!eraser && c === color ? ' on' : '')}
                  style={{ background: c }}
                  aria-label={`색 ${c}`}
                  onClick={() => {
                    setColor(c)
                    setEraser(false)
                  }}
                />
              ))}
            </div>
            <div className="sizes">
              {SIZES.map((w, i) => (
                <button key={w} className={'size' + (i === size ? ' on' : '')} onClick={() => setSize(i)} aria-label={`굵기 ${i + 1}`}>
                  <span style={{ width: w * 0.7 + 4, height: w * 0.7 + 4 }} />
                </button>
              ))}
            </div>
            <button className={'tool' + (eraser ? ' on' : '')} onClick={() => setEraser((e) => !e)}>
              🧽 지우개
            </button>
            <button className="tool" onClick={r.undo}>
              ↩️ 되돌리기
            </button>
            <button className="tool danger" onClick={r.clear}>
              🗑️ 다 지우기
            </button>
          </div>
        ) : (
          <div className="tools placeholder">{toolsHint(s, me.id)}</div>
        )}
      </main>

      <aside className="side">
        <PlayerList players={r.players} s={s} hostId={r.hostId} meId={me.id} />
        <Chat r={r} blocked={canDraw} />
      </aside>

      {r.status !== 'online' && (
        <div className="conn">{r.status === 'error' ? '연결이 끊겼어요. 다시 연결하는 중…' : '연결하는 중…'}</div>
      )}
    </div>
  )
}

function toolsHint(s: GameState | null, meId: string) {
  if (!s) return ''
  if (s.phase === 'drawing' && s.guessed.includes(meId)) return '정답! 친구들이 맞힐 때까지 기다려요 😊'
  if (s.phase === 'drawing') return '아래 채팅창에 정답을 적어 보세요 ✍️'
  return ''
}

// ─── 위쪽 단어/힌트 ──────────────────────────────────────────────
function WordBar({ s, meId }: { s: GameState | null; meId: string }) {
  if (!s || (s.phase !== 'drawing' && s.phase !== 'reveal')) return <div className="word" />
  const show = s.phase === 'reveal' || s.drawerId === meId || s.guessed.includes(meId)
  if (show)
    return (
      <div className="word">
        <span className="cat">{s.cat}</span>
        <b>{s.word}</b>
        {s.drawerId === meId && s.phase === 'drawing' && <span className="me-draw">내가 그려요!</span>}
      </div>
    )
  const chars = [...s.word]
  return (
    <div className="word">
      <span className="cat">{s.cat}</span>
      <span className="blanks">
        {chars.map((ch, i) =>
          ch === ' ' ? (
            <i key={i} className="gap" />
          ) : (
            <i key={i} className={s.hints.includes(i) ? 'shown' : ''}>
              {s.hints.includes(i) ? ch : ''}
            </i>
          ),
        )}
      </span>
      <span className="len">{chars.filter((c) => c !== ' ').length}글자</span>
    </div>
  )
}

function Timer({ deadline, total }: { deadline: number; total: number }) {
  const [now, setNow] = useState(Date.now())
  const lastSec = useRef(-1)
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.max(0, Math.ceil((deadline - now) / 1000))
  useEffect(() => {
    if (left !== lastSec.current && left <= 5 && left > 0) sfx.tick()
    lastSec.current = left
  }, [left])
  const pct = Math.min(1, left / total)
  return (
    <div className={'timer' + (left <= 10 ? ' hurry' : '')} style={{ ['--p' as string]: pct }}>
      <span>{left}</span>
    </div>
  )
}

// ─── 그림판 위 안내 화면 ────────────────────────────────────────
type R = ReturnType<typeof useRoom>

function Overlay({ r, meId }: { r: R; meId: string }) {
  const s = r.state
  if (!s)
    return (
      <div className="overlay">
        <div className="panel">방에 들어가는 중…</div>
      </div>
    )

  if (s.phase === 'lobby') return <Lobby r={r} />

  if (s.phase === 'choosing') {
    if (s.drawerId === meId)
      return (
        <div className="overlay">
          <div className="panel">
            <h2>내 차례! 그릴 단어를 골라요 ✏️</h2>
            <div className="choices">
              {s.choices.map((w, i) => (
                <button key={w.w} className="choice" onClick={() => r.choose(i)}>
                  <small>{w.c}</small>
                  {w.w}
                </button>
              ))}
            </div>
            <p className="muted">시간 안에 안 고르면 자동으로 정해져요</p>
          </div>
        </div>
      )
    return (
      <div className="overlay">
        <div className="panel">
          <h2>{s.names[s.drawerId] ?? '친구'}님이 단어를 고르는 중…</h2>
          {s.note && <p className="muted">{s.note}</p>}
        </div>
      </div>
    )
  }

  if (s.phase === 'reveal') {
    const gained = Object.entries(s.gained).sort((a, b) => b[1] - a[1])
    return (
      <div className="overlay soft">
        <div className="panel">
          <p className="muted">정답은</p>
          <h1 className="answer">{s.word}</h1>
          {s.note && <p>{s.note}</p>}
          {gained.length > 0 && (
            <ul className="gains">
              {gained.map(([id, pts]) => (
                <li key={id}>
                  {s.names[id] ?? '친구'} {id === s.drawerId && '✏️'} <b>+{pts}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  if (s.phase === 'over') {
    const rank = Object.entries(s.scores).sort((a, b) => b[1] - a[1])
    const medals = ['🥇', '🥈', '🥉']
    return (
      <div className="overlay">
        <div className="panel">
          <h2>게임 끝! 🎉</h2>
          <ol className="podium">
            {rank.map(([id, pts]) => {
              const place = rank.filter(([, p]) => p > pts).length // 동점이면 같은 등수
              return (
              <li key={id} className={id === meId ? 'me' : ''}>
                <span className="medal">{medals[place] ?? `${place + 1}등`}</span>
                <span className="nm">{s.names[id] ?? '친구'}</span>
                <b>{pts}점</b>
              </li>
              )
            })}
          </ol>
          {r.isHost ? (
            <button className="big" onClick={r.toLobby}>
              한 번 더 하기
            </button>
          ) : (
            <p className="muted">방장이 새 게임을 열 때까지 기다려요</p>
          )}
        </div>
      </div>
    )
  }
  return null
}

function Lobby({ r }: { r: R }) {
  const s = r.state!
  const host = r.players[0]
  const n = r.players.length
  const set = s.settings
  return (
    <div className="overlay">
      <div className="panel">
        <h2>모둠 친구들을 기다려요 ({n}명)</h2>
        {s.note && <p className="note">{s.note}</p>}
        <div className="setting">
          <span>라운드</span>
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              className={'pill' + (set.rounds === v ? ' on' : '')}
              disabled={!r.isHost}
              onClick={() => r.setSettings({ ...set, rounds: v })}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="setting">
          <span>그리는 시간</span>
          {[60, 80, 100, 120].map((v) => (
            <button
              key={v}
              className={'pill' + (set.drawTime === v ? ' on' : '')}
              disabled={!r.isHost}
              onClick={() => r.setSettings({ ...set, drawTime: v })}
            >
              {v}초
            </button>
          ))}
        </div>
        <p className="muted">
          한 라운드에 모두 한 번씩 그려요 · 먼저 맞힐수록 점수가 높아요
        </p>
        {r.isHost ? (
          <button className="big" disabled={n < 2} onClick={r.start}>
            {n < 2 ? '친구가 1명 더 필요해요' : '게임 시작!'}
          </button>
        ) : (
          <p className="wait">👑 {host?.name}님(방장)이 시작하기를 기다려요</p>
        )}
      </div>
    </div>
  )
}

// ─── 오른쪽: 참가자 + 채팅 ──────────────────────────────────────
function PlayerList({ players, s, hostId, meId }: { players: Player[]; s: GameState | null; hostId?: string; meId: string }) {
  const inGame = s && s.phase !== 'lobby'
  const list = inGame ? [...players].sort((a, b) => (s.scores[b.id] ?? 0) - (s.scores[a.id] ?? 0)) : players
  return (
    <ul className="players">
      {list.map((p) => {
        const drawing = inGame && s.drawerId === p.id && (s.phase === 'drawing' || s.phase === 'choosing')
        const got = inGame && (s.phase === 'drawing' || s.phase === 'reveal') && s.guessed.includes(p.id)
        return (
          <li key={p.id} className={(p.id === meId ? 'me ' : '') + (got ? 'got ' : '') + (drawing ? 'drawing' : '')}>
            <span className="nm">
              {p.id === hostId && '👑 '}
              {p.name}
              {p.id === meId && <small> (나)</small>}
            </span>
            <span className="badge">{drawing ? '✏️' : got ? '✅' : ''}</span>
            {inGame && <b>{s.scores[p.id] ?? 0}</b>}
          </li>
        )
      })}
    </ul>
  )
}

function Chat({ r, blocked }: { r: R; blocked: boolean }) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [r.chat])
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    r.sendChat(text)
    setText('')
  }
  return (
    <div className="chat">
      <div className="msgs" ref={listRef}>
        {r.chat.map((m) => (
          <div key={m.id} className={'msg ' + m.kind}>
            {m.name && <b>{m.name}</b>}
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="chat-form">
        <input
          value={text}
          maxLength={MAX_CHAT}
          disabled={blocked}
          placeholder={blocked ? '그림으로만 설명해요! 🤐' : '정답이나 채팅 입력'}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="send"
        />
        <button disabled={blocked || !text.trim()}>보내기</button>
      </form>
    </div>
  )
}
