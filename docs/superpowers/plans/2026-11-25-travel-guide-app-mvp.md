# travel-guide-app MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 위저드로 여행 조건을 받아 SerpApi 실제 가격 + Claude 일정 + Google Places 검증을 거친 여행 계획을 만들고, 일정·지도·예산 탭과 수정 채팅으로 보여주는 개인용 Next.js PWA를 만든다.

**Architecture:** Next.js App Router 한 프로젝트에 UI와 API 라우트가 같이 있다. 서버 전용 코드는 `src/server/`에 모으고(`import 'server-only'`), 외부 서비스마다 모듈 하나(`serpapi.ts`, `claude.ts`, `places.ts`, `db.ts`)를 두며 `pipeline.ts`만 이들을 엮는다. 외부 호출이 없는 규칙(정규화, 일정 후처리, 지정 장소 보호)은 `*-logic.ts` 순수 함수로 분리해 Vitest로 테스트한다.

**Tech Stack:** Next.js 16.4 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind CSS v4, zod 4, `@anthropic-ai/sdk` 1.14 (`claude-opus-5-5`, `claude-haiku-5-5`), `@supabase/supabase-js` 2, `@vis.gl/react-google-maps` 1.10, Vitest 5.

**Spec:** [`docs/superpowers/specs/2026-11-25-travel-guide-app-design.md`](../specs/2026-11-25-travel-guide-app-design.md)

## Global Constraints

- **커밋 정책 (2026-11-25 사용자 지시로 변경):** 작업은 `feature/mvp` 브랜치에서 한다. 각 태스크 마지막 단계의 "변경 확인 (커밋 금지)"는 **"태스크 변경분을 커밋하고 `git push`"**로 읽는다. `.env.local`은 절대 커밋하지 않는다. 커밋 메시지 끝에는 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙인다.
- 패키지 매니저는 npm 하나. Node 24.
- 모바일 우선, 라이트 모드 전용, 최대 폭 560px. 다크 모드 코드를 넣지 않는다.
- 색은 `src/app/globals.css`의 `@theme` 토큰만 쓴다. 컴포넌트에 임의 헥스 금지. 예외는 Google Maps 마커·선 색으로, `src/lib/categories.ts`의 상수 한 곳에만 둔다.
- 그림자, 그라디언트, 별도 강조색, 장식용 이모지·아이콘 금지. 경계는 `border-hairline`, 주 버튼은 `bg-ink text-canvas`.
- 터치 영역 최소 44px(`min-h-11`). 입력 필드 글자 16px(`text-field`).
- 모든 UI 문구와 에러 메시지는 한국어 해요체 한 문장.
- API 키는 서버 전용. 브라우저로 나가는 값은 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`뿐.
- 브라우저에서 Supabase를 직접 부르지 않는다. 모든 데이터는 `/api/*`를 지난다.
- Claude 모델: 일정 생성·수정 `claude-opus-5-5`(adaptive thinking, effort `high`), 공항 코드 추정 `claude-haiku-5-5`. **`claude-opus-5-5`는 강제 `tool_choice`(`any`/`tool`)를 400으로 거부하므로 구조화 출력(`output_config.format` + `zodOutputFormat`)을 쓴다.**
- 금액은 모두 원화 정수, 일행 전체 기준. 항공·숙박 금액과 총액은 AI 값을 쓰지 않고 서버가 계산한다.
- `MOCK_EXTERNAL=1`이면 Claude·SerpApi·Places를 부르지 않고 샘플 응답을 쓴다(Supabase는 실제로 쓴다).

## File Structure

```
.env.example
vitest.config.ts
test/server-only-stub.ts           ← Vitest에서 'server-only' import를 무력화
src/
  proxy.ts                         ← 로그인 쿠키 확인 (Next 16의 middleware)
  app/
    layout.tsx  globals.css  manifest.ts  fonts/Paperlogy-*.ttf
    page.tsx                       ← 계획 목록
    login/page.tsx
    new/page.tsx                   ← 위저드 (클라이언트 전용 로드)
    plans/[id]/page.tsx            ← 결과
    api/
      login/route.ts
      airports/guess/route.ts
      plans/route.ts
      plans/[id]/route.ts
      plans/[id]/retry/route.ts
      plans/[id]/revise/route.ts
  lib/                             ← 클라이언트·서버 공용, 순수
    schema.ts  dates.ts  format.ts  session.ts  categories.ts  api.ts  async.ts  names.ts
  components/
    Button.tsx  Chip.tsx  CategoryTag.tsx  ProgressDots.tsx  Sheet.tsx  ErrorState.tsx
  features/
    wizard/  draft.ts  useWizardDraft.ts  Wizard.tsx  StepFrame.tsx  steps/BasicSteps.tsx  steps/BookingSteps.tsx  steps/ConfirmStep.tsx
    plan/    usePlan.ts  PlanView.tsx  DayChips.tsx  ScheduleTab.tsx  MapTab.tsx  BudgetTab.tsx  GeneratingView.tsx  Revise.tsx
  server/
    env.ts  http.ts  db.ts
    serpapi.ts  serpapi-logic.ts
    places.ts   places-logic.ts
    claude.ts   prompts.ts
    itinerary-logic.ts  pipeline.ts
    fixtures/google-flights.json  fixtures/google-hotels.json  fixtures/mock.ts
```

---

### Task 1: 프로젝트 스캐폴딩, 디자인 토큰, 테스트 환경

**Files:**
- Create: Next.js 기본 파일 일체(create-next-app), `vitest.config.ts`, `test/server-only-stub.ts`, `src/app/manifest.ts`, `src/app/fonts/Paperlogy-{4Regular,6SemiBold,7Bold}.ttf`, `public/icons/*.png`, `.env.example`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `package.json`, `.gitignore`
- Test: `src/lib/smoke.test.ts` (확인 후 삭제)

**Interfaces:**
- Produces: Tailwind 토큰 클래스 `bg-canvas bg-surface border-hairline border-divider text-ink text-body text-muted text-placeholder bg-chip text-chip-fg`, 카테고리 `bg-cat-{landmark,food,stay,move,shop,nature}-{bg,fg}` / `text-cat-*-fg`, 글자 `text-date text-label text-content text-amount text-field`, 자간 `tracking-title tracking-label`, 모서리 `rounded-card rounded-sheet`. 스크립트 `npm test`.

- [ ] **Step 1: 임시 폴더에 Next.js 생성 후 저장소로 복사**

저장소 루트(`C:\Users\matth\travel-guide-app`)에는 이미 `docs/`, `supabase/`, `.gitignore`가 있으므로 옆 폴더에 만든 뒤 덮어쓰지 않고 복사한다.

```bash
cd /c/Users/matth
npx create-next-app@16.4.6 tga-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
cd tga-scaffold && rm -rf .git && cd ..
cp -rn tga-scaffold/. travel-guide-app/
cat tga-scaffold/.gitignore >> travel-guide-app/.gitignore
rm -rf tga-scaffold
cd travel-guide-app && sort -u .gitignore -o .gitignore && ls
```
Expected: `package.json`, `src/app`, `next.config.ts`, `docs`, `supabase`가 함께 보인다.

- [ ] **Step 2: 의존성 설치**

```bash
cd /c/Users/matth/travel-guide-app
npm i @anthropic-ai/sdk@1.14.0 @supabase/supabase-js@2.119.2 zod@4.6.7 @vis.gl/react-google-maps@1.10.2 server-only@0.0.1
npm i -D vitest@5.1.2 vite-tsconfig-paths@6.1.1
```

- [ ] **Step 3: gagyebu_2에서 폰트와 아이콘 복사**

```bash
cd /c/Users/matth/travel-guide-app
TMP=$(mktemp -d)
gh repo clone DoggySummer/gagyebu_2 "$TMP/g" -- --depth 1 -q
mkdir -p src/app/fonts public/icons
cp "$TMP/g/frontend/src/assets/fonts/Paperlogy-4Regular.ttf" "$TMP/g/frontend/src/assets/fonts/Paperlogy-6SemiBold.ttf" "$TMP/g/frontend/src/assets/fonts/Paperlogy-7Bold.ttf" src/app/fonts/
cp "$TMP/g/frontend/public/icons/"*.png public/icons/
rm -rf "$TMP"
ls src/app/fonts public/icons
```
Expected: 폰트 3개, 아이콘 5개(`apple-touch-icon-180.png favicon-32.png icon-192.png icon-512.png icon-maskable-512.png`). 아이콘은 임시이며 나중에 여행 앱 전용으로 바꾼다.

- [ ] **Step 4: `src/app/globals.css`를 토큰으로 교체**

```css
@import 'tailwindcss';

@theme inline {
  --font-sans:
    var(--font-paperlogy), -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic',
    sans-serif;
}

@theme {
  /* 표면 */
  --color-canvas: #fdfbf7;
  --color-surface: #fffdfa;
  --color-hairline: #ece6dc;
  --color-divider: #f2eee6;

  /* 텍스트 */
  --color-ink: #2b2a26;
  --color-body: #48453e;
  --color-muted: #aba391;
  --color-placeholder: #c4bca9;

  /* 칩 (미선택) */
  --color-chip: #f5f1ea;
  --color-chip-fg: #8a8271;

  /* 장소 카테고리 — 지도 핀 색은 src/lib/categories.ts 와 값이 같아야 한다 */
  --color-cat-landmark-bg: #e4e0f2;
  --color-cat-landmark-fg: #5b4e8c;
  --color-cat-food-bg: #fbe3d6;
  --color-cat-food-fg: #b0664a;
  --color-cat-stay-bg: #efe9da;
  --color-cat-stay-fg: #8a7a4e;
  --color-cat-move-bg: #dde7f2;
  --color-cat-move-fg: #4a6e96;
  --color-cat-shop-bg: #f7dfe6;
  --color-cat-shop-fg: #a85273;
  --color-cat-nature-bg: #ddebe0;
  --color-cat-nature-fg: #4a7c5e;

  /* 타이포그래피 (375px 기준) */
  --text-date: 22px;
  --text-date--line-height: 1.3;
  --text-label: 11px;
  --text-label--line-height: 1.4;
  --text-content: 15px;
  --text-content--line-height: 1.6;
  --text-amount: 32px;
  --text-amount--line-height: 1.2;
  --text-field: 16px;
  --text-field--line-height: 1.5;

  --tracking-title: -0.01em;
  --tracking-label: 0.14em;

  --radius-card: 10px;
  --radius-sheet: 16px;
}

@layer base {
  html {
    -webkit-text-size-adjust: 100%;
  }

  body {
    margin: 0;
    background-color: var(--color-canvas);
    color: var(--color-body);
    font-family: var(--font-sans);
    font-size: var(--text-content);
    line-height: 1.6;
  }
}
```

- [ ] **Step 5: `src/app/layout.tsx` 교체**

```tsx
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const paperlogy = localFont({
  src: [
    { path: './fonts/Paperlogy-4Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Paperlogy-6SemiBold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/Paperlogy-7Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-paperlogy',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '여행 가이드',
  description: 'AI가 짜주는 내 여행 계획',
  icons: {
    icon: '/icons/favicon-32.png',
    apple: '/icons/apple-touch-icon-180.png',
  },
  appleWebApp: { capable: true, title: '여행 가이드', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fdfbf7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={paperlogy.variable}>
      <body>
        <div className="mx-auto min-h-dvh w-full max-w-[560px]">{children}</div>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: `src/app/manifest.ts` 생성**

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '여행 가이드',
    short_name: '여행 가이드',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdfbf7',
    theme_color: '#fdfbf7',
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

- [ ] **Step 7: 기본 홈 화면을 임시 문구로 교체 (`src/app/page.tsx`)**

```tsx
export default function HomePage() {
  return (
    <main className="px-4 py-5">
      <p className="text-label font-semibold uppercase tracking-label text-muted">Travel Guide</p>
      <h1 className="text-date font-bold tracking-title text-ink">여행 가이드</h1>
    </main>
  )
}
```
create-next-app이 만든 `public/*.svg`는 지운다: `rm -f public/*.svg`

- [ ] **Step 8: Vitest 설정**

`test/server-only-stub.ts`:
```ts
// Vitest는 react-server 조건으로 실행되지 않아 'server-only'가 예외를 던진다. 테스트에서만 빈 모듈로 바꾼다.
export {}
```

`vitest.config.ts`:
```ts
import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

`package.json`의 `scripts`에 추가:
```json
"test": "vitest run",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 9: 스모크 테스트로 설정 확인**

`src/lib/smoke.test.ts`:
```ts
import { expect, test } from 'vitest'

test('vitest runs', () => {
  expect(1 + 1).toBe(2)
})
```
Run: `npm test`
Expected: `1 passed`. 확인 후 `rm src/lib/smoke.test.ts`.

- [ ] **Step 10: `.env.example` 작성**

```bash
# 로그인 비밀번호 (8자 이상)
APP_PASSWORD=change-me-please
# 쿠키 서명용 임의 문자열 (32자 이상). 생성: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=
ANTHROPIC_API_KEY=
SERPAPI_API_KEY=
GOOGLE_PLACES_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAP_ID=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
# 1이면 Claude·SerpApi·Places 대신 샘플 응답 사용
MOCK_EXTERNAL=0
```
`.gitignore`에 `.env*.local`이 있고 `.env.example`은 무시되지 않는지 확인: `git check-ignore .env.example; echo $?` → `1`.

- [ ] **Step 11: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: 둘 다 오류 없이 끝난다.

- [ ] **Step 12: 변경 확인 (커밋 금지)**

Run: `git status --short`
Expected: 새 파일 목록이 보인다. 커밋하지 않는다.

---

### Task 2: 공용 스키마, 날짜·형식 유틸

**Files:**
- Create: `src/lib/schema.ts`, `src/lib/dates.ts`, `src/lib/format.ts`, `src/lib/names.ts`
- Test: `src/lib/schema.test.ts`, `src/lib/dates.test.ts`, `src/lib/format.test.ts`, `src/lib/names.test.ts`

**Interfaces:**
- Produces (`@/lib/schema`):
  - 상수 `CATEGORIES`, `STYLES`, `COMPANIONS`, `PACES`, `BUDGETS`, `TRANSPORTS`
  - 스키마 `CategorySchema`, `PlanInputSchema`, `AiItinerarySchema`, `AiRevisionSchema`, `AirportGuessSchema`, `ItinerarySchema`, `OffersSchema`, `PlaceInfoSchema`
  - 타입 `Category`, `TravelStyle`, `Companion`, `Pace`, `BudgetLevel`, `Transport`, `PlanInput`, `FlightInput`, `StayInput`, `AiItinerary`, `AiItem`, `AiRevision`, `Itinerary`, `Item`, `Day`, `PlaceInfo`, `FlightOffer`, `HotelOffer`, `Offers`, `PlanStatus`, `ProgressStep`, `PlanDto`, `PlanSummaryDto`, `MessageDto`, `PlanDetailDto`
- Produces: `tripDates(start: string, end: string): string[]` (`@/lib/dates`), `formatKrw(n: number): string`, `formatShortDate(iso: string): string`, `formatDateRange(start: string, end: string): string`, `formatDuration(min: number): string` (`@/lib/format`), `normalizeName(s: string): string`, `nameMatches(a: string, b: string): boolean` (`@/lib/names`)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/dates.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import { tripDates } from './dates'

describe('tripDates', () => {
  test('시작일과 종료일을 포함한 날짜 목록을 만든다', () => {
    expect(tripDates('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
  })

  test('당일치기는 하루짜리 목록이다', () => {
    expect(tripDates('2026-12-18', '2026-12-18')).toEqual(['2026-12-18'])
  })

  test('종료일이 시작일보다 앞서거나 형식이 틀리면 빈 목록이다', () => {
    expect(tripDates('2026-12-18', '2026-12-17')).toEqual([])
    expect(tripDates('2026-12-18', 'nope')).toEqual([])
  })
})
```

`src/lib/format.test.ts`:
```ts
import { expect, test } from 'vitest'
import { formatDateRange, formatDuration, formatKrw, formatShortDate } from './format'

test('formatKrw', () => {
  expect(formatKrw(1482000)).toBe('1,482,000원')
  expect(formatKrw(0)).toBe('0원')
})

test('formatShortDate / formatDateRange', () => {
  expect(formatShortDate('2026-12-08')).toBe('12.08')
  expect(formatDateRange('2026-12-18', '2026-12-21')).toBe('12.18 – 12.21')
})

test('formatDuration', () => {
  expect(formatDuration(105)).toBe('1시간 45분')
  expect(formatDuration(120)).toBe('2시간')
  expect(formatDuration(40)).toBe('40분')
})
```

`src/lib/names.test.ts`:
```ts
import { expect, test } from 'vitest'
import { nameMatches, normalizeName } from './names'

test('normalizeName은 공백·괄호 앞뒤 공백·대소문자를 무시한다', () => {
  expect(normalizeName('  Oriental Pearl  Tower ')).toBe('orientalpearltower')
})

test('nameMatches는 한쪽이 다른 쪽을 포함하면 같은 장소로 본다', () => {
  expect(nameMatches('동방명주', 'Oriental Pearl Tower (동방명주)')).toBe(true)
  expect(nameMatches('신천지', 'Xintiandi (신천지)')).toBe(true)
  expect(nameMatches('신천지', '와이탄')).toBe(false)
  expect(nameMatches('', '와이탄')).toBe(false)
})
```

`src/lib/schema.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import { PlanInputSchema, type PlanInput } from './schema'

const valid: PlanInput = {
  destination: '상해',
  startDate: '2026-12-18',
  endDate: '2026-12-21',
  origin: '인천',
  adults: 2,
  children: 0,
  companion: '연인',
  styles: ['맛집', '야경'],
  mustVisit: ['동방명주', '신천지'],
  pace: '보통',
  budget: '보통',
  transport: '대중교통',
  flight: { mode: 'search', departureId: 'ICN', arrivalId: 'PVG' },
  stay: { mode: 'search', area: '' },
  notes: '',
}

describe('PlanInputSchema', () => {
  test('올바른 입력을 통과시킨다', () => {
    expect(PlanInputSchema.safeParse(valid).success).toBe(true)
  })

  test('예약 완료 항공·숙소 입력을 통과시킨다', () => {
    const booked = {
      ...valid,
      flight: {
        mode: 'booked',
        flightNumber: 'KE893',
        outboundArrival: '2026-12-18T11:40',
        returnDeparture: '2026-12-21T19:30',
        totalKrw: 562000,
      },
      stay: { mode: 'booked', name: '푸동 샹그릴라', address: '33 Fucheng Rd', totalKrw: 504000 },
    }
    expect(PlanInputSchema.safeParse(booked).success).toBe(true)
  })

  test('종료일이 시작일보다 앞서면 실패한다', () => {
    expect(PlanInputSchema.safeParse({ ...valid, endDate: '2026-12-17' }).success).toBe(false)
  })

  test('15일 이상이면 실패한다', () => {
    expect(PlanInputSchema.safeParse({ ...valid, endDate: '2027-01-01' }).success).toBe(false)
  })

  test('여행 스타일이 없거나 꼭 가고 싶은 곳이 10개를 넘으면 실패한다', () => {
    expect(PlanInputSchema.safeParse({ ...valid, styles: [] }).success).toBe(false)
    const many = Array.from({ length: 11 }, (_, i) => `장소${i}`)
    expect(PlanInputSchema.safeParse({ ...valid, mustVisit: many }).success).toBe(false)
  })

  test('공항 코드는 대문자 3글자여야 한다', () => {
    const bad = { ...valid, flight: { mode: 'search', departureId: 'icn', arrivalId: 'PVG' } }
    expect(PlanInputSchema.safeParse(bad).success).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './dates'` 등.

- [ ] **Step 3: `src/lib/dates.ts` 구현**

```ts
const DAY_MS = 86_400_000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** 시작일~종료일(포함)의 YYYY-MM-DD 목록. 잘못된 입력이면 빈 배열. */
export function tripDates(start: string, end: string): string[] {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return []
  const s = Date.parse(`${start}T00:00:00Z`)
  const e = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return []

  const out: string[] = []
  for (let t = s; t <= e; t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}
```

- [ ] **Step 4: `src/lib/format.ts` 구현**

```ts
export function formatKrw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export function formatShortDate(iso: string): string {
  const [, m = '', d = ''] = iso.split('-')
  return `${m}.${d}`
}

export function formatDateRange(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}
```

- [ ] **Step 5: `src/lib/names.ts` 구현**

```ts
/** 장소 이름 비교용: 소문자, 모든 공백 제거. */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

/** 한쪽 이름이 다른 쪽에 포함되면 같은 장소로 본다. "동방명주" ↔ "Oriental Pearl Tower (동방명주)" */
export function nameMatches(a: string, b: string): boolean {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return false
  return x.includes(y) || y.includes(x)
}
```

- [ ] **Step 6: `src/lib/schema.ts` 구현**

AI 출력용 스키마(`Ai*`)에는 정규식·최소·최대 제약을 넣지 않는다. 구조화 출력이 지원하지 않는 제약이라 SDK가 지워버리므로, 형식 확인은 서버 후처리(Task 8)에서 한다.

```ts
import { z } from 'zod'
import { tripDates } from './dates'

export const CATEGORIES = ['랜드마크', '음식점', '숙소', '이동', '쇼핑', '자연'] as const
export const STYLES = ['맛집', '관광명소', '쇼핑', '자연', '휴양', '야경', '액티비티', '문화·역사'] as const
export const COMPANIONS = ['혼자', '연인', '친구', '가족'] as const
export const PACES = ['여유', '보통', '빡빡'] as const
export const BUDGETS = ['저렴', '보통', '여유'] as const
export const TRANSPORTS = ['대중교통', '렌터카', '도보 위주'] as const
export const MAX_TRIP_DAYS = 14

export const CategorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof CategorySchema>
export type TravelStyle = (typeof STYLES)[number]
export type Companion = (typeof COMPANIONS)[number]
export type Pace = (typeof PACES)[number]
export type BudgetLevel = (typeof BUDGETS)[number]
export type Transport = (typeof TRANSPORTS)[number]

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
const iata = z.string().regex(/^[A-Z]{3}$/)
const krw = z.number().int().min(0).max(100_000_000)

// ── 위저드 입력 ─────────────────────────────────────────────

export const FlightInputSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('search'), departureId: iata, arrivalId: iata }),
  z.object({
    mode: z.literal('booked'),
    flightNumber: z.string().trim().min(2).max(20),
    outboundArrival: localDateTime,
    returnDeparture: localDateTime,
    totalKrw: krw,
  }),
  z.object({ mode: z.literal('none') }),
])
export type FlightInput = z.infer<typeof FlightInputSchema>

export const StayInputSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('search'), area: z.string().trim().max(50) }),
  z.object({
    mode: z.literal('booked'),
    name: z.string().trim().min(1).max(100),
    address: z.string().trim().max(200),
    totalKrw: krw,
  }),
])
export type StayInput = z.infer<typeof StayInputSchema>

export const PlanInputSchema = z
  .object({
    destination: z.string().trim().min(1).max(50),
    startDate: isoDate,
    endDate: isoDate,
    origin: z.string().trim().min(1).max(50),
    adults: z.number().int().min(1).max(9),
    children: z.number().int().min(0).max(8),
    companion: z.enum(COMPANIONS),
    styles: z.array(z.enum(STYLES)).min(1),
    mustVisit: z.array(z.string().trim().min(1).max(50)).max(10),
    pace: z.enum(PACES),
    budget: z.enum(BUDGETS),
    transport: z.enum(TRANSPORTS),
    flight: FlightInputSchema,
    stay: StayInputSchema,
    notes: z.string().max(500),
  })
  .superRefine((v, ctx) => {
    const days = tripDates(v.startDate, v.endDate).length
    if (days === 0) ctx.addIssue({ code: 'custom', path: ['endDate'], message: '귀국일이 출발일보다 빨라요.' })
    if (days > MAX_TRIP_DAYS)
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: `여행 기간은 최대 ${MAX_TRIP_DAYS}일이에요.` })
  })
export type PlanInput = z.infer<typeof PlanInputSchema>

// ── 가격 후보 (SerpApi 정규화 결과) ─────────────────────────

export const FlightOfferSchema = z.object({
  offerId: z.string(),
  airline: z.string(),
  flightNumbers: z.array(z.string()),
  departAirport: z.string(),
  departTime: z.string(),
  arriveAirport: z.string(),
  arriveTime: z.string(),
  durationMin: z.number(),
  stops: z.number(),
  priceKrw: z.number(),
  link: z.string(),
})
export type FlightOffer = z.infer<typeof FlightOfferSchema>

export const HotelOfferSchema = z.object({
  offerId: z.string(),
  name: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  rating: z.number().nullable(),
  totalPriceKrw: z.number(),
  link: z.string(),
})
export type HotelOffer = z.infer<typeof HotelOfferSchema>

export const OffersSchema = z.object({
  flights: z.array(FlightOfferSchema),
  hotels: z.array(HotelOfferSchema),
  flightError: z.string().nullable(),
  hotelError: z.string().nullable(),
})
export type Offers = z.infer<typeof OffersSchema>

// ── AI 출력 (구조화 출력 스키마) ─────────────────────────────

export const AiItemSchema = z.object({
  time: z.string().describe('HH:mm 24시간 형식'),
  placeName: z.string().describe('Google 지도에서 검색되는 장소 이름'),
  category: CategorySchema,
  description: z.string().describe('한두 문장 설명'),
  estCostKrw: z.number().int().describe('일행 전체 기준 원화 추정치, 무료면 0'),
  mustVisit: z.boolean().describe('사용자가 꼭 가고 싶다고 지정한 장소면 true'),
})
export type AiItem = z.infer<typeof AiItemSchema>

export const AiDaySchema = z.object({
  date: z.string().describe('YYYY-MM-DD'),
  theme: z.string().describe('그날의 한 줄 요약'),
  items: z.array(AiItemSchema),
})

const AiChoiceSchema = z.object({
  offerId: z.string().nullable().describe('offers에 있는 id. 후보가 없거나 이미 예약했으면 null'),
  reason: z.string(),
})

export const AiItinerarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  flightChoice: AiChoiceSchema,
  stayChoice: AiChoiceSchema,
  days: z.array(AiDaySchema),
  budget: z.object({
    foodKrw: z.number().int(),
    localTransportKrw: z.number().int(),
    extraKrw: z.number().int(),
    notes: z.string(),
  }),
})
export type AiItinerary = z.infer<typeof AiItinerarySchema>

