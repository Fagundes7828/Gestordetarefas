// =========================================================
//  MF Agenda — Lógica do Dashboard + Calendário
// =========================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut, updateProfile, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail }
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
let prefs = {                          // preferências do usuário (Visualizações)
  paginaInicial: "inicio",
  primeiroDia: 0,
  mostrarFDS: true,
  mostrarConcluidas: true,
  mostrarAtraso: true,
  categoriasColoridas: true,
  calendarConcluidas: true,
  reduzirPassados: false,
  numeroDaSemana: false
};

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
  carregarPrefs();
  escutarRoteiros();
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
    renderLegenda();
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
  const dataDefault = window._diaSelecionado || dataHojeISO();
  g("tkStart").value = tarefa?.inicio || dataDefault;
  g("tkDue").value = tarefa?.conclusao || dataDefault;
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
  window._diaSelecionado = null;
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
  const t = tarefas.find(x => x.id === id);
  // se for tarefa-espelho de roteiro, finaliza o roteiro (que sincroniza a tarefa)
  if (t?.roteiroId) { finalizarRoteiro(t.roteiroId); return; }
  try { await updateDoc(doc(db, "usuarios", usuario.uid, "tarefas", id), { status: "concluida" }); }
  catch (err) { console.error(err); }
};
window.excluir = async (id) => {
  const t = tarefas.find(x => x.id === id);
  // se for tarefa-espelho, redireciona para excluir o roteiro
  if (t?.roteiroId) {
    if (confirm("Esta gravação está vinculada a um roteiro. Deseja excluir o roteiro e a gravação?")) {
      excluirRoteiro(t.roteiroId); closeDayModal(); closeTaskDetail();
    }
    return;
  }
  if (!confirm("Excluir esta tarefa? Esta ação não pode ser desfeita.")) return;
  try { await deleteDoc(doc(db, "usuarios", usuario.uid, "tarefas", id)); closeDayModal(); }
  catch (err) { console.error(err); }
};
window.duplicar = async (id) => {
  const t = tarefas.find(x => x.id === id); if (!t) return;
  if (t.roteiroId) { alert("Gravações vinculadas a roteiros não podem ser duplicadas. Crie um novo roteiro."); return; }
  const copia = { ...t, titulo: t.titulo + " (cópia)", criadoEm: serverTimestamp() };
  delete copia.id;
  try { await addDoc(collection(db, "usuarios", usuario.uid, "tarefas"), copia); }
  catch (err) { console.error(err); }
};
window.editarTarefa = (id) => {
  const t = tarefas.find(x => x.id === id); if (!t) return;
  // tarefa-espelho: abre o roteiro para edição
  if (t.roteiroId) { closeDayModal(); const r = roteiros.find(x => x.id === t.roteiroId); if (r) openRoteiroModal(r); return; }
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
  // aplica preferência mostrarConcluidas
  const base = prefs.mostrarConcluidas !== false ? tarefas : tarefas.filter(t => t.status !== "concluida");

  const total      = tarefas.length; // total sempre conta todas
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

  const pend = base.filter(t => t.status !== "concluida")
    .sort((a,b) => (diasDeAtraso(b.conclusao)||-9999) - (diasDeAtraso(a.conclusao)||-9999));
  renderCards("pendCards", pend, "Nenhuma tarefa pendente. Tudo em dia! 🎉");
  document.getElementById("pendCount").textContent = pend.length ? `${pend.length} item(ns)` : "";

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
  el.className = "task-card lv-" + lv + " clickable";
  el.style.borderLeftColor = t.cor || "var(--blue)";
  el.onclick = () => openTaskDetail(t.id);
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
  if (t.status !== "concluida") {
    el.querySelector(".tc-check").onclick = e => { e.stopPropagation(); concluir(t.id); };
  } else { el.querySelector(".tc-check").style.display = "none"; }
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

  // filtra concluídas do calendário se necessário
  let base = tarefasFiltradas();
  if (!prefs.calendarConcluidas) base = base.filter(t => t.status !== "concluida");

  const mapa = ocorrenciasPorDia(base);
  const grid = document.getElementById("calGrid"); grid.innerHTML = "";

  const inicioSemana = Number(prefs.primeiroDia ?? 0);  // 0=Dom, 1=Seg
  let firstDay = new Date(y, m, 1).getDay() - inicioSemana;
  if (firstDay < 0) firstDay += 7;

  const diasNoMes = new Date(y, m+1, 0).getDate();
  const diasMesAnt = new Date(y, m, 0).getDate();
  const hojeISO = dataHojeISO();

  // atualiza cabeçalho da semana com o início correto
  const wdCells = document.querySelectorAll(".cal-weekdays div");
  const DIAS_CURTOS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  wdCells.forEach((el, i) => { el.textContent = DIAS_CURTOS[(i + inicioSemana) % 7]; });

  for (let i=firstDay-1; i>=0; i--) grid.appendChild(celulaMuda(diasMesAnt-i));
  for (let d=1; d<=diasNoMes; d++) {
    const iso = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isPast = iso < hojeISO;
    grid.appendChild(celula(d, iso, mapa[iso]||[], iso===hojeISO, isPast));
  }
  const restantes = (7 - ((firstDay+diasNoMes)%7))%7;
  for (let d=1; d<=restantes; d++) grid.appendChild(celulaMuda(d));

  aplicarPrefsCalendario();
};

