import { create } from 'zustand';
import { temporal } from 'zundo';

export interface EditorElement {
  id: string;
  type: 'text' | 'image' | 'rect' | 'button';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  opacity?: number;
  src?: string;
  borderRadius?: number;
  zIndex: number;
}

interface EditorState {
  elements: EditorElement[];
  selectedId: string | null;
  scale: number;
  canvasWidth: number; 
  canvasHeight: number;
  
  // Viewport
  pan: { x: number; y: number };
  guides: { type: 'h' | 'v'; pos: number }[];
  
  // Actions
  setCanvasHeight: (height: number) => void;
  setElements: (elements: EditorElement[]) => void;
  addElement: (element: EditorElement) => void;
  updateElement: (id: string, updates: Partial<EditorElement>) => void;
  deleteElement: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setScale: (scale: number | ((s: number) => number)) => void;
  setPan: (pan: { x: number; y: number } | ((p: { x: number; y: number }) => { x: number; y: number })) => void;
  setGuides: (guides: { type: 'h' | 'v'; pos: number }[]) => void;
  moveElementZ: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void;
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      elements: [],
      selectedId: null,
      scale: 1,
      canvasWidth: 1000,
      canvasHeight: 1414,
      pan: { x: 0, y: 0 },
      guides: [],

      setCanvasHeight: (height: number) => set({ canvasHeight: Math.min(20000, Math.max(500, height)) }),

      setElements: (elements) => set({ elements: elements.slice().sort((a, b) => a.zIndex - b.zIndex) }),

      addElement: (element) => set((state) => ({ 
        elements: [...state.elements, { ...element, zIndex: state.elements.length }] 
      })),

      updateElement: (id, updates) => set((state) => ({
        elements: state.elements.map((el) => (el.id === id ? { ...el, ...updates } : el))
      })),

      deleteElement: (id) => set((state) => ({
        elements: state.elements.filter((el) => el.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId
      })),

      setSelectedId: (id) => set({ selectedId: id }),

      setScale: (scaleOrFn) => set((state) => ({ 
        scale: typeof scaleOrFn === 'function' ? scaleOrFn(state.scale) : scaleOrFn 
      })),

      setPan: (panOrFn) => set((state) => ({ 
        pan: typeof panOrFn === 'function' ? panOrFn(state.pan) : panOrFn 
      })),

      setGuides: (guides) => set({ guides }),

      moveElementZ: (id, direction) => set((state) => {
        const list = [...state.elements].sort((a, b) => a.zIndex - b.zIndex);
        const idx = list.findIndex(el => el.id === id);
        if (idx === -1) return state;

        const newList = [...list];
        if (direction === 'up' && idx < newList.length - 1) {
          [newList[idx], newList[idx + 1]] = [newList[idx + 1], newList[idx]];
        } else if (direction === 'down' && idx > 0) {
          [newList[idx], newList[idx - 1]] = [newList[idx - 1], newList[idx]];
        } else if (direction === 'front') {
          const item = newList.splice(idx, 1)[0];
          newList.push(item);
        } else if (direction === 'back') {
          const item = newList.splice(idx, 1)[0];
          newList.unshift(item);
        }

        return {
          elements: newList.map((el, i) => ({ ...el, zIndex: i }))
        };
      }),
    }),
    {
      partialize: (state) => ({ elements: state.elements, canvasHeight: state.canvasHeight }),
    }
  )
);