export const AiRevisionSchema = z.object({
  reply: z.string().describe('무엇을 바꿨는지 사용자에게 보여줄 한두 문장'),
  itinerary: AiItinerarySchema,
})
export type AiRevision = z.infer<typeof AiRevisionSchema>

export const AirportGuessSchema = z.object({
  departureId: z.string().describe('출발 공항 IATA 코드 3글자'),
  arrivalId: z.string().describe('도착 공항 IATA 코드 3글자'),
})

// ── 저장되는 최종 일정 ───────────────────────────────────────

export const PlaceInfoSchema = z.object({
  status: z.enum(['verified', 'unverified']),
  placeId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.string().optional(),
  rating: z.number().optional(),
  mapsUrl: z.string().optional(),
})
export type PlaceInfo = z.infer<typeof PlaceInfoSchema>

export const ItemSchema = AiItemSchema.extend({
  id: z.string(),
  place: PlaceInfoSchema.optional(),
})
export type Item = z.infer<typeof ItemSchema>

export const DaySchema = AiDaySchema.extend({ items: z.array(ItemSchema) })
export type Day = z.infer<typeof DaySchema>

export const ItinerarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  flight: z.object({
    kind: z.enum(['offer', 'booked', 'none', 'unavailable']),
    offerId: z.string().nullable(),
    reason: z.string(),
  }),
  stay: z.object({
    kind: z.enum(['offer', 'booked', 'unavailable']),
    offerId: z.string().nullable(),
    reason: z.string(),
  }),
  days: z.array(DaySchema),
  budget: z.object({
    flightKrw: z.number(),
    stayKrw: z.number(),
    foodKrw: z.number(),
    localTransportKrw: z.number(),
    extraKrw: z.number(),
    totalKrw: z.number(),
    notes: z.string(),
  }),
})
export type Itinerary = z.infer<typeof ItinerarySchema>

// ── API DTO ──────────────────────────────────────────────────

export type PlanStatus = 'generating' | 'ready' | 'failed'
export type ProgressStep = 'offers' | 'itinerary' | 'places'

export type PlanDto = {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  status: PlanStatus
  progressStep: ProgressStep | null
  input: PlanInput
  offers: Offers | null
  itinerary: Itinerary | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type PlanSummaryDto = Pick<
  PlanDto,
  'id' | 'title' | 'destination' | 'startDate' | 'endDate' | 'status' | 'createdAt'
>

export type MessageDto = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type PlanDetailDto = { plan: PlanDto; messages: MessageDto[] }
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm test`
Expected: 4개 파일 모두 PASS.

- [ ] **Step 8: 타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm run typecheck && git status --short`

---

### Task 3: 환경변수, 세션 쿠키, 로그인

**Files:**
- Create: `src/lib/session.ts`, `src/server/env.ts`, `src/server/http.ts`, `src/lib/api.ts`, `src/proxy.ts`, `src/app/api/login/route.ts`, `src/app/login/page.tsx`, `src/components/Button.tsx`
- Test: `src/lib/session.test.ts`

**Interfaces:**
- Produces (`@/lib/session`): `SESSION_COOKIE = 'tga_session'`, `SESSION_MAX_AGE_SEC`, `createSessionToken(secret: string, nowMs?: number): Promise<string>`, `verifySessionToken(token: string, secret: string, nowMs?: number): Promise<boolean>`, `timingSafeEqualStr(a: string, b: string): boolean`
- Produces (`@/server/env`): `env(): Env` (필드는 `.env.example`과 같은 이름), `isMock(): boolean`
- Produces (`@/server/http`): `jsonError(message: string, status: number): NextResponse`, `readJson(req: Request): Promise<unknown>`
- Produces (`@/lib/api`): `class ApiError extends Error { status: number }`, `apiFetch<T>(path: string, init?: RequestInit): Promise<T>`
- Produces (`@/components/Button`): `<Button variant?: 'primary' | 'secondary' | 'text' ...ButtonHTMLAttributes>`

- [ ] **Step 1: 실패하는 테스트 작성 — `src/lib/session.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { SESSION_MAX_AGE_SEC, createSessionToken, timingSafeEqualStr, verifySessionToken } from './session'

const SECRET = 'a'.repeat(32)
const NOW = Date.parse('2026-12-01T00:00:00Z')

describe('session token', () => {
  test('만든 토큰은 같은 비밀값으로 검증된다', async () => {
    const token = await createSessionToken(SECRET, NOW)
    expect(await verifySessionToken(token, SECRET, NOW)).toBe(true)
  })

  test('다른 비밀값이면 실패한다', async () => {
    const token = await createSessionToken(SECRET, NOW)
    expect(await verifySessionToken(token, 'b'.repeat(32), NOW)).toBe(false)
  })

  test('만료 후에는 실패한다', async () => {
    const token = await createSessionToken(SECRET, NOW)
    const later = NOW + (SESSION_MAX_AGE_SEC + 1) * 1000
    expect(await verifySessionToken(token, SECRET, later)).toBe(false)
  })

  test('변조된 토큰은 실패한다', async () => {
    const token = await createSessionToken(SECRET, NOW)
    const [exp, sig] = token.split('.')
    expect(await verifySessionToken(`${Number(exp) + 999}.${sig}`, SECRET, NOW)).toBe(false)
    expect(await verifySessionToken('garbage', SECRET, NOW)).toBe(false)
  })
})

test('timingSafeEqualStr', () => {
  expect(timingSafeEqualStr('abc', 'abc')).toBe(true)
  expect(timingSafeEqualStr('abc', 'abd')).toBe(false)
  expect(timingSafeEqualStr('abc', 'abcd')).toBe(false)
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/session.test.ts`
Expected: FAIL — `Cannot find module './session'`

- [ ] **Step 3: `src/lib/session.ts` 구현**

`proxy.ts`에서도 쓰므로 Node 전용 API 없이 Web Crypto만 쓴다.

```ts
export const SESSION_COOKIE = 'tga_session'
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30

const encoder = new TextEncoder()

function toBase64Url(buf: ArrayBuffer): string {
  let bin = ''
  for (const byte of new Uint8Array(buf)) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** 토큰 형식: `<만료 unix초>.<HMAC-SHA256(만료)>` */
export async function createSessionToken(secret: string, nowMs: number = Date.now()): Promise<string> {
  const exp = String(Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SEC)
  return `${exp}.${await hmac(secret, exp)}`
}

export async function verifySessionToken(token: string, secret: string, nowMs: number = Date.now()): Promise<boolean> {
  const [exp, sig, extra] = token.split('.')
  if (!exp || !sig || extra !== undefined || !/^\d+$/.test(exp)) return false
  if (!timingSafeEqualStr(await hmac(secret, exp), sig)) return false
  return Number(exp) > nowMs / 1000
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/session.test.ts`
Expected: PASS

- [ ] **Step 5: `src/server/env.ts` 구현**

```ts
import 'server-only'
import { z } from 'zod'

const EnvSchema = z.object({
  APP_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(32),
  ANTHROPIC_API_KEY: z.string().min(1),
  SERPAPI_API_KEY: z.string().min(1),
  GOOGLE_PLACES_API_KEY: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  MOCK_EXTERNAL: z.enum(['0', '1']).default('0'),
})
export type Env = z.infer<typeof EnvSchema>

let cached: Env | null = null

/** 처음 호출할 때 검증한다. 빠진 값이 있으면 이름을 담아 예외를 던진다. */
export function env(): Env {
  if (cached) return cached
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`환경변수가 올바르지 않습니다: ${names}`)
  }
  cached = result.data
  return cached
}

export function isMock(): boolean {
  return env().MOCK_EXTERNAL === '1'
}
```

- [ ] **Step 6: `src/server/http.ts` 구현**

```ts
import 'server-only'
import { NextResponse } from 'next/server'

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/** 본문이 JSON이 아니면 null. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
```

- [ ] **Step 7: `src/app/api/login/route.ts` 구현**

```ts
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC, createSessionToken, timingSafeEqualStr } from '@/lib/session'
import { env } from '@/server/env'
import { jsonError, readJson } from '@/server/http'

export async function POST(req: Request) {
  const body = (await readJson(req)) as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''
  const { APP_PASSWORD, SESSION_SECRET } = env()

  if (!timingSafeEqualStr(password, APP_PASSWORD)) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return jsonError('비밀번호가 맞지 않아요.', 401)
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, await createSessionToken(SESSION_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  })
  return res
}
```

- [ ] **Step 8: `src/proxy.ts` 구현**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

const PUBLIC_PATHS = new Set(['/login', '/api/login'])

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const secret = process.env.SESSION_SECRET ?? ''
  if (token && secret && (await verifySessionToken(token, secret))) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|manifest.webmanifest|icons/).*)'],
}
```

- [ ] **Step 9: `src/lib/api.ts` 구현 (브라우저 전용 fetch 래퍼)**

```ts
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = (await res.json().catch(() => null)) as { error?: string } | null

  if (res.status === 401 && path !== '/api/login') {
    window.location.href = '/login'
    throw new ApiError('로그인이 필요해요.', 401)
  }
  if (!res.ok) throw new ApiError(body?.error ?? '요청을 처리하지 못했어요.', res.status)
  return body as T
}
```

- [ ] **Step 10: `src/components/Button.tsx` 구현**

```tsx
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'text'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'w-full min-h-12 rounded-card bg-ink text-canvas font-semibold disabled:opacity-40',
  secondary:
    'min-h-11 rounded-card border border-hairline bg-surface px-4 text-field font-semibold text-body disabled:opacity-40',
  text: 'min-h-11 px-2 text-content text-muted underline-offset-4 hover:underline disabled:opacity-40',
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${VARIANT_CLASS[variant]} ${className}`} {...props} />
}
```

