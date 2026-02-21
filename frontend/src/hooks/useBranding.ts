import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBrandingStore } from '../store/brandingStore';

/**
 * Detects org context from:
 *  1. URL query param: ?org=<slug>   (used on login page and candidate invite links)
 *  2. sessionStorage key 'org_slug'  (set when candidate verifies their invite token)
 * Then loads and applies org branding via brandingStore.
 */
export function useBranding() {
  const [searchParams] = useSearchParams();
  const loadBranding = useBrandingStore((s) => s.loadBranding);
  const loaded = useBrandingStore((s) => s.loaded);

  const orgSlugFromParam = searchParams.get('org');
  const orgSlugFromSession =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('org_slug')
      : null;

  const orgSlug = orgSlugFromParam || orgSlugFromSession || null;

  useEffect(() => {
    if (orgSlug && !loaded) {
      loadBranding(orgSlug);
    }
  }, [orgSlug, loaded, loadBranding]);

  return { orgSlug };
}
