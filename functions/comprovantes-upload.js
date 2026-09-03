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

  console.log("[Upload] Recebido:", { transactionId, cpf, nome, email, hasBase64: !!base64, filename });

  if (!transactionId || !base64) {
    console.error("[Upload] Erro: faltam transactionId ou arquivo", { transactionId: !!transactionId, base64: !!base64 });
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
    
    console.log("[Upload] Buffer criado, tamanho:", buffer.length);
    
    // Nome do arquivo único - sem subfolder complexa
    const filePath = `${transactionId}_${Date.now()}_${filename}`;
    
    console.log("[Upload] Tentando fazer upload para:", filePath);
    
    // Faz upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("comprovantes")
      .upload(filePath, buffer, {
        contentType: "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Upload] Erro no Storage:", uploadError);
      throw uploadError;
    }

    console.log("[Upload] ✓ Arquivo salvo no Storage");

    // Gera URL pública do arquivo
    const { data: urlData } = supabase.storage
      .from("comprovantes")
      .getPublicUrl(filePath);
    
    const fileUrl = urlData?.publicUrl || null;
    
    console.log("[Upload] URL pública:", fileUrl);

    // Registra no banco de dados (não bloqueia se falhar)
    try {
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
        console.warn("[Upload] Aviso ao salvar no banco:", dbError.message);
        // NÃO THROW - continua mesmo assim
      } else {
        console.log("[Upload] ✓ Registro no banco criado");
      }
    } catch (dbErr) {
      console.warn("[Upload] Erro ao salvar no banco (não bloqueia):", dbErr.message);
      // Continua mesmo assim - o arquivo já está no Storage
    }

    console.log(`[Upload] ✓ Comprovante salvo com sucesso para ${transactionId}`);

    return jsonResponse(200, { 
      success: true,
      url: fileUrl,
      message: "Comprovante enviado com sucesso"
    });

  } catch (err) {
    console.error("[Upload] Erro geral:", err.message);
    return jsonResponse(500, { 
      success: false, 
      error: "Erro ao enviar comprovante: " + String(err.message)
    });
  }
};
