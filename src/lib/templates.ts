import { getSupabase } from './supabase';
import { WeddingTemplate, DEFAULT_TEMPLATES } from '../types';

export async function fetchTemplates(): Promise<WeddingTemplate[]> {
  try {
    const supabase = getSupabase();
    const { data: customTemplates, error } = await supabase
      .from('templates')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Table doesn't exist yet, return defaults
        return DEFAULT_TEMPLATES;
      }
      throw error;
    }

    // Map DB fields to interface if necessary (using camelCase in UI, snake_case in DB)
    const mappedCustom = (customTemplates || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      variant: t.variant,
      fontSerif: t.font_serif,
      fontSans: t.font_sans,
      iconType: t.icon_type,
      animationType: t.animation_type,
      colors: typeof t.colors === 'string' ? JSON.parse(t.colors) : t.colors,
      is_custom: true
    }));

    return [...DEFAULT_TEMPLATES, ...mappedCustom];
  } catch (err) {
    console.warn('Could not fetch custom templates, using defaults:', err);
    return DEFAULT_TEMPLATES;
  }
}

export async function saveTemplate(template: Omit<WeddingTemplate, 'id'> & { id?: string }) {
  const supabase = getSupabase();
  const dbData = {
    name: template.name,
    description: template.description,
    variant: template.variant,
    font_serif: template.fontSerif,
    font_sans: template.fontSans,
    icon_type: template.iconType,
    animation_type: template.animationType,
    colors: template.colors, // Supabase handles jsonb normally if passed as object
  };

  if (template.id) {
    const { data, error } = await supabase
      .from('templates')
      .update(dbData)
      .eq('id', template.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('templates')
      .insert([dbData])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function deleteTemplate(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
