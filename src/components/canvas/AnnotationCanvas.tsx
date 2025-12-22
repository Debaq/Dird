import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text } from 'react-konva';
import { useTranslation } from 'react-i18next';
import type { Image } from '@/lib/db/schema';

interface AnnotationCanvasProps {
  image: Image;
  detections?: any[];
  segmentations?: any[];
  onAnnotationChange?: (annotations: any) => void;
}

const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  image,
  detections = [],
  segmentations = [],
  onAnnotationChange,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [konvaImage, setKonvaImage] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);

  // Load image
  useEffect(() => {
    const img = new window.Image();
    const url = URL.createObjectURL(image.originalBlob);

    img.onload = () => {
      setKonvaImage(img);
      calculateScale(img.width, img.height);
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }, [image]);

  // Calculate scale to fit canvas
  const calculateScale = (imgWidth: number, imgHeight: number) => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight || 600;

    const scaleX = containerWidth / imgWidth;
    const scaleY = containerHeight / imgHeight;
    const newScale = Math.min(scaleX, scaleY, 1);

    setScale(newScale);
    setStageSize({
      width: imgWidth * newScale,
      height: imgHeight * newScale,
    });
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (konvaImage) {
        calculateScale(konvaImage.width, konvaImage.height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [konvaImage]);

  if (!konvaImage) {
    return (
      <div className="w-full h-96 bg-coal-50 rounded-lg flex items-center justify-center">
        <p className="text-smoke-500">Cargando imagen...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full bg-coal-900 rounded-lg overflow-hidden">
      <Stage width={stageSize.width} height={stageSize.height}>
        {/* Original Image Layer */}
        <Layer>
          <KonvaImage
            image={konvaImage}
            width={konvaImage.width}
            height={konvaImage.height}
            scaleX={scale}
            scaleY={scale}
          />
        </Layer>

        {/* AI Detections Layer */}
        <Layer>
          {detections.map((detection, idx) => (
            <Group key={`detection-${idx}`}>
              <Rect
                x={detection.bbox.x * scale}
                y={detection.bbox.y * scale}
                width={detection.bbox.width * scale}
                height={detection.bbox.height * scale}
                stroke="#20B5AE"
                strokeWidth={2}
                dash={[5, 5]}
                listening={false}
              />
              <Text
                x={detection.bbox.x * scale}
                y={(detection.bbox.y - 20) * scale}
                text={`${detection.class} (${Math.round(detection.confidence * 100)}%)`}
                fontSize={12}
                fill="#20B5AE"
                padding={4}
                listening={false}
              />
            </Group>
          ))}
        </Layer>

        {/* Manual Annotations Layer */}
        <Layer>{/* Manual annotations will be added here */}</Layer>
      </Stage>
    </div>
  );
};

export default AnnotationCanvas;
