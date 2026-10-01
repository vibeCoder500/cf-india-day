let wanted = false;
let lock: WakeLockSentinel | null = null;

async function acquire() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
  } catch {
    // unsupported, denied, or not HTTPS: the game still works, the screen may just dim
  }
}

// Call from a user gesture (Enter / Join button).
export function keepScreenOn() {
  if (wanted) return;
  wanted = true;
  void acquire();
  document.addEventListener('visibilitychange', () => {
    if (!lock || lock.released) void acquire();
  });
}
