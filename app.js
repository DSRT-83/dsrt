/* app.js - Workspace SwapFace (Single & Multi 2..7)
   Features:
   - load templates.json (Single & Multi)
   - categories + template grid
   - upload multiple faces (thumbnails)
   - auto-suggest template by face count
   - drag thumbnails to slot (drop zone)
   - create face-layer elements (draggable/resizable/rotatable)
   - flatten canvas & download result
*/

const faceUpload = document.getElementById('faceUpload');
const faceList = document.getElementById('faceList');
const categoriesDiv = document.getElementById('categories');
const templateGrid = document.getElementById('templateGrid');
const canvasArea = document.getElementById('canvasArea');
const mainCanvas = document.getElementById('mainCanvas');
const resultGrid = document.getElementById('resultGrid');
const suggestMsg = document.getElementById('suggestMsg');
const btnFlattenDownload = document.getElementById('btnFlattenDownload');
const btnClearLayers = document.getElementById('btnClearLayers');
const btnRandom = document.getElementById('btnRandom');

const ctx = mainCanvas.getContext('2d');

let templatesByCategory = [];
let currentCategoryIndex = 0;
let activeTemplate = null;
let userThumbs = []; // Image objects thumbnails
let userFiles = [];  // File objects
let faceLayers = []; // DOM elements for layers

// canvas sizing
function setCanvasSize(){
  const width = Math.min(760, Math.max(420, canvasArea.clientWidth - 24));
  const ratio = 700/400; // template base aspect in templates JSON coordinate system (approx)
  const height = Math.floor(width / (700/400)); // use 700x400 base mapping roughly
  const dpr = window.devicePixelRatio || 1;
  mainCanvas.style.width = width + 'px';
  mainCanvas.style.height = height + 'px';
  mainCanvas.width = Math.floor(width * dpr);
  mainCanvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
setCanvasSize();
window.addEventListener('resize', () => { setCanvasSize(); if(activeTemplate) redrawCanvasFromLayers(); });

// load templates
fetch('templates.json').then(r=>r.json()).then(data=>{
  templatesByCategory = data;
  renderCategories();
  renderTemplateCards();
  randomPreview(); // random at start
}).catch(err => {
  console.error('templates.json gagal dimuat', err);
  templateGrid.innerHTML = '<p class="placeholder">templates.json error</p>';
});

// categories
function renderCategories(){
  categoriesDiv.innerHTML = '';
  templatesByCategory.forEach((cat, idx) => {
    const btn = document.createElement('button');
    btn.textContent = cat.category;
    if(idx === currentCategoryIndex) btn.classList.add('active');
    btn.onclick = () => { currentCategoryIndex = idx; renderCategories(); renderTemplateCards(); }
    categoriesDiv.appendChild(btn);
  });
}

// templates grid
function renderTemplateCards(){
  templateGrid.innerHTML = '';
  const cat = templatesByCategory[currentCategoryIndex];
  if(!cat || !cat.templates || !cat.templates.length){
    templateGrid.innerHTML = '<p class="placeholder">Tidak ada template</p>'; return;
  }
  cat.templates.forEach((tpl, idx) => {
    const card = document.createElement('div'); card.className='template-card';
    card.innerHTML = `<img src="templates/${tpl.file}" alt="${tpl.name}" /><p>${tpl.name}</p>`;
    const btns = document.createElement('div'); btns.style.display='flex'; btns.style.gap='8px'; btns.style.justifyContent='center';
    const useBtn = document.createElement('button'); useBtn.className='btn small'; useBtn.textContent='Gunakan';
    useBtn.onclick = () => applyTemplateObject(tpl);
    const dlBtn = document.createElement('button'); dlBtn.className='btn small'; dlBtn.textContent='Download';
    dlBtn.onclick = () => { const a = document.createElement('a'); a.href=`templates/${tpl.file}`; a.download = tpl.file; a.click(); }
    btns.appendChild(useBtn); btns.appendChild(dlBtn);
    card.appendChild(btns);
    templateGrid.appendChild(card);
  });
}

// random preview
function randomPreview(){
  const all = templatesByCategory.flatMap(c=>c.templates);
  if(all.length===0) return;
  const r = all[Math.floor(Math.random()*all.length)];
  // set category to that template's category
  templatesByCategory.forEach((c, i)=>{ if(c.templates.find(t=>t.file===r.file)) currentCategoryIndex = i; });
  renderCategories(); renderTemplateCards();
  applyTemplateObject(r);
}

// upload thumbnails
faceUpload.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  if(!files.length) return;
  userFiles = files.slice();
  userThumbs = [];
  faceList.innerHTML = '';
  files.forEach((f, idx) => {
    const url = URL.createObjectURL(f);
    const img = new Image(); img.src = url;
    img.onload = ()=> userThumbs[idx] = img;
    const thumb = document.createElement('div'); thumb.className='face-thumb'; thumb.draggable=true; thumb.dataset.index=idx;
    thumb.innerHTML = `<img src="${url}" alt="thumb">`;
    thumb.addEventListener('dragstart', ev => ev.dataTransfer.setData('text/plain', idx));
    faceList.appendChild(thumb);
  });

  // auto-suggest based on count
  setTimeout(()=>autoSuggestTemplate(files.length), 200);
});

