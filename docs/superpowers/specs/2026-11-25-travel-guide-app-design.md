# travel-guide-app 설계 (MVP)

- 작성일: 2026-11-25
- 상태: 사용자 검토 대기
- 시각 레퍼런스: [`assets/2026-11-25-visual-style-mockup.html`](assets/2026-11-25-visual-style-mockup.html) (폰트는 브레인스토밍 서버에서만 로드되므로 파일로 열면 기본 폰트로 보인다)

## 1. 목표

모바일에서 단계별로 여행 조건을 입력하면 AI가 **항공권·숙소 실제 가격 후보와 일자별 일정, 총예산**을 한 번에 정리해주는 개인용 웹 앱.

- 사용자는 1명(본인). 토큰·API 비용보다 결과 품질을 우선한다.
- 목적지는 사용자가 정한다. 그 안의 랜드마크·음식점·쇼핑 장소는 AI가 추천하고, 사용자가 꼭 가고 싶은 곳은 지정할 수 있다.
- 실제 예약은 하지 않는다. 가격은 조회 시점 시세이며, 예약은 링크로 외부 사이트에서 한다.

### 범위 밖 (MVP)

목적지 추천, 여러 사용자·회원가입, 실제 예약·결제, 다크 모드, 데스크톱 전용 레이아웃, 오프라인 모드, 일정 내보내기(PDF·캘린더), 에이전트형 생성(Claude가 도구를 스스로 호출하는 방식).

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js (App Router) + TypeScript, 패키지 매니저 npm |
| UI | Tailwind CSS v4, 모바일 우선(375px 기준), 최대 폭 560px |
| PWA | `manifest.json` + 아이콘으로 홈 화면 추가 지원 (서비스 워커·오프라인 없음) |
| AI | Claude API, 일정 생성·수정은 `claude-opus-5-5`, 공항 코드 추정은 `claude-haiku-5-5` |
| 가격 조회 | SerpApi `google_flights`, `google_hotels` 엔진 (무료 플랜 월 250회) |
| 지도·장소 | Google Maps JavaScript API(지도 표시) + Places API (New) Text Search(장소 검증) |
| DB | Supabase Postgres (서버에서만 secret key로 접근) |
| 배포 | Vercel |

## 3. 화면 구성

| 경로 | 화면 |
|---|---|
| `/login` | 비밀번호 입력 |
| `/` | 내 여행 계획 목록(최신순) + "새 여행 만들기" |
| `/new` | 단계별 위저드 |
| `/plans/[id]` | 결과: 하단 탭 **일정 / 지도 / 예산** + 일정·지도 탭 하단의 수정 채팅 입력창 |

### 3.1 위저드 단계

한 화면에 질문 하나, 상단 진행 점 표시, 하단 고정 "다음" 버튼. 입력값은 단계 이동 시 `sessionStorage`에 임시 저장해 새로고침에도 유지한다.

| # | 단계 | 입력 | 필수 |
|---|---|---|---|
| 1 | 목적지 | 도시·국가 자유 입력 | 필수 |
| 2 | 날짜 | 출발일, 귀국일 (최대 14일) | 필수 |
| 3 | 출발지·인원 | 출발 도시(기본 인천), 성인 수(1~9), 아동 수(0~8) | 필수 |
| 4 | 동행 | 혼자 / 연인 / 친구 / 가족 | 필수 |
| 5 | 여행 스타일 | 맛집, 관광명소, 쇼핑, 자연, 휴양, 야경, 액티비티, 문화·역사 중 복수 선택 | 1개 이상 |
| 6 | 꼭 가고 싶은 곳 | 장소 이름을 입력 후 엔터 → 칩으로 쌓임 (최대 10개) | 선택 |
| 7 | 강도·예산 | 강도: 여유 / 보통 / 빡빡 · 예산: 저렴 / 보통 / 여유 | 필수 |
| 8 | 교통수단 | 대중교통 / 렌터카 / 도보 위주 | 필수 |
| 9 | 항공편 | 모드 3가지: **가격 조회**(출발·도착 공항 코드 표시, 수정 가능) / **이미 예약함**(편명, 가는 편 도착 일시, 오는 편 출발 일시, 총액) / **항공 불필요** | 필수 |
| 10 | 숙소 | 모드 2가지: **가격 조회**(선호 지역 선택 입력) / **이미 예약함**(숙소명, 주소, 총액) | 필수 |
| 11 | 추가 요청 | 자유 입력 (최대 500자) | 선택 |
| 12 | 확인 | 입력 요약 → "일정 만들기" | — |

