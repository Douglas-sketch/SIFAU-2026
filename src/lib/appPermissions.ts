export interface PermissionRequestResult {
  camera: 'granted' | 'denied' | 'unsupported' | 'error';
  audio: 'granted' | 'denied' | 'unsupported' | 'error';
  location: 'granted' | 'denied' | 'unsupported' | 'error';
}

export async function requestEssentialPermissions(): Promise<PermissionRequestResult> {
  const result: PermissionRequestResult = {
    camera: 'unsupported',
    audio: 'unsupported',
    location: 'unsupported',
  };

  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      result.camera = 'granted';
      result.audio = 'granted';
      stream.getTracks().forEach(track => track.stop());
    } catch (error: any) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      result.camera = denied ? 'denied' : 'error';
      result.audio = denied ? 'denied' : 'error';
    }
  }

  if (navigator.geolocation) {
    result.location = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted' as const),
        (error) => resolve(error?.code === 1 ? 'denied' as const : 'error' as const),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  return result;
}
