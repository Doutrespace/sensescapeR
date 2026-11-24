import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { useLanguageStore } from '../../i18n';
import OpenStreetMapView, { OpenStreetMapMarker } from './OpenStreetMapView';

/**
 * The map is a web page inside a WebView. Here the WebView is replaced by that
 * very page running in jsdom (with the bundled Leaflet), wired to the component
 * the way the WebView bridge does it: injected scripts go in, messages come out.
 */

type MapProps = React.ComponentProps<typeof OpenStreetMapView>;

const mockBridge: { window: any | null; scripts: string[]; injecting: number } = {
  window: null,
  scripts: [],
  injecting: 0,
};

jest.mock('react-native-webview', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const WebView = ReactLocal.forwardRef((props: any, ref: any) => {
    ReactLocal.useImperativeHandle(ref, () => ({
      injectJavaScript: (script: string) => {
        mockBridge.scripts.push(script);
        mockBridge.injecting += 1;
        try {
          mockBridge.window?.eval(script);
        } finally {
          mockBridge.injecting -= 1;
        }
      },
    }));
    return ReactLocal.createElement(View, {
      testID: 'webview',
      source: props.source,
      onMessage: props.onMessage,
    });
  });
  return { WebView };
});

const { JSDOM, VirtualConsole } = require('jsdom') as {
  JSDOM: new (html: string, options: object) => { window: any };
  VirtualConsole: new () => { on: (event: string, listener: (error: Error) => void) => void };
};

const COLOGNE: OpenStreetMapMarker = { id: 'cologne', latitude: 50.9413, longitude: 6.9583, title: 'Cathedral' };
const DEUTZ: OpenStreetMapMarker = { id: 'deutz', latitude: 50.9382, longitude: 6.9749, title: 'Station' };
const EHRENFELD: OpenStreetMapMarker = { id: 'ehrenfeld', latitude: 50.9513, longitude: 6.9166, title: 'Park' };
const BERLIN: OpenStreetMapMarker = { id: 'berlin', latitude: 52.52, longitude: 13.405, title: 'Berlin' };
// Straight north of COLOGNE: together they need the height of the map, not its width.
const NORTH: OpenStreetMapMarker = { id: 'north', latitude: 51.4, longitude: 6.9583, title: 'North' };
const USER_POSITION = { latitude: 50.9, longitude: 6.9 };

// The room the component keeps around the markers: 40 px, and 80 px on the side of the buttons.
const PADDING = 40;
const PADDING_RIGHT = 80;
const MAX_FIT_ZOOM = 16;

// A map like the Explore one: a tab bar (70) with a legend (44) above it, and a header card (140).
const WITH_OVERLAYS = { bottomInset: 70, fitInsets: { top: 140, bottom: 44 } };
const OVERLAYS = { top: 140, bottom: 70 + 44 };

const openPages: Array<{ errors: Error[]; close: () => void }> = [];

