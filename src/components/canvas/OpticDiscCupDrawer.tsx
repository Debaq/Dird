/**
 * OpticDiscCupDrawer
 *
 * Modal para pintar manualmente la copa (cup) sobre el disco óptico detectado
 * Muestra solo el disco óptico recortado y ampliado
 */

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { Detection } from '@/lib/db/schema';
import { Save, Trash2, Paintbrush, RotateCcw, Eraser } from 'lucide-react';

// OpenCV types (will be available globally when opencv.js is loaded)
declare const cv: any;

interface OpticDiscPoint {
  x: number;
  y: number;
}

interface OpticDiscCupDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opticDisc: Detection | null;
  opticCup: Detection | null; // Existing cup detection with painted pixels
  imageBlob: Blob | null;
  onSaveCup: (data: {
    cupBbox: { x: number; y: number; width: number; height: number };
    discPoints?: {
      superior: OpticDiscPoint;
      inferior: OpticDiscPoint;
      nasal: OpticDiscPoint;
      temporal: OpticDiscPoint;
    };
    paintedPixels: string[]; // Array of "x,y" strings for semantic segmentation
  }) => void;
}

export function OpticDiscCupDrawer({
  open,
  onOpenChange,
  opticDisc,
  opticCup,
  imageBlob,
  onSaveCup,
}: OpticDiscCupDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'points' | 'paint'>('points'); // Start with points mode
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush'); // Brush or eraser tool
  const [discPoints, setDiscPoints] = useState<OpticDiscPoint[]>([]);
  const [isPainting, setIsPainting] = useState(false);
  const [brushSize, setBrushSize] = useState(10);
  const [paintedPixels, setPaintedPixels] = useState<Set<string>>(new Set());
  const [imageLoaded, setImageLoaded] = useState(false);
  const [cropInfo, setCropInfo] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [customCursor, setCustomCursor] = useState<string>('crosshair');

  // Image processing controls
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1.0);
  const [useCLAHE, setUseCLAHE] = useState(false);
  const [useGreenChannel, setUseGreenChannel] = useState(false);
  const [useGrayscale, setUseGrayscale] = useState(false);
  const [useSharpening, setUseSharpening] = useState(false);

  // Load and crop image to show only optic disc region
  useEffect(() => {
    if (open && imageBlob && opticDisc) {
      const imageUrl = URL.createObjectURL(imageBlob);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;

        // Calculate crop region (disc bbox + 30% margin)
        const margin = 0.3;
        const marginX = opticDisc.bbox.width * margin;
        const marginY = opticDisc.bbox.height * margin;

        const cropX = Math.max(0, opticDisc.bbox.x - marginX);
        const cropY = Math.max(0, opticDisc.bbox.y - marginY);
        const cropWidth = Math.min(img.width - cropX, opticDisc.bbox.width + 2 * marginX);
        const cropHeight = Math.min(img.height - cropY, opticDisc.bbox.height + 2 * marginY);

        setCropInfo({ x: cropX, y: cropY, width: cropWidth, height: cropHeight });
        setImageLoaded(true);
        drawCanvas();
      };
      img.src = imageUrl;

      // Cleanup
      return () => {
        URL.revokeObjectURL(imageUrl);
      };
    }
  }, [open, imageBlob, opticDisc]);

  // Initialize painted pixels and disc points from existing cup data
  useEffect(() => {
    if (open && opticCup && cropInfo) {
      const scale = 2; // Must match the scale used in drawCanvas

      // Load painted pixels from metadata
      if (opticCup.metadata?.paintedPixels && Array.isArray(opticCup.metadata.paintedPixels)) {
        // Convert from original image coordinates to canvas coordinates
        const canvasPixels = new Set<string>();
        opticCup.metadata.paintedPixels.forEach((pixel: string) => {
          const [origX, origY] = pixel.split(',').map(Number);
          // Convert to canvas coordinates (relative to crop + scaled)
          const canvasX = Math.round((origX - cropInfo.x) * scale);
          const canvasY = Math.round((origY - cropInfo.y) * scale);
          canvasPixels.add(`${canvasX},${canvasY}`);
        });
        setPaintedPixels(canvasPixels);
      }

      // Load disc points from optic disc metadata
      if (opticDisc?.metadata?.precisePoints) {
        const points = opticDisc.metadata.precisePoints;
        const canvasPoints: OpticDiscPoint[] = [
          points.superior,
          points.inferior,
          points.nasal,
          points.temporal,
        ].map(p => ({
          x: Math.round((p.x - cropInfo.x) * scale),
          y: Math.round((p.y - cropInfo.y) * scale),
        }));
        setDiscPoints(canvasPoints);
      }
    }
  }, [open, opticCup, opticDisc, cropInfo]);

  // Redraw canvas when painted pixels, disc points or processing settings change
  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [paintedPixels, discPoints, imageLoaded, brightness, contrast, useCLAHE, useGreenChannel, useGrayscale, useSharpening]);

  // Redraw canvas on window resize
  useEffect(() => {
    if (!imageLoaded) return;

    const handleResize = () => {
      drawCanvas();
    };

    window.addEventListener('resize', handleResize);
    // Also trigger on modal open
    const timeout = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, [imageLoaded]);

  // Update custom cursor when mode, tool, or brush size changes
  useEffect(() => {
    if (mode === 'points') {
      setCustomCursor('crosshair');
    } else {
      // Generate SVG cursor for paint mode
      const canvas = canvasRef.current;
      if (!canvas || !imageLoaded) {
        setCustomCursor('crosshair');
        return;
      }

      // Calculate cursor size in display pixels
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      const displaySize = (brushSize * 2) / scale; // Diameter in display pixels

      // Limit cursor size (browsers typically support up to 128x128)
      const size = Math.min(Math.max(displaySize, 16), 128);
      const center = size / 2;

      const color = tool === 'eraser' ? '#000000' : '#3b82f6';
      const strokeWidth = 2;

      const svg = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${center}" cy="${center}" r="${center - strokeWidth}"
                  fill="none" stroke="${color}" stroke-width="${strokeWidth}" />
          ${tool === 'eraser' ? `<circle cx="${center}" cy="${center}" r="${center - strokeWidth - 1}"
                  fill="none" stroke="white" stroke-width="1" />` : ''}
        </svg>
      `;

      const encodedSvg = encodeURIComponent(svg);
      const dataUri = `url("data:image/svg+xml,${encodedSvg}") ${center} ${center}, crosshair`;
      setCustomCursor(dataUri);
    }
  }, [mode, tool, brushSize, imageLoaded]);

  const processImage = (img: HTMLImageElement): HTMLCanvasElement => {
    // Create temporary canvas for processing
    const tempCanvas = document.createElement('canvas');
    const scale = 2;
    tempCanvas.width = cropInfo!.width * scale;
    tempCanvas.height = cropInfo!.height * scale;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Draw cropped image
    tempCtx.drawImage(
      img,
      cropInfo!.x, cropInfo!.y, cropInfo!.width, cropInfo!.height,
      0, 0, tempCanvas.width, tempCanvas.height
    );

    // Apply OpenCV processing
    const src = cv.imread(tempCanvas);
    let processed = src.clone();

    try {
      // 1. Green channel only
      if (useGreenChannel) {
        const channels = new cv.MatVector();
        cv.split(processed, channels);
        const green = channels.get(1);
        cv.cvtColor(green, processed, cv.COLOR_GRAY2BGR);
        green.delete();
        channels.delete();
      }

      // 2. Grayscale
      if (useGrayscale) {
        cv.cvtColor(processed, processed, cv.COLOR_BGR2GRAY);
        cv.cvtColor(processed, processed, cv.COLOR_GRAY2BGR);
      }

      // 3. Brightness and Contrast
      if (brightness !== 0 || contrast !== 1.0) {
        processed.convertTo(processed, -1, contrast, brightness);
      }

      // 4. CLAHE
      if (useCLAHE) {
        const lab = new cv.Mat();
        cv.cvtColor(processed, lab, cv.COLOR_BGR2Lab);
        const channels = new cv.MatVector();
        cv.split(lab, channels);

        const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        const lChannel = channels.get(0);
        clahe.apply(lChannel, lChannel);

        cv.merge(channels, lab);
        cv.cvtColor(lab, processed, cv.COLOR_Lab2BGR);

        lab.delete();
        channels.delete();
      }

      // 5. Sharpening
      if (useSharpening) {
        const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
          0, -1, 0,
          -1, 5, -1,
          0, -1, 0
        ]);
        cv.filter2D(processed, processed, -1, kernel);
        kernel.delete();
      }

      // Draw processed image to temp canvas
      cv.imshow(tempCanvas, processed);
    } finally {
      src.delete();
      processed.delete();
    }

    return tempCanvas;
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !cropInfo) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get container size
    const container = canvas.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate scale to fit container while maintaining aspect ratio
    const imageAspect = cropInfo.width / cropInfo.height;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth, displayHeight;
    if (imageAspect > containerAspect) {
      // Image is wider - fit to width
      displayWidth = containerWidth;
      displayHeight = containerWidth / imageAspect;
    } else {
      // Image is taller - fit to height
      displayHeight = containerHeight;
      displayWidth = containerHeight * imageAspect;
    }

    // Set canvas display size
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Set canvas internal resolution (2x for sharp rendering)
    const scale = 2;
    canvas.width = cropInfo.width * scale;
    canvas.height = cropInfo.height * scale;

    // Process image and draw
    const processedCanvas = processImage(img);
    ctx.drawImage(processedCanvas, 0, 0);

    // Draw optic disc outline (relative to crop)
    if (opticDisc) {
      const relativeX = (opticDisc.bbox.x - cropInfo.x) * scale;
      const relativeY = (opticDisc.bbox.y - cropInfo.y) * scale;
      const relativeWidth = opticDisc.bbox.width * scale;
      const relativeHeight = opticDisc.bbox.height * scale;

      ctx.strokeStyle = '#ef4444'; // red
      ctx.lineWidth = 3;
      ctx.strokeRect(relativeX, relativeY, relativeWidth, relativeHeight);

      // Label
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Disco Óptico', relativeX, relativeY - 8);
    }

    // Draw painted pixels (cup)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.6)'; // semi-transparent blue
    paintedPixels.forEach(pixel => {
      const [x, y] = pixel.split(',').map(Number);
      ctx.fillRect(x, y, 1, 1);
    });

    // Draw disc points as crosshairs
    discPoints.forEach((point, index) => {
      const crossSize = 8; // Length of each line from center

      // Draw crosshair lines
      ctx.strokeStyle = '#22c55e'; // green
      ctx.lineWidth = 2;
      ctx.beginPath();

      // Horizontal line
      ctx.moveTo(point.x - crossSize, point.y);
      ctx.lineTo(point.x + crossSize, point.y);

      // Vertical line
      ctx.moveTo(point.x, point.y - crossSize);
      ctx.lineTo(point.x, point.y + crossSize);

      ctx.stroke();

      // Draw white outline for the cross for better visibility
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(point.x - crossSize, point.y);
      ctx.lineTo(point.x + crossSize, point.y);
      ctx.moveTo(point.x, point.y - crossSize);
      ctx.lineTo(point.x, point.y + crossSize);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Redraw green cross on top
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(point.x - crossSize, point.y);
      ctx.lineTo(point.x + crossSize, point.y);
      ctx.moveTo(point.x, point.y - crossSize);
      ctx.lineTo(point.x, point.y + crossSize);
      ctx.stroke();

      // Draw number next to the cross (to the right and slightly down)
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // White outline for number
      ctx.strokeText((index + 1).toString(), point.x + crossSize + 4, point.y);
      // Green fill for number
      ctx.fillText((index + 1).toString(), point.x + crossSize + 4, point.y);
    });
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

    return { x, y };
  };

  const paintAt = (x: number, y: number) => {
    const newPaintedPixels = new Set(paintedPixels);

    // Paint or erase in a circle pattern based on brush size
    for (let dx = -brushSize; dx <= brushSize; dx++) {
      for (let dy = -brushSize; dy <= brushSize; dy++) {
        if (dx * dx + dy * dy <= brushSize * brushSize) {
          const px = x + dx;
          const py = y + dy;
          const pixelKey = `${px},${py}`;

          if (tool === 'brush') {
            newPaintedPixels.add(pixelKey);
          } else {
            // eraser
            newPaintedPixels.delete(pixelKey);
          }
        }
      }
    }

    setPaintedPixels(newPaintedPixels);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    if (mode === 'points') {
      // Add point (max 4 points)
      if (discPoints.length < 4) {
        setDiscPoints([...discPoints, { x: coords.x, y: coords.y }]);
      }
    } else {
      // Paint mode
      setIsPainting(true);
      paintAt(coords.x, coords.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPainting) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    paintAt(coords.x, coords.y);
  };

  const handleMouseUp = () => {
    setIsPainting(false);
  };

  const handleSave = () => {
    if (paintedPixels.size === 0 || !cropInfo) return;

    // Calculate bounding box of painted pixels
    const pixels = Array.from(paintedPixels).map(p => p.split(',').map(Number));

    const minX = Math.min(...pixels.map(p => p[0]));
    const maxX = Math.max(...pixels.map(p => p[0]));
    const minY = Math.min(...pixels.map(p => p[1]));
    const maxY = Math.max(...pixels.map(p => p[1]));

    // Convert back to original image coordinates
    const scale = 2;
    const cupBbox = {
      x: cropInfo.x + minX / scale,
      y: cropInfo.y + minY / scale,
      width: (maxX - minX) / scale,
      height: (maxY - minY) / scale,
    };

    // Convert painted pixels to original image coordinates
    const paintedPixelsArray = Array.from(paintedPixels).map(pixel => {
      const [canvasX, canvasY] = pixel.split(',').map(Number);
      const origX = cropInfo.x + canvasX / scale;
      const origY = cropInfo.y + canvasY / scale;
      return `${origX},${origY}`;
    });

    // Convert disc points to original image coordinates
    let discPointsData = undefined;
    if (discPoints.length === 4) {
      const convertedPoints = discPoints.map(p => ({
        x: cropInfo.x + p.x / scale,
        y: cropInfo.y + p.y / scale,
      }));

      // Determine which point is which based on position
      // Sort by Y (top to bottom)
      const sortedByY = [...convertedPoints].sort((a, b) => a.y - b.y);
      const superior = sortedByY[0]; // topmost
      const inferior = sortedByY[3]; // bottommost

      // Sort remaining two by X
      const middleTwo = [sortedByY[1], sortedByY[2]].sort((a, b) => a.x - b.x);

      // Temporal is usually on the left in typical fundus images
      // But we'll need fovea position to determine this correctly
      // For now, we'll just use left/right as temporal/nasal
      const temporal = middleTwo[0]; // leftmost
      const nasal = middleTwo[1]; // rightmost

      discPointsData = {
        superior,
        inferior,
        nasal,
        temporal,
      };
    }

    onSaveCup({ cupBbox, discPoints: discPointsData, paintedPixels: paintedPixelsArray });
    handleClearAll();
    onOpenChange(false);
  };

  const handleClear = () => {
    if (mode === 'points') {
      setDiscPoints([]);
    } else {
      setPaintedPixels(new Set());
    }
  };

  const handleClearAll = () => {
    setPaintedPixels(new Set());
    setDiscPoints([]);
  };

  const handleResetProcessing = () => {
    setBrightness(0);
    setContrast(1.0);
    setUseCLAHE(false);
    setUseGreenChannel(false);
    setUseGrayscale(false);
    setUseSharpening(false);
  };

  const handleClose = () => {
    setPaintedPixels(new Set());
    setDiscPoints([]);
    setMode('points');
    setTool('brush');
    setImageLoaded(false);
    handleResetProcessing();
    onOpenChange(false);
  };

  const canProceedToPaint = discPoints.length === 4;
  const canSave = paintedPixels.size > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Definir Disco Óptico y Copa</DialogTitle>
          <DialogDescription className="h-10 flex items-center">
            {mode === 'points'
              ? 'Paso 1: Marca 4 puntos en los límites del disco óptico (superior, inferior, nasal, temporal)'
              : 'Paso 2: Pinta la copa (excavación) dentro del disco óptico'}
          </DialogDescription>
        </DialogHeader>

        {!opticDisc ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            ⚠️ No se detectó disco óptico en esta imagen. Primero debes marcar el disco óptico.
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_280px] gap-4 flex-1 overflow-hidden">
            {/* Left column - Main canvas area */}
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* Instructions panel - Fixed height to prevent modal resizing */}
              {mode === 'points' ? (
                <div className="flex items-center gap-4 p-3 bg-green-50 border border-green-200 rounded h-[72px] flex-shrink-0">
                  <div className="text-sm text-green-800 flex-1">
                    <p className="font-medium mb-1">📍 Paso 1: Marca 4 puntos en los límites del disco</p>
                    <p className="text-xs">Haz clic en los puntos: superior, inferior, nasal y temporal (en cualquier orden)</p>
                  </div>
                  <div className="text-sm font-bold text-green-700">
                    {discPoints.length}/4 puntos
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded h-[72px] flex-shrink-0">
                  <Paintbrush className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="text-sm text-blue-800 flex-1">
                    <p className="font-medium">🎨 Paso 2: Pinta la copa</p>
                    <p className="text-xs">Usa el pincel para pintar la copa (la parte más oscura dentro del disco). Ajusta el tamaño del pincel en el panel lateral.</p>
                  </div>
                </div>
              )}

              <div className="border-2 border-coal-200 rounded-lg overflow-hidden bg-coal-100 flex-1 min-h-0 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{
                    imageRendering: 'crisp-edges',
                    cursor: customCursor
                  }}
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-smoke-600 h-8 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 border-2 border-red-500 rounded"></div>
                  <span>Disco Óptico (detectado)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span>Puntos del disco</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-blue-500 opacity-60 rounded"></div>
                  <span>Copa (pintada)</span>
                </div>
              </div>
            </div>

            {/* Right column - Image processing controls */}
            <div className="flex flex-col gap-4 border-l pl-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Herramientas</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetProcessing}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>

              <div className="space-y-4">
                {/* Tool Selection - Only show in paint mode */}
                {mode === 'paint' && (
                  <>
                    <div className="space-y-2 pb-4 border-b">
                      <Label className="text-xs font-medium">Herramienta</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={tool === 'brush' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTool('brush')}
                          className="w-full"
                        >
                          <Paintbrush className="w-4 h-4 mr-1" />
                          Pincel
                        </Button>
                        <Button
                          variant={tool === 'eraser' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTool('eraser')}
                          className="w-full"
                        >
                          <Eraser className="w-4 h-4 mr-1" />
                          Goma
                        </Button>
                      </div>
                    </div>
                    {/* Brush Size */}
                    <div className="space-y-2 pb-4 border-b">
                      <Label className="text-xs font-medium">Tamaño del {tool === 'brush' ? 'Pincel' : 'Goma'}</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[brushSize]}
                          onValueChange={(value) => setBrushSize(value[0])}
                          min={5}
                          max={30}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-10 text-right">{brushSize}px</span>
                      </div>
                    </div>
                  </>
                )}
                {/* Brightness */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Brillo</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[brightness]}
                      onValueChange={(value) => setBrightness(value[0])}
                      min={-100}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-10 text-right">{brightness}</span>
                  </div>
                </div>

                {/* Contrast */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Contraste</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[contrast]}
                      onValueChange={(value) => setContrast(value[0])}
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-10 text-right">{contrast.toFixed(1)}</span>
                  </div>
                </div>

                {/* CLAHE */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">CLAHE (realce adaptativo)</Label>
                  <Switch
                    checked={useCLAHE}
                    onCheckedChange={setUseCLAHE}
                  />
                </div>

                {/* Green Channel */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Canal Verde</Label>
                  <Switch
                    checked={useGreenChannel}
                    onCheckedChange={setUseGreenChannel}
                  />
                </div>

                {/* Grayscale */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Escala de Grises</Label>
                  <Switch
                    checked={useGrayscale}
                    onCheckedChange={setUseGrayscale}
                  />
                </div>

                {/* Sharpening */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Nitidez (Sharpening)</Label>
                  <Switch
                    checked={useSharpening}
                    onCheckedChange={setUseSharpening}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-[10px] text-smoke-600 leading-relaxed">
                  💡 <strong>Tip:</strong> Activa "Canal Verde" o "CLAHE" para ver mejor la copa. El procesamiento no afecta la imagen original.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-shrink-0">
          {/* Navigation buttons - Always visible for consistent layout */}
          {mode === 'points' ? (
            <Button
              onClick={() => setMode('paint')}
              disabled={!canProceedToPaint}
              className={canProceedToPaint ? "bg-green-600 hover:bg-green-700" : ""}
            >
              Continuar al Paso 2 →
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setMode('points')}
            >
              ← Volver a Paso 1
            </Button>
          )}

          <div className="flex-1" />

          <Button
            variant="outline"
            onClick={handleClear}
            disabled={mode === 'points' ? discPoints.length === 0 : paintedPixels.size === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {mode === 'points' ? 'Limpiar Puntos' : 'Limpiar Copa'}
          </Button>
          {(discPoints.length > 0 || paintedPixels.size > 0) && (
            <Button
              variant="outline"
              onClick={handleClearAll}
              size="sm"
            >
              Limpiar Todo
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || !opticDisc}
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
