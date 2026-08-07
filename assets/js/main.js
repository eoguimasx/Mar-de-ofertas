/* ══════════ ESTADO ══════════ */
const KEY = 'mardeofertas_v2';

/* ══════════ SUPABASE (banco central da loja) ══════════
   Com isso preenchido, o catálogo vive na nuvem: a Roberta edita de
   qualquer aparelho e TODOS os clientes veem a versão mais nova.
   O IndexedDB local vira só um cache pra abrir rápido / funcionar offline.

   COMO PREENCHER: no painel do Supabase, vá em Settings → API e copie:
   · Project URL  →  SUPABASE_URL
   · anon public  →  SUPABASE_ANON_KEY
   (a chave "anon" é feita pra ficar exposta no site — a escrita é
    protegida pela senha do painel, verificada no servidor)              */
// Prefer values injected at runtime via a small `env.js` that defines `window.__ENV__`.
// Fallback to the hardcoded values for backward compatibility.
const _ENV = (window && (window.__ENV__ || window.__env__)) || {};
const SUPABASE_URL      = String(_ENV.SUPABASE_URL || '');
const SUPABASE_ANON_KEY = String(_ENV.SUPABASE_ANON_KEY || '');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY){
  console.warn('Supabase env not found: create /env.js or set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel');
}

const supabaseAtivo = () =>
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 20;

