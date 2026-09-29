export type Photo = { kind: 'photo'; base64: string; mime: 'image/jpeg' };
type Asset = {
  uri: string;
  base64?: string | null;
  width: number;
  height: number;
  type?: string | null;
};
type Camera = {
  permission: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  take: () => Promise<{ canceled: boolean; assets?: Asset[] | null }>;
  remove: (uri: string) => void;
};

export function createPhotoCapture(camera: Camera) {
  return async (): Promise<
    Photo | { kind: 'cancelled' } | { kind: 'denied'; canAskAgain: boolean }
  > => {
    const permission = await camera.permission();
    if (!permission.granted)
      return { kind: 'denied', canAskAgain: permission.canAskAgain };
    const result = await camera.take();
    try {
      if (result.canceled) return { kind: 'cancelled' };
      const asset = result.assets?.[0];
      if (
        !asset ||
        result.assets?.length !== 1 ||
        asset.type !== 'image' ||
        !asset.base64 ||
        asset.base64.length > 2_666_668 ||
        asset.width * asset.height > 16_000_000
      )
        throw new Error('Take a smaller still photo (at most 2 MB).');
      return { kind: 'photo', base64: asset.base64, mime: 'image/jpeg' };
    } finally {
      // No camera-roll save. Delete cache files even when validation fails.
      let failed = false;
      for (const asset of result.assets ?? []) {
        asset.base64 = null;
        try {
          camera.remove(asset.uri);
        } catch {
          failed = true;
        }
      }
      if (failed)
        throw new Error('Photo cleanup failed. Close and reopen the activity.');
    }
  };
}
