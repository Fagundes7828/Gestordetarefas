// =========================================================
//  MF Agenda — Lógica do Dashboard + Calendário
// =========================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut, updateProfile, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider }
  from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS  = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const PRIOR = { baixa:"Baixa", media:"Média", alta:"Alta", critica:"Crítica" };
const STATUS = { pendente:"Pendente", andamento:"Em andamento", concluida:"Concluída" };

let usuario = null;
let tarefas = [];
let editandoId = null;                 // id da tarefa em edição (null = nova)
let calRef = new Date();               // mês/ano em exibição no calendário

/* ---------------------------------------------------------
   Proteção da página + carregamento
--------------------------------------------------------- */
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  usuario = user;
  document.getElementById("sideUser").textContent = user.displayName || user.email;
  carregarPerfilUI();
  escutarCategorias();
  escutarTarefas();
});

window.sair = async () => { await signOut(auth); window.location.href = "index.html"; };

/* ---------------------------------------------------------
   Relógio ao vivo — fuso de Brasília (GMT-3)
--------------------------------------------------------- */
function brNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}
function tick() {
  const br = brNow();
  document.getElementById("ckWeekday").textContent = DIAS[br.getDay()];
  const mes = MESES[br.getMonth()];
  document.getElementById("ckDate").textContent =
    `${br.getDate()} de ${mes.charAt(0).toUpperCase()+mes.slice(1)} de ${br.getFullYear()}`;
  const p = n => String(n).padStart(2,"0");
  document.getElementById("ckTime").textContent = `${p(br.getHours())}:${p(br.getMinutes())}:${p(br.getSeconds())}`;
}
setInterval(tick, 1000); tick();

function dataHojeISO() { return brNow().toISOString().slice(0,10); }

/* ---------------------------------------------------------
   Navegação entre páginas
--------------------------------------------------------- */
window.goPage = function (page) {
  document.querySelectorAll(".menu-item[data-page]").forEach(b =>
    b.classList.toggle("active", b.dataset.page === page));
  document.querySelectorAll(".page").forEach(p =>
    p.classList.toggle("active", p.id === "page-" + page));
  if (page === "calendario") { calRef = brNow(); renderCalendar(); }
  if (page === "tarefas") { accAberta = null; aplicarEstadoAcc(); }
};

/* ---------------------------------------------------------
   Firestore: escuta em tempo real
--------------------------------------------------------- */
function escutarTarefas() {
  const ref = collection(db, "usuarios", usuario.uid, "tarefas");
  const q = query(ref, orderBy("criadoEm", "desc"));
  onSnapshot(q, (snap) => {
    tarefas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
    if (document.getElementById("page-calendario").classList.contains("active")) renderCalendar();
  }, (err) => console.error("Erro ao ler tarefas:", err));
}

/* ---------------------------------------------------------
   MODAL DE TAREFA (criar e editar)
--------------------------------------------------------- */
window.openTaskModal = function (tarefa = null) {
  editandoId = tarefa ? tarefa.id : null;
  document.getElementById("modalTitle").textContent = tarefa ? "Editar Tarefa" : "Nova Tarefa";
  document.getElementById("btnSaveTask").textContent = "Salvar";
  document.getElementById("taskAlert").className = "alert";

  const g = id => document.getElementById(id);
  g("tkTitle").value = tarefa?.titulo || "";
  g("tkDesc").value = tarefa?.descricao || "";
  g("tkPriority").value = tarefa?.prioridade || "media";
  g("tkStart").value = tarefa?.inicio || dataHojeISO();
  g("tkDue").value = tarefa?.conclusao || dataHojeISO();
  g("tkTime").value = tarefa?.hora || "";
  g("tkStatus").value = tarefa?.status || "pendente";
  g("tkProject").value = tarefa?.projeto || "";

  // Categoria (dropdown) + cor herdada
  montarCatDropdown();
  definirCategoriaSelecionada(tarefa?.categoria || "");
  g("tkColor").value = tarefa?.cor || categoriaCor(tarefa?.categoria) || "#0a84ff";

  document.getElementById("taskOverlay").style.display = "flex";
};
window.closeTaskModal = () => {
  document.getElementById("taskOverlay").style.display = "none";
  document.getElementById("catDropdown")?.classList.remove("open");
  editandoId = null;
};

window.saveTask = async function () {
  const titulo = document.getElementById("tkTitle").value.trim();
  const categoria = document.getElementById("tkCat").value.trim();
  const a = document.getElementById("taskAlert");

  if (!titulo) { a.textContent = "Dê um título à tarefa."; a.className = "alert show error"; return; }
  if (!categoria) { a.textContent = "Selecione uma categoria. Cadastre categorias em Configurações."; a.className = "alert show error"; return; }

  const dados = {
    titulo,
    descricao: document.getElementById("tkDesc").value.trim(),
    categoria,
    prioridade: document.getElementById("tkPriority").value,
    inicio: document.getElementById("tkStart").value || null,
    conclusao: document.getElementById("tkDue").value || null,
    hora: document.getElementById("tkTime").value || null,
    status: document.getElementById("tkStatus").value,
    projeto: document.getElementById("tkProject").value.trim() || null,
    cor: document.getElementById("tkColor").value || "#0a84ff"
  };
  const btn = document.getElementById("btnSaveTask");
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    if (editandoId) {
      await updateDoc(doc(db, "usuarios", usuario.uid, "tarefas", editandoId), dados);
    } else {
      dados.criadoEm = serverTimestamp();
      await addDoc(collection(db, "usuarios", usuario.uid, "tarefas"), dados);
    }
    closeTaskModal();
  } catch (err) {
    console.error(err);
    const a = document.getElementById("taskAlert");
    a.textContent = "Não foi possível salvar. Veja as regras do Firestore.";
    a.className = "alert show error";
  } finally { btn.disabled = false; btn.textContent = "Salvar"; }
};

