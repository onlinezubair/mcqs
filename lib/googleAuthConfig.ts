export function getGoogleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
}

export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
export const APP_FOLDER_NAME = 'MCQ Projector Data';
export const SETTINGS_FILE_NAME = 'settings.json';
export const PAPERS_FOLDER_NAME = 'papers';