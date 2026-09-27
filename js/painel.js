/**
 * Tela Painel.
 * Rotas: GET /dashboard e GET /alugueis?situacao=ativo.
 */
const Painel = {
  iniciar() {
    $("#btn-atualizar-painel").addEventListener("click", () => this.carregar());
  },

  async carregar() {
    try {
      const [dados, ativos] = await Promise.all([
        Api.dashboard(),
        Api.listarAlugueis({ situacao: "ativo" }),
      ]);
      Tarifa.atualizar(dados.tarifa);
      this.renderKpis(dados);
      this.renderOcupacao(dados);
      this.renderRanking(dados.ranking_estacoes);
      this.renderTarifa(dados.tarifa);
      this.renderAndamento(ativos.alugueis);
    } catch (e) {
      UI.erro(e);
      $("#kpis").innerHTML = UI.vazio("Não foi possível carregar o painel. Verifique se a API está rodando.");
    }
  },

  renderKpis(d) {
    const kpis = [
      { rotulo: "Prontos para alugar", valor: d.powerbanks_disponiveis, sub: `${d.powerbanks_estoque} em estoque · ${d.powerbanks_total} no inventário`, classe: "destaque" },
      { rotulo: "Aluguéis em andamento", valor: d.alugueis_ativos,
        sub: d.alugueis_vencendo ? `⚠ ${d.alugueis_vencendo} vencendo em menos de 2h` : `${d.alugueis_hoje} retiradas hoje` },
      { rotulo: "Receita de hoje", valor: Formato.moeda(d.receita_hoje),
        sub: `uso ${Formato.moeda(d.receita_uso)} · franquias ${Formato.moeda(d.receita_vendas)}` },
      { rotulo: "Vendidos (sem devolução)", valor: d.powerbanks_vendidos,
        sub: `estornado aos clientes: ${Formato.moeda(d.estornos_total)}` },
    ];
    $("#kpis").innerHTML = kpis.map((k) => `
      <div class="kpi ${k.classe || ""}">
        <div class="rotulo">${k.rotulo}</div>
        <div class="valor">${k.valor}</div>
        <div class="sub">${k.sub}</div>
      </div>`).join("");
  },

  renderOcupacao(d) {
    $("#ring-ocupacao").innerHTML = `
      <div class="ring" style="--p:${d.ocupacao_rede}"></div>
      <div class="ring-valor">${d.ocupacao_rede}%</div>`;
    const recarregando = d.powerbanks_total - d.powerbanks_disponiveis - d.powerbanks_alugados
      - d.powerbanks_manutencao - d.powerbanks_estoque;
    const itens = [
      ["var(--lime)", "Prontos", d.powerbanks_disponiveis],
      ["var(--warn)", "Recarregando (< 20%)", Math.max(0, recarregando)],
      ["var(--info)", "Alugados", d.powerbanks_alugados],
      ["#6b5a22", "Em manutenção", d.powerbanks_manutencao],
      ["#c9d1c6", "Em estoque", d.powerbanks_estoque],
    ];
    $("#legenda-frota").innerHTML = itens.map(([cor, rotulo, qtd]) =>
      `<li><span><i style="background:${cor}"></i>${rotulo}</span><b>${qtd}</b></li>`).join("");
  },

  renderRanking(ranking) {
    if (!ranking.length) {
      $("#ranking").innerHTML = "<li>Nenhuma retirada ainda.</li>";
      return;
    }
    const maximo = ranking[0].retiradas;
    $("#ranking").innerHTML = ranking.map((r) => `
      <li>
        <span>${esc(r.estacao)}</span><b>${r.retiradas}</b>
        <div class="barra"><span style="width:${(r.retiradas / maximo) * 100}%"></span></div>
      </li>`).join("");
  },

  renderTarifa(t) {
    $("#tarifa").innerHTML = `
      <li>Carência <b>${t.carencia_minutos} min grátis</b></li>
      <li>Primeira hora <b>${Formato.moeda(t.primeira_hora)}</b></li>
      <li>Hora adicional <b>${Formato.moeda(t.hora_adicional)}</b></li>
      <li>Máximo por uso <b>${Formato.moeda(t.teto_diario)}</b></li>
      <li class="franquia">Franquia pré-autorizada <b>${Formato.moeda(t.caucao)}</b></li>
      <li class="regra">Devolveu em até ${t.prazo_horas}h? Paga só o uso e recebe o estorno da diferença.
        Não devolveu? A franquia é cobrada e o power bank é vendido ao cliente.</li>`;
  },

  renderAndamento(alugueis) {
    if (!alugueis.length) {
      $("#andamento").innerHTML = "<li>Nenhum aluguel em andamento.</li>";
      return;
    }
    // Os mais próximos do fim do prazo aparecem primeiro
    alugueis.sort((a, b) => a.minutos_restantes - b.minutos_restantes);
    $("#andamento").innerHTML = alugueis.map((a) => `
      <li>
        <strong>${esc(a.cliente_nome)}</strong>
        <span class="tempo" data-prazo="${a.prazo_devolucao}">—</span>
        <span>${esc(a.powerbank_codigo)} · retirado em ${esc(a.estacao_retirada)} · ${Formato.dataHora(a.inicio)}</span>
        <span>Uso até agora: <b data-inicio="${a.inicio}" data-formato="valor">—</b></span>
      </li>`).join("");
    Relogio.tick();
  },
};
