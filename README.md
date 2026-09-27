# ⚡ Charge Fácil — Front-end

Projeto desenvolvido como MVP da disciplina **Desenvolvimento Full Stack Básico** (PUC-Rio).
Este front consome a API do repositório https://github.com/aferreira20/charge-facil-api

Apresentação geral do projeto: https://github.com/aferreira20/MVP_AFN-Full-Stack-Basico

---

## 1 - Funcionalidades

- **Painel**:
  - indicadores da rede (prontos, aluguéis em andamento, receita, vendidos e estornos);
  - anel de ocupação e ranking de estações;
  - tarifa e regra da franquia de R$ 150,00;
  - aluguéis em andamento com **contagem regressiva do prazo de 24h**, destacada quando faltam menos de 2h.
- **Estações**:
  - cards com a **grade de slots do totem** (pronto, indisponível, livre);
  - busca, filtro de ativas, cadastro, edição e exclusão;
  - nos detalhes, **alocar do estoque** um power bank, **recolher ao estoque** e enviar para manutenção.
- **Totem (autoatendimento)**, que simula o app instalado no totem:
  - **Alugar**: escolha da estação, dados do cliente, aceite da pré-autorização da franquia e liberação do power bank mais carregado, com o prazo de devolução;
  - **Devolver**: escolha da estação, busca do aluguel pelo celular e recibo com uso cobrado e **valor estornado**.
- **Inventário**:
  - **+ Adicionar power bank**: cadastra um power bank novo **em estoque**, com código gerado automaticamente;
  - **Em operação**: todos os power banks com nível de bateria e localização (estoque, estação ou em uso), busca por código, filtros por estação e status (incluindo "Em estoque"), manutenção e descarte. Ao alocar ou recolher um power bank, o card atualiza a estação;
  - **Vendidos**: busca dos power banks **não devolvidos em 24h** (por código, comprador ou telefone), com data da venda e franquia cobrada.
- **Monitor de API** (botão `API` no canto inferior direito): mostra cada chamada feita à API (método, rota, status e horário), para deixar claro qual rota é usada em cada interação.
- **Layout responsivo**: no celular, a navegação vai para uma barra inferior.

## 2 - Tecnologias

- **HTML5, CSS3 e JavaScript puro**, sem frameworks de SPA e sem bibliotecas de CSS.
- Scripts clássicos (`<script src>`, sem ES modules), para que o `index.html` funcione aberto direto do disco.
- `fetch` para consumir a API REST.

## 3 - Como executar

1. **Suba a API primeiro.** Siga o README do repositório https://github.com/aferreira20/charge-facil-api; ela deve responder em `http://127.0.0.1:5000`.

2. **Clone este repositório**:
   ```bash
   git clone https://github.com/aferreira20/charge-facil-front.git
   ```

3. **Abra o arquivo `index.html` diretamente no navegador** (duplo clique).
   Não é preciso servidor, extensão nem nenhuma instalação.

> ℹ️ Se a API estiver em outro endereço, ajuste a constante `API_URL` em `js/config.js`.
> O indicador **API online / offline**, no rodapé do menu lateral, mostra se a conexão está funcionando.

## 🔌 Onde cada rota da API é chamada

| Rota | Tela / ação |
|---|---|
| `GET /dashboard` | Painel (ao abrir, no botão Atualizar e a cada 30 s) |
| `GET /alugueis` | Painel (aluguéis em andamento) e Totem → Devolver (busca pelo celular) |
| `GET /estacoes` | Estações (lista, busca e filtro), Totem (escolha da estação) e filtro do Inventário |
| `GET /estacoes/{id}` | Botão **Detalhes** de uma estação |
| `POST /estacoes` | **+ Nova estação** |
| `PUT /estacoes/{id}` | Botão **Editar** |
| `DELETE /estacoes/{id}` | Botão **Excluir** |
| `GET /powerbanks` | Inventário → Em operação (busca e filtros), Inventário → Vendidos (busca) e Detalhes da estação (lista do estoque) |
| `POST /powerbanks` | Inventário → **+ Adicionar power bank** |
| `PATCH /powerbanks/{id}/estacao` | Detalhes da estação → **Alocar na estação** e ícone ↩ **Recolher ao estoque** |
| `PATCH /powerbanks/{id}/status` | Ícones 🔧 / ✓ no Inventário e nos Detalhes da estação |
| `DELETE /powerbanks/{id}` | Ícone ✕ no Inventário |
| `POST /alugueis` | Totem → Alugar → **Liberar power bank** |
| `PATCH /alugueis/{id}/devolucao` | Totem → Devolver → escolher o aluguel |

## 📁 Estrutura do projeto

```
charge-facil-front/
├── index.html          # Estrutura da SPA (todas as telas)
├── css/
│   └── styles.css      # Estilo próprio (tema Charge Fácil)
├── js/
│   ├── config.js       # URL da API
│   ├── api.js          # Uma função por rota da API
│   ├── ui.js           # Formatação, tarifa, toasts, modal, monitor de API
│   ├── painel.js       # Tela Painel
│   ├── estacoes.js     # Tela Estações (+ detalhes, alocação do estoque e formulários)
│   ├── totem.js        # App do totem: alugar e devolver
│   ├── inventario.js   # Inventário: adicionar ao estoque, em operação e vendidos
│   └── app.js          # Navegação entre telas e relógios ao vivo
└── img/                # Ícone e arte do totem
```
