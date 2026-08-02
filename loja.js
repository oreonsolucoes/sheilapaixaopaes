// ============================================================
//  LOJA — página de encomendas
// ============================================================
let PRODUTOS = [];

const $ = s => document.querySelector(s);
const brl = n => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

// ---------- Produtos ----------
Core.observarProdutos(prods => {
  PRODUTOS = prods.filter(p => p.ativo !== false);
  renderProdutos();
  // Garante ao menos um bloco de item já com os produtos disponíveis
  if (!document.querySelector(".bloco")) addBloco();
  else atualizarSelectsProdutos();
});

function renderProdutos() {
  const grade = $("#grade-produtos");
  if (!PRODUTOS.length) {
    grade.innerHTML = '<div class="carregando">Ainda não há pães cadastrados. Volte em breve!</div>';
    return;
  }
  grade.innerHTML = PRODUTOS.map(p => `
    <article class="card">
      <div class="card-topo ${p.foto ? "tem-foto" : ""}" data-emoji="${escape(p.emoji || "🍞")}">
        ${p.foto
      ? `<img src="${escape(p.foto)}" alt="${escape(p.nome)}" class="card-img" loading="lazy" data-fallback>`
      : (p.emoji || "🍞")}
      </div>
      <div class="card-corpo">
        <h3>${escape(p.nome)}</h3>
        <p>${escape(p.descricao || "")}</p>
        <div class="card-preco">${brl(p.preco)}</div>
      </div>
    </article>`).join("");
  // fallback de imagem quebrada -> emoji
  grade.querySelectorAll("img[data-fallback]").forEach(img => {
    img.onerror = () => {
      const topo = img.parentElement;
      topo.classList.remove("tem-foto");
      topo.textContent = topo.getAttribute("data-emoji") || "🍞";
    };
  });
}

// ---------- Semanas de entrega ----------
const semanaSel = $("#semana");
Core.proximasSegundas(8).forEach(iso => {
  const o = document.createElement("option");
  o.value = iso;
  o.textContent = Core.rotuloSemana(iso);
  semanaSel.appendChild(o);
});
semanaSel.addEventListener("change", monitorarSemana);
let pararMonitor = null;

function monitorarSemana() {
  const iso = semanaSel.value;
  const el = $("#status-semana");
  Core.lerSemanaUmaVez(iso).then(e => {
    if (e.travada) {
      el.className = "status-semana travada";
      el.textContent = "Semana cheia — escolha outra data.";
    } else {
      el.className = "status-semana ok";
      el.textContent = `${e.restantes} de ${e.capacidade} pães disponíveis nesta semana.`;
    }
    recalcular();
  });
}

// ---------- Blocos de itens ----------
function addBloco() {
  const wrap = $("#blocos");
  const div = document.createElement("div");
  div.className = "bloco";
  div.innerHTML = `
    <select class="bloco-produto"></select>
    <div class="qtd">
      <button type="button" class="qtd-btn menos">−</button>
      <input type="number" class="bloco-qtd" value="1" min="1" />
      <button type="button" class="qtd-btn mais">+</button>
    </div>
    <button type="button" class="bloco-remove" title="Remover">✕</button>`;
  wrap.appendChild(div);
  preencherSelect(div.querySelector(".bloco-produto"));

  div.querySelector(".menos").onclick = () => stepQtd(div, -1);
  div.querySelector(".mais").onclick = () => stepQtd(div, 1);
  div.querySelector(".bloco-qtd").oninput = recalcular;
  div.querySelector(".bloco-produto").onchange = recalcular;
  div.querySelector(".bloco-remove").onclick = () => {
    if (document.querySelectorAll(".bloco").length > 1) { div.remove(); recalcular(); }
  };
  recalcular();
}
function stepQtd(div, delta) {
  const inp = div.querySelector(".bloco-qtd");
  inp.value = Math.max(1, (parseInt(inp.value) || 1) + delta);
  recalcular();
}
function preencherSelect(sel) {
  sel.innerHTML = PRODUTOS.map(p =>
    `<option value="${p.id}">${escape(p.nome)} — ${brl(p.preco)}</option>`).join("");
}
function atualizarSelectsProdutos() {
  document.querySelectorAll(".bloco-produto").forEach(sel => {
    const atual = sel.value;
    preencherSelect(sel);
    if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
  });
  recalcular();
}
$("#add-bloco").onclick = addBloco;

