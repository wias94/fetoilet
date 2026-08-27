export function readBrowserFix(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 2500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 180_000, timeout: 2200 },
    );
  });
}