async function openMap(props: Partial<MapProps> = {}, size = { width: 390, height: 700 }) {
  let currentProps: MapProps = { markers: [], ...props };
  const view = render(<OpenStreetMapView {...currentProps} />);
  const webview = () => view.getByTestId('webview');
  const messages: Array<{ type: string }> = [];
  const errors: Error[] = [];
  let reportReady: () => void = () => undefined;
  let giveUp: ReturnType<typeof setTimeout> | undefined;
  const ready = new Promise<void>((resolve, reject) => {
    reportReady = resolve;
    giveUp = setTimeout(
      () => reject(new Error(`The map page did not start. Script errors: ${errors.join('; ') || 'none'}`)),
      3000
    );
  });

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));

  const { window } = new JSDOM(webview().props.source.html, {
    runScripts: 'dangerously',
    virtualConsole,
    beforeParse(pageWindow: any) {
      // jsdom has no layout: the map gets the size of a phone screen.
      Object.defineProperty(pageWindow.HTMLElement.prototype, 'clientWidth', { get: () => size.width });
      Object.defineProperty(pageWindow.HTMLElement.prototype, 'clientHeight', { get: () => size.height });
      // ... and no canvas, which Leaflet draws the position circle on.
      pageWindow.HTMLCanvasElement.prototype.getContext = () =>
        new Proxy({} as Record<PropertyKey, unknown>, {
          get: (target, key) => (key in target ? target[key] : () => undefined),
          set: (target, key, value) => {
            target[key] = value;
            return true;
          },
        });
      // Leaflet asks `'addEventListener' in window`; Node's vm global says no for inherited members.
      pageWindow.addEventListener = pageWindow.addEventListener.bind(pageWindow);
      pageWindow.removeEventListener = pageWindow.removeEventListener.bind(pageWindow);
      pageWindow.ReactNativeWebView = {
        postMessage: (data: string) => {
          const message = JSON.parse(data);
          messages.push(message);
          const deliver = () => webview().props.onMessage({ nativeEvent: { data } });
          try {
            if (mockBridge.injecting > 0) {
              // Answer to a script that React is injecting right now, inside its own act().
              deliver();
            } else {
              act(deliver);
            }
          } finally {
            if (message.type === 'ready') {
              reportReady();
            }
          }
        },
      };
    },
  });
  mockBridge.window = window;
  openPages.push({
    errors,
    close: () => {
      view.unmount();
      window.close();
    },
  });
  await ready.finally(() => clearTimeout(giveUp));

  const map = window.__soundscapeMap;

  return {
    view,
    window,
    map,
    messages,
    size,
    update(nextProps: Partial<MapProps>) {
      currentProps = { ...currentProps, ...nextProps };
      view.rerender(<OpenStreetMapView {...currentProps} />);
    },
    press(label: string) {
      fireEvent.press(view.getByLabelText(label));
    },
    /** Where a marker is drawn, in pixels from the top left corner of the map. */
    position(marker: OpenStreetMapMarker) {
      const point = map.latLngToContainerPoint([marker.latitude, marker.longitude]);
      return { x: point.x as number, y: point.y as number };
    },
    viewState() {
      const center = map.getCenter();
      return { zoom: map.getZoom() as number, latitude: center.lat as number, longitude: center.lng as number };
    },
    drawnMarkers(): any[] {
      return window.__soundscapeMarkerLayer;
    },
  };
}

type OpenedMap = Awaited<ReturnType<typeof openMap>>;

/**
 * The view shows exactly the markers: they sit in the middle of the part of the
 * map that nothing is drawn over, each one inside it, and one zoom level closer
 * they would no longer all fit (unless the closest zoom of a fit is reached).
 */
function expectFittedTo(
  page: OpenedMap,
  markers: OpenStreetMapMarker[],
  insets: { top?: number; bottom?: number } = {}
) {
  const left = PADDING;
  const right = page.size.width - PADDING_RIGHT;
  const top = PADDING + (insets.top ?? 0);
  const bottom = page.size.height - PADDING - (insets.bottom ?? 0);
  const points = markers.map((marker) => page.position(marker));

  points.forEach(({ x, y }) => {
    expect(x).toBeGreaterThanOrEqual(left - 1);
    expect(x).toBeLessThanOrEqual(right + 1);
    expect(y).toBeGreaterThanOrEqual(top - 1);
    expect(y).toBeLessThanOrEqual(bottom + 1);
  });

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - (left + right) / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - (top + bottom) / 2)).toBeLessThanOrEqual(2);

  const fitsOneLevelCloser =
    (Math.max(...xs) - Math.min(...xs)) * 2 <= right - left &&
    (Math.max(...ys) - Math.min(...ys)) * 2 <= bottom - top;
  expect(page.map.getZoom() === MAX_FIT_ZOOM || !fitsOneLevelCloser).toBe(true);
}

beforeAll(async () => {
  await useLanguageStore.getState().setLanguage('en');
});

beforeEach(() => {
  mockBridge.window = null;
  mockBridge.scripts = [];
  mockBridge.injecting = 0;
});

afterEach(() => {
  const pages = openPages.splice(0);
  pages.forEach((page) => page.close());
  // No script error inside the page.
  expect(pages.flatMap((page) => page.errors)).toEqual([]);
});