// ---------- Recalcular totais ----------
function recalcular() {
  let totalPaes = 0, totalValor = 0;
  document.querySelectorAll(".bloco").forEach(b => {
    const id = b.querySelector(".bloco-produto").value;
    const qtd = parseInt(b.querySelector(".bloco-qtd").value) || 0;
    const p = PRODUTOS.find(x => x.id === id);
    if (p) { totalPaes += qtd; totalValor += qtd * Number(p.preco); }
  });
  $("#total-paes").textContent = totalPaes;
  $("#total-valor").textContent = brl(totalValor);
  return { totalPaes, totalValor };
}

// ---------- Envio ----------
$("#form-pedido").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#enviar"), msg = $("#msg-form");
  msg.textContent = "";

  const nome = $("#nome").value.trim();
  const whats = $("#whats").value.trim();
  const semana = semanaSel.value;
  const itens = [];
  document.querySelectorAll(".bloco").forEach(b => {
    const id = b.querySelector(".bloco-produto").value;
    const qtd = parseInt(b.querySelector(".bloco-qtd").value) || 0;
    const p = PRODUTOS.find(x => x.id === id);
    if (p && qtd > 0)
      itens.push({ produtoId: id, nome: p.nome, preco: Number(p.preco), qtd });
  });

  const { totalPaes, totalValor } = recalcular();
  if (!itens.length || totalPaes < 1) { msg.textContent = "Adicione ao menos um pão."; return; }

  btn.disabled = true; btn.textContent = "Enviando…";
  try {
    const pedido = { nome, whatsapp: whats, semana, itens, totalPaes, totalValor };
    await Core.criarPedido(pedido);
    $("#modal-msg").innerHTML =
      `Obrigada, <strong>${escape(nome)}</strong>! Sua encomenda de <strong>${totalPaes} pães</strong> ` +
      `para <strong>${Core.rotuloSemana(semana)}</strong> está confirmada. ` +
      `Você recebe os detalhes no WhatsApp.`;
    $("#modal").hidden = false;
  } catch (err) {
    if (String(err.message).startsWith("SEMANA_TRAVADA"))
      msg.textContent = "Essa semana acabou de fechar. Escolha outra data.";
    else if (String(err.message).startsWith("SEM_VAGAS:"))
      msg.textContent = `Restam apenas ${err.message.split(":")[1]} pães nessa semana. Ajuste a quantidade.`;
    else msg.textContent = "Não foi possível enviar. Tente novamente.";
    btn.disabled = false; btn.textContent = "Confirmar encomenda";
    monitorarSemana();
  }
});

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Carrossel de banners ----------
(function () {
  const trilho = document.getElementById("carrossel-trilho");
  if (!trilho) return;
  const slides = [...trilho.children];
  const pontos = document.getElementById("carrossel-pontos");
  let i = 0, timer;

  slides.forEach((_, idx) => {
    const b = document.createElement("button");
    b.className = "ponto" + (idx === 0 ? " ativo" : "");
    b.setAttribute("aria-label", "Ir ao banner " + (idx + 1));
    b.onclick = () => ir(idx);
    pontos.appendChild(b);
  });

  function ir(n) {
    i = (n + slides.length) % slides.length;
    trilho.style.transform = `translateX(-${i * 100}%)`;
    [...pontos.children].forEach((p, idx) => p.classList.toggle("ativo", idx === i));
    reiniciar();
  }
  function reiniciar() {
    clearInterval(timer);
    timer = setInterval(() => ir(i + 1), 5000);
  }
  document.getElementById("car-dir").onclick = () => ir(i + 1);
  document.getElementById("car-esq").onclick = () => ir(i - 1);
  reiniciar();
})();

// ---------- Scroll reveal ----------
(function () {
  const alvos = document.querySelectorAll(".reveal");
  if (!alvos.length) return;
  if (!("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    alvos.forEach(el => el.classList.add("visivel"));
    return;
  }
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  alvos.forEach(el => io.observe(el));
})();

// ---------- WhatsApp flutuante ----------
(function () {
  const num = (Core.BUSINESS.whatsappContato || "").replace(/\D/g, "");
  const el = document.getElementById("wpp-flutuante");
  if (el && num) {
    el.href = "https://wa.me/" + num +
      "?text=" + encodeURIComponent("Olá! Vim pelo site da Sheila Paixão 🍞");
  } else if (el) {
    el.style.display = "none";
  }
})();

// inicia monitor da primeira semana
setTimeout(monitorarSemana, 300);