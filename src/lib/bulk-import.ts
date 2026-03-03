import "dotenv/config";
import {
  getClosedChats,
  getChatMessages,
  getUser,
  type ChannelUserChat,
  type ChannelUser,
  type ChannelManager,
} from "./channel-talk";
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
  saveWorkspaceMap,
  getUserMap,
  saveUserMap,
  findUserByName,
} from "./store";

const BATCH_SIZE = 50; // 채널톡 페이지당 조회 수
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const TEST_LIMIT = parseInt(process.env.BULK_LIMIT || "0"); // 0 = 무제한

/** 초기 데이터 로딩 */
async function initMaps() {
  // 사용자 맵
  const userMap = await getUserMap();
  if (userMap.length === 0) {
    console.log("[bulk] 세일즈맵 사용자 로딩...");
    const users = await listUsers();
    await saveUserMap(users.map((u) => ({ userId: u.id, name: u.name })));
    console.log(`[bulk] 사용자 ${users.length}명 저장`);
  }

  // 워크스페이스 맵
  const wsMap = await getWorkspaceMap();
  if (wsMap.length === 0) {
    console.log("[bulk] 워크스페이스 맵 구축...");
    const entries: { recordId: string; workspaceId: string }[] = [];
    let cursor: string | undefined;
    while (true) {
      const data = await listCustomObjects(cursor);
      for (const obj of data.customObjectList) {
        if (obj.customObjectDefinitionId === WORKSPACE_DEFINITION_ID) {
          const wsId = obj["워크스페이스 ID"] as string;
          if (wsId) entries.push({ recordId: obj.id as string, workspaceId: wsId });
        }
      }
      if (!data.nextCursor) break;
      cursor = data.nextCursor;
    }
    await saveWorkspaceMap(entries);
    console.log(`[bulk] 워크스페이스 ${entries.length}건 저장`);
  }
}

/** 단일 상담 처리 (sync.ts의 processChat과 동일 로직) */
async function processChat(
  chat: ChannelUserChat,
  user: ChannelUser,
  managers: ChannelManager[]
): Promise<void> {
  const chatId = chat.id;

  const messages = await getChatMessages(chatId);
  const conversationText = formatConversation({ messages, managers, user });
  const analysis = await analyzeConversation(conversationText);

  const roomId = user.profile?.salesmap_room_Id as string;
  let workspaceRecordId: string | null = null;
  if (roomId) {
    workspaceRecordId = await findWorkspace(roomId);
  }

  // 고객 매칭/생성
  const email = (user.profile?.salesmap_email || user.profile?.email || user.email) as string;
  const name = (user.profile?.salesmap_name || user.name) as string;
  if (!email) throw new Error(`이메일 없음: userId=${user.id}`);

  let people = await findPeopleByEmail(email);
  let peopleId: string;
  if (people) {
    peopleId = people.id as string;
  } else {
    const created = await createPeople(name, [
      { name: "이메일", stringValue: email },
      { name: "채널톡 자동 생성", booleanValue: true },
    ]);
    peopleId = created.id;
  }

  // 고객 프로필 업데이트
  const peopleFields: { name: string; [key: string]: unknown }[] = [];
  const userId = user.profile?.salesmap_user_Id as string;
  const accountId = user.profile?.salesmap_account_Id as string;
  if (roomId) peopleFields.push({ name: "워크스페이스 ID", stringValue: roomId });
  if (userId) peopleFields.push({ name: "유저 ID", stringValue: userId });
  if (accountId) peopleFields.push({ name: "계정 ID", stringValue: accountId });
  if (workspaceRecordId) {
    peopleFields.push({ name: "워크스페이스", customObjectValueIdList: [workspaceRecordId] });
  }
  if (peopleFields.length > 0) {
    await updatePeople(peopleId, { fieldList: peopleFields as any });
  }

  // 담당자 매칭
  const assigneeManager = managers.find((m) => m.id === chat.assigneeId);
  let salesmapUserId: string | null = null;
  if (assigneeManager?.name) {
    salesmapUserId = await findUserByName(assigneeManager.name);
  }

  // 채널톡 오브젝트 생성
  const fieldList: { name: string; [key: string]: unknown }[] = [
    { name: "문의 내용", stringValue: analysis.shortSummary },
    { name: "문의 유형", stringValueList: [analysis.inquiryType] },
    { name: "기능 카테고리", stringValueList: [analysis.featureCategory] },
    { name: "생성 날짜", dateValue: new Date(chat.closedAt).toISOString() },
  ];
  if (roomId) fieldList.push({ name: "워크스페이스 ID", stringValue: roomId });
  if (userId) fieldList.push({ name: "유저 ID", stringValue: userId });
  if (accountId) fieldList.push({ name: "계정 ID", stringValue: accountId });
  if (salesmapUserId) fieldList.push({ name: "담당자", userValueId: salesmapUserId });
  fieldList.push({ name: "문의자", peopleValueIdList: [peopleId] });
  if (workspaceRecordId) {
    fieldList.push({ name: "워크스페이스", customObjectValueIdList: [workspaceRecordId] });
  }

  const customObject = await createCustomObject(CHANNEL_TALK_DEFINITION_ID, fieldList as any);

  // 노트 생성
  const conversationHtml = formatConversationHtml({ messages, managers, user });
  const memoText = buildMemoText(analysis.detailedSummary, conversationHtml);
  await updatePeople(peopleId, { memo: memoText });

  // 처리 기록
  await markProcessed({
    userChatId: chatId,
    closedAt: chat.closedAt,
    salesmapRecordId: customObject.id,
    processedAt: new Date().toISOString(),
  });
}

