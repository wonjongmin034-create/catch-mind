import type { DrawOp, Stroke } from './types'

/** 그림판 데이터. 획을 보관하고, 화면(Board)은 아직 안 그린 부분만 이어 그립니다. */
export class BoardModel {
  key = ''
  strokes: Stroke[] = []
  dirty = true // true면 화면 전체를 다시 그림 (되돌리기·지우기·동기화)

  reset(key: string) {
    this.key = key
    this.strokes = []
    this.dirty = true
  }

  load(key: string, strokes: Stroke[]) {
    this.key = key
    this.strokes = strokes.map((s) => ({ ...s, p: [...s.p] }))
    this.dirty = true
  }

  apply(op: DrawOp) {
    switch (op.t) {
      case 's':
        this.strokes.push({ id: op.id, c: op.c, w: op.w, p: [...op.p], d: 0 })
        break
      case 'a': {
        for (let i = this.strokes.length - 1; i >= 0; i--) {
          if (this.strokes[i].id === op.id) {
            this.strokes[i].p.push(...op.p)
            break
          }
        }
        break
      }
      case 'u':
        this.strokes.pop()
        this.dirty = true
        break
      case 'x':
        this.strokes = []
        this.dirty = true
        break
    }
  }

  /** 새로 들어온 사람에게 보낼 사본 */
  snapshot(): Stroke[] {
    return this.strokes.map(({ id, c, w, p }) => ({ id, c, w, p }))
  }
}
