import { Box, Image } from '@chakra-ui/react';
import { memo, useEffect, useRef } from 'react';
import { canvasStyles } from './canvas-styles';
import { useCamera } from '@/context/camera-context';
import { useBgUrl, TRANSPARENT_BG_VALUE } from '@/context/bgurl-context';

const Background = memo(({ children }: { children?: React.ReactNode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    backgroundStream, isBackgroundStreaming, startBackgroundCamera, stopBackgroundCamera,
  } = useCamera();
  const { useCameraBackground, backgroundUrl } = useBgUrl();

  const isTransparent = backgroundUrl === TRANSPARENT_BG_VALUE;

  useEffect(() => {
    if (useCameraBackground) {
      startBackgroundCamera();
    } else {
      stopBackgroundCamera();
    }
  }, [useCameraBackground, startBackgroundCamera, stopBackgroundCamera]);

  useEffect(() => {
    if (videoRef.current && backgroundStream) {
      videoRef.current.srcObject = backgroundStream;
    }
  }, [backgroundStream]);

  return (
    <Box {...canvasStyles.background.container}>
      {useCameraBackground ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            ...canvasStyles.background.video,
            display: isBackgroundStreaming ? 'block' : 'none',
            transform: 'scaleX(-1)',
          }}
        />
      ) : (
        !isTransparent && (
          <Image
            {...canvasStyles.background.image}
            src={backgroundUrl}
            alt="background"
          />
        )
      )}
      {children}
    </Box>
  );
});

Background.displayName = 'Background';

export default Background;
