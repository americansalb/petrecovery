/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { JoinPanel } from '@/app/geo/components/rooms/RoomPanels';
const state = { room: { code: 'ABC123', name: 'Test room', status: 'lobby', config: { game: 'script', variant: 'duel' } }, players: [] };
test('an asynchronously loaded account name replaces a stale browser default', () => {
  const onJoin = jest.fn();
  const { rerender } = render(<JoinPanel state={state} defaultName="Previous account" onJoin={onJoin} />);
  rerender(<JoinPanel state={state} defaultName="Current account" onJoin={onJoin} />);
  expect(screen.getByText(/You will play as/)).toHaveTextContent('You will play as Current account.');
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(onJoin).toHaveBeenCalledWith();
});
