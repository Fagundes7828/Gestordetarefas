// =========================================================
//  MF Agenda — Lógica do Dashboard
// =========================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  collection, addDoc, onSnapshot, doc, updateDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS  = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

let usuario = null;
let tarefas = [];          // cache local das tarefas
let corSelecionada = "#0a84ff";

/* ---------------------------------------------------------
   Proteção da página + carregamento
--------------------------------------------------------- */
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  usuario = user;
  document.getElementById("sideUser").textContent = user.displayName || user.email;
  escutarTarefas();
});

window.sair = async () => { await signOut(auth); window.location.href = "index.html"; };

/* ---------------------------------------------------------
   Relógio ao vivo — fuso de Brasília (GMT-3)
--------------------------------------------------------- */
function tick() {
  // Converte o horário para o fuso de São Paulo independentemente de onde o usuário esteja
  const agora = new Date();
  const br = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

  const semana = DIAS[br.getDay()];
  const dia = br.getDate();
  const mes = MESES[br.getMonth()];
  const ano = br.getFullYear();
  const hh = String(br.getHours()).padStart(2, "0");
  const mm = String(br.getMinutes()).padStart(2, "0");
  const ss = String(br.getSeconds()).padStart(2, "0");

  document.getElementById("ckWeekday").textContent = semana;
  document.getElementById("ckDate").textContent = `${dia} de ${mes.charAt(0).toUpperCase()+mes.slice(1)} de ${ano}`;
  document.getElementById("ckTime").textContent = `${hh}:${mm}:${ss}`;
}
setInterval(tick, 1000);
tick();

/* ---------------------------------------------------------
   Navegação entre páginas (menu lateral)
--------------------------------------------------------- */
window.goPage = function (page) {
  document.querySelectorAll(".menu-item[data-page]").forEach(b =>
    b.classList.toggle("active", b.dataset.page === page));
  document.querySelectorAll(".page").forEach(p =>
    p.classList.toggle("active", p.id === "page-" + page));
};

