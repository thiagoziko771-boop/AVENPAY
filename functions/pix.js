const { getSupabase } = require("./lib/supabase");

const WINNER_BASE   = "https://api.winnerpayy.com.br/api";
const WINNER_ID     = process.env.WINNER_CLIENT_ID;
const WINNER_SECRET = process.env.WINNER_CLIENT_SECRET;
const UTMIFY_TOKEN  = "lzASZob4ldSJJc3jT1LILy9alPxWJgpnPhCh";

// Cache para evitar múltiplas chamadas ao UTMify para o mesmo transactionId
const utmifyCache = new Map();
const CACHE_TTL = 60000; // 60 segundos

// Basic Auth header: Base64(client_id:client_secret)
function getAuthHeader() {
  const creds = `${WINNER_ID}:${WINNER_SECRET}`;
  const b64 = Buffer.from(creds).toString("base64");
  return `Basic ${b64}`;
}

async function sendUtmify(transactionId, status, customer, amountCents, createdAt, utms) {
  // Verifica se já foi enviado recentemente
  if (utmifyCache.has(transactionId)) {
    console.log("[UTMify] Skipping duplicate request for:", transactionId);
    return;
  }

  // Marca como enviado
  utmifyCache.set(transactionId, true);
  
  // Remove do cache após TTL
  setTimeout(() => utmifyCache.delete(transactionId), CACHE_TTL);

  try {
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const netCents        = amountCents - gatewayFeeCents;
    const payload = {
      orderId:       transactionId,
      platform:      "WinnerPay",
      paymentMethod: "pix",
      status,
      createdAt:     createdAt || new Date().toISOString().replace("T"," ").slice(0,19),
      approvedDate:  status === "paid" ? new Date().toISOString().replace("T"," ").slice(0,19) : null,
      refundedAt:    null,
      customer: {
        name:     customer.name    || null,
        email:    customer.email   || null,
        phone:    customer.phone   || null,
        document: customer.cpf     || null,
        country:  "BR",
        ip:       "177.0.0.1",
      },
      products: [{
        id:           "loja-shopify-br-001",
        name:         "LOJA SHOPIFY 03",
        planId:       null,
        planName:     null,
        quantity:     1,
        priceInCents: amountCents,
      }],
      trackingParameters: {
        src:          null,
        sck:          null,
        utm_source:   utms?.utm_source   || null,
        utm_campaign: utms?.utm_campaign || null,
        utm_medium:   utms?.utm_medium   || null,
        utm_content:  utms?.utm_content  || null,
        utm_term:     utms?.utm_term     || null,
      },
      commission: {
        totalPriceInCents:     amountCents,
        gatewayFeeInCents:     gatewayFeeCents,
        userCommissionInCents: netCents,
        currency:              "BRL",
      },
      isTest: false,
    };

    // Usa AbortController com timeout para evitar requisições penduradas
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduzido para 3 segundos

    const response = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-token": UTMIFY_TOKEN },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });
    clearTimeout(timeoutId);
    
    console.log("[UTMify] Requisição enviada com sucesso para:", transactionId);
  } catch (err) {
    console.error("[UTMify] Erro (não bloqueia PIX):", err.message);
    // Não relança erro - permite que PIX seja retornado mesmo se UTMify falhar
  }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function gerarCpfValido() {
  // Gera CPF com dígitos verificadores corretos
  const d = new Array(9);
  for (let i = 0; i < 9; i++) {
    d[i] = Math.floor(Math.random() * 10);
  }
  
  // Calcula primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += d[i] * (10 - i);
  }
  let resto = soma % 11;
  d[9] = resto < 2 ? 0 : 11 - resto;
  
  // Calcula segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += d[i] * (11 - i);
  }
  resto = soma % 11;
  d[10] = resto < 2 ? 0 : 11 - resto;
  
  return d.join('');
}

// WinnerPay recebe REAIS (não centavos)
// Cálculo: TED (17,32) + TSA (21,90) + TPE (25,98) = 65,20
function toAmountReais(rawAmount) {
  // Se não informar, padrão é R$ 65,20
  if (rawAmount == null || rawAmount === undefined || rawAmount === "") {
    console.log("[PIX] Sem amount informado, usando padrão R$ 65,20");
    return 65.20;
  }
  
  const n = Number(rawAmount);
  
  // Se não for um número válido, usa padrão
  if (!Number.isFinite(n)) {
    console.log("[PIX] Amount inválido:", rawAmount, "usando padrão R$ 65,20");
    return 65.20;
  }
  
  // Se vier em centavos (> 6000), converte para reais
  if (n >= 6000) {
    const result = n / 100;
    console.log("[PIX] Amount em centavos:", n, "convertido para:", result);
    return result;
  }
  
  // Se estiver entre 60 e 70, assume R$ 65,20 (valor padrão)
  if (n >= 60 && n < 70) {
    console.log("[PIX] Amount entre 60-70, usando R$ 65,20");
    return 65.20;
  }
  
  // Se estiver entre 70 e 90, assume R$ 79,70 (valor aumentado)
  if (n >= 70 && n < 90) {
    console.log("[PIX] Amount entre 70-90, usando R$ 79,70");
    return 79.70;
  }
  
  // Caso contrário, usa o valor informado
  console.log("[PIX] Amount informado:", n);
  return n;
}