- 9단계의 공항 코드는 1·3단계 입력을 바탕으로 `claude-haiku-5-5`가 추정한 IATA 코드를 미리 채워두고(`POST /api/airports/guess`), 사용자가 고칠 수 있다.
- "이미 예약함" 또는 "항공 불필요"를 고른 항목은 SerpApi를 호출하지 않는다.

## 4. 디자인 시스템

gagyebu_2 저장소의 디자인 체계를 그대로 따른다: **종이 다이어리 감성의 미니멀** — 아이보리 배경, 그림자 대신 헤어라인 보더, 강조색 없이 먹색, 넉넉한 여백, 파스텔 태그. 라이트 모드 전용.

**금지:** 그림자, 그라디언트, 별도 강조색(코랄 등), 장식용 아이콘·이모지, 컴포넌트 안 임의 헥스 값. 색은 `src/app/globals.css`의 `@theme` 토큰만 쓴다.

### 4.1 토큰

| 역할 | 토큰 | 값 |
|---|---|---|
| 배경 | `canvas` | `#FDFBF7` |
| 카드·시트 표면 | `surface` | `#FFFDFA` |
| 보더(헤어라인) | `hairline` | `#ECE6DC` |
| 목록 내부 구분선 | `divider` | `#F2EEE6` |
| 제목·강조 텍스트, 주 버튼 배경 | `ink` | `#2B2A26` |
| 본문 텍스트 | `body` | `#48453E` |
| 보조 라벨 | `muted` | `#ABA391` |
| 플레이스홀더 | `placeholder` | `#C4BCA9` |
| 칩(미선택) | `chip` / `chip-fg` | `#F5F1EA` / `#8A8271` |

- 폰트: **Paperlogy** 400 / 600 / 700 (gagyebu_2의 `src/assets/fonts`에서 복사, `next/font/local`로 로드)
- 글자 크기: 제목 22px, 본문 15px, 라벨 11px(자간 0.14em, 대문자), 금액 32px, 입력 필드 16px(iOS 확대 방지)
- 모서리: 카드 10px, 시트 16px, 칩·버튼 999px(칩) / 10px(주 버튼)
- 터치 영역 최소 44px

### 4.2 장소 카테고리 색

일정 목록의 태그, 지도 핀, 예산 막대가 같은 색을 공유한다.

| 카테고리 | 배경 | 글자·핀 |
|---|---|---|
| 랜드마크 | `#E4E0F2` | `#5B4E8C` |
| 음식점 | `#FBE3D6` | `#B0664A` |
| 숙소 | `#EFE9DA` | `#8A7A4E` |
| 이동 | `#DDE7F2` | `#4A6E96` |
| 쇼핑 | `#F7DFE6` | `#A85273` |
| 자연 | `#DDEBE0` | `#4A7C5E` |

예산 항목 색: 항공 = 이동, 숙박 = 숙소, 식비 = 음식점, 현지 교통·기타 = 자연.

### 4.3 결과 화면 구성

