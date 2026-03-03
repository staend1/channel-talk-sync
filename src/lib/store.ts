import { supabase } from "./supabase";

// --- Processed Chats ---

interface ProcessedChat {
  userChatId: string;
  closedAt: number;
  salesmapRecordId: string;
  processedAt: string;
}

export async function isProcessed(userChatId: string): Promise<boolean> {
  const { count } = await supabase
    .from("processed_chats")
    .select("*", { count: "exact", head: true })
    .eq("user_chat_id", userChatId);
  return (count ?? 0) > 0;
}

export async function markProcessed(entry: ProcessedChat): Promise<void> {
  await supabase.from("processed_chats").upsert({
    user_chat_id: entry.userChatId,
    closed_at: entry.closedAt,
    salesmap_record_id: entry.salesmapRecordId,
    processed_at: entry.processedAt,
  });
}

// --- Workspace Map ---

interface WorkspaceEntry {
  recordId: string;
  workspaceId: string;
}

let workspaceCache: WorkspaceEntry[] | null = null;

export async function getWorkspaceMap(): Promise<WorkspaceEntry[]> {
  if (workspaceCache) return workspaceCache;
  const { data } = await supabase.from("workspace_map").select("record_id, workspace_id");
  workspaceCache = (data ?? []).map((d) => ({
    recordId: d.record_id,
    workspaceId: d.workspace_id,
  }));
  return workspaceCache;
}

export async function findWorkspace(workspaceId: string): Promise<string | null> {
  const map = await getWorkspaceMap();
  const entry = map.find((w) => w.workspaceId === workspaceId);
  return entry ? entry.recordId : null;
}

export async function saveWorkspaceMap(entries: WorkspaceEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({
    record_id: e.recordId,
    workspace_id: e.workspaceId,
  }));
  await supabase.from("workspace_map").upsert(rows, { onConflict: "record_id" });
  workspaceCache = null;
}

export async function appendWorkspaceEntries(entries: WorkspaceEntry[]): Promise<void> {
  await saveWorkspaceMap(entries);
}

// --- User Map ---

interface UserEntry {
  userId: string;
  name: string;
}

let userCache: UserEntry[] | null = null;

export async function getUserMap(): Promise<UserEntry[]> {
  if (userCache) return userCache;
  const { data } = await supabase.from("user_map").select("user_id, name");
  userCache = (data ?? []).map((d) => ({
    userId: d.user_id,
    name: d.name,
  }));
  return userCache;
}

export async function findUserByName(name: string): Promise<string | null> {
  const map = await getUserMap();
  const entry = map.find((u) => u.name === name);
  return entry ? entry.userId : null;
}

export async function saveUserMap(entries: UserEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({
    user_id: e.userId,
    name: e.name,
  }));
  await supabase.from("user_map").upsert(rows, { onConflict: "user_id" });
  userCache = null;
}
