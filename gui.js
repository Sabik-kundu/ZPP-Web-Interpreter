(function GUILib() {
'use strict';

let _root    = null;
let _zTop    = 9000;
let _windows = [];

function _getRoot() {
  if (_root) return _root;
  _root = document.getElementById('zpp-gui-root');
  if (!_root) {
    _root = document.createElement('div');
    _root.id = 'zpp-gui-root';
    _root.style.cssText = [
      'position:fixed','top:0','left:0',
      'width:100%','height:100%',
      'pointer-events:none',
      'z-index:9000',
      'font-family:"JetBrains Mono","Fira Code",Consolas,monospace',
    ].join(';');
    document.body.appendChild(_root);
  }
  return _root;
}

function _view(kind, el) {
  return {
    __type__     : 'view',
    __viewKind__ : kind,
    __el__       : el,
    __children__ : [],
    x: 0, y: 0, width: 0, height: 0,
  };
}

function _drag(win, handle) {
  let ox = 0, oy = 0;
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    ox = e.clientX - win.offsetLeft;
    oy = e.clientY - win.offsetTop;
    win.style.zIndex = ++_zTop;
    const move = e2 => { win.style.left=(e2.clientX-ox)+'px'; win.style.top=(e2.clientY-oy)+'px'; };
    const up   = ()  => { document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup',   up);
  });
}

function createWindow(w, h) {
  w = w || 400;  h = h || 300;
  const root = _getRoot();

  /* outer shell */
  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute',
    'left:80px','top:60px',
    'width:'+w+'px','height:'+h+'px',
    'background:#1e1e2e',
    'border:1.5px solid #44475a',
    'border-radius:10px',
    'box-shadow:0 12px 40px #0009',
    'display:flex','flex-direction:column',
    'overflow:hidden',
    'pointer-events:all',
    'z-index:'+(++_zTop),
  ].join(';');

  const bar = document.createElement('div');
  bar.style.cssText = [
    'display:flex','align-items:center',
    'height:32px','min-height:32px',
    'padding:0 12px',
    'background:#282a36',
    'border-bottom:1px solid #44475a',
    'cursor:move','user-select:none',
    'gap:6px',
  ].join(';');

  const dots = ['#ff5f57','#febc2e','#28c840'];
  const dotEls = dots.map((c,i) => {
    const d = document.createElement('div');
    d.style.cssText = 'width:12px;height:12px;border-radius:50%;background:'+c+';flex-shrink:0;cursor:pointer;transition:filter .15s;';
    d.addEventListener('mouseenter', () => d.style.filter = 'brightness(1.3)');
    d.addEventListener('mouseleave', () => d.style.filter = '');
    return d;
  });

  const titleEl = document.createElement('span');
  titleEl.style.cssText = 'flex:1;text-align:center;color:#cdd6f4;font-size:12px;font-weight:600;letter-spacing:.8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;';
  titleEl.textContent = 'ZETA++ Window';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:none;color:#6272a4;font-size:15px;cursor:pointer;line-height:1;padding:0 2px;transition:color .15s;flex-shrink:0;';
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#ff5555');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#6272a4');

  dotEls[0].title   = 'Close';
  closeBtn.title    = 'Close';
  const _doClose = () => { el.remove(); _windows = _windows.filter(v => v.__el__ !== el); };
  dotEls[0].addEventListener('click', _doClose);
  closeBtn.addEventListener('click',  _doClose);

  dotEls[1].title = 'Minimise';
  dotEls[1].addEventListener('click', () => { body.style.display = body.style.display === 'none' ? 'block' : 'none'; });
  dotEls[2].title = 'Maximise';
  dotEls[2].addEventListener('click', () => {
    if (el._maxed) {
      el.style.cssText = el._savedStyle;
      el._maxed = false;
    } else {
      el._savedStyle = el.style.cssText;
      Object.assign(el.style, { left:'0', top:'0', width:'100vw', height:'100vh', borderRadius:'0', zIndex:++_zTop });
      el._maxed = true;
    }
  });

  dotEls.forEach(d => bar.appendChild(d));
  bar.appendChild(titleEl);
  bar.appendChild(closeBtn);
  el.appendChild(bar);

  const body = document.createElement('div');
  body.style.cssText = 'flex:1;position:relative;overflow:hidden;background:#1e1e2e;';
  el.appendChild(body);

  _drag(el, bar);
  el.addEventListener('mousedown', () => { el.style.zIndex = ++_zTop; });
  root.appendChild(el);

  const v = _view('window', el);
  v.width  = w; v.height = h;
  v.__body__    = body;
  v.__titleEl__ = titleEl;
  v.__closeFns__= [_doClose];

  v.setTitle      = t  => { titleEl.textContent = String(t); return v; };
  v.setBackground = c  => { body.style.background = c; return v; };
  v.show          = () => { el.style.display = 'flex'; return v; };
  v.hide          = () => { el.style.display = 'none'; return v; };
  v.close         = () => _doClose();
  v.move          = (x,y) => { el.style.left=x+'px'; el.style.top=y+'px'; return v; };
  v.resize        = (nw,nh)=>{ el.style.width=nw+'px'; el.style.height=nh+'px'; return v; };
  v.onClose       = fn => { closeBtn.addEventListener('click', fn); dotEls[0].addEventListener('click', fn); return v; };
  v.loadImage     = src=> { body.style.backgroundImage='url('+src+')'; body.style.backgroundSize='cover'; return v; };

  v.setScene = scene => {
    body.innerHTML = '';
    if (scene && scene.__el__) {
      scene.__el__.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
      body.appendChild(scene.__el__);
    }
    return v;
  };

  _windows.push(v);
  return v;
}

