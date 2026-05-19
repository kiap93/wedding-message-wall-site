import { create } from 'zustand';

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
  canvasWidth: number; // Virtual width (e.g. 1000)
  canvasHeight: number; // Virtual height (e.g. 1414)
  
  // Actions
  setElements: (elements: EditorElement[]) => void;
  addElement: (element: EditorElement) => void;
  updateElement: (id: string, updates: Partial<EditorElement>) => void;
  deleteElement: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setScale: (scale: number) => void;
  moveElementZ: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  elements: [],
  selectedId: null,
  scale: 1,
  canvasWidth: 1000,
  canvasHeight: 1414,

  setElements: (elements) => set({ elements: elements.sort((a, b) => a.zIndex - b.zIndex) }),

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

  setScale: (scale) => set({ scale }),

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

    // Reassign zIndex based on new order
    return {
      elements: newList.map((el, i) => ({ ...el, zIndex: i }))
    };
  }),
}));