describe('OpenStreetMapView initial view', () => {
  it('opens fitted to the recordings', async () => {
    const markers = [COLOGNE, DEUTZ, EHRENFELD];
    const page = await openMap({
      markers,
      fitToMarkers: true,
      initialCenter: { ...USER_POSITION, zoom: 13 },
      bottomInset: 70,
    });

    expectFittedTo(page, markers, { bottom: 70 });
    expect(page.drawnMarkers()).toHaveLength(3);
    // The first view is not reported as a move.
    expect(page.messages.map((message) => message.type)).toEqual(['ready']);
  });

  it('keeps the recordings clear of a header and a legend drawn over the map', async () => {
    const markers = [COLOGNE, DEUTZ, NORTH];
    const page = await openMap({ markers, fitToMarkers: true, ...WITH_OVERLAYS });

    expectFittedTo(page, markers, OVERLAYS);
  });

  it('fits once when the first recordings arrive after the map is ready', async () => {
    const page = await openMap({ fitToMarkers: true, initialCenter: { ...USER_POSITION, zoom: 13 } });
    expect(page.viewState().zoom).toBe(13);
    expect(page.viewState().latitude).toBeCloseTo(USER_POSITION.latitude, 3);
    expect(page.viewState().longitude).toBeCloseTo(USER_POSITION.longitude, 3);

    page.update({ markers: [COLOGNE, DEUTZ] });
    expectFittedTo(page, [COLOGNE, DEUTZ]);
    expect(page.messages.map((message) => message.type)).toContain('boundsChange');

    // Later changes to the markers leave the view alone.
    const fitted = page.viewState();
    page.update({ markers: [COLOGNE, DEUTZ, BERLIN] });
    expect(page.viewState()).toEqual(fitted);
    expect(page.drawnMarkers()).toHaveLength(3);
  });

  it('does not fit after the user has zoomed with the buttons', async () => {
    const page = await openMap({ fitToMarkers: true, initialCenter: { ...USER_POSITION, zoom: 13 } });

    page.press('Zoom in');
    expect(page.map.getZoom()).toBe(14);
    const chosen = page.viewState();

    page.update({ markers: [COLOGNE, BERLIN] });
    expect(page.viewState()).toEqual(chosen);
    expect(page.drawnMarkers()).toHaveLength(2);
  });

  it('does not fit after the user has dragged the map', async () => {
    const page = await openMap({ fitToMarkers: true, initialCenter: { ...USER_POSITION, zoom: 13 } });

    // What a drag does: a move that the page did not start itself.
    page.map.panBy([120, 60], { animate: false });
    const chosen = page.viewState();
    expect(chosen.latitude).not.toBeCloseTo(USER_POSITION.latitude, 3);

    page.update({ markers: [COLOGNE, BERLIN] });
    expect(page.viewState()).toEqual(chosen);
  });

  it('shows the given position while there are no recordings, also when it arrives late', async () => {
    const page = await openMap({ fitToMarkers: true });
    expect(page.viewState().zoom).toBe(2);

    page.update({ initialCenter: { ...USER_POSITION, zoom: 13 }, userLocation: USER_POSITION });
    expect(page.viewState().zoom).toBe(13);
    expect(page.viewState().latitude).toBeCloseTo(USER_POSITION.latitude, 3);
    expect(page.viewState().longitude).toBeCloseTo(USER_POSITION.longitude, 3);

    // The first recording still gets its fit afterwards.
    page.update({ markers: [BERLIN] });
    expectFittedTo(page, [BERLIN]);
    expect(page.map.getZoom()).toBe(16);
  });

  it('stays on the recordings when the position arrives after the fit', async () => {
    const markers = [COLOGNE, DEUTZ];
    const page = await openMap({ markers, fitToMarkers: true });
    expectFittedTo(page, markers);
    const fitted = page.viewState();

    page.update({ initialCenter: { latitude: 48.137, longitude: 11.575, zoom: 13 }, userLocation: USER_POSITION });
    expect(page.viewState()).toEqual(fitted);
  });

  it('waits for the map to have a size before fitting', async () => {
    const size = { width: 0, height: 0 };
    const markers = [COLOGNE, DEUTZ];
    const page = await openMap({ markers, fitToMarkers: true }, size);
    expect(page.viewState().zoom).toBe(2);

    // The tab becomes visible: the browser resizes the page and Leaflet picks that up.
    size.width = 390;
    size.height = 700;
    page.map.invalidateSize();

    expectFittedTo(page, markers);
  });

  it('only centres on the given position when fitting is not asked for', async () => {
    const page = await openMap({ markers: [BERLIN], initialCenter: { ...USER_POSITION, zoom: 13 } });

    expect(page.viewState().zoom).toBe(13);
    expect(page.viewState().latitude).toBeCloseTo(USER_POSITION.latitude, 3);
    expect(page.viewState().longitude).toBeCloseTo(USER_POSITION.longitude, 3);
  });
});