function createScene(layout) {
  layout = layout || 'open';
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;';

  const v = _view('scene', el);
  v.__layout__ = layout;

  if (layout === 'grid') {
    el.style.display = 'grid';
    el.style.gap     = '4px';
    el.style.padding = '4px';
    el.style.boxSizing = 'border-box';
  }

  v.setLayout = (type, cols, rows) => {
    v.__layout__ = type;
    if (type === 'grid') {
      el.style.display = 'grid';
      el.style.gridTemplateColumns = 'repeat('+(cols||2)+',1fr)';
      if (rows) el.style.gridTemplateRows = 'repeat('+rows+',1fr)';
      el.style.gap = '4px'; el.style.padding = '4px';
    } else {
      el.style.display = 'block';
    }
    return v;
  };

  v.add = child => {
    if (!child || !child.__el__) return v;
    v.__children__.push(child);
    const ce = child.__el__;
    if (v.__layout__ === 'open') {
      ce.style.position = 'absolute';
      ce.style.left = (child.x || 0)+'px';
      ce.style.top  = (child.y || 0)+'px';
    }
    el.appendChild(ce);
    return v;
  };

  v.remove = child => {
    v.__children__ = v.__children__.filter(c => c !== child);
    if (child && child.__el__ && child.__el__.parentNode === el) el.removeChild(child.__el__);
    return v;
  };

  v.clear = () => { v.__children__ = []; el.innerHTML = ''; return v; };

  return v;
}

