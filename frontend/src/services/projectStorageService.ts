// ==============================================================================
// projectStorageService.ts
// نظام التخزين السحابي لمشاريع Supabase Storage
// مسار التخزين: project-files/{projectId}/{timestamp}_{fileName}
// ==============================================================================
import { supabase } from './supabaseClient';

export const PROJECT_STORAGE_BUCKET = 'project-files';

export interface ProjectStoredFile {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string;
  projectId: string;
}

/**
 * Ensures the project storage bucket exists (if permissions allow)
 */
export async function ensureProjectStorageBucket(): Promise<boolean> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === PROJECT_STORAGE_BUCKET);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(PROJECT_STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });
      if (error && !error.message.includes('already exists')) {
        console.warn('Could not auto-create bucket via API, might require SQL migration:', error.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.warn('Bucket check failed (using local or restricted mode):', err);
    return false;
  }
}

/**
 * Generates an S3 / Supabase Storage compliant ASCII-only object key.
 * Preserves the file extension and converts Arabic / Unicode characters into a deterministic safe slug.
 */
export function getStorageSafeKey(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  const ext = lastDot > 0 ? fileName.substring(lastDot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  const rawBase = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;

  // Extract clean ASCII alphanumeric characters
  const asciiBase = rawBase
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Calculate a deterministic hash for the full original filename
  let hash = 0;
  for (let i = 0; i < fileName.length; i++) {
    hash = ((hash << 5) - hash) + fileName.charCodeAt(i);
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(36);

  if (asciiBase && asciiBase.length > 0) {
    return `${asciiBase.slice(0, 40)}_${hashStr}${ext}`;
  }

  // Pure non-ASCII / Arabic filename (e.g. بيانات_ببسي_بغداد.xlsx)
  return `dataset_${hashStr}${ext}`;
}

/**
 * Uploads a raw project file (Excel/CSV/JSON) to Supabase Storage
 * Path structure: {projectId}/{timestamp}_{safeFileName}
 */
export async function uploadProjectFile(
  projectId: string,
  file: File | Blob,
  fileName: string
): Promise<{ success: boolean; filePath?: string; publicUrl?: string; error?: string }> {
  try {
    await ensureProjectStorageBucket();

    const cleanProjectId = (projectId || 'proj-default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = getStorageSafeKey(fileName || 'dataset.xlsx');
    const timestamp = Date.now();
    const filePath = `${cleanProjectId}/${timestamp}_${safeFileName}`;

    const { data, error } = await supabase.storage
      .from(PROJECT_STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: (file instanceof File && file.type) ? file.type : undefined
      });

    if (error) {
      console.warn('Supabase storage upload error:', error.message);
      return { success: false, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from(PROJECT_STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return {
      success: true,
      filePath: data.path,
      publicUrl: urlData.publicUrl
    };
  } catch (err: any) {
    console.error('Failed to upload file to project storage:', err);
    return { success: false, error: err.message || 'فشل رفع الملف إلى Supabase Storage' };
  }
}

/**
 * Lists all stored files for a specific project
 */
export async function listProjectStoredFiles(projectId: string): Promise<ProjectStoredFile[]> {
  try {
    const { data, error } = await supabase.storage
      .from(PROJECT_STORAGE_BUCKET)
      .list(projectId, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.warn(`Could not list files for project ${projectId}:`, error.message);
      return [];
    }

    if (!data) return [];

    return data
      .filter((item) => item.name && !item.name.startsWith('.'))
      .map((item) => {
        const fullPath = `${projectId}/${item.name}`;
        const { data: urlData } = supabase.storage
          .from(PROJECT_STORAGE_BUCKET)
          .getPublicUrl(fullPath);

        return {
          id: item.id || item.name,
          name: item.name,
          path: fullPath,
          sizeBytes: item.metadata?.size || 0,
          createdAt: item.created_at || new Date().toISOString(),
          updatedAt: item.updated_at || item.created_at || new Date().toISOString(),
          downloadUrl: urlData.publicUrl,
          projectId
        };
      });
  } catch (err) {
    console.error('Error listing project files:', err);
    return [];
  }
}

/**
 * Deletes a file from project storage
 */
export async function deleteProjectStoredFile(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(PROJECT_STORAGE_BUCKET)
      .remove([filePath]);
    return !error;
  } catch (err) {
    console.error('Failed to delete file from storage:', err);
    return false;
  }
}
