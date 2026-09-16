# Variáveis de Ambiente para Netlify

Para a migração para **NowHubPay** funcionar, configure estas variáveis de ambiente no painel do Netlify:

## NowHubPay (NOVO)
```
NOWHUB_CLIENT_ID=cli_15abcbafb56a6521
NOWHUB_CLIENT_SECRET=sec_4e9f4d28a87db26ef504b5d5bf563ce53a4ea44dfd27be42
```

## Supabase (Manter)
```
NEXT_PUBLIC_SUPABASE_URL=https://seus-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-secreta
```

## Passo a Passo para Configurar

1. Acesse o painel do Netlify
2. Vá em: **Site Settings → Build & Deploy → Environment**
3. Clique em **Edit variables**
4. Adicione as variáveis acima
5. Faça redeploy do site

## Status da Migração

- ✅ `functions/pix.js` - Migrado para NowHubPay
- ✅ `functions/check-payment.js` - Migrado para NowHubPay
- ✅ `CONFIG.js` - Atualizado com gateway NowHubPay
- ⏳ Deploy e testes - Próximo passo
