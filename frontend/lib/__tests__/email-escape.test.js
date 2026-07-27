/**
 * Branded emails are domain-authenticated and go to attacker-chosen
 * addresses, so a user-controlled name (a pet's name, an inviter's name)
 * must never reach the recipient as live HTML. escapeHtml neutralizes the
 * five significant characters, and renderBrandedEmail escapes every plain
 * text field (heading, preheader, ctaLabel, footnote) centrally so a caller
 * cannot forget. bodyHtml stays raw HTML by contract; its call sites escape
 * their own user values.
 */

import { escapeHtml, renderBrandedEmail } from '@/app/lib/email';

describe('escapeHtml', () => {
  test('neutralizes the five HTML-significant characters', () => {
    expect(escapeHtml(`</p><a href="x">click</a>`)).toBe(
      '&lt;/p&gt;&lt;a href=&quot;x&quot;&gt;click&lt;/a&gt;'
    );
    expect(escapeHtml("O'Malley & Sons")).toBe('O&#39;Malley &amp; Sons');
  });

  test('coerces nullish to empty string without throwing', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('renderBrandedEmail escapes its plain-text fields', () => {
  const inject = '<script>alert(1)</script>';

  test('a hostile heading cannot break out as live markup', () => {
    const html = renderBrandedEmail({ heading: inject, bodyHtml: '<p>hi</p>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('preheader, ctaLabel and footnote are all escaped', () => {
    const html = renderBrandedEmail({
      heading: 'Hello',
      bodyHtml: '<p>hi</p>',
      preheader: inject,
      ctaLabel: inject,
      ctaUrl: 'https://reunitepets.org/x',
      footnote: inject,
    });
    // Exactly zero live copies of the injected tag anywhere in the document.
    expect(html.includes('<script>alert(1)</script>')).toBe(false);
    // ...and it survives as inert, escaped text (once per injected field:
    // preheader, ctaLabel, footnote — heading is a static 'Hello' here).
    expect(html.split('&lt;script&gt;alert(1)&lt;/script&gt;').length - 1).toBe(3);
  });

  test('bodyHtml is intentionally NOT escaped (callers escape their values)', () => {
    const html = renderBrandedEmail({ heading: 'Hi', bodyHtml: '<p><strong>bold</strong></p>' });
    expect(html).toContain('<p><strong>bold</strong></p>');
  });
});
