// ╔═══════════════════════════════════════════════════════════╗
// ║     ZENKZONE — app.js  |  Frontend conectado al SQL      ║
// ║   Toda acción llama al servidor → se guarda en SQLite    ║
// ╚═══════════════════════════════════════════════════════════╝
'use strict';

const ADMIN_USERNAMES = ['Kev1nRd', 'LOVE69'];

const S = { user:null, token:sessionStorage.getItem('zk_token')||localStorage.getItem('zk_token')||null, page:'home', region:localStorage.getItem('zk_region')||null, lang:localStorage.getItem('zk_lang')||'es', adminTab:'news', newsFilter:'ALL', tourFilter:'ALL' };

function isAdmin() { return S.user && (S.user.isAdmin || ADMIN_USERNAMES.includes(S.user.username)); }

// ── CAPA API ──────────────────────────────────────────────────
// API relativa: funciona cuando Express sirve el frontend desde el mismo puerto.
async function apiFetch(method, endpoint, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...(S.token?{'Authorization':`Bearer ${S.token}`}:{}) } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + endpoint, opts);
  const data = await res.json();
  if (res.status === 401) {
    // Sesión expirada → forzar nuevo login
    S.token = null; S.user = null;
    sessionStorage.removeItem('zk_token');
    localStorage.removeItem('zk_token');
    renderNav();
    renderPage('login');
    throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
  }
  if (!res.ok) throw new Error(data.error||`Error ${res.status}`);
  return data;
}
const API = {
  login:(u,p)=>apiFetch('POST','/auth/login',{username:u,password:p}),
  register:(u,e,p,r,gid)=>apiFetch('POST','/auth/register',{username:u,email:e,password:p,region:r,game_id:gid}),
  logout:()=>apiFetch('POST','/auth/logout'),
  me:()=>apiFetch('GET','/auth/me'),
  getNews:()=>apiFetch('GET','/news'),
  createNews:d=>apiFetch('POST','/news',d),
  updateNews:(id,d)=>apiFetch('PUT',`/news/${id}`,d),
  deleteNews:id=>apiFetch('DELETE',`/news/${id}`),
  getTours:()=>apiFetch('GET','/tournaments'),
  createTour:d=>apiFetch('POST','/tournaments',d),
  updateTour:(id,d)=>apiFetch('PUT',`/tournaments/${id}`,d),
  deleteTour:id=>apiFetch('DELETE',`/tournaments/${id}`),
  joinTour:id=>apiFetch('POST',`/tournaments/${id}/join`),
  awardTour:(id,d)=>apiFetch('POST',`/tournaments/${id}/award`,d),
  getStore:()=>apiFetch('GET','/store'),
  createItem:d=>apiFetch('POST','/store',d),
  updateItem:(id,d)=>apiFetch('PUT',`/store/${id}`,d),
  deleteItem:id=>apiFetch('DELETE',`/store/${id}`),
  redeemItem:(id,d)=>apiFetch('POST',`/store/${id}/redeem`,d),
  storeHistory:()=>apiFetch('GET','/store/history'),
  getCodes:()=>apiFetch('GET','/codes'),
  createCode:d=>apiFetch('POST','/codes',d),
  deleteCode:id=>apiFetch('DELETE',`/codes/${id}`),
  redeemCode:code=>apiFetch('POST','/codes/redeem',{code}),
  getSocial:()=>apiFetch('GET','/social'),
  createSocial:d=>apiFetch('POST','/social',d),
  updateSocial:(id,d)=>apiFetch('PUT',`/social/${id}`,d),
  deleteSocial:id=>apiFetch('DELETE',`/social/${id}`),
  getCollabs:()=>apiFetch('GET','/collabs'),
  createCollab:d=>apiFetch('POST','/collabs',d),
  updateCollab:(id,d)=>apiFetch('PUT',`/collabs/${id}`,d),
  deleteCollab:id=>apiFetch('DELETE',`/collabs/${id}`),
  getUsers:()=>apiFetch('GET','/users'),
  givePoints:(u,a)=>apiFetch('POST',`/users/${u}/give-points`,{amount:a}),
  toggleMismatch:u=>apiFetch('POST',`/users/${u}/toggle-mismatch`),
  saveGameId:(gid,greg)=>apiFetch('PUT','/users/me/game-id',{game_id:gid,game_region:greg}),
  getNotifications:()=>apiFetch('GET','/notifications'),
  readAllNotifs:()=>apiFetch('POST','/notifications/read-all'),
  deleteNotif:id=>apiFetch('DELETE',`/notifications/${id}`),
  getPublicProfile:u=>apiFetch('GET',`/users/${u}/public`),
  forgotPassword:email=>apiFetch('POST','/auth/forgot-password',{email}),
  resetPassword:(token,password)=>apiFetch('POST','/auth/reset-password',{token,password}),
  setUserRole:(u,role)=>apiFetch('PUT',`/users/${u}/role`,{role}),
  unlockUser:u=>apiFetch('POST',`/users/${u}/unlock`),
  getStats:()=>apiFetch('GET','/stats'),
  getStreams:()=>apiFetch('GET','/streams'),
  createStream:d=>apiFetch('POST','/streams',d),
  updateStream:(id,d)=>apiFetch('PUT',`/streams/${id}`,d),
  deleteStream:id=>apiFetch('DELETE',`/streams/${id}`),
  toggleLive:id=>apiFetch('POST',`/streams/${id}/toggle-live`),
  adminSetGameId:(u,gid,greg)=>apiFetch('PUT',`/users/${u}/game-id`,{game_id:gid,game_region:greg}),
  getAllRedemptions:()=>apiFetch('GET','/store/all-redemptions'),
  getStats:()=>apiFetch('GET','/stats'),
};

// ── TRADUCCIONES ──────────────────────────────────────────────
const TR = {
  es:{ home:'Inicio',tournaments:'Torneos',store:'Tienda',login:'Iniciar Sesión',register:'Registrarse',profile:'Perfil',admin:'Admin',logout:'Salir',news_title:'NOVEDADES',all:'Todo',join:'Participar',joined:'✓ Inscrito',upcoming:'PRÓXIMO',active:'ACTIVO',finished:'FINALIZADO',prize1:'🥇 1er: 700 pts',prize2:'🥈 2do: 550 pts',prize3:'🥉 3er: 350 pts',prize_part:'🎮 Participación: 10 pts',store_title:'TIENDA DE CANJE',redeem:'Canjear',pts:'puntos',stock_lbl:'Stock:',login_title:'BIENVENIDO DE VUELTA',username:'Usuario',password:'Contraseña',enter:'ENTRAR',no_acc:'¿No tienes cuenta?',sign_up:'Regístrate',reg_title:'ÚNETE A ZENKZONE',email:'Email',region:'Región',create_acc:'CREAR CUENTA',have_acc:'¿Ya tienes cuenta?',sign_in:'Inicia sesión',profile_title:'MI PERFIL',your_pts:'Tus Puntos',game_id:'ID de Free Fire',game_region:'Región del juego',save:'Guardar',saved:'✓ Guardado',code_section:'CANJEAR CÓDIGO',code_ph:'Ingresa tu código...',code_btn:'CANJEAR',code_ok:'¡Código canjeado! +',pts_added:' puntos',code_err:'Código inválido o agotado',mismatch_notif:'⚠️ Tu ID de Free Fire no coincide con tu región registrada.',must_login:'Debes iniciar sesión para participar',congrats:'¡Inscrito! Buena suerte.',no_news:'No hay novedades',no_tours:'No hay torneos',no_items:'No hay ítems en la tienda',participants_lbl:'Participantes',first_store_title:'¡Primera vez en la Tienda!',first_store_desc:'Ingresa tu ID de Free Fire y tu región de juego.',game_id_ph:'Tu ID (ej: 123456789)',confirm:'CONFIRMAR',insufficient_pts:'Puntos insuficientes',redeemed_ok:'¡Canjeado! Tu premio será procesado pronto.',out_of_stock:'Sin stock',collabs_title:'COLABORACIONES',follow_us:'SÍGUENOS',tours_title:'TORNEOS',no_participants:'Sin participantes aún',your_history:'Historial de Canje',no_history:'Aún no has canjeado nada',admin_title:'PANEL ADMINISTRATIVO',adm_news:'Novedades',adm_tours:'Torneos',adm_store:'Tienda',adm_codes:'Códigos',adm_social:'Redes Sociales',adm_collabs:'Colaboraciones',adm_users:'Usuarios',add:'Agregar',edit:'Editar',del:'Eliminar',cancel:'Cancelar',title_es:'Título (ES)',title_en:'Título (EN)',content_es:'Contenido (ES)',content_en:'Contenido (EN)',img_url:'URL de Imagen',date_lbl:'Fecha',region_lbl:'Región',desc_es:'Descripción (ES)',desc_en:'Descripción (EN)',start_date:'Fecha Inicio',end_date:'Fecha Fin',status_lbl:'Estado',name_es:'Nombre (ES)',name_en:'Nombre (EN)',price_pts:'Precio (pts)',stock_qty:'Stock',code_lbl:'Código',max_uses:'Usos Máx',code_pts_lbl:'Puntos',platform_lbl:'Plataforma',url_lbl:'URL',icon_lbl:'Ícono',collab_name:'Nombre',collab_img:'URL Imagen',collab_url:'URL Perfil',finalize:'Finalizar y dar premios',winner1:'1er Lugar',winner2:'2do Lugar',winner3:'3er Lugar',award:'Otorgar Premios',extra_pts:'Puntos Extra (opcional)',all_get_10:'Resto de participantes: 10 pts por participar.',pts_given:'¡Premios otorgados!',mismatch_flag:'⚠ Marcar mismatch',unmismatch:'✓ Quitar aviso',give_pts:'Dar Puntos',loading:'Cargando...',error_loading:'Error al cargar datos.',custom_pts:'Puntos:',global:'GLOBAL' },
  en:{ home:'Home',tournaments:'Tournaments',store:'Store',login:'Login',register:'Register',profile:'Profile',admin:'Admin',logout:'Logout',news_title:'NEWS',all:'All',join:'Join',joined:'✓ Joined',upcoming:'UPCOMING',active:'ACTIVE',finished:'FINISHED',prize1:'🥇 1st: 700 pts',prize2:'🥈 2nd: 550 pts',prize3:'🥉 3rd: 350 pts',prize_part:'🎮 Participation: 10 pts',store_title:'REDEMPTION STORE',redeem:'Redeem',pts:'points',stock_lbl:'Stock:',login_title:'WELCOME BACK',username:'Username',password:'Password',enter:'ENTER',no_acc:"Don't have an account?",sign_up:'Sign up',reg_title:'JOIN ZENKZONE',email:'Email',region:'Region',create_acc:'CREATE ACCOUNT',have_acc:'Already have an account?',sign_in:'Sign in',profile_title:'MY PROFILE',your_pts:'Your Points',game_id:'Free Fire ID',game_region:'Game Region',save:'Save',saved:'✓ Saved',code_section:'REDEEM CODE',code_ph:'Enter your code...',code_btn:'REDEEM',code_ok:'Code redeemed! +',pts_added:' points',code_err:'Invalid or exhausted code',mismatch_notif:"⚠️ Your Free Fire ID doesn't match your registered region.",must_login:'You must be logged in to participate',congrats:'Joined! Good luck.',no_news:'No news available',no_tours:'No tournaments',no_items:'No items in store',participants_lbl:'Participants',first_store_title:'First time in the Store!',first_store_desc:'Enter your Free Fire ID and game region.',game_id_ph:'Your ID (e.g. 123456789)',confirm:'CONFIRM',insufficient_pts:'Insufficient points',redeemed_ok:'Redeemed! Your prize will be processed soon.',out_of_stock:'Out of stock',collabs_title:'COLLABORATIONS',follow_us:'FOLLOW US',tours_title:'TOURNAMENTS',no_participants:'No participants yet',your_history:'Redemption History',no_history:"You haven't redeemed anything yet",admin_title:'ADMIN PANEL',adm_news:'News',adm_tours:'Tournaments',adm_store:'Store',adm_codes:'Codes',adm_social:'Social Media',adm_collabs:'Collaborations',adm_users:'Users',add:'Add',edit:'Edit',del:'Delete',cancel:'Cancel',title_es:'Title (ES)',title_en:'Title (EN)',content_es:'Content (ES)',content_en:'Content (EN)',img_url:'Image URL',date_lbl:'Date',region_lbl:'Region',desc_es:'Description (ES)',desc_en:'Description (EN)',start_date:'Start Date',end_date:'End Date',status_lbl:'Status',name_es:'Name (ES)',name_en:'Name (EN)',price_pts:'Price (pts)',stock_qty:'Stock',code_lbl:'Code',max_uses:'Max Uses',code_pts_lbl:'Points',platform_lbl:'Platform',url_lbl:'URL',icon_lbl:'Icon',collab_name:'Name',collab_img:'Image URL',collab_url:'Profile URL',finalize:'Finalize & award prizes',winner1:'1st Place',winner2:'2nd Place',winner3:'3rd Place',award:'Award Prizes',extra_pts:'Extra Points (optional)',all_get_10:'Other participants get 10 pts for participating.',pts_given:'Points awarded!',mismatch_flag:'⚠ Flag mismatch',unmismatch:'✓ Remove warning',give_pts:'Give Points',loading:'Loading...',error_loading:'Error loading data.',custom_pts:'Points:',global:'GLOBAL' }
};
function t(k){ return (TR[S.lang]||TR.es)[k]||TR.es[k]||k; }

// ── HELPERS ───────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function tagClass(r){ return r==='LATAM'?'tag-latam':r==='EEUU'?'tag-eeuu':'tag-global'; }
function stCls(s){ return s==='active'?'status-active':s==='upcoming'?'status-upcoming':'status-finished'; }
function notif(msg,type='warn'){ return `<div class="notif notif-${type}">${esc(msg)}</div>`; }
function loading(root){ root.innerHTML=`<div class="page"><div class="container"><div class="empty-state" style="font-size:11px;letter-spacing:3px;">${t('loading')}</div></div></div>`; }
function pRows(tr){ return `<div class="prize-row">🥇 1er: ${tr.prize_1st||700} pts</div><div class="prize-row">🥈 2do: ${tr.prize_2nd||550} pts</div><div class="prize-row">🥉 3er: ${tr.prize_3rd||350} pts</div><div class="prize-row">${t('prize_part')}</div>`; }

function zenkHeroAnimation(user=null){
  const username = user?.username || 'ZENK PLAYER';
  const gid = user?.game_id || 'ID NUMÉRICO';
  const points = user?.points ?? 0;
  const region = user?.region || S.region || 'LATAM';
  return `<section class="zk-anim-wrap" aria-label="Animación ZENKZONE">
    <div class="zk-anim-bg-grid"></div>
    <div class="zk-anim-orb zk-orb-a"></div>
    <div class="zk-anim-orb zk-orb-b"></div>
    <div class="zk-anim-panel">
      <div class="zk-anim-left">
        <div class="zk-kicker">FREE FIRE HUB</div>
        <div class="zk-anim-title">ZENK<span>ZONE</span></div>
        <div class="zk-anim-sub">Registra tu ID, participa en torneos y canjea recompensas.</div>
        <div class="zk-anim-badges">
          <span>⚡ ${esc(points)} pts</span>
          <span>🌎 ${esc(region)}</span>
          <span>🎮 ${esc(gid)}</span>
        </div>
      </div>
      <div class="zk-player-card">
        <div class="zk-card-scan"></div>
        <div class="zk-card-corner c1"></div><div class="zk-card-corner c2"></div><div class="zk-card-corner c3"></div><div class="zk-card-corner c4"></div>
        <div class="zk-avatar-core">👾</div>
        <div class="zk-player-name">${esc(username)}</div>
        <div class="zk-player-id">ID: ${esc(gid)}</div>
        <div class="zk-energy-bar"><span></span></div>
      </div>
    </div>
  </section>`;
}


// ── TOAST ─────────────────────────────────────────────────────
let _tt;
function showToast(msg,type='success'){ const c=document.getElementById('toast-container'); if(c)c.innerHTML=`<div class="toast toast-${type}">${esc(msg)}</div>`; clearTimeout(_tt); _tt=setTimeout(()=>{if(c)c.innerHTML='';},3200); }

// ── MODAL ─────────────────────────────────────────────────────
function openModal(html){ document.getElementById('modal-box').innerHTML=html; document.getElementById('modal-overlay').classList.remove('hidden'); }
function closeModal(){ document.getElementById('modal-overlay').classList.add('hidden'); }
window.closeModal=closeModal;