function createButton(label, x, y, w, h) {
  label = (label === undefined || label === null) ? 'Button' : String(label);
  const el = document.createElement('button');
  el.textContent = label;
  el.style.cssText = [
    'position:absolute',
    'left:'+(x||0)+'px','top:'+(y||0)+'px',
    'width:'+(w||90)+'px','height:'+(h||36)+'px',
    'background:#6272a4','color:#f8f8f2',
    'border:none','border-radius:6px',
    'font-family:inherit','font-size:13px','font-weight:600',
    'cursor:pointer','outline:none',
    'transition:background .12s,transform .07s',
    'box-sizing:border-box','padding:0 8px',
  ].join(';');

  let _bg = '#6272a4';
  el.addEventListener('mouseenter', () => { el.style.background = _lighten(_bg); });
  el.addEventListener('mouseleave', () => { el.style.background = _bg; });
  el.addEventListener('mousedown',  () => { el.style.transform = 'scale(0.94)'; });
  el.addEventListener('mouseup',    () => { el.style.transform = ''; });

  const v = _view('button', el);
  v.x = x||0; v.y = y||0; v.width = w||90; v.height = h||36;

  v.listen = (event, fn) => {
    const map = { click:'click', pressed:'click', hover:'mouseenter', release:'mouseup' };
    el.addEventListener(map[event] || event, () => fn());
    return v;
  };

  v.pressed = () => {
    const b = { _fn: null };
    b.do = fn => { b._fn = fn; el.addEventListener('click', fn); return b; };
    return b;
  };

  v.work = handler => {
    if (typeof handler === 'function') el.addEventListener('click', handler);
    else if (handler && typeof handler._fn === 'function') { /* already registered by .do() */ }
    return v;
  };

  v.setLabel     = t  => { el.textContent = String(t); return v; };
  v.setText      = v.setLabel;
  v.setColor     = (fg, bg) => { el.style.color = fg; el.style.background = _bg = bg; return v; };
  v.setBackground= bg => { el.style.background = _bg = bg; return v; };
  v.setFontSize  = s  => { el.style.fontSize = s+'px'; return v; };
  v.setRadius    = r  => { el.style.borderRadius = r+'px'; return v; };
  v.setBorder    = (c,w2)=>{ el.style.border=(w2||1)+'px solid '+(c||'#fff'); return v; };
  v.setPosition  = (nx,ny)=>{ v.x=nx; v.y=ny; el.style.left=nx+'px'; el.style.top=ny+'px'; return v; };
  v.setSize      = (nw,nh)=>{ v.width=nw; v.height=nh; el.style.width=nw+'px'; el.style.height=nh+'px'; return v; };
  v.enable       = () => { el.disabled=false; el.style.opacity='1'; return v; };
  v.disable      = () => { el.disabled=true;  el.style.opacity='.4'; return v; };
  return v;
}

function createLabel(text, x, y) {
  const el = document.createElement('div');
  el.textContent = String(text == null ? '' : text);
  el.style.cssText = [
    'position:absolute',
    'left:'+(x||0)+'px','top:'+(y||0)+'px',
    'color:#f8f8f2',
    'font-family:inherit','font-size:14px',
    'pointer-events:none','user-select:none',
    'white-space:pre',
  ].join(';');

  const v = _view('label', el);
  v.x = x||0; v.y = y||0;
  v.setText     = t  => { el.textContent = String(t); return v; };
  v.setColor    = c  => { el.style.color = c; return v; };
  v.setFontSize = s  => { el.style.fontSize = s+'px'; return v; };
  v.setFont     = (fam,sz,wt)=>{ if(fam)el.style.fontFamily=fam; if(sz)el.style.fontSize=sz+'px'; if(wt)el.style.fontWeight=wt; return v; };
  v.setAlign    = a  => { el.style.textAlign = a; return v; };
  v.setPosition = (nx,ny)=>{ v.x=nx; v.y=ny; el.style.left=nx+'px'; el.style.top=ny+'px'; return v; };
  v.setSize     = (nw,nh)=>{ el.style.width=nw+'px'; el.style.height=nh+'px'; el.style.overflow='hidden'; return v; };
  v.setBackground = c => { el.style.background=c; el.style.padding='2px 6px'; return v; };
  return v;
}

