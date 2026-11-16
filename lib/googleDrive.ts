import { getGoogleClientId, GOOGLE_SCOPES, APP_FOLDER_NAME, SETTINGS_FILE_NAME, PAPERS_FOLDER_NAME } from './googleAuthConfig';
import type { CloudSettings, PaperIndexEntry, SavedPaper, GoogleSession, DraftInput } from '@/types';
import { safeParse, cloudSettingsSchema, paperIndexEntrySchema, savedPaperSchema } from './schemas';

const GSI_URL = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void;
          }) => {
            config: {
              client_id: string;
              callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void;
            };
            requestAccessToken: (options: { prompt: string; hint?: string }) => void;
          };
          revoke: (clientId: string, callback: () => void) => void;
        };
      };
    };
  }
}

type TokenClient = {
  config: {
    client_id: string;
    callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void;
  };
  requestAccessToken: (options: { prompt: string; hint?: string }) => void;
};

let tokenClient: TokenClient | null = null;
let gisLoaded = false;

function loadGsiScript(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load GSI script'));
    document.head.appendChild(script);
  });
}

export async function initGoogleAuth(): Promise<void> {
  const clientId = getGoogleClientId();
  if (!clientId) return;

  await loadGsiScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services not loaded');
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_SCOPES,
    callback: (response) => {
      if (response.access_token) {
        const expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
        sessionStorage.setItem('mcqProjector_google_token', JSON.stringify({
          accessToken: response.access_token,
          expiresAt,
          email: '',
        }));
      }
    },
  });
}

export async function requestAccessToken(prompt: 'consent' | '' = 'consent', hint?: string): Promise<string> {
  if (!tokenClient) await initGoogleAuth();
  if (!tokenClient) throw new Error('Google auth not initialized');

  return new Promise((resolve, reject) => {
    const originalCallback = tokenClient!.config.callback;
    tokenClient!.config.callback = (response: { access_token?: string; error?: string }) => {
      if (response.access_token) {
        const expiresAt = Date.now() + 3600 * 1000;
        const session: GoogleSession = { accessToken: response.access_token, expiresAt, email: hint || '' };
        sessionStorage.setItem('mcqProjector_google_token', JSON.stringify(session));
        resolve(response.access_token);
      } else {
        reject(new Error(response.error || 'Token request failed'));
      }
      tokenClient!.config.callback = originalCallback;
    };
    tokenClient!.requestAccessToken({ prompt, hint });
  });
}

export async function getValidAccessToken(): Promise<string | null> {
  const stored = sessionStorage.getItem('mcqProjector_google_token');
  if (!stored) return null;

  try {
    const session: GoogleSession = JSON.parse(stored);
    if (session.expiresAt > Date.now() + 5 * 60 * 1000) {
      return session.accessToken;
    }
  } catch {
    return null;
  }

  try {
    return await requestAccessToken('', JSON.parse(stored).email);
  } catch {
    sessionStorage.removeItem('mcqProjector_google_token');
    return null;
  }
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated');

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getOrCreateAppFolder(): Promise<string> {
  const response = await fetchWithAuth(
    `https://www.googleapis.com/drive/v3/files?q=name='${APP_FOLDER_NAME}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)`
  );
  const data = await response.json();
  if (data.files?.length > 0) return data.files[0].id;

  const createResponse = await fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createResponse.json();
  return folder.id;
}

export async function syncSettingsToDrive(settings: CloudSettings): Promise<void> {
  const folderId = await getOrCreateAppFolder();
  const response = await fetchWithAuth(
    `https://www.googleapis.com/drive/v3/files?q=name='${SETTINGS_FILE_NAME}'+and+parents+in+'${folderId}'+and+trashed=false&fields=files(id)`
  );
  const data = await response.json();

  const fileMetadata = {
    name: SETTINGS_FILE_NAME,
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
  formData.append('file', new Blob([JSON.stringify(settings)], { type: 'application/json' }));

  if (data.files?.length > 0) {
    await fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${data.files[0].id}?uploadType=multipart`, {
      method: 'PATCH',
      body: formData,
    });
  } else {
    await fetchWithAuth('https://www.googleapis.com/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      body: formData,
    });
  }
}

export async function loadSettingsFromDrive(): Promise<CloudSettings | null> {
  try {
    const folderId = await getOrCreateAppFolder();
    const response = await fetchWithAuth(
      `https://www.googleapis.com/drive/v3/files?q=name='${SETTINGS_FILE_NAME}'+and+parents+in+'${folderId}'+and+trashed=false&fields=files(id,modifiedTime)`
    );
    const data = await response.json();
    if (!data.files?.length) return null;

    const fileId = data.files[0].id;
    const fileResponse = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    const content = await fileResponse.json();
    const parsed = safeParse(cloudSettingsSchema, content);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function listPapers(): Promise<PaperIndexEntry[]> {
  try {
    const folderId = await getOrCreateAppFolder();
    const papersFolderResponse = await fetchWithAuth(
      `https://www.googleapis.com/drive/v3/files?q=name='${PAPERS_FOLDER_NAME}'+and+parents+in+'${folderId}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id)`
    );
    const papersFolderData = await papersFolderResponse.json();
    let papersFolderId = papersFolderData.files?.[0]?.id;

    if (!papersFolderId) {
      const createResponse = await fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: PAPERS_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folderId],
        }),
      });
      const folder = await createResponse.json();
      papersFolderId = folder.id;
    }

    const response = await fetchWithAuth(
      `https://www.googleapis.com/drive/v3/files?q=parents+in+'${papersFolderId}'+and+trashed=false&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`
    );
    const data = await response.json();
    return (data.files || []).map((f: { id: string; name: string; modifiedTime: string }) => ({
      id: f.id,
      name: f.name,
      driveFileId: f.id,
      remoteModifiedTime: f.modifiedTime,
    }));
  } catch {
    return [];
  }
}

export async function savePaperToDrive(draft: DraftInput, name: string): Promise<string> {
  const folderId = await getOrCreateAppFolder();
  const papersFolderResponse = await fetchWithAuth(
    `https://www.googleapis.com/drive/v3/files?q=name='${PAPERS_FOLDER_NAME}'+and+parents+in+'${folderId}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id)`
  );
  const papersFolderData = await papersFolderResponse.json();
  let papersFolderId = papersFolderData.files?.[0]?.id;

  if (!papersFolderId) {
    const createResponse = await fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: PAPERS_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId],
      }),
    });
    const folder = await createResponse.json();
    papersFolderId = folder.id;
  }

  const paperData: SavedPaper = {
    draft,
    createdAt: Date.now(),
    schema: 1,
  };

  const fileName = `${name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
  const fileMetadata = { name: fileName, parents: [papersFolderId] };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
  formData.append('file', new Blob([JSON.stringify(paperData)], { type: 'application/json' }));

  const response = await fetchWithAuth('https://www.googleapis.com/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    body: formData,
  });
  const file = await response.json();
  return file.id;
}

export async function loadPaperFromDrive(driveFileId: string): Promise<unknown | null> {
  try {
    const response = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`);
    const content = await response.json();
    const parsed = safeParse(savedPaperSchema, content);
    return parsed.success ? parsed.data?.draft : null;
  } catch {
    return null;
  }
}

export function signOutGoogle(): void {
  sessionStorage.removeItem('mcqProjector_google_token');
  if (tokenClient && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(tokenClient.config.client_id, () => {});
  }
}

export function getStoredEmail(): string | null {
  const stored = sessionStorage.getItem('mcqProjector_google_token');
  if (!stored) return null;
  try {
    return JSON.parse(stored).email || null;
  } catch {
    return null;
  }
}