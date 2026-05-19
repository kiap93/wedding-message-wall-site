import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Stage, Layer, Text, Image, Rect, Group } from 'react-konva';
import { useEditorStore, EditorElement } from '../editor/store';
import { WORLD_WIDTH, WORLD_HEIGHT, getFitScale } from '../editor/utils/coordinates';
import { getSupabase } from '../lib/supabase';
import { WeddingEvent } from '../types';
import useImage from 'use-image';
import { Loader2 } from 'lucide-react';

export default function InvitationViewer() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      try {
        const supabase = getSupabase();
        const { data } = await supabase
          .from('projects')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (data) {
          setProject(data);
          if (data.invitation_config) {
            const config = typeof data.invitation_config === 'string' 
              ? JSON.parse(data.invitation_config) 
              : data.invitation_config;
            setElements(config.elements || []);
          }
        }
      } catch (err) {
        console.error('Viewer load error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [slug]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scale = useMemo(() => {
    return getFitScale(dimensions.width, dimensions.height, 0);
  }, [dimensions]);

  const offset = useMemo(() => {
    return {
      x: (dimensions.width - WORLD_WIDTH * scale) / 2,
      y: (dimensions.height - WORLD_HEIGHT * scale) / 2
    };
  }, [dimensions, scale]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#FDFCF0]">
        <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-white overflow-hidden flex items-center justify-center">
      <Stage width={dimensions.width} height={dimensions.height}>
        <Layer x={offset.x} y={offset.y} scaleX={scale} scaleY={scale}>
          <Rect x={0} y={0} width={WORLD_WIDTH} height={WORLD_HEIGHT} fill="white" />
          {elements.sort((a, b) => a.zIndex - b.zIndex).map((el) => (
            <RenderOnlyElement key={el.id} element={el} slug={slug || ''} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

function RenderOnlyElement({ element, slug }: { element: EditorElement, slug: string }) {
  const [image] = useImage(element.src || '');

  const handleClick = () => {
    if (element.type === 'button') {
      window.location.href = `/${slug}/rsvp`;
    }
  };

  const common = {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    opacity: element.opacity ?? 1,
    onClick: handleClick,
    onTap: handleClick,
    listening: element.type === 'button'
  };

  if (element.type === 'text') {
    return (
      <Text
        {...common}
        text={element.text}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.fill}
      />
    );
  }

  if (element.type === 'rect') {
    return <Rect {...common} fill={element.fill} cornerRadius={element.borderRadius} />;
  }

  if (element.type === 'image') {
    return <Image {...common} image={image} />;
  }

  if (element.type === 'button') {
    return (
      <Group {...common} cursor="pointer">
        <Rect
          width={element.width}
          height={element.height}
          fill={element.fill}
          cornerRadius={element.borderRadius || 8}
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
}
