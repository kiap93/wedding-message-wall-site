import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Transformer, Rect } from 'react-konva';
import { useEditorStore } from '../store';
import { ElementRenderer } from './ElementRenderer';
import { WORLD_WIDTH, WORLD_HEIGHT, getFitScale } from '../utils/coordinates';

export const EditorCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { elements, selectedId, setSelectedId, setScale, scale } = useEditorStore();

  // Handle auto-resize
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        
        // Calculate new scale to fit
        const newScale = getFitScale(width, height, 60);
        setScale(newScale);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [setScale]);

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

  // Center design offset
  const offset = useMemo(() => {
    const x = (dimensions.width - WORLD_WIDTH * scale) / 2;
    const y = (dimensions.height - WORLD_HEIGHT * scale) / 2;
    return { x, y };
  }, [dimensions, scale]);

  return (
    <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-[#F0F0EE]">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        ref={stageRef}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            setSelectedId(null);
          }
        }}
      >
        <Layer x={offset.x} y={offset.y} scaleX={scale} scaleY={scale}>
          {/* Background Shadow/Border to visualize the world space */}
          <Rect
            x={0}
            y={0}
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            fill="white"
            shadowBlur={20}
            shadowColor="rgba(0,0,0,0.1)"
          />

          {elements.map((el) => (
            <ElementRenderer key={el.id} element={el} isSelected={selectedId === el.id} />
          ))}

          <Transformer
            ref={trRef}
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
