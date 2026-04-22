import {
  getClosedChats,
  getChatMessages,
  getUser,
  getSignedFileUrl,
  type ChannelUserChat,
  type ChannelUser,
  type ChannelManager,
} from "./channel-talk";
import { uploadImageToStorage } from "./supabase";
import {
  findPeopleByEmail,
  createPeople,
  updatePeople,
  createCustomObject,
  createCustomObjectMemo,
  listUsers,
  listCustomObjects,
  CHANNEL_TALK_DEFINITION_ID,
  WORKSPACE_DEFINITION_ID,
} from "./salesmap";
import { analyzeConversation } from "./gemini";
import { formatConversation, formatConversationHtml, buildMemoText } from "./formatter";
import {
  isProcessed,
  markProcessed,
  findWorkspace,
  getWorkspaceMap,
  appendWorkspaceEntries,
  saveWorkspaceMap,
  getUserMap,
  saveUserMap,
  findUserByName,
} from "./store";

/** 세일즈맵 사용자 맵 초기화 */
async function ensureUserMap() {
  const map = await getUserMap();
  if (map.length > 0) return;
  console.log("[sync] 세일즈맵 사용자 목록 로딩...");
  const users = await listUsers();
  await saveUserMap(users.map((u) => ({ userId: u.id, name: u.name })));
  console.log(`[sync] 사용자 ${users.length}명 저장`);
}

/** 워크스페이스 맵 초기화/갱신 */
async function ensureWorkspaceMap() {
  const existing = await getWorkspaceMap();
  if (existing.length === 0) {
    console.log("[sync] 워크스페이스 맵 초기 구축...");
    await buildFullWorkspaceMap();
  }
}

async function buildFullWorkspaceMap() {
  const entries: { recordId: string; workspaceId: string }[] = [];
  let cursor: string | undefined;

  while (true) {
    const data = await listCustomObjects(cursor);
    for (const obj of data.customObjectList) {
      if (obj.customObjectDefinitionId === WORKSPACE_DEFINITION_ID) {
        const wsId = obj["워크스페이스 ID"] as string;
        if (wsId) {
          entries.push({ recordId: obj.id as string, workspaceId: wsId });
        }
      }
    }
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }

  await saveWorkspaceMap(entries);
  console.log(`[sync] 워크스페이스 ${entries.length}건 저장`);
}

/** 워크스페이스 맵 갱신 (실행당 1회만) */
let workspaceMapRefreshed = false;
async function refreshWorkspaceMap(): Promise<void> {
  if (workspaceMapRefreshed) {
    console.log("[sync] 워크스페이스 맵 이미 갱신됨, 스킵");
    return;
  }
  console.log("[sync] 워크스페이스 맵 갱신...");
  await buildFullWorkspaceMap();
  workspaceMapRefreshed = true;
}

/** 고객 매칭/생성 + 필드 업데이트 (이메일 없으면 null 반환) */
async function matchOrCreatePeople(
  user: ChannelUser,
  workspaceRecordId: string | null
): Promise<string | null> {
  const email = (user.profile?.salesmap_email || user.profile?.email || user.email) as string;
  const name = (user.profile?.salesmap_name || user.name) as string;

  if (!email) {
    console.warn(`[sync] 이메일 없음 (${name}), 고객 연결 없이 진행`);
    return null;
  }

  // 1. 이메일로 검색
  let people = await findPeopleByEmail(email);
  let peopleId: string;

  if (people) {
    peopleId = people.id as string;
    console.log(`[sync] 기존 고객 매칭: ${name} (${email}) → ${peopleId}`);
  } else {
    // 2. 없으면 생성
    const created = await createPeople(name, [
      { name: "이메일", stringValue: email },
      { name: "채널톡 자동 생성", booleanValue: true },
    ]);
    peopleId = created.id;
    console.log(`[sync] 고객 생성: ${name} (${email}) → ${peopleId}`);
  }

  // 3. 프로필 필드 업데이트
  const fieldList: { name: string; [key: string]: unknown }[] = [];
  const roomId = user.profile?.salesmap_room_Id as string;
  const userId = user.profile?.salesmap_user_Id as string;
  const accountId = user.profile?.salesmap_account_Id as string;

  if (roomId) fieldList.push({ name: "워크스페이스 ID", stringValue: roomId });
  if (userId) fieldList.push({ name: "유저 ID", stringValue: userId });
  if (accountId) fieldList.push({ name: "계정 ID", stringValue: accountId });

  // 고객 → 워크스페이스 연결
  if (workspaceRecordId) {
    fieldList.push({ name: "워크스페이스", customObjectValueIdList: [workspaceRecordId] });
  }

  if (fieldList.length > 0) {
    await updatePeople(peopleId, { fieldList: fieldList as any });
  }

  return peopleId;
}