- [ ] **Step 11: `src/app/login/page.tsx` 구현**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ password }) })
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인하지 못했어요.')
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-4">
      <p className="text-label font-semibold uppercase tracking-label text-muted">Travel Guide</p>
      <h1 className="mt-1 text-date font-bold tracking-title text-ink">비밀번호를 입력해주세요</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="min-h-12 rounded-card border border-hairline bg-surface px-3 text-field text-ink placeholder:text-placeholder focus:border-ink focus:outline-none"
        />
        {error && (
          <p role="alert" className="text-content text-body">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending || password.length === 0}>
          {pending ? '확인 중' : '들어가기'}
        </Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 12: 수동 확인**

`.env.local`을 만든다(값은 임시, `SUPABASE_*`와 외부 키는 아직 없으면 `dummy`로):
```bash
cp .env.example .env.local
```
`.env.local`에서 `APP_PASSWORD=test-password-1`, `SESSION_SECRET=`에 32자 이상 임의값, `SUPABASE_URL=https://example.supabase.co`, 나머지 키는 `dummy`, `MOCK_EXTERNAL=1`.

Run: `npm run dev` 후 브라우저(모바일 크기)로 `http://localhost:3000` 접속.
Expected: `/login`으로 이동 → 틀린 비밀번호는 1초 뒤 "비밀번호가 맞지 않아요." → 맞는 비밀번호면 홈 화면. `curl -i http://localhost:3000/api/plans` → `401`.

- [ ] **Step 13: 테스트·타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm test && npm run typecheck && git status --short`

---
### Task 4: Supabase 연결과 DB 접근 함수

**Files:**
- Create: `src/server/db.ts`
- Uses: `supabase/migrations/20261125000000_init.sql` (이미 있음)

**Interfaces:**
- Consumes: `env()` (Task 3), DTO 타입 (Task 2)
- Produces (`@/server/db`):
  - `insertPlan(input: PlanInput): Promise<string>` — 새 id
  - `getPlan(id: string): Promise<PlanDto | null>`
  - `listPlans(): Promise<PlanSummaryDto[]>` — 최신순 100개
  - `updatePlan(id: string, patch: PlanPatch): Promise<void>`
  - `deletePlan(id: string): Promise<void>`
  - `listMessages(planId: string, limit?: number): Promise<MessageDto[]>` — 오래된 순
  - `insertMessage(planId: string, role: 'user' | 'assistant', content: string): Promise<MessageDto>`
  - `type PlanPatch = Partial<{ title: string; status: PlanStatus; progressStep: ProgressStep | null; offers: Offers; itinerary: Itinerary; error: string | null }>`

- [ ] **Step 1: (사용자) Supabase에 테이블 생성**

사용자에게 요청한다: Supabase Dashboard → SQL Editor → `supabase/migrations/20261125000000_init.sql` 내용을 붙여넣고 Run. Table Editor에 `plans`, `plan_messages`가 보이면 완료.
사용자에게 `.env.local`의 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`를 실제 값으로 바꿔달라고 요청한다(키를 채팅에 붙여넣지 않도록 안내).

- [ ] **Step 2: `src/server/db.ts` 구현**

```ts
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Itinerary,
  MessageDto,
  Offers,
  PlanDto,
  PlanInput,
  PlanStatus,
  PlanSummaryDto,
  ProgressStep,
} from '@/lib/schema'
import { env } from './env'

let client: SupabaseClient | null = null

function db(): SupabaseClient {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env()
    client = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

type PlanRow = {
  id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  status: PlanStatus
  progress_step: ProgressStep | null
  input: PlanInput
  offers: Offers | null
  itinerary: Itinerary | null
  error: string | null
  created_at: string
  updated_at: string
}

type MessageRow = { id: string; role: 'user' | 'assistant'; content: string; created_at: string }

export type PlanPatch = Partial<{
  title: string
  status: PlanStatus
  progressStep: ProgressStep | null
  offers: Offers
  itinerary: Itinerary
  error: string | null
}>

function toPlanDto(row: PlanRow): PlanDto {
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    progressStep: row.progress_step,
    input: row.input,
    offers: row.offers,
    itinerary: row.itinerary,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toMessageDto(row: MessageRow): MessageDto {
  return { id: row.id, role: row.role, content: row.content, createdAt: row.created_at }
}

function fail(action: string, error: { message: string }): never {
  throw new Error(`DB ${action} 실패: ${error.message}`)
}

export async function insertPlan(input: PlanInput): Promise<string> {
  const { data, error } = await db()
    .from('plans')
    .insert({
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      status: 'generating',
      progress_step: 'offers',
      input,
    })
    .select('id')
    .single()
  if (error) fail('insertPlan', error)
  return (data as { id: string }).id
}

export async function getPlan(id: string): Promise<PlanDto | null> {
  const { data, error } = await db().from('plans').select('*').eq('id', id).maybeSingle()
  if (error) fail('getPlan', error)
  return data ? toPlanDto(data as PlanRow) : null
}

export async function listPlans(): Promise<PlanSummaryDto[]> {
  const { data, error } = await db()
    .from('plans')
    .select('id, title, destination, start_date, end_date, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) fail('listPlans', error)
  return (data as PlanRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
  }))
}

export async function updatePlan(id: string, patch: PlanPatch): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.title !== undefined) row.title = patch.title
  if (patch.status !== undefined) row.status = patch.status
  if (patch.progressStep !== undefined) row.progress_step = patch.progressStep
  if (patch.offers !== undefined) row.offers = patch.offers
  if (patch.itinerary !== undefined) row.itinerary = patch.itinerary
  if (patch.error !== undefined) row.error = patch.error
  const { error } = await db().from('plans').update(row).eq('id', id)
  if (error) fail('updatePlan', error)
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await db().from('plans').delete().eq('id', id)
  if (error) fail('deletePlan', error)
}

export async function listMessages(planId: string, limit = 50): Promise<MessageDto[]> {
  const { data, error } = await db()
    .from('plan_messages')
    .select('id, role, content, created_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) fail('listMessages', error)
  return (data as MessageRow[]).map(toMessageDto).reverse()
}

export async function insertMessage(
  planId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<MessageDto> {
  const { data, error } = await db()
    .from('plan_messages')
    .insert({ plan_id: planId, role, content })
    .select('id, role, content, created_at')
    .single()
  if (error) fail('insertMessage', error)
  return toMessageDto(data as MessageRow)
}
```

- [ ] **Step 3: 타입 검사**

Run: `npm run typecheck`
Expected: 오류 없음. (DB 동작은 Task 9의 API로 확인한다.)

- [ ] **Step 4: 변경 확인 (커밋 금지)**

Run: `git status --short`

---

### Task 5: SerpApi 항공·호텔 조회

**Files:**
- Create: `src/server/serpapi-logic.ts`, `src/server/serpapi.ts`, `src/server/fixtures/google-flights.json`, `src/server/fixtures/google-hotels.json`
- Test: `src/server/serpapi-logic.test.ts`

**Interfaces:**
- Consumes: `FlightOffer`, `HotelOffer`, `Offers`, `PlanInput`, `BudgetLevel` (Task 2), `env()`, `isMock()` (Task 3)
- Produces (`@/server/serpapi-logic`): `normalizeFlights(raw: unknown, limit?: number): FlightOffer[]`, `normalizeHotels(raw: unknown, budget: BudgetLevel, limit?: number): HotelOffer[]`
- Produces (`@/server/serpapi`): `fetchOffers(input: PlanInput): Promise<Offers>` — 실패해도 throw하지 않고 `flightError`/`hotelError`에 문구를 담는다

- [ ] **Step 1: 샘플 응답 픽스처 작성**

`src/server/fixtures/google-flights.json` (SerpApi `google_flights` 응답의 필요한 부분만):
```json
{
  "search_metadata": { "google_flights_url": "https://www.google.com/travel/flights?hl=ko&q=ICN-KIX" },
  "best_flights": [
    {
      "flights": [
        {
          "departure_airport": { "id": "ICN", "time": "2026-12-18 09:55" },
          "arrival_airport": { "id": "KIX", "time": "2026-12-18 11:40" },
          "airline": "대한항공",
          "flight_number": "KE 723"
        }
      ],
      "total_duration": 105,
      "price": 562000
    }
  ],
  "other_flights": [
    {
      "flights": [
        {
          "departure_airport": { "id": "ICN", "time": "2026-12-18 07:10" },
          "arrival_airport": { "id": "KIX", "time": "2026-12-18 09:00" },
          "airline": "제주항공",
          "flight_number": "7C 1302"
        }
      ],
      "total_duration": 110,
      "price": 398000
    },
    {
      "flights": [
        {
          "departure_airport": { "id": "ICN", "time": "2026-12-18 13:00" },
          "arrival_airport": { "id": "NRT", "time": "2026-12-18 15:20" },
          "airline": "ANA",
          "flight_number": "NH 862"
        },
        {
          "departure_airport": { "id": "NRT", "time": "2026-12-18 17:00" },
          "arrival_airport": { "id": "KIX", "time": "2026-12-18 18:20" },
          "airline": "ANA",
          "flight_number": "NH 2177"
        }
      ],
      "total_duration": 320,
      "price": 690000
    },
    {
      "flights": [
        {
          "departure_airport": { "id": "ICN", "time": "2026-12-18 20:00" },
          "arrival_airport": { "id": "KIX", "time": "2026-12-18 21:45" },
          "airline": "가격없음항공",
          "flight_number": "XX 1"
        }
      ],
      "total_duration": 105
    }
  ]
}
```

`src/server/fixtures/google-hotels.json`:
```json
{
  "search_metadata": { "google_hotels_url": "https://www.google.com/travel/hotels?q=osaka" },
  "properties": [
    {
      "name": "호텔 한큐 레스파이어 오사카",
      "gps_coordinates": { "latitude": 34.7055, "longitude": 135.4983 },
      "overall_rating": 4.4,
      "total_rate": { "extracted_lowest": 504000 },
      "link": "https://example.com/hankyu"
    },
    {
      "name": "난바 비즈니스 호텔",
      "gps_coordinates": { "latitude": 34.6659, "longitude": 135.5013 },
      "overall_rating": 3.8,
      "total_rate": { "extracted_lowest": 270000 }
    },
    {
      "name": "콘래드 오사카",
      "gps_coordinates": { "latitude": 34.6931, "longitude": 135.4930 },
      "overall_rating": 4.7,
      "total_rate": { "extracted_lowest": 1620000 },
      "link": "https://example.com/conrad"
    },
    {
      "name": "가격 없는 료칸",
      "overall_rating": 4.9
    }
  ]
}
```

- [ ] **Step 2: 실패하는 테스트 작성 — `src/server/serpapi-logic.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import flights from './fixtures/google-flights.json'
import hotels from './fixtures/google-hotels.json'
import { normalizeFlights, normalizeHotels } from './serpapi-logic'

describe('normalizeFlights', () => {
  test('best_flights와 other_flights를 합치고 가격 없는 항목은 뺀다', () => {
    const result = normalizeFlights(flights)
    expect(result.map((f) => f.offerId)).toEqual(['F1', 'F2', 'F3'])
    expect(result[0]).toEqual({
      offerId: 'F1',
      airline: '대한항공',
      flightNumbers: ['KE 723'],
      departAirport: 'ICN',
      departTime: '2026-12-18 09:55',
      arriveAirport: 'KIX',
      arriveTime: '2026-12-18 11:40',
      durationMin: 105,
      stops: 0,
      priceKrw: 562000,
      link: 'https://www.google.com/travel/flights?hl=ko&q=ICN-KIX',
    })
  })

  test('경유편은 첫 구간 출발과 마지막 구간 도착을 쓰고 경유 수를 센다', () => {
    const transfer = normalizeFlights(flights)[2]
    expect(transfer.flightNumbers).toEqual(['NH 862', 'NH 2177'])
    expect(transfer.arriveAirport).toBe('KIX')
    expect(transfer.stops).toBe(1)
  })

  test('limit만큼만 돌려주고, 형식이 이상한 응답은 빈 배열이다', () => {
    expect(normalizeFlights(flights, 1)).toHaveLength(1)
    expect(normalizeFlights(null)).toEqual([])
    expect(normalizeFlights({ best_flights: 'x' })).toEqual([])
  })
})

describe('normalizeHotels', () => {
  test('저렴: 가격 오름차순, 가격 없는 숙소는 빼고, 링크가 없으면 검색 링크를 쓴다', () => {
    const result = normalizeHotels(hotels, '저렴')
    expect(result.map((h) => h.name)).toEqual(['난바 비즈니스 호텔', '호텔 한큐 레스파이어 오사카', '콘래드 오사카'])
    expect(result[0].link).toBe('https://www.google.com/travel/hotels?q=osaka')
    expect(result[0].offerId).toBe('H1')
  })

  test('보통: 평점 4.0 이상 중 가격 오름차순', () => {
    expect(normalizeHotels(hotels, '보통').map((h) => h.name)).toEqual([
      '호텔 한큐 레스파이어 오사카',
      '콘래드 오사카',
    ])
  })

  test('여유: 평점 내림차순', () => {
    expect(normalizeHotels(hotels, '여유').map((h) => h.name)).toEqual([
      '콘래드 오사카',
      '호텔 한큐 레스파이어 오사카',
      '난바 비즈니스 호텔',
    ])
  })

  test('보통인데 평점 4.0 이상이 없으면 전체를 가격순으로 쓴다', () => {
    const low = { properties: [{ name: 'A', overall_rating: 3.1, total_rate: { extracted_lowest: 100 } }] }
    expect(normalizeHotels(low, '보통').map((h) => h.name)).toEqual(['A'])
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- src/server/serpapi-logic.test.ts`
Expected: FAIL — `Cannot find module './serpapi-logic'`

- [ ] **Step 4: `src/server/serpapi-logic.ts` 구현**

```ts
import type { BudgetLevel, FlightOffer, HotelOffer } from '@/lib/schema'

type RawLeg = {
  departure_airport?: { id?: string; time?: string }
  arrival_airport?: { id?: string; time?: string }
  airline?: string
  flight_number?: string
}
type RawFlightOption = { flights?: RawLeg[]; total_duration?: number; price?: number }
type RawProperty = {
  name?: string
  gps_coordinates?: { latitude?: number; longitude?: number }
  overall_rating?: number
  total_rate?: { extracted_lowest?: number }
  link?: string
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function normalizeFlights(raw: unknown, limit = 5): FlightOffer[] {
  const body = asRecord(raw)
  const meta = asRecord(body.search_metadata)
  const link =
    typeof meta.google_flights_url === 'string' ? meta.google_flights_url : 'https://www.google.com/travel/flights'
  const options = [...asArray<RawFlightOption>(body.best_flights), ...asArray<RawFlightOption>(body.other_flights)]

  return options
    .filter((o) => typeof o.price === 'number' && Array.isArray(o.flights) && o.flights.length > 0)
    .slice(0, limit)
    .map((o, index) => {
      const legs = o.flights as RawLeg[]
      const first = legs[0]
      const last = legs[legs.length - 1]
      return {
        offerId: `F${index + 1}`,
        airline: first.airline ?? '항공사 정보 없음',
        flightNumbers: legs.map((leg) => leg.flight_number ?? '').filter(Boolean),
        departAirport: first.departure_airport?.id ?? '',
        departTime: first.departure_airport?.time ?? '',
        arriveAirport: last.arrival_airport?.id ?? '',
        arriveTime: last.arrival_airport?.time ?? '',
        durationMin: o.total_duration ?? 0,
        stops: legs.length - 1,
        priceKrw: Math.round(o.price as number),
        link,
      }
    })
}

type HotelDraft = Omit<HotelOffer, 'offerId'>

function sortHotels(list: HotelDraft[], budget: BudgetLevel): HotelDraft[] {
  const byPrice = (a: HotelDraft, b: HotelDraft) => a.totalPriceKrw - b.totalPriceKrw
  if (budget === '저렴') return [...list].sort(byPrice)
  if (budget === '보통') {
    const good = list.filter((h) => (h.rating ?? 0) >= 4)
    return [...(good.length > 0 ? good : list)].sort(byPrice)
  }
  return [...list].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byPrice(a, b))
}

export function normalizeHotels(raw: unknown, budget: BudgetLevel, limit = 8): HotelOffer[] {
  const body = asRecord(raw)
  const meta = asRecord(body.search_metadata)
  const fallbackLink =
    typeof meta.google_hotels_url === 'string' ? meta.google_hotels_url : 'https://www.google.com/travel/hotels'

  const drafts: HotelDraft[] = asArray<RawProperty>(body.properties)
    .filter((p) => typeof p.name === 'string' && typeof p.total_rate?.extracted_lowest === 'number')
    .map((p) => ({
      name: p.name as string,
      lat: p.gps_coordinates?.latitude ?? null,
      lng: p.gps_coordinates?.longitude ?? null,
      rating: p.overall_rating ?? null,
      totalPriceKrw: Math.round(p.total_rate?.extracted_lowest as number),
      link: p.link ?? fallbackLink,
    }))

  return sortHotels(drafts, budget)
    .slice(0, limit)
    .map((h, index) => ({ offerId: `H${index + 1}`, ...h }))
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- src/server/serpapi-logic.test.ts`
Expected: PASS

- [ ] **Step 6: `src/server/serpapi.ts` 구현**

```ts
import 'server-only'
import type { FlightOffer, HotelOffer, Offers, PlanInput } from '@/lib/schema'
import { env, isMock } from './env'
import flightsFixture from './fixtures/google-flights.json'
import hotelsFixture from './fixtures/google-hotels.json'
import { normalizeFlights, normalizeHotels } from './serpapi-logic'

const ENDPOINT = 'https://serpapi.com/search.json'

async function serpapi(params: Record<string, string>): Promise<unknown> {
  const url = new URL(ENDPOINT)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set('api_key', env().SERPAPI_API_KEY)

  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok || !body || body.error) throw new Error(`SerpApi: ${body?.error ?? `HTTP ${res.status}`}`)
  return body
}

async function searchFlights(input: PlanInput): Promise<FlightOffer[]> {
  if (input.flight.mode !== 'search') return []
  if (isMock()) return normalizeFlights(flightsFixture)
  const raw = await serpapi({
    engine: 'google_flights',
    type: '1',
    departure_id: input.flight.departureId,
    arrival_id: input.flight.arrivalId,
    outbound_date: input.startDate,
    return_date: input.endDate,
    adults: String(input.adults),
    children: String(input.children),
    currency: 'KRW',
    hl: 'ko',
    gl: 'kr',
  })
  return normalizeFlights(raw)
}

async function searchHotels(input: PlanInput): Promise<HotelOffer[]> {
  if (input.stay.mode !== 'search') return []
  if (isMock()) return normalizeHotels(hotelsFixture, input.budget)
  const params: Record<string, string> = {
    engine: 'google_hotels',
    q: [input.destination, input.stay.area, '호텔'].filter(Boolean).join(' '),
    check_in_date: input.startDate,
    check_out_date: input.endDate,
    adults: String(input.adults),
    currency: 'KRW',
    hl: 'ko',
    gl: 'kr',
  }
  if (input.children > 0) {
    params.children = String(input.children)
    params.children_ages = Array.from({ length: input.children }, () => '8').join(',')
  }
  return normalizeHotels(await serpapi(params), input.budget)
}

/** 항공·호텔을 병렬 조회한다. 실패한 쪽은 빈 배열과 안내 문구로 채우고 예외를 던지지 않는다. */
export async function fetchOffers(input: PlanInput): Promise<Offers> {
  const [flights, hotels] = await Promise.allSettled([searchFlights(input), searchHotels(input)])
  if (flights.status === 'rejected') console.error(flights.reason)
  if (hotels.status === 'rejected') console.error(hotels.reason)
  return {
    flights: flights.status === 'fulfilled' ? flights.value : [],
    hotels: hotels.status === 'fulfilled' ? hotels.value : [],
    flightError: flights.status === 'rejected' ? '항공권 가격을 가져오지 못했어요.' : null,
    hotelError: hotels.status === 'rejected' ? '숙소 가격을 가져오지 못했어요.' : null,
  }
}
```

- [ ] **Step 7: 전체 테스트·타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm test && npm run typecheck && git status --short`

---

### Task 6: Google Places 장소 확인

**Files:**
- Create: `src/lib/async.ts`, `src/server/places-logic.ts`, `src/server/places.ts`
- Test: `src/lib/async.test.ts`, `src/server/places-logic.test.ts`

**Interfaces:**
- Consumes: `PlaceInfo` (Task 2), `env()`, `isMock()` (Task 3)
- Produces (`@/lib/async`): `mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>`
- Produces (`@/server/places-logic`): `type LatLng = { lat: number; lng: number }`, `distanceKm(a: LatLng, b: LatLng): number`, `toPlaceInfo(raw: unknown, center: LatLng | null, maxKm?: number): PlaceInfo`, `mockPlaceInfo(name: string, center: LatLng): PlaceInfo`
- Produces (`@/server/places`): `geocodeDestination(destination: string): Promise<LatLng | null>`, `verifyPlaces(queries: { key: string; placeName: string }[], destination: string): Promise<Map<string, PlaceInfo>>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/async.test.ts`:
```ts
import { expect, test } from 'vitest'
import { mapWithConcurrency } from './async'

test('순서를 유지하고 동시 실행 수를 지킨다', async () => {
  let running = 0
  let peak = 0
  const result = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
    running++
    peak = Math.max(peak, running)
    await new Promise((r) => setTimeout(r, n * 5))
    running--
    return n * 10
  })
  expect(result).toEqual([50, 10, 40, 20, 30])
  expect(peak).toBe(2)
})
```

`src/server/places-logic.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import { distanceKm, mockPlaceInfo, toPlaceInfo } from './places-logic'

const SHANGHAI = { lat: 31.2304, lng: 121.4737 }

describe('distanceKm', () => {
  test('상해 시내 ↔ 푸동 공항은 약 30km', () => {
    const km = distanceKm(SHANGHAI, { lat: 31.1443, lng: 121.8083 })
    expect(km).toBeGreaterThan(28)
    expect(km).toBeLessThan(36)
  })
})

describe('toPlaceInfo', () => {
  const raw = {
    places: [
      {
        id: 'ChIJ_pearl',
        displayName: { text: '동방명주' },
        formattedAddress: '1 Century Ave, Pudong, Shanghai',
        location: { latitude: 31.2397, longitude: 121.4998 },
        rating: 4.5,
        googleMapsUri: 'https://maps.google.com/?cid=1',
      },
    ],
  }

  test('첫 결과를 verified로 변환한다', () => {
    expect(toPlaceInfo(raw, SHANGHAI)).toEqual({
      status: 'verified',
      placeId: 'ChIJ_pearl',
      lat: 31.2397,
      lng: 121.4998,
      address: '1 Century Ave, Pudong, Shanghai',
      rating: 4.5,
      mapsUrl: 'https://maps.google.com/?cid=1',
    })
  })

  test('결과가 없거나 목적지에서 너무 멀면 unverified', () => {
    expect(toPlaceInfo({ places: [] }, SHANGHAI)).toEqual({ status: 'unverified' })
    expect(toPlaceInfo({}, SHANGHAI)).toEqual({ status: 'unverified' })
    const far = { places: [{ ...raw.places[0], location: { latitude: 37.5665, longitude: 126.978 } }] }
    expect(toPlaceInfo(far, SHANGHAI)).toEqual({ status: 'unverified' })
  })

  test('목적지 좌표를 모르면 거리 확인 없이 채택한다', () => {
    expect(toPlaceInfo(raw, null).status).toBe('verified')
  })
})