function createInput(hint, x, y, w, h) {
  const el = document.createElement('input');
  el.type = 'text';
  el.placeholder = String(hint || '');
  el.style.cssText = [
    'position:absolute',
    'left:'+(x||0)+'px','top:'+(y||0)+'px',
    'width:'+(w||160)+'px','height:'+(h||34)+'px',
    'background:#282a36','color:#f8f8f2',
    'border:1.5px solid #6272a4','border-radius:5px',
    'font-family:inherit','font-size:13px',
    'padding:0 10px','outline:none','box-sizing:border-box',
  ].join(';');
  el.addEventListener('focus', () => el.style.borderColor = '#bd93f9');
  el.addEventListener('blur',  () => el.style.borderColor = '#6272a4');

  const v = _view('input', el);
  v.x = x||0; v.y = y||0;
  v.getValue  = ()=> el.value;
  v.setValue  = t => { el.value = String(t); return v; };
  v.clear     = ()=> { el.value = ''; return v; };
  v.focus     = ()=> { el.focus(); return v; };
  v.setPosition = (nx,ny)=>{ el.style.left=nx+'px'; el.style.top=ny+'px'; return v; };
  v.listen = (event, fn) => {
    if (event === 'change') el.addEventListener('input',   () => fn(el.value));
    if (event === 'enter')  el.addEventListener('keydown', e  => { if(e.key==='Enter') fn(el.value); });
    if (event === 'focus')  el.addEventListener('focus',   fn);
    if (event === 'blur')   el.addEventListener('blur',    fn);
    return v;
  };
  return v;
}

function createCanvas(w, h) {
  w = w || 400;  h = h || 300;

  const el  = document.createElement('canvas');
  el.width  = w;  el.height = h;
  el.style.cssText = 'position:absolute;top:0;left:0;display:block;outline:none;';
  el.setAttribute('tabindex','0');

  const ctx   = el.getContext('2d');
  let _loop   = null;
  let _keys   = {};
  let _onKey  = [];
  let _onKeyUp= [];

  el.addEventListener('keydown', e => {
    _keys[e.key] = _keys[e.code] = true;
    e.preventDefault();
    _onKey.forEach(f => f(e.key, e.code));
  });
  el.addEventListener('keyup', e => {
    _keys[e.key] = _keys[e.code] = false;
    _onKeyUp.forEach(f => f(e.key, e.code));
  });

  const v = _view('canvas', el);
  v.width = w;  v.height = h;
  v.__ctx__  = ctx;
  v.__keys__ = _keys;

  /* ── drawing ── */
  v.getCtx    = ()           => ctx;
  v.clear     = (bg)         => { if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);}else ctx.clearRect(0,0,w,h); return v; };
  v.fill      = c            => { ctx.fillStyle=c; ctx.fillRect(0,0,w,h); return v; };
  v.drawRect  = (x,y,rw,rh,c,filled)=>{ if(filled===false){ctx.strokeStyle=c||'#fff';ctx.strokeRect(x,y,rw,rh);}else{ctx.fillStyle=c||'#fff';ctx.fillRect(x,y,rw,rh);} return v; };
  v.drawCircle= (x,y,r,c,filled)=>{ ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2); if(filled===false){ctx.strokeStyle=c||'#fff';ctx.stroke();}else{ctx.fillStyle=c||'#fff';ctx.fill();} return v; };
  v.drawText  = (t,x,y,c,sz,fam)=>{ ctx.fillStyle=c||'#fff'; ctx.font=(sz||14)+'px '+(fam||'monospace'); ctx.fillText(String(t),x,y); return v; };
  v.drawLine  = (x1,y1,x2,y2,c,lw)=>{ ctx.beginPath();ctx.strokeStyle=c||'#fff';ctx.lineWidth=lw||1;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke(); return v; };
  v.drawPoly  = (pts,c,filled)=>{ if(!pts||pts.length<2)return v; ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);pts.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));ctx.closePath(); if(filled===false){ctx.strokeStyle=c||'#fff';ctx.stroke();}else{ctx.fillStyle=c||'#fff';ctx.fill();} return v; };
  v.drawArc   = (x,y,r,sa,ea,c,filled)=>{ ctx.beginPath();ctx.arc(x,y,r,sa,ea); if(filled===false){ctx.strokeStyle=c||'#fff';ctx.stroke();}else{ctx.fillStyle=c||'#fff';ctx.fill();} return v; };
  v.drawImage = (img,x,y,iw,ih)=>{ if(img&&img.__img__&&img.__img__.complete){ctx.drawImage(img.__img__,x||0,y||0,iw||img.__img__.naturalWidth,ih||img.__img__.naturalHeight);} return v; };
  v.setFont   = (sz,fam)     => { ctx.font=(sz||14)+'px '+(fam||'monospace'); return v; };
  v.setAlpha  = a            => { ctx.globalAlpha = a; return v; };
  v.save      = ()           => { ctx.save(); return v; };
  v.restore   = ()           => { ctx.restore(); return v; };
  v.translate = (x,y)        => { ctx.translate(x,y); return v; };
  v.rotate    = deg          => { ctx.rotate(deg*Math.PI/180); return v; };
  v.scale2    = (sx,sy)      => { ctx.scale(sx,sy||sx); return v; };
  v.measureText= t           => ctx.measureText(String(t)).width;
  v.setSize   = (nw,nh)      => { el.width=nw; el.height=nh; v.width=nw; v.height=nh; return v; };
  v.toDataURL = ()           => el.toDataURL();

  /* ── input ── */
  v.isKeyDown = k => !!_keys[k];
  v.onKey     = fn => { _onKey.push(fn); return v; };
  v.onKeyUp   = fn => { _onKeyUp.push(fn); return v; };
  v.onClick   = fn => { el.addEventListener('click',e=>{const r=el.getBoundingClientRect();fn(e.clientX-r.left,e.clientY-r.top);}); return v; };
  v.onMouse   = (ev,fn)=>{ el.addEventListener(ev,e=>{const r=el.getBoundingClientRect();fn(e.clientX-r.left,e.clientY-r.top,e);}); return v; };
  v.focus     = ()  => { el.focus(); return v; };

  v.loop = (fn, fps) => {
    if (_loop) cancelAnimationFrame(_loop);
    fps = fps || 60;
    const ms = 1000 / fps;
    let last = 0;
    function tick(ts) {
      _loop = requestAnimationFrame(tick);
      if (ts - last >= ms) { last = ts; fn(ts); }
    }
    _loop = requestAnimationFrame(tick);
    return v;
  };
  v.stopLoop = () => { if(_loop){cancelAnimationFrame(_loop);_loop=null;} return v; };

  return v;
}