/* ---------------------------------------------------------
   AÇÕES sobre tarefas
--------------------------------------------------------- */
window.concluir = async (id) => {
  try { await updateDoc(doc(db, "usuarios", usuario.uid, "tarefas", id), { status: "concluida" }); }
  catch (err) { console.error(err); }
};
window.excluir = async (id) => {
  if (!confirm("Excluir esta tarefa? Esta ação não pode ser desfeita.")) return;
  try { await deleteDoc(doc(db, "usuarios", usuario.uid, "tarefas", id)); closeDayModal(); }
  catch (err) { console.error(err); }
};
window.duplicar = async (id) => {
  const t = tarefas.find(x => x.id === id); if (!t) return;
  const copia = { ...t, titulo: t.titulo + " (cópia)", criadoEm: serverTimestamp() };
  delete copia.id;
  try { await addDoc(collection(db, "usuarios", usuario.uid, "tarefas"), copia); }
  catch (err) { console.error(err); }
};
window.editarTarefa = (id) => {
  const t = tarefas.find(x => x.id === id); if (!t) return;
  closeDayModal(); openTaskModal(t);
};

/* ---------------------------------------------------------
   Cálculo de atraso (dashboard)
--------------------------------------------------------- */
function diasDeAtraso(iso) {
  if (!iso) return null;
  return Math.round((new Date(dataHojeISO()) - new Date(iso)) / 86400000);
}
function textoAtraso(dias) {
  if (dias === null) return "";
  if (dias < 0) {
    const f = Math.abs(dias);
    if (f === 1) return "falta 1 dia";
    if (f < 7) return `faltam ${f} dias`;
    if (f < 30) return `faltam ${Math.floor(f/7)} semana(s)`;
    return `faltam ${Math.floor(f/30)} mês(es)`;
  }
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "atrasada há 1 dia";
  if (dias < 7) return `atrasada há ${dias} dias`;
  if (dias < 30) { const s = Math.floor(dias/7); return `atrasada há ${s} semana${s>1?'s':''}`; }
  if (dias < 365) { const m = Math.floor(dias/30); return `atrasada há ${m} mês${m>1?'es':''}`; }
  const y = Math.floor(dias/365); return `atrasada há ${y} ano${y>1?'s':''}`;
}
function nivel(t) {
  if (t.status === "concluida") return "green";
  const d = diasDeAtraso(t.conclusao);
  if (d === null) return "green";
  if (d > 0) return t.prioridade === "critica" ? "critical" : "red";
  if (d >= -2) return "yellow";
  return "green";
}

/* ---------------------------------------------------------
   RENDER DO DASHBOARD (resumo + cards)
--------------------------------------------------------- */
function render() {
  const total = tarefas.length;
  const concluidas = tarefas.filter(t => t.status === "concluida").length;
  const pendentes  = tarefas.filter(t => t.status !== "concluida").length;
  const atrasadas  = tarefas.filter(t => t.status !== "concluida" && diasDeAtraso(t.conclusao) > 0).length;
  const taxa = total ? (concluidas/total*100) : 0;

  document.getElementById("stTotal").textContent = total;
  document.getElementById("stDone").textContent = concluidas;
  document.getElementById("stPend").textContent = pendentes;
  document.getElementById("stLate").textContent = atrasadas;
  document.getElementById("stRate").textContent = taxa.toFixed(2).replace('.', ',') + "%";
  document.getElementById("stBar").style.width = taxa + "%";

  const pend = tarefas.filter(t => t.status !== "concluida")
    .sort((a,b) => (diasDeAtraso(b.conclusao)||-9999) - (diasDeAtraso(a.conclusao)||-9999));
  renderCards("pendCards", pend, "Nenhuma tarefa pendente. Tudo em dia! 🎉");
  document.getElementById("pendCount").textContent = pend.length ? `${pend.length} item(ns)` : "";

  // Atualiza a tela de Tarefas (accordion + contadores)
  renderTarefasAccordion();
}
function renderCards(containerId, lista, vazio) {
  const box = document.getElementById(containerId); box.innerHTML = "";
  if (!lista.length) { box.innerHTML = `<div class="empty-state"><div class="big">🗂️</div>${vazio}</div>`; return; }
  lista.forEach(t => box.appendChild(card(t)));
}
function card(t) {
  const lv = nivel(t); const d = diasDeAtraso(t.conclusao);
  const statusCls = { pendente:"st-pendente", andamento:"st-andamento", concluida:"st-concluida" }[t.status] || "st-pendente";
  const el = document.createElement("div");
  el.className = "task-card lv-" + lv;
  el.style.borderLeftColor = t.cor || "var(--blue)";
  const dueTxt = t.conclusao ? new Date(t.conclusao).toLocaleDateString("pt-BR",{timeZone:"UTC"}) : "sem prazo";
  el.innerHTML = `
    <button class="tc-check" title="Marcar como concluída">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="tc-head"><div class="tc-title"></div><span class="tc-cat"></span></div>
    <div class="tc-due">📅 ${dueTxt}${t.hora ? " · "+t.hora : ""}</div>
    <div class="tc-body"></div>
    <div class="tc-foot">
      <span class="tc-status ${statusCls}">${STATUS[t.status]||t.status}</span>
      <span class="tc-late ${lv}">${t.status==="concluida" ? "✓ concluída" : textoAtraso(d)}</span>
    </div>`;
  el.querySelector(".tc-title").textContent = t.titulo;
  el.querySelector(".tc-cat").textContent = t.categoria || "Geral";
  el.querySelector(".tc-body").textContent = t.descricao || "Sem descrição.";
  if (t.status !== "concluida") el.querySelector(".tc-check").onclick = () => concluir(t.id);
  else el.querySelector(".tc-check").style.display = "none";
  return el;
}