test('mockPlaceInfo는 이름마다 같은 좌표를 목적지 근처에 만든다', () => {
  const a = mockPlaceInfo('동방명주', SHANGHAI)
  expect(a).toEqual(mockPlaceInfo('동방명주', SHANGHAI))
  expect(a.status).toBe('verified')
  expect(distanceKm(SHANGHAI, { lat: a.lat!, lng: a.lng! })).toBeLessThan(5)
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/async.test.ts src/server/places-logic.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `src/lib/async.ts` 구현**

```ts
/** 최대 limit개씩 동시에 실행하고, 입력 순서대로 결과를 돌려준다. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
```

- [ ] **Step 4: `src/server/places-logic.ts` 구현**

```ts
import type { PlaceInfo } from '@/lib/schema'

export type LatLng = { lat: number; lng: number }

type RawPlace = {
  id?: string
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  rating?: number
  googleMapsUri?: string
}

const EARTH_RADIUS_KM = 6371

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Places Text Search(New) 응답의 첫 결과를 PlaceInfo로. 없거나 center에서 maxKm 넘게 떨어지면 unverified. */
export function toPlaceInfo(raw: unknown, center: LatLng | null, maxKm = 100): PlaceInfo {
  const places = (raw as { places?: unknown } | null)?.places
  const first = Array.isArray(places) ? (places[0] as RawPlace | undefined) : undefined
  const lat = first?.location?.latitude
  const lng = first?.location?.longitude
  if (!first?.id || typeof lat !== 'number' || typeof lng !== 'number') return { status: 'unverified' }
  if (center && distanceKm(center, { lat, lng }) > maxKm) return { status: 'unverified' }

  const info: PlaceInfo = { status: 'verified', placeId: first.id, lat, lng }
  if (first.formattedAddress) info.address = first.formattedAddress
  if (typeof first.rating === 'number') info.rating = first.rating
  if (first.googleMapsUri) info.mapsUrl = first.googleMapsUri
  return info
}

/** MOCK_EXTERNAL용: 이름 해시로 목적지 반경 약 2km 안에 고정 좌표를 만든다. */
export function mockPlaceInfo(name: string, center: LatLng): PlaceInfo {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const dLat = ((hash & 0xffff) / 0xffff - 0.5) * 0.03
  const dLng = (((hash >>> 16) & 0xffff) / 0xffff - 0.5) * 0.03
  return {
    status: 'verified',
    placeId: `mock-${Math.abs(hash)}`,
    lat: center.lat + dLat,
    lng: center.lng + dLng,
    address: '샘플 주소',
    rating: 4.2,
    mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(name)}`,
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- src/lib/async.test.ts src/server/places-logic.test.ts`
Expected: PASS

- [ ] **Step 6: `src/server/places.ts` 구현**

```ts
import 'server-only'
import { mapWithConcurrency } from '@/lib/async'
import type { PlaceInfo } from '@/lib/schema'
import { env, isMock } from './env'
import { mockPlaceInfo, toPlaceInfo, type LatLng } from './places-logic'

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri'
const MOCK_CENTER: LatLng = { lat: 34.6937, lng: 135.5023 }

async function searchText(textQuery: string, center: LatLng | null): Promise<unknown> {
  const body: Record<string, unknown> = { textQuery, languageCode: 'ko' }
  if (center) {
    body.locationBias = {
      circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 50_000 },
    }
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env().GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Places: HTTP ${res.status} ${await res.text().catch(() => '')}`)
  return res.json()
}

export async function geocodeDestination(destination: string): Promise<LatLng | null> {
  if (isMock()) return MOCK_CENTER
  try {
    const info = toPlaceInfo(await searchText(destination, null), null)
    return info.status === 'verified' ? { lat: info.lat!, lng: info.lng! } : null
  } catch (e) {
    console.error(e)
    return null
  }
}

/** key별 PlaceInfo. 개별 실패는 unverified로 두고 예외를 던지지 않는다. */
export async function verifyPlaces(
  queries: { key: string; placeName: string }[],
  destination: string,
): Promise<Map<string, PlaceInfo>> {
  const result = new Map<string, PlaceInfo>()
  if (queries.length === 0) return result
  const center = await geocodeDestination(destination)

  await mapWithConcurrency(queries, 5, async ({ key, placeName }) => {
    if (isMock()) {
      result.set(key, mockPlaceInfo(placeName, center ?? MOCK_CENTER))
      return
    }
    try {
      result.set(key, toPlaceInfo(await searchText(`${placeName} ${destination}`, center), center))
    } catch (e) {
      console.error(e)
      result.set(key, { status: 'unverified' })
    }
  })
  return result
}
```

- [ ] **Step 7: 전체 테스트·타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm test && npm run typecheck && git status --short`

---
### Task 7: Claude 프롬프트와 호출

**Files:**
- Create: `src/server/prompts.ts`, `src/server/claude.ts`, `src/server/fixtures/mock.ts`, `src/app/api/airports/guess/route.ts`
- Test: `src/server/prompts.test.ts`, `src/server/fixtures/mock.test.ts`

**Interfaces:**
- Consumes: 스키마·타입, `tripDates` (Task 2), `env()`, `isMock()`, `jsonError`, `readJson` (Task 3)
- Produces (`@/server/prompts`): `GENERATE_SYSTEM: string`, `REVISE_SYSTEM: string`, `buildGenerateMessage(input: PlanInput, offers: Offers): string`, `buildReviseMessage(args: ReviseArgs): string`, `toAiItinerary(it: Itinerary): AiItinerary`, `type ReviseArgs = { input: PlanInput; offers: Offers; itinerary: Itinerary; history: MessageDto[]; message: string }`
- Produces (`@/server/claude`): `class ClaudeOutputError extends Error`, `generateItinerary(input: PlanInput, offers: Offers): Promise<AiItinerary>`, `reviseItinerary(args: ReviseArgs): Promise<AiRevision>`, `guessAirports(origin: string, destination: string): Promise<{ departureId: string; arrivalId: string }>`
- Produces (`@/server/fixtures/mock`): `mockItinerary(input: PlanInput, offers: Offers): AiItinerary`, `mockRevision(args: ReviseArgs): AiRevision`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/server/prompts.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import type { Itinerary, Offers, PlanInput } from '@/lib/schema'
import { buildGenerateMessage, buildReviseMessage, toAiItinerary } from './prompts'

const input: PlanInput = {
  destination: '상해',
  startDate: '2026-12-18',
  endDate: '2026-12-20',
  origin: '인천',
  adults: 2,
  children: 0,
  companion: '연인',
  styles: ['맛집', '야경'],
  mustVisit: ['동방명주', '신천지'],
  pace: '보통',
  budget: '보통',
  transport: '대중교통',
  flight: { mode: 'search', departureId: 'ICN', arrivalId: 'PVG' },
  stay: { mode: 'search', area: '와이탄' },
  notes: '해산물 못 먹어요',
}

const offers: Offers = {
  flights: [
    {
      offerId: 'F1',
      airline: '대한항공',
      flightNumbers: ['KE 893'],
      departAirport: 'ICN',
      departTime: '2026-12-18 09:00',
      arriveAirport: 'PVG',
      arriveTime: '2026-12-18 10:10',
      durationMin: 130,
      stops: 0,
      priceKrw: 520000,
      link: 'https://x',
    },
  ],
  hotels: [],
  flightError: null,
  hotelError: '숙소 가격을 가져오지 못했어요.',
}

describe('buildGenerateMessage', () => {
  const text = buildGenerateMessage(input, offers)

  test('여행 날짜를 빠짐없이 넣는다', () => {
    expect(text).toContain('<dates>\n2026-12-18\n2026-12-19\n2026-12-20\n</dates>')
  })

  test('꼭 가고 싶은 곳과 추가 요청을 넣는다', () => {
    expect(text).toContain('<must_visit>\n동방명주\n신천지\n</must_visit>')
    expect(text).toContain('해산물 못 먹어요')
  })

  test('항공 후보 id를 넣고, 가격 링크는 넣지 않는다', () => {
    expect(text).toContain('"id": "F1"')
    expect(text).not.toContain('https://x')
  })

  test('예약 완료 항공은 편명과 시각을 넣는다', () => {
    const booked = buildGenerateMessage(
      {
        ...input,
        flight: {
          mode: 'booked',
          flightNumber: 'OZ361',
          outboundArrival: '2026-12-18T11:40',
          returnDeparture: '2026-12-20T19:30',
          totalKrw: 600000,
        },
      },
      { ...offers, flights: [] },
    )
    expect(booked).toContain('OZ361')
    expect(booked).toContain('2026-12-18T11:40')
    expect(booked).toContain('"flights": []')
  })
})

describe('buildReviseMessage / toAiItinerary', () => {
  const itinerary: Itinerary = {
    title: '상해 야경 여행',
    summary: '요약',
    flight: { kind: 'offer', offerId: 'F1', reason: '직항' },
    stay: { kind: 'unavailable', offerId: null, reason: '' },
    days: [
      {
        date: '2026-12-18',
        theme: '푸동',
        items: [
          {
            id: 'i1',
            time: '18:00',
            placeName: '동방명주',
            category: '랜드마크',
            description: '야경',
            estCostKrw: 60000,
            mustVisit: true,
            place: { status: 'verified', placeId: 'p1', lat: 1, lng: 2 },
          },
        ],
      },
    ],
    budget: { flightKrw: 520000, stayKrw: 0, foodKrw: 1, localTransportKrw: 2, extraKrw: 3, totalKrw: 520006, notes: '' },
  }

  test('toAiItinerary는 서버 전용 필드(id, place, 항공·숙박 금액)를 뺀다', () => {
    const ai = toAiItinerary(itinerary)
    expect(ai.days[0].items[0]).toEqual({
      time: '18:00',
      placeName: '동방명주',
      category: '랜드마크',
      description: '야경',
      estCostKrw: 60000,
      mustVisit: true,
    })
    expect(ai.flightChoice).toEqual({ offerId: 'F1', reason: '직항' })
    expect(ai.budget).toEqual({ foodKrw: 1, localTransportKrw: 2, extraKrw: 3, notes: '' })
  })

  test('현재 일정, 대화, 요청을 넣는다', () => {
    const text = buildReviseMessage({
      input,
      offers,
      itinerary,
      history: [{ id: 'm1', role: 'user', content: '첫날 줄여줘', createdAt: '' }],
      message: '둘째 날 라멘집 추가해줘',
    })
    expect(text).toContain('<current_itinerary>')
    expect(text).not.toContain('"placeId"')
    expect(text).toContain('사용자: 첫날 줄여줘')
    expect(text).toContain('<request>\n둘째 날 라멘집 추가해줘\n</request>')
  })
})
```

`src/server/fixtures/mock.test.ts`:
```ts
import { expect, test } from 'vitest'
import { AiItinerarySchema, type PlanInput } from '@/lib/schema'
import { mockItinerary } from './mock'

const input = {
  destination: '오사카',
  startDate: '2026-12-18',
  endDate: '2026-12-20',
  mustVisit: ['유니버설 스튜디오 재팬'],
} as PlanInput

test('mockItinerary는 스키마에 맞고 날짜마다 하루씩, 지정 장소를 포함한다', () => {
  const ai = mockItinerary(input, { flights: [], hotels: [], flightError: null, hotelError: null })
  expect(AiItinerarySchema.safeParse(ai).success).toBe(true)
  expect(ai.days.map((d) => d.date)).toEqual(['2026-12-18', '2026-12-19', '2026-12-20'])
  const items = ai.days.flatMap((d) => d.items)
  expect(items.some((i) => i.placeName === '유니버설 스튜디오 재팬' && i.mustVisit)).toBe(true)
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/server/prompts.test.ts src/server/fixtures/mock.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `src/server/prompts.ts` 구현**

```ts
import { tripDates } from '@/lib/dates'
import type { AiItinerary, Itinerary, MessageDto, Offers, PlanInput } from '@/lib/schema'

export const GENERATE_SYSTEM = `당신은 한국인 여행자를 위한 현지 여행 가이드입니다. 주어진 조건과 가격 후보로 실제로 따라 할 수 있는 여행 일정을 만듭니다.

규칙:
- 실제로 존재하고 지금도 운영 중일 가능성이 높은 장소만 고릅니다. 지어낸 장소를 넣지 않습니다.
- placeName은 Google 지도에서 그대로 검색되는 이름으로 씁니다. 현지 공식 이름 뒤에 괄호로 한국어 이름을 붙여도 됩니다. 예: "Oriental Pearl Tower (동방명주)"
- days는 <dates>의 날짜를 순서대로 하나씩, 빠짐없이 만듭니다.
- 하루 장소 수는 일정 강도에 맞춥니다. 여유 3~4곳, 보통 5~6곳, 빡빡 7~8곳. category "이동" 항목은 장소 수에 세지 않습니다.
- 같은 날 장소는 가까운 곳끼리 묶어 동선이 되돌아가지 않게 하고, items는 time 순서로 씁니다. time은 HH:mm 24시간 형식입니다.
- 숙소가 정해져 있으면 매일 숙소에서 출발해 숙소로 돌아온다고 보고 짭니다.
- 첫날은 도착 시각 이후, 마지막 날은 출발 시각 3시간 전까지만 일정을 넣습니다. 항공 정보가 없으면 첫날 10:00부터 마지막 날 18:00까지로 봅니다.
- 점심과 저녁을 매일 넣고, 휴무일과 영업시간 상식을 고려합니다.
- <must_visit>의 장소는 반드시 넣고 mustVisit을 true로 합니다. 나머지 항목은 false입니다.
- 추가 요청(notes)과 여행 스타일을 우선 반영합니다.
- estCostKrw는 일행 전체 기준 원화 추정치이며, 무료면 0입니다.
- flightChoice와 stayChoice의 offerId는 <offers>에 있는 id 중 하나를 고르고, 후보가 없으면 null로 둡니다. reason은 고른 이유 한 문장입니다.
- budget의 foodKrw, localTransportKrw, extraKrw는 여행 전체의 일행 기준 원화 추정치입니다. 항공·숙박 금액은 넣지 않습니다. notes에는 예산 관련 팁 한두 문장을 씁니다.
- title은 20자 이내, summary는 2~3문장, theme은 한 줄로, 모두 한국어로 씁니다.`

export const REVISE_SYSTEM = `${GENERATE_SYSTEM}

수정 규칙:
- <current_itinerary>를 <request>에 맞게 고친 일정 전체를 itinerary로 돌려줍니다. 요청과 관계없는 날과 항목은 그대로 둡니다.
- mustVisit이 true인 장소는 사용자가 명시적으로 빼달라고 하지 않는 한 남깁니다.
- 다른 항공편·숙소로 바꿔달라는 요청은 <offers> 안에서만 고릅니다.
- reply에는 무엇을 바꿨는지 한두 문장으로 씁니다. 요청을 들어줄 수 없으면 그 이유를 쓰고 일정은 그대로 둡니다.`

export type ReviseArgs = {
  input: PlanInput
  offers: Offers
  itinerary: Itinerary
  history: MessageDto[]
  message: string
}

function tripFacts(input: PlanInput) {
  const flight =
    input.flight.mode === 'booked'
      ? {
          status: '예약 완료',
          flightNumber: input.flight.flightNumber,
          outboundArrival: input.flight.outboundArrival,
          returnDeparture: input.flight.returnDeparture,
        }
      : input.flight.mode === 'none'
        ? { status: '항공 필요 없음' }
        : { status: '후보 중 선택', departureId: input.flight.departureId, arrivalId: input.flight.arrivalId }
  const stay =
    input.stay.mode === 'booked'
      ? { status: '예약 완료', name: input.stay.name, address: input.stay.address }
      : { status: '후보 중 선택', preferredArea: input.stay.area || '상관없음' }

  return {
    destination: input.destination,
    origin: input.origin,
    travelers: { adults: input.adults, children: input.children },
    companion: input.companion,
    styles: input.styles,
    pace: input.pace,
    budget: input.budget,
    transport: input.transport,
    flight,
    stay,
    notes: input.notes || '(없음)',
  }
}

function offersForPrompt(offers: Offers) {
  return {
    flights: offers.flights.map((f) => ({
      id: f.offerId,
      airline: f.airline,
      flightNumbers: f.flightNumbers,
      depart: `${f.departAirport} ${f.departTime}`,
      arrive: `${f.arriveAirport} ${f.arriveTime}`,
      durationMin: f.durationMin,
      stops: f.stops,
      roundTripPriceKrw: f.priceKrw,
    })),
    hotels: offers.hotels.map((h) => ({
      id: h.offerId,
      name: h.name,
      rating: h.rating,
      totalPriceKrw: h.totalPriceKrw,
      lat: h.lat,
      lng: h.lng,
    })),
  }
}

function sharedBlocks(input: PlanInput, offers: Offers): string[] {
  return [
    `<trip>\n${JSON.stringify(tripFacts(input), null, 2)}\n</trip>`,
    `<dates>\n${tripDates(input.startDate, input.endDate).join('\n')}\n</dates>`,
    `<must_visit>\n${input.mustVisit.length > 0 ? input.mustVisit.join('\n') : '(없음)'}\n</must_visit>`,
    `<offers>\n${JSON.stringify(offersForPrompt(offers), null, 2)}\n</offers>`,
  ]
}

export function buildGenerateMessage(input: PlanInput, offers: Offers): string {
  return [...sharedBlocks(input, offers), '위 조건으로 여행 일정을 만들어주세요.'].join('\n\n')
}

export function toAiItinerary(it: Itinerary): AiItinerary {
  return {
    title: it.title,
    summary: it.summary,
    flightChoice: { offerId: it.flight.offerId, reason: it.flight.reason },
    stayChoice: { offerId: it.stay.offerId, reason: it.stay.reason },
    days: it.days.map((day) => ({
      date: day.date,
      theme: day.theme,
      items: day.items.map(({ time, placeName, category, description, estCostKrw, mustVisit }) => ({
        time,
        placeName,
        category,
        description,
        estCostKrw,
        mustVisit,
      })),
    })),
    budget: {
      foodKrw: it.budget.foodKrw,
      localTransportKrw: it.budget.localTransportKrw,
      extraKrw: it.budget.extraKrw,
      notes: it.budget.notes,
    },
  }
}

export function buildReviseMessage({ input, offers, itinerary, history, message }: ReviseArgs): string {
  const conversation =
    history.length > 0
      ? history.map((m) => `${m.role === 'user' ? '사용자' : '가이드'}: ${m.content}`).join('\n')
      : '(없음)'
  return [
    ...sharedBlocks(input, offers),
    `<current_itinerary>\n${JSON.stringify(toAiItinerary(itinerary), null, 2)}\n</current_itinerary>`,
    `<conversation>\n${conversation}\n</conversation>`,
    `<request>\n${message}\n</request>`,
  ].join('\n\n')
}
```

- [ ] **Step 4: `src/server/fixtures/mock.ts` 구현**

```ts
import { tripDates } from '@/lib/dates'
import type { AiItem, AiItinerary, AiRevision, Offers, PlanInput } from '@/lib/schema'
import { toAiItinerary, type ReviseArgs } from '../prompts'

const SAMPLE: Omit<AiItem, 'mustVisit'>[] = [
  { time: '10:00', placeName: '샘플 전망대', category: '랜드마크', description: '도시 전경을 보는 곳이에요.', estCostKrw: 30000 },
  { time: '12:30', placeName: '샘플 라멘집', category: '음식점', description: '현지인이 많이 가는 라멘집이에요.', estCostKrw: 24000 },
  { time: '14:30', placeName: '샘플 시장', category: '쇼핑', description: '간식과 기념품을 사기 좋아요.', estCostKrw: 20000 },
  { time: '16:30', placeName: '샘플 공원', category: '자연', description: '산책하며 쉬어가요.', estCostKrw: 0 },
  { time: '19:00', placeName: '샘플 이자카야', category: '음식점', description: '저녁과 가벼운 술 한잔.', estCostKrw: 60000 },
]

/** MOCK_EXTERNAL=1 전용 샘플 일정. 지정 장소는 하루에 하나씩 13:30에 넣는다. */
export function mockItinerary(input: PlanInput, offers: Offers): AiItinerary {
  const must = [...input.mustVisit]
  return {
    title: `${input.destination} 샘플 여행`,
    summary: 'MOCK_EXTERNAL=1로 만든 샘플 일정이에요. 실제 AI 결과가 아니에요.',
    flightChoice: { offerId: offers.flights[0]?.offerId ?? null, reason: '샘플: 첫 번째 후보를 골랐어요.' },
    stayChoice: { offerId: offers.hotels[0]?.offerId ?? null, reason: '샘플: 첫 번째 후보를 골랐어요.' },
    days: tripDates(input.startDate, input.endDate).map((date, dayIndex) => {
      const items: AiItem[] = SAMPLE.map((s) => ({ ...s, placeName: `${s.placeName} ${dayIndex + 1}`, mustVisit: false }))
      const pick = must.shift()
      if (pick) {
        items.splice(2, 0, {
          time: '13:30',
          placeName: pick,
          category: '랜드마크',
          description: '직접 고른 장소예요.',
          estCostKrw: 0,
          mustVisit: true,
        })
      }
      return { date, theme: `${dayIndex + 1}일차 샘플 일정`, items }
    }),
    budget: { foodKrw: 300000, localTransportKrw: 80000, extraKrw: 50000, notes: '샘플 예산이에요.' },
  }
}

export function mockRevision(args: ReviseArgs): AiRevision {
  const itinerary = toAiItinerary(args.itinerary)
  itinerary.days[0]?.items.push({
    time: '21:00',
    placeName: '샘플 야경 명소',
    category: '랜드마크',
    description: `샘플 수정: "${args.message}" 요청을 받아 추가했어요.`,
    estCostKrw: 0,
    mustVisit: false,
  })
  return { reply: '샘플 응답이에요. 첫날 마지막에 야경 명소를 넣었어요.', itinerary }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- src/server/prompts.test.ts src/server/fixtures/mock.test.ts`
Expected: PASS

- [ ] **Step 6: `src/server/claude.ts` 구현**

구조화 출력은 `client.messages.parse()` + `zodOutputFormat()`(`@anthropic-ai/sdk/helpers/zod`)을 쓴다. `parsed_output`이 `null`이면 형식 오류로 본다. 14일 일정과 thinking을 감안해 `max_tokens`를 32000으로 잡는다. TS SDK는 비스트리밍 요청의 타임아웃을 `max_tokens`에 맞춰 늘려주지만, 만약 SDK가 스트리밍을 요구하는 오류를 던지면 `max_tokens`를 16000으로 낮춘다.

```ts
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import {
  AiItinerarySchema,
  AiRevisionSchema,
  AirportGuessSchema,
  type AiItinerary,
  type AiRevision,
  type Offers,
  type PlanInput,
} from '@/lib/schema'
import { env, isMock } from './env'
import { mockItinerary, mockRevision } from './fixtures/mock'
import { GENERATE_SYSTEM, REVISE_SYSTEM, buildGenerateMessage, buildReviseMessage, type ReviseArgs } from './prompts'

const PLAN_MODEL = 'claude-opus-5-5'
const LIGHT_MODEL = 'claude-haiku-5-5'
const IATA = /^[A-Z]{3}$/

/** 응답이 거절·잘림·형식 오류일 때. 파이프라인이 1회 재시도한다. */
export class ClaudeOutputError extends Error {}

let client: Anthropic | null = null
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, maxRetries: 3 })
  return client
}

function checkStop(stopReason: string | null): void {
  if (stopReason === 'refusal') {
    throw new ClaudeOutputError('AI가 이 요청을 처리하지 않았어요. 요청 내용을 바꿔서 다시 시도해주세요.')
  }
  if (stopReason === 'max_tokens') {
    throw new ClaudeOutputError('일정이 너무 길어서 중간에 끊겼어요. 다시 시도해주세요.')
  }
}

export async function generateItinerary(input: PlanInput, offers: Offers): Promise<AiItinerary> {
  if (isMock()) return mockItinerary(input, offers)
  const response = await anthropic().messages.parse({
    model: PLAN_MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(AiItinerarySchema) },
    system: GENERATE_SYSTEM,
    messages: [{ role: 'user', content: buildGenerateMessage(input, offers) }],
  })
  checkStop(response.stop_reason)
  if (!response.parsed_output) throw new ClaudeOutputError('AI 응답 형식이 올바르지 않아요.')
  return response.parsed_output
}

export async function reviseItinerary(args: ReviseArgs): Promise<AiRevision> {
  if (isMock()) return mockRevision(args)
  const response = await anthropic().messages.parse({
    model: PLAN_MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(AiRevisionSchema) },
    system: REVISE_SYSTEM,
    messages: [{ role: 'user', content: buildReviseMessage(args) }],
  })
  checkStop(response.stop_reason)
  if (!response.parsed_output) throw new ClaudeOutputError('AI 응답 형식이 올바르지 않아요.')
  return response.parsed_output
}

export async function guessAirports(
  origin: string,
  destination: string,
): Promise<{ departureId: string; arrivalId: string }> {
  if (isMock()) return { departureId: 'ICN', arrivalId: 'KIX' }
  const response = await anthropic().messages.parse({
    model: LIGHT_MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low', format: zodOutputFormat(AirportGuessSchema) },
    messages: [
      {
        role: 'user',
        content: `출발지 "${origin}"에서 목적지 "${destination}"로 가는 여행입니다. 한국인 여행자가 가장 많이 쓰는 국제선 출발 공항과 도착 공항의 IATA 코드를 대문자 3글자로 알려주세요.`,
      },
    ],
  })
  checkStop(response.stop_reason)
  const out = response.parsed_output
  if (!out || !IATA.test(out.departureId) || !IATA.test(out.arrivalId)) {
    throw new ClaudeOutputError('공항 코드를 추정하지 못했어요. 직접 입력해주세요.')
  }
  return out
}
```

- [ ] **Step 7: `src/app/api/airports/guess/route.ts` 구현**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ClaudeOutputError, guessAirports } from '@/server/claude'
import { jsonError, readJson } from '@/server/http'

const BodySchema = z.object({
  origin: z.string().trim().min(1).max(50),
  destination: z.string().trim().min(1).max(50),
})

export async function POST(req: Request) {
  const body = BodySchema.safeParse(await readJson(req))
  if (!body.success) return jsonError('출발지와 목적지를 입력해주세요.', 400)
  try {
    return NextResponse.json(await guessAirports(body.data.origin, body.data.destination))
  } catch (e) {
    if (e instanceof ClaudeOutputError) return jsonError(e.message, 422)
    console.error(e)
    return jsonError('공항 코드를 추정하지 못했어요. 직접 입력해주세요.', 502)
  }
}
```

- [ ] **Step 8: 타입 검사로 SDK 시그니처 확인**

Run: `npm run typecheck`
Expected: 오류 없음. `messages.parse`, `output_config.effort`, `thinking: { type: 'adaptive' }`, `parsed_output`에서 타입 오류가 나면 설치된 SDK의 타입 정의(`node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts`, `node_modules/@anthropic-ai/sdk/helpers/zod.d.ts`)에서 정확한 이름을 찾아 고친다. 추측해서 고치지 않는다.

- [ ] **Step 9: (선택, 실제 키가 있을 때) 공항 추정 실호출 확인**

`.env.local`에 실제 `ANTHROPIC_API_KEY`와 `MOCK_EXTERNAL=0`을 넣고 `npm run dev`를 실행한다. 로그인한 브라우저 개발자 도구 콘솔에서:
```js
await (await fetch('/api/airports/guess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: '인천', destination: '상해' }) })).json()
```
Expected: `{ departureId: 'ICN', arrivalId: 'PVG' }`(또는 `'SHA'`). 확인 후 `MOCK_EXTERNAL=1`로 되돌린다.

- [ ] **Step 10: 전체 테스트 후 변경 확인 (커밋 금지)**

Run: `npm test && git status --short`

---

### Task 8: 일정 후처리 규칙

**Files:**
- Create: `src/server/itinerary-logic.ts`
- Test: `src/server/itinerary-logic.test.ts`

**Interfaces:**
- Consumes: `tripDates`, `nameMatches`, `normalizeName`, 스키마 타입 (Task 2)
- Produces (`@/server/itinerary-logic`):
  - `type FinalizeContext = { input: PlanInput; offers: Offers; makeId: () => string }`
  - `finalizeItinerary(ai: AiItinerary, ctx: FinalizeContext): Itinerary` — 날짜 맞추기, 시간 정리·정렬, 지정 장소 표시·보충, 항공·숙박 선택 확정, 금액 계산
  - `protectMustVisit(prev: Itinerary, next: Itinerary, userMessage: string): Itinerary`
  - `inheritPlaces(prev: Itinerary, next: Itinerary): Itinerary` — 같은 이름 항목의 `id`·`place` 물려받기
  - `itemsNeedingPlaces(it: Itinerary): { key: string; placeName: string }[]`
  - `applyPlaces(it: Itinerary, places: Map<string, PlaceInfo>): Itinerary`

- [ ] **Step 1: 실패하는 테스트 작성 — `src/server/itinerary-logic.test.ts`**

```ts
import { beforeEach, describe, expect, test } from 'vitest'
import type { AiItinerary, Itinerary, Offers, PlanInput } from '@/lib/schema'
import {
  applyPlaces,
  finalizeItinerary,
  inheritPlaces,
  itemsNeedingPlaces,
  protectMustVisit,
  type FinalizeContext,
} from './itinerary-logic'

const baseInput: PlanInput = {
  destination: '상해',
  startDate: '2026-12-18',
  endDate: '2026-12-19',
  origin: '인천',
  adults: 2,
  children: 0,
  companion: '연인',
  styles: ['야경'],
  mustVisit: ['동방명주', '신천지'],
  pace: '보통',
  budget: '보통',
  transport: '대중교통',
  flight: { mode: 'search', departureId: 'ICN', arrivalId: 'PVG' },
  stay: { mode: 'search', area: '' },
  notes: '',
}

const offers: Offers = {
  flights: [
    { offerId: 'F1', airline: 'A', flightNumbers: [], departAirport: 'ICN', departTime: '', arriveAirport: 'PVG', arriveTime: '', durationMin: 0, stops: 0, priceKrw: 600000, link: '' },
    { offerId: 'F2', airline: 'B', flightNumbers: [], departAirport: 'ICN', departTime: '', arriveAirport: 'PVG', arriveTime: '', durationMin: 0, stops: 0, priceKrw: 450000, link: '' },
  ],
  hotels: [{ offerId: 'H1', name: '호텔', lat: null, lng: null, rating: 4.5, totalPriceKrw: 300000, link: '' }],
  flightError: null,
  hotelError: null,
}

function ai(overrides: Partial<AiItinerary> = {}): AiItinerary {
  return {
    title: '상해 야경 여행',
    summary: '요약',
    flightChoice: { offerId: 'F1', reason: '시간이 좋아요' },
    stayChoice: { offerId: 'H1', reason: '위치가 좋아요' },
    days: [
      {
        date: '2026-12-18',
        theme: '푸동',
        items: [
          { time: '19:00', placeName: 'Oriental Pearl Tower (동방명주)', category: '랜드마크', description: '', estCostKrw: 60000, mustVisit: false },
          { time: '9:30', placeName: '샤오롱바오 집', category: '음식점', description: '', estCostKrw: -5, mustVisit: false },
        ],
      },
      { date: '2026-12-25', theme: '여행 기간 밖', items: [] },
    ],
    budget: { foodKrw: 200000, localTransportKrw: 50000, extraKrw: 30000, notes: '' },
    ...overrides,
  }
}

let counter = 0
let ctx: FinalizeContext
beforeEach(() => {
  counter = 0
  ctx = { input: baseInput, offers, makeId: () => `id${++counter}` }
})

describe('finalizeItinerary', () => {
  test('여행 날짜에 맞춰 하루씩 만들고 기간 밖 날짜는 버린다', () => {
    const it = finalizeItinerary(ai(), ctx)
    expect(it.days.map((d) => d.date)).toEqual(['2026-12-18', '2026-12-19'])
    expect(it.days[1].theme).toBe('자유 일정')
  })

  test('시간을 HH:mm으로 맞추고 시간순으로 정렬하며 음수 비용은 0으로', () => {
    const items = finalizeItinerary(ai(), ctx).days[0].items
    expect(items.map((i) => i.time)).toEqual(['09:30', '19:00'])
    expect(items[0].estCostKrw).toBe(0)
  })

  test('지정 장소 이름과 맞는 항목은 mustVisit=true, 빠진 지정 장소는 마지막 날에 넣는다', () => {
    const it = finalizeItinerary(ai(), ctx)
    expect(it.days[0].items.find((i) => i.placeName.includes('동방명주'))?.mustVisit).toBe(true)
    const added = it.days[1].items.find((i) => i.placeName === '신천지')
    expect(added).toMatchObject({ time: '16:00', mustVisit: true, category: '랜드마크' })
  })

  test('AI가 고른 항공·숙소 금액으로 예산을 계산한다', () => {
    const it = finalizeItinerary(ai(), ctx)
    expect(it.flight).toEqual({ kind: 'offer', offerId: 'F1', reason: '시간이 좋아요' })
    expect(it.budget).toMatchObject({ flightKrw: 600000, stayKrw: 300000, totalKrw: 600000 + 300000 + 200000 + 50000 + 30000 })
  })

  test('없는 offerId를 고르면 최저가 후보로 바꾼다', () => {
    const it = finalizeItinerary(ai({ flightChoice: { offerId: 'F9', reason: 'x' } }), ctx)
    expect(it.flight).toEqual({ kind: 'offer', offerId: 'F2', reason: '가장 저렴한 항공편으로 골랐어요.' })
    expect(it.budget.flightKrw).toBe(450000)
  })

  test('예약 완료 항공·숙소는 입력한 금액을 쓴다', () => {
    const input: PlanInput = {
      ...baseInput,
      flight: { mode: 'booked', flightNumber: 'KE893', outboundArrival: '2026-12-18T11:00', returnDeparture: '2026-12-19T19:00', totalKrw: 700000 },
      stay: { mode: 'booked', name: '내 호텔', address: '', totalKrw: 250000 },
    }
    const it = finalizeItinerary(ai(), { ...ctx, input })
    expect(it.flight.kind).toBe('booked')
    expect(it.stay.kind).toBe('booked')
    expect(it.budget.flightKrw).toBe(700000)
    expect(it.budget.stayKrw).toBe(250000)
  })

  test('항공 불필요 / 후보 없음', () => {
    const none = finalizeItinerary(ai(), { ...ctx, input: { ...baseInput, flight: { mode: 'none' } } })
    expect(none.flight.kind).toBe('none')
    const empty = finalizeItinerary(ai(), { ...ctx, offers: { ...offers, flights: [], hotels: [] } })
    expect(empty.flight.kind).toBe('unavailable')
    expect(empty.stay.kind).toBe('unavailable')
    expect(empty.budget.flightKrw).toBe(0)
  })
})

describe('수정 후 처리', () => {
  function prev(): Itinerary {
    const it = finalizeItinerary(ai(), ctx)
    return applyPlaces(it, new Map(itemsNeedingPlaces(it).map((q) => [q.key, { status: 'verified' as const, lat: 1, lng: 2 }])))
  }

  // 수정 흐름에서는 finalizeItinerary가 지정 장소를 다시 채우지 않도록 mustVisit을 비운 입력을 쓴다 (runRevision과 같음)
  const reviseCtx = () => ({ ...ctx, input: { ...baseInput, mustVisit: [] } })

  test('protectMustVisit: 요청 없이 빠진 지정 장소를 원래 날짜에 되살린다', () => {
    const before = prev()
    const next = finalizeItinerary(ai({ days: [{ date: '2026-12-18', theme: '푸동', items: [] }] }), reviseCtx())
    const restored = protectMustVisit(before, next, '첫날 일정을 줄여줘')
    expect(restored.days[0].items.some((i) => i.placeName.includes('동방명주'))).toBe(true)
    expect(restored.days[1].items.some((i) => i.placeName === '신천지')).toBe(true)
  })

  test('protectMustVisit: 사용자가 그 장소를 빼달라고 하면 되살리지 않는다', () => {
    const before = prev()
    const next = finalizeItinerary(ai({ days: [{ date: '2026-12-18', theme: '푸동', items: [] }] }), reviseCtx())
    const result = protectMustVisit(before, next, '동방명주는 빼줘')
    const names = result.days.flatMap((d) => d.items).map((i) => i.placeName)
    expect(names.some((n) => n.includes('동방명주'))).toBe(false)
    expect(names).toContain('신천지')
  })

  test('inheritPlaces: 같은 이름 항목은 id와 place를 물려받고, 새 항목만 확인 대상이 된다', () => {
    const before = prev()
    const pearl = before.days[0].items.find((i) => i.placeName.includes('동방명주'))!
    const next = finalizeItinerary(
      ai({
        days: [
          {
            date: '2026-12-18',
            theme: '푸동',
            items: [
              { time: '19:00', placeName: 'Oriental Pearl Tower (동방명주)', category: '랜드마크', description: '', estCostKrw: 0, mustVisit: true },
              { time: '20:30', placeName: '와이탄 야경', category: '랜드마크', description: '', estCostKrw: 0, mustVisit: false },
            ],
          },
        ],
      }),
      reviseCtx(),
    )
    const merged = inheritPlaces(before, protectMustVisit(before, next, '와이탄 야경 추가해줘'))
    const kept = merged.days[0].items.find((i) => i.placeName.includes('동방명주'))!
    expect(kept.id).toBe(pearl.id)
    expect(kept.place).toEqual(pearl.place)
    // 신천지는 되살아나면서 기존 place를 그대로 가지므로 새로 확인할 항목은 와이탄 야경뿐이다
    expect(itemsNeedingPlaces(merged).map((q) => q.placeName)).toEqual(['와이탄 야경'])
  })

  test('applyPlaces는 key(id)에 맞는 항목에만 place를 붙인다', () => {
    const it = finalizeItinerary(ai(), ctx)
    const first = it.days[0].items[0]
    const out = applyPlaces(it, new Map([[first.id, { status: 'unverified' as const }]]))
    expect(out.days[0].items[0].place).toEqual({ status: 'unverified' })
    expect(out.days[0].items[1].place).toBeUndefined()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/server/itinerary-logic.test.ts`
