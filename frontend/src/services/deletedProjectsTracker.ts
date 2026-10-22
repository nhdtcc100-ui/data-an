// ==============================================================================
// deletedProjectsTracker.ts - Persistent blacklist for permanently deleted projects
// Prevents any deleted project from resurrecting upon refresh or from cache/DB lags
// ==============================================================================

const DELETED_PROJECTS_KEY = 'lens_bi_deleted_project_ids_v1';

export function getDeletedProjectIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PROJECTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markProjectAsDeleted(id: string): void {
  if (!id) return;
  try {
    const set = getDeletedProjectIds();
    set.add(id);
    localStorage.setItem(DELETED_PROJECTS_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('[deletedProjectsTracker] Failed to persist deleted ID:', err);
  }
}

export function isProjectDeleted(id: string): boolean {
  if (!id) return false;
  return getDeletedProjectIds().has(id);
}

export function unmarkProjectAsDeleted(id: string): void {
  if (!id) return;
  try {
    const set = getDeletedProjectIds();
    set.delete(id);
    localStorage.setItem(DELETED_PROJECTS_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('[deletedProjectsTracker] Failed to unmark deleted ID:', err);
  }
}
