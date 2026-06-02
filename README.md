# MF Agenda

Aplicação web pessoal de **calendário e gerenciamento de tarefas**, com login via Firebase.
Este é o **Módulo 1: Autenticação**.

## Arquivos do projeto

| Arquivo | O que faz |
|---|---|
| `index.html` | Tela de login e cadastro (visual glassmorphism iOS) |
| `styles.css` | Toda a aparência da aplicação |
| `firebase-config.js` | Onde você cola as chaves do **seu** Firebase |
| `auth.js` | Lógica de login, cadastro, Google e validações |
| `app.html` | Página interna provisória (aparece depois do login) |

---

## Passo 1 — Criar o projeto no Firebase

1. Acesse <https://console.firebase.google.com> e clique em **Adicionar projeto**.
2. Dê um nome (ex.: `mf-agenda`) e siga até criar.
3. No menu lateral, vá em **Criar > Authentication > Começar**.
4. Na aba **Sign-in method**, ative:
   - **E-mail/senha**
   - **Google**
5. No menu lateral, vá em **Criar > Firestore Database > Criar banco de dados**
   (pode começar no modo de **teste**).

## Passo 2 — Pegar as chaves de configuração

1. Clique na engrenagem ⚙️ (canto superior esquerdo) > **Configurações do projeto**.
2. Role até **Seus aplicativos** e clique no ícone **`</>`** (Web).
3. Dê um apelido ao app e registre. O Firebase vai mostrar um bloco `firebaseConfig`.
4. Copie esses valores e cole no arquivo **`firebase-config.js`**, substituindo os
   `COLE_SUA_API_KEY_AQUI`, `SEU-PROJETO`, etc.

## Passo 3 — Rodar no seu computador

⚠️ **Importante:** o login do Firebase **não funciona** abrindo o arquivo com dois cliques
(`file://`). Ele precisa de um pequeno servidor local. O jeito mais fácil:

- **Com a extensão Live Server (VS Code):** instale o VS Code, abra a pasta do projeto,
  instale a extensão *Live Server*, clique com o botão direito em `index.html` >
  **Open with Live Server**.

Pronto — vai abrir em `http://localhost:...` e o login funcionará.

## Passo 4 — Autorizar o domínio (para o login com Google)

No Firebase, em **Authentication > Settings > Domínios autorizados**, confirme que
`localhost` está na lista (já costuma vir). Quando você publicar, adicione também o
domínio do site.

---

## Publicar (opcional, mais pra frente)

- **GitHub:** crie um repositório e suba os arquivos.
- **Hospedagem:** dá pra usar o **Firebase Hosting** (`firebase deploy`) ou o GitHub Pages.

> Observação sobre as chaves: para apps web, esses valores do `firebaseConfig` ficam
> visíveis no navegador e **isso é normal**. A segurança de verdade vem das **Regras do
> Firestore** e da configuração da aba **Authentication** — cuidaremos disso ao avançar.
