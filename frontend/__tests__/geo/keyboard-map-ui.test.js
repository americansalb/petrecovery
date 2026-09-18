/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import KeyboardMap from '@/app/geo/components/KeyboardMap';
import { appleKeyboard, ignoreGameShortcut } from '@/app/geo/lib/mapKeyboard';

test('keyboard map pans, zooms and places without submitting the game', () => {
  const pan = jest.fn(), zoom = jest.fn(), place = jest.fn(() => ({ lat: 20, lng: 35 }));
  const gameKey = jest.fn();
  const view = render(<div onKeyDown={gameKey}><KeyboardMap interactive pan={pan} zoom={zoom} place={place}><button>Zoom control</button></KeyboardMap></div>);
  const map = screen.getByRole('group', { name: 'Guess map' });
  fireEvent.focus(map);
  expect(screen.getByText(/Arrow keys move ·/)).toBeVisible();
  fireEvent.keyDown(map, { key: 'ArrowLeft' });
  fireEvent.keyDown(map, { key: '+' });
  fireEvent.keyDown(map, { key: 'Enter' });
  expect(pan).toHaveBeenCalledWith(-1, 0);
  expect(zoom).toHaveBeenCalledWith(1);
  expect(place).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('20.00 latitude, 35.00 longitude');
  expect(gameKey).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
  expect(place).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(map, { key: 'Tab' });
  expect(gameKey).toHaveBeenCalledTimes(2);
  view.rerender(<KeyboardMap interactive={false} place={place}>Result</KeyboardMap>);
  fireEvent.keyDown(screen.getByRole('group', { name: 'Answer map' }), { key: 'Enter' });
  expect(place).toHaveBeenCalledTimes(1);
  view.rerender(<KeyboardMap interactive place={place}>Next round</KeyboardMap>);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

test('Apple keyboard adapter wraps longitude, bounds zoom and uses the visible centre', () => {
  const mapkit = {
    Coordinate: function (latitude, longitude) { Object.assign(this, { latitude, longitude }); },
    CoordinateSpan: function (latitudeDelta, longitudeDelta) { Object.assign(this, { latitudeDelta, longitudeDelta }); },
    CoordinateRegion: function (center, span) { Object.assign(this, { center, span }); },
  };
  const mapRef = { current: { region: { center: { latitude: 80, longitude: 179 }, span: { latitudeDelta: 60, longitudeDelta: 60 } } } };
  const onPin = jest.fn();
  const keys = appleKeyboard(mapRef, mapkit, onPin);
  keys.pan(1, -1);
  expect(mapRef.current.region.center).toEqual({ latitude: 85, longitude: -171 });
  keys.zoom(1);
  expect(mapRef.current.region.span).toEqual({ latitudeDelta: 30, longitudeDelta: 30 });
  expect(keys.place()).toEqual({ lat: 85, lng: -171 });
  expect(onPin).toHaveBeenCalledWith({ lat: 85, lng: -171 });
  for (let i = 0; i < 12; i++) keys.zoom(-1);
  expect(mapRef.current.region.span).toEqual({ latitudeDelta: 150, longitudeDelta: 360 });
  mapRef.current = null;
  expect(keys.place()).toBeNull();
  expect(() => keys.pan(1, 0)).not.toThrow();
});

test('global game shortcuts leave links, controls, dialogs and keyboard maps alone', () => {
  const view = render(<div><button><span>Button child</span></button><a href="/geo">Link</a><div data-keyboard-map><span>Map child</span></div><dialog open><p>Account form</p></dialog><p>Game background</p></div>);
  for (const label of ['Button child', 'Link', 'Map child', 'Account form']) {
    expect(ignoreGameShortcut({ target: screen.getByText(label) })).toBe(true);
  }
  expect(ignoreGameShortcut({ target: screen.getByText('Game background') })).toBe(false);
  expect(ignoreGameShortcut({ defaultPrevented: true })).toBe(true);
  view.unmount();
});
