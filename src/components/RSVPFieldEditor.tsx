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
  // Ensure fields is always an array
  let safeFields: RSVPField[] = [];
  if (Array.isArray(fields)) {
    safeFields = fields;
  } else if (typeof fields === 'string') {
    try {
      safeFields = JSON.parse(fields);
    } catch (e) {
      console.error('Failed to parse fields string:', e);
      safeFields = [];
    }
  }
  
  const currentFields = (safeFields && safeFields.length > 0) ? safeFields : DEFAULT_FIELDS;

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
                    const isActive = Array.isArray(currentFields) && currentFields.some(f => f.id === df.id);
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
        
        <Reorder.Group axis="y" values={currentFields} onReorder={onChange} className="space-y-4">
          {Array.isArray(currentFields) && currentFields.map((field) => {
            const isStandard = DEFAULT_FIELDS.some(df => df.id === field.id);
            return (
              <Reorder.Item 
                key={field.id} 
                value={field}
                className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm flex items-start gap-4 group hover:border-[#C5A059]/30 transition-all"
              >
                <div className="mt-2 cursor-grab active:cursor-grabbing text-gray-300 group-hover:text-[#C5A059] transition-colors p-2">
                  <GripVertical className="w-5 h-5" />
                </div>
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-[#C5A059]">
                      {isStandard ? 'Standard Label' : 'Custom Question'}
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-transparent focus:border-[#C5A059] focus:bg-white outline-none transition-all text-[#2D2424] text-sm font-medium"
                      placeholder="Enter question label..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Field Type</label>
                    <select
                      value={field.type}
                      onChange={(e) => handleUpdateField(field.id, { type: e.target.value as any })}
                      disabled={isStandard && field.id !== 'meal_preference'} // Keep meal preference choice-based
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-transparent focus:border-[#C5A059] focus:bg-white outline-none transition-all text-[#2D2424] text-sm disabled:opacity-50 cursor-pointer"
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
                    <div className="md:col-span-2 space-y-4 bg-gray-50/50 p-6 rounded-2xl border border-dashed border-gray-100">
                      <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Options</label>
                      <div className="space-y-3">
                        {(field.options || []).map((option, index) => (
                          <div key={index} className="flex gap-3">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...(field.options || [])];
                                newOptions[index] = e.target.value;
                                handleUpdateField(field.id, { options: newOptions });
                              }}
                              className="flex-1 px-4 py-2 rounded-xl bg-white border border-gray-100 focus:border-[#C5A059] outline-none transition-all text-sm"
                              placeholder={`Option ${index + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newOptions = (field.options || []).filter((_, i) => i !== index);
                                handleUpdateField(field.id, { options: newOptions });
                              }}
                              className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newOptions = [...(field.options || []), ''];
                            handleUpdateField(field.id, { options: newOptions });
                          }}
                          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#C5A059] hover:text-[#B38D45] transition-colors mt-2"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Choice
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="md:col-span-2 flex flex-wrap items-center gap-8 py-2">
                     <div className="flex items-center gap-3">
                       <input 
                          type="checkbox" 
                          id={`req-${field.id}`}
                          checked={field.required}
                          onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                          className="w-5 h-5 rounded-lg border-gray-200 text-[#C5A059] focus:ring-[#C5A059] transition-all cursor-pointer"
                       />
                       <label htmlFor={`req-${field.id}`} className="text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">Required</label>
                     </div>
                     <div className="flex items-center gap-3">
                       <input 
                          type="checkbox" 
                          id={`att-${field.id}`}
                          checked={field.showIfAttending}
                          onChange={(e) => handleUpdateField(field.id, { showIfAttending: e.target.checked })}
                          className="w-5 h-5 rounded-lg border-gray-200 text-[#C5A059] focus:ring-[#C5A059] transition-all cursor-pointer"
                       />
                       <label htmlFor={`att-${field.id}`} className="text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">Show only if Attending</label>
                     </div>
                  </div>
                </div>
  
                <button
                  onClick={() => handleRemoveField(field.id)}
                  className="mt-6 p-2 text-gray-200 hover:text-red-500 transition-colors"
                  title="Remove Question"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        <div className="mt-6 flex justify-center">
          <button
            onClick={handleAddField}
            className="flex items-center gap-2 px-6 py-3 bg-[#C5A059]/10 text-[#C5A059] border border-dashed border-[#C5A059]/30 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#C5A059]/20 transition-all w-full justify-center"
          >
            <Plus className="w-4 h-4" /> Add Another Question
          </button>
        </div>

        {Array.isArray(currentFields) && currentFields.filter(f => !DEFAULT_FIELDS.some(df => df.id === f.id)).length === 0 && (
            <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-3xl mt-4">
                <p className="text-sm text-gray-400">No custom questions added yet. Click "Add Field" to start customizing your RSVP form.</p>
            </div>
        )}
      </div>
    </div>
  );
}
