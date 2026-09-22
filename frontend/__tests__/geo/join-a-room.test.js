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

test('a friend who types nothing still gets into the room', () => {
  const onJoin = show();
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(onJoin).toHaveBeenCalledWith(DEFAULT_PLAYER_NAME);
});

test('a name they do type is the name they join under', () => {
  const onJoin = show();
  fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: 'Ada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(onJoin).toHaveBeenCalledWith('Ada');
});

test('whitespace is not a name', () => {
  const onJoin = show();
  fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(onJoin).toHaveBeenCalledWith(DEFAULT_PLAYER_NAME);
});

test('a signed-in player arrives with their account name already in', () => {
  const onJoin = show({ defaultName: 'Kevin' });
  expect(screen.getByLabelText(/Your name/)).toHaveValue('Kevin');
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(onJoin).toHaveBeenCalledWith('Kevin');
});

test('the field says it is optional, so a dead button never has to explain itself', () => {
  show();
  expect(screen.getByLabelText('Your name (optional)')).toBeInTheDocument();
});
