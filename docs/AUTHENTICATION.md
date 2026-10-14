# Artist accounts and sign-in

## Implemented
Every authenticated visitor has an artist profile and its own versioned D1 workspace. Artist keys are derived on the server from provider and verified subject, never from email, request JSON, or a workspace picker. Every read and write is scoped to that artist key. Anonymous requests return 401. Browser writes require a same-origin Origin header. Responses containing workspace/account data are not cached.

The current deployed identity provider is ChatGPT, authenticated by the Sites dispatcher. The `/account` screen shows the current identity and sign-out; it also shows Google as unavailable. Google does not authenticate users in this version. `/api/auth/session` reports this provider status accurately.

Fresh artist accounts start with empty catalogs, deals, conventions, and sales. The original legacy workspace is preserved in its original table and copied only to the configured original ChatGPT owner. A durable claim prevents a later account from inheriting it again. Configure `LEGACY_OWNER_EMAIL` server-side before deploying this migration. No other visitor receives legacy data. OAuth providers are not automatically linked by matching email.

## Google activation: remaining work
The current Sites tooling exposes dispatch-owned ChatGPT authentication, but no confirmed Google authentication provisioning path. Sites skill instructions require confirmation of a supported external-provider path before adding an app-owned OAuth stack. The disabled Google button is a scaffold placeholder, not an OAuth integration.

To complete Google sign-in on a confirmed compatible deployment:
1. Register a Google OAuth web application and exact callback URLs for each environment.
2. Configure client ID and secret using server-side secrets (never commit the secret).
3. Use a maintained authentication provider/library to implement authorization code flow, state, PKCE, nonce, verified issuer/audience/subject, and secure HTTP-only sessions.
4. Extend `authenticatedArtist()` to resolve verified Google subjects through `artistKey('google', subject)`; continue rejecting anonymous requests.
5. Add session sign-out, CSRF protection, provider error handling, and tests for invalid/expired sessions.
6. Explicitly design authenticated account linking if existing ChatGPT artists should use Google to access the same workspace. Do not merge accounts on email alone.
7. Only then enable Google in `/api/auth/session` and `/account`.

Preview visitor access and application account ownership are separate: this Site remains owner-private. Account isolation is ready for other authenticated visitors when Site access is explicitly expanded. No external invitations or audience changes were made.
