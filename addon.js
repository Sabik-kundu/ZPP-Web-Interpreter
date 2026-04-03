
const editor = document.getElementById('editor');
const output = document.getElementById('output');
const saveBtn = document.getElementById('saveBtn');
const newFileBtn = document.getElementById('newFileBtn');
const fileList = document.getElementById('fileList');
const currentFileNameDisplay = document.getElementById('currentFileName');
const unsavedIndicator = document.getElementById('unsavedIndicator');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const sidebar = document.getElementById('sidebar');
const resizer = document.getElementById('resizer');
const outputContainer = document.getElementById('outputContainer');
const lineHighlight = document.getElementById('lineHighlight');
const uploadBtn = document.getElementById('uploadBtn');
const downloadBtn = document.getElementById('downloadBtn');
const fileInput = document.getElementById('fileInput');
const editorContainer = document.getElementById('editorContainer');

let currentFileName = null;
const STORAGE_PREFIX = 'zeta_file_';
const LINE_HEIGHT = 22.4;        // matched to ass.js
const EDITOR_PADDING_TOP = 12;  // matched to ass.js padding

function init() {
  _syncVfsFromStorage();
  renderFileList();
  const files = getSavedFiles();
  if (files.length > 0) {
    loadFile(files[0]);
  } else {
    startNewFile();
  }

  // === HIDE WHITE LINE FROM ass.js (without changing ass.js) ===
  setTimeout(() => {
    const whiteLine = editorContainer.querySelector('div[style*="rgba(255,255,255,0.05)"]');
    if (whiteLine) whiteLine.style.display = 'none';
  }, 100);
  // ============================================================
}

function _syncVfsFromStorage() {
  if (typeof _vfs === 'undefined') return;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const filename = key.replace(STORAGE_PREFIX, '');
      _vfs[filename] = localStorage.getItem(key) || '';
    }
  }
}

saveBtn.addEventListener('click', saveCurrentFile);
newFileBtn.addEventListener('click', startNewFile);

editor.addEventListener('input', () => {
  unsavedIndicator.classList.remove('hidden');
  updateLineHighlight();
});

toggleSidebarBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
  isResizing = true;
  document.body.style.cursor = 'ns-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const containerHeight = document.body.clientHeight;
  const topbarHeight = 50;
  const minEditorHeight = 100;
  const minTerminalHeight = 40;

  let newTerminalHeight = containerHeight - e.clientY;
  if (newTerminalHeight < minTerminalHeight) newTerminalHeight = minTerminalHeight;
  if (containerHeight - newTerminalHeight - topbarHeight < minEditorHeight) {
    newTerminalHeight = containerHeight - topbarHeight - minEditorHeight;
  }

  outputContainer.style.height = `${newTerminalHeight}px`;
  updateLineHighlight();
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = 'default';
  }
});

function updateLineHighlight() {
  if (!editor || !lineHighlight) return;

  requestAnimationFrame(() => {
    const textUpToCursor = editor.value.substring(0, editor.selectionStart);
    const lineNumber = textUpToCursor.split('\n').length;

    let topOffset = (lineNumber - 1) * LINE_HEIGHT - editor.scrollTop + EDITOR_PADDING_TOP;
    if (topOffset < EDITOR_PADDING_TOP) topOffset = EDITOR_PADDING_TOP;

    lineHighlight.style.display = 'block';
    lineHighlight.style.top = `${topOffset}px`;
  });
}

['keyup', 'click', 'scroll', 'input'].forEach(evt => {
  editor.addEventListener(evt, updateLineHighlight);
});

window.addEventListener('resize', updateLineHighlight);

// ====================== REST OF YOUR CODE (unchanged) ======================
uploadBtn.addEventListener('click', () => { fileInput.click(); });

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target.result;
    let fileName = file.name;
    localStorage.setItem(STORAGE_PREFIX + fileName, content);
    if (typeof _vfs !== 'undefined') _vfs[fileName] = content;
    currentFileName = fileName;
    editor.value = content;
    currentFileNameDisplay.textContent = currentFileName;
    unsavedIndicator.classList.add('hidden');
    renderFileList();
    updateLineHighlight();
  };
  reader.readAsText(file);
  fileInput.value = '';
});

downloadBtn.addEventListener('click', () => {
  if (!currentFileName) return;
  const content = editor.value;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = currentFileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

function getSavedFiles() {
  const files = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) files.push(key.replace(STORAGE_PREFIX, ''));
  }
  return files.sort();
}

function renderFileList() {
  fileList.innerHTML = '';
  const files = getSavedFiles();
  files.forEach(fileName => {
    const li = document.createElement('li');
    li.className = `file-item ${fileName === currentFileName ? 'active' : ''}`;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = fileName;
    nameSpan.onclick = () => loadFile(fileName);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete File';
    deleteBtn.onclick = (e) => { e.stopPropagation(); deleteFile(fileName); };
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    fileList.appendChild(li);
  });
}

function saveCurrentFile() {
  if (!currentFileName) {
    let newName = prompt('Enter file name (e.g., helpers.zpp):');
    if (!newName) return;
    if (!newName.includes('.')) newName += '.zpp';
    currentFileName = newName;
  }
  const source = editor.value;
  localStorage.setItem(STORAGE_PREFIX + currentFileName, source);
  if (typeof _vfs !== 'undefined') _vfs[currentFileName] = source;
  currentFileNameDisplay.textContent = currentFileName;
  unsavedIndicator.classList.add('hidden');
  renderFileList();
}

function loadFile(fileName) {
  const content = localStorage.getItem(STORAGE_PREFIX + fileName);
  if (content !== null) {
    currentFileName = fileName;
    editor.value = content;
    currentFileNameDisplay.textContent = currentFileName;
    unsavedIndicator.classList.add('hidden');
    renderFileList();
    setTimeout(updateLineHighlight, 10);
    if (typeof _vfs !== 'undefined') _vfs[fileName] = content;
  }
}

function startNewFile() {
  currentFileName = null;
  editor.value = '';
  currentFileNameDisplay.textContent = 'untitled.zpp';
  unsavedIndicator.classList.add('hidden');
  renderFileList();
  editor.focus();
  updateLineHighlight();
}

function deleteFile(fileName) {
  if (confirm(`Delete ${fileName}?`)) {
    localStorage.removeItem(STORAGE_PREFIX + fileName);
    if (typeof _vfs !== 'undefined') delete _vfs[fileName];
    if (currentFileName === fileName) startNewFile();
    else renderFileList();
  }
}

init();
