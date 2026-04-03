// ============================================================
//  ZETA++ Interpreter  —  v6.0
//
//  New in v6 (unique ZETA++ syntax):
//    for each item in arr { }       — foreach loop
//    when cond then a else b        — ternary expression
//    attempt { } rescue e { }       — try / catch
//    raise expr                     — throw
//    match val { on x => { } }      — switch / pattern match
//    repeat { } until cond;         — do-while
//    fn(x) => expr                  — inline lambda
//    fn(x) { body }                 — block lambda
//    func f(x = default) { }        — default parameters
//    func f(...nums) { }            — variadic parameters
//    fn method() { } in struct      — struct methods (self bound)
//    x is num / x is MyStruct       — type-check operator
//    val in arr / "k" in obj        — membership operator
//    & | ^ ~ << >>                  — bitwise operators
//    hero.hp -= 10 / hero.hp++      — compound assign on fields
//    arr[i] += 5  / arr[i]++        — compound assign on indices
//    let [a, b] = arr;              — array destructuring
//    let {x, y} = obj;              — object/struct destructuring
//    arr.map(fn) .filter .reduce    — functional array methods
//    enum Color { RED GREEN BLUE }  — enumerations
//
//  All v5 / v4 features still present.
// ============================================================

'use strict';

const _fs   = (() => { try { return require('fs');   } catch { return null; } })();
const _proc = (typeof process !== 'undefined') ? process : null;

function _readLineNode(prompt) {
  if (_proc && _proc.stdout && prompt) _proc.stdout.write(prompt);
  if (!_fs) return '';
  const buf = Buffer.alloc(1);
  let out = ''; let fd = 0; let openedTty = false;
  try { fd = _fs.openSync('/dev/tty', 'r'); openedTty = true; } catch (_) {}
  try {
    while (true) {
      const n = _fs.readSync(fd, buf, 0, 1);
      if (n === 0) break;
      const c = buf.toString('utf8', 0, 1);
      if (c === '\n') break;
      if (c !== '\r') out += c;
    }
  } catch (e) { if (_proc) _proc.stderr.write('input() error: ' + e.message + '\n'); }
  if (openedTty) try { _fs.closeSync(fd); } catch (_) {}
  return out;
}

// ── Control-flow signals ─────────────────────────────────────
class ReturnSignal   { constructor(v) { this.value = v; } }
class BreakSignal    {}
class ContinueSignal {}
class ThrowSignal    { constructor(v) { this.value = v; } }

// ── Struct instance marker ────────────────────────────────────
class StructInstance {
  constructor(typeName, fields) {
    this.__type__ = typeName;
    Object.assign(this, fields);
  }
}

// ── Default file loader ───────────────────────────────────────
function _defaultFileLoader(filename) {
  if (typeof require !== 'undefined') {
    const fs = require('fs'), path = require('path');
    const runFile = process.argv[2] || '';
    const runDir  = runFile ? path.dirname(path.resolve(runFile)) : process.cwd();
    const candidates = [
      path.resolve(runDir, filename),
      path.resolve(process.cwd(), filename),
      path.resolve(path.dirname(process.argv[1] || '.'), filename)
    ];
    for (const p of candidates) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    throw new Error(`#import: file "${filename}" not found`);
  }
  throw new Error(`#import: no file loader for "${filename}"`);
}

// ============================================================
//  Interpreter
// ============================================================
class Interpreter {
  constructor(opts = {}) {
    this.outputs     = [];
    this._sink       = opts.sink || null;
    this.structs     = Object.create(null);
    this._inputFn    = opts.inputFn || null;
    this._fileLoader = opts.fileLoader || _defaultFileLoader;
    this.globalScope = this._buildGlobals();
  }

  interpret(code) {
    this.outputs = [];
    this.structs = Object.create(null);
    code = this._preprocess(code);
    const tokens = this.tokenize(code);
    const ast    = this.parse(tokens);
    this._execBlock(ast.body, this.globalScope);
    return this.outputs;
  }

  _preprocess(code) {
    const importRe = /^[ \t]*#import\[["']([^"']+)["']\];?[ \t]*(\r?\n|$)/gm;
    let inlined = '';
    const processed = code.replace(importRe, (_, filename) => {
      const ext = filename.split('.').pop().toLowerCase();
      if (ext === 'zl') {
        if (typeof DSALibraries !== 'undefined' && DSALibraries[filename])
          DSALibraries[filename].inject(this.globalScope);
        else throw new Error(`#import: library "${filename}" not found`);
        return '';
      } else if (ext === 'zpp') {
        const src = this._fileLoader(filename);
        inlined += this._preprocess(src) + '\n';
        return '';
      }
      throw new Error(`#import: unknown type ".${ext}"`);
    });
    return inlined + processed;
  }

  _print(line) {
    const s = String(line);
    this.outputs.push(s);
    if (this._sink) this._sink.write(s + '\n');
  }

  // ----------------------------------------------------------
  //  Built-in globals
  // ----------------------------------------------------------
  _buildGlobals() {
    const G = Object.create(null);

    G.print = (...args) => this._print(args.map(a => this._str(a)).join(' '));

    G.input = (prompt) => {
      const raw = this._inputFn
        ? this._inputFn(prompt || '')
        : _readLineNode(prompt || '');
      const trimmed = raw.trim();
      const n = Number(trimmed);
      return (trimmed !== '' && !isNaN(n)) ? n : raw;
    };

    G.toNum  = x => Number(x);
    G.toStr  = x => String(x);
    G.toBool = x => Boolean(x);

    G.isNum    = x => typeof x === 'number';
    G.isStr    = x => typeof x === 'string';
    G.isBool   = x => typeof x === 'boolean';
    G.isArr    = x => Array.isArray(x);
    G.isNull   = x => x === null || x === undefined;
    G.isStruct = x => x instanceof StructInstance;
    G.typeOf   = x => {
      if (x instanceof StructInstance) return x.__type__;
      if (Array.isArray(x))            return 'array';
      return typeof x;
    };

    G.abs    = x      => Math.abs(x);
    G.ceil   = x      => Math.ceil(x);
    G.floor  = x      => Math.floor(x);
    G.round  = x      => Math.round(x);
    G.sqrt   = x      => Math.sqrt(x);
    G.pow    = (x, y) => Math.pow(x, y);
    G.log    = x      => Math.log(x);
    G.log2   = x      => Math.log2(x);
    G.log10  = x      => Math.log10(x);
    G.sin    = x      => Math.sin(x);
    G.cos    = x      => Math.cos(x);
    G.tan    = x      => Math.tan(x);
    G.asin   = x      => Math.asin(x);
    G.acos   = x      => Math.acos(x);
    G.atan   = x      => Math.atan(x);
    G.atan2  = (y, x) => Math.atan2(y, x);
    G.hypot  = (x, y) => Math.hypot(x, y);
    G.PI     = Math.PI;
    G.E      = Math.E;
    G.INF    = Infinity;
    G.max    = (...a) => Math.max(...(a.length===1&&Array.isArray(a[0])?a[0]:a));
    G.min    = (...a) => Math.min(...(a.length===1&&Array.isArray(a[0])?a[0]:a));
    G.random    = ()     => Math.random();
    G.randomInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

    G.calculate = expr => {
      const safe = String(expr).replace(/[^0-9+\-*/.() %]/g, '');
      try   { return Function('"use strict";return(' + safe + ')')(); }
      catch (_) { throw new Error(`calculate: invalid expression "${expr}"`); }
    };

    // Strings
    G.len        = x         => x.length;
    G.upper      = s         => s.toUpperCase();
    G.lower      = s         => s.toLowerCase();
    G.trim       = s         => s.trim();
    G.split      = (s, d)    => s.split(d ?? '');
    G.join       = (a, d)    => a.join(d ?? ',');
    G.slice      = (x, a, b) => x.slice(a, b);
    G.substr     = (s, a, b) => s.substring(a, b);
    G.indexOf    = (x, v)    => x.indexOf(v);
    G.includes   = (x, v)    => x.includes(v);
    G.replace    = (s, a, b) => s.replace(a, b);
    G.startsWith = (s, p)    => s.startsWith(p);
    G.endsWith   = (s, p)    => s.endsWith(p);
    G.repeat     = (s, n)    => s.repeat(n);
    G.padLeft    = (s, n, c) => s.padStart(n, c ?? ' ');
    G.padRight   = (s, n, c) => s.padEnd(n, c ?? ' ');
    G.charCode   = (s, i)    => s.charCodeAt(i ?? 0);
    G.fromChar   = n         => String.fromCharCode(n);
    G.format     = (s, ...a) => s.replace(/{(\d+)}/g, (_, i) => a[i] ?? '');

    // Arrays
    G.range = (a, b, step = 1) => {
      const arr = [];
      if (step > 0) for (let i = a; i <= b; i += step) arr.push(i);
      else          for (let i = a; i >= b; i += step) arr.push(i);
      return arr;
    };
    G.fill    = (n, v)              => Array(n).fill(v);
    G.sum     = a                   => a.reduce((s, x) => s + x, 0);
    G.avg     = a                   => a.reduce((s, x) => s + x, 0) / a.length;
    G.unique  = a                   => [...new Set(a)];
    G.copy    = a                   => [...a];
    G.flat    = (a, d = 1)          => a.flat(d);
    G.concat  = (a, b)              => a.concat(b);
    G.push    = (a, ...v)           => { a.push(...v); return a; };
    G.pop     = a                   => a.pop();
    G.shift   = a                   => a.shift();
    G.unshift = (a, v)              => { a.unshift(v); return a; };
    G.splice  = (a, i, d, ...items) => { a.splice(i, d, ...items); return a; };
    G.reverse = a                   => [...a].reverse();
    G.keys    = o                   => Object.keys(o);
    G.values  = o                   => Object.values(o);
    G.has     = (o, k)              => k in Object(o);

    // JSON
    G.toJSON   = x => JSON.stringify(x instanceof StructInstance
      ? Object.fromEntries(Object.entries(x).filter(([k])=>k!=='__type__'))
      : x);
    G.fromJSON = s => JSON.parse(s);

    // Sorts
    G.sort         = a => [...a].sort((x, y) => x - y);
    G.sortDesc     = a => [...a].sort((x, y) => y - x);
    G.sortStr      = a => [...a].sort();
    G.bubbleSort   = arr => { arr=[...arr]; const n=arr.length; for(let i=0;i<n-1;i++) for(let j=0;j<n-i-1;j++) if(arr[j]>arr[j+1]){const t=arr[j];arr[j]=arr[j+1];arr[j+1]=t;} return arr; };
    G.selectionSort= arr => { arr=[...arr]; const n=arr.length; for(let i=0;i<n-1;i++){let m=i; for(let j=i+1;j<n;j++) if(arr[j]<arr[m])m=j; const t=arr[i];arr[i]=arr[m];arr[m]=t;} return arr; };
    G.insertionSort= arr => { arr=[...arr]; for(let i=1;i<arr.length;i++){const k=arr[i];let j=i-1; while(j>=0&&arr[j]>k){arr[j+1]=arr[j];j--;} arr[j+1]=k;} return arr; };
    G.mergeSort    = function ms(arr) { if(arr.length<=1)return arr; const m=arr.length>>1; const L=ms(arr.slice(0,m)),R=ms(arr.slice(m)); const res=[];let i=0,j=0; while(i<L.length&&j<R.length)res.push(L[i]<=R[j]?L[i++]:R[j++]); return res.concat(L.slice(i)).concat(R.slice(j)); };
    G.quickSort    = function qs(arr) { if(arr.length<=1)return arr; const p=arr[arr.length>>1]; return [...qs(arr.filter(x=>x<p)),...arr.filter(x=>x===p),...qs(arr.filter(x=>x>p))]; };
    G.heapSort     = arr => { arr=[...arr]; const n=arr.length; const h=(sz,i)=>{let lg=i,l=2*i+1,r=2*i+2; if(l<sz&&arr[l]>arr[lg])lg=l; if(r<sz&&arr[r]>arr[lg])lg=r; if(lg!==i){const t=arr[i];arr[i]=arr[lg];arr[lg]=t;h(sz,lg);}}; for(let i=Math.floor(n/2)-1;i>=0;i--)h(n,i); for(let i=n-1;i>0;i--){const t=arr[0];arr[0]=arr[i];arr[i]=t;h(i,0);} return arr; };
    G.countingSort = arr => { if(!arr.length)return[]; const mn=Math.min(...arr),mx=Math.max(...arr); const cnt=Array(mx-mn+1).fill(0); arr.forEach(x=>cnt[x-mn]++); const res=[]; cnt.forEach((c,i)=>{for(let j=0;j<c;j++)res.push(i+mn);}); return res; };

    // Search
    G.linearSearch = (arr, t) => { for(let i=0;i<arr.length;i++) if(arr[i]===t) return i; return -1; };
    G.binarySearch = (arr, t) => { let lo=0,hi=arr.length-1; while(lo<=hi){const m=(lo+hi)>>1; if(arr[m]===t)return m; arr[m]<t?lo=m+1:hi=m-1;} return -1; };
    G.search = G.linearSearch;

    return G;
  }

