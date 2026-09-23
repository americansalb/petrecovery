/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AccountDialog, { DIALOG_EXIT_MS } from '@/app/geo/components/AccountDialog';

jest.mock('@/app/geo/components/SignInCard', () => () => <input aria-label="Email" />);

const fs = require('fs');
const path = require('path');

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function () { this.setAttribute('open', ''); });
  HTMLDialogElement.prototype.close = jest.fn(function () { this.removeAttribute('open'); });
});
afterEach(() => {
  jest.useRealTimers();
  delete window.matchMedia;
});

const dialogNode = () => screen.getByRole('dialog', { name: 'Sign in to play together', hidden: true });

test('an account dialog opened from the noninteractive HUD restores pointer events and can close', () => {
  jest.useFakeTimers();
  const onClose = jest.fn();
  const view = render(<div style={{ pointerEvents: 'none' }}><AccountDialog onClose={onClose} /></div>);
  expect(dialogNode()).toHaveClass('pointer-events-auto');
  fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
  act(() => { jest.advanceTimersByTime(DIALOG_EXIT_MS); });
  expect(onClose).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  expect(document.body.style.overflow).not.toBe('hidden');
});

/*
 * The sheet leaves the way it arrived. It used to vanish in the frame
 * after Close, and the page behind it was simply back.
 */
describe('closing the sheet', () => {
  test('it plays its way out before the page takes it away', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    render(<AccountDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    expect(dialogNode()).toHaveClass('pe-dialog-leaving');
    expect(onClose).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(DIALOG_EXIT_MS); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Escape leaves the same way, and a second press does not close it twice', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    render(<AccountDialog onClose={onClose} />);
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialogNode(), cancel);
    // The browser would close it at once; the sheet has to play first.
    expect(cancel.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    act(() => { jest.advanceTimersByTime(DIALOG_EXIT_MS * 2); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('somebody who asked for less motion gets it closed at once', () => {
    window.matchMedia = jest.fn(() => ({ matches: true }));
    const onClose = jest.fn();
    render(<AccountDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialogNode()).not.toHaveClass('pe-dialog-leaving');
  });

  test('a page that removes it early does not hear a late close', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const view = render(<AccountDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    view.unmount();
    act(() => { jest.advanceTimersByTime(DIALOG_EXIT_MS); });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('the wait is as long as the animation', () => {
    // If the stylesheet's exit grows and this does not, the sheet is
    // cut off mid-fade; if this grows alone, it sits there invisible.
    const css = fs.readFileSync(path.resolve(__dirname, '../../app/geo/motion.css'), 'utf8');
    const rule = css.match(/\.pe-account-dialog\.pe-dialog-leaving \{\s*animation: pe-dialog-out (\d+)ms/);
    expect(rule).toBeTruthy();
    expect(Number(rule[1])).toBe(DIALOG_EXIT_MS);
  });
});
