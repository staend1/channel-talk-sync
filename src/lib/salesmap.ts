const BASE_URL = "https://salesmap.kr/api/v2";

function headers() {
  return {
    Authorization: `Bearer ${process.env.SALESMAP_API_TOKEN!}`,
    "Content-Type": "application/json",
  };
}

const DELAY_MS = 150; // rate limit: 100 req / 10s
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  await sleep(DELAY_MS);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesmap API error ${res.status}: ${text}`);
  }
  return res.json();
}

// --- People (고객) ---

interface PeopleSearchResult {
  success: boolean;
  data: { people: Record<string, unknown>[] };
}

/** 이메일로 고객 검색 (전체 필드 반환) */
export async function findPeopleByEmail(email: string): Promise<Record<string, unknown> | null> {
  try {
    const data = await fetchAPI<PeopleSearchResult>(`/people-temp/${encodeURIComponent(email)}`);
    return data.data.people.length > 0 ? data.data.people[0] : null;
  } catch {
    // 검색 실패 = 없음 (400 "고객을 찾을 수 없습니다" 등)
    return null;
  }
}

interface FieldListItem {
  name: string;
  stringValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
  dateValue?: string;
  userValueId?: string;
  organizationValueId?: string;
  peopleValueId?: string;
  peopleValueIdList?: string[];
  customObjectValueIdList?: string[];
  stringValueList?: string[];
}

/** 고객 생성 (이미 존재하면 기존 ID 반환) */
export async function createPeople(
  name: string,
  fieldList?: FieldListItem[]
): Promise<{ id: string; name: string }> {
  const body: Record<string, unknown> = { name };
  if (fieldList) body.fieldList = fieldList;

  await sleep(DELAY_MS);
  const res = await fetch(`${BASE_URL}/people`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    // "동일한 이메일을 가진 고객이 존재합니다" → 기존 ID 반환
    if (json?.data?.id) {
      console.log(`[salesmap] 기존 고객 사용: ${json.data.name} (${json.data.id})`);
      return { id: json.data.id, name: json.data.name };
    }
    throw new Error(`Salesmap API error ${res.status}: ${JSON.stringify(json)}`);
  }

  const data = await res.json();
  return data.data.people;
}

/** 고객 수정 */
export async function updatePeople(
  peopleId: string,
  updates: { name?: string; memo?: string; fieldList?: FieldListItem[] }
): Promise<void> {
  await fetchAPI(`/people/${peopleId}`, {
    method: "POST",
    body: JSON.stringify(updates),
  });
}

// --- Custom Object ---

/** 커스텀 오브젝트 목록 조회 (페이지네이션) */
export async function listCustomObjects(cursor?: string): Promise<{
  customObjectList: Record<string, unknown>[];
  nextCursor: string | null;
}> {
  let path = "/custom-object";
  if (cursor) path += `?cursor=${cursor}`;
  const data = await fetchAPI<{
    success: boolean;
    data: { customObjectList: Record<string, unknown>[]; nextCursor: string | null };
  }>(path);
  return data.data;
}

/** 커스텀 오브젝트 생성 */
export async function createCustomObject(
  customObjectDefinitionId: string,
  fieldList: FieldListItem[]
): Promise<{ id: string }> {
  const data = await fetchAPI<{ success: boolean; data: { customObject: { id: string } } }>(
    "/custom-object",
    {
      method: "POST",
      body: JSON.stringify({ customObjectDefinitionId, fieldList }),
    }
  );
  return data.data.customObject;
}

/** 커스텀 오브젝트에 메모(노트) 생성 */
export async function createCustomObjectMemo(
  customObjectId: string,
  memo: string
): Promise<void> {
  await fetchAPI(`/custom-object/${customObjectId}`, {
    method: "POST",
    body: JSON.stringify({ memo }),
  });
}

// --- User (사용자) ---

export interface SalesmapUser {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
}

/** 사용자 목록 조회 (전체) */
export async function listUsers(): Promise<SalesmapUser[]> {
  const allUsers: SalesmapUser[] = [];
  let cursor: string | undefined;

  while (true) {
    let path = "/user";
    if (cursor) path += `?cursor=${cursor}`;
    const data = await fetchAPI<{
      success: boolean;
      data: { userList: SalesmapUser[]; nextCursor?: string };
    }>(path);
    allUsers.push(...data.data.userList);
    if (!data.data.nextCursor) break;
    cursor = data.data.nextCursor;
  }

  return allUsers;
}

// --- Constants ---

export const CHANNEL_TALK_DEFINITION_ID = "019cb198-7afc-7aac-b557-e1fce57a0946";
export const WORKSPACE_DEFINITION_ID = "019abec5-514f-7dd2-8f0d-8650835719cf";