async function main() {
  console.log("=== 벌크 Import 시작 (1년치) ===\n");

  await initMaps();

  const cutoff = Date.now() - ONE_YEAR_MS;
  let since: string | undefined;
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const errorLog: string[] = [];
  let page = 0;

  while (true) {
    page++;
    let path = `/open/v5/user-chats?state=closed&sortOrder=desc&limit=${BATCH_SIZE}`;
    if (since) path += `&since=${since}`;

    // 채널톡에서 종료 상담 조회 (raw fetch로 managers 포함)
    const res = await fetch(`https://api.channel.io${path}`, {
      headers: {
        "x-access-key": process.env.CHANNEL_ACCESS_KEY!,
        "x-access-secret": process.env.CHANNEL_ACCESS_SECRET!,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    const chats: ChannelUserChat[] = data.userChats || [];
    const users: ChannelUser[] = data.users || [];
    const managers: ChannelManager[] = data.managers || [];

    if (chats.length === 0) break;

    const userMap = new Map(users.map((u) => [u.id, u]));
    const oldest = chats[chats.length - 1].closedAt;

    console.log(`\n[page ${page}] ${chats.length}건 (${new Date(oldest).toISOString().slice(0, 10)}까지)`);

    for (const chat of chats) {
      // 1년 이전이면 스킵
      if (chat.closedAt < cutoff) {
        totalSkipped++;
        continue;
      }

      // 이미 처리된 건 스킵
      if (await isProcessed(chat.id)) {
        totalSkipped++;
        continue;
      }

      let user = userMap.get(chat.userId);
      if (!user) {
        try {
          user = await getUser(chat.userId);
        } catch {
          const msg = `${chat.id}: 유저 조회 실패`;
          errorLog.push(msg);
          totalErrors++;
          continue;
        }
      }

      try {
        await processChat(chat, user, managers);
        totalProcessed++;
        if (totalProcessed % 10 === 0) {
          console.log(`  → ${totalProcessed}건 처리 완료`);
        }
        if (TEST_LIMIT > 0 && totalProcessed >= TEST_LIMIT) break;
      } catch (e) {
        const msg = `${chat.id}: ${(e as Error).message}`;
        console.error(`  [에러] ${msg}`);
        errorLog.push(msg);
        totalErrors++;
      }
    }

    // 테스트 제한 도달
    if (TEST_LIMIT > 0 && totalProcessed >= TEST_LIMIT) {
      console.log(`\n테스트 제한 ${TEST_LIMIT}건 도달, 중단`);
      break;
    }

    // 1년 전보다 오래된 상담이면 중단
    if (oldest < cutoff) {
      console.log("\n1년 전 도달, 중단");
      break;
    }

    if (!data.next) break;
    since = data.next;
  }

  console.log(`\n=== 벌크 Import 완료 ===`);
  console.log(`처리: ${totalProcessed}건`);
  console.log(`스킵: ${totalSkipped}건`);
  console.log(`에러: ${totalErrors}건`);

  if (errorLog.length > 0) {
    console.log("\n--- 에러 목록 ---");
    errorLog.forEach((e) => console.log(e));
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