/* =========================================================
   CALENDÁRIO
   ========================================================= */
window.navCal = function (tipo, delta) {
  if (tipo === "today") calRef = brNow();
  else if (tipo === "month") calRef.setMonth(calRef.getMonth() + delta);
  else if (tipo === "year") calRef.setFullYear(calRef.getFullYear() + delta);
  renderCalendar();
};

// Aplica os filtros escolhidos
function tarefasFiltradas() {
  const fS = document.getElementById("fltStatus").value;
  const fP = document.getElementById("fltPriority").value;
  const fC = document.getElementById("fltCat").value;
  const fJ = document.getElementById("fltProject").value.trim().toLowerCase();
  return tarefas.filter(t => {
    if (fS && t.status !== fS) return false;
    if (fP && t.prioridade !== fP) return false;
    if (fC && (t.categoria||"") !== fC) return false;
    if (fJ && !(t.projeto||"").toLowerCase().includes(fJ)) return false;
    return true;
  });
}

// Monta um mapa: dia (YYYY-MM-DD) -> lista de ocorrências {tarefa, tipo}
function ocorrenciasPorDia(lista) {
  const mapa = {};
  const push = (iso, t, tipo) => {
    if (!iso) return;
    (mapa[iso] = mapa[iso] || []).push({ ...t, _edge: tipo });
  };
  lista.forEach(t => {
    push(t.inicio, t, "inicio");
    if (t.conclusao && t.conclusao !== t.inicio) push(t.conclusao, t, "fim");
  });
  return mapa;
}

window.renderCalendar = function () {
  const y = calRef.getFullYear(), m = calRef.getMonth();
  document.getElementById("calTitle").textContent =
    MESES[m].charAt(0).toUpperCase()+MESES[m].slice(1) + " " + y;

  const mapa = ocorrenciasPorDia(tarefasFiltradas());
  const grid = document.getElementById("calGrid"); grid.innerHTML = "";

  const firstDay = new Date(y, m, 1).getDay();
  const diasNoMes = new Date(y, m+1, 0).getDate();
  const diasMesAnt = new Date(y, m, 0).getDate();
  const hojeISO = dataHojeISO();

  for (let i=firstDay-1; i>=0; i--) grid.appendChild(celulaMuda(diasMesAnt-i));
  for (let d=1; d<=diasNoMes; d++) {
    const iso = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    grid.appendChild(celula(d, iso, mapa[iso]||[], iso===hojeISO));
  }
  const restantes = (7 - ((firstDay+diasNoMes)%7))%7;
  for (let d=1; d<=restantes; d++) grid.appendChild(celulaMuda(d));
};

function celulaMuda(num) {
  const c = document.createElement("div");
  c.className = "cal-cell muted";
  c.innerHTML = `<div class="cal-num">${num}</div>`;
  return c;
}

function celula(dia, iso, evs, hoje) {
  const c = document.createElement("div");
  c.className = "cal-cell" + (hoje ? " today" : "");
  c.innerHTML = `<div class="cal-num">${dia}</div>`;

  const box = document.createElement("div");
  box.className = "cal-evs";
  evs.slice(0,3).forEach(ev => {
    const tag = document.createElement("div");
    tag.className = "cal-ev";
    tag.style.background = ev.cor || "#0a84ff";
    const edge = ev._edge === "fim" ? "🏁" : "▶";
    tag.innerHTML = `<span class="edge">${edge}</span><span></span>`;
    tag.querySelector("span:last-child").textContent = ev.titulo;
    box.appendChild(tag);
  });
  if (evs.length > 3) {
    const more = document.createElement("div");
    more.className = "cal-more";
    more.textContent = `+${evs.length-3} tarefa(s)`;
    box.appendChild(more);
  }
  c.appendChild(box);

  // Clique / toque → abre o detalhe do dia
  c.onclick = () => openDayModal(iso, evs);

  // Hover (somente PC): pop-up rápido + expandido após 5s
  if (window.matchMedia("(hover: hover)").matches && evs.length) {
    let timer = null;
    c.addEventListener("mouseenter", (e) => {
      mostrarPopover(e, iso, evs, false);
      timer = setTimeout(() => mostrarPopover(e, iso, evs, true), 5000);
    });
    c.addEventListener("mousemove", (e) => posicionarPopover(e));
    c.addEventListener("mouseleave", () => { clearTimeout(timer); esconderPopover(); });
  }
  return c;
}

