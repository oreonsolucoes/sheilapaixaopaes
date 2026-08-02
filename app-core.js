// ============================================================
//  NÚCLEO COMPARTILHADO — Sheilíssima
//  Firebase + regras de semana/entrega + disponibilidade
// ============================================================
(function () {
  const { firebaseConfig, WHATSAPP_WEBHOOK_URL, BUSINESS } = window.__SHEILISSIMA__;

  // Aviso claro enquanto o Firebase não estiver configurado
  if (!firebaseConfig || firebaseConfig.apiKey === "COLE_AQUI") {
    console.warn("Firebase ainda não configurado — edite firebase-config.js.");
    window.addEventListener("DOMContentLoaded", () => {
      const aviso = document.createElement("div");
      aviso.style.cssText =
        "position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#A6303B;" +
        "color:#fff;padding:12px 18px;font:600 14px Inter,sans-serif;text-align:center";
      aviso.textContent =
        "⚙️ Configure o Firebase em firebase-config.js para ativar pedidos, produtos e painel.";
      document.body.appendChild(aviso);
    });
  }

  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  const auth = firebase.auth();

  // ---------- Datas / semanas de entrega ----------
  // Uma "semana de entrega" é identificada pela data (ISO) da SEGUNDA de entrega.
  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
           "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseYmd(s) {
    const [y, m, dd] = s.split("-").map(Number);
    return new Date(y, m - 1, dd);
  }
  // Próxima segunda de entrega para uma data de pedido.
  // Regra: pedidos de domingo a sexta contam para a segunda seguinte.
  // Se o pedido cair no sábado/domingo, entra para a segunda da PRÓXIMA semana,
  // pois o sábado é o dia de confecção do lote já fechado.
  function proximaSegundaDeEntrega(base = new Date()) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const dow = d.getDay(); // 0 dom ... 6 sáb
    let add;
    if (dow === 0) add = 1;                 // domingo -> segunda de amanhã
    else if (dow >= 1 && dow <= 5) add = 8 - dow; // seg-sex -> próxima segunda
    else add = 2;                            // sábado -> segunda +2 (lote já em confecção)
    d.setDate(d.getDate() + add);
    return d;
  }
  // Lista as próximas N segundas selecionáveis a partir de hoje.
  function proximasSegundas(n = 8) {
    const out = [];
    let seg = proximaSegundaDeEntrega(new Date());
    for (let i = 0; i < n; i++) {
      out.push(ymd(seg));
      seg = new Date(seg); seg.setDate(seg.getDate() + 7);
    }
    return out;
  }
  function rotuloSemana(iso) {
    const d = parseYmd(iso);
    const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return "Segunda, " + d.getDate() + " de " + meses[d.getMonth()] + ".";
  }

  // ---------- Disponibilidade por semana ----------
  // Retorna { usados, capacidade, restantes, travada } observando em tempo real.
  function observarSemana(iso, cb) {
    db.ref("pedidos").orderByChild("semana").equalTo(iso).on("value", snap => {
      let usados = 0;
      snap.forEach(ch => { usados += Number(ch.val().totalPaes || 0); });
      db.ref("config/capacidadeSemana/" + iso).once("value").then(capSnap => {
        const capacidade = capSnap.exists() ? Number(capSnap.val()) : BUSINESS.paesPorSemana;
        const restantes = Math.max(0, capacidade - usados);
        cb({ usados, capacidade, restantes, travada: restantes <= 0 });
      });
    });
  }
  function lerSemanaUmaVez(iso) {
    return db.ref("pedidos").orderByChild("semana").equalTo(iso).once("value").then(snap => {
      let usados = 0;
      snap.forEach(ch => { usados += Number(ch.val().totalPaes || 0); });
      return db.ref("config/capacidadeSemana/" + iso).once("value").then(capSnap => {
        const capacidade = capSnap.exists() ? Number(capSnap.val()) : BUSINESS.paesPorSemana;
        const restantes = Math.max(0, capacidade - usados);
        return { usados, capacidade, restantes, travada: restantes <= 0 };
      });
    });
  }

  // ---------- Produtos ----------
  function observarProdutos(cb) {
    db.ref("produtos").on("value", snap => {
      const arr = [];
      snap.forEach(ch => {
        arr.push(Object.assign({ id: ch.key }, ch.val()));
        // NÃO retornar valor: se a callback do forEach do Firebase retorna truthy,
        // a iteração para no primeiro item (por isso aparecia só 1 produto).
      });
      cb(arr);
    });
  }

  // ---------- Criar pedido (transação para respeitar a trava) ----------
  async function criarPedido(pedido) {
    const semana = pedido.semana;
    const estado = await lerSemanaUmaVez(semana);
    if (estado.travada) throw new Error("SEMANA_TRAVADA");
    if (pedido.totalPaes > estado.restantes)
      throw new Error("SEM_VAGAS:" + estado.restantes);

    const ref = db.ref("pedidos").push();
    const registro = Object.assign({}, pedido, {
      criadoEm: firebase.database.ServerValue.TIMESTAMP,
      status: "confirmado"
    });
    await ref.set(registro);

    // Dispara webhook do WhatsApp (não bloqueia o fluxo em caso de erro)
    if (WHATSAPP_WEBHOOK_URL) {
      try {
        await fetch(WHATSAPP_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ref.key, ...registro,
            rotuloSemana: rotuloSemana(semana) })
        });
      } catch (e) { console.warn("Webhook falhou:", e); }
    }
    return ref.key;
  }

  window.Core = {
    db, auth, BUSINESS,
    ymd, parseYmd, proximasSegundas, rotuloSemana,
    observarSemana, lerSemanaUmaVez, observarProdutos, criarPedido
  };
})();
