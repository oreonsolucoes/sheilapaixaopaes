// ============================================================
//  ADMIN — painel de gestão
// ============================================================
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const brl = n => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Auth ----------
Core.auth.onAuthStateChanged(user => {
  $("#tela-login").hidden = !!user;
  $("#tela-app").hidden = !user;
  if (user) iniciarApp();
});

$("#form-login").addEventListener("submit", async e => {
  e.preventDefault();
  const erro = $("#erro-login"); erro.textContent = "";
  try {
    await Core.auth.signInWithEmailAndPassword($("#email").value, $("#senha").value);
  } catch (err) {
    erro.textContent = "E-mail ou senha inválidos.";
  }
});
$("#sair").onclick = () => Core.auth.signOut();

// ---------- Tabs ----------
$$(".tab").forEach(t => t.onclick = () => {
  $$(".tab").forEach(x => x.classList.remove("ativa"));
  t.classList.add("ativa");
  ["pedidos", "produtos", "semanas"].forEach(name =>
    $("#painel-" + name).hidden = (name !== t.dataset.tab));
});

let APP_INICIADO = false;
function iniciarApp() {
  if (APP_INICIADO) return; APP_INICIADO = true;
  $("#cap-padrao").textContent = Core.BUSINESS.paesPorSemana;
  carregarPedidos();
  carregarProdutos();
  carregarSemanas();
}

// ============================================================
//  PEDIDOS
// ============================================================
let TODOS_PEDIDOS = [];
function carregarPedidos() {
  const filtro = $("#filtro-semana");
  Core.proximasSemanas(8).forEach(sab => {
    const o = document.createElement("option");
    o.value = sab; o.textContent = Core.rotuloSemana(sab);
    filtro.appendChild(o);
  });
  filtro.onchange = renderPedidos;

  Core.db.ref("pedidos").on("value", snap => {
    TODOS_PEDIDOS = [];
    snap.forEach(ch => {
      TODOS_PEDIDOS.push(Object.assign({ id: ch.key }, ch.val()));
    });
    TODOS_PEDIDOS.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    renderPedidos();
    renderMetricas();
  });
}

function renderMetricas() {
  const total = TODOS_PEDIDOS.length;
  const paes = TODOS_PEDIDOS.reduce((s, p) => s + Number(p.totalPaes || 0), 0);
  const receita = TODOS_PEDIDOS.reduce((s, p) => s + Number(p.totalValor || 0), 0);
  $("#metricas").innerHTML = `
    <div class="metrica"><span>${total}</span><label>pedidos</label></div>
    <div class="metrica"><span>${paes}</span><label>pães encomendados</label></div>
    <div class="metrica"><span>${brl(receita)}</span><label>receita prevista</label></div>`;
}

function renderPedidos() {
  const f = $("#filtro-semana").value;
  const lista = f ? TODOS_PEDIDOS.filter(p => p.leva === f) : TODOS_PEDIDOS;
  const box = $("#lista-pedidos");
  if (!lista.length) { box.innerHTML = '<div class="vazio">Nenhum pedido por aqui ainda.</div>'; return; }

  box.innerHTML = lista.map(p => {
    const itens = (p.itens || []).map(i =>
      `<li>${i.qtd}× ${esc(i.nome)} <span>${brl(i.qtd * i.preco)}</span></li>`).join("");
    const zap = String(p.whatsapp || "").replace(/\D/g, "");
    return `
    <article class="pedido">
      <div class="pedido-topo">
        <div>
          <strong>${esc(p.nome)}</strong>
          <a class="zap" href="https://wa.me/55${zap}" target="_blank">📱 ${esc(p.whatsapp)}</a>
        </div>
        <span class="pedido-semana">${p.diaEntrega ? Core.rotuloDia(p.diaEntrega) : (p.semana ? Core.rotuloDia(p.semana) : "—")}</span>
      </div>
      <ul class="pedido-itens">${itens}</ul>
      <div class="pedido-rodape">
        <span>${p.totalPaes} pães</span>
        <strong>${brl(p.totalValor)}</strong>
        <button class="btn-excluir-mini" data-del="${p.id}">Excluir</button>
      </div>
    </article>`;
  }).join("");

  $$("[data-del]").forEach(b => b.onclick = () => {
    if (confirm("Excluir este pedido? A vaga da semana será liberada."))
      Core.db.ref("pedidos/" + b.dataset.del).remove();
  });
}

