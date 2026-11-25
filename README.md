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
