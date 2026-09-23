/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Tabs from '@/app/geo/components/ui/Tabs';

function Example() {
  const [value, setValue] = useState('record');
  return <>
    <Tabs items={['record', 'shop', 'settings'].map((id) => ({ id, label: id }))}
      value={value} onChange={setValue} label="Sections" panelId="test-panel" />
    <div role="tabpanel" id="test-panel" aria-labelledby={`test-panel-tab-${value}`}>{value}</div>
  </>;
}

test('arrow keys wrap, Home/End navigate, and the selected tab names its panel', () => {
  render(<Example />);
  const record = screen.getByRole('tab', { name: 'record' });
  record.focus();
  fireEvent.keyDown(record, { key: 'ArrowLeft' });
  const settings = screen.getByRole('tab', { name: 'settings' });
  expect(settings).toHaveFocus();
  expect(settings).toHaveAttribute('aria-selected', 'true');
  expect(record).toHaveAttribute('tabindex', '-1');
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('settings');
  fireEvent.keyDown(settings, { key: 'Home' });
  expect(record).toHaveFocus();
  fireEvent.keyDown(record, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'shop' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'shop' }), { key: 'End' });
  expect(settings).toHaveFocus();
  expect(settings).toHaveAttribute('aria-controls', 'test-panel');
});

test('the selection is a pill behind the row, placed before the first paint without sliding in', () => {
  const { container } = render(<Example />);
  const pill = container.querySelector('[data-pill]');
  expect(pill).toBeInTheDocument();
  expect(pill).toHaveClass('pe-tab-pill');
  expect(pill).toHaveAttribute('aria-hidden', 'true');
  // Its first placement is instant; only moves after it are animated.
  expect(pill.style.transitionDuration).toBe('0ms');
});

test('a parent that rebuilds its items every render does not make the pill re-render', () => {
  let renders = 0;
  function Rebuilds() {
    const [value, setValue] = useState('record');
    const [, force] = useState(0);
    renders += 1;
    // A fresh array each render, as the Rankings page builds it.
    const items = ['record', 'shop'].map((id) => ({ id, label: id }));
    return <>
      <Tabs items={items} value={value} onChange={setValue} label="Sections" />
      <button type="button" onClick={() => force((n) => n + 1)}>again</button>
    </>;
  }
  render(<Rebuilds />);
  const before = renders;
  fireEvent.click(screen.getByRole('button', { name: 'again' }));
  fireEvent.click(screen.getByRole('button', { name: 'again' }));
  // Two parent renders, and nothing more on top of them.
  expect(renders - before).toBe(2);
});
