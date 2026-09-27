/**
 * Utilitários de interface compartilhados: formatação, avisos (toasts), modal,
 * confirmação, status da API e Monitor de API.
 */

// Escapa o texto digitado pelo usuário antes de inseri-lo no HTML (evita XSS)
function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

const Formato = {
  moeda: (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),

  duracao(minutos) {
    const m = Math.max(0, Math.floor(minutos));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const resto = m % 60;
    return resto ? `${h}h ${String(resto).padStart(2, "0")}min` : `${h}h`;
  },

  // Formato de cronômetro hh:mm:ss
  cronometro(segundos) {
    const s = Math.max(0, Math.floor(segundos));
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${ss}`;
  },

  // A API envia datas ISO sem fuso horário; o navegador as interpreta no horário local
  dataHora(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    const hoje = new Date();
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === hoje.toDateString()) return `hoje, ${hora}`;
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    if (d.toDateString() === ontem.toDateString()) return `ontem, ${hora}`;
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${hora}`;
  },

  // Máscara de celular brasileiro: (21) 99999-0000
  telefone(valor) {
    const d = String(valor).replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  },

  status: {
    "em estoque": ["Em estoque", "neutro"],
    "disponível": ["Disponível", "ok"],
    alugado: ["Alugado", "info"],
    "manutenção": ["Manutenção", "warn"],
    vendido: ["Vendido", "off"],
  },
};

// Cópia das regras de tarifa da API, usada para mostrar o valor ao vivo durante o aluguel
const Tarifa = {
  regras: { carencia_minutos: 5, primeira_hora: 5, hora_adicional: 3, teto_diario: 25, caucao: 150, prazo_horas: 24 },

  atualizar(regras) {
    if (regras) this.regras = regras;
  },

  // Valor de uso dentro da janela de 24h (mesma regra da API)
  calcular(minutos) {
    const r = this.regras;
    if (minutos <= r.carencia_minutos) return 0;
    const horas = Math.ceil(minutos / 60);
    return Math.min(r.teto_diario, r.primeira_hora + r.hora_adicional * (horas - 1));
  },

  resumo() {
    const r = this.regras;
    return `${r.carencia_minutos} min grátis · ${Formato.moeda(r.primeira_hora)} a 1ª hora · ` +
      `${Formato.moeda(r.hora_adicional)} por hora adicional · máx. ${Formato.moeda(r.teto_diario)}`;
  },
};

const UI = {
  toast(mensagem, tipo = "ok") {
    const el = document.createElement("div");
    el.className = `toast ${tipo === "ok" ? "" : tipo}`;
    el.textContent = mensagem;
    $("#toasts").appendChild(el);
    setTimeout(() => {
      el.classList.add("saindo");
      setTimeout(() => el.remove(), 300);
    }, tipo === "erro" ? 5000 : 3200);
  },

  erro(e) {
    UI.toast(e.message || String(e), "erro");
  },

  abrirModal(titulo, html) {
    $("#modal-titulo").textContent = titulo;
    $("#modal-corpo").innerHTML = html;
    $("#modal").hidden = false;
    const primeiro = $("#modal-corpo input, #modal-corpo select, #modal-corpo button");
    if (primeiro) primeiro.focus();
    return $("#modal-corpo");
  },

  fecharModal() {
    $("#modal").hidden = true;
    $("#modal-corpo").innerHTML = "";
  },

  // Confirmação baseada em Promise (evita o window.confirm, que bloqueia a página)
  confirmar(titulo, mensagem, rotuloOk = "Confirmar") {
    return new Promise((resolver) => {
      const corpo = UI.abrirModal(titulo, `
        <div class="confirmacao">
          <p>${mensagem}</p>
          <div class="acoes">
            <button class="btn btn-ghost" data-resp="nao">Cancelar</button>
            <button class="btn btn-danger" data-resp="sim">${esc(rotuloOk)}</button>
          </div>
        </div>`);
      // O listener fica no wrapper interno: #modal-corpo é reaproveitado e acumularia listeners
      $(".confirmacao", corpo).addEventListener("click", (ev) => {
        const botao = ev.target.closest("[data-resp]");
        if (!botao) return;
        UI.fecharModal();
        resolver(botao.dataset.resp === "sim");
      });
    });
  },

  statusApi(online) {
    const el = $("#api-status");
    el.classList.toggle("on", online);
    el.classList.toggle("off", !online);
    $(".txt", el).textContent = online ? "API online" : "API offline";
  },

  vazio(mensagem) {
    return `<div class="vazio">${mensagem}</div>`;
  },

  classeNivel(nivel) {
    if (nivel >= 50) return "ok";
    if (nivel >= 20) return "medio";
    return "baixo";
  },

  miniBateria(nivel) {
    if (nivel === null || nivel === undefined) return "";
    return `<span class="mini-bateria ${UI.classeNivel(nivel)}"><i style="--n:${nivel}%"></i>${nivel}%</span>`;
  },

  pillStatus(status) {
    const [rotulo, classe] = Formato.status[status] || [status, "info"];
    return `<span class="pill ${classe}">${rotulo}</span>`;
  },

  // Destaca os campos inválidos (validação HTML5) e retorna true quando o formulário é válido
  validarForm(form) {
    let valido = true;
    $$("input, select", form).forEach((campo) => {
      const ok = campo.checkValidity();
      campo.classList.toggle("invalido", !ok);
      if (!ok) valido = false;
    });
    if (!valido) UI.toast("Revise os campos destacados.", "aviso");
    return valido;
  },
};

// Painel flutuante que lista cada chamada à API (mostra qual rota cada ação usa)
const Monitor = {
  total: 0,

  registrar(metodo, caminho, status) {
    this.total += 1;
    $("#monitor-count").textContent = this.total;
    const ok = typeof status === "number" && status < 400;
    const item = document.createElement("li");
    item.className = "novo";
    item.innerHTML = `
      <span class="metodo ${metodo}">${metodo}</span>
      <span>${esc(caminho)}</span>
      <span class="${ok ? "st-ok" : "st-erro"}">${status}</span>
      <span class="hora">${new Date().toLocaleTimeString("pt-BR")}</span>`;
    $("#monitor-lista").prepend(item);
    $$("#monitor-lista li").slice(60).forEach((li) => li.remove());
  },

  iniciar() {
    $("#monitor-toggle").addEventListener("click", () => $("#monitor").classList.toggle("aberto"));
    $("#monitor-limpar").addEventListener("click", () => {
      $("#monitor-lista").innerHTML = "";
      this.total = 0;
      $("#monitor-count").textContent = 0;
    });
  },
};

// Debounce simples para os campos de busca
function debounce(fn, espera = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), espera);
  };
}