Expected: FAIL — `Cannot find module './itinerary-logic'`

- [ ] **Step 3: `src/server/itinerary-logic.ts` 구현**

```ts
import { tripDates } from '@/lib/dates'
import { nameMatches, normalizeName } from '@/lib/names'
import type { AiItem, AiItinerary, Day, Item, Itinerary, Offers, PlaceInfo, PlanInput } from '@/lib/schema'

export type FinalizeContext = { input: PlanInput; offers: Offers; makeId: () => string }

const REMOVE_WORDS = ['빼', '삭제', '제외', '안갈', '지워', '없애']

function normalizeTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return '12:00'
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return '12:00'
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

function byTime(a: { time: string }, b: { time: string }): number {
  return a.time.localeCompare(b.time)
}

function nonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

function pickFlight(ai: AiItinerary, input: PlanInput, offers: Offers): { choice: Itinerary['flight']; krw: number } {
  if (input.flight.mode === 'booked') {
    return { choice: { kind: 'booked', offerId: null, reason: '' }, krw: input.flight.totalKrw }
  }
  if (input.flight.mode === 'none') return { choice: { kind: 'none', offerId: null, reason: '' }, krw: 0 }
  if (offers.flights.length === 0) return { choice: { kind: 'unavailable', offerId: null, reason: '' }, krw: 0 }

  const chosen = offers.flights.find((f) => f.offerId === ai.flightChoice.offerId)
  const offer = chosen ?? [...offers.flights].sort((a, b) => a.priceKrw - b.priceKrw)[0]
  return {
    choice: {
      kind: 'offer',
      offerId: offer.offerId,
      reason: chosen ? ai.flightChoice.reason : '가장 저렴한 항공편으로 골랐어요.',
    },
    krw: offer.priceKrw,
  }
}

function pickStay(ai: AiItinerary, input: PlanInput, offers: Offers): { choice: Itinerary['stay']; krw: number } {
  if (input.stay.mode === 'booked') {
    return { choice: { kind: 'booked', offerId: null, reason: '' }, krw: input.stay.totalKrw }
  }
  if (offers.hotels.length === 0) return { choice: { kind: 'unavailable', offerId: null, reason: '' }, krw: 0 }

  const chosen = offers.hotels.find((h) => h.offerId === ai.stayChoice.offerId)
  const offer = chosen ?? [...offers.hotels].sort((a, b) => a.totalPriceKrw - b.totalPriceKrw)[0]
  return {
    choice: {
      kind: 'offer',
      offerId: offer.offerId,
      reason: chosen ? ai.stayChoice.reason : '가장 저렴한 숙소로 골랐어요.',
    },
    krw: offer.totalPriceKrw,
  }
}

export function finalizeItinerary(ai: AiItinerary, ctx: FinalizeContext): Itinerary {
  const { input, offers, makeId } = ctx
  const aiByDate = new Map(ai.days.map((d) => [d.date, d]))

  const toItem = (it: AiItem): Item => ({
    ...it,
    id: makeId(),
    time: normalizeTime(it.time),
    estCostKrw: nonNegative(it.estCostKrw),
    mustVisit: it.mustVisit || input.mustVisit.some((name) => nameMatches(name, it.placeName)),
  })

  const days: Day[] = tripDates(input.startDate, input.endDate).map((date) => {
    const day = aiByDate.get(date)
    return { date, theme: day?.theme || '자유 일정', items: (day?.items ?? []).map(toItem).sort(byTime) }
  })

  const allItems = days.flatMap((d) => d.items)
  const missing = input.mustVisit.filter((name) => !allItems.some((i) => nameMatches(name, i.placeName)))
  const lastDay = days[days.length - 1]
  if (lastDay && missing.length > 0) {
    for (const name of missing) {
      lastDay.items.push({
        id: makeId(),
        time: '16:00',
        placeName: name,
        category: '랜드마크',
        description: '직접 고른 장소예요. 일정에 맞춰 들러보세요.',
        estCostKrw: 0,
        mustVisit: true,
      })
    }
    lastDay.items.sort(byTime)
  }

  const flight = pickFlight(ai, input, offers)
  const stay = pickStay(ai, input, offers)
  const foodKrw = nonNegative(ai.budget.foodKrw)
  const localTransportKrw = nonNegative(ai.budget.localTransportKrw)
  const extraKrw = nonNegative(ai.budget.extraKrw)

  return {
    title: ai.title.trim().slice(0, 20) || `${input.destination} 여행`,
    summary: ai.summary,
    flight: flight.choice,
    stay: stay.choice,
    days,
    budget: {
      flightKrw: flight.krw,
      stayKrw: stay.krw,
      foodKrw,
      localTransportKrw,
      extraKrw,
      totalKrw: flight.krw + stay.krw + foodKrw + localTransportKrw + extraKrw,
      notes: ai.budget.notes,
    },
  }
}

/** "Oriental Pearl Tower (동방명주)" → ["Oriental Pearl Tower (동방명주)", "Oriental Pearl Tower", "동방명주"] */
function nameVariants(placeName: string): string[] {
  const inner = [...placeName.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])
  const outer = placeName.replace(/\([^)]*\)/g, '').trim()
  return [placeName, outer, ...inner].filter(Boolean)
}

function userAskedToRemove(placeName: string, userMessage: string): boolean {
  const msg = normalizeName(userMessage)
  const mentioned = nameVariants(placeName).some((v) => msg.includes(normalizeName(v)))
  return mentioned && REMOVE_WORDS.some((w) => msg.includes(w))
}

export function protectMustVisit(prev: Itinerary, next: Itinerary, userMessage: string): Itinerary {
  const days = next.days.map((d) => ({ ...d, items: [...d.items] }))
  const nextItems = days.flatMap((d) => d.items)

  for (const prevDay of prev.days) {
    for (const item of prevDay.items) {
      if (!item.mustVisit) continue
      if (nextItems.some((i) => nameMatches(i.placeName, item.placeName))) continue
      if (userAskedToRemove(item.placeName, userMessage)) continue
      const target = days.find((d) => d.date === prevDay.date) ?? days[days.length - 1]
      if (!target) continue
      target.items.push(item)
      target.items.sort(byTime)
    }
  }
  return { ...next, days }
}

export function inheritPlaces(prev: Itinerary, next: Itinerary): Itinerary {
  const known = new Map<string, Item>()
  for (const item of prev.days.flatMap((d) => d.items)) {
    const key = normalizeName(item.placeName)
    if (!known.has(key)) known.set(key, item)
  }
  const used = new Set<string>()
  return {
    ...next,
    days: next.days.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        const match = known.get(normalizeName(item.placeName))
        if (!match || used.has(match.id)) return item
        used.add(match.id)
        return { ...item, id: match.id, place: match.place }
      }),
    })),
  }
}

export function itemsNeedingPlaces(it: Itinerary): { key: string; placeName: string }[] {
  return it.days.flatMap((d) => d.items).filter((i) => !i.place).map((i) => ({ key: i.id, placeName: i.placeName }))
}

export function applyPlaces(it: Itinerary, places: Map<string, PlaceInfo>): Itinerary {
  return {
    ...it,
    days: it.days.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        const place = places.get(item.id)
        return place ? { ...item, place } : item
      }),
    })),
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/server/itinerary-logic.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 테스트·타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm test && npm run typecheck && git status --short`

---

### Task 9: 생성·수정 파이프라인과 계획 API

**Files:**
- Create: `src/server/pipeline.ts`, `src/app/api/plans/route.ts`, `src/app/api/plans/[id]/route.ts`, `src/app/api/plans/[id]/retry/route.ts`, `src/app/api/plans/[id]/revise/route.ts`

**Interfaces:**
- Consumes: `db` 함수 (Task 4), `fetchOffers` (Task 5), `verifyPlaces` (Task 6), `generateItinerary`, `reviseItinerary`, `ClaudeOutputError` (Task 7), 후처리 함수 (Task 8)
- Produces (`@/server/pipeline`): `runGeneration(planId: string): Promise<void>` (예외를 던지지 않고 실패를 DB에 기록), `runRevision(planId: string, message: string): Promise<{ reply: string; itinerary: Itinerary; messages: MessageDto[] }>`, `class RevisionError extends Error { status: number }`, `STALE_MS = 600000`
- Produces (HTTP):
  - `GET /api/plans` → `PlanSummaryDto[]`
  - `POST /api/plans` body `PlanInput` → `201 { id }`
  - `GET /api/plans/[id]` → `PlanDetailDto`
  - `DELETE /api/plans/[id]` → `{ ok: true }`
  - `POST /api/plans/[id]/retry` → `202 { ok: true }`
  - `POST /api/plans/[id]/revise` body `{ message: string }` → `{ reply, itinerary, messages }`

- [ ] **Step 1: `src/server/pipeline.ts` 구현**

```ts
import 'server-only'
import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import type { Itinerary, MessageDto } from '@/lib/schema'
import { ClaudeOutputError, generateItinerary, reviseItinerary } from './claude'
import { getPlan, insertMessage, listMessages, updatePlan } from './db'
import { applyPlaces, finalizeItinerary, inheritPlaces, itemsNeedingPlaces, protectMustVisit } from './itinerary-logic'
import { verifyPlaces } from './places'
import { fetchOffers } from './serpapi'

/** generating 상태가 이 시간 넘게 갱신되지 않으면 멈춘 것으로 본다. */
export const STALE_MS = 10 * 60 * 1000

export class RevisionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (!(e instanceof ClaudeOutputError)) throw e
    console.warn('Claude 출력 오류, 1회 재시도:', e.message)
    return fn()
  }
}

function userMessage(e: unknown): string {
  if (e instanceof ClaudeOutputError) return e.message
  if (e instanceof Anthropic.APIError) return 'AI 서버가 응답하지 않아요. 잠시 후 다시 시도해주세요.'
  return '일정을 만드는 중 문제가 생겼어요. 다시 시도해주세요.'
}

async function attachPlaces(itinerary: Itinerary, destination: string): Promise<Itinerary> {
  const places = await verifyPlaces(itemsNeedingPlaces(itinerary), destination)
  return applyPlaces(itinerary, places)
}

export async function runGeneration(planId: string): Promise<void> {
  const plan = await getPlan(planId)
  if (!plan) return
  try {
    let offers = plan.offers
    if (!offers) {
      await updatePlan(planId, { progressStep: 'offers' })
      offers = await fetchOffers(plan.input)
      await updatePlan(planId, { offers })
    }

    await updatePlan(planId, { progressStep: 'itinerary' })
    const currentOffers = offers
    const ai = await withOneRetry(() => generateItinerary(plan.input, currentOffers))
    let itinerary = finalizeItinerary(ai, { input: plan.input, offers, makeId: randomUUID })

    await updatePlan(planId, { progressStep: 'places' })
    itinerary = await attachPlaces(itinerary, plan.input.destination)

    await updatePlan(planId, { itinerary, title: itinerary.title, status: 'ready', progressStep: null, error: null })
  } catch (e) {
    console.error('runGeneration 실패', planId, e)
    await updatePlan(planId, { status: 'failed', progressStep: null, error: userMessage(e) }).catch((dbError) =>
      console.error('실패 상태 저장도 실패', dbError),
    )
  }
}

export async function runRevision(
  planId: string,
  message: string,
): Promise<{ reply: string; itinerary: Itinerary; messages: MessageDto[] }> {
  const plan = await getPlan(planId)
  if (!plan) throw new RevisionError('여행 계획을 찾지 못했어요.', 404)
  if (plan.status !== 'ready' || !plan.itinerary || !plan.offers) {
    throw new RevisionError('일정이 완성된 뒤에 수정할 수 있어요.', 409)
  }
  const prev = plan.itinerary
  const offers = plan.offers

  const history = await listMessages(planId, 10)
  const userMsg = await insertMessage(planId, 'user', message)

  try {
    const ai = await withOneRetry(() =>
      reviseItinerary({ input: plan.input, offers, itinerary: prev, history, message }),
    )
    // 지정 장소 보충은 protectMustVisit이 맡는다. input.mustVisit을 그대로 넘기면
    // 사용자가 "빼줘"라고 한 장소를 finalizeItinerary가 다시 넣어버린다.
    const reviseInput = { ...plan.input, mustVisit: [] }
    let next = finalizeItinerary(ai.itinerary, { input: reviseInput, offers, makeId: randomUUID })
    next = protectMustVisit(prev, next, message)
    next = inheritPlaces(prev, next)
    next = await attachPlaces(next, plan.input.destination)

    await updatePlan(planId, { itinerary: next, title: next.title })
    const assistantMsg = await insertMessage(planId, 'assistant', ai.reply)
    return { reply: ai.reply, itinerary: next, messages: [userMsg, assistantMsg] }
  } catch (e) {
    console.error('runRevision 실패', planId, e)
    const text = userMessage(e).replace('일정을 만드는', '일정을 고치는')
    const assistantMsg = await insertMessage(planId, 'assistant', text)
    throw Object.assign(new RevisionError(text, 502), { messages: [userMsg, assistantMsg] })
  }
}
```

- [ ] **Step 2: `src/app/api/plans/route.ts` 구현**

```ts
import { NextResponse, after } from 'next/server'
import { PlanInputSchema } from '@/lib/schema'
import { insertPlan, listPlans } from '@/server/db'
import { jsonError, readJson } from '@/server/http'
import { runGeneration } from '@/server/pipeline'

export const maxDuration = 300

export async function GET() {
  return NextResponse.json(await listPlans())
}

export async function POST(req: Request) {
  const parsed = PlanInputSchema.safeParse(await readJson(req))
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? '입력을 다시 확인해주세요.', 400)
  }
  const id = await insertPlan(parsed.data)
  after(() => runGeneration(id))
  return NextResponse.json({ id }, { status: 201 })
}
```

- [ ] **Step 3: `src/app/api/plans/[id]/route.ts` 구현**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { PlanDetailDto } from '@/lib/schema'
import { deletePlan, getPlan, listMessages, updatePlan } from '@/server/db'
import { jsonError } from '@/server/http'
import { STALE_MS } from '@/server/pipeline'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return jsonError('여행 계획을 찾지 못했어요.', 404)

  let plan = await getPlan(id)
  if (!plan) return jsonError('여행 계획을 찾지 못했어요.', 404)

  if (plan.status === 'generating' && Date.now() - Date.parse(plan.updatedAt) > STALE_MS) {
    await updatePlan(id, { status: 'failed', progressStep: null, error: '생성이 중간에 멈췄어요. 다시 시도해주세요.' })
    plan = (await getPlan(id))!
  }

  const body: PlanDetailDto = { plan, messages: await listMessages(id) }
  return NextResponse.json(body)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return jsonError('여행 계획을 찾지 못했어요.', 404)
  await deletePlan(id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: `src/app/api/plans/[id]/retry/route.ts` 구현**

```ts
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { getPlan, updatePlan } from '@/server/db'
import { jsonError } from '@/server/http'
import { runGeneration } from '@/server/pipeline'

export const maxDuration = 300

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return jsonError('여행 계획을 찾지 못했어요.', 404)
  const plan = await getPlan(id)
  if (!plan) return jsonError('여행 계획을 찾지 못했어요.', 404)
  if (plan.status !== 'failed') return jsonError('실패한 계획만 다시 시도할 수 있어요.', 409)

  await updatePlan(id, { status: 'generating', progressStep: plan.offers ? 'itinerary' : 'offers', error: null })
  after(() => runGeneration(id))
  return NextResponse.json({ ok: true }, { status: 202 })
}
```

- [ ] **Step 5: `src/app/api/plans/[id]/revise/route.ts` 구현**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { MessageDto } from '@/lib/schema'
import { jsonError, readJson } from '@/server/http'
import { RevisionError, runRevision } from '@/server/pipeline'

export const maxDuration = 300

const BodySchema = z.object({ message: z.string().trim().min(1).max(500) })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return jsonError('여행 계획을 찾지 못했어요.', 404)
  const body = BodySchema.safeParse(await readJson(req))
  if (!body.success) return jsonError('수정 요청을 500자 이내로 입력해주세요.', 400)

  try {
    return NextResponse.json(await runRevision(id, body.data.message))
  } catch (e) {
    if (e instanceof RevisionError) {
      const messages = (e as RevisionError & { messages?: MessageDto[] }).messages ?? []
      return NextResponse.json({ error: e.message, messages }, { status: e.status })
    }
    console.error(e)
    return jsonError('일정을 고치는 중 문제가 생겼어요. 다시 시도해주세요.', 500)
  }
}
```

- [ ] **Step 6: 타입 검사**

Run: `npm run typecheck`
Expected: 오류 없음. `after`를 `next/server`에서 못 찾는다는 오류가 나면 설치된 Next 버전의 문서(`node_modules/next/dist/docs` 또는 https://nextjs.org/docs/app/api-reference/functions/after)를 확인한다.

- [ ] **Step 7: MOCK 모드로 API 흐름 확인**

전제: Task 4 Step 1에서 Supabase 테이블과 `.env.local`의 Supabase 값이 준비됨, `MOCK_EXTERNAL=1`.

`npm run dev`를 실행하고, 로그인한 브라우저의 개발자 도구 콘솔에서:
```js
const input = { destination: '오사카', startDate: '2026-12-18', endDate: '2026-12-20', origin: '인천', adults: 2, children: 0, companion: '연인', styles: ['맛집'], mustVisit: ['유니버설 스튜디오 재팬'], pace: '보통', budget: '보통', transport: '대중교통', flight: { mode: 'search', departureId: 'ICN', arrivalId: 'KIX' }, stay: { mode: 'search', area: '' }, notes: '' }
const { id } = await (await fetch('/api/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).json()
await new Promise((r) => setTimeout(r, 3000))
const detail = await (await fetch(`/api/plans/${id}`)).json()
console.log(detail.plan.status, detail.plan.itinerary.days.length, detail.plan.itinerary.budget)
```
Expected: `ready 3 { flightKrw: 562000, stayKrw: 504000, ... }` — 보통 예산이라 평점 4.0 이상 최저가 숙소(한큐 504,000원), 샘플이 고른 F1 항공(562,000원).

이어서 수정 확인:
```js
const r = await (await fetch(`/api/plans/${id}/revise`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '첫날 밤에 야경 추가해줘' }) })).json()
console.log(r.reply, r.itinerary.days[0].items.at(-1).placeName, r.messages.length)
```
Expected: `샘플 응답이에요. ... 샘플 야경 명소 2`

`/api/plans`(GET)에 방금 계획이 보이는지 확인한 뒤 `fetch(`/api/plans/${id}`, { method: 'DELETE' })`로 지운다.

- [ ] **Step 8: 변경 확인 (커밋 금지)**

Run: `npm test && git status --short`

---
### Task 10: 공용 UI 컴포넌트와 계획 목록 화면

**Files:**
- Create: `src/lib/categories.ts`, `src/components/Chip.tsx`, `src/components/CategoryTag.tsx`, `src/components/ProgressDots.tsx`, `src/components/Sheet.tsx`, `src/components/ErrorState.tsx`
- Modify: `src/app/page.tsx` (Task 1의 임시 화면 교체)

**Interfaces:**
- Consumes: `Category`, `PlanSummaryDto` (Task 2), `apiFetch`, `Button` (Task 3), `formatDateRange` (Task 2)
- Produces:
  - `CATEGORY_TAG_CLASS: Record<Category, string>`, `CATEGORY_PIN_COLOR: Record<Category, string>`, `ROUTE_COLOR: string` (`@/lib/categories`)
  - `<Chip selected: boolean ...ButtonHTMLAttributes>`
  - `<CategoryTag category: Category>`
  - `<ProgressDots total: number current: number>`
  - `<Sheet open: boolean onClose: () => void title: string children>`
  - `<ErrorState message: string onRetry?: () => void>`

- [ ] **Step 1: `src/lib/categories.ts`**

```ts
import type { Category } from './schema'

