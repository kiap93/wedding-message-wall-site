import React, { useRef, useEffect } from 'react';
import { Text, Image, Rect, Group } from 'react-konva';
import { EditorElement, useEditorStore } from '../store';
import useImage from 'use-image';

interface Props {
  element: EditorElement;
  isSelected: boolean;
}

export const ElementRenderer: React.FC<Props> = ({ element, isSelected }) => {
  const shapeRef = useRef<any>(null);
  const updateElement = useEditorStore((state) => state.updateElement);
  const setSelectedId = useEditorStore((state) => state.setSelectedId);
  
  const [image] = useImage(element.src || '');

  const handleDragEnd = (e: any) => {
    updateElement(element.id, {
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale to 1 and update dimensions
    node.scaleX(1);
    node.scaleY(1);

    updateElement(element.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(5, node.width() * scaleX),
      height: Math.max(5, node.height() * scaleY),
      rotation: node.rotation(),
    });
  };

  const commonProps = {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    opacity: element.opacity ?? 1,
    draggable: true,
    ref: shapeRef,
    onClick: () => setSelectedId(element.id),
    onTap: () => setSelectedId(element.id),
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
  };

  if (element.type === 'text') {
    return (
      <Text
        {...commonProps}
        text={element.text}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.fill}
      />
    );
  }

  if (element.type === 'rect') {
    return (
      <Rect
        {...commonProps}
        fill={element.fill}
        cornerRadius={element.borderRadius}
      />
    );
  }

  if (element.type === 'image') {
    return (
      <Image
        {...commonProps}
        image={image}
      />
    );
  }

  if (element.type === 'button') {
    return (
      <Group {...commonProps}>
        <Rect
          width={element.width}
          height={element.height}
          fill={element.fill}
          cornerRadius={element.borderRadius || 8}
          shadowBlur={isSelected ? 10 : 0}
          shadowColor="rgba(0,0,0,0.1)"
        />
        <Text
          width={element.width}
          height={element.height}
          text={element.text}
          fontSize={element.fontSize || 16}
          fontFamily={element.fontFamily || 'Inter'}
          fill="#FFFFFF"
          align="center"
          verticalAlign="middle"
        />
      </Group>
    );
  }

  return null;
};
