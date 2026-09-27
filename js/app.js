/**
 * Inicialização da SPA: navegação entre telas, relógio dos aluguéis em andamento e eventos do modal.
 */

// A cada segundo atualiza cronômetros e valor acumulado (data-inicio) e a contagem do prazo de 24h (data-prazo)
const Relogio = {
  tick() {
    const agora = Date.now();
    $$("[data-inicio]").forEach((el) => {
      const segundos = (agora - new Date(el.dataset.inicio).getTime()) / 1000;
      el.textContent = el.dataset.formato === "valor"
        ? Formato.moeda(Tarifa.calcular(Math.floor(segundos / 60)))
        : Formato.cronometro(segundos);
    });
    $$("[data-prazo]").forEach((el) => {
      const segundos = (new Date(el.dataset.prazo).getTime() - agora) / 1000;
      el.textContent = segundos > 0 ? `vence em ${Formato.cronometro(segundos)}` : "prazo esgotado";
      el.classList.toggle("urgente", segundos < 2 * 3600);
    });
  },
  iniciar() {
    setInterval(() => this.tick(), 1000);
  },
};

const App = {
  views: { painel: Painel, estacoes: Estacoes, totem: Totem, inventario: Inventario },
  atual: "painel",

  irPara(nome) {
    if (!this.views[nome]) nome = "painel";
    this.atual = nome;
    $$(".view").forEach((v) => v.classList.toggle("ativa", v.id === `view-${nome}`));
    $$(".nav-item").forEach((b) => b.classList.toggle("ativo", b.dataset.view === nome));
    if (location.hash !== `#${nome}`) history.replaceState(null, "", `#${nome}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    this.views[nome].carregar();
  },

  iniciar() {
    Object.values(this.views).forEach((v) => v.iniciar());
    Monitor.iniciar();
    Relogio.iniciar();

    // Navegação: botões do menu lateral e qualquer elemento com data-goto
    document.addEventListener("click", (ev) => {
      const nav = ev.target.closest("[data-view]");
      if (nav) return this.irPara(nav.dataset.view);
      const atalho = ev.target.closest("[data-goto]");
      if (atalho) {
        UI.fecharModal();
        this.irPara(atalho.dataset.goto);
      }
      if (ev.target.closest("[data-fechar]")) UI.fecharModal();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !$("#modal").hidden) UI.fecharModal();
    });

    // Mantém o painel atualizado enquanto estiver visível
    setInterval(() => {
      if (this.atual === "painel" && $("#modal").hidden) Painel.carregar();
    }, 30000);

    this.irPara(location.hash.replace("#", "") || "painel");
  },
};

document.addEventListener("DOMContentLoaded", () => App.iniciar());
