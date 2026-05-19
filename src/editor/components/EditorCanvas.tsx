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
    guides
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

    const speed = 0.005;
    const isZoomIn = e.evt.deltaY < 0;
    const newScale = isZoomIn ? oldScale * 1.1 : oldScale / 1.1;

    setScale(newScale);
    setPan({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  // Handle Panning (Spacebar + Drag OR Middle Mouse)
  const [isPanning, setIsPanning] = useState(false);
  const handleMouseDown = (e: any) => {
    // Selection logic
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
    
    // Pan logic: middle button or spacebar (keyboard not handled here yet)
    if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.altKey)) {
      setIsPanning(true);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isPanning) return;
    setPan((prev) => ({
      x: prev.x + e.evt.movementX,
      y: prev.y + e.evt.movementY
    }));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          useEditorStore.temporal.getState().redo();
        } else {
          useEditorStore.temporal.getState().undo();
        }
      }

      // Spacebar panning (not fully functional without separate state, but showing intent)
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        onWheel={handleWheel}
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      >
        <Layer x={pan.x} y={pan.y} scaleX={scale} scaleY={scale}>
          {/* Background Shadow/Border to visualize the world space */}
          <Rect
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
