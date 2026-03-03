# 채널톡 ↔ 세일즈맵 연동기 PRD

> 최종 수정: 2026-03-03

## 목적

채널톡 상담 종료 시 대화 내용을 세일즈맵 CRM에 자동 기록.
AI 요약 + 원본 대화를 구조화된 데이터로 저장하여 고객 히스토리 추적.

---

## 아키텍처

```
Vercel Cron (5분 간격)
  → 채널톡 API: 종료된 상담 감지 (폴링)
  → 채널톡 API: 메시지 전체 조회 (텍스트 + 이미지)
  → Gemini AI: 대화 요약 + 분류 (1회 호출)
  → 세일즈맵 API: 고객 매칭/생성 + 채널톡 커오 생성 + 고객 노트 생성
  → Supabase: 처리 완료 기록 (중복 방지)
```

---

## 데이터 플로우

### 1. 종료 상담 감지

```
GET /open/v5/user-chats?state=closed&sortOrder=desc
→ Supabase processed_chats에서 이미 처리한 건 제외
→ 새로 종료된 건만 처리
```

### 2. 고객 매칭/생성

```
채널톡 user.profile.email
  → GET /v2/people-temp/{email} 로 세일즈맵 고객 검색
    ├── 있음 → peopleId 확보
    └── 없음 → POST /v2/people 생성 → peopleId 확보

고객 필드 업데이트 (POST /v2/people/{id}):
  - 워크스페이스 ID = profile.salesmap_room_Id
  - 유저 ID = profile.salesmap_user_Id
  - 계정 ID = profile.salesmap_account_Id
  - 워크스페이스 (관계 필드) = workspaceRecordId
  - 채널톡 자동 생성 = true (신규 생성 시만)
```

### 3. 워크스페이스 매칭

```
Supabase workspace_map (record_id, workspace_id)
  - 초기: GET /v2/custom-object 전체 순회 → definitionId 필터 → 맵 구축
  - profile.salesmap_room_Id로 맵 조회
    ├── 있음 → recordId 확보
    └── 없음 → 맵 전체 갱신 → 재조회
```

### 4. 채널톡 커스텀 오브젝트 생성

```
POST /v2/custom-object
Body: {
  customObjectDefinitionId: "019cb198-7afc-7aac-b557-e1fce57a0946",
  fieldList: [
    // AI 요약
    { name: "문의 내용", stringValue: "Gemini 요약 (공백 제외 30자 이내)" },

    // 분류 (multiSelect → stringValueList)
    { name: "문의 유형", stringValueList: ["사용법 문의"] },
    { name: "기능 카테고리", stringValueList: ["노트"] },

    // 메타데이터
    { name: "생성 날짜", dateValue: closedAt },
    { name: "담당자", userValueId: "매칭된 세일즈맵 userId" },

    // 관계 연결
    { name: "문의자", peopleValueIdList: [peopleId] },
    { name: "워크스페이스", customObjectValueIdList: [workspaceRecordId] },

    // 채널톡 프로필 정보 (이중 저장)
    { name: "워크스페이스 ID", stringValue: profile.salesmap_room_Id },
    { name: "유저 ID", stringValue: profile.salesmap_user_Id },
    { name: "계정 ID", stringValue: profile.salesmap_account_Id },
  ]
}
```

### 5. 노트 생성 (고객에 생성 → 채널톡 커오로 자동 전파)

```
POST /v2/people/{peopleId}
Body: {
  memo: "<HTML 형식: 요약 + 카톡 스타일 대화 원문>"
}
```

노트 구조:
- 채널톡 문의 내용 / 답변 내용 / 후속 조치 (볼드 처리)
- 구분선
- 대화 원문 (카톡 스타일 말풍선: 고객=왼쪽 회색, 상담사=오른쪽 파란색)
- 이미지는 cf.channel.io 프라이빗 링크로 포함 (로그인 사용자만 접근 가능)

