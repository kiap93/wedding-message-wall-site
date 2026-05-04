import React from 'react';
import { Plus, Trash2, GripVertical, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { RSVPField } from '../types';
import { motion, Reorder } from 'motion/react';

interface RSVPFieldEditorProps {
  fields: RSVPField[];
  onChange: (fields: RSVPField[]) => void;
}

const DEFAULT_FIELDS: RSVPField[] = [
  { id: 'name', label: 'Full Name', type: 'text', required: true },
  { id: 'email', label: 'Email Address', type: 'text', required: false },
  { id: 'guest_count', label: 'Number of Guests', type: 'number', required: true, showIfAttending: true },
  { id: 'meal_preference', label: 'Meal Preference', type: 'select', required: true, options: ['Standard', 'Vegetarian', 'Vegan', 'Gluten Free'], showIfAttending: true },
  { id: 'dietary_requirements', label: 'Dietary Notes', type: 'textarea', required: false, showIfAttending: true }
];

export default function RSVPFieldEditor({ fields, onChange }: RSVPFieldEditorProps) {
  // If fields is empty or undefined, initialize with defaults
  const currentFields = fields && fields.length > 0 ? fields : DEFAULT_FIELDS;

  const handleAddField = () => {
    const newField: RSVPField = {
      id: Math.random().toString(36).substring(2, 9),
      label: 'New Question',
      type: 'text',
      required: false
    };
    onChange([...currentFields, newField]);
  };

  const handleRemoveField = (id: string) => {
    // Basic fields (name, email etc) can't be TRULY removed from the schema but we can skip them in rendering
    // For now allow removing anything
    onChange(currentFields.filter(f => f.id !== id));
  };

  const handleUpdateField = (id: string, updates: Partial<RSVPField>) => {
    onChange(currentFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const toggleField = (id: string) => {
    const field = currentFields.find(f => f.id === id);
    if (field) {
        // If it exists, remove it. If it doesn't, add it back from defaults?
        // Actually, let's use a "hidden" flag or just filter them.
        handleRemoveField(id);
    } else {
        const defaultF = DEFAULT_FIELDS.find(df => df.id === id);
        if (defaultF) onChange([...currentFields, defaultF]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif">Form Questions</h3>
        <button
          onClick={handleAddField}
          className="flex items-center gap-2 px-4 py-2 bg-[#C5A059] text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#B38D45] transition-all"
        >
          <Plus className="w-4 h-4" /> Add Field
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-[#C5A059]/10 shadow-sm p-6">
        <div className="mb-6 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Standard Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DEFAULT_FIELDS.map(df => {
                    const isActive = currentFields.some(f => f.id === df.id);
                    return (
                        <button
                            key={df.id}
                            onClick={() => toggleField(df.id)}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                isActive 
                                    ? 'border-[#C5A059] bg-[#C5A059]/5 text-[#C5A059]' 
                                    : 'border-gray-100 bg-gray-50 text-gray-400 opacity-60'
                            }`}
                        >
                            <span className="text-sm font-bold">{df.label}</span>
                            {isActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                    );
                })}
            </div>
        </div>

        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Custom Questions</h4>
        
        <Reorder.Group axis="y" values={currentFields} onReorder={onChange} className="space-y-3">
          {currentFields.filter(f => !DEFAULT_FIELDS.some(df => df.id === f.id)).map((field) => (
            <Reorder.Item 
              key={field.id} 
              value={field}
              className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex items-start gap-4 group"
            >
              <div className="mt-2 cursor-grab active:cursor-grabbing text-gray-300 group-hover:text-gray-400 transition-colors">
                <GripVertical className="w-5 h-5" />
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Label</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Type</label>
                  <select
                    value={field.type}
                    onChange={(e) => handleUpdateField(field.id, { type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 text-sm"
                  >
                    <option value="text">Short Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="number">Number</option>
                    <option value="select">Dropdown Choice</option>
                    <option value="radio">Single Choice (Radio)</option>
                    <option value="checkbox">Multi Choice (Checkbox)</option>
                  </select>
                </div>
                {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Options (one per line)</label>
                    <textarea
                      value={field.options?.join('\n') || ''}
                      onChange={(e) => handleUpdateField(field.id, { options: e.target.value.split('\n').map(s => s.trim()).filter(s => s) })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 text-sm min-h-[80px]"
                      placeholder={"Option 1\nOption 2\nOption 3"}
                    />
                  </div>
                )}
                <div className="md:col-span-2 flex items-center gap-6">
                   <div className="flex items-center gap-2">
                     <input 
                        type="checkbox" 
                        id={`req-${field.id}`}
                        checked={field.required}
                        onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-[#C5A059] focus:ring-[#C5A059]"
                     />
                     <label htmlFor={`req-${field.id}`} className="text-xs font-bold text-gray-600 cursor-pointer">Required</label>
                   </div>
                   <div className="flex items-center gap-2">
                     <input 
                        type="checkbox" 
                        id={`att-${field.id}`}
                        checked={field.showIfAttending}
                        onChange={(e) => handleUpdateField(field.id, { showIfAttending: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-[#C5A059] focus:ring-[#C5A059]"
                     />
                     <label htmlFor={`att-${field.id}`} className="text-xs font-bold text-gray-600 cursor-pointer">Only if Attending</label>
                   </div>
                </div>
              </div>

              <button
                onClick={() => handleRemoveField(field.id)}
                className="mt-6 p-2 text-gray-300 hover:text-red-500 transition-colors"
                title="Remove Question"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {currentFields.filter(f => !DEFAULT_FIELDS.some(df => df.id === f.id)).length === 0 && (
            <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-3xl mt-4">
                <p className="text-sm text-gray-400">No custom questions added yet.</p>
            </div>
        )}
      </div>
    </div>
  );
}
