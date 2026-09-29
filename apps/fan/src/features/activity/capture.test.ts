import { createPhotoCapture } from './capture';

test('permission denial never launches camera', async () => {
  const take = jest.fn();
  const camera = createPhotoCapture({
    permission: async () => ({ granted: false, canAskAgain: false }),
    take,
    remove: jest.fn(),
  });
  expect(await camera()).toEqual({ kind: 'denied', canAskAgain: false });
  expect(take).not.toHaveBeenCalled();
});
test('camera-only result is memory-owned and disk asset is removed before returning', async () => {
  const remove = jest.fn();
  const camera = createPhotoCapture({
    permission: async () => ({ granted: true, canAskAgain: true }),
    take: async () => ({
      canceled: false,
      assets: [
        {
          uri: 'file:///capture.jpg',
          base64: 'YWJj',
          width: 4,
          height: 3,
          type: 'image',
        },
      ],
    }),
    remove,
  });
  expect(await camera()).toEqual({
    kind: 'photo',
    base64: 'YWJj',
    mime: 'image/jpeg',
  });
  expect(remove).toHaveBeenCalledWith('file:///capture.jpg');
});
test('oversized or unsupported captures are removed and rejected', async () => {
  const remove = jest.fn();
  const camera = createPhotoCapture({
    permission: async () => ({ granted: true, canAskAgain: true }),
    take: async () => ({
      canceled: false,
      assets: [
        {
          uri: 'file:///capture.jpg',
          base64: 'YWJj',
          width: 5000,
          height: 5000,
          type: 'image',
        },
      ],
    }),
    remove,
  });
  await expect(camera()).rejects.toThrow('smaller');
  expect(remove).toHaveBeenCalledTimes(1);
});
test('cleanup failure prevents retaining or sending the capture', async () => {
  const camera = createPhotoCapture({
    permission: async () => ({ granted: true, canAskAgain: true }),
    take: async () => ({
      canceled: false,
      assets: [
        {
          uri: 'file:///capture.jpg',
          base64: 'YWJj',
          width: 4,
          height: 3,
          type: 'image',
        },
      ],
    }),
    remove: () => {
      throw new Error('cleanup');
    },
  });
  await expect(camera()).rejects.toThrow('cleanup');
});
