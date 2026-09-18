test('background cleanup does not keep a worker alive', () => {
  const unref = jest.fn();
  const interval = jest.spyOn(global, 'setInterval').mockReturnValue({ unref });
  try {
    jest.isolateModules(() => require('@/app/lib/rateLimit'));
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
    expect(unref).toHaveBeenCalledTimes(1);
  } finally {
    interval.mockRestore();
  }
});