- **일정 탭:** 상단 라벨(`OSAKA · 12.18 – 12.21`) + 제목 → 일차 칩(가로 스크롤) → 한 카드 안에 구분선으로 나뉜 항목 목록(시간 · 장소명 · 카테고리 태그). 항목을 누르면 설명, 예상 비용, 평점, Google 지도 링크가 펼쳐진다. 사용자가 지정한 장소(`mustVisit`)는 장소명 옆에 작은 `내가 고른 곳` 라벨을 붙인다. 일차별 `theme` 한 줄을 목록 위에 보여준다.
- **지도 탭:** 일차 칩으로 날짜를 고르면 그날 장소에 카테고리 색 번호 핀(방문 순서)을 찍고, 순서대로 `ink` 색 직선 폴리라인으로 잇는다. 핀을 누르면 하단 시트에 장소 정보. 지도 스타일은 채도를 낮춘 커스텀 스타일. `unverified` 장소는 지도에서 빠지고 목록에 "위치 미확인" 표시.
- **예산 탭:** 총액(32px) + 항목 비율 막대 → 항목 목록(항공 / 숙박 / 식비 / 현지 교통 / 기타) → 추천 항공편 카드, 추천 숙소 카드(각각 AI의 선택 이유 한 줄과 외부 링크), "다른 후보 보기"로 나머지 후보 펼치기.
- **수정 채팅:** 일정·지도 탭 하단에 입력창 고정. 보내면 시트가 열려 대화 기록과 진행 상태를 보여준다.
- **생성 중 화면:** 3단계 진행 표시(가격 조회 → 일정 작성 → 장소 확인)와 현재 단계 문구.

## 5. 아키텍처

### 5.1 폴더 구조

```
src/
  app/
    (auth)/login/page.tsx
    page.tsx                     ← 계획 목록
    new/page.tsx                 ← 위저드
    plans/[id]/page.tsx          ← 결과
    api/
      login/route.ts
      airports/guess/route.ts
      plans/route.ts             ← GET 목록, POST 생성
      plans/[id]/route.ts        ← GET 단건, DELETE
      plans/[id]/retry/route.ts
      plans/[id]/revise/route.ts
    globals.css                  ← @theme 토큰
  components/                    ← 공용 UI (Button, Chip, List, Sheet, TabBar, ProgressDots)
  features/
    wizard/                      ← 단계 컴포넌트, 입력 상태 훅
    plan/                        ← 일정·지도·예산 탭, 수정 채팅
  lib/
    schema.ts                    ← zod 스키마: 위저드 입력, 일정 JSON (클라이언트·서버 공용)
  server/                        ← 서버 전용 (import 'server-only')
    env.ts                       ← 환경변수 검증
    auth.ts                      ← 쿠키 서명·검증
    db.ts                        ← Supabase 클라이언트와 plans/plan_messages 함수
    claude.ts                    ← 일정 생성·수정·공항 추정 호출
    prompts.ts                   ← 시스템 프롬프트와 입력 직렬화
    serpapi.ts                   ← 항공·호텔 조회와 결과 정규화
    places.ts                    ← 장소 검증
    pipeline.ts                  ← 생성·수정 파이프라인 (위 모듈을 순서대로 호출)
middleware.ts                    ← 로그인 쿠키 확인
supabase/migrations/             ← SQL 마이그레이션
```

각 외부 서비스 모듈은 정규화된 결과 타입만 내보내고, `pipeline.ts`만 여러 모듈을 안다. 외부 응답 원본 형태는 각 모듈 밖으로 새지 않는다.

### 5.2 환경변수

| 이름 | 위치 | 용도 |
|---|---|---|
| `APP_PASSWORD` | 서버 | 로그인 비밀번호 |
| `SESSION_SECRET` | 서버 | 쿠키 서명용 32바이트 이상 임의 문자열 |
| `ANTHROPIC_API_KEY` | 서버 | Claude |
| `SERPAPI_API_KEY` | 서버 | SerpApi |
| `GOOGLE_PLACES_API_KEY` | 서버 | Places API (IP·API 제한) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 브라우저 | Maps JavaScript API (HTTP 리퍼러를 배포 도메인·localhost로 제한) |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | 브라우저 | Advanced Markers와 커스텀 스타일용 Map ID |
| `SUPABASE_URL` | 서버 | Supabase 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | 서버 | Supabase secret key |

## 6. 데이터 모델

마이그레이션: [`supabase/migrations/20261125000000_init.sql`](../../../supabase/migrations/20261125000000_init.sql)

