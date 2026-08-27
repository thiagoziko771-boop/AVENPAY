/**
 * CONFIGURAÇÃO CENTRAL - Valores padronizados
 * Mudar aqui afeta TODO o sistema: frontend, backend, pixels
 */

const CONFIG = {
  // Valor padrão do PIX em REAIS
  DEFAULT_AMOUNT: 65.20,
  
  // Detalhamento da taxa
  AMOUNTS: {
    TED: 17.32,      // Taxa banco
    TSA: 21.90,      // Taxa intermediária
    TPE: 25.98,      // Taxa plataforma
    TOTAL: 65.20     // Soma: 17.32 + 21.90 + 25.98
  },
  
  // Loja
  STORE_NAME: "LOJA SHOPIFY 03",
  
  // Facebook Pixel IDs
  FACEBOOK_PIXELS: [
    "4327697327497010",
    "1078834241324397",
    "1527029111971432"
  ],
  
  // UTMify
  UTMIFY_PIXEL_ID: "6a2200f2ae65ba8b4e8c85c7",
  
  // WinnerPay
  WINNER_API_BASE: "https://api.winnerpayy.com.br/api",
  
  // Supabase
  SUPABASE_TABLE: "transactions"
};

// Export para Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
