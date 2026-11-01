import { apiClient } from "@/lib/api";

export type PolicyPageLink = { slug: string; title: string };

let cached: Promise<PolicyPageLink[]> | null = null;

/**
 * The published website policy pages (Terms, Privacy, Refunds, About) for the footer. Fetched once per page load;
 * an error or an unpublished page simply leaves the link out.
 */
export function loadPolicyPages(): Promise<PolicyPageLink[]> {
  if (!cached) {
    cached = apiClient
      .getPolicyPages()
      .then((res) => (Array.isArray(res.data?.pages) ? res.data.pages : []))
      .catch(() => []);
  }
  return cached;
}

/** Tests only. */
export function resetPolicyPagesCache(): void {
  cached = null;
}
