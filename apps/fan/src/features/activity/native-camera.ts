import { Directory, File, Paths } from 'expo-file-system';
import {
  requestCameraPermissionsAsync,
  launchCameraAsync,
  CameraType,
} from 'expo-image-picker';
import { createPhotoCapture } from './capture';

const capture = createPhotoCapture({
  permission: requestCameraPermissionsAsync,
  take: () =>
    launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      exif: false,
      quality: 0.6,
      cameraType: CameraType.back,
    }),
  remove: (uri) => {
    const file = new File(uri);
    if (file.exists) file.delete();
  },
});

// This feature is the only ImagePicker consumer. Clear camera originals as well
// as returned compressed assets, including remnants of a prior interrupted run.
export function discardCameraCache() {
  const directory = new Directory(Paths.cache, 'ImagePicker');
  if (directory.exists) directory.delete();
}
let capturing = false;
export async function capturePhoto() {
  if (capturing) throw new Error('Camera is already open.');
  capturing = true;
  try {
    discardCameraCache();
    return await capture();
  } finally {
    capturing = false;
    discardCameraCache();
  }
}
