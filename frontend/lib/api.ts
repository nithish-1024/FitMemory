/**
 * FitMemory Typed API Client
 * Connects to the FastAPI backend (default http://localhost:8000)
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any
  ) {
    super(`API Error ${status}: ${statusText}${data?.detail ? ` - ${data.detail}` : ""}`);
    this.name = "ApiError";
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    clearTimeout(id);

    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch {
        // Non-JSON error
      }
      throw new ApiError(response.status, response.statusText, errorData);
    }

    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// ----------------- TYPE DEFINITIONS -----------------

export interface ItemAttributes {
  color?: string;
  type?: string;
  fit?: string;
  texture?: string;
  palette?: string;
  formality?: number;
  [key: string]: any;
}

export interface WardrobeItem {
  id: string;
  name: string;
  photo: string;
  attributes: ItemAttributes;
}

export interface DiscoveredItem {
  name: string;
  color: string;
  category: string;
  description?: string;
}

export interface RecommendationResponse {
  user_id: string;
  item_ids: string[];
  items: WardrobeItem[];
  reasoning: string;
  attributes_used: {
    color?: string[];
    type?: string[];
    fit?: string[];
    texture?: string[];
    [key: string]: string[] | undefined;
  };
  kb_rules_used: string[];
  profile_applied: boolean;
  image_prompt: string;
  image_url: string;
  used_fallback: boolean;
  mode?: "closet" | "discover";
  new_item?: DiscoveredItem | null;
}

export interface FeedbackPayload {
  user_id: string;
  item_ids: string[];
  action: "accept" | "reject";
  attributes_used?: Record<string, any>;
  clarification?: string | null;
  reasoning?: string | null;
}

export interface ClarificationOption {
  key: string;
  label: string;
}

export interface FeedbackProbeResponse {
  needs_clarification: true;
  options: ClarificationOption[];
  item_ids: string[];
}

export interface ProfileConfidenceSnapshot {
  attribute: string;
  sentiment: number;
  confidence: number;
  evidence: number;
}

export interface FeedbackDecisionResponse {
  needs_clarification: false;
  written: boolean;
  memory_write_summary: string;
  profile_confidence_snapshot: ProfileConfidenceSnapshot[];
  suggestion?: string;
}

export type FeedbackResponse = FeedbackProbeResponse | FeedbackDecisionResponse;

export interface FeedbackLogEntry {
  timestamp: string;
  item_ids: string[];
  action: "accept" | "reject";
  clarification: string | null;
  attributes_used: Record<string, string[]>;
  reasoning: string;
}

export interface MemoryPreference {
  category: string;
  value: string;
  direction: "likes" | "avoids";
  label: string;
  confidence: number;
  strength: "strong" | "moderate" | "early signal";
  evidence: number;
}

export interface MemoryViewerResponse {
  user_id: string;
  preferences: MemoryPreference[];
  mood_flags: number;
  recent_activity: FeedbackLogEntry[];
  summary: string;
}

// ----------------- API CLIENT FUNCTIONS -----------------

/**
 * Health check endpoint
 * GET /health
 */
export async function getHealth(): Promise<{ status: string }> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/health`);
  return res.json();
}

/**
 * Get wardrobe for a user
 * GET /wardrobe/{user_id}
 */
export async function getWardrobe(userId: string): Promise<WardrobeItem[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/wardrobe/${encodeURIComponent(userId)}`);
  return res.json();
}

/**
 * Request an outfit recommendation
 * POST /recommend
 */
export async function recommendOutfit(
  userId: string,
  exclude: string[] | string[][] = [],
  mode: "closet" | "discover" = "closet"
): Promise<RecommendationResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/recommend`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      exclude,
      mode,
    }),
  });
  return res.json();
}

/**
 * Submit feedback on an outfit
 * POST /feedback
 */
export async function submitFeedback(
  payload: FeedbackPayload
): Promise<FeedbackResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/feedback`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

/**
 * Retrieve recent feedback interactions
 * GET /feedback-log/{user_id}?limit={limit}
 */
export async function getFeedbackLog(
  userId: string,
  limit: number = 5
): Promise<FeedbackLogEntry[]> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/feedback-log/${encodeURIComponent(userId)}?limit=${limit}`
  );
  return res.json();
}

/**
 * Get human-readable persistent memory profile
 * GET /memory/{user_id}
 */
export async function getMemory(userId: string): Promise<MemoryViewerResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/memory/${encodeURIComponent(userId)}`);
  return res.json();
}
