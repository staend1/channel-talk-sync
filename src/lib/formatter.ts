import type { ChannelMessage, ChannelManager, ChannelUser } from "./channel-talk";

interface FormatOptions {
  messages: ChannelMessage[];
  managers: ChannelManager[];
  user: ChannelUser;
}

/** 메시지를 대화 원문 텍스트로 포맷팅 (Gemini 분석용) */
export function formatConversation({ messages, managers, user }: FormatOptions): string {
  const managerMap = new Map(managers.map((m) => [m.id, m.name]));

  // bot 제외, plainText 또는 이미지가 있는 것만
  const filtered = messages.filter(
    (m) => m.personType !== "bot" && (m.plainText?.trim() || (m.files && m.files.length > 0))
  );

  if (filtered.length === 0) return "(대화 내용 없음)";

  // 화자 정보 수집
  const assigneeIds = new Set<string>();
  filtered.forEach((m) => {
    if (m.personType === "manager") assigneeIds.add(m.personId);
  });

  // 헤더
  const headerLines: string[] = [`고객: ${user.name}`];
  assigneeIds.forEach((id) => {
    headerLines.push(`담당자: ${managerMap.get(id) || "상담사"}`);
  });

  // 대화 본문
  const bodyLines: string[] = [];
  let lastSpeaker = "";

  filtered.forEach((m) => {
    const name = m.personType === "user" ? user.name : managerMap.get(m.personId) || "상담사";

    if (name !== lastSpeaker) {
      if (bodyLines.length > 0) bodyLines.push("");
      bodyLines.push(`${name}: ${formatTime(m.createdAt)}`);
      lastSpeaker = name;
    }

    if (m.plainText?.trim()) bodyLines.push(m.plainText.trim());
    if (m.files && m.files.length > 0) {
      for (const f of m.files) {
        bodyLines.push(`[이미지: ${f.name}] https://cf.channel.io/${f.key}`);
      }
    }
  });

  return headerLines.join("\n") + "\n\n---\n\n" + bodyLines.join("\n");
}

/** 대화를 카톡 스타일 HTML로 포맷팅 (노트용) */
export function formatConversationHtml({ messages, managers, user }: FormatOptions): string {
  const managerMap = new Map(managers.map((m) => [m.id, m.name]));

  const filtered = messages.filter(
    (m) => m.personType !== "bot" && (m.plainText?.trim() || (m.files && m.files.length > 0))
  );

  if (filtered.length === 0) return "<p>(대화 내용 없음)</p>";

  const bubbles: string[] = [];
  let lastSpeaker = "";

  filtered.forEach((m) => {
    const isUser = m.personType === "user";
    const name = isUser ? user.name : managerMap.get(m.personId) || "상담사";
    const time = formatTime(m.createdAt);

    // 말풍선 스타일
    const align = isUser ? "left" : "right";
    const bgColor = isUser ? "#f1f1f1" : "#d4e6ff";
    const nameColor = isUser ? "#333" : "#1a5ab8";

    // 메시지 내용 조합
    const parts: string[] = [];
    if (m.plainText?.trim()) {
      parts.push(escapeHtml(m.plainText.trim()).replace(/\n/g, "<br>"));
    }
    if (m.files && m.files.length > 0) {
      for (const f of m.files) {
        parts.push(`<a href="https://cf.channel.io/${f.key}" style="color:#1a73e8;">[이미지: ${escapeHtml(f.name)}]</a>`);
      }
    }

    const showName = name !== lastSpeaker;
    lastSpeaker = name;

    const nameHtml = showName
      ? `<div style="font-size:12px; color:${nameColor}; margin-bottom:4px; font-weight:bold;">${escapeHtml(name)} <span style="font-weight:normal; color:#999;">${time}</span></div>`
      : "";

    bubbles.push(
      `<div style="text-align:${align}; margin-bottom:8px;">` +
        nameHtml +
        `<div style="display:inline-block; max-width:80%; padding:10px 14px; border-radius:12px; background:${bgColor}; text-align:left; font-size:14px; color:#000; line-height:1.6;">` +
          parts.join("<br>") +
        `</div>` +
      `</div>`
    );
  });

  return bubbles.join("\n");
}

/** 노트 전체 텍스트 생성 (요약 + 대화 HTML) */
export function buildMemoText(detailedSummary: string, conversationHtml: string): string {
  const summaryHtml = detailedSummary
    .replace(/\[채널톡 문의 내용\]/g, "<b>채널톡 문의 내용</b>")
    .replace(/\[문의 내용\]/g, "<b>채널톡 문의 내용</b>")
    .replace(/\[답변 내용\]/g, "<b>답변 내용</b>")
    .replace(/\[후속 조치\]/g, "<b>후속 조치</b>")
    .replace(/\n/g, "<br>");

  return `<div style="font-size:15px; color:#000; line-height:1.7;">
<div style="margin-bottom:16px;">${summaryHtml}</div>
<hr style="border:none; border-top:1px solid #ddd; margin:16px 0;">
<h3 style="margin:0 0 12px 0;">대화 원문</h3>
<div style="padding:8px;">${conversationHtml}</div>
</div>`;
}

/** HTML 이스케이프 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Unix ms → KST MM-DD HH:mm */
function formatTime(unixMs: number): string {
  const d = new Date(unixMs);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const min = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${min}`;
}