/* ---------- Pop-over de hover ---------- */
const popover = () => document.getElementById("calPopover");
function posicionarPopover(e) {
  const p = popover();
  let x = e.clientX + 16, y = e.clientY + 16;
  const r = p.getBoundingClientRect();
  if (x + r.width > window.innerWidth) x = e.clientX - r.width - 16;
  if (y + r.height > window.innerHeight) y = window.innerHeight - r.height - 12;
  p.style.left = x + "px"; p.style.top = y + "px";
}
function mostrarPopover(e, iso, evs, expandido) {
  const p = popover();
  const [yy,mm,dd] = iso.split("-");
  let html = `<div class="pop-title">${dd}/${mm} — ${evs.length} tarefa(s)</div>`;
  const lista = expandido ? evs : evs.slice(0,3);
  lista.forEach(ev => {
    html += `<div class="pop-ev">
      <div class="pe-top"><span class="pe-dot" style="background:${ev.cor||'#0a84ff'}"></span>
      <span class="pe-name">${escapar(ev.titulo)}</span></div>
      <div class="pe-meta">${escapar(ev.categoria||'Geral')} · ${PRIOR[ev.prioridade]||''} · ${STATUS[ev.status]||''}${ev.hora? ' · '+ev.hora : ''}</div>
      ${expandido && ev.descricao ? `<div class="pe-desc">${escapar(ev.descricao)}</div>` : ''}
      ${ev.conclusao ? `<div class="pe-meta">Conclusão: ${new Date(ev.conclusao).toLocaleDateString('pt-BR',{timeZone:'UTC'})}</div>` : ''}
    </div>`;
  });
  if (!expandido && evs.length > 3) html += `<div class="pe-meta" style="padding-top:6px">+${evs.length-3} — passe 5s para ver tudo</div>`;
  p.innerHTML = html;
  p.classList.toggle("expanded", expandido);
  p.style.display = "block";
  posicionarPopover(e);
}
function esconderPopover() { const p = popover(); p.style.display = "none"; p.classList.remove("expanded"); }

/* ---------- Modal de detalhes do dia ---------- */
window.openDayModal = function (iso, evs) {
  esconderPopover();
  const dObj = new Date(iso + "T00:00:00");
  const [yy,mm,dd] = iso.split("-");
  document.getElementById("dayTitle").textContent = `${dd} de ${MESES[+mm-1]} de ${yy}`;
  document.getElementById("dayWeekday").textContent = DIAS[dObj.getDay()];
  document.getElementById("dayCount").textContent = `${evs.length} tarefa(s)`;

  const body = document.getElementById("dayBody"); body.innerHTML = "";
  if (!evs.length) {
    body.innerHTML = `<div class="empty-state"><div class="big">🗓️</div>Nenhuma tarefa neste dia.<br><br>
      <button class="btn btn-primary" style="max-width:200px;margin:0 auto" onclick="closeDayModal();openTaskModal()">Criar tarefa</button></div>`;
  } else {
    evs.forEach(ev => body.appendChild(dayTaskCard(ev)));
  }
  document.getElementById("dayOverlay").style.display = "flex";
};
window.closeDayModal = () => { document.getElementById("dayOverlay").style.display = "none"; };

function dayTaskCard(t) {
  const el = document.createElement("div");
  el.className = "day-task";
  el.style.borderLeftColor = t.cor || "#0a84ff";
  const criado = t.criadoEm?.toDate ? t.criadoEm.toDate().toLocaleDateString("pt-BR") : "—";
  const concl = t.conclusao ? new Date(t.conclusao).toLocaleDateString("pt-BR",{timeZone:"UTC"}) : "—";
  el.innerHTML = `
    <div class="dt-top">
      <div class="dt-name"></div>
      <span class="dt-badge" style="background:${t.cor||'#0a84ff'};color:#fff">${t._edge==="fim"?"Conclusão":"Início"}</span>
    </div>
    <div class="dt-badges">
      <span class="dt-badge"></span>
      <span class="dt-badge">${PRIOR[t.prioridade]||t.prioridade}</span>
      <span class="dt-badge">${STATUS[t.status]||t.status}</span>
      ${t.hora ? `<span class="dt-badge">🕐 ${t.hora}</span>` : ""}
      ${t.projeto ? `<span class="dt-badge">📁 ${escapar(t.projeto)}</span>` : ""}
    </div>
    <div class="dt-desc"></div>
    <div class="dt-info">Criada em ${criado} · Conclusão prevista: ${concl}</div>
    <div class="dt-actions">
      <button class="dt-btn dt-edit">✎ Editar</button>
      ${t.status!=="concluida" ? `<button class="dt-btn dt-done">✓ Concluir</button>` : ""}
      <button class="dt-btn dt-dup">⧉ Duplicar</button>
      <button class="dt-btn dt-del">🗑 Excluir</button>
    </div>`;
  el.querySelector(".dt-name").textContent = t.titulo;
  el.querySelector(".dt-badges .dt-badge").textContent = t.categoria || "Geral";
  el.querySelector(".dt-desc").textContent = t.descricao || "Sem descrição.";
  el.querySelector(".dt-edit").onclick = () => editarTarefa(t.id);
  if (t.status!=="concluida") el.querySelector(".dt-done").onclick = () => { concluir(t.id); closeDayModal(); };
  el.querySelector(".dt-dup").onclick = () => duplicar(t.id);
  el.querySelector(".dt-del").onclick = () => excluir(t.id);
  return el;
}

