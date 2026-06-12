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