// auto-suggest
function autoSuggestTemplate(count){
  if(!templatesByCategory.length) return;
  // find templates with slots >= count and minimal >= (prefer equal)
  const possible = templatesByCategory.flatMap(c=>c.templates.filter(t=>t.slots.length >= count));
  if(possible.length===0){
    suggestMsg.textContent = `⚠️ Tidak ada template yang cocok untuk ${count} wajah. Silakan pilih manual.`;
    return;
  }
  // prefer exact slot count if possible
  let exact = possible.filter(t=>t.slots.length === count);
  const chosen = (exact.length? exact : possible)[Math.floor(Math.random()* (exact.length? exact.length : possible.length))];
  // activate category
  templatesByCategory.forEach((c,i)=>{ if(c.templates.find(t=>t.file===chosen.file)) currentCategoryIndex = i; });
  renderCategories(); renderTemplateCards();
  suggestMsg.textContent = `✨ Sistem memilih template otomatis: ${chosen.name}`;
  applyTemplateObject(chosen);
}

// apply template object - create dropzones & layers
function applyTemplateObject(tpl){
  clearLayers();
  activeTemplate = tpl;

  // draw template as base on canvas
  const img = new Image(); img.src = `templates/${tpl.file}`;
  img.onload = () => {
    // draw base to canvas at displayed size
    const displayW = parseInt(mainCanvas.style.width);
    const displayH = parseInt(mainCanvas.style.height);
    ctx.clearRect(0,0,displayW,displayH);
    ctx.drawImage(img, 0, 0, displayW, displayH);

    // create slot dropzones and initial layers
    tpl.slots.forEach((slot, slotIndex) => {
      const dz = document.createElement('div'); dz.className='drop-zone';
      dz.style.left = slot.x + 'px'; dz.style.top = slot.y + 'px'; dz.style.width = slot.w + 'px'; dz.style.height = slot.h + 'px';
      canvasArea.appendChild(dz);

      const layer = document.createElement('div'); layer.className='face-layer';
      layer.style.left = slot.x + 'px'; layer.style.top = slot.y + 'px'; layer.style.width = slot.w + 'px'; layer.style.height = slot.h + 'px';
      layer.dataset.slotIndex = slotIndex;

      const imgEl = document.createElement('img'); layer.appendChild(imgEl);
      const resizeHandle = document.createElement('div'); resizeHandle.className='resize-handle'; layer.appendChild(resizeHandle);
      const rotateHandle = document.createElement('div'); rotateHandle.className='rotate-handle'; layer.appendChild(rotateHandle);

      // drop to assign face
      layer.addEventListener('dragover', ev => ev.preventDefault());
      layer.addEventListener('drop', ev => {
        ev.preventDefault();
        const idx = parseInt(ev.dataTransfer.getData('text/plain'), 10);
        if(!isNaN(idx) && userThumbs[idx]) {
          imgEl.src = userThumbs[idx].src; layer.dataset.faceIndex = idx;
          redrawCanvasFromLayers();
        }
      });

      // if userThumbs present, auto assign by order
      canvasArea.appendChild(layer);
      faceLayers.push(layer);
      makeLayerDraggable(layer);
      makeLayerResizable(layer, resizeHandle);
      makeLayerRotatable(layer, rotateHandle);
    });

    // auto assign first N faces
    for(let i=0;i<faceLayers.length && i<userThumbs.length;i++){
      const L = faceLayers[i]; const imgEl = L.querySelector('img'); imgEl.src = userThumbs[i].src; L.dataset.faceIndex = i;
    }
    redrawCanvasFromLayers();
  };
}

