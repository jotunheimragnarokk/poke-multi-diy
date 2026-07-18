# Poke Multi DIY

Painel caseiro que abre 4 sessões independentes do Poke Idle World (ou qualquer
site que você configurar) em uma única janela, em grade 2×2. Cada sessão tem
login/cookies isolados e salvos localmente — igual a 4 navegadores separados,
só que organizados numa tela.

Isso **não é bot**: nenhuma ação é feita automaticamente. É só um "navegador
multi-conta" caseiro.

## Requisitos

- [Node.js](https://nodejs.org) instalado (versão 18 ou mais recente).

## Como rodar em modo desenvolvimento

```bash
cd poke-multi
npm install
npm start
```

Isso abre a janela com as 4 contas já carregando o jogo. Na primeira vez,
faça login manualmente em cada uma das 4 telas (cada uma é uma sessão
separada, então pode logar em 4 contas diferentes). Nas próximas vezes que
abrir o app, as sessões continuam salvas.

## Como gerar um .exe portátil (Windows)

```bash
npm run build:win
```

O instalador/portátil sai na pasta `dist/`. Você pode copiar essa pasta para
qualquer PC Windows e rodar sem precisar instalar Node ali.

## Como trocar o jogo/site ou o número de contas

Abra o arquivo `main.js` e edite estas duas linhas no topo:

```js
const GAME_URL = 'https://poke.idleworld.online/';
const ACCOUNT_COUNT = 4;
```

Se mudar `ACCOUNT_COUNT` para um número diferente de 4, ajuste também o CSS
em `style.css` na classe `.grid-4` (ex.: para 6 contas, use
`grid-template-columns: 1fr 1fr 1fr;` e `grid-template-rows: 1fr 1fr;`).

## Estrutura dos arquivos

- `main.js` — processo principal do Electron, cria a janela e guarda config.
- `preload.js` — ponte segura entre o processo principal e a página.
- `index.html` / `style.css` / `renderer.js` — a interface (grade, botões de
  mutar/recarregar/expandir).
- `assets/` — coloque aqui um ícone `.ico` se quiser personalizar o app.

## Funcionalidades

- Grade 2×2 com 4 sessões simultâneas.
- Cada sessão com login/cookies próprios e persistentes (partition
  `persist:contaN` do Electron).
- Botão de mutar/desmutar áudio por conta.
- Botão de recarregar uma conta específica ou todas de uma vez.
- Botão de expandir uma conta para tela cheia e voltar à grade.
