import { useState } from 'react'
import Room from './Room'

const GROUPS = [1, 2, 3, 4, 5, 6, 7, 8]

function load(k: string) {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
function save(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* 저장 못 해도 괜찮음 */
  }
}

/** 탭마다 고유 id (새로고침해도 유지 → 점수 이어짐) */
function myId() {
  try {
    let id = sessionStorage.getItem('cm.id')
    if (!id) {
      id = Math.random().toString(36).slice(2, 10)
      sessionStorage.setItem('cm.id', id)
    }
    return id
  } catch {
    return Math.random().toString(36).slice(2, 10)
  }
}

export default function App() {
  const [name, setName] = useState(() => load('cm.name'))
  const [cls, setCls] = useState(() => load('cm.class'))
  // 새로고침해도 같은 모둠으로 바로 다시 들어가도록 탭에 기억
  const [room, setRoomState] = useState<{ cls: string; group: number } | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('cm.room') ?? 'null')
    } catch {
      return null
    }
  })
  const setRoom = (r: { cls: string; group: number } | null) => {
    try {
      if (r) sessionStorage.setItem('cm.room', JSON.stringify(r))
      else sessionStorage.removeItem('cm.room')
    } catch {
      /* 무시 */
    }
    setRoomState(r)
  }
  const [id] = useState(myId)

  const nameOk = name.trim().length > 0
  const clsOk = cls.trim().length > 0

  if (room)
    return (
      <Room
        room={`${encodeURIComponent(room.cls)}:${room.group}`}
        label={`${room.cls} · ${room.group}모둠`}
        me={{ id, name: name.trim() }}
        onLeave={() => setRoom(null)}
      />
    )

  const join = (group: number) => {
    if (!nameOk || !clsOk) return
    save('cm.name', name.trim())
    save('cm.class', cls.trim())
    setRoom({ cls: cls.trim(), group })
  }

  return (
    <div className="home">
      <div className="home-card">
        <h1>
          <span className="logo">🎨</span> 그림 퀴즈
        </h1>
        <p className="sub">한 명이 그리고, 모둠 친구들이 맞혀요!</p>

        <label>
          내 이름
          <input value={name} maxLength={8} placeholder="예: 김도토리" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          우리 반
          <input value={cls} maxLength={10} placeholder="예: 5-3" onChange={(e) => setCls(e.target.value)} />
        </label>

        <div className="group-title">우리 모둠을 눌러서 들어가요</div>
        <div className="groups">
          {GROUPS.map((g) => (
            <button key={g} className="group-btn" aria-label={`${g}모둠`} disabled={!nameOk || !clsOk} onClick={() => join(g)}>
              {g}
              <small>모둠</small>
            </button>
          ))}
        </div>
        {(!nameOk || !clsOk) && <p className="hint">이름과 반을 먼저 적어 주세요</p>}
      </div>
    </div>
  )
}