/** 단일 상담 처리 */
async function processChat(
  chat: ChannelUserChat,
  user: ChannelUser,
  managers: ChannelManager[]
): Promise<void> {
  const chatId = chat.id;
  console.log(`\n[sync] 상담 처리 시작: ${chatId} (${user.name})`);

  // 1. 메시지 조회
  const messages = await getChatMessages(chatId);
  console.log(`[sync] 메시지 ${messages.length}건 조회`);

  // 1.5 이미지 → Supabase Storage 업로드
  for (const m of messages) {
    if (!m.files || m.files.length === 0) continue;
    for (const f of m.files) {
      if (!f.contentType?.startsWith("image/")) continue;
      try {
        const signedUrl = await getSignedFileUrl(chatId, f.key);
        f.publicUrl = await uploadImageToStorage(signedUrl, chatId, f.id, f.contentType);
      } catch (e) {
        console.warn(`[sync] 이미지 업로드 실패 (${f.name}): ${(e as Error).message}`);
      }
    }
  }

  // 2. 대화 포맷팅
  const conversationText = formatConversation({ messages, managers, user });

  // 3. Gemini 분석
  console.log("[sync] Gemini 분석 중...");
  const analysis = await analyzeConversation(conversationText);
  console.log(`[sync] 요약: ${analysis.shortSummary}`);
  console.log(`[sync] 분류: ${analysis.inquiryType} / ${analysis.featureCategory}`);

  // 4. 워크스페이스 매칭 (고객 연결에 필요하므로 먼저)
  const roomId = user.profile?.salesmap_room_Id as string;
  let workspaceRecordId: string | null = null;
  if (roomId) {
    workspaceRecordId = await findWorkspace(roomId);
    if (!workspaceRecordId) {
      await refreshWorkspaceMap();
      workspaceRecordId = await findWorkspace(roomId);
    }
  }

  // 5. 고객 매칭/생성 + 워크스페이스 연결
  const peopleId = await matchOrCreatePeople(user, workspaceRecordId);

  // 6. 담당자 매칭
  const assigneeManager = managers.find((m) => m.id === chat.assigneeId);
  const assigneeName = assigneeManager?.name;
  let salesmapUserId: string | null = null;
  if (assigneeName) {
    salesmapUserId = await findUserByName(assigneeName);
  }

  // 7. 채널톡 커스텀 오브젝트 생성
  const channelTalkLink = `https://desk.channel.io/salesmap/user-chats/${user.name}-${chatId}`;
  const fieldList: { name: string; [key: string]: unknown }[] = [
    { name: "문의 내용", stringValue: analysis.shortSummary },
    { name: "문의 유형", stringValueList: [analysis.inquiryType] },
    { name: "기능 카테고리", stringValueList: [analysis.featureCategory] },
    { name: "인입 날짜", dateValue: new Date(chat.createdAt).toISOString() },
    { name: "생성 날짜", dateValue: new Date(chat.closedAt).toISOString() },
    { name: "채널톡 링크", stringValue: channelTalkLink },
  ];

  // 채널톡 프로필 이중 저장
  if (roomId) fieldList.push({ name: "워크스페이스 ID", stringValue: roomId });
  const chUserId = user.profile?.salesmap_user_Id as string;
  if (chUserId) fieldList.push({ name: "유저 ID", stringValue: chUserId });
  const chAccountId = user.profile?.salesmap_account_Id as string;
  if (chAccountId) fieldList.push({ name: "계정 ID", stringValue: chAccountId });

  // 담당자
  if (salesmapUserId) {
    fieldList.push({ name: "담당자", userValueId: salesmapUserId });
  }

  // 고객 연결 (문의자 = multiPeople 관계 필드)
  if (peopleId) fieldList.push({ name: "문의자", peopleValueIdList: [peopleId] });

  // 워크스페이스 연결 (채널톡 → 워크스페이스)
  if (workspaceRecordId) {
    fieldList.push({ name: "워크스페이스", customObjectValueIdList: [workspaceRecordId] });
  }

  const customObject = await createCustomObject(
    CHANNEL_TALK_DEFINITION_ID,
    fieldList as any
  );
  console.log(`[sync] 채널톡 오브젝트 생성: ${customObject.id}`);

  // 8. 노트 생성 (고객 + 채널톡 커오 양쪽)
  const conversationHtml = formatConversationHtml({ messages, managers, user, chatId });
  const memoText = buildMemoText(analysis.detailedSummary, conversationHtml);
  if (peopleId) await updatePeople(peopleId, { memo: memoText });
  await createCustomObjectMemo(customObject.id, memoText);
  console.log("[sync] 노트 생성 완료 (고객 + 채널톡)");

  // 9. 처리 완료 기록
  await markProcessed({
    userChatId: chatId,
    closedAt: chat.closedAt,
    salesmapRecordId: customObject.id,
    processedAt: new Date().toISOString(),
  });
}

/** 메인 동기화 실행 */
export async function runSync(limit = 20): Promise<{ processed: number; skipped: number; errors: string[] }> {
  console.log("[sync] 동기화 시작...");

  // 초기화
  await ensureUserMap();
  await ensureWorkspaceMap();

  // 종료된 상담 조회
  const data = await getClosedChats(limit);
  const { userChats, users, managers } = data;

  console.log(`[sync] 종료 상담 ${userChats.length}건 조회`);

  const userMap = new Map(users.map((u) => [u.id, u]));

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const chat of userChats) {
    if (await isProcessed(chat.id)) {
      skipped++;
      continue;
    }

    const user = userMap.get(chat.userId);
    if (!user) {
      console.log(`[sync] 유저 정보 없음: ${chat.userId}, 개별 조회...`);
      try {
        const fetchedUser = await getUser(chat.userId);
        try {
          await processChat(chat, fetchedUser, managers);
          processed++;
        } catch (e) {
          const msg = `${chat.id}: ${(e as Error).message}`;
          console.error(`[sync] 에러: ${msg}`);
          errors.push(msg);
        }
      } catch (e) {
        const msg = `${chat.id}: 유저 조회 실패 - ${(e as Error).message}`;
        console.error(`[sync] 에러: ${msg}`);
        errors.push(msg);
      }
      continue;
    }

    try {
      await processChat(chat, user, managers);
      processed++;
    } catch (e) {
      const msg = `${chat.id}: ${(e as Error).message}`;
      console.error(`[sync] 에러: ${msg}`);
      errors.push(msg);
    }
  }

  console.log(`\n[sync] 완료: 처리 ${processed}건, 스킵 ${skipped}건, 에러 ${errors.length}건`);
  return { processed, skipped, errors };
}
