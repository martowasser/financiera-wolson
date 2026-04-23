// Active-state logic for sidebar items that may carry a ?tab= param.
// Items without a tab-specific href match by pathname prefix. Items with
// ?tab=X match only when the URL's current tab equals X. Pages that default
// to a tab when none is present in the URL (e.g. /entities defaults to
// Sociedades) are handled via the `defaultTabByBase` table.
const defaultTabByBase: Record<string, string> = {
  '/entities': 'sociedades',
  '/viewer/entities': 'sociedades',
};

export function isNavItemActive(
  href: string,
  pathname: string,
  currentTab: string | null,
): boolean {
  const [base, qs] = href.split('?');
  if (!pathname.startsWith(base)) return false;
  if (!qs) return true;
  const wantedTab = new URLSearchParams(qs).get('tab');
  if (!wantedTab) return true;
  const effectiveTab = currentTab ?? defaultTabByBase[base] ?? null;
  return effectiveTab === wantedTab;
}
