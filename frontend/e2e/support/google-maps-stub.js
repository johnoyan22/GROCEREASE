export async function installGoogleMapsStub(page) {
  await page.addInitScript(() => {
    window.qaMapMarkers = [];
    class MapFixture {
      constructor(element) {
        this.element = element; this.events = {}; this.center = { lat: 10.3, lng: 123.9 };
        const label = document.createElement('p'); label.textContent = 'Google Maps API fixture — no live provider'; label.className = 'text-xs p-1'; element.append(label);
        const button = document.createElement('button'); button.textContent = 'Choose test map location'; button.className = 'rounded border p-1 text-xs';
        button.onclick = () => this.events.click?.({ latLng: { toJSON: () => ({ lat: 10.3, lng: 123.9 }) } }); element.append(button);
      }
      addListener(name, callback) { this.events[name] = callback; return { remove: () => delete this.events[name] }; }
      panTo(point) { this.center = point; }
      setZoom(zoom) { this.zoom = zoom; }
      getCenter() { return { toJSON: () => this.center }; }
    }
    class MarkerFixture {
      constructor(options) {
        this.events = {}; Object.assign(this, options); window.qaMapMarkers.push(this);
        this.button = document.createElement('button'); this.button.className = 'block rounded border px-2 py-1 text-xs'; this.button.textContent = options.gmpDraggable ? 'Drag chosen map pin' : 'Map marker ' + options.title;
        this.button.onclick = () => { if (options.gmpDraggable) { this.position = { lat: 10.301, lng: 123.901 }; this.events.dragend?.(); } else this.events.click?.(); };
        options.map.element.append(this.button);
      }
      set map(value) { this._map = value; if (!value) this.button?.remove(); }
      get map() { return this._map; }
      addListener(name, callback) { this.events[name] = callback; return { remove: () => delete this.events[name] }; }
    }
    window.google = { maps: { importLibrary: async name => name === 'maps' ? { Map: MapFixture } : { AdvancedMarkerElement: MarkerFixture, PinElement: class {} } } };
  });
}
