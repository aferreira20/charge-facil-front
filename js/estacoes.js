/**
 * Tela Estações.
 * Rotas: GET /estacoes, GET /estacoes/{id}, POST /estacoes, PUT /estacoes/{id} e DELETE /estacoes/{id}.
 * No modal de detalhes: GET /powerbanks?status=em estoque, PATCH /powerbanks/{id}/estacao
 * (alocar ou recolher ao estoque) e PATCH /powerbanks/{id}/status.
 */
const Estacoes = {
  lista: [],
  seq: 0, // evita exibir respostas fora de ordem enquanto o usuário digita na busca

  iniciar() {
    $("#btn-nova-estacao").addEventListener("click", () => this.abrirFormulario());
    $("#busca-estacao").addEventListener("input", debounce(() => this.carregar()));
    $("#apenas-ativas").addEventListener("change", () => this.carregar());

    // Delegação de eventos: um único listener atende os botões de todos os cards
    $("#lista-estacoes").addEventListener("click", (ev) => {
      const botao = ev.target.closest("[data-acao]");
      if (!botao) return;
      const id = Number(botao.dataset.id);
      if (botao.dataset.acao === "detalhes") this.abrirDetalhes(id);
      if (botao.dataset.acao === "editar") this.abrirFormulario(this.lista.find((e) => e.id === id));
      if (botao.dataset.acao === "excluir") this.excluir(id);
    });
  },

  async carregar() {
    const alvo = $("#lista-estacoes");
    if (!this.lista.length) alvo.innerHTML = `<p class="carregando">Carregando estações…</p>`;
    const pedido = ++this.seq;
    try {
      const { estacoes } = await Api.listarEstacoes({
        busca: $("#busca-estacao").value.trim(),
        apenas_ativas: $("#apenas-ativas").checked ? "true" : "",
      });
      if (pedido !== this.seq) return;
      this.lista = estacoes;
      alvo.innerHTML = estacoes.length
        ? estacoes.map((e) => this.card(e)).join("")
        : UI.vazio("Nenhuma estação encontrada.");
    } catch (e) {
      UI.erro(e);
      alvo.innerHTML = UI.vazio("Não foi possível carregar as estações.");
    }
  },

  // Grade visual dos slots: pronto / indisponível (bateria baixa ou manutenção) / livre
  slots(e) {
    const indisponiveis = e.slots_ocupados - e.disponiveis;
    const celulas = [];
    for (let i = 0; i < e.capacidade; i++) {
      let classe = "";
      if (i < e.disponiveis) classe = "cheio";
      else if (i < e.disponiveis + indisponiveis) classe = "baixo";
      celulas.push(`<span class="slot ${classe}"></span>`);
    }
    return `<div class="slots" title="${e.disponiveis} prontos · ${indisponiveis} indisponíveis · ${e.slots_livres} livres">${celulas.join("")}</div>`;
  },

  card(e) {
    return `
      <article class="estacao ${e.ativa ? "" : "inativa"}">
        <div class="estacao-topo">
          <div>
            <h3>${esc(e.nome)}</h3>
            <p class="end">${esc(e.endereco)} · ${esc(e.bairro)}, ${esc(e.cidade)}</p>
          </div>
          ${e.ativa ? '<span class="pill ok">Ativa</span>' : '<span class="pill off">Inativa</span>'}
        </div>
        ${this.slots(e)}
        <div class="meta">
          <span><b>${e.disponiveis}</b> prontos</span>
          <span><b>${e.slots_livres}</b> slots livres</span>
          <span>🕑 ${esc(e.horario)}</span>
        </div>
        <div class="estacao-acoes">
          <button class="btn btn-primary btn-sm" data-acao="detalhes" data-id="${e.id}">Detalhes</button>
          <button class="btn btn-ghost btn-sm" data-acao="editar" data-id="${e.id}">Editar</button>
          <button class="btn btn-danger btn-sm" data-acao="excluir" data-id="${e.id}">Excluir</button>
        </div>
      </article>`;
  },

  abrirFormulario(estacao = null) {
    const e = estacao || { nome: "", endereco: "", bairro: "", cidade: "Rio de Janeiro", capacidade: 12, horario: "24 horas", ativa: true };
    const corpo = UI.abrirModal(estacao ? "Editar estação" : "Nova estação", `
      <form class="form" id="form-estacao" novalidate>
        <label>Nome da estação
          <input class="input" name="nome" required minlength="3" maxlength="80" value="${esc(e.nome)}" placeholder="Shopping Rio Sul">
        </label>
        <label>Endereço
          <input class="input" name="endereco" required minlength="5" maxlength="160" value="${esc(e.endereco)}" placeholder="Rua, número - referência">
        </label>
        <div class="linha">
          <label>Bairro
            <input class="input" name="bairro" required minlength="2" maxlength="60" value="${esc(e.bairro)}">
          </label>
          <label>Cidade
            <input class="input" name="cidade" required minlength="2" maxlength="60" value="${esc(e.cidade)}">
          </label>
        </div>
        <div class="linha">
          <label>Capacidade (slots)
            <input class="input" name="capacidade" type="number" required min="4" max="40" value="${e.capacidade}">
          </label>
          <label>Horário de funcionamento
            <input class="input" name="horario" required maxlength="40" value="${esc(e.horario)}">
          </label>
        </div>
        <label class="switch">
          <input type="checkbox" name="ativa" ${e.ativa ? "checked" : ""}>
          <span class="slider"></span> Estação ativa (aceita retiradas e devoluções)
        </label>
        <div class="acoes">
          <button type="button" class="btn btn-ghost" data-fechar>Cancelar</button>
          <button type="submit" class="btn btn-primary">${estacao ? "Salvar alterações" : "Cadastrar estação"}</button>
        </div>
      </form>`);

    $("#form-estacao", corpo).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const form = ev.target;
      if (!UI.validarForm(form)) return;
      const dados = {
        nome: form.nome.value.trim(),
        endereco: form.endereco.value.trim(),
        bairro: form.bairro.value.trim(),
        cidade: form.cidade.value.trim(),
        capacidade: Number(form.capacidade.value),
        horario: form.horario.value.trim(),
        ativa: form.ativa.checked,
      };
      try {
        if (estacao) {
          await Api.atualizarEstacao(estacao.id, dados);
          UI.toast("Estação atualizada.");
        } else {
          await Api.cadastrarEstacao(dados);
          UI.toast("Estação cadastrada! Adicione power banks em Detalhes.");
        }
        UI.fecharModal();
        this.carregar();
      } catch (e) {
        UI.erro(e);
      }
    });
  },

  async excluir(id) {
    const estacao = this.lista.find((e) => e.id === id);
    const ok = await UI.confirmar("Excluir estação",
      `Deseja excluir <strong>${esc(estacao?.nome)}</strong>? O histórico de aluguéis será mantido.`, "Excluir");
    if (!ok) return;
    try {
      await Api.removerEstacao(id);
      UI.toast("Estação excluída.");
      this.carregar();
    } catch (e) {
      UI.erro(e);
    }
  },

  async abrirDetalhes(id) {
    try {
      // Detalhe da estação + power banks em estoque (candidatos à alocação)
      const [e, estoque] = await Promise.all([
        Api.buscarEstacao(id),
        Api.listarPowerBanks({ status: "em estoque" }),
      ]);
      const manut = (pb) => pb.status === "manutenção";
      const itens = e.powerbanks.map((pb) => `
        <li>
          <span class="pb-codigo">${esc(pb.codigo)}</span>
          <span>${UI.miniBateria(pb.nivel_bateria)} · ${pb.capacidade_mah / 1000}k mAh ${UI.pillStatus(pb.status)}</span>
          <span class="pb-acoes">
            <button class="icone-btn" title="${manut(pb) ? "Liberar para uso" : "Enviar para manutenção"}"
              data-pb="${pb.id}" data-acao="${manut(pb) ? "liberar" : "manutencao"}">${manut(pb) ? "✓" : "🔧"}</button>
            <button class="icone-btn" title="Recolher ao estoque" data-pb="${pb.id}" data-acao="recolher">↩</button>
          </span>
        </li>`).join("");

      let alocar;
      if (!estoque.powerbanks.length) {
        alocar = UI.vazio("Nenhum power bank em estoque. Adicione pelo Inventário.");
      } else if (e.slots_livres === 0) {
        alocar = UI.vazio("Estação lotada: recolha um power bank ao estoque para liberar um slot.");
      } else {
        alocar = `
          <label>Power bank em estoque
            <select class="input" name="powerbank">
              ${estoque.powerbanks.map((pb) =>
                `<option value="${pb.id}">${esc(pb.codigo)} · ${pb.capacidade_mah / 1000}k mAh · ${pb.nivel_bateria}%</option>`).join("")}
            </select>
          </label>
          <button type="submit" class="btn btn-primary">Alocar na estação</button>`;
      }

      const corpo = UI.abrirModal(e.nome, `
        <p class="end">${esc(e.endereco)} · ${esc(e.bairro)}, ${esc(e.cidade)} · 🕑 ${esc(e.horario)}</p>
        <div style="margin:14px 0">${this.slots(e)}</div>
        <div class="meta" style="display:flex;gap:16px;color:var(--muted);font-size:13px">
          <span><b style="color:var(--text)">${e.disponiveis}</b> prontos</span>
          <span><b style="color:var(--text)">${e.slots_ocupados}</b>/${e.capacidade} slots ocupados</span>
        </div>
        <ul class="detalhe-lista">${itens || "<li>Nenhum power bank nesta estação.</li>"}</ul>
        <form class="alocar" id="form-alocar" novalidate>
          <h3>Alocar do estoque <small class="nota-inline">(${estoque.powerbanks.length} disponíveis no estoque)</small></h3>
          ${alocar}
        </form>`);

      $(".detalhe-lista", corpo).addEventListener("click", async (ev) => {
        const botao = ev.target.closest("[data-pb]");
        if (!botao) return;
        const pbId = Number(botao.dataset.pb);
        try {
          if (botao.dataset.acao === "recolher") {
            const pb = await Api.alocarPowerBank(pbId, null);
            UI.toast(`${pb.codigo} recolhido ao estoque.`);
          } else {
            const status = botao.dataset.acao === "liberar" ? "disponível" : "manutenção";
            await Api.alterarStatusPowerBank(pbId, status);
            UI.toast(status === "manutenção" ? "Enviado para manutenção." : "Liberado para uso.");
          }
          this.abrirDetalhes(id);
          this.carregar();
        } catch (erro) {
          UI.erro(erro);
        }
      });

      $("#form-alocar", corpo).addEventListener("submit", async (ev) => {
        ev.preventDefault();
        try {
          const pb = await Api.alocarPowerBank(Number(ev.target.powerbank.value), id);
          UI.toast(`${pb.codigo} alocado em ${pb.estacao_nome}.`);
          this.abrirDetalhes(id);
          this.carregar();
        } catch (erro) {
          UI.erro(erro);
        }
      });
    } catch (e) {
      UI.erro(e);
    }
  },
};