/* ---------------------------------------------------------
   Firestore: escuta as tarefas do usuário em tempo real
   Caminho: usuarios/{uid}/tarefas
--------------------------------------------------------- */
function escutarTarefas() {
  const ref = collection(db, "usuarios", usuario.uid, "tarefas");
  const q = query(ref, orderBy("criadoEm", "desc"));
  onSnapshot(q, (snap) => {
    tarefas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => {
    console.error("Erro ao ler tarefas:", err);
  });
}

/* ---------------------------------------------------------
   Modal de criação
--------------------------------------------------------- */
window.openTaskModal = function () {
  document.getElementById("taskAlert").className = "alert";
  ["tkTitle","tkDesc","tkCat","tkProject"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("tkPriority").value = "media";
  document.getElementById("tkStatus").value = "pendente";
  const hoje = dataHojeISO();
  document.getElementById("tkStart").value = hoje;
  document.getElementById("tkDue").value = hoje;
  corSelecionada = "#0a84ff";
  document.querySelectorAll("#tkSwatches .sw").forEach((s,i)=>s.classList.toggle("sel", i===0));
  document.getElementById("taskOverlay").style.display = "flex";
};
window.closeTaskModal = function () {
  document.getElementById("taskOverlay").style.display = "none";
};
window.pickColor = function (el) {
  document.querySelectorAll("#tkSwatches .sw").forEach(s => s.classList.remove("sel"));
  el.classList.add("sel");
  corSelecionada = el.dataset.color;
};

function dataHojeISO() {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return br.toISOString().slice(0,10);
}

/* ---------------------------------------------------------
   Salvar tarefa no Firestore
--------------------------------------------------------- */
window.saveTask = async function () {
  const titulo = document.getElementById("tkTitle").value.trim();
  if (!titulo) {
    const a = document.getElementById("taskAlert");
    a.textContent = "Dê um título à tarefa.";
    a.className = "alert show error";
    return;
  }

  const dados = {
    titulo,
    descricao: document.getElementById("tkDesc").value.trim(),
    categoria: document.getElementById("tkCat").value.trim() || "Geral",
    prioridade: document.getElementById("tkPriority").value,
    inicio: document.getElementById("tkStart").value || null,
    conclusao: document.getElementById("tkDue").value || null,
    status: document.getElementById("tkStatus").value,
    projeto: document.getElementById("tkProject").value.trim() || null,
    cor: corSelecionada,
    criadoEm: serverTimestamp()
  };

  const btn = document.getElementById("btnSaveTask");
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    await addDoc(collection(db, "usuarios", usuario.uid, "tarefas"), dados);
    closeTaskModal();
  } catch (err) {
    console.error(err);
    const a = document.getElementById("taskAlert");
    a.textContent = "Não foi possível salvar. Veja as regras do Firestore.";
    a.className = "alert show error";
  } finally {
    btn.disabled = false; btn.textContent = "Salvar";
  }
};

/* ---------------------------------------------------------
   Marcar como concluída
--------------------------------------------------------- */
window.concluir = async function (id) {
  try {
    await updateDoc(doc(db, "usuarios", usuario.uid, "tarefas", id), { status: "concluida" });
  } catch (err) { console.error(err); }
};

/* ---------------------------------------------------------
   Cálculo de atraso e nível de urgência
--------------------------------------------------------- */
function diasDeAtraso(conclusaoISO) {
  if (!conclusaoISO) return null;
  const hoje = new Date(dataHojeISO());
  const prazo = new Date(conclusaoISO);
  const diff = Math.round((hoje - prazo) / 86400000); // dias
  return diff; // positivo = atrasada, negativo = ainda há prazo
}

function textoAtraso(dias) {
  if (dias === null) return "";
  if (dias < 0) {
    const f = Math.abs(dias);
    if (f === 0) return "vence hoje";
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

// Define a cor (nível) com base em prazo + prioridade
function nivel(t) {
  if (t.status === "concluida") return "green";
  const d = diasDeAtraso(t.conclusao);
  if (d === null) return "green";
  if (d > 0) return t.prioridade === "critica" ? "critical" : "red";  // atrasada
  if (d >= -2) return "yellow";   // vence em até 2 dias
  return "green";                 // em dia
}

/* ---------------------------------------------------------
   Render geral (resumo + cards)
--------------------------------------------------------- */
function render() {
  const total = tarefas.length;
  const concluidas = tarefas.filter(t => t.status === "concluida").length;
  const pendentes  = tarefas.filter(t => t.status !== "concluida").length;
  const atrasadas  = tarefas.filter(t => t.status !== "concluida" && diasDeAtraso(t.conclusao) > 0).length;
  const taxa = total ? (concluidas / total * 100) : 0;

  document.getElementById("stTotal").textContent = total;
  document.getElementById("stDone").textContent = concluidas;
  document.getElementById("stPend").textContent = pendentes;
  document.getElementById("stLate").textContent = atrasadas;
  document.getElementById("stRate").textContent = taxa.toFixed(2).replace('.', ',') + "%";
  document.getElementById("stBar").style.width = taxa + "%";

  // Página início: pendentes e atrasadas (não concluídas), atrasadas primeiro
  const pend = tarefas
    .filter(t => t.status !== "concluida")
    .sort((a,b) => (diasDeAtraso(b.conclusao)||-9999) - (diasDeAtraso(a.conclusao)||-9999));
  renderCards("pendCards", pend, "Nenhuma tarefa pendente. Tudo em dia! 🎉");
  document.getElementById("pendCount").textContent = pend.length ? `${pend.length} item(ns)` : "";

  // Página tarefas: todas
  renderCards("allCards", tarefas, "Você ainda não criou nenhuma tarefa.");
  document.getElementById("allCount").textContent = total ? `${total} item(ns)` : "";
}

function renderCards(containerId, lista, vazio) {
  const box = document.getElementById(containerId);
  box.innerHTML = "";
  if (!lista.length) {
    box.innerHTML = `<div class="empty-state"><div class="big">🗂️</div>${vazio}</div>`;
    return;
  }
  lista.forEach(t => box.appendChild(card(t)));
}

function card(t) {
  const lv = nivel(t);
  const d = diasDeAtraso(t.conclusao);
  const statusTxt = { pendente:"Pendente", andamento:"Em andamento", concluida:"Concluída" }[t.status] || t.status;
  const statusCls = { pendente:"st-pendente", andamento:"st-andamento", concluida:"st-concluida" }[t.status] || "st-pendente";

  const el = document.createElement("div");
  el.className = "task-card lv-" + lv;
  el.style.borderLeftColor = t.cor || "var(--blue)";

  const dueTxt = t.conclusao ? new Date(t.conclusao).toLocaleDateString("pt-BR", {timeZone:"UTC"}) : "sem prazo";

  el.innerHTML = `
    <button class="tc-check" title="Marcar como concluída">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="tc-head">
      <div class="tc-title"></div>
      <span class="tc-cat"></span>
    </div>
    <div class="tc-due">📅 ${dueTxt}</div>
    <div class="tc-body"></div>
    <div class="tc-foot">
      <span class="tc-status ${statusCls}">${statusTxt}</span>
      <span class="tc-late ${lv}">${t.status==="concluida" ? "✓ concluída" : textoAtraso(d)}</span>
    </div>
  `;
  el.querySelector(".tc-title").textContent = t.titulo;
  el.querySelector(".tc-cat").textContent = t.categoria || "Geral";
  el.querySelector(".tc-body").textContent = t.descricao || "Sem descrição.";
  if (t.status !== "concluida") {
    el.querySelector(".tc-check").onclick = () => concluir(t.id);
  } else {
    el.querySelector(".tc-check").style.display = "none";
  }
  return el;
}

// Fecha modal ao clicar fora / Esc
document.getElementById("taskOverlay").addEventListener("click", e => {
  if (e.target.id === "taskOverlay") closeTaskModal();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeTaskModal(); });
