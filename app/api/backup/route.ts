import { env } from 'cloudflare:workers';
import { authenticatedArtist } from '@/lib/artist-auth';
import { database } from '@/lib/storage';
import { createBackupApi } from '@/lib/workspace-backup';
export const dynamic = 'force-dynamic';
function api() {
  return createBackupApi({
    database,
    authenticatedArtist,
    legacyOwnerEmail: (env as unknown as Record<string, string>).LEGACY_OWNER_EMAIL || '',
  });
}
export function GET() {
  return api().GET();
}
export function POST(req: Request) {
  return api().POST(req);
}