function celulaMuda(num) {
  const c = document.createElement("div");
  c.className = "cal-cell muted";
  c.innerHTML = `<div class="cal-num">${num}</div>`;
  return c;
}

function celula(dia, iso, evs, hoje, isPast) {
  const c = document.createElement("div");
  let cls = "cal-cell" + (hoje ? " today" : "");
  if (isPast && prefs.reduzirPassados) cls += " passado";
  c.className = cls;
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
window._diaSelecionado = null; // guarda o dia clicado no calendário
window.openDayModal = function (iso, evs) {
  esconderPopover();
  window._diaSelecionado = iso; // salva para usar ao criar tarefa
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
  el.className = "day-task clickable";
  el.style.borderLeftColor = t.cor || "#0a84ff";
  el.onclick = () => { closeDayModal(); openTaskDetail(t.id); };
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
    <div class="dt-actions">
      <button class="dt-btn dt-edit">✎ Editar</button>
      ${t.status!=="concluida" ? `<button class="dt-btn dt-done">✓ Concluir</button>` : ""}
      <button class="dt-btn dt-dup">⧉ Duplicar</button>
      <button class="dt-btn dt-del">🗑 Excluir</button>
    </div>`;
  el.querySelector(".dt-name").textContent = t.titulo;
  el.querySelector(".dt-badges .dt-badge").textContent = t.categoria || "Geral";
  el.querySelector(".dt-desc").textContent = t.descricao || "Sem descrição.";
  el.querySelector(".dt-edit").onclick = e => { e.stopPropagation(); closeDayModal(); openTaskModal(tarefas.find(x=>x.id===t.id)); };
  if (t.status!=="concluida") el.querySelector(".dt-done").onclick = e => { e.stopPropagation(); concluir(t.id); closeDayModal(); };
  el.querySelector(".dt-dup").onclick = e => { e.stopPropagation(); duplicar(t.id); };
  el.querySelector(".dt-del").onclick = e => { e.stopPropagation(); excluir(t.id); };
  return el;
}

function escapar(s) {
  return String(s||"").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

/* ---------- Fechar modais (clique fora / Esc) ---------- */
document.getElementById("taskOverlay").addEventListener("click", e => { if (e.target.id==="taskOverlay") closeTaskModal(); });
document.getElementById("dayOverlay").addEventListener("click", e => { if (e.target.id==="dayOverlay") closeDayModal(); });
document.addEventListener("keydown", e => { if (e.key==="Escape"){ closeTaskModal(); closeDayModal(); closeTaskDetail(); closeRoteiroModal(); closeRoteiroDetail(); } });

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
      <button class="ci-edit" title="Editar">✎</button>
      <button class="ci-toggle ${c.ativa ? "on" : "off"}">${c.ativa ? "Ativa" : "Inativa"}</button>
      <button class="ci-del" title="Remover">✕</button>`;
    el.querySelector(".ci-nome").textContent = c.nome;
    if (c.descricao) el.querySelector(".ci-desc").textContent = c.descricao;
    el.querySelector(".ci-toggle").onclick = () => toggleCategoriaAtiva(idx);
    el.querySelector(".ci-edit").onclick = () => editarCategoria(idx, el, c);
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

function editarCategoria(idx, elCard, c) {
  // remove formulário se já aberto neste card
  const existing = elCard.querySelector(".cat-edit-form");
  if (existing) { existing.remove(); return; }
  // fecha formulários abertos em outros cards
  document.querySelectorAll(".cat-edit-form").forEach(f => f.remove());

  const form = document.createElement("div");
  form.className = "cat-edit-form";
  form.innerHTML = `
    <div class="cat-edit-row">
      <input type="color" class="ec-cor" value="${c.cor||'#0a84ff'}">
      <input type="text" class="ec-nome" value="${escapar(c.nome)}" placeholder="Nome">
    </div>
    <input type="text" class="ec-desc" value="${escapar(c.descricao||'')}" placeholder="Descrição (opcional)">
    <div class="cat-edit-btns">
      <button class="btn btn-primary" style="font-size:13px;padding:8px 16px">Salvar</button>
      <button class="btn btn-soft" style="font-size:13px;padding:8px 16px">Cancelar</button>
    </div>`;
  form.querySelector(".cat-edit-btns button:last-child").onclick = () => form.remove();
  form.querySelector(".cat-edit-btns button:first-child").onclick = async () => {
    const novoNome = form.querySelector(".ec-nome").value.trim();
    const novaCor  = form.querySelector(".ec-cor").value;
    const novaDesc = form.querySelector(".ec-desc").value.trim();
    if (!novoNome) return cfgAlert("O nome não pode ficar vazio.", "error");
    const novas = categorias.map((cat, i) => i === idx ? { ...cat, nome: novoNome, cor: novaCor, descricao: novaDesc } : cat);
    await salvarCategorias(novas);
    cfgAlert("Categoria atualizada!", "ok");
    form.remove();
  };
  elCard.appendChild(form);
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
  // item fixo: gravações vinculadas a roteiros
  const temGravacao = tarefas.some(t => t.roteiroId);
  if (temGravacao) {
    const g = document.createElement("div");
    g.className = "lg-item";
    g.innerHTML = `<span class="dot" style="background:#ff2d92"></span><span>🎬 Gravação (roteiro)</span>`;
    box.appendChild(g);
  }
  if (!categorias.length) {
    if (!temGravacao) box.innerHTML = `<div class="lg-empty">Cadastre categorias para ver a legenda.</div>`;
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
  // mapeia nome do stat para o data-cat correto do accordion
  const catMap = { todas:"todas", concluida:"concluida", pendente:"pendente", atrasada:"atrasada" };
  const cat = catMap[categoria] || "todas";
  abrirAcc(cat);
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

  const todasBase = filtrarBusca(tarefas); // sempre usa todas para os grupos
  const grupos = {
    todas:     base,
    pendente:  todasBase.filter(t => t.status === "pendente" || t.status === "andamento"),
    concluida: todasBase.filter(t => t.status === "concluida"),
    atrasada:  todasBase.filter(t => t.status !== "concluida" && diasDeAtraso(t.conclusao) > 0)
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
  el.className = "task-card lv-" + lv + " clickable";
  el.style.borderLeftColor = t.cor || "var(--blue)";
  el.onclick = () => openTaskDetail(t.id);
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
  // stopPropagation nos botões pra não disparar o onclick do card
  el.querySelector(".dt-edit").onclick = e => { e.stopPropagation(); openTaskModal(t); };
  if (t.status!=="concluida") el.querySelector(".dt-done").onclick = e => { e.stopPropagation(); concluir(t.id); };
  el.querySelector(".dt-dup").onclick = e => { e.stopPropagation(); duplicar(t.id); };
  el.querySelector(".dt-del").onclick = e => { e.stopPropagation(); excluir(t.id); };
  return el;
}

/* =========================================================
   CORREÇÃO #01 — Task Detail View
   ========================================================= */

window.openTaskDetail = function (id) {
  const t = tarefas.find(x => x.id === id);
  if (!t) return;

  // INTEGRAÇÃO: se a tarefa está vinculada a um roteiro, abre o roteiro
  if (t.roteiroId) {
    const r = roteiros.find(x => x.id === t.roteiroId);
    if (r) { openRoteiroDetail(r.id); return; }
  }

  // barra de cor
  const bar = document.getElementById("detailColorBar");
  bar.style.background = t.cor || "#0a84ff";

  // título
  document.getElementById("detailTitle").textContent = t.titulo;

  // badges: categoria + status + prioridade
  const catBadge = document.getElementById("detailCatBadge");
  catBadge.textContent = t.categoria || "Sem categoria";
  catBadge.style.background = t.cor || "#0a84ff";

  const statusMap = { pendente:"Pendente", andamento:"Em andamento", concluida:"Concluída" };
  document.getElementById("detailStatusBadge").textContent = statusMap[t.status] || t.status;
  document.getElementById("detailPriBadge").textContent = PRIOR[t.prioridade] || t.prioridade;

  // descrição completa
  const descEl = document.getElementById("detailDesc");
  if (t.descricao?.trim()) {
    descEl.textContent = t.descricao;
    descEl.classList.remove("sem-desc");
  } else {
    descEl.textContent = "Nenhuma descrição cadastrada.";
    descEl.classList.add("sem-desc");
  }

  // informações em grade
  const fmt = iso => iso ? new Date(iso).toLocaleDateString("pt-BR",{timeZone:"UTC"}) : "—";
  document.getElementById("detailProject").textContent = t.projeto || "—";
  document.getElementById("detailStart").textContent = fmt(t.inicio);
  document.getElementById("detailDue").textContent = fmt(t.conclusao);
  document.getElementById("detailTime").textContent = t.hora || "—";
  const criadoEm = t.criadoEm?.toDate ? t.criadoEm.toDate().toLocaleDateString("pt-BR") : "—";
  document.getElementById("detailCreated").textContent = criadoEm;
  const d = diasDeAtraso(t.conclusao);
  document.getElementById("detailLate").textContent = t.status === "concluida" ? "✓ Concluída" : (textoAtraso(d) || "—");

  // botões de ação
  document.getElementById("detailBtnEdit").onclick = () => { closeTaskDetail(); openTaskModal(t); };
  const btnDone = document.getElementById("detailBtnDone");
  if (t.status === "concluida") {
    btnDone.style.display = "none";
  } else {
    btnDone.style.display = "flex";
    btnDone.onclick = () => { concluir(t.id); closeTaskDetail(); };
  }
  document.getElementById("detailBtnDup").onclick = () => { duplicar(t.id); closeTaskDetail(); };
  document.getElementById("detailBtnDel").onclick = () => excluir(t.id);

  document.getElementById("detailOverlay").style.display = "flex";
};

window.closeTaskDetail = () => {
  document.getElementById("detailOverlay").style.display = "none";
};

// fecha com Esc e clique fora
document.getElementById("detailOverlay").addEventListener("click", e => {
  if (e.target.id === "detailOverlay") closeTaskDetail();
});
// (o Esc já fecha todos via listener existente — extend ele)

/* =========================================================
   MÓDULO 6A — Configurações (abas + visualizações + recuperar senha)
   ========================================================= */

/* ---------- Navegação entre abas ---------- */
window.switchCfgTab = function (tab) {
  document.querySelectorAll(".cfg-tab").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".cfg-tab-content").forEach(c =>
    c.classList.toggle("active", c.id === "cfgtab-" + tab));
};

/* ---------- Método de Conexão ---------- */
function renderConnInfo() {
  const box = document.getElementById("connInfo");
  if (!box) return;
  const ehGoogle = usuario.providerData.some(p => p.providerId === "google.com");
  const temSenha = usuario.providerData.some(p => p.providerId === "password");
  if (ehGoogle) {
    box.innerHTML = `<div class="conn-icon">🔵</div><div class="conn-text"><b>Google</b><span>Conta vinculada: ${usuario.email}</span></div>`;
    document.getElementById("passBlock").style.display = "none";
  } else if (temSenha) {
    box.innerHTML = `<div class="conn-icon">📧</div><div class="conn-text"><b>E-mail e Senha</b><span>${usuario.email}</span></div>`;
    document.getElementById("passBlock").style.display = "block";
  } else {
    box.innerHTML = `<div class="conn-icon">🔑</div><div class="conn-text"><b>Outro método</b><span>${usuario.email || "—"}</span></div>`;
  }
}

/* ---------- Recuperar senha ---------- */
window.recuperarSenha = async function () {
  if (!usuario.email) return cfgAlert("Nenhum e-mail associado.", "error");
  try {
    await sendPasswordResetEmail(auth, usuario.email);
    cfgAlert("E-mail de recuperação enviado para " + usuario.email, "ok");
  } catch (err) {
    console.error(err); cfgAlert("Não foi possível enviar o e-mail.", "error");
  }
};

/* ---------- Carregar perfil (atualizado com bio + conn) ---------- */
function carregarPerfilUI() {
  const nome = usuario.displayName || "";
  document.getElementById("cfgName").value = nome;
  document.getElementById("cfgEmail").value = usuario.email || "(conta sem e-mail)";
  const ini = iniciais(nome || usuario.email);
  document.getElementById("sideAvatar").textContent = ini;
  document.getElementById("cfgAvatar").textContent = ini;
  renderConnInfo();
  montarGridCores();
  getDoc(doc(db, "usuarios", usuario.uid)).then(snap => {
    if (!snap.exists()) { aplicarAvatarCor(avatarCor); return; }
    const d = snap.data();
    if (d.avatarCor) { avatarCor = d.avatarCor; aplicarAvatarCor(d.avatarCor); montarGridCores(); }
    if (d.bio) document.getElementById("cfgBio").value = d.bio;
  }).catch(() => {});
}

/* ---------- Salvar perfil (bio incluída) ---------- */
window.salvarPerfil = async function () {
  const nome = document.getElementById("cfgName").value.trim();
  const bio  = document.getElementById("cfgBio")?.value.trim() || "";
  if (!nome) return cfgAlert("Digite um nome.", "error");
  const btn = document.getElementById("btnSaveProfile");
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    await updateProfile(usuario, { displayName: nome });
    await setDoc(doc(db, "usuarios", usuario.uid), { nome, bio, avatarCor }, { merge: true });
    document.getElementById("sideUser").textContent = nome;
    const ini = iniciais(nome);
    document.getElementById("sideAvatar").textContent = ini;
    document.getElementById("cfgAvatar").textContent = ini;
    aplicarAvatarCor(avatarCor);
    cfgAlert("Perfil salvo com sucesso!", "ok");
  } catch (err) {
    console.error(err); cfgAlert("Não foi possível salvar o perfil.", "error");
  } finally { btn.disabled = false; btn.textContent = "Salvar perfil"; }
};

/* ---------- Preferências (Visualizações) ---------- */
async function carregarPrefs() {
  try {
    const snap = await getDoc(doc(db, "usuarios", usuario.uid));
    if (snap.exists() && snap.data().prefs) {
      prefs = { ...prefs, ...snap.data().prefs };
    }
  } catch (err) { console.error(err); }
  aplicarPrefsUI();
  aplicarPrefsCalendario();
  aplicarPrefAtraso();
  aplicarPrefCores();
  // redireciona para a página inicial configurada após o login
  const paginaInicial = prefs.paginaInicial || "inicio";
  if (paginaInicial !== "inicio") goPage(paginaInicial);
}

function aplicarPrefsUI() {
  const get = id => document.getElementById(id);
  if (get("prefHome")) get("prefHome").value = prefs.paginaInicial || "inicio";
  if (get("prefWeekStart")) get("prefWeekStart").value = String(prefs.primeiroDia ?? 0);
  if (get("prefWeekends")) get("prefWeekends").checked = prefs.mostrarFDS !== false;
  if (get("prefShowDone")) get("prefShowDone").checked = prefs.mostrarConcluidas !== false;
  if (get("prefShowLate")) get("prefShowLate").checked = prefs.mostrarAtraso !== false;
  if (get("prefColorCats")) get("prefColorCats").checked = prefs.categoriasColoridas !== false;
  if (get("prefCalDone")) get("prefCalDone").checked = prefs.calendarConcluidas !== false;
  if (get("prefDimPast")) get("prefDimPast").checked = prefs.reduzirPassados === true;
  if (get("prefWeekNum")) get("prefWeekNum").checked = prefs.numeroDaSemana === true;
}

window.salvarPref = async function (chave, valor) {
  prefs[chave] = typeof valor === "string" && !isNaN(valor) ? Number(valor) : valor;
  aplicarPrefsCalendario();
  aplicarPrefAtraso();
  aplicarPrefCores();
  if (chave === "numeroDaSemana") setTimeout(aplicarNumeroDaSemana, 100);
  try {
    await setDoc(doc(db, "usuarios", usuario.uid), { prefs }, { merge: true });
  } catch (err) { console.error(err); }
};

function aplicarPrefsCalendario() {
  const grid = document.getElementById("calGrid");
  const wdays = document.querySelector(".cal-weekdays");
  if (grid) grid.classList.toggle("hide-fds", !prefs.mostrarFDS);
  if (wdays) wdays.classList.toggle("hide-fds", !prefs.mostrarFDS);
}

/* =========================================================
   MÓDULO 6B — ROTEIROS
   ========================================================= */

let roteiros = [];
let roteiroEditandoId = null;

const RT_STATUS = {
  elaboracao: "Em elaboração",
  pronto: "Pronto para gravação",
  gravado: "Gravado",
  finalizado: "Finalizado"
};
const RT_COR = {
  elaboracao: "#0a84ff",
  pronto: "#ff9500",
  gravado: "#bf5af2",
  finalizado: "#34c759"
};

/* ---------- Navegação: botão dinâmico no topbar ---------- */
const _goPageOrig = window.goPage;
window.goPage = function (page) {
  _goPageOrig(page);
  // atualiza botão do topbar
  const btn = document.getElementById("btnTopbar");
  if (btn) {
    if (page === "roteiros") {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg> Criar Roteiro`;
      btn.onclick = () => openRoteiroModal();
    } else {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg> Criar Tarefa`;
      btn.onclick = () => openTaskModal();
    }
  }
  // aplica número de semana ao abrir calendário
  if (page === "calendario") setTimeout(aplicarNumeroDaSemana, 100);
};

/* ---------- Firestore: escutar roteiros ---------- */
function escutarRoteiros() {
  const ref = collection(db, "usuarios", usuario.uid, "roteiros");
  const q = query(ref, orderBy("criadoEm", "desc"));
  onSnapshot(q, (snap) => {
    roteiros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRoteiros();
    atualizarContadorRoteiros();
  }, err => console.error("Erro ao ler roteiros:", err));
}

function atualizarContadorRoteiros() {
  const el = document.getElementById("roteirosCount");
  if (el) el.textContent = roteiros.length ? `${roteiros.length} roteiro(s)` : "";
}

/* ---------- Render dos cards ---------- */
window.renderRoteiros = function () {
  const fltStatus = document.getElementById("roteiroFltStatus")?.value || "";
  let lista = fltStatus ? roteiros.filter(r => r.status === fltStatus) : roteiros;
  const grid = document.getElementById("roteirosGrid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!lista.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">📝</div>${fltStatus ? "Nenhum roteiro com esse status." : "Nenhum roteiro criado ainda. Clique em \"Criar Roteiro\" para começar."}</div>`;
    return;
  }
  lista.forEach(r => grid.appendChild(cardRoteiro(r)));
};

function cardRoteiro(r) {
  const cor = RT_COR[r.status] || "#0a84ff";
  const statusCls = "rs-" + (r.status || "elaboracao");
  const dataGrav = r.dataGravacao ? new Date(r.dataGravacao).toLocaleDateString("pt-BR",{timeZone:"UTC"}) : "—";
  const criado = r.criadoEm?.toDate ? r.criadoEm.toDate().toLocaleDateString("pt-BR") : "—";
  const atualiz = r.atualizadoEm?.toDate ? r.atualizadoEm.toDate().toLocaleDateString("pt-BR") : criado;

  const el = document.createElement("div");
  el.className = "roteiro-card";
  el.style.borderLeftColor = cor;
  el.onclick = () => openRoteiroDetail(r.id);
  el.innerHTML = `
    <div class="rc-head">
      <span class="rc-status ${statusCls}">${RT_STATUS[r.status]||r.status}</span>
      <span class="rc-date">📅 ${dataGrav}</span>
    </div>
    <div class="rc-title"></div>
    <div class="rc-meta">Criado em ${criado} · Atualizado: ${atualiz}</div>
    <div class="rc-actions">
      <button class="dt-btn dt-edit">✎ Editar</button>
      ${r.status !== "finalizado" ? `<button class="dt-btn dt-done">✓ Finalizar</button>` : ""}
      <button class="dt-btn dt-del">🗑 Excluir</button>
    </div>`;
  el.querySelector(".rc-title").textContent = r.titulo;
  el.querySelector(".dt-edit").onclick = e => { e.stopPropagation(); openRoteiroModal(r); };
  if (r.status !== "finalizado") el.querySelector(".dt-done").onclick = e => { e.stopPropagation(); finalizarRoteiro(r.id); };
  el.querySelector(".dt-del").onclick = e => { e.stopPropagation(); excluirRoteiro(r.id); };
  return el;
}

/* ---------- Modal de criação / edição ---------- */
window.openRoteiroModal = function (roteiro = null) {
  roteiroEditandoId = roteiro ? roteiro.id : null;
  document.getElementById("roteiroModalTitle").textContent = roteiro ? "Editar Roteiro" : "Novo Roteiro";
  document.getElementById("btnSalvarRoteiro").textContent = "Salvar Roteiro";
  document.getElementById("roteiroAlert").className = "alert";
  document.getElementById("rtTitulo").value = roteiro?.titulo || "";
  document.getElementById("rtData").value = roteiro?.dataGravacao || dataHojeISO();
  document.getElementById("rtStatus").value = roteiro?.status || "elaboracao";
  document.getElementById("roteiroEditor").innerHTML = roteiro?.conteudo || "";
  document.getElementById("roteiroOverlay").style.display = "flex";
  setTimeout(() => document.getElementById("rtTitulo").focus(), 50);
};

window.closeRoteiroModal = () => {
  document.getElementById("roteiroOverlay").style.display = "none";
  roteiroEditandoId = null;
};

window.salvarRoteiro = async function () {
  const titulo = document.getElementById("rtTitulo").value.trim();
  const dataGravacao = document.getElementById("rtData").value;
  const conteudo = document.getElementById("roteiroEditor").innerHTML;
  const a = document.getElementById("roteiroAlert");

  if (!titulo) { a.textContent = "Dê um título ao roteiro."; a.className = "alert show error"; return; }
  if (!dataGravacao) { a.textContent = "Informe a data da gravação."; a.className = "alert show error"; return; }

  const status = document.getElementById("rtStatus").value;
  const dados = {
    titulo,
    dataGravacao,
    conteudo,
    status,
    atualizadoEm: serverTimestamp()
  };
  const btn = document.getElementById("btnSalvarRoteiro");
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    let roteiroId;
    if (roteiroEditandoId) {
      roteiroId = roteiroEditandoId;
      await updateDoc(doc(db, "usuarios", usuario.uid, "roteiros", roteiroId), dados);
    } else {
      dados.criadoEm = serverTimestamp();
      const ref = await addDoc(collection(db, "usuarios", usuario.uid, "roteiros"), dados);
      roteiroId = ref.id;
    }
    // INTEGRAÇÃO COM CALENDÁRIO: cria/atualiza a tarefa-espelho vinculada
    await sincronizarTarefaRoteiro(roteiroId, titulo, dataGravacao, status);
    closeRoteiroModal();
  } catch (err) {
    console.error(err); a.textContent = "Não foi possível salvar."; a.className = "alert show error";
  } finally { btn.disabled = false; btn.textContent = "Salvar Roteiro"; }
};

/* ---------- Integração Roteiro ↔ Calendário ---------- */
// Cria ou atualiza uma tarefa "espelho" que representa a gravação no calendário.
// A tarefa é marcada com roteiroId para vinculação e renderização especial.
async function sincronizarTarefaRoteiro(roteiroId, titulo, dataGravacao, statusRoteiro) {
  const existente = tarefas.find(t => t.roteiroId === roteiroId);
  const statusTarefa = statusRoteiro === "finalizado" ? "concluida" : "pendente";
  const dadosTarefa = {
    titulo: "🎬 Gravação: " + titulo,
    descricao: "Gravação vinculada a um roteiro. Abra o roteiro para ver o conteúdo completo.",
    categoria: "Gravação",
    prioridade: "alta",
    status: statusTarefa,
    cor: "#ff2d92",            // cor própria de gravação (rosa/magenta)
    inicio: dataGravacao,
    conclusao: dataGravacao,
    hora: null,
    projeto: "Roteiros",
    roteiroId: roteiroId        // marca a vinculação
  };
  try {
    if (existente) {
      await updateDoc(doc(db, "usuarios", usuario.uid, "tarefas", existente.id), dadosTarefa);
    } else {
      dadosTarefa.criadoEm = serverTimestamp();
      await addDoc(collection(db, "usuarios", usuario.uid, "tarefas"), dadosTarefa);
    }
  } catch (err) { console.error("Erro ao sincronizar tarefa do roteiro:", err); }
}

/* ---------- Ações nos cards ---------- */
async function finalizarRoteiro(id) {
  try {
    await updateDoc(doc(db, "usuarios", usuario.uid, "roteiros", id), { status:"finalizado", atualizadoEm:serverTimestamp() });
    // marca a tarefa-espelho como concluída
    const vinculada = tarefas.find(t => t.roteiroId === id);
    if (vinculada) await updateDoc(doc(db, "usuarios", usuario.uid, "tarefas", vinculada.id), { status:"concluida" });
  } catch (err) { console.error(err); }
}

async function excluirRoteiro(id) {
  if (!confirm("Excluir este roteiro? A gravação vinculada no calendário também será removida.")) return;
  try {
    await deleteDoc(doc(db, "usuarios", usuario.uid, "roteiros", id));
    // remove a tarefa-espelho vinculada
    const vinculada = tarefas.find(t => t.roteiroId === id);
    if (vinculada) await deleteDoc(doc(db, "usuarios", usuario.uid, "tarefas", vinculada.id));
    closeRoteiroDetail();
  } catch (err) { console.error(err); }
}

/* ---------- Modal de visualização completa ---------- */
window.openRoteiroDetail = function (id) {
  const r = roteiros.find(x => x.id === id);
  if (!r) return;
  const cor = RT_COR[r.status] || "#0a84ff";
  document.getElementById("rdColorBar").style.background = cor;
  document.getElementById("rdTitulo").textContent = r.titulo;
  document.getElementById("rdStatus").textContent = RT_STATUS[r.status] || r.status;
  document.getElementById("rdData").textContent = r.dataGravacao
    ? "📅 " + new Date(r.dataGravacao).toLocaleDateString("pt-BR",{timeZone:"UTC"}) : "—";
  document.getElementById("rdCriado").textContent = r.criadoEm?.toDate ? r.criadoEm.toDate().toLocaleDateString("pt-BR") : "—";
  document.getElementById("rdAtualizado").textContent = r.atualizadoEm?.toDate ? r.atualizadoEm.toDate().toLocaleDateString("pt-BR") : "—";
  document.getElementById("rdConteudo").innerHTML = r.conteudo || "<em>Sem conteúdo.</em>";

  document.getElementById("rdBtnEdit").onclick = () => { closeRoteiroDetail(); openRoteiroModal(r); };
  const btnFin = document.getElementById("rdBtnFinalizar");
  btnFin.style.display = r.status === "finalizado" ? "none" : "flex";
  btnFin.onclick = () => { finalizarRoteiro(r.id); closeRoteiroDetail(); };
  document.getElementById("rdBtnExcluir").onclick = () => excluirRoteiro(r.id);

  document.getElementById("roteiroDetailOverlay").style.display = "flex";
};
window.closeRoteiroDetail = () => { document.getElementById("roteiroDetailOverlay").style.display = "none"; };

/* ---------- Toolbar do editor ---------- */
window.fmt = function (cmd) {
  document.getElementById("roteiroEditor").focus();
  document.execCommand(cmd, false, null);
};

/* ---------- Fechar com Esc e clique fora ---------- */
document.getElementById("roteiroOverlay").addEventListener("click", e => { if (e.target.id==="roteiroOverlay") closeRoteiroModal(); });
document.getElementById("roteiroDetailOverlay").addEventListener("click", e => { if (e.target.id==="roteiroDetailOverlay") closeRoteiroDetail(); });

/* =========================================================
   ========================================================= */

// Bug 3: mostrarAtraso — oculta o indicador de atraso nos cards quando desativado
// Fazemos isso via CSS dinâmico (mais eficiente que rerender)
function aplicarPrefAtraso() {
  let style = document.getElementById("prefAtrasoStyle");
  if (!style) { style = document.createElement("style"); style.id = "prefAtrasoStyle"; document.head.appendChild(style); }
  style.textContent = prefs.mostrarAtraso !== false ? "" : ".tc-late,.detail-info-item:last-child{display:none}";
}

// Bug 4: categoriasColoridas — oculta bordas coloridas quando desativado
function aplicarPrefCores() {
  let style = document.getElementById("prefCoresStyle");
  if (!style) { style = document.createElement("style"); style.id = "prefCoresStyle"; document.head.appendChild(style); }
  style.textContent = prefs.categoriasColoridas !== false ? "" :
    ".task-card{border-left-color:rgba(60,60,67,.15)!important}.cal-ev{background:#8e8e93!important}.detail-color-bar{background:#8e8e93!important}.detail-cat-badge{background:#8e8e93!important}";
}

// Bug 5: numeroDaSemana — desenha o número da semana ISO em cada linha do calendário
function aplicarNumeroDaSemana() {
  document.querySelectorAll(".week-num").forEach(el => el.remove());
  if (!prefs.numeroDaSemana) return;
  const cells = document.querySelectorAll(".cal-cell:not(.muted)");
  cells.forEach(cell => {
    const num = cell.querySelector(".cal-num");
    if (!num) return;
    const dia = parseInt(num.textContent);
    const calTitle = document.getElementById("calTitle")?.textContent || "";
    const match = calTitle.match(/(\w+)\s+(\d{4})/);
    if (!match) return;
    const mes = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"].indexOf(match[1].toLowerCase());
    const ano = parseInt(match[2]);
    if (mes < 0) return;
    const d = new Date(ano, mes, dia);
    if (d.getDay() === (prefs.primeiroDia ?? 0)) {
      const semNum = getWeekNumber(d);
      const badge = document.createElement("span");
      badge.className = "week-num";
      badge.textContent = "S" + semNum;
      cell.style.position = "relative";
      cell.appendChild(badge);
    }
  });
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// carregarPrefs consolidada acima




// goPage consolidado no wrapper de roteiros abaixo