### `plans`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | AI가 지은 제목 (생성 전 기본값 "새 여행") |
| `destination` | text | 목록 표시용 |
| `start_date` / `end_date` | date | |
| `status` | text | `generating` / `ready` / `failed` |
| `progress_step` | text | `offers` / `itinerary` / `places`, 생성 중일 때만 의미 |
| `input` | jsonb | 위저드 입력 원본 |
| `offers` | jsonb | 정규화된 항공·호텔 후보 (재시도 시 재사용) |
| `itinerary` | jsonb | 최종 일정 (아래 스키마) |
| `error` | text | 실패 사유 (사용자에게 보여줄 문장) |
| `created_at` / `updated_at` | timestamptz | `updated_at`은 트리거로 갱신 |

### `plan_messages`

수정 채팅 기록. `plan_id`(FK, cascade 삭제), `role`(`user`/`assistant`), `content`, `created_at`.

### 설계 판단: 일정을 JSONB 하나로 저장하는 이유

AI가 생성과 수정 때마다 일정 전체를 다시 쓴다. 일자·장소를 테이블로 쪼개면 수정마다 diff를 계산해 여러 행을 고쳐야 하지만, JSONB 하나면 통째로 교체하면 된다. 일정 내부를 조건으로 조회할 일도 없다.

### RLS

두 테이블 모두 RLS를 켜고 정책은 만들지 않는다. 서버만 secret key로 접근하므로 RLS를 우회하고, publishable key로 들어오는 직접 접근은 전부 막힌다.

### 6.1 일정 JSON 스키마 (`lib/schema.ts`의 zod 스키마가 기준)

> 아래는 개념 요약이다. 구현 계획에서 `flight`/`stay`는 `{ kind, offerId, reason }` 한 형태로 합쳤고 `kind`에 `unavailable`(후보 없음)을 더했으며, `budget.totalKrw`를 서버가 계산해 저장한다. 차이가 있으면 `src/lib/schema.ts`를 따른다.

```ts
type Itinerary = {
  title: string                       // 20자 이내
  summary: string                     // 2~3문장
  flight:
    | { kind: 'offer'; offerId: string; reason: string }
    | { kind: 'booked' }
    | { kind: 'none' }
  stay:
    | { kind: 'offer'; offerId: string; reason: string }
    | { kind: 'booked' }
  days: {
    date: string                      // YYYY-MM-DD, 여행 기간과 정확히 일치
    theme: string                     // 그날의 한 줄 요약
    items: {
      id: string                      // 서버가 부여 (수정 시 유지)
      time: string                    // HH:mm
      placeName: string               // 현지 검색에 쓸 이름
      category: '랜드마크' | '음식점' | '숙소' | '이동' | '쇼핑' | '자연'
      description: string
      estCostKrw: number              // 1인 기준이 아닌 일행 전체 기준
      mustVisit: boolean              // 사용자가 지정한 곳
      place?: {                       // 서버가 Places로 채움
        status: 'verified' | 'unverified'
        placeId?: string; lat?: number; lng?: number
        address?: string; rating?: number; mapsUrl?: string
      }
    }[]
  }[]
  budget: {                           // 모두 원화, 일행 전체 기준
    flightKrw: number                 // 서버가 선택한 offer 또는 예약 금액으로 덮어씀
    stayKrw: number                   // 위와 같음
    foodKrw: number
    localTransportKrw: number
    extraKrw: number
    notes: string
  }
}
```

`flightKrw`, `stayKrw`, 총액은 AI 값을 믿지 않고 서버가 실제 가격으로 계산한다.

## 7. 생성 파이프라인

### 7.1 새 계획 생성 — `POST /api/plans`