// ── NAV ───────────────────────────────────────────────────────
async function updateLiveDot(){
  try{
    const ss=await API.getStreams();
    const hasLive=ss.some(s=>s.is_live);
    const link=document.querySelector('.nav-link[onclick*="streams"]');
    if(link){
      const dot=link.querySelector('.nav-live-dot');
      if(hasLive&&!dot){
        const d=document.createElement('span');
        d.className='nav-live-dot';
        link.appendChild(d);
      } else if(!hasLive&&dot){
        dot.remove();
      }
    }
  }catch{}
}
function renderNav(){
  const nav=document.getElementById('main-nav');
  const pts=S.user&&!S.user.isAdmin?S.user.points||0:null;
  const unread=S.unreadNotifs||0;
  const pages=[{k:'home',l:t('home')},{k:'tournaments',l:t('tournaments')},{k:'store',l:t('store')},{k:'streams',l:'🔴 En Vivo'},...(S.user?[{k:'profile',l:t('profile')}]:[{k:'login',l:t('login')},{k:'register',l:t('register')}]),...(isAdmin()?[{k:'admin',l:t('admin')}]:[])];
  const lsw=S.region==='OTRO'?`<div class="lang-switcher"><button class="lang-btn ${S.lang==='es'?'active':''}" onclick="app.setLang('es')">ES</button><button class="lang-btn ${S.lang==='en'?'active':''}" onclick="app.setLang('en')">EN</button></div>`:'';
  nav.innerHTML=`<button class="nav-logo" onclick="app.go('home')">ZENK<span class="accent">ZONE</span><span class="icon">👾</span></button><div class="nav-links" id="nav-links-list">${pages.map(p=>`<button class="nav-link ${S.page===p.k?'active':''}" onclick="app.go('${p.k}')">${esc(p.l)}</button>`).join('')}${S.user?`<button class="nav-link" onclick="app.logout()">${t('logout')}</button>`:''}</div><div class="nav-right">${pts!==null?`<div class="nav-pts">⚡ ${pts} pts</div>`:''}
      ${S.user&&!S.user.isAdmin?`<button class="notif-bell" onclick="app.showNotifs()" title="Notificaciones">
        🔔${unread>0?`<span class="notif-count">${unread>9?'9+':unread}</span>`:''}</button>`:''}
      ${lsw}<button class="globe-btn" onclick="app.resetRegion()" title="Cambiar región">🌐</button><button class="menu-btn" onclick="app.toggleMobileMenu()">☰</button></div>`;
}

// ── ROUTER ────────────────────────────────────────────────────
async function renderPage(page){
  if(!S.region)return;
  S.page=page; renderNav();
  const root=document.getElementById('app-root');
  closeModal(); window.scrollTo(0,0); loading(root);
  try{
    if(page==='home')await renderHome(root);
    else if(page==='tournaments')await renderTournaments(root);
    else if(page==='store')await renderStore(root);
    else if(page==='login')renderLogin(root);
    else if(page==='register')renderRegister(root);
    else if(page==='profile')await renderProfile(root);
    else if(page==='streams')await renderStreams(root);
    else if(page==='admin'){ if(isAdmin())await renderAdmin(root); else renderLogin(root); }
    else await renderHome(root);
  }catch(e){ root.innerHTML=`<div class="page"><div class="container">${notif(t('error_loading')+' '+e.message,'error')}</div></div>`; }
}

// ── HOME ──────────────────────────────────────────────────────
async function renderHome(root){
  const [allNews,social,collabs]=await Promise.all([API.getNews(),API.getSocial(),API.getCollabs()]);
  const news=S.newsFilter==='ALL'?allNews:allNews.filter(n=>n.region===S.newsFilter||n.region==='ALL');

  // Cards de noticias con diseño futurista + reveal animado
  const cards=news.length===0
    ?`<div class="empty-state">${t('no_news')}</div>`
    :`<div class="grid-2">${news.map((n,i)=>`
      <div class="card card-glow zk-news-card" style="opacity:0;transform:translateY(40px);transition:opacity .6s ${i*0.1}s ease,transform .6s ${i*0.1}s ease">
        <div class="zk-news-bar"></div>
        <img src="${esc(n.image)}" alt="" class="news-img" loading="lazy"/>
        <div class="news-body">
          <span class="region-tag ${tagClass(n.region)}">${n.region==='ALL'?t('global'):n.region}</span>
          <div class="news-title">${esc(S.lang==='es'?n.title_es:n.title_en)}</div>
          <div class="news-content">${esc(S.lang==='es'?n.content_es:n.content_en)}</div>
          <div class="news-date">${esc(n.pub_date)}</div>
        </div>
      </div>`).join('')}</div>`;

  const csec=collabs.length===0?'':` <div style="margin-top:52px;"><div class="section-header"><div class="section-title">${t('collabs_title')}</div><div class="section-line"></div></div><div class="grid-4">${collabs.map((c,i)=>`<div class="card collab-card" style="opacity:0;transform:scale(0.88);transition:opacity .5s ${i*0.08}s,transform .5s ${i*0.08}s"><img src="${esc(c.image)}" alt="${esc(c.name)}" class="collab-img" loading="lazy"/><div class="collab-name">${esc(c.name)}</div>${c.url&&c.url!=='#'?`<a href="${esc(c.url)}" target="_blank" rel="noreferrer" class="collab-link">↗ Ver perfil</a>`:''}</div>`).join('')}</div></div>`;
  // Mapeo de colores y labels por plataforma
  function socStyle(platform){
    const p=(platform||'').toLowerCase();
    if(p.includes('youtube'))  return {c:'#FF0000',bg:'rgba(255,0,0,.08)',glow:'rgba(255,0,0,.25)',ico:'▶'};
    if(p.includes('tiktok'))   return {c:'#69C9D0',bg:'rgba(105,201,208,.07)',glow:'rgba(105,201,208,.2)',ico:'♪'};
    if(p.includes('instagram'))return {c:'#E1306C',bg:'rgba(225,48,108,.07)',glow:'rgba(225,48,108,.2)',ico:'◈'};
    if(p.includes('twitter')||p.includes('x.com'))return {c:'#1DA1F2',bg:'rgba(29,161,242,.07)',glow:'rgba(29,161,242,.2)',ico:'✗'};
    if(p.includes('discord'))  return {c:'#5865F2',bg:'rgba(88,101,242,.08)',glow:'rgba(88,101,242,.25)',ico:'◉'};
    if(p.includes('twitch'))   return {c:'#9146FF',bg:'rgba(145,70,255,.07)',glow:'rgba(145,70,255,.22)',ico:'◆'};
    if(p.includes('facebook')) return {c:'#1877F2',bg:'rgba(24,119,242,.07)',glow:'rgba(24,119,242,.2)',ico:'ƒ'};
    return {c:'#00FF88',bg:'rgba(0,255,136,.07)',glow:'rgba(0,255,136,.22)',ico:'◎'};
  }
  const ssec=social.length===0?'':` <div class="zk-social-section">
    <div class="zk-section-divider" style="margin-bottom:32px;">
      <span class="zk-section-label">// ${t('follow_us')}</span>
      <div class="zk-section-line"></div>
    </div>
    <div class="zk-social-grid">
      ${social.map((s,i)=>{
        const st=socStyle(s.platform);
        return `<a href="${esc(s.url)}" target="_blank" rel="noreferrer"
          class="zk-social-card"
          style="--sc:${st.c};--sbg:${st.bg};--sglow:${st.glow};opacity:0;transform:translateY(28px) scale(.95);transition:opacity .5s ${i*0.1}s,transform .5s ${i*0.1}s;">
          <div class="zk-social-card-bar"></div>
          <div class="zk-social-card-icon">${esc(s.icon)||st.ico}</div>
          <div class="zk-social-card-name">${esc(s.platform)}</div>
          <div class="zk-social-card-arrow">↗</div>
          <div class="zk-social-card-glow"></div>
        </a>`;
      }).join('')}
    </div>
  </div>`;

  // Hero sin el zenkHeroAnimation — reemplazado por diseño propio futurista
  const heroHTML=`
    <div class="zk-home-hero">
      <div class="zk-home-hero-bg"></div>
      <div class="zk-home-hero-content">
        <div class="zk-home-badge">
          <span class="zk-home-badge-dot"></span>
          ${esc(S.region)} REGION — FREE FIRE HUB
        </div>
        <h1 class="zk-home-title" data-text="ZENKZONE">ZENK<span>ZONE</span></h1>
        <p class="zk-home-sub">Torneos, recompensas y comunidad Free Fire para LATAM y EEUU.</p>
        <div class="zk-home-actions">
          <button class="btn btn-primary zk-btn-glow" onclick="app.go('tournaments')">⚔ VER TORNEOS</button>
          <button class="btn btn-outline" onclick="app.go('store')">🛒 TIENDA</button>
        </div>
        ${S.user?`<div class="zk-home-stats">
          <div class="zk-home-stat"><span class="zk-home-stat-val">${S.user.points||0}</span><span class="zk-home-stat-lbl">⚡ Puntos</span></div>
          <div class="zk-home-stat"><span class="zk-home-stat-val">${esc(S.user.region||'—')}</span><span class="zk-home-stat-lbl">🌎 Región</span></div>
          <div class="zk-home-stat"><span class="zk-home-stat-val">${esc(S.user.username)}</span><span class="zk-home-stat-lbl">👾 Usuario</span></div>
        </div>`:''}
      </div>
      <div class="zk-home-orb-wrap">
        <div class="zk-home-orb1"></div>
        <div class="zk-home-orb2"></div>
        <div class="zk-home-orb3"></div>
        <div class="zk-home-orb-core">👾</div>
      </div>
    </div>`;

  root.innerHTML=`<div class="page"><div class="container">
    ${heroHTML}
    <div class="zk-section-divider">
      <span class="zk-section-label">// ${t('news_title')}</span>
      <div class="zk-section-line"></div>
      <div class="filter-tabs" style="margin:0;padding:0;">
        <button class="filter-tab ${S.newsFilter==='ALL'?'active':''}" onclick="app.setNewsFilter('ALL')">${t('all')}</button>
        <button class="filter-tab ${S.newsFilter==='LATAM'?'active':''}" onclick="app.setNewsFilter('LATAM')">LATAM</button>
        <button class="filter-tab ${S.newsFilter==='EEUU'?'active':''}" onclick="app.setNewsFilter('EEUU')">EEUU</button>
      </div>
    </div>
    ${cards}${csec}${ssec}
  </div></div>`;

  // Activar animaciones tras render
  requestAnimationFrame(()=>{
    root.querySelectorAll('.zk-news-card,.collab-card,.zk-social-card').forEach(el=>{
      el.style.opacity='1'; el.style.transform='none';
    });
  });
}

