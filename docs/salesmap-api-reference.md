# 세일즈맵 API 레퍼런스

> AI 에이전트가 세일즈맵 CRM API를 사용하고, 유저에게 비즈니스 컨설팅까지 제공하기 위한 통합 레퍼런스.
> **2026-02-27 실제 API 호출로 전면 검증 완료.**

---

## 비즈니스 개념 가이드

세일즈맵은 B2B 영업 CRM이다. AI 에이전트가 유저의 요청을 이해하고 적절한 API를 선택하려면 각 개념의 비즈니스 맥락을 알아야 한다.

### 핵심 오브젝트

| 오브젝트 | 비즈니스 의미 | 영업 흐름에서의 역할 |
|---------|-------------|-------------------|
| **고객 (People)** | 실제 사람. 영업 대상 담당자. | 모든 영업의 시작점. 이메일/전화로 연락하는 대상 |
| **회사 (Organization)** | 고객이 소속된 기업. | B2B에서 실제 계약 주체. 고객 여러 명이 한 회사에 속함 |
| **리드 (Lead)** | 아직 검증되지 않은 잠재 기회. | "이 고객이 관심 있을 수도?" 단계. 확인 후 딜로 전환 |
| **딜 (Deal)** | 검증된 영업 기회. 매출과 직결. | "실제로 계약 가능성 있음" 단계. 파이프라인으로 진행 추적 |
| **파이프라인 (Pipeline)** | 딜/리드의 진행 단계 흐름. | 영업 프로세스를 시각화. 예: 초기접촉→니즈파악→제안→협상→성사/실패 |
| **견적서 (Quote)** | 딜/리드에 연결된 가격 제안서. | 고객에게 보내는 공식 가격표. 상품×수량×할인 |
| **상품 (Product)** | 판매하는 제품/서비스. | 견적서에 포함되는 단위. 일반/구독(월간·연간) |
| **시퀀스 (Sequence)** | 자동화된 이메일 캠페인. | 고객에게 단계별로 이메일을 자동 발송. 오픈/클릭/회신 추적 |
| **TODO** | 영업 담당자의 할 일. | 전화, 미팅, 업무 등 follow-up 관리 |
| **메모 (Memo)** | 고객/딜 등에 남기는 내부 기록. | 미팅 노트, 상담 내용 등 팀 공유 |
| **웹 폼 (WebForm)** | 외부 리드 수집 폼. | 웹사이트에 삽입하여 문의/신청 자동 수집 |
| **커스텀 오브젝트** | 워크스페이스별 맞춤 데이터. | 계약, 프로젝트 등 기본 오브젝트로 안 되는 것 |

### 영업 흐름 예시

```
웹폼 제출 → 고객+회사 자동생성 → 리드 생성 → 시퀀스 등록(자동 이메일)
→ 응답 오면 딜로 전환 → 파이프라인 단계별 진행 → 견적서 발송 → 성사/실패
```

### 히스토리 vs 액티비티

| | 히스토리 (History) | 액티비티 (Activity) |
|---|---|---|
| **기록 대상** | 필드 값 변경 내역 | 이벤트/활동 타임라인 |
| **용도** | "이 고객 이름이 언제 바뀌었지?" "담당자가 누구에서 누구로?" | "이 고객에게 이메일 보낸 적 있나?" "최근 활동이 뭐야?" |
| **컨설팅 활용** | 데이터 변경 추적, 감사(audit) | 고객 engagement 분석, 영업 활동량 파악 |
| **핵심 필드** | `fieldName`, `fieldValue` (무엇이 어떤 값으로) | `type` (어떤 활동), 관련 리소스 ID |

### 시퀀스의 비즈니스 의미

시퀀스는 **영업 자동화의 핵심**이다:
- **목적**: 잠재 고객에게 시간차를 두고 이메일을 자동 발송하여 응답률을 높임
- **구조**: 여러 단계(step)로 구성. 각 단계는 이메일 발송 또는 TODO 생성
- **추적**: 이메일 오픈, 링크 클릭, 회신을 자동 추적
- **비즈니스 판단 기준**:
  - 오픈율 높지만 클릭 없음 → 제목은 좋지만 본문/CTA 개선 필요
  - 클릭은 있지만 회신 없음 → 관심은 있으나 행동 유도 부족
  - 회신 있음 → 즉시 개인화된 follow-up 필요
- **예시**: "콜드 메일 시퀀스" = 3일차 첫 메일 → 6일차 후속 메일 → 7일차 전화 TODO 자동 생성

---

## 기본 설정

```
Base URL: https://salesmap.kr/api
API Version: v2
Authentication: Bearer <token> (Authorization 헤더)
Content-Type: application/json
Rate Limit: 100 요청 / 10초 (워크스페이스 단위)
Rate Limit 초과 시: HTTP 429 { "success": false, "message": "Too Many Requests" }
권장 요청 간격: 0.1~0.15초
```

### 응답 구조 공통 패턴
- 목록 조회 응답의 각 항목은 `id` + **한글 필드명이 직접 속성으로** 반환된다.
- 관계형 필드는 `{"id": "uuid", "name": "이름"}` 객체 또는 배열로 반환.
- `RecordId`는 `id`와 동일한 값.
- 페이지네이션: `nextCursor`가 `null`이면 마지막 페이지. 페이지당 50건.
- **단일 조회(`GET /v2/{resource}/{id}`)의 응답은 모두 배열로 래핑된다:**
  - `data.people[0]`, `data.deal[0]`, `data.organization[0]`, `data.lead[0]`
  - 단일 ID 조회이지만 배열 `[{...}]` 형태. 반드시 `[0]`으로 접근.

---

## fieldList 데이터 필드 유형 (검증됨)

모든 생성/수정 API에서 `fieldList` 배열로 커스텀 필드 값을 지정한다.
**필드 이름은 세일즈맵 워크스페이스의 한글 이름과 정확히 일치해야 한다.**
**선택형 필드의 값도 세일즈맵에 등록된 옵션과 정확히 일치해야 한다.** 미등록 값 입력 시 에러:
```json
{ "success": false, "message": "Bad Request", "reason": "people 유입경로에 정의 되지 않은 값을 입력했습니다." }
```

### 기본 유형

| 유형 | value 키 | 검증된 요청 예시 | 실제 응답 값 |
|------|---------|-----------------|-------------|
| 텍스트 | `stringValue` | `{ "name": "이메일", "stringValue": "test@test.com" }` | `"이메일": "test@test.com"` |
| 숫자 | `numberValue` | `{ "name": "인센티브", "numberValue": 50000 }` | `"인센티브": 50000` |
| True/False | `booleanValue` | `{ "name": "구글 폼 제출", "booleanValue": true }` | `"구글 폼 제출": true` |
| 날짜 | `dateValue` | `{ "name": "생년월일", "dateValue": "1990-05-15" }` | `"생년월일": "1990-05-14T15:00:00.000Z"` |
| 날짜(시간) | `dateValue` | `{ "name": "날짜시간", "dateValue": "2026-02-27T10:30:00.000Z" }` | `"날짜시간": "2026-02-27T10:30:00.000Z"` |
| 단일 선택 | `stringValue` | `{ "name": "유입경로", "stringValue": "블로그" }` | `"유입경로": "블로그"` |
| 복수 선택 | `stringValueList` | `{ "name": "복수 선택", "stringValueList": ["1", "2"] }` | `"복수 선택": ["1", "2"]` |

**날짜 주의:** `dateValue`에 날짜만 (`"1990-05-15"`) 보내면 KST→UTC 변환되어 `-9시간` 조정된 값으로 저장됨.

### 관계 유형

| 유형 | value 키 | 검증된 요청 예시 | 실제 응답 값 |
|------|---------|-----------------|-------------|
| 사용자(단일) | `userValueId` | `{ "name": "AAA", "userValueId": "<userId>" }` | `"AAA": {"id": "dac27c65-...", "name": "세일즈맵 관리자"}` |
| 회사(복수) | `organizationValueIdList` | `{ "name": "자회사", "organizationValueIdList": ["<orgId>"] }` | `"자회사": [{"id": "0193f1aa-...", "name": "캐치톡"}]` |
| 고객(복수) | `peopleValueIdList` | `{ "name": "고객 - 1", "peopleValueIdList": ["<id>"] }` | `"고객 - 1": [{"id": "019c9d9c-...", "name": "관계필드테스트"}]` |
| 회사(단일) | `organizationValueId` | `{ "name": "거래처", "organizationValueId": "<orgId>" }` | `"거래처": {"id": "...", "name": "회사명"}` |
| 고객(단일) | `peopleValueId` | `{ "name": "담당자", "peopleValueId": "<id>" }` | `"담당자": {"id": "...", "name": "이름"}` |
| 사용자(복수) | `userValueIdList` | `{ "name": "참여자", "userValueIdList": ["<id>"] }` | `"참여자": [{"id": "...", "name": "이름"}]` |
| 파이프라인 | `pipelineValueId` | `{ "name": "파이프라인", "pipelineValueId": "<id>" }` | `"파이프라인": {"id": "...", "name": "이름"}` |
| 파이프라인 단계 | `pipelineStageValueId` | `{ "name": "단계", "pipelineStageValueId": "<id>" }` | `"파이프라인 단계": {"id": "...", "name": "단계명"}` |
| 웹 폼(단일) | `webformValueId` | `{ "name": "웹폼", "webformValueId": "<id>" }` | `"웹폼": {"id": "...", "name": "이름"}` |
| 딜(복수) | `dealValueIdList` | `{ "name": "딜 목록", "dealValueIdList": ["<id>"] }` | `"딜 목록": [{"id": "...", "name": "딜명"}]` |
| 시퀀스(단일) | `sequenceValueId` | `{ "name": "시퀀스", "sequenceValueId": "<id>" }` | `"시퀀스": {"id": "...", "name": "이름"}` |
| 시퀀스(복수) | `sequenceValueIdList` | `{ "name": "시퀀스 목록", "sequenceValueIdList": ["<id>"] }` | `"시퀀스 목록": [{"id": "...", "name": "이름"}]` |

### fieldList 주의사항
- **딜 `금액`은 fieldList가 아닌 top-level `price` 파라미터로 전달.** fieldList에 넣으면 에러: `"금액 값은 fieldList이 아닌 파라메터 입니다."`
- 파이프라인/파이프라인 단계는 딜/리드 생성 시 별도 body 파라미터(`pipelineId`, `pipelineStageId`)로도 지정 가능.

---

## 엔드포인트

### 회사 (Organization)

> 비즈니스: B2B 영업의 거래 대상 기업. 고객(담당자)의 상위 개념. 같은 회사에 여러 고객이 속할 수 있다.