1. 입력을 zod로 검증하고 `plans`에 `status: generating`, `progress_step: offers`로 저장한다.
2. 즉시 `{ id }`를 응답하고, 남은 작업은 Next.js `after()`로 이어서 실행한다. 라우트 `maxDuration = 300`.
3. **가격 조회 (`offers`)** — 항공·호텔을 병렬 조회한다.
   - 항공: `google_flights`, 왕복(`type=1`), `departure_id`·`arrival_id`(IATA), 날짜, 성인·아동 수, `currency=KRW`, `hl=ko`. 상위 5개를 `{ offerId, airline, flightNumbers, depart, arrive, durationMin, stops, priceKrw, link }`로 정규화.
   - 호텔: `google_hotels`, `q = "{목적지} {선호 지역} 호텔"`, 체크인·아웃, 인원, `currency=KRW`, `hl=ko`. 예산 등급별로 정렬해(저렴: 총액 오름차순 / 보통: 평점 4.0 이상 중 총액 오름차순 / 여유: 평점 내림차순) 상위 8개를 `{ offerId, name, lat, lng, rating, totalPriceKrw, link }`로 정규화(SerpApi 응답에 지역명 필드가 일정하지 않아 `area`는 두지 않는다).
   - 한쪽이 실패하면 해당 후보를 빈 배열로 두고 계속 진행한다. 결과는 `offers`에 저장.
4. **일정 작성 (`itinerary`)** — `claude-opus-5-5` 호출 1회.
   - 시스템 프롬프트: 여행 가이드 역할, 동선 효율, 강도별 하루 장소 수(여유 3~4 / 보통 5~6 / 빡빡 7~8), 첫날·마지막 날은 항공 시각 기준으로 배치, 숙소를 매일 시작·끝점으로, 영업시간 상식 고려, 실존하는 장소만, `mustVisit` 장소는 반드시 포함.
   - 응답 형식은 **구조화 출력**(`output_config.format` + SDK의 `zodOutputFormat`, `client.messages.parse()`)으로 강제한다. `claude-opus-5-5`는 강제 `tool_choice`(`any`/`tool`)를 400으로 거부하므로 tool use 방식은 쓰지 않는다. AI 출력 스키마(`AiItinerarySchema`)는 저장 스키마와 별도이며 `src/lib/schema.ts`가 기준이다.
   - 거절(`refusal`)·잘림(`max_tokens`)·파싱 실패면 **같은 요청으로 1회 재시도**, 그래도 실패하면 `failed`.
   - 서버 후처리: 항목 `id` 부여, 날짜가 여행 기간과 일치하는지 확인, `offerId`가 실제 후보에 있는지 확인(없으면 최저가 후보로 대체), 항공·숙박 금액 덮어쓰기, `mustVisit` 장소 누락 시 `failed`가 아니라 마지막 날 자유시간에 추가.
5. **장소 확인 (`places`)** — 모든 항목을 Places Text Search(New)로 병렬 확인(동시 5개).
   - 질의 `"{placeName} {목적지}"`, 목적지 좌표 기준 50km location bias, 필드 마스크 `places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri`.
   - 첫 결과를 채택한다. 결과가 없거나 목적지에서 100km 넘게 떨어지면 `unverified`.
   - 목적지 좌표는 같은 API로 목적지 이름을 1회 검색해 얻는다.
6. `itinerary`, `title` 저장, `status: ready`.

어느 단계든 예외가 나면 `status: failed`, `error`에 사용자용 문장을 저장한다.

### 7.2 재시도 — `POST /api/plans/[id]/retry`

`failed` 상태에서만 가능. `offers`가 이미 있으면 가격 조회를 건너뛰고 4단계부터 다시 실행한다.

### 7.3 진행 상태 확인

결과 화면은 `status`가 `generating`인 동안 `GET /api/plans/[id]`를 2초마다 호출해 `progress_step`을 표시한다. `ready`나 `failed`가 되면 멈춘다.

### 7.4 수정 채팅 — `POST /api/plans/[id]/revise`

