import { DEVICE_RE } from '../../shared/survey';

// A random id for this browser, kept across logouts so a device can answer a survey only once. It is not a hardware
// fingerprint: clearing site data, private mode or another browser gives a new one (the name check still applies).
const DEVICE_KEY = 'cfid.device.v1';
let memory: string | null = null;

// getRandomValues also works on plain-http LAN testing (randomUUID needs a secure context, PLAN.md §22.6).
const fresh = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function deviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved && DEVICE_RE.test(saved)) return saved;
  } catch {
    // storage blocked
  }
  memory ??= fresh();
  try {
    localStorage.setItem(DEVICE_KEY, memory);
  } catch {
    // private mode: this tab keeps an in-memory id
  }
  return memory;
}
