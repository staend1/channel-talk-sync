# 채널톡 ↔ 세일즈맵 연동기 (Warsaw)

> 최종 작업: 2026-03-03

## 요약

채널톡 종료 상담 → Gemini AI 요약 → 세일즈맵 커스텀 오브젝트 자동 생성

## 문서

- `docs/PRD.md` — 상세 요구사항, 데이터 플로우, 필드 매핑
- `docs/channel-talk-api-reference.md` — 채널톡 API 참조
- `docs/channel-talk-swagger.json` — 채널톡 OpenAPI 스펙

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `src/lib/channel-talk.ts` | 채널톡 API 클라이언트 |
| `src/lib/salesmap.ts` | 세일즈맵 API 클라이언트 |
| `src/lib/gemini.ts` | Gemini AI 분석 (요약+분류) |
| `src/lib/formatter.ts` | 대화 포맷터 |
| `src/lib/sync.ts` | 메인 동기화 오케스트레이터 |
| `src/lib/store.ts` | 파일 기반 상태 저장소 |
| `src/lib/test-sync.ts` | 테스트 스크립트 |

## 주요 ID

- 채널톡 커스텀 오브젝트 definitionId: `019cb198-7afc-7aac-b557-e1fce57a0946`
- 워크스페이스 커스텀 오브젝트 definitionId: `019abec5-514f-7dd2-8f0d-8650835719cf`

## 현재 상태

- E2E 테스트 성공 (3건 종료 상담 처리 완료)
- 테스트 레코드 세일즈맵에 생성됨 (삭제 필요)
- [ ] 세일즈맵 채널톡 정의에 people 연결 필드 추가 필요
- [ ] Vercel Cron 라우트 추가
- [ ] 파일 스토어 → Supabase 교체

## 실전 노트

- 세일즈맵 `문의 유형`, `기능 카테고리`는 **multiSelect** → `stringValueList` 사용
- 채널톡 정의에 people 필드(요청자/참조 대상/챔피언) 없음 → 고객 자동 연결 불가
- 채널톡에 `userChat.closed` 웹훅 스코프 없음 → 폴링 방식 채택
- Gemini 응답이 잘릴 수 있음 → maxOutputTokens=8000 + 잘린 JSON 복구 로직