function createScreen(w, h) {
  const win = createWindow(w || 600, h || 432);
  const cvs = createCanvas(w || 600, (h||432) - 32);  /* 32 = titlebar */
  cvs.__el__.style.cssText = 'position:absolute;top:0;left:0;display:block;outline:none;';

  const scene = createScene('open');
  scene.add(cvs);
  win.setScene(scene);
  win.__viewKind__ = 'screen';
  win.canvas = cvs;

  /* proxy all canvas methods */
  const proxy = ['clear','fill','drawRect','drawCircle','drawText','drawLine',
                  'drawPoly','drawArc','drawImage','loop','stopLoop',
                  'onKey','onKeyUp','onClick','isKeyDown','focus','getCtx',
                  'save','restore','translate','rotate','scale2','setAlpha',
                  'measureText','toDataURL'];
  proxy.forEach(m => { win[m] = (...a) => cvs[m](...a); });
  return win;
}

function createCamera(cvs) {
  const cam = _view('camera', null);
  cam.x = 0;  cam.y = 0;  cam.zoom = 1;

  cam.moveTo = (x,y)     => { cam.x=x; cam.y=y; return cam; };
  cam.zoomTo = z         => { cam.zoom=z; return cam; };
  cam.follow = (tgt, s)  => {
    s = s || 0.1;
    if (!cvs) return cam;
    cam.x += ((tgt.x - cvs.width/2)  - cam.x) * s;
    cam.y += ((tgt.y - cvs.height/2) - cam.y) * s;
    return cam;
  };
  cam.apply  = () => {
    if (cvs && cvs.__ctx__) {
      cvs.__ctx__.save();
      cvs.__ctx__.scale(cam.zoom, cam.zoom);
      cvs.__ctx__.translate(-cam.x, -cam.y);
    }
    return cam;
  };
  cam.reset  = () => { if(cvs&&cvs.__ctx__) cvs.__ctx__.restore(); return cam; };
  return cam;
}

