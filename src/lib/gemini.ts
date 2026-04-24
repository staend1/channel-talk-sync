const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const INQUIRY_TYPE_OPTIONS = ["사용법 문의", "기능 요청", "버그 제보"] as const;

const CATEGORY_LARGE_OPTIONS = [
  "AI 기능", "자동화", "차트 & 대시보드", "이메일", "필드 & 계산 필드",
  "노트", "뷰 & 레이아웃", "파이프라인 & 레코드", "웹 폼", "견적서 & 상품",
  "문서 & 전자계약", "커스텀 오브젝트", "연결 관계", "미팅 & 캘린더", "연동 · API",
  "데이터 임포트/익스포트", "사용자 · 권한 · 팀", "검색 & 필터", "모바일 & 앱",
  "결제 & 크레딧", "고객 · 회사 관리", "알림 · 커뮤니케이션", "전역 UI/UX",
  "첨부파일", "기타",
] as const;

const CATEGORY_MEDIUM_OPTIONS = [
  // AI 기능
  "AI 인사이트", "세일로", "명함 스캔", "녹음·STT",
  // 자동화
  "워크플로우 트리거·액션", "이메일 발송", "시퀀스 연계", "시퀀스 발송·수신·운영·오류",
  // 차트 & 대시보드
  "차트 유형", "축·분류", "필터", "스타일", "기간 비교", "KPI", "대시보드",
  // 이메일
  "발송·예약", "에디터", "템플릿", "참조", "열람·통계", "첨부",
  // 필드 & 계산 필드
  "계산 필드", "선택 옵션", "제약(unique 등)", "커스텀 필드",
  // 노트
  "유형·분류", "전파", "댓글",
  // 뷰 & 레이아웃
  "리스트", "칸반", "상세 화면", "미리보기", "레이아웃",
  // 파이프라인 & 레코드
  "파이프라인 설정", "레코드 병합·복제·일괄 편집",
  // 웹 폼
  "답변 유형", "자동화", "트래킹", "필드 매칭",
  // 견적서 & 상품
  "템플릿", "통화", "레이아웃", "승인", "원가 롤업",
  // 문서 & 전자계약
  "모두싸인", "문서 열람",
  // 커스텀 오브젝트
  "커스텀 오브젝트 생성·필드·연결",
  // 연결 관계
  "레코드 연결", "관계 필드",
  // 미팅 & 캘린더
  "미팅 기록", "캘린더 연동",
  // 연동 · API
  "API", "웹훅", "슬랙", "바로빌", "채널톡", "카톡·문자", "Gmail", "ERP", "메일",
  // 데이터 임포트/익스포트
  "임포트", "엑셀 추출",
  // 사용자 · 권한 · 팀
  "SSO", "권한", "팀·조직", "역할",
  // 검색 & 필터
  "전역 검색", "필터", "조건 저장",
  // 모바일 & 앱
  "모바일 앱", "반응형",
  // 결제 & 크레딧
  "플랜", "크레딧", "결제",
  // 고객 · 회사 관리
  "고객사", "담당자", "중복 관리",
  // 알림 · 커뮤니케이션
  "알림", "인앱 메시지",
  // 전역 UI/UX
  "테마", "언어", "공통 UX",
  // 첨부파일
  "첨부파일 업로드·관리",
  // 기타
  "테스트/비-VOC", "미분류",
] as const;

export interface GeminiAnalysis {
  shortSummary: string;
  detailedSummary: string;
  inquiryType: string[];
  featureCategoryLarge: string[];
  featureCategoryMedium: string[];
}

/** 잘린 JSON을 복구: 열린 문자열/객체를 닫고 누락된 필드에 기본값 */
function recoverTruncatedJson(str: string): string {
  const lastComplete = Math.max(
    str.lastIndexOf('","'),
    str.lastIndexOf('"],"'),
    str.lastIndexOf('","')
  );

  let truncated = lastComplete > 0 ? str.slice(0, lastComplete) : str;

  const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) truncated += '(잘림)"';

  const openBrackets = (truncated.match(/\[/g) || []).length;
  const closeBrackets = (truncated.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) truncated += "]";

  const openBraces = (truncated.match(/\{/g) || []).length;
  const closeBraces = (truncated.match(/\}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) truncated += "}";

  return truncated;
}

/** JSON 문자열 내부의 리터럴 줄바꿈을 이스케이프 시퀀스로 변환 */
function fixNewlinesInJsonStrings(str: string): string {
  const result: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) { result.push(ch); escape = false; continue; }
    if (ch === "\\" && inString) { result.push(ch); escape = true; continue; }
    if (ch === '"') { inString = !inString; result.push(ch); continue; }
    if (inString && ch === "\n") { result.push("\\n"); continue; }
    if (inString && ch === "\r") { result.push("\\r"); continue; }
    result.push(ch);
  }
  return result.join("");
}

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8000,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const candidate = data.candidates[0];
  if (candidate.finishReason === "MAX_TOKENS") {
    console.warn("[gemini] 응답이 토큰 제한으로 잘렸습니다. 잘린 응답으로 복구 시도합니다.");
  }
  return candidate.content.parts[0].text;
}

