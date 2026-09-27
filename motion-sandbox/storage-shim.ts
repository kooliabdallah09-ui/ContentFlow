// Imported first by main.tsx, before Remotion. In an opaque-origin iframe
// even `typeof localStorage` throws a SecurityError, and Remotion reads it
// (player volume, overrides, timing caches). An in-memory Storage keeps it
// working without granting the frame real storage.

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: i => Array.from(data.keys())[i] ?? null,
    removeItem: key => { data.delete(key) },
    setItem: (key, value) => { data.set(key, String(value)) },
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  try {
    void window[name]
  } catch {
    Object.defineProperty(window, name, { value: memoryStorage(), configurable: true })
  }
}

export {}
