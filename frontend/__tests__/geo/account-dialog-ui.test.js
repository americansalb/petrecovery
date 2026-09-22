/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import AccountDialog from '@/app/geo/components/AccountDialog';

jest.mock('@/app/geo/components/SignInCard', () => () => <input aria-label="Email" />);

test('an account dialog opened from the noninteractive HUD restores pointer events and can close', () => {
  HTMLDialogElement.prototype.showModal = jest.fn(function () { this.setAttribute('open', ''); });
  HTMLDialogElement.prototype.close = jest.fn(function () { this.removeAttribute('open'); });
  const onClose = jest.fn();
  const view = render(<div style={{ pointerEvents: 'none' }}><AccountDialog onClose={onClose} /></div>);
  expect(screen.getByRole('dialog', { name: 'Sign in to play together', hidden: true })).toHaveClass('pointer-events-auto');
  fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  expect(document.body.style.overflow).not.toBe('hidden');
});
