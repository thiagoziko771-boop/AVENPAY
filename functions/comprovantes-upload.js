const { getSupabase } = require("./lib/supabase");

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

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    console.error("[Upload] Parse error:", err.message);
  }

  const transactionId = body.transaction_id || body.id || null;
  const cpf = body.customer_cpf || body.cpf || null;
  const nome = body.customer_name || body.nome || null;
  const email = body.customer_email || null;
  const base64 = body.arquivo || null;
  const filename = body.filename || "comprovante.png";

  if (!transactionId || !base64) {
    return jsonResponse(400, { 
      success: false, 
      error: "transaction_id e arquivo são obrigatórios" 
    });
  }

  try {
    const supabase = getSupabase();
    
    // Converte base64 para buffer
    const base64Data = base64.split(",")[1] || base64;
    const buffer = Buffer.from(base64Data, "base64");
    
    // Nome do arquivo único
    const filePath = `comprovantes/${transactionId}/${filename}`;
    
    // Faz upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("comprovantes")
      .upload(filePath, buffer, {
        contentType: "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Upload] Storage error:", uploadError);
      throw uploadError;
    }

    // Gera URL pública do arquivo
    const { data: urlData } = supabase.storage
      .from("comprovantes")
      .getPublicUrl(filePath);
    
    const fileUrl = urlData?.publicUrl || null;

    // Registra no banco de dados
    const { error: dbError } = await supabase.from("comprovantes").insert({
      transaction_id: transactionId,
      cpf: cpf,
      nome: nome,
      email: email,
      arquivo_url: fileUrl,
      filename: filename,
      status: "pendente",
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("[Upload] Database error:", dbError);
      throw dbError;
    }

    console.log(`[Upload] ✓ Arquivo enviado para ${transactionId}`);

    return jsonResponse(200, { 
      success: true,
      url: fileUrl,
      message: "Comprovante enviado com sucesso"
    });

  } catch (err) {
    console.error("[Upload] Error:", err.message);
    return jsonResponse(500, { 
      success: false, 
      error: "Erro ao enviar comprovante: " + String(err.message)
    });
  }
};