function escapar(s) {
  return String(s||"").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

/* ---------- Fechar modais (clique fora / Esc) ---------- */
document.getElementById("taskOverlay").addEventListener("click", e => { if (e.target.id==="taskOverlay") closeTaskModal(); });
document.getElementById("dayOverlay").addEventListener("click", e => { if (e.target.id==="dayOverlay") closeDayModal(); });
document.addEventListener("keydown", e => { if (e.key==="Escape"){ closeTaskModal(); closeDayModal(); } });

/* =========================================================
   MÓDULO 4 — CONFIGURAÇÕES
   ========================================================= */

let avatarCor = "#0a84ff";
let categorias = [];

function iniciais(nome) {
  if (!nome) return "MF";
  return nome.trim().split(/\s+/).map(p => p[0]).slice(0,2).join("").toUpperCase();
}

function cfgAlert(msg, tipo) {
  const a = document.getElementById("cfgAlert");
  a.textContent = msg;
  a.className = "cfg-alert show " + (tipo === "ok" ? "ok" : "error");
  setTimeout(() => { a.className = "cfg-alert"; }, 4000);
}

/* ---------- Carrega o perfil na tela ---------- */
function carregarPerfilUI() {
  const nome = usuario.displayName || "";
  document.getElementById("cfgName").value = nome;
  document.getElementById("cfgEmail").value = usuario.email || "(conta sem e-mail)";

  const ini = iniciais(nome || usuario.email);
  document.getElementById("sideAvatar").textContent = ini;
  document.getElementById("cfgAvatar").textContent = ini;

  // Detecta se entrou com Google (some o bloco de senha)
  const ehGoogle = usuario.providerData.some(p => p.providerId === "google.com");
  const temSenha = usuario.providerData.some(p => p.providerId === "password");
  document.getElementById("passBlock").style.display = temSenha && !ehGoogle ? "block" : (temSenha ? "block" : "none");

  // Cor do avatar salva (no Firestore)
  montarGridCores();
  getDoc(doc(db, "usuarios", usuario.uid)).then(snap => {
    const c = snap.exists() && snap.data().avatarCor;
    if (c) {
      avatarCor = c;
      aplicarAvatarCor(c);   // ao carregar, aplica em menu + preview (é a cor já salva)
      montarGridCores();
    } else {
      aplicarAvatarCor(avatarCor);
    }
  }).catch(()=>{});
}

function aplicarAvatarCor(cor) {
  // aplica em AMBOS (menu + preview) — usado só ao carregar e ao salvar
  const grad = `linear-gradient(145deg, ${cor}, ${escurece(cor)})`;
  document.getElementById("sideAvatar").style.background = grad;
  document.getElementById("cfgAvatar").style.background = grad;
  const dot = document.getElementById("colorTriggerDot");
  if (dot) dot.style.background = grad;
}
function previewAvatarCor(cor) {
  // #04: aplica SÓ no preview das Configurações (não mexe no menu até salvar)
  const grad = `linear-gradient(145deg, ${cor}, ${escurece(cor)})`;
  document.getElementById("cfgAvatar").style.background = grad;
  const dot = document.getElementById("colorTriggerDot");
  if (dot) dot.style.background = grad;
}
// Escurece qualquer cor hex em ~18% (para o degradê) — funciona com a paleta toda
function escurece(hex) {
  hex = (hex || "#0a84ff").replace("#","");
  if (hex.length === 3) hex = hex.split("").map(c=>c+c).join("");
  let r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  const f = 0.82;
  r = Math.round(r*f); g = Math.round(g*f); b = Math.round(b*f);
  return "#" + [r,g,b].map(v => v.toString(16).padStart(2,"0")).join("");
}

/* ---------- #05: Paleta grande + pop-up de cores ---------- */
const PALETA_AVATAR = [
  "#0a84ff","#5e5ce6","#bf5af2","#ff2d55","#ff3b30","#ff9500",
  "#ffcc00","#34c759","#30d158","#00c7be","#64d2ff","#5856d6",
  "#af52de","#ff6482","#a2845e","#8e8e93","#48484a","#1c1c1e"
];

function montarGridCores() {
  const grid = document.getElementById("colorGrid");
  if (!grid) return;
  grid.innerHTML = "";
  PALETA_AVATAR.forEach(cor => {
    const o = document.createElement("div");
    o.className = "color-opt" + (cor === avatarCor ? " sel" : "");
    o.style.background = `linear-gradient(145deg, ${cor}, ${escurece(cor)})`;
    o.dataset.c = cor;
    o.title = cor;
    o.onclick = () => escolherCor(cor);
    grid.appendChild(o);
  });
}

window.toggleColorPopup = function (ev) {
  if (ev) ev.stopPropagation();
  const picker = document.querySelector(".color-picker");
  picker.classList.toggle("open");
};

function escolherCor(cor) {
  avatarCor = cor;                       // cor pendente
  previewAvatarCor(cor);                 // #04: só preview, não mexe no menu
  document.querySelectorAll(".color-opt").forEach(o => o.classList.toggle("sel", o.dataset.c === cor));
  document.querySelector(".color-picker").classList.remove("open");
}

// fecha pop-ups ao clicar fora (seletor de cor + dropdown de categoria)
document.addEventListener("click", (e) => {
  const picker = document.querySelector(".color-picker");
  if (picker && picker.classList.contains("open") && !picker.contains(e.target)) {
    picker.classList.remove("open");
  }
  const dd = document.getElementById("catDropdown");
  if (dd && dd.classList.contains("open") && !dd.contains(e.target)) {
    dd.classList.remove("open");
  }
});

/* ---------- Salvar nome + cor do avatar ---------- */
window.salvarPerfil = async function () {
  const nome = document.getElementById("cfgName").value.trim();
  if (!nome) return cfgAlert("Digite um nome.", "error");

  const btn = document.getElementById("btnSaveProfile");
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    await updateProfile(usuario, { displayName: nome });
    await setDoc(doc(db, "usuarios", usuario.uid), { nome, avatarCor }, { merge: true });
    document.getElementById("sideUser").textContent = nome;
    const ini = iniciais(nome);
    document.getElementById("sideAvatar").textContent = ini;
    document.getElementById("cfgAvatar").textContent = ini;
    aplicarAvatarCor(avatarCor);   // #04: só agora a cor entra no MENU lateral
    cfgAlert("Perfil salvo com sucesso!", "ok");
  } catch (err) {
    console.error(err);
    cfgAlert("Não foi possível salvar o perfil.", "error");
  } finally { btn.disabled = false; btn.textContent = "Salvar perfil"; }
};