describe('OpenStreetMapView zoom to recordings button', () => {
  it('is disabled while no marker has coordinates', async () => {
    const page = await openMap({
      markers: [{ id: 'nowhere', latitude: Number.NaN, longitude: Number.NaN }],
    });
    const scriptsBefore = mockBridge.scripts.length;

    expect(page.view.getByLabelText('Zoom to recordings')).toBeDisabled();
    page.press('Zoom to recordings');
    expect(mockBridge.scripts).toHaveLength(scriptsBefore);
    // A marker without coordinates is not drawn either.
    expect(page.drawnMarkers()).toHaveLength(0);

    page.update({ markers: [COLOGNE] });
    expect(page.view.getByLabelText('Zoom to recordings')).not.toBeDisabled();
  });

  it('brings all recordings back into view', async () => {
    const markers = [COLOGNE, EHRENFELD, NORTH];
    const page = await openMap({ markers, fitToMarkers: true, ...WITH_OVERLAYS });

    page.map.setView([40.4168, -3.7038], 6, { animate: false });
    page.press('Zoom to recordings');

    expectFittedTo(page, markers, OVERLAYS);
  });

  it('slides back when the recordings are only a little out of view', async () => {
    const markers = [COLOGNE, DEUTZ, EHRENFELD];
    const page = await openMap({ markers, fitToMarkers: true, bottomInset: 70 });
    const fitted = page.viewState();

    page.map.panBy([150, 0], { animate: false });
    // Leaflet animates a short way back, so the view arrives a moment later.
    const arrived = new Promise((resolve) => page.map.once('moveend', resolve));
    page.press('Zoom to recordings');
    await arrived;

    expect(page.viewState().zoom).toBe(fitted.zoom);
    expectFittedTo(page, markers, { bottom: 70 });
  });

  it('centres a single recording at zoom 16', async () => {
    const page = await openMap({ markers: [COLOGNE], initialCenter: { ...USER_POSITION, zoom: 13 }, ...WITH_OVERLAYS });
    expect(page.map.getZoom()).toBe(13);

    page.press('Zoom to recordings');

    expect(page.map.getZoom()).toBe(16);
    // In the middle of what the header, the legend, the tab bar and the buttons leave free.
    expectFittedTo(page, [COLOGNE], OVERLAYS);
  });

  it('treats several recordings at one place like a single one', async () => {
    const page = await openMap({
      markers: [COLOGNE, { ...COLOGNE, id: 'cologne-again' }],
      fitToMarkers: true,
    });
    expect(page.map.getZoom()).toBe(16);

    page.map.setView([0, 0], 3, { animate: false });
    page.press('Zoom to recordings');

    expect(page.map.getZoom()).toBe(16);
    expectFittedTo(page, [COLOGNE]);
  });

  it('still shows everything in a map too small to keep the overlays clear', async () => {
    const markers = [COLOGNE, BERLIN];
    const page = await openMap({ markers, ...WITH_OVERLAYS }, { width: 300, height: 260 });
    expect(page.map.getZoom()).toBe(2);

    page.press('Zoom to recordings');

    expect(page.map.getZoom()).toBeGreaterThan(4);
    markers.forEach((marker) => {
      const { x, y } = page.position(marker);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(300);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(260);
    });
  });
});

