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

function formatCpf(cpf) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
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

  let dados = { cpf, nome: "", nome_mae: "", data_nascimento: "", sexo: "" };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const apiResp = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await apiResp.text();
    const data = JSON.parse(text);
    const root = data?.DADOS || data?.data || data || {};

    // Preenche se a API retornou dados
    if (root.nome && String(root.nome).trim() !== "") {
      dados = {
        cpf,
        nome:            root.nome            || "",
        nome_mae:        root.nome_mae        || "",
        data_nascimento: root.data_nascimento || "",
        sexo:            root.sexo            || "",
      };
    }
  } catch (_) {
    // Se a API falhar, continua com dados vazios — o funil pede manual
  }

  // Sempre retorna 200 — nunca bloqueia o funil
  // Se nome vier vazio, o frontend vai para manualEntry mas o CPF já está salvo
  return jsonResponse(200, { DADOS: dados });
};
