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
      html: t.html,
      css: t.css,
      card_html: t.card_html,
      is_custom: true
    }));

    return [...DEFAULT_TEMPLATES, ...mappedCustom];
  } catch (err) {
    console.warn('Could not fetch custom templates, using defaults:', err);
    return DEFAULT_TEMPLATES;
  }
}

export async function saveTemplate(template: Omit<WeddingTemplate, 'id'> & { id?: string }) {
  const token = localStorage.getItem('wedding_session_token');
  const dbData = {
    name: template.name,
    description: template.description,
    variant: template.variant,
    font_serif: template.fontSerif,
    font_sans: template.fontSans,
    icon_type: template.iconType,
    animation_type: template.animationType,
    colors: template.colors, 
    html: template.html,
    css: template.css,
    card_html: template.card_html,
  };

  const endpoint = template.id ? `/api/templates/${template.id}` : '/api/templates';
  const method = template.id ? 'PUT' : 'POST';

  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(dbData)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to save template');
  }

  return data.data;
}

export async function deleteTemplate(id: string) {
  const token = localStorage.getItem('wedding_session_token');
  const response = await fetch(`/api/templates/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete template');
  }
}
