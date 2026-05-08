import { WeddingTemplate, DEFAULT_TEMPLATES } from '../types';
import { authenticatedFetch } from './auth';

export async function fetchTemplates(): Promise<WeddingTemplate[]> {
  try {
    // Try to fetch via API first (bypassing RLS)
    const response = await fetch('/api/templates');
    if (response.ok) {
      const { data } = await response.json();
      if (data) {
        // Map snake_case to camelCase
        const mappedCustom = data.map((t: any) => ({
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
      }
    }
    return DEFAULT_TEMPLATES;
  } catch (err) {
    console.warn('Could not fetch custom templates, using defaults:', err);
    return DEFAULT_TEMPLATES;
  }
}

export async function saveTemplate(template: Omit<WeddingTemplate, 'id'> & { id?: string }) {
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
  const method = template.id ? 'PATCH' : 'POST';

  const response = await authenticatedFetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dbData)
  });

  if (!response.ok) {
    let errorMessage = 'Failed to save template';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      const text = await response.text();
      errorMessage = `Server Error (${response.status}): ${text.substring(0, 100)}`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.data;
}

export async function deleteTemplate(id: string) {
  const response = await authenticatedFetch(`/api/templates/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete template');
  }
}