/* ---------- Trocar senha ---------- */
window.trocarSenha = async function () {
  const atual = document.getElementById("cfgPass1").value;
  const nova  = document.getElementById("cfgPass2").value;
  if (!atual || !nova) return cfgAlert("Preencha a senha atual e a nova.", "error");
  if (nova.length < 6) return cfgAlert("A nova senha precisa ter no mínimo 6 caracteres.", "error");

  const btn = document.getElementById("btnSavePass");
  btn.disabled = true; btn.textContent = "Atualizando...";
  try {
    // Reautentica (o Firebase exige login recente para trocar senha)
    const cred = EmailAuthProvider.credential(usuario.email, atual);
    await reauthenticateWithCredential(usuario, cred);
    await updatePassword(usuario, nova);
    document.getElementById("cfgPass1").value = "";
    document.getElementById("cfgPass2").value = "";
    cfgAlert("Senha atualizada com sucesso!", "ok");
  } catch (err) {
    console.error(err);
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password")
      cfgAlert("A senha atual está incorreta.", "error");
    else if (err.code === "auth/too-many-requests")
      cfgAlert("Muitas tentativas. Tente novamente mais tarde.", "error");
    else cfgAlert("Não foi possível trocar a senha.", "error");
  } finally { btn.disabled = false; btn.textContent = "Atualizar senha"; }
};

/* ---------- Categorias (Firestore, tempo real) — modelo novo ---------- */
// Cada categoria: { nome, cor, descricao, ativa }
function normalizarCategorias(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(c => {
    if (typeof c === "string") return { nome: c, cor: "#0a84ff", descricao: "", ativa: true };
    return { nome: c.nome || "", cor: c.cor || "#0a84ff", descricao: c.descricao || "", ativa: c.ativa !== false };
  }).filter(c => c.nome);
}

function escutarCategorias() {
  const ref = doc(db, "usuarios", usuario.uid);
  onSnapshot(ref, (snap) => {
    categorias = normalizarCategorias(snap.exists() && snap.data().categorias);
    renderCategorias();
    montarFiltroCategorias();
    renderLegenda();
    // se a tela de tarefas/calendário estiver aberta, atualiza
    if (document.getElementById("page-calendario")?.classList.contains("active")) renderCalendar();
  }, (err) => console.error("Erro ao ler categorias:", err));
}

// busca a cor de uma categoria pelo nome
function categoriaCor(nome) {
  const c = categorias.find(x => x.nome === nome);
  return c ? c.cor : null;
}

function renderCategorias() {
  const box = document.getElementById("catsList");
  if (!box) return;
  box.innerHTML = "";
  if (!categorias.length) {
    box.innerHTML = `<span class="cats-empty">Nenhuma categoria ainda. Cadastre abaixo. 👇</span>`;
    return;
  }
  categorias.forEach((c, idx) => {
    const el = document.createElement("div");
    el.className = "cat-item" + (c.ativa ? "" : " inativa");
    el.innerHTML = `
      <span class="ci-dot" style="background:${c.cor}"></span>
      <div class="ci-texts">
        <div class="ci-nome"></div>
        ${c.descricao ? `<div class="ci-desc"></div>` : ""}
      </div>
      <button class="ci-toggle ${c.ativa ? "on" : "off"}">${c.ativa ? "Ativa" : "Inativa"}</button>
      <button class="ci-del" title="Remover">✕</button>`;
    el.querySelector(".ci-nome").textContent = c.nome;
    if (c.descricao) el.querySelector(".ci-desc").textContent = c.descricao;
    el.querySelector(".ci-toggle").onclick = () => toggleCategoriaAtiva(idx);
    el.querySelector(".ci-del").onclick = () => removerCategoria(idx);
    box.appendChild(el);
  });
}