export const CATEGORY_TAG_CLASS: Record<Category, string> = {
  랜드마크: 'bg-cat-landmark-bg text-cat-landmark-fg',
  음식점: 'bg-cat-food-bg text-cat-food-fg',
  숙소: 'bg-cat-stay-bg text-cat-stay-fg',
  이동: 'bg-cat-move-bg text-cat-move-fg',
  쇼핑: 'bg-cat-shop-bg text-cat-shop-fg',
  자연: 'bg-cat-nature-bg text-cat-nature-fg',
}

// Google Maps 마커·선은 Tailwind 클래스를 쓸 수 없어서 globals.css 토큰과 같은 값을 여기에만 둔다.
// 토큰을 바꾸면 이 값도 함께 바꾼다.
export const CATEGORY_PIN_COLOR: Record<Category, string> = {
  랜드마크: '#5b4e8c',
  음식점: '#b0664a',
  숙소: '#8a7a4e',
  이동: '#4a6e96',
  쇼핑: '#a85273',
  자연: '#4a7c5e',
}

export const ROUTE_COLOR = '#2b2a26'
```

- [ ] **Step 2: `src/components/Chip.tsx`**

```tsx
import type { ButtonHTMLAttributes } from 'react'

export function Chip({
  selected,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`min-h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold ${
        selected ? 'bg-ink text-canvas' : 'border border-hairline bg-surface text-body'
      } ${className}`}
      {...props}
    />
  )
}
```

- [ ] **Step 3: `src/components/CategoryTag.tsx`**

```tsx
import { CATEGORY_TAG_CLASS } from '@/lib/categories'
import type { Category } from '@/lib/schema'

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-label font-semibold ${CATEGORY_TAG_CLASS[category]}`}>
      {category}
    </span>
  )
}
```

- [ ] **Step 4: `src/components/ProgressDots.tsx`**

```tsx
export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${total}단계 중 ${current + 1}단계`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full ${i === current ? 'w-4 bg-ink' : i < current ? 'w-1.5 bg-muted' : 'w-1.5 bg-hairline'}`}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: `src/components/Sheet.tsx`**

```tsx
'use client'

import { useEffect } from 'react'

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[80dvh] w-full max-w-[560px] overflow-y-auto rounded-t-sheet border-t border-hairline bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-content font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 h-11 w-11 text-date text-muted">
            ×
          </button>
        </div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: `src/components/ErrorState.tsx`**

```tsx
import { Button } from './Button'

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mt-8 text-center">
      <p role="alert" className="text-content text-body">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3">
          다시 시도
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 7: `src/app/page.tsx` — 계획 목록**

```tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { apiFetch } from '@/lib/api'
import { formatDateRange } from '@/lib/format'
import type { PlanStatus, PlanSummaryDto } from '@/lib/schema'

const STATUS_LABEL: Record<PlanStatus, string | null> = {
  generating: '만드는 중',
  ready: null,
  failed: '실패',
}

