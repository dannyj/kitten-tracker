// Separate module so the proxy (edge bundle) can import the cookie name
// without pulling in the Node-only session code.
export const SESSION_COOKIE_NAME = "kitten_session";