1. 사용자 메시지를 `plan_messages`에 저장한다.
2. `claude-opus-5-5`에 현재 `itinerary`, 위저드 입력, `offers`, 최근 대화 10개, 새 요청을 넘기고 구조화 출력(`AiRevisionSchema`)으로 **수정된 일정 전체**와 사용자에게 보여줄 짧은 답변(`reply`)을 받는다. 다른 항공·숙소 후보로 바꾸는 요청도 `offers` 안에서 처리한다.
3. 실패 시 1회 재시도. 후처리에서는 위저드의 `mustVisit` 목록으로 장소를 다시 채우지 않는다(사용자가 뺀 장소가 되살아나지 않도록). 지정 장소 보충은 4번 규칙만 맡는다.
4. **지정 장소 보호:** 기존 `mustVisit` 항목이 빠졌는데 사용자 메시지에 그 장소 이름과 삭제 의도("빼", "삭제", "제외", "안 갈")가 함께 없으면, 빠진 항목을 원래 날짜에 되살린다.
5. 기존 항목과 `placeName`이 같은 항목은 `id`와 `place`를 그대로 물려받고, **새 장소만** Places로 확인한다.
6. `itinerary` 저장, `reply`를 assistant 메시지로 저장 후 응답한다.

수정은 요청-응답 동기 방식이다(`maxDuration = 300`). 처리 중에는 입력창을 잠그고 시트에 진행 문구를 보여준다.

## 8. 로그인

- `POST /api/login`에 비밀번호를 보내고, `APP_PASSWORD`와 상수 시간 비교로 일치하면 `SESSION_SECRET`으로 HMAC 서명한 httpOnly·Secure·SameSite=Lax 쿠키를 30일 유효로 발급한다.
- `middleware.ts`가 `/login`, `/api/login`, 정적 파일을 뺀 모든 경로에서 쿠키를 확인한다. 페이지는 `/login`으로, API는 401로 보낸다.
- 비밀번호가 틀리면 1초 지연 후 401을 응답한다(무차별 대입 완화).

## 9. 에러 처리

| 상황 | 처리 |
|---|---|
| SerpApi 실패·한도 초과 | 해당 후보 없이 진행, 예산 탭에 "가격 정보를 가져오지 못했어요" 표시 |
| Claude 응답 형식 오류 | 1회 재시도 후 `failed` |
| Claude API 오류(과부하 등) | SDK 기본 재시도 후 `failed` |
| Places 결과 없음 | 해당 장소 `unverified`, 지도에서 제외 |
| Places API 오류 | 전부 `unverified`로 두고 `ready` 처리, 지도 탭에 안내 문구 |
| 생성 중 서버 함수 종료(시간 초과) | `generating`이 10분 넘게 갱신되지 않으면 `GET` 시 `failed`로 바꾸고 재시도 버튼 표시 |
| 입력 검증 실패 | 400, 위저드 해당 단계로 이동 |

화면의 모든 에러 문구는 한국어 한 문장 + "다시 시도" 버튼(gagyebu_2 패턴).

## 10. 테스트

- **Vitest 단위 테스트**는 외부 호출 없는 순수 로직에만 쓴다: 입력·일정 zod 스키마, SerpApi 응답 정규화(저장한 샘플 JSON 사용), 일정 후처리(금액 덮어쓰기, `offerId` 대체, 날짜 확인), 지정 장소 보호 규칙, 수정 시 `place` 물려받기.
- 외부 API(Claude, SerpApi, Places, Supabase)를 실제로 부르는 테스트는 만들지 않는다. 대신 개발 환경에서 `MOCK_EXTERNAL=1`이면 각 서버 모듈이 저장된 샘플 응답을 돌려줘서, API 비용 없이 화면 전체 흐름을 확인할 수 있다.
- E2E 테스트는 없다. 화면은 모바일 크기 브라우저에서 직접 확인한다.

## 11. 사전 준비 (사용자)

1. Supabase 새 프로젝트(Seoul 리전) 생성, Project URL과 secret key 확보, 마이그레이션 SQL 실행
2. Anthropic API 키 발급
3. SerpApi 가입(무료 플랜), API 키 확보
4. Google Cloud 프로젝트 생성, 결제 계정 연결, Maps JavaScript API와 Places API (New) 활성화, 키 2개(브라우저용·서버용) 발급 및 제한 설정, Map ID 생성
5. Vercel에 저장소 연결, 환경변수 등록
