// ============================================================
//  CONFIGURAÇÃO DO FIREBASE — Sheilíssima
//  1. Crie um projeto em https://console.firebase.google.com
//  2. Ative "Realtime Database" e "Authentication > E-mail/senha"
//  3. Cole abaixo o objeto firebaseConfig do seu projeto
//  4. Crie um usuário admin em Authentication > Users
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBgA3GpKLkU6bHUCI-_5ktrWQrNWQO4vds",
  authDomain: "sheila-paixao-paes.firebaseapp.com",
  projectId: "sheila-paixao-paes",
  databaseURL: "https://sheila-paixao-paes-default-rtdb.firebaseio.com/",
  storageBucket: "sheila-paixao-paes.firebasestorage.app",
  messagingSenderId: "11075517789",
  appId: "1:11075517789:web:e7f57cce26eacfb873bcb4"
};

// ------------------------------------------------------------
//  WEBHOOK DE WHATSAPP
//  Cole a URL do seu webhook (Make/Zapier/n8n/API oficial).
//  Ao criar um pedido, o site envia um POST em JSON para esta URL
//  com os dados do cliente e do pedido, para você disparar a
//  mensagem de confirmação no WhatsApp da pessoa.
//  Deixe "" (vazio) para desativar o disparo automático.
// ------------------------------------------------------------
const WHATSAPP_WEBHOOK_URL = "";

const BUSINESS = {
  paesPorSemana: 10,          // capacidade de confecção por semana
  fechaPedidosNo: 5,          // 5 = sexta (0=dom ... 6=sáb). Trava ao atingir a capacidade entre dom e sex
  entregaNoDia: 1,            // 1 = segunda-feira
  nomeLoja: "Sheila Paixão",
  slogan: "Feito à mão, feito pra você",
  whatsappContato: "5511976761111"   // número da loja (só dígitos, com 55). Usado no botão flutuante.
};

window.__SHEILISSIMA__ = { firebaseConfig, WHATSAPP_WEBHOOK_URL, BUSINESS };
