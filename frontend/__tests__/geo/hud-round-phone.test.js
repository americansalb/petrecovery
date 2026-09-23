/** @jest-environment jsdom */
/**
 * A phone showed no round number during a Street round: the top-centre
 * "Round 1 of 5" is hidden below the sm breakpoint because the top row
 * has no room for it, so a player on a phone could not tell how far
 * into a game they were until the reveal. The pill on the left carries
 * a short "1/5" there instead, and only there.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import GameHud from '@/app/geo/components/GameHud';

jest.mock('next/link', () => function Link({ children, href, ...rest }) { return <a href={href} {...rest}>{children}</a>; });
jest.mock('@/app/geo/components/SaveGameButton', () => () => null);

const base = { score: 0, streak: 0, secondsLeft: NaN, showMapControls: true, onReturn() {}, onToggleMobileMap() {} };

test('a phone sees which round it is on, beside what it is playing', () => {
  const { container } = render(<GameHud {...base} config={{ mode: 'balanced', time: 0 }} roundNumber={2} roundsTotal={5} />);
  const short = container.querySelector('[data-geo-round-short]');
  expect(short).toHaveTextContent('· 2/5');
  // Phones only: the desktop has the full "Round 2 of 5" in the middle.
  expect(short).toHaveClass('sm:hidden');
  expect(container).toHaveTextContent('Round 2 of 5');
});

test('a streak has no rounds to count', () => {
  const { container } = render(<GameHud {...base} config={{ mode: 'streak', time: 0 }} roundNumber={3} roundsTotal={0} streak={2} />);
  expect(container.querySelector('[data-geo-round-short]')).toBeNull();
});
