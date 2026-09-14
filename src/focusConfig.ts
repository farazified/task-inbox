// ── focusConfig.ts ── edit this file to change sign-in settings ──

/**
 * Public OAuth client id, same shape as the SEO-IQ dashboard's config.js. This is
 * not a secret: the browser runs the implicit flow, so there is no client secret
 * anywhere in this project.
 *
 * To use it, the Google Cloud project behind this id needs:
 *   • the Google Calendar API enabled,
 *   • the two scopes below listed on its OAuth consent screen,
 *   • http://127.0.0.1:5173 as an authorized JavaScript origin and redirect URI.
 */
export const CLIENT_ID =
  '890208838259-0ns3e1isj4u53uj080c3drl2lsqmjk9o.apps.googleusercontent.com'

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid email profile',
].join(' ')

/** sessionStorage key, so the token dies with the browser session. */
export const TOKEN_KEY = 'focus_tok'
export const TOKEN_EXPIRY_KEY = 'focus_tok_exp'
export const ACCOUNT_KEY = 'focus_account'
