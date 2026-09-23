/** @jest-environment jsdom */

/**
 * Following a friend's invite link is one hurdle, not two.
 *
 * The third and worst instance of the same defect. #299 took the name
 * requirement off signing in; #300 took it off opening a room. This is
 * the panel a friend lands on when somebody sends them a room link -
 * the exact moment the game is spreading - and the Join button was
 * dead until they invented a player name. It then asked them to sign
 * in anyway, so there were two gates where the code needs one, and the
 * first explained nothing, because a disabled button cannot.
 *
 * Founder, 2026-09-19: "we dont let them... WE don't make it easy."
 *
 * An invited player is a Player until they choose otherwise, on the
 * profile page where the name is theirs to keep. Anybody who does type
 * one keeps it, and a signed-in player arrives with theirs already
 * filled in from the account (defaultName).
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { JoinPanel } from '@/app/geo/components/rooms/RoomPanels';
import { DEFAULT_PLAYER_NAME } from '@/app/lib/geo/rooms';

const room = {
  code: 'ABC123',
  name: "Kevin's room",
  status: 'lobby',
  config: { mode: 'balanced', region: '', rounds: 5, time: 60 },
  settings: { variant: 'duel', game: 'street', rounds: 5, time: 60 },
  variant: 'duel',
};
const state = { room, players: [{ id: 'p1', name: 'Kevin' }] };

const show = (props = {}) => {
  const onJoin = jest.fn();
  render(<JoinPanel state={state} onJoin={onJoin} busy={false} {...props} />);
  return onJoin;
};

test('Join is live the moment the invited player arrives', () => {
  show();
  expect(screen.getByRole('button', { name: 'Join' })).toBeEnabled();
});

test('joining asks for nothing: no name box, one button', () => {
  const onJoin = show();
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(onJoin).toHaveBeenCalledTimes(1);
  expect(onJoin).toHaveBeenCalledWith();
});

/**
 * The name box renamed the account. A profile takes whatever name it
 * is sent, and the panel sent the box's contents (or "Player" when it
 * was empty) before joining, so clearing it and pressing Join renamed a
 * signed-in player's account "Player". The name is the account's now,
 * and the panel only says what it is.
 */
test('a signed-in player is told the name they will play under', () => {
  show({ defaultName: 'Kevin' });
  expect(screen.getByText(/You will play as/)).toHaveTextContent('You will play as Kevin.');
});

test('the placeholder is not announced as anybody\'s name', () => {
  show({ defaultName: DEFAULT_PLAYER_NAME });
  expect(screen.queryByText(/You will play as/)).toBeNull();
});

test('the room joins under the account name and never renames the profile', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../app/geo/components/RoomClient.js'), 'utf8');
  const onJoin = src.slice(src.indexOf('onJoin={() =>'), src.indexOf('busy={busy}', src.indexOf('onJoin={() =>')));
  expect(onJoin).toContain("ensureProfile('')");
  expect(onJoin).not.toMatch(/ensureProfile\(name\)/);
});
