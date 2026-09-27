/**
 * Simulador do app de autoatendimento do totem.
 * Alugar:   GET /estacoes?apenas_ativas=true e POST /alugueis.
 * Devolver: GET /estacoes?apenas_ativas=true, GET /alugueis?situacao=ativo&cliente=<celular>
 *           e PATCH /alugueis/{id}/devolucao.
 */
const Totem = {
  modo: "alugar",
  estacaoRetirada: null,
  estacaoDevolucao: null,

  PASSOS: {
    alugar: [["a1", "Estação"], ["a2", "Seus dados"], ["a3", "Retire"]],
    devolver: [["d1", "Estação"], ["d2", "Seu aluguel"], ["d3", "Recibo"]],
  },

  iniciar() {
    $("#modo-totem").addEventListener("click", (ev) => {
      const aba = ev.target.closest("[data-modo]");
      if (aba) this.trocarModo(aba.dataset.modo);
    });

    // Máscara de celular em todos os campos de telefone do totem
    $$("#view-totem .telefone").forEach((campo) =>
      campo.addEventListener("input", () => { campo.value = Formato.telefone(campo.value); }));

    // Botões genéricos de "voltar" e "concluir"
    $("#view-totem").addEventListener("click", (ev) => {
      const voltar = ev.target.closest("[data-etapa]");
      if (voltar) this.irEtapa(voltar.dataset.etapa);
      if (ev.target.closest("[data-reiniciar]")) this.carregar();
    });

    // Fluxo de aluguel
    $("#alugar-estacoes").addEventListener("click", (ev) => {
      const botao = ev.target.closest("[data-id]");
      if (!botao || botao.disabled) return;
      this.estacaoRetirada = { id: Number(botao.dataset.id), nome: botao.dataset.nome };
      $("#alugar-estacao-nome").textContent = this.estacaoRetirada.nome;
      this.irEtapa("a2");
      $("#etapa-a2 input").focus();
    });
    $("#etapa-a2").addEventListener("submit", (ev) => {
      ev.preventDefault();
      this.alugar(ev.target);
    });

    // Fluxo de devolução
    $("#devolver-estacoes").addEventListener("click", (ev) => {
      const botao = ev.target.closest("[data-id]");
      if (!botao || botao.disabled) return;
      this.estacaoDevolucao = { id: Number(botao.dataset.id), nome: botao.dataset.nome };
      $("#devolver-estacao-nome").textContent = this.estacaoDevolucao.nome;
      $("#devolver-alugueis").innerHTML = "";
      $("#form-busca-aluguel").reset();
      this.irEtapa("d2");
      $("#form-busca-aluguel input").focus();
    });
    $("#form-busca-aluguel").addEventListener("submit", (ev) => {
      ev.preventDefault();
      this.buscarAlugueis(ev.target);
    });
    $("#devolver-alugueis").addEventListener("click", (ev) => {
      const botao = ev.target.closest("[data-aluguel]");
      if (botao) this.devolver(Number(botao.dataset.aluguel));
    });
  },

  trocarModo(modo) {
    this.modo = modo;
    $$("#modo-totem .tab").forEach((t) => t.classList.toggle("ativo", t.dataset.modo === modo));
    $("#kiosk-titulo").innerHTML = modo === "alugar"
      ? "Alugue um <span>power bank</span>"
      : "Devolva seu <span>power bank</span>";
    this.carregar();
  },

  irEtapa(id) {
    $$("#view-totem .etapa").forEach((el) => el.classList.toggle("ativa", el.id === `etapa-${id}`));
    const passos = this.PASSOS[this.modo];
    const atual = passos.findIndex(([p]) => p === id);
    $("#passos").innerHTML = passos.map(([, rotulo], i) => `
      <li class="passo ${i === atual ? "ativo" : ""} ${i < atual ? "feito" : ""}"><b>${i + 1}</b> ${rotulo}</li>`).join("");
  },

  async carregar() {
    const alugar = this.modo === "alugar";
    this.irEtapa(alugar ? "a1" : "d1");
    $("#etapa-a2").reset();
    const alvo = alugar ? $("#alugar-estacoes") : $("#devolver-estacoes");
    alvo.innerHTML = `<p class="carregando">Buscando estações…</p>`;
    try {
      const { estacoes } = await Api.listarEstacoes({ apenas_ativas: "true" });
      // Para alugar importa ter power bank pronto; para devolver, ter slot livre
      const quantidade = (e) => (alugar ? e.disponiveis : e.slots_livres);
      estacoes.sort((a, b) => quantidade(b) - quantidade(a));
      alvo.innerHTML = estacoes.length ? estacoes.map((e) => `
        <button class="escolha" data-id="${e.id}" data-nome="${esc(e.nome)}" ${quantidade(e) ? "" : "disabled"}>
          <span><strong>${esc(e.nome)}</strong><small>${esc(e.bairro)}, ${esc(e.cidade)} · ${esc(e.horario)}</small></span>
          <span class="qtd">${quantidade(e)}<small>${alugar ? "disponíveis" : "slots livres"}</small></span>
        </button>`).join("") : UI.vazio("Nenhuma estação ativa no momento.");
    } catch (e) {
      UI.erro(e);
      alvo.innerHTML = UI.vazio("Não foi possível carregar as estações.");
    }
    this.renderAvisoCaucao();
  },

  renderAvisoCaucao() {
    const r = Tarifa.regras;
    $("#aviso-caucao").innerHTML = `
      <strong>Franquia de ${Formato.moeda(r.caucao)} pré-autorizada no cartão</strong>
      <span>Devolva em até ${r.prazo_horas}h em qualquer estação: você paga só o uso
      (${esc(Tarifa.resumo())}) e o restante é estornado.</span>
      <span>Sem devolução em ${r.prazo_horas}h, a franquia é cobrada e o power bank é seu.</span>`;
  },

  async alugar(form) {
    if (!UI.validarForm(form)) return;
    const botao = $("button[type=submit]", form);
    botao.disabled = true;
    try {
      const a = await Api.iniciarAluguel({
        estacao_id: this.estacaoRetirada.id,
        cliente_nome: form.cliente_nome.value.trim(),
        cliente_telefone: form.cliente_telefone.value.trim(),
      });
      $("#liberado-codigo").textContent = a.powerbank_codigo;
      $("#liberado-info").innerHTML =
        `Retire o power bank no slot aceso da estação <strong>${esc(a.estacao_retirada)}</strong>. ` +
        `Carga atual: <strong>${a.nivel_bateria ?? "—"}%</strong>.`;
      $("#liberado-prazo").innerHTML =
        `Franquia de <strong>${Formato.moeda(a.caucao)}</strong> pré-autorizada. ` +
        `Devolva até <strong>${Formato.dataHora(a.prazo_devolucao)}</strong> em qualquer estação.`;
      this.irEtapa("a3");
      UI.toast(`Aluguel #${a.id} iniciado. Boa carga, ${a.cliente_nome.split(" ")[0]}!`);
    } catch (e) {
      UI.erro(e);
    } finally {
      botao.disabled = false;
    }
  },

  async buscarAlugueis(form) {
    if (!UI.validarForm(form)) return;
    const alvo = $("#devolver-alugueis");
    try {
      const { alugueis } = await Api.listarAlugueis({ situacao: "ativo", cliente: form.telefone.value.trim() });
      alvo.innerHTML = alugueis.length ? alugueis.map((a) => `
        <button class="escolha" data-aluguel="${a.id}">
          <span>
            <strong>${esc(a.powerbank_codigo)} · ${esc(a.cliente_nome)}</strong>
            <small>Retirado em ${esc(a.estacao_retirada)}, ${Formato.dataHora(a.inicio)} ·
              prazo: <span data-prazo="${a.prazo_devolucao}">—</span></small>
          </span>
          <span class="qtd"><b data-inicio="${a.inicio}" data-formato="valor">—</b><small>uso até agora</small></span>
        </button>`).join("") : UI.vazio("Nenhum aluguel em andamento para este celular.");
      Relogio.tick();
    } catch (e) {
      UI.erro(e);
    }
  },

  async devolver(aluguelId) {
    try {
      const a = await Api.devolverPowerBank(aluguelId, this.estacaoDevolucao.id);
      $("#recibo-devolucao").innerHTML = `
        <div class="total"><small>Estornado para o seu cartão</small><b>${Formato.moeda(a.estorno)}</b></div>
        <dl>
          <dt>Franquia pré-autorizada</dt><dd>${Formato.moeda(a.caucao)}</dd>
          <dt>Uso cobrado</dt><dd>${Formato.moeda(a.valor)}</dd>
          <dt>Power bank</dt><dd>${esc(a.powerbank_codigo)}</dd>
          <dt>Retirada</dt><dd>${esc(a.estacao_retirada)} · ${Formato.dataHora(a.inicio)}</dd>
          <dt>Devolução</dt><dd>${esc(a.estacao_devolucao)} · ${Formato.dataHora(a.fim)}</dd>
          <dt>Duração</dt><dd>${Formato.duracao(a.duracao_minutos)}</dd>
        </dl>`;
      this.irEtapa("d3");
      UI.toast("Power bank devolvido. Obrigado!");
    } catch (e) {
      UI.erro(e);
    }
  },
};
