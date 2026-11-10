/**
 * Auth0 SPA client.
 *
 * One client instance for the whole app. The SDK keeps tokens in memory, so a
 * page reload does not leave a bearer token sitting in localStorage where the
 * next person at a shared front desk could lift it. TrackSimply's own session
 * (which holds the role) is stored separately, by AuthContext.
 *
 * The client id and domain are public by design — they ship in the browser
 * bundle of every SPA that uses Auth0. The client SECRET is what must never
 * appear here, and a SPA application does not have one.
 *
 * Nothing in this file decides who may enter the app. It only proves identity.
 * AuthContext maps the verified email onto a row in site_users and reads the
 * role from there.
 */

/* The SDK is ~250 kB. Importing it eagerly costs every visitor, including
   everyone who never signs in with Auth0, so it is loaded on demand: when the
   button is pressed or when the page is returning from a redirect. */
const loadSdk = () => import('@auth0/auth0-spa-js');

/* Fallbacks match the application configured for this project, so the app runs
   without extra setup. Override with VITE_AUTH0_DOMAIN / VITE_AUTH0_CLIENT_ID
   if the tenant or application changes. */
const DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN || 'dev-khv0g5lmbvhwr174.us.auth0.com';
const CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || 'BRxAT0jrLX8ySZACCOEWptWhr8f7U15I';

/* Auth0's standard identifier for the Google social connection. Override only
   if the connection was given a different name in the tenant. */
const GOOGLE_CONNECTION = import.meta.env.VITE_AUTH0_GOOGLE_CONNECTION || 'google-oauth2';

/* The callback must match an Allowed Callback URL in the Auth0 application and
   the origin must match an Allowed Web Origin, or the login fails on return.
   Deriving it from the current origin means a local session on
   http://localhost:5173 and the deployed site each send their own — which is
   why localhost has to be registered in Auth0 as well.

   The trailing slash is deliberate. Auth0 compares the full string, and the
   deployed application in this tenant is registered as
   https://track-simply.vercel.app/ — so the redirect has to carry the slash to
   match it. VITE_AUTH0_REDIRECT_URI overrides this for an unusual setup. */
export const auth0RedirectUri = () => {
  const configured = import.meta.env.VITE_AUTH0_REDIRECT_URI;
  if (configured) return configured;
  return typeof window !== 'undefined' ? `${window.location.origin}/` : '';
};

let clientPromise = null;

/** Lazily creates the client, and reuses it on every later call. */
export function getAuth0Client() {
  if (!clientPromise) {
    clientPromise = loadSdk().then(({ createAuth0Client }) =>
      createAuth0Client({
        domain: DOMAIN,
        clientId: CLIENT_ID,
        authorizationParams: { redirect_uri: auth0RedirectUri() },
        cacheLocation: 'memory',
        useRefreshTokens: false,
      }),
    );
  }
  return clientPromise;
}

/**
 * Opens Auth0 in a POPUP and resolves with the user profile once the provider
 * is finished.
 *
 * A popup is deliberate. A full-page redirect hands the visitor to a hosted
 * page we do not control, with no way back except the browser's history; a
 * popup is a real window with its own close button, so cancelling is always
 * possible. It also leaves the app where it was instead of reloading it.
 */
export async function loginWithAuth0({ signup = false, connection } = {}) {
  const client = await getAuth0Client();
  await client.loginWithPopup({
    authorizationParams: {
      redirect_uri: auth0RedirectUri(),
      // Supplying a connection sends the visitor straight to that provider
      // instead of the Auth0 chooser page.
      ...(connection ? { connection } : {}),
      ...(signup ? { screen_hint: 'signup' } : {}),
    },
  });
  return client.getUser();
}

/**
 * Google, specifically. Auth0 creates the identity on first use, so this is
 * both "sign up" and "sign in" — Google decides whether the account is new.
 * That is why there is no separate signup variant: two buttons doing the same
 * thing would only confuse.
 */
export async function loginWithGoogle() {
  return loginWithAuth0({ connection: GOOGLE_CONNECTION });
}

/** Ends the Auth0 session as well as the local one. */
export async function logoutFromAuth0() {
  const client = await getAuth0Client();
  await client.logout({ logoutParams: { returnTo: auth0RedirectUri() } });
}
