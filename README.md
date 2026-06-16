# MF Agenda

> Aplicação web pessoal de organização, planejamento e gerenciamento de tarefas, compromissos e roteiros de gravação — com sincronização em nuvem via Firebase.

**🌐 Acesso:** [fagundes7828.github.io/Gestordetarefas](https://fagundes7828.github.io/Gestordetarefas/)

---

## Visão Geral

O **MF Agenda** é uma plataforma pessoal desenvolvida do zero em HTML, CSS e JavaScript puro, sem frameworks ou ferramentas de build. O objetivo é centralizar o gerenciamento de tarefas diárias, compromissos, projetos e roteiros de gravação de vídeo em um único lugar, com visual moderno inspirado no iOS e sincronização completa com a nuvem.

---

## Funcionalidades

### 🔐 Autenticação
- Login e cadastro com **e-mail e senha**
- Login com **Google** (OAuth via Firebase)
- Proteção de rotas (acesso ao app exige login)
- Sessão persistente via Firebase Authentication

### 🏠 Dashboard (Tela Inicial)
- Relógio em tempo real no fuso **GMT-3 (Brasília)**
- Cards de estatísticas clicáveis: Total, Concluídas, Pendentes, Atrasadas e Taxa de conclusão
- Seção de **tarefas pendentes e atrasadas** com cards visuais
- Indicadores de urgência por cor (verde / amarelo / vermelho / vermelho intenso)
- Tempo de atraso calculado automaticamente ("atrasada há 2 dias", "atrasada há 1 semana"...)

### 📅 Calendário
- Grade mensal com navegação por **mês e ano**
- Início de semana configurável (Domingo ou Segunda-feira)
- Tarefas aparecem tanto no **dia de início** quanto no **dia de conclusão**
- Cores das tarefas herdadas da categoria
- **Hover rápido** com pop-up de detalhes (desktop)
- **Hover expandido** após 5 segundos com descrição completa
- Clique no dia → modal completo com lista de tarefas + botão "Nova Tarefa"
- Filtros por Status, Prioridade e Categoria
- **Legenda automática** gerada pelas categorias cadastradas
- Responsivo para mobile (toque abre o modal do dia)

### ✅ Tarefas
- Accordion por categoria: **Todas**, **Pendentes**, **Concluídas**, **Atrasadas**
- Só uma categoria aberta por vez
- **Barra de busca** por nome, categoria, projeto ou descrição
- **Contadores em tempo real** ao lado de cada categoria
- Ações em cada card: Editar, Concluir, Duplicar, Excluir
- **Task Detail View** — modal único com a tarefa completa (descrição integral, sem corte)

### 📝 Roteiros
- Tela dedicada ao gerenciamento de roteiros de gravação
- Editor com toolbar: **Negrito**, **Itálico**, **Sublinhado**, Listas, Alinhamento
- Campos: Título, Data da gravação, Status, Conteúdo
- Status dos roteiros: **Em elaboração**, **Pronto para gravação**, **Gravado**, **Finalizado**
- Cards com cor por status (azul / laranja / roxo / verde)
- Visualização completa do roteiro sem limite de tamanho
- Ações: Visualizar, Editar, Finalizar, Excluir
- Filtro por status

### ⚙️ Configurações

**Perfil**
- Editar nome de exibição e descrição
- Escolher cor do avatar (18 opções)
- Exibição do método de conexão (Google ou e-mail/senha)
- Troca e recuperação de senha (somente contas e-mail/senha)

**Categorias**
- Cadastrar categorias com **nome**, **cor livre** e **descrição opcional**
- Ativar / Desativar / Editar / Excluir categorias
- Categorias aparecem como dropdown na criação de tarefas
- Cor da categoria herdada automaticamente pela tarefa (sobrescrita opcional)
- Legenda do calendário gerada automaticamente

**Visualizações**
- Página inicial configurável (Dashboard, Calendário, Tarefas ou Roteiros)
- Primeiro dia da semana (Domingo ou Segunda)
- Mostrar / ocultar fins de semana no calendário
- Mostrar / ocultar tarefas concluídas nas listas
- Mostrar / ocultar indicadores de atraso
- Ativar / desativar cores de categoria nos cards
- Mostrar tarefas concluídas no calendário
- Reduzir brilho de eventos passados
- Mostrar número das semanas (padrão ISO)

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
├── styles.css          # Estilos globais (autenticação + app)
├── auth.js             # Lógica de autenticação (login, cadastro, Google)
├── app.js              # Lógica do app (dashboard, calendário, tarefas, roteiros, configurações)
├── firebase-config.js  # Configuração e inicialização do Firebase
└── README.md           # Este arquivo
```

---

## Estrutura do Banco de Dados (Firestore)

```
usuarios/
└── {uid}/
    ├── nome              string
    ├── bio               string
    ├── email             string
    ├── avatarCor         string (hex)
    ├── categorias        array de objetos { nome, cor, descricao, ativa }
    ├── prefs             objeto de preferências de visualização
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
    │       └── criadoEm     timestamp
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

---

## Regras de Segurança (Firestore)

Cada usuário só acessa os próprios dados. Cole no Firebase → Firestore → aba **Regras**:

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

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto.
2. Ative **Authentication** → E-mail/senha e Google.
3. Crie o **Firestore Database** em modo de teste.
4. Em **Configurações do projeto → Seus aplicativos**, registre um app Web e copie o `firebaseConfig`.
5. Cole os valores em `firebase-config.js`, substituindo os placeholders.
6. Em **Authentication → Settings → Domínios autorizados**, adicione `fagundes7828.github.io`.
7. Aplique as **Regras de Segurança** acima no Firestore.

---

## Design System

O projeto segue um **design system** consistente baseado em:

- **Glassmorphism** — vidro fosco com `backdrop-filter: blur()` e bordas translúcidas
- **Estilo iOS** — bordas arredondadas, sombras suaves, animações fluidas
- **Paleta** — gradiente azul-lavanda-rosa de fundo, azul `#0a84ff` como cor primária
- **Tipografia** — System UI (SF Pro no iOS/macOS, Segoe UI no Windows, Roboto no Android)
- **Responsividade** — menu lateral vira barra horizontal em mobile, grids se adaptam

---

## Módulos Desenvolvidos

| # | Módulo | Status |
|---|---|---|
| 1 | Autenticação (login, cadastro, Google) | ✅ Concluído |
| 2 | Dashboard (relógio, estatísticas, cards) | ✅ Concluído |
| 3 | Calendário (grade, hover, filtros, legenda) | ✅ Concluído |
| 4 | Configurações base (perfil, categorias) | ✅ Concluído |
| 5 | Tela de Tarefas (accordion, busca, contadores) | ✅ Concluído |
| 6A | Settings reestruturado (abas Perfil/Categorias/Visualizações) | ✅ Concluído |
| 6B | Roteiros (editor, cards, CRUD, visualização completa) | ✅ Concluído |

---

## Funcionalidades Planejadas (Futuras)

- [ ] Tema claro / escuro
- [ ] Visualização de semana no calendário
- [ ] Drag and drop de tarefas no calendário
- [ ] Vinculação de roteiros a tarefas e ao calendário
- [ ] Exportação de roteiros para PDF e Word
- [ ] Controle de versões dos roteiros
- [ ] Integração com Google Calendar
- [ ] Notificações de prazo
- [ ] Organização por projetos

---

## Autor

**Mateus Fagundes**
Criador de conteúdo e produtor — desenvolveu o MF Agenda como plataforma pessoal de organização para gestão de tarefas, roteiros de gravação e planejamento de conteúdo.

🔗 [github.com/Fagundes7828](https://github.com/Fagundes7828)
🌐 [fagundes7828.github.io/Gestordetarefas](https://fagundes7828.github.io/Gestordetarefas/)

---

*Desenvolvido com HTML, CSS e JavaScript puro — sem frameworks, sem dependências de build.*
