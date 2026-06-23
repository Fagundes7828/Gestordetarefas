# MF Agenda — v1.0

> Sistema pessoal de organização, planejamento de tarefas e gerenciamento de roteiros de gravação, com sincronização em nuvem via Firebase e modo escuro estilo Apple.

**🌐 Acesso:** [fagundes7828.github.io/Gestordetarefas](https://fagundes7828.github.io/Gestordetarefas/)
**📦 Versão:** 1.0 (estável)
**👤 Autor:** Mateus Fagundes — [@Fagundes7828](https://github.com/Fagundes7828)

---

## Sumário

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Banco de Dados](#banco-de-dados-firestore)
- [Configuração do Firebase](#configuração-do-firebase)
- [Como Publicar Atualizações](#como-publicar-atualizações)
- [Versionamento e Tags](#versionamento-e-tags)
- [Roadmap](#roadmap-funcionalidades-futuras)

---

## Visão Geral

O **MF Agenda** é uma aplicação web desenvolvida do zero em HTML, CSS e JavaScript puro, sem frameworks ou ferramentas de build. Centraliza o gerenciamento de tarefas, compromissos, projetos e roteiros de gravação de vídeo em um único lugar, com visual moderno inspirado no iOS, sincronização completa com a nuvem e suporte a tema claro e escuro.

---

## Funcionalidades

### 🔐 Autenticação
- Login e cadastro com e-mail e senha
- Login com Google (OAuth via Firebase)
- Proteção de rotas e sessão persistente

### 🏠 Dashboard
- Relógio em tempo real (GMT-3, Brasília)
- Cards de estatísticas: Total, Concluídas, Pendentes, Atrasadas e Taxa de conclusão
- Seção de tarefas pendentes e atrasadas com indicadores de urgência
- **Bloco "Concluídas hoje"** com botão de reabrir tarefa
- Cálculo automático de tempo de atraso

### 📅 Calendário
- Grade mensal com navegação por mês e ano
- Início de semana configurável (Domingo ou Segunda)
- Tarefas exibidas no dia de início e no dia de conclusão
- Cores herdadas das categorias
- Hover com detalhes e modal completo do dia
- Filtros por Status, Prioridade e Categoria
- Legenda automática gerada pelas categorias

### ✅ Tarefas
- Accordion por categoria (Todas, Pendentes, Concluídas, Atrasadas)
- Busca por nome, categoria, projeto ou descrição
- Contadores em tempo real
- Modal de detalhe completo (Task Detail View) com descrição integral
- Ações: Editar, Concluir, Duplicar, Excluir, Reabrir

### 📝 Roteiros
- Editor de texto com formatação (negrito, itálico, sublinhado, listas, alinhamento)
- Campos: título, data da gravação, status e conteúdo
- Status: Em elaboração, Pronto para gravação, Gravado, Finalizado
- Cards com cor por status
- Visualização completa sem limite de tamanho
- **Integração com o Calendário**: ao definir uma data de gravação, é criada automaticamente uma "gravação" vinculada que aparece no calendário (em rosa). Editar, finalizar ou excluir o roteiro reflete na gravação, e vice-versa.

### ⚙️ Configurações (em abas)
- **Perfil**: nome, descrição, cor do avatar, método de conexão, troca/recuperação de senha
- **Categorias**: criar, editar, ativar/desativar e excluir, com cor livre e descrição
- **Visualizações**: tema, página inicial, primeiro dia da semana e 7 opções de exibição do calendário

### 🌙 Tema (estilo Apple)
- Três modos: **Claro**, **Escuro** e **Automático** (segue o sistema)
- Escuro "puro" no estilo Apple (preto/cinza profundo)
- Preferência salva na nuvem e em cache local (sem flash ao carregar)
- Transições suaves

### 📱 Responsividade
- Layout adaptado para desktop e mobile
- No celular, o menu vira uma barra fixa inferior estilo app iOS

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | HTML5, CSS3, JavaScript (ES Modules, sem framework) |
| Autenticação | Firebase Authentication 12.13.0 |
| Banco de dados | Cloud Firestore (Firebase) |
| Hospedagem | GitHub Pages |
| Controle de versão | Git + GitHub |
| Ícones | SVG inline (estilo Lucide / SF Symbols) |
| Fontes | System UI (`-apple-system`, `BlinkMacSystemFont`) |

---

## Estrutura de Arquivos

```
Gestordetarefas/
├── index.html          # Tela de autenticação (login e cadastro)
├── app.html            # Aplicação principal (todas as telas internas)
├── styles.css          # Estilos globais (inclui tema claro e escuro)
├── auth.js             # Lógica de autenticação
├── app.js              # Lógica do app (dashboard, calendário, tarefas, roteiros, config)
├── firebase-config.js  # Configuração e inicialização do Firebase
└── README.md           # Este arquivo
```

---

## Banco de Dados (Firestore)

```
usuarios/
└── {uid}/
    ├── nome              string
    ├── bio               string
    ├── email             string
    ├── avatarCor         string (hex)
    ├── categorias        array de { nome, cor, descricao, ativa }
    ├── prefs             objeto de preferências (tema, visualizações)
    ├── criadoEm          timestamp
    │
    ├── tarefas/
    │   └── {tarefaId}/
    │       ├── titulo        string
    │       ├── descricao     string
    │       ├── categoria     string
    │       ├── prioridade    "baixa" | "media" | "alta" | "critica"
    │       ├── status        "pendente" | "andamento" | "concluida"
    │       ├── cor           string (hex)
    │       ├── inicio        string (YYYY-MM-DD)
    │       ├── conclusao     string (YYYY-MM-DD)
    │       ├── hora          string (HH:MM)
    │       ├── projeto       string
    │       ├── roteiroId     string (se for gravação vinculada a um roteiro)
    │       ├── concluidaEm   timestamp (quando foi concluída)
    │       └── criadoEm      timestamp
    │
    └── roteiros/
        └── {roteiroId}/
            ├── titulo        string
            ├── dataGravacao  string (YYYY-MM-DD)
            ├── conteudo      string (HTML do editor)
            ├── status        "elaboracao" | "pronto" | "gravado" | "finalizado"
            ├── criadoEm      timestamp
            └── atualizadoEm  timestamp
```

### Regras de Segurança (Firestore)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /{documento=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

---

## Configuração do Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e abra o projeto `mf-agenda`.
2. Ative **Authentication** → E-mail/senha e Google.
3. Crie o **Firestore Database**.
4. Em **Configurações do projeto → Seus aplicativos**, copie o `firebaseConfig` e cole em `firebase-config.js`.
5. Em **Authentication → Settings → Domínios autorizados**, adicione `fagundes7828.github.io`.
6. Aplique as **Regras de Segurança** acima no Firestore.

---

## Como Publicar Atualizações

O projeto é hospedado no GitHub Pages. Para atualizar:

1. No repositório, substitua o arquivo alterado (apague o antigo e suba o novo, ou edite direto).
2. Aguarde de **2 a 10 minutos** (o GitHub Pages tem cache).
3. Teste em uma **janela anônima** (Cmd+Shift+N) para evitar ver versões em cache.

> **Dica:** muitos "bugs" aparentes são apenas cache. Sempre teste em janela anônima após esperar alguns minutos.

---

## Versionamento e Tags

Este projeto usa **versionamento semântico** (`vMAJOR.MINOR.PATCH`):

- `v1.0` — versão estável atual
- `v1.1` — novas funcionalidades pequenas (ex: exportar PDF)
- `v1.0.1` — correção de um bug pequeno
- `v2.0` — mudanças grandes (ex: integração Google Calendar completa)

### Como marcar uma versão (Release) no GitHub

1. Acesse `github.com/Fagundes7828/Gestordetarefas/releases`
2. Clique em **"Draft a new release"**
3. Em **"Choose a tag"**, digite `v1.0` e confirme "Create new tag on publish"
4. **Target:** `main`
5. **Release title:** `MF Agenda v1.0 — Versão Estável`
6. Adicione a descrição com as funcionalidades incluídas
7. Clique em **"Publish release"**

### Pela linha de comando (alternativa)

```bash
git tag -a v1.0 -m "Versão estável 1.0"
git push origin v1.0
```

---

## Histórico de Versões

### v1.0 — Versão Estável (atual)
Primeira versão estável e completa. Inclui:
- Autenticação (e-mail/senha + Google)
- Dashboard com estatísticas, relógio e bloco de concluídas hoje
- Calendário mensal com filtros e legenda automática
- Gerenciamento de tarefas (accordion, busca, detalhes)
- Roteiros com editor formatado
- Integração Roteiros ↔ Calendário
- Configurações em abas (Perfil, Categorias, Visualizações)
- Modo escuro (Claro / Escuro / Automático)
- Layout responsivo (desktop e mobile)
- Código revisado: sem duplicatas, sem código órfão, estrutura validada

---

## Roadmap (Funcionalidades Futuras)

- [ ] Visualização de semana no calendário (estilo Apple)
- [ ] Exportação de roteiros para PDF e Word
- [ ] Integração com Google Calendar (configuração já preparada no Google Cloud)
- [ ] Notificações de prazo
- [ ] Drag and drop de tarefas no calendário
- [ ] Controle de versões e histórico de roteiros
- [ ] PWA (instalar como app no iPhone/Mac)

---

## Design System

- **Glassmorphism** — vidro fosco com `backdrop-filter`
- **Estilo iOS** — bordas arredondadas, sombras suaves, animações fluidas
- **Cores** — gradiente azul-lavanda-rosa (claro) / preto profundo (escuro), azul `#0a84ff` como primária
- **Tipografia** — System UI (SF Pro no Apple, Segoe UI no Windows, Roboto no Android)
- **Tema** — variáveis CSS para alternância completa entre claro e escuro

---

*Desenvolvido com HTML, CSS e JavaScript puro — sem frameworks, sem dependências de build.*

**MF Agenda v1.0** · © 2026 Mateus Fagundes
