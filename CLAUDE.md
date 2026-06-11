# Claude Code 킥오프 프롬프트
# 유통기한 재고 관리 앱 — Phase 1 MVP

---

## 진행 상태 (세션 시작 시 반드시 확인)

| Step | 내용 | 상태 |
|------|------|------|
| Step 1 | 프로젝트 셋업 (Next.js, Tailwind, Capacitor, Supabase) | ✅ 완료 |
| Step 2 | 온보딩 플로우 (익명 인증, 파티 설정) | ✅ 완료 |
| Step 3 | 홈 화면 (재고 리스트, 필터, 스와이프, empty state) | ✅ 완료 |
| Step 4 | 직접 입력 등록 | ✅ 완료 |
| Step 5 | 재고 상세 / 수정 | ✅ 완료 |
| Step 6 | 사진 AI 등록 | ✅ 완료 |
| Step 7 | 바코드 스캔 | ✅ 완료 |
| Step 8 | 푸시 알림 | ✅ 완료 |
| Step 9 | 요리 추천 | 🔲 미완료 |
| Step 10 | 마이 탭 / 대시보드 | 🔲 미완료 |

---

## 역할 및 목표
너는 이 앱의 풀스택 개발자다. 아래 PRD와 디자인 시스템을 완전히 숙지하고, 모든 결정은 이 문서를 기준으로 한다. 임의로 스택을 변경하거나 기능을 추가/축소하지 말고, 불명확한 부분은 반드시 먼저 질문하라.

---

## 기술 스택 (변경 금지)
- **Frontend**: Next.js 14 (output: 'export' 정적 빌드 필수), React, JavaScript (TypeScript 사용 안 함)
- **앱 전환**: Capacitor v6 (iOS + Android)
- **Backend/DB**: Supabase (PostgreSQL + Storage + Edge Functions + 익명 인증)
- **AI**: Anthropic Claude API — claude-sonnet-4-20250514 (사진 분석, OCR, 요리 추천 통합)
- **바코드**: 식품안전나라 바코드연계제품정보 공공 API
- **푸시 알림**: Capacitor Push Notifications + FCM
- **인증**: Supabase 익명 인증 → 카카오 OAuth 승계
- **광고**: AdMob (보상형 + 네이티브) — Phase 1 후반에 붙임
- **패키지 매니저**: npm

Next.js `output: 'export'` 이므로 API Routes, SSR, Image Optimization 사용 불가. 모든 서버 로직은 Supabase Edge Functions으로 처리한다.

---

## 디자인 시스템 (보맵 UI 패턴 기반)

### 핵심 원칙
보맵(보험 앱) UI의 레이아웃 패턴을 이 앱에 적용한다. 보맵의 특징:
- 군더더기 없는 흰 배경 위에 명확한 정보 계층
- 색상을 최소화하고 포인트 컬러 한 가지만 액션에 사용
- 카드 단위로 정보를 묶되 그림자는 거의 없음
- 수치/상태를 텍스트+컬러칩 조합으로 표현

### 컬러 토큰 (tailwind.config.js에 등록됨)
```js
colors: {
  primary: '#1D6AE5',
  secondary: '#0EA5A0',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  border: '#E8ECF2',
  text: '#1A1A2E',
  subtext: '#8A94A6',
  disabled: '#C8CDD6',
}
```

### 타이포그래피
- 폰트: `Pretendard` (한국어 최적화)
- 제목: `18px, font-weight: 600, color: text`
- 본문: `15px, font-weight: 400, color: text`
- 보조: `13px, font-weight: 400, color: subtext`
- 레이블/뱃지: `12px, font-weight: 500`

### 여백 시스템
- 수평 패딩: `px-5` (20px) 고정
- 섹션 간 간격: `gap-6` (24px)
- 카드 내부 패딩: `p-4` (16px)
- 리스트 아이템 수직 패딩: `py-3` (12px)
- 하단 탭바 높이: 56px + safe area inset

### 컴포넌트 규칙

**헤더**: 높이 52px, 좌측 뒤로가기(44×44px) + 중앙 제목 + 우측 액션 (선택)

**버튼**
- Primary: `bg-primary text-white rounded-xl h-[52px] w-full text-[15px] font-semibold`
- Secondary: `bg-bg text-text rounded-xl h-[52px] w-full`
- 비활성: `bg-disabled text-white`

**입력 필드**: `bg-bg border border-border rounded-xl h-[52px] px-4`
- 포커스: `border-primary`
- 에러: `border-danger` + 하단 `text-[12px] text-danger`
- 레이블: 필드 위 `text-[13px] text-subtext mb-1`

**리스트 아이템**: 최소 64px, 좌측 카테고리 아이콘(40×40) + 중앙 텍스트 + 우측 D-day 뱃지

**D-day 뱃지**
- D-8+: `bg-bg text-subtext`
- D-3~7: `bg-[#FEF3C7] text-warning`
- D-1~2: `bg-[#FEE2E2] text-danger`
- D-day/초과: `bg-danger text-white`

**필터 칩**
- 기본: `bg-bg text-subtext rounded-full px-3 py-1.5 text-[13px]`
- 선택: `bg-primary text-white rounded-full px-3 py-1.5 text-[13px] font-medium`