// ============================================================
//  PRODUTOS
// ============================================================
function carregarProdutos() {
  Core.observarProdutos(prods => {
    const box = $("#lista-produtos");
    if (!prods.length) {
      box.innerHTML = '<div class="vazio">Nenhum produto. Crie o primeiro pão!</div>'; return;
    }
    box.innerHTML = prods.map(p => `
      <article class="produto-item ${p.ativo === false ? "inativo" : ""}">
        <div class="produto-emoji" data-emoji="${esc(p.emoji || "🍞")}">${p.foto
        ? `<img src="${esc(p.foto)}" alt="${esc(p.nome)}" class="produto-thumb" data-fallback>`
        : (p.emoji || "🍞")}</div>
        <div class="produto-info">
          <strong>${esc(p.nome)}</strong>
          <p>${esc(p.descricao || "")}</p>
        </div>
        <div class="produto-preco">${brl(p.preco)}</div>
        <button class="btn btn-ghost btn-pequeno" data-edit="${p.id}">Editar</button>
      </article>`).join("");
    // fallback de imagem quebrada -> emoji (sem HTML inline frágil)
    box.querySelectorAll("img[data-fallback]").forEach(img => {
      img.onerror = () => {
        img.parentElement.textContent =
        img.parentElement.getAttribute("data-emoji") || "🍞";
      };
    });
    $$("[data-edit]").forEach(b => b.onclick = () =>
      abrirModalProduto(prods.find(x => x.id === b.dataset.edit)));
  });
}

$("#novo-produto").onclick = () => abrirModalProduto(null);
$("#cancelar-produto").onclick = () => $("#modal-produto").hidden = true;

function abrirModalProduto(p) {
  $("#modal-produto-titulo").textContent = p ? "Editar produto" : "Novo produto";
  $("#p-id").value = p ? p.id : "";
  $("#p-foto").value = p ? (p.foto || "") : "";
  $("#p-emoji").value = p ? (p.emoji || "") : "🍞";
  $("#p-nome").value = p ? p.nome : "";
  $("#p-desc").value = p ? (p.descricao || "") : "";
  $("#p-preco").value = p ? p.preco : "";
  $("#p-ativo").checked = p ? p.ativo !== false : true;
  $("#excluir-produto").hidden = !p;
  $("#modal-produto").hidden = false;
}

$("#form-produto").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("#p-id").value;
  const dados = {
    foto: $("#p-foto").value.trim(),
    emoji: $("#p-emoji").value.trim() || "🍞",
    nome: $("#p-nome").value.trim(),
    descricao: $("#p-desc").value.trim(),
    preco: Number($("#p-preco").value),
    ativo: $("#p-ativo").checked
  };
  const ref = id ? Core.db.ref("produtos/" + id) : Core.db.ref("produtos").push();
  ref.update(dados).then(() => $("#modal-produto").hidden = true);
});

$("#excluir-produto").onclick = () => {
  const id = $("#p-id").value;
  if (id && confirm("Excluir este produto?"))
    Core.db.ref("produtos/" + id).remove().then(() => $("#modal-produto").hidden = true);
};

// ============================================================
//  SEMANAS (capacidade)
// ============================================================
function carregarSemanas() {
  const semanas = Core.proximasSemanas(8);
  const box = $("#lista-semanas");

  Core.db.ref("config/capacidadeSemana").on("value", capSnap => {
    const caps = capSnap.val() || {};
    Core.db.ref("pedidos").on("value", pedSnap => {
      const usoPorSemana = {};
      pedSnap.forEach(ch => {
        const v = ch.val();
        const chave = v.leva || v.semana; // compat: pedidos antigos usavam "semana"
        if (chave) usoPorSemana[chave] = (usoPorSemana[chave] || 0) + Number(v.totalPaes || 0);
      });

      box.innerHTML = semanas.map(iso => {
        const cap = caps[iso] != null ? caps[iso] : Core.BUSINESS.paesPorSemana;
        const uso = usoPorSemana[iso] || 0;
        const rest = Math.max(0, cap - uso);
        const travada = rest <= 0;
        const pct = Math.min(100, Math.round(uso / cap * 100)) || 0;
        return `
        <article class="semana-item ${travada ? "travada" : ""}">
          <div class="semana-info">
            <strong>${Core.rotuloSemana(iso)}</strong>
            <span class="badge ${travada ? "b-travada" : "b-aberta"}">
              ${travada ? "Fechada" : "Aberta"}</span>
          </div>
          <div class="barra"><div class="barra-fill" style="width:${pct}%"></div></div>
          <div class="semana-num">${uso} / ${cap} pães · ${rest} restantes</div>
          <div class="semana-edit">
            <label>Capacidade:</label>
            <input type="number" min="0" value="${cap}" data-cap="${iso}" />
          </div>
        </article>`;
      }).join("");

      $$("[data-cap]").forEach(inp => inp.onchange = () => {
        const val = Math.max(0, parseInt(inp.value) || 0);
        Core.db.ref("config/capacidadeSemana/" + inp.dataset.cap).set(val);
      });
    });
  });
}
