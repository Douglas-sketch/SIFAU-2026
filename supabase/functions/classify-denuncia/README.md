# classify-denuncia

Edge Function para sugerir tipo e urgência de denúncia com Anthropic.

## Variáveis de ambiente (Supabase)

Configure no painel do Supabase (Project Settings → Edge Functions → Secrets):

- `ANTHROPIC_API_KEY`

## Deploy

```bash
supabase functions deploy classify-denuncia
```

## Exemplo de payload

```json
{
  "descricao": "Obra sem alvará avançando sobre calçada.",
  "tipos_disponiveis": [
    "Construção Irregular",
    "Ocupação Irregular",
    "Comércio Irregular",
    "Desmatamento",
    "Lixo/Entulho",
    "Outros"
  ]
}
```
