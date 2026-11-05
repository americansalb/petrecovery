/**
 * A stored file's URL changes when its bytes change.
 *
 * Bunny caches for thirty days and keys the cache on the whole URL. The
 * cascade writes every redraw to the same storage key, so without a
 * content hash in the URL a redrawn flyer stayed hidden behind the old one
 * at the edge.
 */

describe('uploadBufferToCdn', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    global.fetch = env.__fetch;
  });

  function configure() {
    process.env.BUNNY_STORAGE_ZONE = 'zone';
    process.env.BUNNY_API_KEY = 'key';
    process.env.BUNNY_CDN_URL = 'https://cdn.example.net';
    jest.resetModules();
    return require('@/app/lib/cdnUpload');
  }

  test('the URL carries a hash of the bytes, and the key does not', async () => {
    const { uploadBufferToCdn, contentVersion } = configure();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const a = await uploadBufferToCdn(Buffer.from('flyer v1'), { key: 'cases/c1/flyer_letter.pdf', contentType: 'application/pdf' });
    const b = await uploadBufferToCdn(Buffer.from('flyer v2'), { key: 'cases/c1/flyer_letter.pdf', contentType: 'application/pdf' });
    const again = await uploadBufferToCdn(Buffer.from('flyer v1'), { key: 'cases/c1/flyer_letter.pdf', contentType: 'application/pdf' });

    expect(a.key).toBe('cases/c1/flyer_letter.pdf');
    expect(a.url).toBe(`https://cdn.example.net/cases/c1/flyer_letter.pdf?v=${contentVersion(Buffer.from('flyer v1'))}`);
    expect(a.url).not.toBe(b.url);
    expect(again.url).toBe(a.url);
    expect(contentVersion(Buffer.from('flyer v1'))).toMatch(/^[0-9a-f]{8}$/);
    // The PUT itself goes to the bare key: the storage object is the same one.
    expect(global.fetch.mock.calls[0][0]).toBe('https://storage.bunnycdn.com/zone/cases/c1/flyer_letter.pdf');
  });
});
