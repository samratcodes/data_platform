// `__Host-` cookies require HTTPS, so development uses a plain name.
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-filemarket_session" : "filemarket_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