#### 목록 조회
```
GET /v2/organization
Query: cursor
```
실제 응답 예시:
```json
{
  "id": "0193f1bb-faec-7aab-943b-0d7c4f171715",
  "RecordId": "0193f1bb-faec-7aab-943b-0d7c4f171715",
  "이름": "세일즈맵",
  "주소": "서울시 강남구",
  "직원수": 111,
  "담당자": {"id": "0a538c60-...", "name": "양시열"},
  "팀": [{"id": "cfc82536-...", "name": "팀테스트"}],
  "딜 개수": 74,
  "리드 개수": 40,
  "진행중 딜 개수": 29,
  "성사된 딜 개수": 28,
  "실패된 딜 개수": 17,
  "총 매출": 728791000,
  "최근 작성된 노트": "ㅇㅇㅇㅇㅇㅇ",
  "최근 노트 작성일": "2026-02-27T01:27:00.000Z",
  "최근 노트 작성자": {"id": "864640bf-...", "name": "예빈_어글리브레드"},
  "최근 제출된 웹폼": {"id": "2a5f3312-...", "name": "회사 모달 테스트"},
  "최근 웹폼 제출 날짜": "2025-09-19T01:44:00.000Z",
  "최근 딜 성사 날짜": "2026-02-19T04:15:00.000Z",
  "최근 성사된 딜 금액": 1000000,
  "제출된 웹폼 목록": [{"id": "...", "name": "문의하기2 (복사)"}],
  "생성 날짜": "2024-12-23T04:17:00.000Z",
  "수정 날짜": "2026-02-19T04:44:00.000Z"
  // + 워크스페이스 커스텀 필드들 (null인 것 포함)
}
```

#### 생성
```
POST /v2/organization
Body: { name (required), memo?, fieldList? }
Response 201: { success: true, data: { organization: { id, name, createdAt } } }
```
실제 응답:
```json
{"success": true, "data": {"organization": {"id": "019c9d9c-eadd-...", "name": "API검증회사", "createdAt": "2026-02-27T05:40:32.605Z"}}}
```

**중복 이름 에러:** (기존 회사 재활용 가능)
```json
{"success": false, "message": "Bad Request", "reason": "중복되는 이름을 가진 기업이 존재합니다.", "data": {"id": "<기존orgId>", "name": "회사명"}}
```

#### 단일 조회
```
GET /v2/organization/<organizationId>
Response 200: { success: true, data: { organization: [ {...} ] } }
```
배열 래핑 — `response.data.organization[0]`으로 접근.

#### 수정
```
POST /v2/organization/<organizationId>
Body: { name?, memo?, fieldList? }
Response 201: { success: true, data: { organization: { id, name, updatedAt } } }
```

#### 삭제
```
POST /v2/organization/delete
Body: 미확인 (개발팀 문의 필요)
```
`POST /v2/organization/delete`로 라우트 자체는 존재 (400 응답). body 파라미터 형식 미공개.

#### 히스토리
```
GET /v2/organization/history  (Query: cursor)
Response: { organizationHistoryList: [...], nextCursor }
```
> 회사 필드 변경 이력. "이 회사 담당자가 누구에서 누구로 바뀌었지?" 같은 추적에 사용.

실제 응답 예시:
```json
{
  "id": "0193f1aa-434e-7330-bd21-afdf016b257b",
  "organizationId": "0193f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
  "type": "editField",
  "fieldName": "이름",
  "fieldValue": "캐치톡",
  "ownerId": "0a538c60-416b-48d1-aaeb-6692a964b1d6",
  "createdAt": "2024-12-23T03:58:07.697Z"
}
```
```json
// 담당자 변경 이력 — fieldValue에 _id + name 객체
{
  "type": "editField",
  "fieldName": "담당자",
  "fieldValue": {"_id": "0a538c60-...", "name": "양시열"}
}
```

**type 값:** `editField`

#### 액티비티
```
GET /v2/organization/activity (Query: cursor)
Response: { organizationActivityList: [...], nextCursor }
```
> 회사와 관련된 모든 활동 타임라인. "이 회사에 최근 연락한 적 있나?" 파악에 사용.

실제 응답 예시:
```json
// 회사 생성
{"id": "0193f1aa-4338-...", "type": "create", "date": "2024-12-23T03:58:07.672Z", "organizationId": "0193f1aa-42fc-...", "emailId": null, "messageId": null, "threadId": null, "webFormId": null, "webFormName": null, "smsId": null, "memoId": null, "todoId": null}

// 웹폼 제출
{"type": "webFormSubmit", "webFormId": "5db28081-...", "webFormName": "문의하기2"}

// 이메일
{"type": "email", "emailId": "cb17cbe4-..."}

// 이메일 오픈 추적
{"type": "emailOpen", "emailId": "cb17cbe4-..."}

// 미팅
{"type": "meeting", "date": "2025-01-31T01:28:57.135Z"}

// 메모 생성
{"type": "memoCreate", "memoId": "019c9d9f-..."}
```

**type 값:** `create`, `email`, `emailOpen`, `webFormSubmit`, `memoCreate`, `meeting`

항목 스키마: `{ id, type, date, organizationId, emailId, messageId, threadId, webFormId, webFormName, smsId, memoId, todoId }`

---

### 고객 (People)

> 비즈니스: 실제 영업 대상인 사람. 이메일/전화로 연락하는 담당자. 회사에 소속되며, 딜/리드의 주체가 된다.

#### 목록 조회
```
GET /v2/people
Query: cursor
```
실제 응답 예시:
```json
{
  "id": "019420d5-0264-7447-b603-98c86164aad2",
  "organizationId": "019420d5-0226-7447-b603-8893fec3de3b",
  "RecordId": "019420d5-0264-7447-b603-98c86164aad2",
  "이름": "Yang SiYeol",
  "이메일": "l@l.com",
  "전화": "01094346321",
  "담당자": {"id": "0a538c60-...", "name": "양시열"},
  "팀": [{"id": "cfc82536-...", "name": "팀테스트"}],
  "수신 거부 여부": false,
  "딜 개수": 0,
  "리드 개수": 0,
  "성사된 딜 개수": 0,
  "실패된 딜 개수": 0,
  "진행중 딜 개수": 0,
  "총 매출": 0,
  "전체 TODO": 0,
  "미완료 TODO": 0,
  "완료 TODO": 0,
  "누적 시퀀스 등록수": 0,
  "현재 진행중인 시퀀스 여부": false,
  "최근 고객 활동일": "2025-01-01T07:46:58.478Z",
  "최근 작성된 노트": "- 고객 이름 : Yang SiYeol\n- 고객 이메일 : l@l.com\n...",
  "최근 노트 작성일": "2025-01-01T07:46:58.403Z",
  "최근 노트 작성자": {"id": "0a538c60-...", "name": "양시열"},
  "최근 제출된 웹폼": {"id": "5db28081-...", "name": "문의하기2"},
  "최근 웹폼 제출 날짜": "2025-01-01T07:46:58.359Z",
  "제출된 웹폼 목록": [{"id": "5db28081-...", "name": "문의하기2"}],
  "생성 날짜": "2025-01-01T07:46:00.000Z",
  "수정 날짜": "2025-04-24T07:25:43.613Z"
  // + 포지션, 프로필 사진, 링크드인, 시퀀스 관련 등 커스텀 필드
}
```

#### 생성
```
POST /v2/people
Body: { name (required), organizationId?, memo?, fieldList? }
Response 201: { success: true, data: { people: { id, name, createdAt } } }
```
실제 응답:
```json
{"success": true, "data": {"people": {"id": "019c9d9c-867c-...", "name": "API검증테스트", "createdAt": "2026-02-27T05:40:06.908Z"}}}
```

**이메일 중복 감지:** 이메일이 동일한 고객이 이미 있으면 `isDuplicate: true`와 기존 고객 정보가 반환될 수 있음.

#### 단일 조회
```
GET /v2/people/<peopleId>
Response 200: { success: true, data: { people: [ {...} ] } }
```
배열 래핑 — `response.data.people[0]`으로 접근. 목록 조회와 동일 스키마 (커스텀 필드 포함 120개+ 필드).

#### 수정
```
POST /v2/people/<peopleId>
Body: { name?, email?, phone?, ownerId?, organizationId?, memo?, fieldList? }
Response 201: { success: true, data: { people: { id, name, updatedAt } } }
```

#### 삭제
```
POST /v2/people/delete
Body: 미확인 (개발팀 문의 필요)
```
`POST /v2/people/delete`로 라우트 존재 (400 응답). body 파라미터 형식 미공개.

#### 히스토리
```
GET /v2/people/history  (Query: cursor, peopleId?)
Response: { peopleHistoryList: [...], nextCursor }
```
> 고객 필드 변경 이력. "이 고객 담당자가 바뀐 적 있나?" "이메일이 수정됐나?" 같은 추적.

실제 응답 예시:
```json
// 필드 수정 — 이름 변경
{
  "id": "0193f1aa-b332-777e-8409-ae6b08b17f66",
  "peopleId": "0193f1aa-b2c6-7778-b0b4-b9a4a7b8df43",
  "type": "editField",
  "organization": null,
  "fieldName": "이름",
  "fieldValue": "박일환",
  "ownerId": "0a538c60-416b-48d1-aaeb-6692a964b1d6",
  "createdAt": "2024-12-23T03:58:36.342Z"
}

// 필드 수정 — boolean 값
{"type": "editField", "fieldName": "수신 거부 여부", "fieldValue": false}

// 필드 수정 — 관계 필드 (담당자 변경)
{"type": "editField", "fieldName": "담당자", "fieldValue": {"_id": "0a538c60-...", "name": "양시열"}}

// 회사 연결 변경
{"type": "editOrganizationConnect", "organization": {"_id": "0193f1aa-42fc-...", "name": "캐치톡"}}
```

**type 값:** `editField`, `editOrganizationConnect`

항목 스키마: `{ id, peopleId, type, organization, fieldName, fieldValue, ownerId, createdAt }`
- `organization`: 회사 연결 변경 시 `{_id, name}` 객체, 아니면 `null`
- `fieldValue`: 유형에 따라 string, number, boolean, `{_id, name}` 객체 등

#### 액티비티
```
GET /v2/people/activity (Query: cursor, peopleId?)
Response: { peopleActivityList: [...], nextCursor }
```
> 고객과 관련된 모든 활동. "이 고객에게 이메일 보낸 적 있나?" "웹폼 제출한 적 있나?" 파악.

실제 응답 예시:
```json
// 고객 생성
{"id": "0193f1aa-b307-...", "type": "create", "date": "2024-12-23T03:58:36.295Z", "peopleId": "0193f1aa-b2c6-...", "emailId": null, "messageId": null, "threadId": null, "webFormId": null, "webFormName": null, "smsId": null, "memoId": null, "todoId": null, "documentId": null, "documentName": null}

// 메모 생성
{"type": "memoCreate", "memoId": "019420d5-02e2-..."}

// 웹폼 제출
{"type": "webFormSubmit", "webFormId": "5db28081-...", "webFormName": "문의하기2"}

// 이메일 발송/수신
{"type": "email", "emailId": "cb17cbe4-..."}

// 이메일 오픈 추적
{"type": "emailOpen", "emailId": "cb17cbe4-..."}
```