  // ----------------------------------------------------------
  //  Tokenizer
  // ----------------------------------------------------------
  tokenize(code) {
    const tokens = [];
    let i = 0;

    const KEYWORDS = new Set([
      'let', 'set', 'str', 'num', 'bool', 'array', 'view',
      'if', 'else', 'for', 'each', 'while',
      'func', 'fn', 'return', 'in', 'to', 'step',
      'break', 'continue', 'struct', 'enum',
      'when', 'then',
      'attempt', 'rescue', 'raise',
      'match', 'on',
      'repeat', 'until',
      'is'
    ]);

    while (i < code.length) {
      const ch = code[i];

      if (/\s/.test(ch)) { i++; continue; }

      // Single-line comment
      if (ch === '/' && code[i+1] === '/') {
        while (i < code.length && code[i] !== '\n') i++;
        continue;
      }
      // Block comment
      if (ch === '/' && code[i+1] === '*') {
        i += 2;
        while (i < code.length-1 && !(code[i]==='*'&&code[i+1]==='/')) i++;
        i += 2;
        continue;
      }

      // Identifiers / keywords
      if (/[a-zA-Z_]/.test(ch)) {
        let word = '';
        while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) word += code[i++];
        if      (word === 'true')  tokens.push({ type: 'boolean', value: true  });
        else if (word === 'false') tokens.push({ type: 'boolean', value: false });
        else if (word === 'null')  tokens.push({ type: 'null',    value: null  });
        else if (KEYWORDS.has(word)) tokens.push({ type: word });
        else tokens.push({ type: 'identifier', value: word });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(ch)) {
        if (ch === '0' && (code[i+1]==='x'||code[i+1]==='X')) {
          let num = code[i++] + code[i++];
          while (i < code.length && /[0-9a-fA-F]/.test(code[i])) num += code[i++];
          tokens.push({ type: 'number', value: parseInt(num, 16) });
        } else {
          let num = '';
          while (i < code.length && /[0-9.]/.test(code[i])) num += code[i++];
          tokens.push({ type: 'number', value: parseFloat(num) });
        }
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        const quote = ch; i++;
        let str = '';
        while (i < code.length && code[i] !== quote) {
          if (code[i] === '\\') {
            i++;
            const ESC = { n:'\n', t:'\t', r:'\r', '\\':'\\', '"':'"', "'":"'" };
            str += (code[i] in ESC) ? ESC[code[i]] : code[i];
          } else { str += code[i]; }
          i++;
        }
        i++;
        tokens.push({ type: 'string', value: str });
        continue;
      }

      // Backtick multi-line strings
      if (ch === '`') {
        i++;
        let str = '';
        while (i < code.length && code[i] !== '`') {
          if (code[i] === '\\') {
            i++;
            const ESC = { n:'\n', t:'\t', r:'\r', '\\':'\\', '`':'`' };
            str += (code[i] in ESC) ? ESC[code[i]] : code[i];
          } else { str += code[i]; }
          i++;
        }
        i++;
        tokens.push({ type: 'string', value: str });
        continue;
      }

      // '=' vs '==' vs '=>'
      if (ch === '=') {
        if (code[i+1]==='=')      { tokens.push({ type: 'operator', value: '==' }); i+=2; }
        else if (code[i+1]==='>') { tokens.push({ type: '=>' });                     i+=2; }
        else                       { tokens.push({ type: '=' });                      i++;  }
        continue;
      }

      // '...' spread/variadic
      if (ch === '.' && code[i+1] === '.' && code[i+2] === '.') {
        tokens.push({ type: '...' });
        i += 3;
        continue;
      }

      // Multi-char operators (including bitwise)
      if ('+-*/%><!&|^~'.includes(ch)) {
        let op = ch; i++;
        const nx = code[i] ?? '';
        if      (ch==='!'&&nx==='='){op='!='; i++;}
        else if (ch==='>'&&nx==='='){op='>='; i++;}
        else if (ch==='<'&&nx==='='){op='<='; i++;}
        else if (ch==='&'&&nx==='&'){op='&&'; i++;}
        else if (ch==='|'&&nx==='|'){op='||'; i++;}
        else if (ch==='+'&&nx==='+'){op='++'; i++;}
        else if (ch==='-'&&nx==='-'){op='--'; i++;}
        else if (ch==='+'&&nx==='='){op='+='; i++;}
        else if (ch==='-'&&nx==='='){op='-='; i++;}
        else if (ch==='*'&&nx==='='){op='*='; i++;}
        else if (ch==='/'&&nx==='='){op='/='; i++;}
        else if (ch==='%'&&nx==='='){op='%='; i++;}
        else if (ch==='&'&&nx==='='){op='&='; i++;}
        else if (ch==='|'&&nx==='='){op='|='; i++;}
        else if (ch==='^'&&nx==='='){op='^='; i++;}
        else if (ch==='<'&&nx==='<'){op='<<'; i++;}
        else if (ch==='>'&&nx==='>'){op='>>'; i++;}
        // single char bitwise: &, |, ^, ~  (already in op)
        tokens.push({ type: 'operator', value: op });
        continue;
      }

      // Single-char symbols
      if ('[]{}(),;:.?'.includes(ch)) { tokens.push({ type: ch }); i++; continue; }

      throw new Error(`Unexpected character '${ch}' at position ${i}`);
    }
    return tokens;
  }

  // ----------------------------------------------------------
  //  Parser
  // ----------------------------------------------------------
  parse(tokens) {
    this.tokens       = tokens;
    this.pos          = 0;
    this._structNames = new Set();
    const body = [];
    while (this.pos < this.tokens.length) body.push(this._parseStatement());
    return { type: 'program', body };
  }

  _peek(offset = 0) { return this.tokens[this.pos + offset] || { type: 'EOF' }; }

  _consume(type) {
    const tok = this.tokens[this.pos++];
    if (!tok) throw new Error(`Expected '${type}' but reached end of input`);
    if (tok.type !== type && tok.value !== type)
      throw new Error(`Expected '${type}' but got '${tok.type}'` +
        (tok.value !== undefined ? ` ('${tok.value}')` : ''));
    return tok;
  }

  _parseBlock() {
    const stmts = [];
    while (this._peek().type !== '}' && this._peek().type !== 'EOF')
      stmts.push(this._parseStatement());
    return stmts;
  }

  // ----------------------------------------------------------
  //  Statement dispatch
  // ----------------------------------------------------------
  _parseStatement() {
    const t = this._peek();

    if (['let','set','str','num','bool','array','view'].includes(t.type)) return this._parseDecl();
    if (t.type === 'struct')   return this._parseStructDef();
    if (t.type === 'enum')     return this._parseEnum();
    if (t.type === 'if')       return this._parseIf();
    if (t.type === 'for')      return this._parseFor();
    if (t.type === 'while')    return this._parseWhile();
    if (t.type === 'repeat')   return this._parseRepeat();
    if (t.type === 'func')     return this._parseFunc();
    if (t.type === 'return')   return this._parseReturn();
    if (t.type === 'raise')    return this._parseRaise();
    if (t.type === 'attempt')  return this._parseAttempt();
    if (t.type === 'match')    return this._parseMatch();
    if (t.type === 'break')    { this.pos++; this._consume(';'); return { type: 'break' }; }
    if (t.type === 'continue') { this.pos++; this._consume(';'); return { type: 'continue' }; }

    // StructName var;  /  StructName arr[n];
    if (t.type === 'identifier' && this._structNames.has(t.value)) {
      const t2 = this._peek(1);
      if (t2.type === 'identifier') return this._parseStructVarDecl();
    }

    if (t.type === 'identifier') return this._parseExprStmt();

    throw new Error(`Unexpected token: '${t.type}'` +
      (t.value !== undefined ? ` ('${t.value}')` : ''));
  }

  // ----------------------------------------------------------
  //  Declarations
  // ----------------------------------------------------------
  _parseDecl() {
    const keyword = this.tokens[this.pos++].type;
    const DECL_DEFAULTS = { num:0, str:'', bool:false, let:null, set:null, array:[], view:null };

    if (keyword === 'set' && this._peek().type !== 'identifier')
      throw new Error("'set' requires an identifier");

    // ── Destructuring: let [a,b] = arr;  let {x,y} = obj; ───
    if (keyword === 'let') {
      if (this._peek().type === '[') {
        // Array destructuring
        this._consume('[');
        const names = [];
        while (this._peek().type !== ']') {
          names.push(this._consume('identifier').value);
          if (this._peek().type === ',') this._consume(',');
        }
        this._consume(']');
        this._consume('=');
        const src = this._parseExpression();
        this._consume(';');
        return { type: 'destructure_arr', names, src };
      }
      if (this._peek().type === '{') {
        // Object/struct destructuring
        this._consume('{');
        const names = [];
        while (this._peek().type !== '}') {
          names.push(this._consume('identifier').value);
          if (this._peek().type === ',') this._consume(',');
        }
        this._consume('}');
        this._consume('=');
        const src = this._parseExpression();
        this._consume(';');
        return { type: 'destructure_obj', names, src };
      }
    }

    const parseOne = (kw) => {
      const id = this._consume('identifier').value;
      if (this._peek().type === ';' || this._peek().type === ',') {
        if (kw === 'set') throw new Error(`'set' constant '${id}' must have a value`);
        return { type: 'decl', keyword: kw, id, value: null, defaultVal: DECL_DEFAULTS[kw] };
      }
      this._consume('=');
      if (kw === 'array' && this._peek().type === '[') {
        const t1 = this.tokens[this.pos+1], t2 = this.tokens[this.pos+2];
        if (t1 && t2 && t2.type==='=' && (t1.value==='type'||t1.type==='num')) {
          const init = this._parseArrayInit();
          return { type: 'decl', keyword: kw, id, value: init, defaultVal: undefined };
        }
      }
      const value = this._parseExpression();
      return { type: 'decl', keyword: kw, id, value, defaultVal: undefined };
    };

    const decls = [parseOne(keyword)];
    while (this._peek().type === ',') {
      this._consume(',');
      decls.push(parseOne(keyword));
    }
    this._consume(';');
    if (decls.length === 1) return decls[0];
    return { type: 'multi_decl', decls };
  }

  _parseArrayInit() {
    this._consume('[');
    let elemType = null, countExpr = null;
    while (this._peek().type !== ']') {
      const kt = this._peek();
      if (kt.type !== 'identifier' && kt.type !== 'num')
        throw new Error(`Expected key in array init`);
      const key = kt.type === 'num' ? (this.pos++, 'num') : this._consume('identifier').value;
      this._consume('=');
      if (key === 'type')     { elemType  = this._consume('string').value; }
      else if (key === 'num') { countExpr = this._parseExpression(); }
      else throw new Error(`Unknown array init key '${key}'`);
      if (this._peek().type === ',') this._consume(',');
    }
    this._consume(']');
    if (!elemType)  throw new Error('array init missing type=');
    if (!countExpr) throw new Error('array init missing num=');
    return { type: 'array_init', elemType, countExpr };
  }

  // ----------------------------------------------------------
  //  struct definition — now supports fn methods
  // ----------------------------------------------------------
  _parseStructDef() {
    this._consume('struct');
    const name = this._consume('identifier').value;
    this._structNames.add(name);
    this._consume('{');
    const fields  = [];
    const methods = [];   // fn methodName(params) { body }
    while (this._peek().type !== '}') {
      if (this._peek().type === 'fn') {
        // method definition
        this._consume('fn');
        const mname = this._consume('identifier').value;
        this._consume('(');
        const params = this._parseFuncParams();
        this._consume(')');
        this._consume('{');
        const body = this._parseBlock();
        this._consume('}');
        methods.push({ name: mname, params, body });
      } else {
        let fieldType = null;
        const t = this._peek();
        if (['num','str','bool'].includes(t.type)) {
          fieldType = this.tokens[this.pos++].type;
        } else if (t.type === 'identifier' && this._structNames.has(t.value)) {
          fieldType = this.tokens[this.pos++].value;
        }
        const fieldName = this._consume('identifier').value;
        this._consume(';');
        fields.push({ name: fieldName, type: fieldType });
      }
    }
    this._consume('}');
    return { type: 'struct_def', name, fields, methods };
  }

  // ----------------------------------------------------------
  //  enum
  // ----------------------------------------------------------
  _parseEnum() {
    this._consume('enum');
    const name    = this._consume('identifier').value;
    this._consume('{');
    const entries = [];
    let auto = 0;
    while (this._peek().type !== '}') {
      const ename = this._consume('identifier').value;
      let val = auto++;
      if (this._peek().type === '=') {
        this._consume('=');
        const tok = this._consume('number');
        val  = tok.value;
        auto = val + 1;
      }
      entries.push({ name: ename, value: val });
    }
    this._consume('}');
    return { type: 'enum_def', name, entries };
  }

  // ----------------------------------------------------------
  //  if / for / while / repeat / match / attempt
  // ----------------------------------------------------------
  _parseIf() {
    this._consume('if');
    const condition = this._parseExpression();
    this._consume('{');
    const thenBody  = this._parseBlock();
    this._consume('}');
    let elseBody = null;
    if (this._peek().type === 'else') {
      this._consume('else');
      if (this._peek().type === 'if') {
        elseBody = [this._parseIf()];
      } else {
        this._consume('{');
        elseBody = this._parseBlock();
        this._consume('}');
      }
    }
    return { type: 'if', condition, thenBody, elseBody };
  }

  _parseFor() {
    this._consume('for');
    // for each item in arr { }
    if (this._peek().type === 'each') {
      this._consume('each');
      const id  = this._consume('identifier').value;
      this._consume('in');
      const src = this._parseExpression();
      this._consume('{');
      const body = this._parseBlock();
      this._consume('}');
      return { type: 'for_each', id, src, body };
    }
    // for i in start to end [step n] { }
    const id    = this._consume('identifier').value;
    this._consume('in');
    const start = this._parseExpression();
    this._consume('to');
    const end   = this._parseExpression();
    let step = null;
    if (this._peek().type === 'step') { this._consume('step'); step = this._parseExpression(); }
    this._consume('{');
    const body = this._parseBlock();
    this._consume('}');
    return { type: 'for', id, start, end, step, body };
  }

  _parseWhile() {
    this._consume('while');
    const condition = this._parseExpression();
    this._consume('{');
    const body = this._parseBlock();
    this._consume('}');
    return { type: 'while', condition, body };
  }

  // repeat { } until cond;
  _parseRepeat() {
    this._consume('repeat');
    this._consume('{');
    const body = this._parseBlock();
    this._consume('}');
    this._consume('until');
    const condition = this._parseExpression();
    this._consume(';');
    return { type: 'repeat', body, condition };
  }

  // match val { on x => { } on y => { } else => { } }
  _parseMatch() {
    this._consume('match');
    const subject = this._parseExpression();
    this._consume('{');
    const arms = [];
    let elseBody = null;
    while (this._peek().type !== '}') {
      if (this._peek().type === 'else') {
        this._consume('else');
        this._consume('=>');
        this._consume('{');
        elseBody = this._parseBlock();
        this._consume('}');
      } else {
        this._consume('on');
        const pattern = this._parseExpression();
        this._consume('=>');
        this._consume('{');
        const body = this._parseBlock();
        this._consume('}');
        arms.push({ pattern, body });
      }
    }
    this._consume('}');
    return { type: 'match', subject, arms, elseBody };
  }

  // attempt { } rescue errVar { }
  _parseAttempt() {
    this._consume('attempt');
    this._consume('{');
    const tryBody = this._parseBlock();
    this._consume('}');
    this._consume('rescue');
    const errVar = this._consume('identifier').value;
    this._consume('{');
    const catchBody = this._parseBlock();
    this._consume('}');
    return { type: 'attempt', tryBody, errVar, catchBody };
  }

  // raise expr;
  _parseRaise() {
    this._consume('raise');
    const value = this._parseExpression();
    this._consume(';');
    return { type: 'raise', value };
  }

  // ----------------------------------------------------------
  //  func — default params, variadic (...name)
  // ----------------------------------------------------------
  _parseFuncParams() {
    const params = [];
    const TYPE_KEYWORDS = new Set(['num','str','bool','let','array']);
    while (this._peek().type !== ')') {
      // variadic: ...name
      if (this._peek().type === '...') {
        this._consume('...');
        const name = this._consume('identifier').value;
        params.push({ name, type: null, variadic: true, defaultVal: undefined });
        // must be last param
        break;
      }
      let paramType = null;
      const pt = this._peek();
      if (TYPE_KEYWORDS.has(pt.type) || (pt.type==='identifier'&&this._structNames.has(pt.value))) {
        paramType = this.tokens[this.pos++].type || this.tokens[this.pos-1].value;
        if (this._peek().type !== 'identifier') {
          // consumed name not type
          params.push({ name: paramType, type: null, variadic: false, defaultVal: undefined });
          if (this._peek().type === ',') this._consume(',');
          continue;
        }
      }
      const name = this._consume('identifier').value;
      // default value?
      let defaultVal = undefined;
      if (this._peek().type === '=') {
        this._consume('=');
        defaultVal = this._parseExpression();
      }
      params.push({ name, type: paramType, variadic: false, defaultVal });
      if (this._peek().type === ',') this._consume(',');
    }
    return params;
  }

  _parseFunc() {
    this._consume('func');
    const id = this._consume('identifier').value;
    this._consume('(');
    const params = this._parseFuncParams();
    this._consume(')');
    this._consume('{');
    const body = this._parseBlock();
    this._consume('}');
    return { type: 'func', id, params, body };
  }

  _parseReturn() {
    this._consume('return');
    if (this._peek().type === ';') { this._consume(';'); return { type: 'return', value: null }; }
    const value = this._parseExpression();
    this._consume(';');
    return { type: 'return', value };
  }

  // ----------------------------------------------------------
  //  Struct var decl  (C-style)
  // ----------------------------------------------------------
  _parseStructVarDecl() {
    const structName = this._consume('identifier').value;
    const parseOneDeclarator = () => {
      const varName = this._consume('identifier').value;
      if (this._peek().type === '[') {
        this._consume('['); const countExpr = this._parseExpression(); this._consume(']');
        return { kind: 'array', varName, structName, countExpr };
      }
      if (this._peek().type === '=') {
        this._consume('='); const initExpr = this._parseExpression();
        return { kind: 'init', varName, structName, initExpr };
      }
      return { kind: 'single', varName, structName };
    };
    const declarators = [parseOneDeclarator()];
    while (this._peek().type === ',') { this._consume(','); declarators.push(parseOneDeclarator()); }
    this._consume(';');
    if (declarators.length === 1) return { type: 'struct_var_decl', ...declarators[0] };
    return { type: 'struct_multi_decl', declarators };
  }

  // ----------------------------------------------------------
  //  Expression statements — extended for field/index compound
  // ----------------------------------------------------------
  _parseExprStmt() {
    const id = this._consume('identifier');

    // ── simple assign: x = expr; ─────────────────────────────
    if (this._peek().type === '=') {
      this._consume('=');
      const value = this._parseExpression();
      this._consume(';');
      return { type: 'assign', id: id.value, value };
    }

    // ── compound assign on variable: x += expr; x++; ─────────
    if (this._peek().type === 'operator' &&
        ['+=','-=','*=','/=','%=','&=','|=','^=','++','--'].includes(this._peek().value)) {
      const op = this._consume('operator').value;
      if (op === '++' || op === '--') {
        this._consume(';');
        return { type: 'compound_assign', id: id.value,
                 op: op==='++'?'+=':'-=', value: { type: 'number', value: 1 } };
      }
      const value = this._parseExpression();
      this._consume(';');
      return { type: 'compound_assign', id: id.value, op, value };
    }

    // ── arr[i] ... ───────────────────────────────────────────
    if (this._peek().type === '[') {
      this._consume('[');
      const index = this._parseExpression();
      this._consume(']');

      // arr[i].field ... (struct field after index)
      if (this._peek().type === '.') {
        const chain = [];
        while (this._peek().type === '.') {
          this._consume('.'); chain.push(this._consume('identifier').value);
        }
        // compound assign on chained field
        if (this._peek().type === 'operator' &&
            ['+=','-=','*=','/=','%=','&=','|=','^=','++','--'].includes(this._peek().value)) {
          const op = this._consume('operator').value;
          if (op === '++' || op === '--') {
            this._consume(';');
            return { type: 'index_dot_compound', target: id.value, index, chain,
                     op: op==='++'?'+=':'-=', value: { type: 'number', value: 1 } };
          }
          const value = this._parseExpression();
          this._consume(';');
          return { type: 'index_dot_compound', target: id.value, index, chain, op, value };
        }
        this._consume('=');
        const value = this._parseExpression();
        this._consume(';');
        return { type: 'index_dot_assign', target: id.value, index, chain, value };
      }

      // arr[i] += expr; / arr[i]++;
      if (this._peek().type === 'operator' &&
          ['+=','-=','*=','/=','%=','&=','|=','^=','++','--'].includes(this._peek().value)) {
        const op = this._consume('operator').value;
        if (op === '++' || op === '--') {
          this._consume(';');
          return { type: 'index_compound', target: id.value, index,
                   op: op==='++'?'+=':'-=', value: { type: 'number', value: 1 } };
        }
        const value = this._parseExpression();
        this._consume(';');
        return { type: 'index_compound', target: id.value, index, op, value };
      }

      // arr[i] = expr;
      this._consume('=');
      const value = this._parseExpression();
      this._consume(';');
      return { type: 'array_assign', target: id.value, index, value };
    }

    // ── obj.field ...  /  obj.method(args); ──────────────────
    if (this._peek().type === '.') {
      const chain = [];
      while (this._peek().type === '.') {
        this._consume('.'); chain.push(this._consume('identifier').value);
      }

      // method call
      if (this._peek().type === '(') {
        const method = chain.pop();
        this._consume('(');
        const args = this._parseArgList();
        this._consume(')');
        this._consume(';');
        return { type: 'dot_method_stmt', target: id.value, chain, method, args };
      }

      // compound assign on field: hero.hp -= 10 / hero.hp++;
      if (this._peek().type === 'operator' &&
          ['+=','-=','*=','/=','%=','&=','|=','^=','++','--'].includes(this._peek().value)) {
        const op = this._consume('operator').value;
        if (op === '++' || op === '--') {
          this._consume(';');
          return { type: 'dot_compound', target: id.value, chain,
                   op: op==='++'?'+=':'-=', value: { type: 'number', value: 1 } };
        }
        const value = this._parseExpression();
        this._consume(';');
        return { type: 'dot_compound', target: id.value, chain, op, value };
      }

      // plain dot assign
      this._consume('=');
      const value = this._parseExpression();
      this._consume(';');
      return { type: 'dot_assign', target: id.value, chain, value };
    }

    // ── f(args); ─────────────────────────────────────────────
    if (this._peek().type === '(') {
      this._consume('(');
      const args = this._parseArgList();
      this._consume(')');
      this._consume(';');
      return { type: 'call_stmt', id: id.value, args };
    }

    throw new Error(`Unexpected token after '${id.value}': '${this._peek().type}'`);
  }

  _parseArgList() {
    const args = [];
    while (this._peek().type !== ')') {
      args.push(this._parseExpression());
      if (this._peek().type === ',') this._consume(',');
    }
    return args;
  }

  // ----------------------------------------------------------
  //  Expression parsers
  // ----------------------------------------------------------
  _parseExpression() {
    // when cond then a else b  (ternary)
    if (this._peek().type === 'when') {
      this._consume('when');
      const cond       = this._parseLogicalOr();
      this._consume('then');
      const consequent = this._parseLogicalOr();
      this._consume('else');
      const alternate  = this._parseExpression(); // recursive for chaining
      return { type: 'when_expr', cond, consequent, alternate };
    }
    return this._parseLogicalOr();
  }

  _parseLogicalOr() {
    let left = this._parseLogicalAnd();
    while (this._peek().value === '||') {
      const op = this._consume('operator').value;
      left = { type: 'binary', op, left, right: this._parseLogicalAnd() };
    }
    return left;
  }
  _parseLogicalAnd() {
    let left = this._parseEquality();
    while (this._peek().value === '&&') {
      const op = this._consume('operator').value;
      left = { type: 'binary', op, left, right: this._parseEquality() };
    }
    return left;
  }
  _parseEquality() {
    let left = this._parseRelational();
    while (['==','!='].includes(this._peek().value)) {
      const op = this._consume('operator').value;
      left = { type: 'binary', op, left, right: this._parseRelational() };
    }
    return left;
  }
  _parseRelational() {
    let left = this._parseBitwise();
    while (true) {
      const t = this._peek();
      // x is Type
      if (t.type === 'is') {
        this._consume('is');
        const typeTok = this._peek();
        let typeName;
        if (['num','str','bool','array','func'].includes(typeTok.type)) {
          typeName = this.tokens[this.pos++].type;
        } else if (typeTok.type === 'null') {
          typeName = 'null'; this.pos++;
        } else if (typeTok.type === 'identifier') {
          typeName = this.tokens[this.pos++].value;
        } else {
          throw new Error(`Expected type name after 'is'`);
        }
        left = { type: 'is_expr', value: left, typeName };
        continue;
      }
      // val in arr / "k" in obj
      if (t.type === 'in') {
        this._consume('in');
        const right = this._parseBitwise();
        left = { type: 'in_expr', value: left, collection: right };
        continue;
      }
      if (['>', '<', '>=', '<='].includes(t.value)) {
        const op = this._consume('operator').value;
        left = { type: 'binary', op, left, right: this._parseBitwise() };
        continue;
      }
      break;
    }
    return left;
  }
  _parseBitwise() {
    let left = this._parseAdditive();
    while (['&','|','^','<<','>>'].includes(this._peek().value)) {
      const op = this._consume('operator').value;
      left = { type: 'binary', op, left, right: this._parseAdditive() };
    }
    return left;
  }
  _parseAdditive() {
    let left = this._parseMultiplicative();
    while (['+','-'].includes(this._peek().value)) {
      const op = this._consume('operator').value;
      left = { type: 'binary', op, left, right: this._parseMultiplicative() };
    }
    return left;
  }
  _parseMultiplicative() {
    let left = this._parseUnary();
    while (['*','/','%'].includes(this._peek().value)) {
      const op = this._consume('operator').value;
      left = { type: 'binary', op, left, right: this._parseUnary() };
    }
    return left;
  }
  _parseUnary() {
    if (this._peek().type === 'operator' && ['!','-','~'].includes(this._peek().value)) {
      const op = this._consume('operator').value;
      return { type: 'unary', op, right: this._parseUnary() };
    }
    return this._parsePostfix();
  }
  _parsePostfix() {
    let node = this._parsePrimary();
    while (true) {
      if (this._peek().type === '[') {
        this._consume('[');
        const index = this._parseExpression();
        this._consume(']');
        node = { type: 'index', target: node, index };
      } else if (this._peek().type === '.') {
        this._consume('.');
        const prop = this._consume('identifier').value;
        if (this._peek().type === '(') {
          this._consume('(');
          const args = this._parseArgList();
          this._consume(')');
          node = { type: 'method_expr', target: node, method: prop, args };
        } else {
          node = { type: 'prop', target: node, prop };
        }
      } else { break; }
    }
    return node;
  }

  _parsePrimary() {
    const t = this._peek();

    if (t.type === 'number' || t.type === 'boolean') return this.tokens[this.pos++];
    if (t.type === 'null')                            return this.tokens[this.pos++];
    if (t.type === 'string')                          return this.tokens[this.pos++];

    // ── fn lambda:  fn(params) => expr   fn(params) { body } ─
    if (t.type === 'fn') {
      this._consume('fn');
      this._consume('(');
      const params = this._parseFuncParams();
      this._consume(')');
      if (this._peek().type === '=>') {
        this._consume('=>');
        const expr = this._parseExpression();
        return { type: 'lambda', params, body: null, expr };
      }
      this._consume('{');
      const body = this._parseBlock();
      this._consume('}');
      return { type: 'lambda', params, body, expr: null };
    }

    if (t.type === 'identifier') {
      const id = this.tokens[this.pos++];

      // Struct literal
      if (this._peek().type === '{' && this._structNames && this._structNames.has(id.value)) {
        this._consume('{');
        const fields = [];
        while (this._peek().type !== '}') {
          const kt = this._peek();
          if (kt.type !== 'identifier' && kt.type !== 'string')
            throw new Error(`Struct field name must be identifier`);
          const key = this.tokens[this.pos++].value;
          this._consume(':');
          const value = this._parseExpression();
          fields.push({ key, value });
          if (this._peek().type === ',') this._consume(',');
        }
        this._consume('}');
        return { type: 'struct_new', name: id.value, fields };
      }

      // Function call
      if (this._peek().type === '(') {
        this._consume('(');
        const args = this._parseArgList();
        this._consume(')');
        return { type: 'call', id: id.value, args };
      }

      return id;
    }

    // Parenthesised expression
    if (t.type === '(') {
      this._consume('(');
      const expr = this._parseExpression();
      this._consume(')');
      return expr;
    }

    // Array literal
    if (t.type === '[') {
      this._consume('[');
      const elements = [];
      while (this._peek().type !== ']') {
        elements.push(this._parseExpression());
        if (this._peek().type === ',') this._consume(',');
      }
      this._consume(']');
      return { type: 'array', elements };
    }

    // Object literal
    if (t.type === '{') {
      this._consume('{');
      const props = [];
      while (this._peek().type !== '}') {
        const kt = this._peek();
        if (kt.type !== 'identifier' && kt.type !== 'string')
          throw new Error(`Object key must be identifier or string`);
        const key = this.tokens[this.pos++].value;
        this._consume(':');
        const value = this._parseExpression();
        props.push({ key, value });
        if (this._peek().type === ',') this._consume(',');
      }
      this._consume('}');
      return { type: 'object', props };
    }

    throw new Error(`Unexpected token in expression: '${t.type}'` +
      (t.value !== undefined ? ` ('${t.value}')` : ''));
  }

  // ----------------------------------------------------------
  //  Execution engine
  // ----------------------------------------------------------
  _execBlock(stmts, scope) {
    for (const stmt of stmts) {
      const sig = this._exec(stmt, scope);
      if (sig instanceof ReturnSignal   ||
          sig instanceof BreakSignal    ||
          sig instanceof ContinueSignal ||
          sig instanceof ThrowSignal) return sig;
    }
  }

  _exec(node, scope) {
    switch (node.type) {

      // ── multi_decl ────────────────────────────────────────────
      case 'multi_decl': {
        for (const d of node.decls) this._exec(d, scope);
        return;
      }

      // ── decl ──────────────────────────────────────────────────
      case 'decl': {
        if (node.keyword === 'array' && node.value && node.value.type === 'array_init') {
          const count   = this._eval(node.value.countExpr, scope);
          const elemType = node.value.elemType;
          const defaults = { num: 0, str: '', object: null };
          scope[node.id] = Array.from({ length: count }, () => defaults[elemType]);
          return;
        }
        let val = node.value !== null ? this._eval(node.value, scope) : node.defaultVal;
        if (node.keyword === 'num' && typeof val === 'string') {
          const n = Number(val.trim());
          if (isNaN(n)) throw new Error(`Type error: '${node.id}' is num but got "${val}"`);
          val = n;
        }
        if (node.keyword === 'str' && typeof val === 'number') val = String(val);
        // view and let: accept any value — no type checking
        if (!['let','view'].includes(node.keyword)) {
          if (node.keyword === 'num'  && typeof val !== 'number')
            throw new Error(`Type error: '${node.id}' is num but got ${typeof val}`);
          if (node.keyword === 'str'  && typeof val !== 'string')
            throw new Error(`Type error: '${node.id}' is str but got ${typeof val}`);
          if (node.keyword === 'bool' && typeof val !== 'boolean')
            throw new Error(`Type error: '${node.id}' is bool but got ${typeof val}`);
        }
        scope[node.id] = val;
        if (node.keyword === 'set') {
          if (!Object.prototype.hasOwnProperty.call(scope, '__consts__'))
            scope.__consts__ = new Set();
          scope.__consts__.add(node.id);
        }
        return;
      }

      // ── destructuring ─────────────────────────────────────────
      case 'destructure_arr': {
        const src = this._eval(node.src, scope);
        if (!Array.isArray(src)) throw new Error('Array destructuring requires an array');
        node.names.forEach((name, i) => { scope[name] = src[i] ?? null; });
        return;
      }
      case 'destructure_obj': {
        const src = this._eval(node.src, scope);
        if (src === null || typeof src !== 'object')
          throw new Error('Object destructuring requires an object or struct');
        node.names.forEach(name => { scope[name] = src[name] ?? null; });
        return;
      }

      // ── struct_def ────────────────────────────────────────────
      case 'struct_def': {
        const { name, fields, methods } = node;
        this.structs[name] = fields;
        // store methods on structs table for binding at call time
        this.structs[name].__methods__ = methods || [];

        scope[name] = (...positionalArgs) => {
          const obj = new StructInstance(name, {});
          fields.forEach((f, i) => {
            const defaults = { num:0, str:'', bool:false };
            obj[f.name] = positionalArgs[i] !== undefined
              ? positionalArgs[i]
              : (f.type ? (defaults[f.type] ?? null) : null);
          });
          this._bindMethods(obj, methods, scope);
          return obj;
        };
        scope[name].__isStructCtor__ = true;
        scope[name].__structName__   = name;
        return;
      }

      // ── enum_def ──────────────────────────────────────────────
      case 'enum_def': {
        const obj = Object.create(null);
        node.entries.forEach(e => { obj[e.name] = e.value; });
        Object.freeze(obj);
        scope[node.name] = obj;
        return;
      }

      // ── struct_var_decl / struct_multi_decl ───────────────────
      case 'struct_multi_decl': {
        for (const d of node.declarators) this._exec({ type: 'struct_var_decl', ...d }, scope);
        return;
      }
      case 'struct_var_decl': {
        const def = this.structs[node.structName];
        if (!def) throw new Error(`Unknown struct type: '${node.structName}'`);
        const makeDefault = () => this._makeStructDefault(node.structName, scope);
        if (node.kind === 'array') {
          const count = this._eval(node.countExpr, scope);
          scope[node.varName] = Array.from({ length: count }, makeDefault);
        } else if (node.kind === 'init') {
          scope[node.varName] = this._eval(node.initExpr, scope);
        } else {
          scope[node.varName] = makeDefault();
        }
        return;
      }

      // ── assign ────────────────────────────────────────────────
      case 'assign': {
        this._setVar(scope, node.id, this._eval(node.value, scope));
        return;
      }

      // ── compound_assign ───────────────────────────────────────
      case 'compound_assign': {
        const cur = this._getVar(scope, node.id);
        const rhs = this._eval(node.value, scope);
        this._setVar(scope, node.id, this._applyOp(node.op, cur, rhs));
        return;
      }

      // ── array_assign ──────────────────────────────────────────
      case 'array_assign': {
        const arr = this._getVar(scope, node.target);
        arr[this._eval(node.index, scope)] = this._eval(node.value, scope);
        return;
      }

      // ── index_compound  arr[i] += 5 ──────────────────────────
      case 'index_compound': {
        const arr = this._getVar(scope, node.target);
        const idx = this._eval(node.index, scope);
        const rhs = this._eval(node.value, scope);
        arr[idx] = this._applyOp(node.op, arr[idx], rhs);
        return;
      }

      // ── index_dot_assign  arr[i].field = expr ─────────────────
      case 'index_dot_assign': {
        let obj = this._getVar(scope, node.target);
        obj = obj[this._eval(node.index, scope)];
        for (let i = 0; i < node.chain.length - 1; i++) obj = obj[node.chain[i]];
        obj[node.chain[node.chain.length - 1]] = this._eval(node.value, scope);
        return;
      }

      // ── index_dot_compound  arr[i].field += 5 ─────────────────
      case 'index_dot_compound': {
        let obj = this._getVar(scope, node.target);
        obj = obj[this._eval(node.index, scope)];
        for (let i = 0; i < node.chain.length - 1; i++) obj = obj[node.chain[i]];
        const last = node.chain[node.chain.length - 1];
        const rhs  = this._eval(node.value, scope);
        obj[last] = this._applyOp(node.op, obj[last], rhs);
        return;
      }

      // ── dot_assign  obj.a.b = expr ────────────────────────────
      case 'dot_assign': {
        let obj = this._getVar(scope, node.target);
        for (let i = 0; i < node.chain.length - 1; i++) {
          obj = obj[node.chain[i]];
          if (obj === null || obj === undefined)
            throw new Error(`Cannot set property on null/undefined`);
        }
        obj[node.chain[node.chain.length - 1]] = this._eval(node.value, scope);
        return;
      }

      // ── dot_compound  hero.hp -= 10 ───────────────────────────
      case 'dot_compound': {
        let obj = this._getVar(scope, node.target);
        for (let i = 0; i < node.chain.length - 1; i++) {
          obj = obj[node.chain[i]];
          if (obj === null || obj === undefined)
            throw new Error(`Cannot compound-assign on null/undefined`);
        }
        const last = node.chain[node.chain.length - 1];
        const rhs  = this._eval(node.value, scope);
        obj[last] = this._applyOp(node.op, obj[last], rhs);
        return;
      }

      // ── dot_method_stmt ───────────────────────────────────────
      case 'dot_method_stmt': {
        let obj = this._getVar(scope, node.target);
        for (const key of node.chain) obj = obj[key];
        const args = node.args.map(a => this._eval(a, scope));
        this._applyMethod(obj, node.method, args);
        return;
      }

      case 'method_stmt': {
        const tgt  = this._getVar(scope, node.target);
        const args = node.args.map(a => this._eval(a, scope));
        this._applyMethod(tgt, node.method, args);
        return;
      }

      // ── call_stmt ─────────────────────────────────────────────
      case 'call_stmt': {
        const fn = this._getVar(scope, node.id);
        if (typeof fn !== 'function') throw new Error(`'${node.id}' is not a function`);
        fn(...node.args.map(a => this._eval(a, scope)));
        return;
      }

      // ── if ────────────────────────────────────────────────────
      case 'if': {
        if (this._eval(node.condition, scope)) {
          return this._execBlock(node.thenBody, Object.create(scope));
        } else if (node.elseBody) {
          return this._execBlock(node.elseBody, Object.create(scope));
        }
        return;
      }

      // ── for i in start to end ─────────────────────────────────
      case 'for': {
        const start = this._eval(node.start, scope);
        const end   = this._eval(node.end,   scope);
        const step  = node.step ? this._eval(node.step, scope) : (start <= end ? 1 : -1);
        const cmp   = step > 0 ? (a, b) => a <= b : (a, b) => a >= b;
        for (let idx = start; cmp(idx, end); idx += step) {
          const ls = Object.create(scope);
          ls[node.id] = idx;
          const sig = this._execBlock(node.body, ls);
          if (sig instanceof ReturnSignal) return sig;
          if (sig instanceof ThrowSignal)  return sig;
          if (sig instanceof BreakSignal)  break;
        }
        return;
      }

      // ── for each item in arr ──────────────────────────────────
      case 'for_each': {
        const src = this._eval(node.src, scope);
        const items = Array.isArray(src) ? src
          : typeof src === 'string' ? src.split('')
          : Object.values(src);
        for (const item of items) {
          const ls = Object.create(scope);
          ls[node.id] = item;
          const sig = this._execBlock(node.body, ls);
          if (sig instanceof ReturnSignal) return sig;
          if (sig instanceof ThrowSignal)  return sig;
          if (sig instanceof BreakSignal)  break;
        }
        return;
      }

      // ── while ─────────────────────────────────────────────────
      case 'while': {
        while (this._eval(node.condition, scope)) {
          const sig = this._execBlock(node.body, Object.create(scope));
          if (sig instanceof ReturnSignal) return sig;
          if (sig instanceof ThrowSignal)  return sig;
          if (sig instanceof BreakSignal)  break;
        }
        return;
      }

      // ── repeat { } until cond; ────────────────────────────────
      case 'repeat': {
        do {
          const sig = this._execBlock(node.body, Object.create(scope));
          if (sig instanceof ReturnSignal) return sig;
          if (sig instanceof ThrowSignal)  return sig;
          if (sig instanceof BreakSignal)  break;
        } while (this._eval(node.condition, scope) === false);
        return;
      }

      // ── match val { on x => { } else => { } } ────────────────
      case 'match': {
        const subject = this._eval(node.subject, scope);
        for (const arm of node.arms) {
          const pattern = this._eval(arm.pattern, scope);
          if (subject === pattern) {
            const sig = this._execBlock(arm.body, Object.create(scope));
            if (sig) return sig;
            return;
          }
        }
        if (node.elseBody) {
          return this._execBlock(node.elseBody, Object.create(scope));
        }
        return;
      }

      // ── attempt { } rescue e { } ──────────────────────────────
      case 'attempt': {
        let sig;
        try {
          sig = this._execBlock(node.tryBody, Object.create(scope));
        } catch (jsErr) {
          // catch both raise (ThrowSignal) and real JS runtime errors
          const cs = Object.create(scope);
          cs[node.errVar] = jsErr instanceof ThrowSignal ? jsErr.value : jsErr.message;
          return this._execBlock(node.catchBody, cs);
        }
        if (sig instanceof ThrowSignal) {
          const cs = Object.create(scope);
          cs[node.errVar] = sig.value;
          return this._execBlock(node.catchBody, cs);
        }
        return sig;
      }

      // ── raise expr; ───────────────────────────────────────────
      case 'raise': {
        const val = this._eval(node.value, scope);
        return new ThrowSignal(val);
      }

      // ── func ──────────────────────────────────────────────────
      case 'func': {
        const cls = scope;
        scope[node.id] = this._makeFn(node.params, node.body, cls);
        return;
      }

      case 'return': {
        const val = node.value !== null ? this._eval(node.value, scope) : null;
        return new ReturnSignal(val);
      }

      case 'break':    return new BreakSignal();
      case 'continue': return new ContinueSignal();

      default:
        throw new Error(`Unknown statement type: '${node.type}'`);
    }
  }

  // ----------------------------------------------------------
  //  Helpers
  // ----------------------------------------------------------
  _applyOp(op, cur, rhs) {
    switch (op) {
      case '+=': return cur + rhs;
      case '-=': return cur - rhs;
      case '*=': return cur * rhs;
      case '/=': if (rhs === 0) throw new Error('Division by zero'); return cur / rhs;
      case '%=': return cur % rhs;
      case '&=': return (cur | 0) & (rhs | 0);
      case '|=': return (cur | 0) | (rhs | 0);
      case '^=': return (cur | 0) ^ (rhs | 0);
      default:   throw new Error(`Unknown compound op '${op}'`);
    }
  }

  _makeFn(params, body, closure) {
    return (...args) => {
      const fs = Object.create(closure);
      let argIdx = 0;
      for (const param of params) {
        const name   = param.name;
        const ptype  = param.type;
        const isVar  = param.variadic;
        const defVal = param.defaultVal;

        if (isVar) {
          // collect all remaining args into an array
          fs[name] = args.slice(argIdx);
          break;
        }

        let val = argIdx < args.length ? args[argIdx++]
          : (defVal !== undefined ? this._eval(defVal, closure) : null);

        // type coercion
        if (ptype === 'num') {
          if (typeof val === 'string') {
            const n = Number(val);
            if (isNaN(n)) throw new Error(`Param '${name}' expects num, got "${val}"`);
            val = n;
          } else if (typeof val !== 'number' && val !== null) {
            throw new Error(`Param '${name}' expects num, got ${typeof val}`);
          }
        } else if (ptype === 'str') {
          if (typeof val === 'number') val = String(val);
          else if (typeof val !== 'string' && val !== null)
            throw new Error(`Param '${name}' expects str, got ${typeof val}`);
        } else if (ptype === 'bool') {
          if (typeof val !== 'boolean' && val !== null)
            throw new Error(`Param '${name}' expects bool, got ${typeof val}`);
        }

        fs[name] = val;
      }
      const sig = this._execBlock(body, fs);
      if (sig instanceof ThrowSignal) throw sig;  // propagate up
      return sig instanceof ReturnSignal ? sig.value : null;
    };
  }

  _makeStructDefault(typeName, scope) {
    const def = this.structs[typeName];
    if (!def) return null;
    const typeDefaults = { num: 0, str: '', bool: false };
    const inst = new StructInstance(typeName, {});
    def.forEach(f => {
      if (f.type && typeDefaults.hasOwnProperty(f.type))   inst[f.name] = typeDefaults[f.type];
      else if (f.type && this.structs[f.type])              inst[f.name] = this._makeStructDefault(f.type, scope);
      else                                                   inst[f.name] = null;
    });
    this._bindMethods(inst, def.__methods__ || [], scope || this.globalScope);
    return inst;
  }

  _bindMethods(inst, methods, scope) {
    for (const m of methods) {
      // Close over inst as 'self'
      const capturedInst = inst;
      inst[m.name] = (...args) => {
        const ms = Object.create(scope);
        ms['self'] = capturedInst;
        m.params.forEach((p, i) => {
          const name = typeof p === 'string' ? p : p.name;
          ms[name] = args[i] ?? null;
        });
        const sig = this._execBlock(m.body, ms);
        if (sig instanceof ThrowSignal) throw sig;
        return sig instanceof ReturnSignal ? sig.value : null;
      };
    }
  }

  // ----------------------------------------------------------
  //  Expression evaluator
  // ----------------------------------------------------------
  _eval(node, scope) {
    switch (node.type) {

      case 'number':
      case 'boolean': return node.value;
      case 'null':    return null;

      // String interpolation
      case 'string': {
        if (!node.value.includes('#')) return node.value;
        const src = node.value;
        let out = '', i = 0;
        while (i < src.length) {
          if (src[i] !== '#') { out += src[i++]; continue; }
          if (src[i+1] === '#') { out += '#'; i += 2; continue; }
          if (src[i+1] === '(') {
            let depth = 0, j = i + 1;
            while (j < src.length) {
              if (src[j]==='(') depth++;
              else if (src[j]===')') { depth--; if (depth===0) break; }
              j++;
            }
            const exprText = src.slice(i + 2, j);
            try {
              const savedToks = this.tokens, savedPos = this.pos;
              this.tokens = this.tokenize(exprText); this.pos = 0;
              const exprNode = this._parseExpression();
              this.tokens = savedToks; this.pos = savedPos;
              out += this._str(this._eval(exprNode, scope));
            } catch (_) { out += src.slice(i, j+1); }
            i = j + 1; continue;
          }
          if (/[a-zA-Z_]/.test(src[i+1])) {
            let j = i + 1;
            while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
            while (j < src.length && src[j]==='.' && /[a-zA-Z_]/.test(src[j+1])) {
              j++;
              while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
            }
            const varExpr = src.slice(i+1, j);
            const parts   = varExpr.split('.');
            let val = this._getVar(scope, parts[0]);
            if (val !== undefined) {
              for (let k = 1; k < parts.length; k++) {
                if (val == null) { val = undefined; break; }
                val = val[parts[k]];
              }
            }
            out += val !== undefined ? this._str(val) : src.slice(i, j);
            i = j; continue;
          }
          out += src[i++];
        }
        return out;
      }

      case 'identifier': {
        const val = this._getVar(scope, node.value);
        if (val === undefined) throw new Error(`Undefined variable: '${node.value}'`);
        return val;
      }

      case 'call': {
        const fn = this._getVar(scope, node.id);
        if (typeof fn !== 'function') throw new Error(`'${node.id}' is not a function`);
        try {
          return fn(...node.args.map(a => this._eval(a, scope)));
        } catch (e) {
          if (e instanceof ThrowSignal) return e; // re-wrap
          throw e;
        }
      }

      case 'index':      return this._eval(node.target, scope)[this._eval(node.index, scope)];
      case 'prop':       return this._eval(node.target, scope)[node.prop];

      case 'method_expr': {
        const tgt  = this._eval(node.target, scope);
        const args = node.args.map(a => this._eval(a, scope));
        return this._applyMethod(tgt, node.method, args, scope);
      }

      case 'array':  return node.elements.map(e => this._eval(e, scope));

      case 'object': {
        const obj = {};
        node.props.forEach(p => obj[p.key] = this._eval(p.value, scope));
        return obj;
      }

      // ── struct instantiation ───────────────────────────────────
      case 'struct_new': {
        const def = this.structs[node.name];
        if (!def) throw new Error(`Unknown struct type: '${node.name}'`);
        const inst = this._makeStructDefault(node.name, scope);
        node.fields.forEach(f => {
          if (!def.find(d => d.name === f.key))
            throw new Error(`Struct '${node.name}' has no field '${f.key}'`);
          inst[f.key] = this._eval(f.value, scope);
        });
        return inst;
      }

      // ── lambda ────────────────────────────────────────────────
      case 'lambda': {
        const capturedScope = scope;
        if (node.expr !== null) {
          // arrow lambda: fn(x) => expr
          return (...args) => {
            const fs = Object.create(capturedScope);
            node.params.forEach((p, i) => {
              const name = typeof p === 'string' ? p : p.name;
              fs[name] = args[i] ?? null;
            });
            return this._eval(node.expr, fs);
          };
        }
        // block lambda: fn(x) { body }
        return this._makeFn(node.params, node.body, capturedScope);
      }

      // ── when cond then a else b ────────────────────────────────
      case 'when_expr': {
        return this._eval(node.cond, scope)
          ? this._eval(node.consequent, scope)
          : this._eval(node.alternate, scope);
      }

      // ── x is Type ─────────────────────────────────────────────
      case 'is_expr': {
        const val  = this._eval(node.value, scope);
        const t    = node.typeName;
        if (t === 'num')   return typeof val === 'number';
        if (t === 'str')   return typeof val === 'string';
        if (t === 'bool')  return typeof val === 'boolean';
        if (t === 'array') return Array.isArray(val);
        if (t === 'func')  return typeof val === 'function';
        if (t === 'null')  return val === null || val === undefined;
        // struct type
        return val instanceof StructInstance && val.__type__ === t;
      }

      // ── val in arr / "k" in obj ───────────────────────────────
      case 'in_expr': {
        const val = this._eval(node.value, scope);
        const col = this._eval(node.collection, scope);
        if (Array.isArray(col)) return col.includes(val);
        if (typeof col === 'string') return col.includes(val);
        if (typeof col === 'object' && col !== null) return val in col;
        throw new Error(`'in' requires an array, string, or object`);
      }

      case 'binary': {
        if (node.op === '&&')
          return this._eval(node.left, scope) && this._eval(node.right, scope);
        if (node.op === '||')
          return this._eval(node.left, scope) || this._eval(node.right, scope);
        const l = this._eval(node.left,  scope);
        const r = this._eval(node.right, scope);
        switch (node.op) {
          case '+':  return l + r;
          case '-':  return l - r;
          case '*':  return l * r;
          case '/':  if (r === 0) throw new Error('Division by zero'); return l / r;
          case '%':  return l % r;
          case '==': return l === r;
          case '!=': return l !== r;
          case '>':  return l > r;
          case '<':  return l < r;
          case '>=': return l >= r;
          case '<=': return l <= r;
          // bitwise
          case '&':  return (l|0) & (r|0);
          case '|':  return (l|0) | (r|0);
          case '^':  return (l|0) ^ (r|0);
          case '<<': return (l|0) << (r|0);
          case '>>': return (l|0) >> (r|0);
          default:   throw new Error(`Unknown binary operator '${node.op}'`);
        }
      }

      case 'unary': {
        const v = this._eval(node.right, scope);
        if (node.op === '!') return !v;
        if (node.op === '-') return -v;
        if (node.op === '~') return ~(v|0);
        throw new Error(`Unknown unary operator '${node.op}'`);
      }

      default:
        throw new Error(`Unknown expression type: '${node.type}'`);
    }
  }

  // ----------------------------------------------------------
  //  Method dispatch
  // ----------------------------------------------------------
  _applyMethod(target, method, args, scope) {
    if (Array.isArray(target)) {
      switch (method) {
        case 'push':     target.push(...args);      return target;
        case 'pop':      return target.pop();
        case 'shift':    return target.shift();
        case 'unshift':  target.unshift(...args);   return target;
        case 'indexOf':  return target.indexOf(args[0]);
        case 'includes': return target.includes(args[0]);
        case 'join':     return target.join(args[0] ?? ',');
        case 'slice':    return target.slice(...args);
        case 'concat':   return target.concat(args[0]);
        case 'reverse':  return [...target].reverse();
        case 'len':      return target.length;
        case 'sort':     return [...target].sort((a, b) => a - b);
        // ── Functional methods (accept fn lambda or JS function) ──
        case 'map':     return target.map(   (x, i) => this._callFn(args[0], [x, i]));
        case 'filter':  return target.filter((x, i) => this._callFn(args[0], [x, i]));
        case 'find':    return target.find(  (x, i) => this._callFn(args[0], [x, i])) ?? null;
        case 'every':   return target.every( (x, i) => this._callFn(args[0], [x, i]));
        case 'some':    return target.some(  (x, i) => this._callFn(args[0], [x, i]));
        case 'flatMap': return target.flatMap((x, i) => this._callFn(args[0], [x, i]));
        case 'reduce': {
          if (args.length < 2) throw new Error('reduce requires an initial value as 2nd arg');
          return target.reduce((acc, x) => this._callFn(args[0], [acc, x]), args[1]);
        }
        case 'sortBy': {
          return [...target].sort((a, b) => {
            const ka = this._callFn(args[0], [a]);
            const kb = this._callFn(args[0], [b]);
            return ka < kb ? -1 : ka > kb ? 1 : 0;
          });
        }
        case 'count': {
          if (!args[0]) return target.length;
          return target.filter(x => this._callFn(args[0], [x])).length;
        }
        default: throw new Error(`Unknown array method: '${method}'`);
      }
    }

    if (typeof target === 'string') {
      switch (method) {
        case 'len':        return target.length;
        case 'upper':      return target.toUpperCase();
        case 'lower':      return target.toLowerCase();
        case 'trim':       return target.trim();
        case 'split':      return target.split(args[0] ?? '');
        case 'slice':      return target.slice(...args);
        case 'indexOf':    return target.indexOf(args[0]);
        case 'includes':   return target.includes(args[0]);
        case 'replace':    return target.replace(args[0], args[1]);
        case 'startsWith': return target.startsWith(args[0]);
        case 'endsWith':   return target.endsWith(args[0]);
        case 'repeat':     return target.repeat(args[0]);
        case 'toNum':      return Number(target);
        case 'charCode':   return target.charCodeAt(args[0] ?? 0);
        case 'chars':      return target.split('');
        case 'words':      return target.trim().split(/\s+/);
        case 'lines':      return target.split('\n');
        default: throw new Error(`Unknown string method: '${method}'`);
      }
    }

    if (target instanceof StructInstance || (typeof target === 'object' && target !== null)) {
      if (typeof target[method] === 'function') {
        return target[method].apply(target, args);
      }
      switch (method) {
        case 'keys':   return Object.keys(target).filter(k => k !== '__type__' && typeof target[k] !== 'function');
        case 'values': return Object.entries(target).filter(([k,v]) => k !== '__type__' && typeof v !== 'function').map(([,v])=>v);
        case 'has':    return args[0] in target;
        default: throw new Error(`Unknown object method: '${method}' on ${target.__type__ || 'object'}`);
      }
    }

    throw new Error(`Cannot call '${method}' on ${typeof target}`);
  }

  // Call a ZETA++ lambda or JS function with given args
  _callFn(fn, args) {
    if (typeof fn !== 'function')
      throw new Error(`Expected a function (lambda), got ${typeof fn}`);
    try {
      const result = fn(...args);
      if (result instanceof ThrowSignal) throw result;
      if (result instanceof ReturnSignal) return result.value;
      return result;
    } catch (e) {
      if (e instanceof ThrowSignal) throw e;
      throw e;
    }
  }

  // ----------------------------------------------------------
  //  Scope helpers
  // ----------------------------------------------------------
  _getVar(scope, name) {
    let s = scope;
    while (s !== null) {
      if (Object.prototype.hasOwnProperty.call(s, name)) return s[name];
      s = Object.getPrototypeOf(s);
    }
    return undefined;
  }

  _setVar(scope, name, value) {
    let s = scope;
    while (s !== null) {
      if (Object.prototype.hasOwnProperty.call(s, name)) {
        if (s.__consts__ && s.__consts__.has(name))
          throw new Error(`Cannot reassign constant '${name}' (declared with 'set')`);
        s[name] = value;
        return;
      }
      s = Object.getPrototypeOf(s);
    }
    scope[name] = value;
  }

  // ----------------------------------------------------------
  //  Stringify
  // ----------------------------------------------------------
  _str(val) {
    if (val === null)              return 'null';
    if (val === undefined)         return 'undefined';
    if (typeof val === 'boolean')  return val ? 'true' : 'false';
    if (typeof val === 'function') return '<func>';
    // gui.zl view objects carry __type__ = 'view' set by _view()
    if (typeof val === 'object' && val !== null && val.__type__ === 'view')
      return `<view:${val.__viewKind__ || 'widget'}>`;
    if (val instanceof StructInstance) {
      const fields = Object.entries(val)
        .filter(([k, v]) => k !== '__type__' && typeof v !== 'function')
        .map(([k, v]) => `${k}: ${this._str(v)}`)
        .join(', ');
      return `${val.__type__} { ${fields} }`;
    }
    if (Array.isArray(val))
      return '[' + val.map(v => typeof v === 'string' ? `"${v}"` : this._str(v)).join(', ') + ']';
    if (typeof val === 'object')
      return '{' + Object.entries(val).map(([k, v]) => `${k}: ${this._str(v)}`).join(', ') + '}';
    return String(val);
  }
}