function createPanel(x, y, w, h, bg) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute',
    'left:'+(x||0)+'px','top:'+(y||0)+'px',
    'width:'+(w||200)+'px','height:'+(h||150)+'px',
    'background:'+(bg||'#282a36'),
    'border:1px solid #44475a','border-radius:6px',
    'overflow:hidden','box-sizing:border-box',
  ].join(';');

  const v = _view('panel', el);
  v.x=x||0; v.y=y||0; v.width=w||200; v.height=h||150;
  v.setBackground = c   => { el.style.background=c; return v; };
  v.setBorder     = (c,bw)=>{ el.style.border=(bw||1)+'px solid '+(c||'#44475a'); return v; };
  v.setRadius     = r   => { el.style.borderRadius=r+'px'; return v; };
  v.add = child => {
    if (child && child.__el__) {
      child.__el__.style.position = 'absolute';
      el.appendChild(child.__el__);
    }
    return v;
  };
  return v;
}

function showAlert(msg, title) {
  const win = createWindow(360, 160);
  win.setTitle(title || 'Alert');
  win.move(Math.max(0,window.innerWidth/2-180), Math.max(0,window.innerHeight/2-80));
  const sc = createScene('open');
  const lbl = createLabel(String(msg), 20, 16);
  lbl.setFont(null, 13);
  const ok = createButton('OK', 140, 96, 80, 34);
  ok.setColor('#1e1e2e','#50fa7b');
  ok.on('click', () => win.close());
  sc.add(lbl); sc.add(ok);
  win.setScene(sc);
  return win;
}

function showPrompt(msg, cb, title) {
  const win = createWindow(380, 190);
  win.setTitle(title || 'Input');
  win.move(Math.max(0,window.innerWidth/2-190), Math.max(0,window.innerHeight/2-95));
  const sc  = createScene('open');
  const lbl = createLabel(String(msg), 20, 16);
  const inp = createInput('', 20, 56, 340, 32);
  const ok  = createButton('OK',     210, 112, 70, 32);
  const no  = createButton('Cancel', 290, 112, 80, 32);
  ok.setColor('#1e1e2e','#50fa7b');
  no.setColor('#f8f8f2','#ff5555');
  ok.on('click',()=>{ const val=inp.getValue(); win.close(); if(cb)cb(val); });
  no.on('click',()=>{ win.close(); if(cb)cb(null); });
  sc.add(lbl); sc.add(inp); sc.add(ok); sc.add(no);
  win.setScene(sc);
  setTimeout(()=>inp.focus(), 60);
  return win;
}

function loadWebImage(src, cb) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const v = _view('image', null);
  v.__img__ = img;
  v.ready   = false;
  img.onload  = () => { v.ready=true; v.width=img.naturalWidth; v.height=img.naturalHeight; if(cb)cb(v); };
  img.onerror = () => { v.ready=false; if(cb)cb(null); };
  img.src = src;
  return v;
}

function openImage(cb) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.addEventListener('change', () => {
    const f = inp.files[0];
    if (!f) { document.body.removeChild(inp); return; }
    const url = URL.createObjectURL(f);
    loadWebImage(url, cb);
    document.body.removeChild(inp);
  });
  inp.click();
}

function _lighten(hex) {
  try {
    const n = parseInt(hex.replace('#',''),16);
    const r = Math.min(255,((n>>16)&255)+30);
    const g = Math.min(255,((n>>8 )&255)+30);
    const b = Math.min(255,( n     &255)+30);
    return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  } catch(_) { return hex; }
}