async function salvarCategorias(novas) {
  try {
    await setDoc(doc(db, "usuarios", usuario.uid), { categorias: novas }, { merge: true });
  } catch (err) { console.error(err); cfgAlert("Não foi possível salvar as categorias.", "error"); }
}

window.addCategoria = async function () {
  const nomeEl = document.getElementById("catNome");
  const nome = nomeEl.value.trim();
  const cor = document.getElementById("catCor").value || "#0a84ff";
  const descricao = document.getElementById("catDesc").value.trim();
  if (!nome) return cfgAlert("Digite o nome da categoria.", "error");
  if (categorias.some(c => c.nome.toLowerCase() === nome.toLowerCase()))
    return cfgAlert("Essa categoria já existe.", "error");

  await salvarCategorias([...categorias, { nome, cor, descricao, ativa: true }]);
  nomeEl.value = ""; document.getElementById("catDesc").value = "";
  cfgAlert("Categoria adicionada!", "ok");
};

function toggleCategoriaAtiva(idx) {
  const novas = categorias.map((c, i) => i === idx ? { ...c, ativa: !c.ativa } : c);
  salvarCategorias(novas);
}

function removerCategoria(idx) {
  const c = categorias[idx];
  if (!confirm(`Remover a categoria "${c.nome}"? As tarefas que a usam continuarão existindo.`)) return;
  salvarCategorias(categorias.filter((_, i) => i !== idx));
}

/* ---------- Dropdown de categoria no modal de tarefa ---------- */
let buscaCatDropdown = "";

window.toggleCatDropdown = function (ev) {
  if (ev) ev.stopPropagation();
  const dd = document.getElementById("catDropdown");
  dd.classList.toggle("open");
  if (dd.classList.contains("open")) {
    buscaCatDropdown = "";
    document.getElementById("catDdSearch").value = "";
    montarCatDropdown();
    setTimeout(() => document.getElementById("catDdSearch").focus(), 50);
  }
};

window.filtrarCatDropdown = function () {
  buscaCatDropdown = document.getElementById("catDdSearch").value.trim().toLowerCase();
  montarCatDropdown();
};

function montarCatDropdown() {
  const list = document.getElementById("catDdList");
  if (!list) return;
  const ativas = categorias.filter(c => c.ativa &&
    c.nome.toLowerCase().includes(buscaCatDropdown));
  list.innerHTML = "";
  if (!categorias.filter(c => c.ativa).length) {
    list.innerHTML = `<div class="cat-dd-empty">Nenhuma categoria. Cadastre em Configurações.</div>`;
    return;
  }
  if (!ativas.length) { list.innerHTML = `<div class="cat-dd-empty">Nada encontrado.</div>`; return; }
  ativas.forEach(c => {
    const o = document.createElement("div");
    o.className = "cat-dd-opt";
    o.innerHTML = `<span class="dd-dot" style="background:${c.cor}"></span><span></span>`;
    o.querySelector("span:last-child").textContent = c.nome;
    o.onclick = () => { definirCategoriaSelecionada(c.nome); document.getElementById("catDropdown").classList.remove("open"); };
    list.appendChild(o);
  });
}

// Define a categoria escolhida (atualiza hidden, visual e cor herdada)
function definirCategoriaSelecionada(nome) {
  document.getElementById("tkCat").value = nome || "";
  const cur = document.getElementById("catDdCurrent");
  const cor = categoriaCor(nome);
  if (nome) {
    cur.classList.remove("placeholder");
    cur.innerHTML = `<span class="dd-dot" style="background:${cor||'#0a84ff'}"></span><span></span>`;
    cur.querySelector("span:last-child").textContent = nome;
    // herda a cor da categoria automaticamente
    if (cor) document.getElementById("tkColor").value = cor;
  } else {
    cur.classList.add("placeholder");
    cur.textContent = "Selecione...";
  }
}

/* ---------- Filtro de categoria (calendário) ---------- */
function montarFiltroCategorias() {
  const sel = document.getElementById("fltCat");
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = `<option value="">Categoria: todas</option>` +
    categorias.map(c => `<option value="${escapar(c.nome)}">${escapar(c.nome)}</option>`).join("");
  sel.value = atual; // mantém seleção se ainda existir
}

/* ---------- Legenda automática (calendário) ---------- */
function renderLegenda() {
  const box = document.getElementById("calLegendList");
  if (!box) return;
  box.innerHTML = "";
  if (!categorias.length) {
    box.innerHTML = `<div class="lg-empty">Cadastre categorias para ver a legenda.</div>`;
    return;
  }
  categorias.forEach(c => {
    const el = document.createElement("div");
    el.className = "lg-item" + (c.ativa ? "" : " inativa");
    el.innerHTML = `<span class="dot" style="background:${c.cor}"></span><span></span>`;
    el.querySelector("span:last-child").textContent = c.nome;
    box.appendChild(el);
  });
}

/* =========================================================
   MÓDULO 5 — TELA DE TAREFAS (accordion + busca + cards clicáveis)
   ========================================================= */

// Qual categoria está aberta no accordion (null = todas recolhidas)
let accAberta = null;

/* ---------- Clique nos cards de estatística do Dashboard ---------- */
window.irParaTarefas = function (categoria) {
  goPage("tarefas");
  // "todas" abre Todas; demais abrem a categoria correspondente
  abrirAcc(categoria);
};