// redraw canvas (base template + layers)
function redrawCanvasFromLayers(){
  if(!activeTemplate) return;
  const tplImg = new Image(); tplImg.src = `templates/${activeTemplate.file}`;
  tplImg.onload = () => {
    const displayW = parseInt(mainCanvas.style.width);
    const displayH = parseInt(mainCanvas.style.height);
    ctx.clearRect(0,0,displayW,displayH);
    ctx.drawImage(tplImg, 0, 0, displayW, displayH);

    faceLayers.forEach(layer => {
      const imgEl = layer.querySelector('img');
      if(!imgEl || !imgEl.src) return;
      const canvasRect = canvasArea.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      const x = layerRect.left - canvasRect.left;
      const y = layerRect.top - canvasRect.top;
      const w = layerRect.width;
      const h = layerRect.height;

      // rotation parsing
      const transform = layer.style.transform || '';
      const rotateMatch = transform.match(/rotate\(([-\d.]+)rad\)/);
      const angle = rotateMatch ? parseFloat(rotateMatch[1]) : 0;

      ctx.save();
      ctx.translate(x + w/2, y + h/2);
      ctx.rotate(angle);
      ctx.drawImage(imgEl, -w/2, -h/2, w, h);
      ctx.restore();
    });
  };
}

// clear layers & dropzones
function clearLayers(){
  document.querySelectorAll('.drop-zone').forEach(e=>e.remove());
  document.querySelectorAll('.face-layer').forEach(e=>e.remove());
  faceLayers = []; activeTemplate=null;
  resultGrid.innerHTML = `<p class="placeholder">Belum ada hasil yang di-flatten.</p>`;
  ctx.clearRect(0,0, mainCanvas.width, mainCanvas.height);
  suggestMsg.textContent = '';
}

