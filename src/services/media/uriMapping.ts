/**
 * Maps media URIs between what the app uses at runtime and what the local
 * database stores. On native both are the same file path. The web build
 * overrides this (uriMapping.web.ts) because `blob:` URLs do not survive a
 * page reload.
 */
export function toStoredUri(uri: string): string {
  return uri;
}

export function toRuntimeUri(storedUri: string): string {
  return storedUri;
}