/* ---------- Abrir/fechar uma categoria ---------- */
window.toggleAcc = function (cat) {
  if (accAberta === cat) { accAberta = null; }   // clicou na já aberta → recolhe
  else { accAberta = cat; }                       // abre essa e recolhe as outras
  aplicarEstadoAcc();
};
function abrirAcc(cat) {
  accAberta = cat;
  aplicarEstadoAcc();
  // rola suavemente até a categoria aberta
  setTimeout(() => {
    const g = document.querySelector(`.acc-group[data-cat="${cat}"]`);
    if (g) g.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}
function aplicarEstadoAcc() {
  document.querySelectorAll(".acc-group").forEach(g =>
    g.classList.toggle("open", g.dataset.cat === accAberta));
}

/* ---------- Busca ---------- */
window.limparBusca = function () {
  document.getElementById("taskSearch").value = "";
  renderTarefasAccordion();
};

function filtrarBusca(lista) {
  const termo = document.getElementById("taskSearch")?.value.trim().toLowerCase() || "";
  document.getElementById("searchClear").style.display = termo ? "block" : "none";
  if (!termo) return lista;
  return lista.filter(t =>
    (t.titulo||"").toLowerCase().includes(termo) ||
    (t.categoria||"").toLowerCase().includes(termo) ||
    (t.projeto||"").toLowerCase().includes(termo) ||
    (t.descricao||"").toLowerCase().includes(termo)
  );
}

/* ---------- Render do accordion + contadores ---------- */
window.renderTarefasAccordion = function () {
  const base = filtrarBusca(tarefas);

  const grupos = {
    todas:     base,
    pendente:  base.filter(t => t.status === "pendente" || t.status === "andamento"),
    concluida: base.filter(t => t.status === "concluida"),
    atrasada:  base.filter(t => t.status !== "concluida" && diasDeAtraso(t.conclusao) > 0)
  };

  // contadores em tempo real
  document.getElementById("cntTodas").textContent = grupos.todas.length;
  document.getElementById("cntPendente").textContent = grupos.pendente.length;
  document.getElementById("cntConcluida").textContent = grupos.concluida.length;
  document.getElementById("cntAtrasada").textContent = grupos.atrasada.length;

  // cards de cada grupo
  preencheGrupo("cardsTodas", grupos.todas, "Nenhuma tarefa cadastrada.");
  preencheGrupo("cardsPendente", grupos.pendente, "Nenhuma tarefa pendente.");
  preencheGrupo("cardsConcluida", grupos.concluida, "Nenhuma tarefa concluída ainda.");
  preencheGrupo("cardsAtrasada", grupos.atrasada, "Nenhuma tarefa atrasada. 🎉");
};

function preencheGrupo(containerId, lista, vazio) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.innerHTML = "";
  if (!lista.length) { box.innerHTML = `<div class="acc-empty">${vazio}</div>`; return; }
  lista.forEach(t => box.appendChild(cardTarefa(t)));
}

/* ---------- Card da tarefa (com ações) ---------- */
function cardTarefa(t) {
  const lv = nivel(t);
  const d = diasDeAtraso(t.conclusao);
  const statusCls = { pendente:"st-pendente", andamento:"st-andamento", concluida:"st-concluida" }[t.status] || "st-pendente";
  const criado = t.criadoEm?.toDate ? t.criadoEm.toDate().toLocaleDateString("pt-BR") : "—";
  const limite = t.conclusao ? new Date(t.conclusao).toLocaleDateString("pt-BR",{timeZone:"UTC"}) : "sem prazo";

  const el = document.createElement("div");
  el.className = "task-card lv-" + lv;
  el.style.borderLeftColor = t.cor || "var(--blue)";
  el.innerHTML = `
    <div class="tc-head"><div class="tc-title"></div><span class="tc-cat"></span></div>
    <div class="tc-badges">
      <span class="dt-badge">${PRIOR[t.prioridade]||t.prioridade}</span>
      ${t.projeto ? `<span class="dt-badge">📁 ${escapar(t.projeto)}</span>` : ""}
    </div>
    <div class="tc-due">📅 Limite: ${limite}${t.hora ? " · "+t.hora : ""}</div>
    <div class="tc-info">Criada em ${criado}</div>
    <div class="tc-foot">
      <span class="tc-status ${statusCls}">${STATUS[t.status]||t.status}</span>
      <span class="tc-late ${lv}">${t.status==="concluida" ? "✓ concluída" : textoAtraso(d)}</span>
    </div>
    <div class="dt-actions">
      <button class="dt-btn dt-edit">✎ Editar</button>
      ${t.status!=="concluida" ? `<button class="dt-btn dt-done">✓ Concluir</button>` : ""}
      <button class="dt-btn dt-dup">⧉ Duplicar</button>
      <button class="dt-btn dt-del">🗑 Excluir</button>
    </div>`;
  el.querySelector(".tc-title").textContent = t.titulo;
  el.querySelector(".tc-cat").textContent = t.categoria || "Geral";
  el.querySelector(".dt-edit").onclick = () => openTaskModal(t);
  if (t.status!=="concluida") el.querySelector(".dt-done").onclick = () => concluir(t.id);
  el.querySelector(".dt-dup").onclick = () => duplicar(t.id);
  el.querySelector(".dt-del").onclick = () => excluir(t.id);
  return el;
}
