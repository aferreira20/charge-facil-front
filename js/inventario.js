/**
 * Tela Inventário.
 * Em operação: GET /powerbanks (filtros), GET /estacoes (opções do filtro),
 *              POST /powerbanks (nova unidade em estoque), PATCH /powerbanks/{id}/status
 *              e DELETE /powerbanks/{id}.
 * Vendidos:    GET /powerbanks?status=vendido&busca=<código, comprador ou telefone>.
 */
const Inventario = {
  aba: "operacao",
  lista: [],
  seq: 0, // evita exibir respostas fora de ordem quando os filtros mudam rápido

  iniciar() {
    $("#btn-novo-powerbank").addEventListener("click", () => this.abrirNovo());

    $("#abas-inventario").addEventListener("click", (ev) => {
      const aba = ev.target.closest("[data-aba]");
      if (aba) this.trocarAba(aba.dataset.aba);
    });

    $("#busca-codigo").addEventListener("input", debounce(() => this.carregarOperacao()));
    $("#filtro-estacao").addEventListener("change", () => this.carregarOperacao());
    $("#filtro-status").addEventListener("change", () => this.carregarOperacao());
    $("#busca-vendidos").addEventListener("input", debounce(() => this.carregarVendidos()));

    $("#lista-operacao").addEventListener("click", (ev) => {
      const botao = ev.target.closest("[data-acao]");
      if (botao) this.acao(botao.dataset.acao, Number(botao.dataset.id));
    });
  },

  trocarAba(aba) {
    this.aba = aba;
    $$("#abas-inventario .tab").forEach((t) => t.classList.toggle("ativo", t.dataset.aba === aba));
    $$("#view-inventario .aba").forEach((el) => el.classList.toggle("ativa", el.id === `aba-${aba}`));
    this.carregar();
  },

  carregar() {
    return this.aba === "vendidos" ? this.carregarVendidos() : this.carregarOperacao(true);
  },

  async carregarFiltroEstacoes() {
    const select = $("#filtro-estacao");
    const atual = select.value;
    const { estacoes } = await Api.listarEstacoes();
    select.innerHTML = `<option value="">Todas as estações</option>` +
      estacoes.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join("");
    if (estacoes.some((e) => String(e.id) === atual)) select.value = atual;
  },

  // ---------- Frota em operação ----------

  async carregarOperacao(atualizarFiltro = false) {
    const alvo = $("#lista-operacao");
    const pedido = ++this.seq;
    try {
      if (atualizarFiltro) await this.carregarFiltroEstacoes();
      const { powerbanks } = await Api.listarPowerBanks({
        estacao_id: $("#filtro-estacao").value,
        status: $("#filtro-status").value,
        busca: $("#busca-codigo").value.trim(),
      });
      if (pedido !== this.seq) return; // já existe uma requisição mais recente
      this.lista = powerbanks;
      $("#contador-operacao").textContent = `${powerbanks.length} power bank${powerbanks.length === 1 ? "" : "s"}`;
      alvo.innerHTML = powerbanks.length
        ? powerbanks.map((pb) => this.cardOperacao(pb)).join("")
        : UI.vazio("Nenhum power bank com esses filtros.");
    } catch (e) {
      UI.erro(e);
      alvo.innerHTML = UI.vazio("Não foi possível carregar o inventário.");
    }
  },

  cardOperacao(pb) {
    const alugado = pb.status === "alugado";
    const manut = pb.status === "manutenção";
    const estoque = pb.status === "em estoque";
    let local = `📍 ${esc(pb.estacao_nome || "—")}`;
    if (alugado) local = "📱 Em uso por um cliente";
    if (estoque) local = "📦 No estoque · aloque pelos Detalhes da estação";
    return `
      <article class="pb ${estoque ? "estoque" : ""}">
        <div class="pb-topo">
          <span class="pb-codigo">${esc(pb.codigo)}</span>
          ${UI.pillStatus(pb.status)}
        </div>
        <div class="pb-local">${local}</div>
        <div class="nivel ${UI.classeNivel(pb.nivel_bateria)}"><span style="width:${pb.nivel_bateria}%"></span></div>
        <div class="pb-rodape">
          <span>${pb.nivel_bateria}% · ${pb.capacidade_mah / 1000}k mAh</span>
          <span class="pb-acoes">
            <button class="icone-btn" data-acao="${manut ? "liberar" : "manutencao"}" data-id="${pb.id}"
              title="${manut ? "Liberar para uso" : "Enviar para manutenção"}" ${alugado || estoque ? "disabled" : ""}>${manut ? "✓" : "🔧"}</button>
            <button class="icone-btn perigo" data-acao="remover" data-id="${pb.id}" title="Remover da frota" ${alugado ? "disabled" : ""}>✕</button>
          </span>
        </div>
      </article>`;
  },

  // Nova unidade: entra em estoque e o código é gerado pela API
  abrirNovo() {
    const corpo = UI.abrirModal("Adicionar power bank", `
      <form class="form" id="form-novo-pb" novalidate>
        <label>Capacidade
          <select class="input" name="capacidade_mah">
            <option value="5000">5.000 mAh</option>
            <option value="10000" selected>10.000 mAh</option>
            <option value="20000">20.000 mAh</option>
          </select>
        </label>
        <p class="nota">O código (CF-00XX) é gerado automaticamente. O power bank entra no inventário
          <strong>em estoque</strong>, com 100% de carga, e é alocado pelos Detalhes de uma estação.</p>
        <div class="acoes">
          <button type="button" class="btn btn-ghost" data-fechar>Cancelar</button>
          <button type="submit" class="btn btn-primary">Adicionar ao estoque</button>
        </div>
      </form>`);

    $("#form-novo-pb", corpo).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        const pb = await Api.adicionarPowerBank({ capacidade_mah: Number(ev.target.capacidade_mah.value) });
        UI.fecharModal();
        UI.toast(`${pb.codigo} adicionado ao estoque.`);
        if (this.aba !== "operacao") this.trocarAba("operacao");
        else this.carregarOperacao();
      } catch (e) {
        UI.erro(e);
      }
    });
  },

  async acao(tipo, id) {
    const pb = this.lista.find((p) => p.id === id);
    try {
      if (tipo === "remover") {
        const ok = await UI.confirmar("Remover power bank",
          `Remover <strong>${esc(pb.codigo)}</strong> da frota? Esta ação não pode ser desfeita.`, "Remover");
        if (!ok) return;
        await Api.removerPowerBank(id);
        UI.toast(`${pb.codigo} removido da frota.`);
      } else {
        const status = tipo === "liberar" ? "disponível" : "manutenção";
        await Api.alterarStatusPowerBank(id, status);
        UI.toast(`${pb.codigo} ${status === "manutenção" ? "enviado para manutenção" : "liberado para uso"}.`);
      }
      this.carregarOperacao();
    } catch (e) {
      UI.erro(e);
    }
  },

  // ---------- Vendidos (não devolvidos em 24h) ----------

  async carregarVendidos() {
    const alvo = $("#lista-vendidos");
    const pedido = ++this.seq;
    try {
      const { powerbanks } = await Api.listarPowerBanks({
        status: "vendido",
        busca: $("#busca-vendidos").value.trim(),
      });
      if (pedido !== this.seq) return;
      const total = powerbanks.reduce((soma, pb) => soma + (pb.venda ? pb.venda.valor : 0), 0);
      $("#contador-vendidos").textContent =
        `${powerbanks.length} vendido${powerbanks.length === 1 ? "" : "s"} · ${Formato.moeda(total)} em franquias`;
      alvo.innerHTML = powerbanks.length
        ? powerbanks.map((pb) => this.cardVendido(pb)).join("")
        : UI.vazio("Nenhum power bank vendido encontrado.");
    } catch (e) {
      UI.erro(e);
      alvo.innerHTML = UI.vazio("Não foi possível carregar os vendidos.");
    }
  },

  cardVendido(pb) {
    const v = pb.venda || {};
    return `
      <article class="pb vendido">
        <div class="pb-topo">
          <span class="pb-codigo">${esc(pb.codigo)}</span>
          ${UI.pillStatus(pb.status)}
        </div>
        <dl class="venda">
          <dt>Comprador</dt><dd>${esc(v.cliente_nome)}</dd>
          <dt>Telefone</dt><dd>${esc(v.cliente_telefone)}</dd>
          <dt>Retirado</dt><dd>${esc(v.estacao_retirada)} · ${Formato.dataHora(v.retirado_em)}</dd>
          <dt>Vendido</dt><dd>${Formato.dataHora(v.vendido_em)}</dd>
        </dl>
        <div class="pb-rodape">
          <span>${pb.capacidade_mah / 1000}k mAh · aluguel #${v.aluguel_id}</span>
          <b class="valor-venda">${Formato.moeda(v.valor)}</b>
        </div>
      </article>`;
  },
};
