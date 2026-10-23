// ==============================================================================
// projectsDbService.ts - Project DB persistence service (PostgreSQL / Supabase)
// ==============================================================================
import { supabase } from './supabaseClient';
import type { Project } from '../types/project';
import { getDeletedProjectIds } from './deletedProjectsTracker';

const MAX_ROWS = 500;

function toDbRow(p: Project, isActive: boolean) {
  const rawRows = p.dataSource?.rawRows || [];
  const ds = {
    ...p.dataSource,
    rawRows: rawRows.slice(0, MAX_ROWS)
  };

  return {
    id: p.id,
    title: p.title || 'مشروع جديد',
    description: p.description || null,
    category: p.category || 'sales',
    icon: p.icon || '📊',
    color_accent: p.colorAccent || 'sky',
    data_source_type: p.dataSourceType || 'google_sheets',
    google_sheet_url: p.googleSheetUrl || null,
    is_public: p.isPublic ?? false,
    is_active: isActive,
    dashboard: (p.dashboard as any) || {},
    data_source: (ds as any) || {},
    database_config: (p.databaseConfig as any) || null,
    active_filters: p.activeFilters || {},
    widget_filters: p.widgetFilters || {},
    drill_down_states: p.drillDownStates || {},
    theme: p.theme || 'dark',
    motion_theme: p.motionTheme || p.dashboard?.motionTheme || 'glass-capsule',
    updated_at: new Date().toISOString()
  };
}

function fromDbRow(r: any): Project {
  const dash = r.dashboard || {};
  const motionTheme = r.motion_theme || dash.motionTheme || 'glass-capsule';
  const widgets = (dash.widgets || []).map((w: any) => ({
    ...w,
    layout: {
      x: w.layout?.x ?? 0,
      y: w.layout?.y ?? 0,
      w: w.layout?.w ?? (w.type === 'slicer' || w.type === 'table' ? 12 : 6),
      h: w.layout?.h ?? (w.type === 'kpi' ? 2 : w.type === 'table' ? 5 : 4),
      i: w.layout?.i || w.id || `w-${Math.random().toString(36).substring(2, 9)}`,
      ...(w.layout || {})
    }
  }));

  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    category: r.category || 'sales',
    icon: r.icon || '📊',
    colorAccent: r.color_accent || 'sky',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    dataSourceType: r.data_source_type || 'google_sheets',
    googleSheetUrl: r.google_sheet_url || undefined,
    isPublic: r.is_public ?? false,
    databaseConfig: r.database_config || undefined,
    motionTheme,
    dashboard: {
      ...dash,
      motionTheme,
      widgets
    },
    dataSource: r.data_source,
    activeFilters: r.active_filters || {},
    widgetFilters: r.widget_filters || {},
    drillDownStates: r.drill_down_states || {},
    theme: r.theme || 'dark'
  };
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  projects?: Project[];
  activeProjectId?: string;
  error?: string;
}

/**
 * Save all projects to PostgreSQL (excluding any permanently deleted projects)
 */
export async function saveAllProjectsToDb(projects: Project[], activeProjectId: string): Promise<SaveResult> {
  try {
    if (!projects || projects.length === 0) return { success: true };

    // STRICT GUARD: Filter out any projects that were marked deleted to prevent resurrection
    const deletedIds = getDeletedProjectIds();
    const validProjects = projects.filter((p) => p && p.id && !deletedIds.has(p.id));

    if (validProjects.length === 0) return { success: true };

    const rows = validProjects.map((p) => toDbRow(p, p.id === activeProjectId));
    const { error } = await supabase.from('projects').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn('[projectsDb] upsert error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Save error' };
  }
}

/**
 * Save a single project to PostgreSQL
 */
export async function saveProjectToDb(project: Project, isActive: boolean): Promise<SaveResult> {
  try {
    if (!project || !project.id) return { success: false, error: 'Invalid project' };

    // STRICT GUARD: Never save a project that is in deleted tracker
    const deletedIds = getDeletedProjectIds();
    if (deletedIds.has(project.id)) {
      console.warn('[projectsDb] Blocked save for deleted project:', project.id);
      return { success: true };
    }

    if (isActive) {
      // Mark others as inactive
      await supabase.from('projects').update({ is_active: false }).neq('id', project.id);
    }
    const row = toDbRow(project, isActive);
    const { error } = await supabase.from('projects').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[projectsDb] saveProject error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Save error' };
  }
}

/**
 * Load all projects from PostgreSQL
 */
export async function loadProjectsFromDb(): Promise<LoadResult> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[projectsDb] load error:', error.message);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, projects: [], activeProjectId: undefined };
    }

    const loaded = data
      .map(fromDbRow)
      .filter((p: Project) => Boolean(p.id && p.dashboard && p.dataSource));

    const activeRow = data.find((r: any) => r.is_active === true);
    const activeId = activeRow?.id || loaded[0]?.id;

    return {
      success: true,
      projects: loaded,
      activeProjectId: activeId
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Load error' };
  }
}

/**
 * Load a single project by ID (used for dedicated public share links)
 */
export async function loadProjectByIdFromDb(projectId: string): Promise<{ success: boolean; project?: Project; error?: string }> {
  try {
    if (!projectId) return { success: false, error: 'Project ID is required' };

    const deletedIds = getDeletedProjectIds();
    if (deletedIds.has(projectId)) {
      return { success: false, error: 'المشروع تم حذفه من قاعدة البيانات' };
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      console.warn('[projectsDb] loadProjectById error:', error.message);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'المشروع غير موجود أو تم حذفه' };
    }

    const project = fromDbRow(data);
    return { success: true, project };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Load error' };
  }
}

/**
 * Delete a project from PostgreSQL with cascading cleanup
 */
export async function deleteProjectFromDb(projectId: string): Promise<SaveResult> {
  try {
    if (!projectId) return { success: true };

    // 1. Delete from projects table
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      console.warn('[projectsDb] delete error:', error.message);
      return { success: false, error: error.message };
    }

    // 2. Cascade cleanup in project_files table (best effort)
    try {
      await supabase.from('project_files').delete().eq('project_id', projectId);
    } catch {
      // project_files cleanup is best-effort
    }

    // 3. Cascade cleanup in storage objects (files in project folder)
    try {
      const { data: files } = await supabase.storage.from('project-files').list(projectId);
      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${projectId}/${f.name}`);
        await supabase.storage.from('project-files').remove(filePaths);
      }
    } catch {
      // storage bucket cleanup is best-effort
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Delete error' };
  }
}