// drag/move layer
function makeLayerDraggable(el){
  let startX, startY, initLeft, initTop;
  el.addEventListener('mousedown', (ev) => {
    if(ev.target.classList.contains('resize-handle')||ev.target.classList.contains('rotate-handle')) return;
    ev.preventDefault();
    startX = ev.clientX; startY = ev.clientY;
    const rect = el.getBoundingClientRect(); const areaRect = canvasArea.getBoundingClientRect();
    initLeft = rect.left - areaRect.left; initTop = rect.top - areaRect.top;
    function move(e){
      el.style.left = (initLeft + (e.clientX - startX)) + 'px';
      el.style.top = (initTop + (e.clientY - startY)) + 'px';
      redrawCanvasFromLayers();
    }
    function up(){ document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
  // touch
  el.addEventListener('touchstart', (ev)=>{
    const t = ev.touches[0]; if(ev.target.classList.contains('resize-handle')||ev.target.classList.contains('rotate-handle')) return;
    let startTx = t.clientX, startTy = t.clientY;
    const rect = el.getBoundingClientRect(); const areaRect = canvasArea.getBoundingClientRect();
    const initL = rect.left - areaRect.left, initT = rect.top - areaRect.top;
    function move(e){
      const t2 = e.touches[0];
      el.style.left = (initL + (t2.clientX - startTx)) + 'px';
      el.style.top = (initT + (t2.clientY - startTy)) + 'px';
      redrawCanvasFromLayers();
    }
    function end(){ document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); }
    document.addEventListener('touchmove', move); document.addEventListener('touchend', end);
  });
}

// resize
function makeLayerResizable(el, handle){
  handle.addEventListener('mousedown', (ev)=>{
    ev.stopPropagation(); ev.preventDefault();
    const rect = el.getBoundingClientRect(); const startW = rect.width, startH = rect.height;
    const startX = ev.clientX, startY = ev.clientY;
    function move(e){ el.style.width = Math.max(20, startW + (e.clientX - startX)) + 'px'; el.style.height = Math.max(20, startH + (e.clientY - startY)) + 'px'; redrawCanvasFromLayers(); }
    function up(){ document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
  handle.addEventListener('touchstart', (ev)=>{
    ev.stopPropagation(); ev.preventDefault();
    const t = ev.touches[0]; const rect = el.getBoundingClientRect(); const startW = rect.width, startH = rect.height;
    const startX = t.clientX, startY = t.clientY;
    function move(e){ const t2=e.touches[0]; el.style.width = Math.max(20, startW + (t2.clientX - startX)) + 'px'; el.style.height = Math.max(20, startH + (t2.clientY - startY)) + 'px'; redrawCanvasFromLayers(); }
    function end(){ document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); }
    document.addEventListener('touchmove', move); document.addEventListener('touchend', end);
  });
}

// rotate
function makeLayerRotatable(el, handle){
  handle.addEventListener('mousedown', (ev)=>{
    ev.stopPropagation(); ev.preventDefault();
    const rect = el.getBoundingClientRect(); const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    function move(e){ const angle = Math.atan2(e.clientY - cy, e.clientX - cx); el.style.transform = `rotate(${angle}rad)`; redrawCanvasFromLayers(); }
    function up(){ document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
  handle.addEventListener('touchstart', (ev)=>{
    ev.stopPropagation(); ev.preventDefault();
    const rect = el.getBoundingClientRect(); const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    function move(e){ const t2=e.touches[0]; const angle = Math.atan2(t2.clientY - cy, t2.clientX - cx); el.style.transform = `rotate(${angle}rad)`; redrawCanvasFromLayers(); }
    function end(){ document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); }
    document.addEventListener('touchmove', move); document.addEventListener('touchend', end);
  });
}

// flatten & download
function flattenAndDownload(){
  if(!activeTemplate){ alert('Pilih template dulu.'); return; }
  const w = parseInt(mainCanvas.style.width), h = parseInt(mainCanvas.style.height);
  const final = document.createElement('canvas'); final.width = w; final.height = h; const fctx = final.getContext('2d');
  const tplImg = new Image(); tplImg.src = `templates/${activeTemplate.file}`;
  tplImg.onload = () => {
    fctx.drawImage(tplImg, 0, 0, w, h);
    faceLayers.forEach(layer => {
      const imgEl = layer.querySelector('img'); if(!imgEl || !imgEl.src) return;
      const lRect = layer.getBoundingClientRect(), aRect = canvasArea.getBoundingClientRect();
      const x = lRect.left - aRect.left, y = lRect.top - aRect.top, lw = lRect.width, lh = lRect.height;
      const transform = layer.style.transform || ''; const match = transform.match(/rotate\(([-\d.]+)rad\)/); const angle = match? parseFloat(match[1]) : 0;
      fctx.save(); fctx.translate(x + lw/2, y + lh/2); fctx.rotate(angle); fctx.drawImage(imgEl, -lw/2, -lh/2, lw, lh); fctx.restore();
    });
    const link = document.createElement('a'); link.href = final.toDataURL('image/png'); link.download = `swapface_${Date.now()}.png`; link.click();
    // preview
    const thumbCard = document.createElement('div'); thumbCard.className='result-card';
    thumbCard.innerHTML = `<img src="${final.toDataURL()}" alt="result"/><a href="${final.toDataURL()}" download="swapface_${Date.now()}.png"><button class="btn small">Download</button></a>`;
    if(resultGrid.querySelector('.placeholder')) resultGrid.innerHTML = '';
    resultGrid.prepend(thumbCard);
  };
}

btnFlattenDownload?.addEventListener('click', flattenAndDownload);
btnClearLayers?.addEventListener('click', clearLayers);
btnRandom?.addEventListener('click', randomPreview);

// initial placeholder
resultGrid.innerHTML = `<p class="placeholder">Belum ada hasil yang di-flatten.</p>`;
