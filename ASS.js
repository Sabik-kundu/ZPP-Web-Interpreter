(function () {
  'use strict';

  // ── Colour palette ────────────────────────────────────────────────────────
  const C = {
    keyword:      '#c792ea',   // purple   — if else for while func ...
    type:         '#90e0ef',   // blue     — num str bool let array struct set enum
    builtin:      '#89ddff',   // cyan     — print len push ...
    mlFunc:       '#f07178',   // coral    — LinearRegression KMeans ...
    userFunc:     '#80cbc4',   // teal     — user-defined functions
    userStruct:   '#ffcb6b',   // amber    — user-defined struct names
    userVariable: '#89f2dd',   // mint     — user-declared variables (incl. struct instances)
    structField:  '#e0a8ff',   // lavender — fields declared inside structs
    string:       '#c3e88d',   // green    — "text"
    number:       '#f78c6c',   // orange   — 42  3.14  0xFF
    comment:      '#546e7a',   // slate    — // and /* */
    operator:     '#89ddff',   // cyan     — + - * / == != ++ -- << ...
    dot:          '#d4d4d4',   // plain    — . , ; :
    importDir:    '#ffcb6b',   // yellow   — #import
    importStr:    '#c3e88d',   // green    — the path after #import
    plain:        '#d4d4d4',   // default text
    bool:         '#46cbd7',   // teal     — true false null
    selfKw:       '#f07178',   // coral    — self
  };

  // Bracket depth colour cycle — 4 levels then repeats
  const BRACKET_COLORS = [
    '#89ddff',   // depth 0 — cyan
    '#c792ea',   // depth 1 — purple
    '#c3e88d',   // depth 2 — green
    '#ffcb6b',   // depth 3 — amber
  ];

  // ── Token sets (complete per manual v6.0) ────────────────────────────────
  const KEYWORDS = new Set([
    'if','else','for','while','return','break','continue',
    'in','to','step','func','fn','when','then',
    'attempt','rescue','raise',          // try/catch/throw
    'repeat','until',                    // do-while style
    'each',                              // for each
    'is',                                // type check operator
    'match','on',                        // switch/pattern
    'enum',                              // enum keyword (control flow use)
  ]);

  const TYPES = new Set(['num','str','bool','let','array','struct','set','enum', 'view']);

  const BOOL  = new Set(['true','false','null']);
  const SELF  = new Set(['self']);

  const BUILTINS = new Set([
    // I/O
    'print','input',
    // type conversion
    'toNum','toStr','toBool',
    // type checks
    'isNum','isStr','isBool','isArr','isNull','isStruct','typeOf',
    // math core
    'abs','ceil','floor','round','sqrt','pow','log','log2','log10',
    'sin','cos','tan','asin','acos','atan','atan2','hypot',
    'max','min','random','randomInt','calculate',
    // array
    'range','fill','sum','avg','unique','copy','flat',
    'concat','push','pop','shift','unshift','splice','reverse',
    'keys','values','has',
    // array functional
    'map','filter','find','every','some','flatMap','reduce','sortBy','count',
    // sort
    'sort','sortDesc','sortStr',
    'bubbleSort','selectionSort','insertionSort',
    'mergeSort','quickSort','heapSort','countingSort',
    // search
    'linearSearch','binarySearch','search',
    // string
    'len','upper','lower','trim','split','join','slice','substr',
    'indexOf','includes','replace','startsWith','endsWith','repeat',
    'padLeft','padRight','charCode','fromChar','format',
    // json
    'toJSON','fromJSON',
    // math.zl
    'degrees','radians','sinD','cosD','tanD','truncate','sign',
    'clamp','lerp',
    'factorial','isPrime','gcd','lcm','fibonacci','fibSequence','primes',
    'combination','permutation','distance2D','distance3D',
    'median','mode','variance','stddev','matMul','matTranspose',
    // time.zl
    'now','year','month','day','hour','minute','second','millisecond',
    'dayOfWeek','monthName','dateStr','timeStr','timestamp','dateTimeStr',
    'formatTime','msToSeconds','msToMinutes','msToHours','formatDuration',
    'timerStart','timerEnd','timerElapsed','unixNow','fromUnix','daysBetween',
    'startClock','stopClock',
    // net.zl
    'fetchText','fetchLines','fetchJSON','fetchCSV','fetchTable',
    'jsonGet','jsonKeys','jsonToArray',
    // convert.zl
    'cToF','fToC','cToK','kToC',
    'kmToMiles','milesToKm','mToFt','ftToM',
    'mToInches','cmToInches','inchesToCm',
    'kgToLbs','lbsToKg','gToOz','ozToG',
    'kmhToMph','mphToKmh','msToKmh','kmhToMs',
    'bytesToKB','bytesToMB','bytesToGB','kbToBytes','mbToBytes','gbToBytes','formatBytes',
    // random.zl
    'setSeed','randSeed','randInt','randFloat','randBool',
    'coinFlip','dice','pick','shuffle','sample','gaussianRandom','uuid',
    // str.zl
    'countOccurrences','isPalindrome','titleCase','camelCase','snakeCase','capitalize',
    'wordWrap','countWords','countLines','reverseStr','reverseWords',
    'isNumStr','isEmailStr','isURLStr','lpad','rpad','center',
    'escapeHtml','stripHtml','countChar','template',
    // algo.zl
    'makeStack','makeQueue','makeMinPQ','makeNode','makeLinkedList','makeGraph',
  ]);

  const ML_BUILTINS = new Set([
    // preprocessing
    'normalize','standardize','trainTestSplit','oneHotEncode','labelEncode','polyFeatures',
    // metrics
    'accuracy','mse','rmse','mae','r2score','confusionMatrix',
    'precision','recall','f1score','classReport',
    // models
    'LinearRegression','RidgeRegression','LassoRegression',
    'LogisticRegression','SoftmaxRegression',
    'KNNClassifier','KNNRegressor',
    'GaussianNB',
    'DecisionTree','RandomForest',
    'LinearSVM',
    'KMeans','DBSCAN',
    'MLP','PCA',
    'AdaBoost','GradientBoosting',
    // datasets
    'loadIris','loadHousing','loadXOR','loadMoons',
    'loadCircles','loadSpam','loadHousePrice','loadSentiment',
    // pretrained
    'xorSolver','irisClassifier','housingPredictor',
    'sentimentClassifier','spamFilter',
    // tools
    'crossValScore','gridSearch','silhouetteScore',
    'modelSummary','pipeline','featureImportance',
    'saveModel','loadModel',
  ]);

  // Two-character operator table (longest-match)
  const TWO_OPS = new Set([
    '==','!=','<=','>=',
    '+=','-=','*=','/=','%=',
    '++','--',
    '&&','||',
    '<<','>>',
    '=>',
  ]);

  // ── Highlighter ──────────────────────────────────────────────────────────
  function highlight(raw) {
    const span = (color, text) => `<span style="color:${color}">${text}</span>`;
    const esc  = s => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // ── Pre-scan pass: collect user-defined names ─────────────────────────
    const userFuncs    = new Set();
    const userStructs  = new Set();
    const userVariable = new Set();
    const structFields = new Set();

    // Guard: never classify a reserved word as a user-defined name
    const isReserved = w =>
      KEYWORDS.has(w) || TYPES.has(w) || BOOL.has(w) ||
      SELF.has(w) || BUILTINS.has(w) || ML_BUILTINS.has(w);

    // Named functions/structs:  func foo   fn bar   struct Node
    const defRe = /\b(func|fn|struct)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let m;
    while ((m = defRe.exec(raw)) !== null) {
      if (!isReserved(m[2])) {
        if (m[1] === 'func' || m[1] === 'fn') userFuncs.add(m[2]);
        if (m[1] === 'struct')                userStructs.add(m[2]);
      }
    }

    // Multi-variable declarations:  num a, b, c;   let x, y = 1, 2;
    const multiVarRe = /\b(num|str|bool|let|array|set|view)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)/g;
    while ((m = multiVarRe.exec(raw)) !== null) {
      m[2].split(',').forEach(v => {
        const name = v.trim().split(/\s+/)[0];
        if (name && !isReserved(name)) userVariable.add(name);
      });
    }

    // Struct field declarations inside { ... }  (skip method bodies by matching to ';')
    // Use a smarter body extractor that respects nested braces
    const extractStructBody = (src, startIdx) => {
      let depth = 0, j = startIdx;
      while (j < src.length) {
        if (src[j] === '{') { depth++; }
        else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(startIdx + 1, j); }
        j++;
      }
      return '';
    };
    const structHeaderRe = /\bstruct\s+[a-zA-Z_][a-zA-Z0-9_]*\s*(\{)/g;
    while ((m = structHeaderRe.exec(raw)) !== null) {
      const body = extractStructBody(raw, m.index + m[0].length - 1);
      // Fields: "TypeName fieldName;" — capture only fieldName (group 1)
      const fieldRe = /\b(?:num|str|bool|array|let|view)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[;=,]/g;
      let fm;
      while ((fm = fieldRe.exec(body)) !== null) {
        if (!isReserved(fm[1])) structFields.add(fm[1]);
      }
      // Methods inside struct
      const fnInStruct = /\bfn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      while ((fm = fnInStruct.exec(body)) !== null) {
        if (!isReserved(fm[1])) userFuncs.add(fm[1]);
      }
    }

    // Struct instance declarations:  Node newNode   Node newNode = ...
    // After collecting struct names, scan for StructName identifier patterns
    userStructs.forEach(sName => {
      const instRe = new RegExp(`\\b${sName}\\s+([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
      while ((m = instRe.exec(raw)) !== null) {
        if (!isReserved(m[1])) userVariable.add(m[1]);
      }
    });

    // ── Main tokenizer ────────────────────────────────────────────────────
    let out          = '';
    let i            = 0;
    let bracketDepth = 0;   // drives bracket colour hierarchy

    while (i < raw.length) {
      const c = raw[i];

      // Block comment /* ... */
      if (c === '/' && raw[i+1] === '*') {
        let j = i + 2;
        while (j < raw.length && !(raw[j] === '*' && raw[j+1] === '/')) j++;
        j += 2;
        out += span(C.comment, esc(raw.slice(i, j)));
        i = j; continue;
      }

      // Line comment // ...
      if (c === '/' && raw[i+1] === '/') {
        let j = i;
        while (j < raw.length && raw[j] !== '\n') j++;
        out += span(C.comment, esc(raw.slice(i, j)));
        i = j; continue;
      }

      // #import directive
      if (c === '#' && raw.slice(i, i+7) === '#import') {
        const lineEnd = raw.indexOf('\n', i + 7);
        const rest = lineEnd === -1 ? raw.slice(i + 7) : raw.slice(i + 7, lineEnd);
        out += span(C.importDir, '#import');
        out += span(C.importStr, esc(rest));
        i = lineEnd === -1 ? raw.length : lineEnd;
        continue;
      }

      // String literal " or '
      if (c === '"' || c === "'") {
        const q = c; let j = i + 1; let str = q;
        while (j < raw.length) {
          if (raw[j] === '\\') { str += raw[j] + (raw[j+1] || ''); j += 2; continue; }
          str += raw[j];
          if (raw[j] === q) { j++; break; }
          j++;
        }
        out += span(C.string, esc(str));
        i = j; continue;
      }

      // Number: hex 0xFF or decimal 3.14
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(raw[i+1] || ''))) {
        let j = i;
        if (c === '0' && (raw[i+1] === 'x' || raw[i+1] === 'X')) {
          j += 2;
          while (j < raw.length && /[0-9a-fA-F]/.test(raw[j])) j++;
        } else {
          while (j < raw.length && /[0-9.]/.test(raw[j])) j++;
        }
        out += span(C.number, esc(raw.slice(i, j)));
        i = j; continue;
      }

      // Identifier / keyword / name
      if (/[a-zA-Z_]/.test(c)) {
        let j = i;
        while (j < raw.length && /[a-zA-Z0-9_]/.test(raw[j])) j++;
        const word = raw.slice(i, j);

        let color = C.plain;
        if      (KEYWORDS.has(word))       color = C.keyword;
        else if (TYPES.has(word))          color = C.type;
        else if (SELF.has(word))           color = C.selfKw;
        else if (BOOL.has(word))           color = C.bool;
        else if (ML_BUILTINS.has(word))    color = C.mlFunc;
        else if (BUILTINS.has(word))       color = C.builtin;
        else if (userStructs.has(word))    color = C.userStruct;
        else if (userFuncs.has(word))      color = C.userFunc;
        else if (structFields.has(word))   color = C.structField;
        else if (userVariable.has(word))   color = C.userVariable;

        out += span(color, esc(word));
        i = j; continue;
      }

      // Operators (longest-match two-char first)
      if ('+-*/%=!<>&|^~'.includes(c)) {
        const two = raw.slice(i, i+2);
        if (TWO_OPS.has(two)) {
          out += span(C.operator, esc(two));
          i += 2;
        } else {
          out += span(C.operator, esc(c));
          i += 1;
        }
        continue;
      }

      // Brackets with depth-based colour hierarchy
      if ('([{'.includes(c)) {
        out += span(BRACKET_COLORS[bracketDepth % 4], esc(c));
        bracketDepth++;
        i++; continue;
      }
      if (')]}'.includes(c)) {
        bracketDepth = Math.max(0, bracketDepth - 1);
        out += span(BRACKET_COLORS[bracketDepth % 4], esc(c));
        i++; continue;
      }

      // Other punctuation (dots, commas, semicolons, colons) — muted
      if ('.,;:'.includes(c)) {
        out += span(C.dot, esc(c));
        i++; continue;
      }

      // Whitespace
      if (c === '\n') { out += '\n'; i++; continue; }
      if (c === ' ')  { out += ' ';  i++; continue; }
      if (c === '\t') { out += '  '; i++; continue; }

      out += esc(c); i++;
    }

    return out + '\n';
  }

  // ── Editor bootstrap ─────────────────────────────────────────────────────
  function init() {
    const textarea = document.getElementById('editor');
    if (!textarea) return;

    const container = textarea.parentElement;

    const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace";
    const FONT_SIZE   = '14px';
    const LINE_HEIGHT = '1.6';
    const PADDING     = '12px 12px 12px 56px';
    const GUTTER_W    = '44px';
    const BG          = '#1e1e1e';

    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.background = BG;

    // ── Gutter (line numbers) ─────────────────────────────────────────────
    const gutter = document.createElement('div');
    Object.assign(gutter.style, {
      position:      'absolute',
      top:           '0',
      left:          '0',
      width:         GUTTER_W,
      height:        '100%',
      background:    '#252526',
      borderRight:   '1px solid #333',
      fontFamily:    FONT_FAMILY,
      fontSize:      FONT_SIZE,
      lineHeight:    LINE_HEIGHT,
      color:         '#5a6a72',
      textAlign:     'right',
      padding:       '12px 6px 12px 0',
      boxSizing:     'border-box',
      userSelect:    'none',
      overflowY:     'hidden',
      whiteSpace:    'pre',
      pointerEvents: 'none',
      zIndex:        '1',
    });
    container.appendChild(gutter);

    // ── Highlight overlay ─────────────────────────────────────────────────
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:      'absolute',
      top:           '0',
      left:          '0',
      right:         '0',
      bottom:        '0',
      fontFamily:    FONT_FAMILY,
      fontSize:      FONT_SIZE,
      lineHeight:    LINE_HEIGHT,
      padding:       PADDING,
      boxSizing:     'border-box',
      whiteSpace:    'pre',
      overflowX:     'auto',
      overflowY:     'auto',
      pointerEvents: 'none',
      zIndex:        '2',
      color:         C.plain,
      wordBreak:     'break-all',
    });
    container.appendChild(overlay);

    // ── Textarea (invisible, captures all input) ──────────────────────────
    Object.assign(textarea.style, {
      position:       'absolute',
      top:            '0',
      left:           '0',
      right:          '0',
      bottom:         '0',
      width:          '100%',
      height:         '100%',
      fontFamily:     FONT_FAMILY,
      fontSize:       FONT_SIZE,
      lineHeight:     LINE_HEIGHT,
      padding:        PADDING,
      boxSizing:      'border-box',
      background:     'transparent',
      color:          'transparent',
      caretColor:     '#fff',
      border:         'none',
      outline:        'none',
      resize:         'none',
      whiteSpace:     'pre',
      overflowX:      'auto',
      overflowY:      'auto',
      zIndex:         '3',
      spellcheck:     'false',
      autocorrect:    'off',
      autocapitalize: 'off',
    });

    // ── Active-line highlight strip ───────────────────────────────────────
    const activeLine = document.createElement('div');
    Object.assign(activeLine.style, {
      position:      'absolute',
      left:          '0',
      right:         '0',
      height:        '0',
      background:    'rgba(255, 255, 255, 0.05)',   // very soft white
      borderLeft:    '2px solid rgba(255, 255, 255, 0.15)',
      pointerEvents: 'none',
      zIndex:        '1',
      transition:    'top 0.04s',
    });
    container.appendChild(activeLine);

    // ── Sync function (highlight + scroll + gutter + active line) ─────────
    let rafPending = false;
    function syncAll() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const val   = textarea.value;
        const lines = val.split('\n');

        // Re-highlight
        overlay.innerHTML = highlight(val);

        // Sync scroll
        overlay.scrollTop  = textarea.scrollTop;
        overlay.scrollLeft = textarea.scrollLeft;
        gutter.scrollTop   = textarea.scrollTop;

        // Line numbers
        gutter.textContent = lines.map((_, idx) => idx + 1).join('\n');

        // Active-line highlight
        const pos      = textarea.selectionStart;
        const curLine  = val.slice(0, pos).split('\n').length - 1;
        const lineH    = parseFloat(FONT_SIZE) * parseFloat(LINE_HEIGHT);
        const padTop   = 12;
        activeLine.style.top    = (padTop + curLine * lineH) + 'px';
        activeLine.style.height = lineH + 'px';
      });
    }

    // ── Key handling ──────────────────────────────────────────────────────
    textarea.addEventListener('keydown', e => {
      const { key, shiftKey, ctrlKey, metaKey } = e;
      const sel  = textarea.selectionStart;
      const selE = textarea.selectionEnd;
      const val  = textarea.value;

      const insertAt = (newVal, cursor) => {
        e.preventDefault();
        textarea.value = newVal;
        textarea.setSelectionRange(cursor, cursor);
        syncAll();
      };

      // ── Tab / Shift+Tab ───────────────────────────────────────────────
      if (key === 'Tab') {
        e.preventDefault();
        if (shiftKey) {
          const lineStart = val.lastIndexOf('\n', sel - 1) + 1;
          const before    = val.slice(lineStart, sel);
          const remove    = before.match(/^ {1,2}/) ? before.match(/^ {1,2}/)[0].length : 0;
          if (remove > 0) {
            textarea.value = val.slice(0, lineStart) + val.slice(lineStart + remove);
            textarea.setSelectionRange(sel - remove, sel - remove);
            syncAll();
          }
        } else {
          const newVal = val.slice(0, sel) + '  ' + val.slice(selE);
          textarea.value = newVal;
          textarea.setSelectionRange(sel + 2, sel + 2);
          syncAll();
        }
        return;
      }

      // ── Ctrl/Cmd + / → toggle line comment ───────────────────────────
      if ((ctrlKey || metaKey) && key === '/') {
        e.preventDefault();
        const lineStart = val.lastIndexOf('\n', sel - 1) + 1;
        const lineEnd   = val.indexOf('\n', sel);
        const line      = val.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
        let newLine, delta;
        if (line.trimStart().startsWith('//')) {
          newLine = line.replace(/^(\s*)\/\/\s?/, '$1');
          delta   = -(line.length - newLine.length);
        } else {
          const indent = line.match(/^\s*/)[0];
          newLine = indent + '// ' + line.slice(indent.length);
          delta   = 3;
        }
        textarea.value = val.slice(0, lineStart) + newLine +
          (lineEnd === -1 ? '' : val.slice(lineEnd));
        textarea.setSelectionRange(sel + delta, sel + delta);
        syncAll();
        return;
      }

      // ── Enter — smart indent + brace expansion ────────────────────────
      if (key === 'Enter') {
        e.preventDefault();
        const lineStart   = val.lastIndexOf('\n', sel - 1) + 1;
        const currentLine = val.slice(lineStart, sel);
        const indent      = currentLine.match(/^\s*/)[0];
        const trimmed     = currentLine.trimEnd();
        const afterCursor = val[selE]; // character immediately after cursor

        if (trimmed.endsWith('{') && afterCursor === '}') {
          // Cursor is between { } — expand to three lines
          //   {
          //     |cursor
          //   }
          const inner  = '\n' + indent + '  ';
          const closing = '\n' + indent;
          const newVal  = val.slice(0, sel) + inner + closing + val.slice(selE);
          textarea.value = newVal;
          textarea.setSelectionRange(sel + inner.length, sel + inner.length);
        } else {
          // Normal enter — preserve indent, add extra if line ends with {
          const extra  = trimmed.endsWith('{') ? '  ' : '';
          const ins    = '\n' + indent + extra;
          const newVal = val.slice(0, sel) + ins + val.slice(selE);
          textarea.value = newVal;
          textarea.setSelectionRange(sel + ins.length, sel + ins.length);
        }
        syncAll();
        return;
      }

      // ── Auto-pair brackets / quotes ───────────────────────────────────
      const PAIRS = { '(':')', '[':']', '{':'}', '"':'"', "'":"'" };
      const CLOSE = new Set([')', ']', '}']);

      if (PAIRS[key]) {
        const close    = PAIRS[key];
        const selected = val.slice(sel, selE);
        e.preventDefault();
        if (selected.length > 0) {
          // Wrap selection
          const newVal = val.slice(0, sel) + key + selected + close + val.slice(selE);
          textarea.value = newVal;
          textarea.setSelectionRange(sel + 1, selE + 1);
        } else if (key === close && val[sel] === close) {
          // Skip over existing close
          textarea.setSelectionRange(sel + 1, sel + 1);
        } else {
          const newVal = val.slice(0, sel) + key + close + val.slice(selE);
          textarea.value = newVal;
          textarea.setSelectionRange(sel + 1, sel + 1);
        }
        syncAll();
        return;
      }

      if (CLOSE.has(key) && val[sel] === key) {
        e.preventDefault();
        textarea.setSelectionRange(sel + 1, sel + 1);
        return;
      }

      // ── Backspace — delete matching pair ─────────────────────────────
      if (key === 'Backspace' && sel === selE && sel > 0) {
        const before = val[sel - 1];
        const after  = val[sel];
        const PAIR_BACK = { '(':')', '[':']', '{':'}', '"':'"', "'":"'" };
        if (PAIR_BACK[before] && PAIR_BACK[before] === after) {
          e.preventDefault();
          const newVal = val.slice(0, sel - 1) + val.slice(sel + 1);
          textarea.value = newVal;
          textarea.setSelectionRange(sel - 1, sel - 1);
          syncAll();
          return;
        }
      }
    });

    textarea.addEventListener('input',  syncAll);
    textarea.addEventListener('scroll', syncAll);
    textarea.addEventListener('click',  syncAll);
    textarea.addEventListener('keyup',  syncAll);
    textarea.addEventListener('select', syncAll);

    syncAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();