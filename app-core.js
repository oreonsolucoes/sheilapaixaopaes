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

  // ---------- Datas / levas de entrega ----------
  // Uma "leva" é assada no SÁBADO e entregue em sáb, dom OU seg.
  // A leva é identificada pela data ISO do SÁBADO (âncora / dia que assa).
  // Corte: pedidos até DOMINGO entram na leva deste fim de semana;
  //        a partir de SEGUNDA, vão para a leva do próximo sábado.
  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseYmd(s) {
    const [y, m, dd] = s.split("-").map(Number);
    return new Date(y, m - 1, dd);
  }
  // Sábado âncora da leva atual/próxima para uma data de pedido.
  function sabadoDaLeva(base = new Date()) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const dow = d.getDay(); // 0 dom, 1 seg ... 6 sáb
    if (dow === 6) return d;                                   // sábado -> hoje
    if (dow === 0) { d.setDate(d.getDate() - 1); return d; }   // domingo -> sábado de ontem (leva atual)
    d.setDate(d.getDate() + (6 - dow));                        // seg-sex -> próximo sábado
    return d;
  }
  // Os 3 dias de entrega de uma leva (sáb, dom, seg), a partir do sábado âncora.
  function diasDaLeva(sabIso) {
    const sab = parseYmd(sabIso);
    const dom = new Date(sab); dom.setDate(sab.getDate() + 1);
    const seg = new Date(sab); seg.setDate(sab.getDate() + 2);
    return [ymd(sab), ymd(dom), ymd(seg)];
  }
  // Lista as próximas N levas (sábados âncora) a partir de hoje.
  function proximasSemanas(n = 8) {
    const out = [];
    let sab = sabadoDaLeva(new Date());
    for (let i = 0; i < n; i++) {
      out.push(ymd(sab));
      sab = new Date(sab); sab.setDate(sab.getDate() + 7);
    }
    return out;
  }
  const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  // Rótulo de um DIA de entrega específico (ex.: "Domingo, 3 de ago.")
  function rotuloDia(iso) {
    const d = parseYmd(iso);
    return NOMES_DIA[d.getDay()] + ", " + d.getDate() + " de " + MESES[d.getMonth()] + ".";
  }
  // Rótulo de uma LEVA (pelo sábado âncora) — ex.: "Leva de 1–3 de ago."
  function rotuloSemana(sabIso) {
    const [s, , seg] = diasDaLeva(sabIso);
    const ds = parseYmd(s), dg = parseYmd(seg);
    if (ds.getMonth() === dg.getMonth())
      return "Leva de " + ds.getDate() + "–" + dg.getDate() + " de " + MESES[ds.getMonth()] + ".";
    return "Leva de " + ds.getDate() + " " + MESES[ds.getMonth()] + " a " +
      dg.getDate() + " " + MESES[dg.getMonth()] + ".";
  }

  // ---------- Disponibilidade por leva ----------
  // A capacidade (20 pães) é da LEVA inteira, somando entregas de sáb+dom+seg.
  // Cada pedido guarda o campo "leva" = sábado âncora.
  function observarSemana(leva, cb) {
    db.ref("pedidos").orderByChild("leva").equalTo(leva).on("value", snap => {
      let usados = 0;
      snap.forEach(ch => { usados += Number(ch.val().totalPaes || 0); });
      db.ref("config/capacidadeSemana/" + leva).once("value").then(capSnap => {
        const capacidade = capSnap.exists() ? Number(capSnap.val()) : BUSINESS.paesPorSemana;
        const restantes = Math.max(0, capacidade - usados);
        cb({ usados, capacidade, restantes, travada: restantes <= 0 });
      });
    });
  }
  function lerSemanaUmaVez(leva) {
    return db.ref("pedidos").orderByChild("leva").equalTo(leva).once("value").then(snap => {
      let usados = 0;
      snap.forEach(ch => { usados += Number(ch.val().totalPaes || 0); });
      return db.ref("config/capacidadeSemana/" + leva).once("value").then(capSnap => {
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

  // ---------- Criar pedido (respeita a trava da leva) ----------
  async function criarPedido(pedido) {
    const leva = pedido.leva;
    const estado = await lerSemanaUmaVez(leva);
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
          body: JSON.stringify({
            id: ref.key, ...registro,
            rotuloEntrega: rotuloDia(pedido.diaEntrega),
            rotuloLeva: rotuloSemana(leva)
          })
        });
      } catch (e) { console.warn("Webhook falhou:", e); }
    }
    return ref.key;
  }

  window.Core = {
    db, auth, BUSINESS,
    ymd, parseYmd, sabadoDaLeva, diasDaLeva, proximasSemanas,
    rotuloDia, rotuloSemana,
    observarSemana, lerSemanaUmaVez, observarProdutos, criarPedido
  };
})();
