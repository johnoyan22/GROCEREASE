let pending;
export function loadGoogleMaps(key) {
  if (!key) return Promise.reject(new Error('The interactive map is not available yet.'));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { window.clearTimeout(timer); script.remove(); delete window.__grocerEaseMapsReady; pending = undefined; reject(new Error('Google Maps could not load. You can still use your location to find registered stores.')); };
    const timer = window.setTimeout(fail, 20000);
    window.__grocerEaseMapsReady = () => { window.clearTimeout(timer); delete window.__grocerEaseMapsReady; resolve(window.google.maps); };
    script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({ key, v: 'quarterly', loading: 'async', libraries: 'marker', callback: '__grocerEaseMapsReady' });
    script.async = true; script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}