**type 값:** `create`, `memoCreate`, `webFormSubmit`, `email`, `emailOpen`

항목 스키마: `{ id, type, date, peopleId, emailId, messageId, threadId, webFormId, webFormName, smsId, memoId, todoId, documentId, documentName }`
- People만 `documentId`, `documentName` 필드 추가 존재

---

### 고객 이메일 조회 (People by Email)

> 비즈니스: 이메일 주소로 기존 고객을 빠르게 찾는 API. 웹훅에서 이메일 수신 시 발신자 매칭, 웹폼 제출 시 기존 고객 확인 등에 활용.

```
GET /v2/people-temp/<email>
Response: { people: [ {...}, ... ] }
```
- `data.people`은 **배열** (동일 이메일 고객이 여러 명일 수 있음)
- 각 항목은 목록 조회와 **동일한 전체 스키마** 반환 (한글 필드명 포함)

실제 응답 예시 (`GET /v2/people-temp/l@l.com`):
```json
{
  "success": true,
  "data": {
    "people": [
      {
        "id": "019420d5-0264-7447-b603-98c86164aad2",
        "organizationId": "019420d5-0226-7447-b603-8893fec3de3b",
        "이름": "Yang SiYeol",
        "이메일": "l@l.com",
        "전화": "01094346321",
        "담당자": {"id": "0a538c60-...", "name": "양시열"},
        "팀": [{"id": "cfc82536-...", "name": "팀테스트"}],
        "수신 거부 여부": false,
        "딜 개수": 0,
        "리드 개수": 0,
        "성사된 딜 개수": 0,
        "실패된 딜 개수": 0,
        "진행중 딜 개수": 0,
        "총 매출": 0,
        "전체 TODO": 0,
        "미완료 TODO": 0,
        "완료 TODO": 0,
        "누적 시퀀스 등록수": 0,
        "현재 진행중인 시퀀스 여부": false,
        "최근 고객 활동일": "2025-01-01T07:46:58.478Z",
        "최근 작성된 노트": "- 고객 이름 : Yang SiYeol\n- 고객 이메일 : l@l.com...",
        "최근 노트 작성일": "2025-01-01T07:46:58.403Z",
        "최근 노트 작성자": {"id": "0a538c60-...", "name": "양시열"},
        "최근 제출된 웹폼": {"id": "5db28081-...", "name": "문의하기2"},
        "최근 웹폼 제출 날짜": "2025-01-01T07:46:58.359Z",
        "제출된 웹폼 목록": [{"id": "5db28081-...", "name": "문의하기2"}],
        "생성 날짜": "2025-01-01T07:46:00.000Z",
        "수정 날짜": "2025-04-24T07:25:43.613Z"
      }
    ]
  }
}
```

**Search Record API와 비교:**
| | `people-temp` | Search Record API |
|---|---|---|
| 응답 내용 | **전체 필드** (한글 필드 포함) | **id + name만** |
| 검색 조건 | 이메일 1건 완전 일치만 | 다양한 필드, 다양한 연산자 |
| 용도 | 이메일로 빠른 상세 조회 | 복합 조건 검색 후 개별 조회 |

---

### 딜 (Deal)

> 비즈니스: 검증된 영업 기회. 매출 예측의 기반. 파이프라인 단계를 따라 진행되며, 최종적으로 성사(Won) 또는 실패(Lost).

#### 목록 조회
```
GET /v2/deal
Query: cursor, pipelineName?, pipelineStageName?
```
실제 응답 예시 (주요 필드):
```json
{
  "id": "01982ae8-d268-788f-8b26-1474c7b0b3bc",
  "peopleId": "019993cb-15cf-7aac-925b-70411361dbcf",
  "organizationId": "01981652-f838-7ee0-a9e0-8c46842d54ce",
  "이름": "회사2 딜ㄷㅈㄷ",
  "금액": 20011,
  "상태": "SQL",
  "파이프라인": {"id": "e2ca5511-...", "name": "1-5단계"},
  "파이프라인 단계": {"id": "90ecd3e2-...", "name": "4단계"},
  "담당자": {"id": "b4d43478-...", "name": "박일환"},
  "팀": [{"id": "cfc82536-...", "name": "팀테스트"}],
  "메인 견적 상품 리스트": [{"id": "0194d465-...", "name": "!1!"}],
  "참여자": [{"id": "01965c48-...", "name": "5"}],
  "선금 납부 여부": true,
  "수주 예정일": "2025-09-13T15:00:00.000Z",
  "등록된 시퀀스 목록": [{"id": "019b0698-...", "name": "1"}],
  "전체 TODO": 2,
  "미완료 TODO": 2,
  "생성 날짜": "2025-07-21T02:55:00.000Z",
  "수정 날짜": "2026-02-27T00:52:00.000Z"
  // + 파이프라인 단계별 진입/퇴장/누적시간 자동 필드들 (수백 개)
}
```
**참고:** 딜은 파이프라인 단계별 추적 필드(`N단계(파이프라인명)로 진입한 날짜`, `에서 보낸 누적 시간`, `에서 퇴장한 날짜`)가 자동 생성되어 필드가 수백 개일 수 있다.

#### 단일 조회
```
GET /v2/deal/<dealId>
Response 200: { success: true, data: { deal: [ {...} ] } }
```
배열 래핑 — `response.data.deal[0]`으로 접근. (모든 단일 조회 공통)

#### 생성
```
POST /v2/deal
Body:
  name: string (required)
  peopleId: string (peopleId 또는 organizationId 중 하나 이상 필수)
  organizationId: string (위와 동일)
  status: string (required - "Won" | "Lost" | "In progress")
  pipelineId: string (required)
  pipelineStageId: string (required - 해당 파이프라인에 속한 단계만 가능)
  price: number         ← 금액은 반드시 여기! fieldList에 넣으면 에러
  memo: string
  fieldList: array
```
실제 검증된 요청:
```json
{
  "name": "API검증딜",
  "organizationId": "0193f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
  "pipelineId": "cc7658f8-4ea4-4c1c-8137-7bf22ae4a4b5",
  "pipelineStageId": "814870c5-96d3-4305-9341-40350e2be9b1",
  "status": "In progress",
  "price": 5000000,
  "fieldList": [
    { "name": "등급", "stringValue": "A" },
    { "name": "선금 납부 여부", "booleanValue": true }
  ]
}
```
응답:
```json
{"success": true, "data": {"deal": {"id": "019c9d9e-5578-...", "name": "API검증딜", "createdAt": "2026-02-27T05:42:05.434Z"}}}
```

#### 수정
```
POST /v2/deal/<dealId>
Body: { name?, peopleId?, organizationId?, status?, price?, memo?, pipelineId?, pipelineStageId?, fieldList? }
```
`pipelineStageId`는 `pipelineId` 지정 시 필수.

#### 삭제
```
POST /v2/deal/delete
Body: 미확인 (개발팀 문의 필요)
```
`POST /v2/deal/delete`로 라우트 존재 (400 응답). body 파라미터 형식 미공개.
**주의:** `POST /v2/deal/<dealId>/delete` (path에 ID)는 **404** — 작동하지 않음.

#### 히스토리
```
GET /v2/deal/history (Query: cursor)
Response: { dealHistoryList: [...], nextCursor }
```
> 딜 필드 변경 이력. "이 딜의 금액이 변경됐나?" "담당자가 바뀌었나?" "파이프라인 단계가 언제 이동했나?"

실제 응답 예시:
```json
// 필드 수정
{
  "id": "01982ae8-d3da-7222-bb08-de47b1646163",
  "dealId": "01982ae8-d268-788f-8b26-1474c7b0b3bc",
  "type": "editField",
  "people": null,
  "organization": null,
  "fieldName": "누적 시퀀스 등록수",
  "fieldValue": 0,
  "ownerId": "dac27c65-dac3-4c0e-9fcb-38283548035d",
  "createdAt": "2025-07-21T02:55:58.429Z"
}

// 회사 연결
{"type": "editOrganizationConnect", "organization": {"_id": "01982ae8-d0bf-...", "name": "회사2"}}

// 고객 연결
{"type": "editPeopleConnection", "people": {"_id": "01982ae8-d166-...", "name": "고객2"}}
```

**type 값:** `editField`, `editOrganizationConnect`, `editPeopleConnection`

항목 스키마: `{ id, dealId, type, people, organization, fieldName, fieldValue, ownerId, createdAt }`
- `people`: 고객 연결 변경 시 `{_id, name}`, 아니면 `null`
- `organization`: 회사 연결 변경 시 `{_id, name}`, 아니면 `null`

#### 액티비티
```
GET /v2/deal/activity (Query: cursor)
Response: { dealActivityList: [...], nextCursor }
```
> 딜 관련 모든 활동. "이 딜에 이메일/메모/TODO가 있었나?" 파악. `dealStatus` 필드로 딜 상태 변화도 추적.

실제 응답 예시:
```json
// 딜 생성
{"id": "01982ae8-d3c5-...", "type": "create", "date": "2025-07-21T02:55:58.068Z", "dealId": "01982ae8-d268-...", "emailId": null, "messageId": null, "threadId": null, "webFormId": null, "webFormName": null, "smsId": null, "memoId": null, "todoId": null, "dealStatus": null}

// TODO 생성
{"type": "todoCreate", "todoId": "01989caa-8376-..."}

// 메모 생성
{"type": "memoCreate", "memoId": "01989caa-9352-..."}

// 이메일
{"type": "email", "emailId": "..."}
```

**type 값:** `create`, `memoCreate`, `todoCreate`, `email`

항목 스키마: `{ id, type, date, dealId, emailId, messageId, threadId, webFormId, webFormName, smsId, memoId, todoId, dealStatus }`
- Deal만 `dealStatus` 필드 추가 존재

#### 견적서 조회
```
GET /v2/deal/<dealId>/quote
Response: { quoteList: [...] }
```
> 비즈니스: 딜에 연결된 가격 제안서 목록. "이 딜에 견적서 보냈나?" "총액이 얼마지?"