export default function HomePage() {
  const [plans, setPlans] = useState<PlanSummaryDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiFetch<PlanSummaryDto[]>('/api/plans')
      .then((list) => {
        if (cancelled) return
        setPlans(list)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '목록을 불러오지 못했어요.')
      })
    return () => {
      cancelled = true
    }
  }, [version])

  return (
    <main className="px-4 pb-28 pt-5">
      <p className="text-label font-semibold uppercase tracking-label text-muted">Travel Guide</p>
      <h1 className="text-date font-bold tracking-title text-ink">내 여행</h1>

      {error ? (
        <ErrorState message={error} onRetry={() => setVersion((v) => v + 1)} />
      ) : plans === null ? (
        <p className="mt-8 text-center text-content text-muted">불러오는 중이에요</p>
      ) : plans.length === 0 ? (
        <p className="mt-8 text-center text-content text-muted">아직 만든 여행이 없어요. 아래 버튼으로 시작해보세요.</p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-card border border-hairline bg-surface">
          {plans.map((plan, index) => (
            <li key={plan.id} className={index > 0 ? 'border-t border-divider' : undefined}>
              <Link href={`/plans/${plan.id}`} className="flex min-h-11 items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-label font-semibold uppercase tracking-label text-muted">
                    {plan.destination} · {formatDateRange(plan.startDate, plan.endDate)}
                  </p>
                  <p className="truncate text-content font-semibold text-ink">{plan.title}</p>
                </div>
                {STATUS_LABEL[plan.status] && (
                  <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-label font-semibold text-chip-fg">
                    {STATUS_LABEL[plan.status]}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[560px] bg-canvas px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <Link
          href="/new"
          className="flex min-h-12 w-full items-center justify-center rounded-card bg-ink font-semibold text-canvas"
        >
          새 여행 만들기
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 8: 화면 확인**

Run: `npm run dev` → 모바일 크기(375px)로 `/` 접속.
Expected: Task 9에서 만든 계획이 남아 있으면 목록에, 없으면 빈 상태 문구. 하단에 먹색 "새 여행 만들기" 버튼. 그림자·강조색이 없어야 한다.

- [ ] **Step 9: 린트·타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm run lint && npm run typecheck && git status --short`

---

### Task 11: 단계별 위저드

**Files:**
- Create: `src/features/wizard/draft.ts`, `src/features/wizard/useWizardDraft.ts`, `src/features/wizard/StepFrame.tsx`, `src/features/wizard/steps/BasicSteps.tsx`, `src/features/wizard/steps/BookingSteps.tsx`, `src/features/wizard/steps/ConfirmStep.tsx`, `src/features/wizard/Wizard.tsx`, `src/app/new/page.tsx`
- Test: `src/features/wizard/draft.test.ts`

**Interfaces:**
- Consumes: 스키마 상수·타입, `tripDates`, `formatKrw` (Task 2), `apiFetch`, `Button` (Task 3), `Chip`, `ProgressDots` (Task 10), `POST /api/airports/guess`, `POST /api/plans`
- Produces (`@/features/wizard/draft`): `type WizardDraft`, `EMPTY_DRAFT`, `STEPS`, `type StepId`, `canProceed(step: StepId, d: WizardDraft): boolean`, `toPlanInput(d: WizardDraft): { ok: true; input: PlanInput } | { ok: false; message: string }`, `parseKrw(s: string): number | null`
- Produces: `type StepProps = { draft: WizardDraft; update: (patch: Partial<WizardDraft>) => void }` (`StepFrame.tsx`)

- [ ] **Step 1: 실패하는 테스트 작성 — `src/features/wizard/draft.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { EMPTY_DRAFT, canProceed, parseKrw, toPlanInput, type WizardDraft } from './draft'

const filled: WizardDraft = {
  ...EMPTY_DRAFT,
  destination: '상해',
  startDate: '2026-12-18',
  endDate: '2026-12-21',
  companion: '연인',
  styles: ['맛집'],
  mustVisit: ['동방명주'],
  pace: '보통',
  budget: '보통',
  transport: '대중교통',
  departureId: 'ICN',
  arrivalId: 'PVG',
}

test('parseKrw는 쉼표와 원을 무시한다', () => {
  expect(parseKrw('562,000원')).toBe(562000)
  expect(parseKrw('')).toBeNull()
})

describe('canProceed', () => {
  test('목적지가 비면 못 넘어간다', () => {
    expect(canProceed('destination', EMPTY_DRAFT)).toBe(false)
    expect(canProceed('destination', filled)).toBe(true)
  })

  test('날짜는 1~14일이어야 한다', () => {
    expect(canProceed('dates', filled)).toBe(true)
    expect(canProceed('dates', { ...filled, endDate: '2027-01-01' })).toBe(false)
    expect(canProceed('dates', { ...filled, endDate: '2026-12-17' })).toBe(false)
  })

  test('항공: 가격 조회는 공항 코드 둘 다, 예약 완료는 편명·시각·금액, 불필요는 바로 통과', () => {
    expect(canProceed('flight', filled)).toBe(true)
    expect(canProceed('flight', { ...filled, arrivalId: 'PV' })).toBe(false)
    const booked: WizardDraft = {
      ...filled,
      flightMode: 'booked',
      bookedFlight: { flightNumber: 'KE893', outboundArrival: '2026-12-18T11:40', returnDeparture: '', totalKrw: '562,000' },
    }
    expect(canProceed('flight', booked)).toBe(false)
    expect(canProceed('flight', { ...booked, bookedFlight: { ...booked.bookedFlight, returnDeparture: '2026-12-21T19:30' } })).toBe(true)
    expect(canProceed('flight', { ...filled, flightMode: 'none', departureId: '' })).toBe(true)
  })

  test('숙소: 예약 완료는 이름과 금액이 필요하다', () => {
    expect(canProceed('stay', filled)).toBe(true)
    expect(canProceed('stay', { ...filled, stayMode: 'booked' })).toBe(false)
    expect(canProceed('stay', { ...filled, stayMode: 'booked', bookedStay: { name: '호텔', address: '', totalKrw: '300000' } })).toBe(true)
  })

  test('꼭 가고 싶은 곳과 추가 요청은 비어도 된다', () => {
    expect(canProceed('mustVisit', { ...filled, mustVisit: [] })).toBe(true)
    expect(canProceed('notes', filled)).toBe(true)
  })
})

describe('toPlanInput', () => {
  test('가격 조회 모드 입력을 PlanInput으로 바꾼다', () => {
    const result = toPlanInput(filled)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.input.flight).toEqual({ mode: 'search', departureId: 'ICN', arrivalId: 'PVG' })
      expect(result.input.stay).toEqual({ mode: 'search', area: '' })
    }
  })

  test('예약 완료 금액 문자열을 숫자로 바꾼다', () => {
    const result = toPlanInput({
      ...filled,
      flightMode: 'booked',
      bookedFlight: { flightNumber: 'KE893', outboundArrival: '2026-12-18T11:40', returnDeparture: '2026-12-21T19:30', totalKrw: '562,000' },
      stayMode: 'booked',
      bookedStay: { name: '호텔', address: '주소', totalKrw: '300,000원' },
    })
    expect(result.ok && result.input.flight).toMatchObject({ mode: 'booked', totalKrw: 562000 })
    expect(result.ok && result.input.stay).toMatchObject({ mode: 'booked', totalKrw: 300000 })
  })

  test('필수 값이 없으면 실패한다', () => {
    expect(toPlanInput(EMPTY_DRAFT).ok).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/features/wizard/draft.test.ts`
Expected: FAIL — `Cannot find module './draft'`

- [ ] **Step 3: `src/features/wizard/draft.ts` 구현**

```ts
import { tripDates } from '@/lib/dates'
import {
  MAX_TRIP_DAYS,
  PlanInputSchema,
  type BudgetLevel,
  type Companion,
  type Pace,
  type PlanInput,
  type Transport,
  type TravelStyle,
} from '@/lib/schema'

export type FlightMode = 'search' | 'booked' | 'none'
export type StayMode = 'search' | 'booked'

export type WizardDraft = {
  destination: string
  startDate: string
  endDate: string
  origin: string
  adults: number
  children: number
  companion: Companion | null
  styles: TravelStyle[]
  mustVisit: string[]
  pace: Pace | null
  budget: BudgetLevel | null
  transport: Transport | null
  flightMode: FlightMode
  departureId: string
  arrivalId: string
  bookedFlight: { flightNumber: string; outboundArrival: string; returnDeparture: string; totalKrw: string }
  stayMode: StayMode
  stayArea: string
  bookedStay: { name: string; address: string; totalKrw: string }
  notes: string
}

export const EMPTY_DRAFT: WizardDraft = {
  destination: '',
  startDate: '',
  endDate: '',
  origin: '인천',
  adults: 2,
  children: 0,
  companion: null,
  styles: [],
  mustVisit: [],
  pace: null,
  budget: null,
  transport: null,
  flightMode: 'search',
  departureId: '',
  arrivalId: '',
  bookedFlight: { flightNumber: '', outboundArrival: '', returnDeparture: '', totalKrw: '' },
  stayMode: 'search',
  stayArea: '',
  bookedStay: { name: '', address: '', totalKrw: '' },
  notes: '',
}

export const STEPS = [
  { id: 'destination', label: '목적지' },
  { id: 'dates', label: '날짜' },
  { id: 'people', label: '출발지·인원' },
  { id: 'companion', label: '동행' },
  { id: 'styles', label: '여행 스타일' },
  { id: 'mustVisit', label: '꼭 가고 싶은 곳' },
  { id: 'paceBudget', label: '강도·예산' },
  { id: 'transport', label: '교통수단' },
  { id: 'flight', label: '항공편' },
  { id: 'stay', label: '숙소' },
  { id: 'notes', label: '추가 요청' },
  { id: 'confirm', label: '확인' },
] as const
export type StepId = (typeof STEPS)[number]['id']

const IATA = /^[A-Z]{3}$/

export function parseKrw(s: string): number | null {
  const digits = s.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : null
}

export function canProceed(step: StepId, d: WizardDraft): boolean {
  switch (step) {
    case 'destination':
      return d.destination.trim().length > 0
    case 'dates': {
      const days = tripDates(d.startDate, d.endDate).length
      return days > 0 && days <= MAX_TRIP_DAYS
    }
    case 'people':
      return d.origin.trim().length > 0 && d.adults >= 1
    case 'companion':
      return d.companion !== null
    case 'styles':
      return d.styles.length > 0
    case 'mustVisit':
      return true
    case 'paceBudget':
      return d.pace !== null && d.budget !== null
    case 'transport':
      return d.transport !== null
    case 'flight':
      if (d.flightMode === 'none') return true
      if (d.flightMode === 'search') return IATA.test(d.departureId) && IATA.test(d.arrivalId)
      return (
        d.bookedFlight.flightNumber.trim().length >= 2 &&
        d.bookedFlight.outboundArrival !== '' &&
        d.bookedFlight.returnDeparture !== '' &&
        parseKrw(d.bookedFlight.totalKrw) !== null
      )
    case 'stay':
      if (d.stayMode === 'search') return true
      return d.bookedStay.name.trim().length > 0 && parseKrw(d.bookedStay.totalKrw) !== null
    case 'notes':
      return d.notes.length <= 500
    case 'confirm':
      return toPlanInput(d).ok
  }
}

export function toPlanInput(d: WizardDraft): { ok: true; input: PlanInput } | { ok: false; message: string } {
  const flight =
    d.flightMode === 'search'
      ? { mode: 'search', departureId: d.departureId.trim().toUpperCase(), arrivalId: d.arrivalId.trim().toUpperCase() }
      : d.flightMode === 'booked'
        ? {
            mode: 'booked',
            flightNumber: d.bookedFlight.flightNumber,
            outboundArrival: d.bookedFlight.outboundArrival,
            returnDeparture: d.bookedFlight.returnDeparture,
            totalKrw: parseKrw(d.bookedFlight.totalKrw),
          }
        : { mode: 'none' }
  const stay =
    d.stayMode === 'search'
      ? { mode: 'search', area: d.stayArea }
      : { mode: 'booked', name: d.bookedStay.name, address: d.bookedStay.address, totalKrw: parseKrw(d.bookedStay.totalKrw) }

  const result = PlanInputSchema.safeParse({
    destination: d.destination,
    startDate: d.startDate,
    endDate: d.endDate,
    origin: d.origin,
    adults: d.adults,
    children: d.children,
    companion: d.companion,
    styles: d.styles,
    mustVisit: d.mustVisit,
    pace: d.pace,
    budget: d.budget,
    transport: d.transport,
    flight,
    stay,
    notes: d.notes,
  })
  if (!result.success) return { ok: false, message: '입력을 다시 확인해주세요.' }
  return { ok: true, input: result.data }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/features/wizard/draft.test.ts`
Expected: PASS

- [ ] **Step 5: `src/features/wizard/useWizardDraft.ts`**

이 훅을 쓰는 `Wizard`는 `ssr: false`로만 로드하므로(Step 10) 초기값에서 바로 `sessionStorage`를 읽는다.

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { EMPTY_DRAFT, type WizardDraft } from './draft'

const KEY = 'tga:wizard'
type State = { step: number; draft: WizardDraft }

function load(): State {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>
      return { step: saved.step ?? 0, draft: { ...EMPTY_DRAFT, ...saved.draft } }
    }
  } catch {
    // 저장소를 못 쓰는 환경이면 빈 상태로 시작한다
  }
  return { step: 0, draft: EMPTY_DRAFT }
}

export function useWizardDraft() {
  const [state, setState] = useState<State>(load)

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // 저장 실패는 무시한다
    }
  }, [state])

  const update = useCallback(
    (patch: Partial<WizardDraft>) => setState((s) => ({ ...s, draft: { ...s.draft, ...patch } })),
    [],
  )
  const goTo = useCallback((step: number) => setState((s) => ({ ...s, step })), [])
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      // 무시
    }
  }, [])

  return { step: state.step, draft: state.draft, update, goTo, clear }
}
```

- [ ] **Step 6: `src/features/wizard/StepFrame.tsx`**

```tsx
import type { WizardDraft } from './draft'

export type StepProps = { draft: WizardDraft; update: (patch: Partial<WizardDraft>) => void }

export const INPUT_CLASS =
  'min-h-12 w-full rounded-card border border-hairline bg-surface px-3 text-field text-ink placeholder:text-placeholder focus:border-ink focus:outline-none'

export function Question({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h1 className="whitespace-pre-line text-date font-bold leading-snug tracking-title text-ink">{title}</h1>
      {hint && <p className="mt-1 text-content text-muted">{hint}</p>}
    </div>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-label font-semibold uppercase tracking-label text-muted">{children}</span>
}

export function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  const btn = 'h-11 w-11 rounded-full border border-hairline bg-surface text-date text-body disabled:opacity-30'
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-content text-body">{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" className={btn} aria-label={`${label} 줄이기`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <span className="w-6 text-center text-content font-semibold text-ink">{value}</span>
        <button type="button" className={btn} aria-label={`${label} 늘리기`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  )
}

export function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-ink"
      />
      <span className="text-content text-body">{label}</span>
    </label>
  )
}
```

- [ ] **Step 7: `src/features/wizard/steps/BasicSteps.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Chip } from '@/components/Chip'
import { tripDates } from '@/lib/dates'
import { BUDGETS, COMPANIONS, MAX_TRIP_DAYS, PACES, STYLES, TRANSPORTS } from '@/lib/schema'
import { Counter, FieldLabel, INPUT_CLASS, Question, type StepProps } from '../StepFrame'

export function DestinationStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'어디로\n여행을 가나요?'} hint="도시나 국가 이름을 적어주세요" />
      <input
        autoFocus
        value={draft.destination}
        onChange={(e) => update({ destination: e.target.value })}
        placeholder="예: 오사카, 상해, 제주도"
        maxLength={50}
        className={`mt-6 ${INPUT_CLASS}`}
      />
    </>
  )
}

export function DatesStep({ draft, update }: StepProps) {
  const days = tripDates(draft.startDate, draft.endDate).length
  const tooLong = days > MAX_TRIP_DAYS
  return (
    <>
      <Question title={'언제\n떠나나요?'} hint={`최대 ${MAX_TRIP_DAYS}일까지 짤 수 있어요`} />
      <div className="mt-6 flex flex-col gap-3">
        <label>
          <FieldLabel>출발일</FieldLabel>
          <input type="date" value={draft.startDate} onChange={(e) => update({ startDate: e.target.value })} className={INPUT_CLASS} />
        </label>
        <label>
          <FieldLabel>귀국일</FieldLabel>
          <input
            type="date"
            value={draft.endDate}
            min={draft.startDate || undefined}
            onChange={(e) => update({ endDate: e.target.value })}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      {days > 0 && (
        <p className={`mt-3 text-content ${tooLong ? 'text-body' : 'text-muted'}`}>
          {tooLong ? `${MAX_TRIP_DAYS}일을 넘었어요. 귀국일을 당겨주세요.` : `${days - 1}박 ${days}일`}
        </p>
      )}
    </>
  )
}

export function PeopleStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'어디서 출발하고\n몇 명이 가나요?'} />
      <label className="mt-6 block">
        <FieldLabel>출발지</FieldLabel>
        <input value={draft.origin} onChange={(e) => update({ origin: e.target.value })} maxLength={50} className={INPUT_CLASS} />
      </label>
      <div className="mt-4 rounded-card border border-hairline bg-surface px-3">
        <Counter label="성인" value={draft.adults} min={1} max={9} onChange={(adults) => update({ adults })} />
        <div className="border-t border-divider" />
        <Counter label="아동" value={draft.children} min={0} max={8} onChange={(children) => update({ children })} />
      </div>
    </>
  )
}

export function CompanionStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'누구와\n함께 가나요?'} />
      <div className="mt-6 flex flex-wrap gap-2">
        {COMPANIONS.map((c) => (
          <Chip key={c} selected={draft.companion === c} onClick={() => update({ companion: c })}>
            {c}
          </Chip>
        ))}
      </div>
    </>
  )
}

export function StylesStep({ draft, update }: StepProps) {
  const toggle = (s: (typeof STYLES)[number]) =>
    update({ styles: draft.styles.includes(s) ? draft.styles.filter((x) => x !== s) : [...draft.styles, s] })
  return (
    <>
      <Question title={'이번 여행에서\n무엇을 하고 싶나요?'} hint="여러 개 고를 수 있어요" />
      <div className="mt-6 flex flex-wrap gap-2">
        {STYLES.map((s) => (
          <Chip key={s} selected={draft.styles.includes(s)} onClick={() => toggle(s)}>
            {s}
          </Chip>
        ))}
      </div>
    </>
  )
}

export function MustVisitStep({ draft, update }: StepProps) {
  const [text, setText] = useState('')
  const add = () => {
    const name = text.trim()
    if (!name || draft.mustVisit.includes(name) || draft.mustVisit.length >= 10) return
    update({ mustVisit: [...draft.mustVisit, name] })
    setText('')
  }
  return (
    <>
      <Question title={'꼭 가고 싶은 곳이\n있나요?'} hint="적어두면 일정에 반드시 넣어요. 없으면 다음으로 넘어가세요" />
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 동방명주"
          maxLength={50}
          enterKeyHint="done"
          className={INPUT_CLASS}
        />
        <button type="submit" className="min-h-12 shrink-0 rounded-card border border-hairline bg-surface px-4 font-semibold text-body">
          추가
        </button>
      </form>
      {draft.mustVisit.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {draft.mustVisit.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => update({ mustVisit: draft.mustVisit.filter((n) => n !== name) })}
              aria-label={`${name} 빼기`}
              className="flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-canvas"
            >
              {name}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-label text-muted">{draft.mustVisit.length} / 10</p>
    </>
  )
}

export function PaceBudgetStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'일정 강도와\n예산을 골라주세요'} />
      <div className="mt-6">
        <FieldLabel>일정 강도</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {PACES.map((p) => (
            <Chip key={p} selected={draft.pace === p} onClick={() => update({ pace: p })}>
              {p}
            </Chip>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <FieldLabel>예산</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <Chip key={b} selected={draft.budget === b} onClick={() => update({ budget: b })}>
              {b}
            </Chip>
          ))}
        </div>
      </div>
    </>
  )
}

export function TransportStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'현지에서는\n어떻게 다니나요?'} />
      <div className="mt-6 flex flex-wrap gap-2">
        {TRANSPORTS.map((t) => (
          <Chip key={t} selected={draft.transport === t} onClick={() => update({ transport: t })}>
            {t}
          </Chip>
        ))}
      </div>
    </>
  )
}

export function NotesStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'더 바라는 점이\n있나요?'} hint="없으면 비워두세요" />
      <textarea
        value={draft.notes}
        onChange={(e) => update({ notes: e.target.value })}
        maxLength={500}
        rows={5}
        placeholder={'예: 둘째 날 저녁은 야경을 보고 싶어요.\n해산물은 못 먹어요.'}
        className={`mt-6 py-3 ${INPUT_CLASS}`}
      />
      <p className="mt-1 text-right text-label text-muted">{draft.notes.length} / 500</p>
    </>
  )
}
```

- [ ] **Step 8: `src/features/wizard/steps/BookingSteps.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { CheckRow, FieldLabel, INPUT_CLASS, Question, type StepProps } from '../StepFrame'

export function FlightStep({ draft, update }: StepProps) {
  const [guessState, setGuessState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const asked = useRef(false)
  const needsGuess = draft.flightMode === 'search' && !draft.departureId && !draft.arrivalId

  useEffect(() => {
    if (!needsGuess || asked.current) return
    asked.current = true
    const run = async () => {
      setGuessState('loading')
      try {
        const res = await apiFetch<{ departureId: string; arrivalId: string }>('/api/airports/guess', {
          method: 'POST',
          body: JSON.stringify({ origin: draft.origin, destination: draft.destination }),
        })
        update({ departureId: res.departureId, arrivalId: res.arrivalId })
        setGuessState('idle')
      } catch {
        setGuessState('failed')
      }
    }
    void run()
  }, [needsGuess, draft.origin, draft.destination, update])

  const b = draft.bookedFlight
  const setBooked = (patch: Partial<typeof b>) => update({ bookedFlight: { ...b, ...patch } })
  const code = (v: string) => v.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3)

  return (
    <>
      <Question title={'항공편은\n어떻게 할까요?'} hint="예약 전이면 실제 가격 후보를 찾아드려요" />
      <div className="mt-4">
        <CheckRow
          checked={draft.flightMode === 'booked'}
          onChange={(v) => update({ flightMode: v ? 'booked' : 'search' })}
          label="이미 예약했어요"
        />
        <CheckRow
          checked={draft.flightMode === 'none'}
          onChange={(v) => update({ flightMode: v ? 'none' : 'search' })}
          label="항공편이 필요 없어요"
        />
      </div>

      {draft.flightMode === 'search' && (
        <div className="mt-4 flex gap-3">
          <label className="flex-1">
            <FieldLabel>출발 공항</FieldLabel>
            <input value={draft.departureId} onChange={(e) => update({ departureId: code(e.target.value) })} placeholder="ICN" className={INPUT_CLASS} />
          </label>
          <label className="flex-1">
            <FieldLabel>도착 공항</FieldLabel>
            <input value={draft.arrivalId} onChange={(e) => update({ arrivalId: code(e.target.value) })} placeholder="KIX" className={INPUT_CLASS} />
          </label>
        </div>
      )}
      {draft.flightMode === 'search' && guessState === 'loading' && (
        <p className="mt-2 text-label text-muted">공항 코드를 찾고 있어요</p>
      )}
      {draft.flightMode === 'search' && guessState === 'failed' && (
        <p className="mt-2 text-label text-muted">공항 코드를 찾지 못했어요. 직접 입력해주세요.</p>
      )}

      {draft.flightMode === 'booked' && (
        <div className="mt-4 flex flex-col gap-3">
          <label>
            <FieldLabel>편명</FieldLabel>
            <input value={b.flightNumber} onChange={(e) => setBooked({ flightNumber: e.target.value })} placeholder="KE723" maxLength={20} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>가는 편 도착 일시 (현지)</FieldLabel>
            <input type="datetime-local" value={b.outboundArrival} onChange={(e) => setBooked({ outboundArrival: e.target.value })} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>오는 편 출발 일시 (현지)</FieldLabel>
            <input type="datetime-local" value={b.returnDeparture} onChange={(e) => setBooked({ returnDeparture: e.target.value })} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>왕복 총액 (원)</FieldLabel>
            <input inputMode="numeric" value={b.totalKrw} onChange={(e) => setBooked({ totalKrw: e.target.value })} placeholder="562000" className={INPUT_CLASS} />
          </label>
        </div>
      )}
    </>
  )
}

export function StayStep({ draft, update }: StepProps) {
  const s = draft.bookedStay
  const setBooked = (patch: Partial<typeof s>) => update({ bookedStay: { ...s, ...patch } })
  return (
    <>
      <Question title={'숙소는\n어떻게 할까요?'} hint="예약 전이면 실제 가격 후보를 찾아드려요" />
      <div className="mt-4">
        <CheckRow
          checked={draft.stayMode === 'booked'}
          onChange={(v) => update({ stayMode: v ? 'booked' : 'search' })}
          label="이미 예약했어요"
        />
      </div>

      {draft.stayMode === 'search' ? (
        <label className="mt-4 block">
          <FieldLabel>선호 지역 (선택)</FieldLabel>
          <input value={draft.stayArea} onChange={(e) => update({ stayArea: e.target.value })} placeholder="예: 난바, 와이탄" maxLength={50} className={INPUT_CLASS} />
        </label>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <label>
            <FieldLabel>숙소 이름</FieldLabel>
            <input value={s.name} onChange={(e) => setBooked({ name: e.target.value })} maxLength={100} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>주소 (선택)</FieldLabel>
            <input value={s.address} onChange={(e) => setBooked({ address: e.target.value })} maxLength={200} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>숙박 총액 (원)</FieldLabel>
            <input inputMode="numeric" value={s.totalKrw} onChange={(e) => setBooked({ totalKrw: e.target.value })} placeholder="504000" className={INPUT_CLASS} />
          </label>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 9: `src/features/wizard/steps/ConfirmStep.tsx`**

```tsx
import { tripDates } from '@/lib/dates'
import { formatDateRange, formatKrw } from '@/lib/format'
import { parseKrw } from '../draft'
import { Question, type StepProps } from '../StepFrame'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-3 py-3">
      <span className="w-20 shrink-0 text-label font-semibold uppercase tracking-label text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-content text-body">{value}</span>
    </div>
  )
}

export function ConfirmStep({ draft, error }: Pick<StepProps, 'draft'> & { error: string | null }) {
  const days = tripDates(draft.startDate, draft.endDate).length
  const flight =
    draft.flightMode === 'none'
      ? '필요 없음'
      : draft.flightMode === 'booked'
        ? `예약 완료 · ${draft.bookedFlight.flightNumber} · ${formatKrw(parseKrw(draft.bookedFlight.totalKrw) ?? 0)}`
        : `가격 조회 · ${draft.departureId} → ${draft.arrivalId}`
  const stay =
    draft.stayMode === 'booked'
      ? `예약 완료 · ${draft.bookedStay.name} · ${formatKrw(parseKrw(draft.bookedStay.totalKrw) ?? 0)}`
      : `가격 조회${draft.stayArea ? ` · ${draft.stayArea}` : ''}`

  const rows: [string, string][] = [
    ['목적지', draft.destination],
    ['날짜', `${formatDateRange(draft.startDate, draft.endDate)} · ${days - 1}박 ${days}일`],
    ['인원', `${draft.origin} 출발 · 성인 ${draft.adults}${draft.children ? ` · 아동 ${draft.children}` : ''}`],
    ['동행', draft.companion ?? ''],
    ['스타일', draft.styles.join(', ')],
    ['꼭 갈 곳', draft.mustVisit.join(', ') || '없음'],
    ['강도·예산', `${draft.pace} · ${draft.budget}`],
    ['교통', draft.transport ?? ''],
    ['항공', flight],
    ['숙소', stay],
    ['추가 요청', draft.notes || '없음'],
  ]

  return (
    <>
      <Question title={'이대로\n일정을 만들까요?'} hint="만드는 데 1~2분 정도 걸려요" />
      <div className="mt-6 overflow-hidden rounded-card border border-hairline bg-surface">
        {rows.map(([label, value], i) => (
          <div key={label} className={i > 0 ? 'border-t border-divider' : undefined}>
            <Row label={label} value={value} />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-content text-body">
          {error}
        </p>
      )}
    </>
  )
}
```

- [ ] **Step 10: `src/features/wizard/Wizard.tsx`와 `src/app/new/page.tsx`**

`src/features/wizard/Wizard.tsx`:
```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { ProgressDots } from '@/components/ProgressDots'
import { apiFetch } from '@/lib/api'
import { STEPS, canProceed, toPlanInput, type StepId } from './draft'
import type { StepProps } from './StepFrame'
import {
  CompanionStep,
  DatesStep,
  DestinationStep,
  MustVisitStep,
  NotesStep,
  PaceBudgetStep,
  PeopleStep,
  StylesStep,
  TransportStep,
} from './steps/BasicSteps'
import { FlightStep, StayStep } from './steps/BookingSteps'
import { ConfirmStep } from './steps/ConfirmStep'
import { useWizardDraft } from './useWizardDraft'

const STEP_COMPONENT: Record<Exclude<StepId, 'confirm'>, (props: StepProps) => React.ReactNode> = {
  destination: DestinationStep,
  dates: DatesStep,
  people: PeopleStep,
  companion: CompanionStep,
  styles: StylesStep,
  mustVisit: MustVisitStep,
  paceBudget: PaceBudgetStep,
  transport: TransportStep,
  flight: FlightStep,
  stay: StayStep,
  notes: NotesStep,
}

export default function Wizard() {
  const router = useRouter()
  const { step, draft, update, goTo, clear } = useWizardDraft()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const index = Math.min(step, STEPS.length - 1)
  const current = STEPS[index]
  const isLast = current.id === 'confirm'

  const back = () => (index === 0 ? router.push('/') : goTo(index - 1))

  const next = async () => {
    if (!isLast) {
      goTo(index + 1)
      return
    }
    const result = toPlanInput(draft)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { id } = await apiFetch<{ id: string }>('/api/plans', { method: 'POST', body: JSON.stringify(result.input) })
      clear()
      router.replace(`/plans/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정 만들기를 시작하지 못했어요.')
      setSubmitting(false)
    }
  }

  const StepComponent = current.id === 'confirm' ? null : STEP_COMPONENT[current.id]

  return (
    <main className="px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={back} aria-label="이전" className="-ml-2 flex h-11 w-11 items-center justify-center text-date text-body">
          ‹
        </button>
        <ProgressDots total={STEPS.length} current={index} />
        <span className="w-11" />
      </div>

      <p className="mt-4 text-label font-semibold uppercase tracking-label text-muted">
        {index + 1} / {STEPS.length} · {current.label}
      </p>
      <div className="mt-2">
        {StepComponent ? <StepComponent draft={draft} update={update} /> : <ConfirmStep draft={draft} error={error} />}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[560px] bg-canvas px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <Button onClick={next} disabled={submitting || !canProceed(current.id, draft)}>
          {isLast ? (submitting ? '시작하는 중' : '일정 만들기') : '다음'}
        </Button>
      </div>
    </main>
  )
}
```

`src/app/new/page.tsx`:
```tsx
'use client'

import dynamic from 'next/dynamic'

// 위저드는 sessionStorage에서 초안을 바로 읽으므로 서버 렌더링을 하지 않는다.
const Wizard = dynamic(() => import('@/features/wizard/Wizard'), { ssr: false })

export default function NewPlanPage() {
  return <Wizard />
}
```

- [ ] **Step 11: 화면 확인 (MOCK)**

Run: `npm run dev` → 375px 폭으로 `/new`.
Expected:
- 12단계가 차례로 나오고, 필수 값이 없으면 "다음"이 비활성.
- 꼭 가고 싶은 곳에서 엔터로 칩이 쌓이고 누르면 빠진다.
- 항공 단계에 들어가면 공항 코드가 자동으로 채워진다(MOCK: ICN/KIX). "이미 예약했어요"를 체크하면 예약 입력칸으로 바뀐다.
- 새로고침해도 입력과 단계가 유지된다.
- 확인 단계에서 "일정 만들기" → `/plans/<id>`로 이동한다(결과 화면은 Task 12에서 만든다. 지금은 404여도 된다).

- [ ] **Step 12: 테스트·린트·타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm test && npm run lint && npm run typecheck && git status --short`

---

### Task 12: 결과 화면 — 진행 상태, 일정 탭, 예산 탭

**Files:**
- Create: `src/features/plan/usePlan.ts`, `src/features/plan/GeneratingView.tsx`, `src/features/plan/DayChips.tsx`, `src/features/plan/ScheduleTab.tsx`, `src/features/plan/BudgetTab.tsx`, `src/features/plan/PlanView.tsx`, `src/app/plans/[id]/page.tsx`

**Interfaces:**
- Consumes: DTO·타입, `formatKrw`, `formatDateRange`, `formatDuration`, `formatShortDate` (Task 2), `apiFetch`, `Button` (Task 3), `CategoryTag`, `Chip`, `ErrorState` (Task 10), `GET /api/plans/[id]`, `POST /api/plans/[id]/retry`, `DELETE /api/plans/[id]`
- Produces:
  - `usePlan(id: string): { data: PlanDetailDto | null; error: string | null; reload: () => void; setData: Dispatch<SetStateAction<PlanDetailDto | null>> }`
  - `<DayChips days: Day[] index: number onChange: (i: number) => void>`
  - `<PlanView id: string>` — Task 13·14가 이 파일에 `MapTab`, `Revise`를 끼워 넣는다

- [ ] **Step 1: `src/features/plan/usePlan.ts`**

```ts
'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { PlanDetailDto } from '@/lib/schema'

const POLL_MS = 2000

/** 계획을 불러오고, generating 동안 2초마다 다시 불러온다. */
export function usePlan(id: string) {
  const [data, setData] = useState<PlanDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const detail = await apiFetch<PlanDetailDto>(`/api/plans/${id}`)
        if (cancelled) return
        setData(detail)
        setError(null)
        if (detail.plan.status === 'generating') timer = setTimeout(load, POLL_MS)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '여행 계획을 불러오지 못했어요.')
      }
    }
    void load()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [id, version])

  return { data, error, reload: () => setVersion((v) => v + 1), setData }
}
```

- [ ] **Step 2: `src/features/plan/GeneratingView.tsx` (생성 중·실패 화면)**

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/lib/api'
import { formatDateRange } from '@/lib/format'
import type { PlanDto, ProgressStep } from '@/lib/schema'

const PROGRESS: { id: ProgressStep; label: string }[] = [
  { id: 'offers', label: '항공권·숙소 가격을 찾고 있어요' },
  { id: 'itinerary', label: '일정을 짜고 있어요' },
  { id: 'places', label: '장소 위치를 확인하고 있어요' },
]

function Header({ plan }: { plan: PlanDto }) {
  return (
    <header>
      <Link href="/" className="-ml-1 inline-flex min-h-11 items-center px-1 text-content text-muted">
        ‹ 목록
      </Link>
      <p className="text-label font-semibold uppercase tracking-label text-muted">
        {plan.destination} · {formatDateRange(plan.startDate, plan.endDate)}
      </p>
    </header>
  )
}

export function GeneratingView({ plan }: { plan: PlanDto }) {
  const current = Math.max(0, PROGRESS.findIndex((s) => s.id === plan.progressStep))
  return (
    <main className="px-4 py-3">
      <Header plan={plan} />
      <h1 className="mt-1 text-date font-bold tracking-title text-ink">여행을 준비하고 있어요</h1>
      <ol className="mt-6 overflow-hidden rounded-card border border-hairline bg-surface">
        {PROGRESS.map((step, i) => (
          <li
            key={step.id}
            className={`flex min-h-11 items-center gap-3 px-3 py-3 text-content ${i > 0 ? 'border-t border-divider' : ''} ${
              i < current ? 'text-muted' : i === current ? 'font-semibold text-ink' : 'text-placeholder'
            }`}
          >
            <span className="w-8 shrink-0 text-label font-semibold uppercase tracking-label">
              {i < current ? '완료' : i === current ? '진행' : '대기'}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-content text-muted">보통 1~2분 걸려요. 이 화면을 닫아도 계속 만들어져요.</p>
    </main>
  )
}

export function FailedView({ plan, onRetried }: { plan: PlanDto; onRetried: () => void }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retry = async () => {
    setPending(true)
    setError(null)
    try {
      await apiFetch(`/api/plans/${plan.id}/retry`, { method: 'POST' })
      onRetried()
    } catch (e) {
      setError(e instanceof Error ? e.message : '다시 시도하지 못했어요.')
      setPending(false)
    }
  }
  return (
    <main className="px-4 py-3">
      <Header plan={plan} />
      <h1 className="mt-1 text-date font-bold tracking-title text-ink">일정을 만들지 못했어요</h1>
      <p role="alert" className="mt-3 text-content text-body">
        {error ?? plan.error ?? '알 수 없는 문제가 생겼어요.'}
      </p>
      <Button onClick={retry} disabled={pending} className="mt-6">
        {pending ? '다시 시작하는 중' : '다시 시도'}
      </Button>
    </main>
  )
}
```

- [ ] **Step 3: `src/features/plan/DayChips.tsx`**

```tsx
import { Chip } from '@/components/Chip'
import { formatShortDate } from '@/lib/format'
import type { Day } from '@/lib/schema'

export function DayChips({ days, index, onChange }: { days: Day[]; index: number; onChange: (i: number) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="일차 선택">
      {days.map((day, i) => (
        <Chip key={day.date} role="tab" aria-selected={i === index} selected={i === index} onClick={() => onChange(i)}>
          {i + 1}일차 <span className="ml-1 opacity-60">{formatShortDate(day.date)}</span>
        </Chip>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: `src/features/plan/ScheduleTab.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { CategoryTag } from '@/components/CategoryTag'
import { formatKrw } from '@/lib/format'
import type { Item, Itinerary } from '@/lib/schema'
import { DayChips } from './DayChips'

function ItemDetail({ item }: { item: Item }) {
  const meta = [
    item.estCostKrw > 0 ? `예상 ${formatKrw(item.estCostKrw)}` : '무료',
    item.place?.rating ? `평점 ${item.place.rating.toFixed(1)}` : null,
    item.place?.status === 'unverified' ? '위치 미확인' : null,
  ].filter(Boolean)
  return (
    <div className="pb-3 pl-[60px] pr-3">
      <p className="text-content text-body">{item.description}</p>
      <p className="mt-1 text-label text-muted">{meta.join(' · ')}</p>
      {item.place?.address && <p className="text-label text-muted">{item.place.address}</p>}
      {item.place?.mapsUrl && (
        <a
          href={item.place.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex min-h-11 items-center text-label font-semibold text-ink underline underline-offset-4"
        >
          Google 지도에서 보기
        </a>
      )}
    </div>
  )
}

export function ScheduleTab({
  itinerary,
  dayIndex,
  onDayChange,
}: {
  itinerary: Itinerary
  dayIndex: number
  onDayChange: (i: number) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const day = itinerary.days[dayIndex]

  return (
    <section className="px-4">
      <p className="text-content text-body">{itinerary.summary}</p>
      <div className="mt-4">
        <DayChips days={itinerary.days} index={dayIndex} onChange={onDayChange} />
      </div>
      <p className="mt-3 text-content font-semibold text-ink">{day.theme}</p>

      {day.items.length === 0 ? (
        <p className="mt-6 text-center text-content text-muted">이날은 자유 일정이에요.</p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-card border border-hairline bg-surface">
          {day.items.map((item, i) => {
            const open = openId === item.id
            return (
              <li key={item.id} className={i > 0 ? 'border-t border-divider' : undefined}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-3 text-left"
                >
                  <span className="w-11 shrink-0 text-content font-semibold text-ink">{item.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-content text-body">{item.placeName}</span>
                    {item.mustVisit && <span className="block text-label font-semibold text-muted">내가 고른 곳</span>}
                  </span>
                  <CategoryTag category={item.category} />
                </button>
                {open && <ItemDetail item={item} />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 5: `src/features/plan/BudgetTab.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/lib/api'
import { formatDuration, formatKrw } from '@/lib/format'
import type { FlightOffer, HotelOffer, Itinerary, PlanDto } from '@/lib/schema'

const LINE = [
  { key: 'flightKrw', label: '항공', tag: 'bg-cat-move-bg text-cat-move-fg', bar: 'bg-cat-move-fg' },
  { key: 'stayKrw', label: '숙박', tag: 'bg-cat-stay-bg text-cat-stay-fg', bar: 'bg-cat-stay-fg' },
  { key: 'foodKrw', label: '식비', tag: 'bg-cat-food-bg text-cat-food-fg', bar: 'bg-cat-food-fg' },
  { key: 'localTransportKrw', label: '현지 교통', tag: 'bg-cat-nature-bg text-cat-nature-fg', bar: 'bg-cat-nature-fg' },
  { key: 'extraKrw', label: '기타', tag: 'bg-chip text-chip-fg', bar: 'bg-muted' },
] as const

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-label font-semibold uppercase tracking-label text-muted">{children}</p>
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 rounded-card border border-hairline bg-surface p-3">{children}</div>
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-label font-semibold text-ink underline underline-offset-4">
      {children}
    </a>
  )
}

function FlightCard({ offer, reason }: { offer: FlightOffer; reason?: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">
          {offer.airline} {offer.flightNumbers.join(' · ')}
        </span>
        <span className="shrink-0 font-semibold text-ink">{formatKrw(offer.priceKrw)}</span>
      </div>
      <p className="text-label text-muted">
        {offer.departAirport} {offer.departTime.slice(11)} → {offer.arriveAirport} {offer.arriveTime.slice(11)} ·{' '}
        {formatDuration(offer.durationMin)} · {offer.stops === 0 ? '직항' : `경유 ${offer.stops}회`} · 왕복
      </p>
      {reason && <p className="mt-1 text-content text-body">{reason}</p>}
      <ExternalLink href={offer.link}>Google Flights에서 보기</ExternalLink>
    </>
  )
}

function HotelCard({ offer, reason }: { offer: HotelOffer; reason?: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-semibold text-ink">{offer.name}</span>
        <span className="shrink-0 font-semibold text-ink">{formatKrw(offer.totalPriceKrw)}</span>
      </div>
      <p className="text-label text-muted">{offer.rating ? `평점 ${offer.rating.toFixed(1)} · ` : ''}전체 숙박 기준</p>
      {reason && <p className="mt-1 text-content text-body">{reason}</p>}
      <ExternalLink href={offer.link}>숙소 보기</ExternalLink>
    </>
  )
}

function Others<T extends { offerId: string }>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <>
      <Button variant="text" onClick={() => setOpen(!open)}>
        {open ? '다른 후보 접기' : `다른 후보 ${items.length}개 보기`}
      </Button>
      {open && items.map((item) => <Card key={item.offerId}>{render(item)}</Card>)}
    </>
  )
}

export function BudgetTab({ plan, itinerary }: { plan: PlanDto; itinerary: Itinerary }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const b = itinerary.budget
  const offers = plan.offers ?? { flights: [], hotels: [], flightError: null, hotelError: null }
  const input = plan.input

  const chosenFlight = offers.flights.find((f) => f.offerId === itinerary.flight.offerId)
  const chosenHotel = offers.hotels.find((h) => h.offerId === itinerary.stay.offerId)

  const remove = async () => {
    if (!window.confirm('이 여행을 삭제할까요? 되돌릴 수 없어요.')) return
    setDeleting(true)
    try {
      await apiFetch(`/api/plans/${plan.id}`, { method: 'DELETE' })
      router.replace('/')
    } catch {
      setDeleting(false)
      window.alert('삭제하지 못했어요. 다시 시도해주세요.')
    }
  }

  return (
    <section className="px-4">
      <p className="text-label font-semibold uppercase tracking-label text-muted">
        예상 총비용 · {input.adults + input.children}명
      </p>
      <p className="text-amount font-bold tracking-title text-ink">{formatKrw(b.totalKrw)}</p>

      {b.totalKrw > 0 && (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-chip">
          {LINE.map((line) => (
            <span key={line.key} className={line.bar} style={{ width: `${(b[line.key] / b.totalKrw) * 100}%` }} />
          ))}
        </div>
      )}

      <ul className="mt-4 overflow-hidden rounded-card border border-hairline bg-surface">
        {LINE.map((line, i) => (
          <li key={line.key} className={`flex min-h-11 items-center gap-2 px-3 py-3 ${i > 0 ? 'border-t border-divider' : ''}`}>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-label font-semibold ${line.tag}`}>{line.label}</span>
            <span className="flex-1" />
            <span className="text-content font-semibold text-ink">{formatKrw(b[line.key])}</span>
          </li>
        ))}
      </ul>
      {b.notes && <p className="mt-2 text-content text-muted">{b.notes}</p>}

      {itinerary.flight.kind !== 'none' && (
        <>
          <Label>항공편</Label>
          <Card>
            {itinerary.flight.kind === 'booked' && input.flight.mode === 'booked' ? (
              <p className="text-content text-body">
                예약 완료 · {input.flight.flightNumber} · {formatKrw(input.flight.totalKrw)}
              </p>
            ) : chosenFlight ? (
              <FlightCard offer={chosenFlight} reason={itinerary.flight.reason} />
            ) : (
              <p className="text-content text-body">{offers.flightError ?? '조건에 맞는 항공권 후보가 없어요.'}</p>
            )}
          </Card>
          <Others items={offers.flights.filter((f) => f !== chosenFlight)} render={(f) => <FlightCard offer={f} />} />
        </>
      )}

      <Label>숙소</Label>
      <Card>
        {itinerary.stay.kind === 'booked' && input.stay.mode === 'booked' ? (
          <p className="text-content text-body">
            예약 완료 · {input.stay.name} · {formatKrw(input.stay.totalKrw)}
          </p>
        ) : chosenHotel ? (
          <HotelCard offer={chosenHotel} reason={itinerary.stay.reason} />
        ) : (
          <p className="text-content text-body">{offers.hotelError ?? '조건에 맞는 숙소 후보가 없어요.'}</p>
        )}
      </Card>
      <Others items={offers.hotels.filter((h) => h !== chosenHotel)} render={(h) => <HotelCard offer={h} />} />

      <p className="mt-6 text-label text-muted">가격은 조회한 시점의 시세예요. 실제 예약은 링크에서 확인해주세요.</p>
      <div className="mt-6 text-center">
        <Button variant="text" onClick={remove} disabled={deleting}>
          {deleting ? '삭제하는 중' : '이 여행 삭제'}
        </Button>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: `src/features/plan/PlanView.tsx` (지도·수정 채팅 자리는 Task 13·14에서 채운다)**

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { formatDateRange } from '@/lib/format'
import { BudgetTab } from './BudgetTab'
import { FailedView, GeneratingView } from './GeneratingView'
import { ScheduleTab } from './ScheduleTab'
import { usePlan } from './usePlan'

type Tab = 'schedule' | 'map' | 'budget'
const TABS: { id: Tab; label: string }[] = [
  { id: 'schedule', label: '일정' },
  { id: 'map', label: '지도' },
  { id: 'budget', label: '예산' },
]

export const TAB_BAR_HEIGHT = 52

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav aria-label="결과 탭" className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex w-full max-w-[560px]">
        {TABS.map((t) => (
          <li key={t.id} className="flex-1">
            <button
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => onChange(t.id)}
              style={{ minHeight: TAB_BAR_HEIGHT }}
              className={`w-full text-label font-semibold tracking-label ${tab === t.id ? 'text-ink' : 'text-muted'}`}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function PlanView({ id }: { id: string }) {
  const { data, error, reload } = usePlan(id)
  const [tab, setTab] = useState<Tab>('schedule')
  const [dayIndex, setDayIndex] = useState(0)

  if (!data) {
    return (
      <main className="px-4 py-5">
        {error ? <ErrorState message={error} onRetry={reload} /> : <p className="text-content text-muted">불러오는 중이에요</p>}
      </main>
    )
  }

  const { plan } = data
  if (plan.status === 'generating') return <GeneratingView plan={plan} />
  if (plan.status === 'failed' || !plan.itinerary) return <FailedView plan={plan} onRetried={reload} />

  const itinerary = plan.itinerary
  const safeDay = Math.min(dayIndex, itinerary.days.length - 1)

  return (
    <div className="pb-[calc(160px+env(safe-area-inset-bottom))]">
      <header className="px-4 pt-2">
        <Link href="/" className="-ml-1 inline-flex min-h-11 items-center px-1 text-content text-muted">
          ‹ 목록
        </Link>
        <p className="text-label font-semibold uppercase tracking-label text-muted">
          {plan.destination} · {formatDateRange(plan.startDate, plan.endDate)}
        </p>
        <h1 className="text-date font-bold tracking-title text-ink">{itinerary.title}</h1>
      </header>

      <div className="mt-3">
        {tab === 'schedule' && <ScheduleTab itinerary={itinerary} dayIndex={safeDay} onDayChange={setDayIndex} />}
        {tab === 'map' && <p className="px-4 text-content text-muted">지도는 다음 작업에서 붙여요.</p>}
        {tab === 'budget' && <BudgetTab plan={plan} itinerary={itinerary} />}
      </div>

      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
```

`src/app/plans/[id]/page.tsx`:
```tsx
import { PlanView } from '@/features/plan/PlanView'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PlanView id={id} />
}
```

- [ ] **Step 7: 화면 확인 (MOCK)**

Run: `npm run dev` → `/new`에서 위저드를 끝까지 진행.
Expected:
- 결과 화면이 "진행 → 완료" 단계를 보여준 뒤 몇 초 안에 일정 탭으로 바뀐다.
- 일차 칩으로 날짜를 바꾸면 목록이 바뀌고, 항목을 누르면 설명·예상 비용·지도 링크가 펼쳐진다. 지정 장소에는 "내가 고른 곳" 표시.
- 예산 탭: 총액, 비율 막대, 항목 금액, 추천 항공·숙소 카드, "다른 후보 N개 보기", "이 여행 삭제".
- 위저드에서 "이미 예약했어요"로 만든 계획은 예산 탭에 예약 금액이 그대로 나온다.

- [ ] **Step 8: 린트·타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm run lint && npm run typecheck && git status --short`

---

### Task 13: 지도 탭 — 핀과 동선

**Files:**
- Create: `src/features/plan/MapTab.tsx`
- Modify: `src/features/plan/PlanView.tsx` (지도 자리 교체)

**Interfaces:**
- Consumes: `Itinerary`, `Item` (Task 2), `CATEGORY_PIN_COLOR`, `ROUTE_COLOR` (Task 10), `CategoryTag`, `Sheet` (Task 10), `DayChips` (Task 12), `formatKrw`
- Produces: `<MapTab itinerary: Itinerary dayIndex: number onDayChange: (i: number) => void>`

- [ ] **Step 1: (사용자) Google Maps 준비**

사용자에게 요청한다:
1. Google Cloud Console → 새 프로젝트 → 결제 계정 연결
2. API 및 서비스 → 라이브러리에서 **Maps JavaScript API**, **Places API (New)** 사용 설정
3. 사용자 인증 정보 → API 키 2개 생성
   - 브라우저용: 애플리케이션 제한 "웹사이트" → `http://localhost:3000/*`(배포 후 Vercel 도메인 추가), API 제한 "Maps JavaScript API"
   - 서버용: API 제한 "Places API (New)"
4. Google Maps Platform → 지도 관리 → 지도 ID 만들기(유형: JavaScript, 벡터). 원하면 지도 스타일에서 채도를 낮춘 스타일을 만들어 이 ID에 연결
5. `.env.local`에 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`, `GOOGLE_PLACES_API_KEY` 입력

키 없이 진행하면 지도 탭은 안내 문구만 보여준다(아래 코드). `NEXT_PUBLIC_GOOGLE_MAP_ID`가 비어 있으면 개발용 `DEMO_MAP_ID`를 쓴다.

- [ ] **Step 2: `src/features/plan/MapTab.tsx`**

```tsx
'use client'

import { APIProvider, AdvancedMarker, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useState } from 'react'
import { CategoryTag } from '@/components/CategoryTag'
import { Sheet } from '@/components/Sheet'
import { CATEGORY_PIN_COLOR, ROUTE_COLOR } from '@/lib/categories'
import { formatKrw } from '@/lib/format'
import type { Item, Itinerary } from '@/lib/schema'
import { DayChips } from './DayChips'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID'

type Stop = { item: Item; order: number; lat: number; lng: number }

function RouteLine({ stops }: { stops: Stop[] }) {
  const map = useMap()
  const maps = useMapsLibrary('maps')
  useEffect(() => {
    if (!map || !maps || stops.length < 2) return
    const line = new maps.Polyline({
      map,
      path: stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      strokeColor: ROUTE_COLOR,
      strokeOpacity: 0.7,
      strokeWeight: 2,
    })
    return () => line.setMap(null)
  }, [map, maps, stops])
  return null
}

function FitBounds({ stops }: { stops: Stop[] }) {
  const map = useMap()
  const core = useMapsLibrary('core')
  useEffect(() => {
    if (!map || !core || stops.length < 2) return
    const bounds = new core.LatLngBounds()
    for (const s of stops) bounds.extend({ lat: s.lat, lng: s.lng })
    map.fitBounds(bounds, 48)
  }, [map, core, stops])
  return null
}

export function MapTab({
  itinerary,
  dayIndex,
  onDayChange,
}: {
  itinerary: Itinerary
  dayIndex: number
  onDayChange: (i: number) => void
}) {
  const day = itinerary.days[dayIndex]
  const [selected, setSelected] = useState<Stop | null>(null)

  const stops = useMemo<Stop[]>(
    () =>
      day.items.flatMap((item, i) =>
        item.place?.status === 'verified' && item.place.lat !== undefined && item.place.lng !== undefined
          ? [{ item, order: i + 1, lat: item.place.lat, lng: item.place.lng }]
          : [],
      ),
    [day],
  )
  const hidden = day.items.length - stops.length

  const changeDay = (i: number) => {
    setSelected(null)
    onDayChange(i)
  }

  return (
    <section className="px-4">
      <DayChips days={itinerary.days} index={dayIndex} onChange={changeDay} />

      <div className="mt-3 h-[55dvh] overflow-hidden rounded-card border border-hairline bg-chip">
        {!API_KEY ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-content text-muted">
            지도 키가 설정되지 않았어요. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 확인해주세요.
          </p>
        ) : stops.length === 0 ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-content text-muted">
            이날은 지도에 표시할 장소가 없어요.
          </p>
        ) : (
          <APIProvider apiKey={API_KEY} language="ko" region="KR">
            <Map
              key={day.date}
              mapId={MAP_ID}
              defaultCenter={{ lat: stops[0].lat, lng: stops[0].lng }}
              defaultZoom={14}
              gestureHandling="greedy"
              disableDefaultUI
              clickableIcons={false}
              className="h-full w-full"
            >
              {stops.map((stop) => (
                <AdvancedMarker
                  key={stop.item.id}
                  position={{ lat: stop.lat, lng: stop.lng }}
                  title={stop.item.placeName}
                  onClick={() => setSelected(stop)}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface text-label font-bold text-surface"
                    style={{ backgroundColor: CATEGORY_PIN_COLOR[stop.item.category] }}
                  >
                    {stop.order}
                  </span>
                </AdvancedMarker>
              ))}
              <RouteLine stops={stops} />
              <FitBounds stops={stops} />
            </Map>
          </APIProvider>
        )}
      </div>

      {hidden > 0 && (
        <p className="mt-2 text-label text-muted">위치를 확인하지 못한 장소 {hidden}곳은 지도에 표시하지 않았어요.</p>
      )}

      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected?.item.placeName ?? ''}>
        {selected && (
          <div className="pb-2">
            <div className="flex items-center gap-2">
              <span className="text-content font-semibold text-ink">
                {selected.order}번째 · {selected.item.time}
              </span>
              <CategoryTag category={selected.item.category} />
            </div>
            <p className="mt-2 text-content text-body">{selected.item.description}</p>
            <p className="mt-1 text-label text-muted">
              {selected.item.estCostKrw > 0 ? `예상 ${formatKrw(selected.item.estCostKrw)}` : '무료'}
              {selected.item.place?.rating ? ` · 평점 ${selected.item.place.rating.toFixed(1)}` : ''}
            </p>
            {selected.item.place?.mapsUrl && (
              <a
                href={selected.item.place.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-11 items-center text-label font-semibold text-ink underline underline-offset-4"
              >
                Google 지도에서 길찾기
              </a>
            )}
          </div>
        )}
      </Sheet>
    </section>
  )
}
```

- [ ] **Step 3: `PlanView.tsx`에 지도 탭 연결**

import 추가:
```tsx
import { MapTab } from './MapTab'
```
교체:
```tsx
        {tab === 'map' && <p className="px-4 text-content text-muted">지도는 다음 작업에서 붙여요.</p>}
```
→
```tsx
        {tab === 'map' && <MapTab itinerary={itinerary} dayIndex={safeDay} onDayChange={setDayIndex} />}
```

- [ ] **Step 4: 화면 확인**

Run: `npm run dev` → MOCK으로 만든 계획의 지도 탭.
Expected (브라우저용 키가 있을 때): 오사카 주변에 카테고리 색 번호 핀, 방문 순서대로 먹색 선, 일차를 바꾸면 핀과 선이 바뀌고 화면 범위가 맞춰진다. 핀을 누르면 하단 시트. 키가 없으면 안내 문구.

- [ ] **Step 5: 린트·타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm run lint && npm run typecheck && git status --short`
`google` 전역 타입 오류가 나면 `npm i -D @types/google.maps`를 설치한다.

---

### Task 14: 수정 채팅

**Files:**
- Create: `src/features/plan/Revise.tsx`
- Modify: `src/features/plan/PlanView.tsx`

**Interfaces:**
- Consumes: `Itinerary`, `MessageDto` (Task 2), `apiFetch` (Task 3), `Sheet` (Task 10), `usePlan().setData`·`reload` (Task 12), `TAB_BAR_HEIGHT` (Task 12), `POST /api/plans/[id]/revise`
- Produces: `<Revise planId: string messages: MessageDto[] onRevised: (itinerary: Itinerary, newMessages: MessageDto[]) => void onFailed: () => void>`

- [ ] **Step 1: `src/features/plan/Revise.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Sheet } from '@/components/Sheet'
import { apiFetch } from '@/lib/api'
import type { Itinerary, MessageDto } from '@/lib/schema'

type ReviseResponse = { reply: string; itinerary: Itinerary; messages: MessageDto[] }

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <p
        className={`max-w-[85%] whitespace-pre-line rounded-card px-3 py-2 text-content ${
          role === 'user' ? 'bg-ink text-canvas' : 'border border-hairline bg-canvas text-body'
        }`}
      >
        {children}
      </p>
    </div>
  )
}

export function Revise({
  planId,
  messages,
  bottomOffset,
  onRevised,
  onFailed,
}: {
  planId: string
  messages: MessageDto[]
  bottomOffset: number
  onRevised: (itinerary: Itinerary, newMessages: MessageDto[]) => void
  onFailed: () => void
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const message = text.trim()
    if (!message || pending) return
    setOpen(true)
    setPending(message)
    setError(null)
    setText('')
    try {
      const res = await apiFetch<ReviseResponse>(`/api/plans/${planId}/revise`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      onRevised(res.itinerary, res.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : '일정을 고치지 못했어요.')
      onFailed()
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <form
        onSubmit={send}
        style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` }}
        className="fixed inset-x-0 z-20 mx-auto flex w-full max-w-[560px] items-center gap-2 bg-canvas px-4 py-2"
      >
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 shrink-0 rounded-card border border-hairline bg-surface px-3 text-label font-semibold text-body"
          >
            대화 {messages.length}
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="일정 수정 요청하기"
          enterKeyHint="send"
          disabled={pending !== null}
          className="min-h-11 min-w-0 flex-1 rounded-card border border-hairline bg-surface px-3 text-field text-ink placeholder:text-placeholder focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          aria-label="보내기"
          disabled={!text.trim() || pending !== null}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-content text-canvas disabled:opacity-30"
        >
          ↑
        </button>
      </form>

      <Sheet open={open} onClose={() => setOpen(false)} title="일정 수정">
        <div className="flex flex-col gap-2 pb-2">
          {messages.length === 0 && pending === null && (
            <p className="text-content text-muted">예: "둘째 날이 너무 빡빡해, 두 곳만 빼줘"</p>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role}>
              {m.content}
            </Bubble>
          ))}
          {pending !== null && (
            <>
              <Bubble role="user">{pending}</Bubble>
              <p className="text-label text-muted">일정을 고치고 있어요. 1분 정도 걸릴 수 있어요.</p>
            </>
          )}
          {error && (
            <p role="alert" className="text-content text-body">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 2: `PlanView.tsx`에 연결**

import 추가:
```tsx
import { Revise } from './Revise'
```
`usePlan` 구조 분해를 바꾼다:
```tsx
  const { data, error, reload } = usePlan(id)
```
→
```tsx
  const { data, error, reload, setData } = usePlan(id)
```
`<TabBar tab={tab} onChange={setTab} />` 바로 위에 추가:
```tsx
      {tab !== 'budget' && (
        <Revise
          planId={plan.id}
          messages={data.messages}
          bottomOffset={TAB_BAR_HEIGHT}
          onRevised={(next, newMessages) =>
            setData((d) =>
              d ? { plan: { ...d.plan, itinerary: next, title: next.title }, messages: [...d.messages, ...newMessages] } : d,
            )
          }
          onFailed={reload}
        />
      )}
```

- [ ] **Step 3: 화면 확인 (MOCK)**

Run: `npm run dev` → 결과 화면 일정 탭에서 "첫날 밤에 야경 추가해줘" 입력 후 보내기.
Expected: 시트가 열리고 보낸 문장과 "고치고 있어요" 문구 → 잠시 후 가이드 답변이 보이고, 시트를 닫으면 1일차 마지막에 "샘플 야경 명소"가 있다. 입력창 왼쪽에 "대화 2" 버튼. 예산 탭에서는 입력창이 숨는다. 입력창이 탭 바와 겹치지 않는다.

- [ ] **Step 4: 린트·타입 검사 후 변경 확인 (커밋 금지)**

Run: `npm run lint && npm run typecheck && git status --short`

---

### Task 15: 실제 API 연결 확인과 배포 준비

**Files:**
- Create: `README.md` (create-next-app 기본 README 교체)
- Modify: `.env.local` (사용자, 커밋되지 않음)

**Interfaces:**
- Consumes: 지금까지의 모든 태스크

- [ ] **Step 1: (사용자) 외부 키 준비**

사용자에게 요청한다:
1. **Anthropic**: console.anthropic.com → API Keys → 키 발급
2. **SerpApi**: serpapi.com 가입(무료 플랜 월 250회) → Dashboard의 API Key
3. Google 키는 Task 13 Step 1에서 준비함
4. `.env.local`의 `ANTHROPIC_API_KEY`, `SERPAPI_API_KEY`를 채우고 `MOCK_EXTERNAL=0`으로 바꿈

- [ ] **Step 2: 실제 API로 한 번 끝까지 실행**

Run: `npm run dev` → `/new`에서 상해 3박 4일, 꼭 가고 싶은 곳 "동방명주", "신천지"로 생성.
Expected:
- 1~2분 안에 `ready`. 실패하면 서버 터미널 로그를 보고 원인(키, 파라미터)을 고친다.
- 일정에 동방명주·신천지가 "내가 고른 곳"으로 들어가 있다.
- 지도에 핀이 실제 위치에 찍히고 "위치 미확인"이 적다.
- 예산 탭의 항공·숙소 가격이 SerpApi 결과와 같다.
- 수정 채팅 "둘째 날 저녁 식당을 바꿔줘" → 해당 항목만 바뀌고 나머지 장소의 핀 위치는 그대로다.
- 서버 로그에 SerpApi 호출이 계획 1개당 2회(항공 1, 호텔 1)인지 확인한다.

- [ ] **Step 3: `README.md` 작성**

```markdown
# travel-guide-app

모바일에서 여행 조건을 단계별로 입력하면 AI가 항공·숙소 실제 가격 후보와 일자별 일정, 총예산을 만들어주는 개인용 웹 앱.

- 설계: `docs/superpowers/specs/2026-11-25-travel-guide-app-design.md`
- 구현 계획: `docs/superpowers/plans/2026-11-25-travel-guide-app-mvp.md`

## 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Claude API (`claude-opus-5-5`) · SerpApi (Google Flights/Hotels) · Google Maps / Places API (New) · Supabase · Vercel

## 로컬 실행

1. `npm install`
2. `cp .env.example .env.local` 후 값 채우기 (각 항목 설명은 `.env.example`)
3. Supabase SQL Editor에서 `supabase/migrations/20261125000000_init.sql` 실행
4. `npm run dev` → http://localhost:3000

API 비용 없이 화면만 보려면 `.env.local`에서 `MOCK_EXTERNAL=1`.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | Vitest 단위 테스트 |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | ESLint |
| `npm run build` | 프로덕션 빌드 |

## 배포 (Vercel)

1. Vercel에서 GitHub 저장소 `travel-guide-app` 연결
2. Settings → Environment Variables에 `.env.example`의 모든 항목 등록 (`MOCK_EXTERNAL=0`)
3. Google Cloud에서 브라우저용 Maps 키의 웹사이트 제한에 Vercel 도메인 추가
4. 배포 후 휴대폰 브라우저로 접속 → 공유 → 홈 화면에 추가
```

- [ ] **Step 4: 최종 검증**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 모두 오류 없이 통과. 실패 항목이 있으면 고친 뒤 다시 실행한다.

- [ ] **Step 5: 변경 확인과 사용자 보고 (커밋 금지)**

Run: `git status --short`
사용자에게 변경 파일 목록, 테스트·빌드 결과, Step 2 실제 실행 결과를 보고한다. 커밋·푸시와 Vercel 배포는 **사용자가 지시할 때만** 진행한다(배포는 GitHub 푸시가 필요하므로 커밋 지시 이후).