function fmtPhone(phone) {
  if (!phone) return "+5511999999999";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 10) return `+55${digits}`;
  return `+55${digits}`;
}

exports.handler = async (event) => {
  // Verificar credenciais obrigatórias
  if (!WINNER_ID || !WINNER_SECRET) {
    console.error("❌ ERRO CRÍTICO: WINNER_CLIENT_ID ou WINNER_CLIENT_SECRET não configurados na Netlify!");
    return jsonResponse(500, { 
      success: false, 
      error: "Credenciais da gateway não configuradas. Contate o suporte.",
      debug: "Missing: " + (!WINNER_ID ? "WINNER_CLIENT_ID " : "") + (!WINNER_SECRET ? "WINNER_CLIENT_SECRET" : "")
    });
  }

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
      body: "",
    };
  }

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { body = {}; }

  const randId      = Math.random().toString(36).slice(2,10);
  const rawAmount   = body.amount ?? body.valor ?? body.total ?? 64;
  const amountReais = toAmountReais(rawAmount);

  const customerName  = (body.nome || body.name || body.customer_name || `Cliente ${randId}`).toString().trim();
  const customerEmail = (body.email || body.customer_email || `cliente${randId}@gmail.com`).toString().trim();
  const customerPhone = fmtPhone(body.phone || body.customer_phone || "11999999999");
  const cpfRaw        = (body.cpf || body.document || body.customer_cpf || "").toString().replace(/\D/g, "");
  const customerCpf   = cpfRaw.length === 11 ? cpfRaw : gerarCpfValido();
  const utms          = body.utm || {};

  const payload = {
    amount:      amountReais,
    description: "LOJA SHOPIFY 03",
    payer: {
      name:     customerName,
      email:    customerEmail,
      document: customerCpf,
      phone:    customerPhone,
    },
    include_qr_image: false,
  };

  let resp;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    resp = await fetch(`${WINNER_BASE}/financial/receber-pix`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": getAuthHeader(),
      },
      body:   JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    return jsonResponse(502, { success: false, error: "Falha ao conectar com gateway: " + String(err) });
  }

  const text = await resp.text();
  if (!resp.ok) {
    let errMsg = text;
    try { errMsg = JSON.parse(text)?.message || errMsg; } catch {}
    console.error("[WinnerPay] Erro HTTP:", resp.status, "Mensagem:", errMsg);
    return jsonResponse(resp.status, { success: false, error: errMsg, debug: { status: resp.status, body: text.substring(0, 200) } });
  }

  let parsed = {};
  try { parsed = JSON.parse(text); } catch {
    console.error("[WinnerPay] Erro ao parsear resposta:", text.substring(0, 200));
    return jsonResponse(500, { success: false, error: "Resposta invalida da gateway", debug: text.substring(0, 200) });
  }

  // WinnerPay retorna: transaction.transaction_id, pix_copia_e_cola
  const data          = parsed.transaction || {};
  const transactionId = data.transaction_id || parsed.transaction_id || null;
  const pixCode       = parsed.pix_copia_e_cola || parsed.qr_code_data || data.metadata?.pix_copia_e_cola || null;

  console.log("[PIX] Gerado com sucesso:", { transactionId, pixCode: pixCode ? "✓" : "✗", amount: amountReais });

  try {
    const supabase = getSupabase();
    await supabase.from("transactions").insert({
      transaction_id: transactionId,
      amount:         amountReais,
      customer_name:  customerName,
      customer_email: customerEmail,
      customer_cpf:   customerCpf,
      customer_phone: customerPhone,
      status:         "pending",
      brcode:         pixCode,
      utm_source:     utms.source || utms.utm_source || null,
      utm_campaign:   utms.campaign || utms.utm_campaign || null,
      utm_medium:     utms.medium || utms.utm_medium || null,
    });
  } catch (err) {
    console.error("[Supabase] Erro ao salvar transação (continuando):", err.message);
    // Continua mesmo se Supabase falhar - PIX já foi gerado na gateway
  }

  await sendUtmify(
    transactionId, "waiting_payment",
    { name: customerName, email: customerEmail, phone: customerPhone, cpf: customerCpf },
    Math.round(amountReais * 100),
    new Date().toISOString().replace("T"," ").slice(0,19),
    utms
  ).catch(err => console.error("[SendUtmify] Erro (não bloqueia resposta):", err.message));

  return jsonResponse(200, {
    success:        true,
    pixCode,
    pix_code:       pixCode,
    brcode:         pixCode,
    payload:        pixCode,
    qr_code_image:  null,
    transaction_id: transactionId,
    transactionId,
    deposit_id:     transactionId,
    status:         data.status || "pending",
  });
};
