(function () {
  'use strict';

  const C = {
    widget  : '#c792ea',   // purple 
    helper  : '#89ddff',   // cyan    
    method  : '#80cbc4',   // teal   
    type    : '#90e0ef',   // blue  
  };

  const _widgets = new Set();   // Window, Scene, Button, Label
  const _helpers = new Set();   // rgb, rgba, hex, make, loadImage
  const _methods = new Set();   // setTitle, getValue, drawRect
  const _types   = new Set();   // view
  window.__ZPP__ = window.__ZPP__ || {};


  window.__ZPP__.registerBuiltins = function (names) {
    const METHOD_RE = /^(?:set|get|draw|on(?=[A-Z])|is(?=[A-Z]))/;
    const METHOD_WORDS = new Set([
      'add','remove','clear','fill','move','close','resize',
      'minimize','maximize','enable','disable','listen','focus',
      'loop','stopLoop','save','restore','translate','rotate',
      'scale2','apply','reset','follow','moveTo','zoomTo',
      'bringToFront','viewPrint',
    ]);

    names.forEach(name => {
      if (/^[A-Z]/.test(name)) {
        _widgets.add(name);                            
      } else if (METHOD_RE.test(name) || METHOD_WORDS.has(name)) {
        _methods.add(name);                            
      } else {
        _helpers.add(name);                            
      }
    });
  };

  
  window.__ZPP__.registerTypes = function (names) {
    names.forEach(n => _types.add(n));
  };

  function recolor(overlay) {
    if (!_widgets.size && !_helpers.size && !_methods.size && !_types.size) return;

    const spans = overlay.getElementsByTagName('span');
    for (let i = 0; i < spans.length; i++) {
      const sp  = spans[i];
      const txt = sp.textContent;

      /* precedence: widget > type > method > helper */
      if      (_widgets.has(txt))  sp.style.color = C.widget;
      else if (_types.has(txt))    sp.style.color = C.type;
      else if (_methods.has(txt))  sp.style.color = C.method;
      else if (_helpers.has(txt))  sp.style.color = C.helper;
    }
  }

  function setup() {
    const textarea = document.getElementById('editor');
    if (!textarea) return;

    const container = textarea.parentElement;
    let   overlay   = null;

    function findOverlay() {
      for (const el of container.children) {
        if (el.tagName === 'DIV' && el.style.zIndex === '2') return el;
      }
      return null;
    }

    const obs = new MutationObserver(() => {
      if (!overlay) overlay = findOverlay();
      if (overlay)  recolor(overlay);
    });

    obs.observe(container, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

})();