# 채널톡 Open API 레퍼런스

> 세일즈맵 CRM 연동을 위해 정리한 채널톡 Open API 레퍼런스.
> 원본 Swagger: `docs/channel-talk-swagger.json` (v27.40.6, 113 endpoints)
> 공식 문서: https://developers.channel.io/docs/authentication-2

---

## 기본 설정

```
Base URL: https://api.channel.io
API Version: v5 (v4도 존재하지만 v5 사용 권장)
Authentication: Access Key + Access Secret (x-access-key, x-access-secret 헤더)
```

공식 인증 가이드: https://developers.channel.io/docs/authentication-2

---

## 핵심 오브젝트

### User (고객/방문자)

채널톡의 "유저" = 세일즈맵의 "고객(People)"에 대응.

| 필드 | 타입 | 설명 | 세일즈맵 매핑 |
|------|------|------|-------------|
| id | string | 채널톡 내부 ID | - |
| memberId | string | 외부 시스템 연동용 고유 ID | RecordId로 활용 가능 |
| type | enum | `member` / `lead` / `unified` | - |
| name | string | 이름 | 이름 |
| email | string | 이메일 | 이메일 |
| mobileNumber | string | 전화번호 | 전화 |
| avatarUrl | string | 프로필 이미지 URL | 프로필 사진 |
| profile | object | 커스텀 프로필 (자유 key-value) | fieldList 매핑 |
| tags | string[] | 유저 태그 | - |
| blocked | boolean | 차단 여부 | 수신 거부 여부 |
| unsubscribeEmail | boolean | 이메일 수신 거부 | - |
| country | string | 국가 | - |
| city | string | 도시 | - |
| sessionsCount | integer | 세션 수 | - |
| lastSeenAt | number | 마지막 접속 (unix ms) | 최근 고객 활동일 |
| createdAt | number | 생성일 (unix ms) | 생성 날짜 |
| updatedAt | number | 수정일 (unix ms) | 수정 날짜 |
| member | boolean | 회원 여부 | - |
| hasChat | boolean | 채팅 이력 존재 여부 | - |

### UserChat (상담 채팅)

채널톡의 "유저챗" = 고객과의 상담 대화.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 채팅 ID |
| userId | string | 유저 ID |
| state | enum | `closed` / `opened` / `snoozed` / `queued` / `initial` / `missed` |
| priority | enum | `low` / `medium` / `high` |
| assigneeId | string | 담당 매니저 ID |
| managerIds | string[] | 참여 매니저 ID 목록 |
| tags | string[] | 채팅 태그 |
| title | string | 채팅 제목 |
| description | string | 채팅 설명 |
| mediumType | enum | `native` / `phone` / `email` / `app` |
| direction | enum | `INBOUND` / `OUTBOUND` |
| createdAt | number | 생성일 (unix ms) |
| openedAt | number | 오픈 시각 |
| closedAt | number | 종료 시각 |
| firstRepliedAt | number | 첫 응답 시각 |
| waitingTime | integer | 대기 시간 (ms) |
| resolutionTime | integer | 해결 시간 (ms) |
| replyCount | integer | 응답 횟수 |

### Manager (매니저/상담원)

| 필드 | 타입 | 설명 | 세일즈맵 매핑 |
|------|------|------|-------------|
| id | string | 매니저 ID | userId |
| name | string | 이름 | 사용자 이름 |
| email | string | 이메일 | - |
| mobileNumber | string | 전화번호 | - |
| roleId | string | 역할 ID | - |

### Webhook

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 웹훅 ID |
| name | string | 웹훅 이름 |
| url | string | 콜백 URL |
| token | string | 인증 토큰 |
| scopes | string[] | 구독 이벤트 스코프 |
| keywords | string[] | 키워드 필터 |
| blocked | boolean | 차단 여부 |

---

## 엔드포인트 (v5)

### User (고객) — 21 endpoints

#### 생성
```
POST /open/v5/users
Response: UserView
```
프로필 기반으로 lead 유저 생성.

#### 단일 조회 (userId)
```
GET /open/v5/users/{userId}
Response: UserView
```

#### 단일 조회 (memberId)
```
GET /open/v5/users/@{memberId}
Response: UserView
```
외부 시스템 연동 ID로 조회.

#### 수정 (userId)
```
PATCH /open/v5/users/{userId}
Body: user.User (부분 업데이트)
Response: UserView
```

#### Upsert (memberId)
```
PUT /open/v5/users/@{memberId}
Body: user.User
Response: UserView
```
memberId 기준으로 없으면 생성, 있으면 업데이트. **연동 시 핵심 API.**

#### 삭제
```
DELETE /open/v5/users/{userId}
DELETE /open/v5/users/@{memberId}
```

#### 차단/해제
```
POST /open/v5/users/{userId}/block
DELETE /open/v5/users/{userId}/block
```

#### Touch (활동 기록)
```
POST /open/v5/users/{userId}/touch
Response: UserView
```

---

### User Chat (상담) — 35 endpoints

#### 유저의 채팅 목록
```
GET /open/v5/users/{userId}/user-chats
Query: sortOrder (required), since?, limit?
Response: SessionBasedUserChatsView
```

#### 채팅 생성
```
POST /open/v5/users/{userId}/user-chats
Response: UserChatView
```

#### 전체 채팅 목록 (managed)
```
GET /open/v5/user-chats
Query: state?, sortOrder?, since?, limit?
Response: ChatBasedUserChatsView
```

