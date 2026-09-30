import type { Level, Word } from './words'

export type Phase = 'lobby' | 'choosing' | 'drawing' | 'reveal' | 'over'

export interface Settings {
  rounds: number
  drawTime: number // 초
  level: Level
}

/** 방장(가장 먼저 들어온 사람)이 만들어서 방 전체에 뿌리는 게임 상태 */
export interface GameState {
  from: string // 보낸 방장 id
  v: number // 버전 (클수록 최신)
  gid: string // 게임 한 판마다 새로
  phase: Phase
  settings: Settings
  round: number // 1부터
  queue: string[] // 이번 라운드에 아직 안 그린 사람
  turnNo: number // 그림판 식별용 (gid:turnNo)
  drawerId: string
  choices: Word[]
  word: string
  cat: string
  hard: boolean // 어려운 단어면 점수 1.5배
  hints: number[] // 공개된 글자 위치
  endsIn: number // 보낸 시점 기준 남은 ms (기기마다 시계가 달라서 절대시각 대신 사용)
  scores: Record<string, number>
  names: Record<string, string>
  guessed: string[] // 이번 차례에 맞힌 사람 (맞힌 순서)
  gained: Record<string, number> // 이번 차례에 얻은 점수
  note: string
}

export interface Player {
  id: string
  name: string
  joinedAt: number
}

export interface ChatMsg {
  id: number
  kind: 'chat' | 'correct' | 'system' | 'close' | 'hidden'
  name?: string
  text: string
}

/** 그림 한 획. 좌표는 가로 1000 × 세로 750 정수, 평탄화된 [x,y,x,y...] */
export interface Stroke {
  id: string
  c: string
  w: number
  p: number[]
  d?: number // 화면에 그린 좌표 수 (로컬 전용)
}

export type DrawOp =
  | { t: 's'; id: string; c: string; w: number; p: number[] } // 획 시작
  | { t: 'a'; id: string; p: number[] } // 점 추가
  | { t: 'u' } // 되돌리기
  | { t: 'x' } // 전체 지우기

export const BOARD_W = 1000
export const BOARD_H = 750