실제 응답 예시:
```json
{
  "quoteList": [
    {
      "id": "59d0e1e9-c39b-443e-a75d-4f46448b30db",
      "roomId": "769058ad-d36c-4800-b867-7bd3cd077025",
      "메인 견적서 여부": true,
      "공유 링크": null,
      "RecordId": "59d0e1e9-c39b-443e-a75d-4f46448b30db",
      "금액": 89.1,
      "담당자": {"id": "117dfe7c-...", "name": "신준영"},
      "이름": "ㅇㅇ",
      "팀": [{"id": "cfc82536-...", "name": "팀테스트"}],
      "할인": 1,
      "할인 유형": "percentage",
      "견적 구성 상품": [
        {
          "id": "0560fbc3-2a8c-482e-87f0-60ee88a542df",
          "productId": "0194d465-e186-755a-ac41-cd0e9eb504f2",
          "금액": 100,
          "수량": 1,
          "할인": 10,
          "할인 유형": "percentage",
          "부가세": 10,
          "전체 금액": 90,
          "결제 횟수": 1,
          "시작 결제일": null,
          "마지막 결제일": null,
          "계약 비고": null
        }
      ],
      "최근 작성된 노트": null,
      "최근 노트 작성일": null,
      "최근 노트 작성자": null,
      "생성 날짜": "2025-10-01T11:08:00.000Z",
      "수정 날짜": "2025-10-01T11:10:06.453Z"
    }
  ]
}
```

**견적서 스키마:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 견적서 ID |
| 메인 견적서 여부 | boolean | 딜의 대표 견적서 여부 |
| 공유 링크 | string/null | 외부 공유 URL |
| 금액 | number | 할인 적용 후 총액 |
| 담당자 | {id, name} | 견적 작성자 |
| 이름 | string | 견적서명 |
| 할인 | number | 전체 할인값 |
| 할인 유형 | string | `"percentage"` 또는 `"amount"` |
| 견적 구성 상품 | array | 포함된 상품 목록 (아래) |

**견적 구성 상품 스키마:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 항목 ID |
| productId | UUID | 상품 ID |
| 금액 | number | 단가 |
| 수량 | number | 수량 |
| 할인 | number | 개별 할인값 |
| 할인 유형 | string | `"percentage"` 또는 `"amount"` |
| 부가세 | number | 부가세 |
| 전체 금액 | number | 할인·부가세 적용 후 최종 금액 |
| 결제 횟수 | number | 구독 상품의 결제 횟수 |
| 시작 결제일 | datetime/null | 구독 시작 결제일 |
| 마지막 결제일 | datetime/null | 구독 마지막 결제일 |

---

### 리드 (Lead)

> 비즈니스: 아직 검증되지 않은 잠재 영업 기회. 딜보다 앞 단계. "관심은 있는데 진짜 사려는 건지 모르겠어" 상태.
> 딜로 전환(convert)할 수 있다. 파이프라인은 선택사항.

딜과 거의 동일한 구조. 차이점: `pipelineId`/`pipelineStageId`가 **선택사항**, `status` **불필요**.

```
GET /v2/lead                          → { leadList, nextCursor }
GET /v2/lead/<leadId>                 → 단일 조회 (배열 래핑: data.lead[0])
POST /v2/lead                         → 생성
  Body: { name (required), peopleId?, organizationId?, memo?, pipelineId?, pipelineStageId?, fieldList? }
  주의: peopleId 또는 organizationId 중 하나 이상 필수 ("[refine]: PeopleId 또는 OrganizationId를 입력해주세요.")
POST /v2/lead/<leadId>                → 수정
GET /v2/lead/<leadId>/quote           → 견적서 조회 (딜 견적서와 동일 스키마)
```

#### 삭제
```
POST /v2/lead/delete
Body: 미확인 (개발팀 문의 필요)
```

#### 히스토리
```
GET /v2/lead/history (Query: cursor)
Response: { leadHistoryList: [...], nextCursor }
```
실제 응답 예시:
```json
// 필드 수정
{"id": "01998525-c22b-...", "leadId": "01998525-c0fc-...", "type": "editField", "people": null, "organization": null, "fieldName": "이름", "fieldValue": "dd 리드", "ownerId": "dac27c65-...", "createdAt": "2025-09-26T08:31:08.032Z"}

// 회사 연결
{"type": "editOrganizationConnect", "organization": {"_id": "0199799b-...", "name": "dd"}}

// 고객 연결
{"type": "editPeopleConnection", "people": {"_id": "0199799b-...", "name": "dd"}}
```

**type 값:** `editField`, `editOrganizationConnect`, `editPeopleConnection`

항목 스키마: `{ id, leadId, type, people, organization, fieldName, fieldValue, ownerId, createdAt }`

#### 액티비티
```
GET /v2/lead/activity (Query: cursor)
Response: { leadActivityList: [...], nextCursor }
```
실제 응답 예시:
```json
{"type": "create", "date": "2025-09-26T08:31:08.032Z", "leadId": "01998525-c0fc-..."}
{"type": "todoCreate", "todoId": "0199799b-aecf-..."}
{"type": "webFormSubmit", "webFormId": "b0e38035-...", "webFormName": "평범 웹 폼"}
{"type": "memoCreate", "memoId": "..."}
{"type": "email", "emailId": "..."}
```

**type 값:** `create`, `todoCreate`, `webFormSubmit`, `memoCreate`, `email`

항목 스키마: `{ id, type, date, leadId, emailId, messageId, threadId, webFormId, webFormName, smsId, memoId, todoId }`

---

### 검색 (Search Record)

> 비즈니스: 복합 조건으로 오브젝트 검색. "이메일 있는 고객 중 이름에 '김'이 포함된 사람", "금액 1000만원 이상인 딜" 같은 조건 검색.

```
POST /v2/object/{targetType}/search
targetType: people | organization | deal | lead
Query: cursor
Response: { objectList: [{ id, name }], nextCursor }
```

**Rate Limit**: 요청당 10 포인트 소모 (일반 API보다 비용 높음)

#### 요청 Body
```json
{
  "filterGroupList": [
    {
      "filters": [
        { "fieldName": "이메일", "operator": "EQ", "value": "test@test.com" }
      ]
    }
  ]
}
```

- `filterGroupList`: 그룹 간 **OR**, 최대 3개. 필수 (빈 배열 불가).
- `filters`: 필터 간 **AND**, 최대 3개
- `fieldName`: 기본/커스텀 필드의 **한글 이름**
- `value`: `EXISTS`/`NOT_EXISTS`만 생략 가능. **빈 문자열 `""` 불가.**

#### 지원 Operator

| 카테고리 | Operator |
|---------|----------|
| 공통 | `EQ`, `NEQ`, `EXISTS`, `NOT_EXISTS` |
| 문자열 | `CONTAINS`, `NOT_CONTAINS` |
| 숫자 | `LT`, `LTE`, `GT`, `GTE` |
| 선택 | `IN`, `NOT_IN`, `LIST_CONTAIN`, `LIST_NOT_CONTAIN` |
| 날짜(지정) | `DATE_ON_OR_AFTER`, `DATE_ON_OR_BEFORE`, `DATE_IS_SPECIFIC_DAY`, `DATE_BETWEEN` |
| 날짜(경과) | `DATE_MORE_THAN_DAYS_AGO`, `DATE_LESS_THAN_DAYS_AGO`, `DATE_LESS_THAN_DAYS_LATER`, `DATE_MORE_THAN_DAYS_LATER`, `DATE_AGO`, `DATE_LATER` |

**주의:**
- Relation 필드 (담당자 등): UUID 값만 허용, `CONTAINS`/`NOT_CONTAINS` 불가
- MultiSelect: `EQ`/`NEQ` 대신 `LIST_CONTAIN`/`LIST_NOT_CONTAIN`
- `DATE_BETWEEN` value: `["2025-01-01", "2025-12-31"]` 배열
- 빈 값 체크: `EXISTS`/`NOT_EXISTS` 사용 (`NEQ` + `""` 안됨)

#### 응답
- **`id`와 `name`만** 포함. 상세 정보 필요 시 개별 조회 API 호출.
- 페이지 사이즈: **50건** (명세상 20건이지만 실측 50건)
- `custom-object` 타입 미지원 → `Invalid targetType`

#### 검증된 사용 예시

이메일로 고객 1건 검색:
```json
// POST /v2/object/people/search
{"filterGroupList": [{"filters": [{"fieldName": "이메일", "operator": "EQ", "value": "test@test.com"}]}]}
// → {"objectList": [{"id": "019c285d-...", "name": "테스트담당자"}], "nextCursor": null}
```

AND (이메일 있는 + 이름 "테스트" 포함):
```json
{"filterGroupList": [{"filters": [{"fieldName": "이메일", "operator": "EXISTS"}, {"fieldName": "이름", "operator": "CONTAINS", "value": "테스트"}]}]}
```

OR (이름 "테스트" 또는 "관리자"):
```json
{"filterGroupList": [{"filters": [{"fieldName": "이름", "operator": "CONTAINS", "value": "테스트"}]}, {"filters": [{"fieldName": "이름", "operator": "CONTAINS", "value": "관리자"}]}]}
```

---

### 견적서 (Quote)

> 비즈니스: 고객에게 공식적으로 보내는 가격 제안서. 딜/리드에 연결되며, 여러 상품을 포함. 할인·부가세 자동 계산.

#### 생성
```
POST /v2/quote
Body:
  name: string (required)
  dealId: string
  leadId: string
  memo: string
  fieldList: array
  isMainQuote: boolean       ← 딜의 대표 견적서로 지정
  quoteProductList: array    ← 포함할 상품 목록
Response: { quote: { id, name, totalAmount, dealId, leadId, createdAt } }
```

**quoteProductList 항목:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | string | Y | 상품 이름 |
| productId | string | 상품 있으면 | 상품 ID |
| price | number | 상품 있으면 | 단가 |
| amount | number | 상품 있으면 | 수량 |
| paymentCount | number | 구독만 | 결제 횟수 |
| paymentStartAt | date | 구독만 | 시작 결제일 |
| fieldList | array | N | 상품 커스텀 필드 |

#### 조회 (딜/리드 연결)
```
GET /v2/deal/<dealId>/quote     → { quoteList: [...] }
GET /v2/lead/<leadId>/quote     → { quoteList: [...] }
```
견적서 응답 스키마는 딜 섹션의 "견적서 조회" 참고.

**목록 조회 (`GET /v2/quote`)는 현재 500 에러 — 개발팀 문의 필요.**

---

### 연관관계 (Association)

> 비즈니스: 오브젝트 간 연결 관계 조회. "이 고객이 어떤 회사에 속해있지?" "이 딜에 연결된 고객은?"

Primary와 Custom 두 가지.

#### Primary (FK 직접 연결)
```
GET /v2/object/{targetType}/{targetId}/association/{toTargetType}/primary
Query: cursor
```
검증된 응답:
```json
{"success": true, "data": {"associationIdList": ["01981652-f838-7ee0-a9e0-8c46842d54ce"], "nextCursor": null}}
```
- targetType / toTargetType: `people`, `organization`, `deal`, `lead`, `memo`
- **ID 목록만** 반환

