/** @jest-environment jsdom */
/**
 * The loading screen every route falls back to showed the pet site's
 * mascot on a light page for up to two seconds before a game page, and
 * made every game page preload that 1.1 MB image (React preloads the
 * images in the first HTML it sends). On the game's routes it is the
 * game's dark canvas, with no image at all.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Loading from '@/app/loading';

let pathname = '/';
jest.mock('next/navigation', () => ({ usePathname: () => pathname }));

test.each(['/geo', '/geo/rooms', '/geo/room/ABC123', '/geo/does-not-exist'])('%s loads on the game canvas, with no pet imagery', (path) => {
  pathname = path;
  const { container } = render(<Loading />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).not.toMatch(/Loading\.\.\./);
  expect(container.firstChild).toHaveStyle({ background: 'rgb(11 15 20)' });
});

test('the pet site keeps its own loading screen', () => {
  pathname = '/lost-and-found';
  const { container } = render(<Loading />);
  expect(container.querySelector('img')).not.toBeNull();
  // A path that merely starts with the letters is not the game.
  pathname = '/geography-club';
  expect(render(<Loading />).container.querySelector('img')).not.toBeNull();
});
