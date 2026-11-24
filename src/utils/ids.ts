import * as Crypto from 'expo-crypto';

/**
 * Random (version 4) UUID.
 *
 * Used for participant and measurement IDs, which have to stay unique when
 * the data of many phones is merged into one table.
 */
export function createUuid(): string {
  try {
    const id = Crypto.randomUUID();
    if (typeof id === 'string' && id.length === 36) {
      return id;
    }
  } catch {
    // Fall through to the manual construction below.
  }

  const bytes = new Uint8Array(16);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => void } }).crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

/**
 * Short code a participant can read out or write down, e.g. "P-3FA91C".
 * Derived from the participant UUID, so it never has to be stored separately.
 */
export function toParticipantCode(participantId: string): string {
  return `P-${participantId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}
