/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { JoinPanel } from '@/app/geo/components/rooms/RoomPanels';
const state = { room: { code: 'ABC123', name: 'Test room', status: 'lobby', config: { game: 'script', variant: 'duel' } }, players: [] };
test('an asynchronously loaded account name replaces a stale browser default', () => {
  const onJoin = jest.fn();
  const { rerender } = render(<JoinPanel state={state} defaultName="Previous account" onJoin={onJoin} />);
  rerender(<JoinPanel state={state} defaultName="Current account" onJoin={onJoin} />);
  expect(screen.getByRole('textbox', { name: 'Your name' })).toHaveValue('Current account');
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(onJoin).toHaveBeenCalledWith('Current account');
});
test('loading the default does not overwrite a name the player is editing', () => {
  const { rerender } = render(<JoinPanel state={state} defaultName="Old name" onJoin={jest.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), { target: { value: 'My choice' } });
  rerender(<JoinPanel state={state} defaultName="Account name" onJoin={jest.fn()} />);
  expect(screen.getByRole('textbox', { name: 'Your name' })).toHaveValue('My choice');
});
