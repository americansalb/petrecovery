/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LeafletScriptMap from '@/app/geo/components/script/LeafletScriptMap';

const mockBounds = { isValid: () => true };
const mockMap = {
  stop: jest.fn(), getSize: () => ({ x: 390, y: 210 }),
  fitBounds: jest.fn(), flyToBounds: jest.fn(),
  setView: jest.fn(function () { return this; }),
  on: jest.fn(), off: jest.fn(), remove: jest.fn(), removeLayer: jest.fn(),
  createPane: () => ({ style: {} }), getPane: () => ({ style: {} }),
  getZoom: () => 2, latLngToContainerPoint: () => ({ x: 0, y: 0 }),
  getCenter: () => ({ lat: 20, lng: 35 }), panBy: jest.fn(), setZoom: jest.fn(),
};
function mockLayer() {
  return { addTo() { return this; }, bindTooltip() { return this; } };
}
jest.mock('leaflet', () => ({
  map: () => mockMap, control: { zoom: mockLayer }, canvas: jest.fn(),
  geoJSON: mockLayer, marker: mockLayer, circle: mockLayer, polygon: mockLayer,
  polyline: mockLayer, divIcon: jest.fn(), featureGroup: () => ({ getBounds: () => mockBounds }),
}));
jest.mock('world-atlas/countries-110m.json', () => ({ objects: { countries: {} } }));
jest.mock('topojson-client', () => ({ feature: () => ({ features: [] }) }));
jest.mock('@/app/lib/geo/data/country-labels.json', () => ({ labels: [] }));

test('mounting directly into a saved reveal frames the answer without an interruptible flight', async () => {
  const view = render(<LeafletScriptMap mode="result" answer={{ name: 'Test', regions: [
    { lat: 30, lng: 35, radiusKm: 100, name: 'Test region' },
  ] }} guess={{ lat: 32, lng: 33 }} />);
  await waitFor(() => expect(mockMap.fitBounds).toHaveBeenCalledWith(mockBounds,
    expect.objectContaining({ animate: false, maxZoom: 7 })));
  expect(mockMap.flyToBounds).not.toHaveBeenCalled();
  const options = mockMap.fitBounds.mock.calls.find(([bounds]) => bounds === mockBounds)[1];
  expect(options.paddingTopLeft).toEqual(options.paddingBottomRight);
  expect(options.paddingTopLeft[1] * 2).toBeLessThan(210);
  view.unmount();
  expect(mockMap.remove).toHaveBeenCalled();
});

test('Leaflet keyboard target places the visible centre and pans without animation', async () => {
  const onPin = jest.fn();
  render(<LeafletScriptMap onPin={onPin} />);
  await waitFor(() => expect(mockMap.on).toHaveBeenCalled());
  const map = screen.getByRole('group', { name: 'Guess map' });
  fireEvent.keyDown(map, { key: 'ArrowRight' });
  fireEvent.keyDown(map, { key: 'Enter' });
  expect(mockMap.panBy).toHaveBeenCalledWith([80, 0], { animate: false });
  expect(onPin).toHaveBeenCalledWith({ lat: 20, lng: 35 });
});
