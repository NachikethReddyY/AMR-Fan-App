import { capturePhoto } from './native-camera';
const mockDelete = jest.fn();
const mockLaunch = jest.fn();
const mockPermission = jest.fn();
jest.mock('expo-file-system', () => ({
  File: class {
    exists = true;
    delete = mockDelete;
  },
  Directory: class {
    exists = true;
    delete = mockDelete;
  },
  Paths: { cache: 'file:///cache/' },
}));
jest.mock('expo-image-picker', () => ({
  CameraType: { back: 'back' },
  requestCameraPermissionsAsync: () => mockPermission(),
  launchCameraAsync: (options: unknown) => mockLaunch(options),
}));

test('native adapter requests only camera and clears stale/original/result cache files', async () => {
  mockPermission.mockResolvedValue({ granted: true, canAskAgain: true });
  mockLaunch.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///cache/ImagePicker/photo.jpg',
        type: 'image',
        base64: 'YWJj',
        width: 3,
        height: 2,
      },
    ],
  });
  expect((await capturePhoto()).kind).toBe('photo');
  expect(mockLaunch).toHaveBeenCalledWith({
    mediaTypes: ['images'],
    allowsEditing: false,
    base64: true,
    exif: false,
    quality: 0.6,
    cameraType: 'back',
  });
  expect(mockPermission).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledTimes(3);
});