#### Custom (커스텀 필드 연결)
```
GET /v2/object/{targetType}/{targetId}/association/{toTargetType}/custom
Query: cursor
```
검증된 응답:
```json
{"success": true, "data": {"associationItemList": [{"id": "01965c48-...", "label": "참여자"}], "nextCursor": null}}
```
- targetType / toTargetType: `people`, `organization`, `deal`, `lead`, `custom-object`
- **ID + label** 반환. `label`은 커스텀 필드 이름.

**실전 팁:** Primary로 안 나오면 Custom으로도 시도. FK인지 커스텀 필드인지 명확하지 않은 경우가 있으므로 유동적으로.

---

### 커스텀 오브젝트 (Custom Object)

> 비즈니스: 기본 오브젝트로 관리할 수 없는 데이터. 예: 계약, 프로젝트, 자산 등. 워크스페이스마다 다르게 정의.

#### 목록 조회
```
GET /v2/custom-object  (Query: cursor)
Response: { customObjectList: [...], nextCursor }
```
실제 응답 예시:
```json
{
  "id": "019a52ed-6157-7000-a6b9-5a8f2ec03804",
  "customObjectDefinitionId": "019a52ec-2539-7000-af11-4aa5b2e3af1f",
  "RecordId": "019a52ed-6157-7000-a6b9-5a8f2ec03804",
  "계약이름": "dd",
  "A": "d",
  "B": null,
  "dd": [{"id": "0198dfd5-...", "name": "30분지남고객"}],
  "담당자": {"id": "dac27c65-...", "name": "세일즈맵 관리자"},
  "팀": [{"id": "cfc82536-...", "name": "팀테스트"}],
  "파이프라인": null,
  "파이프라인 단계": null,
  "최근 파이프라인 단계 수정 날짜": null,
  "생성 날짜": "2025-11-05T07:31:20.021Z",
  "수정 날짜": "2025-11-05T07:44:53.436Z"
}
```
- `customObjectDefinitionId`: 이 레코드가 속한 커스텀 오브젝트 정의(스키마/타입). 같은 definition에 여러 레코드가 속함.
- **Definition 전용 조회 API는 없음** — definition ID는 각 레코드의 `customObjectDefinitionId`에서 확인.
- 필드 정의는 `GET /v2/field/custom-object`로 조회 가능.

#### 생성
```
POST /v2/custom-object
Body: { customObjectDefinitionId (required), fieldList: [{ name, stringValue|... }] }
Response 201: { customObject: { id, ... } }
```

#### 수정
```
POST /v2/custom-object/<customObjectId>
Body: { ownerId?, fieldList: [{ name, stringValue|... }] }
```

#### 단일 조회
```
GET /v2/custom-object/<customObjectId>
```
응답에서 필드가 **직접 속성으로 반환**된다 (다른 오브젝트와 동일 패턴).

#### 삭제
```
POST /v2/custom-object/delete
Body: 미확인 (개발팀 문의 필요)
```

#### 히스토리
```
GET /v2/custom-object/history  (Query: cursor, customObjectId?)
Response: { customObjectHistoryList: [...], nextCursor }
```
실제 응답 예시:
```json
{
  "id": "019a52ed-61aa-7221-bfdd-fbadff771e46",
  "customObjectId": "019a52ed-6157-7000-a6b9-5a8f2ec03804",
  "type": "editField",
  "fieldName": "계약이름",
  "fieldValue": "dd",
  "ownerId": "dac27c65-dac3-4c0e-9fcb-38283548035d",
  "createdAt": "2025-11-05T07:31:20.109Z"
}
// 담당자 변경
{"type": "editField", "fieldName": "담당자", "fieldValue": {"_id": "dac27c65-...", "name": "세일즈맵 관리자"}}
```

**type 값:** `editField`

항목 스키마: `{ id, customObjectId, type, fieldName, fieldValue, ownerId, createdAt }`

#### 액티비티
```
GET /v2/custom-object/activity (Query: cursor, customObjectId?)
Response: { customObjectActivityList: [...], nextCursor }
```
실제 응답 예시:
```json
{"id": "019a52ed-6191-...", "type": "create", "date": "2025-11-05T07:31:20.021Z", "customObjectId": "019a52ed-6157-...", "emailId": null, "messageId": null, "threadId": null, "smsId": null, "memoId": null, "todoId": null, "meetingId": null, "kakaoAlimtalkId": null, "emailLinkId": null}

{"type": "memoCreate", "memoId": "019a52fa-8091-..."}
```

**type 값:** `create`, `memoCreate`

항목 스키마: `{ id, type, date, customObjectId, emailId, messageId, threadId, smsId, memoId, todoId, meetingId, kakaoAlimtalkId, emailLinkId }`
- 커스텀 오브젝트만 `meetingId`, `kakaoAlimtalkId`, `emailLinkId` 추가 (webFormId 없음)

---

### 필드 정의 (Field)

> 비즈니스: 워크스페이스에 정의된 필드 목록 조회. MCP 구현 시 필수 — 어떤 필드가 있고, 어떤 값이 유효한지 동적으로 파악.

```
GET /v2/field/{type}
type: deal | lead | people | organization | product | quote | todo | custom-object
```
검증된 응답 예시:
```json
{
  "success": true,
  "data": {
    "fieldList": [
      {
        "id": "8506f864-3105-4098-9ac3-87c58b45c13e",
        "name": "복수선택",
        "type": "multiSelect",
        "required": false,
        "optionList": [
          { "id": "7c6f4a88-...", "value": "1" },
          { "id": "0fa15a7b-...", "value": "2" },
          { "id": "155be757-...", "value": "3" }
        ]
      },
      {
        "id": "053880a5-e382-4976-8641-c6996aa8b782",
        "name": "문의 서비스",
        "type": "singleSelect",
        "required": false,
        "optionList": [
          { "id": "1c43dc54-...", "value": "ㅁ" },
          { "id": "985827a0-...", "value": "ㅇ" }
        ]
      }
    ]
  }
}
```

**필드 스키마:** `{ id, name, type, required, optionList? }`
- `optionList`는 `singleSelect`/`multiSelect` 필드에만 존재
- 옵션 항목: `{ id, value }`

**지원되는 type 파라미터:**
`deal`, `lead`, `people`, `organization`, `product`, `quote`, `todo`, `custom-object` (하이픈 필수)

**필드 type 값 목록:** `string`, `number`, `boolean`, `date`, `dateTime`, `singleSelect`, `multiSelect`, `user`, `multiUser`, `people`, `multiPeople`, `organization`, `multiOrganization`, `deal`, `multiDeal`, `multiLead`, `pipeline`, `pipelineStage`, `multiProduct`, `multiAttachment`, `webForm`, `multiWebForm`, `sequence`, `multiSequence`, `multiCustomObject`, `multiPeopleGroup`, `multiLeadGroup`, `team`, `multiTeam`

---

### 파이프라인 (Pipeline)

> 비즈니스: 딜/리드의 진행 단계를 정의하는 프레임워크. 예: "초기 접촉 → 니즈 파악 → 제안 → 협상 → 성사/실패".
> 영업 프로세스를 시각화하고, 각 단계에 머문 시간을 추적하여 병목 구간을 파악.

```
GET /v2/deal/pipeline
GET /v2/lead/pipeline
```
검증된 응답:
```json
{
  "pipelineList": [
    {
      "id": "cc7658f8-4ea4-4c1c-8137-7bf22ae4a4b5",
      "name": "딜 생성 테스트용",
      "pipelineStageList": [
        { "id": "814870c5-...", "name": "여기에 자동으로 생성", "index": 0 },
        { "id": "e18a5f96-...", "name": "첫 미팅 준비", "index": 1 },
        { "id": "e483131f-...", "name": "고객 니즈 파악", "index": 2 },
        { "id": "8c0285c5-...", "name": "성사", "index": 6 },
        { "id": "6f9d57ca-...", "name": "실패", "index": 7 }
      ]
    }
  ]
}
```
- 키: `pipelineStageList` (단계 배열)
- 단계 순서: `index` (0부터)

---

### 상품 (Product)

> 비즈니스: 판매하는 제품/서비스. 견적서에 포함되는 단위. 일반 상품과 구독(월간/연간) 상품이 있다.

```
GET /v2/product  (Query: cursor)
POST /v2/product  Body: { name (required), fieldList? }
```
검증된 응답 예시:
```json
{
  "id": "0194d468-3ec6-7aad-98cc-5264877a515d",
  "RecordId": "0194d468-3ec6-7aad-98cc-5264877a515d",
  "이름": ",1,",
  "금액": 1,
  "코드": "1111111",
  "브랜드": "1",
  "유형": "일반",           // "일반" | "구독 (월간)" | "구독 (연간)"
  "상태": "active",         // "active" | "inactive"
  "담당자": {"id": "0a538c60-...", "name": "양시열"},
  "팀": [{"id": "cfc82536-...", "name": "팀테스트"}],
  "생성 날짜": "2025-02-05T04:39:49.196Z",
  "수정 날짜": "2026-02-27T00:37:00.000Z"
}
```

---

### 웹 폼 (WebForm)

> 비즈니스: 웹사이트에 삽입하는 리드 수집 폼. 고객이 문의/신청을 제출하면 자동으로 고객+회사가 생성된다.

#### 목록 조회
```
GET /v2/webForm  (Query: cursor)
```
검증된 응답:
```json
{
  "id": "bfb86637-a603-42b8-b3f6-d3f96eb1a11c",
  "name": "ㅇ",
  "description": null,
  "status": "active",        // "active" | "inactive"
  "folderName": null,
  "viewCount": 0,            // 폼 조회 수
  "submitCount": 0,          // 제출 수
  "createdAt": "2026-02-27T01:51:57.426Z",
  "updatedAt": "2026-02-27T01:57:20.878Z"
}
```

#### 제출 목록 조회
```
GET /v2/webForm/<webFormId>/submit  (Query: cursor)
Response: { webFormSubmitList: [...], nextCursor }
```
> 비즈니스: "이 웹폼으로 어떤 문의가 들어왔지?" — 폼 제출 내역과 자동 생성된 고객/회사/리드 ID 확인.

실제 응답 예시:
```json
{
  "id": "019c8921-5018-7000-8063-5e64c4eec570",
  "peopleId": "019c4056-aa0c-7000-8353-b2694911be4a",
  "organizationId": "019c74e5-a5e5-7bb5-a8c0-93fec5c05f96",
  "dealId": null,
  "leadId": "019c8921-4f91-7000-8062-f9597e7e2e39",
  "contents": [
    {"label": "이름", "value": "딜이름"},
    {"label": "이메일", "value": "yebinpark@salesmap.kr"},
    {"label": "전화번호", "value": "0100012334434"},
    {"label": "회사명", "value": "test24242424"},
    {"label": "개인정보 수집 및 이용 동의", "value": "동의합니다"},
    {"label": "리드 수동 생성 여부", "value": "false"}
  ],
  "createdAt": "2026-02-23T06:13:07.738Z"
}
```