describe('OpenStreetMapView marker texts', () => {
  it('shows titles and subtitles as text, not as HTML', async () => {
    const hostile: OpenStreetMapMarker = {
      id: 'hostile',
      latitude: 50.94,
      longitude: 6.95,
      title: '<img src=x onerror="window.__injected = true">',
      subtitle: '</script><script>window.__injected = true</script> & "more"',
    };
    const page = await openMap({ markers: [hostile], fitToMarkers: true, selectedMarkerId: 'hostile' });

    const popup = page.drawnMarkers()[0].getPopup();
    const content: string = popup.getContent();
    expect(content).toContain('&lt;img src=x onerror=&quot;window.__injected = true&quot;&gt;');
    expect(content).toContain('&lt;/script&gt;&lt;script&gt;window.__injected = true&lt;/script&gt; &amp; &quot;more&quot;');

    // The open popup holds the texts and no element made from them.
    const element = popup.getElement();
    expect(element.querySelector('img, script')).toBeNull();
    expect(element.querySelector('strong').textContent).toBe(hostile.title);
    expect(page.window.__injected).toBeUndefined();

    // The same when the marker arrives through the bridge instead of with the page.
    page.update({ markers: [hostile, { ...hostile, id: 'hostile-2', latitude: 50.95 }] });
    expect(page.drawnMarkers()).toHaveLength(2);
    expect(page.drawnMarkers()[1].getPopup().getContent()).toContain('&lt;img');
    expect(page.window.__injected).toBeUndefined();
  });

  it('sends marker texts as plain ASCII and shows them unchanged', async () => {
    // Umlauts, an emoji and the two line separators, which are valid inside JSON
    // but end a line in the script source of older WebViews.
    const title = [0x47, 0x72, 0xfc, 0x6e, 0x2028, 0x2029, 0x1f3b5].map((code) => String.fromCodePoint(code)).join('');
    const marker: OpenStreetMapMarker = { ...COLOGNE, title };
    const page = await openMap({ markers: [marker], selectedMarkerId: marker.id });
    page.update({ markers: [marker, DEUTZ] });

    const sources = [page.view.getByTestId('webview').props.source.html as string, ...mockBridge.scripts];
    expect(mockBridge.scripts.length).toBeGreaterThan(1);
    sources.forEach((source) => {
      expect(Array.from(source).every((character) => character.charCodeAt(0) < 128)).toBe(true);
    });
    expect(page.drawnMarkers()[0].getPopup().getElement().querySelector('strong').textContent).toBe(title);
  });
});

describe('OpenStreetMapView bridge', () => {
  it('leaves window.postMessage alone, the channel the browser build sends commands through', async () => {
    const page = await openMap({ markers: [COLOGNE] });
    const html: string = page.view.getByTestId('webview').props.source.html;

    // A top-level `function postMessage` in the page would replace
    // window.postMessage inside the map frame; the zoom, locate and fit
    // buttons then silently stop working in the browser.
    expect(html).not.toMatch(/function\s+postMessage\s*\(/);
    expect(html).not.toMatch(/window\.postMessage\s*=/);
  });

  it('sends the configuration again when the page has reloaded', async () => {
    const page = await openMap({ markers: [COLOGNE] });
    const configScripts = () => mockBridge.scripts.filter((script) => script.includes('__updateMapConfig'));
    expect(configScripts()).toHaveLength(1);

    act(() => {
      page.view.getByTestId('webview').props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready' }) } });
    });

    expect(configScripts()).toHaveLength(2);
    expect(configScripts()[1]).toContain('"id":"cologne"');
  });

  it('reports moves and marker presses', async () => {
    const onBoundsChange = jest.fn();
    const onMarkerPress = jest.fn();
    const page = await openMap({ markers: [COLOGNE], fitToMarkers: true, onBoundsChange, onMarkerPress });
    expect(onBoundsChange).not.toHaveBeenCalled();

    page.press('Zoom out');
    expect(onBoundsChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: 15 }));

    page.drawnMarkers()[0].fire('click');
    expect(onMarkerPress).toHaveBeenCalledWith('cologne');
  });
});