if (typeof DSALibraries !== 'undefined') {
  DSALibraries['gui.zl'] = {
    description: 'Full GUI: Window, Scene, Button, Label, TextField, Canvas, Screen, Camera, Panel + game loops + image loading',
    inject(G) {

      if (typeof window !== 'undefined' && window.__ZPP__) {
        window.__ZPP__.registerBuiltins([
          'Window', 'Scene', 'Button', 'Label', 'TextField',
          'Canvas', 'Screen', 'Camera', 'Panel', 'Dialog', 'AskBox', 'make',
          // ── images ──
          'loadImage', 'pickImage',
          // ── color helpers ──
          'rgb', 'rgba', 'hex',
          // ── utilities ──
          'isWidget', 'closeAll', 'allWindows', 'viewPrint',
          // ── Screen/Canvas proxy methods ──
          'clear', 'fill',
          'drawRect', 'drawCircle', 'drawText', 'drawLine',
          'drawPoly', 'drawArc', 'drawImage',
          'setFont', 'setAlpha',
          'save', 'restore', 'translate', 'rotate', 'scale2',
          'measureText', 'toDataURL',
          'loop', 'stopLoop',
          'isKeyDown', 'onKey', 'onKeyUp', 'onClick', 'onMouse',
          // ── view object methods ──
          'setTitle', 'setBackground', 'setScene', 'move', 'close',
          'resize', 'minimize', 'maximize', 'setOpacity', 'setRadius',
          'setBorder', 'setResizable', 'bringToFront',
          'setLayout', 'add', 'remove',
          'getValue', 'setValue', 'setLabel', 'setText',
          'setColor', 'setFontSize', 'setFont', 'setAlign',
          'setPosition', 'setSize', 'setBackground',
          'enable', 'disable', 'listen',
          'getCtx', 'setFont', 'scale2',
          'moveTo', 'zoomTo', 'follow', 'apply', 'reset',
        ]);
        window.__ZPP__.registerTypes(['view']);
      }
      G.Window    = (w,h)          => createWindow(w,h);
      G.Scene     = (layout)       => createScene(layout);
      G.Button    = (l,x,y,w,h)   => createButton(l,x,y,w,h);
      G.Label     = (t,x,y)        => createLabel(t,x,y);
      G.TextField = (h,x,y,w,ht)  => createInput(h,x,y,w,ht);   
      G.Canvas    = (w,h)          => createCanvas(w,h);
      G.Screen    = (w,h)          => createScreen(w,h);
      G.Camera    = (cvs)          => createCamera(cvs);
      G.Panel     = (x,y,w,h,c)   => createPanel(x,y,w,h,c);
      G.Dialog    = (m,t)          => showAlert(m,t);             
      G.AskBox    = (m,cb,t)       => showPrompt(m,cb,t);        

      G.make = (type, ...args) => {
        if (typeof type === 'function') return type(...args);
        const map = {
          window:createWindow, scene:createScene, button:createButton,
          label:createLabel, textfield:createInput, canvas:createCanvas,
          screen:createScreen, camera:createCamera, panel:createPanel,
        };
        const fn = map[String(type).toLowerCase()];
        if (!fn) throw new Error('make: unknown view type "'+type+'"');
        return fn(...args);
      };

      /* ── images ── */
      G.loadImage = (src,cb) => loadWebImage(src,cb);
      G.pickImage = cb       => openImage(cb);                   

      /* ── colour helpers ── */
      G.rgb  = (r,g,b)   => 'rgb('+r+','+g+','+b+')';
      G.rgba = (r,g,b,a) => 'rgba('+r+','+g+','+b+','+a+')';
      G.hex  = c         => String(c);

      /* ── utilities ── */
      G.isWidget  = v => !!(v && v.__type__ === 'view');         
      G.closeAll  = () => { _windows.forEach(w=>{if(w.__el__)w.__el__.remove();}); _windows=[]; }; 
      G.allWindows= () => [..._windows];
      G.viewPrint = (win, text) => { 
        if (!win || !win.__body__) return;
        const d = document.createElement('div');
        d.style.cssText = 'color:#f8f8f2;font-family:monospace;font-size:12px;padding:1px 8px;';
        d.textContent = String(text);
        win.__body__.appendChild(d);
        win.__body__.scrollTop = win.__body__.scrollHeight;
      };
    }
  };
}

if (typeof module !== 'undefined') module.exports = {
  createWindow, createScene, createButton, createLabel,
  createInput, createCanvas, createScreen, createCamera, createPanel,
};

})();