import {env} from 'cloudflare:workers';
import {authenticatedArtist} from '@/lib/artist-auth';
import {database} from '@/lib/storage';
import {createWorkspaceApi} from '@/lib/workspace-api';
export const dynamic='force-dynamic';
function api(){return createWorkspaceApi({database,authenticatedArtist,legacyOwnerEmail:(env as unknown as Record<string,string>).LEGACY_OWNER_EMAIL||''})}
export function GET(req?:Request){return api().GET(req)}
export function POST(req:Request){return api().POST(req)}
