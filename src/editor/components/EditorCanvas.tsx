import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Transformer, Rect, Line } from 'react-konva';
import { useEditorStore } from '../store';
import { ElementRenderer } from './ElementRenderer';
import { WORLD_WIDTH, getFitScale } from '../utils/coordinates';

export const EditorCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { 
    elements, 
    selectedId, 
    setSelectedId, 
    setScale, 
    scale, 
    canvasWidth, 
    canvasHeight,
    pan,
    setPan,
    guides,
    isSpacePressed,
    setIsSpacePressed
  } = useEditorStore();

  // Handle auto-resize & initial scale
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        
        // Only set initial scale once or if requested
        if (scale === 1 && pan.x === 0 && pan.y === 0) {
          const newScale = getFitScale(width, height, canvasWidth, canvasHeight, 60);
          setScale(newScale);
          // Center it
          setPan({
            x: (width - canvasWidth * newScale) / 2,
            y: (height - canvasHeight * newScale) / 2
          });
        }
      }
    });

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight, setScale, setPan]);

  // Handle Zoom (Wheel)
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - pan.x) / oldScale,
      y: (pointer.y - pan.y) / oldScale,
    };

    // If metaKey or ctrlKey is pressed, zoom. Otherwise, scroll (pan)
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const isZoomIn = e.evt.deltaY < 0;
      const newScale = isZoomIn ? oldScale * 1.1 : oldScale / 1.1;

      setScale(newScale);
      setPan({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else {
      // Direct panning with wheel (like a spreadsheet or standard doc)
      setPan((prev) => ({
        x: prev.x - e.evt.deltaX,
        y: prev.y - e.evt.deltaY
      }));
    }
  };

  // Handle Panning (Stage background click OR Spacebar OR Touch dragging)
  const [isPanning, setIsPanning] = useState(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  
  const handleMouseDown = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;

    const isStageClick = e.target === e.target.getStage();
    const isCanvasBgClick = e.target && typeof e.target.id === 'function' && e.target.id() === 'canvas-background';
    
    // Selection logic
    if (isStageClick || isCanvasBgClick) {
      setSelectedId(null);
    }
    
    // Pan logic: middle button OR left button with Space/Alt OR clicks on Stage/Canvas background OR any touches on the backdrop!
    const isTouch = e.evt && e.evt.touches;
    const isMiddleClick = e.evt && e.evt.button === 1;
    const isLeftClick = e.evt && e.evt.button === 0;
    
    if (
      isMiddleClick || 
      (isLeftClick && (e.evt.altKey || isSpacePressed || isStageClick || isCanvasBgClick)) ||
      isTouch
    ) {
      setIsPanning(true);
      // Change cursor to grabbing
      document.body.style.cursor = 'grabbing';
      
      const pointer = stage.getPointerPosition();
      if (pointer) {
        lastPointerRef.current = { x: pointer.x, y: pointer.y };
      }
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isPanning || !lastPointerRef.current) return;
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const dx = pointer.x - lastPointerRef.current.x;
    const dy = pointer.y - lastPointerRef.current.y;

    setPan((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));

    lastPointerRef.current = { x: pointer.x, y: pointer.y };
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    lastPointerRef.current = null;
    document.body.style.cursor = 'default';
  };

  // Keyboard listeners for Spacebar and Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'INPUT') {
        if (!isSpacePressed) setIsSpacePressed(true);
      }
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useEditorStore.temporal.getState().redo();
        } else {
          useEditorStore.temporal.getState().undo();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed, setIsSpacePressed]);

  // Handle Transformer updates
  useEffect(() => {
    if (selectedId && trRef.current && stageRef.current) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
      } else {
        trRef.current.nodes([]);
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedId, elements]);

  return (
    <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-[#F0F0EE]">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        ref={stageRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default' }}
      >
        <Layer x={pan.x} y={pan.y} scaleX={scale} scaleY={scale}>
          {/* Background Shadow/Border to visualize the world space */}
          <Rect
            id="canvas-background"
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill="white"
            shadowBlur={20}
            shadowColor="rgba(0,0,0,0.1)"
          />

          {elements.map((el) => (
            <ElementRenderer key={el.id} element={el} isSelected={selectedId === el.id} />
          ))}

          {/* Guide Lines */}
          {guides.map((g, i) => (
            <Line
              key={i}
              points={g.type === 'v' ? [g.pos, -1000, g.pos, 30000] : [-1000, g.pos, 10000, g.pos]}
              stroke="#FF4785"
              strokeWidth={1 / scale}
              dash={[5, 5]}
            />
          ))}

          <Transformer
            ref={trRef}
            rotateEnabled={true}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
};
