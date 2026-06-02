/* =========================================================
   MF Agenda — Estilos da tela de autenticação
   Visual: glassmorphism inspirado no iOS
   ========================================================= */

:root{
  --blue:#0a84ff;            /* azul iOS */
  --blue-dark:#0066d6;
  --text:#1c1c1e;
  --text-soft:rgba(28,28,30,.6);
  --glass:rgba(255,255,255,.55);
  --glass-border:rgba(255,255,255,.7);
  --field-bg:rgba(255,255,255,.45);
  --danger:#ff3b30;
  --success:#34c759;
  --radius:26px;
  --font:-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
}

*{box-sizing:border-box;margin:0;padding:0}

html,body{height:100%}

body{
  font-family:var(--font);
  color:var(--text);
  min-height:100vh;
  display:grid;
  place-items:center;
  padding:20px;
  overflow:hidden;
  background:linear-gradient(135deg,#dbeafe 0%,#e9d5ff 45%,#fbe2e8 100%);
}

/* ---------- Fundo com orbes flutuantes ---------- */
.bg{position:fixed;inset:0;z-index:-1;overflow:hidden}
.orb{
  position:absolute;border-radius:50%;filter:blur(60px);opacity:.65;
  animation:float 18s ease-in-out infinite;
}
.orb-1{width:340px;height:340px;background:#7cb8ff;top:-80px;left:-60px}
.orb-2{width:300px;height:300px;background:#d8a8ff;bottom:-70px;right:-40px;animation-delay:-4s}
.orb-3{width:240px;height:240px;background:#ffb3c7;top:40%;right:12%;animation-delay:-8s}
.orb-4{width:260px;height:260px;background:#9ae6d0;bottom:18%;left:6%;animation-delay:-12s}

@keyframes float{
  0%,100%{transform:translate(0,0) scale(1)}
  33%{transform:translate(30px,-40px) scale(1.08)}
  66%{transform:translate(-25px,25px) scale(.95)}
}

/* ---------- Cartão de vidro ---------- */
.card{
  width:100%;max-width:400px;
  background:var(--glass);
  backdrop-filter:blur(28px) saturate(180%);
  -webkit-backdrop-filter:blur(28px) saturate(180%);
  border:1px solid var(--glass-border);
  border-radius:var(--radius);
  box-shadow:0 20px 60px -15px rgba(40,30,90,.35), inset 0 1px 0 rgba(255,255,255,.6);
  padding:34px 30px 30px;
  animation:rise .6s cubic-bezier(.2,.8,.2,1) both;
}
@keyframes rise{from{opacity:0;transform:translateY(20px) scale(.98)}to{opacity:1;transform:none}}

/* ---------- Logo ---------- */
.logo{text-align:center;margin-bottom:22px}
.logo-mark{
  width:60px;height:60px;margin:0 auto 12px;border-radius:18px;
  background:linear-gradient(145deg,var(--blue),#5e5ce6);
  color:#fff;font-weight:700;font-size:24px;letter-spacing:.02em;
  display:grid;place-items:center;
  box-shadow:0 10px 24px -8px rgba(10,132,255,.6);
}
.logo h1{font-size:24px;font-weight:700;letter-spacing:-.02em}
.subtitle{font-size:14px;color:var(--text-soft);margin-top:3px}

/* ---------- Segmented control (abas) ---------- */
.segment{
  position:relative;display:flex;background:rgba(120,120,128,.16);
  border-radius:14px;padding:4px;margin-bottom:18px;
}
.segment-thumb{
  position:absolute;top:4px;left:4px;width:calc(50% - 4px);height:calc(100% - 8px);
  background:#fff;border-radius:11px;box-shadow:0 2px 6px rgba(0,0,0,.12);
  transition:transform .32s cubic-bezier(.2,.8,.2,1);
}
.segment-thumb.right{transform:translateX(100%)}
.segment-btn{
  flex:1;position:relative;z-index:1;background:none;border:none;cursor:pointer;
  font-family:var(--font);font-size:15px;font-weight:600;color:var(--text-soft);
  padding:9px 0;transition:color .25s;
}
.segment-btn.active{color:var(--text)}

/* ---------- Alerta ---------- */
.alert{
  display:none;border-radius:12px;padding:11px 14px;margin-bottom:16px;
  font-size:13.5px;font-weight:500;line-height:1.35;
}
.alert.show{display:block;animation:rise .3s ease both}
.alert.error{background:rgba(255,59,48,.12);color:#c4291f;border:1px solid rgba(255,59,48,.25)}
.alert.ok{background:rgba(52,199,89,.14);color:#1d7a3a;border:1px solid rgba(52,199,89,.3)}

/* ---------- Formulários ---------- */
.form{display:none;flex-direction:column;gap:14px}
.form.active{display:flex;animation:rise .35s ease both}

.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:13px;font-weight:600;color:var(--text-soft);padding-left:2px}
.field input{
  font-family:var(--font);font-size:16px;color:var(--text);
  background:var(--field-bg);border:1px solid rgba(255,255,255,.6);
  border-radius:13px;padding:13px 15px;transition:.2s;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
}
.field input::placeholder{color:rgba(60,60,67,.4)}
.field input:focus{
  outline:none;border-color:var(--blue);background:rgba(255,255,255,.7);
  box-shadow:0 0 0 4px rgba(10,132,255,.15);
}

/* ---------- Botões ---------- */
.btn{
  font-family:var(--font);font-size:16px;font-weight:600;cursor:pointer;
  border-radius:14px;padding:14px;border:none;transition:.18s;
  display:flex;align-items:center;justify-content:center;gap:9px;
}
.btn:active{transform:scale(.98)}
.btn:disabled{opacity:.55;cursor:default;transform:none}
.btn-primary{
  background:linear-gradient(145deg,var(--blue),var(--blue-dark));color:#fff;margin-top:4px;
  box-shadow:0 8px 20px -8px rgba(10,132,255,.7);
}
.btn-primary:hover{filter:brightness(1.05)}
.btn-google{
  background:rgba(255,255,255,.7);color:var(--text);
  border:1px solid rgba(255,255,255,.8);
}
.btn-google:hover{background:rgba(255,255,255,.92)}

/* ---------- Divisor "ou" ---------- */
.divider{display:flex;align-items:center;text-align:center;color:var(--text-soft);font-size:13px;margin:2px 0}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:rgba(60,60,67,.18)}
.divider span{padding:0 12px}

/* ---------- Responsivo ---------- */
@media (max-width:420px){
  .card{padding:28px 22px 24px;border-radius:22px}
  .logo h1{font-size:22px}
}