#### 채팅 단일 조회
```
GET /open/v5/user-chats/{userChatId}
Response: UserChatView
```

#### 채팅 수정 (설명 업데이트)
```
PATCH /open/v5/user-chats/{userChatId}
Body: userchat.UserChat
Response: UserChatView
```

#### 매니저 배정
```
PATCH /open/v5/user-chats/{userChatId}/assign-to/managers/{managerId}
Query: botName (required)
Response: UserChatView
```

#### 채팅 오픈/종료/스누즈
```
PUT /open/v5/user-chats/{userChatId}/open
PATCH /open/v5/user-chats/{userChatId}/close
PUT /open/v5/user-chats/{userChatId}/snooze  (Query: duration, botName)
```

#### 메시지 목록 조회
```
GET /open/v5/user-chats/{userChatId}/messages
Query: sortOrder (required), since?, limit?
Response: MessagesView { prev, next, messages[], bots[] }
```

#### 메시지 발송
```
POST /open/v5/user-chats/{userChatId}/messages
Query: botName?
Body: message.OpenMessageCreateRequest
Response: MessageView
```

#### 매니저 초대
```
PATCH /open/v5/user-chats/{userChatId}/invite
Query: botName (required), managerIds[]?
Response: UserChatView
```

#### Cases 조회
```
GET /open/v5/user-chats/cases
Query: from (required, unix ms), to (required, unix ms), since?, limit?, sortOrder?
Response: UserChatCasesViewV5
```

---

### Event (이벤트) — 6 endpoints

#### 이벤트 목록
```
GET /open/v5/users/{userId}/events
Query: sortOrder (required), since?, limit?
Response: EventsView { prev, next, events[] }
```

#### 이벤트 생성
```
POST /open/v5/users/{userId}/events
Body: Event { name, property }
Response: EventView
```

#### 이벤트 삭제
```
DELETE /open/v5/users/{userId}/events/{eventId}
```

---

### Webhook — 10 endpoints

#### 목록
```
GET /open/v5/webhooks
Query: since?, limit?
Response: WebhooksView { next, webhooks[] }
```

#### 생성
```
POST /open/v5/webhooks
Body: webhook.Webhook { name, url, scopes[], keywords[]? }
Response: WebhookView
```

#### 조회/수정/삭제
```
GET /open/v5/webhooks/{id}
PATCH /open/v5/webhooks/{id}   Body: webhook.Webhook
DELETE /open/v5/webhooks/{id}
```

---

### 기타 주요 엔드포인트

#### Manager (매니저)
```
GET /open/v5/managers                           — 매니저 목록
GET /open/v5/managers/{managerId}               — 매니저 상세
PUT /open/v5/managers/{managerId}/status         — 상태 변경
```

#### Channel (채널 정보)
```
GET /open/v5/channel                            — 채널 정보 조회
```

#### Chat Tag (상담 태그)
```
GET /open/v5/chat-tags                          — 태그 목록
POST /open/v5/chat-tags                         — 태그 생성
PATCH /open/v5/chat-tags/{id}                   — 태그 수정
DELETE /open/v5/chat-tags/{id}                  — 태그 삭제
```

#### Bot
```
GET /open/v5/bots                               — 봇 목록
POST /open/v5/bots                              — 봇 생성
DELETE /open/v5/bots/{botId}                    — 봇 삭제
```

#### Marketing
```
GET /open/v5/mkt/campaigns                      — 캠페인 목록
GET /open/v5/mkt/campaigns/{id}                 — 캠페인 상세
GET /open/v5/mkt/one-time-msgs                  — 일회성 메시지 목록
GET /open/v5/mkt/one-time-msgs/{id}             — 일회성 메시지 상세
```

---

## 페이지네이션

- 커서 기반: `since` (커서 값) + `limit` (페이지 크기)
- `sortOrder`: `asc` / `desc`
- 응답의 `next` / `prev` 필드가 다음/이전 커서 값

---

## 날짜/시간 형식

- 모든 날짜는 **Unix milliseconds** (number)
- 예: `1709000000000` = 2024-02-27T...

---

## 세일즈맵 ↔ 채널톡 연동 시 참고

### 데이터 매핑 포인트
| 채널톡 | 세일즈맵 | 비고 |
|--------|---------|------|
| User | People (고객) | 이름/이메일/전화 기본 매핑 |
| User.profile | fieldList | 커스텀 프로필 → 커스텀 필드 |
| User.tags | 커스텀 필드 (복수선택) | 태그 동기화 |
| UserChat | 메모 or 액티비티 | 상담 내역 기록 |
| Manager | User (사용자) | 담당자 매핑 |
| Webhook | 웹훅 | 실시간 동기화 트리거 |

### 연동 방향
1. **채널톡 → 세일즈맵**: 웹훅으로 신규 유저/상담 감지 → 세일즈맵에 고객/메모 생성
2. **세일즈맵 → 채널톡**: 세일즈맵 웹훅으로 변경 감지 → 채널톡 User upsert
3. **양방향 동기화**: 양쪽 웹훅 + memberId 기반 매핑

### 핵심 연동 API
- `PUT /open/v5/users/@{memberId}` — memberId 기반 upsert (세일즈맵 ID를 memberId로 사용)
- `GET /open/v5/users/{userId}/user-chats` — 고객의 상담 이력 조회
- `GET /open/v5/user-chats/{id}/messages` — 상담 메시지 내용 조회
- `POST /open/v5/webhooks` — 실시간 동기화용 웹훅 등록