**웹폼 제출 스키마:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 제출 ID |
| peopleId | UUID/null | 자동 생성/매칭된 고객 |
| organizationId | UUID/null | 자동 생성/매칭된 회사 |
| dealId | UUID/null | 자동 생성된 딜 |
| leadId | UUID/null | 자동 생성된 리드 |
| contents | array | 폼 입력 값. `[{label, value}]` |
| createdAt | datetime | 제출 시각 |

**활용:** `contents[].label`로 폼 필드명, `contents[].value`로 입력값 확인. `peopleId`/`organizationId`로 자동 생성된 레코드에 후속 작업 가능.

---

### TODO

> 비즈니스: 영업 담당자의 할 일 관리. 전화, 미팅, 업무 등 follow-up 스케줄링.
> 고객/딜/리드/회사에 연결 가능. 시퀀스에서 자동 생성될 수도 있음 (예: "3일 후 전화" step).

```
GET /v2/todo  (Query: cursor)
```
**생성 API 없음.** 읽기 전용. TODO는 UI나 시퀀스(createTodo step)에서만 생성된다.

검증된 응답 예시:
```json
{
  "id": "01946462-193e-7ee3-a8fa-a2fd97b3f9f1",
  "peopleId": "019420d5-0264-7447-b603-98c86164aad2",
  "organizationId": "019420d5-0226-7447-b603-8893fec3de3b",
  "dealId": null,
  "leadId": null,
  "dealLeadId": null,
  "RecordId": null,
  "제목": "본인이 본인에게 할당한 TODO",
  "내용": null,
  "유형": "전화",             // "전화" | "미팅" | "업무" | "이메일" 등
  "완료": false,
  "상태": null,
  "시작일": "2025-01-14T10:45:00.000Z",
  "종료일": "2025-01-14T11:00:00.000Z",
  "완료일": null,
  "위치": null,
  "담당자": {"id": "0a538c60-...", "name": "양시열"},
  "참석자": [],
  "팀": [{"id": "cfc82536-...", "name": "팀테스트"}],
  "생성 날짜": "2025-01-14T10:43:06.974Z",
  "수정 날짜": "2025-01-14T10:43:07.041Z"
}
```

**TODO 스키마:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | TODO ID |
| peopleId | UUID/null | 연결된 고객 |
| organizationId | UUID/null | 연결된 회사 |
| dealId | UUID/null | 연결된 딜 |
| leadId | UUID/null | 연결된 리드 |
| 제목 | string | TODO 제목 |
| 내용 | string/null | 상세 내용. 미팅 예약 시 예약자·이메일·장소 등 포함 |
| 유형 | string | `"전화"`, `"미팅"`, `"업무"`, `"이메일"` 등 |
| 완료 | boolean | 완료 여부 |
| 시작일 | datetime | 시작 시각 |
| 종료일 | datetime | 종료 시각 |
| 완료일 | datetime/null | 실제 완료 시각 |
| 위치 | string/null | 미팅 장소 |
| 담당자 | {id, name} | 할당된 담당자 |
| 참석자 | array | 미팅 참석자 목록 |

---

### 메모 (Memo)

> 비즈니스: 고객/딜/회사 등에 남기는 내부 기록. 미팅 노트, 상담 내용, 팀 공유 메모. 히스토리가 아닌 자유 형식 텍스트.

#### 목록 조회
```
GET /v2/memo  (Query: cursor)
```
정렬: `createdAt` 오름차순 (오래된 순 → 최신이 마지막 페이지).

#### 생성 — 오브젝트 수정 API의 `memo` 파라미터 사용
별도 메모 생성 API는 없다. **오브젝트 수정 시 `memo` 파라미터에 텍스트를 넣으면 해당 오브젝트에 메모가 새로 생성된다.**

```
POST /v2/people/<peopleId>        Body: { "memo": "메모 내용" }
POST /v2/organization/<orgId>     Body: { "memo": "메모 내용" }
POST /v2/deal/<dealId>            Body: { "memo": "메모 내용" }
POST /v2/lead/<leadId>            Body: { "memo": "메모 내용" }
```

검증 결과 (People, Organization, Deal 모두 동일하게 동작 확인):
```json
// POST /v2/people/{peopleId} with {"memo": "이것은 API로 생성한 메모입니다"}
// → {"success": true, "data": {"people": {"id": "...", "name": "메모테스트고객", "updatedAt": "..."}}}
//   (응답에 memo 필드는 없지만 실제 생성됨)

// GET /v2/people/{peopleId} 로 확인:
// "최근 작성된 노트": "이것은 API로 생성한 메모입니다"
// "최근 노트 작성일": "2026-02-27T06:26:00.000Z"
// "최근 노트 작성자": {"id": "dac27c65-...", "name": "세일즈맵 관리자"}
```
생성된 메모는 `GET /v2/memo` 목록에도 등록된다.

검증된 응답 예시:
```json
{
  "id": "019420d5-02e2-7447-b603-b4aafbe05672",
  "cursorId": "019420d5-02e2-7447-b603-b4aafbe05672",
  "htmlBody": "<p>- 고객 이름 : Yang SiYeol<br>- 고객 이메일 : l@l.com...</p>",
  "text": "- 고객 이름 : Yang SiYeol\n- 고객 이메일 : l@l.com\n- 고객 전화 : 01094346321\n- 회사 이름 : ㅊ",
  "dealId": null,
  "leadId": null,
  "peopleId": "019420d5-0264-7447-b603-98c86164aad2",
  "organizationId": "019420d5-0226-7447-b603-8893fec3de3b",
  "productId": null,
  "quoteId": null,
  "todoId": null,
  "parentId": null,
  "ownerId": "0a538c60-416b-48d1-aaeb-6692a964b1d6",
  "updatedAt": "2025-01-01T07:46:58.403Z",
  "createdAt": "2025-01-01T07:46:58.402Z",
  "유형": []
}
```

**메모 스키마:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 메모 ID |
| htmlBody | string | HTML 형식 본문 |
| text | string | 평문 본문 |
| 유형 | array | 메모 유형 태그 (빈 배열 가능) |
| dealId | UUID/null | 연결된 딜 |
| leadId | UUID/null | 연결된 리드 |
| peopleId | UUID/null | 연결된 고객 |
| organizationId | UUID/null | 연결된 회사 |
| productId | UUID/null | 연결된 상품 |
| quoteId | UUID/null | 연결된 견적서 |
| todoId | UUID/null | 연결된 TODO |
| parentId | UUID/null | 부모 메모 (대댓글) |
| ownerId | UUID | 작성자 ID |

**참고:** 메모는 다른 오브젝트와 달리 camelCase 키를 사용 (`htmlBody`, `createdAt` 등). `유형`만 한글.

---

### 사용자 (User)

> 비즈니스: CRM 사용자(영업 담당자). 고객/딜의 "담당자"로 할당되는 주체.

#### 목록 조회
```
GET /v2/user  (Query: cursor)
```
검증된 응답:
```json
{"id": "12cfcc1f-...", "name": "김일웅테스트", "status": "active", "email": "sheep_horse@naver.com", "role": "사용자", "createdAt": "2026-02-11T06:27:05.485Z", "updatedAt": "2026-02-11T06:27:05.485Z"}
```

#### 내 정보 조회
```
GET /v2/user/me
```
검증된 응답:
```json
{"id": "dac27c65-...", "name": "세일즈맵 관리자", "status": "active", "updatedAt": "2026-02-27T05:14:14.327Z", "createdAt": "2025-02-17T02:19:31.271Z", "room": {"id": "769058ad-...", "name": "어글리브레드"}}
```
**주의: user/me와 user 목록의 스키마가 다르다.**
- `/me`: `email` 없음, `role` 없음, `room{id,name}` 있음 (room = 워크스페이스)
- 목록: `email` 있음, `role` 있음, `room` 없음

---

### 팀 (Team)

> 비즈니스: 영업팀 그룹. 고객/딜의 "팀" 필드로 할당. 팀별 성과 분석에 활용.

```
GET /v2/team  (Query: cursor)
```
검증된 응답:
```json
{"id": "bc1dbb51-...", "name": "테스트팀", "description": "1", "teammateList": [{"id": "834f235b-...", "name": "양시열_IXYF"}]}
```

---

### 이메일 (Email)

> 비즈니스: 고객과 주고받은 이메일 내역. 수동 발송 + 시퀀스 자동 발송 모두 포함.
> 이메일 ID는 액티비티에서 `type: "email"` 항목의 `emailId`로 얻을 수 있다.

#### 단일 조회
```
GET /v2/email/<emailId>
Response: { email: { id, subject, from, to, cc, bcc, status, messageId, date } }
```

실제 응답 예시:
```json
{
  "success": true,
  "data": {
    "email": {
      "id": "cb17cbe4-36a4-4bd0-8cba-8618bf46665a",
      "subject": "김지훈님이 나를 협찬 유입 콜/메일 세일즈 가이드라인 워크스페이스에 초대했습니다.",
      "from": "notify@mail.notion.so",
      "to": ["siyeolyang@salesmap.kr"],
      "cc": [],
      "bcc": [],
      "status": "delivery",
      "messageId": "<20250116155712.f74695f6c053ac51@mail.notion.so>",
      "date": "2025-01-16T15:57:12.000Z"
    }
  }
}
```

**이메일 스키마:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 이메일 ID |
| subject | string | 제목 |
| from | string | 발신자 이메일 주소 |
| to | string[] | 수신자 목록 |
| cc | string[] | 참조 목록 |
| bcc | string[] | 숨은참조 목록 |
| status | string | 발송 상태. `"delivery"` 등 |
| messageId | string | RFC 2822 Message-ID 헤더 |
| date | datetime | 발송/수신 일시 |

**이메일 조회 플로우:**
1. 고객 액티비티에서 `type: "email"` 항목의 `emailId` 확보
2. `GET /v2/email/{emailId}`로 상세 조회

**이메일 본문(body) 미제공:** 문서에는 `body` 필드가 있다고 되어있으나, 실제 5건 테스트 결과 body/htmlBody/content 필드 **전혀 없음**. 메타데이터만 조회 가능. (개발팀 문의 필요)
**날짜 필드명:** 문서에는 `sentAt`이지만 실제는 **`date`**.

**목록 조회 (`GET /v2/email`)는 존재하지 않음 (404). 반드시 개별 ID로 조회해야 한다.**

잘못된 ID 시: `{ "success": false, "reason": "이메일을 찾을 수 없습니다." }`

---

### 시퀀스 (Sequence)

> 비즈니스: 자동화된 이메일 캠페인. 잠재 고객에게 시간차를 두고 이메일을 자동 발송하고, 오픈/클릭/회신을 추적.
>
> **영업 자동화의 핵심 도구:**
> - 콜드 메일 시퀀스: 신규 잠재 고객에게 단계별 접근
> - 팔로우업 시퀀스: 미팅 후 후속 조치 자동화
> - 리텐션 시퀀스: 기존 고객 재접촉
>
> **시퀀스 구조:** 시퀀스 → 단계(Step) → 고객 등록(Enrollment) → 타임라인(Timeline)