**회사 관계는 의도적으로 미사용** (중복 관리 문제). 고객 노트 전파 로직으로 관련 회사, 리드, 딜, 온보딩, 채널톡에 자동 전파.

### 6. 담당자 매칭

```
초기 세팅: GET /v2/user → Supabase user_map (name, userId)
채널톡 chat.assigneeId → managers에서 이름 확인
→ user_map에서 이름으로 userId 매칭
→ 채널톡.담당자 필드에 userValueId로 설정
```

---

## 대화 원문 포맷

```
고객: 이재융
담당자: 박예빈

---

이재융: 03-02 17:20
안녕하세요, 문의 드립니다.

박예빈: 03-02 17:21
네, 안녕하세요!
```

- 헤더: 고객/담당자 목록
- 본문: 화자변경 시 이름 + KST 타임스탬프, 같은 화자 연속 메시지는 합침
- bot 메시지 제외

---

## 기능 카테고리 옵션 (35개)

```
노트, 검색, 다국어, 데이터 업로드, 데이터 필드 관리,
레이아웃, 목록/파이프라인, 마케팅 이메일, 문서, 미리보기,
미팅, 병합, 뷰(필터/정렬/컬럼), 사용자 관리, 상세 페이지,
상품/견적서, 시퀀스, 알림, 에디터, 연동,
워크플로우, 웹 폼, 이메일, 차트/대시보드,
커스텀 오브젝트, AI, UX/UI, API/웹훅, TODO/캘린더,
타임라인/히스토리, SMS/알림톡, 권한, 기타, 그룹, 모바일
```

## 문의 유형 옵션 (3개)

사용법 문의, 기능 요청, 버그 제보

---

## Supabase 스토어

| 테이블 | 내용 |
|------|------|
| processed_chats | 처리 완료 상담 기록 (user_chat_id, closed_at, salesmap_record_id) |
| workspace_map | 워크스페이스 ID ↔ 세일즈맵 recordId 매핑 |
| user_map | 세일즈맵 사용자 name ↔ userId 매핑 |

---

## Gemini 프롬프트 설계

1회 호출로 요약 + 분류 동시 처리. 모델: gemini-2.5-flash

```json
{
  "shortSummary": "공백 제외 30자 이내 핵심 요약",
  "detailedSummary": "[채널톡 문의 내용]\n...\n\n[답변 내용]\n...\n\n[후속 조치]\n...",
  "inquiryType": "사용법 문의|기능 요청|버그 제보",
  "featureCategory": "기능 카테고리 35개 중 택1"
}
```

JSON 파싱 안전장치:
- 코드블록 제거, JSON 추출
- 리터럴 줄바꿈 → escape 처리 (상태 기반 파서)
- 잘린 JSON 복구 (열린 문자열/객체 닫기)
- 유효성 검증: 옵션에 없으면 기본값

---

## 기술 스택

- Runtime: Vercel Serverless (Node.js / TypeScript)
- Cron: Vercel Cron Jobs (5분 간격)
- Store: Supabase (PostgreSQL)
- AI: Gemini 2.5 Flash API (Prod)
- APIs: 채널톡 Open API v5, 세일즈맵 REST API v2

---

## 현재 상태

- [x] 프로젝트 초기 세팅
- [x] API 클라이언트 (channel-talk.ts, salesmap.ts, gemini.ts)
- [x] 메시지 포맷터 + 카톡 스타일 HTML (formatter.ts)
- [x] 메인 동기화 로직 (sync.ts)
- [x] Supabase 스토어 (store.ts, supabase.ts)
- [x] Vercel Cron 라우트 (/api/cron/sync-chats, 5분 간격)
- [x] 고객 ↔ 채널톡 ↔ 워크스페이스 관계 자동 연결
- [x] 이미지 링크 포함 (cf.channel.io 프라이빗 URL)
- [x] 벌크 import 스크립트 (bulk-import.ts)
- [x] 1년치 벌크 import 실행 중
- [ ] Vercel 배포 (env 설정 + CRON_SECRET)
