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
