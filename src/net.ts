import { createClient } from '@supabase/supabase-js'

// 도토리 마을과 같은 Supabase 프로젝트의 Realtime(broadcast + presence)만 사용.
// DB 테이블은 쓰지 않습니다. anon 키는 브라우저용 공개 키입니다.
const SUPABASE_URL = 'https://qrhppnyvkquekenthzpd.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaHBwbnl2a3F1ZWtlbnRoenBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDczMTUsImV4cCI6MjEwNDM4MzMxNX0.gvaonBYFCl-vooO9nTZqxg5U1BoDOuoIMbrZSlzZG5g'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 20 } },
})

// 무료 플랜 한도: 초당 메시지 100개(보내기+받기 모두 셈, 1분 평균).
// 그림은 이 간격으로 모아서 보내고, 받는 쪽에서 부드럽게 이어 그립니다.
export const DRAW_FLUSH_MS = 250