// ── TORNEOS ───────────────────────────────────────────────────
async function renderTournaments(root){
  const tours=await API.getTours();
  const fil=S.tourFilter==='ALL'?tours:tours.filter(tr=>tr.region===S.tourFilter||tr.region==='ALL');
  const mm=S.user&&S.user.region_mismatch;
  const activeCount=fil.filter(tr=>tr.status==='active').length;

  function tourCard(tr,idx){
    const j=S.user&&tr.participants.includes(S.user.username);
    const isActive=tr.status==='active';
    const barColor=isActive?'linear-gradient(90deg,#00FF88,#00D4FF,#00FF88)':tr.status==='upcoming'?'linear-gradient(90deg,#00D4FF,rgba(0,212,255,.2),#00D4FF)':'linear-gradient(90deg,#1E2A3A,#2A3A5A,#1E2A3A)';
    const statusCls=isActive?'status-active zk-status-live':tr.status==='upcoming'?'status-upcoming':'status-finished';
    const statusDot=isActive?`<span class="zk-status-dot"></span>`:'';
    return `<div class="zk-tour-card" style="opacity:0;transform:translateY(36px) scale(0.96);transition:opacity .55s ${idx*0.1}s ease,transform .55s ${idx*0.1}s ease">
      <div class="zk-tour-bar" style="background:${barColor};background-size:200%;animation:zkBarFlow 3s linear infinite"></div>
      <div class="zk-tour-body">
        <div class="zk-tour-head">
          <span class="status-tag ${statusCls}">${statusDot}${t(tr.status)}</span>
          <span class="zk-tour-region">${tr.region==='ALL'?'🌍 GLOBAL':tr.region==='LATAM'?'🌎 LATAM':'🇺🇸 EEUU'}</span>
        </div>
        <div class="zk-tour-num">${String(idx+1).padStart(2,'0')}</div>
        <div class="tour-title">${esc(S.lang==='es'?tr.title_es:tr.title_en)}</div>
        <div class="tour-desc">${esc(S.lang==='es'?tr.desc_es:tr.desc_en)}</div>
        <div class="zk-tour-prizes">
          <div class="zk-prize-box zk-prize-1"><div class="zk-prize-medal">🥇</div><span>${tr.prize_1st||700}</span><small>pts</small></div>
          <div class="zk-prize-box zk-prize-2"><div class="zk-prize-medal">🥈</div><span>${tr.prize_2nd||550}</span><small>pts</small></div>
          <div class="zk-prize-box zk-prize-3"><div class="zk-prize-medal">🥉</div><span>${tr.prize_3rd||350}</span><small>pts</small></div>
        </div>
        ${tr.finalized&&tr.winner_1?`<div class="zk-winners-row">
          <div class="zk-winners-lbl">🏆 GANADORES</div>
          <div class="zk-winner">🥇 ${esc(tr.winner_1)}</div>
          ${tr.winner_2?`<div class="zk-winner">🥈 ${esc(tr.winner_2)}</div>`:''}
          ${tr.winner_3?`<div class="zk-winner">🥉 ${esc(tr.winner_3)}</div>`:''}
        </div>`:''}
        <div class="tour-dates">📅 ${esc(tr.start_date)} → ${esc(tr.end_date)}</div>
        <div class="tour-footer">
          <div class="participant-count zk-participants">
            <span class="zk-part-count">${tr.participants.length}</span> ${t('participants_lbl')}
          </div>
          ${!tr.finalized
            ?`<button class="btn ${j?'btn-outline':'btn-primary'} btn-sm zk-join-btn" onclick="app.joinTour('${esc(tr.id)}')" ${j?'disabled':''}>${j?t('joined'):t('join')}</button>`
            :`<span style="color:#3a4a6b;font-family:Orbitron,sans-serif;font-size:10px;letter-spacing:1px;">FINALIZADO</span>`}
        </div>
      </div>
    </div>`;
  }

  const cards=fil.length===0
    ?`<div class="empty-state">${t('no_tours')}</div>`
    :`<div class="zk-tours-grid">${fil.map((tr,i)=>tourCard(tr,i)).join('')}</div>`;

  root.innerHTML=`<div class="page"><div class="container">
    ${mm?notif(t('mismatch_notif')):''}
    <div class="zk-tours-hero">
      <div class="zk-tours-hero-left">
        <div class="zk-section-eyebrow">⚔ Competición</div>
        <h1 class="zk-tours-title">TOR<span>NEOS</span></h1>
        <p class="zk-tours-sub">Inscríbete, compite y gana puntos. ${activeCount} torneo${activeCount!==1?'s':''} activo${activeCount!==1?'s':''}.</p>
        <div class="filter-tabs" style="margin-top:16px;">
          <button class="filter-tab ${S.tourFilter==='ALL'?'active':''}" onclick="app.setTourFilter('ALL')">${t('all')}</button>
          <button class="filter-tab ${S.tourFilter==='LATAM'?'active':''}" onclick="app.setTourFilter('LATAM')">LATAM</button>
          <button class="filter-tab ${S.tourFilter==='EEUU'?'active':''}" onclick="app.setTourFilter('EEUU')">EEUU</button>
        </div>
      </div>
      <div class="zk-tours-active-badge">
        <span class="zk-tours-active-dot"></span>
        ${activeCount} ACTIVO${activeCount!==1?'S':''}
      </div>
    </div>
    ${cards}
  </div></div>`;

  // Activar animaciones
  requestAnimationFrame(()=>{
    root.querySelectorAll('.zk-tour-card').forEach(el=>{
      el.style.opacity='1'; el.style.transform='none';
    });
  });

  // Tilt 3D en hover
  root.querySelectorAll('.zk-tour-card').forEach(card=>{
    card.addEventListener('mousemove',e=>{
      const r=card.getBoundingClientRect();
      const dx=(e.clientX-r.left-r.width/2)/(r.width/2);
      const dy=(e.clientY-r.top-r.height/2)/(r.height/2);
      card.style.transform=`perspective(700px) rotateX(${-dy*5}deg) rotateY(${dx*6}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave',()=>card.style.transform='');
  });
}

// ── TIENDA ────────────────────────────────────────────────────
async function renderStore(root){
  const items=await API.getStore();
  const mm=S.user&&S.user.region_mismatch;

  function storeCard(item,idx){
    const ns=item.stock<=0;
    const np=S.user&&!S.user.isAdmin&&S.user.points<item.points;
    const bc=ns?'btn-danger':(np?'btn-outline':'btn-primary');
    const lowStock=item.stock>0&&item.stock<=5;
    return `<div class="zk-store-card" style="opacity:0;transform:translateY(32px);transition:opacity .5s ${idx*0.08}s ease,transform .5s ${idx*0.08}s ease">
      ${lowStock?`<div class="zk-store-stock-badge">Stock: ${item.stock}</div>`:''}
      ${ns?`<div class="zk-store-stock-badge zk-stock-out">Sin stock</div>`:''}
      <div class="zk-store-img-wrap">
        <img src="${esc(item.image)}" alt="" class="store-img" loading="lazy"/>
        <div class="zk-store-img-overlay"></div>
      </div>
      <div class="store-body">
        <div class="store-name">${esc(S.lang==='es'?item.name_es:item.name_en)}</div>
        <div class="store-desc">${esc(S.lang==='es'?item.desc_es:item.desc_en)}</div>
        <div class="store-footer">
          <div>
            <div class="store-price zk-price">⚡ ${item.points} <small>${t('pts')}</small></div>
            <div class="store-stock zk-stock-lbl">${t('stock_lbl')} ${item.stock<0?'∞':item.stock}</div>
          </div>
          <button class="btn ${bc} btn-sm zk-redeem-btn" onclick="app.redeemStore('${esc(item.id)}')" ${ns?'disabled':''}>${ns?t('out_of_stock'):t('redeem')}</button>
        </div>
      </div>
    </div>`;
  }

  const cards=items.length===0
    ?`<div class="empty-state">${t('no_items')}</div>`
    :`<div class="zk-store-grid">${items.map((item,i)=>storeCard(item,i)).join('')}</div>`;

  root.innerHTML=`<div class="page"><div class="container">
    ${mm?notif(t('mismatch_notif')):''}
    <div class="zk-store-hero">
      <div>
        <div class="zk-section-eyebrow">🛒 Recompensas</div>
        <h1 class="zk-store-title">${t('store_title')}</h1>
        <p class="zk-tours-sub">Canjea tus puntos por premios épicos de Free Fire.</p>
      </div>
      ${S.user&&!S.user.isAdmin?`
        <div class="zk-store-pts-box">
          <span class="zk-store-pts-val">${S.user.points||0}</span>
          <span class="zk-store-pts-lbl">⚡ puntos disponibles</span>
        </div>`:''}
    </div>
    ${cards}
  </div></div>`;

  // Activar animaciones
  requestAnimationFrame(()=>{
    root.querySelectorAll('.zk-store-card').forEach(el=>{
      el.style.opacity='1'; el.style.transform='none';
    });
  });

  // Shimmer + tilt en hover
  root.querySelectorAll('.zk-store-card').forEach(card=>{
    card.addEventListener('mousemove',e=>{
      const r=card.getBoundingClientRect();
      const dx=(e.clientX-r.left-r.width/2)/(r.width/2);
      const dy=(e.clientY-r.top-r.height/2)/(r.height/2);
      card.style.transform=`perspective(600px) rotateX(${-dy*4}deg) rotateY(${dx*5}deg) translateY(-5px)`;
      card.style.boxShadow=`0 20px 50px rgba(0,0,0,.4), 0 0 30px rgba(0,255,136,.06)`;
    });
    card.addEventListener('mouseleave',()=>{card.style.transform='';card.style.boxShadow='';});
  });
}

// ── LOGIN ─────────────────────────────────────────────────────
function renderLogin(root){
  root.innerHTML=`
  <div class="zk-auth-page">
    <!-- Panel izquierdo decorativo -->
    <div class="zk-auth-deco" aria-hidden="true">
      <div class="zk-auth-deco-bg"></div>
      <div class="zk-auth-orb zk-auth-orb1"></div>
      <div class="zk-auth-orb zk-auth-orb2"></div>
      <div class="zk-auth-orb zk-auth-orb3"></div>
      <div class="zk-auth-deco-content">
        <div class="zk-auth-logo">ZENK<span>ZONE</span> 👾</div>
        <div class="zk-auth-deco-title">Bienvenido de vuelta,<br/><em>Guerrero</em></div>
        <div class="zk-auth-deco-sub">Inicia sesión para ver torneos, canjear puntos y competir en Free Fire.</div>
        <div class="zk-auth-deco-stats">
          <div class="zk-auth-deco-stat"><span>⚔</span> Torneos activos</div>
          <div class="zk-auth-deco-stat"><span>⚡</span> Sistema de puntos</div>
          <div class="zk-auth-deco-stat"><span>🛒</span> Tienda de canje</div>
          <div class="zk-auth-deco-stat"><span>🔴</span> Streams en vivo</div>
        </div>
      </div>
      <div class="zk-auth-grid-lines"></div>
    </div>

    <!-- Panel derecho — formulario -->
    <div class="zk-auth-form-side">
      <div class="zk-auth-box" id="zkLoginBox">
        <div class="zk-auth-box-bar"></div>

        <div class="zk-auth-box-icon">🔐</div>
        <div class="zk-auth-box-title">${t('login_title')}</div>
        <div class="zk-auth-box-sub">Ingresa tus credenciales para acceder</div>

        <div id="l-err" class="notif notif-error hidden"></div>

        <div class="zk-auth-field">
          <label class="zk-auth-label">${t('username')}</label>
          <div class="zk-auth-input-wrap">
            <span class="zk-auth-input-icon">👤</span>
            <input id="l-u" class="zk-auth-input" placeholder="Tu usuario..." autocomplete="username"/>
          </div>
        </div>

        <div class="zk-auth-field">
          <label class="zk-auth-label">${t('password')}</label>
          <div class="zk-auth-input-wrap">
            <span class="zk-auth-input-icon">🔒</span>
            <input id="l-p" class="zk-auth-input" type="password" placeholder="Tu contraseña..." autocomplete="current-password"/>
            <button class="zk-auth-eye" id="l-eye" tabindex="-1">👁</button>
          </div>
        </div>

        <div class="zk-auth-remember">
          <label class="zk-auth-check-wrap">
            <input type="checkbox" id="l-remember" class="zk-auth-checkbox"/>
            <span class="zk-auth-check-custom"></span>
            Recordarme en este dispositivo
          </label>
          <button id="fp-link" class="zk-auth-link-sm">¿Olvidaste tu contraseña?</button>
        </div>

        <button class="zk-auth-submit" id="l-btn">
          <span id="l-btn-txt">ENTRAR</span>
          <span class="zk-auth-submit-arrow">→</span>
        </button>

        <div class="zk-auth-divider"><span>¿Eres nuevo?</span></div>

        <button class="zk-auth-switch-btn" onclick="app.go('register')">
          CREAR CUENTA GRATIS
        </button>
      </div>
    </div>
  </div>`;

  // Animación entrada
  setTimeout(()=>{
    const box=document.getElementById('zkLoginBox');
    if(box){ box.style.opacity='1'; box.style.transform='none'; }
  },50);

  // Toggle mostrar contraseña
  document.getElementById('l-eye').addEventListener('click',()=>{
    const inp=document.getElementById('l-p');
    inp.type=inp.type==='password'?'text':'password';
  });

  const doLogin=async()=>{
    const u=document.getElementById('l-u').value.trim();
    const p=document.getElementById('l-p').value;
    const e=document.getElementById('l-err');
    const btn=document.getElementById('l-btn');
    const btnTxt=document.getElementById('l-btn-txt');
    e.classList.add('hidden');
    if(!u||!p){e.textContent='Completa todos los campos';e.classList.remove('hidden');return;}
    // Estado loading
    btn.disabled=true; btnTxt.textContent='VERIFICANDO...'; btn.classList.add('zk-auth-loading');
    try{
      const{token,user}=await API.login(u,p);
      S.token=token; S.user=user;
      const rem=document.getElementById('l-remember')?.checked;
      if(rem) localStorage.setItem('zk_token',token);
      else sessionStorage.setItem('zk_token',token);
      // Animación salida
      const box=document.getElementById('zkLoginBox');
      if(box){ box.style.transform='scale(1.03)'; box.style.opacity='0'; }
      setTimeout(async()=>{ showToast('Bienvenido, '+user.username+'!'); await renderPage('home'); },300);
    }catch(err){
      e.textContent=err.message; e.classList.remove('hidden');
      btn.disabled=false; btnTxt.textContent='ENTRAR'; btn.classList.remove('zk-auth-loading');
      // Shake en error
      const box=document.getElementById('zkLoginBox');
      if(box){ box.classList.add('zk-auth-shake'); setTimeout(()=>box.classList.remove('zk-auth-shake'),500); }
    }
  };

  document.getElementById('l-btn').addEventListener('click',doLogin);
  const fplink=document.getElementById('fp-link');
  if(fplink) fplink.addEventListener('click',()=>app.showForgotPwd());
  document.getElementById('l-p').addEventListener('keydown',ev=>ev.key==='Enter'&&doLogin());

  // Focus en primer campo
  setTimeout(()=>document.getElementById('l-u')?.focus(),200);
}

// ── REGISTER ──────────────────────────────────────────────────
function renderRegister(root){
  root.innerHTML=`
  <div class="zk-auth-page">
    <!-- Panel izquierdo decorativo -->
    <div class="zk-auth-deco zk-auth-deco-register" aria-hidden="true">
      <div class="zk-auth-deco-bg"></div>
      <div class="zk-auth-orb zk-auth-orb1"></div>
      <div class="zk-auth-orb zk-auth-orb2"></div>
      <div class="zk-auth-orb zk-auth-orb3"></div>
      <div class="zk-auth-deco-content">
        <div class="zk-auth-logo">ZENK<span>ZONE</span> 👾</div>
        <div class="zk-auth-deco-title">Únete a la<br/><em>comunidad</em></div>
        <div class="zk-auth-deco-sub">Crea tu cuenta, registra tu ID de Free Fire y empieza a competir.</div>
        <div class="zk-auth-steps">
          <div class="zk-auth-step"><span class="zk-auth-step-num">01</span><span>Crea tu cuenta</span></div>
          <div class="zk-auth-step"><span class="zk-auth-step-num">02</span><span>Registra tu ID de Free Fire</span></div>
          <div class="zk-auth-step"><span class="zk-auth-step-num">03</span><span>Participa en torneos</span></div>
          <div class="zk-auth-step"><span class="zk-auth-step-num">04</span><span>Canjea tus puntos</span></div>
        </div>
      </div>
      <div class="zk-auth-grid-lines"></div>
    </div>

    <!-- Panel derecho — formulario -->
    <div class="zk-auth-form-side">
      <div class="zk-auth-box" id="zkRegBox">
        <div class="zk-auth-box-bar" style="background:linear-gradient(90deg,transparent,#00D4FF,#00FF88,#00D4FF,transparent)"></div>

        <div class="zk-auth-box-icon">⚡</div>
        <div class="zk-auth-box-title">${t('reg_title')}</div>
        <div class="zk-auth-box-sub">Completa el formulario para unirte a ZENKZONE</div>

        <div id="r-err" class="notif notif-error hidden"></div>

        <!-- Paso a paso visual -->
        <div class="zk-reg-steps">
          <div class="zk-reg-step active" id="zk-step-1">
            <span class="zk-reg-step-dot">1</span>
            <span>Cuenta</span>
          </div>
          <div class="zk-reg-step-line"></div>
          <div class="zk-reg-step" id="zk-step-2">
            <span class="zk-reg-step-dot">2</span>
            <span>Free Fire</span>
          </div>
          <div class="zk-reg-step-line"></div>
          <div class="zk-reg-step" id="zk-step-3">
            <span class="zk-reg-step-dot">3</span>
            <span>Región</span>
          </div>
        </div>

        <div class="zk-auth-field">
          <label class="zk-auth-label">${t('username')}</label>
          <div class="zk-auth-input-wrap">
            <span class="zk-auth-input-icon">👤</span>
            <input id="r-u" class="zk-auth-input" placeholder="Ej: Kev1nRD" autocomplete="username"/>
          </div>
        </div>

        <div class="zk-auth-field">
          <label class="zk-auth-label">${t('email')}</label>
          <div class="zk-auth-input-wrap">
            <span class="zk-auth-input-icon">✉</span>
            <input id="r-e" class="zk-auth-input" type="email" placeholder="tucorreo@email.com"/>
          </div>
        </div>

        <div class="zk-auth-field">
          <label class="zk-auth-label">${t('password')}</label>
          <div class="zk-auth-input-wrap">
            <span class="zk-auth-input-icon">🔒</span>
            <input id="r-p" class="zk-auth-input" type="password" placeholder="Mínimo 6 caracteres"/>
            <button class="zk-auth-eye" id="r-eye" tabindex="-1">👁</button>
          </div>
          <div class="zk-pwd-strength" id="r-strength">
            <div class="zk-pwd-bar"><div class="zk-pwd-fill" id="r-pwd-fill"></div></div>
            <span id="r-pwd-lbl" class="zk-pwd-lbl">Seguridad</span>
          </div>
        </div>

        <div class="zk-auth-field">
          <label class="zk-auth-label">
            ${t('game_id')}
            <span class="zk-auth-label-hint">¿Dónde encuentro mi ID? → Perfil en Free Fire</span>
          </label>
          <div class="zk-auth-input-wrap">
            <span class="zk-auth-input-icon">🎮</span>
            <input id="r-gid" class="zk-auth-input" inputmode="numeric" pattern="[0-9]*" maxlength="20" placeholder="Solo números. Ej: 123456789" autocomplete="off"/>
          </div>
          <div class="zk-gid-hint" id="r-gid-hint"></div>
        </div>

        <div class="zk-auth-field">
          <label class="zk-auth-label">${t('region')}</label>
          <div class="zk-region-selector">
            <button class="zk-region-btn ${S.region==='LATAM'?'active':''}" data-val="LATAM">🌎 LATAM</button>
            <button class="zk-region-btn ${S.region==='EEUU'?'active':''}" data-val="EEUU">🇺🇸 EEUU</button>
            <button class="zk-region-btn ${(!S.region||S.region==='OTRO')?'active':''}" data-val="OTRO">🌍 OTRO</button>
          </div>
          <input type="hidden" id="r-r" value="${S.region||'OTRO'}"/>
        </div>

        <button class="zk-auth-submit zk-auth-submit-green" id="r-btn">
          <span id="r-btn-txt">CREAR MI CUENTA</span>
          <span class="zk-auth-submit-arrow">→</span>
        </button>

        <div class="zk-auth-divider"><span>¿Ya tienes cuenta?</span></div>

        <button class="zk-auth-switch-btn zk-auth-switch-outline" onclick="app.go('login')">
          INICIAR SESIÓN
        </button>
      </div>
    </div>
  </div>`;

  // Animación entrada
  setTimeout(()=>{
    const box=document.getElementById('zkRegBox');
    if(box){ box.style.opacity='1'; box.style.transform='none'; }
  },50);

  // Toggle mostrar contraseña
  document.getElementById('r-eye').addEventListener('click',()=>{
    const inp=document.getElementById('r-p');
    inp.type=inp.type==='password'?'text':'password';
  });

  // Fuerza de contraseña
  document.getElementById('r-p').addEventListener('input',e=>{
    const v=e.target.value;
    const fill=document.getElementById('r-pwd-fill');
    const lbl=document.getElementById('r-pwd-lbl');
    if(!fill||!lbl) return;
    let score=0;
    if(v.length>=6) score++;
    if(v.length>=10) score++;
    if(/[A-Z]/.test(v)) score++;
    if(/[0-9]/.test(v)) score++;
    if(/[^A-Za-z0-9]/.test(v)) score++;
    const levels=[
      {w:'0%',c:'transparent',t:''},
      {w:'25%',c:'#FF3A3A',t:'Débil'},
      {w:'50%',c:'#FF9500',t:'Regular'},
      {w:'75%',c:'#FFD700',t:'Buena'},
      {w:'100%',c:'#00FF88',t:'Fuerte'},
    ];
    const l=levels[Math.min(score,4)];
    fill.style.width=l.w; fill.style.background=l.c; lbl.textContent=l.t; lbl.style.color=l.c;
  });

  // Solo números en Game ID + hint visual
  const gidInp=document.getElementById('r-gid');
  gidInp.addEventListener('input',()=>{
    gidInp.value=gidInp.value.replace(/\D/g,'').slice(0,20);
    const hint=document.getElementById('r-gid-hint');
    if(!hint) return;
    if(gidInp.value.length===0){ hint.textContent=''; return; }
    if(gidInp.value.length<5){ hint.textContent='⚠ Muy corto, mínimo 5 dígitos'; hint.style.color='#FF9500'; }
    else { hint.textContent='✓ ID válido'; hint.style.color='#00FF88'; }
  });

  // Selector de región visual
  document.querySelectorAll('.zk-region-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.zk-region-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('r-r').value=btn.dataset.val;
    });
  });

  // Indicador paso a paso al hacer focus
  const stepMap={'r-u':'zk-step-1','r-e':'zk-step-1','r-p':'zk-step-1','r-gid':'zk-step-2','r-r':'zk-step-3'};
  Object.entries(stepMap).forEach(([id,step])=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('focus',()=>{
      document.querySelectorAll('.zk-reg-step').forEach(s=>s.classList.remove('active'));
      document.getElementById(step)?.classList.add('active');
    });
  });

  // Submit
  document.getElementById('r-btn').addEventListener('click',async()=>{
    const u=document.getElementById('r-u').value.trim();
    const e2=document.getElementById('r-e').value.trim();
    const p=document.getElementById('r-p').value;
    const gid=document.getElementById('r-gid').value.trim();
    const r=document.getElementById('r-r').value;
    const err=document.getElementById('r-err');
    const btn=document.getElementById('r-btn');
    const btnTxt=document.getElementById('r-btn-txt');
    err.classList.add('hidden');
    if(!u||!e2||!p||!gid){
      err.textContent='Completa todos los campos, incluido el ID de Free Fire';
      err.classList.remove('hidden');
      const box=document.getElementById('zkRegBox');
      if(box){ box.classList.add('zk-auth-shake'); setTimeout(()=>box.classList.remove('zk-auth-shake'),500); }
      return;
    }
    if(!/^\d{5,20}$/.test(gid)){
      err.textContent='El ID de Free Fire solo debe tener números, entre 5 y 20 dígitos';
      err.classList.remove('hidden'); return;
    }
    btn.disabled=true; btnTxt.textContent='CREANDO CUENTA...'; btn.classList.add('zk-auth-loading');
    try{
      const{token,user}=await API.register(u,e2,p,r,gid);
      S.token=token; S.user=user;
      sessionStorage.setItem('zk_token',token);
      const box=document.getElementById('zkRegBox');
      if(box){ box.style.transform='scale(1.03)'; box.style.opacity='0'; }
      setTimeout(async()=>{ showToast('¡Bienvenido, '+u+'! 🎮'); await renderPage('home'); },300);
    }catch(er){
      err.textContent=er.message; err.classList.remove('hidden');
      btn.disabled=false; btnTxt.textContent='CREAR MI CUENTA'; btn.classList.remove('zk-auth-loading');
    }
  });
}

// ── PERFIL ────────────────────────────────────────────────────
async function renderProfile(root){
  if(!S.user){await renderPage('login');return;}
  try{const fr=await API.me();S.user=fr;renderNav();}catch{}
  const u=S.user,mm=u.region_mismatch;
  const hist=u.isAdmin?[]:await API.storeHistory().catch(()=>[]);

  // ── Card 3D izquierda ──
  const gameIdBlock=u.game_id&&u.game_id!==''
    ?`<div class="zk-prof-gameid-box">
        <div class="zk-prof-gameid-lbl">ID DE FREE FIRE</div>
        <div class="zk-prof-gameid-val">${esc(u.game_id)}</div>
        <div class="zk-prof-gameid-region">Región: ${esc(u.game_region||'—')}</div>
        <div class="zk-prof-gameid-lock">🔒 Contacta un admin para cambiar tu ID</div>
        <button class="btn btn-outline btn-sm" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(u.game_id)}');app._toast('ID copiado ✓')">COPIAR ID</button>
      </div>`
    :`<div class="form-row"><label class="inp-label">${t('game_id')}</label>
        <input id="p-gid" class="inp" value="" placeholder="123456789" inputmode="numeric" pattern="[0-9]*" maxlength="20"/>
      </div>
      <div class="form-row"><label class="inp-label">${t('game_region')}</label>
        <select id="p-greg" class="inp">
          <option value="LATAM">LATAM</option>
          <option value="EEUU">EEUU / USA</option>
          <option value="OTRO">OTRO / OTHER</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button id="p-save" class="btn btn-outline btn-sm">${t('save')}</button>
        <span id="p-saved" class="hidden" style="color:#00FF88;font-size:12px;font-family:Orbitron,sans-serif;">✓ ${t('saved')}</span>
      </div>`;

  const histBlock=hist.length>0
    ?`<div class="zk-prof-section-title">🛒 Historial de canje</div>
      <div class="zk-prof-hist">
        ${hist.map(r=>`<div class="zk-prof-hist-row">
          <span class="history-name">${esc(r.item_name)}</span>
          <span class="history-pts">-${r.points_used} pts</span>
          <span class="history-date">${esc((r.redeemed_at||'').split('T')[0])}</span>
        </div>`).join('')}
      </div>`:''

  root.innerHTML=`<div class="page"><div class="zk-prof-page">
    ${mm?notif(t('mismatch_notif')):''}

    <!-- COLUMNA IZQUIERDA — Card 3D -->
    <div class="zk-prof-left">

      <!-- Card principal 3D -->
      <div class="zk-prof-card-scene">
        <div class="zk-prof-card" id="zkProfCard">
          <div class="zk-prof-card-glow" id="zkProfGlow"></div>
          <div class="zk-prof-card-bar"></div>

          <div class="zk-prof-avatar-wrap">
            <div class="zk-prof-ping"></div>
            <div class="zk-prof-ping2"></div>
            <div class="zk-prof-avatar-border">
              <div class="zk-prof-avatar-inner">👾</div>
            </div>
          </div>

          <div class="zk-prof-name">${esc(u.username)}</div>
          <div class="zk-prof-id-lbl">ID: ${esc(u.game_id||'—')}</div>
          <div class="zk-prof-region">🌎 ${esc(u.region||S.region||'LATAM')} · Free Fire</div>

          ${isAdmin()?`<div class="zk-prof-admin-badge"><span class="zk-prof-admin-dot"></span>ADMINISTRADOR</div>`:''}

          <div class="zk-prof-pts-display">
            <div class="zk-prof-pts-glow"></div>
            <span class="zk-prof-pts-num" id="zkPtsNum">0</span>
            <span class="zk-prof-pts-lbl">⚡ puntos disponibles</span>
            <div class="zk-prof-pts-bar"><div class="zk-prof-pts-fill" id="zkPtsFill"></div></div>
          </div>

          <div class="zk-prof-badges">
            <div class="zk-prof-badge">🏆<span>Campeón</span></div>
            <div class="zk-prof-badge">⚡<span>Top 10</span></div>
            <div class="zk-prof-badge">🔥<span>Streaker</span></div>
            <div class="zk-prof-badge">💎<span>VIP</span></div>
          </div>
        </div>
      </div>

      <!-- Miembro desde -->
      <div class="zk-prof-meta-box">
        <div>
          <div class="zk-prof-meta-lbl">Miembro desde</div>
          <div class="zk-prof-meta-val">${esc((u.created_at||'').split('T')[0]||'—')}</div>
        </div>
        <div style="text-align:right">
          <div class="zk-prof-meta-lbl">Región</div>
          <div class="zk-prof-meta-val" style="color:var(--c)">${esc(u.region||'—')}</div>
        </div>
      </div>

      <!-- Canjear código -->
      <div class="zk-prof-code-box">
        <div class="zk-prof-section-title">🎟 ${t('code_section')}</div>
        <div id="code-msg"></div>
        <div class="zk-prof-code-row">
          <input id="p-code" class="inp" placeholder="${t('code_ph')}" style="flex:1;text-transform:uppercase;letter-spacing:2px;"/>
          <button id="p-code-btn" class="btn btn-primary btn-sm">${t('code_btn')}</button>
        </div>
      </div>

    </div>

    <!-- COLUMNA DERECHA — Stats -->
    <div class="zk-prof-right">

      <!-- Tabs -->
      <div class="zk-prof-tabs">
        <button class="zk-prof-tab active" data-tab="stats">📊 Estadísticas</button>
        <button class="zk-prof-tab" data-tab="gameid">🎮 Game ID</button>
        ${hist.length>0?`<button class="zk-prof-tab" data-tab="hist">🛒 Historial</button>`:''}
      </div>

      <!-- Panel Stats -->
      <div class="zk-prof-panel active" id="zkTab-stats">
        <div class="zk-prof-stats-grid">
          <div class="zk-prof-stat-card" style="--acc:#00FF88">
            <span class="zk-prof-stat-icon">⚡</span>
            <span class="zk-prof-stat-val" id="zkStatPts">0</span>
            <span class="zk-prof-stat-lbl">${t('your_pts')}</span>
            <div class="zk-prof-stat-bar"><div class="zk-prof-stat-fill" style="--tw:72%;background:linear-gradient(90deg,#00FF88,#00D4FF)"></div></div>
          </div>
          <div class="zk-prof-stat-card" style="--acc:#00D4FF">
            <span class="zk-prof-stat-icon">🌎</span>
            <span class="zk-prof-stat-val" style="font-size:18px">${esc(u.region||'—')}</span>
            <span class="zk-prof-stat-lbl">${t('region')}</span>
          </div>
          <div class="zk-prof-stat-card" style="--acc:#FFD700">
            <span class="zk-prof-stat-icon">🏆</span>
            <span class="zk-prof-stat-val">${hist.length}</span>
            <span class="zk-prof-stat-lbl">Canjes</span>
            <div class="zk-prof-stat-bar"><div class="zk-prof-stat-fill" style="--tw:${Math.min(hist.length*10,100)}%;background:linear-gradient(90deg,#FFD700,#FF9500)"></div></div>
          </div>
        </div>

        ${histBlock}
      </div>

      <!-- Panel Game ID -->
      <div class="zk-prof-panel" id="zkTab-gameid">
        <div class="zk-prof-section-title">🎮 ${t('game_id')}</div>
        ${gameIdBlock}
      </div>

      <!-- Panel Historial -->
      ${hist.length>0?`<div class="zk-prof-panel" id="zkTab-hist">
        <div class="zk-prof-section-title">🛒 ${t('your_history')}</div>
        <div class="zk-prof-hist">
          ${hist.map(r=>`<div class="zk-prof-hist-row">
            <span class="history-name">${esc(r.item_name)}</span>
            <span class="history-pts">-${r.points_used} pts</span>
            <span class="history-date">${esc((r.redeemed_at||'').split('T')[0])}</span>
          </div>`).join('')}
        </div>
      </div>`:''}

    </div>
  </div></div>`;

  // ── Animaciones ──
  // Contador de puntos
  const ptsEl=document.getElementById('zkPtsNum');
  const statPtsEl=document.getElementById('zkStatPts');
  const target=u.points||0;
  const dur=1600; const s=performance.now();
  (function countUp(now){
    const p=Math.min((now-s)/dur,1);
    const e=1-Math.pow(1-p,3);
    const v=Math.round(e*target).toLocaleString();
    if(ptsEl) ptsEl.textContent=v;
    if(statPtsEl) statPtsEl.textContent=v;
    if(p<1) requestAnimationFrame(countUp);
  })(performance.now());

  // Barra de puntos
  const fill=document.getElementById('zkPtsFill');
  const pct=Math.min((target/5000)*100,100);
  setTimeout(()=>{ if(fill){fill.style.width=pct+'%';} },300);

  // Barras de stats
  setTimeout(()=>{
    root.querySelectorAll('.zk-prof-stat-fill').forEach(b=>{
      const tw=b.style.getPropertyValue('--tw');
      b.style.width=tw||'0%';
    });
  },400);

  // Tilt 3D card
  const card3d=document.getElementById('zkProfCard');
  const glow=document.getElementById('zkProfGlow');
  if(card3d){
    card3d.addEventListener('mousemove',e=>{
      const r=card3d.getBoundingClientRect();
      const dx=(e.clientX-r.left-r.width/2)/(r.width/2);
      const dy=(e.clientY-r.top-r.height/2)/(r.height/2);
      card3d.style.transform=`rotateX(${-dy*10}deg) rotateY(${dx*12}deg) scale(1.025)`;
      card3d.style.boxShadow=`${-dx*20}px ${-dy*16}px 60px rgba(0,212,255,.15),0 30px 70px rgba(0,0,0,.6)`;
      if(glow){glow.style.left=((e.clientX-r.left)/r.width*100)+'%';glow.style.top=((e.clientY-r.top)/r.height*100)+'%';}
    });
    card3d.addEventListener('mouseleave',()=>{card3d.style.transform='';card3d.style.boxShadow='';});
  }

  // Tabs
  root.querySelectorAll('.zk-prof-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      root.querySelectorAll('.zk-prof-tab').forEach(b=>b.classList.remove('active'));
      root.querySelectorAll('.zk-prof-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      const panel=document.getElementById('zkTab-'+btn.dataset.tab);
      if(panel) panel.classList.add('active');
    });
  });

  // Guardar game ID
  const pgidInput=document.getElementById('p-gid');
  if(pgidInput) pgidInput.addEventListener('input',()=>{pgidInput.value=pgidInput.value.replace(/\D/g,'').slice(0,20);});
  const saveBtn=document.getElementById('p-save');
  if(saveBtn){
    saveBtn.addEventListener('click',async()=>{
      try{
        const gid=document.getElementById('p-gid').value.trim();
        if(!/^\d{5,20}$/.test(gid)){showToast('El ID solo debe tener números, entre 5 y 20 dígitos','error');return;}
        const upd=await API.saveGameId(gid,document.getElementById('p-greg').value);
        S.user=upd;renderNav();
        const m=document.getElementById('p-saved');
        m.classList.remove('hidden');setTimeout(()=>m.classList.add('hidden'),2000);
      }catch(e){showToast(e.message,'error');}
    });
  }

  // Canjear código
  const rc=async()=>{
    const code=document.getElementById('p-code').value.trim(),el=document.getElementById('code-msg');
    el.innerHTML=''; if(!code)return;
    try{
      const r=await API.redeemCode(code);S.user=r.user;renderNav();
      el.innerHTML=notif(`${t('code_ok')}${r.points}${t('pts_added')}`,'success');
      document.getElementById('p-code').value='';
    }catch{el.innerHTML=notif(t('code_err'),'error');}
  };
  document.getElementById('p-code-btn').addEventListener('click',rc);
  document.getElementById('p-code').addEventListener('keydown',e=>e.key==='Enter'&&rc());
}


// ─────────────────────────────────────────────────────────────
// PAGINA TRANSMISIONES EN VIVO
// ─────────────────────────────────────────────────────────────
async function renderStreams(root){
  const streams = await API.getStreams();
  const liveNow = streams.filter(s=>s.is_live);
  const upcoming= streams.filter(s=>!s.is_live && !s.ended_at);
  const ended   = streams.filter(s=>!!s.ended_at);

  function embedURL(s){
    const id = esc(s.stream_id);
    if(s.platform==='youtube'){
      // Si el ID empieza con UC es ID de canal → cargar live del canal
      if(id.startsWith('UC')){
        return 'UCW4JoD3h9O9ehmq7nZy-Dgw='+id+'&autoplay=1';
      }
      // Si es ID de video directo
      return 'https://www.youtube.com/embed/'+id+'?autoplay=1&rel=0';
    }
    if(s.platform==='twitch')
      return 'https://player.twitch.tv/?channel='+id+'&parent=localhost&autoplay=false';
    if(s.platform==='tiktok')
      return null; // TikTok no tiene embed oficial
    if(s.platform==='facebook')
      return 'https://www.facebook.com/plugins/video.php?href='+encodeURIComponent(id)+'&show_text=false&autoplay=true';
    return null;
  }
  function chatURL(s){
    const id = esc(s.stream_id);
    if(s.platform==='youtube' && s.chat_enabled){
      // Chat de YouTube solo funciona con ID de video (no de canal)
      if(!id.startsWith('UC'))
        return 'https://www.youtube.com/live_chat?v='+id+'&embed_domain=localhost';
      return null; // canal sin ID de video específico → sin chat embed
    }
    if(s.platform==='twitch' && s.chat_enabled)
      return 'https://www.twitch.tv/embed/'+id+'/chat?parent=localhost';
    return null;
  }
  function externalURL(s){
    const id = esc(s.stream_id);
    if(s.platform==='youtube'){
      if(id.startsWith('UC')) return 'https://www.youtube.com/channel/'+id+'/live';
      return 'https://www.youtube.com/watch?v='+id;
    }
    if(s.platform==='twitch')   return 'https://www.twitch.tv/'+id;
    if(s.platform==='tiktok')   return 'https://www.tiktok.com/@'+id+'/live';
    if(s.platform==='facebook') return id;
    return '#';
  }
  function platBadge(p){
    const m={youtube:'▶ YouTube Live',facebook:'⬡ Facebook Live',tiktok:'♪ TikTok Live'};
    return '<span class="stream-platform '+esc(p)+'">'+(m[p]||p)+'</span>';
  }
  function statBadge(s){
    if(s.is_live)  return '<span class="live-badge">'+t('stream_live')+'</span>';
    if(s.ended_at) return '<span class="ended-badge">'+t('stream_ended')+'</span>';
    return '<span class="scheduled-badge">'+t('stream_scheduled')+'</span>';
  }
  function schedTime(s){
    if(!s.scheduled_at) return '';
    try{
      const d=new Date(s.scheduled_at);
      return t('scheduled_for')+' '+d.toLocaleString(S.lang==='es'?'es-BO':'en-US');
    }catch{return s.scheduled_at;}
  }

  function streamCard(s, big){
    const hasChat=s.chat_enabled&&s.is_live&&chatURL(s);
    const cols=big&&hasChat?'stream-layout-2col':'';
    return '<div class="card stream-card" style="margin-bottom:16px;">'
      +'<div class="'+cols+'">'
      +'<div>'
      +'<div class="stream-embed-wrap">'
      +(s.is_live && embedURL(s)
        ?'<iframe src="'+embedURL(s)+'" allowfullscreen allow="autoplay; encrypted-media"></iframe>'
        :s.is_live && s.platform==='tiktok'
          ?'<div class="stream-embed-placeholder">'
           +'<div class="big-icon">♪</div>'
           +'<div style="color:#e0e8ff;font-size:13px;margin-bottom:12px;">TikTok Live — Ver en la app o navegador</div>'
           +'<a href="'+externalURL(s)+'" target="_blank" rel="noreferrer" class="stream-watch-btn" style="font-size:12px;">♪ Abrir en TikTok</a>'
           +'</div>'
        :'<div class="stream-embed-placeholder">'
         +'<div class="big-icon">📺</div>'
         +'<div>Transmision no iniciada</div>'
         +(s.scheduled_at?'<div style="color:#FFAA00;font-size:11px;">'+schedTime(s)+'</div>':'')
         +'</div>')
      +'</div>'
      +'<div class="stream-body">'
      +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">'
      +statBadge(s)+platBadge(s.platform)
      +(s.viewers>0?'<span style="color:#FF0040;font-family:Orbitron,sans-serif;font-size:11px;">👁 '+s.viewers.toLocaleString()+' '+t('viewers')+'</span>':'')
      +'</div>'
      +'<div class="stream-title">'+esc(s.title)+'</div>'
      +(s.description?'<div class="stream-desc">'+esc(s.description)+'</div>':'')
      +(s.is_live?'<div style="margin-top:10px;"><a href="'+externalURL(s)+'" target="_blank" rel="noreferrer" class="stream-watch-btn">▶ '+t('stream_watch')+'</a></div>':'')
      +'</div>'
      +'</div>'
      +(hasChat?'<div><div style="font-family:Orbitron,sans-serif;font-size:11px;color:#4a5a7b;letter-spacing:2px;padding:12px 0 6px 0;">'+t('stream_chat')+'</div>'
        +'<iframe class="stream-chat-frame" src="'+chatURL(s)+'" sandbox0000="allow-same-origin allow-scripts allow-popups allow-forms" style="border-radius:8px;border:1px solid rgba(0,255,136,0.1);"></iframe></div>':'')
      +'</div></div>';
  }

  root.innerHTML='<div class="page"><div class="container">'
    +'<div class="page-hero">'
    +'<div class="page-title">'+t('streams_title')+'</div>'
    +'<div class="page-sub">'+t('streams_sub')+'</div>'
    +'</div>'
    +(liveNow.length>0
      ?'<div class="section-header" style="margin-bottom:16px;">'
        +'<div class="section-title" style="color:#FF0040;"><span class="live-badge" style="font-size:13px;margin-right:10px;">'+t('stream_live')+'</span>EN VIVO AHORA</div>'
        +'<div class="section-line" style="background:linear-gradient(90deg,rgba(255,0,64,0.4),transparent);"></div>'
        +'</div>'
        +liveNow.map((s,i)=>streamCard(s,i===0)).join('')
      :'')
    +(upcoming.length>0
      ?'<div class="section-header" style="margin-top:32px;margin-bottom:16px;">'
        +'<div class="section-title" style="color:#FFAA00;">📅 '+t('stream_scheduled')+'</div>'
        +'<div class="section-line" style="background:linear-gradient(90deg,rgba(255,170,0,0.4),transparent);"></div>'
        +'</div><div class="grid-2">'+upcoming.map(s=>streamCard(s,false)).join('')+'</div>'
      :'')
    +(liveNow.length===0&&upcoming.length===0
      ?'<div class="empty-state" style="padding:80px 20px;">'
        +'<div style="font-size:48px;margin-bottom:16px;opacity:0.3;">📺</div>'
        +'<div>'+t('no_streams')+'</div>'
        +'</div>'
      :'')
    +(ended.length>0
      ?'<div class="section-header" style="margin-top:32px;margin-bottom:16px;">'
        +'<div class="section-title" style="color:#4a5a7b;">🎬 '+t('stream_ended')+'</div>'
        +'<div class="section-line"></div></div>'
        +'<div class="grid-2">'+ended.map(s=>streamCard(s,false)).join('')+'</div>'
      :'')
    +'</div></div>';

  await updateLiveDot();
}

// ── ADMIN ─────────────────────────────────────────────────────
async function renderAdmin(root){
  const tabs=[{k:'news',l:t('adm_news')},{k:'tours',l:t('adm_tours')},{k:'store',l:t('adm_store')},{k:'codes',l:t('adm_codes')},{k:'social',l:t('adm_social')},{k:'collabs',l:t('adm_collabs')},{k:'users',l:t('adm_users')},{k:'streams',l:t('adm_streams')||'📺 En Vivo'},{k:'stats',l:'📊 Estadísticas'}];
  root.innerHTML=`<div class="page"><div class="container"><div style="font-family:Orbitron,sans-serif;font-size:22px;color:#00FF88;letter-spacing:3px;margin-bottom:6px;">${t('admin_title')}</div><div style="color:#3a4a6b;font-size:11px;letter-spacing:2px;margin-bottom:24px;">🔐 ${esc(S.user.username)}</div><div class="admin-layout"><div class="admin-sidebar">${tabs.map(tb=>`<button class="admin-tab ${S.adminTab===tb.k?'active':''}" onclick="app.setAdminTab('${tb.k}')">${esc(tb.l)}</button>`).join('')}</div><div class="admin-content" id="admin-content"></div></div></div></div>`;
  await loadAdminTab();
}

async function loadAdminTab(){
  const el=document.getElementById('admin-content');
  if(!el)return;
  el.innerHTML=`<div class="empty-state" style="font-size:11px;">${t('loading')}</div>`;
  try{
    if(S.adminTab==='news'){    el.innerHTML=await adminNewsHTML();    adminNewsEvents(); }
    if(S.adminTab==='tours'){   el.innerHTML=await adminToursHTML();   adminToursEvents(); }
    if(S.adminTab==='store'){   el.innerHTML=await adminStoreHTML();   adminStoreEvents(); }
    if(S.adminTab==='codes'){   el.innerHTML=await adminCodesHTML();   adminCodesEvents(); }
    if(S.adminTab==='social'){  el.innerHTML=await adminSocialHTML();  adminSocialEvents(); }
    if(S.adminTab==='collabs'){ el.innerHTML=await adminCollabsHTML(); adminCollabsEvents(); }
    if(S.adminTab==='users'){   el.innerHTML=await adminUsersHTML(); }
    if(S.adminTab==='streams'){ el.innerHTML=await adminStreamsHTML(); adminStreamsEvents(); }
    if(S.adminTab==='stats'){   el.innerHTML=await adminStatsHTML(); }
  }catch(e){el.innerHTML=notif(e.message,'error');}
}

async function adminNewsHTML(){ const l=await API.getNews(); return `<div class="admin-section-title">GESTIÓN DE NOVEDADES</div><button class="btn btn-primary btn-sm" id="news-add-btn" style="margin-bottom:16px;">+ ${t('add')}</button><div class="tbl-wrapper"><table class="tbl"><thead><tr><th>TÍTULO</th><th>REGIÓN</th><th>FECHA</th><th>ACCIONES</th></tr></thead><tbody>${l.map(n=>`<tr><td style="color:#a0b0cc;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${esc(n.title_es)}</td><td><span class="region-tag ${tagClass(n.region)}">${n.region==='ALL'?t('global'):n.region}</span></td><td style="color:#3a4a6b;">${esc(n.pub_date)}</td><td class="tbl-actions"><button class="btn btn-cyan btn-sm" onclick="app.adminNewsEdit('${esc(n.id)}')">${t('edit')}</button><button class="btn btn-danger btn-sm" onclick="app.adminNewsDel('${esc(n.id)}')">${t('del')}</button></td></tr>`).join('')}</tbody></table></div>`; }
function adminNewsEvents(){ document.getElementById('news-add-btn').addEventListener('click',()=>app.adminNewsEdit(null)); }

async function adminToursHTML(){ const l=await API.getTours(); return `<div class="admin-section-title">GESTIÓN DE TORNEOS</div><button class="btn btn-primary btn-sm" id="tour-add-btn" style="margin-bottom:16px;">+ ${t('add')}</button><div class="tbl-wrapper"><table class="tbl"><thead><tr><th>TORNEO</th><th>REGIÓN</th><th>ESTADO</th><th>PARTICIPANTES</th><th>ACCIONES</th></tr></thead><tbody>${l.map(tr=>`<tr><td style="color:#a0b0cc;max-width:180px;overflow:hidden;text-overflow:ellipsis;">${esc(tr.title_es)}</td><td><span class="region-tag ${tagClass(tr.region)}">${tr.region==='ALL'?t('global'):tr.region}</span></td><td><span class="status-tag ${stCls(tr.status)}">${t(tr.status)}</span></td><td style="color:#3a4a6b;">👥 ${tr.participants.length}</td><td class="tbl-actions"><button class="btn btn-cyan btn-sm" onclick="app.adminTourEdit('${esc(tr.id)}')">${t('edit')}</button>${!tr.finalized?`<button class="btn btn-primary btn-sm" onclick="app.adminTourAward('${esc(tr.id)}')">${t('finalize')}</button>`:''}<button class="btn btn-danger btn-sm" onclick="app.adminTourDel('${esc(tr.id)}')">${t('del')}</button></td></tr>`).join('')}</tbody></table></div>`; }
function adminToursEvents(){ document.getElementById('tour-add-btn').addEventListener('click',()=>app.adminTourEdit(null)); }

async function adminStoreHTML(){ const l=await API.getStore(); return `<div class="admin-section-title">GESTIÓN DE TIENDA</div><button class="btn btn-primary btn-sm" id="store-add-btn" style="margin-bottom:16px;">+ ${t('add')}</button><div class="tbl-wrapper"><table class="tbl"><thead><tr><th>NOMBRE</th><th>PUNTOS</th><th>STOCK</th><th>ACCIONES</th></tr></thead><tbody>${l.map(s=>`<tr><td style="color:#a0b0cc;">${esc(s.name_es)}</td><td style="color:#00FF88;font-family:Orbitron,sans-serif;font-size:12px;">⚡ ${s.points}</td><td style="color:#3a4a6b;">${s.stock}</td><td class="tbl-actions"><button class="btn btn-cyan btn-sm" onclick="app.adminStoreEdit('${esc(s.id)}')">${t('edit')}</button><button class="btn btn-danger btn-sm" onclick="app.adminStoreDel('${esc(s.id)}')">${t('del')}</button></td></tr>`).join('')}</tbody></table></div>`; }
function adminStoreEvents(){ document.getElementById('store-add-btn').addEventListener('click',()=>app.adminStoreEdit(null)); }

async function adminCodesHTML(){ const l=await API.getCodes(); return `<div class="admin-section-title">CÓDIGOS PROMOCIONALES</div><button class="btn btn-primary btn-sm" id="code-add-btn" style="margin-bottom:16px;">+ ${t('add')}</button><div class="tbl-wrapper"><table class="tbl"><thead><tr><th>CÓDIGO</th><th>PUNTOS</th><th>USOS MÁX</th><th>USADOS</th><th>ACCIONES</th></tr></thead><tbody>${l.map(c=>`<tr><td style="color:#00FF88;font-family:Orbitron,sans-serif;font-size:12px;letter-spacing:1px;">${esc(c.code)}</td><td style="color:#00D4FF;">+${c.points} pts</td><td style="color:#3a4a6b;">${c.max_uses}</td><td><span style="color:${c.times_used>=c.max_uses?'#FF0051':'#3a4a6b'};">${c.times_used}/${c.max_uses}</span></td><td><button class="btn btn-danger btn-sm" onclick="app.adminCodeDel('${esc(c.id)}')">${t('del')}</button></td></tr>`).join('')}</tbody></table></div>`; }
function adminCodesEvents(){ document.getElementById('code-add-btn').addEventListener('click',()=>{ openModal(`<div class="modal-title">+ Código</div><div class="form-grid-3"><div class="form-row"><label class="inp-label">${t('code_lbl')}</label><input id="cf-c" class="inp" placeholder="ZENKZONE2026" style="text-transform:uppercase;"/></div><div class="form-row"><label class="inp-label">${t('code_pts_lbl')}</label><input id="cf-p" class="inp" type="number" value="100"/></div><div class="form-row"><label class="inp-label">${t('max_uses')}</label><input id="cf-m" class="inp" type="number" value="50"/></div></div><div style="display:flex;gap:8px;"><button class="btn btn-primary" id="cf-save">${t('save')}</button><button class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button></div>`); document.getElementById('cf-c').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase()); document.getElementById('cf-save').addEventListener('click',async()=>{ const code=document.getElementById('cf-c').value.trim().toUpperCase(); if(!code)return; try{await API.createCode({code,points:Number(document.getElementById('cf-p').value)||100,max_uses:Number(document.getElementById('cf-m').value)||50});closeModal();await loadAdminTab();showToast('Código creado ✓');}catch(e){showToast(e.message,'error');} }); }); }

async function adminSocialHTML(){ const l=await API.getSocial(); return `<div class="admin-section-title">REDES SOCIALES</div><button class="btn btn-primary btn-sm" id="soc-add-btn" style="margin-bottom:16px;">+ ${t('add')}</button><div class="tbl-wrapper"><table class="tbl"><thead><tr><th>PLATAFORMA</th><th>URL</th><th>ÍCONO</th><th>ACCIONES</th></tr></thead><tbody>${l.map(s=>`<tr><td style="color:#a0b0cc;font-weight:600;">${esc(s.platform)}</td><td><a href="${esc(s.url)}" target="_blank" style="color:#00D4FF;font-size:12px;text-decoration:none;">${esc(s.url.slice(0,38))}${s.url.length>38?'...':''}</a></td><td style="font-size:18px;">${esc(s.icon)}</td><td class="tbl-actions"><button class="btn btn-cyan btn-sm" onclick="app.adminSocEdit('${esc(s.id)}')">${t('edit')}</button><button class="btn btn-danger btn-sm" onclick="app.adminSocDel('${esc(s.id)}')">${t('del')}</button></td></tr>`).join('')}</tbody></table></div>`; }
function adminSocialEvents(){ document.getElementById('soc-add-btn').addEventListener('click',()=>app.adminSocEdit(null)); }

async function adminCollabsHTML(){ const l=await API.getCollabs(); return `<div class="admin-section-title">COLABORACIONES</div><button class="btn btn-primary btn-sm" id="col-add-btn" style="margin-bottom:16px;">+ ${t('add')}</button><div class="grid-4">${l.map(c=>`<div class="card collab-card"><img src="${esc(c.image)}" alt="${esc(c.name)}" class="collab-img" loading="lazy"/><div class="collab-name">${esc(c.name)}</div><div style="display:flex;gap:6px;justify-content:center;margin-top:10px;"><button class="btn btn-cyan btn-sm" onclick="app.adminColEdit('${esc(c.id)}')">${t('edit')}</button><button class="btn btn-danger btn-sm" onclick="app.adminColDel('${esc(c.id)}')">${t('del')}</button></div></div>`).join('')}</div>`; }
function adminCollabsEvents(){ document.getElementById('col-add-btn').addEventListener('click',()=>app.adminColEdit(null)); }

async function adminUsersHTML(){ const u=await API.getUsers(); return `<div class="admin-section-title">USUARIOS REGISTRADOS (${u.length})</div><div class="tbl-wrapper"><table class="tbl"><thead><tr><th>USUARIO</th><th>EMAIL</th><th>REGIÓN</th><th>PUNTOS</th><th>ID JUEGO</th><th>ACCIONES</th></tr></thead><tbody>${u.map(x=>`<tr><td style="color:#dce8ff;font-weight:600;">${esc(x.username)} ${x.region_mismatch?'<span style="color:#FFAA00;font-size:11px;">⚠️</span>':''}</td><td style="color:#3a4a6b;font-size:12px;">${esc(x.email)}</td><td><span class="region-tag ${tagClass(x.region)}">${esc(x.region)}</span></td><td style="color:#00FF88;font-family:Orbitron,sans-serif;font-size:12px;">⚡ ${x.points||0}</td><td style="color:#3a4a6b;font-size:12px;">${esc(x.game_id||'—')}</td><td class="tbl-actions"><button class="btn btn-primary btn-sm" onclick="app.adminGivePts('${esc(x.username)}',${x.points||0})">+ pts</button>
<button class="btn btn-cyan btn-sm" onclick="app.adminSetRole('${esc(x.username)}','${esc(x.role||'user')}')">👤 Rol</button>
${x.locked_until&&new Date(x.locked_until)>new Date()?`<button class="btn btn-warn btn-sm" onclick="app.adminUnlockUser('${esc(x.username)}')">🔓 Desbloquear</button>`:''}
<button class="btn btn-cyan btn-sm" onclick="app.adminEditGameId('${esc(x.username)}','${esc(x.game_id||'')}','${esc(x.game_region||'')}')">🎮 ID</button>
<button class="btn ${x.region_mismatch?'btn-cyan':'btn-warn'} btn-sm" onclick="app.adminToggleMismatch('${esc(x.username)}')">${x.region_mismatch?t('unmismatch'):t('mismatch_flag')}</button></td></tr>`).join('')}</tbody></table></div>`; }

// ── Admin: Estadísticas / Flujo de Usuarios ──────────────────
async function adminStatsHTML(){
  const [allRedeems, stats] = await Promise.all([API.getAllRedemptions(), API.getStats().catch(()=>null)]);
  const statCards = stats ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
      <div class="stat-box"><div class="stat-value" style="font-size:28px;">${stats.totalUsers}</div><div class="stat-label">USUARIOS</div></div>
      <div class="stat-box"><div class="stat-value" style="font-size:28px;color:#00D4FF;">${stats.newToday}</div><div class="stat-label">NUEVOS HOY</div></div>
      <div class="stat-box"><div class="stat-value" style="font-size:28px;color:#FFAA00;">${stats.totalRedeems}</div><div class="stat-label">CANJES TIENDA</div></div>
      <div class="stat-box"><div class="stat-value" style="font-size:28px;color:#AA00FF;">${stats.totalCodeUses}</div><div class="stat-label">CÓDIGOS USADOS</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
      <div class="card card-body">
        <div class="admin-section-title" style="margin-bottom:12px;">🏆 TOP 10 USUARIOS POR PUNTOS</div>
        ${stats.topUsers.map((u,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;"><span style="color:${i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'#a0b0cc'};">${i+1}. ${esc(u.username)}</span><span style="color:#00FF88;font-family:Orbitron,sans-serif;font-size:11px;">⚡ ${u.points}</span></div>`).join('')}
      </div>
      <div class="card card-body">
        <div class="admin-section-title" style="margin-bottom:12px;">🌎 USUARIOS POR REGIÓN</div>
        ${stats.regionStats.map(r=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;"><span style="color:#a0b0cc;">${esc(r.region)}</span><span style="color:#00D4FF;font-family:Orbitron,sans-serif;font-size:11px;">${r.total} usuarios</span></div>`).join('')}
      </div>
    </div>
    <div class="card card-body" style="margin-bottom:24px;">
      <div class="admin-section-title" style="margin-bottom:12px;">⚡ ACTIVIDAD RECIENTE DE PUNTOS</div>
      <div class="tbl-wrapper"><table class="tbl">
        <thead><tr><th>USUARIO</th><th>PUNTOS</th><th>RAZÓN</th><th>FECHA</th></tr></thead>
        <tbody>${stats.recentActivity.map(a=>`<tr>
          <td style="color:#a0b0cc;font-weight:600;">${esc(a.username)}</td>
          <td style="${a.amount>0?'color:#00FF88':'color:#FF0051'};font-family:Orbitron,sans-serif;font-size:12px;">${a.amount>0?'+':''}${a.amount}</td>
          <td style="color:#6a7a9b;font-size:12px;">${esc(a.reason)}</td>
          <td style="color:#3a4a6b;font-size:11px;">${esc((a.created_at||'').toString().slice(0,16))}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>` : '';

  return `
    <div class="admin-section-title">📊 ESTADÍSTICAS Y FLUJO DE USUARIOS</div>
    ${statCards}
    <div class="admin-section-title" style="margin-top:8px;margin-bottom:12px;">🛒 TODOS LOS CANJES DE TIENDA (${allRedeems.length})</div>
    <div class="tbl-wrapper"><table class="tbl">
      <thead><tr><th>USUARIO</th><th>ÍTEM</th><th>PUNTOS</th><th>ID JUEGO</th><th>REGIÓN</th><th>FECHA</th></tr></thead>
      <tbody>${allRedeems.length===0?`<tr><td colspan="6" style="text-align:center;color:#3a4a6b;padding:20px;">Sin canjes aún</td></tr>`:allRedeems.map(r=>`<tr>
        <td style="color:#dce8ff;font-weight:600;">${esc(r.username)}</td>
        <td style="color:#a0b0cc;max-width:150px;overflow:hidden;text-overflow:ellipsis;">${esc(r.item_name)}</td>
        <td style="color:#FF0051;font-family:Orbitron,sans-serif;font-size:12px;">-${r.points_used}</td>
        <td style="color:#00D4FF;font-size:12px;">${esc(r.game_id||'—')}</td>
        <td><span class="region-tag ${tagClass(r.game_region||'OTRO')}">${esc(r.game_region||'—')}</span></td>
        <td style="color:#3a4a6b;font-size:11px;">${esc((r.redeemed_at||'').toString().slice(0,16))}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}


// ── Admin: Transmisiones En Vivo ─────────────────────────────
async function adminStreamsHTML(){
  const list = await API.getStreams();
  const tours = await API.getTours().catch(()=>[]);
  return '<div class="admin-section-title">GESTIÓN DE TRANSMISIONES EN VIVO</div>'
    +'<button class="btn btn-primary btn-sm" id="stream-add-btn" style="margin-bottom:16px;">+ Agregar Transmisión</button>'
    +'<div class="tbl-wrapper"><table class="tbl">'
    +'<thead><tr><th>TÍTULO</th><th>PLATAFORMA</th><th>REGIÓN</th><th>ESTADO</th><th>PROGRAMADA</th><th>ACCIONES</th></tr></thead>'
    +'<tbody>'
    +list.map(s=>{
      const plat={youtube:'▶ YouTube',twitch:'◉ Twitch',facebook:'⬡ Facebook'};
      const schedStr=s.scheduled_at?new Date(s.scheduled_at).toLocaleString('es-BO'):'—';
      return '<tr>'
        +'<td style="color:#a0b0cc;max-width:180px;overflow:hidden;text-overflow:ellipsis;">'+esc(s.title)+'</td>'
        +'<td><span class="stream-platform '+esc(s.platform)+'">'+esc(plat[s.platform]||s.platform)+'</span></td>'
        +'<td><span class="region-tag '+tagClass(s.region)+'">'+esc(s.region==='ALL'?'GLOBAL':s.region)+'</span></td>'
        +'<td>'+(s.is_live?'<span class="live-badge">EN VIVO</span>':s.ended_at?'<span class="ended-badge">FINALIZADO</span>':'<span class="scheduled-badge">PROGRAMADO</span>')+'</td>'
        +'<td style="color:#3a4a6b;font-size:12px;">'+schedStr+'</td>'
        +'<td class="tbl-actions">'
        +'<button class="btn btn-sm '+(s.is_live?'btn-danger':'btn-primary')+'" onclick="app.adminToggleLive(\''+esc(s.id)+'\')">'+(s.is_live?t('end_live')||'FINALIZAR':t('go_live')||'ACTIVAR')+'</button>'
        +'<button class="btn btn-cyan btn-sm" onclick="app.adminStreamEdit(\''+esc(s.id)+'\')">'+t('edit')+'</button>'
        +'<button class="btn btn-danger btn-sm" onclick="app.adminStreamDel(\''+esc(s.id)+'\')">'+t('del')+'</button>'
        +'</td></tr>';
    }).join('')
    +'</tbody></table></div>';
}
function adminStreamsEvents(){
  const btn=document.getElementById('stream-add-btn');
  if(btn) btn.addEventListener('click',()=>app.adminStreamEdit(null));
}

// ── FOOTER ────────────────────────────────────────────────────
async function renderFooter(){ const footer=document.getElementById('main-footer');let social=[];try{social=await API.getSocial();}catch{}footer.innerHTML=`<div class="container"><div class="footer-grid"><div><div class="footer-logo">ZENK<span class="accent">ZONE</span></div><div class="footer-desc">Tu hub definitivo de Free Fire para LATAM y EEUU.</div></div><div><div class="footer-section-title">NAVEGACIÓN</div>${['home','tournaments','store'].map(k=>`<button class="footer-link" onclick="app.go('${k}')">${t(k)}</button>`).join('')}</div>${social.length>0?`<div><div class="footer-section-title">${t('follow_us')}</div>${social.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noreferrer" class="footer-link">${esc(s.icon)} ${esc(s.platform)}</a>`).join('')}</div>`:''}</div><div class="footer-bottom">© 2026 ZENKZONE 👾 — FREE FIRE HUB LATAM &amp; EEUU</div></div>`; }

// ── APP API PÚBLICA ───────────────────────────────────────────
const app={
  go(p){ const nl=document.getElementById('nav-links-list'); if(nl)nl.classList.remove('mobile-open'); renderPage(p); },
  setLang(l){ S.lang=l; localStorage.setItem('zk_lang',l); renderNav(); renderPage(S.page); renderFooter(); },
  setNewsFilter(f){ S.newsFilter=f; renderPage('home'); },
  setTourFilter(f){ S.tourFilter=f; renderPage('tournaments'); },
  async setAdminTab(tab){ S.adminTab=tab; document.querySelectorAll('.admin-tab').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick')===`app.setAdminTab('${tab}')`)); await loadAdminTab(); },
  toggleMobileMenu(){ const nl=document.getElementById('nav-links-list'); if(nl)nl.classList.toggle('mobile-open'); },
  resetRegion(){ localStorage.removeItem('zk_region');S.region=null; document.getElementById('region-picker').classList.remove('hidden'); setupRegionPicker(); },
  closeModal(){ closeModal(); },
  async logout(){
    try{ await API.logout(); }catch{}
    S.user=null; S.token=null;
    sessionStorage.removeItem('zk_token');
    localStorage.removeItem('zk_token');
    showToast('Sesión cerrada. Inicia sesión nuevamente.');
    await renderPage('login');
  },
  async joinTour(id){ if(!S.user){showToast(t('must_login'),'error');renderPage('login');return;} try{await API.joinTour(id);showToast(t('congrats'));await renderPage('tournaments');}catch(e){showToast(e.message,'error');} },
  async redeemStore(itemId){
    if(!S.user){showToast(t('must_login'),'error');renderPage('login');return;}
    if(!S.user.game_id){
      openModal(`<div class="modal-title">🎮 ${t('first_store_title')}</div><p style="color:#7080a0;font-size:14px;margin-bottom:18px;">${t('first_store_desc')}</p><div class="form-row"><label class="inp-label">${t('game_id')}</label><input id="gs-gid" class="inp" placeholder="${t('game_id_ph')}" inputmode="numeric" pattern="[0-9]*" maxlength="20"/></div><div class="form-row"><label class="inp-label">${t('game_region')}</label><select id="gs-greg" class="inp"><option value="LATAM">LATAM</option><option value="EEUU">EEUU / USA</option><option value="OTRO">OTRO</option></select></div><div style="display:flex;gap:8px;"><button class="btn btn-primary" id="gs-ok">${t('confirm')}</button><button class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button></div>`);
      const gsGid=document.getElementById('gs-gid');
      gsGid.addEventListener('input',()=>{ gsGid.value=gsGid.value.replace(/\D/g,'').slice(0,20); });
      document.getElementById('gs-ok').addEventListener('click',async()=>{ const gid=document.getElementById('gs-gid').value.trim(),greg=document.getElementById('gs-greg').value; if(!/^\d{5,20}$/.test(gid)){showToast('El ID de Free Fire solo debe tener números, entre 5 y 20 dígitos','error'); return;} try{const upd=await API.saveGameId(gid,greg);S.user=upd;renderNav();closeModal();await app._doRedeem(itemId,gid,greg);}catch(e){showToast(e.message,'error');} }); return;
    }
    await app._doRedeem(itemId,S.user.game_id,S.user.game_region);
  },
  async _doRedeem(itemId,game_id,game_region){ try{const r=await API.redeemItem(itemId,{game_id,game_region});S.user=r.user;renderNav();showToast(t('redeemed_ok'));await renderPage('store');}catch(e){showToast(e.message,'error');} },

  adminNewsEdit(id){
    openModal(`<div class="modal-title">${id?t('edit'):`+ ${t('add')}`} ${t('adm_news')}</div><div id="nf-body"></div>`);
    const build=n=>{ document.getElementById('nf-body').innerHTML=`<div class="form-row"><label class="inp-label">${t('title_es')}</label><input id="nf-tes" class="inp" value="${esc(n.title_es||'')}"/></div><div class="form-row"><label class="inp-label">${t('title_en')}</label><input id="nf-ten" class="inp" value="${esc(n.title_en||'')}"/></div><div class="form-row"><label class="inp-label">${t('content_es')}</label><textarea id="nf-ces" class="inp">${esc(n.content_es||'')}</textarea></div><div class="form-row"><label class="inp-label">${t('content_en')}</label><textarea id="nf-cen" class="inp">${esc(n.content_en||'')}</textarea></div><div class="form-row"><label class="inp-label">${t('img_url')}</label><input id="nf-img" class="inp" value="${esc(n.image||'')}" placeholder="https://..."/></div><div class="form-grid-2"><div class="form-row"><label class="inp-label">${t('region_lbl')}</label><select id="nf-reg" class="inp"><option value="LATAM" ${n.region==='LATAM'?'selected':''}>LATAM</option><option value="EEUU" ${n.region==='EEUU'?'selected':''}>EEUU</option><option value="ALL" ${!n.region||n.region==='ALL'?'selected':''}>GLOBAL</option></select></div><div class="form-row"><label class="inp-label">${t('date_lbl')}</label><input id="nf-date" class="inp" type="date" value="${esc(n.pub_date||new Date().toISOString().split('T')[0])}"/></div></div><div style="display:flex;gap:8px;"><button class="btn btn-primary" id="nf-save">${t('save')}</button><button class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button></div>`;
      document.getElementById('nf-save').addEventListener('click',async()=>{ const d={title_es:document.getElementById('nf-tes').value.trim(),title_en:document.getElementById('nf-ten').value.trim(),content_es:document.getElementById('nf-ces').value.trim(),content_en:document.getElementById('nf-cen').value.trim(),image:document.getElementById('nf-img').value.trim(),region:document.getElementById('nf-reg').value,pub_date:document.getElementById('nf-date').value}; if(!d.title_es)return; try{if(id)await API.updateNews(id,d);else await API.createNews(d);closeModal();await loadAdminTab();showToast('Guardado ✓');}catch(e){showToast(e.message,'error');} }); };
    if(id)API.getNews().then(l=>build(l.find(x=>x.id===id)||{})).catch(()=>build({})); else build({});
  },
  async adminNewsDel(id){ if(!confirm('¿Eliminar?'))return; await API.deleteNews(id);await loadAdminTab();showToast('Eliminado'); },

  adminTourEdit(id){
    openModal(`<div class="modal-title">${id?t('edit'):`+ ${t('add')}`} ${t('adm_tours')}</div><div id="tf-body"></div>`);
    const build=tr=>{ document.getElementById('tf-body').innerHTML=`<div class="form-row"><label class="inp-label">${t('title_es')}</label><input id="tf-tes" class="inp" value="${esc(tr.title_es||'')}"/></div><div class="form-row"><label class="inp-label">${t('title_en')}</label><input id="tf-ten" class="inp" value="${esc(tr.title_en||'')}"/></div><div class="form-row"><label class="inp-label">${t('desc_es')}</label><textarea id="tf-des" class="inp">${esc(tr.desc_es||'')}</textarea></div><div class="form-row"><label class="inp-label">${t('desc_en')}</label><textarea id="tf-den" class="inp">${esc(tr.desc_en||'')}</textarea></div><div class="form-grid-3"><div class="form-row"><label class="inp-label">${t('region_lbl')}</label><select id="tf-reg" class="inp"><option value="LATAM" ${tr.region==='LATAM'?'selected':''}>LATAM</option><option value="EEUU" ${tr.region==='EEUU'?'selected':''}>EEUU</option><option value="ALL">GLOBAL</option></select></div><div class="form-row"><label class="inp-label">${t('start_date')}</label><input id="tf-sd" class="inp" type="date" value="${esc(tr.start_date||'')}"/></div><div class="form-row"><label class="inp-label">${t('end_date')}</label><input id="tf-ed" class="inp" type="date" value="${esc(tr.end_date||'')}"/></div></div><div class="form-row"><label class="inp-label">${t('status_lbl')}</label><select id="tf-status" class="inp"><option value="upcoming" ${!tr.status||tr.status==='upcoming'?'selected':''}>Próximo</option><option value="active" ${tr.status==='active'?'selected':''}>Activo</option><option value="finished" ${tr.status==='finished'?'selected':''}>Finalizado</option></select></div><div style="display:flex;gap:8px;"><button class="btn btn-primary" id="tf-save">${t('save')}</button><button class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button></div>`;
      document.getElementById('tf-save').addEventListener('click',async()=>{ const d={title_es:document.getElementById('tf-tes').value.trim(),title_en:document.getElementById('tf-ten').value.trim(),desc_es:document.getElementById('tf-des').value.trim(),desc_en:document.getElementById('tf-den').value.trim(),region:document.getElementById('tf-reg').value,status:document.getElementById('tf-status').value,start_date:document.getElementById('tf-sd').value,end_date:document.getElementById('tf-ed').value}; if(!d.title_es)return; try{if(id)await API.updateTour(id,d);else await API.createTour(d);closeModal();await loadAdminTab();showToast('Guardado ✓');}catch(e){showToast(e.message,'error');} }); };
    if(id)API.getTours().then(l=>build(l.find(x=>x.id===id)||{})).catch(()=>build({})); else build({});
  },
  async adminTourDel(id){ if(!confirm('¿Eliminar?'))return; await API.deleteTour(id);await loadAdminTab();showToast('Eliminado'); },
  async adminTourAward(id){
    const tours=await API.getTours(),tr=tours.find(x=>x.id===id); if(!tr)return;
    const p=tr.participants,opts=`<option value="">-- Seleccionar --</option>${p.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}`;
    openModal(`<div class="modal-title">🏆 ${t('finalize')}</div><div style="background:rgba(0,0,0,0.28);border-radius:8px;padding:12px;margin-bottom:18px;"><div style="font-family:Orbitron,sans-serif;font-size:10px;color:#3a4a6b;margin-bottom:8px;">PARTICIPANTES (${p.length})</div>${p.length===0?`<span style="color:#3a4a6b;font-size:13px;">${t('no_participants')}</span>`:p.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>${[['aw-w1',t('winner1'),'aw-p1',tr.prize_1st||700],['aw-w2',t('winner2'),'aw-p2',tr.prize_2nd||550],['aw-w3',t('winner3'),'aw-p3',tr.prize_3rd||350]].map(([wi,wl,pi,pd])=>`<div class="form-grid-2" style="margin-bottom:10px;"><div class="form-row"><label class="inp-label">${wl}</label><select id="${wi}" class="inp">${opts}</select></div><div class="form-row"><label class="inp-label">${t('custom_pts')}</label><input id="${pi}" class="inp" type="number" value="${pd}"/></div></div>`).join('')}<div class="form-row"><label class="inp-label">${t('extra_pts')}</label><input id="aw-ex" class="inp" type="number" value="0"/></div><div style="background:rgba(0,255,136,0.04);border:1px solid rgba(0,255,136,0.12);border-radius:6px;padding:10px;margin-bottom:16px;font-size:12px;color:#4a5a7b;">${t('all_get_10')}</div><div style="display:flex;gap:8px;"><button class="btn btn-primary" id="aw-save" style="flex:1;">${t('award')}</button><button class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button></div>`);
    document.getElementById('aw-save').addEventListener('click',async()=>{ try{await API.awardTour(id,{winner_1:document.getElementById('aw-w1').value,winner_2:document.getElementById('aw-w2').value,winner_3:document.getElementById('aw-w3').value,prize_1st:Number(document.getElementById('aw-p1').value)||700,prize_2nd:Number(document.getElementById('aw-p2').value)||550,prize_3rd:Number(document.getElementById('aw-p3').value)||350,extra_pts:Number(document.getElementById('aw-ex').value)||0});closeModal();await loadAdminTab();showToast(t('pts_given'));}catch(e){showToast(e.message,'error');} });
  },

  adminStoreEdit(id){
    openModal(`<div class="modal-title">${id?t('edit'):`+ ${t('add')}`} ${t('adm_store')}</div><div id="sf-body"></div>`);
    const build=s=>{ document.getElementById('sf-body').innerHTML=`<div class="form-row"><label class="inp-label">${t('name_es')}</label><input id="sf-nes" class="inp" value="${esc(s.name_es||'')}"/></div><div class="form-row"><label class="inp-label">${t('name_en')}</label><input id="sf-nen" class="inp" value="${esc(s.name_en||'')}"/></div><div class="form-row"><label class="inp-label">${t('desc_es')}</label><textarea id="sf-des" class="inp" style="min-height:60px;">${esc(s.desc_es||'')}</textarea></div><div class="form-row"><label class="inp-label">${t('desc_en')}</label><textarea id="sf-den" class="inp" style="min-height:60px;">${esc(s.desc_en||'')}</textarea></div><div class="form-row"><label class="inp-label">${t('img_url')}</label><input id="sf-img" class="inp" value="${esc(s.image||'')}" placeholder="https://..."/></div><div class="form-grid-3"><div class="form-row"><label class="inp-label">${t('price_pts')}</label><input id="sf-pts" class="inp" type="number" value="${s.points||300}"/></div><div class="form-row"><label class="inp-label">${t('stock_qty')}</label><input id="sf-stk" class="inp" type="number" value="${s.stock||10}"/></div><div class="form-row"><label class="inp-label">${t('region_lbl')}</label><select id="sf-reg" class="inp"><option value="ALL" ${!s.region||s.region==='ALL'?'selected':''}>GLOBAL</option><option value="LATAM" ${s.region==='LATAM'?'selected':''}>LATAM</option><option value="EEUU" ${s.region==='EEUU'?'selected':''}>EEUU</option></select></div></div><div style="display:flex;gap:8px;"><button class="btn btn-primary" id="sf-save">${t('save')}</button><button class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button></div>`;
      document.getElementById('sf-save').addEventListener('click',async()=>{ const d={name_es:document.getElementById('sf-nes').value.trim(),name_en:document.getElementById('sf-nen').value.trim(),desc_es:document.getElementById('sf-des').value.trim(),desc_en:document.getElementById('sf-den').value.trim(),image:document.getElementById('sf-img').value.trim(),points:Number(document.getElementById('sf-pts').value)||100,stock:Number(document.getElementById('sf-stk').value)||0,region:document.getElementById('sf-reg').value}; if(!d.name_es)return; try{if(id)await API.updateItem(id,d);else await API.createItem(d);closeModal();await loadAdminTab();showToast('Guardado ✓');}catch(e){showToast(e.message,'error');} }); };
    if(id)API.getStore().then(l=>build(l.find(x=>x.id===id)||{})).catch(()=>build({})); else build({});
  },
  async adminStoreDel(id){ if(!confirm('¿Eliminar?'))return; await API.deleteItem(id);await loadAdminTab();showToast('Eliminado'); },
  async adminCodeDel(id){ if(!confirm('¿Eliminar?'))return; await API.deleteCode(id);await loadAdminTab();showToast('Eliminado'); },

  adminSocEdit(id){
    openModal(`<div class="modal-title">${id?t('edit'):`+ ${t('add')}`} Red Social</div><div id="socf-body"></div>`);
    const build=s=>{ document.getElementById('socf-body').innerHTML=`<div class="form-row"><label class="inp-label">${t('platform_lbl')}</label><input id="socf-plt" class="inp" value="${esc(s.platform||'')}" placeholder="YouTube..."/></div><div class="form-row"><label class="inp-label">${t('url_lbl')}</label><input id="socf-url" class="inp" value="${esc(s.url||'')}" placeholder="https://..."/></div><div class="form-row"><label class="inp-label">${t('icon_lbl')}</label><input id="socf-ico" class="inp" value="${esc(s.icon||'')}" placeholder="▶ ◈ ♪" style="font-size:20px;"/></div><div style="display:flex;gap:8px;"><button class="btn btn-primary" id="socf-save">${t('save')}</button><button class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button></div>`;
      document.getElementById('socf-save').addEventListener('click',async()=>{ const d={platform:document.getElementById('socf-plt').value.trim(),url:document.getElementById('socf-url').value.trim(),icon:document.getElementById('socf-ico').value.trim()||'◈'}; if(!d.platform||!d.url)return; try{if(id)await API.updateSocial(id,d);else await API.createSocial(d);closeModal();await loadAdminTab();await renderFooter();showToast('Guardado ✓');}catch(e){showToast(e.message,'error');} }); };
    if(id)API.getSocial().then(l=>build(l.find(x=>x.id===id)||{})).catch(()=>build({})); else build({});
  },
  async adminSocDel(id){ if(!confirm('¿Eliminar?'))return; await API.deleteSocial(id);await loadAdminTab();await renderFooter();showToast('Eliminado'); },

  adminColEdit(id){
    openModal(`<div class="modal-title">${id?t('edit'):`+ ${t('add')}`} Colaboración</div><div id="clf-body"></div>`);
    const build=c=>{ document.getElementById('clf-body').innerHTML=`<div class="form-row"><label class="inp-label">${t('collab_name')}</label><input id="clf-name" class="inp" value="${esc(c.name||'')}" placeholder="Creator X"/></div><div class="form-row"><label class="inp-label">${t('collab_img')}</label><input id="clf-img" class="inp" value="${esc(c.image||'')}" placeholder="https://..."/></div><div class="form-row"><label class="inp-label">${t('collab_url')}</label><input id="clf-url" class="inp" value="${esc(c.url||'')}" placeholder="https://..."/></div><div style="display:flex;gap:8px;"><button class="btn btn-primary" id="clf-save">${t('save')}</button><button class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button></div>`;
      document.getElementById('clf-save').addEventListener('click',async()=>{ const d={name:document.getElementById('clf-name').value.trim(),image:document.getElementById('clf-img').value.trim(),url:document.getElementById('clf-url').value.trim()||'#'}; if(!d.name)return; try{if(id)await API.updateCollab(id,d);else await API.createCollab(d);closeModal();await loadAdminTab();showToast('Guardado ✓');}catch(e){showToast(e.message,'error');} }); };
    if(id)API.getCollabs().then(l=>build(l.find(x=>x.id===id)||{})).catch(()=>build({})); else build({});
  },
  async adminColDel(id){ if(!confirm('¿Eliminar?'))return; await API.deleteCollab(id);await loadAdminTab();showToast('Eliminado'); },

  async adminGivePts(username,cur){ openModal(`<div class="modal-title">⚡ ${t('give_pts')} — ${esc(username)}</div><div style="margin-bottom:14px;color:#6a7a9b;font-size:13px;">Actuales: <span style="color:#00FF88;font-family:Orbitron,sans-serif;">${cur}</span></div><div class="form-row"><label class="inp-label">${t('custom_pts')}</label><input id="gp-amt" class="inp" type="number" value="100" min="1"/></div><div class="pts-quick"><button class="btn btn-outline btn-sm" onclick="document.getElementById('gp-amt').value=50">+50</button><button class="btn btn-outline btn-sm" onclick="document.getElementById('gp-amt').value=100">+100</button><button class="btn btn-outline btn-sm" onclick="document.getElementById('gp-amt').value=500">+500</button><button class="btn btn-outline btn-sm" onclick="document.getElementById('gp-amt').value=700">+700</button></div><div style="display:flex;gap:8px;"><button class="btn btn-primary" id="gp-save" style="flex:1;">OTORGAR</button><button class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button></div>`); document.getElementById('gp-save').addEventListener('click',async()=>{ const a=Number(document.getElementById('gp-amt').value)||0; if(a<=0)return; try{const r=await API.givePoints(username,a);if(S.user&&S.user.username===username){S.user.points=r.points;renderNav();}closeModal();await loadAdminTab();showToast(`+${a} pts → ${username}`);}catch(e){showToast(e.message,'error');} }); },
  async adminSetRole(username, currentRole){
    openModal('<div class="modal-title">👤 Cambiar Rol — '+esc(username)+'</div>'
      +'<div style="margin-bottom:16px;color:#6a7a9b;font-size:13px;">Rol actual: <span style="color:#00FF88;font-family:Orbitron,sans-serif;">'+esc(currentRole||'user')+'</span></div>'
      +'<div class="form-row"><label class="inp-label">NUEVO ROL</label>'
      +'<select id="role-sel" class="inp">'
      +'<option value="user" '+((!currentRole||currentRole==="user")?"selected":"")+'>👤 Usuario normal</option>'
      +'<option value="moderator" '+(currentRole==="moderator"?"selected":"")+'>🛡️ Moderador (puede publicar noticias)</option>'
      +'</select></div>'
      +'<div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:8px;padding:10px;margin-bottom:16px;font-size:12px;color:#6a7a9b;">'
      +'ℹ️ El moderador puede crear y editar noticias, pero no puede gestionar torneos, tienda ni usuarios.</div>'
      +'<div style="display:flex;gap:8px;">'
      +'<button class="btn btn-primary" id="role-save" style="flex:1;">GUARDAR ROL</button>'
      +'<button class="btn btn-outline" onclick="closeModal()">Cancelar</button></div>');
    document.getElementById('role-save').addEventListener('click',async()=>{
      const role=document.getElementById('role-sel').value;
      try{await API.setUserRole(username,role);closeModal();await loadAdminTab();showToast('Rol actualizado → '+role);}
      catch(e){showToast(e.message,'error');}
    });
  },
  async adminUnlockUser(username){
    try{await API.unlockUser(username);await loadAdminTab();showToast('Cuenta desbloqueada: '+username);}
    catch(e){showToast(e.message,'error');}
  },
  async adminToggleLive(id){
    try{
      const r=await API.toggleLive(id);
      await loadAdminTab();
      await updateLiveDot();
      showToast(r.is_live?'🔴 Transmisión activada - EN VIVO':'⬛ Transmisión finalizada');
    }catch(e){showToast(e.message,'error');}
  },
  adminStreamEdit(id){
    openModal('<div class="modal-title">'+(id?t('edit'):'+ Agregar')+' Transmisión</div><div id="stf-body"></div>');
    const build=s=>{
      API.getTours().then(tours=>{
        const tourOpts='<option value="">— Sin torneo —</option>'+tours.map(tr=>'<option value="'+esc(tr.id)+'" '+(s.tournament_id===tr.id?'selected':'')+'>'+esc(tr.title_es)+'</option>').join('');
        document.getElementById('stf-body').innerHTML=
          '<div class="form-row"><label class="inp-label">'+t('stream_title_lbl')+'</label>'
          +'<input id="stf-title" class="inp" value="'+esc(s.title||'')+'" placeholder="Torneo ZENKZONE - Final"/></div>'
          +'<div class="form-row"><label class="inp-label">'+t('stream_desc_lbl')+'</label>'
          +'<textarea id="stf-desc" class="inp" style="min-height:60px;">'+esc(s.description||'')+'</textarea></div>'
          +'<div class="form-grid-2">'
          +'<div class="form-row"><label class="inp-label">'+t('stream_platform')+'</label>'
          +'<select id="stf-plat" class="inp">'
          +'<option value="youtube" '+((!s.platform||s.platform==='youtube')?'selected':'')+'>▶ YouTube Live</option>'
          +'<option value="twitch" '+(s.platform==='twitch'?'selected':'')+'>◉ Twitch</option>'
          +'<option value="facebook" '+(s.platform==='facebook'?'selected':'')+'>⬡ Facebook Live</option>'
          +'</select></div>'
          +'<div class="form-row"><label class="inp-label">'+t('stream_region')+'</label>'
          +'<select id="stf-reg" class="inp">'
          +'<option value="ALL" '+(!s.region||s.region==='ALL'?'selected':'')+'>GLOBAL</option>'
          +'<option value="LATAM" '+(s.region==='LATAM'?'selected':'')+'>LATAM</option>'
          +'<option value="EEUU" '+(s.region==='EEUU'?'selected':'')+'>EEUU</option>'
          +'</select></div></div>'
          +'<div class="form-row"><label class="inp-label">'+t('stream_id_lbl')+' (ID de YouTube / canal de Twitch)</label>'
          +'<input id="stf-sid" class="inp" value="'+esc(s.stream_id||'')+'" placeholder="Ej: jfKfPfyJRdk (ID del video de YouTube)"/>'
          +'<div style="margin-top:4px;font-size:11px;color:#4a5a7b;">YouTube: pega solo el ID del video (lo que va después de ?v= en la URL) | Twitch: nombre del canal</div></div>'
          +'<div class="form-row"><label class="inp-label">'+t('stream_sched_lbl')+'</label>'
          +'<input id="stf-sched" class="inp" type="datetime-local" value="'+(s.scheduled_at?new Date(s.scheduled_at).toISOString().slice(0,16):'')+'" /></div>'
          +'<div class="form-row"><label class="inp-label">Torneo asociado (opcional)</label>'
          +'<select id="stf-tour" class="inp">'+tourOpts+'</select></div>'
          +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">'
          +'<input type="checkbox" id="stf-chat" style="width:16px;height:16px;accent-color:#00FF88;" '+(s.chat_enabled!==false?'checked':'')+'/>'
          +'<label for="stf-chat" style="color:#a0b0cc;font-size:14px;cursor:pointer;">'+t('stream_chat_lbl')+' en el player</label></div>'
          +'<div style="display:flex;gap:8px;">'
          +'<button class="btn btn-primary" id="stf-save">'+t('save')+'</button>'
          +'<button class="btn btn-outline" onclick="closeModal()">'+t('cancel')+'</button>'
          +'</div>';
        document.getElementById('stf-save').addEventListener('click',async()=>{
          const d={
            title:document.getElementById('stf-title').value.trim(),
            description:document.getElementById('stf-desc').value.trim(),
            platform:document.getElementById('stf-plat').value,
            stream_id:document.getElementById('stf-sid').value.trim(),
            region:document.getElementById('stf-reg').value,
            scheduled_at:document.getElementById('stf-sched').value||null,
            tournament_id:document.getElementById('stf-tour').value||null,
            chat_enabled:document.getElementById('stf-chat').checked,
          };
          if(!d.title||!d.stream_id){showToast('Título y Stream ID son requeridos','error');return;}
          try{
            if(id)await API.updateStream(id,d); else await API.createStream(d);
            closeModal();await loadAdminTab();showToast('Transmisión guardada ✓');
          }catch(e){showToast(e.message,'error');}
        });
      }).catch(()=>{});
    };
    if(id) API.getStreams().then(l=>build(l.find(x=>x.id===id)||{})).catch(()=>build({}));
    else build({});
  },
  async adminStreamDel(id){
    if(!confirm('¿Eliminar esta transmisión?'))return;
    try{await API.deleteStream(id);await loadAdminTab();showToast('Eliminado');}
    catch(e){showToast(e.message,'error');}
  },
  async adminToggleMismatch(u){ try{await API.toggleMismatch(u);await loadAdminTab();showToast('Actualizado');}catch(e){showToast(e.message,'error');} },
  adminEditGameId(username, currentId, currentRegion){
    openModal(`<div class="modal-title">🎮 Editar ID de Free Fire — ${esc(username)}</div>
      <div style="background:rgba(255,170,0,0.08);border:1px solid rgba(255,170,0,0.25);border-radius:8px;padding:10px;margin-bottom:16px;font-size:12px;color:#FFAA00;">
        ⚠️ Solo los administradores pueden cambiar el ID de Free Fire del usuario.
      </div>
      <div class="form-row"><label class="inp-label">ID de Free Fire</label>
        <input id="agid-id" class="inp" value="${esc(currentId||'')}" placeholder="123456789"/>
      </div>
      <div class="form-row"><label class="inp-label">Región del juego</label>
        <select id="agid-reg" class="inp">
          <option value="LATAM" ${currentRegion==='LATAM'?'selected':''}>LATAM</option>
          <option value="EEUU"  ${currentRegion==='EEUU'?'selected':''}>EEUU / USA</option>
          <option value="OTRO"  ${(!currentRegion||currentRegion==='OTRO')?'selected':''}>OTRO / OTHER</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" id="agid-save" style="flex:1;">GUARDAR</button>
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      </div>`);
    document.getElementById('agid-save').addEventListener('click', async () => {
      const gid  = document.getElementById('agid-id').value.trim();
      const greg = document.getElementById('agid-reg').value;
      try {
        await API.adminSetGameId(username, gid, greg);
        closeModal(); await loadAdminTab(); showToast(`ID actualizado para ${username}`);
      } catch(e){ showToast(e.message,'error'); }
    });
  },
};
window.app=app;

// ── SELECTOR DE REGIÓN ────────────────────────────────────────
function setupRegionPicker(){
  const picker=document.getElementById('region-picker');
  if(S.region){picker.classList.add('hidden');return;}
  picker.querySelectorAll('.region-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{ const r=btn.dataset.region; S.region=r; S.lang=r==='EEUU'?'en':'es'; localStorage.setItem('zk_region',r); localStorage.setItem('zk_lang',S.lang); picker.classList.add('hidden'); renderNav(); await renderPage('home'); await renderFooter(); });
  });
}

// ── SISTEMA DE ANIMACIONES GLOBAL ───────────────────────────
function zkInitGlobals(){
  // Cursor
  if(!document.getElementById('zk-cur')){
    const c=document.createElement('div');c.id='zk-cur';
    c.style.cssText='position:fixed;width:8px;height:8px;border-radius:50%;background:#00FF88;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);box-shadow:0 0 12px #00FF88;transition:width .15s,height .15s,background .15s;';
    document.body.appendChild(c);
    const r=document.createElement('div');r.id='zk-ring';
    r.style.cssText='position:fixed;width:28px;height:28px;border-radius:50%;border:1px solid rgba(0,255,136,.3);pointer-events:none;z-index:99998;transform:translate(-50%,-50%);transition:width .25s,height .25s;';
    document.body.appendChild(r);
    let mx=0,my=0,rx=0,ry=0;
    document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;c.style.left=mx+'px';c.style.top=my+'px';});
    (function l(){rx+=(mx-rx)*.11;ry+=(my-ry)*.11;r.style.left=rx+'px';r.style.top=ry+'px';requestAnimationFrame(l);})();
    document.addEventListener('mouseover',e=>{
      if(e.target.closest('button,a,.btn')){c.style.width='14px';c.style.height='14px';c.style.background='#00D4FF';c.style.boxShadow='0 0 16px #00D4FF';r.style.width='42px';r.style.height='42px';}
      else{c.style.width='8px';c.style.height='8px';c.style.background='#00FF88';c.style.boxShadow='0 0 12px #00FF88';r.style.width='28px';r.style.height='28px';}
    });
  }
  // Canvas partículas
  if(!document.getElementById('zk-canvas')){
    const cv=document.createElement('canvas');cv.id='zk-canvas';
    cv.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.4;';
    document.body.appendChild(cv);
    const ctx=cv.getContext('2d');let W,H,ps=[];
    function rsz(){W=cv.width=window.innerWidth;H=cv.height=window.innerHeight;}
    rsz();window.addEventListener('resize',rsz);
    for(let i=0;i<50;i++) ps.push({x:Math.random()*4000,y:Math.random()*4000,r:Math.random()*1.2+.3,vx:(Math.random()-.5)*.2,vy:(Math.random()-.5)*.2,a:Math.random()*.45+.12,c:Math.random()>.5?'#00FF88':'#00D4FF'});
    (function draw(){ctx.clearRect(0,0,W,H);for(const p of ps){p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;ctx.beginPath();ctx.arc(p.x%W,p.y%H,p.r,0,Math.PI*2);ctx.fillStyle=p.c;ctx.globalAlpha=p.a;ctx.fill();}ctx.globalAlpha=1;requestAnimationFrame(draw);})();
  }
  // Scroll suave
  if(!window._zkScroll){
    window._zkScroll=true;
    let sy=window.scrollY,ty=sy,run=false;
    window.addEventListener('wheel',e=>{
      e.preventDefault();ty+=e.deltaY*.82;
      ty=Math.max(0,Math.min(ty,document.body.scrollHeight-window.innerHeight));
      if(!run)(function l(){run=true;sy+=(ty-sy)*.09;window.scrollTo(0,sy);Math.abs(ty-sy)>.5?requestAnimationFrame(l):(sy=ty,run=false);})();
    },{passive:false});
  }
}

// Helper toast directo
app._toast=(msg)=>showToast(msg,'success');

// ── RECUPERAR CONTRASEÑA ─────────────────────────────────────
app.showForgotPwd=function(){
  openModal(`
    <div class="zk-forgot-box" id="zkForgotBox">
      <div class="zk-forgot-bar"></div>
      <div class="zk-forgot-icon">🔑</div>
      <div class="zk-forgot-title">RECUPERAR CONTRASEÑA</div>
      <div class="zk-forgot-sub">Ingresa tu correo registrado. Te enviaremos un código de 6 dígitos.</div>
      <div id="zkForgotStep1">
        <div id="fp-msg"></div>
        <div class="zk-auth-field" style="margin-bottom:16px;">
          <label class="zk-auth-label">Correo electrónico</label>
          <div class="zk-auth-input-wrap">
            <span class="zk-auth-input-icon">✉</span>
            <input id="fp-email" class="zk-auth-input" type="email" placeholder="tucorreo@email.com" autocomplete="email"/>
          </div>
        </div>
        <button class="zk-auth-submit" id="fp-send" style="margin-bottom:0">
          <span id="fp-send-txt">ENVIAR CÓDIGO</span>
          <span class="zk-auth-submit-arrow">→</span>
        </button>
      </div>
      <div id="zkForgotStep2" style="display:none">
        <div class="zk-forgot-sent-info" id="fp-sent-info"></div>
        <div class="zk-forgot-code-title">Ingresa el código de 6 dígitos</div>
        <div class="zk-code-inputs" id="fp-code-wrap">
          <input class="zk-code-digit" maxlength="1" data-idx="0" inputmode="numeric"/>
          <input class="zk-code-digit" maxlength="1" data-idx="1" inputmode="numeric"/>
          <input class="zk-code-digit" maxlength="1" data-idx="2" inputmode="numeric"/>
          <span class="zk-code-sep">—</span>
          <input class="zk-code-digit" maxlength="1" data-idx="3" inputmode="numeric"/>
          <input class="zk-code-digit" maxlength="1" data-idx="4" inputmode="numeric"/>
          <input class="zk-code-digit" maxlength="1" data-idx="5" inputmode="numeric"/>
        </div>
        <div class="zk-forgot-resend">
          ¿No llegó? <button id="fp-resend" class="zk-auth-link-sm">Reenviar</button>
          <span id="fp-countdown" class="zk-forgot-countdown"></span>
        </div>
        <div id="fp-code-msg"></div>
        <button class="zk-auth-submit" id="fp-verify" style="margin-bottom:0">
          <span id="fp-verify-txt">VERIFICAR CÓDIGO</span>
          <span class="zk-auth-submit-arrow">→</span>
        </button>
      </div>
      <div id="zkForgotStep3" style="display:none">
        <div class="zk-forgot-sent-info" style="background:rgba(0,255,136,.06);border-color:rgba(0,255,136,.18);color:#00FF88;">✓ Código verificado correctamente</div>
        <div class="zk-forgot-code-title">Crea tu nueva contraseña</div>
        <div class="zk-auth-field" style="margin-bottom:12px;">
          <div class="zk-auth-input-wrap">
            <span class="zk-auth-input-icon">🔒</span>
            <input id="fp-np" class="zk-auth-input" type="password" placeholder="Nueva contraseña..."/>
            <button class="zk-auth-eye" id="fp-eye1" tabindex="-1">👁</button>
          </div>
          <div class="zk-pwd-strength">
            <div class="zk-pwd-bar"><div class="zk-pwd-fill" id="fp-pwd-fill"></div></div>
            <span id="fp-pwd-lbl" class="zk-pwd-lbl"></span>
          </div>
        </div>
        <div class="zk-auth-field" style="margin-bottom:16px;">
          <div class="zk-auth-input-wrap">
            <span class="zk-auth-input-icon">🔒</span>
            <input id="fp-np2" class="zk-auth-input" type="password" placeholder="Confirmar contraseña..."/>
            <button class="zk-auth-eye" id="fp-eye2" tabindex="-1">👁</button>
          </div>
        </div>
        <div id="fp-new-msg"></div>
        <button class="zk-auth-submit zk-auth-submit-green" id="fp-change" style="margin-bottom:0">
          <span id="fp-change-txt">CAMBIAR CONTRASEÑA</span>
          <span class="zk-auth-submit-arrow">→</span>
        </button>
      </div>
      <div id="zkForgotStep4" style="display:none;text-align:center;padding:20px 0;">
        <div style="font-size:48px;margin-bottom:16px;">🎉</div>
        <div class="zk-forgot-title" style="color:#00FF88;">¡CONTRASEÑA CAMBIADA!</div>
        <div class="zk-forgot-sub" style="margin-bottom:20px;">Tu contraseña fue actualizada correctamente.</div>
        <button class="zk-auth-submit" onclick="closeModal();app.go('login')" style="margin-bottom:0">IR AL LOGIN →</button>
      </div>
    </div>
  `);

  let fpEmail='',fpToken='',fpCd=null;

  const goStep=n=>[1,2,3,4].forEach(i=>{ const el=document.getElementById('zkForgotStep'+i); if(el) el.style.display=i===n?'':'none'; });

  // Fuerza contraseña
  document.getElementById('fp-np')?.addEventListener('input',e=>{
    const v=e.target.value,fill=document.getElementById('fp-pwd-fill'),lbl=document.getElementById('fp-pwd-lbl');
    if(!fill||!lbl)return;
    let sc=0;if(v.length>=6)sc++;if(v.length>=10)sc++;if(/[A-Z]/.test(v))sc++;if(/[0-9]/.test(v))sc++;if(/[^A-Za-z0-9]/.test(v))sc++;
    const lv=[{w:'0%',c:'transparent',t:''},{w:'25%',c:'#FF3A3A',t:'Débil'},{w:'50%',c:'#FF9500',t:'Regular'},{w:'75%',c:'#FFD700',t:'Buena'},{w:'100%',c:'#00FF88',t:'Fuerte'}];
    const l=lv[Math.min(sc,4)];fill.style.width=l.w;fill.style.background=l.c;lbl.textContent=l.t;lbl.style.color=l.c;
  });
  document.getElementById('fp-eye1')?.addEventListener('click',()=>{ const i=document.getElementById('fp-np'); i.type=i.type==='password'?'text':'password'; });
  document.getElementById('fp-eye2')?.addEventListener('click',()=>{ const i=document.getElementById('fp-np2'); i.type=i.type==='password'?'text':'password'; });

  // Inputs código — auto-avance + auto-verificar
  const digitInputs=[...document.querySelectorAll('.zk-code-digit')];
  digitInputs.forEach((inp,i)=>{
    inp.addEventListener('input',()=>{
      inp.value=inp.value.replace(/\D/g,'').slice(-1);
      if(inp.value&&i<digitInputs.length-1) digitInputs[i+1].focus();
      if(digitInputs.map(a=>a.value).join('').length===6) setTimeout(()=>document.getElementById('fp-verify')?.click(),120);
    });
    inp.addEventListener('keydown',e=>{ if(e.key==='Backspace'&&!inp.value&&i>0) digitInputs[i-1].focus(); });
    inp.addEventListener('paste',e=>{
      e.preventDefault();
      const p=(e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
      digitInputs.forEach((a,j)=>a.value=p[j]||'');
      const last=Math.min(p.length,6)-1; if(last>=0) digitInputs[last].focus();
      if(p.length===6) setTimeout(()=>document.getElementById('fp-verify')?.click(),120);
    });
  });

  // Countdown reenvío
  function startCountdown(sec=60){
    const btn=document.getElementById('fp-resend'),cd=document.getElementById('fp-countdown');
    if(btn) btn.disabled=true; let s=sec;
    fpCd=setInterval(()=>{ s--; if(cd) cd.textContent=s>0?`(${s}s)`:'';
      if(s<=0){ clearInterval(fpCd); if(btn) btn.disabled=false; if(cd) cd.textContent=''; } },1000);
  }

  // Paso 1 — enviar correo
  async function sendCode(){
    const email=document.getElementById('fp-email')?.value.trim();
    const msg=document.getElementById('fp-msg');
    if(!email){ if(msg) msg.innerHTML='<div class="notif notif-error">Ingresa tu correo</div>'; return; }
    const btn=document.getElementById('fp-send'),btnTxt=document.getElementById('fp-send-txt');
    btn.disabled=true; btnTxt.textContent='ENVIANDO...'; btn.classList.add('zk-auth-loading');
    try{
      await API.forgotPassword(email); fpEmail=email;
      const info=document.getElementById('fp-sent-info');
      if(info) info.innerHTML=`📧 Código enviado a <strong>${email}</strong>. Revisa tu bandeja de entrada.`;
      goStep(2); startCountdown(60);
      setTimeout(()=>digitInputs[0]?.focus(),150);
    }catch(e){
      if(msg) msg.innerHTML=`<div class="notif notif-error">${e.message}</div>`;
      btn.disabled=false; btnTxt.textContent='ENVIAR CÓDIGO'; btn.classList.remove('zk-auth-loading');
    }
  }
  document.getElementById('fp-send')?.addEventListener('click',sendCode);
  document.getElementById('fp-email')?.addEventListener('keydown',e=>e.key==='Enter'&&sendCode());
  document.getElementById('fp-resend')?.addEventListener('click',async()=>{
    if(!fpEmail) return;
    try{ await API.forgotPassword(fpEmail); startCountdown(60); showToast('Código reenviado ✓'); }
    catch(e){ showToast(e.message,'error'); }
  });

  // Paso 2 — verificar código
  document.getElementById('fp-verify')?.addEventListener('click',async()=>{
    const code=digitInputs.map(a=>a.value).join('');
    const msg=document.getElementById('fp-code-msg');
    if(code.length<6){ if(msg) msg.innerHTML='<div class="notif notif-error">Ingresa los 6 dígitos</div>'; return; }
    const btn=document.getElementById('fp-verify'),btnTxt=document.getElementById('fp-verify-txt');
    btn.disabled=true; btnTxt.textContent='VERIFICANDO...'; btn.classList.add('zk-auth-loading');
    try{
      const res=await apiFetch('POST','/auth/verify-reset-code',{email:fpEmail,code});
      fpToken=res.token||code; clearInterval(fpCd); goStep(3);
      setTimeout(()=>document.getElementById('fp-np')?.focus(),100);
    }catch(e){
      if(msg) msg.innerHTML=`<div class="notif notif-error">${e.message||'Código incorrecto'}</div>`;
      digitInputs.forEach(d=>{ d.classList.add('zk-code-error'); setTimeout(()=>d.classList.remove('zk-code-error'),500); d.value=''; });
      digitInputs[0]?.focus();
      btn.disabled=false; btnTxt.textContent='VERIFICAR CÓDIGO'; btn.classList.remove('zk-auth-loading');
    }
  });

  // Paso 3 — nueva contraseña
  document.getElementById('fp-change')?.addEventListener('click',async()=>{
    const np=document.getElementById('fp-np')?.value;
    const np2=document.getElementById('fp-np2')?.value;
    const msg=document.getElementById('fp-new-msg');
    if(!np||np.length<6){ if(msg) msg.innerHTML='<div class="notif notif-error">Mínimo 6 caracteres</div>'; return; }
    if(np!==np2){ if(msg) msg.innerHTML='<div class="notif notif-error">Las contraseñas no coinciden</div>'; return; }
    const btn=document.getElementById('fp-change'),btnTxt=document.getElementById('fp-change-txt');
    btn.disabled=true; btnTxt.textContent='GUARDANDO...'; btn.classList.add('zk-auth-loading');
    try{ await API.resetPassword(fpToken,np); goStep(4); }
    catch(e){
      if(msg) msg.innerHTML=`<div class="notif notif-error">${e.message}</div>`;
      btn.disabled=false; btnTxt.textContent='CAMBIAR CONTRASEÑA'; btn.classList.remove('zk-auth-loading');
    }
  });

  // Focus inicial
  setTimeout(()=>document.getElementById('fp-email')?.focus(),150);
};

// ── ARRANQUE ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',async()=>{
  zkInitGlobals();
  if(S.token){ try{S.user=await API.me();}catch{S.token=null;sessionStorage.removeItem('zk_token');} }
  setupRegionPicker();
  if(S.region){ renderNav(); await renderPage('home'); await renderFooter(); }
  document.getElementById('modal-overlay').addEventListener('click',e=>{ if(e.target.id==='modal-overlay')closeModal(); });
  // Verificar streams en vivo cada 60 seg
  if(S.region){ await updateLiveDot(); setInterval(updateLiveDot, 60000); }
});