#### 목록 조회
```
GET /v2/sequence
Response: { sequenceList: [...] }
```
검증된 응답 예시:
```json
{"_id": "c90a3588-5d50-4f03-a257-565d0313a6b6", "name": "직접 만들기", "description": "이메일 및 필요한 작업을 직접 추가해보세요", "createdAt": "2025-10-02T11:13:08.245Z"}
{"_id": "019bfe67-d245-7555-8c11-6c35cf1e47e3", "name": "콜드 메일", "description": "잠재 고객에게 유용한 자료를 제공해 신뢰를 쌓고, 미팅 기회를 만드는 시퀀스입니다", "createdAt": "2026-01-27T..."}
```
**주의: `_id` 사용 (`id` 아님).**

#### 단일 조회
```
GET /v2/sequence/<sequenceId>
Response: { _id, name, description, createdAt }
```

#### 단계 조회 (Step)
```
GET /v2/sequence/<sequenceId>/step
Response: { stepList: [...] }
```
> 시퀀스의 각 단계 정의. "이 시퀀스가 며칠 간격으로 뭘 하는지" 파악.

실제 응답 예시 (콜드 메일 시퀀스 — 3단계):
```json
{
  "stepList": [
    {
      "id": "...",
      "index": 0,
      "type": "sendEmail",
      "executeImmediately": false,
      "businessDay": 3,
      "executionTime": "0900"
    },
    {
      "id": "...",
      "index": 1,
      "type": "sendEmail",
      "executeImmediately": false,
      "businessDay": 6,
      "executionTime": "0900"
    },
    {
      "id": "...",
      "index": 2,
      "type": "createTodo",
      "executeImmediately": false,
      "businessDay": 1,
      "executionTime": "0900"
    }
  ]
}
```

**Step 스키마:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 단계 ID |
| index | number | 순서 (0부터) |
| type | string | `"sendEmail"` (이메일 발송) 또는 `"createTodo"` (TODO 자동 생성) |
| executeImmediately | boolean | 즉시 실행 여부 |
| businessDay | number | 이전 단계로부터 대기 영업일 수 |
| executionTime | string | 실행 시각 (`"0900"` = 오전 9시) |

**비즈니스 해석 예시:**
위 콜드 메일 시퀀스는:
1. 등록 후 3영업일 → 오전 9시에 첫 이메일 발송
2. 6영업일 후 → 후속 이메일 발송
3. 1영업일 후 → 전화 TODO 자동 생성 (담당자에게 "전화해라" 리마인더)

#### 등록 목록 조회 (Enrollment)
```
GET /v2/sequence/<sequenceId>/enrollment  (Query: cursor)
Response: { sequenceEnrollmentList: [...] }
```
> 이 시퀀스에 등록된 고객 목록. "이 시퀀스에 몇 명이 등록되어 있지?"

검증된 응답:
```json
{"_id": "258b4b4d-...", "peopleId": "0199799b-...", "createdAt": "2025-10-02T11:18:38.790Z"}
```

**Enrollment 스키마:** `{ _id, peopleId, createdAt }`
- `_id` 사용 (`id` 아님)
- `status`, `currentStepOrder` 같은 필드는 없음 (개발팀 문의 필요)

#### 등록 타임라인 조회 (Timeline)
```
GET /v2/sequence/enrollment/<enrollId>/timeline  (Query: cursor)
Response: { timelineList: [...] }
```
> 특정 고객의 시퀀스 진행 상황. "이메일 보냈나? 열었나? 링크 클릭했나? 회신했나?"

실제 응답 예시:
```json
// 이메일 발송
{"eventType": "sendEmail", "stepIndex": 0, "date": "2025-11-27T09:32:25.000Z"}

// 이메일 오픈 (여러 번 기록됨)
{"eventType": "emailOpen", "stepIndex": 0, "date": "2025-11-27T10:11:16.000Z"}
{"eventType": "emailOpen", "stepIndex": 0, "date": "2025-11-29T00:34:13.000Z"}

// 이메일 내 링크 클릭
{"eventType": "emailLinkClick", "stepIndex": 0, "date": "2026-02-09T09:50:16.000Z", "linkUrl": "https://salesmap.kr/email-notification/link?redirectTo=...", "linkName": "1: \"템플릿 확인하기\""}

// 이메일 회신
{"eventType": "emailReply", "stepIndex": 0, "date": "2026-02-25T06:10:11.000Z"}
```

**Timeline eventType 목록:**

| eventType | 의미 | 비즈니스 시그널 |
|-----------|------|---------------|
| `sendEmail` | 이메일 발송됨 | 시퀀스 단계 실행 확인 |
| `emailOpen` | 이메일 오픈됨 (여러 번 가능) | 관심 있음. 오픈 횟수가 높으면 적극 관심 |
| `emailLinkClick` | 이메일 내 링크 클릭 | 강한 관심 시그널. CTA가 효과적 |
| `emailReply` | 이메일 회신 | 가장 강한 시그널. 즉시 개인화 follow-up 필요 |

**Timeline 스키마:** `{ eventType, stepIndex, date, emailId, linkUrl?, linkName? }`
- `emailId`: 해당 이벤트와 관련된 이메일 ID (`GET /v2/email/{emailId}`로 상세 조회 가능)
- `linkUrl`, `linkName`은 `emailLinkClick`일 때만 존재
- `stepIndex`로 어느 단계의 이메일에 대한 반응인지 파악

**문서 vs 실제 차이:**

| 항목 | 문서 | 실제 |
|------|------|------|
| 리스트 키 | `enrollmentList` | **`sequenceEnrollmentList`** |
| Enrollment ID | `id` | **`_id`** |
| Enrollment 상태 | `status` 존재 | **없음** |
| Enrollment 등록일 | `enrolledAt` | **`createdAt`** |
| Timeline 이벤트 유형 | `type` | **`eventType`** |
| Timeline 단계 | `stepOrder` | **`stepIndex`** (0-based) |
| Timeline 시간 | `createdAt` | **`date`** |
| Timeline ID | `id` 존재 | **없음** |

**시퀀스 분석 플로우:**
1. `GET /v2/sequence` → 시퀀스 목록
2. `GET /v2/sequence/{id}/step` → 각 단계 구성 파악
3. `GET /v2/sequence/{id}/enrollment` → 등록된 고객 목록
4. `GET /v2/sequence/enrollment/{enrollId}/timeline` → 개별 고객 반응 분석
5. 오픈만 하고 클릭 없으면 → 본문/CTA 개선 필요
6. 클릭은 있지만 회신 없으면 → 다음 메일에서 직접 미팅 제안
7. 회신 있으면 → 시퀀스 성공, 1:1 대응으로 전환

---

## 히스토리/액티비티 URL 패턴

**반드시 slash notation. dot notation은 전부 404.**

```
/v2/people/history          /v2/people/activity
/v2/organization/history    /v2/organization/activity
/v2/deal/history            /v2/deal/activity
/v2/lead/history            /v2/lead/activity
/v2/custom-object/history   /v2/custom-object/activity
```

### 히스토리 총정리

> "무엇이 언제 어떻게 바뀌었나?" — 필드 변경 감사(audit) 로그.

**공통 스키마:** `{ id, [objectType]Id, type, fieldName, fieldValue, ownerId, createdAt }`

**type 값 정리:**

| type | 의미 | 어떤 오브젝트에서 |
|------|------|-----------------|
| `editField` | 필드 값 변경 | 모든 오브젝트 |
| `editOrganizationConnect` | 회사 연결 변경 | People, Deal, Lead |
| `editPeopleConnection` | 고객 연결 변경 | Deal, Lead |

**오브젝트별 차이:**
- **People**: `organization` 필드 추가 (`{_id, name}` 또는 `null`)
- **Deal/Lead**: `people`, `organization` 필드 추가
- **Organization/Custom Object**: 추가 필드 없음

**fieldValue 타입별 형태:**
- 텍스트: `"박일환"`
- 숫자: `0`, `50000`
- 불린: `true`, `false`
- 관계: `{"_id": "uuid", "name": "이름"}`

### 액티비티 총정리

> "이 오브젝트에 어떤 일이 있었나?" — 이벤트 타임라인.

**공통 스키마:** `{ id, type, date, [objectType]Id, emailId, messageId, threadId, smsId, memoId, todoId }`

**type 값 정리:**

| type | 의미 | 관련 ID |
|------|------|--------|
| `create` | 오브젝트 생성 | — |
| `email` | 이메일 수신/발신 | `emailId` |
| `emailOpen` | 이메일 오픈 추적 | `emailId` |
| `memoCreate` | 메모 생성 | `memoId` |
| `todoCreate` | TODO 생성 | `todoId` |
| `webFormSubmit` | 웹폼 제출 | `webFormId`, `webFormName` |
| `meeting` | 미팅 | — |

**오브젝트별 추가 필드:**
- **People**: `+ documentId, documentName, webFormId, webFormName`
- **Deal**: `+ dealStatus, webFormId, webFormName`
- **Organization/Lead**: `+ webFormId, webFormName`
- **Custom Object**: `+ meetingId, kakaoAlimtalkId, emailLinkId` (webFormId **없음**)

---

## 삭제 API 패턴

모든 삭제는 동일한 패턴:

```
POST /v2/{resource}/delete
```

| 리소스 | 엔드포인트 | 라우트 존재 | 비고 |
|--------|-----------|-----------|------|
| 고객 | `POST /v2/people/delete` | O (400) | body 파라미터 미공개 |
| 회사 | `POST /v2/organization/delete` | O (400) | body 파라미터 미공개 |
| 딜 | `POST /v2/deal/delete` | O (400) | body 파라미터 미공개 |
| 리드 | `POST /v2/lead/delete` | O (400) | body 파라미터 미공개 |
| 커스텀 오브젝트 | `POST /v2/custom-object/delete` | O (400) | body 파라미터 미공개 |

**중요:**
- `POST /v2/{resource}/{id}/delete` (path에 ID) → **404**. 작동하지 않음.
- `DELETE /v2/{resource}/{id}` → **405** `"Invalid Request Method"`. REST 표준 방식 미지원.
- 라우트 자체는 존재하지만 body 파라미터 형식이 공개되지 않아 사용 불가. → **개발팀 문의 필요**

---

## 웹훅 (Webhook)

> 비즈니스: 세일즈맵에서 이벤트 발생 시 외부 시스템에 실시간 알림. 자동화 파이프라인의 트리거.

### 설정
- 세일즈맵 설정 > 웹훅에서 URL 등록 및 구독 이벤트 선택
- 타임아웃: 10초 이내 응답 필요
- 재시도: 실패 시 10분 간격, 최대 10회
- 서명 검증: 현재 미제공