**바텀 시트**: `rounded-t-3xl`, 상단 핸들 `w-10 h-1 bg-border`, 뒤 오버레이 `bg-black/40`

**토스트**: `bg-[#1A1A2E] text-white rounded-xl px-4 py-3 text-[14px]`, 2초 자동 사라짐

**스켈레톤**: `bg-bg animate-pulse rounded-xl` — 스피너 사용 금지

---

## 화면 구조 및 라우팅
```
/ (홈)
/item?id=[id] (재고 상세)
/item/edit?id=[id] (재고 수정)
/register (등록 — 바텀시트)
/register/photo (사진 AI 등록)
/register/barcode (바코드 스캔)
/register/manual (직접 입력)
/register/confirm (AI 인식 결과 확인)
/shopping (장보기 탭)
/recipe (요리 탭)
/my (마이 탭)
/my/party (파티 관리)
/my/settings (알림 설정)
/onboarding (첫 실행)
/onboarding/permissions
/onboarding/notifications
/onboarding/party
```

---

## 기한 상태머신
```js
function calcEffectiveExpiry(item, catalog) {
  // 1. 라벨 기한 or 카탈로그 기본값
  // 2. 개봉한 경우 → min(라벨기한, 개봉일+opened_days)
  // 3. 냉동 중인 경우 → 냉동일+frozen_days (다른 날짜 무시)
  // → lib/calcExpiry.js 참고
}
```
클라이언트 계산: `lib/calcExpiry.js`
서버 계산: `supabase/functions/calc-expiry/index.js`

---

## Supabase 설정
- 환경변수: `.env.local` — 절대 코드에 하드코딩 금지
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` — Edge Function 전용, 프론트 노출 금지
- 익명 인증: Supabase Dashboard → Authentication → Anonymous 활성화
- Storage 버킷: `scans` (사진 업로드)

---

## DB 스키마 요약
- `parties`: 가구 그룹 (id, name, invite_code, created_by)
- `profiles`: 사용자 (id=auth.uid, party_id, onboarding_done, notification_*)
- `items`: 재고 (id, party_id, name, category, storage_type, quantity, unit, label_expiry_date, purchase_date, is_opened, opened_at, is_frozen, frozen_at, effective_expiry_date, expiry_is_estimated, catalog_id, status, memo, image_url)
- `food_catalog`: 식품 카탈로그 (id, name, aliases, category, shelf_days, opened_days, frozen_days, default_unit)

---

## Phase 1 개발 순서
```
Step 1: 프로젝트 셋업 ✅
Step 2: 온보딩 ✅
Step 3: 홈 화면 ✅
Step 4: 직접 입력 등록 ✅
  - food_catalog 테이블 (003_food_catalog.sql)
  - lib/calcExpiry.js (유효기한 계산)
  - supabase/functions/calc-expiry/index.js
  - app/register/manual/page.js
Step 5: 재고 상세 / 수정 ✅
  - app/item/page.js (상세 화면)
  - app/item/edit/page.js (수정 + 삭제)
Step 6: 사진 AI 등록 ✅
  - supabase/migrations/004_scans_schema.sql
  - supabase/functions/analyze-photo/index.ts (Claude Vision API, 배포 완료)
  - app/register/photo/page.js (촬영/갤러리 선택 + 업로드)
  - app/register/confirm/page.js (결과 확인 + 일괄 등록)
Step 7: 바코드 스캔 ✅
  - supabase/functions/barcode-lookup/index.ts (식품안전나라 C005 API — FOOD_SAFETY_API_KEY 시크릿 필요, 배포 필요)
  - app/register/barcode/page.js (네이티브 ML Kit + 웹 BarcodeDetector + 수동 입력 폴백)
  - app/register/manual/page.js (sessionStorage 'register_prefill' 프리필 지원)
Step 8: 푸시 알림 ✅
  - supabase/migrations/005_push_tokens.sql (push_token 컬럼 + notification_logs + pg_cron 가이드)
  - lib/push.js + components/PushManager.js (FCM 토큰 등록, 네이티브 전용)
  - supabase/functions/send-expiry-notifications/index.ts (FCM v1, FCM_SERVICE_ACCOUNT 시크릿 필요, 30분 주기 cron)
  - app/my/settings/page.js (알림 설정)
Step 9: 요리 추천 🔲
Step 10: 마이 탭 / 대시보드 🔲
```

---

## 코드 품질 규칙
- 컴포넌트: `/components`, 페이지: `/app` (App Router)
- Supabase 호출: `/lib/supabase.js` 에서만
- Edge Function: `/supabase/functions/`
- 모든 Supabase 쿼리에 에러 핸들링 필수
- 로딩 상태: 스켈레톤으로 처리 (스피너 사용 금지)
- ANTHROPIC_API_KEY 프론트엔드 코드 노출 절대 금지

---

## 광고 규칙
- 금지: `/register/*`, 알림 랜딩, `/shopping`
- 허용: 홈 리스트 하단, 마이 탭 하단, 요리 추천 추가 사용 시
