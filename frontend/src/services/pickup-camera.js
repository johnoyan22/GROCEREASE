export const isPickupQr = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function cameraError(error) {
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) return 'Camera permission was denied. Allow camera access in your browser, or use the pickup PIN.';
  if (['NotFoundError', 'OverconstrainedError'].includes(error?.name)) return 'No usable camera was found. Choose another camera or use the pickup PIN.';
  if (['NotReadableError', 'AbortError'].includes(error?.name)) return 'The camera is busy or unavailable. Close other camera apps and retry, or use the pickup PIN.';
  return 'The camera could not start. Retry or use the pickup PIN.';
}

// Own getUserMedia so even a permission response arriving after close is released.
// ZXing owns decoding only. Neither frames nor credentials are persisted.
export function createPickupCamera({ video, onCandidate, onError, onState,
  mediaDevices = navigator.mediaDevices, secure = window.isSecureContext,
  loadReader = () => import('@zxing/browser') }) {
  let generation = 0, stream = null, controls = null;
  const release = (source) => source?.getTracks().forEach((track) => track.stop());
  function stop() {
    generation++;
    controls?.stop(); controls = null;
    release(stream); stream = null;
    video.pause(); video.srcObject = null;
  }
  async function start(deviceId = '') {
    stop();
    const version = generation;
    if (!secure || !mediaDevices?.getUserMedia) {
      onError('Camera access needs HTTPS or trusted localhost. Use the pickup PIN on this connection.');
      return;
    }
    onState('starting');
    try {
      const { BrowserQRCodeReader } = await loadReader();
      if (version !== generation) return;
      const source = await mediaDevices.getUserMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } } });
      if (version !== generation) { release(source); return; }
      stream = source;
      source.getTracks().forEach(track => track.addEventListener?.('ended', () => {
        if (version !== generation) return;
        stop(); onState('stopped'); onError('The camera disconnected. Reopen it or use the pickup PIN.');
      }, { once: true }));
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 500 });
      video.srcObject = source;
      let timer;
      try {
        await Promise.race([video.play(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Camera playback timed out')), 8000); })]);
      } finally { clearTimeout(timer); }
      if (version !== generation) { release(source); return; }
      // scan() is synchronous and returns stop controls. Owning playback avoids a
      // late decodeFromStream cleanup clearing a newly switched camera's video.
      const decoding = reader.scan(video, (result, error, scanner) => {
        if (version !== generation) return;
        if (result) {
          // Invalidate synchronously before any async validation or another frame.
          scanner?.stop(); stop(); onState('stopped');
          onCandidate(result.getText());
        } else if (error && !['NotFoundException', 'ChecksumException', 'FormatException'].includes(error.name)) {
          stop(); onState('stopped'); onError('QR decoding stopped. Retry or use the pickup PIN.');
        }
      });
      if (version !== generation) { decoding.stop(); release(source); return; }
      controls = decoding;
      const devices = await mediaDevices.enumerateDevices();
      if (version === generation) onState('running', devices.filter((device) => device.kind === 'videoinput'));
    } catch (error) {
      if (version !== generation) return;
      stop(); onState('stopped'); onError(cameraError(error));
    }
  }
  return { start, stop };
}
