const { getSupabase } = require("./lib/supabase");

const VIZZION_BASE   = "https://app.vizzionpay.com.br/api/v1";
const VIZZION_PUB    = process.env.VIZZION_PUBLIC_KEY  || "thiago-ziko766_7dcl7bavvrdsg854";
const VIZZION_SECRET = process.env.VIZZION_SECRET_KEY  || "2naj9vu4z2n6hst48mqdk9rx4dzx86rb0u437znelwuzskm6l2toqwelf1bpmeff";
const UTMIFY_TOKEN   = "lzASZob4ldSJJc3jT1LILy9alPxWJgpnPhCh";

async function sendUtmify(transactionId, status, customer, amountReais, createdAt, utms) {
  try {
    const amountCents     = Math.round(amountReais * 100);
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const netCents        = amountCents - gatewayFeeCents;
    const payload = {
      orderId:       transactionId,
      platform:      "VizzionPay",
      paymentMethod: "pix",
      status,
      createdAt:     createdAt || new Date().toISOString().replace("T"," ").slice(0,19),
      approvedDate:  status === "paid" ? new Date().toISOString().replace("T"," ").slice(0,19) : null,
      refundedAt:    null,
      customer: {
        name:     customer.name     || null,
        email:    customer.email    || null,
        phone:    customer.phone    || null,
        document: customer.cpf      || null,
        country:  "BR",
        ip:       "177.0.0.1",
      },
      products: [{
        id:           "shopify-br-001",
        name:         "LOJA SHOPIFY BR",
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
    await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-token": UTMIFY_TOKEN },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[UTMify] Erro:", err);
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
  const n = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, n);
  let s1 = d.reduce((a, v, i) => a + v * (10 - i), 0);
  let r1 = (s1 * 10) % 11; if (r1 >= 10) r1 = 0; d.push(r1);
  let s2 = d.reduce((a, v, i) => a + v * (11 - i), 0);
  let r2 = (s2 * 10) % 11; if (r2 >= 10) r2 = 0; d.push(r2);
  return d.join('');
}

function toAmountReais(rawAmount) {
  if (rawAmount == null) return 64.00;
  const n = Number(rawAmount);
  if (!Number.isFinite(n)) return 64.00;
  if (n >= 60 && n < 70)  return 64.00;
  if (n >= 70 && n < 90)  return 79.00;
  if (n >= 6000) return n / 100;
  return n;
}

function fmtPhone(phone) {
  if (!phone) return "(11) 99999-9999";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" }, body: "" };
  }

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { body = {}; }

  const randId      = Math.random().toString(36).slice(2,10);
  const amountReais = toAmountReais(body.amount ?? body.valor ?? body.total ?? 64);
  const customerName  = (body.nome || body.name || body.customer_name || `Cliente ${randId}`).toString().trim();
  const customerEmail = (body.email || body.customer_email || `cliente${randId}@gmail.com`).toString().trim();
  const customerPhone = fmtPhone(body.phone || body.customer_phone || "11999999999");
  const cpfRaw        = (body.cpf || body.document || body.customer_cpf || "").toString().replace(/\D/g, "");
  const customerCpf   = cpfRaw.length === 11 ? cpfRaw : gerarCpfValido();
  const utms          = body.utm || {};
  const identifier    = `order_${randId}_${Date.now()}`;

  const payload = {
    identifier,
    amount: amountReais,
    client: {
      name:     customerName,
      email:    customerEmail,
      phone:    customerPhone,
      document: customerCpf,
    },
    products: [{ id: "shopify-br-001", name: "LOJA SHOPIFY BR", quantity: 1, price: amountReais }],
    dueDate:  new Date(Date.now() + 24*60*60*1000).toISOString().slice(0,10),
    metadata: { provider: "LOJA SHOPIFY BR", orderId: identifier },
  };

  let resp;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    resp = await fetch(`${VIZZION_BASE}/gateway/pix/receive`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-public-key":  VIZZION_PUB,
        "x-secret-key":  VIZZION_SECRET,
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
    return jsonResponse(resp.status, { success: false, error: errMsg });
  }

  let parsed = {};
  try { parsed = JSON.parse(text); } catch {
    return jsonResponse(500, { success: false, error: "Resposta invalida da gateway" });
  }

  const transactionId = parsed.transactionId || null;
  const pixCode       = parsed.pix?.code      || null;

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
    console.error("[Supabase] Erro:", err);
  }

  await sendUtmify(transactionId, "waiting_payment",
    { name: customerName, email: customerEmail, phone: customerPhone, cpf: customerCpf },
    amountReais, new Date().toISOString().replace("T"," ").slice(0,19), utms
  );

  return jsonResponse(200, {
    success:        true,
    pixCode,
    pix_code:       pixCode,
    brcode:         pixCode,
    payload:        pixCode,
    qr_code_image:  parsed.pix?.image || null,
    transaction_id: transactionId,
    transactionId,
    deposit_id:     transactionId,
    status:         parsed.status || "PENDING",
  });
};
