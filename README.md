# CC MASTER — Riddle Home

Página inicial estática do projeto de riddles do CC MASTER.

## Arquivos

- `index.html` — estrutura da página inicial
- `style.css` — visual noir/detetive em preto e branco
- `app.js` — cadastro/login simples para protótipo usando localStorage
- `assets/logo-ccmasters.png` — substitua por sua logo corrigida

## Como subir no GitHub

1. Abra o repositório `CCMaster-Riddle`.
2. Envie estes arquivos para a raiz do projeto.
3. Crie a pasta `assets`.
4. Coloque sua logo corrigida em `assets/logo-ccmasters.png`.
5. Faça commit.
6. No Cloudflare Pages, use:
   - Framework preset: `None`
   - Build command: vazio
   - Output directory: `/`

## Observação sobre cadastro

O cadastro atual é apenas para teste visual e salva no navegador da pessoa usando `localStorage`.
Para salvar progresso real online e aparecer em ranking/investigadores, use Firebase ou Supabase.
