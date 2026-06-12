# CC MASTER — Riddle

Projeto estático com página inicial e riddles em Markdown usando Jekyll.

## Ideia principal

A home fica em `index.html`.
Cada riddle fica em um arquivo `.md` dentro da pasta `riddles/`.
O visual e os botões de investigação ficam no layout `_layouts/riddle.html`, então você não precisa repetir HTML em todos os 100 casos.

## Estrutura

```txt
_config.yml
Gemfile
index.html
style.css
app.js
_layouts/riddle.html
assets/css/riddle.css
assets/js/riddle.js
assets/logo-ccmasters.png
assets/riddles/placeholder.svg
riddles/001.md
riddles/002.md
```

## Como criar um novo riddle

Copie `riddles/001.md`, renomeie para `003.md`, e altere:

```yml
---
layout: riddle
numero: "003"
title: "Riddle 003"
nome: "Caso 003"
frase: "Sua frase aparece aqui."
imagem: "/assets/riddles/003.png"
answer_hash: "HASH_DA_RESPOSTA"
proximo: "/riddles/004/"
permalink: /riddles/003/
---

Texto opcional, pistas escondidas ou elementos extras.
```

## Como gerar o hash da resposta

O site normaliza a resposta: minúsculas, sem acentos e sem espaços/símbolos.
Exemplo: `São Paulo!` vira `saopaulo`.

Você pode gerar o SHA-256 com qualquer gerador online ou com terminal:

```bash
echo -n "resposta" | sha256sum
```

No Windows PowerShell:

```powershell
"resposta" | ForEach-Object { [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($_))).Replace('-', '').ToLower() }
```

## Cloudflare Pages

Como agora usamos Markdown/Jekyll, não use mais build vazio.

Configuração recomendada:

- Framework preset: `Jekyll` ou `None`
- Build command: `bundle exec jekyll build`
- Output directory: `_site`

## GitHub Pages

Também funciona com GitHub Pages, porque ele processa Jekyll automaticamente.

## Aviso sobre segurança

O hash evita deixar a resposta escrita diretamente no HTML, mas um site 100% estático nunca é totalmente seguro contra inspeção/brute force. Para ranking real, progresso entre dispositivos e validação forte de respostas, o ideal depois é usar Firebase ou Supabase.


## Versão estática corrigida

Esta versão também inclui páginas diretas em HTML:

```txt
riddles/001/index.html
riddles/002/index.html
```

Assim o botão "Começar" funciona mesmo sem build Jekyll.

No Cloudflare Pages, você pode usar:

```txt
Build command: deixar vazio
Output directory: /
```

Se preferir usar os arquivos `.md`, aí precisa voltar para Jekyll:

```txt
Build command: bundle exec jekyll build
Output directory: _site
```


## Atualização de login

- Nome do investigador aparece no menu antes de "Como jogar".
- Login ganhou a opção "Lembrar neste navegador".
- Botões "Começar/Continuar" e "Sair" ficam dentro do card de login, abaixo do formulário.
- Os três cards inferiores da home foram removidos.


## Ajuste de navegação

- Nome do investigador aparece também nas páginas dos riddles.
- Menu dos riddles agora inclui Como jogar, Regras e Ranking.
- Removidos os botões órfãos Começar/Sair que apareciam no final da home.


## Atualização visual da home

- Removidos os blocos laterais de investigação da página inicial.
- A home agora mantém apenas logo, texto principal e cadastro/login.
- Texto explicativo reduzido visualmente para ficar menos pesado.


## Ajuste de logo

- Removido o texto/fallback "CC MASTER" que podia aparecer junto ou abaixo da logo.
- A home agora exibe apenas a imagem da logo.


## Ajuste da logo

- Removido o efeito de faixas/glitch/pixel-burst ao abrir a página.
- No modo claro, a logo agora usa `filter: invert(1)` via CSS.
