/**
 * Cloudflare Worker for Wedding Message Wall
 * Bindings:
 * - WEDDING_KV: KV Namespace
 */

export interface Message {
  id: string;
  name: string;
  message: string;
  timestamp: number;
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /api/messages
    if (request.method === 'GET' && path === '/api/messages') {
      const messagesStr = await env.WEDDING_KV.get('wedding_messages');
      const messages = messagesStr ? JSON.parse(messagesStr) : [];
      return new Response(JSON.stringify(messages), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /api/messages
    if (request.method === 'POST' && path === '/api/messages') {
      try {
        const body: any = await request.json();
        const { name, message } = body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return new Response(JSON.stringify({ error: 'Message is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const sanitizedName = name?.substring(0, 30) || '';
        const sanitizedMessage = message.substring(0, 150);

        const newMessage: Message = {
          id: crypto.randomUUID(),
          name: sanitizedName,
          message: sanitizedMessage,
          timestamp: Date.now(),
        };

        // Fetch existing, add new, keep last 50
        const messagesStr = await env.WEDDING_KV.get('wedding_messages');
        let messages: Message[] = messagesStr ? JSON.parse(messagesStr) : [];
        
        messages.unshift(newMessage);
        messages = messages.slice(0, 50);

        await env.WEDDING_KV.put('wedding_messages', JSON.stringify(messages));

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
