import { authenticatedArtist } from '@/lib/artist-auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json(
    {
      artist: await authenticatedArtist(),
      providers: {
        chatgpt: { available: true, signInPath: '/signin-with-chatgpt?return_to=%2F' },
        google: {
          available: false,
          reason: 'Google sign-in has not been configured for this deployment.',
        },
      },
    },
    { headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
  );
}
