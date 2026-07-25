declare module '@ffmpeg/ffmpeg' {
  export type FFmpeg = {
    load: () => Promise<void>;
    isLoaded: () => boolean;
    run: (...args: string[]) => Promise<void>;
    FS: (method: string, ...args: unknown[]) => unknown;
  };

  export const createFFmpeg: (options?: {
    corePath?: string;
    log?: boolean;
  }) => FFmpeg;

  export const fetchFile: (
    file: string | Blob | File,
  ) => Promise<Uint8Array>;
}

declare module 'react-webcam' {
  import {
    type ForwardRefExoticComponent,
    type RefAttributes,
  } from 'react';

  type WebcamProps = {
    audio?: boolean;
    videoConstraints?: MediaTrackConstraints;
    audioConstraints?: MediaTrackConstraints;
    mirrored?: boolean;
    screenshotFormat?: string;
    onUserMedia?: (stream: MediaStream) => void;
    onUserMediaError?: (error: string | DOMException) => void;
  };

  type WebcamInstance = HTMLVideoElement & {
    stream?: MediaStream;
    video?: HTMLVideoElement;
  };

  const Webcam: ForwardRefExoticComponent<
    WebcamProps & RefAttributes<WebcamInstance>
  >;

  export default Webcam;
}

declare module 'react-player' {
  import { type ComponentType } from 'react';

  type ReactPlayerProps = {
    url?: string;
    controls?: boolean;
    muted?: boolean;
    playsinline?: boolean;
    width?: string | number;
    height?: string | number;
    onError?: (error: unknown) => void;
  };

  const ReactPlayer: ComponentType<ReactPlayerProps>;

  export default ReactPlayer;
}
