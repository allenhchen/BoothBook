import {getChatGPTUser} from '@/app/chatgpt-auth';
import {artistKey,type Artist} from './artist-store';
export async function authenticatedArtist():Promise<Artist|null>{
 const user=await getChatGPTUser();
 if(!user)return null;
 return {id:artistKey('chatgpt',user.userId),email:user.email,displayName:user.displayName,provider:'chatgpt'};
}
// External provider adapters must supply a server-verified issuer/subject.
// Never accept an artist ID or email from request JSON as authentication.
// Google authentication is intentionally unavailable until a supported host
// authentication path and a Google OAuth client have been configured.