### 페이로드
```json
{
  "event": "생성",                      // "생성" | "수정" | "삭제" | "병합"
  "occurredAt": "2026-01-11T15:00:00.000Z",
  "source": "사용자",                    // API | 시스템 | 데이터 가져오기 | 시퀀스 | 웹 폼 | 워크플로우 | 사용자 | 고객
  "sourceId": "<userId>",               // source에 따라 다른 ID. 시스템이면 null
  "objectType": "딜",                    // 딜 | 리드 | 고객 | 회사 | 커스텀 오브젝트명
  "customObjectDefinitionId": null,      // 커스텀 오브젝트인 경우에만
  "objectId": "<dealId>",
  "eventId": "<eventId>",               // 동일 행위로 여러 웹훅 발생 시 같은 ID
  "fieldName": "이름",                   // event="수정"일 때만
  "beforeField": "이전 값",              // event="수정"일 때만
  "afterField": "새 값"                  // event="수정"일 때만
}
```

### beforeField / afterField 형태

| 필드 유형 | 값 형태 | 예시 |
|-----------|---------|------|
| 비어있음 | `null` | `null` |
| 암호화 | `"암호화된 데이터"` | 상수 |
| True/False | `boolean` | `true` |
| 날짜 | `string` | `"2024-04-16"` |
| 날짜(시간) | `string` | `"2024-04-16 오전 07시 18분"` |
| 숫자 | `number` | `12000` |
| 텍스트 / 단일선택 | `string` | `"서울시 강남구"` |
| 복수 선택 | `string[]` | `["내과", "외과"]` |
| 관계(단일) | `{id, name}` | `{"id": "<id>", "name": "이름"}` |
| 관계(복수) | `[{id, name}]` | `[{"id": "<id>", "name": "이름"}]` |

**파이프라인 단계 변경 시 `afterField`는 객체:** `{"id": "<stageId>", "name": "단계명"}` → `afterField.name`으로 접근

### eventId 동작
- 고객 생성 → `생성` + `수정` 웹훅이 동일 eventId
- 고객 병합 → `삭제` + `병합` 웹훅이 동일 eventId

### 구독 가능한 이벤트
고객/회사/리드/딜: 생성, 수정, 삭제, 병합
커스텀 오브젝트: 생성, 수정, 삭제 (병합 없음)

### 핸들러 패턴
```javascript
app.post('/webhook/salesmap', (req, res) => {
  res.status(200).json({ success: true });  // 즉시 응답
  processWebhook(req.body).catch(console.error);
});
```

---

## 공통 에러

```json
{"success": false, "message": "Unauthorized"}
{"success": false, "message": "Bad Request", "reason": "구체적 사유"}
{"success": false, "message": "Too Many Requests"}
{"success": false, "message": "Not Found"}
{"success": false, "message": "Invalid parameters"}
{"message": "Unexpected Server Error"}
```

검증된 특수 에러:
```json
// 회사명 중복
{"success": false, "message": "Bad Request", "reason": "중복되는 이름을 가진 기업이 존재합니다.", "data": {"id": "<orgId>", "name": "회사명"}}

// fieldList에 미등록 옵션값
{"success": false, "message": "Bad Request", "reason": "people 유입경로에 정의 되지 않은 값을 입력했습니다."}

// 딜 금액을 fieldList에 넣었을 때
{"success": false, "message": "Bad Request", "reason": "금액 값은 fieldList이 아닌 파라메터 입니다."}

// 이메일 단일 조회 - 없는 ID
{"success": false, "message": "Bad Request", "reason": "이메일을 찾을 수 없습니다."}

// Search API - 빈 문자열 value
{"success": false, "message": "Bad Request", "reason": ["[filterGroupList,0,filters,0,value]: 필수 입력 사항입니다."]}

// 리드 생성 - peopleId/organizationId 둘 다 없음
{"success": false, "message": "Bad Request", "reason": "[refine]: PeopleId 또는 OrganizationId를 입력해주세요."}

// 삭제 - body 파라미터 누락
{"success": false, "message": "Bad Request", "reason": "고객을 찾을 수 없습니다."}

// REST DELETE 메서드
{"success": false, "message": "Invalid Request Method"}
```

---

## 베스트 프랙티스

1. **요청 간격**: 0.1~0.15초 (rate limit 방지)
2. **배치 처리**: 5개씩 `Promise.allSettled`
3. **웹훅 응답**: 10초 내 200 응답, 처리는 비동기
4. **중복 이벤트**: `eventId + objectId`로 감지
5. **회사 중복**: 생성 실패 시 에러의 `data.id`로 기존 회사 활용
6. **필드명**: 세일즈맵 UI의 한글 이름과 정확히 일치
7. **URL 패턴**: 히스토리/액티비티는 slash notation만 작동
8. **시퀀스 ID**: `_id` 사용 (`id` 아님)
9. **Field API**: `GET /v2/field/{type}`으로 필드 정의 동적 조회
10. **딜 금액**: `price` top-level 파라미터로 전달 (fieldList 아님)
11. **이메일 조회**: 액티비티에서 `emailId` 확보 → `GET /v2/email/{id}` 개별 조회
12. **시퀀스 분석**: 목록 → step → enrollment → timeline 순서로 drill-down
13. **고객 이메일 검색**: 상세 필드 필요하면 `people-temp`, 조건 검색이면 `Search Record API`

---

## 개발팀 문의 필요 목록

> 2026-02-27 실제 API 호출로 전면 검증한 결과.
> **A**: 문서에 있는데 안 되는 것 (버그 의심)
> **B**: 없으면 AI 에이전트가 핵심 기능을 못하는 것 (기능 요청)
> **C**: 있으면 좋은 것 (개선 제안)

---

### A. 문서에 있는데 안 되는 것 (버그 의심)

| # | 항목 | 문서 내용 | 실제 결과 | 영향 |
|---|------|----------|----------|------|
| A1 | **딜 삭제 API** | `POST /v2/deal/<dealId>/delete` | **404** (라우트 없음). `POST /v2/deal/delete`는 400 반환하지만 body 형식 미공개 | 모든 오브젝트 삭제 불가. 잘못 생성한 레코드 정리 못함 |
| A2 | **이메일 본문(body)** | 응답에 `body` 필드 존재 | **없음**. subject/from/to/status/date만 반환 | 에이전트가 이메일 내용 분석 불가. "이 고객에게 뭐라고 메일 보냈지?" 답변 못함 |
| A3 | **이메일 날짜 필드명** | `sentAt` | 실제는 **`date`** | 필드명 불일치 |
| A4 | **시퀀스 enrollment 필드** | `id`, `status`, `currentStepOrder`, `enrolledAt` | 실제는 **`_id`, `createdAt`만**. status/currentStepOrder 없음 | "이 고객 시퀀스 진행 중이야? 몇 단계까지 갔어?" 답변 불가 |
| A5 | **시퀀스 enrollment 리스트 키** | `enrollmentList` | 실제는 **`sequenceEnrollmentList`** | 문서대로 파싱하면 에러 |
| A6 | **시퀀스 timeline 필드명** | `type`, `stepOrder`, `createdAt`, `id` | 실제는 **`eventType`, `stepIndex`, `date`**, id 없음 | 문서대로 파싱하면 에러 |
| A7 | **견적서 목록 조회** | `GET /v2/quote` | **500 서버 에러** | 딜/리드 경유로만 견적서 접근 가능 |
| A8 | **시퀀스 timeline 일부 500** | 정상 조회 | 특정 enrollment에서 `Unexpected Server Error` | 일부 고객의 시퀀스 추적 데이터 조회 불가 |

---

### B. 없으면 AI 에이전트가 핵심 기능 못하는 것 (기능 요청)

| # | 항목 | 현재 상황 | AI 에이전트에 필요한 이유 |
|---|------|----------|------------------------|
| B1 | **TODO 생성 API** | 읽기만 가능. `POST /v2/todo` → 500 | 에이전트가 "내일 이 고객에게 전화해" 같은 follow-up 자동 생성 못함. 시퀀스 createTodo step으로만 가능한데, 그건 시퀀스에 묶여있어 유연하지 않음 |
| B2 | **시퀀스 등록(enrollment) 생성 API** | 없음. `POST /v2/sequence/enrollment` → 500 | "이 고객을 콜드메일 시퀀스에 등록해줘" 불가. 영업 자동화의 핵심인데 API로 시작을 못함 |
| B3 | **커스텀 오브젝트 Definition 목록 조회** | 없음. 각 레코드의 `customObjectDefinitionId`에서 역추론만 가능 | "우리 워크스페이스에 어떤 커스텀 오브젝트 타입이 있지?" 프로그래밍적으로 파악 불가. MCP가 커스텀 오브젝트를 동적으로 다루려면 definition 목록+이름 조회 필수 |
| B4 | **이메일 목록 조회** | 없음. `GET /v2/email` → 404 | 고객별 이메일 히스토리를 보려면 activity에서 emailId를 하나씩 수집 → 개별 조회해야 함. "이 고객과 주고받은 이메일 전체 보여줘"가 매우 비효율적 |
| B5 | **리드→딜 전환 API** | 없음 (추정) | "이 리드 검증됐으니 딜로 전환해줘" 자동화 불가. 리드 삭제 + 딜 생성으로 우회해야 하는데, 삭제도 안 됨 |
| B6 | **고객 전화번호 검색** | `people-temp`은 이메일만. Search Record API의 전화 검색은 `EQ`만 (부분일치 불가) | 전화 인바운드 시 발신자 매칭이 어려움. 전화번호 뒷자리나 하이픈 유무 등 유연한 검색 필요 |

---

### C. 있으면 좋은 것 (개선 제안)

| # | 항목 | 현재 상황 | 개선되면 좋은 이유 |
|---|------|----------|-------------------|
| C1 | `/v2/user/me`에 `email` 필드 | 목록 조회에는 있지만 me에는 없음 | 현재 API 사용자의 이메일을 알려면 user 목록에서 본인을 찾아야 함 |
| C2 | `GET /v2/field/memo`, `field/sequence` | `Invalid parameters` | 메모/시퀀스 필드 정의를 동적으로 파악 불가 |
| C3 | Search Record API `custom-object` 지원 | `Invalid targetType` | 커스텀 오브젝트 조건 검색 불가 |
| C4 | 메모 목록 정렬 순서 | `createdAt` 오름차순 (오래된 순) | 최신 메모부터 보고 싶으면 마지막 페이지까지 가야 함. 내림차순 옵션 필요 |
| C5 | SMS/미팅/문서/카카오알림톡 API | 모두 404 | 액티비티에 `smsId`, `meetingId`, `kakaoAlimtalkId` 등은 나오는데 상세 조회 API가 없음 |