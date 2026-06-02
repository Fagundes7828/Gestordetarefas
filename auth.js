// =========================================================
//  MF Agenda — Lógica de Autenticação
// =========================================================

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();

/* ---------------------------------------------------------
   Se o usuário já está logado, manda direto para o app.
--------------------------------------------------------- */
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "app.html";
});

/* ---------------------------------------------------------
   Troca de abas (Entrar / Criar conta) — visual estilo iOS
--------------------------------------------------------- */
window.switchTab = function (tab) {
  const isLogin = tab === "login";
  document.getElementById("tabLogin").classList.toggle("active", isLogin);
  document.getElementById("tabSignup").classList.toggle("active", !isLogin);
  document.getElementById("segThumb").classList.toggle("right", !isLogin);
  document.getElementById("formLogin").classList.toggle("active", isLogin);
  document.getElementById("formSignup").classList.toggle("active", !isLogin);
  hideAlert();
};

/* ---------------------------------------------------------
   Mensagens de feedback
--------------------------------------------------------- */
function showAlert(msg, type = "error") {
  const el = document.getElementById("alert");
  el.textContent = msg;
  el.className = "alert show " + (type === "ok" ? "ok" : "error");
}
function hideAlert() {
  document.getElementById("alert").className = "alert";
}

function setLoading(btnId, loading, originalText) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? "Aguarde..." : originalText;
}

/* ---------------------------------------------------------
   LOGIN com e-mail e senha
--------------------------------------------------------- */
window.doLogin = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPass").value;

  if (!email || !pass) return showAlert("Preencha e-mail e senha.");

  setLoading("btnLogin", true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // o onAuthStateChanged cuida do redirecionamento
  } catch (err) {
    showAlert(traduzErro(err.code));
    setLoading("btnLogin", false, "Entrar");
  }
};

/* ---------------------------------------------------------
   CADASTRO com e-mail e senha
--------------------------------------------------------- */
window.doSignup = async function () {
  const nome  = document.getElementById("signName").value.trim();
  const email = document.getElementById("signEmail").value.trim();
  const pass  = document.getElementById("signPass").value;
  const pass2 = document.getElementById("signPass2").value;

  // Validações
  if (!nome || !email || !pass || !pass2) return showAlert("Preencha todos os campos.");
  if (!validaEmail(email)) return showAlert("Digite um e-mail válido.");
  if (pass.length < 6)     return showAlert("A senha precisa ter no mínimo 6 caracteres.");
  if (pass !== pass2)      return showAlert("As senhas não conferem.");

  setLoading("btnSignup", true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: nome });
    await salvaPerfil(cred.user, nome);
    // o onAuthStateChanged cuida do redirecionamento
  } catch (err) {
    showAlert(traduzErro(err.code));
    setLoading("btnSignup", false, "Criar conta");
  }
};

/* ---------------------------------------------------------
   AUTENTICAÇÃO com Google (serve para login e cadastro)
--------------------------------------------------------- */
window.doGoogle = async function () {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await salvaPerfil(cred.user, cred.user.displayName || "Usuário");
    // o onAuthStateChanged cuida do redirecionamento
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") showAlert(traduzErro(err.code));
  }
};

/* ---------------------------------------------------------
   Salva (ou atualiza) o perfil do usuário no Firestore
--------------------------------------------------------- */
async function salvaPerfil(user, nome) {
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      nome:  nome,
      email: user.email,
      criadoEm: serverTimestamp()
    });
  }
}

/* ---------------------------------------------------------
   Utilitários
--------------------------------------------------------- */
function validaEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function traduzErro(code) {
  const mapa = {
    "auth/invalid-email":          "E-mail inválido.",
    "auth/user-not-found":         "Usuário não encontrado.",
    "auth/wrong-password":         "Senha incorreta.",
    "auth/invalid-credential":     "E-mail ou senha incorretos.",
    "auth/email-already-in-use":   "Este e-mail já está cadastrado.",
    "auth/weak-password":          "A senha é muito fraca (mínimo 6 caracteres).",
    "auth/too-many-requests":      "Muitas tentativas. Tente novamente mais tarde.",
    "auth/network-request-failed": "Sem conexão com a internet.",
    "auth/popup-blocked":          "O navegador bloqueou a janela do Google."
  };
  return mapa[code] || "Algo deu errado. Tente novamente.";
}
