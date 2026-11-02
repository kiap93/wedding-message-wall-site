import React from 'react';
import { Plus, Trash2, GripVertical, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { RSVPField } from '../types';
import { Reorder } from 'motion/react';
import Button from '../design-system/components/Button';
import Input from '../design-system/components/Input';
import Select from '../design-system/components/Select';

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
    onChange(currentFields.filter(f => f.id !== id));
  };

  const handleUpdateField = (id: string, updates: Partial<RSVPField>) => {
    onChange(currentFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const toggleField = (id: string) => {
    const field = currentFields.find(f => f.id === id);
    if (field) {
      handleRemoveField(id);
    } else {
      const defaultF = DEFAULT_FIELDS.find(df => df.id === id);
      if (defaultF) onChange([...currentFields, defaultF]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#252525]">RSVP Form Schema</h3>
          <p className="text-xs text-[#777777]">Customize the questions and options guests answer during confirmation</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddField}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Custom Question
        </Button>
      </div>

      {/* Standard Fields Toggle Strip */}
      <div className="bg-white rounded-lg border border-[#E8E8E5] p-5 shadow-subtle">
        <div className="text-xs font-medium text-[#777777] mb-3">Core Attendance Fields</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {DEFAULT_FIELDS.map(df => {
            const isActive = Array.isArray(currentFields) && currentFields.some(f => f.id === df.id);
            return (
              <button
                key={df.id}
                onClick={() => toggleField(df.id)}
                className={`flex items-center justify-between p-2.5 rounded-md border text-xs font-medium transition-colors ${
                  isActive 
                    ? 'border-[#252525] bg-[#FAF9F7] text-[#252525]' 
                    : 'border-[#E8E8E5] bg-white text-[#999999] hover:border-[#D4D4CE]'
                }`}
              >
                <span>{df.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-[#252525] text-white' : 'bg-[#EFEFEA] text-[#777777]'
                }`}>
                  {isActive ? 'Active' : 'Off'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reorderable Fields List */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-[#777777]">Questions & Conditional Logic</div>
        
        <Reorder.Group axis="y" values={currentFields} onReorder={onChange} className="space-y-3">
          {Array.isArray(currentFields) && currentFields.map((field) => {
            const isStandard = DEFAULT_FIELDS.some(df => df.id === field.id);
            return (
              <Reorder.Item 
                key={field.id} 
                value={field}
                className="bg-white border border-[#E8E8E5] p-4 rounded-lg shadow-subtle flex items-start gap-3 hover:border-[#D4D4CE] transition-colors"
              >
                <div className="mt-2.5 cursor-grab active:cursor-grabbing text-[#B0ADA8] hover:text-[#252525] transition-colors">
                  <GripVertical className="w-4 h-4" />
                </div>
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={isStandard ? 'Standard Label' : 'Question Label'}
                    value={field.label}
                    onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                    placeholder="Enter question text..."
                  />

                  <Select
                    label="Field Type"
                    value={field.type}
                    onChange={(e) => handleUpdateField(field.id, { type: e.target.value as any })}
                    disabled={isStandard && field.id !== 'meal_preference'}
                    options={[
                      { value: 'text', label: 'Short Text' },
                      { value: 'textarea', label: 'Long Text / Notes' },
                      { value: 'number', label: 'Numeric Quantity' },
                      { value: 'select', label: 'Dropdown Selection' },
                      { value: 'radio', label: 'Single Choice (Radio)' },
                      { value: 'checkbox', label: 'Multi Choice (Checkbox)' },
                    ]}
                  />

                  {/* Choice options for dropdowns/radios */}
                  {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                    <div className="md:col-span-2 p-3 bg-[#FAF9F7] rounded-md border border-[#E8E8E5] space-y-2">
                      <div className="text-xs font-medium text-[#777777]">Selection Options</div>
                      <div className="space-y-2">
                        {(field.options || []).map((option, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...(field.options || [])];
                                newOptions[index] = e.target.value;
                                handleUpdateField(field.id, { options: newOptions });
                              }}
                              className="flex-1 h-8 px-3 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                              placeholder={`Option ${index + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newOptions = (field.options || []).filter((_, i) => i !== index);
                                handleUpdateField(field.id, { options: newOptions });
                              }}
                              className="p-1.5 text-[#777777] hover:text-red-600 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newOptions = [...(field.options || []), ''];
                            handleUpdateField(field.id, { options: newOptions });
                          }}
                          leftIcon={<Plus className="w-3 h-3" />}
                        >
                          Add Option Choice
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Checkbox settings */}
                  <div className="md:col-span-2 flex flex-wrap items-center gap-6 pt-1 text-xs text-[#555555]">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={field.required}
                        onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                        className="rounded border-[#E8E8E5] text-[#252525] focus:ring-[#8B806F]"
                      />
                      <span>Required field</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={field.showIfAttending}
                        onChange={(e) => handleUpdateField(field.id, { showIfAttending: e.target.checked })}
                        className="rounded border-[#E8E8E5] text-[#252525] focus:ring-[#8B806F]"
                      />
                      <span>Only show if attending</span>
                    </label>
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveField(field.id)}
                  className="mt-2 text-[#B0ADA8] hover:text-red-600 p-1.5 rounded transition-colors"
                  title="Delete Question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </div>
    </div>
  );
}
