# Sheilíssima — Encomendas de pães artesanais

Site estático (HTML/CSS/JS) com back-end **Firebase Realtime Database + Auth**, pronto para **GitHub Pages**.

## Arquivos
| Arquivo | O que é |
|---|---|
| `index.html` / `loja.js` | Página pública de encomendas |
| `admin.html` / `admin.js` | Painel do admin (login por e-mail/senha) |
| `app-core.js` | Regras de semana, disponibilidade e criação de pedido |
| `firebase-config.js` | **Você edita aqui**: credenciais + webhook do WhatsApp |
| `styles.css` | Identidade visual |
| `database.rules.json` | Regras de segurança do banco |

## Regras do negócio (já implementadas)
- Encomendas abertas **domingo a sexta**; **10 pães por semana** (ajustável).
- Ao atingir 10 pães, **a semana trava automaticamente**.
- Entrega **sempre na segunda-feira**; o cliente escolhe qual segunda.
- Pedido feito **no sábado** já entra para a segunda da **próxima** semana (dia de confecção).
- A trava é garantida por **transação** no envio: dois clientes não passam da capacidade.

## Passo a passo

### 1. Criar o projeto Firebase
1. https://console.firebase.google.com → **Adicionar projeto**.
2. **Build → Realtime Database → Criar** (comece em modo bloqueado).
3. **Build → Authentication → Começar → E-mail/senha → Ativar**.
4. Em **Authentication → Users → Adicionar usuário**, crie seu login de admin.
5. **Configurações do projeto → Seus apps → Web (</>）** e copie o `firebaseConfig`.

### 2. Configurar o código
- Cole o `firebaseConfig` em `firebase-config.js`.
- Cole a URL do webhook em `WHATSAPP_WEBHOOK_URL` (veja abaixo). Deixe `""` para desativar.

### 3. Aplicar as regras de segurança
No Realtime Database → aba **Regras**, cole o conteúdo de `database.rules.json` e publique.

### 4. Publicar no GitHub Pages
```bash
git init && git add . && git commit -m "Sheilíssima"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/sheilissima.git
git push -u origin main
```
No repositório: **Settings → Pages → Branch: main / root → Save**.
O site fica em `https://SEU_USUARIO.github.io/sheilissima/`.

> Depois de publicar, adicione o domínio do GitHub Pages em
> **Firebase → Authentication → Settings → Domínios autorizados**.

### 5. Webhook do WhatsApp
Ao criar um pedido, o site faz um `POST` JSON para sua URL com:
```json
{
  "id": "-Nabc123",
  "nome": "Maria",
  "whatsapp": "(11) 90000-0000",
  "semana": "2026-08-10",
  "rotuloSemana": "Segunda, 10 de ago.",
  "itens": [{ "nome": "Pão de fermentação natural", "qtd": 2, "preco": 28 }],
  "totalPaes": 2,
  "totalValor": 56,
  "status": "confirmado"
}
```
Ligue essa URL a um fluxo em **Make**, **Zapier**, **n8n** ou à **API oficial do WhatsApp Cloud**
para disparar a mensagem de confirmação à pessoa.

## Primeiros produtos
Abra o painel → aba **Produtos → + Novo produto**. Enquanto não houver produtos, a loja
mostra o aviso "volte em breve".

## Sobre a marca
Você ainda não tem logo nem paleta — o site usa um **selo tipográfico "S"** e uma paleta
de padaria (massa/crosta + acento geleia). Tudo mora em variáveis CSS no topo de `styles.css`
(`--geleia`, `--crosta`, `--tosta`…), então trocar as cores depois é imediato.
