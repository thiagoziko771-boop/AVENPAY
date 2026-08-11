const CPF_API_BASE  = "https://api.amnesiatecnologia.lat/";
const CPF_API_TOKEN = "4c80cd47-d9d5-4672-a301-b9b8741fc293";

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

  const cpfRaw = event.queryStringParameters?.cpf || "";
  const cpf = cpfRaw.replace(/\D/g, "").slice(0, 11);
  if (!cpf) {
    return jsonResponse(400, { status: 400, statusMsg: "Informe o CPF" });
  }

  const apiUrl = `${CPF_API_BASE}?token=${CPF_API_TOKEN}&cpf=${cpf}`;

  let apiResp;
  let text = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      apiResp = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      text = await apiResp.text();
      if (apiResp.ok) break;
    } catch (error) {
      if (attempt === 3) {
        return jsonResponse(502, {
          status: 502,
          statusMsg: "Falha ao consultar CPF",
          details: String(error),
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    return jsonResponse(502, {
      status: 502,
      statusMsg: "Resposta invalida da API de CPF",
      details: text.slice(0, 200),
    });
  }

  // Resposta da API: { DADOS: { cpf, nome, nome_mae, data_nascimento, sexo } }
  const dados = data?.DADOS || data?.data || data || {};

  if (!dados.nome || String(dados.nome).trim() === "") {
    return jsonResponse(404, { status: 404, statusMsg: "CPF nao encontrado" });
  }

  return jsonResponse(200, {
    DADOS: {
      cpf:              cpf,
      nome:             dados.nome             || "",
      nome_mae:         dados.nome_mae         || "",
      data_nascimento:  dados.data_nascimento  || "",
      sexo:             dados.sexo             || "",
    },
  });
};
