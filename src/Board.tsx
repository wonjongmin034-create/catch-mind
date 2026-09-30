import { useEffect, useRef } from 'react'
import type { BoardModel } from './boardModel'
import { BOARD_H, BOARD_W, type DrawOp, type Stroke } from './types'

interface Props {
  model: BoardModel
  canDraw: boolean
  color: string
  width: number
  onOp: (op: DrawOp) => void
  children?: React.ReactNode
}

const MIN_DIST = 2.5 // 이보다 가까운 점은 버림 (메시지 크기 절약)

export default function Board({ model, canDraw, color, width, onOp, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const live = useRef({ canDraw, color, width, onOp })
  live.current = { canDraw, color, width, onOp }

  // 화면 크기 맞추기 + 그리기 루프
  useEffect(() => {
    const wrap = wrapRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let scale = 1

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(w * (BOARD_H / BOARD_W) * dpr)
      scale = canvas.width / BOARD_W
      model.dirty = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    const drawRange = (s: Stroke, from: number, to: number) => {
      ctx.strokeStyle = s.c
      ctx.fillStyle = s.c
      ctx.lineWidth = s.w * scale
      if (s.p.length === 2) {
        ctx.beginPath()
        ctx.arc(s.p[0] * scale, s.p[1] * scale, (s.w * scale) / 2, 0, Math.PI * 2)
        ctx.fill()
        return
      }
      const start = Math.max(0, from - 2)
      ctx.beginPath()
      ctx.moveTo(s.p[start] * scale, s.p[start + 1] * scale)
      for (let i = start + 2; i < to; i += 2) ctx.lineTo(s.p[i] * scale, s.p[i + 1] * scale)
      ctx.stroke()
    }

    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (model.dirty) {
        model.dirty = false
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        for (const s of model.strokes) {
          if (s.p.length) drawRange(s, 0, s.p.length)
          s.d = s.p.length
        }
        return
      }
      for (const s of model.strokes) {
        const d = s.d ?? 0
        const len = s.p.length
        if (d >= len) continue
        // 한꺼번에 도착한 점들을 몇 프레임에 나눠 그려서 부드럽게 보이게
        const step = live.current.canDraw ? len - d : Math.max(4, Math.ceil((len - d) / 2 / 8) * 2)
        const to = Math.min(len, d + step)
        drawRange(s, d, to)
        s.d = to
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [model])

  // 입력
  useEffect(() => {
    const canvas = canvasRef.current!
    let cur: { id: string; x: number; y: number } | null = null

    const toBoard = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return [
        Math.round(((e.clientX - r.left) / r.width) * BOARD_W),
        Math.round(((e.clientY - r.top) / r.height) * BOARD_H),
      ]
    }
    const down = (e: PointerEvent) => {
      if (!live.current.canDraw || e.button > 0) return
      e.preventDefault()
      canvas.setPointerCapture(e.pointerId)
      const [x, y] = toBoard(e)
      const id = Math.random().toString(36).slice(2, 9)
      cur = { id, x, y }
      const op: DrawOp = { t: 's', id, c: live.current.color, w: live.current.width, p: [x, y] }
      model.apply(op)
      live.current.onOp(op)
    }
    const move = (e: PointerEvent) => {
      if (!cur || !live.current.canDraw) return
      e.preventDefault()
      const evs = e.getCoalescedEvents?.() ?? [e]
      const pts: number[] = []
      for (const ev of evs.length ? evs : [e]) {
        const [x, y] = toBoard(ev)
        if (Math.hypot(x - cur.x, y - cur.y) < MIN_DIST) continue
        cur.x = x
        cur.y = y
        pts.push(x, y)
      }
      if (!pts.length) return
      const op: DrawOp = { t: 'a', id: cur.id, p: pts }
      model.apply(op)
      live.current.onOp(op)
    }
    const up = () => {
      cur = null
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    }
  }, [model])

  return (
    <div ref={wrapRef} className={'board' + (canDraw ? ' can-draw' : '')}>
      <canvas ref={canvasRef} />
      {children}
    </div>
  )
}
