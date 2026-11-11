import { API_BASE_URL, apiClient } from "@/lib/api";

/**
 * IITR Connect (`/api/v1/connect/`): private technical discussions and knowledge for signed-in portal users.
 * Every endpoint enforces access on the server; this client never decides who may see what.
 */
const BASE = "/v1/connect/";

export interface ConnectResult<T> {
  data?: T;
  error?: string;
  field?: string;
  status?: number;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ConnectBootstrap {
  enabled: boolean;
  is_portal_admin: boolean;
  is_community_admin: boolean;
  is_internal: boolean;
  can_use_general: boolean;
  community_count: number;
  moderates_any: boolean;
  name: string;
  tagline: string;
}

export type CommunityKind = "group" | "general";

export interface CategoryRef {
  id: number;
  slug: string;
  name: string;
  description?: string;
  staff_only_posting?: boolean;
}

export interface CommunitySummary {
  id: number;
  slug: string;
  name: string;
  kind: CommunityKind;
  status: "active" | "archived";
  description: string;
  equipment_group_id: number | null;
  is_test_only: boolean;
  member_count: number | null;
  thread_count: number | null;
  can_post: boolean;
  can_moderate: boolean;
  my_badge: string;
  my_status: string | null;
}

export interface EquipmentRef {
  id: number;
  name: string;
  code: string;
}

export interface CommunityDetail extends CommunitySummary {
  categories: CategoryRef[];
  equipment?: Array<{ equipment_id: number; name: string; code: string }>;
  staff: Array<{ user_id: number; name: string; badge: string }>;
  following?: boolean;
}

export type ThreadType =
  | "question"
  | "technical_issue"
  | "solution"
  | "general"
  | "suggestion"
  | "feature_request"
  | "announcement"
  | "research"
  | "poll";

export const THREAD_TYPES: Array<{ value: ThreadType; label: string; hint: string; staffOnly?: boolean }> = [
  { value: "question", label: "Question", hint: "Ask how to do something" },
  { value: "technical_issue", label: "Technical Issue", hint: "Report a problem you ran into" },
  { value: "solution", label: "Solution / Knowledge Sharing", hint: "Share something that worked" },
  { value: "general", label: "General Discussion", hint: "Anything else" },
  { value: "suggestion", label: "Suggestion", hint: "Propose an improvement" },
  { value: "feature_request", label: "Feature Request", hint: "Ask for a portal feature" },
  { value: "research", label: "Research Discussion", hint: "Methods, collaborations and results" },
  { value: "poll", label: "Poll", hint: "Ask people to choose" },
  { value: "announcement", label: "Announcement", hint: "For facility staff and moderators", staffOnly: true },
];

export const THREAD_TYPE_LABEL: Record<ThreadType, string> = Object.fromEntries(
  THREAD_TYPES.map((t) => [t.value, t.label]),
) as Record<ThreadType, string>;

export interface AuthorRef {
  id: number;
  name: string;
  badge: string;
}

export interface ThreadCard {
  id: number;
  title: string;
  type: ThreadType;
  status: "open" | "locked";
  visibility: string;
  community: { id: number; slug: string; name: string; kind: CommunityKind };
  category: { id: number; slug: string; name: string } | null;
  equipment: EquipmentRef | null;
  author: AuthorRef;
  tags: Array<{ slug: string; name: string }>;
  excerpt: string;
  created_at: string;
  last_activity_at: string;
  reply_count: number;
  view_count: number;
  helpful_count: number;
  is_pinned: boolean;
  is_solvable: boolean;
  is_solved: boolean;
  /** The person who asked confirmed the accepted answer resolved it. */
  is_resolved?: boolean;
  solved_at: string | null;
  is_known_problem: boolean;
  has_workaround: boolean;
  is_outdated: boolean;
  marked_resolved_at: string | null;
  bookmarked: boolean;
  following: boolean;
  unread: boolean;
}

export interface AcceptedPreview {
  post_id: number;
  excerpt: string;
  author: string;
  badge: string;
  resolution_hours: number | null;
}

/** Search hit: a thread card plus where it matched, a safe highlighted snippet and the accepted answer preview. */
export interface SearchHit extends ThreadCard {
  matched_in?: "discussion" | "reply" | "details";
  snippet_html?: string;
  accepted_answer?: AcceptedPreview | null;
}

export interface SearchPage extends Paginated<SearchHit> {
  facets: { types?: Partial<Record<ThreadType, number>>; solved?: number };
  articles?: Array<{ id: number; title: string; summary: string; community: string; is_institutional_guidance: boolean }>;
}

export type EquipmentDiscussions =
  | {
      available: false;
      reason: "members_only" | "internal_only" | "not_set_up";
      equipment: EquipmentRef;
      community_name?: string;
    }
  | {
      available: true;
      equipment: EquipmentRef;
      community: { id: number; slug: string; name: string; kind: CommunityKind };
      category: { slug: string; name: string } | null;
      can_post: boolean;
      counts: { threads: number; open_questions: number; solved: number; known_problems: number };
      note: string;
      recent: ThreadCard[];
      questions: ThreadCard[];
      solutions: ThreadCard[];
      known_problems: ThreadCard[];
      announcements: ThreadCard[];
      articles: ArticleCard[];
    };

export interface AttachmentRef {
  id: string;
  name: string;
  size: number;
  kind: "image" | "pdf" | "office" | "text";
  is_inline_image: boolean;
  download_path: string;
}

export type ReactionKind = "helpful" | "insightful" | "thanks";

export interface PostView {
  id: number;
  is_opening: boolean;
  parent_id: number | null;
  author: AuthorRef;
  is_verified_response: boolean;
  body_html: string;
  visibility: string;
  created_at: string;
  edited_at: string | null;
  edit_count: number;
  helpful_count: number;
  reactions: Partial<Record<ReactionKind, number>>;
  my_reactions: ReactionKind[];
  attachments: AttachmentRef[];
  is_accepted: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface PollView {
  options: Array<{ id: number; label: string; vote_count: number }>;
  total_votes: number;
  my_vote: number | null;
  closes_at: string | null;
  is_closed: boolean;
}

export interface SolutionSummary {
  post_id: number;
  solver: AuthorRef;
  accepted_by: string;
  accepted_by_author: boolean;
  accepted_at: string;
  resolution_hours: number;
  resolved_by_author: boolean;
  resolved_at: string | null;
  can_confirm_resolved: boolean;
}

export interface AnnouncementInfo {
  priority: "normal" | "important" | "critical";
  expires_at: string | null;
  is_expired: boolean;
  requires_acknowledgement: boolean;
  target_equipment: { id: number; name: string } | null;
  acknowledged: boolean;
  acknowledged_count?: number;
  audience_count?: number;
}

export interface ConnectNotification {
  id: number;
  event: string;
  title: string;
  message: string;
  link: string;
  actor: string;
  created_at: string;
  read: boolean;
}

export interface NotificationPrefs {
  email_mode: "immediate" | "daily" | "weekly" | "off";
  in_app_enabled: boolean;
  muted_events: string[];
  auto_follow_own_threads: boolean;
  auto_follow_replied_threads: boolean;
  events: Array<{ key: string; label: string }>;
  email_modes: Array<{ key: string; label: string }>;
}

export interface ThreadDetail extends ThreadCard {
  opening_post: PostView | null;
  poll: PollView | null;
  accepted_post_id: number | null;
  solution: SolutionSummary | null;
  announcement?: AnnouncementInfo | null;
  articles: Array<{ id: number; title: string; status: ArticleStatus }>;
  permissions: {
    can_reply: boolean;
    can_moderate: boolean;
    can_edit: boolean;
    can_delete: boolean;
    can_accept: boolean;
    can_curate: boolean;
  };
}

export type ArticleStatus = "draft" | "under_review" | "published" | "archived";

export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: "Draft",
  under_review: "Under Review",
  published: "Published",
  archived: "Archived",
};

export interface ArticleCard {
  id: number;
  title: string;
  summary: string;
  status: ArticleStatus;
  community: { id: number; slug: string; name: string; kind: CommunityKind };
  category: { id: number; name: string } | null;
  equipment: EquipmentRef | null;
  tags: Array<{ slug: string; name: string }>;
  author: { id: number; name: string };
  reviewer: { id: number; name: string } | null;
  is_institutional_guidance: boolean;
  needs_review: boolean;
  version: number;
  view_count: number;
  published_at: string | null;
  last_reviewed_at: string | null;
  updated_at: string;
  source_thread_id: number | null;
}

export interface ArticleDetail extends ArticleCard {
  body_html: string;
  source: { thread_id: number | null; post: { id: number; author: string; badge: string; is_verified_response: boolean } | null };
  permissions: {
    can_edit: boolean;
    can_submit: boolean;
    can_review: boolean;
    can_publish: boolean;
    can_archive: boolean;
    can_restore: boolean;
  };
  reviews?: Array<{ decision: "approved" | "changes_requested" | "rejected"; comment: string; reviewer: string; version: number; created_at: string }>;
}

export interface HomeSections {
  articles?: Array<{ id: number; title: string; community: string; is_institutional_guidance: boolean; published_at: string }>;
  latest: ThreadCard[];
  trending: ThreadCard[];
  recently_solved: ThreadCard[];
  technical_support: ThreadCard[];
  announcements: ThreadCard[];
  active_contributors: Array<{ id: number; name: string; accepted_answers: number; helpful_received: number; replies: number }>;
}

export interface ThreadInput {
  community: string;
  title: string;
  body: string;
  type: ThreadType;
  category_id?: number | null;
  equipment_id?: number | null;
  tags?: string[];
  attachments?: string[];
  poll_options?: string[];
  poll_closes_at?: string | null;
  follow?: boolean;
  priority?: AnnouncementInfo["priority"];
  expires_at?: string | null;
  requires_acknowledgement?: boolean;
  target_equipment_id?: number | null;
  pin?: boolean;
}

export interface DraftPayload {
  title?: string;
  body?: string;
  type?: ThreadType;
  category_id?: number | null;
  community_id?: number | null;
  equipment_id?: number | null;
  tags?: string[];
  attachments?: string[];
  poll_options?: string[];
}

export type FeedParams = Partial<{
  community: string;
  scope: "my_communities" | "general";
  category: string;
  type: string;
  tag: string;
  equipment: number;
  author: number;
  mine: boolean;
  bookmarked: boolean;
  following: boolean;
  status: "solved" | "resolved" | "unsolved" | "unanswered";
  known_problem: boolean;
  from: string;
  to: string;
  q: string;
  sort: "latest" | "new" | "discussed" | "viewed" | "helpful" | "unanswered" | "relevance" | "solved";
  page: number;
  page_size: number;
}>;

function headers(json: boolean): HeadersInit {
  const token = apiClient.getToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

async function request<T>(path: string, init: RequestInit = {}, json = true): Promise<ConnectResult<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${BASE}${path}`, { ...init, headers: headers(json), credentials: "omit" });
    if (res.status === 204) return { status: 204 };
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        error:
          typeof body.detail === "string"
            ? body.detail
            : res.status === 404
              ? "This page is not available to you."
              : `Request failed (HTTP ${res.status})`,
        field: typeof body.field === "string" ? body.field : undefined,
        status: res.status,
      };
    }
    return { data: body as T, status: res.status };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error occurred" };
  }
}

const send = <T>(method: string, path: string, body: unknown = {}) => request<T>(path, { method, body: JSON.stringify(body) });

export function query(params: Record<string, unknown> = {}): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    sp.set(key, value === true ? "1" : String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Fetch an attachment with the signed-in token and return an object URL (caller revokes it). */
export async function attachmentObjectUrl(id: string, inline = true): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${BASE}attachments/${id}/${inline ? "?inline=1" : ""}`, {
      headers: headers(false),
      credentials: "omit",
    });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

export async function downloadAttachment(a: AttachmentRef): Promise<boolean> {
  const url = await attachmentObjectUrl(a.id, false);
  if (!url) return false;
  const link = document.createElement("a");
  link.href = url;
  link.download = a.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

export const connectApi = {
  bootstrap: () => request<ConnectBootstrap>("bootstrap/"),
  home: () => request<HomeSections>("home/"),
  communities: () => request<{ results: CommunitySummary[] }>("communities/"),
  community: (slug: string) => request<CommunityDetail>(`communities/${encodeURIComponent(slug)}/`),
  followCommunity: (slug: string, level: "watching" | "muted" | null) =>
    send<{ level: string | null }>("PUT", `communities/${encodeURIComponent(slug)}/follow/`, { level }),
  mentionCandidates: (slug: string, q: string) =>
    request<{ results: AuthorRef[] }>(`communities/${encodeURIComponent(slug)}/mention-candidates/${query({ q })}`),
  threads: (params: FeedParams = {}) => request<Paginated<ThreadCard>>(`threads/${query(params)}`),
  search: (params: FeedParams = {}) => request<SearchPage>(`search/${query(params)}`),
  suggest: (title: string, community?: string | null, equipment?: number | null) =>
    request<{ results: SearchHit[] }>(`suggest/${query({ title, community: community ?? undefined, equipment: equipment ?? undefined })}`),
  thread: (id: number) => request<ThreadDetail>(`threads/${id}/`),
  createThread: (input: ThreadInput) => send<ThreadDetail>("POST", "threads/", input),
  editThread: (id: number, input: Partial<Pick<ThreadInput, "title" | "body" | "tags" | "category_id" | "attachments">> & { reason?: string }) =>
    send<ThreadDetail>("PATCH", `threads/${id}/`, input),
  deleteThread: (id: number) => request<void>(`threads/${id}/`, { method: "DELETE" }),
  posts: (threadId: number, page = 1) => request<Paginated<PostView>>(`threads/${threadId}/posts/${query({ page })}`),
  reply: (threadId: number, body: string, parentId?: number | null, attachments: string[] = []) =>
    send<PostView>("POST", `threads/${threadId}/posts/`, { body, parent_id: parentId ?? null, attachments }),
  editPost: (postId: number, body: string, attachments: string[] = [], reason = "") =>
    send<PostView>("PATCH", `posts/${postId}/`, { body, attachments, reason }),
  deletePost: (postId: number) => request<void>(`posts/${postId}/`, { method: "DELETE" }),
  revisions: (postId: number) =>
    request<{ results: Array<{ id: number; title: string; body_html: string; editor: string; by_moderator: boolean; reason: string; created_at: string }> }>(
      `posts/${postId}/revisions/`,
    ),
  react: (postId: number, kind: ReactionKind) =>
    send<{ kind: ReactionKind; active: boolean; counts: Partial<Record<ReactionKind, number>> }>("POST", `posts/${postId}/react/`, { kind }),
  bookmark: (threadId: number) => send<{ bookmarked: boolean }>("POST", `threads/${threadId}/bookmark/`),
  follow: (threadId: number, level: "watching" | "muted" | null) =>
    send<{ level: string | null }>("PUT", `threads/${threadId}/follow/`, { level }),
  vote: (threadId: number, optionId: number) => send<PollView>("POST", `threads/${threadId}/vote/`, { option_id: optionId }),
  equipmentDiscussions: (equipmentId: number) => request<EquipmentDiscussions>(`equipment/${equipmentId}/discussions/`),
  staffTools: (
    threadId: number,
    changes: Partial<{ is_pinned: boolean; is_known_problem: boolean; has_workaround: boolean; is_outdated: boolean; resolved: boolean; reason: string }>,
  ) => send<ThreadDetail>("PATCH", `threads/${threadId}/staff/`, changes),
  acceptSolution: (threadId: number, postId: number) => send<ThreadDetail>("POST", `threads/${threadId}/solution/`, { post_id: postId }),
  revokeSolution: (threadId: number) => send<ThreadDetail>("DELETE", `threads/${threadId}/solution/`, {}),
  confirmResolved: (threadId: number) => send<ThreadDetail>("PUT", `threads/${threadId}/solution/`, {}),
  acknowledge: (threadId: number) => send<ThreadDetail>("POST", `threads/${threadId}/acknowledge/`),
  acknowledgements: (threadId: number) =>
    request<{ results: Array<{ user_id: number; name: string; acknowledged_at: string }> }>(`threads/${threadId}/acknowledge/`),
  notifications: (params: { page?: number; unread?: boolean } = {}) =>
    request<Paginated<ConnectNotification> & { unread_count: number }>(`notifications/${query(params)}`),
  markNotificationsRead: (ids: number[] | "all") =>
    send<{ marked: number }>("POST", "notifications/read/", ids === "all" ? { all: true } : { ids }),
  notificationPrefs: () => request<NotificationPrefs>("notifications/preferences/"),
  saveNotificationPrefs: (input: Partial<Omit<NotificationPrefs, "events" | "email_modes">>) =>
    send<NotificationPrefs>("PUT", "notifications/preferences/", input),
  articles: (params: Partial<{ status: "published" | "workflow" | ArticleStatus; community: string; equipment: number; tag: string; q: string; guidance: boolean; page: number }> = {}) =>
    request<Paginated<ArticleCard>>(`articles/${query(params)}`),
  article: (id: number) => request<ArticleDetail>(`articles/${id}/`),
  promote: (input: { thread_id: number; post_id?: number | null; title?: string; summary?: string }) => send<ArticleDetail>("POST", "articles/", input),
  editArticle: (id: number, input: Partial<{ title: string; summary: string; body: string; tags: string[]; note: string }>) =>
    send<ArticleDetail>("PATCH", `articles/${id}/`, input),
  articleAction: (
    id: number,
    action: "submit" | "review" | "publish" | "archive" | "restore",
    body: Partial<{ decision: "approved" | "changes_requested" | "rejected"; comment: string; institutional: boolean; reason: string }> = {},
  ) => send<ArticleDetail>("POST", `articles/${id}/${action}/`, body),
  articleRevisions: (id: number) =>
    request<{ results: Array<{ version: number; title: string; summary: string; body_html: string; status: string; editor: string; note: string; created_at: string }> }>(
      `articles/${id}/revisions/`,
    ),
  categories: (community?: string) => request<{ results: CategoryRef[] }>(`categories/${query({ community })}`),
  tags: (q = "") => request<{ results: Array<{ slug: string; name: string; count: number }> }>(`tags/${query({ q })}`),
  draft: (key: string) => request<{ context_key: string; payload: DraftPayload; updated_at: string }>(`drafts/${encodeURIComponent(key)}/`),
  saveDraft: (key: string, payload: DraftPayload) =>
    send<{ context_key: string; updated_at: string }>("PUT", `drafts/${encodeURIComponent(key)}/`, { payload }),
  deleteDraft: (key: string) => request<void>(`drafts/${encodeURIComponent(key)}/`, { method: "DELETE" }),
  upload: (community: string, file: File, inline = false) => {
    const form = new FormData();
    form.append("community", community);
    form.append("file", file);
    if (inline) form.append("inline", "1");
    return request<AttachmentRef>("attachments/", { method: "POST", body: form }, false);
  },
  removeUpload: (id: string) => request<void>(`attachments/${id}/`, { method: "DELETE" }),
};
