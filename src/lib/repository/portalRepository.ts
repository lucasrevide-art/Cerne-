import { supabase } from "../supabase/client.ts";
import type { ContentFormat } from "../../types.ts";
import { unwrap } from "./util.ts";

export type AccessLevel = "view" | "review" | "edit";
export type AreaAccess = { id: string; email: string; permission: AccessLevel; token: string; member_id: string | null };
export type PortalArea = { id: string; name: string };
export type PortalTask = {
  id: string; title: string; notes: string; status: string; deadline: string | null;
  completed_at: string | null; project_id: string | null; content_version: number; stage: string | null;
  latest_activity?: { kind: ActivityKind; created_at: string } | null;
  review: { kind: string; version: number } | null;
};
export type ContentVerdict = "approved" | "rejected" | "changes";
export type PortalContent = {
  id: string; title: string; format: ContentFormat; publish_date: string; objective: string; script: string; caption: string;
  project_id: string; content_version: number; review: { kind: ContentVerdict; version: number } | null;
};
export type ContentEventKind = "comment" | ContentVerdict;
export type ContentEvent = { id: string; kind: ContentEventKind; body: string; version: number; author: string; created_at: string };
export type ContentSummary = { id: string; review: { kind: ContentVerdict; version: number; created_at: string } | null; last_by_client: boolean | null };
export type PortalNote = { id: string; title: string; body: string; project_id: string | null };
export type PortalSpace = PortalArea & {
  description: string; permission: AccessLevel | "owner"; projects: PortalArea[]; tasks: PortalTask[]; notes: PortalNote[]; contents?: PortalContent[];
};
export type Attachment = { id: string; name: string; mime: string };
export type ActivityKind = "comment" | "requested" | "approved" | "changes";
export type Activity = {
  id: string; kind: ActivityKind; body: string; internal: boolean; version: number; author: string; created_at: string;
  snapshot: { title: string; notes: string; files: Pick<Attachment, "id" | "name">[] } | null;
};

export const portalRepository = {
  async available() {
    const res = await supabase.rpc("cerne_portal");
    if (res.error?.code === "PGRST202" || res.error?.code === "42883") return false;
    unwrap(res);
    return true;
  },
  async areas(): Promise<PortalArea[]> {
    return unwrap(await supabase.rpc("cerne_portal"));
  },
  async area(area: string): Promise<PortalSpace> {
    return unwrap(await supabase.rpc("cerne_portal", { area }));
  },
  async access(area: string, action: "list" | "revoke", value?: string): Promise<AreaAccess[]> {
    return unwrap(await supabase.rpc("cerne_access", { area, action, value }));
  },
  async invite(area: string, email: string, level: AccessLevel): Promise<AreaAccess> {
    return unwrap(await supabase.rpc("cerne_access", { area, action: "invite", value: email.trim(), level }));
  },
  async accept(token: string): Promise<string> {
    return unwrap(await supabase.rpc("cerne_access", { area: null, action: "accept", value: token }));
  },
  async activity(item: string, action: ActivityKind | "list", message?: string, internal_only?: boolean, expected_version?: number): Promise<Activity[]> {
    return unwrap(await supabase.rpc("cerne_activity", { item, action, message, internal_only, expected_version }));
  },
  async edit(item: string, new_title: string, message: string, expected_version: number) {
    unwrap(await supabase.rpc("cerne_activity", { item, action: "edit", new_title, message, expected_version }));
  },
  async contentEvents(item: string, action: ContentEventKind | "list", message?: string, expected_version?: number): Promise<ContentEvent[]> {
    return unwrap(await supabase.rpc("cerne_content", { item, action, message, expected_version }));
  },
  /** Respostas do cliente por conteúdo. Vazio se a migração de revisão ainda não rodou. */
  async contentSummary(project?: string): Promise<ContentSummary[]> {
    const res = await supabase.rpc("cerne_content_summary", { project: project ?? null });
    if (res.error?.code === "PGRST202" || res.error?.code === "42883") return [];
    return unwrap(res);
  },
  async files(item: string, entity: "task" | "note"): Promise<Attachment[]> {
    return unwrap(await supabase.rpc("cerne_files", { item, entity, action: "list" }));
  },
  async upload(item: string, entity: "task" | "note", file: File, id: string): Promise<Attachment[]> {
    if (file.size > 20 * 1024 * 1024) throw new Error("O arquivo precisa ter até 20 MB.");
    unwrap(await supabase.rpc("cerne_files", { item, entity, action: "reserve", file_id: id, file_name: file.name, file_mime: file.type }));
    const uploaded = await supabase.storage.from("cerne-files").upload(id, file, { cacheControl: "0" });
    if (uploaded.error && uploaded.error.statusCode !== "409" && !/already exists/i.test(uploaded.error.message)) throw uploaded.error;
    return unwrap(await supabase.rpc("cerne_files", { item, entity, action: "finish", file_id: id }));
  },
  async download(id: string): Promise<Blob> {
    const { data, error } = await supabase.storage.from("cerne-files").download(id);
    if (error) throw error;
    return data;
  },
};
