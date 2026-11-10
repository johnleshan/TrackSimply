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

/* The callback must match an Allowed Callback URL in the Auth0 application and
   the origin must match an Allowed Web Origin, or the login fails on return.
   Deriving it from the current origin means a local session on
   http://localhost:5173 and the deployed site each send their own — which is
   why localhost has to be registered in Auth0 as well. */
export const auth0RedirectUri = () =>
  (typeof window !== 'undefined' ? window.location.origin : '');

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

/** Sends the browser to Auth0's Universal Login page. */
export async function loginWithAuth0({ signup = false } = {}) {
  const client = await getAuth0Client();
  await client.loginWithRedirect({
    authorizationParams: {
      redirect_uri: auth0RedirectUri(),
      ...(signup ? { screen_hint: 'signup' } : {}),
    },
  });
}

/** Ends the Auth0 session as well as the local one. */
export async function logoutFromAuth0() {
  const client = await getAuth0Client();
  await client.logout({ logoutParams: { returnTo: auth0RedirectUri() } });
}
