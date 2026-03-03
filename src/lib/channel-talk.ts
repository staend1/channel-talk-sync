const BASE_URL = "https://api.channel.io";

function headers() {
  return {
    "x-access-key": process.env.CHANNEL_ACCESS_KEY!,
    "x-access-secret": process.env.CHANNEL_ACCESS_SECRET!,
    "Content-Type": "application/json",
  };
}

export interface ChannelFile {
  id: string;
  type: string;
  name: string;
  size: number;
  contentType: string;
  width?: number;
  height?: number;
  bucket: string;
  key: string;
}

export interface ChannelMessage {
  id: string;
  personType: "user" | "manager" | "bot";
  personId: string;
  plainText: string;
  createdAt: number;
  blocks: { type: string; value?: string }[];
  files?: ChannelFile[];
}

export interface ChannelUserChat {
  id: string;
  state: string;
  userId: string;
  name: string;
  assigneeId: string;
  managerIds: string[];
  closedAt: number;
  createdAt: number;
  openedAt: number;
  firstRepliedAt: number;
  waitingTime: number;
  resolutionTime: number;
  replyCount: number;
}

export interface ChannelUser {
  id: string;
  memberId: string;
  name: string;
  email: string;
  profile: Record<string, unknown>;
}

export interface ChannelManager {
  id: string;
  name: string;
  email: string;
}

interface UserChatsResponse {
  messages: ChannelMessage[];
  userChats: ChannelUserChat[];
  users: ChannelUser[];
  managers: ChannelManager[];
  next: string | null;
}

interface MessagesResponse {
  messages: ChannelMessage[];
  bots: unknown[];
  next: string | null;
  prev: string | null;
}

async function fetchAPI<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Channel Talk API error ${res.status}: ${text}`);
  }
  return res.json();
}

/** 종료된 상담 목록 조회 */
export async function getClosedChats(limit = 20, since?: string): Promise<UserChatsResponse> {
  let path = `/open/v5/user-chats?state=closed&sortOrder=desc&limit=${limit}`;
  if (since) path += `&since=${since}`;
  return fetchAPI<UserChatsResponse>(path);
}

/** 특정 상담의 메시지 전체 조회 */
export async function getChatMessages(userChatId: string): Promise<ChannelMessage[]> {
  const allMessages: ChannelMessage[] = [];
  let since: string | undefined;

  while (true) {
    let path = `/open/v5/user-chats/${userChatId}/messages?sortOrder=asc&limit=50`;
    if (since) path += `&since=${since}`;

    const data = await fetchAPI<MessagesResponse>(path);
    allMessages.push(...data.messages);

    if (!data.next) break;
    since = data.next;
  }

  return allMessages;
}

/** 유저 상세 조회 */
export async function getUser(userId: string): Promise<ChannelUser> {
  const data = await fetchAPI<{ user: ChannelUser }>(`/open/v5/users/${userId}`);
  return data.user;
}