// ============================================================
//  Public API
// ============================================================
class InputNeededError extends Error {
  constructor(prompt, outputSoFar) {
    super('__INPUT_NEEDED__');
    this.isInputNeeded = true;
    this.prompt        = prompt || '';
    this.outputSoFar   = outputSoFar || [];
  }
}

function interpretDSALang(code, answers, opts) {
  answers = answers || [];
  opts    = opts    || {};
  let idx = 0;

  const fileLoader = opts.files
    ? (filename) => {
        if (opts.files[filename] === undefined)
          throw new Error(`#import: "${filename}" not found`);
        return opts.files[filename];
      }
    : _defaultFileLoader;

  const interp = new Interpreter({
    fileLoader,
    inputFn: (prompt) => {
      if (idx < answers.length) return String(answers[idx++]);
      throw new InputNeededError(prompt, [...interp.outputs]);
    }
  });
  return interp.interpret(code);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { interpretDSALang, InputNeededError, Interpreter };
}

if (typeof require !== 'undefined' && require.main === module) {
  const nodefs = require('fs');
  const interp = new Interpreter({ sink: process.stdout });
  let code;
  if (process.argv[2]) {
    code = nodefs.readFileSync(process.argv[2], 'utf8');
  } else {
    code = `
// ZETA++ v6 — Feature Showcase
// Run any .zpp file with:  node interpreter.js file.zpp

// 1. foreach
let nums = [1,2,3,4,5];
for each n in nums { print("num: " + n); }

// 2. ternary
num x = 7;
str label = when x > 5 then "big" else "small";
print("label: " + label);

// 3. match
match x {
  on 1 => { print("one"); }
  on 7 => { print("seven!"); }
  else  => { print("other"); }
}

// 4. attempt / rescue / raise
attempt {
  raise "oops!";
} rescue e {
  print("caught: " + e);
}

// 5. repeat until
num i = 0;
repeat { i++; } until i >= 3;
print("i after repeat: " + i);

// 6. lambda + map/filter
let doubled = nums.map(fn(n) => n * 2);
print("doubled: " + join(doubled, " "));
let evens = nums.filter(fn(n) => n % 2 == 0);
print("evens: " + join(evens, " "));

// 7. enum
enum Direction { NORTH SOUTH EAST WEST }
print("NORTH=" + Direction.NORTH + " WEST=" + Direction.WEST);

// 8. struct methods
struct Circle {
  num radius;
  fn area() { return 3.14159 * self.radius * self.radius; }
  fn describe() { print("Circle r=" + self.radius + " area=" + self.area()); }
}
Circle c; c.radius = 5;
c.describe();

// 9. destructuring
let [a, b, cc] = [10, 20, 30];
print("destructured: a=#a b=#b c=#cc");

// 10. bitwise
print("5 & 3 = " + (5 & 3));
print("5 | 3 = " + (5 | 3));
print("5 ^ 3 = " + (5 ^ 3));
print("1 << 3 = " + (1 << 3));

// 11. is / in
print("5 is num: " + (5 is num));
print("3 in nums: " + (3 in nums));

// 12. compound assign on fields
struct Point { num x; num y; }
Point p;
p.x = 10;
p.x -= 3;
p.x++;
print("p.x = " + p.x);
`;
  }
  try {
    interp.interpret(code);
  } catch (e) {
    process.stderr.write('\x1b[31mError:\x1b[0m ' + e.message + '\n');
    process.exit(1);
  }
}