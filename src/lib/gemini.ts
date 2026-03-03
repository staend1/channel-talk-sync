const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const CATEGORY_OPTIONS = [
  "노트", "검색", "다국어", "데이터 업로드", "데이터 필드 관리",
  "레이아웃", "목록/파이프라인", "마케팅 이메일", "문서", "미리보기",
  "미팅", "병합", "뷰(필터/정렬/컬럼)", "사용자 관리", "상세 페이지",
  "상품/견적서", "시퀀스", "알림", "에디터", "연동",
  "워크플로우", "웹 폼", "이메일", "차트/대시보드",
  "커스텀 오브젝트", "AI", "UX/UI", "API/웹훅", "TODO/캘린더",
  "타임라인/히스토리", "SMS/알림톡", "권한", "기타", "그룹", "모바일",
] as const;

const INQUIRY_TYPE_OPTIONS = ["사용법 문의", "기능 요청", "버그 제보"] as const;

export interface GeminiAnalysis {
  /** 공백 제외 30자 이내 요약 */
  shortSummary: string;
  /** 상세 요약 (노트 앞부분) */
  detailedSummary: string;
  /** 문의 유형 */
  inquiryType: string;
  /** 기능 카테고리 */
  featureCategory: string;
}

/** 잘린 JSON을 복구: 열린 문자열/객체를 닫고 누락된 필드에 기본값 */
function recoverTruncatedJson(str: string): string {
  // 마지막으로 완성된 key-value 쌍까지만 남기고 나머지 자름
  // 패턴: ,"key":"value" 또는 ,"key":["value"]
  const lastComplete = Math.max(
    str.lastIndexOf('","'),
    str.lastIndexOf('"],"'),
    str.lastIndexOf('","')
  );

  let truncated = lastComplete > 0 ? str.slice(0, lastComplete) : str;

  // 열린 문자열 닫기
  const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) truncated += '(잘림)"';

  // 열린 배열 닫기
  const openBrackets = (truncated.match(/\[/g) || []).length;
  const closeBrackets = (truncated.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) truncated += "]";

  // 열린 객체 닫기
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
3. inquiryType: 아래 중 택1
   ${JSON.stringify(INQUIRY_TYPE_OPTIONS)}
4. featureCategory: 아래 중 택1 (대화 내용과 가장 관련있는 기능)
   ${JSON.stringify(CATEGORY_OPTIONS)}

## 대화 원문
${conversation}

## 응답 형식 (JSON만 반환, 마크다운 코드블록 없이)
- 반드시 한 줄로 된 유효한 JSON을 반환
- detailedSummary 내 줄바꿈은 반드시 \\n으로 표현 (리터럴 줄바꿈 금지)
{"shortSummary":"시퀀스 요일별 발송 기능 요청","detailedSummary":"[채널톡 문의 내용]\\n고객이 무엇을 물어봤는지\\n\\n[답변 내용]\\n상담사가 어떻게 답변했는지\\n\\n[후속 조치]\\n없음","inquiryType":"...","featureCategory":"..."}`;

  const raw = await callGemini(prompt);

  // JSON 파싱 (코드블록 감싸져 있을 수 있음, 앞뒤 잡문 제거)
  let jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // JSON 객체 부분만 추출 (앞뒤 텍스트가 있을 수 있음)
  const startIdx = jsonStr.indexOf("{");
  const endIdx = jsonStr.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    jsonStr = jsonStr.slice(startIdx, endIdx + 1);
  }

  let parsed: GeminiAnalysis;
  try {
    parsed = JSON.parse(jsonStr) as GeminiAnalysis;
  } catch (e1) {
    // JSON 파싱 실패 시 재시도: 문자열 내부의 리터럴 줄바꿈을 이스케이프 처리
    const cleaned = fixNewlinesInJsonStrings(jsonStr)
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");
    try {
      parsed = JSON.parse(cleaned) as GeminiAnalysis;
    } catch (e2) {
      // 잘린 JSON 복구 시도: 열린 문자열과 객체를 닫아줌
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

  // 유효성 검증
  if (!INQUIRY_TYPE_OPTIONS.includes(parsed.inquiryType as typeof INQUIRY_TYPE_OPTIONS[number])) {
    parsed.inquiryType = "사용법 문의";
  }
  if (!CATEGORY_OPTIONS.includes(parsed.featureCategory as typeof CATEGORY_OPTIONS[number])) {
    parsed.featureCategory = "기타";
  }

  return parsed;
}