/* chamada base com timeout — sem internet, falha em 12s em vez de travar */
async function sbFetch(caminho, opts = {}, timeoutMs = 12000){
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(SUPABASE_URL + caminho, {
      ...opts,
      signal: ctl.signal,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    if (!r.ok){
      let msg = 'HTTP ' + r.status;
      try { const body = await r.json(); if (body && body.message) msg = body.message; } catch(e){}
      throw new Error(msg);
    }
    return await r.json();
  } finally { clearTimeout(t); }
}

/* lê o catálogo público da loja */
async function nuvemLer(){
  const rows = await sbFetch('/rest/v1/loja?id=eq.principal&select=dados');
  return (rows && rows[0] && rows[0].dados) || null;
}
/* confere a senha do painel (verificação acontece NO SERVIDOR) */
async function nuvemVerificarSenha(senha){
  return await sbFetch('/rest/v1/rpc/verificar_senha', {
    method: 'POST', body: JSON.stringify({ p_senha: senha })
  });
}
/* grava o catálogo; só funciona com a senha certa */
async function nuvemSalvar(senha, dados, novaSenha){
  return await sbFetch('/rest/v1/rpc/salvar_loja', {
    method: 'POST',
    body: JSON.stringify({ p_senha: senha, p_dados: dados, p_nova_senha: novaSenha || null })
  });
}

let senhaSessao = null;        // fica só na memória, depois do login do painel
let novaSenhaPendente = null;  // troca de senha aguardando o próximo salvamento
const MAX_PRODUCTS = 1000;

/* ══════════ ARMAZENAMENTO ══════════ */
const IDB_NOME = 'mardeofertas';
const IDB_STORE = 'estado';
const IDB_CHAVE = 'principal';

function idbAbrir(){
  return new Promise((ok, erro)=>{
    if (!window.indexedDB) return erro(new Error('sem IndexedDB'));
    const req = indexedDB.open(IDB_NOME, 1);
    req.onupgradeneeded = ()=>{
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = ()=> ok(req.result);
    req.onerror = ()=> erro(req.error || new Error('falha ao abrir'));
    req.onblocked = ()=> erro(new Error('bloqueado'));
  });
}
function idbLer(){
  return idbAbrir().then(db => new Promise((ok, erro)=>{
    const t = db.transaction([IDB_STORE], 'readonly');
    const r = t.objectStore(IDB_STORE).get(IDB_CHAVE);
    r.onsuccess = ()=> ok(r.result ?? null);
    r.onerror  = ()=> erro(r.error);
  }));
}
function idbGravar(valor){
  return idbAbrir().then(db => new Promise((ok, erro)=>{
    const t = db.transaction([IDB_STORE], 'readwrite');
    const r = t.objectStore(IDB_STORE).put(valor, IDB_CHAVE);
    r.onsuccess = ()=> ok(true);
    r.onerror  = ()=> erro(r.error);
    t.onabort  = ()=> erro(t.error || new Error('transação abortada'));
  }));
}
const SEED = {
  password: 'mardeofertas',
  settings: {
    whatsapp:'12991694868',
    address:'Rua Sete de Setembro, 04 — Centro, Cachoeira Paulista',
    instagram:'mar.de.ofertas_',
    minOrder:30,
    deliveryFee:5,
    paymentMethods:['Dinheiro','Pix (na maquininha)','Crédito','Débito','Alimentação','Refeição'],
    paymentsRev:2,
    promoGroups: [
      {id:'azul',  name:'Grupo Azul',  icon:'🔵', color:'#1888BA', minQty:4, mode:'fixed', fixedPrice:20, discountPercent:10, active:true},
      {id:'verde', name:'Grupo Verde', icon:'🟢', color:'#2DBE6C', minQty:3, mode:'fixed', fixedPrice:15, discountPercent:10, active:true},
      {id:'ouro',  name:'Grupo Ouro',  icon:'⭐', color:'#F0B429', minQty:5, mode:'fixed', fixedPrice:25, discountPercent:10, active:true}
    ]
  },
  products: [
    {id:'p1',  name:'Arroz Tio João 5kg',        category:'Mercearia',           price:28.90, emoji:'🍚', image:null, available:true, promoGroup:'azul'},
    {id:'p2',  name:'Feijão Carioca 1kg',        category:'Mercearia',           price:8.50,  emoji:'🫘', image:null, available:true, promoGroup:null},
    {id:'p3',  name:'Óleo de Soja Soya 900ml',   category:'Mercearia',           price:7.90,  emoji:'🫗', image:null, available:true, promoGroup:null},
    {id:'p4',  name:'Açúcar Refinado União 1kg', category:'Mercearia',           price:4.50,  emoji:'🧂', image:null, available:true, promoGroup:'azul'},
    {id:'p5',  name:'Café 3 Corações 500g',      category:'Mercearia',           price:18.90, emoji:'☕', image:null, available:true, promoGroup:'ouro'},
    {id:'p6',  name:'Refrigerante Coca-Cola 2L', category:'Bebidas',             price:10.90, emoji:'🥤', image:null, available:true, promoGroup:'verde'},
    {id:'p7',  name:'Água Mineral 500ml',        category:'Bebidas',             price:2.50,  emoji:'💧', image:null, available:true, promoGroup:null},
    {id:'p8',  name:'Suco Del Valle Uva 1L',     category:'Bebidas',             price:8.90,  emoji:'🧃', image:null, available:true, promoGroup:'verde'},
    {id:'p9',  name:'Cerveja Skol Lata 350ml',   category:'Bebidas',             price:4.20,  emoji:'🍺', image:null, available:true, promoGroup:'verde'},
    {id:'p10', name:'Pão Francês (kg)',          category:'Padaria',             price:16.90, emoji:'🥖', image:null, available:true, promoGroup:null},
    {id:'p11', name:'Pão de Forma Wickbold',     category:'Padaria',             price:9.90,  emoji:'🍞', image:null, available:true, promoGroup:null},
    {id:'p12', name:'Leite Integral Italac 1L',  category:'Frios e laticínios',  price:5.50,  emoji:'🥛', image:null, available:true, promoGroup:'ouro'},
    {id:'p13', name:'Queijo Mussarela 200g',     category:'Frios e laticínios',  price:12.90, emoji:'🧀', image:null, available:true, promoGroup:'ouro'},
    {id:'p14', name:'Presunto Fatiado 200g',     category:'Frios e laticínios',  price:9.90,  emoji:'🍖', image:null, available:false, promoGroup:null},
    {id:'p15', name:'Ovos Brancos (dúzia)',      category:'Frios e laticínios',  price:13.90, emoji:'🥚', image:null, available:true, promoGroup:'ouro'},
    {id:'p16', name:'Biscoito Recheado Bono',    category:'Doces e snacks',      price:3.90,  emoji:'🍪', image:null, available:true, promoGroup:null, variants:[{name:'Morango',available:true},{name:'Chocolate',available:true},{name:'Doce de Leite',available:false}]},
    {id:'p17', name:'Chocolate Lacta 90g',       category:'Doces e snacks',      price:6.50,  emoji:'🍫', image:null, available:true, promoGroup:'ouro'},
    {id:'p18', name:'Salgadinho Ruffles',        category:'Doces e snacks',      price:7.90,  emoji:'🥔', image:null, available:true, promoGroup:null},
    {id:'p19', name:'Sabão em Pó Omo 1kg',       category:'Higiene e limpeza',   price:14.90, emoji:'🧼', image:null, available:true, promoGroup:'azul'},
    {id:'p20', name:'Papel Higiênico Neve 12un', category:'Higiene e limpeza',   price:22.90, emoji:'🧻', image:null, available:true, promoGroup:'azul'},
    {id:'p21', name:'Detergente Ypê',            category:'Higiene e limpeza',   price:2.90,  emoji:'🧴', image:null, available:true, promoGroup:null},
    {id:'p22', name:'Banana Prata (kg)',         category:'Hortifruti',          price:5.90,  emoji:'🍌', image:null, available:true, promoGroup:null},
    {id:'p23', name:'Tomate (kg)',               category:'Hortifruti',          price:8.90,  emoji:'🍅', image:null, available:true, promoGroup:null},
    {id:'p24', name:'Batata (kg)',               category:'Hortifruti',          price:6.50,  emoji:'🥔', image:null, available:true, promoGroup:null}
  ]
};

// começa com o padrão pra nada ficar indefinido; a leitura real (assíncrona,
// do IndexedDB) substitui isso na inicialização, poucos milissegundos depois.
let state = load(null);
let cart = {};
let activeCat = 'todos';
let query = '';
let mode = 'entrega';
let payment = null;
let cashFor = null;
let editingId = null;
let pickedEmoji = '📦';
let pickedImage = null;

/* valida e normaliza os dados brutos vindos do armazenamento.
   Recebe o texto salvo; se vier nulo ou quebrado, devolve o estado padrão. */
function load(raw){
  const base = JSON.parse(JSON.stringify(SEED));

  /* ── validadores de segurança ─────────────────────────────────────────
     TODO dado externo (IndexedDB, localStorage ou, no futuro, Supabase)
     passa por aqui antes de tocar a tela. Como o app monta HTML com esses
     valores, cada campo só é aceito num formato conhecido e inofensivo:
     - id: só letras/números/traço (é como o app gera: 'p'+Date.now())
     - emoji/ícone: curto e sem caracteres de HTML
     - imagem: apenas data-URL de imagem em base64 (é o que o upload gera) */
  const safeId    = v => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v)) ? v : null;
  const safeEmoji = (v, pad) => (typeof v === 'string' && v.length > 0 && v.length <= 8 && !/[<>&"'`]/.test(v)) ? v : pad;
  const safeImage = v => (typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(v)) ? v : null;

  try{
    if(!raw) return base;
    const s = JSON.parse(raw);
    const settings = Object.assign({}, base.settings, s.settings || {});
    // atualização de versão: se o navegador guardou a lista antiga de pagamentos,
    // substitui pela oficial da loja — sem mexer nos produtos já cadastrados.
    // (a versão precisa vir do dado SALVO; se lida depois da mesclagem já viria
    //  preenchida com o padrão e a atualização nunca aconteceria)
    const revSalva = (s.settings && Number(s.settings.paymentsRev)) || 0;
    if (revSalva < base.settings.paymentsRev){
      settings.paymentMethods = base.settings.paymentMethods.slice();
      settings.paymentsRev = base.settings.paymentsRev;
    }
    if (!Array.isArray(settings.paymentMethods) || !settings.paymentMethods.length){
      settings.paymentMethods = base.settings.paymentMethods;
    } else {
      settings.paymentMethods = settings.paymentMethods.filter(m => typeof m === 'string' && m.trim()).map(m => m.trim());
      if (!settings.paymentMethods.length) settings.paymentMethods = base.settings.paymentMethods;
    }

    // grupos promocionais: cada item precisa ter forma correta, senão é descartado
    // silenciosamente — dado ruim aqui não pode derrubar o site.
    settings.promoGroups = Array.isArray(settings.promoGroups)
      ? settings.promoGroups.map(sanitizePromoGroup).filter(Boolean)
      : base.settings.promoGroups.slice();

    const idsValidos = new Set(settings.promoGroups.map(g => g.id));
    // mescla defensiva: dado salvo incompleto não pode derrubar a loja
    return {
      password: typeof s.password === 'string' && s.password ? s.password : base.password,
      settings,
      products: Array.isArray(s.products)
        ? s.products.filter(p => p && safeId(p.id) && p.name).slice(0, MAX_PRODUCTS).map(p => ({
            id: p.id, name: String(p.name).slice(0, 80),
            category: String(p.category || 'Outros').slice(0, 40),
            price: Number(p.price) || 0,
            emoji: safeEmoji(p.emoji, '📦'),
            image: safeImage(p.image),
            available: p.available !== false,
            destaque: p.destaque === true,
            promoGroup: (typeof p.promoGroup === 'string' && idsValidos.has(p.promoGroup)) ? p.promoGroup : null,
            variants: sanitizeVariants(p.variants)
          }))
        : base.products
    };
  }catch(e){ return base; }
}

/* valida a lista de variações (sabores/opções) de um produto salvo:
   descarta lixo, limita nome a 40 letras, remove duplicadas, máximo de 30. */
function sanitizeVariants(v){
  if (!Array.isArray(v)) return [];
  const vistos = new Set(), out = [];
  for (const x of v){
    if (!x || typeof x !== 'object') continue;
    const name = String(x.name || '').trim().slice(0, 40);
    if (!name || vistos.has(name)) continue;
    vistos.add(name);
    out.push({ name, available: x.available !== false });
    if (out.length >= 30) break;
  }
  return out;
}

/* ══════════ CHAVES DO CARRINHO ══════════ */
/* um item do carrinho pode ser "produto" ou "produto + variação" (sabor).
   A chave junta os dois com um separador de controle que não aparece em nomes. */
const VSEP = '\u001F';
function cartKey(id, variant){ return variant ? id + VSEP + variant : id; }
function keyInfo(key){
  const i = key.indexOf(VSEP);
  return i < 0 ? { id:key, variant:null } : { id:key.slice(0,i), variant:key.slice(i+1) };
}
/* quantidade total de um produto somando todas as variações */
function prodQty(id){
  let n = 0;
  for (const [k,q] of Object.entries(cart)){ if (keyInfo(k).id === id) n += q; }
  return n;
}
function findVariant(p, nome){ return (p.variants||[]).find(v=>v.name===nome) || null; }
/* codifica a chave pra viver dentro de atributo HTML sem risco */
const encKey = k => encodeURIComponent(k);
const decKey = k => decodeURIComponent(k);
function sanitizePromoGroup(g){
  if (!g || typeof g !== 'object') return null;
  // id só no formato que o próprio app gera ('pg'+timestamp ou seeds como 'azul')
  if (typeof g.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(g.id)) return null;
  const name = typeof g.name === 'string' && g.name.trim() ? g.name.trim().slice(0, 40) : 'Grupo';
  // ícone: curto e sem caracteres de HTML — é renderizado direto no innerHTML
  const icon = (typeof g.icon === 'string' && g.icon.length > 0 && g.icon.length <= 8 && !/[<>&\"'`]/.test(g.icon)) ? g.icon : '🔵';
  const color = typeof g.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(g.color) ? g.color : '#1888BA';
  let minQty = Math.round(Number(g.minQty));
  if (!Number.isFinite(minQty) || minQty < 2) minQty = 2;
  if (minQty > 50) minQty = 50;
  const mode = g.mode === 'discount' ? 'discount' : 'fixed';
  let fixedPrice = Number(g.fixedPrice);
  if (!Number.isFinite(fixedPrice) || fixedPrice < 0) fixedPrice = 0;
  let discountPercent = Math.round(Number(g.discountPercent));
  if (!Number.isFinite(discountPercent) || discountPercent < 1) discountPercent = 1;
  if (discountPercent > 99) discountPercent = 99;
  const active = g.active !== false;
  return { id:g.id, name, icon, color, minQty, mode, fixedPrice, discountPercent, active };
}
/* grava no IndexedDB; se falhar, tenta o localStorage como reserva.
   Não bloqueia a interface — quem chama não precisa esperar. */
let avisouArmazenamento = false;
function save(){
  const json = JSON.stringify(state);
  idbGravar(json).catch(()=>{
    try {
      localStorage.setItem(KEY, json);
    } catch(e){
      if (!avisouArmazenamento){
        avisouArmazenamento = true;
        toast('Não foi possível salvar (armazenamento cheio)','⚠️');
        setTimeout(()=>{ avisouArmazenamento = false; }, 5000);
      }
    }
  });
  salvarNaNuvem(); // em segundo plano; não trava a interface
}

/* envia o estado pra nuvem. Se vários salvamentos acontecerem em sequência
   (ex: editando vários produtos rápido), espera o atual terminar e manda
   só mais um com a versão final — sem enfileirar dezenas de envios. */
let salvandoNuvem = false, salvarDeNovo = false;
async function salvarNaNuvem(){
  if (!supabaseAtivo() || !senhaSessao) return;
  if (salvandoNuvem){ salvarDeNovo = true; return; }
  salvandoNuvem = true;
  try {
    const { password, ...publico } = state;  // a senha NUNCA vai no catálogo público
    const ok = await nuvemSalvar(senhaSessao, publico, novaSenhaPendente);
    if (ok === true){
      if (novaSenhaPendente){ senhaSessao = novaSenhaPendente; novaSenhaPendente = null; }
    } else {
      toast('A nuvem recusou o salvamento (senha?)','⚠️');
    }
  } catch(e){
    if (String(e.message).includes('pacote_grande_demais')){
      toast('Catálogo grande demais pra nuvem agora — remova fotos de produtos antigos','⚠️');
    } else {
      toast('Sem conexão — alterações salvas só neste aparelho','⚠️');
    }
  } finally {
    salvandoNuvem = false;
    if (salvarDeNovo){ salvarDeNovo = false; salvarNaNuvem(); }
  }
}

/* lê o estado salvo: IndexedDB primeiro; se estiver vazio, procura dados da versão
   antiga no localStorage e migra pro IndexedDB, mantendo tudo que já foi cadastrado. */
async function carregarEstado(){
  let raw = null;
  try { raw = await idbLer(); } catch(e){ raw = null; }

  if (!raw){
    let antigo = null;
    try { antigo = localStorage.getItem(KEY); } catch(e){}
    if (antigo){
      raw = antigo;
      // migra pro IndexedDB e libera o espaço antigo (5MB) pra não ficar duplicado
      try { await idbGravar(antigo); localStorage.removeItem(KEY); } catch(e){}
    }
  }
  return load(raw);
}

/* ══════════ UTILS ══════════ */
const $ = id => document.getElementById(id);
const brl = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function priceHTML(v){
  const [a,b] = v.toFixed(2).split('.');
  return `<span class="cur">R$</span>${a}<span class="cts">,${b}</span>`;
}

let toastT, toastInicio = 0;
function toast(msg, ic='✓'){
  const t = $('toast');
  const agora = Date.now();
  // adicionar vários produtos seguidos reiniciava o tempo e o aviso parecia travado.
  // agora ele nunca fica mais que 2,2s na tela, não importa quantos toques.
  if (!t.classList.contains('on')) toastInicio = agora;
  $('toastMsg').textContent = msg;
  t.querySelector('.ic').textContent = ic;
  t.classList.toggle('warn', ic === '⚠️'); // erro/aviso fica vermelho; sucesso continua verde
  t.classList.add('on');
  t.setAttribute('aria-hidden','false');
  clearTimeout(toastT);
  const restante = Math.max(400, Math.min(1400, 2200 - (agora - toastInicio)));
  toastT = setTimeout(()=>{
    t.classList.remove('on');
    t.setAttribute('aria-hidden','true');
  }, restante);
}

/* ══════════ HORÁRIO ══════════ */
/* horário de funcionamento e regra de pedidos, num lugar só.
   Domingo (d===0): a loja abre 9h–13h, mas NÃO aceita pedidos pelo site
   (sem entrega nem retirada), então o botão de enviar fica bloqueado o dia todo. */
function storeStatus(){
  const n = new Date(), d = n.getDay(), t = n.getHours() + n.getMinutes()/60;
  let close;
  if (d >= 1 && d <= 5) close = 19;
  else if (d === 6) close = 17;
  else close = 13;
  const aberta = t >= 9 && t < close;
  const domingo = d === 0;
  // só dá pra pedir com a loja aberta E se não for domingo
  const aceitaPedido = aberta && !domingo;
  return { aberta, domingo, aceitaPedido, close, t };
}

function updateStatus(){
  const { aberta, domingo, close, t } = storeStatus();

  const dot = $('statusDot'), txt = $('statusText');
  if (aberta){
    dot.classList.remove('closed');
    if (domingo){
      // aberta pra visita, mas sem pedidos pelo site
      txt.innerHTML = `Aberta <span class="muted">· sem pedidos aos domingos</span>`;
    } else {
      txt.innerHTML = `Aberta agora <span class="muted">· fecha ${close}h</span>`;
    }
  } else {
    dot.classList.add('closed');
    txt.innerHTML = t < 9 ? `Fechada <span class="muted">· abre 9h</span>` : `Fechada <span class="muted">· abre amanhã 9h</span>`;
  }
  syncOrderAvailability();
}

/* liga/desliga a possibilidade de fechar pedido conforme o horário */
function syncOrderAvailability(){
  const { aceitaPedido, domingo } = storeStatus();
  const wpp = $('wppBtn');
  if (!wpp) return;
  wpp.classList.toggle('blocked', !aceitaPedido);
  const aviso = $('closedNote');
  if (aviso){
    if (aceitaPedido){
      aviso.style.display = 'none';
    } else {
      aviso.style.display = 'flex';
      aviso.querySelector('.cn-txt').textContent = domingo
        ? 'Aos domingos a loja não faz pedidos pelo site. Você pode montar seu pedido e enviar a partir de segunda.'
        : 'A loja está fechada agora. Monte seu pedido à vontade e envie quando ela abrir (Seg–Sáb, a partir das 9h).';
    }
  }
}

/* ══════════ CATEGORIAS ══════════ */
function cats(){
  const base = ['todos', ...[...new Set(state.products.map(p=>p.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'))];
  // a aba de destaque só aparece quando existe pelo menos 1 produto marcado —
  // senão o cliente cairia numa aba vazia sem entender o porquê.
  return state.products.some(p=>p.destaque) ? ['destaque', ...base] : base;
}
/* se a categoria aberta deixou de existir (último produto excluído ou movido,
   ou último destaque desmarcado), volta pra "Todos" — senão a loja aparecia vazia pro cliente. */
function ensureCat(){
  if (activeCat === 'destaque'){
    if (!state.products.some(p=>p.destaque)) activeCat = 'todos';
    return;
  }
  if (activeCat !== 'todos' && !state.products.some(p=>p.category===activeCat)) activeCat = 'todos';
}
function renderCats(){
  $('catscroll').innerHTML = cats().map(c=>
    `<button class="chip${c===activeCat?' active':''}${c==='destaque'?' destaque-chip':''}" data-cat="${esc(c)}">${c==='todos'?'Todos':c==='destaque'?'⭐ Destaque do dia':esc(c)}</button>`
  ).join('');
}
$('catscroll').addEventListener('click', e=>{
  const b = e.target.closest('.chip'); if(!b) return;
  activeCat = b.dataset.cat;
  renderCats(); renderGrid();
  const y = document.querySelector('.catalog').offsetTop - 76;
  window.scrollTo({ top:y, behavior:'smooth' });
});

/* ══════════ CATÁLOGO ══════════ */
function visible(){
  // busca sempre percorre a loja inteira — filtrar por categoria junto
  // fazia a pessoa digitar um produto que existe e não achar nada.
  if (query){
    const q = norm(query);
    return state.products.filter(p => norm(p.name).includes(q) || norm(p.category).includes(q));
  }
  if (activeCat === 'destaque') return state.products.filter(p=>p.destaque);
  return activeCat === 'todos' ? state.products : state.products.filter(p=>p.category===activeCat);
}

function renderGrid(){
  const list = visible();
  $('secTitle').textContent = query ? `Resultados para “${query}”` : (activeCat === 'todos' ? 'Todos os produtos' : activeCat === 'destaque' ? '⭐ Destaque do dia' : activeCat);
  const avail = list.filter(p=>p.available).length;
  $('secCount').textContent = list.length ? `${avail} disponíve${avail!==1?'is':'l'}` : 'sem resultado';

  if (!list.length){
    $('grid').innerHTML = `<div class="empty"><div class="ico">🔍</div><h3>Nada encontrado</h3><p>Tente outro nome ou escolha outra categoria.</p></div>`;
    return;
  }

  $('grid').innerHTML = list.map(p=>{
    const temVar = (p.variants||[]).length > 0;
    const q = temVar ? prodQty(p.id) : (cart[p.id] || 0);
    const media = p.image
      ? `<img src="${p.image}" alt="${esc(p.name)}">`
      : `<span class="obj">${p.emoji||'📦'}</span>`;
    let ctrl;
    if (!p.available){
      ctrl = `<button class="add" disabled aria-label="Indisponível">✕</button>`;
    } else if (temVar){
      // com opções, o botão sempre abre o seletor; com itens já escolhidos vira contador
      ctrl = q === 0
        ? `<button class="add" data-pick="${p.id}" aria-label="Escolher opções de ${esc(p.name)}">+</button>`
        : `<button class="pickqty" data-pick="${p.id}" aria-label="Alterar opções de ${esc(p.name)}">${q} ▾</button>`;
    } else {
      ctrl = q === 0
        ? `<button class="add" data-add="${encKey(p.id)}" aria-label="Adicionar ${esc(p.name)}">+</button>`
        : `<div class="stepper"><button data-sub="${encKey(p.id)}" aria-label="Remover um">−</button><span>${q}</span><button data-add="${encKey(p.id)}" aria-label="Adicionar mais um">+</button></div>`;
    }
    const pg = (p.available && p.promoGroup) ? state.settings.promoGroups.find(g=>g.id===p.promoGroup && g.active) : null;
    const promoTag = pg
      ? `<span class="promo-tag" style="background:${pg.color}33;border-color:${pg.color}88" title="${esc(pg.name)}">${pg.icon} ${dealLabel(pg)}</span>`
      : '';
    const nDisp = temVar ? (p.variants||[]).filter(v=>v.available).length : 0;
    const catLinha = temVar
      ? `${esc(p.category)} · ${nDisp} sabor${nDisp!==1?'es':''}`
      : esc(p.category);
    return `<article class="card${p.available?'':' out'}${p.destaque?' destaque':''}">\n      <div class="thumb">${p.available?'':'<span class="tag-out">Esgotado</span>'}${(p.destaque && p.available)?'<span class="destaque-tag">⭐ Destaque</span>':''}${promoTag}${media}</div>\n      <div class="card-body">\n        <div class="card-cat">${catLinha}</div>\n        <h3 class="card-name">${esc(p.name)}</h3>\n        <div class="card-foot"><div class="price">${priceHTML(p.price)}</div>${ctrl}</div>\n      </div>\n    </article>`;
  }).join('');
}

/* delegação dos botões do grid */
$('grid').addEventListener('click', e=>{
  const pk = e.target.closest('[data-pick]');
  if (pk){ openPicker(pk.dataset.pick); return; }
  const a = e.target.closest('[data-add]');
  if (a){ add(decKey(a.dataset.add)); return; }
  const s = e.target.closest('[data-sub]');
  if (s){ sub(decKey(s.dataset.sub)); }
});

/* tilt 3D com o ponteiro (só desktop, respeita reduced-motion) */
const canTilt = window.matchMedia('(hover:hover) and (pointer:fine)').matches
             && !window.matchMedia('(prefers-reduced-motion:reduce)').matches;
if (canTilt){
  const g = $('grid');
  g.addEventListener('pointermove', e=>{
    const c = e.target.closest('.card'); if(!c) return;
    const r = c.getBoundingClientRect();
    const px = (e.clientX - r.left)/r.width - .5;
    const py = (e.clientY - r.top)/r.height - .5;
    c.style.setProperty('--ry', (px*8).toFixed(2)+'deg');
    c.style.setProperty('--rx', (-py*6).toFixed(2)+'deg');
  });
  g.addEventListener('pointerout', e=>{
    const c = e.target.closest('.card'); if(!c) return;
    if (c.contains(e.relatedTarget)) return;
    c.style.setProperty('--ry','0deg'); c.style.setProperty('--rx','0deg');
  });
}

/* ══════════ BUSCA ══════════ */
$('searchInput').addEventListener('input', e=>{
  query = e.target.value.trim();
  $('searchClear').classList.toggle('on', query.length > 0);
  renderGrid();
});
$('searchClear').addEventListener('click', ()=>{
  query = ''; $('searchInput').value = '';
  $('searchClear').classList.remove('on');
  renderGrid(); $('searchInput').focus();
});

/* (rest of original script preserved in this file) */

// Service Worker registration (simple, non-blocking)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  });
}