/** 대화 분석: 요약 + 분류를 한 번의 호출로 처리 */
export async function analyzeConversation(conversation: string): Promise<GeminiAnalysis> {
  const prompt = `당신은 B2B SaaS CRM(세일즈맵)의 고객 상담 내용을 분석하는 전문가입니다.

아래 고객 상담 대화를 분석해서 JSON으로 반환해주세요.

## 규칙
1. shortSummary: 고객의 핵심 문의를 자연스러운 한국어로 요약. 띄어쓰기는 자연스럽게 포함하되, 공백을 제외한 글자 수가 30자 이내. 예시: "시퀀스 요일별 발송 기능 요청"
2. detailedSummary: 아래 형식으로 상세 요약 작성 (각 항목 1-2문장, 간결하게)
   [채널톡 문의 내용] (고객이 무엇을 물어봤는지)
   [답변 내용] (상담사가 어떻게 답변했는지)
   [후속 조치] (필요한 후속 조치가 있으면 작성, 없으면 "없음")
   각 항목 사이에 빈 줄(\\n\\n) 삽입
3. inquiryType: 해당하는 것 모두 선택 (배열, 최소 1개)
   ${JSON.stringify(INQUIRY_TYPE_OPTIONS)}
4. featureCategoryLarge: 대화와 관련된 대분류 모두 선택 (배열, 최소 1개)
   ${JSON.stringify(CATEGORY_LARGE_OPTIONS)}
5. featureCategoryMedium: 대화와 관련된 중분류 모두 선택 (배열, 최소 1개). 반드시 아래 목록에 있는 값만 사용.
   ${JSON.stringify(CATEGORY_MEDIUM_OPTIONS)}

## 대화 원문
${conversation}

## 응답 형식 (JSON만 반환, 마크다운 코드블록 없이)
- 반드시 한 줄로 된 유효한 JSON을 반환
- detailedSummary 내 줄바꿈은 반드시 \\n으로 표현 (리터럴 줄바꿈 금지)
{"shortSummary":"시퀀스 요일별 발송 기능 요청","detailedSummary":"[채널톡 문의 내용]\\n...\\n\\n[답변 내용]\\n...\\n\\n[후속 조치]\\n없음","inquiryType":["기능 요청"],"featureCategoryLarge":["자동화"],"featureCategoryMedium":["시퀀스 발송·수신·운영·오류"]}`;

  const raw = await callGemini(prompt);

  let jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const startIdx = jsonStr.indexOf("{");
  const endIdx = jsonStr.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    jsonStr = jsonStr.slice(startIdx, endIdx + 1);
  }

  let parsed: GeminiAnalysis;
  try {
    parsed = JSON.parse(jsonStr) as GeminiAnalysis;
  } catch (e1) {
    const cleaned = fixNewlinesInJsonStrings(jsonStr)
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");
    try {
      parsed = JSON.parse(cleaned) as GeminiAnalysis;
    } catch (e2) {
      const recovered = recoverTruncatedJson(cleaned);
      try {
        parsed = JSON.parse(recovered) as GeminiAnalysis;
        console.warn("[gemini] 잘린 JSON 복구 성공");
      } catch {
        console.error("[gemini] JSON 복구 실패. 원본:", JSON.stringify(raw).slice(0, 300));
        throw e2;
      }
    }
  }

  // 유효성 검증 — 목록에 없는 값 제거, 비어있으면 기본값
  parsed.inquiryType = (parsed.inquiryType ?? [])
    .filter((v) => (INQUIRY_TYPE_OPTIONS as readonly string[]).includes(v));
  if (parsed.inquiryType.length === 0) parsed.inquiryType = ["사용법 문의"];

  parsed.featureCategoryLarge = (parsed.featureCategoryLarge ?? [])
    .filter((v) => (CATEGORY_LARGE_OPTIONS as readonly string[]).includes(v));
  if (parsed.featureCategoryLarge.length === 0) parsed.featureCategoryLarge = ["기타"];

  parsed.featureCategoryMedium = (parsed.featureCategoryMedium ?? [])
    .filter((v) => (CATEGORY_MEDIUM_OPTIONS as readonly string[]).includes(v));
  if (parsed.featureCategoryMedium.length === 0) parsed.featureCategoryMedium = ["미분류"];

  return parsed;
}
