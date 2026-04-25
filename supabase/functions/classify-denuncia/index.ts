// Supabase Edge Function: classify-denuncia
// Configuração necessária no Supabase:
//   ANTHROPIC_API_KEY=<sua_chave>

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ClassifyRequest = {
  descricao?: string;
  tipos_disponiveis?: string[];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as ClassifyRequest;
    const descricao = (body.descricao || '').trim();
    const tipos = Array.isArray(body.tipos_disponiveis) ? body.tipos_disponiveis : [];

    if (!descricao || tipos.length === 0) {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Você é um classificador de denúncias urbanas para prefeitura. Com base na descrição abaixo, retorne JSON com: { tipo_sugerido: string (um dos tipos disponíveis), urgencia: 'baixa'|'media'|'alta', justificativa: string (1 frase) }. Descrição: ${descricao}. Tipos disponíveis: ${tipos.join(', ')}`;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 220,
        temperature: 0,
        system: 'Retorne apenas JSON válido sem markdown.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      return new Response(JSON.stringify({ error: 'Falha Anthropic', details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await anthropicResponse.json();
    const contentText = data?.content?.[0]?.text ?? '{}';

    let parsed: { tipo_sugerido?: string; urgencia?: 'baixa' | 'media' | 'alta'; justificativa?: string } = {};
    try {
      parsed = JSON.parse(contentText);
    } catch {
      // fallback simples para evitar quebrar quando vier texto misto
      const match = contentText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const tipoSugerido = tipos.includes(parsed.tipo_sugerido || '') ? parsed.tipo_sugerido : tipos[0];
    const urgencia = parsed.urgencia === 'baixa' || parsed.urgencia === 'media' || parsed.urgencia === 'alta'
      ? parsed.urgencia
      : 'media';

    const result = {
      tipo_sugerido: tipoSugerido,
      urgencia,
      justificativa: (parsed.justificativa || 'Classificação sugerida com base na descrição informada.').slice(0, 280),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Erro interno', details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
