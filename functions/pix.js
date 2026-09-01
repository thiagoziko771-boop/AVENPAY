const { getSupabase } = require("./lib/supabase");

const AVEN_BASE = "https://api.avenpayments.com";
const AVEN_API_KEY = process.env.AVEN_API_KEY || "2zxA50CzfpTMZgKCwuotYv681fsfo4bcrXrdttHxdD4";
const UTMIFY_TOKEN = "lzASZob4ldSJJc3jT1LILy9alPxWJgpnPhCh";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAuthHeader() {
  if (!AVEN_API_KEY) throw new Error("AVEN_API_KEY não configurada");
  return `Bearer ${AVEN_API_KEY}`;
}

function gerarCpfValido() {
  const d = new Array(9);
  for (let i = 0; i < 9; i++) d[i] = Math.floor(Math.random() * 10);
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += d[i] * (10 - i);
  let resto = soma % 11;
  d[9] = resto < 2 ? 0 : 11 - resto;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += d[i] * (11 - i);
  resto = soma % 11;
  d[10] = resto < 2 ? 0 : 11 - resto;
  return d.join('');
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*" }, body: "" };

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch {}

  const randId = Math.random().toString(36).slice(2, 10);
  const customerName = (body.nome || body.name || `Cliente ${randId}`).toString().trim();
  const customerEmail = (body.email || `cliente${randId}@gmail.com`).toString().trim();
  const customerPhone = (body.phone || "11999999999").replace(/\D/g, "");
  const cpfRaw = (body.cpf || "").replace(/\D/g, "");
  const customerCpf = cpfRaw.length === 11 ? cpfRaw : gerarCpfValido();

  // Payload que funcionou
  const payload = {
    amount: 6520,
    currency: "BRL",
    method: "PIX",
    description: "LOJA SHOPIFY 03",
    payer: {
      name: customerName,
      taxId: customerCpf,
      email: customerEmail,
      phone: customerPhone
    },
    items: [{
      quantity: 1,
      name: "LOJA SHOPIFY 03",
      price: 6520,
      type: "DIGITAL"
    }]
  };

  try {
    const authHeader = getAuthHeader();
    const resp = await fetch(`${AVEN_BASE}/v1/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    if (!resp.ok) {
      let errMsg = text;
      try { errMsg = JSON.parse(text)?.message || errMsg; } catch {}
      return jsonResponse(resp.status, { success: false, error: errMsg });
    }

    let parsed = {};
    try { parsed = JSON.parse(text); } catch {}

    const transactionId = parsed.id;
    const pixCode = parsed.data?.copypaste;

    if (!transactionId || !pixCode) {
      return jsonResponse(500, { success: false, error: "Gateway retornou resposta incompleta" });
    }

    // Salvar no Supabase (não bloqueia)
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = getSupabase();
        await supabase.from("transactions").insert({
          transaction_id: transactionId,
          amount: 65.20,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_cpf: customerCpf,
          customer_phone: customerPhone,
          status: "pending",
          brcode: pixCode
        });
      } catch (err) {
        console.error("[Supabase]", err.message);
      }
    }

    return jsonResponse(200, {
      success: true,
      pixCode,
      pix_code: pixCode,
      transaction_id: transactionId,
      status: "pending"
    });

  } catch (err) {
    return jsonResponse(502, { success: false, error: "Falha ao conectar com gateway" });
  }
};
