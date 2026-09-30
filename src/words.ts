// 일반 제시어 — 초등학생이 그릴 수 있는 쉬운 단어. 카테고리는 맞히는 사람에게 힌트로 보여 줍니다.
export const WORDS: Record<string, string[]> = {
  동물: [
    '고양이', '강아지', '토끼', '코끼리', '기린', '사자', '호랑이', '펭귄', '거북이', '뱀',
    '원숭이', '돼지', '닭', '오리', '물고기', '상어', '고래', '문어', '게', '달팽이',
    '나비', '거미', '개미', '벌', '부엉이', '곰', '다람쥐', '공룡', '낙타', '악어',
  ],
  음식: [
    '피자', '햄버거', '김밥', '라면', '떡볶이', '아이스크림', '케이크', '도넛', '치킨', '핫도그',
    '계란프라이', '빵', '우유', '사탕', '솜사탕', '팝콘', '초밥', '주먹밥', '만두', '쿠키',
  ],
  '과일·채소': [
    '사과', '바나나', '수박', '딸기', '포도', '파인애플', '체리', '레몬', '복숭아', '귤',
    '당근', '옥수수', '버섯', '고추', '감자', '양파', '호박', '브로콜리', '토마토', '오이',
  ],
  물건: [
    '우산', '안경', '시계', '가위', '연필', '지우개', '책', '가방', '의자', '침대',
    '컵', '숟가락', '열쇠', '전구', '휴대폰', '컴퓨터', '텔레비전', '선풍기', '냉장고', '카메라',
    '모자', '양말', '장갑', '신발', '거울', '칫솔', '빗자루', '풍선', '선물', '편지',
  ],
  탈것: [
    '자동차', '버스', '기차', '비행기', '배', '자전거', '오토바이', '헬리콥터', '로켓', '소방차',
    '구급차', '트럭', '잠수함', '열기구', '지하철',
  ],
  '자연·날씨': [
    '해', '달', '별', '구름', '비', '눈사람', '무지개', '번개', '산', '바다',
    '나무', '꽃', '해바라기', '화산', '섬', '폭포', '선인장', '나뭇잎', '눈', '바람',
  ],
  장소: [
    '학교', '병원', '집', '놀이터', '수영장', '도서관', '공원', '성', '텐트', '등대',
    '동물원', '교회', '다리', '피라미드', '우주',
  ],
  '운동·놀이': [
    '축구', '농구', '야구', '수영', '줄넘기', '스키', '볼링', '태권도', '연날리기', '그네',
    '미끄럼틀', '시소', '윷놀이', '팽이', '썰매',
  ],
  '사람·직업': [
    '경찰', '소방관', '의사', '요리사', '선생님', '가수', '화가', '우주비행사', '해적', '로봇',
    '마법사', '왕', '공주', '유령', '천사',
  ],
  몸: ['눈썹', '코', '입', '귀', '손', '발', '이빨', '머리카락', '심장', '뼈'],
}

export interface Word {
  w: string
  c: string
}

export const ALL_WORDS: Word[] = Object.entries(WORDS).flatMap(([c, ws]) => ws.map((w) => ({ w, c })))

/** 최근에 나온 단어를 피해서 n개 뽑기 */
export function pickWords(n: number, avoid: Set<string>): Word[] {
  const pool = ALL_WORDS.filter((x) => !avoid.has(x.w))
  const src = pool.length >= n ? pool : ALL_WORDS
  const out: Word[] = []
  const used = new Set<string>()
  while (out.length < n && used.size < src.length) {
    const x = src[Math.floor(Math.random() * src.length)]
    if (used.has(x.w)) continue
    used.add(x.w)
    out.push(x)
  }
  return out
}

/** 정답 비교용: 공백·문장부호 제거 + 소문자 ("우유?" → "우유") */
export const norm = (s: string) => s.replace(/[\s.,!?~^'"…·ㅋㅎ]+/g, '').toLowerCase()

/** 한 글자만 다르거나 한 글자 빠진/더한 경우 → "아깝다!" */
export function isClose(guess: string, word: string): boolean {
  const a = [...norm(guess)]
  const b = [...norm(word)]
  if (a.join('') === b.join('') || b.length < 2) return false
  if (a.length === b.length) return a.filter((ch, i) => ch !== b[i]).length === 1
  if (Math.abs(a.length - b.length) !== 1) return false
  const [s, l] = a.length < b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let skipped = false
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) {
      i++
      j++
    } else if (skipped) return false
    else {
      skipped = true
      j++
    }
  }
  return true
}
