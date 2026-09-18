/** Actual Nodemailer composition, without opening a network connection.
 * This checks compatibility of the security upgrade, NOT inbox delivery.
 */
const nodemailer = require('nodemailer');

test('composes the app mail fields, attachment and unsubscribe headers', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const result = await transport.sendMail({
    from: 'ReunitePets <sender@example.test>', to: 'owner@example.test',
    subject: 'Verify your email', html: '<p>Verification link</p>',
    headers: { 'List-Unsubscribe': '<https://example.test/unsubscribe/test>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    attachments: [{ filename: 'flyer.txt', content: Buffer.from('Synthetic flyer'), contentType: 'text/plain' }],
  });
  expect(result.envelope).toEqual({ from: 'sender@example.test', to: ['owner@example.test'] });
  const mime = result.message.toString();
  expect(mime).toContain('Subject: Verify your email');
  expect(mime).toContain('List-Unsubscribe: <https://example.test/unsubscribe/test>');
  expect(mime).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  expect(mime).toContain('Verification link');
  expect(mime).toContain('filename=flyer.txt');
  expect(mime).toContain(Buffer.from('Synthetic flyer').toString('base64'));
  transport.close();
});
