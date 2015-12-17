(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
!function() {
  var WAAClock = require( 'waaclock' ),
      CodeMirror = require( 'codemirror' )

  require( '../node_modules/codemirror/mode/javascript/javascript.js' )

  var cm = CodeMirror( document.body, { mode:"javascript" })

  console.log('test2')

}()

},{"../node_modules/codemirror/mode/javascript/javascript.js":4,"codemirror":3,"waaclock":5}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// This is CodeMirror (http://codemirror.net), a code editor
// implemented in JavaScript on top of the browser's DOM.
//
// You can find some technical background for some of the code below
// at http://marijnhaverbeke.nl/blog/#cm-internals .

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    module.exports = mod();
  else if (typeof define == "function" && define.amd) // AMD
    return define([], mod);
  else // Plain browser env
    this.CodeMirror = mod();
})(function() {
  "use strict";

  // BROWSER SNIFFING

  // Kludges for bugs and behavior differences that can't be feature
  // detected are enabled based on userAgent etc sniffing.
  var userAgent = navigator.userAgent;
  var platform = navigator.platform;

  var gecko = /gecko\/\d/i.test(userAgent);
  var ie_upto10 = /MSIE \d/.test(userAgent);
  var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(userAgent);
  var ie = ie_upto10 || ie_11up;
  var ie_version = ie && (ie_upto10 ? document.documentMode || 6 : ie_11up[1]);
  var webkit = /WebKit\//.test(userAgent);
  var qtwebkit = webkit && /Qt\/\d+\.\d+/.test(userAgent);
  var chrome = /Chrome\//.test(userAgent);
  var presto = /Opera\//.test(userAgent);
  var safari = /Apple Computer/.test(navigator.vendor);
  var mac_geMountainLion = /Mac OS X 1\d\D([8-9]|\d\d)\D/.test(userAgent);
  var phantom = /PhantomJS/.test(userAgent);

  var ios = /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent);
  // This is woefully incomplete. Suggestions for alternative methods welcome.
  var mobile = ios || /Android|webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile/i.test(userAgent);
  var mac = ios || /Mac/.test(platform);
  var windows = /win/i.test(platform);

  var presto_version = presto && userAgent.match(/Version\/(\d*\.\d*)/);
  if (presto_version) presto_version = Number(presto_version[1]);
  if (presto_version && presto_version >= 15) { presto = false; webkit = true; }
  // Some browsers use the wrong event properties to signal cmd/ctrl on OS X
  var flipCtrlCmd = mac && (qtwebkit || presto && (presto_version == null || presto_version < 12.11));
  var captureRightClick = gecko || (ie && ie_version >= 9);

  // Optimize some code when these features are not used.
  var sawReadOnlySpans = false, sawCollapsedSpans = false;

  // EDITOR CONSTRUCTOR

  // A CodeMirror instance represents an editor. This is the object
  // that user code is usually dealing with.

  function CodeMirror(place, options) {
    if (!(this instanceof CodeMirror)) return new CodeMirror(place, options);

    this.options = options = options ? copyObj(options) : {};
    // Determine effective options based on given values and defaults.
    copyObj(defaults, options, false);
    setGuttersForLineNumbers(options);

    var doc = options.value;
    if (typeof doc == "string") doc = new Doc(doc, options.mode, null, options.lineSeparator);
    this.doc = doc;

    var input = new CodeMirror.inputStyles[options.inputStyle](this);
    var display = this.display = new Display(place, doc, input);
    display.wrapper.CodeMirror = this;
    updateGutters(this);
    themeChanged(this);
    if (options.lineWrapping)
      this.display.wrapper.className += " CodeMirror-wrap";
    if (options.autofocus && !mobile) display.input.focus();
    initScrollbars(this);

    this.state = {
      keyMaps: [],  // stores maps added by addKeyMap
      overlays: [], // highlighting overlays, as added by addOverlay
      modeGen: 0,   // bumped when mode/overlay changes, used to invalidate highlighting info
      overwrite: false,
      delayingBlurEvent: false,
      focused: false,
      suppressEdits: false, // used to disable editing during key handlers when in readOnly mode
      pasteIncoming: false, cutIncoming: false, // help recognize paste/cut edits in input.poll
      selectingText: false,
      draggingText: false,
      highlight: new Delayed(), // stores highlight worker timeout
      keySeq: null,  // Unfinished key sequence
      specialChars: null
    };

    var cm = this;

    // Override magic textarea content restore that IE sometimes does
    // on our hidden textarea on reload
    if (ie && ie_version < 11) setTimeout(function() { cm.display.input.reset(true); }, 20);

    registerEventHandlers(this);
    ensureGlobalHandlers();

    startOperation(this);
    this.curOp.forceUpdate = true;
    attachDoc(this, doc);

    if ((options.autofocus && !mobile) || cm.hasFocus())
      setTimeout(bind(onFocus, this), 20);
    else
      onBlur(this);

    for (var opt in optionHandlers) if (optionHandlers.hasOwnProperty(opt))
      optionHandlers[opt](this, options[opt], Init);
    maybeUpdateLineNumberWidth(this);
    if (options.finishInit) options.finishInit(this);
    for (var i = 0; i < initHooks.length; ++i) initHooks[i](this);
    endOperation(this);
    // Suppress optimizelegibility in Webkit, since it breaks text
    // measuring on line wrapping boundaries.
    if (webkit && options.lineWrapping &&
        getComputedStyle(display.lineDiv).textRendering == "optimizelegibility")
      display.lineDiv.style.textRendering = "auto";
  }

  // DISPLAY CONSTRUCTOR

  // The display handles the DOM integration, both for input reading
  // and content drawing. It holds references to DOM nodes and
  // display-related state.

  function Display(place, doc, input) {
    var d = this;
    this.input = input;

    // Covers bottom-right square when both scrollbars are present.
    d.scrollbarFiller = elt("div", null, "CodeMirror-scrollbar-filler");
    d.scrollbarFiller.setAttribute("cm-not-content", "true");
    // Covers bottom of gutter when coverGutterNextToScrollbar is on
    // and h scrollbar is present.
    d.gutterFiller = elt("div", null, "CodeMirror-gutter-filler");
    d.gutterFiller.setAttribute("cm-not-content", "true");
    // Will contain the actual code, positioned to cover the viewport.
    d.lineDiv = elt("div", null, "CodeMirror-code");
    // Elements are added to these to represent selection and cursors.
    d.selectionDiv = elt("div", null, null, "position: relative; z-index: 1");
    d.cursorDiv = elt("div", null, "CodeMirror-cursors");
    // A visibility: hidden element used to find the size of things.
    d.measure = elt("div", null, "CodeMirror-measure");
    // When lines outside of the viewport are measured, they are drawn in this.
    d.lineMeasure = elt("div", null, "CodeMirror-measure");
    // Wraps everything that needs to exist inside the vertically-padded coordinate system
    d.lineSpace = elt("div", [d.measure, d.lineMeasure, d.selectionDiv, d.cursorDiv, d.lineDiv],
                      null, "position: relative; outline: none");
    // Moved around its parent to cover visible view.
    d.mover = elt("div", [elt("div", [d.lineSpace], "CodeMirror-lines")], null, "position: relative");
    // Set to the height of the document, allowing scrolling.
    d.sizer = elt("div", [d.mover], "CodeMirror-sizer");
    d.sizerWidth = null;
    // Behavior of elts with overflow: auto and padding is
    // inconsistent across browsers. This is used to ensure the
    // scrollable area is big enough.
    d.heightForcer = elt("div", null, null, "position: absolute; height: " + scrollerGap + "px; width: 1px;");
    // Will contain the gutters, if any.
    d.gutters = elt("div", null, "CodeMirror-gutters");
    d.lineGutter = null;
    // Actual scrollable element.
    d.scroller = elt("div", [d.sizer, d.heightForcer, d.gutters], "CodeMirror-scroll");
    d.scroller.setAttribute("tabIndex", "-1");
    // The element in which the editor lives.
    d.wrapper = elt("div", [d.scrollbarFiller, d.gutterFiller, d.scroller], "CodeMirror");

    // Work around IE7 z-index bug (not perfect, hence IE7 not really being supported)
    if (ie && ie_version < 8) { d.gutters.style.zIndex = -1; d.scroller.style.paddingRight = 0; }
    if (!webkit && !(gecko && mobile)) d.scroller.draggable = true;

    if (place) {
      if (place.appendChild) place.appendChild(d.wrapper);
      else place(d.wrapper);
    }

    // Current rendered range (may be bigger than the view window).
    d.viewFrom = d.viewTo = doc.first;
    d.reportedViewFrom = d.reportedViewTo = doc.first;
    // Information about the rendered lines.
    d.view = [];
    d.renderedView = null;
    // Holds info about a single rendered line when it was rendered
    // for measurement, while not in view.
    d.externalMeasured = null;
    // Empty space (in pixels) above the view
    d.viewOffset = 0;
    d.lastWrapHeight = d.lastWrapWidth = 0;
    d.updateLineNumbers = null;

    d.nativeBarWidth = d.barHeight = d.barWidth = 0;
    d.scrollbarsClipped = false;

    // Used to only resize the line number gutter when necessary (when
    // the amount of lines crosses a boundary that makes its width change)
    d.lineNumWidth = d.lineNumInnerWidth = d.lineNumChars = null;
    // Set to true when a non-horizontal-scrolling line widget is
    // added. As an optimization, line widget aligning is skipped when
    // this is false.
    d.alignWidgets = false;

    d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;

    // Tracks the maximum line length so that the horizontal scrollbar
    // can be kept static when scrolling.
    d.maxLine = null;
    d.maxLineLength = 0;
    d.maxLineChanged = false;

    // Used for measuring wheel scrolling granularity
    d.wheelDX = d.wheelDY = d.wheelStartX = d.wheelStartY = null;

    // True when shift is held down.
    d.shift = false;

    // Used to track whether anything happened since the context menu
    // was opened.
    d.selForContextMenu = null;

    d.activeTouch = null;

    input.init(d);
  }

  // STATE UPDATES

  // Used to get the editor into a consistent state again when options change.

  function loadMode(cm) {
    cm.doc.mode = CodeMirror.getMode(cm.options, cm.doc.modeOption);
    resetModeState(cm);
  }

  function resetModeState(cm) {
    cm.doc.iter(function(line) {
      if (line.stateAfter) line.stateAfter = null;
      if (line.styles) line.styles = null;
    });
    cm.doc.frontier = cm.doc.first;
    startWorker(cm, 100);
    cm.state.modeGen++;
    if (cm.curOp) regChange(cm);
  }

  function wrappingChanged(cm) {
    if (cm.options.lineWrapping) {
      addClass(cm.display.wrapper, "CodeMirror-wrap");
      cm.display.sizer.style.minWidth = "";
      cm.display.sizerWidth = null;
    } else {
      rmClass(cm.display.wrapper, "CodeMirror-wrap");
      findMaxLine(cm);
    }
    estimateLineHeights(cm);
    regChange(cm);
    clearCaches(cm);
    setTimeout(function(){updateScrollbars(cm);}, 100);
  }

  // Returns a function that estimates the height of a line, to use as
  // first approximation until the line becomes visible (and is thus
  // properly measurable).
  function estimateHeight(cm) {
    var th = textHeight(cm.display), wrapping = cm.options.lineWrapping;
    var perLine = wrapping && Math.max(5, cm.display.scroller.clientWidth / charWidth(cm.display) - 3);
    return function(line) {
      if (lineIsHidden(cm.doc, line)) return 0;

      var widgetsHeight = 0;
      if (line.widgets) for (var i = 0; i < line.widgets.length; i++) {
        if (line.widgets[i].height) widgetsHeight += line.widgets[i].height;
      }

      if (wrapping)
        return widgetsHeight + (Math.ceil(line.text.length / perLine) || 1) * th;
      else
        return widgetsHeight + th;
    };
  }

  function estimateLineHeights(cm) {
    var doc = cm.doc, est = estimateHeight(cm);
    doc.iter(function(line) {
      var estHeight = est(line);
      if (estHeight != line.height) updateLineHeight(line, estHeight);
    });
  }

  function themeChanged(cm) {
    cm.display.wrapper.className = cm.display.wrapper.className.replace(/\s*cm-s-\S+/g, "") +
      cm.options.theme.replace(/(^|\s)\s*/g, " cm-s-");
    clearCaches(cm);
  }

  function guttersChanged(cm) {
    updateGutters(cm);
    regChange(cm);
    setTimeout(function(){alignHorizontally(cm);}, 20);
  }

  // Rebuild the gutter elements, ensure the margin to the left of the
  // code matches their width.
  function updateGutters(cm) {
    var gutters = cm.display.gutters, specs = cm.options.gutters;
    removeChildren(gutters);
    for (var i = 0; i < specs.length; ++i) {
      var gutterClass = specs[i];
      var gElt = gutters.appendChild(elt("div", null, "CodeMirror-gutter " + gutterClass));
      if (gutterClass == "CodeMirror-linenumbers") {
        cm.display.lineGutter = gElt;
        gElt.style.width = (cm.display.lineNumWidth || 1) + "px";
      }
    }
    gutters.style.display = i ? "" : "none";
    updateGutterSpace(cm);
  }

  function updateGutterSpace(cm) {
    var width = cm.display.gutters.offsetWidth;
    cm.display.sizer.style.marginLeft = width + "px";
  }

  // Compute the character length of a line, taking into account
  // collapsed ranges (see markText) that might hide parts, and join
  // other lines onto it.
  function lineLength(line) {
    if (line.height == 0) return 0;
    var len = line.text.length, merged, cur = line;
    while (merged = collapsedSpanAtStart(cur)) {
      var found = merged.find(0, true);
      cur = found.from.line;
      len += found.from.ch - found.to.ch;
    }
    cur = line;
    while (merged = collapsedSpanAtEnd(cur)) {
      var found = merged.find(0, true);
      len -= cur.text.length - found.from.ch;
      cur = found.to.line;
      len += cur.text.length - found.to.ch;
    }
    return len;
  }

  // Find the longest line in the document.
  function findMaxLine(cm) {
    var d = cm.display, doc = cm.doc;
    d.maxLine = getLine(doc, doc.first);
    d.maxLineLength = lineLength(d.maxLine);
    d.maxLineChanged = true;
    doc.iter(function(line) {
      var len = lineLength(line);
      if (len > d.maxLineLength) {
        d.maxLineLength = len;
        d.maxLine = line;
      }
    });
  }

  // Make sure the gutters options contains the element
  // "CodeMirror-linenumbers" when the lineNumbers option is true.
  function setGuttersForLineNumbers(options) {
    var found = indexOf(options.gutters, "CodeMirror-linenumbers");
    if (found == -1 && options.lineNumbers) {
      options.gutters = options.gutters.concat(["CodeMirror-linenumbers"]);
    } else if (found > -1 && !options.lineNumbers) {
      options.gutters = options.gutters.slice(0);
      options.gutters.splice(found, 1);
    }
  }

  // SCROLLBARS

  // Prepare DOM reads needed to update the scrollbars. Done in one
  // shot to minimize update/measure roundtrips.
  function measureForScrollbars(cm) {
    var d = cm.display, gutterW = d.gutters.offsetWidth;
    var docH = Math.round(cm.doc.height + paddingVert(cm.display));
    return {
      clientHeight: d.scroller.clientHeight,
      viewHeight: d.wrapper.clientHeight,
      scrollWidth: d.scroller.scrollWidth, clientWidth: d.scroller.clientWidth,
      viewWidth: d.wrapper.clientWidth,
      barLeft: cm.options.fixedGutter ? gutterW : 0,
      docHeight: docH,
      scrollHeight: docH + scrollGap(cm) + d.barHeight,
      nativeBarWidth: d.nativeBarWidth,
      gutterWidth: gutterW
    };
  }

  function NativeScrollbars(place, scroll, cm) {
    this.cm = cm;
    var vert = this.vert = elt("div", [elt("div", null, null, "min-width: 1px")], "CodeMirror-vscrollbar");
    var horiz = this.horiz = elt("div", [elt("div", null, null, "height: 100%; min-height: 1px")], "CodeMirror-hscrollbar");
    place(vert); place(horiz);

    on(vert, "scroll", function() {
      if (vert.clientHeight) scroll(vert.scrollTop, "vertical");
    });
    on(horiz, "scroll", function() {
      if (horiz.clientWidth) scroll(horiz.scrollLeft, "horizontal");
    });

    this.checkedZeroWidth = false;
    // Need to set a minimum width to see the scrollbar on IE7 (but must not set it on IE8).
    if (ie && ie_version < 8) this.horiz.style.minHeight = this.vert.style.minWidth = "18px";
  }

  NativeScrollbars.prototype = copyObj({
    update: function(measure) {
      var needsH = measure.scrollWidth > measure.clientWidth + 1;
      var needsV = measure.scrollHeight > measure.clientHeight + 1;
      var sWidth = measure.nativeBarWidth;

      if (needsV) {
        this.vert.style.display = "block";
        this.vert.style.bottom = needsH ? sWidth + "px" : "0";
        var totalHeight = measure.viewHeight - (needsH ? sWidth : 0);
        // A bug in IE8 can cause this value to be negative, so guard it.
        this.vert.firstChild.style.height =
          Math.max(0, measure.scrollHeight - measure.clientHeight + totalHeight) + "px";
      } else {
        this.vert.style.display = "";
        this.vert.firstChild.style.height = "0";
      }

      if (needsH) {
        this.horiz.style.display = "block";
        this.horiz.style.right = needsV ? sWidth + "px" : "0";
        this.horiz.style.left = measure.barLeft + "px";
        var totalWidth = measure.viewWidth - measure.barLeft - (needsV ? sWidth : 0);
        this.horiz.firstChild.style.width =
          (measure.scrollWidth - measure.clientWidth + totalWidth) + "px";
      } else {
        this.horiz.style.display = "";
        this.horiz.firstChild.style.width = "0";
      }

      if (!this.checkedZeroWidth && measure.clientHeight > 0) {
        if (sWidth == 0) this.zeroWidthHack();
        this.checkedZeroWidth = true;
      }

      return {right: needsV ? sWidth : 0, bottom: needsH ? sWidth : 0};
    },
    setScrollLeft: function(pos) {
      if (this.horiz.scrollLeft != pos) this.horiz.scrollLeft = pos;
      if (this.disableHoriz) this.enableZeroWidthBar(this.horiz, this.disableHoriz);
    },
    setScrollTop: function(pos) {
      if (this.vert.scrollTop != pos) this.vert.scrollTop = pos;
      if (this.disableVert) this.enableZeroWidthBar(this.vert, this.disableVert);
    },
    zeroWidthHack: function() {
      var w = mac && !mac_geMountainLion ? "12px" : "18px";
      this.horiz.style.height = this.vert.style.width = w;
      this.horiz.style.pointerEvents = this.vert.style.pointerEvents = "none";
      this.disableHoriz = new Delayed;
      this.disableVert = new Delayed;
    },
    enableZeroWidthBar: function(bar, delay) {
      bar.style.pointerEvents = "auto";
      function maybeDisable() {
        // To find out whether the scrollbar is still visible, we
        // check whether the element under the pixel in the bottom
        // left corner of the scrollbar box is the scrollbar box
        // itself (when the bar is still visible) or its filler child
        // (when the bar is hidden). If it is still visible, we keep
        // it enabled, if it's hidden, we disable pointer events.
        var box = bar.getBoundingClientRect();
        var elt = document.elementFromPoint(box.left + 1, box.bottom - 1);
        if (elt != bar) bar.style.pointerEvents = "none";
        else delay.set(1000, maybeDisable);
      }
      delay.set(1000, maybeDisable);
    },
    clear: function() {
      var parent = this.horiz.parentNode;
      parent.removeChild(this.horiz);
      parent.removeChild(this.vert);
    }
  }, NativeScrollbars.prototype);

  function NullScrollbars() {}

  NullScrollbars.prototype = copyObj({
    update: function() { return {bottom: 0, right: 0}; },
    setScrollLeft: function() {},
    setScrollTop: function() {},
    clear: function() {}
  }, NullScrollbars.prototype);

  CodeMirror.scrollbarModel = {"native": NativeScrollbars, "null": NullScrollbars};

  function initScrollbars(cm) {
    if (cm.display.scrollbars) {
      cm.display.scrollbars.clear();
      if (cm.display.scrollbars.addClass)
        rmClass(cm.display.wrapper, cm.display.scrollbars.addClass);
    }

    cm.display.scrollbars = new CodeMirror.scrollbarModel[cm.options.scrollbarStyle](function(node) {
      cm.display.wrapper.insertBefore(node, cm.display.scrollbarFiller);
      // Prevent clicks in the scrollbars from killing focus
      on(node, "mousedown", function() {
        if (cm.state.focused) setTimeout(function() { cm.display.input.focus(); }, 0);
      });
      node.setAttribute("cm-not-content", "true");
    }, function(pos, axis) {
      if (axis == "horizontal") setScrollLeft(cm, pos);
      else setScrollTop(cm, pos);
    }, cm);
    if (cm.display.scrollbars.addClass)
      addClass(cm.display.wrapper, cm.display.scrollbars.addClass);
  }

  function updateScrollbars(cm, measure) {
    if (!measure) measure = measureForScrollbars(cm);
    var startWidth = cm.display.barWidth, startHeight = cm.display.barHeight;
    updateScrollbarsInner(cm, measure);
    for (var i = 0; i < 4 && startWidth != cm.display.barWidth || startHeight != cm.display.barHeight; i++) {
      if (startWidth != cm.display.barWidth && cm.options.lineWrapping)
        updateHeightsInViewport(cm);
      updateScrollbarsInner(cm, measureForScrollbars(cm));
      startWidth = cm.display.barWidth; startHeight = cm.display.barHeight;
    }
  }

  // Re-synchronize the fake scrollbars with the actual size of the
  // content.
  function updateScrollbarsInner(cm, measure) {
    var d = cm.display;
    var sizes = d.scrollbars.update(measure);

    d.sizer.style.paddingRight = (d.barWidth = sizes.right) + "px";
    d.sizer.style.paddingBottom = (d.barHeight = sizes.bottom) + "px";

    if (sizes.right && sizes.bottom) {
      d.scrollbarFiller.style.display = "block";
      d.scrollbarFiller.style.height = sizes.bottom + "px";
      d.scrollbarFiller.style.width = sizes.right + "px";
    } else d.scrollbarFiller.style.display = "";
    if (sizes.bottom && cm.options.coverGutterNextToScrollbar && cm.options.fixedGutter) {
      d.gutterFiller.style.display = "block";
      d.gutterFiller.style.height = sizes.bottom + "px";
      d.gutterFiller.style.width = measure.gutterWidth + "px";
    } else d.gutterFiller.style.display = "";
  }

  // Compute the lines that are visible in a given viewport (defaults
  // the the current scroll position). viewport may contain top,
  // height, and ensure (see op.scrollToPos) properties.
  function visibleLines(display, doc, viewport) {
    var top = viewport && viewport.top != null ? Math.max(0, viewport.top) : display.scroller.scrollTop;
    top = Math.floor(top - paddingTop(display));
    var bottom = viewport && viewport.bottom != null ? viewport.bottom : top + display.wrapper.clientHeight;

    var from = lineAtHeight(doc, top), to = lineAtHeight(doc, bottom);
    // Ensure is a {from: {line, ch}, to: {line, ch}} object, and
    // forces those lines into the viewport (if possible).
    if (viewport && viewport.ensure) {
      var ensureFrom = viewport.ensure.from.line, ensureTo = viewport.ensure.to.line;
      if (ensureFrom < from) {
        from = ensureFrom;
        to = lineAtHeight(doc, heightAtLine(getLine(doc, ensureFrom)) + display.wrapper.clientHeight);
      } else if (Math.min(ensureTo, doc.lastLine()) >= to) {
        from = lineAtHeight(doc, heightAtLine(getLine(doc, ensureTo)) - display.wrapper.clientHeight);
        to = ensureTo;
      }
    }
    return {from: from, to: Math.max(to, from + 1)};
  }

  // LINE NUMBERS

  // Re-align line numbers and gutter marks to compensate for
  // horizontal scrolling.
  function alignHorizontally(cm) {
    var display = cm.display, view = display.view;
    if (!display.alignWidgets && (!display.gutters.firstChild || !cm.options.fixedGutter)) return;
    var comp = compensateForHScroll(display) - display.scroller.scrollLeft + cm.doc.scrollLeft;
    var gutterW = display.gutters.offsetWidth, left = comp + "px";
    for (var i = 0; i < view.length; i++) if (!view[i].hidden) {
      if (cm.options.fixedGutter && view[i].gutter)
        view[i].gutter.style.left = left;
      var align = view[i].alignable;
      if (align) for (var j = 0; j < align.length; j++)
        align[j].style.left = left;
    }
    if (cm.options.fixedGutter)
      display.gutters.style.left = (comp + gutterW) + "px";
  }

  // Used to ensure that the line number gutter is still the right
  // size for the current document size. Returns true when an update
  // is needed.
  function maybeUpdateLineNumberWidth(cm) {
    if (!cm.options.lineNumbers) return false;
    var doc = cm.doc, last = lineNumberFor(cm.options, doc.first + doc.size - 1), display = cm.display;
    if (last.length != display.lineNumChars) {
      var test = display.measure.appendChild(elt("div", [elt("div", last)],
                                                 "CodeMirror-linenumber CodeMirror-gutter-elt"));
      var innerW = test.firstChild.offsetWidth, padding = test.offsetWidth - innerW;
      display.lineGutter.style.width = "";
      display.lineNumInnerWidth = Math.max(innerW, display.lineGutter.offsetWidth - padding) + 1;
      display.lineNumWidth = display.lineNumInnerWidth + padding;
      display.lineNumChars = display.lineNumInnerWidth ? last.length : -1;
      display.lineGutter.style.width = display.lineNumWidth + "px";
      updateGutterSpace(cm);
      return true;
    }
    return false;
  }

  function lineNumberFor(options, i) {
    return String(options.lineNumberFormatter(i + options.firstLineNumber));
  }

  // Computes display.scroller.scrollLeft + display.gutters.offsetWidth,
  // but using getBoundingClientRect to get a sub-pixel-accurate
  // result.
  function compensateForHScroll(display) {
    return display.scroller.getBoundingClientRect().left - display.sizer.getBoundingClientRect().left;
  }

  // DISPLAY DRAWING

  function DisplayUpdate(cm, viewport, force) {
    var display = cm.display;

    this.viewport = viewport;
    // Store some values that we'll need later (but don't want to force a relayout for)
    this.visible = visibleLines(display, cm.doc, viewport);
    this.editorIsHidden = !display.wrapper.offsetWidth;
    this.wrapperHeight = display.wrapper.clientHeight;
    this.wrapperWidth = display.wrapper.clientWidth;
    this.oldDisplayWidth = displayWidth(cm);
    this.force = force;
    this.dims = getDimensions(cm);
    this.events = [];
  }

  DisplayUpdate.prototype.signal = function(emitter, type) {
    if (hasHandler(emitter, type))
      this.events.push(arguments);
  };
  DisplayUpdate.prototype.finish = function() {
    for (var i = 0; i < this.events.length; i++)
      signal.apply(null, this.events[i]);
  };

  function maybeClipScrollbars(cm) {
    var display = cm.display;
    if (!display.scrollbarsClipped && display.scroller.offsetWidth) {
      display.nativeBarWidth = display.scroller.offsetWidth - display.scroller.clientWidth;
      display.heightForcer.style.height = scrollGap(cm) + "px";
      display.sizer.style.marginBottom = -display.nativeBarWidth + "px";
      display.sizer.style.borderRightWidth = scrollGap(cm) + "px";
      display.scrollbarsClipped = true;
    }
  }

  // Does the actual updating of the line display. Bails out
  // (returning false) when there is nothing to be done and forced is
  // false.
  function updateDisplayIfNeeded(cm, update) {
    var display = cm.display, doc = cm.doc;

    if (update.editorIsHidden) {
      resetView(cm);
      return false;
    }

    // Bail out if the visible area is already rendered and nothing changed.
    if (!update.force &&
        update.visible.from >= display.viewFrom && update.visible.to <= display.viewTo &&
        (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo) &&
        display.renderedView == display.view && countDirtyView(cm) == 0)
      return false;

    if (maybeUpdateLineNumberWidth(cm)) {
      resetView(cm);
      update.dims = getDimensions(cm);
    }

    // Compute a suitable new viewport (from & to)
    var end = doc.first + doc.size;
    var from = Math.max(update.visible.from - cm.options.viewportMargin, doc.first);
    var to = Math.min(end, update.visible.to + cm.options.viewportMargin);
    if (display.viewFrom < from && from - display.viewFrom < 20) from = Math.max(doc.first, display.viewFrom);
    if (display.viewTo > to && display.viewTo - to < 20) to = Math.min(end, display.viewTo);
    if (sawCollapsedSpans) {
      from = visualLineNo(cm.doc, from);
      to = visualLineEndNo(cm.doc, to);
    }

    var different = from != display.viewFrom || to != display.viewTo ||
      display.lastWrapHeight != update.wrapperHeight || display.lastWrapWidth != update.wrapperWidth;
    adjustView(cm, from, to);

    display.viewOffset = heightAtLine(getLine(cm.doc, display.viewFrom));
    // Position the mover div to align with the current scroll position
    cm.display.mover.style.top = display.viewOffset + "px";

    var toUpdate = countDirtyView(cm);
    if (!different && toUpdate == 0 && !update.force && display.renderedView == display.view &&
        (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo))
      return false;

    // For big changes, we hide the enclosing element during the
    // update, since that speeds up the operations on most browsers.
    var focused = activeElt();
    if (toUpdate > 4) display.lineDiv.style.display = "none";
    patchDisplay(cm, display.updateLineNumbers, update.dims);
    if (toUpdate > 4) display.lineDiv.style.display = "";
    display.renderedView = display.view;
    // There might have been a widget with a focused element that got
    // hidden or updated, if so re-focus it.
    if (focused && activeElt() != focused && focused.offsetHeight) focused.focus();

    // Prevent selection and cursors from interfering with the scroll
    // width and height.
    removeChildren(display.cursorDiv);
    removeChildren(display.selectionDiv);
    display.gutters.style.height = display.sizer.style.minHeight = 0;

    if (different) {
      display.lastWrapHeight = update.wrapperHeight;
      display.lastWrapWidth = update.wrapperWidth;
      startWorker(cm, 400);
    }

    display.updateLineNumbers = null;

    return true;
  }

  function postUpdateDisplay(cm, update) {
    var viewport = update.viewport;
    for (var first = true;; first = false) {
      if (!first || !cm.options.lineWrapping || update.oldDisplayWidth == displayWidth(cm)) {
        // Clip forced viewport to actual scrollable area.
        if (viewport && viewport.top != null)
          viewport = {top: Math.min(cm.doc.height + paddingVert(cm.display) - displayHeight(cm), viewport.top)};
        // Updated line heights might result in the drawn area not
        // actually covering the viewport. Keep looping until it does.
        update.visible = visibleLines(cm.display, cm.doc, viewport);
        if (update.visible.from >= cm.display.viewFrom && update.visible.to <= cm.display.viewTo)
          break;
      }
      if (!updateDisplayIfNeeded(cm, update)) break;
      updateHeightsInViewport(cm);
      var barMeasure = measureForScrollbars(cm);
      updateSelection(cm);
      setDocumentHeight(cm, barMeasure);
      updateScrollbars(cm, barMeasure);
    }

    update.signal(cm, "update", cm);
    if (cm.display.viewFrom != cm.display.reportedViewFrom || cm.display.viewTo != cm.display.reportedViewTo) {
      update.signal(cm, "viewportChange", cm, cm.display.viewFrom, cm.display.viewTo);
      cm.display.reportedViewFrom = cm.display.viewFrom; cm.display.reportedViewTo = cm.display.viewTo;
    }
  }

  function updateDisplaySimple(cm, viewport) {
    var update = new DisplayUpdate(cm, viewport);
    if (updateDisplayIfNeeded(cm, update)) {
      updateHeightsInViewport(cm);
      postUpdateDisplay(cm, update);
      var barMeasure = measureForScrollbars(cm);
      updateSelection(cm);
      setDocumentHeight(cm, barMeasure);
      updateScrollbars(cm, barMeasure);
      update.finish();
    }
  }

  function setDocumentHeight(cm, measure) {
    cm.display.sizer.style.minHeight = measure.docHeight + "px";
    var total = measure.docHeight + cm.display.barHeight;
    cm.display.heightForcer.style.top = total + "px";
    cm.display.gutters.style.height = Math.max(total + scrollGap(cm), measure.clientHeight) + "px";
  }

  // Read the actual heights of the rendered lines, and update their
  // stored heights to match.
  function updateHeightsInViewport(cm) {
    var display = cm.display;
    var prevBottom = display.lineDiv.offsetTop;
    for (var i = 0; i < display.view.length; i++) {
      var cur = display.view[i], height;
      if (cur.hidden) continue;
      if (ie && ie_version < 8) {
        var bot = cur.node.offsetTop + cur.node.offsetHeight;
        height = bot - prevBottom;
        prevBottom = bot;
      } else {
        var box = cur.node.getBoundingClientRect();
        height = box.bottom - box.top;
      }
      var diff = cur.line.height - height;
      if (height < 2) height = textHeight(display);
      if (diff > .001 || diff < -.001) {
        updateLineHeight(cur.line, height);
        updateWidgetHeight(cur.line);
        if (cur.rest) for (var j = 0; j < cur.rest.length; j++)
          updateWidgetHeight(cur.rest[j]);
      }
    }
  }

  // Read and store the height of line widgets associated with the
  // given line.
  function updateWidgetHeight(line) {
    if (line.widgets) for (var i = 0; i < line.widgets.length; ++i)
      line.widgets[i].height = line.widgets[i].node.offsetHeight;
  }

  // Do a bulk-read of the DOM positions and sizes needed to draw the
  // view, so that we don't interleave reading and writing to the DOM.
  function getDimensions(cm) {
    var d = cm.display, left = {}, width = {};
    var gutterLeft = d.gutters.clientLeft;
    for (var n = d.gutters.firstChild, i = 0; n; n = n.nextSibling, ++i) {
      left[cm.options.gutters[i]] = n.offsetLeft + n.clientLeft + gutterLeft;
      width[cm.options.gutters[i]] = n.clientWidth;
    }
    return {fixedPos: compensateForHScroll(d),
            gutterTotalWidth: d.gutters.offsetWidth,
            gutterLeft: left,
            gutterWidth: width,
            wrapperWidth: d.wrapper.clientWidth};
  }

  // Sync the actual display DOM structure with display.view, removing
  // nodes for lines that are no longer in view, and creating the ones
  // that are not there yet, and updating the ones that are out of
  // date.
  function patchDisplay(cm, updateNumbersFrom, dims) {
    var display = cm.display, lineNumbers = cm.options.lineNumbers;
    var container = display.lineDiv, cur = container.firstChild;

    function rm(node) {
      var next = node.nextSibling;
      // Works around a throw-scroll bug in OS X Webkit
      if (webkit && mac && cm.display.currentWheelTarget == node)
        node.style.display = "none";
      else
        node.parentNode.removeChild(node);
      return next;
    }

    var view = display.view, lineN = display.viewFrom;
    // Loop over the elements in the view, syncing cur (the DOM nodes
    // in display.lineDiv) with the view as we go.
    for (var i = 0; i < view.length; i++) {
      var lineView = view[i];
      if (lineView.hidden) {
      } else if (!lineView.node || lineView.node.parentNode != container) { // Not drawn yet
        var node = buildLineElement(cm, lineView, lineN, dims);
        container.insertBefore(node, cur);
      } else { // Already drawn
        while (cur != lineView.node) cur = rm(cur);
        var updateNumber = lineNumbers && updateNumbersFrom != null &&
          updateNumbersFrom <= lineN && lineView.lineNumber;
        if (lineView.changes) {
          if (indexOf(lineView.changes, "gutter") > -1) updateNumber = false;
          updateLineForChanges(cm, lineView, lineN, dims);
        }
        if (updateNumber) {
          removeChildren(lineView.lineNumber);
          lineView.lineNumber.appendChild(document.createTextNode(lineNumberFor(cm.options, lineN)));
        }
        cur = lineView.node.nextSibling;
      }
      lineN += lineView.size;
    }
    while (cur) cur = rm(cur);
  }

  // When an aspect of a line changes, a string is added to
  // lineView.changes. This updates the relevant part of the line's
  // DOM structure.
  function updateLineForChanges(cm, lineView, lineN, dims) {
    for (var j = 0; j < lineView.changes.length; j++) {
      var type = lineView.changes[j];
      if (type == "text") updateLineText(cm, lineView);
      else if (type == "gutter") updateLineGutter(cm, lineView, lineN, dims);
      else if (type == "class") updateLineClasses(lineView);
      else if (type == "widget") updateLineWidgets(cm, lineView, dims);
    }
    lineView.changes = null;
  }

  // Lines with gutter elements, widgets or a background class need to
  // be wrapped, and have the extra elements added to the wrapper div
  function ensureLineWrapped(lineView) {
    if (lineView.node == lineView.text) {
      lineView.node = elt("div", null, null, "position: relative");
      if (lineView.text.parentNode)
        lineView.text.parentNode.replaceChild(lineView.node, lineView.text);
      lineView.node.appendChild(lineView.text);
      if (ie && ie_version < 8) lineView.node.style.zIndex = 2;
    }
    return lineView.node;
  }

  function updateLineBackground(lineView) {
    var cls = lineView.bgClass ? lineView.bgClass + " " + (lineView.line.bgClass || "") : lineView.line.bgClass;
    if (cls) cls += " CodeMirror-linebackground";
    if (lineView.background) {
      if (cls) lineView.background.className = cls;
      else { lineView.background.parentNode.removeChild(lineView.background); lineView.background = null; }
    } else if (cls) {
      var wrap = ensureLineWrapped(lineView);
      lineView.background = wrap.insertBefore(elt("div", null, cls), wrap.firstChild);
    }
  }

  // Wrapper around buildLineContent which will reuse the structure
  // in display.externalMeasured when possible.
  function getLineContent(cm, lineView) {
    var ext = cm.display.externalMeasured;
    if (ext && ext.line == lineView.line) {
      cm.display.externalMeasured = null;
      lineView.measure = ext.measure;
      return ext.built;
    }
    return buildLineContent(cm, lineView);
  }

  // Redraw the line's text. Interacts with the background and text
  // classes because the mode may output tokens that influence these
  // classes.
  function updateLineText(cm, lineView) {
    var cls = lineView.text.className;
    var built = getLineContent(cm, lineView);
    if (lineView.text == lineView.node) lineView.node = built.pre;
    lineView.text.parentNode.replaceChild(built.pre, lineView.text);
    lineView.text = built.pre;
    if (built.bgClass != lineView.bgClass || built.textClass != lineView.textClass) {
      lineView.bgClass = built.bgClass;
      lineView.textClass = built.textClass;
      updateLineClasses(lineView);
    } else if (cls) {
      lineView.text.className = cls;
    }
  }

  function updateLineClasses(lineView) {
    updateLineBackground(lineView);
    if (lineView.line.wrapClass)
      ensureLineWrapped(lineView).className = lineView.line.wrapClass;
    else if (lineView.node != lineView.text)
      lineView.node.className = "";
    var textClass = lineView.textClass ? lineView.textClass + " " + (lineView.line.textClass || "") : lineView.line.textClass;
    lineView.text.className = textClass || "";
  }

  function updateLineGutter(cm, lineView, lineN, dims) {
    if (lineView.gutter) {
      lineView.node.removeChild(lineView.gutter);
      lineView.gutter = null;
    }
    if (lineView.gutterBackground) {
      lineView.node.removeChild(lineView.gutterBackground);
      lineView.gutterBackground = null;
    }
    if (lineView.line.gutterClass) {
      var wrap = ensureLineWrapped(lineView);
      lineView.gutterBackground = elt("div", null, "CodeMirror-gutter-background " + lineView.line.gutterClass,
                                      "left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) +
                                      "px; width: " + dims.gutterTotalWidth + "px");
      wrap.insertBefore(lineView.gutterBackground, lineView.text);
    }
    var markers = lineView.line.gutterMarkers;
    if (cm.options.lineNumbers || markers) {
      var wrap = ensureLineWrapped(lineView);
      var gutterWrap = lineView.gutter = elt("div", null, "CodeMirror-gutter-wrapper", "left: " +
                                             (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px");
      cm.display.input.setUneditable(gutterWrap);
      wrap.insertBefore(gutterWrap, lineView.text);
      if (lineView.line.gutterClass)
        gutterWrap.className += " " + lineView.line.gutterClass;
      if (cm.options.lineNumbers && (!markers || !markers["CodeMirror-linenumbers"]))
        lineView.lineNumber = gutterWrap.appendChild(
          elt("div", lineNumberFor(cm.options, lineN),
              "CodeMirror-linenumber CodeMirror-gutter-elt",
              "left: " + dims.gutterLeft["CodeMirror-linenumbers"] + "px; width: "
              + cm.display.lineNumInnerWidth + "px"));
      if (markers) for (var k = 0; k < cm.options.gutters.length; ++k) {
        var id = cm.options.gutters[k], found = markers.hasOwnProperty(id) && markers[id];
        if (found)
          gutterWrap.appendChild(elt("div", [found], "CodeMirror-gutter-elt", "left: " +
                                     dims.gutterLeft[id] + "px; width: " + dims.gutterWidth[id] + "px"));
      }
    }
  }

  function updateLineWidgets(cm, lineView, dims) {
    if (lineView.alignable) lineView.alignable = null;
    for (var node = lineView.node.firstChild, next; node; node = next) {
      var next = node.nextSibling;
      if (node.className == "CodeMirror-linewidget")
        lineView.node.removeChild(node);
    }
    insertLineWidgets(cm, lineView, dims);
  }

  // Build a line's DOM representation from scratch
  function buildLineElement(cm, lineView, lineN, dims) {
    var built = getLineContent(cm, lineView);
    lineView.text = lineView.node = built.pre;
    if (built.bgClass) lineView.bgClass = built.bgClass;
    if (built.textClass) lineView.textClass = built.textClass;

    updateLineClasses(lineView);
    updateLineGutter(cm, lineView, lineN, dims);
    insertLineWidgets(cm, lineView, dims);
    return lineView.node;
  }

  // A lineView may contain multiple logical lines (when merged by
  // collapsed spans). The widgets for all of them need to be drawn.
  function insertLineWidgets(cm, lineView, dims) {
    insertLineWidgetsFor(cm, lineView.line, lineView, dims, true);
    if (lineView.rest) for (var i = 0; i < lineView.rest.length; i++)
      insertLineWidgetsFor(cm, lineView.rest[i], lineView, dims, false);
  }

  function insertLineWidgetsFor(cm, line, lineView, dims, allowAbove) {
    if (!line.widgets) return;
    var wrap = ensureLineWrapped(lineView);
    for (var i = 0, ws = line.widgets; i < ws.length; ++i) {
      var widget = ws[i], node = elt("div", [widget.node], "CodeMirror-linewidget");
      if (!widget.handleMouseEvents) node.setAttribute("cm-ignore-events", "true");
      positionLineWidget(widget, node, lineView, dims);
      cm.display.input.setUneditable(node);
      if (allowAbove && widget.above)
        wrap.insertBefore(node, lineView.gutter || lineView.text);
      else
        wrap.appendChild(node);
      signalLater(widget, "redraw");
    }
  }

  function positionLineWidget(widget, node, lineView, dims) {
    if (widget.noHScroll) {
      (lineView.alignable || (lineView.alignable = [])).push(node);
      var width = dims.wrapperWidth;
      node.style.left = dims.fixedPos + "px";
      if (!widget.coverGutter) {
        width -= dims.gutterTotalWidth;
        node.style.paddingLeft = dims.gutterTotalWidth + "px";
      }
      node.style.width = width + "px";
    }
    if (widget.coverGutter) {
      node.style.zIndex = 5;
      node.style.position = "relative";
      if (!widget.noHScroll) node.style.marginLeft = -dims.gutterTotalWidth + "px";
    }
  }

  // POSITION OBJECT

  // A Pos instance represents a position within the text.
  var Pos = CodeMirror.Pos = function(line, ch) {
    if (!(this instanceof Pos)) return new Pos(line, ch);
    this.line = line; this.ch = ch;
  };

  // Compare two positions, return 0 if they are the same, a negative
  // number when a is less, and a positive number otherwise.
  var cmp = CodeMirror.cmpPos = function(a, b) { return a.line - b.line || a.ch - b.ch; };

  function copyPos(x) {return Pos(x.line, x.ch);}
  function maxPos(a, b) { return cmp(a, b) < 0 ? b : a; }
  function minPos(a, b) { return cmp(a, b) < 0 ? a : b; }

  // INPUT HANDLING

  function ensureFocus(cm) {
    if (!cm.state.focused) { cm.display.input.focus(); onFocus(cm); }
  }

  function isReadOnly(cm) {
    return cm.options.readOnly || cm.doc.cantEdit;
  }

  // This will be set to an array of strings when copying, so that,
  // when pasting, we know what kind of selections the copied text
  // was made out of.
  var lastCopied = null;

  function applyTextInput(cm, inserted, deleted, sel, origin) {
    var doc = cm.doc;
    cm.display.shift = false;
    if (!sel) sel = doc.sel;

    var paste = cm.state.pasteIncoming || origin == "paste";
    var textLines = doc.splitLines(inserted), multiPaste = null;
    // When pasing N lines into N selections, insert one line per selection
    if (paste && sel.ranges.length > 1) {
      if (lastCopied && lastCopied.join("\n") == inserted) {
        if (sel.ranges.length % lastCopied.length == 0) {
          multiPaste = [];
          for (var i = 0; i < lastCopied.length; i++)
            multiPaste.push(doc.splitLines(lastCopied[i]));
        }
      } else if (textLines.length == sel.ranges.length) {
        multiPaste = map(textLines, function(l) { return [l]; });
      }
    }

    // Normal behavior is to insert the new text into every selection
    for (var i = sel.ranges.length - 1; i >= 0; i--) {
      var range = sel.ranges[i];
      var from = range.from(), to = range.to();
      if (range.empty()) {
        if (deleted && deleted > 0) // Handle deletion
          from = Pos(from.line, from.ch - deleted);
        else if (cm.state.overwrite && !paste) // Handle overwrite
          to = Pos(to.line, Math.min(getLine(doc, to.line).text.length, to.ch + lst(textLines).length));
      }
      var updateInput = cm.curOp.updateInput;
      var changeEvent = {from: from, to: to, text: multiPaste ? multiPaste[i % multiPaste.length] : textLines,
                         origin: origin || (paste ? "paste" : cm.state.cutIncoming ? "cut" : "+input")};
      makeChange(cm.doc, changeEvent);
      signalLater(cm, "inputRead", cm, changeEvent);
    }
    if (inserted && !paste)
      triggerElectric(cm, inserted);

    ensureCursorVisible(cm);
    cm.curOp.updateInput = updateInput;
    cm.curOp.typing = true;
    cm.state.pasteIncoming = cm.state.cutIncoming = false;
  }

  function handlePaste(e, cm) {
    var pasted = e.clipboardData && e.clipboardData.getData("text/plain");
    if (pasted) {
      e.preventDefault();
      if (!isReadOnly(cm) && !cm.options.disableInput)
        runInOp(cm, function() { applyTextInput(cm, pasted, 0, null, "paste"); });
      return true;
    }
  }

  function triggerElectric(cm, inserted) {
    // When an 'electric' character is inserted, immediately trigger a reindent
    if (!cm.options.electricChars || !cm.options.smartIndent) return;
    var sel = cm.doc.sel;

    for (var i = sel.ranges.length - 1; i >= 0; i--) {
      var range = sel.ranges[i];
      if (range.head.ch > 100 || (i && sel.ranges[i - 1].head.line == range.head.line)) continue;
      var mode = cm.getModeAt(range.head);
      var indented = false;
      if (mode.electricChars) {
        for (var j = 0; j < mode.electricChars.length; j++)
          if (inserted.indexOf(mode.electricChars.charAt(j)) > -1) {
            indented = indentLine(cm, range.head.line, "smart");
            break;
          }
      } else if (mode.electricInput) {
        if (mode.electricInput.test(getLine(cm.doc, range.head.line).text.slice(0, range.head.ch)))
          indented = indentLine(cm, range.head.line, "smart");
      }
      if (indented) signalLater(cm, "electricInput", cm, range.head.line);
    }
  }

  function copyableRanges(cm) {
    var text = [], ranges = [];
    for (var i = 0; i < cm.doc.sel.ranges.length; i++) {
      var line = cm.doc.sel.ranges[i].head.line;
      var lineRange = {anchor: Pos(line, 0), head: Pos(line + 1, 0)};
      ranges.push(lineRange);
      text.push(cm.getRange(lineRange.anchor, lineRange.head));
    }
    return {text: text, ranges: ranges};
  }

  function disableBrowserMagic(field) {
    field.setAttribute("autocorrect", "off");
    field.setAttribute("autocapitalize", "off");
    field.setAttribute("spellcheck", "false");
  }

  // TEXTAREA INPUT STYLE

  function TextareaInput(cm) {
    this.cm = cm;
    // See input.poll and input.reset
    this.prevInput = "";

    // Flag that indicates whether we expect input to appear real soon
    // now (after some event like 'keypress' or 'input') and are
    // polling intensively.
    this.pollingFast = false;
    // Self-resetting timeout for the poller
    this.polling = new Delayed();
    // Tracks when input.reset has punted to just putting a short
    // string into the textarea instead of the full selection.
    this.inaccurateSelection = false;
    // Used to work around IE issue with selection being forgotten when focus moves away from textarea
    this.hasSelection = false;
    this.composing = null;
  };

  function hiddenTextarea() {
    var te = elt("textarea", null, null, "position: absolute; padding: 0; width: 1px; height: 1em; outline: none");
    var div = elt("div", [te], null, "overflow: hidden; position: relative; width: 3px; height: 0px;");
    // The textarea is kept positioned near the cursor to prevent the
    // fact that it'll be scrolled into view on input from scrolling
    // our fake cursor out of view. On webkit, when wrap=off, paste is
    // very slow. So make the area wide instead.
    if (webkit) te.style.width = "1000px";
    else te.setAttribute("wrap", "off");
    // If border: 0; -- iOS fails to open keyboard (issue #1287)
    if (ios) te.style.border = "1px solid black";
    disableBrowserMagic(te);
    return div;
  }

  TextareaInput.prototype = copyObj({
    init: function(display) {
      var input = this, cm = this.cm;

      // Wraps and hides input textarea
      var div = this.wrapper = hiddenTextarea();
      // The semihidden textarea that is focused when the editor is
      // focused, and receives input.
      var te = this.textarea = div.firstChild;
      display.wrapper.insertBefore(div, display.wrapper.firstChild);

      // Needed to hide big blue blinking cursor on Mobile Safari (doesn't seem to work in iOS 8 anymore)
      if (ios) te.style.width = "0px";

      on(te, "input", function() {
        if (ie && ie_version >= 9 && input.hasSelection) input.hasSelection = null;
        input.poll();
      });

      on(te, "paste", function(e) {
        if (handlePaste(e, cm)) return true;

        cm.state.pasteIncoming = true;
        input.fastPoll();
      });

      function prepareCopyCut(e) {
        if (cm.somethingSelected()) {
          lastCopied = cm.getSelections();
          if (input.inaccurateSelection) {
            input.prevInput = "";
            input.inaccurateSelection = false;
            te.value = lastCopied.join("\n");
            selectInput(te);
          }
        } else if (!cm.options.lineWiseCopyCut) {
          return;
        } else {
          var ranges = copyableRanges(cm);
          lastCopied = ranges.text;
          if (e.type == "cut") {
            cm.setSelections(ranges.ranges, null, sel_dontScroll);
          } else {
            input.prevInput = "";
            te.value = ranges.text.join("\n");
            selectInput(te);
          }
        }
        if (e.type == "cut") cm.state.cutIncoming = true;
      }
      on(te, "cut", prepareCopyCut);
      on(te, "copy", prepareCopyCut);

      on(display.scroller, "paste", function(e) {
        if (eventInWidget(display, e)) return;
        cm.state.pasteIncoming = true;
        input.focus();
      });

      // Prevent normal selection in the editor (we handle our own)
      on(display.lineSpace, "selectstart", function(e) {
        if (!eventInWidget(display, e)) e_preventDefault(e);
      });

      on(te, "compositionstart", function() {
        var start = cm.getCursor("from");
        if (input.composing) input.composing.range.clear()
        input.composing = {
          start: start,
          range: cm.markText(start, cm.getCursor("to"), {className: "CodeMirror-composing"})
        };
      });
      on(te, "compositionend", function() {
        if (input.composing) {
          input.poll();
          input.composing.range.clear();
          input.composing = null;
        }
      });
    },

    prepareSelection: function() {
      // Redraw the selection and/or cursor
      var cm = this.cm, display = cm.display, doc = cm.doc;
      var result = prepareSelection(cm);

      // Move the hidden textarea near the cursor to prevent scrolling artifacts
      if (cm.options.moveInputWithCursor) {
        var headPos = cursorCoords(cm, doc.sel.primary().head, "div");
        var wrapOff = display.wrapper.getBoundingClientRect(), lineOff = display.lineDiv.getBoundingClientRect();
        result.teTop = Math.max(0, Math.min(display.wrapper.clientHeight - 10,
                                            headPos.top + lineOff.top - wrapOff.top));
        result.teLeft = Math.max(0, Math.min(display.wrapper.clientWidth - 10,
                                             headPos.left + lineOff.left - wrapOff.left));
      }

      return result;
    },

    showSelection: function(drawn) {
      var cm = this.cm, display = cm.display;
      removeChildrenAndAdd(display.cursorDiv, drawn.cursors);
      removeChildrenAndAdd(display.selectionDiv, drawn.selection);
      if (drawn.teTop != null) {
        this.wrapper.style.top = drawn.teTop + "px";
        this.wrapper.style.left = drawn.teLeft + "px";
      }
    },

    // Reset the input to correspond to the selection (or to be empty,
    // when not typing and nothing is selected)
    reset: function(typing) {
      if (this.contextMenuPending) return;
      var minimal, selected, cm = this.cm, doc = cm.doc;
      if (cm.somethingSelected()) {
        this.prevInput = "";
        var range = doc.sel.primary();
        minimal = hasCopyEvent &&
          (range.to().line - range.from().line > 100 || (selected = cm.getSelection()).length > 1000);
        var content = minimal ? "-" : selected || cm.getSelection();
        this.textarea.value = content;
        if (cm.state.focused) selectInput(this.textarea);
        if (ie && ie_version >= 9) this.hasSelection = content;
      } else if (!typing) {
        this.prevInput = this.textarea.value = "";
        if (ie && ie_version >= 9) this.hasSelection = null;
      }
      this.inaccurateSelection = minimal;
    },

    getField: function() { return this.textarea; },

    supportsTouch: function() { return false; },

    focus: function() {
      if (this.cm.options.readOnly != "nocursor" && (!mobile || activeElt() != this.textarea)) {
        try { this.textarea.focus(); }
        catch (e) {} // IE8 will throw if the textarea is display: none or not in DOM
      }
    },

    blur: function() { this.textarea.blur(); },

    resetPosition: function() {
      this.wrapper.style.top = this.wrapper.style.left = 0;
    },

    receivedFocus: function() { this.slowPoll(); },

    // Poll for input changes, using the normal rate of polling. This
    // runs as long as the editor is focused.
    slowPoll: function() {
      var input = this;
      if (input.pollingFast) return;
      input.polling.set(this.cm.options.pollInterval, function() {
        input.poll();
        if (input.cm.state.focused) input.slowPoll();
      });
    },

    // When an event has just come in that is likely to add or change
    // something in the input textarea, we poll faster, to ensure that
    // the change appears on the screen quickly.
    fastPoll: function() {
      var missed = false, input = this;
      input.pollingFast = true;
      function p() {
        var changed = input.poll();
        if (!changed && !missed) {missed = true; input.polling.set(60, p);}
        else {input.pollingFast = false; input.slowPoll();}
      }
      input.polling.set(20, p);
    },

    // Read input from the textarea, and update the document to match.
    // When something is selected, it is present in the textarea, and
    // selected (unless it is huge, in which case a placeholder is
    // used). When nothing is selected, the cursor sits after previously
    // seen text (can be empty), which is stored in prevInput (we must
    // not reset the textarea when typing, because that breaks IME).
    poll: function() {
      var cm = this.cm, input = this.textarea, prevInput = this.prevInput;
      // Since this is called a *lot*, try to bail out as cheaply as
      // possible when it is clear that nothing happened. hasSelection
      // will be the case when there is a lot of text in the textarea,
      // in which case reading its value would be expensive.
      if (this.contextMenuPending || !cm.state.focused ||
          (hasSelection(input) && !prevInput && !this.composing) ||
          isReadOnly(cm) || cm.options.disableInput || cm.state.keySeq)
        return false;

      var text = input.value;
      // If nothing changed, bail.
      if (text == prevInput && !cm.somethingSelected()) return false;
      // Work around nonsensical selection resetting in IE9/10, and
      // inexplicable appearance of private area unicode characters on
      // some key combos in Mac (#2689).
      if (ie && ie_version >= 9 && this.hasSelection === text ||
          mac && /[\uf700-\uf7ff]/.test(text)) {
        cm.display.input.reset();
        return false;
      }

      if (cm.doc.sel == cm.display.selForContextMenu) {
        var first = text.charCodeAt(0);
        if (first == 0x200b && !prevInput) prevInput = "\u200b";
        if (first == 0x21da) { this.reset(); return this.cm.execCommand("undo"); }
      }
      // Find the part of the input that is actually new
      var same = 0, l = Math.min(prevInput.length, text.length);
      while (same < l && prevInput.charCodeAt(same) == text.charCodeAt(same)) ++same;

      var self = this;
      runInOp(cm, function() {
        applyTextInput(cm, text.slice(same), prevInput.length - same,
                       null, self.composing ? "*compose" : null);

        // Don't leave long text in the textarea, since it makes further polling slow
        if (text.length > 1000 || text.indexOf("\n") > -1) input.value = self.prevInput = "";
        else self.prevInput = text;

        if (self.composing) {
          self.composing.range.clear();
          self.composing.range = cm.markText(self.composing.start, cm.getCursor("to"),
                                             {className: "CodeMirror-composing"});
        }
      });
      return true;
    },

    ensurePolled: function() {
      if (this.pollingFast && this.poll()) this.pollingFast = false;
    },

    onKeyPress: function() {
      if (ie && ie_version >= 9) this.hasSelection = null;
      this.fastPoll();
    },

    onContextMenu: function(e) {
      var input = this, cm = input.cm, display = cm.display, te = input.textarea;
      var pos = posFromMouse(cm, e), scrollPos = display.scroller.scrollTop;
      if (!pos || presto) return; // Opera is difficult.

      // Reset the current text selection only if the click is done outside of the selection
      // and 'resetSelectionOnContextMenu' option is true.
      var reset = cm.options.resetSelectionOnContextMenu;
      if (reset && cm.doc.sel.contains(pos) == -1)
        operation(cm, setSelection)(cm.doc, simpleSelection(pos), sel_dontScroll);

      var oldCSS = te.style.cssText;
      input.wrapper.style.position = "absolute";
      te.style.cssText = "position: fixed; width: 30px; height: 30px; top: " + (e.clientY - 5) +
        "px; left: " + (e.clientX - 5) + "px; z-index: 1000; background: " +
        (ie ? "rgba(255, 255, 255, .05)" : "transparent") +
        "; outline: none; border-width: 0; outline: none; overflow: hidden; opacity: .05; filter: alpha(opacity=5);";
      if (webkit) var oldScrollY = window.scrollY; // Work around Chrome issue (#2712)
      display.input.focus();
      if (webkit) window.scrollTo(null, oldScrollY);
      display.input.reset();
      // Adds "Select all" to context menu in FF
      if (!cm.somethingSelected()) te.value = input.prevInput = " ";
      input.contextMenuPending = true;
      display.selForContextMenu = cm.doc.sel;
      clearTimeout(display.detectingSelectAll);

      // Select-all will be greyed out if there's nothing to select, so
      // this adds a zero-width space so that we can later check whether
      // it got selected.
      function prepareSelectAllHack() {
        if (te.selectionStart != null) {
          var selected = cm.somethingSelected();
          var extval = "\u200b" + (selected ? te.value : "");
          te.value = "\u21da"; // Used to catch context-menu undo
          te.value = extval;
          input.prevInput = selected ? "" : "\u200b";
          te.selectionStart = 1; te.selectionEnd = extval.length;
          // Re-set this, in case some other handler touched the
          // selection in the meantime.
          display.selForContextMenu = cm.doc.sel;
        }
      }
      function rehide() {
        input.contextMenuPending = false;
        input.wrapper.style.position = "relative";
        te.style.cssText = oldCSS;
        if (ie && ie_version < 9) display.scrollbars.setScrollTop(display.scroller.scrollTop = scrollPos);

        // Try to detect the user choosing select-all
        if (te.selectionStart != null) {
          if (!ie || (ie && ie_version < 9)) prepareSelectAllHack();
          var i = 0, poll = function() {
            if (display.selForContextMenu == cm.doc.sel && te.selectionStart == 0 &&
                te.selectionEnd > 0 && input.prevInput == "\u200b")
              operation(cm, commands.selectAll)(cm);
            else if (i++ < 10) display.detectingSelectAll = setTimeout(poll, 500);
            else display.input.reset();
          };
          display.detectingSelectAll = setTimeout(poll, 200);
        }
      }

      if (ie && ie_version >= 9) prepareSelectAllHack();
      if (captureRightClick) {
        e_stop(e);
        var mouseup = function() {
          off(window, "mouseup", mouseup);
          setTimeout(rehide, 20);
        };
        on(window, "mouseup", mouseup);
      } else {
        setTimeout(rehide, 50);
      }
    },

    readOnlyChanged: function(val) {
      if (!val) this.reset();
    },

    setUneditable: nothing,

    needsContentAttribute: false
  }, TextareaInput.prototype);

  // CONTENTEDITABLE INPUT STYLE

  function ContentEditableInput(cm) {
    this.cm = cm;
    this.lastAnchorNode = this.lastAnchorOffset = this.lastFocusNode = this.lastFocusOffset = null;
    this.polling = new Delayed();
    this.gracePeriod = false;
  }

  ContentEditableInput.prototype = copyObj({
    init: function(display) {
      var input = this, cm = input.cm;
      var div = input.div = display.lineDiv;
      disableBrowserMagic(div);

      on(div, "paste", function(e) { handlePaste(e, cm); })

      on(div, "compositionstart", function(e) {
        var data = e.data;
        input.composing = {sel: cm.doc.sel, data: data, startData: data};
        if (!data) return;
        var prim = cm.doc.sel.primary();
        var line = cm.getLine(prim.head.line);
        var found = line.indexOf(data, Math.max(0, prim.head.ch - data.length));
        if (found > -1 && found <= prim.head.ch)
          input.composing.sel = simpleSelection(Pos(prim.head.line, found),
                                                Pos(prim.head.line, found + data.length));
      });
      on(div, "compositionupdate", function(e) {
        input.composing.data = e.data;
      });
      on(div, "compositionend", function(e) {
        var ours = input.composing;
        if (!ours) return;
        if (e.data != ours.startData && !/\u200b/.test(e.data))
          ours.data = e.data;
        // Need a small delay to prevent other code (input event,
        // selection polling) from doing damage when fired right after
        // compositionend.
        setTimeout(function() {
          if (!ours.handled)
            input.applyComposition(ours);
          if (input.composing == ours)
            input.composing = null;
        }, 50);
      });

      on(div, "touchstart", function() {
        input.forceCompositionEnd();
      });

      on(div, "input", function() {
        if (input.composing) return;
        if (isReadOnly(cm) || !input.pollContent())
          runInOp(input.cm, function() {regChange(cm);});
      });

      function onCopyCut(e) {
        if (cm.somethingSelected()) {
          lastCopied = cm.getSelections();
          if (e.type == "cut") cm.replaceSelection("", null, "cut");
        } else if (!cm.options.lineWiseCopyCut) {
          return;
        } else {
          var ranges = copyableRanges(cm);
          lastCopied = ranges.text;
          if (e.type == "cut") {
            cm.operation(function() {
              cm.setSelections(ranges.ranges, 0, sel_dontScroll);
              cm.replaceSelection("", null, "cut");
            });
          }
        }
        // iOS exposes the clipboard API, but seems to discard content inserted into it
        if (e.clipboardData && !ios) {
          e.preventDefault();
          e.clipboardData.clearData();
          e.clipboardData.setData("text/plain", lastCopied.join("\n"));
        } else {
          // Old-fashioned briefly-focus-a-textarea hack
          var kludge = hiddenTextarea(), te = kludge.firstChild;
          cm.display.lineSpace.insertBefore(kludge, cm.display.lineSpace.firstChild);
          te.value = lastCopied.join("\n");
          var hadFocus = document.activeElement;
          selectInput(te);
          setTimeout(function() {
            cm.display.lineSpace.removeChild(kludge);
            hadFocus.focus();
          }, 50);
        }
      }
      on(div, "copy", onCopyCut);
      on(div, "cut", onCopyCut);
    },

    prepareSelection: function() {
      var result = prepareSelection(this.cm, false);
      result.focus = this.cm.state.focused;
      return result;
    },

    showSelection: function(info) {
      if (!info || !this.cm.display.view.length) return;
      if (info.focus) this.showPrimarySelection();
      this.showMultipleSelections(info);
    },

    showPrimarySelection: function() {
      var sel = window.getSelection(), prim = this.cm.doc.sel.primary();
      var curAnchor = domToPos(this.cm, sel.anchorNode, sel.anchorOffset);
      var curFocus = domToPos(this.cm, sel.focusNode, sel.focusOffset);
      if (curAnchor && !curAnchor.bad && curFocus && !curFocus.bad &&
          cmp(minPos(curAnchor, curFocus), prim.from()) == 0 &&
          cmp(maxPos(curAnchor, curFocus), prim.to()) == 0)
        return;

      var start = posToDOM(this.cm, prim.from());
      var end = posToDOM(this.cm, prim.to());
      if (!start && !end) return;

      var view = this.cm.display.view;
      var old = sel.rangeCount && sel.getRangeAt(0);
      if (!start) {
        start = {node: view[0].measure.map[2], offset: 0};
      } else if (!end) { // FIXME dangerously hacky
        var measure = view[view.length - 1].measure;
        var map = measure.maps ? measure.maps[measure.maps.length - 1] : measure.map;
        end = {node: map[map.length - 1], offset: map[map.length - 2] - map[map.length - 3]};
      }

      try { var rng = range(start.node, start.offset, end.offset, end.node); }
      catch(e) {} // Our model of the DOM might be outdated, in which case the range we try to set can be impossible
      if (rng) {
        sel.removeAllRanges();
        sel.addRange(rng);
        if (old && sel.anchorNode == null) sel.addRange(old);
        else if (gecko) this.startGracePeriod();
      }
      this.rememberSelection();
    },

    startGracePeriod: function() {
      var input = this;
      clearTimeout(this.gracePeriod);
      this.gracePeriod = setTimeout(function() {
        input.gracePeriod = false;
        if (input.selectionChanged())
          input.cm.operation(function() { input.cm.curOp.selectionChanged = true; });
      }, 20);
    },

    showMultipleSelections: function(info) {
      removeChildrenAndAdd(this.cm.display.cursorDiv, info.cursors);
      removeChildrenAndAdd(this.cm.display.selectionDiv, info.selection);
    },

    rememberSelection: function() {
      var sel = window.getSelection();
      this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset;
      this.lastFocusNode = sel.focusNode; this.lastFocusOffset = sel.focusOffset;
    },

    selectionInEditor: function() {
      var sel = window.getSelection();
      if (!sel.rangeCount) return false;
      var node = sel.getRangeAt(0).commonAncestorContainer;
      return contains(this.div, node);
    },

    focus: function() {
      if (this.cm.options.readOnly != "nocursor") this.div.focus();
    },
    blur: function() { this.div.blur(); },
    getField: function() { return this.div; },

    supportsTouch: function() { return true; },

    receivedFocus: function() {
      var input = this;
      if (this.selectionInEditor())
        this.pollSelection();
      else
        runInOp(this.cm, function() { input.cm.curOp.selectionChanged = true; });

      function poll() {
        if (input.cm.state.focused) {
          input.pollSelection();
          input.polling.set(input.cm.options.pollInterval, poll);
        }
      }
      this.polling.set(this.cm.options.pollInterval, poll);
    },

    selectionChanged: function() {
      var sel = window.getSelection();
      return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
        sel.focusNode != this.lastFocusNode || sel.focusOffset != this.lastFocusOffset;
    },

    pollSelection: function() {
      if (!this.composing && !this.gracePeriod && this.selectionChanged()) {
        var sel = window.getSelection(), cm = this.cm;
        this.rememberSelection();
        var anchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
        var head = domToPos(cm, sel.focusNode, sel.focusOffset);
        if (anchor && head) runInOp(cm, function() {
          setSelection(cm.doc, simpleSelection(anchor, head), sel_dontScroll);
          if (anchor.bad || head.bad) cm.curOp.selectionChanged = true;
        });
      }
    },

    pollContent: function() {
      var cm = this.cm, display = cm.display, sel = cm.doc.sel.primary();
      var from = sel.from(), to = sel.to();
      if (from.line < display.viewFrom || to.line > display.viewTo - 1) return false;

      var fromIndex;
      if (from.line == display.viewFrom || (fromIndex = findViewIndex(cm, from.line)) == 0) {
        var fromLine = lineNo(display.view[0].line);
        var fromNode = display.view[0].node;
      } else {
        var fromLine = lineNo(display.view[fromIndex].line);
        var fromNode = display.view[fromIndex - 1].node.nextSibling;
      }
      var toIndex = findViewIndex(cm, to.line);
      if (toIndex == display.view.length - 1) {
        var toLine = display.viewTo - 1;
        var toNode = display.lineDiv.lastChild;
      } else {
        var toLine = lineNo(display.view[toIndex + 1].line) - 1;
        var toNode = display.view[toIndex + 1].node.previousSibling;
      }

      var newText = cm.doc.splitLines(domTextBetween(cm, fromNode, toNode, fromLine, toLine));
      var oldText = getBetween(cm.doc, Pos(fromLine, 0), Pos(toLine, getLine(cm.doc, toLine).text.length));
      while (newText.length > 1 && oldText.length > 1) {
        if (lst(newText) == lst(oldText)) { newText.pop(); oldText.pop(); toLine--; }
        else if (newText[0] == oldText[0]) { newText.shift(); oldText.shift(); fromLine++; }
        else break;
      }

      var cutFront = 0, cutEnd = 0;
      var newTop = newText[0], oldTop = oldText[0], maxCutFront = Math.min(newTop.length, oldTop.length);
      while (cutFront < maxCutFront && newTop.charCodeAt(cutFront) == oldTop.charCodeAt(cutFront))
        ++cutFront;
      var newBot = lst(newText), oldBot = lst(oldText);
      var maxCutEnd = Math.min(newBot.length - (newText.length == 1 ? cutFront : 0),
                               oldBot.length - (oldText.length == 1 ? cutFront : 0));
      while (cutEnd < maxCutEnd &&
             newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1))
        ++cutEnd;

      newText[newText.length - 1] = newBot.slice(0, newBot.length - cutEnd);
      newText[0] = newText[0].slice(cutFront);

      var chFrom = Pos(fromLine, cutFront);
      var chTo = Pos(toLine, oldText.length ? lst(oldText).length - cutEnd : 0);
      if (newText.length > 1 || newText[0] || cmp(chFrom, chTo)) {
        replaceRange(cm.doc, newText, chFrom, chTo, "+input");
        return true;
      }
    },

    ensurePolled: function() {
      this.forceCompositionEnd();
    },
    reset: function() {
      this.forceCompositionEnd();
    },
    forceCompositionEnd: function() {
      if (!this.composing || this.composing.handled) return;
      this.applyComposition(this.composing);
      this.composing.handled = true;
      this.div.blur();
      this.div.focus();
    },
    applyComposition: function(composing) {
      if (isReadOnly(this.cm))
        operation(this.cm, regChange)(this.cm)
      else if (composing.data && composing.data != composing.startData)
        operation(this.cm, applyTextInput)(this.cm, composing.data, 0, composing.sel);
    },

    setUneditable: function(node) {
      node.contentEditable = "false"
    },

    onKeyPress: function(e) {
      e.preventDefault();
      if (!isReadOnly(this.cm))
        operation(this.cm, applyTextInput)(this.cm, String.fromCharCode(e.charCode == null ? e.keyCode : e.charCode), 0);
    },

    readOnlyChanged: function(val) {
      this.div.contentEditable = String(val != "nocursor")
    },

    onContextMenu: nothing,
    resetPosition: nothing,

    needsContentAttribute: true
  }, ContentEditableInput.prototype);

  function posToDOM(cm, pos) {
    var view = findViewForLine(cm, pos.line);
    if (!view || view.hidden) return null;
    var line = getLine(cm.doc, pos.line);
    var info = mapFromLineView(view, line, pos.line);

    var order = getOrder(line), side = "left";
    if (order) {
      var partPos = getBidiPartAt(order, pos.ch);
      side = partPos % 2 ? "right" : "left";
    }
    var result = nodeAndOffsetInLineMap(info.map, pos.ch, side);
    result.offset = result.collapse == "right" ? result.end : result.start;
    return result;
  }

  function badPos(pos, bad) { if (bad) pos.bad = true; return pos; }

  function domToPos(cm, node, offset) {
    var lineNode;
    if (node == cm.display.lineDiv) {
      lineNode = cm.display.lineDiv.childNodes[offset];
      if (!lineNode) return badPos(cm.clipPos(Pos(cm.display.viewTo - 1)), true);
      node = null; offset = 0;
    } else {
      for (lineNode = node;; lineNode = lineNode.parentNode) {
        if (!lineNode || lineNode == cm.display.lineDiv) return null;
        if (lineNode.parentNode && lineNode.parentNode == cm.display.lineDiv) break;
      }
    }
    for (var i = 0; i < cm.display.view.length; i++) {
      var lineView = cm.display.view[i];
      if (lineView.node == lineNode)
        return locateNodeInLineView(lineView, node, offset);
    }
  }

  function locateNodeInLineView(lineView, node, offset) {
    var wrapper = lineView.text.firstChild, bad = false;
    if (!node || !contains(wrapper, node)) return badPos(Pos(lineNo(lineView.line), 0), true);
    if (node == wrapper) {
      bad = true;
      node = wrapper.childNodes[offset];
      offset = 0;
      if (!node) {
        var line = lineView.rest ? lst(lineView.rest) : lineView.line;
        return badPos(Pos(lineNo(line), line.text.length), bad);
      }
    }

    var textNode = node.nodeType == 3 ? node : null, topNode = node;
    if (!textNode && node.childNodes.length == 1 && node.firstChild.nodeType == 3) {
      textNode = node.firstChild;
      if (offset) offset = textNode.nodeValue.length;
    }
    while (topNode.parentNode != wrapper) topNode = topNode.parentNode;
    var measure = lineView.measure, maps = measure.maps;

    function find(textNode, topNode, offset) {
      for (var i = -1; i < (maps ? maps.length : 0); i++) {
        var map = i < 0 ? measure.map : maps[i];
        for (var j = 0; j < map.length; j += 3) {
          var curNode = map[j + 2];
          if (curNode == textNode || curNode == topNode) {
            var line = lineNo(i < 0 ? lineView.line : lineView.rest[i]);
            var ch = map[j] + offset;
            if (offset < 0 || curNode != textNode) ch = map[j + (offset ? 1 : 0)];
            return Pos(line, ch);
          }
        }
      }
    }
    var found = find(textNode, topNode, offset);
    if (found) return badPos(found, bad);

    // FIXME this is all really shaky. might handle the few cases it needs to handle, but likely to cause problems
    for (var after = topNode.nextSibling, dist = textNode ? textNode.nodeValue.length - offset : 0; after; after = after.nextSibling) {
      found = find(after, after.firstChild, 0);
      if (found)
        return badPos(Pos(found.line, found.ch - dist), bad);
      else
        dist += after.textContent.length;
    }
    for (var before = topNode.previousSibling, dist = offset; before; before = before.previousSibling) {
      found = find(before, before.firstChild, -1);
      if (found)
        return badPos(Pos(found.line, found.ch + dist), bad);
      else
        dist += after.textContent.length;
    }
  }

  function domTextBetween(cm, from, to, fromLine, toLine) {
    var text = "", closing = false, lineSep = cm.doc.lineSeparator();
    function recognizeMarker(id) { return function(marker) { return marker.id == id; }; }
    function walk(node) {
      if (node.nodeType == 1) {
        var cmText = node.getAttribute("cm-text");
        if (cmText != null) {
          if (cmText == "") cmText = node.textContent.replace(/\u200b/g, "");
          text += cmText;
          return;
        }
        var markerID = node.getAttribute("cm-marker"), range;
        if (markerID) {
          var found = cm.findMarks(Pos(fromLine, 0), Pos(toLine + 1, 0), recognizeMarker(+markerID));
          if (found.length && (range = found[0].find()))
            text += getBetween(cm.doc, range.from, range.to).join(lineSep);
          return;
        }
        if (node.getAttribute("contenteditable") == "false") return;
        for (var i = 0; i < node.childNodes.length; i++)
          walk(node.childNodes[i]);
        if (/^(pre|div|p)$/i.test(node.nodeName))
          closing = true;
      } else if (node.nodeType == 3) {
        var val = node.nodeValue;
        if (!val) return;
        if (closing) {
          text += lineSep;
          closing = false;
        }
        text += val;
      }
    }
    for (;;) {
      walk(from);
      if (from == to) break;
      from = from.nextSibling;
    }
    return text;
  }

  CodeMirror.inputStyles = {"textarea": TextareaInput, "contenteditable": ContentEditableInput};

  // SELECTION / CURSOR

  // Selection objects are immutable. A new one is created every time
  // the selection changes. A selection is one or more non-overlapping
  // (and non-touching) ranges, sorted, and an integer that indicates
  // which one is the primary selection (the one that's scrolled into
  // view, that getCursor returns, etc).
  function Selection(ranges, primIndex) {
    this.ranges = ranges;
    this.primIndex = primIndex;
  }

  Selection.prototype = {
    primary: function() { return this.ranges[this.primIndex]; },
    equals: function(other) {
      if (other == this) return true;
      if (other.primIndex != this.primIndex || other.ranges.length != this.ranges.length) return false;
      for (var i = 0; i < this.ranges.length; i++) {
        var here = this.ranges[i], there = other.ranges[i];
        if (cmp(here.anchor, there.anchor) != 0 || cmp(here.head, there.head) != 0) return false;
      }
      return true;
    },
    deepCopy: function() {
      for (var out = [], i = 0; i < this.ranges.length; i++)
        out[i] = new Range(copyPos(this.ranges[i].anchor), copyPos(this.ranges[i].head));
      return new Selection(out, this.primIndex);
    },
    somethingSelected: function() {
      for (var i = 0; i < this.ranges.length; i++)
        if (!this.ranges[i].empty()) return true;
      return false;
    },
    contains: function(pos, end) {
      if (!end) end = pos;
      for (var i = 0; i < this.ranges.length; i++) {
        var range = this.ranges[i];
        if (cmp(end, range.from()) >= 0 && cmp(pos, range.to()) <= 0)
          return i;
      }
      return -1;
    }
  };

  function Range(anchor, head) {
    this.anchor = anchor; this.head = head;
  }

  Range.prototype = {
    from: function() { return minPos(this.anchor, this.head); },
    to: function() { return maxPos(this.anchor, this.head); },
    empty: function() {
      return this.head.line == this.anchor.line && this.head.ch == this.anchor.ch;
    }
  };

  // Take an unsorted, potentially overlapping set of ranges, and
  // build a selection out of it. 'Consumes' ranges array (modifying
  // it).
  function normalizeSelection(ranges, primIndex) {
    var prim = ranges[primIndex];
    ranges.sort(function(a, b) { return cmp(a.from(), b.from()); });
    primIndex = indexOf(ranges, prim);
    for (var i = 1; i < ranges.length; i++) {
      var cur = ranges[i], prev = ranges[i - 1];
      if (cmp(prev.to(), cur.from()) >= 0) {
        var from = minPos(prev.from(), cur.from()), to = maxPos(prev.to(), cur.to());
        var inv = prev.empty() ? cur.from() == cur.head : prev.from() == prev.head;
        if (i <= primIndex) --primIndex;
        ranges.splice(--i, 2, new Range(inv ? to : from, inv ? from : to));
      }
    }
    return new Selection(ranges, primIndex);
  }

  function simpleSelection(anchor, head) {
    return new Selection([new Range(anchor, head || anchor)], 0);
  }

  // Most of the external API clips given positions to make sure they
  // actually exist within the document.
  function clipLine(doc, n) {return Math.max(doc.first, Math.min(n, doc.first + doc.size - 1));}
  function clipPos(doc, pos) {
    if (pos.line < doc.first) return Pos(doc.first, 0);
    var last = doc.first + doc.size - 1;
    if (pos.line > last) return Pos(last, getLine(doc, last).text.length);
    return clipToLen(pos, getLine(doc, pos.line).text.length);
  }
  function clipToLen(pos, linelen) {
    var ch = pos.ch;
    if (ch == null || ch > linelen) return Pos(pos.line, linelen);
    else if (ch < 0) return Pos(pos.line, 0);
    else return pos;
  }
  function isLine(doc, l) {return l >= doc.first && l < doc.first + doc.size;}
  function clipPosArray(doc, array) {
    for (var out = [], i = 0; i < array.length; i++) out[i] = clipPos(doc, array[i]);
    return out;
  }

  // SELECTION UPDATES

  // The 'scroll' parameter given to many of these indicated whether
  // the new cursor position should be scrolled into view after
  // modifying the selection.

  // If shift is held or the extend flag is set, extends a range to
  // include a given position (and optionally a second position).
  // Otherwise, simply returns the range between the given positions.
  // Used for cursor motion and such.
  function extendRange(doc, range, head, other) {
    if (doc.cm && doc.cm.display.shift || doc.extend) {
      var anchor = range.anchor;
      if (other) {
        var posBefore = cmp(head, anchor) < 0;
        if (posBefore != (cmp(other, anchor) < 0)) {
          anchor = head;
          head = other;
        } else if (posBefore != (cmp(head, other) < 0)) {
          head = other;
        }
      }
      return new Range(anchor, head);
    } else {
      return new Range(other || head, head);
    }
  }

  // Extend the primary selection range, discard the rest.
  function extendSelection(doc, head, other, options) {
    setSelection(doc, new Selection([extendRange(doc, doc.sel.primary(), head, other)], 0), options);
  }

  // Extend all selections (pos is an array of selections with length
  // equal the number of selections)
  function extendSelections(doc, heads, options) {
    for (var out = [], i = 0; i < doc.sel.ranges.length; i++)
      out[i] = extendRange(doc, doc.sel.ranges[i], heads[i], null);
    var newSel = normalizeSelection(out, doc.sel.primIndex);
    setSelection(doc, newSel, options);
  }

  // Updates a single range in the selection.
  function replaceOneSelection(doc, i, range, options) {
    var ranges = doc.sel.ranges.slice(0);
    ranges[i] = range;
    setSelection(doc, normalizeSelection(ranges, doc.sel.primIndex), options);
  }

  // Reset the selection to a single range.
  function setSimpleSelection(doc, anchor, head, options) {
    setSelection(doc, simpleSelection(anchor, head), options);
  }

  // Give beforeSelectionChange handlers a change to influence a
  // selection update.
  function filterSelectionChange(doc, sel) {
    var obj = {
      ranges: sel.ranges,
      update: function(ranges) {
        this.ranges = [];
        for (var i = 0; i < ranges.length; i++)
          this.ranges[i] = new Range(clipPos(doc, ranges[i].anchor),
                                     clipPos(doc, ranges[i].head));
      }
    };
    signal(doc, "beforeSelectionChange", doc, obj);
    if (doc.cm) signal(doc.cm, "beforeSelectionChange", doc.cm, obj);
    if (obj.ranges != sel.ranges) return normalizeSelection(obj.ranges, obj.ranges.length - 1);
    else return sel;
  }

  function setSelectionReplaceHistory(doc, sel, options) {
    var done = doc.history.done, last = lst(done);
    if (last && last.ranges) {
      done[done.length - 1] = sel;
      setSelectionNoUndo(doc, sel, options);
    } else {
      setSelection(doc, sel, options);
    }
  }

  // Set a new selection.
  function setSelection(doc, sel, options) {
    setSelectionNoUndo(doc, sel, options);
    addSelectionToHistory(doc, doc.sel, doc.cm ? doc.cm.curOp.id : NaN, options);
  }

  function setSelectionNoUndo(doc, sel, options) {
    if (hasHandler(doc, "beforeSelectionChange") || doc.cm && hasHandler(doc.cm, "beforeSelectionChange"))
      sel = filterSelectionChange(doc, sel);

    var bias = options && options.bias ||
      (cmp(sel.primary().head, doc.sel.primary().head) < 0 ? -1 : 1);
    setSelectionInner(doc, skipAtomicInSelection(doc, sel, bias, true));

    if (!(options && options.scroll === false) && doc.cm)
      ensureCursorVisible(doc.cm);
  }

  function setSelectionInner(doc, sel) {
    if (sel.equals(doc.sel)) return;

    doc.sel = sel;

    if (doc.cm) {
      doc.cm.curOp.updateInput = doc.cm.curOp.selectionChanged = true;
      signalCursorActivity(doc.cm);
    }
    signalLater(doc, "cursorActivity", doc);
  }

  // Verify that the selection does not partially select any atomic
  // marked ranges.
  function reCheckSelection(doc) {
    setSelectionInner(doc, skipAtomicInSelection(doc, doc.sel, null, false), sel_dontScroll);
  }

  // Return a selection that does not partially select any atomic
  // ranges.
  function skipAtomicInSelection(doc, sel, bias, mayClear) {
    var out;
    for (var i = 0; i < sel.ranges.length; i++) {
      var range = sel.ranges[i];
      var newAnchor = skipAtomic(doc, range.anchor, bias, mayClear);
      var newHead = skipAtomic(doc, range.head, bias, mayClear);
      if (out || newAnchor != range.anchor || newHead != range.head) {
        if (!out) out = sel.ranges.slice(0, i);
        out[i] = new Range(newAnchor, newHead);
      }
    }
    return out ? normalizeSelection(out, sel.primIndex) : sel;
  }

  // Ensure a given position is not inside an atomic range.
  function skipAtomic(doc, pos, bias, mayClear) {
    var flipped = false, curPos = pos;
    var dir = bias || 1;
    doc.cantEdit = false;
    search: for (;;) {
      var line = getLine(doc, curPos.line);
      if (line.markedSpans) {
        for (var i = 0; i < line.markedSpans.length; ++i) {
          var sp = line.markedSpans[i], m = sp.marker;
          if ((sp.from == null || (m.inclusiveLeft ? sp.from <= curPos.ch : sp.from < curPos.ch)) &&
              (sp.to == null || (m.inclusiveRight ? sp.to >= curPos.ch : sp.to > curPos.ch))) {
            if (mayClear) {
              signal(m, "beforeCursorEnter");
              if (m.explicitlyCleared) {
                if (!line.markedSpans) break;
                else {--i; continue;}
              }
            }
            if (!m.atomic) continue;
            var newPos = m.find(dir < 0 ? -1 : 1);
            if (cmp(newPos, curPos) == 0) {
              newPos.ch += dir;
              if (newPos.ch < 0) {
                if (newPos.line > doc.first) newPos = clipPos(doc, Pos(newPos.line - 1));
                else newPos = null;
              } else if (newPos.ch > line.text.length) {
                if (newPos.line < doc.first + doc.size - 1) newPos = Pos(newPos.line + 1, 0);
                else newPos = null;
              }
              if (!newPos) {
                if (flipped) {
                  // Driven in a corner -- no valid cursor position found at all
                  // -- try again *with* clearing, if we didn't already
                  if (!mayClear) return skipAtomic(doc, pos, bias, true);
                  // Otherwise, turn off editing until further notice, and return the start of the doc
                  doc.cantEdit = true;
                  return Pos(doc.first, 0);
                }
                flipped = true; newPos = pos; dir = -dir;
              }
            }
            curPos = newPos;
            continue search;
          }
        }
      }
      return curPos;
    }
  }

  // SELECTION DRAWING

  function updateSelection(cm) {
    cm.display.input.showSelection(cm.display.input.prepareSelection());
  }

  function prepareSelection(cm, primary) {
    var doc = cm.doc, result = {};
    var curFragment = result.cursors = document.createDocumentFragment();
    var selFragment = result.selection = document.createDocumentFragment();

    for (var i = 0; i < doc.sel.ranges.length; i++) {
      if (primary === false && i == doc.sel.primIndex) continue;
      var range = doc.sel.ranges[i];
      var collapsed = range.empty();
      if (collapsed || cm.options.showCursorWhenSelecting)
        drawSelectionCursor(cm, range.head, curFragment);
      if (!collapsed)
        drawSelectionRange(cm, range, selFragment);
    }
    return result;
  }

  // Draws a cursor for the given range
  function drawSelectionCursor(cm, head, output) {
    var pos = cursorCoords(cm, head, "div", null, null, !cm.options.singleCursorHeightPerLine);

    var cursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor"));
    cursor.style.left = pos.left + "px";
    cursor.style.top = pos.top + "px";
    cursor.style.height = Math.max(0, pos.bottom - pos.top) * cm.options.cursorHeight + "px";

    if (pos.other) {
      // Secondary cursor, shown when on a 'jump' in bi-directional text
      var otherCursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor CodeMirror-secondarycursor"));
      otherCursor.style.display = "";
      otherCursor.style.left = pos.other.left + "px";
      otherCursor.style.top = pos.other.top + "px";
      otherCursor.style.height = (pos.other.bottom - pos.other.top) * .85 + "px";
    }
  }

  // Draws the given range as a highlighted selection
  function drawSelectionRange(cm, range, output) {
    var display = cm.display, doc = cm.doc;
    var fragment = document.createDocumentFragment();
    var padding = paddingH(cm.display), leftSide = padding.left;
    var rightSide = Math.max(display.sizerWidth, displayWidth(cm) - display.sizer.offsetLeft) - padding.right;

    function add(left, top, width, bottom) {
      if (top < 0) top = 0;
      top = Math.round(top);
      bottom = Math.round(bottom);
      fragment.appendChild(elt("div", null, "CodeMirror-selected", "position: absolute; left: " + left +
                               "px; top: " + top + "px; width: " + (width == null ? rightSide - left : width) +
                               "px; height: " + (bottom - top) + "px"));
    }

    function drawForLine(line, fromArg, toArg) {
      var lineObj = getLine(doc, line);
      var lineLen = lineObj.text.length;
      var start, end;
      function coords(ch, bias) {
        return charCoords(cm, Pos(line, ch), "div", lineObj, bias);
      }

      iterateBidiSections(getOrder(lineObj), fromArg || 0, toArg == null ? lineLen : toArg, function(from, to, dir) {
        var leftPos = coords(from, "left"), rightPos, left, right;
        if (from == to) {
          rightPos = leftPos;
          left = right = leftPos.left;
        } else {
          rightPos = coords(to - 1, "right");
          if (dir == "rtl") { var tmp = leftPos; leftPos = rightPos; rightPos = tmp; }
          left = leftPos.left;
          right = rightPos.right;
        }
        if (fromArg == null && from == 0) left = leftSide;
        if (rightPos.top - leftPos.top > 3) { // Different lines, draw top part
          add(left, leftPos.top, null, leftPos.bottom);
          left = leftSide;
          if (leftPos.bottom < rightPos.top) add(left, leftPos.bottom, null, rightPos.top);
        }
        if (toArg == null && to == lineLen) right = rightSide;
        if (!start || leftPos.top < start.top || leftPos.top == start.top && leftPos.left < start.left)
          start = leftPos;
        if (!end || rightPos.bottom > end.bottom || rightPos.bottom == end.bottom && rightPos.right > end.right)
          end = rightPos;
        if (left < leftSide + 1) left = leftSide;
        add(left, rightPos.top, right - left, rightPos.bottom);
      });
      return {start: start, end: end};
    }

    var sFrom = range.from(), sTo = range.to();
    if (sFrom.line == sTo.line) {
      drawForLine(sFrom.line, sFrom.ch, sTo.ch);
    } else {
      var fromLine = getLine(doc, sFrom.line), toLine = getLine(doc, sTo.line);
      var singleVLine = visualLine(fromLine) == visualLine(toLine);
      var leftEnd = drawForLine(sFrom.line, sFrom.ch, singleVLine ? fromLine.text.length + 1 : null).end;
      var rightStart = drawForLine(sTo.line, singleVLine ? 0 : null, sTo.ch).start;
      if (singleVLine) {
        if (leftEnd.top < rightStart.top - 2) {
          add(leftEnd.right, leftEnd.top, null, leftEnd.bottom);
          add(leftSide, rightStart.top, rightStart.left, rightStart.bottom);
        } else {
          add(leftEnd.right, leftEnd.top, rightStart.left - leftEnd.right, leftEnd.bottom);
        }
      }
      if (leftEnd.bottom < rightStart.top)
        add(leftSide, leftEnd.bottom, null, rightStart.top);
    }

    output.appendChild(fragment);
  }

  // Cursor-blinking
  function restartBlink(cm) {
    if (!cm.state.focused) return;
    var display = cm.display;
    clearInterval(display.blinker);
    var on = true;
    display.cursorDiv.style.visibility = "";
    if (cm.options.cursorBlinkRate > 0)
      display.blinker = setInterval(function() {
        display.cursorDiv.style.visibility = (on = !on) ? "" : "hidden";
      }, cm.options.cursorBlinkRate);
    else if (cm.options.cursorBlinkRate < 0)
      display.cursorDiv.style.visibility = "hidden";
  }

  // HIGHLIGHT WORKER

  function startWorker(cm, time) {
    if (cm.doc.mode.startState && cm.doc.frontier < cm.display.viewTo)
      cm.state.highlight.set(time, bind(highlightWorker, cm));
  }

  function highlightWorker(cm) {
    var doc = cm.doc;
    if (doc.frontier < doc.first) doc.frontier = doc.first;
    if (doc.frontier >= cm.display.viewTo) return;
    var end = +new Date + cm.options.workTime;
    var state = copyState(doc.mode, getStateBefore(cm, doc.frontier));
    var changedLines = [];

    doc.iter(doc.frontier, Math.min(doc.first + doc.size, cm.display.viewTo + 500), function(line) {
      if (doc.frontier >= cm.display.viewFrom) { // Visible
        var oldStyles = line.styles, tooLong = line.text.length > cm.options.maxHighlightLength;
        var highlighted = highlightLine(cm, line, tooLong ? copyState(doc.mode, state) : state, true);
        line.styles = highlighted.styles;
        var oldCls = line.styleClasses, newCls = highlighted.classes;
        if (newCls) line.styleClasses = newCls;
        else if (oldCls) line.styleClasses = null;
        var ischange = !oldStyles || oldStyles.length != line.styles.length ||
          oldCls != newCls && (!oldCls || !newCls || oldCls.bgClass != newCls.bgClass || oldCls.textClass != newCls.textClass);
        for (var i = 0; !ischange && i < oldStyles.length; ++i) ischange = oldStyles[i] != line.styles[i];
        if (ischange) changedLines.push(doc.frontier);
        line.stateAfter = tooLong ? state : copyState(doc.mode, state);
      } else {
        if (line.text.length <= cm.options.maxHighlightLength)
          processLine(cm, line.text, state);
        line.stateAfter = doc.frontier % 5 == 0 ? copyState(doc.mode, state) : null;
      }
      ++doc.frontier;
      if (+new Date > end) {
        startWorker(cm, cm.options.workDelay);
        return true;
      }
    });
    if (changedLines.length) runInOp(cm, function() {
      for (var i = 0; i < changedLines.length; i++)
        regLineChange(cm, changedLines[i], "text");
    });
  }

  // Finds the line to start with when starting a parse. Tries to
  // find a line with a stateAfter, so that it can start with a
  // valid state. If that fails, it returns the line with the
  // smallest indentation, which tends to need the least context to
  // parse correctly.
  function findStartLine(cm, n, precise) {
    var minindent, minline, doc = cm.doc;
    var lim = precise ? -1 : n - (cm.doc.mode.innerMode ? 1000 : 100);
    for (var search = n; search > lim; --search) {
      if (search <= doc.first) return doc.first;
      var line = getLine(doc, search - 1);
      if (line.stateAfter && (!precise || search <= doc.frontier)) return search;
      var indented = countColumn(line.text, null, cm.options.tabSize);
      if (minline == null || minindent > indented) {
        minline = search - 1;
        minindent = indented;
      }
    }
    return minline;
  }

  function getStateBefore(cm, n, precise) {
    var doc = cm.doc, display = cm.display;
    if (!doc.mode.startState) return true;
    var pos = findStartLine(cm, n, precise), state = pos > doc.first && getLine(doc, pos-1).stateAfter;
    if (!state) state = startState(doc.mode);
    else state = copyState(doc.mode, state);
    doc.iter(pos, n, function(line) {
      processLine(cm, line.text, state);
      var save = pos == n - 1 || pos % 5 == 0 || pos >= display.viewFrom && pos < display.viewTo;
      line.stateAfter = save ? copyState(doc.mode, state) : null;
      ++pos;
    });
    if (precise) doc.frontier = pos;
    return state;
  }

  // POSITION MEASUREMENT

  function paddingTop(display) {return display.lineSpace.offsetTop;}
  function paddingVert(display) {return display.mover.offsetHeight - display.lineSpace.offsetHeight;}
  function paddingH(display) {
    if (display.cachedPaddingH) return display.cachedPaddingH;
    var e = removeChildrenAndAdd(display.measure, elt("pre", "x"));
    var style = window.getComputedStyle ? window.getComputedStyle(e) : e.currentStyle;
    var data = {left: parseInt(style.paddingLeft), right: parseInt(style.paddingRight)};
    if (!isNaN(data.left) && !isNaN(data.right)) display.cachedPaddingH = data;
    return data;
  }

  function scrollGap(cm) { return scrollerGap - cm.display.nativeBarWidth; }
  function displayWidth(cm) {
    return cm.display.scroller.clientWidth - scrollGap(cm) - cm.display.barWidth;
  }
  function displayHeight(cm) {
    return cm.display.scroller.clientHeight - scrollGap(cm) - cm.display.barHeight;
  }

  // Ensure the lineView.wrapping.heights array is populated. This is
  // an array of bottom offsets for the lines that make up a drawn
  // line. When lineWrapping is on, there might be more than one
  // height.
  function ensureLineHeights(cm, lineView, rect) {
    var wrapping = cm.options.lineWrapping;
    var curWidth = wrapping && displayWidth(cm);
    if (!lineView.measure.heights || wrapping && lineView.measure.width != curWidth) {
      var heights = lineView.measure.heights = [];
      if (wrapping) {
        lineView.measure.width = curWidth;
        var rects = lineView.text.firstChild.getClientRects();
        for (var i = 0; i < rects.length - 1; i++) {
          var cur = rects[i], next = rects[i + 1];
          if (Math.abs(cur.bottom - next.bottom) > 2)
            heights.push((cur.bottom + next.top) / 2 - rect.top);
        }
      }
      heights.push(rect.bottom - rect.top);
    }
  }

  // Find a line map (mapping character offsets to text nodes) and a
  // measurement cache for the given line number. (A line view might
  // contain multiple lines when collapsed ranges are present.)
  function mapFromLineView(lineView, line, lineN) {
    if (lineView.line == line)
      return {map: lineView.measure.map, cache: lineView.measure.cache};
    for (var i = 0; i < lineView.rest.length; i++)
      if (lineView.rest[i] == line)
        return {map: lineView.measure.maps[i], cache: lineView.measure.caches[i]};
    for (var i = 0; i < lineView.rest.length; i++)
      if (lineNo(lineView.rest[i]) > lineN)
        return {map: lineView.measure.maps[i], cache: lineView.measure.caches[i], before: true};
  }

  // Render a line into the hidden node display.externalMeasured. Used
  // when measurement is needed for a line that's not in the viewport.
  function updateExternalMeasurement(cm, line) {
    line = visualLine(line);
    var lineN = lineNo(line);
    var view = cm.display.externalMeasured = new LineView(cm.doc, line, lineN);
    view.lineN = lineN;
    var built = view.built = buildLineContent(cm, view);
    view.text = built.pre;
    removeChildrenAndAdd(cm.display.lineMeasure, built.pre);
    return view;
  }

  // Get a {top, bottom, left, right} box (in line-local coordinates)
  // for a given character.
  function measureChar(cm, line, ch, bias) {
    return measureCharPrepared(cm, prepareMeasureForLine(cm, line), ch, bias);
  }

  // Find a line view that corresponds to the given line number.
  function findViewForLine(cm, lineN) {
    if (lineN >= cm.display.viewFrom && lineN < cm.display.viewTo)
      return cm.display.view[findViewIndex(cm, lineN)];
    var ext = cm.display.externalMeasured;
    if (ext && lineN >= ext.lineN && lineN < ext.lineN + ext.size)
      return ext;
  }

  // Measurement can be split in two steps, the set-up work that
  // applies to the whole line, and the measurement of the actual
  // character. Functions like coordsChar, that need to do a lot of
  // measurements in a row, can thus ensure that the set-up work is
  // only done once.
  function prepareMeasureForLine(cm, line) {
    var lineN = lineNo(line);
    var view = findViewForLine(cm, lineN);
    if (view && !view.text) {
      view = null;
    } else if (view && view.changes) {
      updateLineForChanges(cm, view, lineN, getDimensions(cm));
      cm.curOp.forceUpdate = true;
    }
    if (!view)
      view = updateExternalMeasurement(cm, line);

    var info = mapFromLineView(view, line, lineN);
    return {
      line: line, view: view, rect: null,
      map: info.map, cache: info.cache, before: info.before,
      hasHeights: false
    };
  }

  // Given a prepared measurement object, measures the position of an
  // actual character (or fetches it from the cache).
  function measureCharPrepared(cm, prepared, ch, bias, varHeight) {
    if (prepared.before) ch = -1;
    var key = ch + (bias || ""), found;
    if (prepared.cache.hasOwnProperty(key)) {
      found = prepared.cache[key];
    } else {
      if (!prepared.rect)
        prepared.rect = prepared.view.text.getBoundingClientRect();
      if (!prepared.hasHeights) {
        ensureLineHeights(cm, prepared.view, prepared.rect);
        prepared.hasHeights = true;
      }
      found = measureCharInner(cm, prepared, ch, bias);
      if (!found.bogus) prepared.cache[key] = found;
    }
    return {left: found.left, right: found.right,
            top: varHeight ? found.rtop : found.top,
            bottom: varHeight ? found.rbottom : found.bottom};
  }

  var nullRect = {left: 0, right: 0, top: 0, bottom: 0};

  function nodeAndOffsetInLineMap(map, ch, bias) {
    var node, start, end, collapse;
    // First, search the line map for the text node corresponding to,
    // or closest to, the target character.
    for (var i = 0; i < map.length; i += 3) {
      var mStart = map[i], mEnd = map[i + 1];
      if (ch < mStart) {
        start = 0; end = 1;
        collapse = "left";
      } else if (ch < mEnd) {
        start = ch - mStart;
        end = start + 1;
      } else if (i == map.length - 3 || ch == mEnd && map[i + 3] > ch) {
        end = mEnd - mStart;
        start = end - 1;
        if (ch >= mEnd) collapse = "right";
      }
      if (start != null) {
        node = map[i + 2];
        if (mStart == mEnd && bias == (node.insertLeft ? "left" : "right"))
          collapse = bias;
        if (bias == "left" && start == 0)
          while (i && map[i - 2] == map[i - 3] && map[i - 1].insertLeft) {
            node = map[(i -= 3) + 2];
            collapse = "left";
          }
        if (bias == "right" && start == mEnd - mStart)
          while (i < map.length - 3 && map[i + 3] == map[i + 4] && !map[i + 5].insertLeft) {
            node = map[(i += 3) + 2];
            collapse = "right";
          }
        break;
      }
    }
    return {node: node, start: start, end: end, collapse: collapse, coverStart: mStart, coverEnd: mEnd};
  }

  function measureCharInner(cm, prepared, ch, bias) {
    var place = nodeAndOffsetInLineMap(prepared.map, ch, bias);
    var node = place.node, start = place.start, end = place.end, collapse = place.collapse;

    var rect;
    if (node.nodeType == 3) { // If it is a text node, use a range to retrieve the coordinates.
      for (var i = 0; i < 4; i++) { // Retry a maximum of 4 times when nonsense rectangles are returned
        while (start && isExtendingChar(prepared.line.text.charAt(place.coverStart + start))) --start;
        while (place.coverStart + end < place.coverEnd && isExtendingChar(prepared.line.text.charAt(place.coverStart + end))) ++end;
        if (ie && ie_version < 9 && start == 0 && end == place.coverEnd - place.coverStart) {
          rect = node.parentNode.getBoundingClientRect();
        } else if (ie && cm.options.lineWrapping) {
          var rects = range(node, start, end).getClientRects();
          if (rects.length)
            rect = rects[bias == "right" ? rects.length - 1 : 0];
          else
            rect = nullRect;
        } else {
          rect = range(node, start, end).getBoundingClientRect() || nullRect;
        }
        if (rect.left || rect.right || start == 0) break;
        end = start;
        start = start - 1;
        collapse = "right";
      }
      if (ie && ie_version < 11) rect = maybeUpdateRectForZooming(cm.display.measure, rect);
    } else { // If it is a widget, simply get the box for the whole widget.
      if (start > 0) collapse = bias = "right";
      var rects;
      if (cm.options.lineWrapping && (rects = node.getClientRects()).length > 1)
        rect = rects[bias == "right" ? rects.length - 1 : 0];
      else
        rect = node.getBoundingClientRect();
    }
    if (ie && ie_version < 9 && !start && (!rect || !rect.left && !rect.right)) {
      var rSpan = node.parentNode.getClientRects()[0];
      if (rSpan)
        rect = {left: rSpan.left, right: rSpan.left + charWidth(cm.display), top: rSpan.top, bottom: rSpan.bottom};
      else
        rect = nullRect;
    }

    var rtop = rect.top - prepared.rect.top, rbot = rect.bottom - prepared.rect.top;
    var mid = (rtop + rbot) / 2;
    var heights = prepared.view.measure.heights;
    for (var i = 0; i < heights.length - 1; i++)
      if (mid < heights[i]) break;
    var top = i ? heights[i - 1] : 0, bot = heights[i];
    var result = {left: (collapse == "right" ? rect.right : rect.left) - prepared.rect.left,
                  right: (collapse == "left" ? rect.left : rect.right) - prepared.rect.left,
                  top: top, bottom: bot};
    if (!rect.left && !rect.right) result.bogus = true;
    if (!cm.options.singleCursorHeightPerLine) { result.rtop = rtop; result.rbottom = rbot; }

    return result;
  }

  // Work around problem with bounding client rects on ranges being
  // returned incorrectly when zoomed on IE10 and below.
  function maybeUpdateRectForZooming(measure, rect) {
    if (!window.screen || screen.logicalXDPI == null ||
        screen.logicalXDPI == screen.deviceXDPI || !hasBadZoomedRects(measure))
      return rect;
    var scaleX = screen.logicalXDPI / screen.deviceXDPI;
    var scaleY = screen.logicalYDPI / screen.deviceYDPI;
    return {left: rect.left * scaleX, right: rect.right * scaleX,
            top: rect.top * scaleY, bottom: rect.bottom * scaleY};
  }

  function clearLineMeasurementCacheFor(lineView) {
    if (lineView.measure) {
      lineView.measure.cache = {};
      lineView.measure.heights = null;
      if (lineView.rest) for (var i = 0; i < lineView.rest.length; i++)
        lineView.measure.caches[i] = {};
    }
  }

  function clearLineMeasurementCache(cm) {
    cm.display.externalMeasure = null;
    removeChildren(cm.display.lineMeasure);
    for (var i = 0; i < cm.display.view.length; i++)
      clearLineMeasurementCacheFor(cm.display.view[i]);
  }

  function clearCaches(cm) {
    clearLineMeasurementCache(cm);
    cm.display.cachedCharWidth = cm.display.cachedTextHeight = cm.display.cachedPaddingH = null;
    if (!cm.options.lineWrapping) cm.display.maxLineChanged = true;
    cm.display.lineNumChars = null;
  }

  function pageScrollX() { return window.pageXOffset || (document.documentElement || document.body).scrollLeft; }
  function pageScrollY() { return window.pageYOffset || (document.documentElement || document.body).scrollTop; }

  // Converts a {top, bottom, left, right} box from line-local
  // coordinates into another coordinate system. Context may be one of
  // "line", "div" (display.lineDiv), "local"/null (editor), "window",
  // or "page".
  function intoCoordSystem(cm, lineObj, rect, context) {
    if (lineObj.widgets) for (var i = 0; i < lineObj.widgets.length; ++i) if (lineObj.widgets[i].above) {
      var size = widgetHeight(lineObj.widgets[i]);
      rect.top += size; rect.bottom += size;
    }
    if (context == "line") return rect;
    if (!context) context = "local";
    var yOff = heightAtLine(lineObj);
    if (context == "local") yOff += paddingTop(cm.display);
    else yOff -= cm.display.viewOffset;
    if (context == "page" || context == "window") {
      var lOff = cm.display.lineSpace.getBoundingClientRect();
      yOff += lOff.top + (context == "window" ? 0 : pageScrollY());
      var xOff = lOff.left + (context == "window" ? 0 : pageScrollX());
      rect.left += xOff; rect.right += xOff;
    }
    rect.top += yOff; rect.bottom += yOff;
    return rect;
  }

  // Coverts a box from "div" coords to another coordinate system.
  // Context may be "window", "page", "div", or "local"/null.
  function fromCoordSystem(cm, coords, context) {
    if (context == "div") return coords;
    var left = coords.left, top = coords.top;
    // First move into "page" coordinate system
    if (context == "page") {
      left -= pageScrollX();
      top -= pageScrollY();
    } else if (context == "local" || !context) {
      var localBox = cm.display.sizer.getBoundingClientRect();
      left += localBox.left;
      top += localBox.top;
    }

    var lineSpaceBox = cm.display.lineSpace.getBoundingClientRect();
    return {left: left - lineSpaceBox.left, top: top - lineSpaceBox.top};
  }

  function charCoords(cm, pos, context, lineObj, bias) {
    if (!lineObj) lineObj = getLine(cm.doc, pos.line);
    return intoCoordSystem(cm, lineObj, measureChar(cm, lineObj, pos.ch, bias), context);
  }

  // Returns a box for a given cursor position, which may have an
  // 'other' property containing the position of the secondary cursor
  // on a bidi boundary.
  function cursorCoords(cm, pos, context, lineObj, preparedMeasure, varHeight) {
    lineObj = lineObj || getLine(cm.doc, pos.line);
    if (!preparedMeasure) preparedMeasure = prepareMeasureForLine(cm, lineObj);
    function get(ch, right) {
      var m = measureCharPrepared(cm, preparedMeasure, ch, right ? "right" : "left", varHeight);
      if (right) m.left = m.right; else m.right = m.left;
      return intoCoordSystem(cm, lineObj, m, context);
    }
    function getBidi(ch, partPos) {
      var part = order[partPos], right = part.level % 2;
      if (ch == bidiLeft(part) && partPos && part.level < order[partPos - 1].level) {
        part = order[--partPos];
        ch = bidiRight(part) - (part.level % 2 ? 0 : 1);
        right = true;
      } else if (ch == bidiRight(part) && partPos < order.length - 1 && part.level < order[partPos + 1].level) {
        part = order[++partPos];
        ch = bidiLeft(part) - part.level % 2;
        right = false;
      }
      if (right && ch == part.to && ch > part.from) return get(ch - 1);
      return get(ch, right);
    }
    var order = getOrder(lineObj), ch = pos.ch;
    if (!order) return get(ch);
    var partPos = getBidiPartAt(order, ch);
    var val = getBidi(ch, partPos);
    if (bidiOther != null) val.other = getBidi(ch, bidiOther);
    return val;
  }

  // Used to cheaply estimate the coordinates for a position. Used for
  // intermediate scroll updates.
  function estimateCoords(cm, pos) {
    var left = 0, pos = clipPos(cm.doc, pos);
    if (!cm.options.lineWrapping) left = charWidth(cm.display) * pos.ch;
    var lineObj = getLine(cm.doc, pos.line);
    var top = heightAtLine(lineObj) + paddingTop(cm.display);
    return {left: left, right: left, top: top, bottom: top + lineObj.height};
  }

  // Positions returned by coordsChar contain some extra information.
  // xRel is the relative x position of the input coordinates compared
  // to the found position (so xRel > 0 means the coordinates are to
  // the right of the character position, for example). When outside
  // is true, that means the coordinates lie outside the line's
  // vertical range.
  function PosWithInfo(line, ch, outside, xRel) {
    var pos = Pos(line, ch);
    pos.xRel = xRel;
    if (outside) pos.outside = true;
    return pos;
  }

  // Compute the character position closest to the given coordinates.
  // Input must be lineSpace-local ("div" coordinate system).
  function coordsChar(cm, x, y) {
    var doc = cm.doc;
    y += cm.display.viewOffset;
    if (y < 0) return PosWithInfo(doc.first, 0, true, -1);
    var lineN = lineAtHeight(doc, y), last = doc.first + doc.size - 1;
    if (lineN > last)
      return PosWithInfo(doc.first + doc.size - 1, getLine(doc, last).text.length, true, 1);
    if (x < 0) x = 0;

    var lineObj = getLine(doc, lineN);
    for (;;) {
      var found = coordsCharInner(cm, lineObj, lineN, x, y);
      var merged = collapsedSpanAtEnd(lineObj);
      var mergedPos = merged && merged.find(0, true);
      if (merged && (found.ch > mergedPos.from.ch || found.ch == mergedPos.from.ch && found.xRel > 0))
        lineN = lineNo(lineObj = mergedPos.to.line);
      else
        return found;
    }
  }

  function coordsCharInner(cm, lineObj, lineNo, x, y) {
    var innerOff = y - heightAtLine(lineObj);
    var wrongLine = false, adjust = 2 * cm.display.wrapper.clientWidth;
    var preparedMeasure = prepareMeasureForLine(cm, lineObj);

    function getX(ch) {
      var sp = cursorCoords(cm, Pos(lineNo, ch), "line", lineObj, preparedMeasure);
      wrongLine = true;
      if (innerOff > sp.bottom) return sp.left - adjust;
      else if (innerOff < sp.top) return sp.left + adjust;
      else wrongLine = false;
      return sp.left;
    }

    var bidi = getOrder(lineObj), dist = lineObj.text.length;
    var from = lineLeft(lineObj), to = lineRight(lineObj);
    var fromX = getX(from), fromOutside = wrongLine, toX = getX(to), toOutside = wrongLine;

    if (x > toX) return PosWithInfo(lineNo, to, toOutside, 1);
    // Do a binary search between these bounds.
    for (;;) {
      if (bidi ? to == from || to == moveVisually(lineObj, from, 1) : to - from <= 1) {
        var ch = x < fromX || x - fromX <= toX - x ? from : to;
        var xDiff = x - (ch == from ? fromX : toX);
        while (isExtendingChar(lineObj.text.charAt(ch))) ++ch;
        var pos = PosWithInfo(lineNo, ch, ch == from ? fromOutside : toOutside,
                              xDiff < -1 ? -1 : xDiff > 1 ? 1 : 0);
        return pos;
      }
      var step = Math.ceil(dist / 2), middle = from + step;
      if (bidi) {
        middle = from;
        for (var i = 0; i < step; ++i) middle = moveVisually(lineObj, middle, 1);
      }
      var middleX = getX(middle);
      if (middleX > x) {to = middle; toX = middleX; if (toOutside = wrongLine) toX += 1000; dist = step;}
      else {from = middle; fromX = middleX; fromOutside = wrongLine; dist -= step;}
    }
  }

  var measureText;
  // Compute the default text height.
  function textHeight(display) {
    if (display.cachedTextHeight != null) return display.cachedTextHeight;
    if (measureText == null) {
      measureText = elt("pre");
      // Measure a bunch of lines, for browsers that compute
      // fractional heights.
      for (var i = 0; i < 49; ++i) {
        measureText.appendChild(document.createTextNode("x"));
        measureText.appendChild(elt("br"));
      }
      measureText.appendChild(document.createTextNode("x"));
    }
    removeChildrenAndAdd(display.measure, measureText);
    var height = measureText.offsetHeight / 50;
    if (height > 3) display.cachedTextHeight = height;
    removeChildren(display.measure);
    return height || 1;
  }

  // Compute the default character width.
  function charWidth(display) {
    if (display.cachedCharWidth != null) return display.cachedCharWidth;
    var anchor = elt("span", "xxxxxxxxxx");
    var pre = elt("pre", [anchor]);
    removeChildrenAndAdd(display.measure, pre);
    var rect = anchor.getBoundingClientRect(), width = (rect.right - rect.left) / 10;
    if (width > 2) display.cachedCharWidth = width;
    return width || 10;
  }

  // OPERATIONS

  // Operations are used to wrap a series of changes to the editor
  // state in such a way that each change won't have to update the
  // cursor and display (which would be awkward, slow, and
  // error-prone). Instead, display updates are batched and then all
  // combined and executed at once.

  var operationGroup = null;

  var nextOpId = 0;
  // Start a new operation.
  function startOperation(cm) {
    cm.curOp = {
      cm: cm,
      viewChanged: false,      // Flag that indicates that lines might need to be redrawn
      startHeight: cm.doc.height, // Used to detect need to update scrollbar
      forceUpdate: false,      // Used to force a redraw
      updateInput: null,       // Whether to reset the input textarea
      typing: false,           // Whether this reset should be careful to leave existing text (for compositing)
      changeObjs: null,        // Accumulated changes, for firing change events
      cursorActivityHandlers: null, // Set of handlers to fire cursorActivity on
      cursorActivityCalled: 0, // Tracks which cursorActivity handlers have been called already
      selectionChanged: false, // Whether the selection needs to be redrawn
      updateMaxLine: false,    // Set when the widest line needs to be determined anew
      scrollLeft: null, scrollTop: null, // Intermediate scroll position, not pushed to DOM yet
      scrollToPos: null,       // Used to scroll to a specific position
      focus: false,
      id: ++nextOpId           // Unique ID
    };
    if (operationGroup) {
      operationGroup.ops.push(cm.curOp);
    } else {
      cm.curOp.ownsGroup = operationGroup = {
        ops: [cm.curOp],
        delayedCallbacks: []
      };
    }
  }

  function fireCallbacksForOps(group) {
    // Calls delayed callbacks and cursorActivity handlers until no
    // new ones appear
    var callbacks = group.delayedCallbacks, i = 0;
    do {
      for (; i < callbacks.length; i++)
        callbacks[i].call(null);
      for (var j = 0; j < group.ops.length; j++) {
        var op = group.ops[j];
        if (op.cursorActivityHandlers)
          while (op.cursorActivityCalled < op.cursorActivityHandlers.length)
            op.cursorActivityHandlers[op.cursorActivityCalled++].call(null, op.cm);
      }
    } while (i < callbacks.length);
  }

  // Finish an operation, updating the display and signalling delayed events
  function endOperation(cm) {
    var op = cm.curOp, group = op.ownsGroup;
    if (!group) return;

    try { fireCallbacksForOps(group); }
    finally {
      operationGroup = null;
      for (var i = 0; i < group.ops.length; i++)
        group.ops[i].cm.curOp = null;
      endOperations(group);
    }
  }

  // The DOM updates done when an operation finishes are batched so
  // that the minimum number of relayouts are required.
  function endOperations(group) {
    var ops = group.ops;
    for (var i = 0; i < ops.length; i++) // Read DOM
      endOperation_R1(ops[i]);
    for (var i = 0; i < ops.length; i++) // Write DOM (maybe)
      endOperation_W1(ops[i]);
    for (var i = 0; i < ops.length; i++) // Read DOM
      endOperation_R2(ops[i]);
    for (var i = 0; i < ops.length; i++) // Write DOM (maybe)
      endOperation_W2(ops[i]);
    for (var i = 0; i < ops.length; i++) // Read DOM
      endOperation_finish(ops[i]);
  }

  function endOperation_R1(op) {
    var cm = op.cm, display = cm.display;
    maybeClipScrollbars(cm);
    if (op.updateMaxLine) findMaxLine(cm);

    op.mustUpdate = op.viewChanged || op.forceUpdate || op.scrollTop != null ||
      op.scrollToPos && (op.scrollToPos.from.line < display.viewFrom ||
                         op.scrollToPos.to.line >= display.viewTo) ||
      display.maxLineChanged && cm.options.lineWrapping;
    op.update = op.mustUpdate &&
      new DisplayUpdate(cm, op.mustUpdate && {top: op.scrollTop, ensure: op.scrollToPos}, op.forceUpdate);
  }

  function endOperation_W1(op) {
    op.updatedDisplay = op.mustUpdate && updateDisplayIfNeeded(op.cm, op.update);
  }

  function endOperation_R2(op) {
    var cm = op.cm, display = cm.display;
    if (op.updatedDisplay) updateHeightsInViewport(cm);

    op.barMeasure = measureForScrollbars(cm);

    // If the max line changed since it was last measured, measure it,
    // and ensure the document's width matches it.
    // updateDisplay_W2 will use these properties to do the actual resizing
    if (display.maxLineChanged && !cm.options.lineWrapping) {
      op.adjustWidthTo = measureChar(cm, display.maxLine, display.maxLine.text.length).left + 3;
      cm.display.sizerWidth = op.adjustWidthTo;
      op.barMeasure.scrollWidth =
        Math.max(display.scroller.clientWidth, display.sizer.offsetLeft + op.adjustWidthTo + scrollGap(cm) + cm.display.barWidth);
      op.maxScrollLeft = Math.max(0, display.sizer.offsetLeft + op.adjustWidthTo - displayWidth(cm));
    }

    if (op.updatedDisplay || op.selectionChanged)
      op.preparedSelection = display.input.prepareSelection();
  }

  function endOperation_W2(op) {
    var cm = op.cm;

    if (op.adjustWidthTo != null) {
      cm.display.sizer.style.minWidth = op.adjustWidthTo + "px";
      if (op.maxScrollLeft < cm.doc.scrollLeft)
        setScrollLeft(cm, Math.min(cm.display.scroller.scrollLeft, op.maxScrollLeft), true);
      cm.display.maxLineChanged = false;
    }

    if (op.preparedSelection)
      cm.display.input.showSelection(op.preparedSelection);
    if (op.updatedDisplay)
      setDocumentHeight(cm, op.barMeasure);
    if (op.updatedDisplay || op.startHeight != cm.doc.height)
      updateScrollbars(cm, op.barMeasure);

    if (op.selectionChanged) restartBlink(cm);

    if (cm.state.focused && op.updateInput)
      cm.display.input.reset(op.typing);
    if (op.focus && op.focus == activeElt() && (!document.hasFocus || document.hasFocus()))
      ensureFocus(op.cm);
  }

  function endOperation_finish(op) {
    var cm = op.cm, display = cm.display, doc = cm.doc;

    if (op.updatedDisplay) postUpdateDisplay(cm, op.update);

    // Abort mouse wheel delta measurement, when scrolling explicitly
    if (display.wheelStartX != null && (op.scrollTop != null || op.scrollLeft != null || op.scrollToPos))
      display.wheelStartX = display.wheelStartY = null;

    // Propagate the scroll position to the actual DOM scroller
    if (op.scrollTop != null && (display.scroller.scrollTop != op.scrollTop || op.forceScroll)) {
      doc.scrollTop = Math.max(0, Math.min(display.scroller.scrollHeight - display.scroller.clientHeight, op.scrollTop));
      display.scrollbars.setScrollTop(doc.scrollTop);
      display.scroller.scrollTop = doc.scrollTop;
    }
    if (op.scrollLeft != null && (display.scroller.scrollLeft != op.scrollLeft || op.forceScroll)) {
      doc.scrollLeft = Math.max(0, Math.min(display.scroller.scrollWidth - displayWidth(cm), op.scrollLeft));
      display.scrollbars.setScrollLeft(doc.scrollLeft);
      display.scroller.scrollLeft = doc.scrollLeft;
      alignHorizontally(cm);
    }
    // If we need to scroll a specific position into view, do so.
    if (op.scrollToPos) {
      var coords = scrollPosIntoView(cm, clipPos(doc, op.scrollToPos.from),
                                     clipPos(doc, op.scrollToPos.to), op.scrollToPos.margin);
      if (op.scrollToPos.isCursor && cm.state.focused) maybeScrollWindow(cm, coords);
    }

    // Fire events for markers that are hidden/unidden by editing or
    // undoing
    var hidden = op.maybeHiddenMarkers, unhidden = op.maybeUnhiddenMarkers;
    if (hidden) for (var i = 0; i < hidden.length; ++i)
      if (!hidden[i].lines.length) signal(hidden[i], "hide");
    if (unhidden) for (var i = 0; i < unhidden.length; ++i)
      if (unhidden[i].lines.length) signal(unhidden[i], "unhide");

    if (display.wrapper.offsetHeight)
      doc.scrollTop = cm.display.scroller.scrollTop;

    // Fire change events, and delayed event handlers
    if (op.changeObjs)
      signal(cm, "changes", cm, op.changeObjs);
    if (op.update)
      op.update.finish();
  }

  // Run the given function in an operation
  function runInOp(cm, f) {
    if (cm.curOp) return f();
    startOperation(cm);
    try { return f(); }
    finally { endOperation(cm); }
  }
  // Wraps a function in an operation. Returns the wrapped function.
  function operation(cm, f) {
    return function() {
      if (cm.curOp) return f.apply(cm, arguments);
      startOperation(cm);
      try { return f.apply(cm, arguments); }
      finally { endOperation(cm); }
    };
  }
  // Used to add methods to editor and doc instances, wrapping them in
  // operations.
  function methodOp(f) {
    return function() {
      if (this.curOp) return f.apply(this, arguments);
      startOperation(this);
      try { return f.apply(this, arguments); }
      finally { endOperation(this); }
    };
  }
  function docMethodOp(f) {
    return function() {
      var cm = this.cm;
      if (!cm || cm.curOp) return f.apply(this, arguments);
      startOperation(cm);
      try { return f.apply(this, arguments); }
      finally { endOperation(cm); }
    };
  }

  // VIEW TRACKING

  // These objects are used to represent the visible (currently drawn)
  // part of the document. A LineView may correspond to multiple
  // logical lines, if those are connected by collapsed ranges.
  function LineView(doc, line, lineN) {
    // The starting line
    this.line = line;
    // Continuing lines, if any
    this.rest = visualLineContinued(line);
    // Number of logical lines in this visual line
    this.size = this.rest ? lineNo(lst(this.rest)) - lineN + 1 : 1;
    this.node = this.text = null;
    this.hidden = lineIsHidden(doc, line);
  }

  // Create a range of LineView objects for the given lines.
  function buildViewArray(cm, from, to) {
    var array = [], nextPos;
    for (var pos = from; pos < to; pos = nextPos) {
      var view = new LineView(cm.doc, getLine(cm.doc, pos), pos);
      nextPos = pos + view.size;
      array.push(view);
    }
    return array;
  }

  // Updates the display.view data structure for a given change to the
  // document. From and to are in pre-change coordinates. Lendiff is
  // the amount of lines added or subtracted by the change. This is
  // used for changes that span multiple lines, or change the way
  // lines are divided into visual lines. regLineChange (below)
  // registers single-line changes.
  function regChange(cm, from, to, lendiff) {
    if (from == null) from = cm.doc.first;
    if (to == null) to = cm.doc.first + cm.doc.size;
    if (!lendiff) lendiff = 0;

    var display = cm.display;
    if (lendiff && to < display.viewTo &&
        (display.updateLineNumbers == null || display.updateLineNumbers > from))
      display.updateLineNumbers = from;

    cm.curOp.viewChanged = true;

    if (from >= display.viewTo) { // Change after
      if (sawCollapsedSpans && visualLineNo(cm.doc, from) < display.viewTo)
        resetView(cm);
    } else if (to <= display.viewFrom) { // Change before
      if (sawCollapsedSpans && visualLineEndNo(cm.doc, to + lendiff) > display.viewFrom) {
        resetView(cm);
      } else {
        display.viewFrom += lendiff;
        display.viewTo += lendiff;
      }
    } else if (from <= display.viewFrom && to >= display.viewTo) { // Full overlap
      resetView(cm);
    } else if (from <= display.viewFrom) { // Top overlap
      var cut = viewCuttingPoint(cm, to, to + lendiff, 1);
      if (cut) {
        display.view = display.view.slice(cut.index);
        display.viewFrom = cut.lineN;
        display.viewTo += lendiff;
      } else {
        resetView(cm);
      }
    } else if (to >= display.viewTo) { // Bottom overlap
      var cut = viewCuttingPoint(cm, from, from, -1);
      if (cut) {
        display.view = display.view.slice(0, cut.index);
        display.viewTo = cut.lineN;
      } else {
        resetView(cm);
      }
    } else { // Gap in the middle
      var cutTop = viewCuttingPoint(cm, from, from, -1);
      var cutBot = viewCuttingPoint(cm, to, to + lendiff, 1);
      if (cutTop && cutBot) {
        display.view = display.view.slice(0, cutTop.index)
          .concat(buildViewArray(cm, cutTop.lineN, cutBot.lineN))
          .concat(display.view.slice(cutBot.index));
        display.viewTo += lendiff;
      } else {
        resetView(cm);
      }
    }

    var ext = display.externalMeasured;
    if (ext) {
      if (to < ext.lineN)
        ext.lineN += lendiff;
      else if (from < ext.lineN + ext.size)
        display.externalMeasured = null;
    }
  }

  // Register a change to a single line. Type must be one of "text",
  // "gutter", "class", "widget"
  function regLineChange(cm, line, type) {
    cm.curOp.viewChanged = true;
    var display = cm.display, ext = cm.display.externalMeasured;
    if (ext && line >= ext.lineN && line < ext.lineN + ext.size)
      display.externalMeasured = null;

    if (line < display.viewFrom || line >= display.viewTo) return;
    var lineView = display.view[findViewIndex(cm, line)];
    if (lineView.node == null) return;
    var arr = lineView.changes || (lineView.changes = []);
    if (indexOf(arr, type) == -1) arr.push(type);
  }

  // Clear the view.
  function resetView(cm) {
    cm.display.viewFrom = cm.display.viewTo = cm.doc.first;
    cm.display.view = [];
    cm.display.viewOffset = 0;
  }

  // Find the view element corresponding to a given line. Return null
  // when the line isn't visible.
  function findViewIndex(cm, n) {
    if (n >= cm.display.viewTo) return null;
    n -= cm.display.viewFrom;
    if (n < 0) return null;
    var view = cm.display.view;
    for (var i = 0; i < view.length; i++) {
      n -= view[i].size;
      if (n < 0) return i;
    }
  }

  function viewCuttingPoint(cm, oldN, newN, dir) {
    var index = findViewIndex(cm, oldN), diff, view = cm.display.view;
    if (!sawCollapsedSpans || newN == cm.doc.first + cm.doc.size)
      return {index: index, lineN: newN};
    for (var i = 0, n = cm.display.viewFrom; i < index; i++)
      n += view[i].size;
    if (n != oldN) {
      if (dir > 0) {
        if (index == view.length - 1) return null;
        diff = (n + view[index].size) - oldN;
        index++;
      } else {
        diff = n - oldN;
      }
      oldN += diff; newN += diff;
    }
    while (visualLineNo(cm.doc, newN) != newN) {
      if (index == (dir < 0 ? 0 : view.length - 1)) return null;
      newN += dir * view[index - (dir < 0 ? 1 : 0)].size;
      index += dir;
    }
    return {index: index, lineN: newN};
  }

  // Force the view to cover a given range, adding empty view element
  // or clipping off existing ones as needed.
  function adjustView(cm, from, to) {
    var display = cm.display, view = display.view;
    if (view.length == 0 || from >= display.viewTo || to <= display.viewFrom) {
      display.view = buildViewArray(cm, from, to);
      display.viewFrom = from;
    } else {
      if (display.viewFrom > from)
        display.view = buildViewArray(cm, from, display.viewFrom).concat(display.view);
      else if (display.viewFrom < from)
        display.view = display.view.slice(findViewIndex(cm, from));
      display.viewFrom = from;
      if (display.viewTo < to)
        display.view = display.view.concat(buildViewArray(cm, display.viewTo, to));
      else if (display.viewTo > to)
        display.view = display.view.slice(0, findViewIndex(cm, to));
    }
    display.viewTo = to;
  }

  // Count the number of lines in the view whose DOM representation is
  // out of date (or nonexistent).
  function countDirtyView(cm) {
    var view = cm.display.view, dirty = 0;
    for (var i = 0; i < view.length; i++) {
      var lineView = view[i];
      if (!lineView.hidden && (!lineView.node || lineView.changes)) ++dirty;
    }
    return dirty;
  }

  // EVENT HANDLERS

  // Attach the necessary event handlers when initializing the editor
  function registerEventHandlers(cm) {
    var d = cm.display;
    on(d.scroller, "mousedown", operation(cm, onMouseDown));
    // Older IE's will not fire a second mousedown for a double click
    if (ie && ie_version < 11)
      on(d.scroller, "dblclick", operation(cm, function(e) {
        if (signalDOMEvent(cm, e)) return;
        var pos = posFromMouse(cm, e);
        if (!pos || clickInGutter(cm, e) || eventInWidget(cm.display, e)) return;
        e_preventDefault(e);
        var word = cm.findWordAt(pos);
        extendSelection(cm.doc, word.anchor, word.head);
      }));
    else
      on(d.scroller, "dblclick", function(e) { signalDOMEvent(cm, e) || e_preventDefault(e); });
    // Some browsers fire contextmenu *after* opening the menu, at
    // which point we can't mess with it anymore. Context menu is
    // handled in onMouseDown for these browsers.
    if (!captureRightClick) on(d.scroller, "contextmenu", function(e) {onContextMenu(cm, e);});

    // Used to suppress mouse event handling when a touch happens
    var touchFinished, prevTouch = {end: 0};
    function finishTouch() {
      if (d.activeTouch) {
        touchFinished = setTimeout(function() {d.activeTouch = null;}, 1000);
        prevTouch = d.activeTouch;
        prevTouch.end = +new Date;
      }
    };
    function isMouseLikeTouchEvent(e) {
      if (e.touches.length != 1) return false;
      var touch = e.touches[0];
      return touch.radiusX <= 1 && touch.radiusY <= 1;
    }
    function farAway(touch, other) {
      if (other.left == null) return true;
      var dx = other.left - touch.left, dy = other.top - touch.top;
      return dx * dx + dy * dy > 20 * 20;
    }
    on(d.scroller, "touchstart", function(e) {
      if (!isMouseLikeTouchEvent(e)) {
        clearTimeout(touchFinished);
        var now = +new Date;
        d.activeTouch = {start: now, moved: false,
                         prev: now - prevTouch.end <= 300 ? prevTouch : null};
        if (e.touches.length == 1) {
          d.activeTouch.left = e.touches[0].pageX;
          d.activeTouch.top = e.touches[0].pageY;
        }
      }
    });
    on(d.scroller, "touchmove", function() {
      if (d.activeTouch) d.activeTouch.moved = true;
    });
    on(d.scroller, "touchend", function(e) {
      var touch = d.activeTouch;
      if (touch && !eventInWidget(d, e) && touch.left != null &&
          !touch.moved && new Date - touch.start < 300) {
        var pos = cm.coordsChar(d.activeTouch, "page"), range;
        if (!touch.prev || farAway(touch, touch.prev)) // Single tap
          range = new Range(pos, pos);
        else if (!touch.prev.prev || farAway(touch, touch.prev.prev)) // Double tap
          range = cm.findWordAt(pos);
        else // Triple tap
          range = new Range(Pos(pos.line, 0), clipPos(cm.doc, Pos(pos.line + 1, 0)));
        cm.setSelection(range.anchor, range.head);
        cm.focus();
        e_preventDefault(e);
      }
      finishTouch();
    });
    on(d.scroller, "touchcancel", finishTouch);

    // Sync scrolling between fake scrollbars and real scrollable
    // area, ensure viewport is updated when scrolling.
    on(d.scroller, "scroll", function() {
      if (d.scroller.clientHeight) {
        setScrollTop(cm, d.scroller.scrollTop);
        setScrollLeft(cm, d.scroller.scrollLeft, true);
        signal(cm, "scroll", cm);
      }
    });

    // Listen to wheel events in order to try and update the viewport on time.
    on(d.scroller, "mousewheel", function(e){onScrollWheel(cm, e);});
    on(d.scroller, "DOMMouseScroll", function(e){onScrollWheel(cm, e);});

    // Prevent wrapper from ever scrolling
    on(d.wrapper, "scroll", function() { d.wrapper.scrollTop = d.wrapper.scrollLeft = 0; });

    d.dragFunctions = {
      enter: function(e) {if (!signalDOMEvent(cm, e)) e_stop(e);},
      over: function(e) {if (!signalDOMEvent(cm, e)) { onDragOver(cm, e); e_stop(e); }},
      start: function(e){onDragStart(cm, e);},
      drop: operation(cm, onDrop),
      leave: function() {clearDragCursor(cm);}
    };

    var inp = d.input.getField();
    on(inp, "keyup", function(e) { onKeyUp.call(cm, e); });
    on(inp, "keydown", operation(cm, onKeyDown));
    on(inp, "keypress", operation(cm, onKeyPress));
    on(inp, "focus", bind(onFocus, cm));
    on(inp, "blur", bind(onBlur, cm));
  }

  function dragDropChanged(cm, value, old) {
    var wasOn = old && old != CodeMirror.Init;
    if (!value != !wasOn) {
      var funcs = cm.display.dragFunctions;
      var toggle = value ? on : off;
      toggle(cm.display.scroller, "dragstart", funcs.start);
      toggle(cm.display.scroller, "dragenter", funcs.enter);
      toggle(cm.display.scroller, "dragover", funcs.over);
      toggle(cm.display.scroller, "dragleave", funcs.leave);
      toggle(cm.display.scroller, "drop", funcs.drop);
    }
  }

  // Called when the window resizes
  function onResize(cm) {
    var d = cm.display;
    if (d.lastWrapHeight == d.wrapper.clientHeight && d.lastWrapWidth == d.wrapper.clientWidth)
      return;
    // Might be a text scaling operation, clear size caches.
    d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;
    d.scrollbarsClipped = false;
    cm.setSize();
  }

  // MOUSE EVENTS

  // Return true when the given mouse event happened in a widget
  function eventInWidget(display, e) {
    for (var n = e_target(e); n != display.wrapper; n = n.parentNode) {
      if (!n || (n.nodeType == 1 && n.getAttribute("cm-ignore-events") == "true") ||
          (n.parentNode == display.sizer && n != display.mover))
        return true;
    }
  }

  // Given a mouse event, find the corresponding position. If liberal
  // is false, it checks whether a gutter or scrollbar was clicked,
  // and returns null if it was. forRect is used by rectangular
  // selections, and tries to estimate a character position even for
  // coordinates beyond the right of the text.
  function posFromMouse(cm, e, liberal, forRect) {
    var display = cm.display;
    if (!liberal && e_target(e).getAttribute("cm-not-content") == "true") return null;

    var x, y, space = display.lineSpace.getBoundingClientRect();
    // Fails unpredictably on IE[67] when mouse is dragged around quickly.
    try { x = e.clientX - space.left; y = e.clientY - space.top; }
    catch (e) { return null; }
    var coords = coordsChar(cm, x, y), line;
    if (forRect && coords.xRel == 1 && (line = getLine(cm.doc, coords.line).text).length == coords.ch) {
      var colDiff = countColumn(line, line.length, cm.options.tabSize) - line.length;
      coords = Pos(coords.line, Math.max(0, Math.round((x - paddingH(cm.display).left) / charWidth(cm.display)) - colDiff));
    }
    return coords;
  }

  // A mouse down can be a single click, double click, triple click,
  // start of selection drag, start of text drag, new cursor
  // (ctrl-click), rectangle drag (alt-drag), or xwin
  // middle-click-paste. Or it might be a click on something we should
  // not interfere with, such as a scrollbar or widget.
  function onMouseDown(e) {
    var cm = this, display = cm.display;
    if (display.activeTouch && display.input.supportsTouch() || signalDOMEvent(cm, e)) return;
    display.shift = e.shiftKey;

    if (eventInWidget(display, e)) {
      if (!webkit) {
        // Briefly turn off draggability, to allow widgets to do
        // normal dragging things.
        display.scroller.draggable = false;
        setTimeout(function(){display.scroller.draggable = true;}, 100);
      }
      return;
    }
    if (clickInGutter(cm, e)) return;
    var start = posFromMouse(cm, e);
    window.focus();

    switch (e_button(e)) {
    case 1:
      // #3261: make sure, that we're not starting a second selection
      if (cm.state.selectingText)
        cm.state.selectingText(e);
      else if (start)
        leftButtonDown(cm, e, start);
      else if (e_target(e) == display.scroller)
        e_preventDefault(e);
      break;
    case 2:
      if (webkit) cm.state.lastMiddleDown = +new Date;
      if (start) extendSelection(cm.doc, start);
      setTimeout(function() {display.input.focus();}, 20);
      e_preventDefault(e);
      break;
    case 3:
      if (captureRightClick) onContextMenu(cm, e);
      else delayBlurEvent(cm);
      break;
    }
  }

  var lastClick, lastDoubleClick;
  function leftButtonDown(cm, e, start) {
    if (ie) setTimeout(bind(ensureFocus, cm), 0);
    else cm.curOp.focus = activeElt();

    var now = +new Date, type;
    if (lastDoubleClick && lastDoubleClick.time > now - 400 && cmp(lastDoubleClick.pos, start) == 0) {
      type = "triple";
    } else if (lastClick && lastClick.time > now - 400 && cmp(lastClick.pos, start) == 0) {
      type = "double";
      lastDoubleClick = {time: now, pos: start};
    } else {
      type = "single";
      lastClick = {time: now, pos: start};
    }

    var sel = cm.doc.sel, modifier = mac ? e.metaKey : e.ctrlKey, contained;
    if (cm.options.dragDrop && dragAndDrop && !isReadOnly(cm) &&
        type == "single" && (contained = sel.contains(start)) > -1 &&
        (cmp((contained = sel.ranges[contained]).from(), start) < 0 || start.xRel > 0) &&
        (cmp(contained.to(), start) > 0 || start.xRel < 0))
      leftButtonStartDrag(cm, e, start, modifier);
    else
      leftButtonSelect(cm, e, start, type, modifier);
  }

  // Start a text drag. When it ends, see if any dragging actually
  // happen, and treat as a click if it didn't.
  function leftButtonStartDrag(cm, e, start, modifier) {
    var display = cm.display, startTime = +new Date;
    var dragEnd = operation(cm, function(e2) {
      if (webkit) display.scroller.draggable = false;
      cm.state.draggingText = false;
      off(document, "mouseup", dragEnd);
      off(display.scroller, "drop", dragEnd);
      if (Math.abs(e.clientX - e2.clientX) + Math.abs(e.clientY - e2.clientY) < 10) {
        e_preventDefault(e2);
        if (!modifier && +new Date - 200 < startTime)
          extendSelection(cm.doc, start);
        // Work around unexplainable focus problem in IE9 (#2127) and Chrome (#3081)
        if (webkit || ie && ie_version == 9)
          setTimeout(function() {document.body.focus(); display.input.focus();}, 20);
        else
          display.input.focus();
      }
    });
    // Let the drag handler handle this.
    if (webkit) display.scroller.draggable = true;
    cm.state.draggingText = dragEnd;
    // IE's approach to draggable
    if (display.scroller.dragDrop) display.scroller.dragDrop();
    on(document, "mouseup", dragEnd);
    on(display.scroller, "drop", dragEnd);
  }

  // Normal selection, as opposed to text dragging.
  function leftButtonSelect(cm, e, start, type, addNew) {
    var display = cm.display, doc = cm.doc;
    e_preventDefault(e);

    var ourRange, ourIndex, startSel = doc.sel, ranges = startSel.ranges;
    if (addNew && !e.shiftKey) {
      ourIndex = doc.sel.contains(start);
      if (ourIndex > -1)
        ourRange = ranges[ourIndex];
      else
        ourRange = new Range(start, start);
    } else {
      ourRange = doc.sel.primary();
      ourIndex = doc.sel.primIndex;
    }

    if (e.altKey) {
      type = "rect";
      if (!addNew) ourRange = new Range(start, start);
      start = posFromMouse(cm, e, true, true);
      ourIndex = -1;
    } else if (type == "double") {
      var word = cm.findWordAt(start);
      if (cm.display.shift || doc.extend)
        ourRange = extendRange(doc, ourRange, word.anchor, word.head);
      else
        ourRange = word;
    } else if (type == "triple") {
      var line = new Range(Pos(start.line, 0), clipPos(doc, Pos(start.line + 1, 0)));
      if (cm.display.shift || doc.extend)
        ourRange = extendRange(doc, ourRange, line.anchor, line.head);
      else
        ourRange = line;
    } else {
      ourRange = extendRange(doc, ourRange, start);
    }

    if (!addNew) {
      ourIndex = 0;
      setSelection(doc, new Selection([ourRange], 0), sel_mouse);
      startSel = doc.sel;
    } else if (ourIndex == -1) {
      ourIndex = ranges.length;
      setSelection(doc, normalizeSelection(ranges.concat([ourRange]), ourIndex),
                   {scroll: false, origin: "*mouse"});
    } else if (ranges.length > 1 && ranges[ourIndex].empty() && type == "single" && !e.shiftKey) {
      setSelection(doc, normalizeSelection(ranges.slice(0, ourIndex).concat(ranges.slice(ourIndex + 1)), 0),
                   {scroll: false, origin: "*mouse"});
      startSel = doc.sel;
    } else {
      replaceOneSelection(doc, ourIndex, ourRange, sel_mouse);
    }

    var lastPos = start;
    function extendTo(pos) {
      if (cmp(lastPos, pos) == 0) return;
      lastPos = pos;

      if (type == "rect") {
        var ranges = [], tabSize = cm.options.tabSize;
        var startCol = countColumn(getLine(doc, start.line).text, start.ch, tabSize);
        var posCol = countColumn(getLine(doc, pos.line).text, pos.ch, tabSize);
        var left = Math.min(startCol, posCol), right = Math.max(startCol, posCol);
        for (var line = Math.min(start.line, pos.line), end = Math.min(cm.lastLine(), Math.max(start.line, pos.line));
             line <= end; line++) {
          var text = getLine(doc, line).text, leftPos = findColumn(text, left, tabSize);
          if (left == right)
            ranges.push(new Range(Pos(line, leftPos), Pos(line, leftPos)));
          else if (text.length > leftPos)
            ranges.push(new Range(Pos(line, leftPos), Pos(line, findColumn(text, right, tabSize))));
        }
        if (!ranges.length) ranges.push(new Range(start, start));
        setSelection(doc, normalizeSelection(startSel.ranges.slice(0, ourIndex).concat(ranges), ourIndex),
                     {origin: "*mouse", scroll: false});
        cm.scrollIntoView(pos);
      } else {
        var oldRange = ourRange;
        var anchor = oldRange.anchor, head = pos;
        if (type != "single") {
          if (type == "double")
            var range = cm.findWordAt(pos);
          else
            var range = new Range(Pos(pos.line, 0), clipPos(doc, Pos(pos.line + 1, 0)));
          if (cmp(range.anchor, anchor) > 0) {
            head = range.head;
            anchor = minPos(oldRange.from(), range.anchor);
          } else {
            head = range.anchor;
            anchor = maxPos(oldRange.to(), range.head);
          }
        }
        var ranges = startSel.ranges.slice(0);
        ranges[ourIndex] = new Range(clipPos(doc, anchor), head);
        setSelection(doc, normalizeSelection(ranges, ourIndex), sel_mouse);
      }
    }

    var editorSize = display.wrapper.getBoundingClientRect();
    // Used to ensure timeout re-tries don't fire when another extend
    // happened in the meantime (clearTimeout isn't reliable -- at
    // least on Chrome, the timeouts still happen even when cleared,
    // if the clear happens after their scheduled firing time).
    var counter = 0;

    function extend(e) {
      var curCount = ++counter;
      var cur = posFromMouse(cm, e, true, type == "rect");
      if (!cur) return;
      if (cmp(cur, lastPos) != 0) {
        cm.curOp.focus = activeElt();
        extendTo(cur);
        var visible = visibleLines(display, doc);
        if (cur.line >= visible.to || cur.line < visible.from)
          setTimeout(operation(cm, function(){if (counter == curCount) extend(e);}), 150);
      } else {
        var outside = e.clientY < editorSize.top ? -20 : e.clientY > editorSize.bottom ? 20 : 0;
        if (outside) setTimeout(operation(cm, function() {
          if (counter != curCount) return;
          display.scroller.scrollTop += outside;
          extend(e);
        }), 50);
      }
    }

    function done(e) {
      cm.state.selectingText = false;
      counter = Infinity;
      e_preventDefault(e);
      display.input.focus();
      off(document, "mousemove", move);
      off(document, "mouseup", up);
      doc.history.lastSelOrigin = null;
    }

    var move = operation(cm, function(e) {
      if (!e_button(e)) done(e);
      else extend(e);
    });
    var up = operation(cm, done);
    cm.state.selectingText = up;
    on(document, "mousemove", move);
    on(document, "mouseup", up);
  }

  // Determines whether an event happened in the gutter, and fires the
  // handlers for the corresponding event.
  function gutterEvent(cm, e, type, prevent) {
    try { var mX = e.clientX, mY = e.clientY; }
    catch(e) { return false; }
    if (mX >= Math.floor(cm.display.gutters.getBoundingClientRect().right)) return false;
    if (prevent) e_preventDefault(e);

    var display = cm.display;
    var lineBox = display.lineDiv.getBoundingClientRect();

    if (mY > lineBox.bottom || !hasHandler(cm, type)) return e_defaultPrevented(e);
    mY -= lineBox.top - display.viewOffset;

    for (var i = 0; i < cm.options.gutters.length; ++i) {
      var g = display.gutters.childNodes[i];
      if (g && g.getBoundingClientRect().right >= mX) {
        var line = lineAtHeight(cm.doc, mY);
        var gutter = cm.options.gutters[i];
        signal(cm, type, cm, line, gutter, e);
        return e_defaultPrevented(e);
      }
    }
  }

  function clickInGutter(cm, e) {
    return gutterEvent(cm, e, "gutterClick", true);
  }

  // Kludge to work around strange IE behavior where it'll sometimes
  // re-fire a series of drag-related events right after the drop (#1551)
  var lastDrop = 0;

  function onDrop(e) {
    var cm = this;
    clearDragCursor(cm);
    if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e))
      return;
    e_preventDefault(e);
    if (ie) lastDrop = +new Date;
    var pos = posFromMouse(cm, e, true), files = e.dataTransfer.files;
    if (!pos || isReadOnly(cm)) return;
    // Might be a file drop, in which case we simply extract the text
    // and insert it.
    if (files && files.length && window.FileReader && window.File) {
      var n = files.length, text = Array(n), read = 0;
      var loadFile = function(file, i) {
        if (cm.options.allowDropFileTypes &&
            indexOf(cm.options.allowDropFileTypes, file.type) == -1)
          return;

        var reader = new FileReader;
        reader.onload = operation(cm, function() {
          var content = reader.result;
          if (/[\x00-\x08\x0e-\x1f]{2}/.test(content)) content = "";
          text[i] = content;
          if (++read == n) {
            pos = clipPos(cm.doc, pos);
            var change = {from: pos, to: pos,
                          text: cm.doc.splitLines(text.join(cm.doc.lineSeparator())),
                          origin: "paste"};
            makeChange(cm.doc, change);
            setSelectionReplaceHistory(cm.doc, simpleSelection(pos, changeEnd(change)));
          }
        });
        reader.readAsText(file);
      };
      for (var i = 0; i < n; ++i) loadFile(files[i], i);
    } else { // Normal drop
      // Don't do a replace if the drop happened inside of the selected text.
      if (cm.state.draggingText && cm.doc.sel.contains(pos) > -1) {
        cm.state.draggingText(e);
        // Ensure the editor is re-focused
        setTimeout(function() {cm.display.input.focus();}, 20);
        return;
      }
      try {
        var text = e.dataTransfer.getData("Text");
        if (text) {
          if (cm.state.draggingText && !(mac ? e.altKey : e.ctrlKey))
            var selected = cm.listSelections();
          setSelectionNoUndo(cm.doc, simpleSelection(pos, pos));
          if (selected) for (var i = 0; i < selected.length; ++i)
            replaceRange(cm.doc, "", selected[i].anchor, selected[i].head, "drag");
          cm.replaceSelection(text, "around", "paste");
          cm.display.input.focus();
        }
      }
      catch(e){}
    }
  }

  function onDragStart(cm, e) {
    if (ie && (!cm.state.draggingText || +new Date - lastDrop < 100)) { e_stop(e); return; }
    if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e)) return;

    e.dataTransfer.setData("Text", cm.getSelection());

    // Use dummy image instead of default browsers image.
    // Recent Safari (~6.0.2) have a tendency to segfault when this happens, so we don't do it there.
    if (e.dataTransfer.setDragImage && !safari) {
      var img = elt("img", null, null, "position: fixed; left: 0; top: 0;");
      img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
      if (presto) {
        img.width = img.height = 1;
        cm.display.wrapper.appendChild(img);
        // Force a relayout, or Opera won't use our image for some obscure reason
        img._top = img.offsetTop;
      }
      e.dataTransfer.setDragImage(img, 0, 0);
      if (presto) img.parentNode.removeChild(img);
    }
  }

  function onDragOver(cm, e) {
    var pos = posFromMouse(cm, e);
    if (!pos) return;
    var frag = document.createDocumentFragment();
    drawSelectionCursor(cm, pos, frag);
    if (!cm.display.dragCursor) {
      cm.display.dragCursor = elt("div", null, "CodeMirror-cursors CodeMirror-dragcursors");
      cm.display.lineSpace.insertBefore(cm.display.dragCursor, cm.display.cursorDiv);
    }
    removeChildrenAndAdd(cm.display.dragCursor, frag);
  }

  function clearDragCursor(cm) {
    if (cm.display.dragCursor) {
      cm.display.lineSpace.removeChild(cm.display.dragCursor);
      cm.display.dragCursor = null;
    }
  }

  // SCROLL EVENTS

  // Sync the scrollable area and scrollbars, ensure the viewport
  // covers the visible area.
  function setScrollTop(cm, val) {
    if (Math.abs(cm.doc.scrollTop - val) < 2) return;
    cm.doc.scrollTop = val;
    if (!gecko) updateDisplaySimple(cm, {top: val});
    if (cm.display.scroller.scrollTop != val) cm.display.scroller.scrollTop = val;
    cm.display.scrollbars.setScrollTop(val);
    if (gecko) updateDisplaySimple(cm);
    startWorker(cm, 100);
  }
  // Sync scroller and scrollbar, ensure the gutter elements are
  // aligned.
  function setScrollLeft(cm, val, isScroller) {
    if (isScroller ? val == cm.doc.scrollLeft : Math.abs(cm.doc.scrollLeft - val) < 2) return;
    val = Math.min(val, cm.display.scroller.scrollWidth - cm.display.scroller.clientWidth);
    cm.doc.scrollLeft = val;
    alignHorizontally(cm);
    if (cm.display.scroller.scrollLeft != val) cm.display.scroller.scrollLeft = val;
    cm.display.scrollbars.setScrollLeft(val);
  }

  // Since the delta values reported on mouse wheel events are
  // unstandardized between browsers and even browser versions, and
  // generally horribly unpredictable, this code starts by measuring
  // the scroll effect that the first few mouse wheel events have,
  // and, from that, detects the way it can convert deltas to pixel
  // offsets afterwards.
  //
  // The reason we want to know the amount a wheel event will scroll
  // is that it gives us a chance to update the display before the
  // actual scrolling happens, reducing flickering.

  var wheelSamples = 0, wheelPixelsPerUnit = null;
  // Fill in a browser-detected starting value on browsers where we
  // know one. These don't have to be accurate -- the result of them
  // being wrong would just be a slight flicker on the first wheel
  // scroll (if it is large enough).
  if (ie) wheelPixelsPerUnit = -.53;
  else if (gecko) wheelPixelsPerUnit = 15;
  else if (chrome) wheelPixelsPerUnit = -.7;
  else if (safari) wheelPixelsPerUnit = -1/3;

  var wheelEventDelta = function(e) {
    var dx = e.wheelDeltaX, dy = e.wheelDeltaY;
    if (dx == null && e.detail && e.axis == e.HORIZONTAL_AXIS) dx = e.detail;
    if (dy == null && e.detail && e.axis == e.VERTICAL_AXIS) dy = e.detail;
    else if (dy == null) dy = e.wheelDelta;
    return {x: dx, y: dy};
  };
  CodeMirror.wheelEventPixels = function(e) {
    var delta = wheelEventDelta(e);
    delta.x *= wheelPixelsPerUnit;
    delta.y *= wheelPixelsPerUnit;
    return delta;
  };

  function onScrollWheel(cm, e) {
    var delta = wheelEventDelta(e), dx = delta.x, dy = delta.y;

    var display = cm.display, scroll = display.scroller;
    // Quit if there's nothing to scroll here
    var canScrollX = scroll.scrollWidth > scroll.clientWidth;
    var canScrollY = scroll.scrollHeight > scroll.clientHeight;
    if (!(dx && canScrollX || dy && canScrollY)) return;

    // Webkit browsers on OS X abort momentum scrolls when the target
    // of the scroll event is removed from the scrollable element.
    // This hack (see related code in patchDisplay) makes sure the
    // element is kept around.
    if (dy && mac && webkit) {
      outer: for (var cur = e.target, view = display.view; cur != scroll; cur = cur.parentNode) {
        for (var i = 0; i < view.length; i++) {
          if (view[i].node == cur) {
            cm.display.currentWheelTarget = cur;
            break outer;
          }
        }
      }
    }

    // On some browsers, horizontal scrolling will cause redraws to
    // happen before the gutter has been realigned, causing it to
    // wriggle around in a most unseemly way. When we have an
    // estimated pixels/delta value, we just handle horizontal
    // scrolling entirely here. It'll be slightly off from native, but
    // better than glitching out.
    if (dx && !gecko && !presto && wheelPixelsPerUnit != null) {
      if (dy && canScrollY)
        setScrollTop(cm, Math.max(0, Math.min(scroll.scrollTop + dy * wheelPixelsPerUnit, scroll.scrollHeight - scroll.clientHeight)));
      setScrollLeft(cm, Math.max(0, Math.min(scroll.scrollLeft + dx * wheelPixelsPerUnit, scroll.scrollWidth - scroll.clientWidth)));
      // Only prevent default scrolling if vertical scrolling is
      // actually possible. Otherwise, it causes vertical scroll
      // jitter on OSX trackpads when deltaX is small and deltaY
      // is large (issue #3579)
      if (!dy || (dy && canScrollY))
        e_preventDefault(e);
      display.wheelStartX = null; // Abort measurement, if in progress
      return;
    }

    // 'Project' the visible viewport to cover the area that is being
    // scrolled into view (if we know enough to estimate it).
    if (dy && wheelPixelsPerUnit != null) {
      var pixels = dy * wheelPixelsPerUnit;
      var top = cm.doc.scrollTop, bot = top + display.wrapper.clientHeight;
      if (pixels < 0) top = Math.max(0, top + pixels - 50);
      else bot = Math.min(cm.doc.height, bot + pixels + 50);
      updateDisplaySimple(cm, {top: top, bottom: bot});
    }

    if (wheelSamples < 20) {
      if (display.wheelStartX == null) {
        display.wheelStartX = scroll.scrollLeft; display.wheelStartY = scroll.scrollTop;
        display.wheelDX = dx; display.wheelDY = dy;
        setTimeout(function() {
          if (display.wheelStartX == null) return;
          var movedX = scroll.scrollLeft - display.wheelStartX;
          var movedY = scroll.scrollTop - display.wheelStartY;
          var sample = (movedY && display.wheelDY && movedY / display.wheelDY) ||
            (movedX && display.wheelDX && movedX / display.wheelDX);
          display.wheelStartX = display.wheelStartY = null;
          if (!sample) return;
          wheelPixelsPerUnit = (wheelPixelsPerUnit * wheelSamples + sample) / (wheelSamples + 1);
          ++wheelSamples;
        }, 200);
      } else {
        display.wheelDX += dx; display.wheelDY += dy;
      }
    }
  }

  // KEY EVENTS

  // Run a handler that was bound to a key.
  function doHandleBinding(cm, bound, dropShift) {
    if (typeof bound == "string") {
      bound = commands[bound];
      if (!bound) return false;
    }
    // Ensure previous input has been read, so that the handler sees a
    // consistent view of the document
    cm.display.input.ensurePolled();
    var prevShift = cm.display.shift, done = false;
    try {
      if (isReadOnly(cm)) cm.state.suppressEdits = true;
      if (dropShift) cm.display.shift = false;
      done = bound(cm) != Pass;
    } finally {
      cm.display.shift = prevShift;
      cm.state.suppressEdits = false;
    }
    return done;
  }

  function lookupKeyForEditor(cm, name, handle) {
    for (var i = 0; i < cm.state.keyMaps.length; i++) {
      var result = lookupKey(name, cm.state.keyMaps[i], handle, cm);
      if (result) return result;
    }
    return (cm.options.extraKeys && lookupKey(name, cm.options.extraKeys, handle, cm))
      || lookupKey(name, cm.options.keyMap, handle, cm);
  }

  var stopSeq = new Delayed;
  function dispatchKey(cm, name, e, handle) {
    var seq = cm.state.keySeq;
    if (seq) {
      if (isModifierKey(name)) return "handled";
      stopSeq.set(50, function() {
        if (cm.state.keySeq == seq) {
          cm.state.keySeq = null;
          cm.display.input.reset();
        }
      });
      name = seq + " " + name;
    }
    var result = lookupKeyForEditor(cm, name, handle);

    if (result == "multi")
      cm.state.keySeq = name;
    if (result == "handled")
      signalLater(cm, "keyHandled", cm, name, e);

    if (result == "handled" || result == "multi") {
      e_preventDefault(e);
      restartBlink(cm);
    }

    if (seq && !result && /\'$/.test(name)) {
      e_preventDefault(e);
      return true;
    }
    return !!result;
  }

  // Handle a key from the keydown event.
  function handleKeyBinding(cm, e) {
    var name = keyName(e, true);
    if (!name) return false;

    if (e.shiftKey && !cm.state.keySeq) {
      // First try to resolve full name (including 'Shift-'). Failing
      // that, see if there is a cursor-motion command (starting with
      // 'go') bound to the keyname without 'Shift-'.
      return dispatchKey(cm, "Shift-" + name, e, function(b) {return doHandleBinding(cm, b, true);})
          || dispatchKey(cm, name, e, function(b) {
               if (typeof b == "string" ? /^go[A-Z]/.test(b) : b.motion)
                 return doHandleBinding(cm, b);
             });
    } else {
      return dispatchKey(cm, name, e, function(b) { return doHandleBinding(cm, b); });
    }
  }

  // Handle a key from the keypress event
  function handleCharBinding(cm, e, ch) {
    return dispatchKey(cm, "'" + ch + "'", e,
                       function(b) { return doHandleBinding(cm, b, true); });
  }

  var lastStoppedKey = null;
  function onKeyDown(e) {
    var cm = this;
    cm.curOp.focus = activeElt();
    if (signalDOMEvent(cm, e)) return;
    // IE does strange things with escape.
    if (ie && ie_version < 11 && e.keyCode == 27) e.returnValue = false;
    var code = e.keyCode;
    cm.display.shift = code == 16 || e.shiftKey;
    var handled = handleKeyBinding(cm, e);
    if (presto) {
      lastStoppedKey = handled ? code : null;
      // Opera has no cut event... we try to at least catch the key combo
      if (!handled && code == 88 && !hasCopyEvent && (mac ? e.metaKey : e.ctrlKey))
        cm.replaceSelection("", null, "cut");
    }

    // Turn mouse into crosshair when Alt is held on Mac.
    if (code == 18 && !/\bCodeMirror-crosshair\b/.test(cm.display.lineDiv.className))
      showCrossHair(cm);
  }

  function showCrossHair(cm) {
    var lineDiv = cm.display.lineDiv;
    addClass(lineDiv, "CodeMirror-crosshair");

    function up(e) {
      if (e.keyCode == 18 || !e.altKey) {
        rmClass(lineDiv, "CodeMirror-crosshair");
        off(document, "keyup", up);
        off(document, "mouseover", up);
      }
    }
    on(document, "keyup", up);
    on(document, "mouseover", up);
  }

  function onKeyUp(e) {
    if (e.keyCode == 16) this.doc.sel.shift = false;
    signalDOMEvent(this, e);
  }

  function onKeyPress(e) {
    var cm = this;
    if (eventInWidget(cm.display, e) || signalDOMEvent(cm, e) || e.ctrlKey && !e.altKey || mac && e.metaKey) return;
    var keyCode = e.keyCode, charCode = e.charCode;
    if (presto && keyCode == lastStoppedKey) {lastStoppedKey = null; e_preventDefault(e); return;}
    if ((presto && (!e.which || e.which < 10)) && handleKeyBinding(cm, e)) return;
    var ch = String.fromCharCode(charCode == null ? keyCode : charCode);
    if (handleCharBinding(cm, e, ch)) return;
    cm.display.input.onKeyPress(e);
  }

  // FOCUS/BLUR EVENTS

  function delayBlurEvent(cm) {
    cm.state.delayingBlurEvent = true;
    setTimeout(function() {
      if (cm.state.delayingBlurEvent) {
        cm.state.delayingBlurEvent = false;
        onBlur(cm);
      }
    }, 100);
  }

  function onFocus(cm) {
    if (cm.state.delayingBlurEvent) cm.state.delayingBlurEvent = false;

    if (cm.options.readOnly == "nocursor") return;
    if (!cm.state.focused) {
      signal(cm, "focus", cm);
      cm.state.focused = true;
      addClass(cm.display.wrapper, "CodeMirror-focused");
      // This test prevents this from firing when a context
      // menu is closed (since the input reset would kill the
      // select-all detection hack)
      if (!cm.curOp && cm.display.selForContextMenu != cm.doc.sel) {
        cm.display.input.reset();
        if (webkit) setTimeout(function() { cm.display.input.reset(true); }, 20); // Issue #1730
      }
      cm.display.input.receivedFocus();
    }
    restartBlink(cm);
  }
  function onBlur(cm) {
    if (cm.state.delayingBlurEvent) return;

    if (cm.state.focused) {
      signal(cm, "blur", cm);
      cm.state.focused = false;
      rmClass(cm.display.wrapper, "CodeMirror-focused");
    }
    clearInterval(cm.display.blinker);
    setTimeout(function() {if (!cm.state.focused) cm.display.shift = false;}, 150);
  }

  // CONTEXT MENU HANDLING

  // To make the context menu work, we need to briefly unhide the
  // textarea (making it as unobtrusive as possible) to let the
  // right-click take effect on it.
  function onContextMenu(cm, e) {
    if (eventInWidget(cm.display, e) || contextMenuInGutter(cm, e)) return;
    if (signalDOMEvent(cm, e, "contextmenu")) return;
    cm.display.input.onContextMenu(e);
  }

  function contextMenuInGutter(cm, e) {
    if (!hasHandler(cm, "gutterContextMenu")) return false;
    return gutterEvent(cm, e, "gutterContextMenu", false);
  }

  // UPDATING

  // Compute the position of the end of a change (its 'to' property
  // refers to the pre-change end).
  var changeEnd = CodeMirror.changeEnd = function(change) {
    if (!change.text) return change.to;
    return Pos(change.from.line + change.text.length - 1,
               lst(change.text).length + (change.text.length == 1 ? change.from.ch : 0));
  };

  // Adjust a position to refer to the post-change position of the
  // same text, or the end of the change if the change covers it.
  function adjustForChange(pos, change) {
    if (cmp(pos, change.from) < 0) return pos;
    if (cmp(pos, change.to) <= 0) return changeEnd(change);

    var line = pos.line + change.text.length - (change.to.line - change.from.line) - 1, ch = pos.ch;
    if (pos.line == change.to.line) ch += changeEnd(change).ch - change.to.ch;
    return Pos(line, ch);
  }

  function computeSelAfterChange(doc, change) {
    var out = [];
    for (var i = 0; i < doc.sel.ranges.length; i++) {
      var range = doc.sel.ranges[i];
      out.push(new Range(adjustForChange(range.anchor, change),
                         adjustForChange(range.head, change)));
    }
    return normalizeSelection(out, doc.sel.primIndex);
  }

  function offsetPos(pos, old, nw) {
    if (pos.line == old.line)
      return Pos(nw.line, pos.ch - old.ch + nw.ch);
    else
      return Pos(nw.line + (pos.line - old.line), pos.ch);
  }

  // Used by replaceSelections to allow moving the selection to the
  // start or around the replaced test. Hint may be "start" or "around".
  function computeReplacedSel(doc, changes, hint) {
    var out = [];
    var oldPrev = Pos(doc.first, 0), newPrev = oldPrev;
    for (var i = 0; i < changes.length; i++) {
      var change = changes[i];
      var from = offsetPos(change.from, oldPrev, newPrev);
      var to = offsetPos(changeEnd(change), oldPrev, newPrev);
      oldPrev = change.to;
      newPrev = to;
      if (hint == "around") {
        var range = doc.sel.ranges[i], inv = cmp(range.head, range.anchor) < 0;
        out[i] = new Range(inv ? to : from, inv ? from : to);
      } else {
        out[i] = new Range(from, from);
      }
    }
    return new Selection(out, doc.sel.primIndex);
  }

  // Allow "beforeChange" event handlers to influence a change
  function filterChange(doc, change, update) {
    var obj = {
      canceled: false,
      from: change.from,
      to: change.to,
      text: change.text,
      origin: change.origin,
      cancel: function() { this.canceled = true; }
    };
    if (update) obj.update = function(from, to, text, origin) {
      if (from) this.from = clipPos(doc, from);
      if (to) this.to = clipPos(doc, to);
      if (text) this.text = text;
      if (origin !== undefined) this.origin = origin;
    };
    signal(doc, "beforeChange", doc, obj);
    if (doc.cm) signal(doc.cm, "beforeChange", doc.cm, obj);

    if (obj.canceled) return null;
    return {from: obj.from, to: obj.to, text: obj.text, origin: obj.origin};
  }

  // Apply a change to a document, and add it to the document's
  // history, and propagating it to all linked documents.
  function makeChange(doc, change, ignoreReadOnly) {
    if (doc.cm) {
      if (!doc.cm.curOp) return operation(doc.cm, makeChange)(doc, change, ignoreReadOnly);
      if (doc.cm.state.suppressEdits) return;
    }

    if (hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange")) {
      change = filterChange(doc, change, true);
      if (!change) return;
    }

    // Possibly split or suppress the update based on the presence
    // of read-only spans in its range.
    var split = sawReadOnlySpans && !ignoreReadOnly && removeReadOnlyRanges(doc, change.from, change.to);
    if (split) {
      for (var i = split.length - 1; i >= 0; --i)
        makeChangeInner(doc, {from: split[i].from, to: split[i].to, text: i ? [""] : change.text});
    } else {
      makeChangeInner(doc, change);
    }
  }

  function makeChangeInner(doc, change) {
    if (change.text.length == 1 && change.text[0] == "" && cmp(change.from, change.to) == 0) return;
    var selAfter = computeSelAfterChange(doc, change);
    addChangeToHistory(doc, change, selAfter, doc.cm ? doc.cm.curOp.id : NaN);

    makeChangeSingleDoc(doc, change, selAfter, stretchSpansOverChange(doc, change));
    var rebased = [];

    linkedDocs(doc, function(doc, sharedHist) {
      if (!sharedHist && indexOf(rebased, doc.history) == -1) {
        rebaseHist(doc.history, change);
        rebased.push(doc.history);
      }
      makeChangeSingleDoc(doc, change, null, stretchSpansOverChange(doc, change));
    });
  }

  // Revert a change stored in a document's history.
  function makeChangeFromHistory(doc, type, allowSelectionOnly) {
    if (doc.cm && doc.cm.state.suppressEdits) return;

    var hist = doc.history, event, selAfter = doc.sel;
    var source = type == "undo" ? hist.done : hist.undone, dest = type == "undo" ? hist.undone : hist.done;

    // Verify that there is a useable event (so that ctrl-z won't
    // needlessly clear selection events)
    for (var i = 0; i < source.length; i++) {
      event = source[i];
      if (allowSelectionOnly ? event.ranges && !event.equals(doc.sel) : !event.ranges)
        break;
    }
    if (i == source.length) return;
    hist.lastOrigin = hist.lastSelOrigin = null;

    for (;;) {
      event = source.pop();
      if (event.ranges) {
        pushSelectionToHistory(event, dest);
        if (allowSelectionOnly && !event.equals(doc.sel)) {
          setSelection(doc, event, {clearRedo: false});
          return;
        }
        selAfter = event;
      }
      else break;
    }

    // Build up a reverse change object to add to the opposite history
    // stack (redo when undoing, and vice versa).
    var antiChanges = [];
    pushSelectionToHistory(selAfter, dest);
    dest.push({changes: antiChanges, generation: hist.generation});
    hist.generation = event.generation || ++hist.maxGeneration;

    var filter = hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange");

    for (var i = event.changes.length - 1; i >= 0; --i) {
      var change = event.changes[i];
      change.origin = type;
      if (filter && !filterChange(doc, change, false)) {
        source.length = 0;
        return;
      }

      antiChanges.push(historyChangeFromChange(doc, change));

      var after = i ? computeSelAfterChange(doc, change) : lst(source);
      makeChangeSingleDoc(doc, change, after, mergeOldSpans(doc, change));
      if (!i && doc.cm) doc.cm.scrollIntoView({from: change.from, to: changeEnd(change)});
      var rebased = [];

      // Propagate to the linked documents
      linkedDocs(doc, function(doc, sharedHist) {
        if (!sharedHist && indexOf(rebased, doc.history) == -1) {
          rebaseHist(doc.history, change);
          rebased.push(doc.history);
        }
        makeChangeSingleDoc(doc, change, null, mergeOldSpans(doc, change));
      });
    }
  }

  // Sub-views need their line numbers shifted when text is added
  // above or below them in the parent document.
  function shiftDoc(doc, distance) {
    if (distance == 0) return;
    doc.first += distance;
    doc.sel = new Selection(map(doc.sel.ranges, function(range) {
      return new Range(Pos(range.anchor.line + distance, range.anchor.ch),
                       Pos(range.head.line + distance, range.head.ch));
    }), doc.sel.primIndex);
    if (doc.cm) {
      regChange(doc.cm, doc.first, doc.first - distance, distance);
      for (var d = doc.cm.display, l = d.viewFrom; l < d.viewTo; l++)
        regLineChange(doc.cm, l, "gutter");
    }
  }

  // More lower-level change function, handling only a single document
  // (not linked ones).
  function makeChangeSingleDoc(doc, change, selAfter, spans) {
    if (doc.cm && !doc.cm.curOp)
      return operation(doc.cm, makeChangeSingleDoc)(doc, change, selAfter, spans);

    if (change.to.line < doc.first) {
      shiftDoc(doc, change.text.length - 1 - (change.to.line - change.from.line));
      return;
    }
    if (change.from.line > doc.lastLine()) return;

    // Clip the change to the size of this doc
    if (change.from.line < doc.first) {
      var shift = change.text.length - 1 - (doc.first - change.from.line);
      shiftDoc(doc, shift);
      change = {from: Pos(doc.first, 0), to: Pos(change.to.line + shift, change.to.ch),
                text: [lst(change.text)], origin: change.origin};
    }
    var last = doc.lastLine();
    if (change.to.line > last) {
      change = {from: change.from, to: Pos(last, getLine(doc, last).text.length),
                text: [change.text[0]], origin: change.origin};
    }

    change.removed = getBetween(doc, change.from, change.to);

    if (!selAfter) selAfter = computeSelAfterChange(doc, change);
    if (doc.cm) makeChangeSingleDocInEditor(doc.cm, change, spans);
    else updateDoc(doc, change, spans);
    setSelectionNoUndo(doc, selAfter, sel_dontScroll);
  }

  // Handle the interaction of a change to a document with the editor
  // that this document is part of.
  function makeChangeSingleDocInEditor(cm, change, spans) {
    var doc = cm.doc, display = cm.display, from = change.from, to = change.to;

    var recomputeMaxLength = false, checkWidthStart = from.line;
    if (!cm.options.lineWrapping) {
      checkWidthStart = lineNo(visualLine(getLine(doc, from.line)));
      doc.iter(checkWidthStart, to.line + 1, function(line) {
        if (line == display.maxLine) {
          recomputeMaxLength = true;
          return true;
        }
      });
    }

    if (doc.sel.contains(change.from, change.to) > -1)
      signalCursorActivity(cm);

    updateDoc(doc, change, spans, estimateHeight(cm));

    if (!cm.options.lineWrapping) {
      doc.iter(checkWidthStart, from.line + change.text.length, function(line) {
        var len = lineLength(line);
        if (len > display.maxLineLength) {
          display.maxLine = line;
          display.maxLineLength = len;
          display.maxLineChanged = true;
          recomputeMaxLength = false;
        }
      });
      if (recomputeMaxLength) cm.curOp.updateMaxLine = true;
    }

    // Adjust frontier, schedule worker
    doc.frontier = Math.min(doc.frontier, from.line);
    startWorker(cm, 400);

    var lendiff = change.text.length - (to.line - from.line) - 1;
    // Remember that these lines changed, for updating the display
    if (change.full)
      regChange(cm);
    else if (from.line == to.line && change.text.length == 1 && !isWholeLineUpdate(cm.doc, change))
      regLineChange(cm, from.line, "text");
    else
      regChange(cm, from.line, to.line + 1, lendiff);

    var changesHandler = hasHandler(cm, "changes"), changeHandler = hasHandler(cm, "change");
    if (changeHandler || changesHandler) {
      var obj = {
        from: from, to: to,
        text: change.text,
        removed: change.removed,
        origin: change.origin
      };
      if (changeHandler) signalLater(cm, "change", cm, obj);
      if (changesHandler) (cm.curOp.changeObjs || (cm.curOp.changeObjs = [])).push(obj);
    }
    cm.display.selForContextMenu = null;
  }

  function replaceRange(doc, code, from, to, origin) {
    if (!to) to = from;
    if (cmp(to, from) < 0) { var tmp = to; to = from; from = tmp; }
    if (typeof code == "string") code = doc.splitLines(code);
    makeChange(doc, {from: from, to: to, text: code, origin: origin});
  }

  // SCROLLING THINGS INTO VIEW

  // If an editor sits on the top or bottom of the window, partially
  // scrolled out of view, this ensures that the cursor is visible.
  function maybeScrollWindow(cm, coords) {
    if (signalDOMEvent(cm, "scrollCursorIntoView")) return;

    var display = cm.display, box = display.sizer.getBoundingClientRect(), doScroll = null;
    if (coords.top + box.top < 0) doScroll = true;
    else if (coords.bottom + box.top > (window.innerHeight || document.documentElement.clientHeight)) doScroll = false;
    if (doScroll != null && !phantom) {
      var scrollNode = elt("div", "\u200b", null, "position: absolute; top: " +
                           (coords.top - display.viewOffset - paddingTop(cm.display)) + "px; height: " +
                           (coords.bottom - coords.top + scrollGap(cm) + display.barHeight) + "px; left: " +
                           coords.left + "px; width: 2px;");
      cm.display.lineSpace.appendChild(scrollNode);
      scrollNode.scrollIntoView(doScroll);
      cm.display.lineSpace.removeChild(scrollNode);
    }
  }

  // Scroll a given position into view (immediately), verifying that
  // it actually became visible (as line heights are accurately
  // measured, the position of something may 'drift' during drawing).
  function scrollPosIntoView(cm, pos, end, margin) {
    if (margin == null) margin = 0;
    for (var limit = 0; limit < 5; limit++) {
      var changed = false, coords = cursorCoords(cm, pos);
      var endCoords = !end || end == pos ? coords : cursorCoords(cm, end);
      var scrollPos = calculateScrollPos(cm, Math.min(coords.left, endCoords.left),
                                         Math.min(coords.top, endCoords.top) - margin,
                                         Math.max(coords.left, endCoords.left),
                                         Math.max(coords.bottom, endCoords.bottom) + margin);
      var startTop = cm.doc.scrollTop, startLeft = cm.doc.scrollLeft;
      if (scrollPos.scrollTop != null) {
        setScrollTop(cm, scrollPos.scrollTop);
        if (Math.abs(cm.doc.scrollTop - startTop) > 1) changed = true;
      }
      if (scrollPos.scrollLeft != null) {
        setScrollLeft(cm, scrollPos.scrollLeft);
        if (Math.abs(cm.doc.scrollLeft - startLeft) > 1) changed = true;
      }
      if (!changed) break;
    }
    return coords;
  }

  // Scroll a given set of coordinates into view (immediately).
  function scrollIntoView(cm, x1, y1, x2, y2) {
    var scrollPos = calculateScrollPos(cm, x1, y1, x2, y2);
    if (scrollPos.scrollTop != null) setScrollTop(cm, scrollPos.scrollTop);
    if (scrollPos.scrollLeft != null) setScrollLeft(cm, scrollPos.scrollLeft);
  }

  // Calculate a new scroll position needed to scroll the given
  // rectangle into view. Returns an object with scrollTop and
  // scrollLeft properties. When these are undefined, the
  // vertical/horizontal position does not need to be adjusted.
  function calculateScrollPos(cm, x1, y1, x2, y2) {
    var display = cm.display, snapMargin = textHeight(cm.display);
    if (y1 < 0) y1 = 0;
    var screentop = cm.curOp && cm.curOp.scrollTop != null ? cm.curOp.scrollTop : display.scroller.scrollTop;
    var screen = displayHeight(cm), result = {};
    if (y2 - y1 > screen) y2 = y1 + screen;
    var docBottom = cm.doc.height + paddingVert(display);
    var atTop = y1 < snapMargin, atBottom = y2 > docBottom - snapMargin;
    if (y1 < screentop) {
      result.scrollTop = atTop ? 0 : y1;
    } else if (y2 > screentop + screen) {
      var newTop = Math.min(y1, (atBottom ? docBottom : y2) - screen);
      if (newTop != screentop) result.scrollTop = newTop;
    }

    var screenleft = cm.curOp && cm.curOp.scrollLeft != null ? cm.curOp.scrollLeft : display.scroller.scrollLeft;
    var screenw = displayWidth(cm) - (cm.options.fixedGutter ? display.gutters.offsetWidth : 0);
    var tooWide = x2 - x1 > screenw;
    if (tooWide) x2 = x1 + screenw;
    if (x1 < 10)
      result.scrollLeft = 0;
    else if (x1 < screenleft)
      result.scrollLeft = Math.max(0, x1 - (tooWide ? 0 : 10));
    else if (x2 > screenw + screenleft - 3)
      result.scrollLeft = x2 + (tooWide ? 0 : 10) - screenw;
    return result;
  }

  // Store a relative adjustment to the scroll position in the current
  // operation (to be applied when the operation finishes).
  function addToScrollPos(cm, left, top) {
    if (left != null || top != null) resolveScrollToPos(cm);
    if (left != null)
      cm.curOp.scrollLeft = (cm.curOp.scrollLeft == null ? cm.doc.scrollLeft : cm.curOp.scrollLeft) + left;
    if (top != null)
      cm.curOp.scrollTop = (cm.curOp.scrollTop == null ? cm.doc.scrollTop : cm.curOp.scrollTop) + top;
  }

  // Make sure that at the end of the operation the current cursor is
  // shown.
  function ensureCursorVisible(cm) {
    resolveScrollToPos(cm);
    var cur = cm.getCursor(), from = cur, to = cur;
    if (!cm.options.lineWrapping) {
      from = cur.ch ? Pos(cur.line, cur.ch - 1) : cur;
      to = Pos(cur.line, cur.ch + 1);
    }
    cm.curOp.scrollToPos = {from: from, to: to, margin: cm.options.cursorScrollMargin, isCursor: true};
  }

  // When an operation has its scrollToPos property set, and another
  // scroll action is applied before the end of the operation, this
  // 'simulates' scrolling that position into view in a cheap way, so
  // that the effect of intermediate scroll commands is not ignored.
  function resolveScrollToPos(cm) {
    var range = cm.curOp.scrollToPos;
    if (range) {
      cm.curOp.scrollToPos = null;
      var from = estimateCoords(cm, range.from), to = estimateCoords(cm, range.to);
      var sPos = calculateScrollPos(cm, Math.min(from.left, to.left),
                                    Math.min(from.top, to.top) - range.margin,
                                    Math.max(from.right, to.right),
                                    Math.max(from.bottom, to.bottom) + range.margin);
      cm.scrollTo(sPos.scrollLeft, sPos.scrollTop);
    }
  }

  // API UTILITIES

  // Indent the given line. The how parameter can be "smart",
  // "add"/null, "subtract", or "prev". When aggressive is false
  // (typically set to true for forced single-line indents), empty
  // lines are not indented, and places where the mode returns Pass
  // are left alone.
  function indentLine(cm, n, how, aggressive) {
    var doc = cm.doc, state;
    if (how == null) how = "add";
    if (how == "smart") {
      // Fall back to "prev" when the mode doesn't have an indentation
      // method.
      if (!doc.mode.indent) how = "prev";
      else state = getStateBefore(cm, n);
    }

    var tabSize = cm.options.tabSize;
    var line = getLine(doc, n), curSpace = countColumn(line.text, null, tabSize);
    if (line.stateAfter) line.stateAfter = null;
    var curSpaceString = line.text.match(/^\s*/)[0], indentation;
    if (!aggressive && !/\S/.test(line.text)) {
      indentation = 0;
      how = "not";
    } else if (how == "smart") {
      indentation = doc.mode.indent(state, line.text.slice(curSpaceString.length), line.text);
      if (indentation == Pass || indentation > 150) {
        if (!aggressive) return;
        how = "prev";
      }
    }
    if (how == "prev") {
      if (n > doc.first) indentation = countColumn(getLine(doc, n-1).text, null, tabSize);
      else indentation = 0;
    } else if (how == "add") {
      indentation = curSpace + cm.options.indentUnit;
    } else if (how == "subtract") {
      indentation = curSpace - cm.options.indentUnit;
    } else if (typeof how == "number") {
      indentation = curSpace + how;
    }
    indentation = Math.max(0, indentation);

    var indentString = "", pos = 0;
    if (cm.options.indentWithTabs)
      for (var i = Math.floor(indentation / tabSize); i; --i) {pos += tabSize; indentString += "\t";}
    if (pos < indentation) indentString += spaceStr(indentation - pos);

    if (indentString != curSpaceString) {
      replaceRange(doc, indentString, Pos(n, 0), Pos(n, curSpaceString.length), "+input");
      line.stateAfter = null;
      return true;
    } else {
      // Ensure that, if the cursor was in the whitespace at the start
      // of the line, it is moved to the end of that space.
      for (var i = 0; i < doc.sel.ranges.length; i++) {
        var range = doc.sel.ranges[i];
        if (range.head.line == n && range.head.ch < curSpaceString.length) {
          var pos = Pos(n, curSpaceString.length);
          replaceOneSelection(doc, i, new Range(pos, pos));
          break;
        }
      }
    }
  }

  // Utility for applying a change to a line by handle or number,
  // returning the number and optionally registering the line as
  // changed.
  function changeLine(doc, handle, changeType, op) {
    var no = handle, line = handle;
    if (typeof handle == "number") line = getLine(doc, clipLine(doc, handle));
    else no = lineNo(handle);
    if (no == null) return null;
    if (op(line, no) && doc.cm) regLineChange(doc.cm, no, changeType);
    return line;
  }

  // Helper for deleting text near the selection(s), used to implement
  // backspace, delete, and similar functionality.
  function deleteNearSelection(cm, compute) {
    var ranges = cm.doc.sel.ranges, kill = [];
    // Build up a set of ranges to kill first, merging overlapping
    // ranges.
    for (var i = 0; i < ranges.length; i++) {
      var toKill = compute(ranges[i]);
      while (kill.length && cmp(toKill.from, lst(kill).to) <= 0) {
        var replaced = kill.pop();
        if (cmp(replaced.from, toKill.from) < 0) {
          toKill.from = replaced.from;
          break;
        }
      }
      kill.push(toKill);
    }
    // Next, remove those actual ranges.
    runInOp(cm, function() {
      for (var i = kill.length - 1; i >= 0; i--)
        replaceRange(cm.doc, "", kill[i].from, kill[i].to, "+delete");
      ensureCursorVisible(cm);
    });
  }

  // Used for horizontal relative motion. Dir is -1 or 1 (left or
  // right), unit can be "char", "column" (like char, but doesn't
  // cross line boundaries), "word" (across next word), or "group" (to
  // the start of next group of word or non-word-non-whitespace
  // chars). The visually param controls whether, in right-to-left
  // text, direction 1 means to move towards the next index in the
  // string, or towards the character to the right of the current
  // position. The resulting position will have a hitSide=true
  // property if it reached the end of the document.
  function findPosH(doc, pos, dir, unit, visually) {
    var line = pos.line, ch = pos.ch, origDir = dir;
    var lineObj = getLine(doc, line);
    var possible = true;
    function findNextLine() {
      var l = line + dir;
      if (l < doc.first || l >= doc.first + doc.size) return (possible = false);
      line = l;
      return lineObj = getLine(doc, l);
    }
    function moveOnce(boundToLine) {
      var next = (visually ? moveVisually : moveLogically)(lineObj, ch, dir, true);
      if (next == null) {
        if (!boundToLine && findNextLine()) {
          if (visually) ch = (dir < 0 ? lineRight : lineLeft)(lineObj);
          else ch = dir < 0 ? lineObj.text.length : 0;
        } else return (possible = false);
      } else ch = next;
      return true;
    }

    if (unit == "char") moveOnce();
    else if (unit == "column") moveOnce(true);
    else if (unit == "word" || unit == "group") {
      var sawType = null, group = unit == "group";
      var helper = doc.cm && doc.cm.getHelper(pos, "wordChars");
      for (var first = true;; first = false) {
        if (dir < 0 && !moveOnce(!first)) break;
        var cur = lineObj.text.charAt(ch) || "\n";
        var type = isWordChar(cur, helper) ? "w"
          : group && cur == "\n" ? "n"
          : !group || /\s/.test(cur) ? null
          : "p";
        if (group && !first && !type) type = "s";
        if (sawType && sawType != type) {
          if (dir < 0) {dir = 1; moveOnce();}
          break;
        }

        if (type) sawType = type;
        if (dir > 0 && !moveOnce(!first)) break;
      }
    }
    var result = skipAtomic(doc, Pos(line, ch), origDir, true);
    if (!possible) result.hitSide = true;
    return result;
  }

  // For relative vertical movement. Dir may be -1 or 1. Unit can be
  // "page" or "line". The resulting position will have a hitSide=true
  // property if it reached the end of the document.
  function findPosV(cm, pos, dir, unit) {
    var doc = cm.doc, x = pos.left, y;
    if (unit == "page") {
      var pageSize = Math.min(cm.display.wrapper.clientHeight, window.innerHeight || document.documentElement.clientHeight);
      y = pos.top + dir * (pageSize - (dir < 0 ? 1.5 : .5) * textHeight(cm.display));
    } else if (unit == "line") {
      y = dir > 0 ? pos.bottom + 3 : pos.top - 3;
    }
    for (;;) {
      var target = coordsChar(cm, x, y);
      if (!target.outside) break;
      if (dir < 0 ? y <= 0 : y >= doc.height) { target.hitSide = true; break; }
      y += dir * 5;
    }
    return target;
  }

  // EDITOR METHODS

  // The publicly visible API. Note that methodOp(f) means
  // 'wrap f in an operation, performed on its `this` parameter'.

  // This is not the complete set of editor methods. Most of the
  // methods defined on the Doc type are also injected into
  // CodeMirror.prototype, for backwards compatibility and
  // convenience.

  CodeMirror.prototype = {
    constructor: CodeMirror,
    focus: function(){window.focus(); this.display.input.focus();},

    setOption: function(option, value) {
      var options = this.options, old = options[option];
      if (options[option] == value && option != "mode") return;
      options[option] = value;
      if (optionHandlers.hasOwnProperty(option))
        operation(this, optionHandlers[option])(this, value, old);
    },

    getOption: function(option) {return this.options[option];},
    getDoc: function() {return this.doc;},

    addKeyMap: function(map, bottom) {
      this.state.keyMaps[bottom ? "push" : "unshift"](getKeyMap(map));
    },
    removeKeyMap: function(map) {
      var maps = this.state.keyMaps;
      for (var i = 0; i < maps.length; ++i)
        if (maps[i] == map || maps[i].name == map) {
          maps.splice(i, 1);
          return true;
        }
    },

    addOverlay: methodOp(function(spec, options) {
      var mode = spec.token ? spec : CodeMirror.getMode(this.options, spec);
      if (mode.startState) throw new Error("Overlays may not be stateful.");
      this.state.overlays.push({mode: mode, modeSpec: spec, opaque: options && options.opaque});
      this.state.modeGen++;
      regChange(this);
    }),
    removeOverlay: methodOp(function(spec) {
      var overlays = this.state.overlays;
      for (var i = 0; i < overlays.length; ++i) {
        var cur = overlays[i].modeSpec;
        if (cur == spec || typeof spec == "string" && cur.name == spec) {
          overlays.splice(i, 1);
          this.state.modeGen++;
          regChange(this);
          return;
        }
      }
    }),

    indentLine: methodOp(function(n, dir, aggressive) {
      if (typeof dir != "string" && typeof dir != "number") {
        if (dir == null) dir = this.options.smartIndent ? "smart" : "prev";
        else dir = dir ? "add" : "subtract";
      }
      if (isLine(this.doc, n)) indentLine(this, n, dir, aggressive);
    }),
    indentSelection: methodOp(function(how) {
      var ranges = this.doc.sel.ranges, end = -1;
      for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        if (!range.empty()) {
          var from = range.from(), to = range.to();
          var start = Math.max(end, from.line);
          end = Math.min(this.lastLine(), to.line - (to.ch ? 0 : 1)) + 1;
          for (var j = start; j < end; ++j)
            indentLine(this, j, how);
          var newRanges = this.doc.sel.ranges;
          if (from.ch == 0 && ranges.length == newRanges.length && newRanges[i].from().ch > 0)
            replaceOneSelection(this.doc, i, new Range(from, newRanges[i].to()), sel_dontScroll);
        } else if (range.head.line > end) {
          indentLine(this, range.head.line, how, true);
          end = range.head.line;
          if (i == this.doc.sel.primIndex) ensureCursorVisible(this);
        }
      }
    }),

    // Fetch the parser token for a given character. Useful for hacks
    // that want to inspect the mode state (say, for completion).
    getTokenAt: function(pos, precise) {
      return takeToken(this, pos, precise);
    },

    getLineTokens: function(line, precise) {
      return takeToken(this, Pos(line), precise, true);
    },

    getTokenTypeAt: function(pos) {
      pos = clipPos(this.doc, pos);
      var styles = getLineStyles(this, getLine(this.doc, pos.line));
      var before = 0, after = (styles.length - 1) / 2, ch = pos.ch;
      var type;
      if (ch == 0) type = styles[2];
      else for (;;) {
        var mid = (before + after) >> 1;
        if ((mid ? styles[mid * 2 - 1] : 0) >= ch) after = mid;
        else if (styles[mid * 2 + 1] < ch) before = mid + 1;
        else { type = styles[mid * 2 + 2]; break; }
      }
      var cut = type ? type.indexOf("cm-overlay ") : -1;
      return cut < 0 ? type : cut == 0 ? null : type.slice(0, cut - 1);
    },

    getModeAt: function(pos) {
      var mode = this.doc.mode;
      if (!mode.innerMode) return mode;
      return CodeMirror.innerMode(mode, this.getTokenAt(pos).state).mode;
    },

    getHelper: function(pos, type) {
      return this.getHelpers(pos, type)[0];
    },

    getHelpers: function(pos, type) {
      var found = [];
      if (!helpers.hasOwnProperty(type)) return found;
      var help = helpers[type], mode = this.getModeAt(pos);
      if (typeof mode[type] == "string") {
        if (help[mode[type]]) found.push(help[mode[type]]);
      } else if (mode[type]) {
        for (var i = 0; i < mode[type].length; i++) {
          var val = help[mode[type][i]];
          if (val) found.push(val);
        }
      } else if (mode.helperType && help[mode.helperType]) {
        found.push(help[mode.helperType]);
      } else if (help[mode.name]) {
        found.push(help[mode.name]);
      }
      for (var i = 0; i < help._global.length; i++) {
        var cur = help._global[i];
        if (cur.pred(mode, this) && indexOf(found, cur.val) == -1)
          found.push(cur.val);
      }
      return found;
    },

    getStateAfter: function(line, precise) {
      var doc = this.doc;
      line = clipLine(doc, line == null ? doc.first + doc.size - 1: line);
      return getStateBefore(this, line + 1, precise);
    },

    cursorCoords: function(start, mode) {
      var pos, range = this.doc.sel.primary();
      if (start == null) pos = range.head;
      else if (typeof start == "object") pos = clipPos(this.doc, start);
      else pos = start ? range.from() : range.to();
      return cursorCoords(this, pos, mode || "page");
    },

    charCoords: function(pos, mode) {
      return charCoords(this, clipPos(this.doc, pos), mode || "page");
    },

    coordsChar: function(coords, mode) {
      coords = fromCoordSystem(this, coords, mode || "page");
      return coordsChar(this, coords.left, coords.top);
    },

    lineAtHeight: function(height, mode) {
      height = fromCoordSystem(this, {top: height, left: 0}, mode || "page").top;
      return lineAtHeight(this.doc, height + this.display.viewOffset);
    },
    heightAtLine: function(line, mode) {
      var end = false, lineObj;
      if (typeof line == "number") {
        var last = this.doc.first + this.doc.size - 1;
        if (line < this.doc.first) line = this.doc.first;
        else if (line > last) { line = last; end = true; }
        lineObj = getLine(this.doc, line);
      } else {
        lineObj = line;
      }
      return intoCoordSystem(this, lineObj, {top: 0, left: 0}, mode || "page").top +
        (end ? this.doc.height - heightAtLine(lineObj) : 0);
    },

    defaultTextHeight: function() { return textHeight(this.display); },
    defaultCharWidth: function() { return charWidth(this.display); },

    setGutterMarker: methodOp(function(line, gutterID, value) {
      return changeLine(this.doc, line, "gutter", function(line) {
        var markers = line.gutterMarkers || (line.gutterMarkers = {});
        markers[gutterID] = value;
        if (!value && isEmpty(markers)) line.gutterMarkers = null;
        return true;
      });
    }),

    clearGutter: methodOp(function(gutterID) {
      var cm = this, doc = cm.doc, i = doc.first;
      doc.iter(function(line) {
        if (line.gutterMarkers && line.gutterMarkers[gutterID]) {
          line.gutterMarkers[gutterID] = null;
          regLineChange(cm, i, "gutter");
          if (isEmpty(line.gutterMarkers)) line.gutterMarkers = null;
        }
        ++i;
      });
    }),

    lineInfo: function(line) {
      if (typeof line == "number") {
        if (!isLine(this.doc, line)) return null;
        var n = line;
        line = getLine(this.doc, line);
        if (!line) return null;
      } else {
        var n = lineNo(line);
        if (n == null) return null;
      }
      return {line: n, handle: line, text: line.text, gutterMarkers: line.gutterMarkers,
              textClass: line.textClass, bgClass: line.bgClass, wrapClass: line.wrapClass,
              widgets: line.widgets};
    },

    getViewport: function() { return {from: this.display.viewFrom, to: this.display.viewTo};},

    addWidget: function(pos, node, scroll, vert, horiz) {
      var display = this.display;
      pos = cursorCoords(this, clipPos(this.doc, pos));
      var top = pos.bottom, left = pos.left;
      node.style.position = "absolute";
      node.setAttribute("cm-ignore-events", "true");
      this.display.input.setUneditable(node);
      display.sizer.appendChild(node);
      if (vert == "over") {
        top = pos.top;
      } else if (vert == "above" || vert == "near") {
        var vspace = Math.max(display.wrapper.clientHeight, this.doc.height),
        hspace = Math.max(display.sizer.clientWidth, display.lineSpace.clientWidth);
        // Default to positioning above (if specified and possible); otherwise default to positioning below
        if ((vert == 'above' || pos.bottom + node.offsetHeight > vspace) && pos.top > node.offsetHeight)
          top = pos.top - node.offsetHeight;
        else if (pos.bottom + node.offsetHeight <= vspace)
          top = pos.bottom;
        if (left + node.offsetWidth > hspace)
          left = hspace - node.offsetWidth;
      }
      node.style.top = top + "px";
      node.style.left = node.style.right = "";
      if (horiz == "right") {
        left = display.sizer.clientWidth - node.offsetWidth;
        node.style.right = "0px";
      } else {
        if (horiz == "left") left = 0;
        else if (horiz == "middle") left = (display.sizer.clientWidth - node.offsetWidth) / 2;
        node.style.left = left + "px";
      }
      if (scroll)
        scrollIntoView(this, left, top, left + node.offsetWidth, top + node.offsetHeight);
    },

    triggerOnKeyDown: methodOp(onKeyDown),
    triggerOnKeyPress: methodOp(onKeyPress),
    triggerOnKeyUp: onKeyUp,

    execCommand: function(cmd) {
      if (commands.hasOwnProperty(cmd))
        return commands[cmd].call(null, this);
    },

    triggerElectric: methodOp(function(text) { triggerElectric(this, text); }),

    findPosH: function(from, amount, unit, visually) {
      var dir = 1;
      if (amount < 0) { dir = -1; amount = -amount; }
      for (var i = 0, cur = clipPos(this.doc, from); i < amount; ++i) {
        cur = findPosH(this.doc, cur, dir, unit, visually);
        if (cur.hitSide) break;
      }
      return cur;
    },

    moveH: methodOp(function(dir, unit) {
      var cm = this;
      cm.extendSelectionsBy(function(range) {
        if (cm.display.shift || cm.doc.extend || range.empty())
          return findPosH(cm.doc, range.head, dir, unit, cm.options.rtlMoveVisually);
        else
          return dir < 0 ? range.from() : range.to();
      }, sel_move);
    }),

    deleteH: methodOp(function(dir, unit) {
      var sel = this.doc.sel, doc = this.doc;
      if (sel.somethingSelected())
        doc.replaceSelection("", null, "+delete");
      else
        deleteNearSelection(this, function(range) {
          var other = findPosH(doc, range.head, dir, unit, false);
          return dir < 0 ? {from: other, to: range.head} : {from: range.head, to: other};
        });
    }),

    findPosV: function(from, amount, unit, goalColumn) {
      var dir = 1, x = goalColumn;
      if (amount < 0) { dir = -1; amount = -amount; }
      for (var i = 0, cur = clipPos(this.doc, from); i < amount; ++i) {
        var coords = cursorCoords(this, cur, "div");
        if (x == null) x = coords.left;
        else coords.left = x;
        cur = findPosV(this, coords, dir, unit);
        if (cur.hitSide) break;
      }
      return cur;
    },

    moveV: methodOp(function(dir, unit) {
      var cm = this, doc = this.doc, goals = [];
      var collapse = !cm.display.shift && !doc.extend && doc.sel.somethingSelected();
      doc.extendSelectionsBy(function(range) {
        if (collapse)
          return dir < 0 ? range.from() : range.to();
        var headPos = cursorCoords(cm, range.head, "div");
        if (range.goalColumn != null) headPos.left = range.goalColumn;
        goals.push(headPos.left);
        var pos = findPosV(cm, headPos, dir, unit);
        if (unit == "page" && range == doc.sel.primary())
          addToScrollPos(cm, null, charCoords(cm, pos, "div").top - headPos.top);
        return pos;
      }, sel_move);
      if (goals.length) for (var i = 0; i < doc.sel.ranges.length; i++)
        doc.sel.ranges[i].goalColumn = goals[i];
    }),

    // Find the word at the given position (as returned by coordsChar).
    findWordAt: function(pos) {
      var doc = this.doc, line = getLine(doc, pos.line).text;
      var start = pos.ch, end = pos.ch;
      if (line) {
        var helper = this.getHelper(pos, "wordChars");
        if ((pos.xRel < 0 || end == line.length) && start) --start; else ++end;
        var startChar = line.charAt(start);
        var check = isWordChar(startChar, helper)
          ? function(ch) { return isWordChar(ch, helper); }
          : /\s/.test(startChar) ? function(ch) {return /\s/.test(ch);}
          : function(ch) {return !/\s/.test(ch) && !isWordChar(ch);};
        while (start > 0 && check(line.charAt(start - 1))) --start;
        while (end < line.length && check(line.charAt(end))) ++end;
      }
      return new Range(Pos(pos.line, start), Pos(pos.line, end));
    },

    toggleOverwrite: function(value) {
      if (value != null && value == this.state.overwrite) return;
      if (this.state.overwrite = !this.state.overwrite)
        addClass(this.display.cursorDiv, "CodeMirror-overwrite");
      else
        rmClass(this.display.cursorDiv, "CodeMirror-overwrite");

      signal(this, "overwriteToggle", this, this.state.overwrite);
    },
    hasFocus: function() { return this.display.input.getField() == activeElt(); },

    scrollTo: methodOp(function(x, y) {
      if (x != null || y != null) resolveScrollToPos(this);
      if (x != null) this.curOp.scrollLeft = x;
      if (y != null) this.curOp.scrollTop = y;
    }),
    getScrollInfo: function() {
      var scroller = this.display.scroller;
      return {left: scroller.scrollLeft, top: scroller.scrollTop,
              height: scroller.scrollHeight - scrollGap(this) - this.display.barHeight,
              width: scroller.scrollWidth - scrollGap(this) - this.display.barWidth,
              clientHeight: displayHeight(this), clientWidth: displayWidth(this)};
    },

    scrollIntoView: methodOp(function(range, margin) {
      if (range == null) {
        range = {from: this.doc.sel.primary().head, to: null};
        if (margin == null) margin = this.options.cursorScrollMargin;
      } else if (typeof range == "number") {
        range = {from: Pos(range, 0), to: null};
      } else if (range.from == null) {
        range = {from: range, to: null};
      }
      if (!range.to) range.to = range.from;
      range.margin = margin || 0;

      if (range.from.line != null) {
        resolveScrollToPos(this);
        this.curOp.scrollToPos = range;
      } else {
        var sPos = calculateScrollPos(this, Math.min(range.from.left, range.to.left),
                                      Math.min(range.from.top, range.to.top) - range.margin,
                                      Math.max(range.from.right, range.to.right),
                                      Math.max(range.from.bottom, range.to.bottom) + range.margin);
        this.scrollTo(sPos.scrollLeft, sPos.scrollTop);
      }
    }),

    setSize: methodOp(function(width, height) {
      var cm = this;
      function interpret(val) {
        return typeof val == "number" || /^\d+$/.test(String(val)) ? val + "px" : val;
      }
      if (width != null) cm.display.wrapper.style.width = interpret(width);
      if (height != null) cm.display.wrapper.style.height = interpret(height);
      if (cm.options.lineWrapping) clearLineMeasurementCache(this);
      var lineNo = cm.display.viewFrom;
      cm.doc.iter(lineNo, cm.display.viewTo, function(line) {
        if (line.widgets) for (var i = 0; i < line.widgets.length; i++)
          if (line.widgets[i].noHScroll) { regLineChange(cm, lineNo, "widget"); break; }
        ++lineNo;
      });
      cm.curOp.forceUpdate = true;
      signal(cm, "refresh", this);
    }),

    operation: function(f){return runInOp(this, f);},

    refresh: methodOp(function() {
      var oldHeight = this.display.cachedTextHeight;
      regChange(this);
      this.curOp.forceUpdate = true;
      clearCaches(this);
      this.scrollTo(this.doc.scrollLeft, this.doc.scrollTop);
      updateGutterSpace(this);
      if (oldHeight == null || Math.abs(oldHeight - textHeight(this.display)) > .5)
        estimateLineHeights(this);
      signal(this, "refresh", this);
    }),

    swapDoc: methodOp(function(doc) {
      var old = this.doc;
      old.cm = null;
      attachDoc(this, doc);
      clearCaches(this);
      this.display.input.reset();
      this.scrollTo(doc.scrollLeft, doc.scrollTop);
      this.curOp.forceScroll = true;
      signalLater(this, "swapDoc", this, old);
      return old;
    }),

    getInputField: function(){return this.display.input.getField();},
    getWrapperElement: function(){return this.display.wrapper;},
    getScrollerElement: function(){return this.display.scroller;},
    getGutterElement: function(){return this.display.gutters;}
  };
  eventMixin(CodeMirror);

  // OPTION DEFAULTS

  // The default configuration options.
  var defaults = CodeMirror.defaults = {};
  // Functions to run when options are changed.
  var optionHandlers = CodeMirror.optionHandlers = {};

  function option(name, deflt, handle, notOnInit) {
    CodeMirror.defaults[name] = deflt;
    if (handle) optionHandlers[name] =
      notOnInit ? function(cm, val, old) {if (old != Init) handle(cm, val, old);} : handle;
  }

  // Passed to option handlers when there is no old value.
  var Init = CodeMirror.Init = {toString: function(){return "CodeMirror.Init";}};

  // These two are, on init, called from the constructor because they
  // have to be initialized before the editor can start at all.
  option("value", "", function(cm, val) {
    cm.setValue(val);
  }, true);
  option("mode", null, function(cm, val) {
    cm.doc.modeOption = val;
    loadMode(cm);
  }, true);

  option("indentUnit", 2, loadMode, true);
  option("indentWithTabs", false);
  option("smartIndent", true);
  option("tabSize", 4, function(cm) {
    resetModeState(cm);
    clearCaches(cm);
    regChange(cm);
  }, true);
  option("lineSeparator", null, function(cm, val) {
    cm.doc.lineSep = val;
    if (!val) return;
    var newBreaks = [], lineNo = cm.doc.first;
    cm.doc.iter(function(line) {
      for (var pos = 0;;) {
        var found = line.text.indexOf(val, pos);
        if (found == -1) break;
        pos = found + val.length;
        newBreaks.push(Pos(lineNo, found));
      }
      lineNo++;
    });
    for (var i = newBreaks.length - 1; i >= 0; i--)
      replaceRange(cm.doc, val, newBreaks[i], Pos(newBreaks[i].line, newBreaks[i].ch + val.length))
  });
  option("specialChars", /[\t\u0000-\u0019\u00ad\u200b-\u200f\u2028\u2029\ufeff]/g, function(cm, val, old) {
    cm.state.specialChars = new RegExp(val.source + (val.test("\t") ? "" : "|\t"), "g");
    if (old != CodeMirror.Init) cm.refresh();
  });
  option("specialCharPlaceholder", defaultSpecialCharPlaceholder, function(cm) {cm.refresh();}, true);
  option("electricChars", true);
  option("inputStyle", mobile ? "contenteditable" : "textarea", function() {
    throw new Error("inputStyle can not (yet) be changed in a running editor"); // FIXME
  }, true);
  option("rtlMoveVisually", !windows);
  option("wholeLineUpdateBefore", true);

  option("theme", "default", function(cm) {
    themeChanged(cm);
    guttersChanged(cm);
  }, true);
  option("keyMap", "default", function(cm, val, old) {
    var next = getKeyMap(val);
    var prev = old != CodeMirror.Init && getKeyMap(old);
    if (prev && prev.detach) prev.detach(cm, next);
    if (next.attach) next.attach(cm, prev || null);
  });
  option("extraKeys", null);

  option("lineWrapping", false, wrappingChanged, true);
  option("gutters", [], function(cm) {
    setGuttersForLineNumbers(cm.options);
    guttersChanged(cm);
  }, true);
  option("fixedGutter", true, function(cm, val) {
    cm.display.gutters.style.left = val ? compensateForHScroll(cm.display) + "px" : "0";
    cm.refresh();
  }, true);
  option("coverGutterNextToScrollbar", false, function(cm) {updateScrollbars(cm);}, true);
  option("scrollbarStyle", "native", function(cm) {
    initScrollbars(cm);
    updateScrollbars(cm);
    cm.display.scrollbars.setScrollTop(cm.doc.scrollTop);
    cm.display.scrollbars.setScrollLeft(cm.doc.scrollLeft);
  }, true);
  option("lineNumbers", false, function(cm) {
    setGuttersForLineNumbers(cm.options);
    guttersChanged(cm);
  }, true);
  option("firstLineNumber", 1, guttersChanged, true);
  option("lineNumberFormatter", function(integer) {return integer;}, guttersChanged, true);
  option("showCursorWhenSelecting", false, updateSelection, true);

  option("resetSelectionOnContextMenu", true);
  option("lineWiseCopyCut", true);

  option("readOnly", false, function(cm, val) {
    if (val == "nocursor") {
      onBlur(cm);
      cm.display.input.blur();
      cm.display.disabled = true;
    } else {
      cm.display.disabled = false;
    }
    cm.display.input.readOnlyChanged(val)
  });
  option("disableInput", false, function(cm, val) {if (!val) cm.display.input.reset();}, true);
  option("dragDrop", true, dragDropChanged);
  option("allowDropFileTypes", null);

  option("cursorBlinkRate", 530);
  option("cursorScrollMargin", 0);
  option("cursorHeight", 1, updateSelection, true);
  option("singleCursorHeightPerLine", true, updateSelection, true);
  option("workTime", 100);
  option("workDelay", 100);
  option("flattenSpans", true, resetModeState, true);
  option("addModeClass", false, resetModeState, true);
  option("pollInterval", 100);
  option("undoDepth", 200, function(cm, val){cm.doc.history.undoDepth = val;});
  option("historyEventDelay", 1250);
  option("viewportMargin", 10, function(cm){cm.refresh();}, true);
  option("maxHighlightLength", 10000, resetModeState, true);
  option("moveInputWithCursor", true, function(cm, val) {
    if (!val) cm.display.input.resetPosition();
  });

  option("tabindex", null, function(cm, val) {
    cm.display.input.getField().tabIndex = val || "";
  });
  option("autofocus", null);

  // MODE DEFINITION AND QUERYING

  // Known modes, by name and by MIME
  var modes = CodeMirror.modes = {}, mimeModes = CodeMirror.mimeModes = {};

  // Extra arguments are stored as the mode's dependencies, which is
  // used by (legacy) mechanisms like loadmode.js to automatically
  // load a mode. (Preferred mechanism is the require/define calls.)
  CodeMirror.defineMode = function(name, mode) {
    if (!CodeMirror.defaults.mode && name != "null") CodeMirror.defaults.mode = name;
    if (arguments.length > 2)
      mode.dependencies = Array.prototype.slice.call(arguments, 2);
    modes[name] = mode;
  };

  CodeMirror.defineMIME = function(mime, spec) {
    mimeModes[mime] = spec;
  };

  // Given a MIME type, a {name, ...options} config object, or a name
  // string, return a mode config object.
  CodeMirror.resolveMode = function(spec) {
    if (typeof spec == "string" && mimeModes.hasOwnProperty(spec)) {
      spec = mimeModes[spec];
    } else if (spec && typeof spec.name == "string" && mimeModes.hasOwnProperty(spec.name)) {
      var found = mimeModes[spec.name];
      if (typeof found == "string") found = {name: found};
      spec = createObj(found, spec);
      spec.name = found.name;
    } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec)) {
      return CodeMirror.resolveMode("application/xml");
    }
    if (typeof spec == "string") return {name: spec};
    else return spec || {name: "null"};
  };

  // Given a mode spec (anything that resolveMode accepts), find and
  // initialize an actual mode object.
  CodeMirror.getMode = function(options, spec) {
    var spec = CodeMirror.resolveMode(spec);
    var mfactory = modes[spec.name];
    if (!mfactory) return CodeMirror.getMode(options, "text/plain");
    var modeObj = mfactory(options, spec);
    if (modeExtensions.hasOwnProperty(spec.name)) {
      var exts = modeExtensions[spec.name];
      for (var prop in exts) {
        if (!exts.hasOwnProperty(prop)) continue;
        if (modeObj.hasOwnProperty(prop)) modeObj["_" + prop] = modeObj[prop];
        modeObj[prop] = exts[prop];
      }
    }
    modeObj.name = spec.name;
    if (spec.helperType) modeObj.helperType = spec.helperType;
    if (spec.modeProps) for (var prop in spec.modeProps)
      modeObj[prop] = spec.modeProps[prop];

    return modeObj;
  };

  // Minimal default mode.
  CodeMirror.defineMode("null", function() {
    return {token: function(stream) {stream.skipToEnd();}};
  });
  CodeMirror.defineMIME("text/plain", "null");

  // This can be used to attach properties to mode objects from
  // outside the actual mode definition.
  var modeExtensions = CodeMirror.modeExtensions = {};
  CodeMirror.extendMode = function(mode, properties) {
    var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : (modeExtensions[mode] = {});
    copyObj(properties, exts);
  };

  // EXTENSIONS

  CodeMirror.defineExtension = function(name, func) {
    CodeMirror.prototype[name] = func;
  };
  CodeMirror.defineDocExtension = function(name, func) {
    Doc.prototype[name] = func;
  };
  CodeMirror.defineOption = option;

  var initHooks = [];
  CodeMirror.defineInitHook = function(f) {initHooks.push(f);};

  var helpers = CodeMirror.helpers = {};
  CodeMirror.registerHelper = function(type, name, value) {
    if (!helpers.hasOwnProperty(type)) helpers[type] = CodeMirror[type] = {_global: []};
    helpers[type][name] = value;
  };
  CodeMirror.registerGlobalHelper = function(type, name, predicate, value) {
    CodeMirror.registerHelper(type, name, value);
    helpers[type]._global.push({pred: predicate, val: value});
  };

  // MODE STATE HANDLING

  // Utility functions for working with state. Exported because nested
  // modes need to do this for their inner modes.

  var copyState = CodeMirror.copyState = function(mode, state) {
    if (state === true) return state;
    if (mode.copyState) return mode.copyState(state);
    var nstate = {};
    for (var n in state) {
      var val = state[n];
      if (val instanceof Array) val = val.concat([]);
      nstate[n] = val;
    }
    return nstate;
  };

  var startState = CodeMirror.startState = function(mode, a1, a2) {
    return mode.startState ? mode.startState(a1, a2) : true;
  };

  // Given a mode and a state (for that mode), find the inner mode and
  // state at the position that the state refers to.
  CodeMirror.innerMode = function(mode, state) {
    while (mode.innerMode) {
      var info = mode.innerMode(state);
      if (!info || info.mode == mode) break;
      state = info.state;
      mode = info.mode;
    }
    return info || {mode: mode, state: state};
  };

  // STANDARD COMMANDS

  // Commands are parameter-less actions that can be performed on an
  // editor, mostly used for keybindings.
  var commands = CodeMirror.commands = {
    selectAll: function(cm) {cm.setSelection(Pos(cm.firstLine(), 0), Pos(cm.lastLine()), sel_dontScroll);},
    singleSelection: function(cm) {
      cm.setSelection(cm.getCursor("anchor"), cm.getCursor("head"), sel_dontScroll);
    },
    killLine: function(cm) {
      deleteNearSelection(cm, function(range) {
        if (range.empty()) {
          var len = getLine(cm.doc, range.head.line).text.length;
          if (range.head.ch == len && range.head.line < cm.lastLine())
            return {from: range.head, to: Pos(range.head.line + 1, 0)};
          else
            return {from: range.head, to: Pos(range.head.line, len)};
        } else {
          return {from: range.from(), to: range.to()};
        }
      });
    },
    deleteLine: function(cm) {
      deleteNearSelection(cm, function(range) {
        return {from: Pos(range.from().line, 0),
                to: clipPos(cm.doc, Pos(range.to().line + 1, 0))};
      });
    },
    delLineLeft: function(cm) {
      deleteNearSelection(cm, function(range) {
        return {from: Pos(range.from().line, 0), to: range.from()};
      });
    },
    delWrappedLineLeft: function(cm) {
      deleteNearSelection(cm, function(range) {
        var top = cm.charCoords(range.head, "div").top + 5;
        var leftPos = cm.coordsChar({left: 0, top: top}, "div");
        return {from: leftPos, to: range.from()};
      });
    },
    delWrappedLineRight: function(cm) {
      deleteNearSelection(cm, function(range) {
        var top = cm.charCoords(range.head, "div").top + 5;
        var rightPos = cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div");
        return {from: range.from(), to: rightPos };
      });
    },
    undo: function(cm) {cm.undo();},
    redo: function(cm) {cm.redo();},
    undoSelection: function(cm) {cm.undoSelection();},
    redoSelection: function(cm) {cm.redoSelection();},
    goDocStart: function(cm) {cm.extendSelection(Pos(cm.firstLine(), 0));},
    goDocEnd: function(cm) {cm.extendSelection(Pos(cm.lastLine()));},
    goLineStart: function(cm) {
      cm.extendSelectionsBy(function(range) { return lineStart(cm, range.head.line); },
                            {origin: "+move", bias: 1});
    },
    goLineStartSmart: function(cm) {
      cm.extendSelectionsBy(function(range) {
        return lineStartSmart(cm, range.head);
      }, {origin: "+move", bias: 1});
    },
    goLineEnd: function(cm) {
      cm.extendSelectionsBy(function(range) { return lineEnd(cm, range.head.line); },
                            {origin: "+move", bias: -1});
    },
    goLineRight: function(cm) {
      cm.extendSelectionsBy(function(range) {
        var top = cm.charCoords(range.head, "div").top + 5;
        return cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div");
      }, sel_move);
    },
    goLineLeft: function(cm) {
      cm.extendSelectionsBy(function(range) {
        var top = cm.charCoords(range.head, "div").top + 5;
        return cm.coordsChar({left: 0, top: top}, "div");
      }, sel_move);
    },
    goLineLeftSmart: function(cm) {
      cm.extendSelectionsBy(function(range) {
        var top = cm.charCoords(range.head, "div").top + 5;
        var pos = cm.coordsChar({left: 0, top: top}, "div");
        if (pos.ch < cm.getLine(pos.line).search(/\S/)) return lineStartSmart(cm, range.head);
        return pos;
      }, sel_move);
    },
    goLineUp: function(cm) {cm.moveV(-1, "line");},
    goLineDown: function(cm) {cm.moveV(1, "line");},
    goPageUp: function(cm) {cm.moveV(-1, "page");},
    goPageDown: function(cm) {cm.moveV(1, "page");},
    goCharLeft: function(cm) {cm.moveH(-1, "char");},
    goCharRight: function(cm) {cm.moveH(1, "char");},
    goColumnLeft: function(cm) {cm.moveH(-1, "column");},
    goColumnRight: function(cm) {cm.moveH(1, "column");},
    goWordLeft: function(cm) {cm.moveH(-1, "word");},
    goGroupRight: function(cm) {cm.moveH(1, "group");},
    goGroupLeft: function(cm) {cm.moveH(-1, "group");},
    goWordRight: function(cm) {cm.moveH(1, "word");},
    delCharBefore: function(cm) {cm.deleteH(-1, "char");},
    delCharAfter: function(cm) {cm.deleteH(1, "char");},
    delWordBefore: function(cm) {cm.deleteH(-1, "word");},
    delWordAfter: function(cm) {cm.deleteH(1, "word");},
    delGroupBefore: function(cm) {cm.deleteH(-1, "group");},
    delGroupAfter: function(cm) {cm.deleteH(1, "group");},
    indentAuto: function(cm) {cm.indentSelection("smart");},
    indentMore: function(cm) {cm.indentSelection("add");},
    indentLess: function(cm) {cm.indentSelection("subtract");},
    insertTab: function(cm) {cm.replaceSelection("\t");},
    insertSoftTab: function(cm) {
      var spaces = [], ranges = cm.listSelections(), tabSize = cm.options.tabSize;
      for (var i = 0; i < ranges.length; i++) {
        var pos = ranges[i].from();
        var col = countColumn(cm.getLine(pos.line), pos.ch, tabSize);
        spaces.push(new Array(tabSize - col % tabSize + 1).join(" "));
      }
      cm.replaceSelections(spaces);
    },
    defaultTab: function(cm) {
      if (cm.somethingSelected()) cm.indentSelection("add");
      else cm.execCommand("insertTab");
    },
    transposeChars: function(cm) {
      runInOp(cm, function() {
        var ranges = cm.listSelections(), newSel = [];
        for (var i = 0; i < ranges.length; i++) {
          var cur = ranges[i].head, line = getLine(cm.doc, cur.line).text;
          if (line) {
            if (cur.ch == line.length) cur = new Pos(cur.line, cur.ch - 1);
            if (cur.ch > 0) {
              cur = new Pos(cur.line, cur.ch + 1);
              cm.replaceRange(line.charAt(cur.ch - 1) + line.charAt(cur.ch - 2),
                              Pos(cur.line, cur.ch - 2), cur, "+transpose");
            } else if (cur.line > cm.doc.first) {
              var prev = getLine(cm.doc, cur.line - 1).text;
              if (prev)
                cm.replaceRange(line.charAt(0) + cm.doc.lineSeparator() +
                                prev.charAt(prev.length - 1),
                                Pos(cur.line - 1, prev.length - 1), Pos(cur.line, 1), "+transpose");
            }
          }
          newSel.push(new Range(cur, cur));
        }
        cm.setSelections(newSel);
      });
    },
    newlineAndIndent: function(cm) {
      runInOp(cm, function() {
        var len = cm.listSelections().length;
        for (var i = 0; i < len; i++) {
          var range = cm.listSelections()[i];
          cm.replaceRange(cm.doc.lineSeparator(), range.anchor, range.head, "+input");
          cm.indentLine(range.from().line + 1, null, true);
        }
        ensureCursorVisible(cm);
      });
    },
    toggleOverwrite: function(cm) {cm.toggleOverwrite();}
  };


  // STANDARD KEYMAPS

  var keyMap = CodeMirror.keyMap = {};

  keyMap.basic = {
    "Left": "goCharLeft", "Right": "goCharRight", "Up": "goLineUp", "Down": "goLineDown",
    "End": "goLineEnd", "Home": "goLineStartSmart", "PageUp": "goPageUp", "PageDown": "goPageDown",
    "Delete": "delCharAfter", "Backspace": "delCharBefore", "Shift-Backspace": "delCharBefore",
    "Tab": "defaultTab", "Shift-Tab": "indentAuto",
    "Enter": "newlineAndIndent", "Insert": "toggleOverwrite",
    "Esc": "singleSelection"
  };
  // Note that the save and find-related commands aren't defined by
  // default. User code or addons can define them. Unknown commands
  // are simply ignored.
  keyMap.pcDefault = {
    "Ctrl-A": "selectAll", "Ctrl-D": "deleteLine", "Ctrl-Z": "undo", "Shift-Ctrl-Z": "redo", "Ctrl-Y": "redo",
    "Ctrl-Home": "goDocStart", "Ctrl-End": "goDocEnd", "Ctrl-Up": "goLineUp", "Ctrl-Down": "goLineDown",
    "Ctrl-Left": "goGroupLeft", "Ctrl-Right": "goGroupRight", "Alt-Left": "goLineStart", "Alt-Right": "goLineEnd",
    "Ctrl-Backspace": "delGroupBefore", "Ctrl-Delete": "delGroupAfter", "Ctrl-S": "save", "Ctrl-F": "find",
    "Ctrl-G": "findNext", "Shift-Ctrl-G": "findPrev", "Shift-Ctrl-F": "replace", "Shift-Ctrl-R": "replaceAll",
    "Ctrl-[": "indentLess", "Ctrl-]": "indentMore",
    "Ctrl-U": "undoSelection", "Shift-Ctrl-U": "redoSelection", "Alt-U": "redoSelection",
    fallthrough: "basic"
  };
  // Very basic readline/emacs-style bindings, which are standard on Mac.
  keyMap.emacsy = {
    "Ctrl-F": "goCharRight", "Ctrl-B": "goCharLeft", "Ctrl-P": "goLineUp", "Ctrl-N": "goLineDown",
    "Alt-F": "goWordRight", "Alt-B": "goWordLeft", "Ctrl-A": "goLineStart", "Ctrl-E": "goLineEnd",
    "Ctrl-V": "goPageDown", "Shift-Ctrl-V": "goPageUp", "Ctrl-D": "delCharAfter", "Ctrl-H": "delCharBefore",
    "Alt-D": "delWordAfter", "Alt-Backspace": "delWordBefore", "Ctrl-K": "killLine", "Ctrl-T": "transposeChars"
  };
  keyMap.macDefault = {
    "Cmd-A": "selectAll", "Cmd-D": "deleteLine", "Cmd-Z": "undo", "Shift-Cmd-Z": "redo", "Cmd-Y": "redo",
    "Cmd-Home": "goDocStart", "Cmd-Up": "goDocStart", "Cmd-End": "goDocEnd", "Cmd-Down": "goDocEnd", "Alt-Left": "goGroupLeft",
    "Alt-Right": "goGroupRight", "Cmd-Left": "goLineLeft", "Cmd-Right": "goLineRight", "Alt-Backspace": "delGroupBefore",
    "Ctrl-Alt-Backspace": "delGroupAfter", "Alt-Delete": "delGroupAfter", "Cmd-S": "save", "Cmd-F": "find",
    "Cmd-G": "findNext", "Shift-Cmd-G": "findPrev", "Cmd-Alt-F": "replace", "Shift-Cmd-Alt-F": "replaceAll",
    "Cmd-[": "indentLess", "Cmd-]": "indentMore", "Cmd-Backspace": "delWrappedLineLeft", "Cmd-Delete": "delWrappedLineRight",
    "Cmd-U": "undoSelection", "Shift-Cmd-U": "redoSelection", "Ctrl-Up": "goDocStart", "Ctrl-Down": "goDocEnd",
    fallthrough: ["basic", "emacsy"]
  };
  keyMap["default"] = mac ? keyMap.macDefault : keyMap.pcDefault;

  // KEYMAP DISPATCH

  function normalizeKeyName(name) {
    var parts = name.split(/-(?!$)/), name = parts[parts.length - 1];
    var alt, ctrl, shift, cmd;
    for (var i = 0; i < parts.length - 1; i++) {
      var mod = parts[i];
      if (/^(cmd|meta|m)$/i.test(mod)) cmd = true;
      else if (/^a(lt)?$/i.test(mod)) alt = true;
      else if (/^(c|ctrl|control)$/i.test(mod)) ctrl = true;
      else if (/^s(hift)$/i.test(mod)) shift = true;
      else throw new Error("Unrecognized modifier name: " + mod);
    }
    if (alt) name = "Alt-" + name;
    if (ctrl) name = "Ctrl-" + name;
    if (cmd) name = "Cmd-" + name;
    if (shift) name = "Shift-" + name;
    return name;
  }

  // This is a kludge to keep keymaps mostly working as raw objects
  // (backwards compatibility) while at the same time support features
  // like normalization and multi-stroke key bindings. It compiles a
  // new normalized keymap, and then updates the old object to reflect
  // this.
  CodeMirror.normalizeKeyMap = function(keymap) {
    var copy = {};
    for (var keyname in keymap) if (keymap.hasOwnProperty(keyname)) {
      var value = keymap[keyname];
      if (/^(name|fallthrough|(de|at)tach)$/.test(keyname)) continue;
      if (value == "...") { delete keymap[keyname]; continue; }

      var keys = map(keyname.split(" "), normalizeKeyName);
      for (var i = 0; i < keys.length; i++) {
        var val, name;
        if (i == keys.length - 1) {
          name = keys.join(" ");
          val = value;
        } else {
          name = keys.slice(0, i + 1).join(" ");
          val = "...";
        }
        var prev = copy[name];
        if (!prev) copy[name] = val;
        else if (prev != val) throw new Error("Inconsistent bindings for " + name);
      }
      delete keymap[keyname];
    }
    for (var prop in copy) keymap[prop] = copy[prop];
    return keymap;
  };

  var lookupKey = CodeMirror.lookupKey = function(key, map, handle, context) {
    map = getKeyMap(map);
    var found = map.call ? map.call(key, context) : map[key];
    if (found === false) return "nothing";
    if (found === "...") return "multi";
    if (found != null && handle(found)) return "handled";

    if (map.fallthrough) {
      if (Object.prototype.toString.call(map.fallthrough) != "[object Array]")
        return lookupKey(key, map.fallthrough, handle, context);
      for (var i = 0; i < map.fallthrough.length; i++) {
        var result = lookupKey(key, map.fallthrough[i], handle, context);
        if (result) return result;
      }
    }
  };

  // Modifier key presses don't count as 'real' key presses for the
  // purpose of keymap fallthrough.
  var isModifierKey = CodeMirror.isModifierKey = function(value) {
    var name = typeof value == "string" ? value : keyNames[value.keyCode];
    return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod";
  };

  // Look up the name of a key as indicated by an event object.
  var keyName = CodeMirror.keyName = function(event, noShift) {
    if (presto && event.keyCode == 34 && event["char"]) return false;
    var base = keyNames[event.keyCode], name = base;
    if (name == null || event.altGraphKey) return false;
    if (event.altKey && base != "Alt") name = "Alt-" + name;
    if ((flipCtrlCmd ? event.metaKey : event.ctrlKey) && base != "Ctrl") name = "Ctrl-" + name;
    if ((flipCtrlCmd ? event.ctrlKey : event.metaKey) && base != "Cmd") name = "Cmd-" + name;
    if (!noShift && event.shiftKey && base != "Shift") name = "Shift-" + name;
    return name;
  };

  function getKeyMap(val) {
    return typeof val == "string" ? keyMap[val] : val;
  }

  // FROMTEXTAREA

  CodeMirror.fromTextArea = function(textarea, options) {
    options = options ? copyObj(options) : {};
    options.value = textarea.value;
    if (!options.tabindex && textarea.tabIndex)
      options.tabindex = textarea.tabIndex;
    if (!options.placeholder && textarea.placeholder)
      options.placeholder = textarea.placeholder;
    // Set autofocus to true if this textarea is focused, or if it has
    // autofocus and no other element is focused.
    if (options.autofocus == null) {
      var hasFocus = activeElt();
      options.autofocus = hasFocus == textarea ||
        textarea.getAttribute("autofocus") != null && hasFocus == document.body;
    }

    function save() {textarea.value = cm.getValue();}
    if (textarea.form) {
      on(textarea.form, "submit", save);
      // Deplorable hack to make the submit method do the right thing.
      if (!options.leaveSubmitMethodAlone) {
        var form = textarea.form, realSubmit = form.submit;
        try {
          var wrappedSubmit = form.submit = function() {
            save();
            form.submit = realSubmit;
            form.submit();
            form.submit = wrappedSubmit;
          };
        } catch(e) {}
      }
    }

    options.finishInit = function(cm) {
      cm.save = save;
      cm.getTextArea = function() { return textarea; };
      cm.toTextArea = function() {
        cm.toTextArea = isNaN; // Prevent this from being ran twice
        save();
        textarea.parentNode.removeChild(cm.getWrapperElement());
        textarea.style.display = "";
        if (textarea.form) {
          off(textarea.form, "submit", save);
          if (typeof textarea.form.submit == "function")
            textarea.form.submit = realSubmit;
        }
      };
    };

    textarea.style.display = "none";
    var cm = CodeMirror(function(node) {
      textarea.parentNode.insertBefore(node, textarea.nextSibling);
    }, options);
    return cm;
  };

  // STRING STREAM

  // Fed to the mode parsers, provides helper functions to make
  // parsers more succinct.

  var StringStream = CodeMirror.StringStream = function(string, tabSize) {
    this.pos = this.start = 0;
    this.string = string;
    this.tabSize = tabSize || 8;
    this.lastColumnPos = this.lastColumnValue = 0;
    this.lineStart = 0;
  };

  StringStream.prototype = {
    eol: function() {return this.pos >= this.string.length;},
    sol: function() {return this.pos == this.lineStart;},
    peek: function() {return this.string.charAt(this.pos) || undefined;},
    next: function() {
      if (this.pos < this.string.length)
        return this.string.charAt(this.pos++);
    },
    eat: function(match) {
      var ch = this.string.charAt(this.pos);
      if (typeof match == "string") var ok = ch == match;
      else var ok = ch && (match.test ? match.test(ch) : match(ch));
      if (ok) {++this.pos; return ch;}
    },
    eatWhile: function(match) {
      var start = this.pos;
      while (this.eat(match)){}
      return this.pos > start;
    },
    eatSpace: function() {
      var start = this.pos;
      while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) ++this.pos;
      return this.pos > start;
    },
    skipToEnd: function() {this.pos = this.string.length;},
    skipTo: function(ch) {
      var found = this.string.indexOf(ch, this.pos);
      if (found > -1) {this.pos = found; return true;}
    },
    backUp: function(n) {this.pos -= n;},
    column: function() {
      if (this.lastColumnPos < this.start) {
        this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
        this.lastColumnPos = this.start;
      }
      return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0);
    },
    indentation: function() {
      return countColumn(this.string, null, this.tabSize) -
        (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0);
    },
    match: function(pattern, consume, caseInsensitive) {
      if (typeof pattern == "string") {
        var cased = function(str) {return caseInsensitive ? str.toLowerCase() : str;};
        var substr = this.string.substr(this.pos, pattern.length);
        if (cased(substr) == cased(pattern)) {
          if (consume !== false) this.pos += pattern.length;
          return true;
        }
      } else {
        var match = this.string.slice(this.pos).match(pattern);
        if (match && match.index > 0) return null;
        if (match && consume !== false) this.pos += match[0].length;
        return match;
      }
    },
    current: function(){return this.string.slice(this.start, this.pos);},
    hideFirstChars: function(n, inner) {
      this.lineStart += n;
      try { return inner(); }
      finally { this.lineStart -= n; }
    }
  };

  // TEXTMARKERS

  // Created with markText and setBookmark methods. A TextMarker is a
  // handle that can be used to clear or find a marked position in the
  // document. Line objects hold arrays (markedSpans) containing
  // {from, to, marker} object pointing to such marker objects, and
  // indicating that such a marker is present on that line. Multiple
  // lines may point to the same marker when it spans across lines.
  // The spans will have null for their from/to properties when the
  // marker continues beyond the start/end of the line. Markers have
  // links back to the lines they currently touch.

  var nextMarkerId = 0;

  var TextMarker = CodeMirror.TextMarker = function(doc, type) {
    this.lines = [];
    this.type = type;
    this.doc = doc;
    this.id = ++nextMarkerId;
  };
  eventMixin(TextMarker);

  // Clear the marker.
  TextMarker.prototype.clear = function() {
    if (this.explicitlyCleared) return;
    var cm = this.doc.cm, withOp = cm && !cm.curOp;
    if (withOp) startOperation(cm);
    if (hasHandler(this, "clear")) {
      var found = this.find();
      if (found) signalLater(this, "clear", found.from, found.to);
    }
    var min = null, max = null;
    for (var i = 0; i < this.lines.length; ++i) {
      var line = this.lines[i];
      var span = getMarkedSpanFor(line.markedSpans, this);
      if (cm && !this.collapsed) regLineChange(cm, lineNo(line), "text");
      else if (cm) {
        if (span.to != null) max = lineNo(line);
        if (span.from != null) min = lineNo(line);
      }
      line.markedSpans = removeMarkedSpan(line.markedSpans, span);
      if (span.from == null && this.collapsed && !lineIsHidden(this.doc, line) && cm)
        updateLineHeight(line, textHeight(cm.display));
    }
    if (cm && this.collapsed && !cm.options.lineWrapping) for (var i = 0; i < this.lines.length; ++i) {
      var visual = visualLine(this.lines[i]), len = lineLength(visual);
      if (len > cm.display.maxLineLength) {
        cm.display.maxLine = visual;
        cm.display.maxLineLength = len;
        cm.display.maxLineChanged = true;
      }
    }

    if (min != null && cm && this.collapsed) regChange(cm, min, max + 1);
    this.lines.length = 0;
    this.explicitlyCleared = true;
    if (this.atomic && this.doc.cantEdit) {
      this.doc.cantEdit = false;
      if (cm) reCheckSelection(cm.doc);
    }
    if (cm) signalLater(cm, "markerCleared", cm, this);
    if (withOp) endOperation(cm);
    if (this.parent) this.parent.clear();
  };

  // Find the position of the marker in the document. Returns a {from,
  // to} object by default. Side can be passed to get a specific side
  // -- 0 (both), -1 (left), or 1 (right). When lineObj is true, the
  // Pos objects returned contain a line object, rather than a line
  // number (used to prevent looking up the same line twice).
  TextMarker.prototype.find = function(side, lineObj) {
    if (side == null && this.type == "bookmark") side = 1;
    var from, to;
    for (var i = 0; i < this.lines.length; ++i) {
      var line = this.lines[i];
      var span = getMarkedSpanFor(line.markedSpans, this);
      if (span.from != null) {
        from = Pos(lineObj ? line : lineNo(line), span.from);
        if (side == -1) return from;
      }
      if (span.to != null) {
        to = Pos(lineObj ? line : lineNo(line), span.to);
        if (side == 1) return to;
      }
    }
    return from && {from: from, to: to};
  };

  // Signals that the marker's widget changed, and surrounding layout
  // should be recomputed.
  TextMarker.prototype.changed = function() {
    var pos = this.find(-1, true), widget = this, cm = this.doc.cm;
    if (!pos || !cm) return;
    runInOp(cm, function() {
      var line = pos.line, lineN = lineNo(pos.line);
      var view = findViewForLine(cm, lineN);
      if (view) {
        clearLineMeasurementCacheFor(view);
        cm.curOp.selectionChanged = cm.curOp.forceUpdate = true;
      }
      cm.curOp.updateMaxLine = true;
      if (!lineIsHidden(widget.doc, line) && widget.height != null) {
        var oldHeight = widget.height;
        widget.height = null;
        var dHeight = widgetHeight(widget) - oldHeight;
        if (dHeight)
          updateLineHeight(line, line.height + dHeight);
      }
    });
  };

  TextMarker.prototype.attachLine = function(line) {
    if (!this.lines.length && this.doc.cm) {
      var op = this.doc.cm.curOp;
      if (!op.maybeHiddenMarkers || indexOf(op.maybeHiddenMarkers, this) == -1)
        (op.maybeUnhiddenMarkers || (op.maybeUnhiddenMarkers = [])).push(this);
    }
    this.lines.push(line);
  };
  TextMarker.prototype.detachLine = function(line) {
    this.lines.splice(indexOf(this.lines, line), 1);
    if (!this.lines.length && this.doc.cm) {
      var op = this.doc.cm.curOp;
      (op.maybeHiddenMarkers || (op.maybeHiddenMarkers = [])).push(this);
    }
  };

  // Collapsed markers have unique ids, in order to be able to order
  // them, which is needed for uniquely determining an outer marker
  // when they overlap (they may nest, but not partially overlap).
  var nextMarkerId = 0;

  // Create a marker, wire it up to the right lines, and
  function markText(doc, from, to, options, type) {
    // Shared markers (across linked documents) are handled separately
    // (markTextShared will call out to this again, once per
    // document).
    if (options && options.shared) return markTextShared(doc, from, to, options, type);
    // Ensure we are in an operation.
    if (doc.cm && !doc.cm.curOp) return operation(doc.cm, markText)(doc, from, to, options, type);

    var marker = new TextMarker(doc, type), diff = cmp(from, to);
    if (options) copyObj(options, marker, false);
    // Don't connect empty markers unless clearWhenEmpty is false
    if (diff > 0 || diff == 0 && marker.clearWhenEmpty !== false)
      return marker;
    if (marker.replacedWith) {
      // Showing up as a widget implies collapsed (widget replaces text)
      marker.collapsed = true;
      marker.widgetNode = elt("span", [marker.replacedWith], "CodeMirror-widget");
      if (!options.handleMouseEvents) marker.widgetNode.setAttribute("cm-ignore-events", "true");
      if (options.insertLeft) marker.widgetNode.insertLeft = true;
    }
    if (marker.collapsed) {
      if (conflictingCollapsedRange(doc, from.line, from, to, marker) ||
          from.line != to.line && conflictingCollapsedRange(doc, to.line, from, to, marker))
        throw new Error("Inserting collapsed marker partially overlapping an existing one");
      sawCollapsedSpans = true;
    }

    if (marker.addToHistory)
      addChangeToHistory(doc, {from: from, to: to, origin: "markText"}, doc.sel, NaN);

    var curLine = from.line, cm = doc.cm, updateMaxLine;
    doc.iter(curLine, to.line + 1, function(line) {
      if (cm && marker.collapsed && !cm.options.lineWrapping && visualLine(line) == cm.display.maxLine)
        updateMaxLine = true;
      if (marker.collapsed && curLine != from.line) updateLineHeight(line, 0);
      addMarkedSpan(line, new MarkedSpan(marker,
                                         curLine == from.line ? from.ch : null,
                                         curLine == to.line ? to.ch : null));
      ++curLine;
    });
    // lineIsHidden depends on the presence of the spans, so needs a second pass
    if (marker.collapsed) doc.iter(from.line, to.line + 1, function(line) {
      if (lineIsHidden(doc, line)) updateLineHeight(line, 0);
    });

    if (marker.clearOnEnter) on(marker, "beforeCursorEnter", function() { marker.clear(); });

    if (marker.readOnly) {
      sawReadOnlySpans = true;
      if (doc.history.done.length || doc.history.undone.length)
        doc.clearHistory();
    }
    if (marker.collapsed) {
      marker.id = ++nextMarkerId;
      marker.atomic = true;
    }
    if (cm) {
      // Sync editor state
      if (updateMaxLine) cm.curOp.updateMaxLine = true;
      if (marker.collapsed)
        regChange(cm, from.line, to.line + 1);
      else if (marker.className || marker.title || marker.startStyle || marker.endStyle || marker.css)
        for (var i = from.line; i <= to.line; i++) regLineChange(cm, i, "text");
      if (marker.atomic) reCheckSelection(cm.doc);
      signalLater(cm, "markerAdded", cm, marker);
    }
    return marker;
  }

  // SHARED TEXTMARKERS

  // A shared marker spans multiple linked documents. It is
  // implemented as a meta-marker-object controlling multiple normal
  // markers.
  var SharedTextMarker = CodeMirror.SharedTextMarker = function(markers, primary) {
    this.markers = markers;
    this.primary = primary;
    for (var i = 0; i < markers.length; ++i)
      markers[i].parent = this;
  };
  eventMixin(SharedTextMarker);

  SharedTextMarker.prototype.clear = function() {
    if (this.explicitlyCleared) return;
    this.explicitlyCleared = true;
    for (var i = 0; i < this.markers.length; ++i)
      this.markers[i].clear();
    signalLater(this, "clear");
  };
  SharedTextMarker.prototype.find = function(side, lineObj) {
    return this.primary.find(side, lineObj);
  };

  function markTextShared(doc, from, to, options, type) {
    options = copyObj(options);
    options.shared = false;
    var markers = [markText(doc, from, to, options, type)], primary = markers[0];
    var widget = options.widgetNode;
    linkedDocs(doc, function(doc) {
      if (widget) options.widgetNode = widget.cloneNode(true);
      markers.push(markText(doc, clipPos(doc, from), clipPos(doc, to), options, type));
      for (var i = 0; i < doc.linked.length; ++i)
        if (doc.linked[i].isParent) return;
      primary = lst(markers);
    });
    return new SharedTextMarker(markers, primary);
  }

  function findSharedMarkers(doc) {
    return doc.findMarks(Pos(doc.first, 0), doc.clipPos(Pos(doc.lastLine())),
                         function(m) { return m.parent; });
  }

  function copySharedMarkers(doc, markers) {
    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i], pos = marker.find();
      var mFrom = doc.clipPos(pos.from), mTo = doc.clipPos(pos.to);
      if (cmp(mFrom, mTo)) {
        var subMark = markText(doc, mFrom, mTo, marker.primary, marker.primary.type);
        marker.markers.push(subMark);
        subMark.parent = marker;
      }
    }
  }

  function detachSharedMarkers(markers) {
    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i], linked = [marker.primary.doc];;
      linkedDocs(marker.primary.doc, function(d) { linked.push(d); });
      for (var j = 0; j < marker.markers.length; j++) {
        var subMarker = marker.markers[j];
        if (indexOf(linked, subMarker.doc) == -1) {
          subMarker.parent = null;
          marker.markers.splice(j--, 1);
        }
      }
    }
  }

  // TEXTMARKER SPANS

  function MarkedSpan(marker, from, to) {
    this.marker = marker;
    this.from = from; this.to = to;
  }

  // Search an array of spans for a span matching the given marker.
  function getMarkedSpanFor(spans, marker) {
    if (spans) for (var i = 0; i < spans.length; ++i) {
      var span = spans[i];
      if (span.marker == marker) return span;
    }
  }
  // Remove a span from an array, returning undefined if no spans are
  // left (we don't store arrays for lines without spans).
  function removeMarkedSpan(spans, span) {
    for (var r, i = 0; i < spans.length; ++i)
      if (spans[i] != span) (r || (r = [])).push(spans[i]);
    return r;
  }
  // Add a span to a line.
  function addMarkedSpan(line, span) {
    line.markedSpans = line.markedSpans ? line.markedSpans.concat([span]) : [span];
    span.marker.attachLine(line);
  }

  // Used for the algorithm that adjusts markers for a change in the
  // document. These functions cut an array of spans at a given
  // character position, returning an array of remaining chunks (or
  // undefined if nothing remains).
  function markedSpansBefore(old, startCh, isInsert) {
    if (old) for (var i = 0, nw; i < old.length; ++i) {
      var span = old[i], marker = span.marker;
      var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh);
      if (startsBefore || span.from == startCh && marker.type == "bookmark" && (!isInsert || !span.marker.insertLeft)) {
        var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh);
        (nw || (nw = [])).push(new MarkedSpan(marker, span.from, endsAfter ? null : span.to));
      }
    }
    return nw;
  }
  function markedSpansAfter(old, endCh, isInsert) {
    if (old) for (var i = 0, nw; i < old.length; ++i) {
      var span = old[i], marker = span.marker;
      var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh);
      if (endsAfter || span.from == endCh && marker.type == "bookmark" && (!isInsert || span.marker.insertLeft)) {
        var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh);
        (nw || (nw = [])).push(new MarkedSpan(marker, startsBefore ? null : span.from - endCh,
                                              span.to == null ? null : span.to - endCh));
      }
    }
    return nw;
  }

  // Given a change object, compute the new set of marker spans that
  // cover the line in which the change took place. Removes spans
  // entirely within the change, reconnects spans belonging to the
  // same marker that appear on both sides of the change, and cuts off
  // spans partially within the change. Returns an array of span
  // arrays with one element for each line in (after) the change.
  function stretchSpansOverChange(doc, change) {
    if (change.full) return null;
    var oldFirst = isLine(doc, change.from.line) && getLine(doc, change.from.line).markedSpans;
    var oldLast = isLine(doc, change.to.line) && getLine(doc, change.to.line).markedSpans;
    if (!oldFirst && !oldLast) return null;

    var startCh = change.from.ch, endCh = change.to.ch, isInsert = cmp(change.from, change.to) == 0;
    // Get the spans that 'stick out' on both sides
    var first = markedSpansBefore(oldFirst, startCh, isInsert);
    var last = markedSpansAfter(oldLast, endCh, isInsert);

    // Next, merge those two ends
    var sameLine = change.text.length == 1, offset = lst(change.text).length + (sameLine ? startCh : 0);
    if (first) {
      // Fix up .to properties of first
      for (var i = 0; i < first.length; ++i) {
        var span = first[i];
        if (span.to == null) {
          var found = getMarkedSpanFor(last, span.marker);
          if (!found) span.to = startCh;
          else if (sameLine) span.to = found.to == null ? null : found.to + offset;
        }
      }
    }
    if (last) {
      // Fix up .from in last (or move them into first in case of sameLine)
      for (var i = 0; i < last.length; ++i) {
        var span = last[i];
        if (span.to != null) span.to += offset;
        if (span.from == null) {
          var found = getMarkedSpanFor(first, span.marker);
          if (!found) {
            span.from = offset;
            if (sameLine) (first || (first = [])).push(span);
          }
        } else {
          span.from += offset;
          if (sameLine) (first || (first = [])).push(span);
        }
      }
    }
    // Make sure we didn't create any zero-length spans
    if (first) first = clearEmptySpans(first);
    if (last && last != first) last = clearEmptySpans(last);

    var newMarkers = [first];
    if (!sameLine) {
      // Fill gap with whole-line-spans
      var gap = change.text.length - 2, gapMarkers;
      if (gap > 0 && first)
        for (var i = 0; i < first.length; ++i)
          if (first[i].to == null)
            (gapMarkers || (gapMarkers = [])).push(new MarkedSpan(first[i].marker, null, null));
      for (var i = 0; i < gap; ++i)
        newMarkers.push(gapMarkers);
      newMarkers.push(last);
    }
    return newMarkers;
  }

  // Remove spans that are empty and don't have a clearWhenEmpty
  // option of false.
  function clearEmptySpans(spans) {
    for (var i = 0; i < spans.length; ++i) {
      var span = spans[i];
      if (span.from != null && span.from == span.to && span.marker.clearWhenEmpty !== false)
        spans.splice(i--, 1);
    }
    if (!spans.length) return null;
    return spans;
  }

  // Used for un/re-doing changes from the history. Combines the
  // result of computing the existing spans with the set of spans that
  // existed in the history (so that deleting around a span and then
  // undoing brings back the span).
  function mergeOldSpans(doc, change) {
    var old = getOldSpans(doc, change);
    var stretched = stretchSpansOverChange(doc, change);
    if (!old) return stretched;
    if (!stretched) return old;

    for (var i = 0; i < old.length; ++i) {
      var oldCur = old[i], stretchCur = stretched[i];
      if (oldCur && stretchCur) {
        spans: for (var j = 0; j < stretchCur.length; ++j) {
          var span = stretchCur[j];
          for (var k = 0; k < oldCur.length; ++k)
            if (oldCur[k].marker == span.marker) continue spans;
          oldCur.push(span);
        }
      } else if (stretchCur) {
        old[i] = stretchCur;
      }
    }
    return old;
  }

  // Used to 'clip' out readOnly ranges when making a change.
  function removeReadOnlyRanges(doc, from, to) {
    var markers = null;
    doc.iter(from.line, to.line + 1, function(line) {
      if (line.markedSpans) for (var i = 0; i < line.markedSpans.length; ++i) {
        var mark = line.markedSpans[i].marker;
        if (mark.readOnly && (!markers || indexOf(markers, mark) == -1))
          (markers || (markers = [])).push(mark);
      }
    });
    if (!markers) return null;
    var parts = [{from: from, to: to}];
    for (var i = 0; i < markers.length; ++i) {
      var mk = markers[i], m = mk.find(0);
      for (var j = 0; j < parts.length; ++j) {
        var p = parts[j];
        if (cmp(p.to, m.from) < 0 || cmp(p.from, m.to) > 0) continue;
        var newParts = [j, 1], dfrom = cmp(p.from, m.from), dto = cmp(p.to, m.to);
        if (dfrom < 0 || !mk.inclusiveLeft && !dfrom)
          newParts.push({from: p.from, to: m.from});
        if (dto > 0 || !mk.inclusiveRight && !dto)
          newParts.push({from: m.to, to: p.to});
        parts.splice.apply(parts, newParts);
        j += newParts.length - 1;
      }
    }
    return parts;
  }

  // Connect or disconnect spans from a line.
  function detachMarkedSpans(line) {
    var spans = line.markedSpans;
    if (!spans) return;
    for (var i = 0; i < spans.length; ++i)
      spans[i].marker.detachLine(line);
    line.markedSpans = null;
  }
  function attachMarkedSpans(line, spans) {
    if (!spans) return;
    for (var i = 0; i < spans.length; ++i)
      spans[i].marker.attachLine(line);
    line.markedSpans = spans;
  }

  // Helpers used when computing which overlapping collapsed span
  // counts as the larger one.
  function extraLeft(marker) { return marker.inclusiveLeft ? -1 : 0; }
  function extraRight(marker) { return marker.inclusiveRight ? 1 : 0; }

  // Returns a number indicating which of two overlapping collapsed
  // spans is larger (and thus includes the other). Falls back to
  // comparing ids when the spans cover exactly the same range.
  function compareCollapsedMarkers(a, b) {
    var lenDiff = a.lines.length - b.lines.length;
    if (lenDiff != 0) return lenDiff;
    var aPos = a.find(), bPos = b.find();
    var fromCmp = cmp(aPos.from, bPos.from) || extraLeft(a) - extraLeft(b);
    if (fromCmp) return -fromCmp;
    var toCmp = cmp(aPos.to, bPos.to) || extraRight(a) - extraRight(b);
    if (toCmp) return toCmp;
    return b.id - a.id;
  }

  // Find out whether a line ends or starts in a collapsed span. If
  // so, return the marker for that span.
  function collapsedSpanAtSide(line, start) {
    var sps = sawCollapsedSpans && line.markedSpans, found;
    if (sps) for (var sp, i = 0; i < sps.length; ++i) {
      sp = sps[i];
      if (sp.marker.collapsed && (start ? sp.from : sp.to) == null &&
          (!found || compareCollapsedMarkers(found, sp.marker) < 0))
        found = sp.marker;
    }
    return found;
  }
  function collapsedSpanAtStart(line) { return collapsedSpanAtSide(line, true); }
  function collapsedSpanAtEnd(line) { return collapsedSpanAtSide(line, false); }

  // Test whether there exists a collapsed span that partially
  // overlaps (covers the start or end, but not both) of a new span.
  // Such overlap is not allowed.
  function conflictingCollapsedRange(doc, lineNo, from, to, marker) {
    var line = getLine(doc, lineNo);
    var sps = sawCollapsedSpans && line.markedSpans;
    if (sps) for (var i = 0; i < sps.length; ++i) {
      var sp = sps[i];
      if (!sp.marker.collapsed) continue;
      var found = sp.marker.find(0);
      var fromCmp = cmp(found.from, from) || extraLeft(sp.marker) - extraLeft(marker);
      var toCmp = cmp(found.to, to) || extraRight(sp.marker) - extraRight(marker);
      if (fromCmp >= 0 && toCmp <= 0 || fromCmp <= 0 && toCmp >= 0) continue;
      if (fromCmp <= 0 && (cmp(found.to, from) > 0 || (sp.marker.inclusiveRight && marker.inclusiveLeft)) ||
          fromCmp >= 0 && (cmp(found.from, to) < 0 || (sp.marker.inclusiveLeft && marker.inclusiveRight)))
        return true;
    }
  }

  // A visual line is a line as drawn on the screen. Folding, for
  // example, can cause multiple logical lines to appear on the same
  // visual line. This finds the start of the visual line that the
  // given line is part of (usually that is the line itself).
  function visualLine(line) {
    var merged;
    while (merged = collapsedSpanAtStart(line))
      line = merged.find(-1, true).line;
    return line;
  }

  // Returns an array of logical lines that continue the visual line
  // started by the argument, or undefined if there are no such lines.
  function visualLineContinued(line) {
    var merged, lines;
    while (merged = collapsedSpanAtEnd(line)) {
      line = merged.find(1, true).line;
      (lines || (lines = [])).push(line);
    }
    return lines;
  }

  // Get the line number of the start of the visual line that the
  // given line number is part of.
  function visualLineNo(doc, lineN) {
    var line = getLine(doc, lineN), vis = visualLine(line);
    if (line == vis) return lineN;
    return lineNo(vis);
  }
  // Get the line number of the start of the next visual line after
  // the given line.
  function visualLineEndNo(doc, lineN) {
    if (lineN > doc.lastLine()) return lineN;
    var line = getLine(doc, lineN), merged;
    if (!lineIsHidden(doc, line)) return lineN;
    while (merged = collapsedSpanAtEnd(line))
      line = merged.find(1, true).line;
    return lineNo(line) + 1;
  }

  // Compute whether a line is hidden. Lines count as hidden when they
  // are part of a visual line that starts with another line, or when
  // they are entirely covered by collapsed, non-widget span.
  function lineIsHidden(doc, line) {
    var sps = sawCollapsedSpans && line.markedSpans;
    if (sps) for (var sp, i = 0; i < sps.length; ++i) {
      sp = sps[i];
      if (!sp.marker.collapsed) continue;
      if (sp.from == null) return true;
      if (sp.marker.widgetNode) continue;
      if (sp.from == 0 && sp.marker.inclusiveLeft && lineIsHiddenInner(doc, line, sp))
        return true;
    }
  }
  function lineIsHiddenInner(doc, line, span) {
    if (span.to == null) {
      var end = span.marker.find(1, true);
      return lineIsHiddenInner(doc, end.line, getMarkedSpanFor(end.line.markedSpans, span.marker));
    }
    if (span.marker.inclusiveRight && span.to == line.text.length)
      return true;
    for (var sp, i = 0; i < line.markedSpans.length; ++i) {
      sp = line.markedSpans[i];
      if (sp.marker.collapsed && !sp.marker.widgetNode && sp.from == span.to &&
          (sp.to == null || sp.to != span.from) &&
          (sp.marker.inclusiveLeft || span.marker.inclusiveRight) &&
          lineIsHiddenInner(doc, line, sp)) return true;
    }
  }

  // LINE WIDGETS

  // Line widgets are block elements displayed above or below a line.

  var LineWidget = CodeMirror.LineWidget = function(doc, node, options) {
    if (options) for (var opt in options) if (options.hasOwnProperty(opt))
      this[opt] = options[opt];
    this.doc = doc;
    this.node = node;
  };
  eventMixin(LineWidget);

  function adjustScrollWhenAboveVisible(cm, line, diff) {
    if (heightAtLine(line) < ((cm.curOp && cm.curOp.scrollTop) || cm.doc.scrollTop))
      addToScrollPos(cm, null, diff);
  }

  LineWidget.prototype.clear = function() {
    var cm = this.doc.cm, ws = this.line.widgets, line = this.line, no = lineNo(line);
    if (no == null || !ws) return;
    for (var i = 0; i < ws.length; ++i) if (ws[i] == this) ws.splice(i--, 1);
    if (!ws.length) line.widgets = null;
    var height = widgetHeight(this);
    updateLineHeight(line, Math.max(0, line.height - height));
    if (cm) runInOp(cm, function() {
      adjustScrollWhenAboveVisible(cm, line, -height);
      regLineChange(cm, no, "widget");
    });
  };
  LineWidget.prototype.changed = function() {
    var oldH = this.height, cm = this.doc.cm, line = this.line;
    this.height = null;
    var diff = widgetHeight(this) - oldH;
    if (!diff) return;
    updateLineHeight(line, line.height + diff);
    if (cm) runInOp(cm, function() {
      cm.curOp.forceUpdate = true;
      adjustScrollWhenAboveVisible(cm, line, diff);
    });
  };

  function widgetHeight(widget) {
    if (widget.height != null) return widget.height;
    var cm = widget.doc.cm;
    if (!cm) return 0;
    if (!contains(document.body, widget.node)) {
      var parentStyle = "position: relative;";
      if (widget.coverGutter)
        parentStyle += "margin-left: -" + cm.display.gutters.offsetWidth + "px;";
      if (widget.noHScroll)
        parentStyle += "width: " + cm.display.wrapper.clientWidth + "px;";
      removeChildrenAndAdd(cm.display.measure, elt("div", [widget.node], null, parentStyle));
    }
    return widget.height = widget.node.offsetHeight;
  }

  function addLineWidget(doc, handle, node, options) {
    var widget = new LineWidget(doc, node, options);
    var cm = doc.cm;
    if (cm && widget.noHScroll) cm.display.alignWidgets = true;
    changeLine(doc, handle, "widget", function(line) {
      var widgets = line.widgets || (line.widgets = []);
      if (widget.insertAt == null) widgets.push(widget);
      else widgets.splice(Math.min(widgets.length - 1, Math.max(0, widget.insertAt)), 0, widget);
      widget.line = line;
      if (cm && !lineIsHidden(doc, line)) {
        var aboveVisible = heightAtLine(line) < doc.scrollTop;
        updateLineHeight(line, line.height + widgetHeight(widget));
        if (aboveVisible) addToScrollPos(cm, null, widget.height);
        cm.curOp.forceUpdate = true;
      }
      return true;
    });
    return widget;
  }

  // LINE DATA STRUCTURE

  // Line objects. These hold state related to a line, including
  // highlighting info (the styles array).
  var Line = CodeMirror.Line = function(text, markedSpans, estimateHeight) {
    this.text = text;
    attachMarkedSpans(this, markedSpans);
    this.height = estimateHeight ? estimateHeight(this) : 1;
  };
  eventMixin(Line);
  Line.prototype.lineNo = function() { return lineNo(this); };

  // Change the content (text, markers) of a line. Automatically
  // invalidates cached information and tries to re-estimate the
  // line's height.
  function updateLine(line, text, markedSpans, estimateHeight) {
    line.text = text;
    if (line.stateAfter) line.stateAfter = null;
    if (line.styles) line.styles = null;
    if (line.order != null) line.order = null;
    detachMarkedSpans(line);
    attachMarkedSpans(line, markedSpans);
    var estHeight = estimateHeight ? estimateHeight(line) : 1;
    if (estHeight != line.height) updateLineHeight(line, estHeight);
  }

  // Detach a line from the document tree and its markers.
  function cleanUpLine(line) {
    line.parent = null;
    detachMarkedSpans(line);
  }

  function extractLineClasses(type, output) {
    if (type) for (;;) {
      var lineClass = type.match(/(?:^|\s+)line-(background-)?(\S+)/);
      if (!lineClass) break;
      type = type.slice(0, lineClass.index) + type.slice(lineClass.index + lineClass[0].length);
      var prop = lineClass[1] ? "bgClass" : "textClass";
      if (output[prop] == null)
        output[prop] = lineClass[2];
      else if (!(new RegExp("(?:^|\s)" + lineClass[2] + "(?:$|\s)")).test(output[prop]))
        output[prop] += " " + lineClass[2];
    }
    return type;
  }

  function callBlankLine(mode, state) {
    if (mode.blankLine) return mode.blankLine(state);
    if (!mode.innerMode) return;
    var inner = CodeMirror.innerMode(mode, state);
    if (inner.mode.blankLine) return inner.mode.blankLine(inner.state);
  }

  function readToken(mode, stream, state, inner) {
    for (var i = 0; i < 10; i++) {
      if (inner) inner[0] = CodeMirror.innerMode(mode, state).mode;
      var style = mode.token(stream, state);
      if (stream.pos > stream.start) return style;
    }
    throw new Error("Mode " + mode.name + " failed to advance stream.");
  }

  // Utility for getTokenAt and getLineTokens
  function takeToken(cm, pos, precise, asArray) {
    function getObj(copy) {
      return {start: stream.start, end: stream.pos,
              string: stream.current(),
              type: style || null,
              state: copy ? copyState(doc.mode, state) : state};
    }

    var doc = cm.doc, mode = doc.mode, style;
    pos = clipPos(doc, pos);
    var line = getLine(doc, pos.line), state = getStateBefore(cm, pos.line, precise);
    var stream = new StringStream(line.text, cm.options.tabSize), tokens;
    if (asArray) tokens = [];
    while ((asArray || stream.pos < pos.ch) && !stream.eol()) {
      stream.start = stream.pos;
      style = readToken(mode, stream, state);
      if (asArray) tokens.push(getObj(true));
    }
    return asArray ? tokens : getObj();
  }

  // Run the given mode's parser over a line, calling f for each token.
  function runMode(cm, text, mode, state, f, lineClasses, forceToEnd) {
    var flattenSpans = mode.flattenSpans;
    if (flattenSpans == null) flattenSpans = cm.options.flattenSpans;
    var curStart = 0, curStyle = null;
    var stream = new StringStream(text, cm.options.tabSize), style;
    var inner = cm.options.addModeClass && [null];
    if (text == "") extractLineClasses(callBlankLine(mode, state), lineClasses);
    while (!stream.eol()) {
      if (stream.pos > cm.options.maxHighlightLength) {
        flattenSpans = false;
        if (forceToEnd) processLine(cm, text, state, stream.pos);
        stream.pos = text.length;
        style = null;
      } else {
        style = extractLineClasses(readToken(mode, stream, state, inner), lineClasses);
      }
      if (inner) {
        var mName = inner[0].name;
        if (mName) style = "m-" + (style ? mName + " " + style : mName);
      }
      if (!flattenSpans || curStyle != style) {
        while (curStart < stream.start) {
          curStart = Math.min(stream.start, curStart + 50000);
          f(curStart, curStyle);
        }
        curStyle = style;
      }
      stream.start = stream.pos;
    }
    while (curStart < stream.pos) {
      // Webkit seems to refuse to render text nodes longer than 57444 characters
      var pos = Math.min(stream.pos, curStart + 50000);
      f(pos, curStyle);
      curStart = pos;
    }
  }

  // Compute a style array (an array starting with a mode generation
  // -- for invalidation -- followed by pairs of end positions and
  // style strings), which is used to highlight the tokens on the
  // line.
  function highlightLine(cm, line, state, forceToEnd) {
    // A styles array always starts with a number identifying the
    // mode/overlays that it is based on (for easy invalidation).
    var st = [cm.state.modeGen], lineClasses = {};
    // Compute the base array of styles
    runMode(cm, line.text, cm.doc.mode, state, function(end, style) {
      st.push(end, style);
    }, lineClasses, forceToEnd);

    // Run overlays, adjust style array.
    for (var o = 0; o < cm.state.overlays.length; ++o) {
      var overlay = cm.state.overlays[o], i = 1, at = 0;
      runMode(cm, line.text, overlay.mode, true, function(end, style) {
        var start = i;
        // Ensure there's a token end at the current position, and that i points at it
        while (at < end) {
          var i_end = st[i];
          if (i_end > end)
            st.splice(i, 1, end, st[i+1], i_end);
          i += 2;
          at = Math.min(end, i_end);
        }
        if (!style) return;
        if (overlay.opaque) {
          st.splice(start, i - start, end, "cm-overlay " + style);
          i = start + 2;
        } else {
          for (; start < i; start += 2) {
            var cur = st[start+1];
            st[start+1] = (cur ? cur + " " : "") + "cm-overlay " + style;
          }
        }
      }, lineClasses);
    }

    return {styles: st, classes: lineClasses.bgClass || lineClasses.textClass ? lineClasses : null};
  }

  function getLineStyles(cm, line, updateFrontier) {
    if (!line.styles || line.styles[0] != cm.state.modeGen) {
      var state = getStateBefore(cm, lineNo(line));
      var result = highlightLine(cm, line, line.text.length > cm.options.maxHighlightLength ? copyState(cm.doc.mode, state) : state);
      line.stateAfter = state;
      line.styles = result.styles;
      if (result.classes) line.styleClasses = result.classes;
      else if (line.styleClasses) line.styleClasses = null;
      if (updateFrontier === cm.doc.frontier) cm.doc.frontier++;
    }
    return line.styles;
  }

  // Lightweight form of highlight -- proceed over this line and
  // update state, but don't save a style array. Used for lines that
  // aren't currently visible.
  function processLine(cm, text, state, startAt) {
    var mode = cm.doc.mode;
    var stream = new StringStream(text, cm.options.tabSize);
    stream.start = stream.pos = startAt || 0;
    if (text == "") callBlankLine(mode, state);
    while (!stream.eol()) {
      readToken(mode, stream, state);
      stream.start = stream.pos;
    }
  }

  // Convert a style as returned by a mode (either null, or a string
  // containing one or more styles) to a CSS style. This is cached,
  // and also looks for line-wide styles.
  var styleToClassCache = {}, styleToClassCacheWithMode = {};
  function interpretTokenStyle(style, options) {
    if (!style || /^\s*$/.test(style)) return null;
    var cache = options.addModeClass ? styleToClassCacheWithMode : styleToClassCache;
    return cache[style] ||
      (cache[style] = style.replace(/\S+/g, "cm-$&"));
  }

  // Render the DOM representation of the text of a line. Also builds
  // up a 'line map', which points at the DOM nodes that represent
  // specific stretches of text, and is used by the measuring code.
  // The returned object contains the DOM node, this map, and
  // information about line-wide styles that were set by the mode.
  function buildLineContent(cm, lineView) {
    // The padding-right forces the element to have a 'border', which
    // is needed on Webkit to be able to get line-level bounding
    // rectangles for it (in measureChar).
    var content = elt("span", null, null, webkit ? "padding-right: .1px" : null);
    var builder = {pre: elt("pre", [content], "CodeMirror-line"), content: content,
                   col: 0, pos: 0, cm: cm,
                   splitSpaces: (ie || webkit) && cm.getOption("lineWrapping")};
    lineView.measure = {};

    // Iterate over the logical lines that make up this visual line.
    for (var i = 0; i <= (lineView.rest ? lineView.rest.length : 0); i++) {
      var line = i ? lineView.rest[i - 1] : lineView.line, order;
      builder.pos = 0;
      builder.addToken = buildToken;
      // Optionally wire in some hacks into the token-rendering
      // algorithm, to deal with browser quirks.
      if (hasBadBidiRects(cm.display.measure) && (order = getOrder(line)))
        builder.addToken = buildTokenBadBidi(builder.addToken, order);
      builder.map = [];
      var allowFrontierUpdate = lineView != cm.display.externalMeasured && lineNo(line);
      insertLineContent(line, builder, getLineStyles(cm, line, allowFrontierUpdate));
      if (line.styleClasses) {
        if (line.styleClasses.bgClass)
          builder.bgClass = joinClasses(line.styleClasses.bgClass, builder.bgClass || "");
        if (line.styleClasses.textClass)
          builder.textClass = joinClasses(line.styleClasses.textClass, builder.textClass || "");
      }

      // Ensure at least a single node is present, for measuring.
      if (builder.map.length == 0)
        builder.map.push(0, 0, builder.content.appendChild(zeroWidthElement(cm.display.measure)));

      // Store the map and a cache object for the current logical line
      if (i == 0) {
        lineView.measure.map = builder.map;
        lineView.measure.cache = {};
      } else {
        (lineView.measure.maps || (lineView.measure.maps = [])).push(builder.map);
        (lineView.measure.caches || (lineView.measure.caches = [])).push({});
      }
    }

    // See issue #2901
    if (webkit && /\bcm-tab\b/.test(builder.content.lastChild.className))
      builder.content.className = "cm-tab-wrap-hack";

    signal(cm, "renderLine", cm, lineView.line, builder.pre);
    if (builder.pre.className)
      builder.textClass = joinClasses(builder.pre.className, builder.textClass || "");

    return builder;
  }

  function defaultSpecialCharPlaceholder(ch) {
    var token = elt("span", "\u2022", "cm-invalidchar");
    token.title = "\\u" + ch.charCodeAt(0).toString(16);
    token.setAttribute("aria-label", token.title);
    return token;
  }

  // Build up the DOM representation for a single token, and add it to
  // the line map. Takes care to render special characters separately.
  function buildToken(builder, text, style, startStyle, endStyle, title, css) {
    if (!text) return;
    var displayText = builder.splitSpaces ? text.replace(/ {3,}/g, splitSpaces) : text;
    var special = builder.cm.state.specialChars, mustWrap = false;
    if (!special.test(text)) {
      builder.col += text.length;
      var content = document.createTextNode(displayText);
      builder.map.push(builder.pos, builder.pos + text.length, content);
      if (ie && ie_version < 9) mustWrap = true;
      builder.pos += text.length;
    } else {
      var content = document.createDocumentFragment(), pos = 0;
      while (true) {
        special.lastIndex = pos;
        var m = special.exec(text);
        var skipped = m ? m.index - pos : text.length - pos;
        if (skipped) {
          var txt = document.createTextNode(displayText.slice(pos, pos + skipped));
          if (ie && ie_version < 9) content.appendChild(elt("span", [txt]));
          else content.appendChild(txt);
          builder.map.push(builder.pos, builder.pos + skipped, txt);
          builder.col += skipped;
          builder.pos += skipped;
        }
        if (!m) break;
        pos += skipped + 1;
        if (m[0] == "\t") {
          var tabSize = builder.cm.options.tabSize, tabWidth = tabSize - builder.col % tabSize;
          var txt = content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"));
          txt.setAttribute("role", "presentation");
          txt.setAttribute("cm-text", "\t");
          builder.col += tabWidth;
        } else if (m[0] == "\r" || m[0] == "\n") {
          var txt = content.appendChild(elt("span", m[0] == "\r" ? "\u240d" : "\u2424", "cm-invalidchar"));
          txt.setAttribute("cm-text", m[0]);
          builder.col += 1;
        } else {
          var txt = builder.cm.options.specialCharPlaceholder(m[0]);
          txt.setAttribute("cm-text", m[0]);
          if (ie && ie_version < 9) content.appendChild(elt("span", [txt]));
          else content.appendChild(txt);
          builder.col += 1;
        }
        builder.map.push(builder.pos, builder.pos + 1, txt);
        builder.pos++;
      }
    }
    if (style || startStyle || endStyle || mustWrap || css) {
      var fullStyle = style || "";
      if (startStyle) fullStyle += startStyle;
      if (endStyle) fullStyle += endStyle;
      var token = elt("span", [content], fullStyle, css);
      if (title) token.title = title;
      return builder.content.appendChild(token);
    }
    builder.content.appendChild(content);
  }

  function splitSpaces(old) {
    var out = " ";
    for (var i = 0; i < old.length - 2; ++i) out += i % 2 ? " " : "\u00a0";
    out += " ";
    return out;
  }

  // Work around nonsense dimensions being reported for stretches of
  // right-to-left text.
  function buildTokenBadBidi(inner, order) {
    return function(builder, text, style, startStyle, endStyle, title, css) {
      style = style ? style + " cm-force-border" : "cm-force-border";
      var start = builder.pos, end = start + text.length;
      for (;;) {
        // Find the part that overlaps with the start of this text
        for (var i = 0; i < order.length; i++) {
          var part = order[i];
          if (part.to > start && part.from <= start) break;
        }
        if (part.to >= end) return inner(builder, text, style, startStyle, endStyle, title, css);
        inner(builder, text.slice(0, part.to - start), style, startStyle, null, title, css);
        startStyle = null;
        text = text.slice(part.to - start);
        start = part.to;
      }
    };
  }

  function buildCollapsedSpan(builder, size, marker, ignoreWidget) {
    var widget = !ignoreWidget && marker.widgetNode;
    if (widget) builder.map.push(builder.pos, builder.pos + size, widget);
    if (!ignoreWidget && builder.cm.display.input.needsContentAttribute) {
      if (!widget)
        widget = builder.content.appendChild(document.createElement("span"));
      widget.setAttribute("cm-marker", marker.id);
    }
    if (widget) {
      builder.cm.display.input.setUneditable(widget);
      builder.content.appendChild(widget);
    }
    builder.pos += size;
  }

  // Outputs a number of spans to make up a line, taking highlighting
  // and marked text into account.
  function insertLineContent(line, builder, styles) {
    var spans = line.markedSpans, allText = line.text, at = 0;
    if (!spans) {
      for (var i = 1; i < styles.length; i+=2)
        builder.addToken(builder, allText.slice(at, at = styles[i]), interpretTokenStyle(styles[i+1], builder.cm.options));
      return;
    }

    var len = allText.length, pos = 0, i = 1, text = "", style, css;
    var nextChange = 0, spanStyle, spanEndStyle, spanStartStyle, title, collapsed;
    for (;;) {
      if (nextChange == pos) { // Update current marker set
        spanStyle = spanEndStyle = spanStartStyle = title = css = "";
        collapsed = null; nextChange = Infinity;
        var foundBookmarks = [];
        for (var j = 0; j < spans.length; ++j) {
          var sp = spans[j], m = sp.marker;
          if (m.type == "bookmark" && sp.from == pos && m.widgetNode) {
            foundBookmarks.push(m);
          } else if (sp.from <= pos && (sp.to == null || sp.to > pos || m.collapsed && sp.to == pos && sp.from == pos)) {
            if (sp.to != null && sp.to != pos && nextChange > sp.to) {
              nextChange = sp.to;
              spanEndStyle = "";
            }
            if (m.className) spanStyle += " " + m.className;
            if (m.css) css = (css ? css + ";" : "") + m.css;
            if (m.startStyle && sp.from == pos) spanStartStyle += " " + m.startStyle;
            if (m.endStyle && sp.to == nextChange) spanEndStyle += " " + m.endStyle;
            if (m.title && !title) title = m.title;
            if (m.collapsed && (!collapsed || compareCollapsedMarkers(collapsed.marker, m) < 0))
              collapsed = sp;
          } else if (sp.from > pos && nextChange > sp.from) {
            nextChange = sp.from;
          }
        }
        if (collapsed && (collapsed.from || 0) == pos) {
          buildCollapsedSpan(builder, (collapsed.to == null ? len + 1 : collapsed.to) - pos,
                             collapsed.marker, collapsed.from == null);
          if (collapsed.to == null) return;
          if (collapsed.to == pos) collapsed = false;
        }
        if (!collapsed && foundBookmarks.length) for (var j = 0; j < foundBookmarks.length; ++j)
          buildCollapsedSpan(builder, 0, foundBookmarks[j]);
      }
      if (pos >= len) break;

      var upto = Math.min(len, nextChange);
      while (true) {
        if (text) {
          var end = pos + text.length;
          if (!collapsed) {
            var tokenText = end > upto ? text.slice(0, upto - pos) : text;
            builder.addToken(builder, tokenText, style ? style + spanStyle : spanStyle,
                             spanStartStyle, pos + tokenText.length == nextChange ? spanEndStyle : "", title, css);
          }
          if (end >= upto) {text = text.slice(upto - pos); pos = upto; break;}
          pos = end;
          spanStartStyle = "";
        }
        text = allText.slice(at, at = styles[i++]);
        style = interpretTokenStyle(styles[i++], builder.cm.options);
      }
    }
  }

  // DOCUMENT DATA STRUCTURE

  // By default, updates that start and end at the beginning of a line
  // are treated specially, in order to make the association of line
  // widgets and marker elements with the text behave more intuitive.
  function isWholeLineUpdate(doc, change) {
    return change.from.ch == 0 && change.to.ch == 0 && lst(change.text) == "" &&
      (!doc.cm || doc.cm.options.wholeLineUpdateBefore);
  }

  // Perform a change on the document data structure.
  function updateDoc(doc, change, markedSpans, estimateHeight) {
    function spansFor(n) {return markedSpans ? markedSpans[n] : null;}
    function update(line, text, spans) {
      updateLine(line, text, spans, estimateHeight);
      signalLater(line, "change", line, change);
    }
    function linesFor(start, end) {
      for (var i = start, result = []; i < end; ++i)
        result.push(new Line(text[i], spansFor(i), estimateHeight));
      return result;
    }

    var from = change.from, to = change.to, text = change.text;
    var firstLine = getLine(doc, from.line), lastLine = getLine(doc, to.line);
    var lastText = lst(text), lastSpans = spansFor(text.length - 1), nlines = to.line - from.line;

    // Adjust the line structure
    if (change.full) {
      doc.insert(0, linesFor(0, text.length));
      doc.remove(text.length, doc.size - text.length);
    } else if (isWholeLineUpdate(doc, change)) {
      // This is a whole-line replace. Treated specially to make
      // sure line objects move the way they are supposed to.
      var added = linesFor(0, text.length - 1);
      update(lastLine, lastLine.text, lastSpans);
      if (nlines) doc.remove(from.line, nlines);
      if (added.length) doc.insert(from.line, added);
    } else if (firstLine == lastLine) {
      if (text.length == 1) {
        update(firstLine, firstLine.text.slice(0, from.ch) + lastText + firstLine.text.slice(to.ch), lastSpans);
      } else {
        var added = linesFor(1, text.length - 1);
        added.push(new Line(lastText + firstLine.text.slice(to.ch), lastSpans, estimateHeight));
        update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
        doc.insert(from.line + 1, added);
      }
    } else if (text.length == 1) {
      update(firstLine, firstLine.text.slice(0, from.ch) + text[0] + lastLine.text.slice(to.ch), spansFor(0));
      doc.remove(from.line + 1, nlines);
    } else {
      update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
      update(lastLine, lastText + lastLine.text.slice(to.ch), lastSpans);
      var added = linesFor(1, text.length - 1);
      if (nlines > 1) doc.remove(from.line + 1, nlines - 1);
      doc.insert(from.line + 1, added);
    }

    signalLater(doc, "change", doc, change);
  }

  // The document is represented as a BTree consisting of leaves, with
  // chunk of lines in them, and branches, with up to ten leaves or
  // other branch nodes below them. The top node is always a branch
  // node, and is the document object itself (meaning it has
  // additional methods and properties).
  //
  // All nodes have parent links. The tree is used both to go from
  // line numbers to line objects, and to go from objects to numbers.
  // It also indexes by height, and is used to convert between height
  // and line object, and to find the total height of the document.
  //
  // See also http://marijnhaverbeke.nl/blog/codemirror-line-tree.html

  function LeafChunk(lines) {
    this.lines = lines;
    this.parent = null;
    for (var i = 0, height = 0; i < lines.length; ++i) {
      lines[i].parent = this;
      height += lines[i].height;
    }
    this.height = height;
  }

  LeafChunk.prototype = {
    chunkSize: function() { return this.lines.length; },
    // Remove the n lines at offset 'at'.
    removeInner: function(at, n) {
      for (var i = at, e = at + n; i < e; ++i) {
        var line = this.lines[i];
        this.height -= line.height;
        cleanUpLine(line);
        signalLater(line, "delete");
      }
      this.lines.splice(at, n);
    },
    // Helper used to collapse a small branch into a single leaf.
    collapse: function(lines) {
      lines.push.apply(lines, this.lines);
    },
    // Insert the given array of lines at offset 'at', count them as
    // having the given height.
    insertInner: function(at, lines, height) {
      this.height += height;
      this.lines = this.lines.slice(0, at).concat(lines).concat(this.lines.slice(at));
      for (var i = 0; i < lines.length; ++i) lines[i].parent = this;
    },
    // Used to iterate over a part of the tree.
    iterN: function(at, n, op) {
      for (var e = at + n; at < e; ++at)
        if (op(this.lines[at])) return true;
    }
  };

  function BranchChunk(children) {
    this.children = children;
    var size = 0, height = 0;
    for (var i = 0; i < children.length; ++i) {
      var ch = children[i];
      size += ch.chunkSize(); height += ch.height;
      ch.parent = this;
    }
    this.size = size;
    this.height = height;
    this.parent = null;
  }

  BranchChunk.prototype = {
    chunkSize: function() { return this.size; },
    removeInner: function(at, n) {
      this.size -= n;
      for (var i = 0; i < this.children.length; ++i) {
        var child = this.children[i], sz = child.chunkSize();
        if (at < sz) {
          var rm = Math.min(n, sz - at), oldHeight = child.height;
          child.removeInner(at, rm);
          this.height -= oldHeight - child.height;
          if (sz == rm) { this.children.splice(i--, 1); child.parent = null; }
          if ((n -= rm) == 0) break;
          at = 0;
        } else at -= sz;
      }
      // If the result is smaller than 25 lines, ensure that it is a
      // single leaf node.
      if (this.size - n < 25 &&
          (this.children.length > 1 || !(this.children[0] instanceof LeafChunk))) {
        var lines = [];
        this.collapse(lines);
        this.children = [new LeafChunk(lines)];
        this.children[0].parent = this;
      }
    },
    collapse: function(lines) {
      for (var i = 0; i < this.children.length; ++i) this.children[i].collapse(lines);
    },
    insertInner: function(at, lines, height) {
      this.size += lines.length;
      this.height += height;
      for (var i = 0; i < this.children.length; ++i) {
        var child = this.children[i], sz = child.chunkSize();
        if (at <= sz) {
          child.insertInner(at, lines, height);
          if (child.lines && child.lines.length > 50) {
            while (child.lines.length > 50) {
              var spilled = child.lines.splice(child.lines.length - 25, 25);
              var newleaf = new LeafChunk(spilled);
              child.height -= newleaf.height;
              this.children.splice(i + 1, 0, newleaf);
              newleaf.parent = this;
            }
            this.maybeSpill();
          }
          break;
        }
        at -= sz;
      }
    },
    // When a node has grown, check whether it should be split.
    maybeSpill: function() {
      if (this.children.length <= 10) return;
      var me = this;
      do {
        var spilled = me.children.splice(me.children.length - 5, 5);
        var sibling = new BranchChunk(spilled);
        if (!me.parent) { // Become the parent node
          var copy = new BranchChunk(me.children);
          copy.parent = me;
          me.children = [copy, sibling];
          me = copy;
        } else {
          me.size -= sibling.size;
          me.height -= sibling.height;
          var myIndex = indexOf(me.parent.children, me);
          me.parent.children.splice(myIndex + 1, 0, sibling);
        }
        sibling.parent = me.parent;
      } while (me.children.length > 10);
      me.parent.maybeSpill();
    },
    iterN: function(at, n, op) {
      for (var i = 0; i < this.children.length; ++i) {
        var child = this.children[i], sz = child.chunkSize();
        if (at < sz) {
          var used = Math.min(n, sz - at);
          if (child.iterN(at, used, op)) return true;
          if ((n -= used) == 0) break;
          at = 0;
        } else at -= sz;
      }
    }
  };

  var nextDocId = 0;
  var Doc = CodeMirror.Doc = function(text, mode, firstLine, lineSep) {
    if (!(this instanceof Doc)) return new Doc(text, mode, firstLine, lineSep);
    if (firstLine == null) firstLine = 0;

    BranchChunk.call(this, [new LeafChunk([new Line("", null)])]);
    this.first = firstLine;
    this.scrollTop = this.scrollLeft = 0;
    this.cantEdit = false;
    this.cleanGeneration = 1;
    this.frontier = firstLine;
    var start = Pos(firstLine, 0);
    this.sel = simpleSelection(start);
    this.history = new History(null);
    this.id = ++nextDocId;
    this.modeOption = mode;
    this.lineSep = lineSep;
    this.extend = false;

    if (typeof text == "string") text = this.splitLines(text);
    updateDoc(this, {from: start, to: start, text: text});
    setSelection(this, simpleSelection(start), sel_dontScroll);
  };

  Doc.prototype = createObj(BranchChunk.prototype, {
    constructor: Doc,
    // Iterate over the document. Supports two forms -- with only one
    // argument, it calls that for each line in the document. With
    // three, it iterates over the range given by the first two (with
    // the second being non-inclusive).
    iter: function(from, to, op) {
      if (op) this.iterN(from - this.first, to - from, op);
      else this.iterN(this.first, this.first + this.size, from);
    },

    // Non-public interface for adding and removing lines.
    insert: function(at, lines) {
      var height = 0;
      for (var i = 0; i < lines.length; ++i) height += lines[i].height;
      this.insertInner(at - this.first, lines, height);
    },
    remove: function(at, n) { this.removeInner(at - this.first, n); },

    // From here, the methods are part of the public interface. Most
    // are also available from CodeMirror (editor) instances.

    getValue: function(lineSep) {
      var lines = getLines(this, this.first, this.first + this.size);
      if (lineSep === false) return lines;
      return lines.join(lineSep || this.lineSeparator());
    },
    setValue: docMethodOp(function(code) {
      var top = Pos(this.first, 0), last = this.first + this.size - 1;
      makeChange(this, {from: top, to: Pos(last, getLine(this, last).text.length),
                        text: this.splitLines(code), origin: "setValue", full: true}, true);
      setSelection(this, simpleSelection(top));
    }),
    replaceRange: function(code, from, to, origin) {
      from = clipPos(this, from);
      to = to ? clipPos(this, to) : from;
      replaceRange(this, code, from, to, origin);
    },
    getRange: function(from, to, lineSep) {
      var lines = getBetween(this, clipPos(this, from), clipPos(this, to));
      if (lineSep === false) return lines;
      return lines.join(lineSep || this.lineSeparator());
    },

    getLine: function(line) {var l = this.getLineHandle(line); return l && l.text;},

    getLineHandle: function(line) {if (isLine(this, line)) return getLine(this, line);},
    getLineNumber: function(line) {return lineNo(line);},

    getLineHandleVisualStart: function(line) {
      if (typeof line == "number") line = getLine(this, line);
      return visualLine(line);
    },

    lineCount: function() {return this.size;},
    firstLine: function() {return this.first;},
    lastLine: function() {return this.first + this.size - 1;},

    clipPos: function(pos) {return clipPos(this, pos);},

    getCursor: function(start) {
      var range = this.sel.primary(), pos;
      if (start == null || start == "head") pos = range.head;
      else if (start == "anchor") pos = range.anchor;
      else if (start == "end" || start == "to" || start === false) pos = range.to();
      else pos = range.from();
      return pos;
    },
    listSelections: function() { return this.sel.ranges; },
    somethingSelected: function() {return this.sel.somethingSelected();},

    setCursor: docMethodOp(function(line, ch, options) {
      setSimpleSelection(this, clipPos(this, typeof line == "number" ? Pos(line, ch || 0) : line), null, options);
    }),
    setSelection: docMethodOp(function(anchor, head, options) {
      setSimpleSelection(this, clipPos(this, anchor), clipPos(this, head || anchor), options);
    }),
    extendSelection: docMethodOp(function(head, other, options) {
      extendSelection(this, clipPos(this, head), other && clipPos(this, other), options);
    }),
    extendSelections: docMethodOp(function(heads, options) {
      extendSelections(this, clipPosArray(this, heads, options));
    }),
    extendSelectionsBy: docMethodOp(function(f, options) {
      extendSelections(this, map(this.sel.ranges, f), options);
    }),
    setSelections: docMethodOp(function(ranges, primary, options) {
      if (!ranges.length) return;
      for (var i = 0, out = []; i < ranges.length; i++)
        out[i] = new Range(clipPos(this, ranges[i].anchor),
                           clipPos(this, ranges[i].head));
      if (primary == null) primary = Math.min(ranges.length - 1, this.sel.primIndex);
      setSelection(this, normalizeSelection(out, primary), options);
    }),
    addSelection: docMethodOp(function(anchor, head, options) {
      var ranges = this.sel.ranges.slice(0);
      ranges.push(new Range(clipPos(this, anchor), clipPos(this, head || anchor)));
      setSelection(this, normalizeSelection(ranges, ranges.length - 1), options);
    }),

    getSelection: function(lineSep) {
      var ranges = this.sel.ranges, lines;
      for (var i = 0; i < ranges.length; i++) {
        var sel = getBetween(this, ranges[i].from(), ranges[i].to());
        lines = lines ? lines.concat(sel) : sel;
      }
      if (lineSep === false) return lines;
      else return lines.join(lineSep || this.lineSeparator());
    },
    getSelections: function(lineSep) {
      var parts = [], ranges = this.sel.ranges;
      for (var i = 0; i < ranges.length; i++) {
        var sel = getBetween(this, ranges[i].from(), ranges[i].to());
        if (lineSep !== false) sel = sel.join(lineSep || this.lineSeparator());
        parts[i] = sel;
      }
      return parts;
    },
    replaceSelection: function(code, collapse, origin) {
      var dup = [];
      for (var i = 0; i < this.sel.ranges.length; i++)
        dup[i] = code;
      this.replaceSelections(dup, collapse, origin || "+input");
    },
    replaceSelections: docMethodOp(function(code, collapse, origin) {
      var changes = [], sel = this.sel;
      for (var i = 0; i < sel.ranges.length; i++) {
        var range = sel.ranges[i];
        changes[i] = {from: range.from(), to: range.to(), text: this.splitLines(code[i]), origin: origin};
      }
      var newSel = collapse && collapse != "end" && computeReplacedSel(this, changes, collapse);
      for (var i = changes.length - 1; i >= 0; i--)
        makeChange(this, changes[i]);
      if (newSel) setSelectionReplaceHistory(this, newSel);
      else if (this.cm) ensureCursorVisible(this.cm);
    }),
    undo: docMethodOp(function() {makeChangeFromHistory(this, "undo");}),
    redo: docMethodOp(function() {makeChangeFromHistory(this, "redo");}),
    undoSelection: docMethodOp(function() {makeChangeFromHistory(this, "undo", true);}),
    redoSelection: docMethodOp(function() {makeChangeFromHistory(this, "redo", true);}),

    setExtending: function(val) {this.extend = val;},
    getExtending: function() {return this.extend;},

    historySize: function() {
      var hist = this.history, done = 0, undone = 0;
      for (var i = 0; i < hist.done.length; i++) if (!hist.done[i].ranges) ++done;
      for (var i = 0; i < hist.undone.length; i++) if (!hist.undone[i].ranges) ++undone;
      return {undo: done, redo: undone};
    },
    clearHistory: function() {this.history = new History(this.history.maxGeneration);},

    markClean: function() {
      this.cleanGeneration = this.changeGeneration(true);
    },
    changeGeneration: function(forceSplit) {
      if (forceSplit)
        this.history.lastOp = this.history.lastSelOp = this.history.lastOrigin = null;
      return this.history.generation;
    },
    isClean: function (gen) {
      return this.history.generation == (gen || this.cleanGeneration);
    },

    getHistory: function() {
      return {done: copyHistoryArray(this.history.done),
              undone: copyHistoryArray(this.history.undone)};
    },
    setHistory: function(histData) {
      var hist = this.history = new History(this.history.maxGeneration);
      hist.done = copyHistoryArray(histData.done.slice(0), null, true);
      hist.undone = copyHistoryArray(histData.undone.slice(0), null, true);
    },

    addLineClass: docMethodOp(function(handle, where, cls) {
      return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function(line) {
        var prop = where == "text" ? "textClass"
                 : where == "background" ? "bgClass"
                 : where == "gutter" ? "gutterClass" : "wrapClass";
        if (!line[prop]) line[prop] = cls;
        else if (classTest(cls).test(line[prop])) return false;
        else line[prop] += " " + cls;
        return true;
      });
    }),
    removeLineClass: docMethodOp(function(handle, where, cls) {
      return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function(line) {
        var prop = where == "text" ? "textClass"
                 : where == "background" ? "bgClass"
                 : where == "gutter" ? "gutterClass" : "wrapClass";
        var cur = line[prop];
        if (!cur) return false;
        else if (cls == null) line[prop] = null;
        else {
          var found = cur.match(classTest(cls));
          if (!found) return false;
          var end = found.index + found[0].length;
          line[prop] = cur.slice(0, found.index) + (!found.index || end == cur.length ? "" : " ") + cur.slice(end) || null;
        }
        return true;
      });
    }),

    addLineWidget: docMethodOp(function(handle, node, options) {
      return addLineWidget(this, handle, node, options);
    }),
    removeLineWidget: function(widget) { widget.clear(); },

    markText: function(from, to, options) {
      return markText(this, clipPos(this, from), clipPos(this, to), options, options && options.type || "range");
    },
    setBookmark: function(pos, options) {
      var realOpts = {replacedWith: options && (options.nodeType == null ? options.widget : options),
                      insertLeft: options && options.insertLeft,
                      clearWhenEmpty: false, shared: options && options.shared,
                      handleMouseEvents: options && options.handleMouseEvents};
      pos = clipPos(this, pos);
      return markText(this, pos, pos, realOpts, "bookmark");
    },
    findMarksAt: function(pos) {
      pos = clipPos(this, pos);
      var markers = [], spans = getLine(this, pos.line).markedSpans;
      if (spans) for (var i = 0; i < spans.length; ++i) {
        var span = spans[i];
        if ((span.from == null || span.from <= pos.ch) &&
            (span.to == null || span.to >= pos.ch))
          markers.push(span.marker.parent || span.marker);
      }
      return markers;
    },
    findMarks: function(from, to, filter) {
      from = clipPos(this, from); to = clipPos(this, to);
      var found = [], lineNo = from.line;
      this.iter(from.line, to.line + 1, function(line) {
        var spans = line.markedSpans;
        if (spans) for (var i = 0; i < spans.length; i++) {
          var span = spans[i];
          if (!(lineNo == from.line && from.ch > span.to ||
                span.from == null && lineNo != from.line||
                lineNo == to.line && span.from > to.ch) &&
              (!filter || filter(span.marker)))
            found.push(span.marker.parent || span.marker);
        }
        ++lineNo;
      });
      return found;
    },
    getAllMarks: function() {
      var markers = [];
      this.iter(function(line) {
        var sps = line.markedSpans;
        if (sps) for (var i = 0; i < sps.length; ++i)
          if (sps[i].from != null) markers.push(sps[i].marker);
      });
      return markers;
    },

    posFromIndex: function(off) {
      var ch, lineNo = this.first;
      this.iter(function(line) {
        var sz = line.text.length + 1;
        if (sz > off) { ch = off; return true; }
        off -= sz;
        ++lineNo;
      });
      return clipPos(this, Pos(lineNo, ch));
    },
    indexFromPos: function (coords) {
      coords = clipPos(this, coords);
      var index = coords.ch;
      if (coords.line < this.first || coords.ch < 0) return 0;
      this.iter(this.first, coords.line, function (line) {
        index += line.text.length + 1;
      });
      return index;
    },

    copy: function(copyHistory) {
      var doc = new Doc(getLines(this, this.first, this.first + this.size),
                        this.modeOption, this.first, this.lineSep);
      doc.scrollTop = this.scrollTop; doc.scrollLeft = this.scrollLeft;
      doc.sel = this.sel;
      doc.extend = false;
      if (copyHistory) {
        doc.history.undoDepth = this.history.undoDepth;
        doc.setHistory(this.getHistory());
      }
      return doc;
    },

    linkedDoc: function(options) {
      if (!options) options = {};
      var from = this.first, to = this.first + this.size;
      if (options.from != null && options.from > from) from = options.from;
      if (options.to != null && options.to < to) to = options.to;
      var copy = new Doc(getLines(this, from, to), options.mode || this.modeOption, from, this.lineSep);
      if (options.sharedHist) copy.history = this.history;
      (this.linked || (this.linked = [])).push({doc: copy, sharedHist: options.sharedHist});
      copy.linked = [{doc: this, isParent: true, sharedHist: options.sharedHist}];
      copySharedMarkers(copy, findSharedMarkers(this));
      return copy;
    },
    unlinkDoc: function(other) {
      if (other instanceof CodeMirror) other = other.doc;
      if (this.linked) for (var i = 0; i < this.linked.length; ++i) {
        var link = this.linked[i];
        if (link.doc != other) continue;
        this.linked.splice(i, 1);
        other.unlinkDoc(this);
        detachSharedMarkers(findSharedMarkers(this));
        break;
      }
      // If the histories were shared, split them again
      if (other.history == this.history) {
        var splitIds = [other.id];
        linkedDocs(other, function(doc) {splitIds.push(doc.id);}, true);
        other.history = new History(null);
        other.history.done = copyHistoryArray(this.history.done, splitIds);
        other.history.undone = copyHistoryArray(this.history.undone, splitIds);
      }
    },
    iterLinkedDocs: function(f) {linkedDocs(this, f);},

    getMode: function() {return this.mode;},
    getEditor: function() {return this.cm;},

    splitLines: function(str) {
      if (this.lineSep) return str.split(this.lineSep);
      return splitLinesAuto(str);
    },
    lineSeparator: function() { return this.lineSep || "\n"; }
  });

  // Public alias.
  Doc.prototype.eachLine = Doc.prototype.iter;

  // Set up methods on CodeMirror's prototype to redirect to the editor's document.
  var dontDelegate = "iter insert remove copy getEditor constructor".split(" ");
  for (var prop in Doc.prototype) if (Doc.prototype.hasOwnProperty(prop) && indexOf(dontDelegate, prop) < 0)
    CodeMirror.prototype[prop] = (function(method) {
      return function() {return method.apply(this.doc, arguments);};
    })(Doc.prototype[prop]);

  eventMixin(Doc);

  // Call f for all linked documents.
  function linkedDocs(doc, f, sharedHistOnly) {
    function propagate(doc, skip, sharedHist) {
      if (doc.linked) for (var i = 0; i < doc.linked.length; ++i) {
        var rel = doc.linked[i];
        if (rel.doc == skip) continue;
        var shared = sharedHist && rel.sharedHist;
        if (sharedHistOnly && !shared) continue;
        f(rel.doc, shared);
        propagate(rel.doc, doc, shared);
      }
    }
    propagate(doc, null, true);
  }

  // Attach a document to an editor.
  function attachDoc(cm, doc) {
    if (doc.cm) throw new Error("This document is already in use.");
    cm.doc = doc;
    doc.cm = cm;
    estimateLineHeights(cm);
    loadMode(cm);
    if (!cm.options.lineWrapping) findMaxLine(cm);
    cm.options.mode = doc.modeOption;
    regChange(cm);
  }

  // LINE UTILITIES

  // Find the line object corresponding to the given line number.
  function getLine(doc, n) {
    n -= doc.first;
    if (n < 0 || n >= doc.size) throw new Error("There is no line " + (n + doc.first) + " in the document.");
    for (var chunk = doc; !chunk.lines;) {
      for (var i = 0;; ++i) {
        var child = chunk.children[i], sz = child.chunkSize();
        if (n < sz) { chunk = child; break; }
        n -= sz;
      }
    }
    return chunk.lines[n];
  }

  // Get the part of a document between two positions, as an array of
  // strings.
  function getBetween(doc, start, end) {
    var out = [], n = start.line;
    doc.iter(start.line, end.line + 1, function(line) {
      var text = line.text;
      if (n == end.line) text = text.slice(0, end.ch);
      if (n == start.line) text = text.slice(start.ch);
      out.push(text);
      ++n;
    });
    return out;
  }
  // Get the lines between from and to, as array of strings.
  function getLines(doc, from, to) {
    var out = [];
    doc.iter(from, to, function(line) { out.push(line.text); });
    return out;
  }

  // Update the height of a line, propagating the height change
  // upwards to parent nodes.
  function updateLineHeight(line, height) {
    var diff = height - line.height;
    if (diff) for (var n = line; n; n = n.parent) n.height += diff;
  }

  // Given a line object, find its line number by walking up through
  // its parent links.
  function lineNo(line) {
    if (line.parent == null) return null;
    var cur = line.parent, no = indexOf(cur.lines, line);
    for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
      for (var i = 0;; ++i) {
        if (chunk.children[i] == cur) break;
        no += chunk.children[i].chunkSize();
      }
    }
    return no + cur.first;
  }

  // Find the line at the given vertical position, using the height
  // information in the document tree.
  function lineAtHeight(chunk, h) {
    var n = chunk.first;
    outer: do {
      for (var i = 0; i < chunk.children.length; ++i) {
        var child = chunk.children[i], ch = child.height;
        if (h < ch) { chunk = child; continue outer; }
        h -= ch;
        n += child.chunkSize();
      }
      return n;
    } while (!chunk.lines);
    for (var i = 0; i < chunk.lines.length; ++i) {
      var line = chunk.lines[i], lh = line.height;
      if (h < lh) break;
      h -= lh;
    }
    return n + i;
  }


  // Find the height above the given line.
  function heightAtLine(lineObj) {
    lineObj = visualLine(lineObj);

    var h = 0, chunk = lineObj.parent;
    for (var i = 0; i < chunk.lines.length; ++i) {
      var line = chunk.lines[i];
      if (line == lineObj) break;
      else h += line.height;
    }
    for (var p = chunk.parent; p; chunk = p, p = chunk.parent) {
      for (var i = 0; i < p.children.length; ++i) {
        var cur = p.children[i];
        if (cur == chunk) break;
        else h += cur.height;
      }
    }
    return h;
  }

  // Get the bidi ordering for the given line (and cache it). Returns
  // false for lines that are fully left-to-right, and an array of
  // BidiSpan objects otherwise.
  function getOrder(line) {
    var order = line.order;
    if (order == null) order = line.order = bidiOrdering(line.text);
    return order;
  }

  // HISTORY

  function History(startGen) {
    // Arrays of change events and selections. Doing something adds an
    // event to done and clears undo. Undoing moves events from done
    // to undone, redoing moves them in the other direction.
    this.done = []; this.undone = [];
    this.undoDepth = Infinity;
    // Used to track when changes can be merged into a single undo
    // event
    this.lastModTime = this.lastSelTime = 0;
    this.lastOp = this.lastSelOp = null;
    this.lastOrigin = this.lastSelOrigin = null;
    // Used by the isClean() method
    this.generation = this.maxGeneration = startGen || 1;
  }

  // Create a history change event from an updateDoc-style change
  // object.
  function historyChangeFromChange(doc, change) {
    var histChange = {from: copyPos(change.from), to: changeEnd(change), text: getBetween(doc, change.from, change.to)};
    attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);
    linkedDocs(doc, function(doc) {attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);}, true);
    return histChange;
  }

  // Pop all selection events off the end of a history array. Stop at
  // a change event.
  function clearSelectionEvents(array) {
    while (array.length) {
      var last = lst(array);
      if (last.ranges) array.pop();
      else break;
    }
  }

  // Find the top change event in the history. Pop off selection
  // events that are in the way.
  function lastChangeEvent(hist, force) {
    if (force) {
      clearSelectionEvents(hist.done);
      return lst(hist.done);
    } else if (hist.done.length && !lst(hist.done).ranges) {
      return lst(hist.done);
    } else if (hist.done.length > 1 && !hist.done[hist.done.length - 2].ranges) {
      hist.done.pop();
      return lst(hist.done);
    }
  }

  // Register a change in the history. Merges changes that are within
  // a single operation, ore are close together with an origin that
  // allows merging (starting with "+") into a single event.
  function addChangeToHistory(doc, change, selAfter, opId) {
    var hist = doc.history;
    hist.undone.length = 0;
    var time = +new Date, cur;

    if ((hist.lastOp == opId ||
         hist.lastOrigin == change.origin && change.origin &&
         ((change.origin.charAt(0) == "+" && doc.cm && hist.lastModTime > time - doc.cm.options.historyEventDelay) ||
          change.origin.charAt(0) == "*")) &&
        (cur = lastChangeEvent(hist, hist.lastOp == opId))) {
      // Merge this change into the last event
      var last = lst(cur.changes);
      if (cmp(change.from, change.to) == 0 && cmp(change.from, last.to) == 0) {
        // Optimized case for simple insertion -- don't want to add
        // new changesets for every character typed
        last.to = changeEnd(change);
      } else {
        // Add new sub-event
        cur.changes.push(historyChangeFromChange(doc, change));
      }
    } else {
      // Can not be merged, start a new event.
      var before = lst(hist.done);
      if (!before || !before.ranges)
        pushSelectionToHistory(doc.sel, hist.done);
      cur = {changes: [historyChangeFromChange(doc, change)],
             generation: hist.generation};
      hist.done.push(cur);
      while (hist.done.length > hist.undoDepth) {
        hist.done.shift();
        if (!hist.done[0].ranges) hist.done.shift();
      }
    }
    hist.done.push(selAfter);
    hist.generation = ++hist.maxGeneration;
    hist.lastModTime = hist.lastSelTime = time;
    hist.lastOp = hist.lastSelOp = opId;
    hist.lastOrigin = hist.lastSelOrigin = change.origin;

    if (!last) signal(doc, "historyAdded");
  }

  function selectionEventCanBeMerged(doc, origin, prev, sel) {
    var ch = origin.charAt(0);
    return ch == "*" ||
      ch == "+" &&
      prev.ranges.length == sel.ranges.length &&
      prev.somethingSelected() == sel.somethingSelected() &&
      new Date - doc.history.lastSelTime <= (doc.cm ? doc.cm.options.historyEventDelay : 500);
  }

  // Called whenever the selection changes, sets the new selection as
  // the pending selection in the history, and pushes the old pending
  // selection into the 'done' array when it was significantly
  // different (in number of selected ranges, emptiness, or time).
  function addSelectionToHistory(doc, sel, opId, options) {
    var hist = doc.history, origin = options && options.origin;

    // A new event is started when the previous origin does not match
    // the current, or the origins don't allow matching. Origins
    // starting with * are always merged, those starting with + are
    // merged when similar and close together in time.
    if (opId == hist.lastSelOp ||
        (origin && hist.lastSelOrigin == origin &&
         (hist.lastModTime == hist.lastSelTime && hist.lastOrigin == origin ||
          selectionEventCanBeMerged(doc, origin, lst(hist.done), sel))))
      hist.done[hist.done.length - 1] = sel;
    else
      pushSelectionToHistory(sel, hist.done);

    hist.lastSelTime = +new Date;
    hist.lastSelOrigin = origin;
    hist.lastSelOp = opId;
    if (options && options.clearRedo !== false)
      clearSelectionEvents(hist.undone);
  }

  function pushSelectionToHistory(sel, dest) {
    var top = lst(dest);
    if (!(top && top.ranges && top.equals(sel)))
      dest.push(sel);
  }

  // Used to store marked span information in the history.
  function attachLocalSpans(doc, change, from, to) {
    var existing = change["spans_" + doc.id], n = 0;
    doc.iter(Math.max(doc.first, from), Math.min(doc.first + doc.size, to), function(line) {
      if (line.markedSpans)
        (existing || (existing = change["spans_" + doc.id] = {}))[n] = line.markedSpans;
      ++n;
    });
  }

  // When un/re-doing restores text containing marked spans, those
  // that have been explicitly cleared should not be restored.
  function removeClearedSpans(spans) {
    if (!spans) return null;
    for (var i = 0, out; i < spans.length; ++i) {
      if (spans[i].marker.explicitlyCleared) { if (!out) out = spans.slice(0, i); }
      else if (out) out.push(spans[i]);
    }
    return !out ? spans : out.length ? out : null;
  }

  // Retrieve and filter the old marked spans stored in a change event.
  function getOldSpans(doc, change) {
    var found = change["spans_" + doc.id];
    if (!found) return null;
    for (var i = 0, nw = []; i < change.text.length; ++i)
      nw.push(removeClearedSpans(found[i]));
    return nw;
  }

  // Used both to provide a JSON-safe object in .getHistory, and, when
  // detaching a document, to split the history in two
  function copyHistoryArray(events, newGroup, instantiateSel) {
    for (var i = 0, copy = []; i < events.length; ++i) {
      var event = events[i];
      if (event.ranges) {
        copy.push(instantiateSel ? Selection.prototype.deepCopy.call(event) : event);
        continue;
      }
      var changes = event.changes, newChanges = [];
      copy.push({changes: newChanges});
      for (var j = 0; j < changes.length; ++j) {
        var change = changes[j], m;
        newChanges.push({from: change.from, to: change.to, text: change.text});
        if (newGroup) for (var prop in change) if (m = prop.match(/^spans_(\d+)$/)) {
          if (indexOf(newGroup, Number(m[1])) > -1) {
            lst(newChanges)[prop] = change[prop];
            delete change[prop];
          }
        }
      }
    }
    return copy;
  }

  // Rebasing/resetting history to deal with externally-sourced changes

  function rebaseHistSelSingle(pos, from, to, diff) {
    if (to < pos.line) {
      pos.line += diff;
    } else if (from < pos.line) {
      pos.line = from;
      pos.ch = 0;
    }
  }

  // Tries to rebase an array of history events given a change in the
  // document. If the change touches the same lines as the event, the
  // event, and everything 'behind' it, is discarded. If the change is
  // before the event, the event's positions are updated. Uses a
  // copy-on-write scheme for the positions, to avoid having to
  // reallocate them all on every rebase, but also avoid problems with
  // shared position objects being unsafely updated.
  function rebaseHistArray(array, from, to, diff) {
    for (var i = 0; i < array.length; ++i) {
      var sub = array[i], ok = true;
      if (sub.ranges) {
        if (!sub.copied) { sub = array[i] = sub.deepCopy(); sub.copied = true; }
        for (var j = 0; j < sub.ranges.length; j++) {
          rebaseHistSelSingle(sub.ranges[j].anchor, from, to, diff);
          rebaseHistSelSingle(sub.ranges[j].head, from, to, diff);
        }
        continue;
      }
      for (var j = 0; j < sub.changes.length; ++j) {
        var cur = sub.changes[j];
        if (to < cur.from.line) {
          cur.from = Pos(cur.from.line + diff, cur.from.ch);
          cur.to = Pos(cur.to.line + diff, cur.to.ch);
        } else if (from <= cur.to.line) {
          ok = false;
          break;
        }
      }
      if (!ok) {
        array.splice(0, i + 1);
        i = 0;
      }
    }
  }

  function rebaseHist(hist, change) {
    var from = change.from.line, to = change.to.line, diff = change.text.length - (to - from) - 1;
    rebaseHistArray(hist.done, from, to, diff);
    rebaseHistArray(hist.undone, from, to, diff);
  }

  // EVENT UTILITIES

  // Due to the fact that we still support jurassic IE versions, some
  // compatibility wrappers are needed.

  var e_preventDefault = CodeMirror.e_preventDefault = function(e) {
    if (e.preventDefault) e.preventDefault();
    else e.returnValue = false;
  };
  var e_stopPropagation = CodeMirror.e_stopPropagation = function(e) {
    if (e.stopPropagation) e.stopPropagation();
    else e.cancelBubble = true;
  };
  function e_defaultPrevented(e) {
    return e.defaultPrevented != null ? e.defaultPrevented : e.returnValue == false;
  }
  var e_stop = CodeMirror.e_stop = function(e) {e_preventDefault(e); e_stopPropagation(e);};

  function e_target(e) {return e.target || e.srcElement;}
  function e_button(e) {
    var b = e.which;
    if (b == null) {
      if (e.button & 1) b = 1;
      else if (e.button & 2) b = 3;
      else if (e.button & 4) b = 2;
    }
    if (mac && e.ctrlKey && b == 1) b = 3;
    return b;
  }

  // EVENT HANDLING

  // Lightweight event framework. on/off also work on DOM nodes,
  // registering native DOM handlers.

  var on = CodeMirror.on = function(emitter, type, f) {
    if (emitter.addEventListener)
      emitter.addEventListener(type, f, false);
    else if (emitter.attachEvent)
      emitter.attachEvent("on" + type, f);
    else {
      var map = emitter._handlers || (emitter._handlers = {});
      var arr = map[type] || (map[type] = []);
      arr.push(f);
    }
  };

  var noHandlers = []
  function getHandlers(emitter, type, copy) {
    var arr = emitter._handlers && emitter._handlers[type]
    if (copy) return arr && arr.length > 0 ? arr.slice() : noHandlers
    else return arr || noHandlers
  }

  var off = CodeMirror.off = function(emitter, type, f) {
    if (emitter.removeEventListener)
      emitter.removeEventListener(type, f, false);
    else if (emitter.detachEvent)
      emitter.detachEvent("on" + type, f);
    else {
      var handlers = getHandlers(emitter, type, false)
      for (var i = 0; i < handlers.length; ++i)
        if (handlers[i] == f) { handlers.splice(i, 1); break; }
    }
  };

  var signal = CodeMirror.signal = function(emitter, type /*, values...*/) {
    var handlers = getHandlers(emitter, type, true)
    if (!handlers.length) return;
    var args = Array.prototype.slice.call(arguments, 2);
    for (var i = 0; i < handlers.length; ++i) handlers[i].apply(null, args);
  };

  var orphanDelayedCallbacks = null;

  // Often, we want to signal events at a point where we are in the
  // middle of some work, but don't want the handler to start calling
  // other methods on the editor, which might be in an inconsistent
  // state or simply not expect any other events to happen.
  // signalLater looks whether there are any handlers, and schedules
  // them to be executed when the last operation ends, or, if no
  // operation is active, when a timeout fires.
  function signalLater(emitter, type /*, values...*/) {
    var arr = getHandlers(emitter, type, false)
    if (!arr.length) return;
    var args = Array.prototype.slice.call(arguments, 2), list;
    if (operationGroup) {
      list = operationGroup.delayedCallbacks;
    } else if (orphanDelayedCallbacks) {
      list = orphanDelayedCallbacks;
    } else {
      list = orphanDelayedCallbacks = [];
      setTimeout(fireOrphanDelayed, 0);
    }
    function bnd(f) {return function(){f.apply(null, args);};};
    for (var i = 0; i < arr.length; ++i)
      list.push(bnd(arr[i]));
  }

  function fireOrphanDelayed() {
    var delayed = orphanDelayedCallbacks;
    orphanDelayedCallbacks = null;
    for (var i = 0; i < delayed.length; ++i) delayed[i]();
  }

  // The DOM events that CodeMirror handles can be overridden by
  // registering a (non-DOM) handler on the editor for the event name,
  // and preventDefault-ing the event in that handler.
  function signalDOMEvent(cm, e, override) {
    if (typeof e == "string")
      e = {type: e, preventDefault: function() { this.defaultPrevented = true; }};
    signal(cm, override || e.type, cm, e);
    return e_defaultPrevented(e) || e.codemirrorIgnore;
  }

  function signalCursorActivity(cm) {
    var arr = cm._handlers && cm._handlers.cursorActivity;
    if (!arr) return;
    var set = cm.curOp.cursorActivityHandlers || (cm.curOp.cursorActivityHandlers = []);
    for (var i = 0; i < arr.length; ++i) if (indexOf(set, arr[i]) == -1)
      set.push(arr[i]);
  }

  function hasHandler(emitter, type) {
    return getHandlers(emitter, type).length > 0
  }

  // Add on and off methods to a constructor's prototype, to make
  // registering events on such objects more convenient.
  function eventMixin(ctor) {
    ctor.prototype.on = function(type, f) {on(this, type, f);};
    ctor.prototype.off = function(type, f) {off(this, type, f);};
  }

  // MISC UTILITIES

  // Number of pixels added to scroller and sizer to hide scrollbar
  var scrollerGap = 30;

  // Returned or thrown by various protocols to signal 'I'm not
  // handling this'.
  var Pass = CodeMirror.Pass = {toString: function(){return "CodeMirror.Pass";}};

  // Reused option objects for setSelection & friends
  var sel_dontScroll = {scroll: false}, sel_mouse = {origin: "*mouse"}, sel_move = {origin: "+move"};

  function Delayed() {this.id = null;}
  Delayed.prototype.set = function(ms, f) {
    clearTimeout(this.id);
    this.id = setTimeout(f, ms);
  };

  // Counts the column offset in a string, taking tabs into account.
  // Used mostly to find indentation.
  var countColumn = CodeMirror.countColumn = function(string, end, tabSize, startIndex, startValue) {
    if (end == null) {
      end = string.search(/[^\s\u00a0]/);
      if (end == -1) end = string.length;
    }
    for (var i = startIndex || 0, n = startValue || 0;;) {
      var nextTab = string.indexOf("\t", i);
      if (nextTab < 0 || nextTab >= end)
        return n + (end - i);
      n += nextTab - i;
      n += tabSize - (n % tabSize);
      i = nextTab + 1;
    }
  };

  // The inverse of countColumn -- find the offset that corresponds to
  // a particular column.
  var findColumn = CodeMirror.findColumn = function(string, goal, tabSize) {
    for (var pos = 0, col = 0;;) {
      var nextTab = string.indexOf("\t", pos);
      if (nextTab == -1) nextTab = string.length;
      var skipped = nextTab - pos;
      if (nextTab == string.length || col + skipped >= goal)
        return pos + Math.min(skipped, goal - col);
      col += nextTab - pos;
      col += tabSize - (col % tabSize);
      pos = nextTab + 1;
      if (col >= goal) return pos;
    }
  }

  var spaceStrs = [""];
  function spaceStr(n) {
    while (spaceStrs.length <= n)
      spaceStrs.push(lst(spaceStrs) + " ");
    return spaceStrs[n];
  }

  function lst(arr) { return arr[arr.length-1]; }

  var selectInput = function(node) { node.select(); };
  if (ios) // Mobile Safari apparently has a bug where select() is broken.
    selectInput = function(node) { node.selectionStart = 0; node.selectionEnd = node.value.length; };
  else if (ie) // Suppress mysterious IE10 errors
    selectInput = function(node) { try { node.select(); } catch(_e) {} };

  function indexOf(array, elt) {
    for (var i = 0; i < array.length; ++i)
      if (array[i] == elt) return i;
    return -1;
  }
  function map(array, f) {
    var out = [];
    for (var i = 0; i < array.length; i++) out[i] = f(array[i], i);
    return out;
  }

  function nothing() {}

  function createObj(base, props) {
    var inst;
    if (Object.create) {
      inst = Object.create(base);
    } else {
      nothing.prototype = base;
      inst = new nothing();
    }
    if (props) copyObj(props, inst);
    return inst;
  };

  function copyObj(obj, target, overwrite) {
    if (!target) target = {};
    for (var prop in obj)
      if (obj.hasOwnProperty(prop) && (overwrite !== false || !target.hasOwnProperty(prop)))
        target[prop] = obj[prop];
    return target;
  }

  function bind(f) {
    var args = Array.prototype.slice.call(arguments, 1);
    return function(){return f.apply(null, args);};
  }

  var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/;
  var isWordCharBasic = CodeMirror.isWordChar = function(ch) {
    return /\w/.test(ch) || ch > "\x80" &&
      (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch));
  };
  function isWordChar(ch, helper) {
    if (!helper) return isWordCharBasic(ch);
    if (helper.source.indexOf("\\w") > -1 && isWordCharBasic(ch)) return true;
    return helper.test(ch);
  }

  function isEmpty(obj) {
    for (var n in obj) if (obj.hasOwnProperty(n) && obj[n]) return false;
    return true;
  }

  // Extending unicode characters. A series of a non-extending char +
  // any number of extending chars is treated as a single unit as far
  // as editing and measuring is concerned. This is not fully correct,
  // since some scripts/fonts/browsers also treat other configurations
  // of code points as a group.
  var extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/;
  function isExtendingChar(ch) { return ch.charCodeAt(0) >= 768 && extendingChars.test(ch); }

  // DOM UTILITIES

  function elt(tag, content, className, style) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (style) e.style.cssText = style;
    if (typeof content == "string") e.appendChild(document.createTextNode(content));
    else if (content) for (var i = 0; i < content.length; ++i) e.appendChild(content[i]);
    return e;
  }

  var range;
  if (document.createRange) range = function(node, start, end, endNode) {
    var r = document.createRange();
    r.setEnd(endNode || node, end);
    r.setStart(node, start);
    return r;
  };
  else range = function(node, start, end) {
    var r = document.body.createTextRange();
    try { r.moveToElementText(node.parentNode); }
    catch(e) { return r; }
    r.collapse(true);
    r.moveEnd("character", end);
    r.moveStart("character", start);
    return r;
  };

  function removeChildren(e) {
    for (var count = e.childNodes.length; count > 0; --count)
      e.removeChild(e.firstChild);
    return e;
  }

  function removeChildrenAndAdd(parent, e) {
    return removeChildren(parent).appendChild(e);
  }

  var contains = CodeMirror.contains = function(parent, child) {
    if (child.nodeType == 3) // Android browser always returns false when child is a textnode
      child = child.parentNode;
    if (parent.contains)
      return parent.contains(child);
    do {
      if (child.nodeType == 11) child = child.host;
      if (child == parent) return true;
    } while (child = child.parentNode);
  };

  function activeElt() {
    var activeElement = document.activeElement;
    while (activeElement && activeElement.root && activeElement.root.activeElement)
      activeElement = activeElement.root.activeElement;
    return activeElement;
  }
  // Older versions of IE throws unspecified error when touching
  // document.activeElement in some cases (during loading, in iframe)
  if (ie && ie_version < 11) activeElt = function() {
    try { return document.activeElement; }
    catch(e) { return document.body; }
  };

  function classTest(cls) { return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*"); }
  var rmClass = CodeMirror.rmClass = function(node, cls) {
    var current = node.className;
    var match = classTest(cls).exec(current);
    if (match) {
      var after = current.slice(match.index + match[0].length);
      node.className = current.slice(0, match.index) + (after ? match[1] + after : "");
    }
  };
  var addClass = CodeMirror.addClass = function(node, cls) {
    var current = node.className;
    if (!classTest(cls).test(current)) node.className += (current ? " " : "") + cls;
  };
  function joinClasses(a, b) {
    var as = a.split(" ");
    for (var i = 0; i < as.length; i++)
      if (as[i] && !classTest(as[i]).test(b)) b += " " + as[i];
    return b;
  }

  // WINDOW-WIDE EVENTS

  // These must be handled carefully, because naively registering a
  // handler for each editor will cause the editors to never be
  // garbage collected.

  function forEachCodeMirror(f) {
    if (!document.body.getElementsByClassName) return;
    var byClass = document.body.getElementsByClassName("CodeMirror");
    for (var i = 0; i < byClass.length; i++) {
      var cm = byClass[i].CodeMirror;
      if (cm) f(cm);
    }
  }

  var globalsRegistered = false;
  function ensureGlobalHandlers() {
    if (globalsRegistered) return;
    registerGlobalHandlers();
    globalsRegistered = true;
  }
  function registerGlobalHandlers() {
    // When the window resizes, we need to refresh active editors.
    var resizeTimer;
    on(window, "resize", function() {
      if (resizeTimer == null) resizeTimer = setTimeout(function() {
        resizeTimer = null;
        forEachCodeMirror(onResize);
      }, 100);
    });
    // When the window loses focus, we want to show the editor as blurred
    on(window, "blur", function() {
      forEachCodeMirror(onBlur);
    });
  }

  // FEATURE DETECTION

  // Detect drag-and-drop
  var dragAndDrop = function() {
    // There is *some* kind of drag-and-drop support in IE6-8, but I
    // couldn't get it to work yet.
    if (ie && ie_version < 9) return false;
    var div = elt('div');
    return "draggable" in div || "dragDrop" in div;
  }();

  var zwspSupported;
  function zeroWidthElement(measure) {
    if (zwspSupported == null) {
      var test = elt("span", "\u200b");
      removeChildrenAndAdd(measure, elt("span", [test, document.createTextNode("x")]));
      if (measure.firstChild.offsetHeight != 0)
        zwspSupported = test.offsetWidth <= 1 && test.offsetHeight > 2 && !(ie && ie_version < 8);
    }
    var node = zwspSupported ? elt("span", "\u200b") :
      elt("span", "\u00a0", null, "display: inline-block; width: 1px; margin-right: -1px");
    node.setAttribute("cm-text", "");
    return node;
  }

  // Feature-detect IE's crummy client rect reporting for bidi text
  var badBidiRects;
  function hasBadBidiRects(measure) {
    if (badBidiRects != null) return badBidiRects;
    var txt = removeChildrenAndAdd(measure, document.createTextNode("A\u062eA"));
    var r0 = range(txt, 0, 1).getBoundingClientRect();
    if (!r0 || r0.left == r0.right) return false; // Safari returns null in some cases (#2780)
    var r1 = range(txt, 1, 2).getBoundingClientRect();
    return badBidiRects = (r1.right - r0.right < 3);
  }

  // See if "".split is the broken IE version, if so, provide an
  // alternative way to split lines.
  var splitLinesAuto = CodeMirror.splitLines = "\n\nb".split(/\n/).length != 3 ? function(string) {
    var pos = 0, result = [], l = string.length;
    while (pos <= l) {
      var nl = string.indexOf("\n", pos);
      if (nl == -1) nl = string.length;
      var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl);
      var rt = line.indexOf("\r");
      if (rt != -1) {
        result.push(line.slice(0, rt));
        pos += rt + 1;
      } else {
        result.push(line);
        pos = nl + 1;
      }
    }
    return result;
  } : function(string){return string.split(/\r\n?|\n/);};

  var hasSelection = window.getSelection ? function(te) {
    try { return te.selectionStart != te.selectionEnd; }
    catch(e) { return false; }
  } : function(te) {
    try {var range = te.ownerDocument.selection.createRange();}
    catch(e) {}
    if (!range || range.parentElement() != te) return false;
    return range.compareEndPoints("StartToEnd", range) != 0;
  };

  var hasCopyEvent = (function() {
    var e = elt("div");
    if ("oncopy" in e) return true;
    e.setAttribute("oncopy", "return;");
    return typeof e.oncopy == "function";
  })();

  var badZoomedRects = null;
  function hasBadZoomedRects(measure) {
    if (badZoomedRects != null) return badZoomedRects;
    var node = removeChildrenAndAdd(measure, elt("span", "x"));
    var normal = node.getBoundingClientRect();
    var fromRange = range(node, 0, 1).getBoundingClientRect();
    return badZoomedRects = Math.abs(normal.left - fromRange.left) > 1;
  }

  // KEY NAMES

  var keyNames = CodeMirror.keyNames = {
    3: "Enter", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
    19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
    36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
    46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod",
    106: "*", 107: "=", 109: "-", 110: ".", 111: "/", 127: "Delete",
    173: "-", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
    221: "]", 222: "'", 63232: "Up", 63233: "Down", 63234: "Left", 63235: "Right", 63272: "Delete",
    63273: "Home", 63275: "End", 63276: "PageUp", 63277: "PageDown", 63302: "Insert"
  };
  (function() {
    // Number keys
    for (var i = 0; i < 10; i++) keyNames[i + 48] = keyNames[i + 96] = String(i);
    // Alphabetic keys
    for (var i = 65; i <= 90; i++) keyNames[i] = String.fromCharCode(i);
    // Function keys
    for (var i = 1; i <= 12; i++) keyNames[i + 111] = keyNames[i + 63235] = "F" + i;
  })();

  // BIDI HELPERS

  function iterateBidiSections(order, from, to, f) {
    if (!order) return f(from, to, "ltr");
    var found = false;
    for (var i = 0; i < order.length; ++i) {
      var part = order[i];
      if (part.from < to && part.to > from || from == to && part.to == from) {
        f(Math.max(part.from, from), Math.min(part.to, to), part.level == 1 ? "rtl" : "ltr");
        found = true;
      }
    }
    if (!found) f(from, to, "ltr");
  }

  function bidiLeft(part) { return part.level % 2 ? part.to : part.from; }
  function bidiRight(part) { return part.level % 2 ? part.from : part.to; }

  function lineLeft(line) { var order = getOrder(line); return order ? bidiLeft(order[0]) : 0; }
  function lineRight(line) {
    var order = getOrder(line);
    if (!order) return line.text.length;
    return bidiRight(lst(order));
  }

  function lineStart(cm, lineN) {
    var line = getLine(cm.doc, lineN);
    var visual = visualLine(line);
    if (visual != line) lineN = lineNo(visual);
    var order = getOrder(visual);
    var ch = !order ? 0 : order[0].level % 2 ? lineRight(visual) : lineLeft(visual);
    return Pos(lineN, ch);
  }
  function lineEnd(cm, lineN) {
    var merged, line = getLine(cm.doc, lineN);
    while (merged = collapsedSpanAtEnd(line)) {
      line = merged.find(1, true).line;
      lineN = null;
    }
    var order = getOrder(line);
    var ch = !order ? line.text.length : order[0].level % 2 ? lineLeft(line) : lineRight(line);
    return Pos(lineN == null ? lineNo(line) : lineN, ch);
  }
  function lineStartSmart(cm, pos) {
    var start = lineStart(cm, pos.line);
    var line = getLine(cm.doc, start.line);
    var order = getOrder(line);
    if (!order || order[0].level == 0) {
      var firstNonWS = Math.max(0, line.text.search(/\S/));
      var inWS = pos.line == start.line && pos.ch <= firstNonWS && pos.ch;
      return Pos(start.line, inWS ? 0 : firstNonWS);
    }
    return start;
  }

  function compareBidiLevel(order, a, b) {
    var linedir = order[0].level;
    if (a == linedir) return true;
    if (b == linedir) return false;
    return a < b;
  }
  var bidiOther;
  function getBidiPartAt(order, pos) {
    bidiOther = null;
    for (var i = 0, found; i < order.length; ++i) {
      var cur = order[i];
      if (cur.from < pos && cur.to > pos) return i;
      if ((cur.from == pos || cur.to == pos)) {
        if (found == null) {
          found = i;
        } else if (compareBidiLevel(order, cur.level, order[found].level)) {
          if (cur.from != cur.to) bidiOther = found;
          return i;
        } else {
          if (cur.from != cur.to) bidiOther = i;
          return found;
        }
      }
    }
    return found;
  }

  function moveInLine(line, pos, dir, byUnit) {
    if (!byUnit) return pos + dir;
    do pos += dir;
    while (pos > 0 && isExtendingChar(line.text.charAt(pos)));
    return pos;
  }

  // This is needed in order to move 'visually' through bi-directional
  // text -- i.e., pressing left should make the cursor go left, even
  // when in RTL text. The tricky part is the 'jumps', where RTL and
  // LTR text touch each other. This often requires the cursor offset
  // to move more than one unit, in order to visually move one unit.
  function moveVisually(line, start, dir, byUnit) {
    var bidi = getOrder(line);
    if (!bidi) return moveLogically(line, start, dir, byUnit);
    var pos = getBidiPartAt(bidi, start), part = bidi[pos];
    var target = moveInLine(line, start, part.level % 2 ? -dir : dir, byUnit);

    for (;;) {
      if (target > part.from && target < part.to) return target;
      if (target == part.from || target == part.to) {
        if (getBidiPartAt(bidi, target) == pos) return target;
        part = bidi[pos += dir];
        return (dir > 0) == part.level % 2 ? part.to : part.from;
      } else {
        part = bidi[pos += dir];
        if (!part) return null;
        if ((dir > 0) == part.level % 2)
          target = moveInLine(line, part.to, -1, byUnit);
        else
          target = moveInLine(line, part.from, 1, byUnit);
      }
    }
  }

  function moveLogically(line, start, dir, byUnit) {
    var target = start + dir;
    if (byUnit) while (target > 0 && isExtendingChar(line.text.charAt(target))) target += dir;
    return target < 0 || target > line.text.length ? null : target;
  }

  // Bidirectional ordering algorithm
  // See http://unicode.org/reports/tr9/tr9-13.html for the algorithm
  // that this (partially) implements.

  // One-char codes used for character types:
  // L (L):   Left-to-Right
  // R (R):   Right-to-Left
  // r (AL):  Right-to-Left Arabic
  // 1 (EN):  European Number
  // + (ES):  European Number Separator
  // % (ET):  European Number Terminator
  // n (AN):  Arabic Number
  // , (CS):  Common Number Separator
  // m (NSM): Non-Spacing Mark
  // b (BN):  Boundary Neutral
  // s (B):   Paragraph Separator
  // t (S):   Segment Separator
  // w (WS):  Whitespace
  // N (ON):  Other Neutrals

  // Returns null if characters are ordered as they appear
  // (left-to-right), or an array of sections ({from, to, level}
  // objects) in the order in which they occur visually.
  var bidiOrdering = (function() {
    // Character types for codepoints 0 to 0xff
    var lowTypes = "bbbbbbbbbtstwsbbbbbbbbbbbbbbssstwNN%%%NNNNNN,N,N1111111111NNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbbbb,N%%%%NNNNLNNNNN%%11NLNNN1LNNNNNLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLN";
    // Character types for codepoints 0x600 to 0x6ff
    var arabicTypes = "rrrrrrrrrrrr,rNNmmmmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmrrrrrrrnnnnnnnnnn%nnrrrmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmmmmNmmmm";
    function charType(code) {
      if (code <= 0xf7) return lowTypes.charAt(code);
      else if (0x590 <= code && code <= 0x5f4) return "R";
      else if (0x600 <= code && code <= 0x6ed) return arabicTypes.charAt(code - 0x600);
      else if (0x6ee <= code && code <= 0x8ac) return "r";
      else if (0x2000 <= code && code <= 0x200b) return "w";
      else if (code == 0x200c) return "b";
      else return "L";
    }

    var bidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
    var isNeutral = /[stwN]/, isStrong = /[LRr]/, countsAsLeft = /[Lb1n]/, countsAsNum = /[1n]/;
    // Browsers seem to always treat the boundaries of block elements as being L.
    var outerType = "L";

    function BidiSpan(level, from, to) {
      this.level = level;
      this.from = from; this.to = to;
    }

    return function(str) {
      if (!bidiRE.test(str)) return false;
      var len = str.length, types = [];
      for (var i = 0, type; i < len; ++i)
        types.push(type = charType(str.charCodeAt(i)));

      // W1. Examine each non-spacing mark (NSM) in the level run, and
      // change the type of the NSM to the type of the previous
      // character. If the NSM is at the start of the level run, it will
      // get the type of sor.
      for (var i = 0, prev = outerType; i < len; ++i) {
        var type = types[i];
        if (type == "m") types[i] = prev;
        else prev = type;
      }

      // W2. Search backwards from each instance of a European number
      // until the first strong type (R, L, AL, or sor) is found. If an
      // AL is found, change the type of the European number to Arabic
      // number.
      // W3. Change all ALs to R.
      for (var i = 0, cur = outerType; i < len; ++i) {
        var type = types[i];
        if (type == "1" && cur == "r") types[i] = "n";
        else if (isStrong.test(type)) { cur = type; if (type == "r") types[i] = "R"; }
      }

      // W4. A single European separator between two European numbers
      // changes to a European number. A single common separator between
      // two numbers of the same type changes to that type.
      for (var i = 1, prev = types[0]; i < len - 1; ++i) {
        var type = types[i];
        if (type == "+" && prev == "1" && types[i+1] == "1") types[i] = "1";
        else if (type == "," && prev == types[i+1] &&
                 (prev == "1" || prev == "n")) types[i] = prev;
        prev = type;
      }

      // W5. A sequence of European terminators adjacent to European
      // numbers changes to all European numbers.
      // W6. Otherwise, separators and terminators change to Other
      // Neutral.
      for (var i = 0; i < len; ++i) {
        var type = types[i];
        if (type == ",") types[i] = "N";
        else if (type == "%") {
          for (var end = i + 1; end < len && types[end] == "%"; ++end) {}
          var replace = (i && types[i-1] == "!") || (end < len && types[end] == "1") ? "1" : "N";
          for (var j = i; j < end; ++j) types[j] = replace;
          i = end - 1;
        }
      }

      // W7. Search backwards from each instance of a European number
      // until the first strong type (R, L, or sor) is found. If an L is
      // found, then change the type of the European number to L.
      for (var i = 0, cur = outerType; i < len; ++i) {
        var type = types[i];
        if (cur == "L" && type == "1") types[i] = "L";
        else if (isStrong.test(type)) cur = type;
      }

      // N1. A sequence of neutrals takes the direction of the
      // surrounding strong text if the text on both sides has the same
      // direction. European and Arabic numbers act as if they were R in
      // terms of their influence on neutrals. Start-of-level-run (sor)
      // and end-of-level-run (eor) are used at level run boundaries.
      // N2. Any remaining neutrals take the embedding direction.
      for (var i = 0; i < len; ++i) {
        if (isNeutral.test(types[i])) {
          for (var end = i + 1; end < len && isNeutral.test(types[end]); ++end) {}
          var before = (i ? types[i-1] : outerType) == "L";
          var after = (end < len ? types[end] : outerType) == "L";
          var replace = before || after ? "L" : "R";
          for (var j = i; j < end; ++j) types[j] = replace;
          i = end - 1;
        }
      }

      // Here we depart from the documented algorithm, in order to avoid
      // building up an actual levels array. Since there are only three
      // levels (0, 1, 2) in an implementation that doesn't take
      // explicit embedding into account, we can build up the order on
      // the fly, without following the level-based algorithm.
      var order = [], m;
      for (var i = 0; i < len;) {
        if (countsAsLeft.test(types[i])) {
          var start = i;
          for (++i; i < len && countsAsLeft.test(types[i]); ++i) {}
          order.push(new BidiSpan(0, start, i));
        } else {
          var pos = i, at = order.length;
          for (++i; i < len && types[i] != "L"; ++i) {}
          for (var j = pos; j < i;) {
            if (countsAsNum.test(types[j])) {
              if (pos < j) order.splice(at, 0, new BidiSpan(1, pos, j));
              var nstart = j;
              for (++j; j < i && countsAsNum.test(types[j]); ++j) {}
              order.splice(at, 0, new BidiSpan(2, nstart, j));
              pos = j;
            } else ++j;
          }
          if (pos < i) order.splice(at, 0, new BidiSpan(1, pos, i));
        }
      }
      if (order[0].level == 1 && (m = str.match(/^\s+/))) {
        order[0].from = m[0].length;
        order.unshift(new BidiSpan(0, 0, m[0].length));
      }
      if (lst(order).level == 1 && (m = str.match(/\s+$/))) {
        lst(order).to -= m[0].length;
        order.push(new BidiSpan(0, len - m[0].length, len));
      }
      if (order[0].level == 2)
        order.unshift(new BidiSpan(1, order[0].to, order[0].to));
      if (order[0].level != lst(order).level)
        order.push(new BidiSpan(order[0].level, len, len));

      return order;
    };
  })();

  // THE END

  CodeMirror.version = "5.9.0";

  return CodeMirror;
});

},{}],4:[function(require,module,exports){
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// TODO actually recognize syntax of TypeScript constructs

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("javascript", function(config, parserConfig) {
  var indentUnit = config.indentUnit;
  var statementIndent = parserConfig.statementIndent;
  var jsonldMode = parserConfig.jsonld;
  var jsonMode = parserConfig.json || jsonldMode;
  var isTS = parserConfig.typescript;
  var wordRE = parserConfig.wordCharacters || /[\w$\xa1-\uffff]/;

  // Tokenizer

  var keywords = function(){
    function kw(type) {return {type: type, style: "keyword"};}
    var A = kw("keyword a"), B = kw("keyword b"), C = kw("keyword c");
    var operator = kw("operator"), atom = {type: "atom", style: "atom"};

    var jsKeywords = {
      "if": kw("if"), "while": A, "with": A, "else": B, "do": B, "try": B, "finally": B,
      "return": C, "break": C, "continue": C, "new": kw("new"), "delete": C, "throw": C, "debugger": C,
      "var": kw("var"), "const": kw("var"), "let": kw("var"),
      "function": kw("function"), "catch": kw("catch"),
      "for": kw("for"), "switch": kw("switch"), "case": kw("case"), "default": kw("default"),
      "in": operator, "typeof": operator, "instanceof": operator,
      "true": atom, "false": atom, "null": atom, "undefined": atom, "NaN": atom, "Infinity": atom,
      "this": kw("this"), "class": kw("class"), "super": kw("atom"),
      "yield": C, "export": kw("export"), "import": kw("import"), "extends": C
    };

    // Extend the 'normal' keywords with the TypeScript language extensions
    if (isTS) {
      var type = {type: "variable", style: "variable-3"};
      var tsKeywords = {
        // object-like things
        "interface": kw("interface"),
        "extends": kw("extends"),
        "constructor": kw("constructor"),

        // scope modifiers
        "public": kw("public"),
        "private": kw("private"),
        "protected": kw("protected"),
        "static": kw("static"),

        // types
        "string": type, "number": type, "boolean": type, "any": type
      };

      for (var attr in tsKeywords) {
        jsKeywords[attr] = tsKeywords[attr];
      }
    }

    return jsKeywords;
  }();

  var isOperatorChar = /[+\-*&%=<>!?|~^]/;
  var isJsonldKeyword = /^@(context|id|value|language|type|container|list|set|reverse|index|base|vocab|graph)"/;

  function readRegexp(stream) {
    var escaped = false, next, inSet = false;
    while ((next = stream.next()) != null) {
      if (!escaped) {
        if (next == "/" && !inSet) return;
        if (next == "[") inSet = true;
        else if (inSet && next == "]") inSet = false;
      }
      escaped = !escaped && next == "\\";
    }
  }

  // Used as scratch variables to communicate multiple values without
  // consing up tons of objects.
  var type, content;
  function ret(tp, style, cont) {
    type = tp; content = cont;
    return style;
  }
  function tokenBase(stream, state) {
    var ch = stream.next();
    if (ch == '"' || ch == "'") {
      state.tokenize = tokenString(ch);
      return state.tokenize(stream, state);
    } else if (ch == "." && stream.match(/^\d+(?:[eE][+\-]?\d+)?/)) {
      return ret("number", "number");
    } else if (ch == "." && stream.match("..")) {
      return ret("spread", "meta");
    } else if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
      return ret(ch);
    } else if (ch == "=" && stream.eat(">")) {
      return ret("=>", "operator");
    } else if (ch == "0" && stream.eat(/x/i)) {
      stream.eatWhile(/[\da-f]/i);
      return ret("number", "number");
    } else if (ch == "0" && stream.eat(/o/i)) {
      stream.eatWhile(/[0-7]/i);
      return ret("number", "number");
    } else if (ch == "0" && stream.eat(/b/i)) {
      stream.eatWhile(/[01]/i);
      return ret("number", "number");
    } else if (/\d/.test(ch)) {
      stream.match(/^\d*(?:\.\d*)?(?:[eE][+\-]?\d+)?/);
      return ret("number", "number");
    } else if (ch == "/") {
      if (stream.eat("*")) {
        state.tokenize = tokenComment;
        return tokenComment(stream, state);
      } else if (stream.eat("/")) {
        stream.skipToEnd();
        return ret("comment", "comment");
      } else if (/^(?:operator|sof|keyword c|case|new|[\[{}\(,;:])$/.test(state.lastType)) {
        readRegexp(stream);
        stream.match(/^\b(([gimyu])(?![gimyu]*\2))+\b/);
        return ret("regexp", "string-2");
      } else {
        stream.eatWhile(isOperatorChar);
        return ret("operator", "operator", stream.current());
      }
    } else if (ch == "`") {
      state.tokenize = tokenQuasi;
      return tokenQuasi(stream, state);
    } else if (ch == "#") {
      stream.skipToEnd();
      return ret("error", "error");
    } else if (isOperatorChar.test(ch)) {
      stream.eatWhile(isOperatorChar);
      return ret("operator", "operator", stream.current());
    } else if (wordRE.test(ch)) {
      stream.eatWhile(wordRE);
      var word = stream.current(), known = keywords.propertyIsEnumerable(word) && keywords[word];
      return (known && state.lastType != ".") ? ret(known.type, known.style, word) :
                     ret("variable", "variable", word);
    }
  }

  function tokenString(quote) {
    return function(stream, state) {
      var escaped = false, next;
      if (jsonldMode && stream.peek() == "@" && stream.match(isJsonldKeyword)){
        state.tokenize = tokenBase;
        return ret("jsonld-keyword", "meta");
      }
      while ((next = stream.next()) != null) {
        if (next == quote && !escaped) break;
        escaped = !escaped && next == "\\";
      }
      if (!escaped) state.tokenize = tokenBase;
      return ret("string", "string");
    };
  }

  function tokenComment(stream, state) {
    var maybeEnd = false, ch;
    while (ch = stream.next()) {
      if (ch == "/" && maybeEnd) {
        state.tokenize = tokenBase;
        break;
      }
      maybeEnd = (ch == "*");
    }
    return ret("comment", "comment");
  }

  function tokenQuasi(stream, state) {
    var escaped = false, next;
    while ((next = stream.next()) != null) {
      if (!escaped && (next == "`" || next == "$" && stream.eat("{"))) {
        state.tokenize = tokenBase;
        break;
      }
      escaped = !escaped && next == "\\";
    }
    return ret("quasi", "string-2", stream.current());
  }

  var brackets = "([{}])";
  // This is a crude lookahead trick to try and notice that we're
  // parsing the argument patterns for a fat-arrow function before we
  // actually hit the arrow token. It only works if the arrow is on
  // the same line as the arguments and there's no strange noise
  // (comments) in between. Fallback is to only notice when we hit the
  // arrow, and not declare the arguments as locals for the arrow
  // body.
  function findFatArrow(stream, state) {
    if (state.fatArrowAt) state.fatArrowAt = null;
    var arrow = stream.string.indexOf("=>", stream.start);
    if (arrow < 0) return;

    var depth = 0, sawSomething = false;
    for (var pos = arrow - 1; pos >= 0; --pos) {
      var ch = stream.string.charAt(pos);
      var bracket = brackets.indexOf(ch);
      if (bracket >= 0 && bracket < 3) {
        if (!depth) { ++pos; break; }
        if (--depth == 0) break;
      } else if (bracket >= 3 && bracket < 6) {
        ++depth;
      } else if (wordRE.test(ch)) {
        sawSomething = true;
      } else if (/["'\/]/.test(ch)) {
        return;
      } else if (sawSomething && !depth) {
        ++pos;
        break;
      }
    }
    if (sawSomething && !depth) state.fatArrowAt = pos;
  }

  // Parser

  var atomicTypes = {"atom": true, "number": true, "variable": true, "string": true, "regexp": true, "this": true, "jsonld-keyword": true};

  function JSLexical(indented, column, type, align, prev, info) {
    this.indented = indented;
    this.column = column;
    this.type = type;
    this.prev = prev;
    this.info = info;
    if (align != null) this.align = align;
  }

  function inScope(state, varname) {
    for (var v = state.localVars; v; v = v.next)
      if (v.name == varname) return true;
    for (var cx = state.context; cx; cx = cx.prev) {
      for (var v = cx.vars; v; v = v.next)
        if (v.name == varname) return true;
    }
  }

  function parseJS(state, style, type, content, stream) {
    var cc = state.cc;
    // Communicate our context to the combinators.
    // (Less wasteful than consing up a hundred closures on every call.)
    cx.state = state; cx.stream = stream; cx.marked = null, cx.cc = cc; cx.style = style;

    if (!state.lexical.hasOwnProperty("align"))
      state.lexical.align = true;

    while(true) {
      var combinator = cc.length ? cc.pop() : jsonMode ? expression : statement;
      if (combinator(type, content)) {
        while(cc.length && cc[cc.length - 1].lex)
          cc.pop()();
        if (cx.marked) return cx.marked;
        if (type == "variable" && inScope(state, content)) return "variable-2";
        return style;
      }
    }
  }

  // Combinator utils

  var cx = {state: null, column: null, marked: null, cc: null};
  function pass() {
    for (var i = arguments.length - 1; i >= 0; i--) cx.cc.push(arguments[i]);
  }
  function cont() {
    pass.apply(null, arguments);
    return true;
  }
  function register(varname) {
    function inList(list) {
      for (var v = list; v; v = v.next)
        if (v.name == varname) return true;
      return false;
    }
    var state = cx.state;
    cx.marked = "def";
    if (state.context) {
      if (inList(state.localVars)) return;
      state.localVars = {name: varname, next: state.localVars};
    } else {
      if (inList(state.globalVars)) return;
      if (parserConfig.globalVars)
        state.globalVars = {name: varname, next: state.globalVars};
    }
  }

  // Combinators

  var defaultVars = {name: "this", next: {name: "arguments"}};
  function pushcontext() {
    cx.state.context = {prev: cx.state.context, vars: cx.state.localVars};
    cx.state.localVars = defaultVars;
  }
  function popcontext() {
    cx.state.localVars = cx.state.context.vars;
    cx.state.context = cx.state.context.prev;
  }
  function pushlex(type, info) {
    var result = function() {
      var state = cx.state, indent = state.indented;
      if (state.lexical.type == "stat") indent = state.lexical.indented;
      else for (var outer = state.lexical; outer && outer.type == ")" && outer.align; outer = outer.prev)
        indent = outer.indented;
      state.lexical = new JSLexical(indent, cx.stream.column(), type, null, state.lexical, info);
    };
    result.lex = true;
    return result;
  }
  function poplex() {
    var state = cx.state;
    if (state.lexical.prev) {
      if (state.lexical.type == ")")
        state.indented = state.lexical.indented;
      state.lexical = state.lexical.prev;
    }
  }
  poplex.lex = true;

  function expect(wanted) {
    function exp(type) {
      if (type == wanted) return cont();
      else if (wanted == ";") return pass();
      else return cont(exp);
    };
    return exp;
  }

  function statement(type, value) {
    if (type == "var") return cont(pushlex("vardef", value.length), vardef, expect(";"), poplex);
    if (type == "keyword a") return cont(pushlex("form"), expression, statement, poplex);
    if (type == "keyword b") return cont(pushlex("form"), statement, poplex);
    if (type == "{") return cont(pushlex("}"), block, poplex);
    if (type == ";") return cont();
    if (type == "if") {
      if (cx.state.lexical.info == "else" && cx.state.cc[cx.state.cc.length - 1] == poplex)
        cx.state.cc.pop()();
      return cont(pushlex("form"), expression, statement, poplex, maybeelse);
    }
    if (type == "function") return cont(functiondef);
    if (type == "for") return cont(pushlex("form"), forspec, statement, poplex);
    if (type == "variable") return cont(pushlex("stat"), maybelabel);
    if (type == "switch") return cont(pushlex("form"), expression, pushlex("}", "switch"), expect("{"),
                                      block, poplex, poplex);
    if (type == "case") return cont(expression, expect(":"));
    if (type == "default") return cont(expect(":"));
    if (type == "catch") return cont(pushlex("form"), pushcontext, expect("("), funarg, expect(")"),
                                     statement, poplex, popcontext);
    if (type == "class") return cont(pushlex("form"), className, poplex);
    if (type == "export") return cont(pushlex("stat"), afterExport, poplex);
    if (type == "import") return cont(pushlex("stat"), afterImport, poplex);
    return pass(pushlex("stat"), expression, expect(";"), poplex);
  }
  function expression(type) {
    return expressionInner(type, false);
  }
  function expressionNoComma(type) {
    return expressionInner(type, true);
  }
  function expressionInner(type, noComma) {
    if (cx.state.fatArrowAt == cx.stream.start) {
      var body = noComma ? arrowBodyNoComma : arrowBody;
      if (type == "(") return cont(pushcontext, pushlex(")"), commasep(pattern, ")"), poplex, expect("=>"), body, popcontext);
      else if (type == "variable") return pass(pushcontext, pattern, expect("=>"), body, popcontext);
    }

    var maybeop = noComma ? maybeoperatorNoComma : maybeoperatorComma;
    if (atomicTypes.hasOwnProperty(type)) return cont(maybeop);
    if (type == "function") return cont(functiondef, maybeop);
    if (type == "keyword c") return cont(noComma ? maybeexpressionNoComma : maybeexpression);
    if (type == "(") return cont(pushlex(")"), maybeexpression, comprehension, expect(")"), poplex, maybeop);
    if (type == "operator" || type == "spread") return cont(noComma ? expressionNoComma : expression);
    if (type == "[") return cont(pushlex("]"), arrayLiteral, poplex, maybeop);
    if (type == "{") return contCommasep(objprop, "}", null, maybeop);
    if (type == "quasi") return pass(quasi, maybeop);
    if (type == "new") return cont(maybeTarget(noComma));
    return cont();
  }
  function maybeexpression(type) {
    if (type.match(/[;\}\)\],]/)) return pass();
    return pass(expression);
  }
  function maybeexpressionNoComma(type) {
    if (type.match(/[;\}\)\],]/)) return pass();
    return pass(expressionNoComma);
  }

  function maybeoperatorComma(type, value) {
    if (type == ",") return cont(expression);
    return maybeoperatorNoComma(type, value, false);
  }
  function maybeoperatorNoComma(type, value, noComma) {
    var me = noComma == false ? maybeoperatorComma : maybeoperatorNoComma;
    var expr = noComma == false ? expression : expressionNoComma;
    if (type == "=>") return cont(pushcontext, noComma ? arrowBodyNoComma : arrowBody, popcontext);
    if (type == "operator") {
      if (/\+\+|--/.test(value)) return cont(me);
      if (value == "?") return cont(expression, expect(":"), expr);
      return cont(expr);
    }
    if (type == "quasi") { return pass(quasi, me); }
    if (type == ";") return;
    if (type == "(") return contCommasep(expressionNoComma, ")", "call", me);
    if (type == ".") return cont(property, me);
    if (type == "[") return cont(pushlex("]"), maybeexpression, expect("]"), poplex, me);
  }
  function quasi(type, value) {
    if (type != "quasi") return pass();
    if (value.slice(value.length - 2) != "${") return cont(quasi);
    return cont(expression, continueQuasi);
  }
  function continueQuasi(type) {
    if (type == "}") {
      cx.marked = "string-2";
      cx.state.tokenize = tokenQuasi;
      return cont(quasi);
    }
  }
  function arrowBody(type) {
    findFatArrow(cx.stream, cx.state);
    return pass(type == "{" ? statement : expression);
  }
  function arrowBodyNoComma(type) {
    findFatArrow(cx.stream, cx.state);
    return pass(type == "{" ? statement : expressionNoComma);
  }
  function maybeTarget(noComma) {
    return function(type) {
      if (type == ".") return cont(noComma ? targetNoComma : target);
      else return pass(noComma ? expressionNoComma : expression);
    };
  }
  function target(_, value) {
    if (value == "target") { cx.marked = "keyword"; return cont(maybeoperatorComma); }
  }
  function targetNoComma(_, value) {
    if (value == "target") { cx.marked = "keyword"; return cont(maybeoperatorNoComma); }
  }
  function maybelabel(type) {
    if (type == ":") return cont(poplex, statement);
    return pass(maybeoperatorComma, expect(";"), poplex);
  }
  function property(type) {
    if (type == "variable") {cx.marked = "property"; return cont();}
  }
  function objprop(type, value) {
    if (type == "variable" || cx.style == "keyword") {
      cx.marked = "property";
      if (value == "get" || value == "set") return cont(getterSetter);
      return cont(afterprop);
    } else if (type == "number" || type == "string") {
      cx.marked = jsonldMode ? "property" : (cx.style + " property");
      return cont(afterprop);
    } else if (type == "jsonld-keyword") {
      return cont(afterprop);
    } else if (type == "[") {
      return cont(expression, expect("]"), afterprop);
    } else if (type == "spread") {
      return cont(expression);
    }
  }
  function getterSetter(type) {
    if (type != "variable") return pass(afterprop);
    cx.marked = "property";
    return cont(functiondef);
  }
  function afterprop(type) {
    if (type == ":") return cont(expressionNoComma);
    if (type == "(") return pass(functiondef);
  }
  function commasep(what, end) {
    function proceed(type) {
      if (type == ",") {
        var lex = cx.state.lexical;
        if (lex.info == "call") lex.pos = (lex.pos || 0) + 1;
        return cont(what, proceed);
      }
      if (type == end) return cont();
      return cont(expect(end));
    }
    return function(type) {
      if (type == end) return cont();
      return pass(what, proceed);
    };
  }
  function contCommasep(what, end, info) {
    for (var i = 3; i < arguments.length; i++)
      cx.cc.push(arguments[i]);
    return cont(pushlex(end, info), commasep(what, end), poplex);
  }
  function block(type) {
    if (type == "}") return cont();
    return pass(statement, block);
  }
  function maybetype(type) {
    if (isTS && type == ":") return cont(typedef);
  }
  function maybedefault(_, value) {
    if (value == "=") return cont(expressionNoComma);
  }
  function typedef(type) {
    if (type == "variable") {cx.marked = "variable-3"; return cont();}
  }
  function vardef() {
    return pass(pattern, maybetype, maybeAssign, vardefCont);
  }
  function pattern(type, value) {
    if (type == "variable") { register(value); return cont(); }
    if (type == "spread") return cont(pattern);
    if (type == "[") return contCommasep(pattern, "]");
    if (type == "{") return contCommasep(proppattern, "}");
  }
  function proppattern(type, value) {
    if (type == "variable" && !cx.stream.match(/^\s*:/, false)) {
      register(value);
      return cont(maybeAssign);
    }
    if (type == "variable") cx.marked = "property";
    if (type == "spread") return cont(pattern);
    return cont(expect(":"), pattern, maybeAssign);
  }
  function maybeAssign(_type, value) {
    if (value == "=") return cont(expressionNoComma);
  }
  function vardefCont(type) {
    if (type == ",") return cont(vardef);
  }
  function maybeelse(type, value) {
    if (type == "keyword b" && value == "else") return cont(pushlex("form", "else"), statement, poplex);
  }
  function forspec(type) {
    if (type == "(") return cont(pushlex(")"), forspec1, expect(")"), poplex);
  }
  function forspec1(type) {
    if (type == "var") return cont(vardef, expect(";"), forspec2);
    if (type == ";") return cont(forspec2);
    if (type == "variable") return cont(formaybeinof);
    return pass(expression, expect(";"), forspec2);
  }
  function formaybeinof(_type, value) {
    if (value == "in" || value == "of") { cx.marked = "keyword"; return cont(expression); }
    return cont(maybeoperatorComma, forspec2);
  }
  function forspec2(type, value) {
    if (type == ";") return cont(forspec3);
    if (value == "in" || value == "of") { cx.marked = "keyword"; return cont(expression); }
    return pass(expression, expect(";"), forspec3);
  }
  function forspec3(type) {
    if (type != ")") cont(expression);
  }
  function functiondef(type, value) {
    if (value == "*") {cx.marked = "keyword"; return cont(functiondef);}
    if (type == "variable") {register(value); return cont(functiondef);}
    if (type == "(") return cont(pushcontext, pushlex(")"), commasep(funarg, ")"), poplex, statement, popcontext);
  }
  function funarg(type) {
    if (type == "spread") return cont(funarg);
    return pass(pattern, maybetype, maybedefault);
  }
  function className(type, value) {
    if (type == "variable") {register(value); return cont(classNameAfter);}
  }
  function classNameAfter(type, value) {
    if (value == "extends") return cont(expression, classNameAfter);
    if (type == "{") return cont(pushlex("}"), classBody, poplex);
  }
  function classBody(type, value) {
    if (type == "variable" || cx.style == "keyword") {
      if (value == "static") {
        cx.marked = "keyword";
        return cont(classBody);
      }
      cx.marked = "property";
      if (value == "get" || value == "set") return cont(classGetterSetter, functiondef, classBody);
      return cont(functiondef, classBody);
    }
    if (value == "*") {
      cx.marked = "keyword";
      return cont(classBody);
    }
    if (type == ";") return cont(classBody);
    if (type == "}") return cont();
  }
  function classGetterSetter(type) {
    if (type != "variable") return pass();
    cx.marked = "property";
    return cont();
  }
  function afterExport(_type, value) {
    if (value == "*") { cx.marked = "keyword"; return cont(maybeFrom, expect(";")); }
    if (value == "default") { cx.marked = "keyword"; return cont(expression, expect(";")); }
    return pass(statement);
  }
  function afterImport(type) {
    if (type == "string") return cont();
    return pass(importSpec, maybeFrom);
  }
  function importSpec(type, value) {
    if (type == "{") return contCommasep(importSpec, "}");
    if (type == "variable") register(value);
    if (value == "*") cx.marked = "keyword";
    return cont(maybeAs);
  }
  function maybeAs(_type, value) {
    if (value == "as") { cx.marked = "keyword"; return cont(importSpec); }
  }
  function maybeFrom(_type, value) {
    if (value == "from") { cx.marked = "keyword"; return cont(expression); }
  }
  function arrayLiteral(type) {
    if (type == "]") return cont();
    return pass(expressionNoComma, maybeArrayComprehension);
  }
  function maybeArrayComprehension(type) {
    if (type == "for") return pass(comprehension, expect("]"));
    if (type == ",") return cont(commasep(maybeexpressionNoComma, "]"));
    return pass(commasep(expressionNoComma, "]"));
  }
  function comprehension(type) {
    if (type == "for") return cont(forspec, comprehension);
    if (type == "if") return cont(expression, comprehension);
  }

  function isContinuedStatement(state, textAfter) {
    return state.lastType == "operator" || state.lastType == "," ||
      isOperatorChar.test(textAfter.charAt(0)) ||
      /[,.]/.test(textAfter.charAt(0));
  }

  // Interface

  return {
    startState: function(basecolumn) {
      var state = {
        tokenize: tokenBase,
        lastType: "sof",
        cc: [],
        lexical: new JSLexical((basecolumn || 0) - indentUnit, 0, "block", false),
        localVars: parserConfig.localVars,
        context: parserConfig.localVars && {vars: parserConfig.localVars},
        indented: 0
      };
      if (parserConfig.globalVars && typeof parserConfig.globalVars == "object")
        state.globalVars = parserConfig.globalVars;
      return state;
    },

    token: function(stream, state) {
      if (stream.sol()) {
        if (!state.lexical.hasOwnProperty("align"))
          state.lexical.align = false;
        state.indented = stream.indentation();
        findFatArrow(stream, state);
      }
      if (state.tokenize != tokenComment && stream.eatSpace()) return null;
      var style = state.tokenize(stream, state);
      if (type == "comment") return style;
      state.lastType = type == "operator" && (content == "++" || content == "--") ? "incdec" : type;
      return parseJS(state, style, type, content, stream);
    },

    indent: function(state, textAfter) {
      if (state.tokenize == tokenComment) return CodeMirror.Pass;
      if (state.tokenize != tokenBase) return 0;
      var firstChar = textAfter && textAfter.charAt(0), lexical = state.lexical;
      // Kludge to prevent 'maybelse' from blocking lexical scope pops
      if (!/^\s*else\b/.test(textAfter)) for (var i = state.cc.length - 1; i >= 0; --i) {
        var c = state.cc[i];
        if (c == poplex) lexical = lexical.prev;
        else if (c != maybeelse) break;
      }
      if (lexical.type == "stat" && firstChar == "}") lexical = lexical.prev;
      if (statementIndent && lexical.type == ")" && lexical.prev.type == "stat")
        lexical = lexical.prev;
      var type = lexical.type, closing = firstChar == type;

      if (type == "vardef") return lexical.indented + (state.lastType == "operator" || state.lastType == "," ? lexical.info + 1 : 0);
      else if (type == "form" && firstChar == "{") return lexical.indented;
      else if (type == "form") return lexical.indented + indentUnit;
      else if (type == "stat")
        return lexical.indented + (isContinuedStatement(state, textAfter) ? statementIndent || indentUnit : 0);
      else if (lexical.info == "switch" && !closing && parserConfig.doubleIndentSwitch != false)
        return lexical.indented + (/^(?:case|default)\b/.test(textAfter) ? indentUnit : 2 * indentUnit);
      else if (lexical.align) return lexical.column + (closing ? 0 : 1);
      else return lexical.indented + (closing ? 0 : indentUnit);
    },

    electricInput: /^\s*(?:case .*?:|default:|\{|\})$/,
    blockCommentStart: jsonMode ? null : "/*",
    blockCommentEnd: jsonMode ? null : "*/",
    lineComment: jsonMode ? null : "//",
    fold: "brace",
    closeBrackets: "()[]{}''\"\"``",

    helperType: jsonMode ? "json" : "javascript",
    jsonldMode: jsonldMode,
    jsonMode: jsonMode
  };
});

CodeMirror.registerHelper("wordChars", "javascript", /[\w$]/);

CodeMirror.defineMIME("text/javascript", "javascript");
CodeMirror.defineMIME("text/ecmascript", "javascript");
CodeMirror.defineMIME("application/javascript", "javascript");
CodeMirror.defineMIME("application/x-javascript", "javascript");
CodeMirror.defineMIME("application/ecmascript", "javascript");
CodeMirror.defineMIME("application/json", {name: "javascript", json: true});
CodeMirror.defineMIME("application/x-json", {name: "javascript", json: true});
CodeMirror.defineMIME("application/ld+json", {name: "javascript", jsonld: true});
CodeMirror.defineMIME("text/typescript", { name: "javascript", typescript: true });
CodeMirror.defineMIME("application/typescript", { name: "javascript", typescript: true });

});

},{"../../lib/codemirror":3}],5:[function(require,module,exports){
var WAAClock = require('./lib/WAAClock')

module.exports = WAAClock
if (typeof window !== 'undefined') window.WAAClock = WAAClock

},{"./lib/WAAClock":6}],6:[function(require,module,exports){
(function (process){
var isBrowser = (typeof window !== 'undefined')

var CLOCK_DEFAULTS = {
  toleranceLate: 0.10,
  toleranceEarly: 0.001
}

// ==================== Event ==================== //
var Event = function(clock, deadline, func) {
  this.clock = clock
  this.func = func
  this._cleared = false // Flag used to clear an event inside callback

  this.toleranceLate = clock.toleranceLate
  this.toleranceEarly = clock.toleranceEarly
  this._latestTime = null
  this._earliestTime = null
  this.deadline = null
  this.repeatTime = null

  this.schedule(deadline)
}

// Unschedules the event
Event.prototype.clear = function() {
  this.clock._removeEvent(this)
  this._cleared = true
  return this
}

// Sets the event to repeat every `time` seconds.
Event.prototype.repeat = function(time) {
  if (time === 0)
    throw new Error('delay cannot be 0')
  this.repeatTime = time
  if (!this.clock._hasEvent(this))
    this.schedule(this.deadline + this.repeatTime)
  return this
}

// Sets the time tolerance of the event.
// The event will be executed in the interval `[deadline - early, deadline + late]`
// If the clock fails to execute the event in time, the event will be dropped.
Event.prototype.tolerance = function(values) {
  if (typeof values.late === 'number')
    this.toleranceLate = values.late
  if (typeof values.early === 'number')
    this.toleranceEarly = values.early
  this._refreshEarlyLateDates()
  if (this.clock._hasEvent(this)) {
    this.clock._removeEvent(this)
    this.clock._insertEvent(this)
  }
  return this
}

// Returns true if the event is repeated, false otherwise
Event.prototype.isRepeated = function() { return this.repeatTime !== null }

// Schedules the event to be ran before `deadline`.
// If the time is within the event tolerance, we handle the event immediately.
// If the event was already scheduled at a different time, it is rescheduled.
Event.prototype.schedule = function(deadline) {
  this._cleared = false
  this.deadline = deadline
  this._refreshEarlyLateDates()

  if (this.clock.context.currentTime >= this._earliestTime) {
    this._execute()
  
  } else if (this.clock._hasEvent(this)) {
    this.clock._removeEvent(this)
    this.clock._insertEvent(this)
  
  } else this.clock._insertEvent(this)
}

Event.prototype.timeStretch = function(tRef, ratio) {
  if (this.isRepeated())
    this.repeatTime = this.repeatTime * ratio

  var deadline = tRef + ratio * (this.deadline - tRef)
  // If the deadline is too close or past, and the event has a repeat,
  // we calculate the next repeat possible in the stretched space.
  if (this.isRepeated()) {
    while (this.clock.context.currentTime >= deadline - this.toleranceEarly)
      deadline += this.repeatTime
  }
  this.schedule(deadline)
}

// Executes the event
Event.prototype._execute = function() {
  if (this.clock._started === false) return
  this.clock._removeEvent(this)

  if (this.clock.context.currentTime < this._latestTime)
    this.func(this)
  else {
    if (this.onexpired) this.onexpired(this)
    console.warn('event expired')
  }
  // In the case `schedule` is called inside `func`, we need to avoid
  // overrwriting with yet another `schedule`.
  if (!this.clock._hasEvent(this) && this.isRepeated() && !this._cleared)
    this.schedule(this.deadline + this.repeatTime) 
}

// Updates cached times
Event.prototype._refreshEarlyLateDates = function() {
  this._latestTime = this.deadline + this.toleranceLate
  this._earliestTime = this.deadline - this.toleranceEarly
}

// ==================== WAAClock ==================== //
var WAAClock = module.exports = function(context, opts) {
  var self = this
  opts = opts || {}
  this.tickMethod = opts.tickMethod || 'ScriptProcessorNode'
  this.toleranceEarly = opts.toleranceEarly || CLOCK_DEFAULTS.toleranceEarly
  this.toleranceLate = opts.toleranceLate || CLOCK_DEFAULTS.toleranceLate
  this.context = context
  this._events = []
  this._started = false
}

// ---------- Public API ---------- //
// Schedules `func` to run after `delay` seconds.
WAAClock.prototype.setTimeout = function(func, delay) {
  return this._createEvent(func, this._absTime(delay))
}

// Schedules `func` to run before `deadline`.
WAAClock.prototype.callbackAtTime = function(func, deadline) {
  return this._createEvent(func, deadline)
}

// Stretches `deadline` and `repeat` of all scheduled `events` by `ratio`, keeping
// their relative distance to `tRef`. In fact this is equivalent to changing the tempo.
WAAClock.prototype.timeStretch = function(tRef, events, ratio) {
  events.forEach(function(event) { event.timeStretch(tRef, ratio) })
  return events
}

// Removes all scheduled events and starts the clock 
WAAClock.prototype.start = function() {
  if (this._started === false) {
    var self = this
    this._started = true
    this._events = []

    if (this.tickMethod === 'ScriptProcessorNode') {
      var bufferSize = 256
      // We have to keep a reference to the node to avoid garbage collection
      this._clockNode = this.context.createScriptProcessor(bufferSize, 1, 1)
      this._clockNode.connect(this.context.destination)
      this._clockNode.onaudioprocess = function () {
        process.nextTick(function() { self._tick() })
      }
    } else if (this.tickMethod === 'manual') null // _tick is called manually

    else throw new Error('invalid tickMethod ' + this.tickMethod)
  }
}

// Stops the clock
WAAClock.prototype.stop = function() {
  if (this._started === true) {
    this._started = false
    this._clockNode.disconnect()
  }  
}

// ---------- Private ---------- //

// This function is ran periodically, and at each tick it executes
// events for which `currentTime` is included in their tolerance interval.
WAAClock.prototype._tick = function() {
  var event = this._events.shift()

  while(event && event._earliestTime <= this.context.currentTime) {
    event._execute()
    event = this._events.shift()
  }

  // Put back the last event
  if(event) this._events.unshift(event)
}

// Creates an event and insert it to the list
WAAClock.prototype._createEvent = function(func, deadline) {
  return new Event(this, deadline, func)
}

// Inserts an event to the list
WAAClock.prototype._insertEvent = function(event) {
  this._events.splice(this._indexByTime(event._earliestTime), 0, event)
}

// Removes an event from the list
WAAClock.prototype._removeEvent = function(event) {
  var ind = this._events.indexOf(event)
  if (ind !== -1) this._events.splice(ind, 1)
}

// Returns true if `event` is in queue, false otherwise
WAAClock.prototype._hasEvent = function(event) {
 return this._events.indexOf(event) !== -1
}

// Returns the index of the first event whose deadline is >= to `deadline`
WAAClock.prototype._indexByTime = function(deadline) {
  // performs a binary search
  var low = 0
    , high = this._events.length
    , mid
  while (low < high) {
    mid = Math.floor((low + high) / 2)
    if (this._events[mid]._earliestTime < deadline)
      low = mid + 1
    else high = mid
  }
  return low
}

// Converts from relative time to absolute time
WAAClock.prototype._absTime = function(relTime) {
  return relTime + this.context.currentTime
}

// Converts from absolute time to relative time 
WAAClock.prototype._relTime = function(absTime) {
  return absTime - this.context.currentTime
}
}).call(this,require('_process'))

},{"_process":2}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvY29kZW1pcnJvci9saWIvY29kZW1pcnJvci5qcyIsIm5vZGVfbW9kdWxlcy9jb2RlbWlycm9yL21vZGUvamF2YXNjcmlwdC9qYXZhc2NyaXB0LmpzIiwibm9kZV9tb2R1bGVzL3dhYWNsb2NrL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3dhYWNsb2NrL2xpYi9XQUFDbG9jay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hxUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIhZnVuY3Rpb24oKSB7XG4gIHZhciBXQUFDbG9jayA9IHJlcXVpcmUoICd3YWFjbG9jaycgKSxcbiAgICAgIENvZGVNaXJyb3IgPSByZXF1aXJlKCAnY29kZW1pcnJvcicgKVxuXG4gIHJlcXVpcmUoICcuLi9ub2RlX21vZHVsZXMvY29kZW1pcnJvci9tb2RlL2phdmFzY3JpcHQvamF2YXNjcmlwdC5qcycgKVxuXG4gIHZhciBjbSA9IENvZGVNaXJyb3IoIGRvY3VtZW50LmJvZHksIHsgbW9kZTpcImphdmFzY3JpcHRcIiB9KVxuXG4gIGNvbnNvbGUubG9nKCd0ZXN0MicpXG5cbn0oKVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvLyBDb2RlTWlycm9yLCBjb3B5cmlnaHQgKGMpIGJ5IE1hcmlqbiBIYXZlcmJla2UgYW5kIG90aGVyc1xuLy8gRGlzdHJpYnV0ZWQgdW5kZXIgYW4gTUlUIGxpY2Vuc2U6IGh0dHA6Ly9jb2RlbWlycm9yLm5ldC9MSUNFTlNFXG5cbi8vIFRoaXMgaXMgQ29kZU1pcnJvciAoaHR0cDovL2NvZGVtaXJyb3IubmV0KSwgYSBjb2RlIGVkaXRvclxuLy8gaW1wbGVtZW50ZWQgaW4gSmF2YVNjcmlwdCBvbiB0b3Agb2YgdGhlIGJyb3dzZXIncyBET00uXG4vL1xuLy8gWW91IGNhbiBmaW5kIHNvbWUgdGVjaG5pY2FsIGJhY2tncm91bmQgZm9yIHNvbWUgb2YgdGhlIGNvZGUgYmVsb3dcbi8vIGF0IGh0dHA6Ly9tYXJpam5oYXZlcmJla2UubmwvYmxvZy8jY20taW50ZXJuYWxzIC5cblxuKGZ1bmN0aW9uKG1vZCkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgbW9kdWxlID09IFwib2JqZWN0XCIpIC8vIENvbW1vbkpTXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBtb2QoKTtcbiAgZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkgLy8gQU1EXG4gICAgcmV0dXJuIGRlZmluZShbXSwgbW9kKTtcbiAgZWxzZSAvLyBQbGFpbiBicm93c2VyIGVudlxuICAgIHRoaXMuQ29kZU1pcnJvciA9IG1vZCgpO1xufSkoZnVuY3Rpb24oKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIC8vIEJST1dTRVIgU05JRkZJTkdcblxuICAvLyBLbHVkZ2VzIGZvciBidWdzIGFuZCBiZWhhdmlvciBkaWZmZXJlbmNlcyB0aGF0IGNhbid0IGJlIGZlYXR1cmVcbiAgLy8gZGV0ZWN0ZWQgYXJlIGVuYWJsZWQgYmFzZWQgb24gdXNlckFnZW50IGV0YyBzbmlmZmluZy5cbiAgdmFyIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQ7XG4gIHZhciBwbGF0Zm9ybSA9IG5hdmlnYXRvci5wbGF0Zm9ybTtcblxuICB2YXIgZ2Vja28gPSAvZ2Vja29cXC9cXGQvaS50ZXN0KHVzZXJBZ2VudCk7XG4gIHZhciBpZV91cHRvMTAgPSAvTVNJRSBcXGQvLnRlc3QodXNlckFnZW50KTtcbiAgdmFyIGllXzExdXAgPSAvVHJpZGVudFxcLyg/Ols3LTldfFxcZHsyLH0pXFwuLipydjooXFxkKykvLmV4ZWModXNlckFnZW50KTtcbiAgdmFyIGllID0gaWVfdXB0bzEwIHx8IGllXzExdXA7XG4gIHZhciBpZV92ZXJzaW9uID0gaWUgJiYgKGllX3VwdG8xMCA/IGRvY3VtZW50LmRvY3VtZW50TW9kZSB8fCA2IDogaWVfMTF1cFsxXSk7XG4gIHZhciB3ZWJraXQgPSAvV2ViS2l0XFwvLy50ZXN0KHVzZXJBZ2VudCk7XG4gIHZhciBxdHdlYmtpdCA9IHdlYmtpdCAmJiAvUXRcXC9cXGQrXFwuXFxkKy8udGVzdCh1c2VyQWdlbnQpO1xuICB2YXIgY2hyb21lID0gL0Nocm9tZVxcLy8udGVzdCh1c2VyQWdlbnQpO1xuICB2YXIgcHJlc3RvID0gL09wZXJhXFwvLy50ZXN0KHVzZXJBZ2VudCk7XG4gIHZhciBzYWZhcmkgPSAvQXBwbGUgQ29tcHV0ZXIvLnRlc3QobmF2aWdhdG9yLnZlbmRvcik7XG4gIHZhciBtYWNfZ2VNb3VudGFpbkxpb24gPSAvTWFjIE9TIFggMVxcZFxcRChbOC05XXxcXGRcXGQpXFxELy50ZXN0KHVzZXJBZ2VudCk7XG4gIHZhciBwaGFudG9tID0gL1BoYW50b21KUy8udGVzdCh1c2VyQWdlbnQpO1xuXG4gIHZhciBpb3MgPSAvQXBwbGVXZWJLaXQvLnRlc3QodXNlckFnZW50KSAmJiAvTW9iaWxlXFwvXFx3Ky8udGVzdCh1c2VyQWdlbnQpO1xuICAvLyBUaGlzIGlzIHdvZWZ1bGx5IGluY29tcGxldGUuIFN1Z2dlc3Rpb25zIGZvciBhbHRlcm5hdGl2ZSBtZXRob2RzIHdlbGNvbWUuXG4gIHZhciBtb2JpbGUgPSBpb3MgfHwgL0FuZHJvaWR8d2ViT1N8QmxhY2tCZXJyeXxPcGVyYSBNaW5pfE9wZXJhIE1vYml8SUVNb2JpbGUvaS50ZXN0KHVzZXJBZ2VudCk7XG4gIHZhciBtYWMgPSBpb3MgfHwgL01hYy8udGVzdChwbGF0Zm9ybSk7XG4gIHZhciB3aW5kb3dzID0gL3dpbi9pLnRlc3QocGxhdGZvcm0pO1xuXG4gIHZhciBwcmVzdG9fdmVyc2lvbiA9IHByZXN0byAmJiB1c2VyQWdlbnQubWF0Y2goL1ZlcnNpb25cXC8oXFxkKlxcLlxcZCopLyk7XG4gIGlmIChwcmVzdG9fdmVyc2lvbikgcHJlc3RvX3ZlcnNpb24gPSBOdW1iZXIocHJlc3RvX3ZlcnNpb25bMV0pO1xuICBpZiAocHJlc3RvX3ZlcnNpb24gJiYgcHJlc3RvX3ZlcnNpb24gPj0gMTUpIHsgcHJlc3RvID0gZmFsc2U7IHdlYmtpdCA9IHRydWU7IH1cbiAgLy8gU29tZSBicm93c2VycyB1c2UgdGhlIHdyb25nIGV2ZW50IHByb3BlcnRpZXMgdG8gc2lnbmFsIGNtZC9jdHJsIG9uIE9TIFhcbiAgdmFyIGZsaXBDdHJsQ21kID0gbWFjICYmIChxdHdlYmtpdCB8fCBwcmVzdG8gJiYgKHByZXN0b192ZXJzaW9uID09IG51bGwgfHwgcHJlc3RvX3ZlcnNpb24gPCAxMi4xMSkpO1xuICB2YXIgY2FwdHVyZVJpZ2h0Q2xpY2sgPSBnZWNrbyB8fCAoaWUgJiYgaWVfdmVyc2lvbiA+PSA5KTtcblxuICAvLyBPcHRpbWl6ZSBzb21lIGNvZGUgd2hlbiB0aGVzZSBmZWF0dXJlcyBhcmUgbm90IHVzZWQuXG4gIHZhciBzYXdSZWFkT25seVNwYW5zID0gZmFsc2UsIHNhd0NvbGxhcHNlZFNwYW5zID0gZmFsc2U7XG5cbiAgLy8gRURJVE9SIENPTlNUUlVDVE9SXG5cbiAgLy8gQSBDb2RlTWlycm9yIGluc3RhbmNlIHJlcHJlc2VudHMgYW4gZWRpdG9yLiBUaGlzIGlzIHRoZSBvYmplY3RcbiAgLy8gdGhhdCB1c2VyIGNvZGUgaXMgdXN1YWxseSBkZWFsaW5nIHdpdGguXG5cbiAgZnVuY3Rpb24gQ29kZU1pcnJvcihwbGFjZSwgb3B0aW9ucykge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDb2RlTWlycm9yKSkgcmV0dXJuIG5ldyBDb2RlTWlycm9yKHBsYWNlLCBvcHRpb25zKTtcblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgPSBvcHRpb25zID8gY29weU9iaihvcHRpb25zKSA6IHt9O1xuICAgIC8vIERldGVybWluZSBlZmZlY3RpdmUgb3B0aW9ucyBiYXNlZCBvbiBnaXZlbiB2YWx1ZXMgYW5kIGRlZmF1bHRzLlxuICAgIGNvcHlPYmooZGVmYXVsdHMsIG9wdGlvbnMsIGZhbHNlKTtcbiAgICBzZXRHdXR0ZXJzRm9yTGluZU51bWJlcnMob3B0aW9ucyk7XG5cbiAgICB2YXIgZG9jID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAodHlwZW9mIGRvYyA9PSBcInN0cmluZ1wiKSBkb2MgPSBuZXcgRG9jKGRvYywgb3B0aW9ucy5tb2RlLCBudWxsLCBvcHRpb25zLmxpbmVTZXBhcmF0b3IpO1xuICAgIHRoaXMuZG9jID0gZG9jO1xuXG4gICAgdmFyIGlucHV0ID0gbmV3IENvZGVNaXJyb3IuaW5wdXRTdHlsZXNbb3B0aW9ucy5pbnB1dFN0eWxlXSh0aGlzKTtcbiAgICB2YXIgZGlzcGxheSA9IHRoaXMuZGlzcGxheSA9IG5ldyBEaXNwbGF5KHBsYWNlLCBkb2MsIGlucHV0KTtcbiAgICBkaXNwbGF5LndyYXBwZXIuQ29kZU1pcnJvciA9IHRoaXM7XG4gICAgdXBkYXRlR3V0dGVycyh0aGlzKTtcbiAgICB0aGVtZUNoYW5nZWQodGhpcyk7XG4gICAgaWYgKG9wdGlvbnMubGluZVdyYXBwaW5nKVxuICAgICAgdGhpcy5kaXNwbGF5LndyYXBwZXIuY2xhc3NOYW1lICs9IFwiIENvZGVNaXJyb3Itd3JhcFwiO1xuICAgIGlmIChvcHRpb25zLmF1dG9mb2N1cyAmJiAhbW9iaWxlKSBkaXNwbGF5LmlucHV0LmZvY3VzKCk7XG4gICAgaW5pdFNjcm9sbGJhcnModGhpcyk7XG5cbiAgICB0aGlzLnN0YXRlID0ge1xuICAgICAga2V5TWFwczogW10sICAvLyBzdG9yZXMgbWFwcyBhZGRlZCBieSBhZGRLZXlNYXBcbiAgICAgIG92ZXJsYXlzOiBbXSwgLy8gaGlnaGxpZ2h0aW5nIG92ZXJsYXlzLCBhcyBhZGRlZCBieSBhZGRPdmVybGF5XG4gICAgICBtb2RlR2VuOiAwLCAgIC8vIGJ1bXBlZCB3aGVuIG1vZGUvb3ZlcmxheSBjaGFuZ2VzLCB1c2VkIHRvIGludmFsaWRhdGUgaGlnaGxpZ2h0aW5nIGluZm9cbiAgICAgIG92ZXJ3cml0ZTogZmFsc2UsXG4gICAgICBkZWxheWluZ0JsdXJFdmVudDogZmFsc2UsXG4gICAgICBmb2N1c2VkOiBmYWxzZSxcbiAgICAgIHN1cHByZXNzRWRpdHM6IGZhbHNlLCAvLyB1c2VkIHRvIGRpc2FibGUgZWRpdGluZyBkdXJpbmcga2V5IGhhbmRsZXJzIHdoZW4gaW4gcmVhZE9ubHkgbW9kZVxuICAgICAgcGFzdGVJbmNvbWluZzogZmFsc2UsIGN1dEluY29taW5nOiBmYWxzZSwgLy8gaGVscCByZWNvZ25pemUgcGFzdGUvY3V0IGVkaXRzIGluIGlucHV0LnBvbGxcbiAgICAgIHNlbGVjdGluZ1RleHQ6IGZhbHNlLFxuICAgICAgZHJhZ2dpbmdUZXh0OiBmYWxzZSxcbiAgICAgIGhpZ2hsaWdodDogbmV3IERlbGF5ZWQoKSwgLy8gc3RvcmVzIGhpZ2hsaWdodCB3b3JrZXIgdGltZW91dFxuICAgICAga2V5U2VxOiBudWxsLCAgLy8gVW5maW5pc2hlZCBrZXkgc2VxdWVuY2VcbiAgICAgIHNwZWNpYWxDaGFyczogbnVsbFxuICAgIH07XG5cbiAgICB2YXIgY20gPSB0aGlzO1xuXG4gICAgLy8gT3ZlcnJpZGUgbWFnaWMgdGV4dGFyZWEgY29udGVudCByZXN0b3JlIHRoYXQgSUUgc29tZXRpbWVzIGRvZXNcbiAgICAvLyBvbiBvdXIgaGlkZGVuIHRleHRhcmVhIG9uIHJlbG9hZFxuICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgMTEpIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGNtLmRpc3BsYXkuaW5wdXQucmVzZXQodHJ1ZSk7IH0sIDIwKTtcblxuICAgIHJlZ2lzdGVyRXZlbnRIYW5kbGVycyh0aGlzKTtcbiAgICBlbnN1cmVHbG9iYWxIYW5kbGVycygpO1xuXG4gICAgc3RhcnRPcGVyYXRpb24odGhpcyk7XG4gICAgdGhpcy5jdXJPcC5mb3JjZVVwZGF0ZSA9IHRydWU7XG4gICAgYXR0YWNoRG9jKHRoaXMsIGRvYyk7XG5cbiAgICBpZiAoKG9wdGlvbnMuYXV0b2ZvY3VzICYmICFtb2JpbGUpIHx8IGNtLmhhc0ZvY3VzKCkpXG4gICAgICBzZXRUaW1lb3V0KGJpbmQob25Gb2N1cywgdGhpcyksIDIwKTtcbiAgICBlbHNlXG4gICAgICBvbkJsdXIodGhpcyk7XG5cbiAgICBmb3IgKHZhciBvcHQgaW4gb3B0aW9uSGFuZGxlcnMpIGlmIChvcHRpb25IYW5kbGVycy5oYXNPd25Qcm9wZXJ0eShvcHQpKVxuICAgICAgb3B0aW9uSGFuZGxlcnNbb3B0XSh0aGlzLCBvcHRpb25zW29wdF0sIEluaXQpO1xuICAgIG1heWJlVXBkYXRlTGluZU51bWJlcldpZHRoKHRoaXMpO1xuICAgIGlmIChvcHRpb25zLmZpbmlzaEluaXQpIG9wdGlvbnMuZmluaXNoSW5pdCh0aGlzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRIb29rcy5sZW5ndGg7ICsraSkgaW5pdEhvb2tzW2ldKHRoaXMpO1xuICAgIGVuZE9wZXJhdGlvbih0aGlzKTtcbiAgICAvLyBTdXBwcmVzcyBvcHRpbWl6ZWxlZ2liaWxpdHkgaW4gV2Via2l0LCBzaW5jZSBpdCBicmVha3MgdGV4dFxuICAgIC8vIG1lYXN1cmluZyBvbiBsaW5lIHdyYXBwaW5nIGJvdW5kYXJpZXMuXG4gICAgaWYgKHdlYmtpdCAmJiBvcHRpb25zLmxpbmVXcmFwcGluZyAmJlxuICAgICAgICBnZXRDb21wdXRlZFN0eWxlKGRpc3BsYXkubGluZURpdikudGV4dFJlbmRlcmluZyA9PSBcIm9wdGltaXplbGVnaWJpbGl0eVwiKVxuICAgICAgZGlzcGxheS5saW5lRGl2LnN0eWxlLnRleHRSZW5kZXJpbmcgPSBcImF1dG9cIjtcbiAgfVxuXG4gIC8vIERJU1BMQVkgQ09OU1RSVUNUT1JcblxuICAvLyBUaGUgZGlzcGxheSBoYW5kbGVzIHRoZSBET00gaW50ZWdyYXRpb24sIGJvdGggZm9yIGlucHV0IHJlYWRpbmdcbiAgLy8gYW5kIGNvbnRlbnQgZHJhd2luZy4gSXQgaG9sZHMgcmVmZXJlbmNlcyB0byBET00gbm9kZXMgYW5kXG4gIC8vIGRpc3BsYXktcmVsYXRlZCBzdGF0ZS5cblxuICBmdW5jdGlvbiBEaXNwbGF5KHBsYWNlLCBkb2MsIGlucHV0KSB7XG4gICAgdmFyIGQgPSB0aGlzO1xuICAgIHRoaXMuaW5wdXQgPSBpbnB1dDtcblxuICAgIC8vIENvdmVycyBib3R0b20tcmlnaHQgc3F1YXJlIHdoZW4gYm90aCBzY3JvbGxiYXJzIGFyZSBwcmVzZW50LlxuICAgIGQuc2Nyb2xsYmFyRmlsbGVyID0gZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1zY3JvbGxiYXItZmlsbGVyXCIpO1xuICAgIGQuc2Nyb2xsYmFyRmlsbGVyLnNldEF0dHJpYnV0ZShcImNtLW5vdC1jb250ZW50XCIsIFwidHJ1ZVwiKTtcbiAgICAvLyBDb3ZlcnMgYm90dG9tIG9mIGd1dHRlciB3aGVuIGNvdmVyR3V0dGVyTmV4dFRvU2Nyb2xsYmFyIGlzIG9uXG4gICAgLy8gYW5kIGggc2Nyb2xsYmFyIGlzIHByZXNlbnQuXG4gICAgZC5ndXR0ZXJGaWxsZXIgPSBlbHQoXCJkaXZcIiwgbnVsbCwgXCJDb2RlTWlycm9yLWd1dHRlci1maWxsZXJcIik7XG4gICAgZC5ndXR0ZXJGaWxsZXIuc2V0QXR0cmlidXRlKFwiY20tbm90LWNvbnRlbnRcIiwgXCJ0cnVlXCIpO1xuICAgIC8vIFdpbGwgY29udGFpbiB0aGUgYWN0dWFsIGNvZGUsIHBvc2l0aW9uZWQgdG8gY292ZXIgdGhlIHZpZXdwb3J0LlxuICAgIGQubGluZURpdiA9IGVsdChcImRpdlwiLCBudWxsLCBcIkNvZGVNaXJyb3ItY29kZVwiKTtcbiAgICAvLyBFbGVtZW50cyBhcmUgYWRkZWQgdG8gdGhlc2UgdG8gcmVwcmVzZW50IHNlbGVjdGlvbiBhbmQgY3Vyc29ycy5cbiAgICBkLnNlbGVjdGlvbkRpdiA9IGVsdChcImRpdlwiLCBudWxsLCBudWxsLCBcInBvc2l0aW9uOiByZWxhdGl2ZTsgei1pbmRleDogMVwiKTtcbiAgICBkLmN1cnNvckRpdiA9IGVsdChcImRpdlwiLCBudWxsLCBcIkNvZGVNaXJyb3ItY3Vyc29yc1wiKTtcbiAgICAvLyBBIHZpc2liaWxpdHk6IGhpZGRlbiBlbGVtZW50IHVzZWQgdG8gZmluZCB0aGUgc2l6ZSBvZiB0aGluZ3MuXG4gICAgZC5tZWFzdXJlID0gZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1tZWFzdXJlXCIpO1xuICAgIC8vIFdoZW4gbGluZXMgb3V0c2lkZSBvZiB0aGUgdmlld3BvcnQgYXJlIG1lYXN1cmVkLCB0aGV5IGFyZSBkcmF3biBpbiB0aGlzLlxuICAgIGQubGluZU1lYXN1cmUgPSBlbHQoXCJkaXZcIiwgbnVsbCwgXCJDb2RlTWlycm9yLW1lYXN1cmVcIik7XG4gICAgLy8gV3JhcHMgZXZlcnl0aGluZyB0aGF0IG5lZWRzIHRvIGV4aXN0IGluc2lkZSB0aGUgdmVydGljYWxseS1wYWRkZWQgY29vcmRpbmF0ZSBzeXN0ZW1cbiAgICBkLmxpbmVTcGFjZSA9IGVsdChcImRpdlwiLCBbZC5tZWFzdXJlLCBkLmxpbmVNZWFzdXJlLCBkLnNlbGVjdGlvbkRpdiwgZC5jdXJzb3JEaXYsIGQubGluZURpdl0sXG4gICAgICAgICAgICAgICAgICAgICAgbnVsbCwgXCJwb3NpdGlvbjogcmVsYXRpdmU7IG91dGxpbmU6IG5vbmVcIik7XG4gICAgLy8gTW92ZWQgYXJvdW5kIGl0cyBwYXJlbnQgdG8gY292ZXIgdmlzaWJsZSB2aWV3LlxuICAgIGQubW92ZXIgPSBlbHQoXCJkaXZcIiwgW2VsdChcImRpdlwiLCBbZC5saW5lU3BhY2VdLCBcIkNvZGVNaXJyb3ItbGluZXNcIildLCBudWxsLCBcInBvc2l0aW9uOiByZWxhdGl2ZVwiKTtcbiAgICAvLyBTZXQgdG8gdGhlIGhlaWdodCBvZiB0aGUgZG9jdW1lbnQsIGFsbG93aW5nIHNjcm9sbGluZy5cbiAgICBkLnNpemVyID0gZWx0KFwiZGl2XCIsIFtkLm1vdmVyXSwgXCJDb2RlTWlycm9yLXNpemVyXCIpO1xuICAgIGQuc2l6ZXJXaWR0aCA9IG51bGw7XG4gICAgLy8gQmVoYXZpb3Igb2YgZWx0cyB3aXRoIG92ZXJmbG93OiBhdXRvIGFuZCBwYWRkaW5nIGlzXG4gICAgLy8gaW5jb25zaXN0ZW50IGFjcm9zcyBicm93c2Vycy4gVGhpcyBpcyB1c2VkIHRvIGVuc3VyZSB0aGVcbiAgICAvLyBzY3JvbGxhYmxlIGFyZWEgaXMgYmlnIGVub3VnaC5cbiAgICBkLmhlaWdodEZvcmNlciA9IGVsdChcImRpdlwiLCBudWxsLCBudWxsLCBcInBvc2l0aW9uOiBhYnNvbHV0ZTsgaGVpZ2h0OiBcIiArIHNjcm9sbGVyR2FwICsgXCJweDsgd2lkdGg6IDFweDtcIik7XG4gICAgLy8gV2lsbCBjb250YWluIHRoZSBndXR0ZXJzLCBpZiBhbnkuXG4gICAgZC5ndXR0ZXJzID0gZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1ndXR0ZXJzXCIpO1xuICAgIGQubGluZUd1dHRlciA9IG51bGw7XG4gICAgLy8gQWN0dWFsIHNjcm9sbGFibGUgZWxlbWVudC5cbiAgICBkLnNjcm9sbGVyID0gZWx0KFwiZGl2XCIsIFtkLnNpemVyLCBkLmhlaWdodEZvcmNlciwgZC5ndXR0ZXJzXSwgXCJDb2RlTWlycm9yLXNjcm9sbFwiKTtcbiAgICBkLnNjcm9sbGVyLnNldEF0dHJpYnV0ZShcInRhYkluZGV4XCIsIFwiLTFcIik7XG4gICAgLy8gVGhlIGVsZW1lbnQgaW4gd2hpY2ggdGhlIGVkaXRvciBsaXZlcy5cbiAgICBkLndyYXBwZXIgPSBlbHQoXCJkaXZcIiwgW2Quc2Nyb2xsYmFyRmlsbGVyLCBkLmd1dHRlckZpbGxlciwgZC5zY3JvbGxlcl0sIFwiQ29kZU1pcnJvclwiKTtcblxuICAgIC8vIFdvcmsgYXJvdW5kIElFNyB6LWluZGV4IGJ1ZyAobm90IHBlcmZlY3QsIGhlbmNlIElFNyBub3QgcmVhbGx5IGJlaW5nIHN1cHBvcnRlZClcbiAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDgpIHsgZC5ndXR0ZXJzLnN0eWxlLnpJbmRleCA9IC0xOyBkLnNjcm9sbGVyLnN0eWxlLnBhZGRpbmdSaWdodCA9IDA7IH1cbiAgICBpZiAoIXdlYmtpdCAmJiAhKGdlY2tvICYmIG1vYmlsZSkpIGQuc2Nyb2xsZXIuZHJhZ2dhYmxlID0gdHJ1ZTtcblxuICAgIGlmIChwbGFjZSkge1xuICAgICAgaWYgKHBsYWNlLmFwcGVuZENoaWxkKSBwbGFjZS5hcHBlbmRDaGlsZChkLndyYXBwZXIpO1xuICAgICAgZWxzZSBwbGFjZShkLndyYXBwZXIpO1xuICAgIH1cblxuICAgIC8vIEN1cnJlbnQgcmVuZGVyZWQgcmFuZ2UgKG1heSBiZSBiaWdnZXIgdGhhbiB0aGUgdmlldyB3aW5kb3cpLlxuICAgIGQudmlld0Zyb20gPSBkLnZpZXdUbyA9IGRvYy5maXJzdDtcbiAgICBkLnJlcG9ydGVkVmlld0Zyb20gPSBkLnJlcG9ydGVkVmlld1RvID0gZG9jLmZpcnN0O1xuICAgIC8vIEluZm9ybWF0aW9uIGFib3V0IHRoZSByZW5kZXJlZCBsaW5lcy5cbiAgICBkLnZpZXcgPSBbXTtcbiAgICBkLnJlbmRlcmVkVmlldyA9IG51bGw7XG4gICAgLy8gSG9sZHMgaW5mbyBhYm91dCBhIHNpbmdsZSByZW5kZXJlZCBsaW5lIHdoZW4gaXQgd2FzIHJlbmRlcmVkXG4gICAgLy8gZm9yIG1lYXN1cmVtZW50LCB3aGlsZSBub3QgaW4gdmlldy5cbiAgICBkLmV4dGVybmFsTWVhc3VyZWQgPSBudWxsO1xuICAgIC8vIEVtcHR5IHNwYWNlIChpbiBwaXhlbHMpIGFib3ZlIHRoZSB2aWV3XG4gICAgZC52aWV3T2Zmc2V0ID0gMDtcbiAgICBkLmxhc3RXcmFwSGVpZ2h0ID0gZC5sYXN0V3JhcFdpZHRoID0gMDtcbiAgICBkLnVwZGF0ZUxpbmVOdW1iZXJzID0gbnVsbDtcblxuICAgIGQubmF0aXZlQmFyV2lkdGggPSBkLmJhckhlaWdodCA9IGQuYmFyV2lkdGggPSAwO1xuICAgIGQuc2Nyb2xsYmFyc0NsaXBwZWQgPSBmYWxzZTtcblxuICAgIC8vIFVzZWQgdG8gb25seSByZXNpemUgdGhlIGxpbmUgbnVtYmVyIGd1dHRlciB3aGVuIG5lY2Vzc2FyeSAod2hlblxuICAgIC8vIHRoZSBhbW91bnQgb2YgbGluZXMgY3Jvc3NlcyBhIGJvdW5kYXJ5IHRoYXQgbWFrZXMgaXRzIHdpZHRoIGNoYW5nZSlcbiAgICBkLmxpbmVOdW1XaWR0aCA9IGQubGluZU51bUlubmVyV2lkdGggPSBkLmxpbmVOdW1DaGFycyA9IG51bGw7XG4gICAgLy8gU2V0IHRvIHRydWUgd2hlbiBhIG5vbi1ob3Jpem9udGFsLXNjcm9sbGluZyBsaW5lIHdpZGdldCBpc1xuICAgIC8vIGFkZGVkLiBBcyBhbiBvcHRpbWl6YXRpb24sIGxpbmUgd2lkZ2V0IGFsaWduaW5nIGlzIHNraXBwZWQgd2hlblxuICAgIC8vIHRoaXMgaXMgZmFsc2UuXG4gICAgZC5hbGlnbldpZGdldHMgPSBmYWxzZTtcblxuICAgIGQuY2FjaGVkQ2hhcldpZHRoID0gZC5jYWNoZWRUZXh0SGVpZ2h0ID0gZC5jYWNoZWRQYWRkaW5nSCA9IG51bGw7XG5cbiAgICAvLyBUcmFja3MgdGhlIG1heGltdW0gbGluZSBsZW5ndGggc28gdGhhdCB0aGUgaG9yaXpvbnRhbCBzY3JvbGxiYXJcbiAgICAvLyBjYW4gYmUga2VwdCBzdGF0aWMgd2hlbiBzY3JvbGxpbmcuXG4gICAgZC5tYXhMaW5lID0gbnVsbDtcbiAgICBkLm1heExpbmVMZW5ndGggPSAwO1xuICAgIGQubWF4TGluZUNoYW5nZWQgPSBmYWxzZTtcblxuICAgIC8vIFVzZWQgZm9yIG1lYXN1cmluZyB3aGVlbCBzY3JvbGxpbmcgZ3JhbnVsYXJpdHlcbiAgICBkLndoZWVsRFggPSBkLndoZWVsRFkgPSBkLndoZWVsU3RhcnRYID0gZC53aGVlbFN0YXJ0WSA9IG51bGw7XG5cbiAgICAvLyBUcnVlIHdoZW4gc2hpZnQgaXMgaGVsZCBkb3duLlxuICAgIGQuc2hpZnQgPSBmYWxzZTtcblxuICAgIC8vIFVzZWQgdG8gdHJhY2sgd2hldGhlciBhbnl0aGluZyBoYXBwZW5lZCBzaW5jZSB0aGUgY29udGV4dCBtZW51XG4gICAgLy8gd2FzIG9wZW5lZC5cbiAgICBkLnNlbEZvckNvbnRleHRNZW51ID0gbnVsbDtcblxuICAgIGQuYWN0aXZlVG91Y2ggPSBudWxsO1xuXG4gICAgaW5wdXQuaW5pdChkKTtcbiAgfVxuXG4gIC8vIFNUQVRFIFVQREFURVNcblxuICAvLyBVc2VkIHRvIGdldCB0aGUgZWRpdG9yIGludG8gYSBjb25zaXN0ZW50IHN0YXRlIGFnYWluIHdoZW4gb3B0aW9ucyBjaGFuZ2UuXG5cbiAgZnVuY3Rpb24gbG9hZE1vZGUoY20pIHtcbiAgICBjbS5kb2MubW9kZSA9IENvZGVNaXJyb3IuZ2V0TW9kZShjbS5vcHRpb25zLCBjbS5kb2MubW9kZU9wdGlvbik7XG4gICAgcmVzZXRNb2RlU3RhdGUoY20pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVzZXRNb2RlU3RhdGUoY20pIHtcbiAgICBjbS5kb2MuaXRlcihmdW5jdGlvbihsaW5lKSB7XG4gICAgICBpZiAobGluZS5zdGF0ZUFmdGVyKSBsaW5lLnN0YXRlQWZ0ZXIgPSBudWxsO1xuICAgICAgaWYgKGxpbmUuc3R5bGVzKSBsaW5lLnN0eWxlcyA9IG51bGw7XG4gICAgfSk7XG4gICAgY20uZG9jLmZyb250aWVyID0gY20uZG9jLmZpcnN0O1xuICAgIHN0YXJ0V29ya2VyKGNtLCAxMDApO1xuICAgIGNtLnN0YXRlLm1vZGVHZW4rKztcbiAgICBpZiAoY20uY3VyT3ApIHJlZ0NoYW5nZShjbSk7XG4gIH1cblxuICBmdW5jdGlvbiB3cmFwcGluZ0NoYW5nZWQoY20pIHtcbiAgICBpZiAoY20ub3B0aW9ucy5saW5lV3JhcHBpbmcpIHtcbiAgICAgIGFkZENsYXNzKGNtLmRpc3BsYXkud3JhcHBlciwgXCJDb2RlTWlycm9yLXdyYXBcIik7XG4gICAgICBjbS5kaXNwbGF5LnNpemVyLnN0eWxlLm1pbldpZHRoID0gXCJcIjtcbiAgICAgIGNtLmRpc3BsYXkuc2l6ZXJXaWR0aCA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJtQ2xhc3MoY20uZGlzcGxheS53cmFwcGVyLCBcIkNvZGVNaXJyb3Itd3JhcFwiKTtcbiAgICAgIGZpbmRNYXhMaW5lKGNtKTtcbiAgICB9XG4gICAgZXN0aW1hdGVMaW5lSGVpZ2h0cyhjbSk7XG4gICAgcmVnQ2hhbmdlKGNtKTtcbiAgICBjbGVhckNhY2hlcyhjbSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe3VwZGF0ZVNjcm9sbGJhcnMoY20pO30sIDEwMCk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBlc3RpbWF0ZXMgdGhlIGhlaWdodCBvZiBhIGxpbmUsIHRvIHVzZSBhc1xuICAvLyBmaXJzdCBhcHByb3hpbWF0aW9uIHVudGlsIHRoZSBsaW5lIGJlY29tZXMgdmlzaWJsZSAoYW5kIGlzIHRodXNcbiAgLy8gcHJvcGVybHkgbWVhc3VyYWJsZSkuXG4gIGZ1bmN0aW9uIGVzdGltYXRlSGVpZ2h0KGNtKSB7XG4gICAgdmFyIHRoID0gdGV4dEhlaWdodChjbS5kaXNwbGF5KSwgd3JhcHBpbmcgPSBjbS5vcHRpb25zLmxpbmVXcmFwcGluZztcbiAgICB2YXIgcGVyTGluZSA9IHdyYXBwaW5nICYmIE1hdGgubWF4KDUsIGNtLmRpc3BsYXkuc2Nyb2xsZXIuY2xpZW50V2lkdGggLyBjaGFyV2lkdGgoY20uZGlzcGxheSkgLSAzKTtcbiAgICByZXR1cm4gZnVuY3Rpb24obGluZSkge1xuICAgICAgaWYgKGxpbmVJc0hpZGRlbihjbS5kb2MsIGxpbmUpKSByZXR1cm4gMDtcblxuICAgICAgdmFyIHdpZGdldHNIZWlnaHQgPSAwO1xuICAgICAgaWYgKGxpbmUud2lkZ2V0cykgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lLndpZGdldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGxpbmUud2lkZ2V0c1tpXS5oZWlnaHQpIHdpZGdldHNIZWlnaHQgKz0gbGluZS53aWRnZXRzW2ldLmhlaWdodDtcbiAgICAgIH1cblxuICAgICAgaWYgKHdyYXBwaW5nKVxuICAgICAgICByZXR1cm4gd2lkZ2V0c0hlaWdodCArIChNYXRoLmNlaWwobGluZS50ZXh0Lmxlbmd0aCAvIHBlckxpbmUpIHx8IDEpICogdGg7XG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiB3aWRnZXRzSGVpZ2h0ICsgdGg7XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVzdGltYXRlTGluZUhlaWdodHMoY20pIHtcbiAgICB2YXIgZG9jID0gY20uZG9jLCBlc3QgPSBlc3RpbWF0ZUhlaWdodChjbSk7XG4gICAgZG9jLml0ZXIoZnVuY3Rpb24obGluZSkge1xuICAgICAgdmFyIGVzdEhlaWdodCA9IGVzdChsaW5lKTtcbiAgICAgIGlmIChlc3RIZWlnaHQgIT0gbGluZS5oZWlnaHQpIHVwZGF0ZUxpbmVIZWlnaHQobGluZSwgZXN0SGVpZ2h0KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRoZW1lQ2hhbmdlZChjbSkge1xuICAgIGNtLmRpc3BsYXkud3JhcHBlci5jbGFzc05hbWUgPSBjbS5kaXNwbGF5LndyYXBwZXIuY2xhc3NOYW1lLnJlcGxhY2UoL1xccypjbS1zLVxcUysvZywgXCJcIikgK1xuICAgICAgY20ub3B0aW9ucy50aGVtZS5yZXBsYWNlKC8oXnxcXHMpXFxzKi9nLCBcIiBjbS1zLVwiKTtcbiAgICBjbGVhckNhY2hlcyhjbSk7XG4gIH1cblxuICBmdW5jdGlvbiBndXR0ZXJzQ2hhbmdlZChjbSkge1xuICAgIHVwZGF0ZUd1dHRlcnMoY20pO1xuICAgIHJlZ0NoYW5nZShjbSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe2FsaWduSG9yaXpvbnRhbGx5KGNtKTt9LCAyMCk7XG4gIH1cblxuICAvLyBSZWJ1aWxkIHRoZSBndXR0ZXIgZWxlbWVudHMsIGVuc3VyZSB0aGUgbWFyZ2luIHRvIHRoZSBsZWZ0IG9mIHRoZVxuICAvLyBjb2RlIG1hdGNoZXMgdGhlaXIgd2lkdGguXG4gIGZ1bmN0aW9uIHVwZGF0ZUd1dHRlcnMoY20pIHtcbiAgICB2YXIgZ3V0dGVycyA9IGNtLmRpc3BsYXkuZ3V0dGVycywgc3BlY3MgPSBjbS5vcHRpb25zLmd1dHRlcnM7XG4gICAgcmVtb3ZlQ2hpbGRyZW4oZ3V0dGVycyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGVjcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGd1dHRlckNsYXNzID0gc3BlY3NbaV07XG4gICAgICB2YXIgZ0VsdCA9IGd1dHRlcnMuYXBwZW5kQ2hpbGQoZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1ndXR0ZXIgXCIgKyBndXR0ZXJDbGFzcykpO1xuICAgICAgaWYgKGd1dHRlckNsYXNzID09IFwiQ29kZU1pcnJvci1saW5lbnVtYmVyc1wiKSB7XG4gICAgICAgIGNtLmRpc3BsYXkubGluZUd1dHRlciA9IGdFbHQ7XG4gICAgICAgIGdFbHQuc3R5bGUud2lkdGggPSAoY20uZGlzcGxheS5saW5lTnVtV2lkdGggfHwgMSkgKyBcInB4XCI7XG4gICAgICB9XG4gICAgfVxuICAgIGd1dHRlcnMuc3R5bGUuZGlzcGxheSA9IGkgPyBcIlwiIDogXCJub25lXCI7XG4gICAgdXBkYXRlR3V0dGVyU3BhY2UoY20pO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlR3V0dGVyU3BhY2UoY20pIHtcbiAgICB2YXIgd2lkdGggPSBjbS5kaXNwbGF5Lmd1dHRlcnMub2Zmc2V0V2lkdGg7XG4gICAgY20uZGlzcGxheS5zaXplci5zdHlsZS5tYXJnaW5MZWZ0ID0gd2lkdGggKyBcInB4XCI7XG4gIH1cblxuICAvLyBDb21wdXRlIHRoZSBjaGFyYWN0ZXIgbGVuZ3RoIG9mIGEgbGluZSwgdGFraW5nIGludG8gYWNjb3VudFxuICAvLyBjb2xsYXBzZWQgcmFuZ2VzIChzZWUgbWFya1RleHQpIHRoYXQgbWlnaHQgaGlkZSBwYXJ0cywgYW5kIGpvaW5cbiAgLy8gb3RoZXIgbGluZXMgb250byBpdC5cbiAgZnVuY3Rpb24gbGluZUxlbmd0aChsaW5lKSB7XG4gICAgaWYgKGxpbmUuaGVpZ2h0ID09IDApIHJldHVybiAwO1xuICAgIHZhciBsZW4gPSBsaW5lLnRleHQubGVuZ3RoLCBtZXJnZWQsIGN1ciA9IGxpbmU7XG4gICAgd2hpbGUgKG1lcmdlZCA9IGNvbGxhcHNlZFNwYW5BdFN0YXJ0KGN1cikpIHtcbiAgICAgIHZhciBmb3VuZCA9IG1lcmdlZC5maW5kKDAsIHRydWUpO1xuICAgICAgY3VyID0gZm91bmQuZnJvbS5saW5lO1xuICAgICAgbGVuICs9IGZvdW5kLmZyb20uY2ggLSBmb3VuZC50by5jaDtcbiAgICB9XG4gICAgY3VyID0gbGluZTtcbiAgICB3aGlsZSAobWVyZ2VkID0gY29sbGFwc2VkU3BhbkF0RW5kKGN1cikpIHtcbiAgICAgIHZhciBmb3VuZCA9IG1lcmdlZC5maW5kKDAsIHRydWUpO1xuICAgICAgbGVuIC09IGN1ci50ZXh0Lmxlbmd0aCAtIGZvdW5kLmZyb20uY2g7XG4gICAgICBjdXIgPSBmb3VuZC50by5saW5lO1xuICAgICAgbGVuICs9IGN1ci50ZXh0Lmxlbmd0aCAtIGZvdW5kLnRvLmNoO1xuICAgIH1cbiAgICByZXR1cm4gbGVuO1xuICB9XG5cbiAgLy8gRmluZCB0aGUgbG9uZ2VzdCBsaW5lIGluIHRoZSBkb2N1bWVudC5cbiAgZnVuY3Rpb24gZmluZE1heExpbmUoY20pIHtcbiAgICB2YXIgZCA9IGNtLmRpc3BsYXksIGRvYyA9IGNtLmRvYztcbiAgICBkLm1heExpbmUgPSBnZXRMaW5lKGRvYywgZG9jLmZpcnN0KTtcbiAgICBkLm1heExpbmVMZW5ndGggPSBsaW5lTGVuZ3RoKGQubWF4TGluZSk7XG4gICAgZC5tYXhMaW5lQ2hhbmdlZCA9IHRydWU7XG4gICAgZG9jLml0ZXIoZnVuY3Rpb24obGluZSkge1xuICAgICAgdmFyIGxlbiA9IGxpbmVMZW5ndGgobGluZSk7XG4gICAgICBpZiAobGVuID4gZC5tYXhMaW5lTGVuZ3RoKSB7XG4gICAgICAgIGQubWF4TGluZUxlbmd0aCA9IGxlbjtcbiAgICAgICAgZC5tYXhMaW5lID0gbGluZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIE1ha2Ugc3VyZSB0aGUgZ3V0dGVycyBvcHRpb25zIGNvbnRhaW5zIHRoZSBlbGVtZW50XG4gIC8vIFwiQ29kZU1pcnJvci1saW5lbnVtYmVyc1wiIHdoZW4gdGhlIGxpbmVOdW1iZXJzIG9wdGlvbiBpcyB0cnVlLlxuICBmdW5jdGlvbiBzZXRHdXR0ZXJzRm9yTGluZU51bWJlcnMob3B0aW9ucykge1xuICAgIHZhciBmb3VuZCA9IGluZGV4T2Yob3B0aW9ucy5ndXR0ZXJzLCBcIkNvZGVNaXJyb3ItbGluZW51bWJlcnNcIik7XG4gICAgaWYgKGZvdW5kID09IC0xICYmIG9wdGlvbnMubGluZU51bWJlcnMpIHtcbiAgICAgIG9wdGlvbnMuZ3V0dGVycyA9IG9wdGlvbnMuZ3V0dGVycy5jb25jYXQoW1wiQ29kZU1pcnJvci1saW5lbnVtYmVyc1wiXSk7XG4gICAgfSBlbHNlIGlmIChmb3VuZCA+IC0xICYmICFvcHRpb25zLmxpbmVOdW1iZXJzKSB7XG4gICAgICBvcHRpb25zLmd1dHRlcnMgPSBvcHRpb25zLmd1dHRlcnMuc2xpY2UoMCk7XG4gICAgICBvcHRpb25zLmd1dHRlcnMuc3BsaWNlKGZvdW5kLCAxKTtcbiAgICB9XG4gIH1cblxuICAvLyBTQ1JPTExCQVJTXG5cbiAgLy8gUHJlcGFyZSBET00gcmVhZHMgbmVlZGVkIHRvIHVwZGF0ZSB0aGUgc2Nyb2xsYmFycy4gRG9uZSBpbiBvbmVcbiAgLy8gc2hvdCB0byBtaW5pbWl6ZSB1cGRhdGUvbWVhc3VyZSByb3VuZHRyaXBzLlxuICBmdW5jdGlvbiBtZWFzdXJlRm9yU2Nyb2xsYmFycyhjbSkge1xuICAgIHZhciBkID0gY20uZGlzcGxheSwgZ3V0dGVyVyA9IGQuZ3V0dGVycy5vZmZzZXRXaWR0aDtcbiAgICB2YXIgZG9jSCA9IE1hdGgucm91bmQoY20uZG9jLmhlaWdodCArIHBhZGRpbmdWZXJ0KGNtLmRpc3BsYXkpKTtcbiAgICByZXR1cm4ge1xuICAgICAgY2xpZW50SGVpZ2h0OiBkLnNjcm9sbGVyLmNsaWVudEhlaWdodCxcbiAgICAgIHZpZXdIZWlnaHQ6IGQud3JhcHBlci5jbGllbnRIZWlnaHQsXG4gICAgICBzY3JvbGxXaWR0aDogZC5zY3JvbGxlci5zY3JvbGxXaWR0aCwgY2xpZW50V2lkdGg6IGQuc2Nyb2xsZXIuY2xpZW50V2lkdGgsXG4gICAgICB2aWV3V2lkdGg6IGQud3JhcHBlci5jbGllbnRXaWR0aCxcbiAgICAgIGJhckxlZnQ6IGNtLm9wdGlvbnMuZml4ZWRHdXR0ZXIgPyBndXR0ZXJXIDogMCxcbiAgICAgIGRvY0hlaWdodDogZG9jSCxcbiAgICAgIHNjcm9sbEhlaWdodDogZG9jSCArIHNjcm9sbEdhcChjbSkgKyBkLmJhckhlaWdodCxcbiAgICAgIG5hdGl2ZUJhcldpZHRoOiBkLm5hdGl2ZUJhcldpZHRoLFxuICAgICAgZ3V0dGVyV2lkdGg6IGd1dHRlcldcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gTmF0aXZlU2Nyb2xsYmFycyhwbGFjZSwgc2Nyb2xsLCBjbSkge1xuICAgIHRoaXMuY20gPSBjbTtcbiAgICB2YXIgdmVydCA9IHRoaXMudmVydCA9IGVsdChcImRpdlwiLCBbZWx0KFwiZGl2XCIsIG51bGwsIG51bGwsIFwibWluLXdpZHRoOiAxcHhcIildLCBcIkNvZGVNaXJyb3ItdnNjcm9sbGJhclwiKTtcbiAgICB2YXIgaG9yaXogPSB0aGlzLmhvcml6ID0gZWx0KFwiZGl2XCIsIFtlbHQoXCJkaXZcIiwgbnVsbCwgbnVsbCwgXCJoZWlnaHQ6IDEwMCU7IG1pbi1oZWlnaHQ6IDFweFwiKV0sIFwiQ29kZU1pcnJvci1oc2Nyb2xsYmFyXCIpO1xuICAgIHBsYWNlKHZlcnQpOyBwbGFjZShob3Jpeik7XG5cbiAgICBvbih2ZXJ0LCBcInNjcm9sbFwiLCBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh2ZXJ0LmNsaWVudEhlaWdodCkgc2Nyb2xsKHZlcnQuc2Nyb2xsVG9wLCBcInZlcnRpY2FsXCIpO1xuICAgIH0pO1xuICAgIG9uKGhvcml6LCBcInNjcm9sbFwiLCBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChob3Jpei5jbGllbnRXaWR0aCkgc2Nyb2xsKGhvcml6LnNjcm9sbExlZnQsIFwiaG9yaXpvbnRhbFwiKTtcbiAgICB9KTtcblxuICAgIHRoaXMuY2hlY2tlZFplcm9XaWR0aCA9IGZhbHNlO1xuICAgIC8vIE5lZWQgdG8gc2V0IGEgbWluaW11bSB3aWR0aCB0byBzZWUgdGhlIHNjcm9sbGJhciBvbiBJRTcgKGJ1dCBtdXN0IG5vdCBzZXQgaXQgb24gSUU4KS5cbiAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDgpIHRoaXMuaG9yaXouc3R5bGUubWluSGVpZ2h0ID0gdGhpcy52ZXJ0LnN0eWxlLm1pbldpZHRoID0gXCIxOHB4XCI7XG4gIH1cblxuICBOYXRpdmVTY3JvbGxiYXJzLnByb3RvdHlwZSA9IGNvcHlPYmooe1xuICAgIHVwZGF0ZTogZnVuY3Rpb24obWVhc3VyZSkge1xuICAgICAgdmFyIG5lZWRzSCA9IG1lYXN1cmUuc2Nyb2xsV2lkdGggPiBtZWFzdXJlLmNsaWVudFdpZHRoICsgMTtcbiAgICAgIHZhciBuZWVkc1YgPSBtZWFzdXJlLnNjcm9sbEhlaWdodCA+IG1lYXN1cmUuY2xpZW50SGVpZ2h0ICsgMTtcbiAgICAgIHZhciBzV2lkdGggPSBtZWFzdXJlLm5hdGl2ZUJhcldpZHRoO1xuXG4gICAgICBpZiAobmVlZHNWKSB7XG4gICAgICAgIHRoaXMudmVydC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICB0aGlzLnZlcnQuc3R5bGUuYm90dG9tID0gbmVlZHNIID8gc1dpZHRoICsgXCJweFwiIDogXCIwXCI7XG4gICAgICAgIHZhciB0b3RhbEhlaWdodCA9IG1lYXN1cmUudmlld0hlaWdodCAtIChuZWVkc0ggPyBzV2lkdGggOiAwKTtcbiAgICAgICAgLy8gQSBidWcgaW4gSUU4IGNhbiBjYXVzZSB0aGlzIHZhbHVlIHRvIGJlIG5lZ2F0aXZlLCBzbyBndWFyZCBpdC5cbiAgICAgICAgdGhpcy52ZXJ0LmZpcnN0Q2hpbGQuc3R5bGUuaGVpZ2h0ID1cbiAgICAgICAgICBNYXRoLm1heCgwLCBtZWFzdXJlLnNjcm9sbEhlaWdodCAtIG1lYXN1cmUuY2xpZW50SGVpZ2h0ICsgdG90YWxIZWlnaHQpICsgXCJweFwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy52ZXJ0LnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xuICAgICAgICB0aGlzLnZlcnQuZmlyc3RDaGlsZC5zdHlsZS5oZWlnaHQgPSBcIjBcIjtcbiAgICAgIH1cblxuICAgICAgaWYgKG5lZWRzSCkge1xuICAgICAgICB0aGlzLmhvcml6LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgICAgIHRoaXMuaG9yaXouc3R5bGUucmlnaHQgPSBuZWVkc1YgPyBzV2lkdGggKyBcInB4XCIgOiBcIjBcIjtcbiAgICAgICAgdGhpcy5ob3Jpei5zdHlsZS5sZWZ0ID0gbWVhc3VyZS5iYXJMZWZ0ICsgXCJweFwiO1xuICAgICAgICB2YXIgdG90YWxXaWR0aCA9IG1lYXN1cmUudmlld1dpZHRoIC0gbWVhc3VyZS5iYXJMZWZ0IC0gKG5lZWRzViA/IHNXaWR0aCA6IDApO1xuICAgICAgICB0aGlzLmhvcml6LmZpcnN0Q2hpbGQuc3R5bGUud2lkdGggPVxuICAgICAgICAgIChtZWFzdXJlLnNjcm9sbFdpZHRoIC0gbWVhc3VyZS5jbGllbnRXaWR0aCArIHRvdGFsV2lkdGgpICsgXCJweFwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5ob3Jpei5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcbiAgICAgICAgdGhpcy5ob3Jpei5maXJzdENoaWxkLnN0eWxlLndpZHRoID0gXCIwXCI7XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5jaGVja2VkWmVyb1dpZHRoICYmIG1lYXN1cmUuY2xpZW50SGVpZ2h0ID4gMCkge1xuICAgICAgICBpZiAoc1dpZHRoID09IDApIHRoaXMuemVyb1dpZHRoSGFjaygpO1xuICAgICAgICB0aGlzLmNoZWNrZWRaZXJvV2lkdGggPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge3JpZ2h0OiBuZWVkc1YgPyBzV2lkdGggOiAwLCBib3R0b206IG5lZWRzSCA/IHNXaWR0aCA6IDB9O1xuICAgIH0sXG4gICAgc2V0U2Nyb2xsTGVmdDogZnVuY3Rpb24ocG9zKSB7XG4gICAgICBpZiAodGhpcy5ob3Jpei5zY3JvbGxMZWZ0ICE9IHBvcykgdGhpcy5ob3Jpei5zY3JvbGxMZWZ0ID0gcG9zO1xuICAgICAgaWYgKHRoaXMuZGlzYWJsZUhvcml6KSB0aGlzLmVuYWJsZVplcm9XaWR0aEJhcih0aGlzLmhvcml6LCB0aGlzLmRpc2FibGVIb3Jpeik7XG4gICAgfSxcbiAgICBzZXRTY3JvbGxUb3A6IGZ1bmN0aW9uKHBvcykge1xuICAgICAgaWYgKHRoaXMudmVydC5zY3JvbGxUb3AgIT0gcG9zKSB0aGlzLnZlcnQuc2Nyb2xsVG9wID0gcG9zO1xuICAgICAgaWYgKHRoaXMuZGlzYWJsZVZlcnQpIHRoaXMuZW5hYmxlWmVyb1dpZHRoQmFyKHRoaXMudmVydCwgdGhpcy5kaXNhYmxlVmVydCk7XG4gICAgfSxcbiAgICB6ZXJvV2lkdGhIYWNrOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciB3ID0gbWFjICYmICFtYWNfZ2VNb3VudGFpbkxpb24gPyBcIjEycHhcIiA6IFwiMThweFwiO1xuICAgICAgdGhpcy5ob3Jpei5zdHlsZS5oZWlnaHQgPSB0aGlzLnZlcnQuc3R5bGUud2lkdGggPSB3O1xuICAgICAgdGhpcy5ob3Jpei5zdHlsZS5wb2ludGVyRXZlbnRzID0gdGhpcy52ZXJ0LnN0eWxlLnBvaW50ZXJFdmVudHMgPSBcIm5vbmVcIjtcbiAgICAgIHRoaXMuZGlzYWJsZUhvcml6ID0gbmV3IERlbGF5ZWQ7XG4gICAgICB0aGlzLmRpc2FibGVWZXJ0ID0gbmV3IERlbGF5ZWQ7XG4gICAgfSxcbiAgICBlbmFibGVaZXJvV2lkdGhCYXI6IGZ1bmN0aW9uKGJhciwgZGVsYXkpIHtcbiAgICAgIGJhci5zdHlsZS5wb2ludGVyRXZlbnRzID0gXCJhdXRvXCI7XG4gICAgICBmdW5jdGlvbiBtYXliZURpc2FibGUoKSB7XG4gICAgICAgIC8vIFRvIGZpbmQgb3V0IHdoZXRoZXIgdGhlIHNjcm9sbGJhciBpcyBzdGlsbCB2aXNpYmxlLCB3ZVxuICAgICAgICAvLyBjaGVjayB3aGV0aGVyIHRoZSBlbGVtZW50IHVuZGVyIHRoZSBwaXhlbCBpbiB0aGUgYm90dG9tXG4gICAgICAgIC8vIGxlZnQgY29ybmVyIG9mIHRoZSBzY3JvbGxiYXIgYm94IGlzIHRoZSBzY3JvbGxiYXIgYm94XG4gICAgICAgIC8vIGl0c2VsZiAod2hlbiB0aGUgYmFyIGlzIHN0aWxsIHZpc2libGUpIG9yIGl0cyBmaWxsZXIgY2hpbGRcbiAgICAgICAgLy8gKHdoZW4gdGhlIGJhciBpcyBoaWRkZW4pLiBJZiBpdCBpcyBzdGlsbCB2aXNpYmxlLCB3ZSBrZWVwXG4gICAgICAgIC8vIGl0IGVuYWJsZWQsIGlmIGl0J3MgaGlkZGVuLCB3ZSBkaXNhYmxlIHBvaW50ZXIgZXZlbnRzLlxuICAgICAgICB2YXIgYm94ID0gYmFyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICB2YXIgZWx0ID0gZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludChib3gubGVmdCArIDEsIGJveC5ib3R0b20gLSAxKTtcbiAgICAgICAgaWYgKGVsdCAhPSBiYXIpIGJhci5zdHlsZS5wb2ludGVyRXZlbnRzID0gXCJub25lXCI7XG4gICAgICAgIGVsc2UgZGVsYXkuc2V0KDEwMDAsIG1heWJlRGlzYWJsZSk7XG4gICAgICB9XG4gICAgICBkZWxheS5zZXQoMTAwMCwgbWF5YmVEaXNhYmxlKTtcbiAgICB9LFxuICAgIGNsZWFyOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwYXJlbnQgPSB0aGlzLmhvcml6LnBhcmVudE5vZGU7XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5ob3Jpeik7XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy52ZXJ0KTtcbiAgICB9XG4gIH0sIE5hdGl2ZVNjcm9sbGJhcnMucHJvdG90eXBlKTtcblxuICBmdW5jdGlvbiBOdWxsU2Nyb2xsYmFycygpIHt9XG5cbiAgTnVsbFNjcm9sbGJhcnMucHJvdG90eXBlID0gY29weU9iaih7XG4gICAgdXBkYXRlOiBmdW5jdGlvbigpIHsgcmV0dXJuIHtib3R0b206IDAsIHJpZ2h0OiAwfTsgfSxcbiAgICBzZXRTY3JvbGxMZWZ0OiBmdW5jdGlvbigpIHt9LFxuICAgIHNldFNjcm9sbFRvcDogZnVuY3Rpb24oKSB7fSxcbiAgICBjbGVhcjogZnVuY3Rpb24oKSB7fVxuICB9LCBOdWxsU2Nyb2xsYmFycy5wcm90b3R5cGUpO1xuXG4gIENvZGVNaXJyb3Iuc2Nyb2xsYmFyTW9kZWwgPSB7XCJuYXRpdmVcIjogTmF0aXZlU2Nyb2xsYmFycywgXCJudWxsXCI6IE51bGxTY3JvbGxiYXJzfTtcblxuICBmdW5jdGlvbiBpbml0U2Nyb2xsYmFycyhjbSkge1xuICAgIGlmIChjbS5kaXNwbGF5LnNjcm9sbGJhcnMpIHtcbiAgICAgIGNtLmRpc3BsYXkuc2Nyb2xsYmFycy5jbGVhcigpO1xuICAgICAgaWYgKGNtLmRpc3BsYXkuc2Nyb2xsYmFycy5hZGRDbGFzcylcbiAgICAgICAgcm1DbGFzcyhjbS5kaXNwbGF5LndyYXBwZXIsIGNtLmRpc3BsYXkuc2Nyb2xsYmFycy5hZGRDbGFzcyk7XG4gICAgfVxuXG4gICAgY20uZGlzcGxheS5zY3JvbGxiYXJzID0gbmV3IENvZGVNaXJyb3Iuc2Nyb2xsYmFyTW9kZWxbY20ub3B0aW9ucy5zY3JvbGxiYXJTdHlsZV0oZnVuY3Rpb24obm9kZSkge1xuICAgICAgY20uZGlzcGxheS53cmFwcGVyLmluc2VydEJlZm9yZShub2RlLCBjbS5kaXNwbGF5LnNjcm9sbGJhckZpbGxlcik7XG4gICAgICAvLyBQcmV2ZW50IGNsaWNrcyBpbiB0aGUgc2Nyb2xsYmFycyBmcm9tIGtpbGxpbmcgZm9jdXNcbiAgICAgIG9uKG5vZGUsIFwibW91c2Vkb3duXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoY20uc3RhdGUuZm9jdXNlZCkgc2V0VGltZW91dChmdW5jdGlvbigpIHsgY20uZGlzcGxheS5pbnB1dC5mb2N1cygpOyB9LCAwKTtcbiAgICAgIH0pO1xuICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoXCJjbS1ub3QtY29udGVudFwiLCBcInRydWVcIik7XG4gICAgfSwgZnVuY3Rpb24ocG9zLCBheGlzKSB7XG4gICAgICBpZiAoYXhpcyA9PSBcImhvcml6b250YWxcIikgc2V0U2Nyb2xsTGVmdChjbSwgcG9zKTtcbiAgICAgIGVsc2Ugc2V0U2Nyb2xsVG9wKGNtLCBwb3MpO1xuICAgIH0sIGNtKTtcbiAgICBpZiAoY20uZGlzcGxheS5zY3JvbGxiYXJzLmFkZENsYXNzKVxuICAgICAgYWRkQ2xhc3MoY20uZGlzcGxheS53cmFwcGVyLCBjbS5kaXNwbGF5LnNjcm9sbGJhcnMuYWRkQ2xhc3MpO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlU2Nyb2xsYmFycyhjbSwgbWVhc3VyZSkge1xuICAgIGlmICghbWVhc3VyZSkgbWVhc3VyZSA9IG1lYXN1cmVGb3JTY3JvbGxiYXJzKGNtKTtcbiAgICB2YXIgc3RhcnRXaWR0aCA9IGNtLmRpc3BsYXkuYmFyV2lkdGgsIHN0YXJ0SGVpZ2h0ID0gY20uZGlzcGxheS5iYXJIZWlnaHQ7XG4gICAgdXBkYXRlU2Nyb2xsYmFyc0lubmVyKGNtLCBtZWFzdXJlKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDQgJiYgc3RhcnRXaWR0aCAhPSBjbS5kaXNwbGF5LmJhcldpZHRoIHx8IHN0YXJ0SGVpZ2h0ICE9IGNtLmRpc3BsYXkuYmFySGVpZ2h0OyBpKyspIHtcbiAgICAgIGlmIChzdGFydFdpZHRoICE9IGNtLmRpc3BsYXkuYmFyV2lkdGggJiYgY20ub3B0aW9ucy5saW5lV3JhcHBpbmcpXG4gICAgICAgIHVwZGF0ZUhlaWdodHNJblZpZXdwb3J0KGNtKTtcbiAgICAgIHVwZGF0ZVNjcm9sbGJhcnNJbm5lcihjbSwgbWVhc3VyZUZvclNjcm9sbGJhcnMoY20pKTtcbiAgICAgIHN0YXJ0V2lkdGggPSBjbS5kaXNwbGF5LmJhcldpZHRoOyBzdGFydEhlaWdodCA9IGNtLmRpc3BsYXkuYmFySGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIC8vIFJlLXN5bmNocm9uaXplIHRoZSBmYWtlIHNjcm9sbGJhcnMgd2l0aCB0aGUgYWN0dWFsIHNpemUgb2YgdGhlXG4gIC8vIGNvbnRlbnQuXG4gIGZ1bmN0aW9uIHVwZGF0ZVNjcm9sbGJhcnNJbm5lcihjbSwgbWVhc3VyZSkge1xuICAgIHZhciBkID0gY20uZGlzcGxheTtcbiAgICB2YXIgc2l6ZXMgPSBkLnNjcm9sbGJhcnMudXBkYXRlKG1lYXN1cmUpO1xuXG4gICAgZC5zaXplci5zdHlsZS5wYWRkaW5nUmlnaHQgPSAoZC5iYXJXaWR0aCA9IHNpemVzLnJpZ2h0KSArIFwicHhcIjtcbiAgICBkLnNpemVyLnN0eWxlLnBhZGRpbmdCb3R0b20gPSAoZC5iYXJIZWlnaHQgPSBzaXplcy5ib3R0b20pICsgXCJweFwiO1xuXG4gICAgaWYgKHNpemVzLnJpZ2h0ICYmIHNpemVzLmJvdHRvbSkge1xuICAgICAgZC5zY3JvbGxiYXJGaWxsZXIuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgIGQuc2Nyb2xsYmFyRmlsbGVyLnN0eWxlLmhlaWdodCA9IHNpemVzLmJvdHRvbSArIFwicHhcIjtcbiAgICAgIGQuc2Nyb2xsYmFyRmlsbGVyLnN0eWxlLndpZHRoID0gc2l6ZXMucmlnaHQgKyBcInB4XCI7XG4gICAgfSBlbHNlIGQuc2Nyb2xsYmFyRmlsbGVyLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xuICAgIGlmIChzaXplcy5ib3R0b20gJiYgY20ub3B0aW9ucy5jb3Zlckd1dHRlck5leHRUb1Njcm9sbGJhciAmJiBjbS5vcHRpb25zLmZpeGVkR3V0dGVyKSB7XG4gICAgICBkLmd1dHRlckZpbGxlci5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgZC5ndXR0ZXJGaWxsZXIuc3R5bGUuaGVpZ2h0ID0gc2l6ZXMuYm90dG9tICsgXCJweFwiO1xuICAgICAgZC5ndXR0ZXJGaWxsZXIuc3R5bGUud2lkdGggPSBtZWFzdXJlLmd1dHRlcldpZHRoICsgXCJweFwiO1xuICAgIH0gZWxzZSBkLmd1dHRlckZpbGxlci5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcbiAgfVxuXG4gIC8vIENvbXB1dGUgdGhlIGxpbmVzIHRoYXQgYXJlIHZpc2libGUgaW4gYSBnaXZlbiB2aWV3cG9ydCAoZGVmYXVsdHNcbiAgLy8gdGhlIHRoZSBjdXJyZW50IHNjcm9sbCBwb3NpdGlvbikuIHZpZXdwb3J0IG1heSBjb250YWluIHRvcCxcbiAgLy8gaGVpZ2h0LCBhbmQgZW5zdXJlIChzZWUgb3Auc2Nyb2xsVG9Qb3MpIHByb3BlcnRpZXMuXG4gIGZ1bmN0aW9uIHZpc2libGVMaW5lcyhkaXNwbGF5LCBkb2MsIHZpZXdwb3J0KSB7XG4gICAgdmFyIHRvcCA9IHZpZXdwb3J0ICYmIHZpZXdwb3J0LnRvcCAhPSBudWxsID8gTWF0aC5tYXgoMCwgdmlld3BvcnQudG9wKSA6IGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wO1xuICAgIHRvcCA9IE1hdGguZmxvb3IodG9wIC0gcGFkZGluZ1RvcChkaXNwbGF5KSk7XG4gICAgdmFyIGJvdHRvbSA9IHZpZXdwb3J0ICYmIHZpZXdwb3J0LmJvdHRvbSAhPSBudWxsID8gdmlld3BvcnQuYm90dG9tIDogdG9wICsgZGlzcGxheS53cmFwcGVyLmNsaWVudEhlaWdodDtcblxuICAgIHZhciBmcm9tID0gbGluZUF0SGVpZ2h0KGRvYywgdG9wKSwgdG8gPSBsaW5lQXRIZWlnaHQoZG9jLCBib3R0b20pO1xuICAgIC8vIEVuc3VyZSBpcyBhIHtmcm9tOiB7bGluZSwgY2h9LCB0bzoge2xpbmUsIGNofX0gb2JqZWN0LCBhbmRcbiAgICAvLyBmb3JjZXMgdGhvc2UgbGluZXMgaW50byB0aGUgdmlld3BvcnQgKGlmIHBvc3NpYmxlKS5cbiAgICBpZiAodmlld3BvcnQgJiYgdmlld3BvcnQuZW5zdXJlKSB7XG4gICAgICB2YXIgZW5zdXJlRnJvbSA9IHZpZXdwb3J0LmVuc3VyZS5mcm9tLmxpbmUsIGVuc3VyZVRvID0gdmlld3BvcnQuZW5zdXJlLnRvLmxpbmU7XG4gICAgICBpZiAoZW5zdXJlRnJvbSA8IGZyb20pIHtcbiAgICAgICAgZnJvbSA9IGVuc3VyZUZyb207XG4gICAgICAgIHRvID0gbGluZUF0SGVpZ2h0KGRvYywgaGVpZ2h0QXRMaW5lKGdldExpbmUoZG9jLCBlbnN1cmVGcm9tKSkgKyBkaXNwbGF5LndyYXBwZXIuY2xpZW50SGVpZ2h0KTtcbiAgICAgIH0gZWxzZSBpZiAoTWF0aC5taW4oZW5zdXJlVG8sIGRvYy5sYXN0TGluZSgpKSA+PSB0bykge1xuICAgICAgICBmcm9tID0gbGluZUF0SGVpZ2h0KGRvYywgaGVpZ2h0QXRMaW5lKGdldExpbmUoZG9jLCBlbnN1cmVUbykpIC0gZGlzcGxheS53cmFwcGVyLmNsaWVudEhlaWdodCk7XG4gICAgICAgIHRvID0gZW5zdXJlVG87XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7ZnJvbTogZnJvbSwgdG86IE1hdGgubWF4KHRvLCBmcm9tICsgMSl9O1xuICB9XG5cbiAgLy8gTElORSBOVU1CRVJTXG5cbiAgLy8gUmUtYWxpZ24gbGluZSBudW1iZXJzIGFuZCBndXR0ZXIgbWFya3MgdG8gY29tcGVuc2F0ZSBmb3JcbiAgLy8gaG9yaXpvbnRhbCBzY3JvbGxpbmcuXG4gIGZ1bmN0aW9uIGFsaWduSG9yaXpvbnRhbGx5KGNtKSB7XG4gICAgdmFyIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCB2aWV3ID0gZGlzcGxheS52aWV3O1xuICAgIGlmICghZGlzcGxheS5hbGlnbldpZGdldHMgJiYgKCFkaXNwbGF5Lmd1dHRlcnMuZmlyc3RDaGlsZCB8fCAhY20ub3B0aW9ucy5maXhlZEd1dHRlcikpIHJldHVybjtcbiAgICB2YXIgY29tcCA9IGNvbXBlbnNhdGVGb3JIU2Nyb2xsKGRpc3BsYXkpIC0gZGlzcGxheS5zY3JvbGxlci5zY3JvbGxMZWZ0ICsgY20uZG9jLnNjcm9sbExlZnQ7XG4gICAgdmFyIGd1dHRlclcgPSBkaXNwbGF5Lmd1dHRlcnMub2Zmc2V0V2lkdGgsIGxlZnQgPSBjb21wICsgXCJweFwiO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlldy5sZW5ndGg7IGkrKykgaWYgKCF2aWV3W2ldLmhpZGRlbikge1xuICAgICAgaWYgKGNtLm9wdGlvbnMuZml4ZWRHdXR0ZXIgJiYgdmlld1tpXS5ndXR0ZXIpXG4gICAgICAgIHZpZXdbaV0uZ3V0dGVyLnN0eWxlLmxlZnQgPSBsZWZ0O1xuICAgICAgdmFyIGFsaWduID0gdmlld1tpXS5hbGlnbmFibGU7XG4gICAgICBpZiAoYWxpZ24pIGZvciAodmFyIGogPSAwOyBqIDwgYWxpZ24ubGVuZ3RoOyBqKyspXG4gICAgICAgIGFsaWduW2pdLnN0eWxlLmxlZnQgPSBsZWZ0O1xuICAgIH1cbiAgICBpZiAoY20ub3B0aW9ucy5maXhlZEd1dHRlcilcbiAgICAgIGRpc3BsYXkuZ3V0dGVycy5zdHlsZS5sZWZ0ID0gKGNvbXAgKyBndXR0ZXJXKSArIFwicHhcIjtcbiAgfVxuXG4gIC8vIFVzZWQgdG8gZW5zdXJlIHRoYXQgdGhlIGxpbmUgbnVtYmVyIGd1dHRlciBpcyBzdGlsbCB0aGUgcmlnaHRcbiAgLy8gc2l6ZSBmb3IgdGhlIGN1cnJlbnQgZG9jdW1lbnQgc2l6ZS4gUmV0dXJucyB0cnVlIHdoZW4gYW4gdXBkYXRlXG4gIC8vIGlzIG5lZWRlZC5cbiAgZnVuY3Rpb24gbWF5YmVVcGRhdGVMaW5lTnVtYmVyV2lkdGgoY20pIHtcbiAgICBpZiAoIWNtLm9wdGlvbnMubGluZU51bWJlcnMpIHJldHVybiBmYWxzZTtcbiAgICB2YXIgZG9jID0gY20uZG9jLCBsYXN0ID0gbGluZU51bWJlckZvcihjbS5vcHRpb25zLCBkb2MuZmlyc3QgKyBkb2Muc2l6ZSAtIDEpLCBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgICBpZiAobGFzdC5sZW5ndGggIT0gZGlzcGxheS5saW5lTnVtQ2hhcnMpIHtcbiAgICAgIHZhciB0ZXN0ID0gZGlzcGxheS5tZWFzdXJlLmFwcGVuZENoaWxkKGVsdChcImRpdlwiLCBbZWx0KFwiZGl2XCIsIGxhc3QpXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNvZGVNaXJyb3ItbGluZW51bWJlciBDb2RlTWlycm9yLWd1dHRlci1lbHRcIikpO1xuICAgICAgdmFyIGlubmVyVyA9IHRlc3QuZmlyc3RDaGlsZC5vZmZzZXRXaWR0aCwgcGFkZGluZyA9IHRlc3Qub2Zmc2V0V2lkdGggLSBpbm5lclc7XG4gICAgICBkaXNwbGF5LmxpbmVHdXR0ZXIuc3R5bGUud2lkdGggPSBcIlwiO1xuICAgICAgZGlzcGxheS5saW5lTnVtSW5uZXJXaWR0aCA9IE1hdGgubWF4KGlubmVyVywgZGlzcGxheS5saW5lR3V0dGVyLm9mZnNldFdpZHRoIC0gcGFkZGluZykgKyAxO1xuICAgICAgZGlzcGxheS5saW5lTnVtV2lkdGggPSBkaXNwbGF5LmxpbmVOdW1Jbm5lcldpZHRoICsgcGFkZGluZztcbiAgICAgIGRpc3BsYXkubGluZU51bUNoYXJzID0gZGlzcGxheS5saW5lTnVtSW5uZXJXaWR0aCA/IGxhc3QubGVuZ3RoIDogLTE7XG4gICAgICBkaXNwbGF5LmxpbmVHdXR0ZXIuc3R5bGUud2lkdGggPSBkaXNwbGF5LmxpbmVOdW1XaWR0aCArIFwicHhcIjtcbiAgICAgIHVwZGF0ZUd1dHRlclNwYWNlKGNtKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBmdW5jdGlvbiBsaW5lTnVtYmVyRm9yKG9wdGlvbnMsIGkpIHtcbiAgICByZXR1cm4gU3RyaW5nKG9wdGlvbnMubGluZU51bWJlckZvcm1hdHRlcihpICsgb3B0aW9ucy5maXJzdExpbmVOdW1iZXIpKTtcbiAgfVxuXG4gIC8vIENvbXB1dGVzIGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsTGVmdCArIGRpc3BsYXkuZ3V0dGVycy5vZmZzZXRXaWR0aCxcbiAgLy8gYnV0IHVzaW5nIGdldEJvdW5kaW5nQ2xpZW50UmVjdCB0byBnZXQgYSBzdWItcGl4ZWwtYWNjdXJhdGVcbiAgLy8gcmVzdWx0LlxuICBmdW5jdGlvbiBjb21wZW5zYXRlRm9ySFNjcm9sbChkaXNwbGF5KSB7XG4gICAgcmV0dXJuIGRpc3BsYXkuc2Nyb2xsZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdCAtIGRpc3BsYXkuc2l6ZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdDtcbiAgfVxuXG4gIC8vIERJU1BMQVkgRFJBV0lOR1xuXG4gIGZ1bmN0aW9uIERpc3BsYXlVcGRhdGUoY20sIHZpZXdwb3J0LCBmb3JjZSkge1xuICAgIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheTtcblxuICAgIHRoaXMudmlld3BvcnQgPSB2aWV3cG9ydDtcbiAgICAvLyBTdG9yZSBzb21lIHZhbHVlcyB0aGF0IHdlJ2xsIG5lZWQgbGF0ZXIgKGJ1dCBkb24ndCB3YW50IHRvIGZvcmNlIGEgcmVsYXlvdXQgZm9yKVxuICAgIHRoaXMudmlzaWJsZSA9IHZpc2libGVMaW5lcyhkaXNwbGF5LCBjbS5kb2MsIHZpZXdwb3J0KTtcbiAgICB0aGlzLmVkaXRvcklzSGlkZGVuID0gIWRpc3BsYXkud3JhcHBlci5vZmZzZXRXaWR0aDtcbiAgICB0aGlzLndyYXBwZXJIZWlnaHQgPSBkaXNwbGF5LndyYXBwZXIuY2xpZW50SGVpZ2h0O1xuICAgIHRoaXMud3JhcHBlcldpZHRoID0gZGlzcGxheS53cmFwcGVyLmNsaWVudFdpZHRoO1xuICAgIHRoaXMub2xkRGlzcGxheVdpZHRoID0gZGlzcGxheVdpZHRoKGNtKTtcbiAgICB0aGlzLmZvcmNlID0gZm9yY2U7XG4gICAgdGhpcy5kaW1zID0gZ2V0RGltZW5zaW9ucyhjbSk7XG4gICAgdGhpcy5ldmVudHMgPSBbXTtcbiAgfVxuXG4gIERpc3BsYXlVcGRhdGUucHJvdG90eXBlLnNpZ25hbCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgICBpZiAoaGFzSGFuZGxlcihlbWl0dGVyLCB0eXBlKSlcbiAgICAgIHRoaXMuZXZlbnRzLnB1c2goYXJndW1lbnRzKTtcbiAgfTtcbiAgRGlzcGxheVVwZGF0ZS5wcm90b3R5cGUuZmluaXNoID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmV2ZW50cy5sZW5ndGg7IGkrKylcbiAgICAgIHNpZ25hbC5hcHBseShudWxsLCB0aGlzLmV2ZW50c1tpXSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gbWF5YmVDbGlwU2Nyb2xsYmFycyhjbSkge1xuICAgIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgICBpZiAoIWRpc3BsYXkuc2Nyb2xsYmFyc0NsaXBwZWQgJiYgZGlzcGxheS5zY3JvbGxlci5vZmZzZXRXaWR0aCkge1xuICAgICAgZGlzcGxheS5uYXRpdmVCYXJXaWR0aCA9IGRpc3BsYXkuc2Nyb2xsZXIub2Zmc2V0V2lkdGggLSBkaXNwbGF5LnNjcm9sbGVyLmNsaWVudFdpZHRoO1xuICAgICAgZGlzcGxheS5oZWlnaHRGb3JjZXIuc3R5bGUuaGVpZ2h0ID0gc2Nyb2xsR2FwKGNtKSArIFwicHhcIjtcbiAgICAgIGRpc3BsYXkuc2l6ZXIuc3R5bGUubWFyZ2luQm90dG9tID0gLWRpc3BsYXkubmF0aXZlQmFyV2lkdGggKyBcInB4XCI7XG4gICAgICBkaXNwbGF5LnNpemVyLnN0eWxlLmJvcmRlclJpZ2h0V2lkdGggPSBzY3JvbGxHYXAoY20pICsgXCJweFwiO1xuICAgICAgZGlzcGxheS5zY3JvbGxiYXJzQ2xpcHBlZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgLy8gRG9lcyB0aGUgYWN0dWFsIHVwZGF0aW5nIG9mIHRoZSBsaW5lIGRpc3BsYXkuIEJhaWxzIG91dFxuICAvLyAocmV0dXJuaW5nIGZhbHNlKSB3aGVuIHRoZXJlIGlzIG5vdGhpbmcgdG8gYmUgZG9uZSBhbmQgZm9yY2VkIGlzXG4gIC8vIGZhbHNlLlxuICBmdW5jdGlvbiB1cGRhdGVEaXNwbGF5SWZOZWVkZWQoY20sIHVwZGF0ZSkge1xuICAgIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheSwgZG9jID0gY20uZG9jO1xuXG4gICAgaWYgKHVwZGF0ZS5lZGl0b3JJc0hpZGRlbikge1xuICAgICAgcmVzZXRWaWV3KGNtKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBCYWlsIG91dCBpZiB0aGUgdmlzaWJsZSBhcmVhIGlzIGFscmVhZHkgcmVuZGVyZWQgYW5kIG5vdGhpbmcgY2hhbmdlZC5cbiAgICBpZiAoIXVwZGF0ZS5mb3JjZSAmJlxuICAgICAgICB1cGRhdGUudmlzaWJsZS5mcm9tID49IGRpc3BsYXkudmlld0Zyb20gJiYgdXBkYXRlLnZpc2libGUudG8gPD0gZGlzcGxheS52aWV3VG8gJiZcbiAgICAgICAgKGRpc3BsYXkudXBkYXRlTGluZU51bWJlcnMgPT0gbnVsbCB8fCBkaXNwbGF5LnVwZGF0ZUxpbmVOdW1iZXJzID49IGRpc3BsYXkudmlld1RvKSAmJlxuICAgICAgICBkaXNwbGF5LnJlbmRlcmVkVmlldyA9PSBkaXNwbGF5LnZpZXcgJiYgY291bnREaXJ0eVZpZXcoY20pID09IDApXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAobWF5YmVVcGRhdGVMaW5lTnVtYmVyV2lkdGgoY20pKSB7XG4gICAgICByZXNldFZpZXcoY20pO1xuICAgICAgdXBkYXRlLmRpbXMgPSBnZXREaW1lbnNpb25zKGNtKTtcbiAgICB9XG5cbiAgICAvLyBDb21wdXRlIGEgc3VpdGFibGUgbmV3IHZpZXdwb3J0IChmcm9tICYgdG8pXG4gICAgdmFyIGVuZCA9IGRvYy5maXJzdCArIGRvYy5zaXplO1xuICAgIHZhciBmcm9tID0gTWF0aC5tYXgodXBkYXRlLnZpc2libGUuZnJvbSAtIGNtLm9wdGlvbnMudmlld3BvcnRNYXJnaW4sIGRvYy5maXJzdCk7XG4gICAgdmFyIHRvID0gTWF0aC5taW4oZW5kLCB1cGRhdGUudmlzaWJsZS50byArIGNtLm9wdGlvbnMudmlld3BvcnRNYXJnaW4pO1xuICAgIGlmIChkaXNwbGF5LnZpZXdGcm9tIDwgZnJvbSAmJiBmcm9tIC0gZGlzcGxheS52aWV3RnJvbSA8IDIwKSBmcm9tID0gTWF0aC5tYXgoZG9jLmZpcnN0LCBkaXNwbGF5LnZpZXdGcm9tKTtcbiAgICBpZiAoZGlzcGxheS52aWV3VG8gPiB0byAmJiBkaXNwbGF5LnZpZXdUbyAtIHRvIDwgMjApIHRvID0gTWF0aC5taW4oZW5kLCBkaXNwbGF5LnZpZXdUbyk7XG4gICAgaWYgKHNhd0NvbGxhcHNlZFNwYW5zKSB7XG4gICAgICBmcm9tID0gdmlzdWFsTGluZU5vKGNtLmRvYywgZnJvbSk7XG4gICAgICB0byA9IHZpc3VhbExpbmVFbmRObyhjbS5kb2MsIHRvKTtcbiAgICB9XG5cbiAgICB2YXIgZGlmZmVyZW50ID0gZnJvbSAhPSBkaXNwbGF5LnZpZXdGcm9tIHx8IHRvICE9IGRpc3BsYXkudmlld1RvIHx8XG4gICAgICBkaXNwbGF5Lmxhc3RXcmFwSGVpZ2h0ICE9IHVwZGF0ZS53cmFwcGVySGVpZ2h0IHx8IGRpc3BsYXkubGFzdFdyYXBXaWR0aCAhPSB1cGRhdGUud3JhcHBlcldpZHRoO1xuICAgIGFkanVzdFZpZXcoY20sIGZyb20sIHRvKTtcblxuICAgIGRpc3BsYXkudmlld09mZnNldCA9IGhlaWdodEF0TGluZShnZXRMaW5lKGNtLmRvYywgZGlzcGxheS52aWV3RnJvbSkpO1xuICAgIC8vIFBvc2l0aW9uIHRoZSBtb3ZlciBkaXYgdG8gYWxpZ24gd2l0aCB0aGUgY3VycmVudCBzY3JvbGwgcG9zaXRpb25cbiAgICBjbS5kaXNwbGF5Lm1vdmVyLnN0eWxlLnRvcCA9IGRpc3BsYXkudmlld09mZnNldCArIFwicHhcIjtcblxuICAgIHZhciB0b1VwZGF0ZSA9IGNvdW50RGlydHlWaWV3KGNtKTtcbiAgICBpZiAoIWRpZmZlcmVudCAmJiB0b1VwZGF0ZSA9PSAwICYmICF1cGRhdGUuZm9yY2UgJiYgZGlzcGxheS5yZW5kZXJlZFZpZXcgPT0gZGlzcGxheS52aWV3ICYmXG4gICAgICAgIChkaXNwbGF5LnVwZGF0ZUxpbmVOdW1iZXJzID09IG51bGwgfHwgZGlzcGxheS51cGRhdGVMaW5lTnVtYmVycyA+PSBkaXNwbGF5LnZpZXdUbykpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBGb3IgYmlnIGNoYW5nZXMsIHdlIGhpZGUgdGhlIGVuY2xvc2luZyBlbGVtZW50IGR1cmluZyB0aGVcbiAgICAvLyB1cGRhdGUsIHNpbmNlIHRoYXQgc3BlZWRzIHVwIHRoZSBvcGVyYXRpb25zIG9uIG1vc3QgYnJvd3NlcnMuXG4gICAgdmFyIGZvY3VzZWQgPSBhY3RpdmVFbHQoKTtcbiAgICBpZiAodG9VcGRhdGUgPiA0KSBkaXNwbGF5LmxpbmVEaXYuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIHBhdGNoRGlzcGxheShjbSwgZGlzcGxheS51cGRhdGVMaW5lTnVtYmVycywgdXBkYXRlLmRpbXMpO1xuICAgIGlmICh0b1VwZGF0ZSA+IDQpIGRpc3BsYXkubGluZURpdi5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcbiAgICBkaXNwbGF5LnJlbmRlcmVkVmlldyA9IGRpc3BsYXkudmlldztcbiAgICAvLyBUaGVyZSBtaWdodCBoYXZlIGJlZW4gYSB3aWRnZXQgd2l0aCBhIGZvY3VzZWQgZWxlbWVudCB0aGF0IGdvdFxuICAgIC8vIGhpZGRlbiBvciB1cGRhdGVkLCBpZiBzbyByZS1mb2N1cyBpdC5cbiAgICBpZiAoZm9jdXNlZCAmJiBhY3RpdmVFbHQoKSAhPSBmb2N1c2VkICYmIGZvY3VzZWQub2Zmc2V0SGVpZ2h0KSBmb2N1c2VkLmZvY3VzKCk7XG5cbiAgICAvLyBQcmV2ZW50IHNlbGVjdGlvbiBhbmQgY3Vyc29ycyBmcm9tIGludGVyZmVyaW5nIHdpdGggdGhlIHNjcm9sbFxuICAgIC8vIHdpZHRoIGFuZCBoZWlnaHQuXG4gICAgcmVtb3ZlQ2hpbGRyZW4oZGlzcGxheS5jdXJzb3JEaXYpO1xuICAgIHJlbW92ZUNoaWxkcmVuKGRpc3BsYXkuc2VsZWN0aW9uRGl2KTtcbiAgICBkaXNwbGF5Lmd1dHRlcnMuc3R5bGUuaGVpZ2h0ID0gZGlzcGxheS5zaXplci5zdHlsZS5taW5IZWlnaHQgPSAwO1xuXG4gICAgaWYgKGRpZmZlcmVudCkge1xuICAgICAgZGlzcGxheS5sYXN0V3JhcEhlaWdodCA9IHVwZGF0ZS53cmFwcGVySGVpZ2h0O1xuICAgICAgZGlzcGxheS5sYXN0V3JhcFdpZHRoID0gdXBkYXRlLndyYXBwZXJXaWR0aDtcbiAgICAgIHN0YXJ0V29ya2VyKGNtLCA0MDApO1xuICAgIH1cblxuICAgIGRpc3BsYXkudXBkYXRlTGluZU51bWJlcnMgPSBudWxsO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBwb3N0VXBkYXRlRGlzcGxheShjbSwgdXBkYXRlKSB7XG4gICAgdmFyIHZpZXdwb3J0ID0gdXBkYXRlLnZpZXdwb3J0O1xuICAgIGZvciAodmFyIGZpcnN0ID0gdHJ1ZTs7IGZpcnN0ID0gZmFsc2UpIHtcbiAgICAgIGlmICghZmlyc3QgfHwgIWNtLm9wdGlvbnMubGluZVdyYXBwaW5nIHx8IHVwZGF0ZS5vbGREaXNwbGF5V2lkdGggPT0gZGlzcGxheVdpZHRoKGNtKSkge1xuICAgICAgICAvLyBDbGlwIGZvcmNlZCB2aWV3cG9ydCB0byBhY3R1YWwgc2Nyb2xsYWJsZSBhcmVhLlxuICAgICAgICBpZiAodmlld3BvcnQgJiYgdmlld3BvcnQudG9wICE9IG51bGwpXG4gICAgICAgICAgdmlld3BvcnQgPSB7dG9wOiBNYXRoLm1pbihjbS5kb2MuaGVpZ2h0ICsgcGFkZGluZ1ZlcnQoY20uZGlzcGxheSkgLSBkaXNwbGF5SGVpZ2h0KGNtKSwgdmlld3BvcnQudG9wKX07XG4gICAgICAgIC8vIFVwZGF0ZWQgbGluZSBoZWlnaHRzIG1pZ2h0IHJlc3VsdCBpbiB0aGUgZHJhd24gYXJlYSBub3RcbiAgICAgICAgLy8gYWN0dWFsbHkgY292ZXJpbmcgdGhlIHZpZXdwb3J0LiBLZWVwIGxvb3BpbmcgdW50aWwgaXQgZG9lcy5cbiAgICAgICAgdXBkYXRlLnZpc2libGUgPSB2aXNpYmxlTGluZXMoY20uZGlzcGxheSwgY20uZG9jLCB2aWV3cG9ydCk7XG4gICAgICAgIGlmICh1cGRhdGUudmlzaWJsZS5mcm9tID49IGNtLmRpc3BsYXkudmlld0Zyb20gJiYgdXBkYXRlLnZpc2libGUudG8gPD0gY20uZGlzcGxheS52aWV3VG8pXG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoIXVwZGF0ZURpc3BsYXlJZk5lZWRlZChjbSwgdXBkYXRlKSkgYnJlYWs7XG4gICAgICB1cGRhdGVIZWlnaHRzSW5WaWV3cG9ydChjbSk7XG4gICAgICB2YXIgYmFyTWVhc3VyZSA9IG1lYXN1cmVGb3JTY3JvbGxiYXJzKGNtKTtcbiAgICAgIHVwZGF0ZVNlbGVjdGlvbihjbSk7XG4gICAgICBzZXREb2N1bWVudEhlaWdodChjbSwgYmFyTWVhc3VyZSk7XG4gICAgICB1cGRhdGVTY3JvbGxiYXJzKGNtLCBiYXJNZWFzdXJlKTtcbiAgICB9XG5cbiAgICB1cGRhdGUuc2lnbmFsKGNtLCBcInVwZGF0ZVwiLCBjbSk7XG4gICAgaWYgKGNtLmRpc3BsYXkudmlld0Zyb20gIT0gY20uZGlzcGxheS5yZXBvcnRlZFZpZXdGcm9tIHx8IGNtLmRpc3BsYXkudmlld1RvICE9IGNtLmRpc3BsYXkucmVwb3J0ZWRWaWV3VG8pIHtcbiAgICAgIHVwZGF0ZS5zaWduYWwoY20sIFwidmlld3BvcnRDaGFuZ2VcIiwgY20sIGNtLmRpc3BsYXkudmlld0Zyb20sIGNtLmRpc3BsYXkudmlld1RvKTtcbiAgICAgIGNtLmRpc3BsYXkucmVwb3J0ZWRWaWV3RnJvbSA9IGNtLmRpc3BsYXkudmlld0Zyb207IGNtLmRpc3BsYXkucmVwb3J0ZWRWaWV3VG8gPSBjbS5kaXNwbGF5LnZpZXdUbztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVEaXNwbGF5U2ltcGxlKGNtLCB2aWV3cG9ydCkge1xuICAgIHZhciB1cGRhdGUgPSBuZXcgRGlzcGxheVVwZGF0ZShjbSwgdmlld3BvcnQpO1xuICAgIGlmICh1cGRhdGVEaXNwbGF5SWZOZWVkZWQoY20sIHVwZGF0ZSkpIHtcbiAgICAgIHVwZGF0ZUhlaWdodHNJblZpZXdwb3J0KGNtKTtcbiAgICAgIHBvc3RVcGRhdGVEaXNwbGF5KGNtLCB1cGRhdGUpO1xuICAgICAgdmFyIGJhck1lYXN1cmUgPSBtZWFzdXJlRm9yU2Nyb2xsYmFycyhjbSk7XG4gICAgICB1cGRhdGVTZWxlY3Rpb24oY20pO1xuICAgICAgc2V0RG9jdW1lbnRIZWlnaHQoY20sIGJhck1lYXN1cmUpO1xuICAgICAgdXBkYXRlU2Nyb2xsYmFycyhjbSwgYmFyTWVhc3VyZSk7XG4gICAgICB1cGRhdGUuZmluaXNoKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0RG9jdW1lbnRIZWlnaHQoY20sIG1lYXN1cmUpIHtcbiAgICBjbS5kaXNwbGF5LnNpemVyLnN0eWxlLm1pbkhlaWdodCA9IG1lYXN1cmUuZG9jSGVpZ2h0ICsgXCJweFwiO1xuICAgIHZhciB0b3RhbCA9IG1lYXN1cmUuZG9jSGVpZ2h0ICsgY20uZGlzcGxheS5iYXJIZWlnaHQ7XG4gICAgY20uZGlzcGxheS5oZWlnaHRGb3JjZXIuc3R5bGUudG9wID0gdG90YWwgKyBcInB4XCI7XG4gICAgY20uZGlzcGxheS5ndXR0ZXJzLnN0eWxlLmhlaWdodCA9IE1hdGgubWF4KHRvdGFsICsgc2Nyb2xsR2FwKGNtKSwgbWVhc3VyZS5jbGllbnRIZWlnaHQpICsgXCJweFwiO1xuICB9XG5cbiAgLy8gUmVhZCB0aGUgYWN0dWFsIGhlaWdodHMgb2YgdGhlIHJlbmRlcmVkIGxpbmVzLCBhbmQgdXBkYXRlIHRoZWlyXG4gIC8vIHN0b3JlZCBoZWlnaHRzIHRvIG1hdGNoLlxuICBmdW5jdGlvbiB1cGRhdGVIZWlnaHRzSW5WaWV3cG9ydChjbSkge1xuICAgIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgICB2YXIgcHJldkJvdHRvbSA9IGRpc3BsYXkubGluZURpdi5vZmZzZXRUb3A7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkaXNwbGF5LnZpZXcubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjdXIgPSBkaXNwbGF5LnZpZXdbaV0sIGhlaWdodDtcbiAgICAgIGlmIChjdXIuaGlkZGVuKSBjb250aW51ZTtcbiAgICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOCkge1xuICAgICAgICB2YXIgYm90ID0gY3VyLm5vZGUub2Zmc2V0VG9wICsgY3VyLm5vZGUub2Zmc2V0SGVpZ2h0O1xuICAgICAgICBoZWlnaHQgPSBib3QgLSBwcmV2Qm90dG9tO1xuICAgICAgICBwcmV2Qm90dG9tID0gYm90O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGJveCA9IGN1ci5ub2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBoZWlnaHQgPSBib3guYm90dG9tIC0gYm94LnRvcDtcbiAgICAgIH1cbiAgICAgIHZhciBkaWZmID0gY3VyLmxpbmUuaGVpZ2h0IC0gaGVpZ2h0O1xuICAgICAgaWYgKGhlaWdodCA8IDIpIGhlaWdodCA9IHRleHRIZWlnaHQoZGlzcGxheSk7XG4gICAgICBpZiAoZGlmZiA+IC4wMDEgfHwgZGlmZiA8IC0uMDAxKSB7XG4gICAgICAgIHVwZGF0ZUxpbmVIZWlnaHQoY3VyLmxpbmUsIGhlaWdodCk7XG4gICAgICAgIHVwZGF0ZVdpZGdldEhlaWdodChjdXIubGluZSk7XG4gICAgICAgIGlmIChjdXIucmVzdCkgZm9yICh2YXIgaiA9IDA7IGogPCBjdXIucmVzdC5sZW5ndGg7IGorKylcbiAgICAgICAgICB1cGRhdGVXaWRnZXRIZWlnaHQoY3VyLnJlc3Rbal0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFJlYWQgYW5kIHN0b3JlIHRoZSBoZWlnaHQgb2YgbGluZSB3aWRnZXRzIGFzc29jaWF0ZWQgd2l0aCB0aGVcbiAgLy8gZ2l2ZW4gbGluZS5cbiAgZnVuY3Rpb24gdXBkYXRlV2lkZ2V0SGVpZ2h0KGxpbmUpIHtcbiAgICBpZiAobGluZS53aWRnZXRzKSBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmUud2lkZ2V0cy5sZW5ndGg7ICsraSlcbiAgICAgIGxpbmUud2lkZ2V0c1tpXS5oZWlnaHQgPSBsaW5lLndpZGdldHNbaV0ubm9kZS5vZmZzZXRIZWlnaHQ7XG4gIH1cblxuICAvLyBEbyBhIGJ1bGstcmVhZCBvZiB0aGUgRE9NIHBvc2l0aW9ucyBhbmQgc2l6ZXMgbmVlZGVkIHRvIGRyYXcgdGhlXG4gIC8vIHZpZXcsIHNvIHRoYXQgd2UgZG9uJ3QgaW50ZXJsZWF2ZSByZWFkaW5nIGFuZCB3cml0aW5nIHRvIHRoZSBET00uXG4gIGZ1bmN0aW9uIGdldERpbWVuc2lvbnMoY20pIHtcbiAgICB2YXIgZCA9IGNtLmRpc3BsYXksIGxlZnQgPSB7fSwgd2lkdGggPSB7fTtcbiAgICB2YXIgZ3V0dGVyTGVmdCA9IGQuZ3V0dGVycy5jbGllbnRMZWZ0O1xuICAgIGZvciAodmFyIG4gPSBkLmd1dHRlcnMuZmlyc3RDaGlsZCwgaSA9IDA7IG47IG4gPSBuLm5leHRTaWJsaW5nLCArK2kpIHtcbiAgICAgIGxlZnRbY20ub3B0aW9ucy5ndXR0ZXJzW2ldXSA9IG4ub2Zmc2V0TGVmdCArIG4uY2xpZW50TGVmdCArIGd1dHRlckxlZnQ7XG4gICAgICB3aWR0aFtjbS5vcHRpb25zLmd1dHRlcnNbaV1dID0gbi5jbGllbnRXaWR0aDtcbiAgICB9XG4gICAgcmV0dXJuIHtmaXhlZFBvczogY29tcGVuc2F0ZUZvckhTY3JvbGwoZCksXG4gICAgICAgICAgICBndXR0ZXJUb3RhbFdpZHRoOiBkLmd1dHRlcnMub2Zmc2V0V2lkdGgsXG4gICAgICAgICAgICBndXR0ZXJMZWZ0OiBsZWZ0LFxuICAgICAgICAgICAgZ3V0dGVyV2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgd3JhcHBlcldpZHRoOiBkLndyYXBwZXIuY2xpZW50V2lkdGh9O1xuICB9XG5cbiAgLy8gU3luYyB0aGUgYWN0dWFsIGRpc3BsYXkgRE9NIHN0cnVjdHVyZSB3aXRoIGRpc3BsYXkudmlldywgcmVtb3ZpbmdcbiAgLy8gbm9kZXMgZm9yIGxpbmVzIHRoYXQgYXJlIG5vIGxvbmdlciBpbiB2aWV3LCBhbmQgY3JlYXRpbmcgdGhlIG9uZXNcbiAgLy8gdGhhdCBhcmUgbm90IHRoZXJlIHlldCwgYW5kIHVwZGF0aW5nIHRoZSBvbmVzIHRoYXQgYXJlIG91dCBvZlxuICAvLyBkYXRlLlxuICBmdW5jdGlvbiBwYXRjaERpc3BsYXkoY20sIHVwZGF0ZU51bWJlcnNGcm9tLCBkaW1zKSB7XG4gICAgdmFyIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCBsaW5lTnVtYmVycyA9IGNtLm9wdGlvbnMubGluZU51bWJlcnM7XG4gICAgdmFyIGNvbnRhaW5lciA9IGRpc3BsYXkubGluZURpdiwgY3VyID0gY29udGFpbmVyLmZpcnN0Q2hpbGQ7XG5cbiAgICBmdW5jdGlvbiBybShub2RlKSB7XG4gICAgICB2YXIgbmV4dCA9IG5vZGUubmV4dFNpYmxpbmc7XG4gICAgICAvLyBXb3JrcyBhcm91bmQgYSB0aHJvdy1zY3JvbGwgYnVnIGluIE9TIFggV2Via2l0XG4gICAgICBpZiAod2Via2l0ICYmIG1hYyAmJiBjbS5kaXNwbGF5LmN1cnJlbnRXaGVlbFRhcmdldCA9PSBub2RlKVxuICAgICAgICBub2RlLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgIGVsc2VcbiAgICAgICAgbm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgICAgcmV0dXJuIG5leHQ7XG4gICAgfVxuXG4gICAgdmFyIHZpZXcgPSBkaXNwbGF5LnZpZXcsIGxpbmVOID0gZGlzcGxheS52aWV3RnJvbTtcbiAgICAvLyBMb29wIG92ZXIgdGhlIGVsZW1lbnRzIGluIHRoZSB2aWV3LCBzeW5jaW5nIGN1ciAodGhlIERPTSBub2Rlc1xuICAgIC8vIGluIGRpc3BsYXkubGluZURpdikgd2l0aCB0aGUgdmlldyBhcyB3ZSBnby5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZpZXcubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBsaW5lVmlldyA9IHZpZXdbaV07XG4gICAgICBpZiAobGluZVZpZXcuaGlkZGVuKSB7XG4gICAgICB9IGVsc2UgaWYgKCFsaW5lVmlldy5ub2RlIHx8IGxpbmVWaWV3Lm5vZGUucGFyZW50Tm9kZSAhPSBjb250YWluZXIpIHsgLy8gTm90IGRyYXduIHlldFxuICAgICAgICB2YXIgbm9kZSA9IGJ1aWxkTGluZUVsZW1lbnQoY20sIGxpbmVWaWV3LCBsaW5lTiwgZGltcyk7XG4gICAgICAgIGNvbnRhaW5lci5pbnNlcnRCZWZvcmUobm9kZSwgY3VyKTtcbiAgICAgIH0gZWxzZSB7IC8vIEFscmVhZHkgZHJhd25cbiAgICAgICAgd2hpbGUgKGN1ciAhPSBsaW5lVmlldy5ub2RlKSBjdXIgPSBybShjdXIpO1xuICAgICAgICB2YXIgdXBkYXRlTnVtYmVyID0gbGluZU51bWJlcnMgJiYgdXBkYXRlTnVtYmVyc0Zyb20gIT0gbnVsbCAmJlxuICAgICAgICAgIHVwZGF0ZU51bWJlcnNGcm9tIDw9IGxpbmVOICYmIGxpbmVWaWV3LmxpbmVOdW1iZXI7XG4gICAgICAgIGlmIChsaW5lVmlldy5jaGFuZ2VzKSB7XG4gICAgICAgICAgaWYgKGluZGV4T2YobGluZVZpZXcuY2hhbmdlcywgXCJndXR0ZXJcIikgPiAtMSkgdXBkYXRlTnVtYmVyID0gZmFsc2U7XG4gICAgICAgICAgdXBkYXRlTGluZUZvckNoYW5nZXMoY20sIGxpbmVWaWV3LCBsaW5lTiwgZGltcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHVwZGF0ZU51bWJlcikge1xuICAgICAgICAgIHJlbW92ZUNoaWxkcmVuKGxpbmVWaWV3LmxpbmVOdW1iZXIpO1xuICAgICAgICAgIGxpbmVWaWV3LmxpbmVOdW1iZXIuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobGluZU51bWJlckZvcihjbS5vcHRpb25zLCBsaW5lTikpKTtcbiAgICAgICAgfVxuICAgICAgICBjdXIgPSBsaW5lVmlldy5ub2RlLm5leHRTaWJsaW5nO1xuICAgICAgfVxuICAgICAgbGluZU4gKz0gbGluZVZpZXcuc2l6ZTtcbiAgICB9XG4gICAgd2hpbGUgKGN1cikgY3VyID0gcm0oY3VyKTtcbiAgfVxuXG4gIC8vIFdoZW4gYW4gYXNwZWN0IG9mIGEgbGluZSBjaGFuZ2VzLCBhIHN0cmluZyBpcyBhZGRlZCB0b1xuICAvLyBsaW5lVmlldy5jaGFuZ2VzLiBUaGlzIHVwZGF0ZXMgdGhlIHJlbGV2YW50IHBhcnQgb2YgdGhlIGxpbmUnc1xuICAvLyBET00gc3RydWN0dXJlLlxuICBmdW5jdGlvbiB1cGRhdGVMaW5lRm9yQ2hhbmdlcyhjbSwgbGluZVZpZXcsIGxpbmVOLCBkaW1zKSB7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBsaW5lVmlldy5jaGFuZ2VzLmxlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgdHlwZSA9IGxpbmVWaWV3LmNoYW5nZXNbal07XG4gICAgICBpZiAodHlwZSA9PSBcInRleHRcIikgdXBkYXRlTGluZVRleHQoY20sIGxpbmVWaWV3KTtcbiAgICAgIGVsc2UgaWYgKHR5cGUgPT0gXCJndXR0ZXJcIikgdXBkYXRlTGluZUd1dHRlcihjbSwgbGluZVZpZXcsIGxpbmVOLCBkaW1zKTtcbiAgICAgIGVsc2UgaWYgKHR5cGUgPT0gXCJjbGFzc1wiKSB1cGRhdGVMaW5lQ2xhc3NlcyhsaW5lVmlldyk7XG4gICAgICBlbHNlIGlmICh0eXBlID09IFwid2lkZ2V0XCIpIHVwZGF0ZUxpbmVXaWRnZXRzKGNtLCBsaW5lVmlldywgZGltcyk7XG4gICAgfVxuICAgIGxpbmVWaWV3LmNoYW5nZXMgPSBudWxsO1xuICB9XG5cbiAgLy8gTGluZXMgd2l0aCBndXR0ZXIgZWxlbWVudHMsIHdpZGdldHMgb3IgYSBiYWNrZ3JvdW5kIGNsYXNzIG5lZWQgdG9cbiAgLy8gYmUgd3JhcHBlZCwgYW5kIGhhdmUgdGhlIGV4dHJhIGVsZW1lbnRzIGFkZGVkIHRvIHRoZSB3cmFwcGVyIGRpdlxuICBmdW5jdGlvbiBlbnN1cmVMaW5lV3JhcHBlZChsaW5lVmlldykge1xuICAgIGlmIChsaW5lVmlldy5ub2RlID09IGxpbmVWaWV3LnRleHQpIHtcbiAgICAgIGxpbmVWaWV3Lm5vZGUgPSBlbHQoXCJkaXZcIiwgbnVsbCwgbnVsbCwgXCJwb3NpdGlvbjogcmVsYXRpdmVcIik7XG4gICAgICBpZiAobGluZVZpZXcudGV4dC5wYXJlbnROb2RlKVxuICAgICAgICBsaW5lVmlldy50ZXh0LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGxpbmVWaWV3Lm5vZGUsIGxpbmVWaWV3LnRleHQpO1xuICAgICAgbGluZVZpZXcubm9kZS5hcHBlbmRDaGlsZChsaW5lVmlldy50ZXh0KTtcbiAgICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOCkgbGluZVZpZXcubm9kZS5zdHlsZS56SW5kZXggPSAyO1xuICAgIH1cbiAgICByZXR1cm4gbGluZVZpZXcubm9kZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZUxpbmVCYWNrZ3JvdW5kKGxpbmVWaWV3KSB7XG4gICAgdmFyIGNscyA9IGxpbmVWaWV3LmJnQ2xhc3MgPyBsaW5lVmlldy5iZ0NsYXNzICsgXCIgXCIgKyAobGluZVZpZXcubGluZS5iZ0NsYXNzIHx8IFwiXCIpIDogbGluZVZpZXcubGluZS5iZ0NsYXNzO1xuICAgIGlmIChjbHMpIGNscyArPSBcIiBDb2RlTWlycm9yLWxpbmViYWNrZ3JvdW5kXCI7XG4gICAgaWYgKGxpbmVWaWV3LmJhY2tncm91bmQpIHtcbiAgICAgIGlmIChjbHMpIGxpbmVWaWV3LmJhY2tncm91bmQuY2xhc3NOYW1lID0gY2xzO1xuICAgICAgZWxzZSB7IGxpbmVWaWV3LmJhY2tncm91bmQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChsaW5lVmlldy5iYWNrZ3JvdW5kKTsgbGluZVZpZXcuYmFja2dyb3VuZCA9IG51bGw7IH1cbiAgICB9IGVsc2UgaWYgKGNscykge1xuICAgICAgdmFyIHdyYXAgPSBlbnN1cmVMaW5lV3JhcHBlZChsaW5lVmlldyk7XG4gICAgICBsaW5lVmlldy5iYWNrZ3JvdW5kID0gd3JhcC5pbnNlcnRCZWZvcmUoZWx0KFwiZGl2XCIsIG51bGwsIGNscyksIHdyYXAuZmlyc3RDaGlsZCk7XG4gICAgfVxuICB9XG5cbiAgLy8gV3JhcHBlciBhcm91bmQgYnVpbGRMaW5lQ29udGVudCB3aGljaCB3aWxsIHJldXNlIHRoZSBzdHJ1Y3R1cmVcbiAgLy8gaW4gZGlzcGxheS5leHRlcm5hbE1lYXN1cmVkIHdoZW4gcG9zc2libGUuXG4gIGZ1bmN0aW9uIGdldExpbmVDb250ZW50KGNtLCBsaW5lVmlldykge1xuICAgIHZhciBleHQgPSBjbS5kaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQ7XG4gICAgaWYgKGV4dCAmJiBleHQubGluZSA9PSBsaW5lVmlldy5saW5lKSB7XG4gICAgICBjbS5kaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQgPSBudWxsO1xuICAgICAgbGluZVZpZXcubWVhc3VyZSA9IGV4dC5tZWFzdXJlO1xuICAgICAgcmV0dXJuIGV4dC5idWlsdDtcbiAgICB9XG4gICAgcmV0dXJuIGJ1aWxkTGluZUNvbnRlbnQoY20sIGxpbmVWaWV3KTtcbiAgfVxuXG4gIC8vIFJlZHJhdyB0aGUgbGluZSdzIHRleHQuIEludGVyYWN0cyB3aXRoIHRoZSBiYWNrZ3JvdW5kIGFuZCB0ZXh0XG4gIC8vIGNsYXNzZXMgYmVjYXVzZSB0aGUgbW9kZSBtYXkgb3V0cHV0IHRva2VucyB0aGF0IGluZmx1ZW5jZSB0aGVzZVxuICAvLyBjbGFzc2VzLlxuICBmdW5jdGlvbiB1cGRhdGVMaW5lVGV4dChjbSwgbGluZVZpZXcpIHtcbiAgICB2YXIgY2xzID0gbGluZVZpZXcudGV4dC5jbGFzc05hbWU7XG4gICAgdmFyIGJ1aWx0ID0gZ2V0TGluZUNvbnRlbnQoY20sIGxpbmVWaWV3KTtcbiAgICBpZiAobGluZVZpZXcudGV4dCA9PSBsaW5lVmlldy5ub2RlKSBsaW5lVmlldy5ub2RlID0gYnVpbHQucHJlO1xuICAgIGxpbmVWaWV3LnRleHQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYnVpbHQucHJlLCBsaW5lVmlldy50ZXh0KTtcbiAgICBsaW5lVmlldy50ZXh0ID0gYnVpbHQucHJlO1xuICAgIGlmIChidWlsdC5iZ0NsYXNzICE9IGxpbmVWaWV3LmJnQ2xhc3MgfHwgYnVpbHQudGV4dENsYXNzICE9IGxpbmVWaWV3LnRleHRDbGFzcykge1xuICAgICAgbGluZVZpZXcuYmdDbGFzcyA9IGJ1aWx0LmJnQ2xhc3M7XG4gICAgICBsaW5lVmlldy50ZXh0Q2xhc3MgPSBidWlsdC50ZXh0Q2xhc3M7XG4gICAgICB1cGRhdGVMaW5lQ2xhc3NlcyhsaW5lVmlldyk7XG4gICAgfSBlbHNlIGlmIChjbHMpIHtcbiAgICAgIGxpbmVWaWV3LnRleHQuY2xhc3NOYW1lID0gY2xzO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZUxpbmVDbGFzc2VzKGxpbmVWaWV3KSB7XG4gICAgdXBkYXRlTGluZUJhY2tncm91bmQobGluZVZpZXcpO1xuICAgIGlmIChsaW5lVmlldy5saW5lLndyYXBDbGFzcylcbiAgICAgIGVuc3VyZUxpbmVXcmFwcGVkKGxpbmVWaWV3KS5jbGFzc05hbWUgPSBsaW5lVmlldy5saW5lLndyYXBDbGFzcztcbiAgICBlbHNlIGlmIChsaW5lVmlldy5ub2RlICE9IGxpbmVWaWV3LnRleHQpXG4gICAgICBsaW5lVmlldy5ub2RlLmNsYXNzTmFtZSA9IFwiXCI7XG4gICAgdmFyIHRleHRDbGFzcyA9IGxpbmVWaWV3LnRleHRDbGFzcyA/IGxpbmVWaWV3LnRleHRDbGFzcyArIFwiIFwiICsgKGxpbmVWaWV3LmxpbmUudGV4dENsYXNzIHx8IFwiXCIpIDogbGluZVZpZXcubGluZS50ZXh0Q2xhc3M7XG4gICAgbGluZVZpZXcudGV4dC5jbGFzc05hbWUgPSB0ZXh0Q2xhc3MgfHwgXCJcIjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZUxpbmVHdXR0ZXIoY20sIGxpbmVWaWV3LCBsaW5lTiwgZGltcykge1xuICAgIGlmIChsaW5lVmlldy5ndXR0ZXIpIHtcbiAgICAgIGxpbmVWaWV3Lm5vZGUucmVtb3ZlQ2hpbGQobGluZVZpZXcuZ3V0dGVyKTtcbiAgICAgIGxpbmVWaWV3Lmd1dHRlciA9IG51bGw7XG4gICAgfVxuICAgIGlmIChsaW5lVmlldy5ndXR0ZXJCYWNrZ3JvdW5kKSB7XG4gICAgICBsaW5lVmlldy5ub2RlLnJlbW92ZUNoaWxkKGxpbmVWaWV3Lmd1dHRlckJhY2tncm91bmQpO1xuICAgICAgbGluZVZpZXcuZ3V0dGVyQmFja2dyb3VuZCA9IG51bGw7XG4gICAgfVxuICAgIGlmIChsaW5lVmlldy5saW5lLmd1dHRlckNsYXNzKSB7XG4gICAgICB2YXIgd3JhcCA9IGVuc3VyZUxpbmVXcmFwcGVkKGxpbmVWaWV3KTtcbiAgICAgIGxpbmVWaWV3Lmd1dHRlckJhY2tncm91bmQgPSBlbHQoXCJkaXZcIiwgbnVsbCwgXCJDb2RlTWlycm9yLWd1dHRlci1iYWNrZ3JvdW5kIFwiICsgbGluZVZpZXcubGluZS5ndXR0ZXJDbGFzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJsZWZ0OiBcIiArIChjbS5vcHRpb25zLmZpeGVkR3V0dGVyID8gZGltcy5maXhlZFBvcyA6IC1kaW1zLmd1dHRlclRvdGFsV2lkdGgpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJweDsgd2lkdGg6IFwiICsgZGltcy5ndXR0ZXJUb3RhbFdpZHRoICsgXCJweFwiKTtcbiAgICAgIHdyYXAuaW5zZXJ0QmVmb3JlKGxpbmVWaWV3Lmd1dHRlckJhY2tncm91bmQsIGxpbmVWaWV3LnRleHQpO1xuICAgIH1cbiAgICB2YXIgbWFya2VycyA9IGxpbmVWaWV3LmxpbmUuZ3V0dGVyTWFya2VycztcbiAgICBpZiAoY20ub3B0aW9ucy5saW5lTnVtYmVycyB8fCBtYXJrZXJzKSB7XG4gICAgICB2YXIgd3JhcCA9IGVuc3VyZUxpbmVXcmFwcGVkKGxpbmVWaWV3KTtcbiAgICAgIHZhciBndXR0ZXJXcmFwID0gbGluZVZpZXcuZ3V0dGVyID0gZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1ndXR0ZXItd3JhcHBlclwiLCBcImxlZnQ6IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjbS5vcHRpb25zLmZpeGVkR3V0dGVyID8gZGltcy5maXhlZFBvcyA6IC1kaW1zLmd1dHRlclRvdGFsV2lkdGgpICsgXCJweFwiKTtcbiAgICAgIGNtLmRpc3BsYXkuaW5wdXQuc2V0VW5lZGl0YWJsZShndXR0ZXJXcmFwKTtcbiAgICAgIHdyYXAuaW5zZXJ0QmVmb3JlKGd1dHRlcldyYXAsIGxpbmVWaWV3LnRleHQpO1xuICAgICAgaWYgKGxpbmVWaWV3LmxpbmUuZ3V0dGVyQ2xhc3MpXG4gICAgICAgIGd1dHRlcldyYXAuY2xhc3NOYW1lICs9IFwiIFwiICsgbGluZVZpZXcubGluZS5ndXR0ZXJDbGFzcztcbiAgICAgIGlmIChjbS5vcHRpb25zLmxpbmVOdW1iZXJzICYmICghbWFya2VycyB8fCAhbWFya2Vyc1tcIkNvZGVNaXJyb3ItbGluZW51bWJlcnNcIl0pKVxuICAgICAgICBsaW5lVmlldy5saW5lTnVtYmVyID0gZ3V0dGVyV3JhcC5hcHBlbmRDaGlsZChcbiAgICAgICAgICBlbHQoXCJkaXZcIiwgbGluZU51bWJlckZvcihjbS5vcHRpb25zLCBsaW5lTiksXG4gICAgICAgICAgICAgIFwiQ29kZU1pcnJvci1saW5lbnVtYmVyIENvZGVNaXJyb3ItZ3V0dGVyLWVsdFwiLFxuICAgICAgICAgICAgICBcImxlZnQ6IFwiICsgZGltcy5ndXR0ZXJMZWZ0W1wiQ29kZU1pcnJvci1saW5lbnVtYmVyc1wiXSArIFwicHg7IHdpZHRoOiBcIlxuICAgICAgICAgICAgICArIGNtLmRpc3BsYXkubGluZU51bUlubmVyV2lkdGggKyBcInB4XCIpKTtcbiAgICAgIGlmIChtYXJrZXJzKSBmb3IgKHZhciBrID0gMDsgayA8IGNtLm9wdGlvbnMuZ3V0dGVycy5sZW5ndGg7ICsraykge1xuICAgICAgICB2YXIgaWQgPSBjbS5vcHRpb25zLmd1dHRlcnNba10sIGZvdW5kID0gbWFya2Vycy5oYXNPd25Qcm9wZXJ0eShpZCkgJiYgbWFya2Vyc1tpZF07XG4gICAgICAgIGlmIChmb3VuZClcbiAgICAgICAgICBndXR0ZXJXcmFwLmFwcGVuZENoaWxkKGVsdChcImRpdlwiLCBbZm91bmRdLCBcIkNvZGVNaXJyb3ItZ3V0dGVyLWVsdFwiLCBcImxlZnQ6IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaW1zLmd1dHRlckxlZnRbaWRdICsgXCJweDsgd2lkdGg6IFwiICsgZGltcy5ndXR0ZXJXaWR0aFtpZF0gKyBcInB4XCIpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVMaW5lV2lkZ2V0cyhjbSwgbGluZVZpZXcsIGRpbXMpIHtcbiAgICBpZiAobGluZVZpZXcuYWxpZ25hYmxlKSBsaW5lVmlldy5hbGlnbmFibGUgPSBudWxsO1xuICAgIGZvciAodmFyIG5vZGUgPSBsaW5lVmlldy5ub2RlLmZpcnN0Q2hpbGQsIG5leHQ7IG5vZGU7IG5vZGUgPSBuZXh0KSB7XG4gICAgICB2YXIgbmV4dCA9IG5vZGUubmV4dFNpYmxpbmc7XG4gICAgICBpZiAobm9kZS5jbGFzc05hbWUgPT0gXCJDb2RlTWlycm9yLWxpbmV3aWRnZXRcIilcbiAgICAgICAgbGluZVZpZXcubm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbiAgICB9XG4gICAgaW5zZXJ0TGluZVdpZGdldHMoY20sIGxpbmVWaWV3LCBkaW1zKTtcbiAgfVxuXG4gIC8vIEJ1aWxkIGEgbGluZSdzIERPTSByZXByZXNlbnRhdGlvbiBmcm9tIHNjcmF0Y2hcbiAgZnVuY3Rpb24gYnVpbGRMaW5lRWxlbWVudChjbSwgbGluZVZpZXcsIGxpbmVOLCBkaW1zKSB7XG4gICAgdmFyIGJ1aWx0ID0gZ2V0TGluZUNvbnRlbnQoY20sIGxpbmVWaWV3KTtcbiAgICBsaW5lVmlldy50ZXh0ID0gbGluZVZpZXcubm9kZSA9IGJ1aWx0LnByZTtcbiAgICBpZiAoYnVpbHQuYmdDbGFzcykgbGluZVZpZXcuYmdDbGFzcyA9IGJ1aWx0LmJnQ2xhc3M7XG4gICAgaWYgKGJ1aWx0LnRleHRDbGFzcykgbGluZVZpZXcudGV4dENsYXNzID0gYnVpbHQudGV4dENsYXNzO1xuXG4gICAgdXBkYXRlTGluZUNsYXNzZXMobGluZVZpZXcpO1xuICAgIHVwZGF0ZUxpbmVHdXR0ZXIoY20sIGxpbmVWaWV3LCBsaW5lTiwgZGltcyk7XG4gICAgaW5zZXJ0TGluZVdpZGdldHMoY20sIGxpbmVWaWV3LCBkaW1zKTtcbiAgICByZXR1cm4gbGluZVZpZXcubm9kZTtcbiAgfVxuXG4gIC8vIEEgbGluZVZpZXcgbWF5IGNvbnRhaW4gbXVsdGlwbGUgbG9naWNhbCBsaW5lcyAod2hlbiBtZXJnZWQgYnlcbiAgLy8gY29sbGFwc2VkIHNwYW5zKS4gVGhlIHdpZGdldHMgZm9yIGFsbCBvZiB0aGVtIG5lZWQgdG8gYmUgZHJhd24uXG4gIGZ1bmN0aW9uIGluc2VydExpbmVXaWRnZXRzKGNtLCBsaW5lVmlldywgZGltcykge1xuICAgIGluc2VydExpbmVXaWRnZXRzRm9yKGNtLCBsaW5lVmlldy5saW5lLCBsaW5lVmlldywgZGltcywgdHJ1ZSk7XG4gICAgaWYgKGxpbmVWaWV3LnJlc3QpIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZVZpZXcucmVzdC5sZW5ndGg7IGkrKylcbiAgICAgIGluc2VydExpbmVXaWRnZXRzRm9yKGNtLCBsaW5lVmlldy5yZXN0W2ldLCBsaW5lVmlldywgZGltcywgZmFsc2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW5zZXJ0TGluZVdpZGdldHNGb3IoY20sIGxpbmUsIGxpbmVWaWV3LCBkaW1zLCBhbGxvd0Fib3ZlKSB7XG4gICAgaWYgKCFsaW5lLndpZGdldHMpIHJldHVybjtcbiAgICB2YXIgd3JhcCA9IGVuc3VyZUxpbmVXcmFwcGVkKGxpbmVWaWV3KTtcbiAgICBmb3IgKHZhciBpID0gMCwgd3MgPSBsaW5lLndpZGdldHM7IGkgPCB3cy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIHdpZGdldCA9IHdzW2ldLCBub2RlID0gZWx0KFwiZGl2XCIsIFt3aWRnZXQubm9kZV0sIFwiQ29kZU1pcnJvci1saW5ld2lkZ2V0XCIpO1xuICAgICAgaWYgKCF3aWRnZXQuaGFuZGxlTW91c2VFdmVudHMpIG5vZGUuc2V0QXR0cmlidXRlKFwiY20taWdub3JlLWV2ZW50c1wiLCBcInRydWVcIik7XG4gICAgICBwb3NpdGlvbkxpbmVXaWRnZXQod2lkZ2V0LCBub2RlLCBsaW5lVmlldywgZGltcyk7XG4gICAgICBjbS5kaXNwbGF5LmlucHV0LnNldFVuZWRpdGFibGUobm9kZSk7XG4gICAgICBpZiAoYWxsb3dBYm92ZSAmJiB3aWRnZXQuYWJvdmUpXG4gICAgICAgIHdyYXAuaW5zZXJ0QmVmb3JlKG5vZGUsIGxpbmVWaWV3Lmd1dHRlciB8fCBsaW5lVmlldy50ZXh0KTtcbiAgICAgIGVsc2VcbiAgICAgICAgd3JhcC5hcHBlbmRDaGlsZChub2RlKTtcbiAgICAgIHNpZ25hbExhdGVyKHdpZGdldCwgXCJyZWRyYXdcIik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcG9zaXRpb25MaW5lV2lkZ2V0KHdpZGdldCwgbm9kZSwgbGluZVZpZXcsIGRpbXMpIHtcbiAgICBpZiAod2lkZ2V0Lm5vSFNjcm9sbCkge1xuICAgICAgKGxpbmVWaWV3LmFsaWduYWJsZSB8fCAobGluZVZpZXcuYWxpZ25hYmxlID0gW10pKS5wdXNoKG5vZGUpO1xuICAgICAgdmFyIHdpZHRoID0gZGltcy53cmFwcGVyV2lkdGg7XG4gICAgICBub2RlLnN0eWxlLmxlZnQgPSBkaW1zLmZpeGVkUG9zICsgXCJweFwiO1xuICAgICAgaWYgKCF3aWRnZXQuY292ZXJHdXR0ZXIpIHtcbiAgICAgICAgd2lkdGggLT0gZGltcy5ndXR0ZXJUb3RhbFdpZHRoO1xuICAgICAgICBub2RlLnN0eWxlLnBhZGRpbmdMZWZ0ID0gZGltcy5ndXR0ZXJUb3RhbFdpZHRoICsgXCJweFwiO1xuICAgICAgfVxuICAgICAgbm9kZS5zdHlsZS53aWR0aCA9IHdpZHRoICsgXCJweFwiO1xuICAgIH1cbiAgICBpZiAod2lkZ2V0LmNvdmVyR3V0dGVyKSB7XG4gICAgICBub2RlLnN0eWxlLnpJbmRleCA9IDU7XG4gICAgICBub2RlLnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xuICAgICAgaWYgKCF3aWRnZXQubm9IU2Nyb2xsKSBub2RlLnN0eWxlLm1hcmdpbkxlZnQgPSAtZGltcy5ndXR0ZXJUb3RhbFdpZHRoICsgXCJweFwiO1xuICAgIH1cbiAgfVxuXG4gIC8vIFBPU0lUSU9OIE9CSkVDVFxuXG4gIC8vIEEgUG9zIGluc3RhbmNlIHJlcHJlc2VudHMgYSBwb3NpdGlvbiB3aXRoaW4gdGhlIHRleHQuXG4gIHZhciBQb3MgPSBDb2RlTWlycm9yLlBvcyA9IGZ1bmN0aW9uKGxpbmUsIGNoKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFBvcykpIHJldHVybiBuZXcgUG9zKGxpbmUsIGNoKTtcbiAgICB0aGlzLmxpbmUgPSBsaW5lOyB0aGlzLmNoID0gY2g7XG4gIH07XG5cbiAgLy8gQ29tcGFyZSB0d28gcG9zaXRpb25zLCByZXR1cm4gMCBpZiB0aGV5IGFyZSB0aGUgc2FtZSwgYSBuZWdhdGl2ZVxuICAvLyBudW1iZXIgd2hlbiBhIGlzIGxlc3MsIGFuZCBhIHBvc2l0aXZlIG51bWJlciBvdGhlcndpc2UuXG4gIHZhciBjbXAgPSBDb2RlTWlycm9yLmNtcFBvcyA9IGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIGEubGluZSAtIGIubGluZSB8fCBhLmNoIC0gYi5jaDsgfTtcblxuICBmdW5jdGlvbiBjb3B5UG9zKHgpIHtyZXR1cm4gUG9zKHgubGluZSwgeC5jaCk7fVxuICBmdW5jdGlvbiBtYXhQb3MoYSwgYikgeyByZXR1cm4gY21wKGEsIGIpIDwgMCA/IGIgOiBhOyB9XG4gIGZ1bmN0aW9uIG1pblBvcyhhLCBiKSB7IHJldHVybiBjbXAoYSwgYikgPCAwID8gYSA6IGI7IH1cblxuICAvLyBJTlBVVCBIQU5ETElOR1xuXG4gIGZ1bmN0aW9uIGVuc3VyZUZvY3VzKGNtKSB7XG4gICAgaWYgKCFjbS5zdGF0ZS5mb2N1c2VkKSB7IGNtLmRpc3BsYXkuaW5wdXQuZm9jdXMoKTsgb25Gb2N1cyhjbSk7IH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGlzUmVhZE9ubHkoY20pIHtcbiAgICByZXR1cm4gY20ub3B0aW9ucy5yZWFkT25seSB8fCBjbS5kb2MuY2FudEVkaXQ7XG4gIH1cblxuICAvLyBUaGlzIHdpbGwgYmUgc2V0IHRvIGFuIGFycmF5IG9mIHN0cmluZ3Mgd2hlbiBjb3B5aW5nLCBzbyB0aGF0LFxuICAvLyB3aGVuIHBhc3RpbmcsIHdlIGtub3cgd2hhdCBraW5kIG9mIHNlbGVjdGlvbnMgdGhlIGNvcGllZCB0ZXh0XG4gIC8vIHdhcyBtYWRlIG91dCBvZi5cbiAgdmFyIGxhc3RDb3BpZWQgPSBudWxsO1xuXG4gIGZ1bmN0aW9uIGFwcGx5VGV4dElucHV0KGNtLCBpbnNlcnRlZCwgZGVsZXRlZCwgc2VsLCBvcmlnaW4pIHtcbiAgICB2YXIgZG9jID0gY20uZG9jO1xuICAgIGNtLmRpc3BsYXkuc2hpZnQgPSBmYWxzZTtcbiAgICBpZiAoIXNlbCkgc2VsID0gZG9jLnNlbDtcblxuICAgIHZhciBwYXN0ZSA9IGNtLnN0YXRlLnBhc3RlSW5jb21pbmcgfHwgb3JpZ2luID09IFwicGFzdGVcIjtcbiAgICB2YXIgdGV4dExpbmVzID0gZG9jLnNwbGl0TGluZXMoaW5zZXJ0ZWQpLCBtdWx0aVBhc3RlID0gbnVsbDtcbiAgICAvLyBXaGVuIHBhc2luZyBOIGxpbmVzIGludG8gTiBzZWxlY3Rpb25zLCBpbnNlcnQgb25lIGxpbmUgcGVyIHNlbGVjdGlvblxuICAgIGlmIChwYXN0ZSAmJiBzZWwucmFuZ2VzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGlmIChsYXN0Q29waWVkICYmIGxhc3RDb3BpZWQuam9pbihcIlxcblwiKSA9PSBpbnNlcnRlZCkge1xuICAgICAgICBpZiAoc2VsLnJhbmdlcy5sZW5ndGggJSBsYXN0Q29waWVkLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgbXVsdGlQYXN0ZSA9IFtdO1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGFzdENvcGllZC5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIG11bHRpUGFzdGUucHVzaChkb2Muc3BsaXRMaW5lcyhsYXN0Q29waWVkW2ldKSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodGV4dExpbmVzLmxlbmd0aCA9PSBzZWwucmFuZ2VzLmxlbmd0aCkge1xuICAgICAgICBtdWx0aVBhc3RlID0gbWFwKHRleHRMaW5lcywgZnVuY3Rpb24obCkgeyByZXR1cm4gW2xdOyB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOb3JtYWwgYmVoYXZpb3IgaXMgdG8gaW5zZXJ0IHRoZSBuZXcgdGV4dCBpbnRvIGV2ZXJ5IHNlbGVjdGlvblxuICAgIGZvciAodmFyIGkgPSBzZWwucmFuZ2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB2YXIgcmFuZ2UgPSBzZWwucmFuZ2VzW2ldO1xuICAgICAgdmFyIGZyb20gPSByYW5nZS5mcm9tKCksIHRvID0gcmFuZ2UudG8oKTtcbiAgICAgIGlmIChyYW5nZS5lbXB0eSgpKSB7XG4gICAgICAgIGlmIChkZWxldGVkICYmIGRlbGV0ZWQgPiAwKSAvLyBIYW5kbGUgZGVsZXRpb25cbiAgICAgICAgICBmcm9tID0gUG9zKGZyb20ubGluZSwgZnJvbS5jaCAtIGRlbGV0ZWQpO1xuICAgICAgICBlbHNlIGlmIChjbS5zdGF0ZS5vdmVyd3JpdGUgJiYgIXBhc3RlKSAvLyBIYW5kbGUgb3ZlcndyaXRlXG4gICAgICAgICAgdG8gPSBQb3ModG8ubGluZSwgTWF0aC5taW4oZ2V0TGluZShkb2MsIHRvLmxpbmUpLnRleHQubGVuZ3RoLCB0by5jaCArIGxzdCh0ZXh0TGluZXMpLmxlbmd0aCkpO1xuICAgICAgfVxuICAgICAgdmFyIHVwZGF0ZUlucHV0ID0gY20uY3VyT3AudXBkYXRlSW5wdXQ7XG4gICAgICB2YXIgY2hhbmdlRXZlbnQgPSB7ZnJvbTogZnJvbSwgdG86IHRvLCB0ZXh0OiBtdWx0aVBhc3RlID8gbXVsdGlQYXN0ZVtpICUgbXVsdGlQYXN0ZS5sZW5ndGhdIDogdGV4dExpbmVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpbjogb3JpZ2luIHx8IChwYXN0ZSA/IFwicGFzdGVcIiA6IGNtLnN0YXRlLmN1dEluY29taW5nID8gXCJjdXRcIiA6IFwiK2lucHV0XCIpfTtcbiAgICAgIG1ha2VDaGFuZ2UoY20uZG9jLCBjaGFuZ2VFdmVudCk7XG4gICAgICBzaWduYWxMYXRlcihjbSwgXCJpbnB1dFJlYWRcIiwgY20sIGNoYW5nZUV2ZW50KTtcbiAgICB9XG4gICAgaWYgKGluc2VydGVkICYmICFwYXN0ZSlcbiAgICAgIHRyaWdnZXJFbGVjdHJpYyhjbSwgaW5zZXJ0ZWQpO1xuXG4gICAgZW5zdXJlQ3Vyc29yVmlzaWJsZShjbSk7XG4gICAgY20uY3VyT3AudXBkYXRlSW5wdXQgPSB1cGRhdGVJbnB1dDtcbiAgICBjbS5jdXJPcC50eXBpbmcgPSB0cnVlO1xuICAgIGNtLnN0YXRlLnBhc3RlSW5jb21pbmcgPSBjbS5zdGF0ZS5jdXRJbmNvbWluZyA9IGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24gaGFuZGxlUGFzdGUoZSwgY20pIHtcbiAgICB2YXIgcGFzdGVkID0gZS5jbGlwYm9hcmREYXRhICYmIGUuY2xpcGJvYXJkRGF0YS5nZXREYXRhKFwidGV4dC9wbGFpblwiKTtcbiAgICBpZiAocGFzdGVkKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBpZiAoIWlzUmVhZE9ubHkoY20pICYmICFjbS5vcHRpb25zLmRpc2FibGVJbnB1dClcbiAgICAgICAgcnVuSW5PcChjbSwgZnVuY3Rpb24oKSB7IGFwcGx5VGV4dElucHV0KGNtLCBwYXN0ZWQsIDAsIG51bGwsIFwicGFzdGVcIik7IH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdHJpZ2dlckVsZWN0cmljKGNtLCBpbnNlcnRlZCkge1xuICAgIC8vIFdoZW4gYW4gJ2VsZWN0cmljJyBjaGFyYWN0ZXIgaXMgaW5zZXJ0ZWQsIGltbWVkaWF0ZWx5IHRyaWdnZXIgYSByZWluZGVudFxuICAgIGlmICghY20ub3B0aW9ucy5lbGVjdHJpY0NoYXJzIHx8ICFjbS5vcHRpb25zLnNtYXJ0SW5kZW50KSByZXR1cm47XG4gICAgdmFyIHNlbCA9IGNtLmRvYy5zZWw7XG5cbiAgICBmb3IgKHZhciBpID0gc2VsLnJhbmdlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdmFyIHJhbmdlID0gc2VsLnJhbmdlc1tpXTtcbiAgICAgIGlmIChyYW5nZS5oZWFkLmNoID4gMTAwIHx8IChpICYmIHNlbC5yYW5nZXNbaSAtIDFdLmhlYWQubGluZSA9PSByYW5nZS5oZWFkLmxpbmUpKSBjb250aW51ZTtcbiAgICAgIHZhciBtb2RlID0gY20uZ2V0TW9kZUF0KHJhbmdlLmhlYWQpO1xuICAgICAgdmFyIGluZGVudGVkID0gZmFsc2U7XG4gICAgICBpZiAobW9kZS5lbGVjdHJpY0NoYXJzKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbW9kZS5lbGVjdHJpY0NoYXJzLmxlbmd0aDsgaisrKVxuICAgICAgICAgIGlmIChpbnNlcnRlZC5pbmRleE9mKG1vZGUuZWxlY3RyaWNDaGFycy5jaGFyQXQoaikpID4gLTEpIHtcbiAgICAgICAgICAgIGluZGVudGVkID0gaW5kZW50TGluZShjbSwgcmFuZ2UuaGVhZC5saW5lLCBcInNtYXJ0XCIpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChtb2RlLmVsZWN0cmljSW5wdXQpIHtcbiAgICAgICAgaWYgKG1vZGUuZWxlY3RyaWNJbnB1dC50ZXN0KGdldExpbmUoY20uZG9jLCByYW5nZS5oZWFkLmxpbmUpLnRleHQuc2xpY2UoMCwgcmFuZ2UuaGVhZC5jaCkpKVxuICAgICAgICAgIGluZGVudGVkID0gaW5kZW50TGluZShjbSwgcmFuZ2UuaGVhZC5saW5lLCBcInNtYXJ0XCIpO1xuICAgICAgfVxuICAgICAgaWYgKGluZGVudGVkKSBzaWduYWxMYXRlcihjbSwgXCJlbGVjdHJpY0lucHV0XCIsIGNtLCByYW5nZS5oZWFkLmxpbmUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvcHlhYmxlUmFuZ2VzKGNtKSB7XG4gICAgdmFyIHRleHQgPSBbXSwgcmFuZ2VzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjbS5kb2Muc2VsLnJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGxpbmUgPSBjbS5kb2Muc2VsLnJhbmdlc1tpXS5oZWFkLmxpbmU7XG4gICAgICB2YXIgbGluZVJhbmdlID0ge2FuY2hvcjogUG9zKGxpbmUsIDApLCBoZWFkOiBQb3MobGluZSArIDEsIDApfTtcbiAgICAgIHJhbmdlcy5wdXNoKGxpbmVSYW5nZSk7XG4gICAgICB0ZXh0LnB1c2goY20uZ2V0UmFuZ2UobGluZVJhbmdlLmFuY2hvciwgbGluZVJhbmdlLmhlYWQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHt0ZXh0OiB0ZXh0LCByYW5nZXM6IHJhbmdlc307XG4gIH1cblxuICBmdW5jdGlvbiBkaXNhYmxlQnJvd3Nlck1hZ2ljKGZpZWxkKSB7XG4gICAgZmllbGQuc2V0QXR0cmlidXRlKFwiYXV0b2NvcnJlY3RcIiwgXCJvZmZcIik7XG4gICAgZmllbGQuc2V0QXR0cmlidXRlKFwiYXV0b2NhcGl0YWxpemVcIiwgXCJvZmZcIik7XG4gICAgZmllbGQuc2V0QXR0cmlidXRlKFwic3BlbGxjaGVja1wiLCBcImZhbHNlXCIpO1xuICB9XG5cbiAgLy8gVEVYVEFSRUEgSU5QVVQgU1RZTEVcblxuICBmdW5jdGlvbiBUZXh0YXJlYUlucHV0KGNtKSB7XG4gICAgdGhpcy5jbSA9IGNtO1xuICAgIC8vIFNlZSBpbnB1dC5wb2xsIGFuZCBpbnB1dC5yZXNldFxuICAgIHRoaXMucHJldklucHV0ID0gXCJcIjtcblxuICAgIC8vIEZsYWcgdGhhdCBpbmRpY2F0ZXMgd2hldGhlciB3ZSBleHBlY3QgaW5wdXQgdG8gYXBwZWFyIHJlYWwgc29vblxuICAgIC8vIG5vdyAoYWZ0ZXIgc29tZSBldmVudCBsaWtlICdrZXlwcmVzcycgb3IgJ2lucHV0JykgYW5kIGFyZVxuICAgIC8vIHBvbGxpbmcgaW50ZW5zaXZlbHkuXG4gICAgdGhpcy5wb2xsaW5nRmFzdCA9IGZhbHNlO1xuICAgIC8vIFNlbGYtcmVzZXR0aW5nIHRpbWVvdXQgZm9yIHRoZSBwb2xsZXJcbiAgICB0aGlzLnBvbGxpbmcgPSBuZXcgRGVsYXllZCgpO1xuICAgIC8vIFRyYWNrcyB3aGVuIGlucHV0LnJlc2V0IGhhcyBwdW50ZWQgdG8ganVzdCBwdXR0aW5nIGEgc2hvcnRcbiAgICAvLyBzdHJpbmcgaW50byB0aGUgdGV4dGFyZWEgaW5zdGVhZCBvZiB0aGUgZnVsbCBzZWxlY3Rpb24uXG4gICAgdGhpcy5pbmFjY3VyYXRlU2VsZWN0aW9uID0gZmFsc2U7XG4gICAgLy8gVXNlZCB0byB3b3JrIGFyb3VuZCBJRSBpc3N1ZSB3aXRoIHNlbGVjdGlvbiBiZWluZyBmb3Jnb3R0ZW4gd2hlbiBmb2N1cyBtb3ZlcyBhd2F5IGZyb20gdGV4dGFyZWFcbiAgICB0aGlzLmhhc1NlbGVjdGlvbiA9IGZhbHNlO1xuICAgIHRoaXMuY29tcG9zaW5nID0gbnVsbDtcbiAgfTtcblxuICBmdW5jdGlvbiBoaWRkZW5UZXh0YXJlYSgpIHtcbiAgICB2YXIgdGUgPSBlbHQoXCJ0ZXh0YXJlYVwiLCBudWxsLCBudWxsLCBcInBvc2l0aW9uOiBhYnNvbHV0ZTsgcGFkZGluZzogMDsgd2lkdGg6IDFweDsgaGVpZ2h0OiAxZW07IG91dGxpbmU6IG5vbmVcIik7XG4gICAgdmFyIGRpdiA9IGVsdChcImRpdlwiLCBbdGVdLCBudWxsLCBcIm92ZXJmbG93OiBoaWRkZW47IHBvc2l0aW9uOiByZWxhdGl2ZTsgd2lkdGg6IDNweDsgaGVpZ2h0OiAwcHg7XCIpO1xuICAgIC8vIFRoZSB0ZXh0YXJlYSBpcyBrZXB0IHBvc2l0aW9uZWQgbmVhciB0aGUgY3Vyc29yIHRvIHByZXZlbnQgdGhlXG4gICAgLy8gZmFjdCB0aGF0IGl0J2xsIGJlIHNjcm9sbGVkIGludG8gdmlldyBvbiBpbnB1dCBmcm9tIHNjcm9sbGluZ1xuICAgIC8vIG91ciBmYWtlIGN1cnNvciBvdXQgb2Ygdmlldy4gT24gd2Via2l0LCB3aGVuIHdyYXA9b2ZmLCBwYXN0ZSBpc1xuICAgIC8vIHZlcnkgc2xvdy4gU28gbWFrZSB0aGUgYXJlYSB3aWRlIGluc3RlYWQuXG4gICAgaWYgKHdlYmtpdCkgdGUuc3R5bGUud2lkdGggPSBcIjEwMDBweFwiO1xuICAgIGVsc2UgdGUuc2V0QXR0cmlidXRlKFwid3JhcFwiLCBcIm9mZlwiKTtcbiAgICAvLyBJZiBib3JkZXI6IDA7IC0tIGlPUyBmYWlscyB0byBvcGVuIGtleWJvYXJkIChpc3N1ZSAjMTI4NylcbiAgICBpZiAoaW9zKSB0ZS5zdHlsZS5ib3JkZXIgPSBcIjFweCBzb2xpZCBibGFja1wiO1xuICAgIGRpc2FibGVCcm93c2VyTWFnaWModGUpO1xuICAgIHJldHVybiBkaXY7XG4gIH1cblxuICBUZXh0YXJlYUlucHV0LnByb3RvdHlwZSA9IGNvcHlPYmooe1xuICAgIGluaXQ6IGZ1bmN0aW9uKGRpc3BsYXkpIHtcbiAgICAgIHZhciBpbnB1dCA9IHRoaXMsIGNtID0gdGhpcy5jbTtcblxuICAgICAgLy8gV3JhcHMgYW5kIGhpZGVzIGlucHV0IHRleHRhcmVhXG4gICAgICB2YXIgZGl2ID0gdGhpcy53cmFwcGVyID0gaGlkZGVuVGV4dGFyZWEoKTtcbiAgICAgIC8vIFRoZSBzZW1paGlkZGVuIHRleHRhcmVhIHRoYXQgaXMgZm9jdXNlZCB3aGVuIHRoZSBlZGl0b3IgaXNcbiAgICAgIC8vIGZvY3VzZWQsIGFuZCByZWNlaXZlcyBpbnB1dC5cbiAgICAgIHZhciB0ZSA9IHRoaXMudGV4dGFyZWEgPSBkaXYuZmlyc3RDaGlsZDtcbiAgICAgIGRpc3BsYXkud3JhcHBlci5pbnNlcnRCZWZvcmUoZGl2LCBkaXNwbGF5LndyYXBwZXIuZmlyc3RDaGlsZCk7XG5cbiAgICAgIC8vIE5lZWRlZCB0byBoaWRlIGJpZyBibHVlIGJsaW5raW5nIGN1cnNvciBvbiBNb2JpbGUgU2FmYXJpIChkb2Vzbid0IHNlZW0gdG8gd29yayBpbiBpT1MgOCBhbnltb3JlKVxuICAgICAgaWYgKGlvcykgdGUuc3R5bGUud2lkdGggPSBcIjBweFwiO1xuXG4gICAgICBvbih0ZSwgXCJpbnB1dFwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGllICYmIGllX3ZlcnNpb24gPj0gOSAmJiBpbnB1dC5oYXNTZWxlY3Rpb24pIGlucHV0Lmhhc1NlbGVjdGlvbiA9IG51bGw7XG4gICAgICAgIGlucHV0LnBvbGwoKTtcbiAgICAgIH0pO1xuXG4gICAgICBvbih0ZSwgXCJwYXN0ZVwiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChoYW5kbGVQYXN0ZShlLCBjbSkpIHJldHVybiB0cnVlO1xuXG4gICAgICAgIGNtLnN0YXRlLnBhc3RlSW5jb21pbmcgPSB0cnVlO1xuICAgICAgICBpbnB1dC5mYXN0UG9sbCgpO1xuICAgICAgfSk7XG5cbiAgICAgIGZ1bmN0aW9uIHByZXBhcmVDb3B5Q3V0KGUpIHtcbiAgICAgICAgaWYgKGNtLnNvbWV0aGluZ1NlbGVjdGVkKCkpIHtcbiAgICAgICAgICBsYXN0Q29waWVkID0gY20uZ2V0U2VsZWN0aW9ucygpO1xuICAgICAgICAgIGlmIChpbnB1dC5pbmFjY3VyYXRlU2VsZWN0aW9uKSB7XG4gICAgICAgICAgICBpbnB1dC5wcmV2SW5wdXQgPSBcIlwiO1xuICAgICAgICAgICAgaW5wdXQuaW5hY2N1cmF0ZVNlbGVjdGlvbiA9IGZhbHNlO1xuICAgICAgICAgICAgdGUudmFsdWUgPSBsYXN0Q29waWVkLmpvaW4oXCJcXG5cIik7XG4gICAgICAgICAgICBzZWxlY3RJbnB1dCh0ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKCFjbS5vcHRpb25zLmxpbmVXaXNlQ29weUN1dCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgcmFuZ2VzID0gY29weWFibGVSYW5nZXMoY20pO1xuICAgICAgICAgIGxhc3RDb3BpZWQgPSByYW5nZXMudGV4dDtcbiAgICAgICAgICBpZiAoZS50eXBlID09IFwiY3V0XCIpIHtcbiAgICAgICAgICAgIGNtLnNldFNlbGVjdGlvbnMocmFuZ2VzLnJhbmdlcywgbnVsbCwgc2VsX2RvbnRTY3JvbGwpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnB1dC5wcmV2SW5wdXQgPSBcIlwiO1xuICAgICAgICAgICAgdGUudmFsdWUgPSByYW5nZXMudGV4dC5qb2luKFwiXFxuXCIpO1xuICAgICAgICAgICAgc2VsZWN0SW5wdXQodGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZS50eXBlID09IFwiY3V0XCIpIGNtLnN0YXRlLmN1dEluY29taW5nID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIG9uKHRlLCBcImN1dFwiLCBwcmVwYXJlQ29weUN1dCk7XG4gICAgICBvbih0ZSwgXCJjb3B5XCIsIHByZXBhcmVDb3B5Q3V0KTtcblxuICAgICAgb24oZGlzcGxheS5zY3JvbGxlciwgXCJwYXN0ZVwiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChldmVudEluV2lkZ2V0KGRpc3BsYXksIGUpKSByZXR1cm47XG4gICAgICAgIGNtLnN0YXRlLnBhc3RlSW5jb21pbmcgPSB0cnVlO1xuICAgICAgICBpbnB1dC5mb2N1cygpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFByZXZlbnQgbm9ybWFsIHNlbGVjdGlvbiBpbiB0aGUgZWRpdG9yICh3ZSBoYW5kbGUgb3VyIG93bilcbiAgICAgIG9uKGRpc3BsYXkubGluZVNwYWNlLCBcInNlbGVjdHN0YXJ0XCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKCFldmVudEluV2lkZ2V0KGRpc3BsYXksIGUpKSBlX3ByZXZlbnREZWZhdWx0KGUpO1xuICAgICAgfSk7XG5cbiAgICAgIG9uKHRlLCBcImNvbXBvc2l0aW9uc3RhcnRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGFydCA9IGNtLmdldEN1cnNvcihcImZyb21cIik7XG4gICAgICAgIGlmIChpbnB1dC5jb21wb3NpbmcpIGlucHV0LmNvbXBvc2luZy5yYW5nZS5jbGVhcigpXG4gICAgICAgIGlucHV0LmNvbXBvc2luZyA9IHtcbiAgICAgICAgICBzdGFydDogc3RhcnQsXG4gICAgICAgICAgcmFuZ2U6IGNtLm1hcmtUZXh0KHN0YXJ0LCBjbS5nZXRDdXJzb3IoXCJ0b1wiKSwge2NsYXNzTmFtZTogXCJDb2RlTWlycm9yLWNvbXBvc2luZ1wifSlcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgICAgb24odGUsIFwiY29tcG9zaXRpb25lbmRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChpbnB1dC5jb21wb3NpbmcpIHtcbiAgICAgICAgICBpbnB1dC5wb2xsKCk7XG4gICAgICAgICAgaW5wdXQuY29tcG9zaW5nLnJhbmdlLmNsZWFyKCk7XG4gICAgICAgICAgaW5wdXQuY29tcG9zaW5nID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcblxuICAgIHByZXBhcmVTZWxlY3Rpb246IGZ1bmN0aW9uKCkge1xuICAgICAgLy8gUmVkcmF3IHRoZSBzZWxlY3Rpb24gYW5kL29yIGN1cnNvclxuICAgICAgdmFyIGNtID0gdGhpcy5jbSwgZGlzcGxheSA9IGNtLmRpc3BsYXksIGRvYyA9IGNtLmRvYztcbiAgICAgIHZhciByZXN1bHQgPSBwcmVwYXJlU2VsZWN0aW9uKGNtKTtcblxuICAgICAgLy8gTW92ZSB0aGUgaGlkZGVuIHRleHRhcmVhIG5lYXIgdGhlIGN1cnNvciB0byBwcmV2ZW50IHNjcm9sbGluZyBhcnRpZmFjdHNcbiAgICAgIGlmIChjbS5vcHRpb25zLm1vdmVJbnB1dFdpdGhDdXJzb3IpIHtcbiAgICAgICAgdmFyIGhlYWRQb3MgPSBjdXJzb3JDb29yZHMoY20sIGRvYy5zZWwucHJpbWFyeSgpLmhlYWQsIFwiZGl2XCIpO1xuICAgICAgICB2YXIgd3JhcE9mZiA9IGRpc3BsYXkud3JhcHBlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSwgbGluZU9mZiA9IGRpc3BsYXkubGluZURpdi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgcmVzdWx0LnRlVG9wID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oZGlzcGxheS53cmFwcGVyLmNsaWVudEhlaWdodCAtIDEwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkUG9zLnRvcCArIGxpbmVPZmYudG9wIC0gd3JhcE9mZi50b3ApKTtcbiAgICAgICAgcmVzdWx0LnRlTGVmdCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGRpc3BsYXkud3JhcHBlci5jbGllbnRXaWR0aCAtIDEwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZFBvcy5sZWZ0ICsgbGluZU9mZi5sZWZ0IC0gd3JhcE9mZi5sZWZ0KSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHNob3dTZWxlY3Rpb246IGZ1bmN0aW9uKGRyYXduKSB7XG4gICAgICB2YXIgY20gPSB0aGlzLmNtLCBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgICAgIHJlbW92ZUNoaWxkcmVuQW5kQWRkKGRpc3BsYXkuY3Vyc29yRGl2LCBkcmF3bi5jdXJzb3JzKTtcbiAgICAgIHJlbW92ZUNoaWxkcmVuQW5kQWRkKGRpc3BsYXkuc2VsZWN0aW9uRGl2LCBkcmF3bi5zZWxlY3Rpb24pO1xuICAgICAgaWYgKGRyYXduLnRlVG9wICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy53cmFwcGVyLnN0eWxlLnRvcCA9IGRyYXduLnRlVG9wICsgXCJweFwiO1xuICAgICAgICB0aGlzLndyYXBwZXIuc3R5bGUubGVmdCA9IGRyYXduLnRlTGVmdCArIFwicHhcIjtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gUmVzZXQgdGhlIGlucHV0IHRvIGNvcnJlc3BvbmQgdG8gdGhlIHNlbGVjdGlvbiAob3IgdG8gYmUgZW1wdHksXG4gICAgLy8gd2hlbiBub3QgdHlwaW5nIGFuZCBub3RoaW5nIGlzIHNlbGVjdGVkKVxuICAgIHJlc2V0OiBmdW5jdGlvbih0eXBpbmcpIHtcbiAgICAgIGlmICh0aGlzLmNvbnRleHRNZW51UGVuZGluZykgcmV0dXJuO1xuICAgICAgdmFyIG1pbmltYWwsIHNlbGVjdGVkLCBjbSA9IHRoaXMuY20sIGRvYyA9IGNtLmRvYztcbiAgICAgIGlmIChjbS5zb21ldGhpbmdTZWxlY3RlZCgpKSB7XG4gICAgICAgIHRoaXMucHJldklucHV0ID0gXCJcIjtcbiAgICAgICAgdmFyIHJhbmdlID0gZG9jLnNlbC5wcmltYXJ5KCk7XG4gICAgICAgIG1pbmltYWwgPSBoYXNDb3B5RXZlbnQgJiZcbiAgICAgICAgICAocmFuZ2UudG8oKS5saW5lIC0gcmFuZ2UuZnJvbSgpLmxpbmUgPiAxMDAgfHwgKHNlbGVjdGVkID0gY20uZ2V0U2VsZWN0aW9uKCkpLmxlbmd0aCA+IDEwMDApO1xuICAgICAgICB2YXIgY29udGVudCA9IG1pbmltYWwgPyBcIi1cIiA6IHNlbGVjdGVkIHx8IGNtLmdldFNlbGVjdGlvbigpO1xuICAgICAgICB0aGlzLnRleHRhcmVhLnZhbHVlID0gY29udGVudDtcbiAgICAgICAgaWYgKGNtLnN0YXRlLmZvY3VzZWQpIHNlbGVjdElucHV0KHRoaXMudGV4dGFyZWEpO1xuICAgICAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA+PSA5KSB0aGlzLmhhc1NlbGVjdGlvbiA9IGNvbnRlbnQ7XG4gICAgICB9IGVsc2UgaWYgKCF0eXBpbmcpIHtcbiAgICAgICAgdGhpcy5wcmV2SW5wdXQgPSB0aGlzLnRleHRhcmVhLnZhbHVlID0gXCJcIjtcbiAgICAgICAgaWYgKGllICYmIGllX3ZlcnNpb24gPj0gOSkgdGhpcy5oYXNTZWxlY3Rpb24gPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5pbmFjY3VyYXRlU2VsZWN0aW9uID0gbWluaW1hbDtcbiAgICB9LFxuXG4gICAgZ2V0RmllbGQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy50ZXh0YXJlYTsgfSxcblxuICAgIHN1cHBvcnRzVG91Y2g6IGZ1bmN0aW9uKCkgeyByZXR1cm4gZmFsc2U7IH0sXG5cbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5jbS5vcHRpb25zLnJlYWRPbmx5ICE9IFwibm9jdXJzb3JcIiAmJiAoIW1vYmlsZSB8fCBhY3RpdmVFbHQoKSAhPSB0aGlzLnRleHRhcmVhKSkge1xuICAgICAgICB0cnkgeyB0aGlzLnRleHRhcmVhLmZvY3VzKCk7IH1cbiAgICAgICAgY2F0Y2ggKGUpIHt9IC8vIElFOCB3aWxsIHRocm93IGlmIHRoZSB0ZXh0YXJlYSBpcyBkaXNwbGF5OiBub25lIG9yIG5vdCBpbiBET01cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgYmx1cjogZnVuY3Rpb24oKSB7IHRoaXMudGV4dGFyZWEuYmx1cigpOyB9LFxuXG4gICAgcmVzZXRQb3NpdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLndyYXBwZXIuc3R5bGUudG9wID0gdGhpcy53cmFwcGVyLnN0eWxlLmxlZnQgPSAwO1xuICAgIH0sXG5cbiAgICByZWNlaXZlZEZvY3VzOiBmdW5jdGlvbigpIHsgdGhpcy5zbG93UG9sbCgpOyB9LFxuXG4gICAgLy8gUG9sbCBmb3IgaW5wdXQgY2hhbmdlcywgdXNpbmcgdGhlIG5vcm1hbCByYXRlIG9mIHBvbGxpbmcuIFRoaXNcbiAgICAvLyBydW5zIGFzIGxvbmcgYXMgdGhlIGVkaXRvciBpcyBmb2N1c2VkLlxuICAgIHNsb3dQb2xsOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpbnB1dCA9IHRoaXM7XG4gICAgICBpZiAoaW5wdXQucG9sbGluZ0Zhc3QpIHJldHVybjtcbiAgICAgIGlucHV0LnBvbGxpbmcuc2V0KHRoaXMuY20ub3B0aW9ucy5wb2xsSW50ZXJ2YWwsIGZ1bmN0aW9uKCkge1xuICAgICAgICBpbnB1dC5wb2xsKCk7XG4gICAgICAgIGlmIChpbnB1dC5jbS5zdGF0ZS5mb2N1c2VkKSBpbnB1dC5zbG93UG9sbCgpO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8vIFdoZW4gYW4gZXZlbnQgaGFzIGp1c3QgY29tZSBpbiB0aGF0IGlzIGxpa2VseSB0byBhZGQgb3IgY2hhbmdlXG4gICAgLy8gc29tZXRoaW5nIGluIHRoZSBpbnB1dCB0ZXh0YXJlYSwgd2UgcG9sbCBmYXN0ZXIsIHRvIGVuc3VyZSB0aGF0XG4gICAgLy8gdGhlIGNoYW5nZSBhcHBlYXJzIG9uIHRoZSBzY3JlZW4gcXVpY2tseS5cbiAgICBmYXN0UG9sbDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbWlzc2VkID0gZmFsc2UsIGlucHV0ID0gdGhpcztcbiAgICAgIGlucHV0LnBvbGxpbmdGYXN0ID0gdHJ1ZTtcbiAgICAgIGZ1bmN0aW9uIHAoKSB7XG4gICAgICAgIHZhciBjaGFuZ2VkID0gaW5wdXQucG9sbCgpO1xuICAgICAgICBpZiAoIWNoYW5nZWQgJiYgIW1pc3NlZCkge21pc3NlZCA9IHRydWU7IGlucHV0LnBvbGxpbmcuc2V0KDYwLCBwKTt9XG4gICAgICAgIGVsc2Uge2lucHV0LnBvbGxpbmdGYXN0ID0gZmFsc2U7IGlucHV0LnNsb3dQb2xsKCk7fVxuICAgICAgfVxuICAgICAgaW5wdXQucG9sbGluZy5zZXQoMjAsIHApO1xuICAgIH0sXG5cbiAgICAvLyBSZWFkIGlucHV0IGZyb20gdGhlIHRleHRhcmVhLCBhbmQgdXBkYXRlIHRoZSBkb2N1bWVudCB0byBtYXRjaC5cbiAgICAvLyBXaGVuIHNvbWV0aGluZyBpcyBzZWxlY3RlZCwgaXQgaXMgcHJlc2VudCBpbiB0aGUgdGV4dGFyZWEsIGFuZFxuICAgIC8vIHNlbGVjdGVkICh1bmxlc3MgaXQgaXMgaHVnZSwgaW4gd2hpY2ggY2FzZSBhIHBsYWNlaG9sZGVyIGlzXG4gICAgLy8gdXNlZCkuIFdoZW4gbm90aGluZyBpcyBzZWxlY3RlZCwgdGhlIGN1cnNvciBzaXRzIGFmdGVyIHByZXZpb3VzbHlcbiAgICAvLyBzZWVuIHRleHQgKGNhbiBiZSBlbXB0eSksIHdoaWNoIGlzIHN0b3JlZCBpbiBwcmV2SW5wdXQgKHdlIG11c3RcbiAgICAvLyBub3QgcmVzZXQgdGhlIHRleHRhcmVhIHdoZW4gdHlwaW5nLCBiZWNhdXNlIHRoYXQgYnJlYWtzIElNRSkuXG4gICAgcG9sbDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY20gPSB0aGlzLmNtLCBpbnB1dCA9IHRoaXMudGV4dGFyZWEsIHByZXZJbnB1dCA9IHRoaXMucHJldklucHV0O1xuICAgICAgLy8gU2luY2UgdGhpcyBpcyBjYWxsZWQgYSAqbG90KiwgdHJ5IHRvIGJhaWwgb3V0IGFzIGNoZWFwbHkgYXNcbiAgICAgIC8vIHBvc3NpYmxlIHdoZW4gaXQgaXMgY2xlYXIgdGhhdCBub3RoaW5nIGhhcHBlbmVkLiBoYXNTZWxlY3Rpb25cbiAgICAgIC8vIHdpbGwgYmUgdGhlIGNhc2Ugd2hlbiB0aGVyZSBpcyBhIGxvdCBvZiB0ZXh0IGluIHRoZSB0ZXh0YXJlYSxcbiAgICAgIC8vIGluIHdoaWNoIGNhc2UgcmVhZGluZyBpdHMgdmFsdWUgd291bGQgYmUgZXhwZW5zaXZlLlxuICAgICAgaWYgKHRoaXMuY29udGV4dE1lbnVQZW5kaW5nIHx8ICFjbS5zdGF0ZS5mb2N1c2VkIHx8XG4gICAgICAgICAgKGhhc1NlbGVjdGlvbihpbnB1dCkgJiYgIXByZXZJbnB1dCAmJiAhdGhpcy5jb21wb3NpbmcpIHx8XG4gICAgICAgICAgaXNSZWFkT25seShjbSkgfHwgY20ub3B0aW9ucy5kaXNhYmxlSW5wdXQgfHwgY20uc3RhdGUua2V5U2VxKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIHZhciB0ZXh0ID0gaW5wdXQudmFsdWU7XG4gICAgICAvLyBJZiBub3RoaW5nIGNoYW5nZWQsIGJhaWwuXG4gICAgICBpZiAodGV4dCA9PSBwcmV2SW5wdXQgJiYgIWNtLnNvbWV0aGluZ1NlbGVjdGVkKCkpIHJldHVybiBmYWxzZTtcbiAgICAgIC8vIFdvcmsgYXJvdW5kIG5vbnNlbnNpY2FsIHNlbGVjdGlvbiByZXNldHRpbmcgaW4gSUU5LzEwLCBhbmRcbiAgICAgIC8vIGluZXhwbGljYWJsZSBhcHBlYXJhbmNlIG9mIHByaXZhdGUgYXJlYSB1bmljb2RlIGNoYXJhY3RlcnMgb25cbiAgICAgIC8vIHNvbWUga2V5IGNvbWJvcyBpbiBNYWMgKCMyNjg5KS5cbiAgICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uID49IDkgJiYgdGhpcy5oYXNTZWxlY3Rpb24gPT09IHRleHQgfHxcbiAgICAgICAgICBtYWMgJiYgL1tcXHVmNzAwLVxcdWY3ZmZdLy50ZXN0KHRleHQpKSB7XG4gICAgICAgIGNtLmRpc3BsYXkuaW5wdXQucmVzZXQoKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBpZiAoY20uZG9jLnNlbCA9PSBjbS5kaXNwbGF5LnNlbEZvckNvbnRleHRNZW51KSB7XG4gICAgICAgIHZhciBmaXJzdCA9IHRleHQuY2hhckNvZGVBdCgwKTtcbiAgICAgICAgaWYgKGZpcnN0ID09IDB4MjAwYiAmJiAhcHJldklucHV0KSBwcmV2SW5wdXQgPSBcIlxcdTIwMGJcIjtcbiAgICAgICAgaWYgKGZpcnN0ID09IDB4MjFkYSkgeyB0aGlzLnJlc2V0KCk7IHJldHVybiB0aGlzLmNtLmV4ZWNDb21tYW5kKFwidW5kb1wiKTsgfVxuICAgICAgfVxuICAgICAgLy8gRmluZCB0aGUgcGFydCBvZiB0aGUgaW5wdXQgdGhhdCBpcyBhY3R1YWxseSBuZXdcbiAgICAgIHZhciBzYW1lID0gMCwgbCA9IE1hdGgubWluKHByZXZJbnB1dC5sZW5ndGgsIHRleHQubGVuZ3RoKTtcbiAgICAgIHdoaWxlIChzYW1lIDwgbCAmJiBwcmV2SW5wdXQuY2hhckNvZGVBdChzYW1lKSA9PSB0ZXh0LmNoYXJDb2RlQXQoc2FtZSkpICsrc2FtZTtcblxuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgcnVuSW5PcChjbSwgZnVuY3Rpb24oKSB7XG4gICAgICAgIGFwcGx5VGV4dElucHV0KGNtLCB0ZXh0LnNsaWNlKHNhbWUpLCBwcmV2SW5wdXQubGVuZ3RoIC0gc2FtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgbnVsbCwgc2VsZi5jb21wb3NpbmcgPyBcIipjb21wb3NlXCIgOiBudWxsKTtcblxuICAgICAgICAvLyBEb24ndCBsZWF2ZSBsb25nIHRleHQgaW4gdGhlIHRleHRhcmVhLCBzaW5jZSBpdCBtYWtlcyBmdXJ0aGVyIHBvbGxpbmcgc2xvd1xuICAgICAgICBpZiAodGV4dC5sZW5ndGggPiAxMDAwIHx8IHRleHQuaW5kZXhPZihcIlxcblwiKSA+IC0xKSBpbnB1dC52YWx1ZSA9IHNlbGYucHJldklucHV0ID0gXCJcIjtcbiAgICAgICAgZWxzZSBzZWxmLnByZXZJbnB1dCA9IHRleHQ7XG5cbiAgICAgICAgaWYgKHNlbGYuY29tcG9zaW5nKSB7XG4gICAgICAgICAgc2VsZi5jb21wb3NpbmcucmFuZ2UuY2xlYXIoKTtcbiAgICAgICAgICBzZWxmLmNvbXBvc2luZy5yYW5nZSA9IGNtLm1hcmtUZXh0KHNlbGYuY29tcG9zaW5nLnN0YXJ0LCBjbS5nZXRDdXJzb3IoXCJ0b1wiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjbGFzc05hbWU6IFwiQ29kZU1pcnJvci1jb21wb3NpbmdcIn0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBlbnN1cmVQb2xsZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMucG9sbGluZ0Zhc3QgJiYgdGhpcy5wb2xsKCkpIHRoaXMucG9sbGluZ0Zhc3QgPSBmYWxzZTtcbiAgICB9LFxuXG4gICAgb25LZXlQcmVzczogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA+PSA5KSB0aGlzLmhhc1NlbGVjdGlvbiA9IG51bGw7XG4gICAgICB0aGlzLmZhc3RQb2xsKCk7XG4gICAgfSxcblxuICAgIG9uQ29udGV4dE1lbnU6IGZ1bmN0aW9uKGUpIHtcbiAgICAgIHZhciBpbnB1dCA9IHRoaXMsIGNtID0gaW5wdXQuY20sIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCB0ZSA9IGlucHV0LnRleHRhcmVhO1xuICAgICAgdmFyIHBvcyA9IHBvc0Zyb21Nb3VzZShjbSwgZSksIHNjcm9sbFBvcyA9IGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wO1xuICAgICAgaWYgKCFwb3MgfHwgcHJlc3RvKSByZXR1cm47IC8vIE9wZXJhIGlzIGRpZmZpY3VsdC5cblxuICAgICAgLy8gUmVzZXQgdGhlIGN1cnJlbnQgdGV4dCBzZWxlY3Rpb24gb25seSBpZiB0aGUgY2xpY2sgaXMgZG9uZSBvdXRzaWRlIG9mIHRoZSBzZWxlY3Rpb25cbiAgICAgIC8vIGFuZCAncmVzZXRTZWxlY3Rpb25PbkNvbnRleHRNZW51JyBvcHRpb24gaXMgdHJ1ZS5cbiAgICAgIHZhciByZXNldCA9IGNtLm9wdGlvbnMucmVzZXRTZWxlY3Rpb25PbkNvbnRleHRNZW51O1xuICAgICAgaWYgKHJlc2V0ICYmIGNtLmRvYy5zZWwuY29udGFpbnMocG9zKSA9PSAtMSlcbiAgICAgICAgb3BlcmF0aW9uKGNtLCBzZXRTZWxlY3Rpb24pKGNtLmRvYywgc2ltcGxlU2VsZWN0aW9uKHBvcyksIHNlbF9kb250U2Nyb2xsKTtcblxuICAgICAgdmFyIG9sZENTUyA9IHRlLnN0eWxlLmNzc1RleHQ7XG4gICAgICBpbnB1dC53cmFwcGVyLnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xuICAgICAgdGUuc3R5bGUuY3NzVGV4dCA9IFwicG9zaXRpb246IGZpeGVkOyB3aWR0aDogMzBweDsgaGVpZ2h0OiAzMHB4OyB0b3A6IFwiICsgKGUuY2xpZW50WSAtIDUpICtcbiAgICAgICAgXCJweDsgbGVmdDogXCIgKyAoZS5jbGllbnRYIC0gNSkgKyBcInB4OyB6LWluZGV4OiAxMDAwOyBiYWNrZ3JvdW5kOiBcIiArXG4gICAgICAgIChpZSA/IFwicmdiYSgyNTUsIDI1NSwgMjU1LCAuMDUpXCIgOiBcInRyYW5zcGFyZW50XCIpICtcbiAgICAgICAgXCI7IG91dGxpbmU6IG5vbmU7IGJvcmRlci13aWR0aDogMDsgb3V0bGluZTogbm9uZTsgb3ZlcmZsb3c6IGhpZGRlbjsgb3BhY2l0eTogLjA1OyBmaWx0ZXI6IGFscGhhKG9wYWNpdHk9NSk7XCI7XG4gICAgICBpZiAod2Via2l0KSB2YXIgb2xkU2Nyb2xsWSA9IHdpbmRvdy5zY3JvbGxZOyAvLyBXb3JrIGFyb3VuZCBDaHJvbWUgaXNzdWUgKCMyNzEyKVxuICAgICAgZGlzcGxheS5pbnB1dC5mb2N1cygpO1xuICAgICAgaWYgKHdlYmtpdCkgd2luZG93LnNjcm9sbFRvKG51bGwsIG9sZFNjcm9sbFkpO1xuICAgICAgZGlzcGxheS5pbnB1dC5yZXNldCgpO1xuICAgICAgLy8gQWRkcyBcIlNlbGVjdCBhbGxcIiB0byBjb250ZXh0IG1lbnUgaW4gRkZcbiAgICAgIGlmICghY20uc29tZXRoaW5nU2VsZWN0ZWQoKSkgdGUudmFsdWUgPSBpbnB1dC5wcmV2SW5wdXQgPSBcIiBcIjtcbiAgICAgIGlucHV0LmNvbnRleHRNZW51UGVuZGluZyA9IHRydWU7XG4gICAgICBkaXNwbGF5LnNlbEZvckNvbnRleHRNZW51ID0gY20uZG9jLnNlbDtcbiAgICAgIGNsZWFyVGltZW91dChkaXNwbGF5LmRldGVjdGluZ1NlbGVjdEFsbCk7XG5cbiAgICAgIC8vIFNlbGVjdC1hbGwgd2lsbCBiZSBncmV5ZWQgb3V0IGlmIHRoZXJlJ3Mgbm90aGluZyB0byBzZWxlY3QsIHNvXG4gICAgICAvLyB0aGlzIGFkZHMgYSB6ZXJvLXdpZHRoIHNwYWNlIHNvIHRoYXQgd2UgY2FuIGxhdGVyIGNoZWNrIHdoZXRoZXJcbiAgICAgIC8vIGl0IGdvdCBzZWxlY3RlZC5cbiAgICAgIGZ1bmN0aW9uIHByZXBhcmVTZWxlY3RBbGxIYWNrKCkge1xuICAgICAgICBpZiAodGUuc2VsZWN0aW9uU3RhcnQgIT0gbnVsbCkge1xuICAgICAgICAgIHZhciBzZWxlY3RlZCA9IGNtLnNvbWV0aGluZ1NlbGVjdGVkKCk7XG4gICAgICAgICAgdmFyIGV4dHZhbCA9IFwiXFx1MjAwYlwiICsgKHNlbGVjdGVkID8gdGUudmFsdWUgOiBcIlwiKTtcbiAgICAgICAgICB0ZS52YWx1ZSA9IFwiXFx1MjFkYVwiOyAvLyBVc2VkIHRvIGNhdGNoIGNvbnRleHQtbWVudSB1bmRvXG4gICAgICAgICAgdGUudmFsdWUgPSBleHR2YWw7XG4gICAgICAgICAgaW5wdXQucHJldklucHV0ID0gc2VsZWN0ZWQgPyBcIlwiIDogXCJcXHUyMDBiXCI7XG4gICAgICAgICAgdGUuc2VsZWN0aW9uU3RhcnQgPSAxOyB0ZS5zZWxlY3Rpb25FbmQgPSBleHR2YWwubGVuZ3RoO1xuICAgICAgICAgIC8vIFJlLXNldCB0aGlzLCBpbiBjYXNlIHNvbWUgb3RoZXIgaGFuZGxlciB0b3VjaGVkIHRoZVxuICAgICAgICAgIC8vIHNlbGVjdGlvbiBpbiB0aGUgbWVhbnRpbWUuXG4gICAgICAgICAgZGlzcGxheS5zZWxGb3JDb250ZXh0TWVudSA9IGNtLmRvYy5zZWw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIHJlaGlkZSgpIHtcbiAgICAgICAgaW5wdXQuY29udGV4dE1lbnVQZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIGlucHV0LndyYXBwZXIuc3R5bGUucG9zaXRpb24gPSBcInJlbGF0aXZlXCI7XG4gICAgICAgIHRlLnN0eWxlLmNzc1RleHQgPSBvbGRDU1M7XG4gICAgICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOSkgZGlzcGxheS5zY3JvbGxiYXJzLnNldFNjcm9sbFRvcChkaXNwbGF5LnNjcm9sbGVyLnNjcm9sbFRvcCA9IHNjcm9sbFBvcyk7XG5cbiAgICAgICAgLy8gVHJ5IHRvIGRldGVjdCB0aGUgdXNlciBjaG9vc2luZyBzZWxlY3QtYWxsXG4gICAgICAgIGlmICh0ZS5zZWxlY3Rpb25TdGFydCAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKCFpZSB8fCAoaWUgJiYgaWVfdmVyc2lvbiA8IDkpKSBwcmVwYXJlU2VsZWN0QWxsSGFjaygpO1xuICAgICAgICAgIHZhciBpID0gMCwgcG9sbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKGRpc3BsYXkuc2VsRm9yQ29udGV4dE1lbnUgPT0gY20uZG9jLnNlbCAmJiB0ZS5zZWxlY3Rpb25TdGFydCA9PSAwICYmXG4gICAgICAgICAgICAgICAgdGUuc2VsZWN0aW9uRW5kID4gMCAmJiBpbnB1dC5wcmV2SW5wdXQgPT0gXCJcXHUyMDBiXCIpXG4gICAgICAgICAgICAgIG9wZXJhdGlvbihjbSwgY29tbWFuZHMuc2VsZWN0QWxsKShjbSk7XG4gICAgICAgICAgICBlbHNlIGlmIChpKysgPCAxMCkgZGlzcGxheS5kZXRlY3RpbmdTZWxlY3RBbGwgPSBzZXRUaW1lb3V0KHBvbGwsIDUwMCk7XG4gICAgICAgICAgICBlbHNlIGRpc3BsYXkuaW5wdXQucmVzZXQoKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIGRpc3BsYXkuZGV0ZWN0aW5nU2VsZWN0QWxsID0gc2V0VGltZW91dChwb2xsLCAyMDApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uID49IDkpIHByZXBhcmVTZWxlY3RBbGxIYWNrKCk7XG4gICAgICBpZiAoY2FwdHVyZVJpZ2h0Q2xpY2spIHtcbiAgICAgICAgZV9zdG9wKGUpO1xuICAgICAgICB2YXIgbW91c2V1cCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIG9mZih3aW5kb3csIFwibW91c2V1cFwiLCBtb3VzZXVwKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KHJlaGlkZSwgMjApO1xuICAgICAgICB9O1xuICAgICAgICBvbih3aW5kb3csIFwibW91c2V1cFwiLCBtb3VzZXVwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFRpbWVvdXQocmVoaWRlLCA1MCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIHJlYWRPbmx5Q2hhbmdlZDogZnVuY3Rpb24odmFsKSB7XG4gICAgICBpZiAoIXZhbCkgdGhpcy5yZXNldCgpO1xuICAgIH0sXG5cbiAgICBzZXRVbmVkaXRhYmxlOiBub3RoaW5nLFxuXG4gICAgbmVlZHNDb250ZW50QXR0cmlidXRlOiBmYWxzZVxuICB9LCBUZXh0YXJlYUlucHV0LnByb3RvdHlwZSk7XG5cbiAgLy8gQ09OVEVOVEVESVRBQkxFIElOUFVUIFNUWUxFXG5cbiAgZnVuY3Rpb24gQ29udGVudEVkaXRhYmxlSW5wdXQoY20pIHtcbiAgICB0aGlzLmNtID0gY207XG4gICAgdGhpcy5sYXN0QW5jaG9yTm9kZSA9IHRoaXMubGFzdEFuY2hvck9mZnNldCA9IHRoaXMubGFzdEZvY3VzTm9kZSA9IHRoaXMubGFzdEZvY3VzT2Zmc2V0ID0gbnVsbDtcbiAgICB0aGlzLnBvbGxpbmcgPSBuZXcgRGVsYXllZCgpO1xuICAgIHRoaXMuZ3JhY2VQZXJpb2QgPSBmYWxzZTtcbiAgfVxuXG4gIENvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZSA9IGNvcHlPYmooe1xuICAgIGluaXQ6IGZ1bmN0aW9uKGRpc3BsYXkpIHtcbiAgICAgIHZhciBpbnB1dCA9IHRoaXMsIGNtID0gaW5wdXQuY207XG4gICAgICB2YXIgZGl2ID0gaW5wdXQuZGl2ID0gZGlzcGxheS5saW5lRGl2O1xuICAgICAgZGlzYWJsZUJyb3dzZXJNYWdpYyhkaXYpO1xuXG4gICAgICBvbihkaXYsIFwicGFzdGVcIiwgZnVuY3Rpb24oZSkgeyBoYW5kbGVQYXN0ZShlLCBjbSk7IH0pXG5cbiAgICAgIG9uKGRpdiwgXCJjb21wb3NpdGlvbnN0YXJ0XCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdmFyIGRhdGEgPSBlLmRhdGE7XG4gICAgICAgIGlucHV0LmNvbXBvc2luZyA9IHtzZWw6IGNtLmRvYy5zZWwsIGRhdGE6IGRhdGEsIHN0YXJ0RGF0YTogZGF0YX07XG4gICAgICAgIGlmICghZGF0YSkgcmV0dXJuO1xuICAgICAgICB2YXIgcHJpbSA9IGNtLmRvYy5zZWwucHJpbWFyeSgpO1xuICAgICAgICB2YXIgbGluZSA9IGNtLmdldExpbmUocHJpbS5oZWFkLmxpbmUpO1xuICAgICAgICB2YXIgZm91bmQgPSBsaW5lLmluZGV4T2YoZGF0YSwgTWF0aC5tYXgoMCwgcHJpbS5oZWFkLmNoIC0gZGF0YS5sZW5ndGgpKTtcbiAgICAgICAgaWYgKGZvdW5kID4gLTEgJiYgZm91bmQgPD0gcHJpbS5oZWFkLmNoKVxuICAgICAgICAgIGlucHV0LmNvbXBvc2luZy5zZWwgPSBzaW1wbGVTZWxlY3Rpb24oUG9zKHByaW0uaGVhZC5saW5lLCBmb3VuZCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBQb3MocHJpbS5oZWFkLmxpbmUsIGZvdW5kICsgZGF0YS5sZW5ndGgpKTtcbiAgICAgIH0pO1xuICAgICAgb24oZGl2LCBcImNvbXBvc2l0aW9udXBkYXRlXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaW5wdXQuY29tcG9zaW5nLmRhdGEgPSBlLmRhdGE7XG4gICAgICB9KTtcbiAgICAgIG9uKGRpdiwgXCJjb21wb3NpdGlvbmVuZFwiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIHZhciBvdXJzID0gaW5wdXQuY29tcG9zaW5nO1xuICAgICAgICBpZiAoIW91cnMpIHJldHVybjtcbiAgICAgICAgaWYgKGUuZGF0YSAhPSBvdXJzLnN0YXJ0RGF0YSAmJiAhL1xcdTIwMGIvLnRlc3QoZS5kYXRhKSlcbiAgICAgICAgICBvdXJzLmRhdGEgPSBlLmRhdGE7XG4gICAgICAgIC8vIE5lZWQgYSBzbWFsbCBkZWxheSB0byBwcmV2ZW50IG90aGVyIGNvZGUgKGlucHV0IGV2ZW50LFxuICAgICAgICAvLyBzZWxlY3Rpb24gcG9sbGluZykgZnJvbSBkb2luZyBkYW1hZ2Ugd2hlbiBmaXJlZCByaWdodCBhZnRlclxuICAgICAgICAvLyBjb21wb3NpdGlvbmVuZC5cbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoIW91cnMuaGFuZGxlZClcbiAgICAgICAgICAgIGlucHV0LmFwcGx5Q29tcG9zaXRpb24ob3Vycyk7XG4gICAgICAgICAgaWYgKGlucHV0LmNvbXBvc2luZyA9PSBvdXJzKVxuICAgICAgICAgICAgaW5wdXQuY29tcG9zaW5nID0gbnVsbDtcbiAgICAgICAgfSwgNTApO1xuICAgICAgfSk7XG5cbiAgICAgIG9uKGRpdiwgXCJ0b3VjaHN0YXJ0XCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICBpbnB1dC5mb3JjZUNvbXBvc2l0aW9uRW5kKCk7XG4gICAgICB9KTtcblxuICAgICAgb24oZGl2LCBcImlucHV0XCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoaW5wdXQuY29tcG9zaW5nKSByZXR1cm47XG4gICAgICAgIGlmIChpc1JlYWRPbmx5KGNtKSB8fCAhaW5wdXQucG9sbENvbnRlbnQoKSlcbiAgICAgICAgICBydW5Jbk9wKGlucHV0LmNtLCBmdW5jdGlvbigpIHtyZWdDaGFuZ2UoY20pO30pO1xuICAgICAgfSk7XG5cbiAgICAgIGZ1bmN0aW9uIG9uQ29weUN1dChlKSB7XG4gICAgICAgIGlmIChjbS5zb21ldGhpbmdTZWxlY3RlZCgpKSB7XG4gICAgICAgICAgbGFzdENvcGllZCA9IGNtLmdldFNlbGVjdGlvbnMoKTtcbiAgICAgICAgICBpZiAoZS50eXBlID09IFwiY3V0XCIpIGNtLnJlcGxhY2VTZWxlY3Rpb24oXCJcIiwgbnVsbCwgXCJjdXRcIik7XG4gICAgICAgIH0gZWxzZSBpZiAoIWNtLm9wdGlvbnMubGluZVdpc2VDb3B5Q3V0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciByYW5nZXMgPSBjb3B5YWJsZVJhbmdlcyhjbSk7XG4gICAgICAgICAgbGFzdENvcGllZCA9IHJhbmdlcy50ZXh0O1xuICAgICAgICAgIGlmIChlLnR5cGUgPT0gXCJjdXRcIikge1xuICAgICAgICAgICAgY20ub3BlcmF0aW9uKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBjbS5zZXRTZWxlY3Rpb25zKHJhbmdlcy5yYW5nZXMsIDAsIHNlbF9kb250U2Nyb2xsKTtcbiAgICAgICAgICAgICAgY20ucmVwbGFjZVNlbGVjdGlvbihcIlwiLCBudWxsLCBcImN1dFwiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBpT1MgZXhwb3NlcyB0aGUgY2xpcGJvYXJkIEFQSSwgYnV0IHNlZW1zIHRvIGRpc2NhcmQgY29udGVudCBpbnNlcnRlZCBpbnRvIGl0XG4gICAgICAgIGlmIChlLmNsaXBib2FyZERhdGEgJiYgIWlvcykge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBlLmNsaXBib2FyZERhdGEuY2xlYXJEYXRhKCk7XG4gICAgICAgICAgZS5jbGlwYm9hcmREYXRhLnNldERhdGEoXCJ0ZXh0L3BsYWluXCIsIGxhc3RDb3BpZWQuam9pbihcIlxcblwiKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT2xkLWZhc2hpb25lZCBicmllZmx5LWZvY3VzLWEtdGV4dGFyZWEgaGFja1xuICAgICAgICAgIHZhciBrbHVkZ2UgPSBoaWRkZW5UZXh0YXJlYSgpLCB0ZSA9IGtsdWRnZS5maXJzdENoaWxkO1xuICAgICAgICAgIGNtLmRpc3BsYXkubGluZVNwYWNlLmluc2VydEJlZm9yZShrbHVkZ2UsIGNtLmRpc3BsYXkubGluZVNwYWNlLmZpcnN0Q2hpbGQpO1xuICAgICAgICAgIHRlLnZhbHVlID0gbGFzdENvcGllZC5qb2luKFwiXFxuXCIpO1xuICAgICAgICAgIHZhciBoYWRGb2N1cyA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gICAgICAgICAgc2VsZWN0SW5wdXQodGUpO1xuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjbS5kaXNwbGF5LmxpbmVTcGFjZS5yZW1vdmVDaGlsZChrbHVkZ2UpO1xuICAgICAgICAgICAgaGFkRm9jdXMuZm9jdXMoKTtcbiAgICAgICAgICB9LCA1MCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG9uKGRpdiwgXCJjb3B5XCIsIG9uQ29weUN1dCk7XG4gICAgICBvbihkaXYsIFwiY3V0XCIsIG9uQ29weUN1dCk7XG4gICAgfSxcblxuICAgIHByZXBhcmVTZWxlY3Rpb246IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IHByZXBhcmVTZWxlY3Rpb24odGhpcy5jbSwgZmFsc2UpO1xuICAgICAgcmVzdWx0LmZvY3VzID0gdGhpcy5jbS5zdGF0ZS5mb2N1c2VkO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgc2hvd1NlbGVjdGlvbjogZnVuY3Rpb24oaW5mbykge1xuICAgICAgaWYgKCFpbmZvIHx8ICF0aGlzLmNtLmRpc3BsYXkudmlldy5sZW5ndGgpIHJldHVybjtcbiAgICAgIGlmIChpbmZvLmZvY3VzKSB0aGlzLnNob3dQcmltYXJ5U2VsZWN0aW9uKCk7XG4gICAgICB0aGlzLnNob3dNdWx0aXBsZVNlbGVjdGlvbnMoaW5mbyk7XG4gICAgfSxcblxuICAgIHNob3dQcmltYXJ5U2VsZWN0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWwgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCksIHByaW0gPSB0aGlzLmNtLmRvYy5zZWwucHJpbWFyeSgpO1xuICAgICAgdmFyIGN1ckFuY2hvciA9IGRvbVRvUG9zKHRoaXMuY20sIHNlbC5hbmNob3JOb2RlLCBzZWwuYW5jaG9yT2Zmc2V0KTtcbiAgICAgIHZhciBjdXJGb2N1cyA9IGRvbVRvUG9zKHRoaXMuY20sIHNlbC5mb2N1c05vZGUsIHNlbC5mb2N1c09mZnNldCk7XG4gICAgICBpZiAoY3VyQW5jaG9yICYmICFjdXJBbmNob3IuYmFkICYmIGN1ckZvY3VzICYmICFjdXJGb2N1cy5iYWQgJiZcbiAgICAgICAgICBjbXAobWluUG9zKGN1ckFuY2hvciwgY3VyRm9jdXMpLCBwcmltLmZyb20oKSkgPT0gMCAmJlxuICAgICAgICAgIGNtcChtYXhQb3MoY3VyQW5jaG9yLCBjdXJGb2N1cyksIHByaW0udG8oKSkgPT0gMClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICB2YXIgc3RhcnQgPSBwb3NUb0RPTSh0aGlzLmNtLCBwcmltLmZyb20oKSk7XG4gICAgICB2YXIgZW5kID0gcG9zVG9ET00odGhpcy5jbSwgcHJpbS50bygpKTtcbiAgICAgIGlmICghc3RhcnQgJiYgIWVuZCkgcmV0dXJuO1xuXG4gICAgICB2YXIgdmlldyA9IHRoaXMuY20uZGlzcGxheS52aWV3O1xuICAgICAgdmFyIG9sZCA9IHNlbC5yYW5nZUNvdW50ICYmIHNlbC5nZXRSYW5nZUF0KDApO1xuICAgICAgaWYgKCFzdGFydCkge1xuICAgICAgICBzdGFydCA9IHtub2RlOiB2aWV3WzBdLm1lYXN1cmUubWFwWzJdLCBvZmZzZXQ6IDB9O1xuICAgICAgfSBlbHNlIGlmICghZW5kKSB7IC8vIEZJWE1FIGRhbmdlcm91c2x5IGhhY2t5XG4gICAgICAgIHZhciBtZWFzdXJlID0gdmlld1t2aWV3Lmxlbmd0aCAtIDFdLm1lYXN1cmU7XG4gICAgICAgIHZhciBtYXAgPSBtZWFzdXJlLm1hcHMgPyBtZWFzdXJlLm1hcHNbbWVhc3VyZS5tYXBzLmxlbmd0aCAtIDFdIDogbWVhc3VyZS5tYXA7XG4gICAgICAgIGVuZCA9IHtub2RlOiBtYXBbbWFwLmxlbmd0aCAtIDFdLCBvZmZzZXQ6IG1hcFttYXAubGVuZ3RoIC0gMl0gLSBtYXBbbWFwLmxlbmd0aCAtIDNdfTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHsgdmFyIHJuZyA9IHJhbmdlKHN0YXJ0Lm5vZGUsIHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCwgZW5kLm5vZGUpOyB9XG4gICAgICBjYXRjaChlKSB7fSAvLyBPdXIgbW9kZWwgb2YgdGhlIERPTSBtaWdodCBiZSBvdXRkYXRlZCwgaW4gd2hpY2ggY2FzZSB0aGUgcmFuZ2Ugd2UgdHJ5IHRvIHNldCBjYW4gYmUgaW1wb3NzaWJsZVxuICAgICAgaWYgKHJuZykge1xuICAgICAgICBzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgICAgIHNlbC5hZGRSYW5nZShybmcpO1xuICAgICAgICBpZiAob2xkICYmIHNlbC5hbmNob3JOb2RlID09IG51bGwpIHNlbC5hZGRSYW5nZShvbGQpO1xuICAgICAgICBlbHNlIGlmIChnZWNrbykgdGhpcy5zdGFydEdyYWNlUGVyaW9kKCk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlbWVtYmVyU2VsZWN0aW9uKCk7XG4gICAgfSxcblxuICAgIHN0YXJ0R3JhY2VQZXJpb2Q6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGlucHV0ID0gdGhpcztcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLmdyYWNlUGVyaW9kKTtcbiAgICAgIHRoaXMuZ3JhY2VQZXJpb2QgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBpbnB1dC5ncmFjZVBlcmlvZCA9IGZhbHNlO1xuICAgICAgICBpZiAoaW5wdXQuc2VsZWN0aW9uQ2hhbmdlZCgpKVxuICAgICAgICAgIGlucHV0LmNtLm9wZXJhdGlvbihmdW5jdGlvbigpIHsgaW5wdXQuY20uY3VyT3Auc2VsZWN0aW9uQ2hhbmdlZCA9IHRydWU7IH0pO1xuICAgICAgfSwgMjApO1xuICAgIH0sXG5cbiAgICBzaG93TXVsdGlwbGVTZWxlY3Rpb25zOiBmdW5jdGlvbihpbmZvKSB7XG4gICAgICByZW1vdmVDaGlsZHJlbkFuZEFkZCh0aGlzLmNtLmRpc3BsYXkuY3Vyc29yRGl2LCBpbmZvLmN1cnNvcnMpO1xuICAgICAgcmVtb3ZlQ2hpbGRyZW5BbmRBZGQodGhpcy5jbS5kaXNwbGF5LnNlbGVjdGlvbkRpdiwgaW5mby5zZWxlY3Rpb24pO1xuICAgIH0sXG5cbiAgICByZW1lbWJlclNlbGVjdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc2VsID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xuICAgICAgdGhpcy5sYXN0QW5jaG9yTm9kZSA9IHNlbC5hbmNob3JOb2RlOyB0aGlzLmxhc3RBbmNob3JPZmZzZXQgPSBzZWwuYW5jaG9yT2Zmc2V0O1xuICAgICAgdGhpcy5sYXN0Rm9jdXNOb2RlID0gc2VsLmZvY3VzTm9kZTsgdGhpcy5sYXN0Rm9jdXNPZmZzZXQgPSBzZWwuZm9jdXNPZmZzZXQ7XG4gICAgfSxcblxuICAgIHNlbGVjdGlvbkluRWRpdG9yOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWwgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG4gICAgICBpZiAoIXNlbC5yYW5nZUNvdW50KSByZXR1cm4gZmFsc2U7XG4gICAgICB2YXIgbm9kZSA9IHNlbC5nZXRSYW5nZUF0KDApLmNvbW1vbkFuY2VzdG9yQ29udGFpbmVyO1xuICAgICAgcmV0dXJuIGNvbnRhaW5zKHRoaXMuZGl2LCBub2RlKTtcbiAgICB9LFxuXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY20ub3B0aW9ucy5yZWFkT25seSAhPSBcIm5vY3Vyc29yXCIpIHRoaXMuZGl2LmZvY3VzKCk7XG4gICAgfSxcbiAgICBibHVyOiBmdW5jdGlvbigpIHsgdGhpcy5kaXYuYmx1cigpOyB9LFxuICAgIGdldEZpZWxkOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZGl2OyB9LFxuXG4gICAgc3VwcG9ydHNUb3VjaDogZnVuY3Rpb24oKSB7IHJldHVybiB0cnVlOyB9LFxuXG4gICAgcmVjZWl2ZWRGb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaW5wdXQgPSB0aGlzO1xuICAgICAgaWYgKHRoaXMuc2VsZWN0aW9uSW5FZGl0b3IoKSlcbiAgICAgICAgdGhpcy5wb2xsU2VsZWN0aW9uKCk7XG4gICAgICBlbHNlXG4gICAgICAgIHJ1bkluT3AodGhpcy5jbSwgZnVuY3Rpb24oKSB7IGlucHV0LmNtLmN1ck9wLnNlbGVjdGlvbkNoYW5nZWQgPSB0cnVlOyB9KTtcblxuICAgICAgZnVuY3Rpb24gcG9sbCgpIHtcbiAgICAgICAgaWYgKGlucHV0LmNtLnN0YXRlLmZvY3VzZWQpIHtcbiAgICAgICAgICBpbnB1dC5wb2xsU2VsZWN0aW9uKCk7XG4gICAgICAgICAgaW5wdXQucG9sbGluZy5zZXQoaW5wdXQuY20ub3B0aW9ucy5wb2xsSW50ZXJ2YWwsIHBvbGwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnBvbGxpbmcuc2V0KHRoaXMuY20ub3B0aW9ucy5wb2xsSW50ZXJ2YWwsIHBvbGwpO1xuICAgIH0sXG5cbiAgICBzZWxlY3Rpb25DaGFuZ2VkOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWwgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG4gICAgICByZXR1cm4gc2VsLmFuY2hvck5vZGUgIT0gdGhpcy5sYXN0QW5jaG9yTm9kZSB8fCBzZWwuYW5jaG9yT2Zmc2V0ICE9IHRoaXMubGFzdEFuY2hvck9mZnNldCB8fFxuICAgICAgICBzZWwuZm9jdXNOb2RlICE9IHRoaXMubGFzdEZvY3VzTm9kZSB8fCBzZWwuZm9jdXNPZmZzZXQgIT0gdGhpcy5sYXN0Rm9jdXNPZmZzZXQ7XG4gICAgfSxcblxuICAgIHBvbGxTZWxlY3Rpb246IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCF0aGlzLmNvbXBvc2luZyAmJiAhdGhpcy5ncmFjZVBlcmlvZCAmJiB0aGlzLnNlbGVjdGlvbkNoYW5nZWQoKSkge1xuICAgICAgICB2YXIgc2VsID0gd2luZG93LmdldFNlbGVjdGlvbigpLCBjbSA9IHRoaXMuY207XG4gICAgICAgIHRoaXMucmVtZW1iZXJTZWxlY3Rpb24oKTtcbiAgICAgICAgdmFyIGFuY2hvciA9IGRvbVRvUG9zKGNtLCBzZWwuYW5jaG9yTm9kZSwgc2VsLmFuY2hvck9mZnNldCk7XG4gICAgICAgIHZhciBoZWFkID0gZG9tVG9Qb3MoY20sIHNlbC5mb2N1c05vZGUsIHNlbC5mb2N1c09mZnNldCk7XG4gICAgICAgIGlmIChhbmNob3IgJiYgaGVhZCkgcnVuSW5PcChjbSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgc2V0U2VsZWN0aW9uKGNtLmRvYywgc2ltcGxlU2VsZWN0aW9uKGFuY2hvciwgaGVhZCksIHNlbF9kb250U2Nyb2xsKTtcbiAgICAgICAgICBpZiAoYW5jaG9yLmJhZCB8fCBoZWFkLmJhZCkgY20uY3VyT3Auc2VsZWN0aW9uQ2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBwb2xsQ29udGVudDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY20gPSB0aGlzLmNtLCBkaXNwbGF5ID0gY20uZGlzcGxheSwgc2VsID0gY20uZG9jLnNlbC5wcmltYXJ5KCk7XG4gICAgICB2YXIgZnJvbSA9IHNlbC5mcm9tKCksIHRvID0gc2VsLnRvKCk7XG4gICAgICBpZiAoZnJvbS5saW5lIDwgZGlzcGxheS52aWV3RnJvbSB8fCB0by5saW5lID4gZGlzcGxheS52aWV3VG8gLSAxKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgIHZhciBmcm9tSW5kZXg7XG4gICAgICBpZiAoZnJvbS5saW5lID09IGRpc3BsYXkudmlld0Zyb20gfHwgKGZyb21JbmRleCA9IGZpbmRWaWV3SW5kZXgoY20sIGZyb20ubGluZSkpID09IDApIHtcbiAgICAgICAgdmFyIGZyb21MaW5lID0gbGluZU5vKGRpc3BsYXkudmlld1swXS5saW5lKTtcbiAgICAgICAgdmFyIGZyb21Ob2RlID0gZGlzcGxheS52aWV3WzBdLm5vZGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZnJvbUxpbmUgPSBsaW5lTm8oZGlzcGxheS52aWV3W2Zyb21JbmRleF0ubGluZSk7XG4gICAgICAgIHZhciBmcm9tTm9kZSA9IGRpc3BsYXkudmlld1tmcm9tSW5kZXggLSAxXS5ub2RlLm5leHRTaWJsaW5nO1xuICAgICAgfVxuICAgICAgdmFyIHRvSW5kZXggPSBmaW5kVmlld0luZGV4KGNtLCB0by5saW5lKTtcbiAgICAgIGlmICh0b0luZGV4ID09IGRpc3BsYXkudmlldy5sZW5ndGggLSAxKSB7XG4gICAgICAgIHZhciB0b0xpbmUgPSBkaXNwbGF5LnZpZXdUbyAtIDE7XG4gICAgICAgIHZhciB0b05vZGUgPSBkaXNwbGF5LmxpbmVEaXYubGFzdENoaWxkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHRvTGluZSA9IGxpbmVObyhkaXNwbGF5LnZpZXdbdG9JbmRleCArIDFdLmxpbmUpIC0gMTtcbiAgICAgICAgdmFyIHRvTm9kZSA9IGRpc3BsYXkudmlld1t0b0luZGV4ICsgMV0ubm9kZS5wcmV2aW91c1NpYmxpbmc7XG4gICAgICB9XG5cbiAgICAgIHZhciBuZXdUZXh0ID0gY20uZG9jLnNwbGl0TGluZXMoZG9tVGV4dEJldHdlZW4oY20sIGZyb21Ob2RlLCB0b05vZGUsIGZyb21MaW5lLCB0b0xpbmUpKTtcbiAgICAgIHZhciBvbGRUZXh0ID0gZ2V0QmV0d2VlbihjbS5kb2MsIFBvcyhmcm9tTGluZSwgMCksIFBvcyh0b0xpbmUsIGdldExpbmUoY20uZG9jLCB0b0xpbmUpLnRleHQubGVuZ3RoKSk7XG4gICAgICB3aGlsZSAobmV3VGV4dC5sZW5ndGggPiAxICYmIG9sZFRleHQubGVuZ3RoID4gMSkge1xuICAgICAgICBpZiAobHN0KG5ld1RleHQpID09IGxzdChvbGRUZXh0KSkgeyBuZXdUZXh0LnBvcCgpOyBvbGRUZXh0LnBvcCgpOyB0b0xpbmUtLTsgfVxuICAgICAgICBlbHNlIGlmIChuZXdUZXh0WzBdID09IG9sZFRleHRbMF0pIHsgbmV3VGV4dC5zaGlmdCgpOyBvbGRUZXh0LnNoaWZ0KCk7IGZyb21MaW5lKys7IH1cbiAgICAgICAgZWxzZSBicmVhaztcbiAgICAgIH1cblxuICAgICAgdmFyIGN1dEZyb250ID0gMCwgY3V0RW5kID0gMDtcbiAgICAgIHZhciBuZXdUb3AgPSBuZXdUZXh0WzBdLCBvbGRUb3AgPSBvbGRUZXh0WzBdLCBtYXhDdXRGcm9udCA9IE1hdGgubWluKG5ld1RvcC5sZW5ndGgsIG9sZFRvcC5sZW5ndGgpO1xuICAgICAgd2hpbGUgKGN1dEZyb250IDwgbWF4Q3V0RnJvbnQgJiYgbmV3VG9wLmNoYXJDb2RlQXQoY3V0RnJvbnQpID09IG9sZFRvcC5jaGFyQ29kZUF0KGN1dEZyb250KSlcbiAgICAgICAgKytjdXRGcm9udDtcbiAgICAgIHZhciBuZXdCb3QgPSBsc3QobmV3VGV4dCksIG9sZEJvdCA9IGxzdChvbGRUZXh0KTtcbiAgICAgIHZhciBtYXhDdXRFbmQgPSBNYXRoLm1pbihuZXdCb3QubGVuZ3RoIC0gKG5ld1RleHQubGVuZ3RoID09IDEgPyBjdXRGcm9udCA6IDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZEJvdC5sZW5ndGggLSAob2xkVGV4dC5sZW5ndGggPT0gMSA/IGN1dEZyb250IDogMCkpO1xuICAgICAgd2hpbGUgKGN1dEVuZCA8IG1heEN1dEVuZCAmJlxuICAgICAgICAgICAgIG5ld0JvdC5jaGFyQ29kZUF0KG5ld0JvdC5sZW5ndGggLSBjdXRFbmQgLSAxKSA9PSBvbGRCb3QuY2hhckNvZGVBdChvbGRCb3QubGVuZ3RoIC0gY3V0RW5kIC0gMSkpXG4gICAgICAgICsrY3V0RW5kO1xuXG4gICAgICBuZXdUZXh0W25ld1RleHQubGVuZ3RoIC0gMV0gPSBuZXdCb3Quc2xpY2UoMCwgbmV3Qm90Lmxlbmd0aCAtIGN1dEVuZCk7XG4gICAgICBuZXdUZXh0WzBdID0gbmV3VGV4dFswXS5zbGljZShjdXRGcm9udCk7XG5cbiAgICAgIHZhciBjaEZyb20gPSBQb3MoZnJvbUxpbmUsIGN1dEZyb250KTtcbiAgICAgIHZhciBjaFRvID0gUG9zKHRvTGluZSwgb2xkVGV4dC5sZW5ndGggPyBsc3Qob2xkVGV4dCkubGVuZ3RoIC0gY3V0RW5kIDogMCk7XG4gICAgICBpZiAobmV3VGV4dC5sZW5ndGggPiAxIHx8IG5ld1RleHRbMF0gfHwgY21wKGNoRnJvbSwgY2hUbykpIHtcbiAgICAgICAgcmVwbGFjZVJhbmdlKGNtLmRvYywgbmV3VGV4dCwgY2hGcm9tLCBjaFRvLCBcIitpbnB1dFwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGVuc3VyZVBvbGxlZDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmZvcmNlQ29tcG9zaXRpb25FbmQoKTtcbiAgICB9LFxuICAgIHJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZm9yY2VDb21wb3NpdGlvbkVuZCgpO1xuICAgIH0sXG4gICAgZm9yY2VDb21wb3NpdGlvbkVuZDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoaXMuY29tcG9zaW5nIHx8IHRoaXMuY29tcG9zaW5nLmhhbmRsZWQpIHJldHVybjtcbiAgICAgIHRoaXMuYXBwbHlDb21wb3NpdGlvbih0aGlzLmNvbXBvc2luZyk7XG4gICAgICB0aGlzLmNvbXBvc2luZy5oYW5kbGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuZGl2LmJsdXIoKTtcbiAgICAgIHRoaXMuZGl2LmZvY3VzKCk7XG4gICAgfSxcbiAgICBhcHBseUNvbXBvc2l0aW9uOiBmdW5jdGlvbihjb21wb3NpbmcpIHtcbiAgICAgIGlmIChpc1JlYWRPbmx5KHRoaXMuY20pKVxuICAgICAgICBvcGVyYXRpb24odGhpcy5jbSwgcmVnQ2hhbmdlKSh0aGlzLmNtKVxuICAgICAgZWxzZSBpZiAoY29tcG9zaW5nLmRhdGEgJiYgY29tcG9zaW5nLmRhdGEgIT0gY29tcG9zaW5nLnN0YXJ0RGF0YSlcbiAgICAgICAgb3BlcmF0aW9uKHRoaXMuY20sIGFwcGx5VGV4dElucHV0KSh0aGlzLmNtLCBjb21wb3NpbmcuZGF0YSwgMCwgY29tcG9zaW5nLnNlbCk7XG4gICAgfSxcblxuICAgIHNldFVuZWRpdGFibGU6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgIG5vZGUuY29udGVudEVkaXRhYmxlID0gXCJmYWxzZVwiXG4gICAgfSxcblxuICAgIG9uS2V5UHJlc3M6IGZ1bmN0aW9uKGUpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGlmICghaXNSZWFkT25seSh0aGlzLmNtKSlcbiAgICAgICAgb3BlcmF0aW9uKHRoaXMuY20sIGFwcGx5VGV4dElucHV0KSh0aGlzLmNtLCBTdHJpbmcuZnJvbUNoYXJDb2RlKGUuY2hhckNvZGUgPT0gbnVsbCA/IGUua2V5Q29kZSA6IGUuY2hhckNvZGUpLCAwKTtcbiAgICB9LFxuXG4gICAgcmVhZE9ubHlDaGFuZ2VkOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgIHRoaXMuZGl2LmNvbnRlbnRFZGl0YWJsZSA9IFN0cmluZyh2YWwgIT0gXCJub2N1cnNvclwiKVxuICAgIH0sXG5cbiAgICBvbkNvbnRleHRNZW51OiBub3RoaW5nLFxuICAgIHJlc2V0UG9zaXRpb246IG5vdGhpbmcsXG5cbiAgICBuZWVkc0NvbnRlbnRBdHRyaWJ1dGU6IHRydWVcbiAgfSwgQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlKTtcblxuICBmdW5jdGlvbiBwb3NUb0RPTShjbSwgcG9zKSB7XG4gICAgdmFyIHZpZXcgPSBmaW5kVmlld0ZvckxpbmUoY20sIHBvcy5saW5lKTtcbiAgICBpZiAoIXZpZXcgfHwgdmlldy5oaWRkZW4pIHJldHVybiBudWxsO1xuICAgIHZhciBsaW5lID0gZ2V0TGluZShjbS5kb2MsIHBvcy5saW5lKTtcbiAgICB2YXIgaW5mbyA9IG1hcEZyb21MaW5lVmlldyh2aWV3LCBsaW5lLCBwb3MubGluZSk7XG5cbiAgICB2YXIgb3JkZXIgPSBnZXRPcmRlcihsaW5lKSwgc2lkZSA9IFwibGVmdFwiO1xuICAgIGlmIChvcmRlcikge1xuICAgICAgdmFyIHBhcnRQb3MgPSBnZXRCaWRpUGFydEF0KG9yZGVyLCBwb3MuY2gpO1xuICAgICAgc2lkZSA9IHBhcnRQb3MgJSAyID8gXCJyaWdodFwiIDogXCJsZWZ0XCI7XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSBub2RlQW5kT2Zmc2V0SW5MaW5lTWFwKGluZm8ubWFwLCBwb3MuY2gsIHNpZGUpO1xuICAgIHJlc3VsdC5vZmZzZXQgPSByZXN1bHQuY29sbGFwc2UgPT0gXCJyaWdodFwiID8gcmVzdWx0LmVuZCA6IHJlc3VsdC5zdGFydDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgZnVuY3Rpb24gYmFkUG9zKHBvcywgYmFkKSB7IGlmIChiYWQpIHBvcy5iYWQgPSB0cnVlOyByZXR1cm4gcG9zOyB9XG5cbiAgZnVuY3Rpb24gZG9tVG9Qb3MoY20sIG5vZGUsIG9mZnNldCkge1xuICAgIHZhciBsaW5lTm9kZTtcbiAgICBpZiAobm9kZSA9PSBjbS5kaXNwbGF5LmxpbmVEaXYpIHtcbiAgICAgIGxpbmVOb2RlID0gY20uZGlzcGxheS5saW5lRGl2LmNoaWxkTm9kZXNbb2Zmc2V0XTtcbiAgICAgIGlmICghbGluZU5vZGUpIHJldHVybiBiYWRQb3MoY20uY2xpcFBvcyhQb3MoY20uZGlzcGxheS52aWV3VG8gLSAxKSksIHRydWUpO1xuICAgICAgbm9kZSA9IG51bGw7IG9mZnNldCA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAobGluZU5vZGUgPSBub2RlOzsgbGluZU5vZGUgPSBsaW5lTm9kZS5wYXJlbnROb2RlKSB7XG4gICAgICAgIGlmICghbGluZU5vZGUgfHwgbGluZU5vZGUgPT0gY20uZGlzcGxheS5saW5lRGl2KSByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKGxpbmVOb2RlLnBhcmVudE5vZGUgJiYgbGluZU5vZGUucGFyZW50Tm9kZSA9PSBjbS5kaXNwbGF5LmxpbmVEaXYpIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNtLmRpc3BsYXkudmlldy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGxpbmVWaWV3ID0gY20uZGlzcGxheS52aWV3W2ldO1xuICAgICAgaWYgKGxpbmVWaWV3Lm5vZGUgPT0gbGluZU5vZGUpXG4gICAgICAgIHJldHVybiBsb2NhdGVOb2RlSW5MaW5lVmlldyhsaW5lVmlldywgbm9kZSwgb2Zmc2V0KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBsb2NhdGVOb2RlSW5MaW5lVmlldyhsaW5lVmlldywgbm9kZSwgb2Zmc2V0KSB7XG4gICAgdmFyIHdyYXBwZXIgPSBsaW5lVmlldy50ZXh0LmZpcnN0Q2hpbGQsIGJhZCA9IGZhbHNlO1xuICAgIGlmICghbm9kZSB8fCAhY29udGFpbnMod3JhcHBlciwgbm9kZSkpIHJldHVybiBiYWRQb3MoUG9zKGxpbmVObyhsaW5lVmlldy5saW5lKSwgMCksIHRydWUpO1xuICAgIGlmIChub2RlID09IHdyYXBwZXIpIHtcbiAgICAgIGJhZCA9IHRydWU7XG4gICAgICBub2RlID0gd3JhcHBlci5jaGlsZE5vZGVzW29mZnNldF07XG4gICAgICBvZmZzZXQgPSAwO1xuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHZhciBsaW5lID0gbGluZVZpZXcucmVzdCA/IGxzdChsaW5lVmlldy5yZXN0KSA6IGxpbmVWaWV3LmxpbmU7XG4gICAgICAgIHJldHVybiBiYWRQb3MoUG9zKGxpbmVObyhsaW5lKSwgbGluZS50ZXh0Lmxlbmd0aCksIGJhZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHRleHROb2RlID0gbm9kZS5ub2RlVHlwZSA9PSAzID8gbm9kZSA6IG51bGwsIHRvcE5vZGUgPSBub2RlO1xuICAgIGlmICghdGV4dE5vZGUgJiYgbm9kZS5jaGlsZE5vZGVzLmxlbmd0aCA9PSAxICYmIG5vZGUuZmlyc3RDaGlsZC5ub2RlVHlwZSA9PSAzKSB7XG4gICAgICB0ZXh0Tm9kZSA9IG5vZGUuZmlyc3RDaGlsZDtcbiAgICAgIGlmIChvZmZzZXQpIG9mZnNldCA9IHRleHROb2RlLm5vZGVWYWx1ZS5sZW5ndGg7XG4gICAgfVxuICAgIHdoaWxlICh0b3BOb2RlLnBhcmVudE5vZGUgIT0gd3JhcHBlcikgdG9wTm9kZSA9IHRvcE5vZGUucGFyZW50Tm9kZTtcbiAgICB2YXIgbWVhc3VyZSA9IGxpbmVWaWV3Lm1lYXN1cmUsIG1hcHMgPSBtZWFzdXJlLm1hcHM7XG5cbiAgICBmdW5jdGlvbiBmaW5kKHRleHROb2RlLCB0b3BOb2RlLCBvZmZzZXQpIHtcbiAgICAgIGZvciAodmFyIGkgPSAtMTsgaSA8IChtYXBzID8gbWFwcy5sZW5ndGggOiAwKTsgaSsrKSB7XG4gICAgICAgIHZhciBtYXAgPSBpIDwgMCA/IG1lYXN1cmUubWFwIDogbWFwc1tpXTtcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBtYXAubGVuZ3RoOyBqICs9IDMpIHtcbiAgICAgICAgICB2YXIgY3VyTm9kZSA9IG1hcFtqICsgMl07XG4gICAgICAgICAgaWYgKGN1ck5vZGUgPT0gdGV4dE5vZGUgfHwgY3VyTm9kZSA9PSB0b3BOb2RlKSB7XG4gICAgICAgICAgICB2YXIgbGluZSA9IGxpbmVObyhpIDwgMCA/IGxpbmVWaWV3LmxpbmUgOiBsaW5lVmlldy5yZXN0W2ldKTtcbiAgICAgICAgICAgIHZhciBjaCA9IG1hcFtqXSArIG9mZnNldDtcbiAgICAgICAgICAgIGlmIChvZmZzZXQgPCAwIHx8IGN1ck5vZGUgIT0gdGV4dE5vZGUpIGNoID0gbWFwW2ogKyAob2Zmc2V0ID8gMSA6IDApXTtcbiAgICAgICAgICAgIHJldHVybiBQb3MobGluZSwgY2gpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB2YXIgZm91bmQgPSBmaW5kKHRleHROb2RlLCB0b3BOb2RlLCBvZmZzZXQpO1xuICAgIGlmIChmb3VuZCkgcmV0dXJuIGJhZFBvcyhmb3VuZCwgYmFkKTtcblxuICAgIC8vIEZJWE1FIHRoaXMgaXMgYWxsIHJlYWxseSBzaGFreS4gbWlnaHQgaGFuZGxlIHRoZSBmZXcgY2FzZXMgaXQgbmVlZHMgdG8gaGFuZGxlLCBidXQgbGlrZWx5IHRvIGNhdXNlIHByb2JsZW1zXG4gICAgZm9yICh2YXIgYWZ0ZXIgPSB0b3BOb2RlLm5leHRTaWJsaW5nLCBkaXN0ID0gdGV4dE5vZGUgPyB0ZXh0Tm9kZS5ub2RlVmFsdWUubGVuZ3RoIC0gb2Zmc2V0IDogMDsgYWZ0ZXI7IGFmdGVyID0gYWZ0ZXIubmV4dFNpYmxpbmcpIHtcbiAgICAgIGZvdW5kID0gZmluZChhZnRlciwgYWZ0ZXIuZmlyc3RDaGlsZCwgMCk7XG4gICAgICBpZiAoZm91bmQpXG4gICAgICAgIHJldHVybiBiYWRQb3MoUG9zKGZvdW5kLmxpbmUsIGZvdW5kLmNoIC0gZGlzdCksIGJhZCk7XG4gICAgICBlbHNlXG4gICAgICAgIGRpc3QgKz0gYWZ0ZXIudGV4dENvbnRlbnQubGVuZ3RoO1xuICAgIH1cbiAgICBmb3IgKHZhciBiZWZvcmUgPSB0b3BOb2RlLnByZXZpb3VzU2libGluZywgZGlzdCA9IG9mZnNldDsgYmVmb3JlOyBiZWZvcmUgPSBiZWZvcmUucHJldmlvdXNTaWJsaW5nKSB7XG4gICAgICBmb3VuZCA9IGZpbmQoYmVmb3JlLCBiZWZvcmUuZmlyc3RDaGlsZCwgLTEpO1xuICAgICAgaWYgKGZvdW5kKVxuICAgICAgICByZXR1cm4gYmFkUG9zKFBvcyhmb3VuZC5saW5lLCBmb3VuZC5jaCArIGRpc3QpLCBiYWQpO1xuICAgICAgZWxzZVxuICAgICAgICBkaXN0ICs9IGFmdGVyLnRleHRDb250ZW50Lmxlbmd0aDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkb21UZXh0QmV0d2VlbihjbSwgZnJvbSwgdG8sIGZyb21MaW5lLCB0b0xpbmUpIHtcbiAgICB2YXIgdGV4dCA9IFwiXCIsIGNsb3NpbmcgPSBmYWxzZSwgbGluZVNlcCA9IGNtLmRvYy5saW5lU2VwYXJhdG9yKCk7XG4gICAgZnVuY3Rpb24gcmVjb2duaXplTWFya2VyKGlkKSB7IHJldHVybiBmdW5jdGlvbihtYXJrZXIpIHsgcmV0dXJuIG1hcmtlci5pZCA9PSBpZDsgfTsgfVxuICAgIGZ1bmN0aW9uIHdhbGsobm9kZSkge1xuICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT0gMSkge1xuICAgICAgICB2YXIgY21UZXh0ID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJjbS10ZXh0XCIpO1xuICAgICAgICBpZiAoY21UZXh0ICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAoY21UZXh0ID09IFwiXCIpIGNtVGV4dCA9IG5vZGUudGV4dENvbnRlbnQucmVwbGFjZSgvXFx1MjAwYi9nLCBcIlwiKTtcbiAgICAgICAgICB0ZXh0ICs9IGNtVGV4dDtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG1hcmtlcklEID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJjbS1tYXJrZXJcIiksIHJhbmdlO1xuICAgICAgICBpZiAobWFya2VySUQpIHtcbiAgICAgICAgICB2YXIgZm91bmQgPSBjbS5maW5kTWFya3MoUG9zKGZyb21MaW5lLCAwKSwgUG9zKHRvTGluZSArIDEsIDApLCByZWNvZ25pemVNYXJrZXIoK21hcmtlcklEKSk7XG4gICAgICAgICAgaWYgKGZvdW5kLmxlbmd0aCAmJiAocmFuZ2UgPSBmb3VuZFswXS5maW5kKCkpKVxuICAgICAgICAgICAgdGV4dCArPSBnZXRCZXR3ZWVuKGNtLmRvYywgcmFuZ2UuZnJvbSwgcmFuZ2UudG8pLmpvaW4obGluZVNlcCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmdldEF0dHJpYnV0ZShcImNvbnRlbnRlZGl0YWJsZVwiKSA9PSBcImZhbHNlXCIpIHJldHVybjtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgd2Fsayhub2RlLmNoaWxkTm9kZXNbaV0pO1xuICAgICAgICBpZiAoL14ocHJlfGRpdnxwKSQvaS50ZXN0KG5vZGUubm9kZU5hbWUpKVxuICAgICAgICAgIGNsb3NpbmcgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChub2RlLm5vZGVUeXBlID09IDMpIHtcbiAgICAgICAgdmFyIHZhbCA9IG5vZGUubm9kZVZhbHVlO1xuICAgICAgICBpZiAoIXZhbCkgcmV0dXJuO1xuICAgICAgICBpZiAoY2xvc2luZykge1xuICAgICAgICAgIHRleHQgKz0gbGluZVNlcDtcbiAgICAgICAgICBjbG9zaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgdGV4dCArPSB2YWw7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoOzspIHtcbiAgICAgIHdhbGsoZnJvbSk7XG4gICAgICBpZiAoZnJvbSA9PSB0bykgYnJlYWs7XG4gICAgICBmcm9tID0gZnJvbS5uZXh0U2libGluZztcbiAgICB9XG4gICAgcmV0dXJuIHRleHQ7XG4gIH1cblxuICBDb2RlTWlycm9yLmlucHV0U3R5bGVzID0ge1widGV4dGFyZWFcIjogVGV4dGFyZWFJbnB1dCwgXCJjb250ZW50ZWRpdGFibGVcIjogQ29udGVudEVkaXRhYmxlSW5wdXR9O1xuXG4gIC8vIFNFTEVDVElPTiAvIENVUlNPUlxuXG4gIC8vIFNlbGVjdGlvbiBvYmplY3RzIGFyZSBpbW11dGFibGUuIEEgbmV3IG9uZSBpcyBjcmVhdGVkIGV2ZXJ5IHRpbWVcbiAgLy8gdGhlIHNlbGVjdGlvbiBjaGFuZ2VzLiBBIHNlbGVjdGlvbiBpcyBvbmUgb3IgbW9yZSBub24tb3ZlcmxhcHBpbmdcbiAgLy8gKGFuZCBub24tdG91Y2hpbmcpIHJhbmdlcywgc29ydGVkLCBhbmQgYW4gaW50ZWdlciB0aGF0IGluZGljYXRlc1xuICAvLyB3aGljaCBvbmUgaXMgdGhlIHByaW1hcnkgc2VsZWN0aW9uICh0aGUgb25lIHRoYXQncyBzY3JvbGxlZCBpbnRvXG4gIC8vIHZpZXcsIHRoYXQgZ2V0Q3Vyc29yIHJldHVybnMsIGV0YykuXG4gIGZ1bmN0aW9uIFNlbGVjdGlvbihyYW5nZXMsIHByaW1JbmRleCkge1xuICAgIHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuICAgIHRoaXMucHJpbUluZGV4ID0gcHJpbUluZGV4O1xuICB9XG5cbiAgU2VsZWN0aW9uLnByb3RvdHlwZSA9IHtcbiAgICBwcmltYXJ5OiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMucmFuZ2VzW3RoaXMucHJpbUluZGV4XTsgfSxcbiAgICBlcXVhbHM6IGZ1bmN0aW9uKG90aGVyKSB7XG4gICAgICBpZiAob3RoZXIgPT0gdGhpcykgcmV0dXJuIHRydWU7XG4gICAgICBpZiAob3RoZXIucHJpbUluZGV4ICE9IHRoaXMucHJpbUluZGV4IHx8IG90aGVyLnJhbmdlcy5sZW5ndGggIT0gdGhpcy5yYW5nZXMubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBoZXJlID0gdGhpcy5yYW5nZXNbaV0sIHRoZXJlID0gb3RoZXIucmFuZ2VzW2ldO1xuICAgICAgICBpZiAoY21wKGhlcmUuYW5jaG9yLCB0aGVyZS5hbmNob3IpICE9IDAgfHwgY21wKGhlcmUuaGVhZCwgdGhlcmUuaGVhZCkgIT0gMCkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICBkZWVwQ29weTogZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKHZhciBvdXQgPSBbXSwgaSA9IDA7IGkgPCB0aGlzLnJhbmdlcy5sZW5ndGg7IGkrKylcbiAgICAgICAgb3V0W2ldID0gbmV3IFJhbmdlKGNvcHlQb3ModGhpcy5yYW5nZXNbaV0uYW5jaG9yKSwgY29weVBvcyh0aGlzLnJhbmdlc1tpXS5oZWFkKSk7XG4gICAgICByZXR1cm4gbmV3IFNlbGVjdGlvbihvdXQsIHRoaXMucHJpbUluZGV4KTtcbiAgICB9LFxuICAgIHNvbWV0aGluZ1NlbGVjdGVkOiBmdW5jdGlvbigpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5yYW5nZXMubGVuZ3RoOyBpKyspXG4gICAgICAgIGlmICghdGhpcy5yYW5nZXNbaV0uZW1wdHkoKSkgcmV0dXJuIHRydWU7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICBjb250YWluczogZnVuY3Rpb24ocG9zLCBlbmQpIHtcbiAgICAgIGlmICghZW5kKSBlbmQgPSBwb3M7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByYW5nZSA9IHRoaXMucmFuZ2VzW2ldO1xuICAgICAgICBpZiAoY21wKGVuZCwgcmFuZ2UuZnJvbSgpKSA+PSAwICYmIGNtcChwb3MsIHJhbmdlLnRvKCkpIDw9IDApXG4gICAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuICB9O1xuXG4gIGZ1bmN0aW9uIFJhbmdlKGFuY2hvciwgaGVhZCkge1xuICAgIHRoaXMuYW5jaG9yID0gYW5jaG9yOyB0aGlzLmhlYWQgPSBoZWFkO1xuICB9XG5cbiAgUmFuZ2UucHJvdG90eXBlID0ge1xuICAgIGZyb206IGZ1bmN0aW9uKCkgeyByZXR1cm4gbWluUG9zKHRoaXMuYW5jaG9yLCB0aGlzLmhlYWQpOyB9LFxuICAgIHRvOiBmdW5jdGlvbigpIHsgcmV0dXJuIG1heFBvcyh0aGlzLmFuY2hvciwgdGhpcy5oZWFkKTsgfSxcbiAgICBlbXB0eTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5oZWFkLmxpbmUgPT0gdGhpcy5hbmNob3IubGluZSAmJiB0aGlzLmhlYWQuY2ggPT0gdGhpcy5hbmNob3IuY2g7XG4gICAgfVxuICB9O1xuXG4gIC8vIFRha2UgYW4gdW5zb3J0ZWQsIHBvdGVudGlhbGx5IG92ZXJsYXBwaW5nIHNldCBvZiByYW5nZXMsIGFuZFxuICAvLyBidWlsZCBhIHNlbGVjdGlvbiBvdXQgb2YgaXQuICdDb25zdW1lcycgcmFuZ2VzIGFycmF5IChtb2RpZnlpbmdcbiAgLy8gaXQpLlxuICBmdW5jdGlvbiBub3JtYWxpemVTZWxlY3Rpb24ocmFuZ2VzLCBwcmltSW5kZXgpIHtcbiAgICB2YXIgcHJpbSA9IHJhbmdlc1twcmltSW5kZXhdO1xuICAgIHJhbmdlcy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIGNtcChhLmZyb20oKSwgYi5mcm9tKCkpOyB9KTtcbiAgICBwcmltSW5kZXggPSBpbmRleE9mKHJhbmdlcywgcHJpbSk7XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCByYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjdXIgPSByYW5nZXNbaV0sIHByZXYgPSByYW5nZXNbaSAtIDFdO1xuICAgICAgaWYgKGNtcChwcmV2LnRvKCksIGN1ci5mcm9tKCkpID49IDApIHtcbiAgICAgICAgdmFyIGZyb20gPSBtaW5Qb3MocHJldi5mcm9tKCksIGN1ci5mcm9tKCkpLCB0byA9IG1heFBvcyhwcmV2LnRvKCksIGN1ci50bygpKTtcbiAgICAgICAgdmFyIGludiA9IHByZXYuZW1wdHkoKSA/IGN1ci5mcm9tKCkgPT0gY3VyLmhlYWQgOiBwcmV2LmZyb20oKSA9PSBwcmV2LmhlYWQ7XG4gICAgICAgIGlmIChpIDw9IHByaW1JbmRleCkgLS1wcmltSW5kZXg7XG4gICAgICAgIHJhbmdlcy5zcGxpY2UoLS1pLCAyLCBuZXcgUmFuZ2UoaW52ID8gdG8gOiBmcm9tLCBpbnYgPyBmcm9tIDogdG8pKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTZWxlY3Rpb24ocmFuZ2VzLCBwcmltSW5kZXgpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2ltcGxlU2VsZWN0aW9uKGFuY2hvciwgaGVhZCkge1xuICAgIHJldHVybiBuZXcgU2VsZWN0aW9uKFtuZXcgUmFuZ2UoYW5jaG9yLCBoZWFkIHx8IGFuY2hvcildLCAwKTtcbiAgfVxuXG4gIC8vIE1vc3Qgb2YgdGhlIGV4dGVybmFsIEFQSSBjbGlwcyBnaXZlbiBwb3NpdGlvbnMgdG8gbWFrZSBzdXJlIHRoZXlcbiAgLy8gYWN0dWFsbHkgZXhpc3Qgd2l0aGluIHRoZSBkb2N1bWVudC5cbiAgZnVuY3Rpb24gY2xpcExpbmUoZG9jLCBuKSB7cmV0dXJuIE1hdGgubWF4KGRvYy5maXJzdCwgTWF0aC5taW4obiwgZG9jLmZpcnN0ICsgZG9jLnNpemUgLSAxKSk7fVxuICBmdW5jdGlvbiBjbGlwUG9zKGRvYywgcG9zKSB7XG4gICAgaWYgKHBvcy5saW5lIDwgZG9jLmZpcnN0KSByZXR1cm4gUG9zKGRvYy5maXJzdCwgMCk7XG4gICAgdmFyIGxhc3QgPSBkb2MuZmlyc3QgKyBkb2Muc2l6ZSAtIDE7XG4gICAgaWYgKHBvcy5saW5lID4gbGFzdCkgcmV0dXJuIFBvcyhsYXN0LCBnZXRMaW5lKGRvYywgbGFzdCkudGV4dC5sZW5ndGgpO1xuICAgIHJldHVybiBjbGlwVG9MZW4ocG9zLCBnZXRMaW5lKGRvYywgcG9zLmxpbmUpLnRleHQubGVuZ3RoKTtcbiAgfVxuICBmdW5jdGlvbiBjbGlwVG9MZW4ocG9zLCBsaW5lbGVuKSB7XG4gICAgdmFyIGNoID0gcG9zLmNoO1xuICAgIGlmIChjaCA9PSBudWxsIHx8IGNoID4gbGluZWxlbikgcmV0dXJuIFBvcyhwb3MubGluZSwgbGluZWxlbik7XG4gICAgZWxzZSBpZiAoY2ggPCAwKSByZXR1cm4gUG9zKHBvcy5saW5lLCAwKTtcbiAgICBlbHNlIHJldHVybiBwb3M7XG4gIH1cbiAgZnVuY3Rpb24gaXNMaW5lKGRvYywgbCkge3JldHVybiBsID49IGRvYy5maXJzdCAmJiBsIDwgZG9jLmZpcnN0ICsgZG9jLnNpemU7fVxuICBmdW5jdGlvbiBjbGlwUG9zQXJyYXkoZG9jLCBhcnJheSkge1xuICAgIGZvciAodmFyIG91dCA9IFtdLCBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSBvdXRbaV0gPSBjbGlwUG9zKGRvYywgYXJyYXlbaV0pO1xuICAgIHJldHVybiBvdXQ7XG4gIH1cblxuICAvLyBTRUxFQ1RJT04gVVBEQVRFU1xuXG4gIC8vIFRoZSAnc2Nyb2xsJyBwYXJhbWV0ZXIgZ2l2ZW4gdG8gbWFueSBvZiB0aGVzZSBpbmRpY2F0ZWQgd2hldGhlclxuICAvLyB0aGUgbmV3IGN1cnNvciBwb3NpdGlvbiBzaG91bGQgYmUgc2Nyb2xsZWQgaW50byB2aWV3IGFmdGVyXG4gIC8vIG1vZGlmeWluZyB0aGUgc2VsZWN0aW9uLlxuXG4gIC8vIElmIHNoaWZ0IGlzIGhlbGQgb3IgdGhlIGV4dGVuZCBmbGFnIGlzIHNldCwgZXh0ZW5kcyBhIHJhbmdlIHRvXG4gIC8vIGluY2x1ZGUgYSBnaXZlbiBwb3NpdGlvbiAoYW5kIG9wdGlvbmFsbHkgYSBzZWNvbmQgcG9zaXRpb24pLlxuICAvLyBPdGhlcndpc2UsIHNpbXBseSByZXR1cm5zIHRoZSByYW5nZSBiZXR3ZWVuIHRoZSBnaXZlbiBwb3NpdGlvbnMuXG4gIC8vIFVzZWQgZm9yIGN1cnNvciBtb3Rpb24gYW5kIHN1Y2guXG4gIGZ1bmN0aW9uIGV4dGVuZFJhbmdlKGRvYywgcmFuZ2UsIGhlYWQsIG90aGVyKSB7XG4gICAgaWYgKGRvYy5jbSAmJiBkb2MuY20uZGlzcGxheS5zaGlmdCB8fCBkb2MuZXh0ZW5kKSB7XG4gICAgICB2YXIgYW5jaG9yID0gcmFuZ2UuYW5jaG9yO1xuICAgICAgaWYgKG90aGVyKSB7XG4gICAgICAgIHZhciBwb3NCZWZvcmUgPSBjbXAoaGVhZCwgYW5jaG9yKSA8IDA7XG4gICAgICAgIGlmIChwb3NCZWZvcmUgIT0gKGNtcChvdGhlciwgYW5jaG9yKSA8IDApKSB7XG4gICAgICAgICAgYW5jaG9yID0gaGVhZDtcbiAgICAgICAgICBoZWFkID0gb3RoZXI7XG4gICAgICAgIH0gZWxzZSBpZiAocG9zQmVmb3JlICE9IChjbXAoaGVhZCwgb3RoZXIpIDwgMCkpIHtcbiAgICAgICAgICBoZWFkID0gb3RoZXI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUmFuZ2UoYW5jaG9yLCBoZWFkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBSYW5nZShvdGhlciB8fCBoZWFkLCBoZWFkKTtcbiAgICB9XG4gIH1cblxuICAvLyBFeHRlbmQgdGhlIHByaW1hcnkgc2VsZWN0aW9uIHJhbmdlLCBkaXNjYXJkIHRoZSByZXN0LlxuICBmdW5jdGlvbiBleHRlbmRTZWxlY3Rpb24oZG9jLCBoZWFkLCBvdGhlciwgb3B0aW9ucykge1xuICAgIHNldFNlbGVjdGlvbihkb2MsIG5ldyBTZWxlY3Rpb24oW2V4dGVuZFJhbmdlKGRvYywgZG9jLnNlbC5wcmltYXJ5KCksIGhlYWQsIG90aGVyKV0sIDApLCBvcHRpb25zKTtcbiAgfVxuXG4gIC8vIEV4dGVuZCBhbGwgc2VsZWN0aW9ucyAocG9zIGlzIGFuIGFycmF5IG9mIHNlbGVjdGlvbnMgd2l0aCBsZW5ndGhcbiAgLy8gZXF1YWwgdGhlIG51bWJlciBvZiBzZWxlY3Rpb25zKVxuICBmdW5jdGlvbiBleHRlbmRTZWxlY3Rpb25zKGRvYywgaGVhZHMsIG9wdGlvbnMpIHtcbiAgICBmb3IgKHZhciBvdXQgPSBbXSwgaSA9IDA7IGkgPCBkb2Muc2VsLnJhbmdlcy5sZW5ndGg7IGkrKylcbiAgICAgIG91dFtpXSA9IGV4dGVuZFJhbmdlKGRvYywgZG9jLnNlbC5yYW5nZXNbaV0sIGhlYWRzW2ldLCBudWxsKTtcbiAgICB2YXIgbmV3U2VsID0gbm9ybWFsaXplU2VsZWN0aW9uKG91dCwgZG9jLnNlbC5wcmltSW5kZXgpO1xuICAgIHNldFNlbGVjdGlvbihkb2MsIG5ld1NlbCwgb3B0aW9ucyk7XG4gIH1cblxuICAvLyBVcGRhdGVzIGEgc2luZ2xlIHJhbmdlIGluIHRoZSBzZWxlY3Rpb24uXG4gIGZ1bmN0aW9uIHJlcGxhY2VPbmVTZWxlY3Rpb24oZG9jLCBpLCByYW5nZSwgb3B0aW9ucykge1xuICAgIHZhciByYW5nZXMgPSBkb2Muc2VsLnJhbmdlcy5zbGljZSgwKTtcbiAgICByYW5nZXNbaV0gPSByYW5nZTtcbiAgICBzZXRTZWxlY3Rpb24oZG9jLCBub3JtYWxpemVTZWxlY3Rpb24ocmFuZ2VzLCBkb2Muc2VsLnByaW1JbmRleCksIG9wdGlvbnMpO1xuICB9XG5cbiAgLy8gUmVzZXQgdGhlIHNlbGVjdGlvbiB0byBhIHNpbmdsZSByYW5nZS5cbiAgZnVuY3Rpb24gc2V0U2ltcGxlU2VsZWN0aW9uKGRvYywgYW5jaG9yLCBoZWFkLCBvcHRpb25zKSB7XG4gICAgc2V0U2VsZWN0aW9uKGRvYywgc2ltcGxlU2VsZWN0aW9uKGFuY2hvciwgaGVhZCksIG9wdGlvbnMpO1xuICB9XG5cbiAgLy8gR2l2ZSBiZWZvcmVTZWxlY3Rpb25DaGFuZ2UgaGFuZGxlcnMgYSBjaGFuZ2UgdG8gaW5mbHVlbmNlIGFcbiAgLy8gc2VsZWN0aW9uIHVwZGF0ZS5cbiAgZnVuY3Rpb24gZmlsdGVyU2VsZWN0aW9uQ2hhbmdlKGRvYywgc2VsKSB7XG4gICAgdmFyIG9iaiA9IHtcbiAgICAgIHJhbmdlczogc2VsLnJhbmdlcyxcbiAgICAgIHVwZGF0ZTogZnVuY3Rpb24ocmFuZ2VzKSB7XG4gICAgICAgIHRoaXMucmFuZ2VzID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmFuZ2VzLmxlbmd0aDsgaSsrKVxuICAgICAgICAgIHRoaXMucmFuZ2VzW2ldID0gbmV3IFJhbmdlKGNsaXBQb3MoZG9jLCByYW5nZXNbaV0uYW5jaG9yKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGlwUG9zKGRvYywgcmFuZ2VzW2ldLmhlYWQpKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHNpZ25hbChkb2MsIFwiYmVmb3JlU2VsZWN0aW9uQ2hhbmdlXCIsIGRvYywgb2JqKTtcbiAgICBpZiAoZG9jLmNtKSBzaWduYWwoZG9jLmNtLCBcImJlZm9yZVNlbGVjdGlvbkNoYW5nZVwiLCBkb2MuY20sIG9iaik7XG4gICAgaWYgKG9iai5yYW5nZXMgIT0gc2VsLnJhbmdlcykgcmV0dXJuIG5vcm1hbGl6ZVNlbGVjdGlvbihvYmoucmFuZ2VzLCBvYmoucmFuZ2VzLmxlbmd0aCAtIDEpO1xuICAgIGVsc2UgcmV0dXJuIHNlbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFNlbGVjdGlvblJlcGxhY2VIaXN0b3J5KGRvYywgc2VsLCBvcHRpb25zKSB7XG4gICAgdmFyIGRvbmUgPSBkb2MuaGlzdG9yeS5kb25lLCBsYXN0ID0gbHN0KGRvbmUpO1xuICAgIGlmIChsYXN0ICYmIGxhc3QucmFuZ2VzKSB7XG4gICAgICBkb25lW2RvbmUubGVuZ3RoIC0gMV0gPSBzZWw7XG4gICAgICBzZXRTZWxlY3Rpb25Ob1VuZG8oZG9jLCBzZWwsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZXRTZWxlY3Rpb24oZG9jLCBzZWwsIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNldCBhIG5ldyBzZWxlY3Rpb24uXG4gIGZ1bmN0aW9uIHNldFNlbGVjdGlvbihkb2MsIHNlbCwgb3B0aW9ucykge1xuICAgIHNldFNlbGVjdGlvbk5vVW5kbyhkb2MsIHNlbCwgb3B0aW9ucyk7XG4gICAgYWRkU2VsZWN0aW9uVG9IaXN0b3J5KGRvYywgZG9jLnNlbCwgZG9jLmNtID8gZG9jLmNtLmN1ck9wLmlkIDogTmFOLCBvcHRpb25zKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFNlbGVjdGlvbk5vVW5kbyhkb2MsIHNlbCwgb3B0aW9ucykge1xuICAgIGlmIChoYXNIYW5kbGVyKGRvYywgXCJiZWZvcmVTZWxlY3Rpb25DaGFuZ2VcIikgfHwgZG9jLmNtICYmIGhhc0hhbmRsZXIoZG9jLmNtLCBcImJlZm9yZVNlbGVjdGlvbkNoYW5nZVwiKSlcbiAgICAgIHNlbCA9IGZpbHRlclNlbGVjdGlvbkNoYW5nZShkb2MsIHNlbCk7XG5cbiAgICB2YXIgYmlhcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5iaWFzIHx8XG4gICAgICAoY21wKHNlbC5wcmltYXJ5KCkuaGVhZCwgZG9jLnNlbC5wcmltYXJ5KCkuaGVhZCkgPCAwID8gLTEgOiAxKTtcbiAgICBzZXRTZWxlY3Rpb25Jbm5lcihkb2MsIHNraXBBdG9taWNJblNlbGVjdGlvbihkb2MsIHNlbCwgYmlhcywgdHJ1ZSkpO1xuXG4gICAgaWYgKCEob3B0aW9ucyAmJiBvcHRpb25zLnNjcm9sbCA9PT0gZmFsc2UpICYmIGRvYy5jbSlcbiAgICAgIGVuc3VyZUN1cnNvclZpc2libGUoZG9jLmNtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFNlbGVjdGlvbklubmVyKGRvYywgc2VsKSB7XG4gICAgaWYgKHNlbC5lcXVhbHMoZG9jLnNlbCkpIHJldHVybjtcblxuICAgIGRvYy5zZWwgPSBzZWw7XG5cbiAgICBpZiAoZG9jLmNtKSB7XG4gICAgICBkb2MuY20uY3VyT3AudXBkYXRlSW5wdXQgPSBkb2MuY20uY3VyT3Auc2VsZWN0aW9uQ2hhbmdlZCA9IHRydWU7XG4gICAgICBzaWduYWxDdXJzb3JBY3Rpdml0eShkb2MuY20pO1xuICAgIH1cbiAgICBzaWduYWxMYXRlcihkb2MsIFwiY3Vyc29yQWN0aXZpdHlcIiwgZG9jKTtcbiAgfVxuXG4gIC8vIFZlcmlmeSB0aGF0IHRoZSBzZWxlY3Rpb24gZG9lcyBub3QgcGFydGlhbGx5IHNlbGVjdCBhbnkgYXRvbWljXG4gIC8vIG1hcmtlZCByYW5nZXMuXG4gIGZ1bmN0aW9uIHJlQ2hlY2tTZWxlY3Rpb24oZG9jKSB7XG4gICAgc2V0U2VsZWN0aW9uSW5uZXIoZG9jLCBza2lwQXRvbWljSW5TZWxlY3Rpb24oZG9jLCBkb2Muc2VsLCBudWxsLCBmYWxzZSksIHNlbF9kb250U2Nyb2xsKTtcbiAgfVxuXG4gIC8vIFJldHVybiBhIHNlbGVjdGlvbiB0aGF0IGRvZXMgbm90IHBhcnRpYWxseSBzZWxlY3QgYW55IGF0b21pY1xuICAvLyByYW5nZXMuXG4gIGZ1bmN0aW9uIHNraXBBdG9taWNJblNlbGVjdGlvbihkb2MsIHNlbCwgYmlhcywgbWF5Q2xlYXIpIHtcbiAgICB2YXIgb3V0O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsLnJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJhbmdlID0gc2VsLnJhbmdlc1tpXTtcbiAgICAgIHZhciBuZXdBbmNob3IgPSBza2lwQXRvbWljKGRvYywgcmFuZ2UuYW5jaG9yLCBiaWFzLCBtYXlDbGVhcik7XG4gICAgICB2YXIgbmV3SGVhZCA9IHNraXBBdG9taWMoZG9jLCByYW5nZS5oZWFkLCBiaWFzLCBtYXlDbGVhcik7XG4gICAgICBpZiAob3V0IHx8IG5ld0FuY2hvciAhPSByYW5nZS5hbmNob3IgfHwgbmV3SGVhZCAhPSByYW5nZS5oZWFkKSB7XG4gICAgICAgIGlmICghb3V0KSBvdXQgPSBzZWwucmFuZ2VzLnNsaWNlKDAsIGkpO1xuICAgICAgICBvdXRbaV0gPSBuZXcgUmFuZ2UobmV3QW5jaG9yLCBuZXdIZWFkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dCA/IG5vcm1hbGl6ZVNlbGVjdGlvbihvdXQsIHNlbC5wcmltSW5kZXgpIDogc2VsO1xuICB9XG5cbiAgLy8gRW5zdXJlIGEgZ2l2ZW4gcG9zaXRpb24gaXMgbm90IGluc2lkZSBhbiBhdG9taWMgcmFuZ2UuXG4gIGZ1bmN0aW9uIHNraXBBdG9taWMoZG9jLCBwb3MsIGJpYXMsIG1heUNsZWFyKSB7XG4gICAgdmFyIGZsaXBwZWQgPSBmYWxzZSwgY3VyUG9zID0gcG9zO1xuICAgIHZhciBkaXIgPSBiaWFzIHx8IDE7XG4gICAgZG9jLmNhbnRFZGl0ID0gZmFsc2U7XG4gICAgc2VhcmNoOiBmb3IgKDs7KSB7XG4gICAgICB2YXIgbGluZSA9IGdldExpbmUoZG9jLCBjdXJQb3MubGluZSk7XG4gICAgICBpZiAobGluZS5tYXJrZWRTcGFucykge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmUubWFya2VkU3BhbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICB2YXIgc3AgPSBsaW5lLm1hcmtlZFNwYW5zW2ldLCBtID0gc3AubWFya2VyO1xuICAgICAgICAgIGlmICgoc3AuZnJvbSA9PSBudWxsIHx8IChtLmluY2x1c2l2ZUxlZnQgPyBzcC5mcm9tIDw9IGN1clBvcy5jaCA6IHNwLmZyb20gPCBjdXJQb3MuY2gpKSAmJlxuICAgICAgICAgICAgICAoc3AudG8gPT0gbnVsbCB8fCAobS5pbmNsdXNpdmVSaWdodCA/IHNwLnRvID49IGN1clBvcy5jaCA6IHNwLnRvID4gY3VyUG9zLmNoKSkpIHtcbiAgICAgICAgICAgIGlmIChtYXlDbGVhcikge1xuICAgICAgICAgICAgICBzaWduYWwobSwgXCJiZWZvcmVDdXJzb3JFbnRlclwiKTtcbiAgICAgICAgICAgICAgaWYgKG0uZXhwbGljaXRseUNsZWFyZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWxpbmUubWFya2VkU3BhbnMpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGVsc2Ugey0taTsgY29udGludWU7fVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW0uYXRvbWljKSBjb250aW51ZTtcbiAgICAgICAgICAgIHZhciBuZXdQb3MgPSBtLmZpbmQoZGlyIDwgMCA/IC0xIDogMSk7XG4gICAgICAgICAgICBpZiAoY21wKG5ld1BvcywgY3VyUG9zKSA9PSAwKSB7XG4gICAgICAgICAgICAgIG5ld1Bvcy5jaCArPSBkaXI7XG4gICAgICAgICAgICAgIGlmIChuZXdQb3MuY2ggPCAwKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5ld1Bvcy5saW5lID4gZG9jLmZpcnN0KSBuZXdQb3MgPSBjbGlwUG9zKGRvYywgUG9zKG5ld1Bvcy5saW5lIC0gMSkpO1xuICAgICAgICAgICAgICAgIGVsc2UgbmV3UG9zID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChuZXdQb3MuY2ggPiBsaW5lLnRleHQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5ld1Bvcy5saW5lIDwgZG9jLmZpcnN0ICsgZG9jLnNpemUgLSAxKSBuZXdQb3MgPSBQb3MobmV3UG9zLmxpbmUgKyAxLCAwKTtcbiAgICAgICAgICAgICAgICBlbHNlIG5ld1BvcyA9IG51bGw7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKCFuZXdQb3MpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmxpcHBlZCkge1xuICAgICAgICAgICAgICAgICAgLy8gRHJpdmVuIGluIGEgY29ybmVyIC0tIG5vIHZhbGlkIGN1cnNvciBwb3NpdGlvbiBmb3VuZCBhdCBhbGxcbiAgICAgICAgICAgICAgICAgIC8vIC0tIHRyeSBhZ2FpbiAqd2l0aCogY2xlYXJpbmcsIGlmIHdlIGRpZG4ndCBhbHJlYWR5XG4gICAgICAgICAgICAgICAgICBpZiAoIW1heUNsZWFyKSByZXR1cm4gc2tpcEF0b21pYyhkb2MsIHBvcywgYmlhcywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAvLyBPdGhlcndpc2UsIHR1cm4gb2ZmIGVkaXRpbmcgdW50aWwgZnVydGhlciBub3RpY2UsIGFuZCByZXR1cm4gdGhlIHN0YXJ0IG9mIHRoZSBkb2NcbiAgICAgICAgICAgICAgICAgIGRvYy5jYW50RWRpdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gUG9zKGRvYy5maXJzdCwgMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZsaXBwZWQgPSB0cnVlOyBuZXdQb3MgPSBwb3M7IGRpciA9IC1kaXI7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGN1clBvcyA9IG5ld1BvcztcbiAgICAgICAgICAgIGNvbnRpbnVlIHNlYXJjaDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBjdXJQb3M7XG4gICAgfVxuICB9XG5cbiAgLy8gU0VMRUNUSU9OIERSQVdJTkdcblxuICBmdW5jdGlvbiB1cGRhdGVTZWxlY3Rpb24oY20pIHtcbiAgICBjbS5kaXNwbGF5LmlucHV0LnNob3dTZWxlY3Rpb24oY20uZGlzcGxheS5pbnB1dC5wcmVwYXJlU2VsZWN0aW9uKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJlcGFyZVNlbGVjdGlvbihjbSwgcHJpbWFyeSkge1xuICAgIHZhciBkb2MgPSBjbS5kb2MsIHJlc3VsdCA9IHt9O1xuICAgIHZhciBjdXJGcmFnbWVudCA9IHJlc3VsdC5jdXJzb3JzID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgIHZhciBzZWxGcmFnbWVudCA9IHJlc3VsdC5zZWxlY3Rpb24gPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRvYy5zZWwucmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocHJpbWFyeSA9PT0gZmFsc2UgJiYgaSA9PSBkb2Muc2VsLnByaW1JbmRleCkgY29udGludWU7XG4gICAgICB2YXIgcmFuZ2UgPSBkb2Muc2VsLnJhbmdlc1tpXTtcbiAgICAgIHZhciBjb2xsYXBzZWQgPSByYW5nZS5lbXB0eSgpO1xuICAgICAgaWYgKGNvbGxhcHNlZCB8fCBjbS5vcHRpb25zLnNob3dDdXJzb3JXaGVuU2VsZWN0aW5nKVxuICAgICAgICBkcmF3U2VsZWN0aW9uQ3Vyc29yKGNtLCByYW5nZS5oZWFkLCBjdXJGcmFnbWVudCk7XG4gICAgICBpZiAoIWNvbGxhcHNlZClcbiAgICAgICAgZHJhd1NlbGVjdGlvblJhbmdlKGNtLCByYW5nZSwgc2VsRnJhZ21lbnQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gRHJhd3MgYSBjdXJzb3IgZm9yIHRoZSBnaXZlbiByYW5nZVxuICBmdW5jdGlvbiBkcmF3U2VsZWN0aW9uQ3Vyc29yKGNtLCBoZWFkLCBvdXRwdXQpIHtcbiAgICB2YXIgcG9zID0gY3Vyc29yQ29vcmRzKGNtLCBoZWFkLCBcImRpdlwiLCBudWxsLCBudWxsLCAhY20ub3B0aW9ucy5zaW5nbGVDdXJzb3JIZWlnaHRQZXJMaW5lKTtcblxuICAgIHZhciBjdXJzb3IgPSBvdXRwdXQuYXBwZW5kQ2hpbGQoZWx0KFwiZGl2XCIsIFwiXFx1MDBhMFwiLCBcIkNvZGVNaXJyb3ItY3Vyc29yXCIpKTtcbiAgICBjdXJzb3Iuc3R5bGUubGVmdCA9IHBvcy5sZWZ0ICsgXCJweFwiO1xuICAgIGN1cnNvci5zdHlsZS50b3AgPSBwb3MudG9wICsgXCJweFwiO1xuICAgIGN1cnNvci5zdHlsZS5oZWlnaHQgPSBNYXRoLm1heCgwLCBwb3MuYm90dG9tIC0gcG9zLnRvcCkgKiBjbS5vcHRpb25zLmN1cnNvckhlaWdodCArIFwicHhcIjtcblxuICAgIGlmIChwb3Mub3RoZXIpIHtcbiAgICAgIC8vIFNlY29uZGFyeSBjdXJzb3IsIHNob3duIHdoZW4gb24gYSAnanVtcCcgaW4gYmktZGlyZWN0aW9uYWwgdGV4dFxuICAgICAgdmFyIG90aGVyQ3Vyc29yID0gb3V0cHV0LmFwcGVuZENoaWxkKGVsdChcImRpdlwiLCBcIlxcdTAwYTBcIiwgXCJDb2RlTWlycm9yLWN1cnNvciBDb2RlTWlycm9yLXNlY29uZGFyeWN1cnNvclwiKSk7XG4gICAgICBvdGhlckN1cnNvci5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcbiAgICAgIG90aGVyQ3Vyc29yLnN0eWxlLmxlZnQgPSBwb3Mub3RoZXIubGVmdCArIFwicHhcIjtcbiAgICAgIG90aGVyQ3Vyc29yLnN0eWxlLnRvcCA9IHBvcy5vdGhlci50b3AgKyBcInB4XCI7XG4gICAgICBvdGhlckN1cnNvci5zdHlsZS5oZWlnaHQgPSAocG9zLm90aGVyLmJvdHRvbSAtIHBvcy5vdGhlci50b3ApICogLjg1ICsgXCJweFwiO1xuICAgIH1cbiAgfVxuXG4gIC8vIERyYXdzIHRoZSBnaXZlbiByYW5nZSBhcyBhIGhpZ2hsaWdodGVkIHNlbGVjdGlvblxuICBmdW5jdGlvbiBkcmF3U2VsZWN0aW9uUmFuZ2UoY20sIHJhbmdlLCBvdXRwdXQpIHtcbiAgICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXksIGRvYyA9IGNtLmRvYztcbiAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgdmFyIHBhZGRpbmcgPSBwYWRkaW5nSChjbS5kaXNwbGF5KSwgbGVmdFNpZGUgPSBwYWRkaW5nLmxlZnQ7XG4gICAgdmFyIHJpZ2h0U2lkZSA9IE1hdGgubWF4KGRpc3BsYXkuc2l6ZXJXaWR0aCwgZGlzcGxheVdpZHRoKGNtKSAtIGRpc3BsYXkuc2l6ZXIub2Zmc2V0TGVmdCkgLSBwYWRkaW5nLnJpZ2h0O1xuXG4gICAgZnVuY3Rpb24gYWRkKGxlZnQsIHRvcCwgd2lkdGgsIGJvdHRvbSkge1xuICAgICAgaWYgKHRvcCA8IDApIHRvcCA9IDA7XG4gICAgICB0b3AgPSBNYXRoLnJvdW5kKHRvcCk7XG4gICAgICBib3R0b20gPSBNYXRoLnJvdW5kKGJvdHRvbSk7XG4gICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChlbHQoXCJkaXZcIiwgbnVsbCwgXCJDb2RlTWlycm9yLXNlbGVjdGVkXCIsIFwicG9zaXRpb246IGFic29sdXRlOyBsZWZ0OiBcIiArIGxlZnQgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicHg7IHRvcDogXCIgKyB0b3AgKyBcInB4OyB3aWR0aDogXCIgKyAod2lkdGggPT0gbnVsbCA/IHJpZ2h0U2lkZSAtIGxlZnQgOiB3aWR0aCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicHg7IGhlaWdodDogXCIgKyAoYm90dG9tIC0gdG9wKSArIFwicHhcIikpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRyYXdGb3JMaW5lKGxpbmUsIGZyb21BcmcsIHRvQXJnKSB7XG4gICAgICB2YXIgbGluZU9iaiA9IGdldExpbmUoZG9jLCBsaW5lKTtcbiAgICAgIHZhciBsaW5lTGVuID0gbGluZU9iai50ZXh0Lmxlbmd0aDtcbiAgICAgIHZhciBzdGFydCwgZW5kO1xuICAgICAgZnVuY3Rpb24gY29vcmRzKGNoLCBiaWFzKSB7XG4gICAgICAgIHJldHVybiBjaGFyQ29vcmRzKGNtLCBQb3MobGluZSwgY2gpLCBcImRpdlwiLCBsaW5lT2JqLCBiaWFzKTtcbiAgICAgIH1cblxuICAgICAgaXRlcmF0ZUJpZGlTZWN0aW9ucyhnZXRPcmRlcihsaW5lT2JqKSwgZnJvbUFyZyB8fCAwLCB0b0FyZyA9PSBudWxsID8gbGluZUxlbiA6IHRvQXJnLCBmdW5jdGlvbihmcm9tLCB0bywgZGlyKSB7XG4gICAgICAgIHZhciBsZWZ0UG9zID0gY29vcmRzKGZyb20sIFwibGVmdFwiKSwgcmlnaHRQb3MsIGxlZnQsIHJpZ2h0O1xuICAgICAgICBpZiAoZnJvbSA9PSB0bykge1xuICAgICAgICAgIHJpZ2h0UG9zID0gbGVmdFBvcztcbiAgICAgICAgICBsZWZ0ID0gcmlnaHQgPSBsZWZ0UG9zLmxlZnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmlnaHRQb3MgPSBjb29yZHModG8gLSAxLCBcInJpZ2h0XCIpO1xuICAgICAgICAgIGlmIChkaXIgPT0gXCJydGxcIikgeyB2YXIgdG1wID0gbGVmdFBvczsgbGVmdFBvcyA9IHJpZ2h0UG9zOyByaWdodFBvcyA9IHRtcDsgfVxuICAgICAgICAgIGxlZnQgPSBsZWZ0UG9zLmxlZnQ7XG4gICAgICAgICAgcmlnaHQgPSByaWdodFBvcy5yaWdodDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZnJvbUFyZyA9PSBudWxsICYmIGZyb20gPT0gMCkgbGVmdCA9IGxlZnRTaWRlO1xuICAgICAgICBpZiAocmlnaHRQb3MudG9wIC0gbGVmdFBvcy50b3AgPiAzKSB7IC8vIERpZmZlcmVudCBsaW5lcywgZHJhdyB0b3AgcGFydFxuICAgICAgICAgIGFkZChsZWZ0LCBsZWZ0UG9zLnRvcCwgbnVsbCwgbGVmdFBvcy5ib3R0b20pO1xuICAgICAgICAgIGxlZnQgPSBsZWZ0U2lkZTtcbiAgICAgICAgICBpZiAobGVmdFBvcy5ib3R0b20gPCByaWdodFBvcy50b3ApIGFkZChsZWZ0LCBsZWZ0UG9zLmJvdHRvbSwgbnVsbCwgcmlnaHRQb3MudG9wKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodG9BcmcgPT0gbnVsbCAmJiB0byA9PSBsaW5lTGVuKSByaWdodCA9IHJpZ2h0U2lkZTtcbiAgICAgICAgaWYgKCFzdGFydCB8fCBsZWZ0UG9zLnRvcCA8IHN0YXJ0LnRvcCB8fCBsZWZ0UG9zLnRvcCA9PSBzdGFydC50b3AgJiYgbGVmdFBvcy5sZWZ0IDwgc3RhcnQubGVmdClcbiAgICAgICAgICBzdGFydCA9IGxlZnRQb3M7XG4gICAgICAgIGlmICghZW5kIHx8IHJpZ2h0UG9zLmJvdHRvbSA+IGVuZC5ib3R0b20gfHwgcmlnaHRQb3MuYm90dG9tID09IGVuZC5ib3R0b20gJiYgcmlnaHRQb3MucmlnaHQgPiBlbmQucmlnaHQpXG4gICAgICAgICAgZW5kID0gcmlnaHRQb3M7XG4gICAgICAgIGlmIChsZWZ0IDwgbGVmdFNpZGUgKyAxKSBsZWZ0ID0gbGVmdFNpZGU7XG4gICAgICAgIGFkZChsZWZ0LCByaWdodFBvcy50b3AsIHJpZ2h0IC0gbGVmdCwgcmlnaHRQb3MuYm90dG9tKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHtzdGFydDogc3RhcnQsIGVuZDogZW5kfTtcbiAgICB9XG5cbiAgICB2YXIgc0Zyb20gPSByYW5nZS5mcm9tKCksIHNUbyA9IHJhbmdlLnRvKCk7XG4gICAgaWYgKHNGcm9tLmxpbmUgPT0gc1RvLmxpbmUpIHtcbiAgICAgIGRyYXdGb3JMaW5lKHNGcm9tLmxpbmUsIHNGcm9tLmNoLCBzVG8uY2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZnJvbUxpbmUgPSBnZXRMaW5lKGRvYywgc0Zyb20ubGluZSksIHRvTGluZSA9IGdldExpbmUoZG9jLCBzVG8ubGluZSk7XG4gICAgICB2YXIgc2luZ2xlVkxpbmUgPSB2aXN1YWxMaW5lKGZyb21MaW5lKSA9PSB2aXN1YWxMaW5lKHRvTGluZSk7XG4gICAgICB2YXIgbGVmdEVuZCA9IGRyYXdGb3JMaW5lKHNGcm9tLmxpbmUsIHNGcm9tLmNoLCBzaW5nbGVWTGluZSA/IGZyb21MaW5lLnRleHQubGVuZ3RoICsgMSA6IG51bGwpLmVuZDtcbiAgICAgIHZhciByaWdodFN0YXJ0ID0gZHJhd0ZvckxpbmUoc1RvLmxpbmUsIHNpbmdsZVZMaW5lID8gMCA6IG51bGwsIHNUby5jaCkuc3RhcnQ7XG4gICAgICBpZiAoc2luZ2xlVkxpbmUpIHtcbiAgICAgICAgaWYgKGxlZnRFbmQudG9wIDwgcmlnaHRTdGFydC50b3AgLSAyKSB7XG4gICAgICAgICAgYWRkKGxlZnRFbmQucmlnaHQsIGxlZnRFbmQudG9wLCBudWxsLCBsZWZ0RW5kLmJvdHRvbSk7XG4gICAgICAgICAgYWRkKGxlZnRTaWRlLCByaWdodFN0YXJ0LnRvcCwgcmlnaHRTdGFydC5sZWZ0LCByaWdodFN0YXJ0LmJvdHRvbSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWRkKGxlZnRFbmQucmlnaHQsIGxlZnRFbmQudG9wLCByaWdodFN0YXJ0LmxlZnQgLSBsZWZ0RW5kLnJpZ2h0LCBsZWZ0RW5kLmJvdHRvbSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChsZWZ0RW5kLmJvdHRvbSA8IHJpZ2h0U3RhcnQudG9wKVxuICAgICAgICBhZGQobGVmdFNpZGUsIGxlZnRFbmQuYm90dG9tLCBudWxsLCByaWdodFN0YXJ0LnRvcCk7XG4gICAgfVxuXG4gICAgb3V0cHV0LmFwcGVuZENoaWxkKGZyYWdtZW50KTtcbiAgfVxuXG4gIC8vIEN1cnNvci1ibGlua2luZ1xuICBmdW5jdGlvbiByZXN0YXJ0QmxpbmsoY20pIHtcbiAgICBpZiAoIWNtLnN0YXRlLmZvY3VzZWQpIHJldHVybjtcbiAgICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXk7XG4gICAgY2xlYXJJbnRlcnZhbChkaXNwbGF5LmJsaW5rZXIpO1xuICAgIHZhciBvbiA9IHRydWU7XG4gICAgZGlzcGxheS5jdXJzb3JEaXYuc3R5bGUudmlzaWJpbGl0eSA9IFwiXCI7XG4gICAgaWYgKGNtLm9wdGlvbnMuY3Vyc29yQmxpbmtSYXRlID4gMClcbiAgICAgIGRpc3BsYXkuYmxpbmtlciA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICBkaXNwbGF5LmN1cnNvckRpdi5zdHlsZS52aXNpYmlsaXR5ID0gKG9uID0gIW9uKSA/IFwiXCIgOiBcImhpZGRlblwiO1xuICAgICAgfSwgY20ub3B0aW9ucy5jdXJzb3JCbGlua1JhdGUpO1xuICAgIGVsc2UgaWYgKGNtLm9wdGlvbnMuY3Vyc29yQmxpbmtSYXRlIDwgMClcbiAgICAgIGRpc3BsYXkuY3Vyc29yRGl2LnN0eWxlLnZpc2liaWxpdHkgPSBcImhpZGRlblwiO1xuICB9XG5cbiAgLy8gSElHSExJR0hUIFdPUktFUlxuXG4gIGZ1bmN0aW9uIHN0YXJ0V29ya2VyKGNtLCB0aW1lKSB7XG4gICAgaWYgKGNtLmRvYy5tb2RlLnN0YXJ0U3RhdGUgJiYgY20uZG9jLmZyb250aWVyIDwgY20uZGlzcGxheS52aWV3VG8pXG4gICAgICBjbS5zdGF0ZS5oaWdobGlnaHQuc2V0KHRpbWUsIGJpbmQoaGlnaGxpZ2h0V29ya2VyLCBjbSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gaGlnaGxpZ2h0V29ya2VyKGNtKSB7XG4gICAgdmFyIGRvYyA9IGNtLmRvYztcbiAgICBpZiAoZG9jLmZyb250aWVyIDwgZG9jLmZpcnN0KSBkb2MuZnJvbnRpZXIgPSBkb2MuZmlyc3Q7XG4gICAgaWYgKGRvYy5mcm9udGllciA+PSBjbS5kaXNwbGF5LnZpZXdUbykgcmV0dXJuO1xuICAgIHZhciBlbmQgPSArbmV3IERhdGUgKyBjbS5vcHRpb25zLndvcmtUaW1lO1xuICAgIHZhciBzdGF0ZSA9IGNvcHlTdGF0ZShkb2MubW9kZSwgZ2V0U3RhdGVCZWZvcmUoY20sIGRvYy5mcm9udGllcikpO1xuICAgIHZhciBjaGFuZ2VkTGluZXMgPSBbXTtcblxuICAgIGRvYy5pdGVyKGRvYy5mcm9udGllciwgTWF0aC5taW4oZG9jLmZpcnN0ICsgZG9jLnNpemUsIGNtLmRpc3BsYXkudmlld1RvICsgNTAwKSwgZnVuY3Rpb24obGluZSkge1xuICAgICAgaWYgKGRvYy5mcm9udGllciA+PSBjbS5kaXNwbGF5LnZpZXdGcm9tKSB7IC8vIFZpc2libGVcbiAgICAgICAgdmFyIG9sZFN0eWxlcyA9IGxpbmUuc3R5bGVzLCB0b29Mb25nID0gbGluZS50ZXh0Lmxlbmd0aCA+IGNtLm9wdGlvbnMubWF4SGlnaGxpZ2h0TGVuZ3RoO1xuICAgICAgICB2YXIgaGlnaGxpZ2h0ZWQgPSBoaWdobGlnaHRMaW5lKGNtLCBsaW5lLCB0b29Mb25nID8gY29weVN0YXRlKGRvYy5tb2RlLCBzdGF0ZSkgOiBzdGF0ZSwgdHJ1ZSk7XG4gICAgICAgIGxpbmUuc3R5bGVzID0gaGlnaGxpZ2h0ZWQuc3R5bGVzO1xuICAgICAgICB2YXIgb2xkQ2xzID0gbGluZS5zdHlsZUNsYXNzZXMsIG5ld0NscyA9IGhpZ2hsaWdodGVkLmNsYXNzZXM7XG4gICAgICAgIGlmIChuZXdDbHMpIGxpbmUuc3R5bGVDbGFzc2VzID0gbmV3Q2xzO1xuICAgICAgICBlbHNlIGlmIChvbGRDbHMpIGxpbmUuc3R5bGVDbGFzc2VzID0gbnVsbDtcbiAgICAgICAgdmFyIGlzY2hhbmdlID0gIW9sZFN0eWxlcyB8fCBvbGRTdHlsZXMubGVuZ3RoICE9IGxpbmUuc3R5bGVzLmxlbmd0aCB8fFxuICAgICAgICAgIG9sZENscyAhPSBuZXdDbHMgJiYgKCFvbGRDbHMgfHwgIW5ld0NscyB8fCBvbGRDbHMuYmdDbGFzcyAhPSBuZXdDbHMuYmdDbGFzcyB8fCBvbGRDbHMudGV4dENsYXNzICE9IG5ld0Nscy50ZXh0Q2xhc3MpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgIWlzY2hhbmdlICYmIGkgPCBvbGRTdHlsZXMubGVuZ3RoOyArK2kpIGlzY2hhbmdlID0gb2xkU3R5bGVzW2ldICE9IGxpbmUuc3R5bGVzW2ldO1xuICAgICAgICBpZiAoaXNjaGFuZ2UpIGNoYW5nZWRMaW5lcy5wdXNoKGRvYy5mcm9udGllcik7XG4gICAgICAgIGxpbmUuc3RhdGVBZnRlciA9IHRvb0xvbmcgPyBzdGF0ZSA6IGNvcHlTdGF0ZShkb2MubW9kZSwgc3RhdGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGxpbmUudGV4dC5sZW5ndGggPD0gY20ub3B0aW9ucy5tYXhIaWdobGlnaHRMZW5ndGgpXG4gICAgICAgICAgcHJvY2Vzc0xpbmUoY20sIGxpbmUudGV4dCwgc3RhdGUpO1xuICAgICAgICBsaW5lLnN0YXRlQWZ0ZXIgPSBkb2MuZnJvbnRpZXIgJSA1ID09IDAgPyBjb3B5U3RhdGUoZG9jLm1vZGUsIHN0YXRlKSA6IG51bGw7XG4gICAgICB9XG4gICAgICArK2RvYy5mcm9udGllcjtcbiAgICAgIGlmICgrbmV3IERhdGUgPiBlbmQpIHtcbiAgICAgICAgc3RhcnRXb3JrZXIoY20sIGNtLm9wdGlvbnMud29ya0RlbGF5KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGNoYW5nZWRMaW5lcy5sZW5ndGgpIHJ1bkluT3AoY20sIGZ1bmN0aW9uKCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VkTGluZXMubGVuZ3RoOyBpKyspXG4gICAgICAgIHJlZ0xpbmVDaGFuZ2UoY20sIGNoYW5nZWRMaW5lc1tpXSwgXCJ0ZXh0XCIpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gRmluZHMgdGhlIGxpbmUgdG8gc3RhcnQgd2l0aCB3aGVuIHN0YXJ0aW5nIGEgcGFyc2UuIFRyaWVzIHRvXG4gIC8vIGZpbmQgYSBsaW5lIHdpdGggYSBzdGF0ZUFmdGVyLCBzbyB0aGF0IGl0IGNhbiBzdGFydCB3aXRoIGFcbiAgLy8gdmFsaWQgc3RhdGUuIElmIHRoYXQgZmFpbHMsIGl0IHJldHVybnMgdGhlIGxpbmUgd2l0aCB0aGVcbiAgLy8gc21hbGxlc3QgaW5kZW50YXRpb24sIHdoaWNoIHRlbmRzIHRvIG5lZWQgdGhlIGxlYXN0IGNvbnRleHQgdG9cbiAgLy8gcGFyc2UgY29ycmVjdGx5LlxuICBmdW5jdGlvbiBmaW5kU3RhcnRMaW5lKGNtLCBuLCBwcmVjaXNlKSB7XG4gICAgdmFyIG1pbmluZGVudCwgbWlubGluZSwgZG9jID0gY20uZG9jO1xuICAgIHZhciBsaW0gPSBwcmVjaXNlID8gLTEgOiBuIC0gKGNtLmRvYy5tb2RlLmlubmVyTW9kZSA/IDEwMDAgOiAxMDApO1xuICAgIGZvciAodmFyIHNlYXJjaCA9IG47IHNlYXJjaCA+IGxpbTsgLS1zZWFyY2gpIHtcbiAgICAgIGlmIChzZWFyY2ggPD0gZG9jLmZpcnN0KSByZXR1cm4gZG9jLmZpcnN0O1xuICAgICAgdmFyIGxpbmUgPSBnZXRMaW5lKGRvYywgc2VhcmNoIC0gMSk7XG4gICAgICBpZiAobGluZS5zdGF0ZUFmdGVyICYmICghcHJlY2lzZSB8fCBzZWFyY2ggPD0gZG9jLmZyb250aWVyKSkgcmV0dXJuIHNlYXJjaDtcbiAgICAgIHZhciBpbmRlbnRlZCA9IGNvdW50Q29sdW1uKGxpbmUudGV4dCwgbnVsbCwgY20ub3B0aW9ucy50YWJTaXplKTtcbiAgICAgIGlmIChtaW5saW5lID09IG51bGwgfHwgbWluaW5kZW50ID4gaW5kZW50ZWQpIHtcbiAgICAgICAgbWlubGluZSA9IHNlYXJjaCAtIDE7XG4gICAgICAgIG1pbmluZGVudCA9IGluZGVudGVkO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWlubGluZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFN0YXRlQmVmb3JlKGNtLCBuLCBwcmVjaXNlKSB7XG4gICAgdmFyIGRvYyA9IGNtLmRvYywgZGlzcGxheSA9IGNtLmRpc3BsYXk7XG4gICAgaWYgKCFkb2MubW9kZS5zdGFydFN0YXRlKSByZXR1cm4gdHJ1ZTtcbiAgICB2YXIgcG9zID0gZmluZFN0YXJ0TGluZShjbSwgbiwgcHJlY2lzZSksIHN0YXRlID0gcG9zID4gZG9jLmZpcnN0ICYmIGdldExpbmUoZG9jLCBwb3MtMSkuc3RhdGVBZnRlcjtcbiAgICBpZiAoIXN0YXRlKSBzdGF0ZSA9IHN0YXJ0U3RhdGUoZG9jLm1vZGUpO1xuICAgIGVsc2Ugc3RhdGUgPSBjb3B5U3RhdGUoZG9jLm1vZGUsIHN0YXRlKTtcbiAgICBkb2MuaXRlcihwb3MsIG4sIGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgIHByb2Nlc3NMaW5lKGNtLCBsaW5lLnRleHQsIHN0YXRlKTtcbiAgICAgIHZhciBzYXZlID0gcG9zID09IG4gLSAxIHx8IHBvcyAlIDUgPT0gMCB8fCBwb3MgPj0gZGlzcGxheS52aWV3RnJvbSAmJiBwb3MgPCBkaXNwbGF5LnZpZXdUbztcbiAgICAgIGxpbmUuc3RhdGVBZnRlciA9IHNhdmUgPyBjb3B5U3RhdGUoZG9jLm1vZGUsIHN0YXRlKSA6IG51bGw7XG4gICAgICArK3BvcztcbiAgICB9KTtcbiAgICBpZiAocHJlY2lzZSkgZG9jLmZyb250aWVyID0gcG9zO1xuICAgIHJldHVybiBzdGF0ZTtcbiAgfVxuXG4gIC8vIFBPU0lUSU9OIE1FQVNVUkVNRU5UXG5cbiAgZnVuY3Rpb24gcGFkZGluZ1RvcChkaXNwbGF5KSB7cmV0dXJuIGRpc3BsYXkubGluZVNwYWNlLm9mZnNldFRvcDt9XG4gIGZ1bmN0aW9uIHBhZGRpbmdWZXJ0KGRpc3BsYXkpIHtyZXR1cm4gZGlzcGxheS5tb3Zlci5vZmZzZXRIZWlnaHQgLSBkaXNwbGF5LmxpbmVTcGFjZS5vZmZzZXRIZWlnaHQ7fVxuICBmdW5jdGlvbiBwYWRkaW5nSChkaXNwbGF5KSB7XG4gICAgaWYgKGRpc3BsYXkuY2FjaGVkUGFkZGluZ0gpIHJldHVybiBkaXNwbGF5LmNhY2hlZFBhZGRpbmdIO1xuICAgIHZhciBlID0gcmVtb3ZlQ2hpbGRyZW5BbmRBZGQoZGlzcGxheS5tZWFzdXJlLCBlbHQoXCJwcmVcIiwgXCJ4XCIpKTtcbiAgICB2YXIgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSA/IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGUpIDogZS5jdXJyZW50U3R5bGU7XG4gICAgdmFyIGRhdGEgPSB7bGVmdDogcGFyc2VJbnQoc3R5bGUucGFkZGluZ0xlZnQpLCByaWdodDogcGFyc2VJbnQoc3R5bGUucGFkZGluZ1JpZ2h0KX07XG4gICAgaWYgKCFpc05hTihkYXRhLmxlZnQpICYmICFpc05hTihkYXRhLnJpZ2h0KSkgZGlzcGxheS5jYWNoZWRQYWRkaW5nSCA9IGRhdGE7XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1cblxuICBmdW5jdGlvbiBzY3JvbGxHYXAoY20pIHsgcmV0dXJuIHNjcm9sbGVyR2FwIC0gY20uZGlzcGxheS5uYXRpdmVCYXJXaWR0aDsgfVxuICBmdW5jdGlvbiBkaXNwbGF5V2lkdGgoY20pIHtcbiAgICByZXR1cm4gY20uZGlzcGxheS5zY3JvbGxlci5jbGllbnRXaWR0aCAtIHNjcm9sbEdhcChjbSkgLSBjbS5kaXNwbGF5LmJhcldpZHRoO1xuICB9XG4gIGZ1bmN0aW9uIGRpc3BsYXlIZWlnaHQoY20pIHtcbiAgICByZXR1cm4gY20uZGlzcGxheS5zY3JvbGxlci5jbGllbnRIZWlnaHQgLSBzY3JvbGxHYXAoY20pIC0gY20uZGlzcGxheS5iYXJIZWlnaHQ7XG4gIH1cblxuICAvLyBFbnN1cmUgdGhlIGxpbmVWaWV3LndyYXBwaW5nLmhlaWdodHMgYXJyYXkgaXMgcG9wdWxhdGVkLiBUaGlzIGlzXG4gIC8vIGFuIGFycmF5IG9mIGJvdHRvbSBvZmZzZXRzIGZvciB0aGUgbGluZXMgdGhhdCBtYWtlIHVwIGEgZHJhd25cbiAgLy8gbGluZS4gV2hlbiBsaW5lV3JhcHBpbmcgaXMgb24sIHRoZXJlIG1pZ2h0IGJlIG1vcmUgdGhhbiBvbmVcbiAgLy8gaGVpZ2h0LlxuICBmdW5jdGlvbiBlbnN1cmVMaW5lSGVpZ2h0cyhjbSwgbGluZVZpZXcsIHJlY3QpIHtcbiAgICB2YXIgd3JhcHBpbmcgPSBjbS5vcHRpb25zLmxpbmVXcmFwcGluZztcbiAgICB2YXIgY3VyV2lkdGggPSB3cmFwcGluZyAmJiBkaXNwbGF5V2lkdGgoY20pO1xuICAgIGlmICghbGluZVZpZXcubWVhc3VyZS5oZWlnaHRzIHx8IHdyYXBwaW5nICYmIGxpbmVWaWV3Lm1lYXN1cmUud2lkdGggIT0gY3VyV2lkdGgpIHtcbiAgICAgIHZhciBoZWlnaHRzID0gbGluZVZpZXcubWVhc3VyZS5oZWlnaHRzID0gW107XG4gICAgICBpZiAod3JhcHBpbmcpIHtcbiAgICAgICAgbGluZVZpZXcubWVhc3VyZS53aWR0aCA9IGN1cldpZHRoO1xuICAgICAgICB2YXIgcmVjdHMgPSBsaW5lVmlldy50ZXh0LmZpcnN0Q2hpbGQuZ2V0Q2xpZW50UmVjdHMoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWN0cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICB2YXIgY3VyID0gcmVjdHNbaV0sIG5leHQgPSByZWN0c1tpICsgMV07XG4gICAgICAgICAgaWYgKE1hdGguYWJzKGN1ci5ib3R0b20gLSBuZXh0LmJvdHRvbSkgPiAyKVxuICAgICAgICAgICAgaGVpZ2h0cy5wdXNoKChjdXIuYm90dG9tICsgbmV4dC50b3ApIC8gMiAtIHJlY3QudG9wKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaGVpZ2h0cy5wdXNoKHJlY3QuYm90dG9tIC0gcmVjdC50b3ApO1xuICAgIH1cbiAgfVxuXG4gIC8vIEZpbmQgYSBsaW5lIG1hcCAobWFwcGluZyBjaGFyYWN0ZXIgb2Zmc2V0cyB0byB0ZXh0IG5vZGVzKSBhbmQgYVxuICAvLyBtZWFzdXJlbWVudCBjYWNoZSBmb3IgdGhlIGdpdmVuIGxpbmUgbnVtYmVyLiAoQSBsaW5lIHZpZXcgbWlnaHRcbiAgLy8gY29udGFpbiBtdWx0aXBsZSBsaW5lcyB3aGVuIGNvbGxhcHNlZCByYW5nZXMgYXJlIHByZXNlbnQuKVxuICBmdW5jdGlvbiBtYXBGcm9tTGluZVZpZXcobGluZVZpZXcsIGxpbmUsIGxpbmVOKSB7XG4gICAgaWYgKGxpbmVWaWV3LmxpbmUgPT0gbGluZSlcbiAgICAgIHJldHVybiB7bWFwOiBsaW5lVmlldy5tZWFzdXJlLm1hcCwgY2FjaGU6IGxpbmVWaWV3Lm1lYXN1cmUuY2FjaGV9O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZVZpZXcucmVzdC5sZW5ndGg7IGkrKylcbiAgICAgIGlmIChsaW5lVmlldy5yZXN0W2ldID09IGxpbmUpXG4gICAgICAgIHJldHVybiB7bWFwOiBsaW5lVmlldy5tZWFzdXJlLm1hcHNbaV0sIGNhY2hlOiBsaW5lVmlldy5tZWFzdXJlLmNhY2hlc1tpXX07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lVmlldy5yZXN0Lmxlbmd0aDsgaSsrKVxuICAgICAgaWYgKGxpbmVObyhsaW5lVmlldy5yZXN0W2ldKSA+IGxpbmVOKVxuICAgICAgICByZXR1cm4ge21hcDogbGluZVZpZXcubWVhc3VyZS5tYXBzW2ldLCBjYWNoZTogbGluZVZpZXcubWVhc3VyZS5jYWNoZXNbaV0sIGJlZm9yZTogdHJ1ZX07XG4gIH1cblxuICAvLyBSZW5kZXIgYSBsaW5lIGludG8gdGhlIGhpZGRlbiBub2RlIGRpc3BsYXkuZXh0ZXJuYWxNZWFzdXJlZC4gVXNlZFxuICAvLyB3aGVuIG1lYXN1cmVtZW50IGlzIG5lZWRlZCBmb3IgYSBsaW5lIHRoYXQncyBub3QgaW4gdGhlIHZpZXdwb3J0LlxuICBmdW5jdGlvbiB1cGRhdGVFeHRlcm5hbE1lYXN1cmVtZW50KGNtLCBsaW5lKSB7XG4gICAgbGluZSA9IHZpc3VhbExpbmUobGluZSk7XG4gICAgdmFyIGxpbmVOID0gbGluZU5vKGxpbmUpO1xuICAgIHZhciB2aWV3ID0gY20uZGlzcGxheS5leHRlcm5hbE1lYXN1cmVkID0gbmV3IExpbmVWaWV3KGNtLmRvYywgbGluZSwgbGluZU4pO1xuICAgIHZpZXcubGluZU4gPSBsaW5lTjtcbiAgICB2YXIgYnVpbHQgPSB2aWV3LmJ1aWx0ID0gYnVpbGRMaW5lQ29udGVudChjbSwgdmlldyk7XG4gICAgdmlldy50ZXh0ID0gYnVpbHQucHJlO1xuICAgIHJlbW92ZUNoaWxkcmVuQW5kQWRkKGNtLmRpc3BsYXkubGluZU1lYXN1cmUsIGJ1aWx0LnByZSk7XG4gICAgcmV0dXJuIHZpZXc7XG4gIH1cblxuICAvLyBHZXQgYSB7dG9wLCBib3R0b20sIGxlZnQsIHJpZ2h0fSBib3ggKGluIGxpbmUtbG9jYWwgY29vcmRpbmF0ZXMpXG4gIC8vIGZvciBhIGdpdmVuIGNoYXJhY3Rlci5cbiAgZnVuY3Rpb24gbWVhc3VyZUNoYXIoY20sIGxpbmUsIGNoLCBiaWFzKSB7XG4gICAgcmV0dXJuIG1lYXN1cmVDaGFyUHJlcGFyZWQoY20sIHByZXBhcmVNZWFzdXJlRm9yTGluZShjbSwgbGluZSksIGNoLCBiaWFzKTtcbiAgfVxuXG4gIC8vIEZpbmQgYSBsaW5lIHZpZXcgdGhhdCBjb3JyZXNwb25kcyB0byB0aGUgZ2l2ZW4gbGluZSBudW1iZXIuXG4gIGZ1bmN0aW9uIGZpbmRWaWV3Rm9yTGluZShjbSwgbGluZU4pIHtcbiAgICBpZiAobGluZU4gPj0gY20uZGlzcGxheS52aWV3RnJvbSAmJiBsaW5lTiA8IGNtLmRpc3BsYXkudmlld1RvKVxuICAgICAgcmV0dXJuIGNtLmRpc3BsYXkudmlld1tmaW5kVmlld0luZGV4KGNtLCBsaW5lTildO1xuICAgIHZhciBleHQgPSBjbS5kaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQ7XG4gICAgaWYgKGV4dCAmJiBsaW5lTiA+PSBleHQubGluZU4gJiYgbGluZU4gPCBleHQubGluZU4gKyBleHQuc2l6ZSlcbiAgICAgIHJldHVybiBleHQ7XG4gIH1cblxuICAvLyBNZWFzdXJlbWVudCBjYW4gYmUgc3BsaXQgaW4gdHdvIHN0ZXBzLCB0aGUgc2V0LXVwIHdvcmsgdGhhdFxuICAvLyBhcHBsaWVzIHRvIHRoZSB3aG9sZSBsaW5lLCBhbmQgdGhlIG1lYXN1cmVtZW50IG9mIHRoZSBhY3R1YWxcbiAgLy8gY2hhcmFjdGVyLiBGdW5jdGlvbnMgbGlrZSBjb29yZHNDaGFyLCB0aGF0IG5lZWQgdG8gZG8gYSBsb3Qgb2ZcbiAgLy8gbWVhc3VyZW1lbnRzIGluIGEgcm93LCBjYW4gdGh1cyBlbnN1cmUgdGhhdCB0aGUgc2V0LXVwIHdvcmsgaXNcbiAgLy8gb25seSBkb25lIG9uY2UuXG4gIGZ1bmN0aW9uIHByZXBhcmVNZWFzdXJlRm9yTGluZShjbSwgbGluZSkge1xuICAgIHZhciBsaW5lTiA9IGxpbmVObyhsaW5lKTtcbiAgICB2YXIgdmlldyA9IGZpbmRWaWV3Rm9yTGluZShjbSwgbGluZU4pO1xuICAgIGlmICh2aWV3ICYmICF2aWV3LnRleHQpIHtcbiAgICAgIHZpZXcgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAodmlldyAmJiB2aWV3LmNoYW5nZXMpIHtcbiAgICAgIHVwZGF0ZUxpbmVGb3JDaGFuZ2VzKGNtLCB2aWV3LCBsaW5lTiwgZ2V0RGltZW5zaW9ucyhjbSkpO1xuICAgICAgY20uY3VyT3AuZm9yY2VVcGRhdGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoIXZpZXcpXG4gICAgICB2aWV3ID0gdXBkYXRlRXh0ZXJuYWxNZWFzdXJlbWVudChjbSwgbGluZSk7XG5cbiAgICB2YXIgaW5mbyA9IG1hcEZyb21MaW5lVmlldyh2aWV3LCBsaW5lLCBsaW5lTik7XG4gICAgcmV0dXJuIHtcbiAgICAgIGxpbmU6IGxpbmUsIHZpZXc6IHZpZXcsIHJlY3Q6IG51bGwsXG4gICAgICBtYXA6IGluZm8ubWFwLCBjYWNoZTogaW5mby5jYWNoZSwgYmVmb3JlOiBpbmZvLmJlZm9yZSxcbiAgICAgIGhhc0hlaWdodHM6IGZhbHNlXG4gICAgfTtcbiAgfVxuXG4gIC8vIEdpdmVuIGEgcHJlcGFyZWQgbWVhc3VyZW1lbnQgb2JqZWN0LCBtZWFzdXJlcyB0aGUgcG9zaXRpb24gb2YgYW5cbiAgLy8gYWN0dWFsIGNoYXJhY3RlciAob3IgZmV0Y2hlcyBpdCBmcm9tIHRoZSBjYWNoZSkuXG4gIGZ1bmN0aW9uIG1lYXN1cmVDaGFyUHJlcGFyZWQoY20sIHByZXBhcmVkLCBjaCwgYmlhcywgdmFySGVpZ2h0KSB7XG4gICAgaWYgKHByZXBhcmVkLmJlZm9yZSkgY2ggPSAtMTtcbiAgICB2YXIga2V5ID0gY2ggKyAoYmlhcyB8fCBcIlwiKSwgZm91bmQ7XG4gICAgaWYgKHByZXBhcmVkLmNhY2hlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgIGZvdW5kID0gcHJlcGFyZWQuY2FjaGVba2V5XTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFwcmVwYXJlZC5yZWN0KVxuICAgICAgICBwcmVwYXJlZC5yZWN0ID0gcHJlcGFyZWQudmlldy50ZXh0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKCFwcmVwYXJlZC5oYXNIZWlnaHRzKSB7XG4gICAgICAgIGVuc3VyZUxpbmVIZWlnaHRzKGNtLCBwcmVwYXJlZC52aWV3LCBwcmVwYXJlZC5yZWN0KTtcbiAgICAgICAgcHJlcGFyZWQuaGFzSGVpZ2h0cyA9IHRydWU7XG4gICAgICB9XG4gICAgICBmb3VuZCA9IG1lYXN1cmVDaGFySW5uZXIoY20sIHByZXBhcmVkLCBjaCwgYmlhcyk7XG4gICAgICBpZiAoIWZvdW5kLmJvZ3VzKSBwcmVwYXJlZC5jYWNoZVtrZXldID0gZm91bmQ7XG4gICAgfVxuICAgIHJldHVybiB7bGVmdDogZm91bmQubGVmdCwgcmlnaHQ6IGZvdW5kLnJpZ2h0LFxuICAgICAgICAgICAgdG9wOiB2YXJIZWlnaHQgPyBmb3VuZC5ydG9wIDogZm91bmQudG9wLFxuICAgICAgICAgICAgYm90dG9tOiB2YXJIZWlnaHQgPyBmb3VuZC5yYm90dG9tIDogZm91bmQuYm90dG9tfTtcbiAgfVxuXG4gIHZhciBudWxsUmVjdCA9IHtsZWZ0OiAwLCByaWdodDogMCwgdG9wOiAwLCBib3R0b206IDB9O1xuXG4gIGZ1bmN0aW9uIG5vZGVBbmRPZmZzZXRJbkxpbmVNYXAobWFwLCBjaCwgYmlhcykge1xuICAgIHZhciBub2RlLCBzdGFydCwgZW5kLCBjb2xsYXBzZTtcbiAgICAvLyBGaXJzdCwgc2VhcmNoIHRoZSBsaW5lIG1hcCBmb3IgdGhlIHRleHQgbm9kZSBjb3JyZXNwb25kaW5nIHRvLFxuICAgIC8vIG9yIGNsb3Nlc3QgdG8sIHRoZSB0YXJnZXQgY2hhcmFjdGVyLlxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWFwLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICB2YXIgbVN0YXJ0ID0gbWFwW2ldLCBtRW5kID0gbWFwW2kgKyAxXTtcbiAgICAgIGlmIChjaCA8IG1TdGFydCkge1xuICAgICAgICBzdGFydCA9IDA7IGVuZCA9IDE7XG4gICAgICAgIGNvbGxhcHNlID0gXCJsZWZ0XCI7XG4gICAgICB9IGVsc2UgaWYgKGNoIDwgbUVuZCkge1xuICAgICAgICBzdGFydCA9IGNoIC0gbVN0YXJ0O1xuICAgICAgICBlbmQgPSBzdGFydCArIDE7XG4gICAgICB9IGVsc2UgaWYgKGkgPT0gbWFwLmxlbmd0aCAtIDMgfHwgY2ggPT0gbUVuZCAmJiBtYXBbaSArIDNdID4gY2gpIHtcbiAgICAgICAgZW5kID0gbUVuZCAtIG1TdGFydDtcbiAgICAgICAgc3RhcnQgPSBlbmQgLSAxO1xuICAgICAgICBpZiAoY2ggPj0gbUVuZCkgY29sbGFwc2UgPSBcInJpZ2h0XCI7XG4gICAgICB9XG4gICAgICBpZiAoc3RhcnQgIT0gbnVsbCkge1xuICAgICAgICBub2RlID0gbWFwW2kgKyAyXTtcbiAgICAgICAgaWYgKG1TdGFydCA9PSBtRW5kICYmIGJpYXMgPT0gKG5vZGUuaW5zZXJ0TGVmdCA/IFwibGVmdFwiIDogXCJyaWdodFwiKSlcbiAgICAgICAgICBjb2xsYXBzZSA9IGJpYXM7XG4gICAgICAgIGlmIChiaWFzID09IFwibGVmdFwiICYmIHN0YXJ0ID09IDApXG4gICAgICAgICAgd2hpbGUgKGkgJiYgbWFwW2kgLSAyXSA9PSBtYXBbaSAtIDNdICYmIG1hcFtpIC0gMV0uaW5zZXJ0TGVmdCkge1xuICAgICAgICAgICAgbm9kZSA9IG1hcFsoaSAtPSAzKSArIDJdO1xuICAgICAgICAgICAgY29sbGFwc2UgPSBcImxlZnRcIjtcbiAgICAgICAgICB9XG4gICAgICAgIGlmIChiaWFzID09IFwicmlnaHRcIiAmJiBzdGFydCA9PSBtRW5kIC0gbVN0YXJ0KVxuICAgICAgICAgIHdoaWxlIChpIDwgbWFwLmxlbmd0aCAtIDMgJiYgbWFwW2kgKyAzXSA9PSBtYXBbaSArIDRdICYmICFtYXBbaSArIDVdLmluc2VydExlZnQpIHtcbiAgICAgICAgICAgIG5vZGUgPSBtYXBbKGkgKz0gMykgKyAyXTtcbiAgICAgICAgICAgIGNvbGxhcHNlID0gXCJyaWdodFwiO1xuICAgICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7bm9kZTogbm9kZSwgc3RhcnQ6IHN0YXJ0LCBlbmQ6IGVuZCwgY29sbGFwc2U6IGNvbGxhcHNlLCBjb3ZlclN0YXJ0OiBtU3RhcnQsIGNvdmVyRW5kOiBtRW5kfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1lYXN1cmVDaGFySW5uZXIoY20sIHByZXBhcmVkLCBjaCwgYmlhcykge1xuICAgIHZhciBwbGFjZSA9IG5vZGVBbmRPZmZzZXRJbkxpbmVNYXAocHJlcGFyZWQubWFwLCBjaCwgYmlhcyk7XG4gICAgdmFyIG5vZGUgPSBwbGFjZS5ub2RlLCBzdGFydCA9IHBsYWNlLnN0YXJ0LCBlbmQgPSBwbGFjZS5lbmQsIGNvbGxhcHNlID0gcGxhY2UuY29sbGFwc2U7XG5cbiAgICB2YXIgcmVjdDtcbiAgICBpZiAobm9kZS5ub2RlVHlwZSA9PSAzKSB7IC8vIElmIGl0IGlzIGEgdGV4dCBub2RlLCB1c2UgYSByYW5nZSB0byByZXRyaWV2ZSB0aGUgY29vcmRpbmF0ZXMuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDQ7IGkrKykgeyAvLyBSZXRyeSBhIG1heGltdW0gb2YgNCB0aW1lcyB3aGVuIG5vbnNlbnNlIHJlY3RhbmdsZXMgYXJlIHJldHVybmVkXG4gICAgICAgIHdoaWxlIChzdGFydCAmJiBpc0V4dGVuZGluZ0NoYXIocHJlcGFyZWQubGluZS50ZXh0LmNoYXJBdChwbGFjZS5jb3ZlclN0YXJ0ICsgc3RhcnQpKSkgLS1zdGFydDtcbiAgICAgICAgd2hpbGUgKHBsYWNlLmNvdmVyU3RhcnQgKyBlbmQgPCBwbGFjZS5jb3ZlckVuZCAmJiBpc0V4dGVuZGluZ0NoYXIocHJlcGFyZWQubGluZS50ZXh0LmNoYXJBdChwbGFjZS5jb3ZlclN0YXJ0ICsgZW5kKSkpICsrZW5kO1xuICAgICAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDkgJiYgc3RhcnQgPT0gMCAmJiBlbmQgPT0gcGxhY2UuY292ZXJFbmQgLSBwbGFjZS5jb3ZlclN0YXJ0KSB7XG4gICAgICAgICAgcmVjdCA9IG5vZGUucGFyZW50Tm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpZSAmJiBjbS5vcHRpb25zLmxpbmVXcmFwcGluZykge1xuICAgICAgICAgIHZhciByZWN0cyA9IHJhbmdlKG5vZGUsIHN0YXJ0LCBlbmQpLmdldENsaWVudFJlY3RzKCk7XG4gICAgICAgICAgaWYgKHJlY3RzLmxlbmd0aClcbiAgICAgICAgICAgIHJlY3QgPSByZWN0c1tiaWFzID09IFwicmlnaHRcIiA/IHJlY3RzLmxlbmd0aCAtIDEgOiAwXTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICByZWN0ID0gbnVsbFJlY3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVjdCA9IHJhbmdlKG5vZGUsIHN0YXJ0LCBlbmQpLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpIHx8IG51bGxSZWN0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZWN0LmxlZnQgfHwgcmVjdC5yaWdodCB8fCBzdGFydCA9PSAwKSBicmVhaztcbiAgICAgICAgZW5kID0gc3RhcnQ7XG4gICAgICAgIHN0YXJ0ID0gc3RhcnQgLSAxO1xuICAgICAgICBjb2xsYXBzZSA9IFwicmlnaHRcIjtcbiAgICAgIH1cbiAgICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgMTEpIHJlY3QgPSBtYXliZVVwZGF0ZVJlY3RGb3Jab29taW5nKGNtLmRpc3BsYXkubWVhc3VyZSwgcmVjdCk7XG4gICAgfSBlbHNlIHsgLy8gSWYgaXQgaXMgYSB3aWRnZXQsIHNpbXBseSBnZXQgdGhlIGJveCBmb3IgdGhlIHdob2xlIHdpZGdldC5cbiAgICAgIGlmIChzdGFydCA+IDApIGNvbGxhcHNlID0gYmlhcyA9IFwicmlnaHRcIjtcbiAgICAgIHZhciByZWN0cztcbiAgICAgIGlmIChjbS5vcHRpb25zLmxpbmVXcmFwcGluZyAmJiAocmVjdHMgPSBub2RlLmdldENsaWVudFJlY3RzKCkpLmxlbmd0aCA+IDEpXG4gICAgICAgIHJlY3QgPSByZWN0c1tiaWFzID09IFwicmlnaHRcIiA/IHJlY3RzLmxlbmd0aCAtIDEgOiAwXTtcbiAgICAgIGVsc2VcbiAgICAgICAgcmVjdCA9IG5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgfVxuICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOSAmJiAhc3RhcnQgJiYgKCFyZWN0IHx8ICFyZWN0LmxlZnQgJiYgIXJlY3QucmlnaHQpKSB7XG4gICAgICB2YXIgclNwYW4gPSBub2RlLnBhcmVudE5vZGUuZ2V0Q2xpZW50UmVjdHMoKVswXTtcbiAgICAgIGlmIChyU3BhbilcbiAgICAgICAgcmVjdCA9IHtsZWZ0OiByU3Bhbi5sZWZ0LCByaWdodDogclNwYW4ubGVmdCArIGNoYXJXaWR0aChjbS5kaXNwbGF5KSwgdG9wOiByU3Bhbi50b3AsIGJvdHRvbTogclNwYW4uYm90dG9tfTtcbiAgICAgIGVsc2VcbiAgICAgICAgcmVjdCA9IG51bGxSZWN0O1xuICAgIH1cblxuICAgIHZhciBydG9wID0gcmVjdC50b3AgLSBwcmVwYXJlZC5yZWN0LnRvcCwgcmJvdCA9IHJlY3QuYm90dG9tIC0gcHJlcGFyZWQucmVjdC50b3A7XG4gICAgdmFyIG1pZCA9IChydG9wICsgcmJvdCkgLyAyO1xuICAgIHZhciBoZWlnaHRzID0gcHJlcGFyZWQudmlldy5tZWFzdXJlLmhlaWdodHM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBoZWlnaHRzLmxlbmd0aCAtIDE7IGkrKylcbiAgICAgIGlmIChtaWQgPCBoZWlnaHRzW2ldKSBicmVhaztcbiAgICB2YXIgdG9wID0gaSA/IGhlaWdodHNbaSAtIDFdIDogMCwgYm90ID0gaGVpZ2h0c1tpXTtcbiAgICB2YXIgcmVzdWx0ID0ge2xlZnQ6IChjb2xsYXBzZSA9PSBcInJpZ2h0XCIgPyByZWN0LnJpZ2h0IDogcmVjdC5sZWZ0KSAtIHByZXBhcmVkLnJlY3QubGVmdCxcbiAgICAgICAgICAgICAgICAgIHJpZ2h0OiAoY29sbGFwc2UgPT0gXCJsZWZ0XCIgPyByZWN0LmxlZnQgOiByZWN0LnJpZ2h0KSAtIHByZXBhcmVkLnJlY3QubGVmdCxcbiAgICAgICAgICAgICAgICAgIHRvcDogdG9wLCBib3R0b206IGJvdH07XG4gICAgaWYgKCFyZWN0LmxlZnQgJiYgIXJlY3QucmlnaHQpIHJlc3VsdC5ib2d1cyA9IHRydWU7XG4gICAgaWYgKCFjbS5vcHRpb25zLnNpbmdsZUN1cnNvckhlaWdodFBlckxpbmUpIHsgcmVzdWx0LnJ0b3AgPSBydG9wOyByZXN1bHQucmJvdHRvbSA9IHJib3Q7IH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBXb3JrIGFyb3VuZCBwcm9ibGVtIHdpdGggYm91bmRpbmcgY2xpZW50IHJlY3RzIG9uIHJhbmdlcyBiZWluZ1xuICAvLyByZXR1cm5lZCBpbmNvcnJlY3RseSB3aGVuIHpvb21lZCBvbiBJRTEwIGFuZCBiZWxvdy5cbiAgZnVuY3Rpb24gbWF5YmVVcGRhdGVSZWN0Rm9yWm9vbWluZyhtZWFzdXJlLCByZWN0KSB7XG4gICAgaWYgKCF3aW5kb3cuc2NyZWVuIHx8IHNjcmVlbi5sb2dpY2FsWERQSSA9PSBudWxsIHx8XG4gICAgICAgIHNjcmVlbi5sb2dpY2FsWERQSSA9PSBzY3JlZW4uZGV2aWNlWERQSSB8fCAhaGFzQmFkWm9vbWVkUmVjdHMobWVhc3VyZSkpXG4gICAgICByZXR1cm4gcmVjdDtcbiAgICB2YXIgc2NhbGVYID0gc2NyZWVuLmxvZ2ljYWxYRFBJIC8gc2NyZWVuLmRldmljZVhEUEk7XG4gICAgdmFyIHNjYWxlWSA9IHNjcmVlbi5sb2dpY2FsWURQSSAvIHNjcmVlbi5kZXZpY2VZRFBJO1xuICAgIHJldHVybiB7bGVmdDogcmVjdC5sZWZ0ICogc2NhbGVYLCByaWdodDogcmVjdC5yaWdodCAqIHNjYWxlWCxcbiAgICAgICAgICAgIHRvcDogcmVjdC50b3AgKiBzY2FsZVksIGJvdHRvbTogcmVjdC5ib3R0b20gKiBzY2FsZVl9O1xuICB9XG5cbiAgZnVuY3Rpb24gY2xlYXJMaW5lTWVhc3VyZW1lbnRDYWNoZUZvcihsaW5lVmlldykge1xuICAgIGlmIChsaW5lVmlldy5tZWFzdXJlKSB7XG4gICAgICBsaW5lVmlldy5tZWFzdXJlLmNhY2hlID0ge307XG4gICAgICBsaW5lVmlldy5tZWFzdXJlLmhlaWdodHMgPSBudWxsO1xuICAgICAgaWYgKGxpbmVWaWV3LnJlc3QpIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZVZpZXcucmVzdC5sZW5ndGg7IGkrKylcbiAgICAgICAgbGluZVZpZXcubWVhc3VyZS5jYWNoZXNbaV0gPSB7fTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjbGVhckxpbmVNZWFzdXJlbWVudENhY2hlKGNtKSB7XG4gICAgY20uZGlzcGxheS5leHRlcm5hbE1lYXN1cmUgPSBudWxsO1xuICAgIHJlbW92ZUNoaWxkcmVuKGNtLmRpc3BsYXkubGluZU1lYXN1cmUpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY20uZGlzcGxheS52aWV3Lmxlbmd0aDsgaSsrKVxuICAgICAgY2xlYXJMaW5lTWVhc3VyZW1lbnRDYWNoZUZvcihjbS5kaXNwbGF5LnZpZXdbaV0pO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xlYXJDYWNoZXMoY20pIHtcbiAgICBjbGVhckxpbmVNZWFzdXJlbWVudENhY2hlKGNtKTtcbiAgICBjbS5kaXNwbGF5LmNhY2hlZENoYXJXaWR0aCA9IGNtLmRpc3BsYXkuY2FjaGVkVGV4dEhlaWdodCA9IGNtLmRpc3BsYXkuY2FjaGVkUGFkZGluZ0ggPSBudWxsO1xuICAgIGlmICghY20ub3B0aW9ucy5saW5lV3JhcHBpbmcpIGNtLmRpc3BsYXkubWF4TGluZUNoYW5nZWQgPSB0cnVlO1xuICAgIGNtLmRpc3BsYXkubGluZU51bUNoYXJzID0gbnVsbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhZ2VTY3JvbGxYKCkgeyByZXR1cm4gd2luZG93LnBhZ2VYT2Zmc2V0IHx8IChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgfHwgZG9jdW1lbnQuYm9keSkuc2Nyb2xsTGVmdDsgfVxuICBmdW5jdGlvbiBwYWdlU2Nyb2xsWSgpIHsgcmV0dXJuIHdpbmRvdy5wYWdlWU9mZnNldCB8fCAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50IHx8IGRvY3VtZW50LmJvZHkpLnNjcm9sbFRvcDsgfVxuXG4gIC8vIENvbnZlcnRzIGEge3RvcCwgYm90dG9tLCBsZWZ0LCByaWdodH0gYm94IGZyb20gbGluZS1sb2NhbFxuICAvLyBjb29yZGluYXRlcyBpbnRvIGFub3RoZXIgY29vcmRpbmF0ZSBzeXN0ZW0uIENvbnRleHQgbWF5IGJlIG9uZSBvZlxuICAvLyBcImxpbmVcIiwgXCJkaXZcIiAoZGlzcGxheS5saW5lRGl2KSwgXCJsb2NhbFwiL251bGwgKGVkaXRvciksIFwid2luZG93XCIsXG4gIC8vIG9yIFwicGFnZVwiLlxuICBmdW5jdGlvbiBpbnRvQ29vcmRTeXN0ZW0oY20sIGxpbmVPYmosIHJlY3QsIGNvbnRleHQpIHtcbiAgICBpZiAobGluZU9iai53aWRnZXRzKSBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmVPYmoud2lkZ2V0cy5sZW5ndGg7ICsraSkgaWYgKGxpbmVPYmoud2lkZ2V0c1tpXS5hYm92ZSkge1xuICAgICAgdmFyIHNpemUgPSB3aWRnZXRIZWlnaHQobGluZU9iai53aWRnZXRzW2ldKTtcbiAgICAgIHJlY3QudG9wICs9IHNpemU7IHJlY3QuYm90dG9tICs9IHNpemU7XG4gICAgfVxuICAgIGlmIChjb250ZXh0ID09IFwibGluZVwiKSByZXR1cm4gcmVjdDtcbiAgICBpZiAoIWNvbnRleHQpIGNvbnRleHQgPSBcImxvY2FsXCI7XG4gICAgdmFyIHlPZmYgPSBoZWlnaHRBdExpbmUobGluZU9iaik7XG4gICAgaWYgKGNvbnRleHQgPT0gXCJsb2NhbFwiKSB5T2ZmICs9IHBhZGRpbmdUb3AoY20uZGlzcGxheSk7XG4gICAgZWxzZSB5T2ZmIC09IGNtLmRpc3BsYXkudmlld09mZnNldDtcbiAgICBpZiAoY29udGV4dCA9PSBcInBhZ2VcIiB8fCBjb250ZXh0ID09IFwid2luZG93XCIpIHtcbiAgICAgIHZhciBsT2ZmID0gY20uZGlzcGxheS5saW5lU3BhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICB5T2ZmICs9IGxPZmYudG9wICsgKGNvbnRleHQgPT0gXCJ3aW5kb3dcIiA/IDAgOiBwYWdlU2Nyb2xsWSgpKTtcbiAgICAgIHZhciB4T2ZmID0gbE9mZi5sZWZ0ICsgKGNvbnRleHQgPT0gXCJ3aW5kb3dcIiA/IDAgOiBwYWdlU2Nyb2xsWCgpKTtcbiAgICAgIHJlY3QubGVmdCArPSB4T2ZmOyByZWN0LnJpZ2h0ICs9IHhPZmY7XG4gICAgfVxuICAgIHJlY3QudG9wICs9IHlPZmY7IHJlY3QuYm90dG9tICs9IHlPZmY7XG4gICAgcmV0dXJuIHJlY3Q7XG4gIH1cblxuICAvLyBDb3ZlcnRzIGEgYm94IGZyb20gXCJkaXZcIiBjb29yZHMgdG8gYW5vdGhlciBjb29yZGluYXRlIHN5c3RlbS5cbiAgLy8gQ29udGV4dCBtYXkgYmUgXCJ3aW5kb3dcIiwgXCJwYWdlXCIsIFwiZGl2XCIsIG9yIFwibG9jYWxcIi9udWxsLlxuICBmdW5jdGlvbiBmcm9tQ29vcmRTeXN0ZW0oY20sIGNvb3JkcywgY29udGV4dCkge1xuICAgIGlmIChjb250ZXh0ID09IFwiZGl2XCIpIHJldHVybiBjb29yZHM7XG4gICAgdmFyIGxlZnQgPSBjb29yZHMubGVmdCwgdG9wID0gY29vcmRzLnRvcDtcbiAgICAvLyBGaXJzdCBtb3ZlIGludG8gXCJwYWdlXCIgY29vcmRpbmF0ZSBzeXN0ZW1cbiAgICBpZiAoY29udGV4dCA9PSBcInBhZ2VcIikge1xuICAgICAgbGVmdCAtPSBwYWdlU2Nyb2xsWCgpO1xuICAgICAgdG9wIC09IHBhZ2VTY3JvbGxZKCk7XG4gICAgfSBlbHNlIGlmIChjb250ZXh0ID09IFwibG9jYWxcIiB8fCAhY29udGV4dCkge1xuICAgICAgdmFyIGxvY2FsQm94ID0gY20uZGlzcGxheS5zaXplci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGxlZnQgKz0gbG9jYWxCb3gubGVmdDtcbiAgICAgIHRvcCArPSBsb2NhbEJveC50b3A7XG4gICAgfVxuXG4gICAgdmFyIGxpbmVTcGFjZUJveCA9IGNtLmRpc3BsYXkubGluZVNwYWNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHJldHVybiB7bGVmdDogbGVmdCAtIGxpbmVTcGFjZUJveC5sZWZ0LCB0b3A6IHRvcCAtIGxpbmVTcGFjZUJveC50b3B9O1xuICB9XG5cbiAgZnVuY3Rpb24gY2hhckNvb3JkcyhjbSwgcG9zLCBjb250ZXh0LCBsaW5lT2JqLCBiaWFzKSB7XG4gICAgaWYgKCFsaW5lT2JqKSBsaW5lT2JqID0gZ2V0TGluZShjbS5kb2MsIHBvcy5saW5lKTtcbiAgICByZXR1cm4gaW50b0Nvb3JkU3lzdGVtKGNtLCBsaW5lT2JqLCBtZWFzdXJlQ2hhcihjbSwgbGluZU9iaiwgcG9zLmNoLCBiaWFzKSwgY29udGV4dCk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgYm94IGZvciBhIGdpdmVuIGN1cnNvciBwb3NpdGlvbiwgd2hpY2ggbWF5IGhhdmUgYW5cbiAgLy8gJ290aGVyJyBwcm9wZXJ0eSBjb250YWluaW5nIHRoZSBwb3NpdGlvbiBvZiB0aGUgc2Vjb25kYXJ5IGN1cnNvclxuICAvLyBvbiBhIGJpZGkgYm91bmRhcnkuXG4gIGZ1bmN0aW9uIGN1cnNvckNvb3JkcyhjbSwgcG9zLCBjb250ZXh0LCBsaW5lT2JqLCBwcmVwYXJlZE1lYXN1cmUsIHZhckhlaWdodCkge1xuICAgIGxpbmVPYmogPSBsaW5lT2JqIHx8IGdldExpbmUoY20uZG9jLCBwb3MubGluZSk7XG4gICAgaWYgKCFwcmVwYXJlZE1lYXN1cmUpIHByZXBhcmVkTWVhc3VyZSA9IHByZXBhcmVNZWFzdXJlRm9yTGluZShjbSwgbGluZU9iaik7XG4gICAgZnVuY3Rpb24gZ2V0KGNoLCByaWdodCkge1xuICAgICAgdmFyIG0gPSBtZWFzdXJlQ2hhclByZXBhcmVkKGNtLCBwcmVwYXJlZE1lYXN1cmUsIGNoLCByaWdodCA/IFwicmlnaHRcIiA6IFwibGVmdFwiLCB2YXJIZWlnaHQpO1xuICAgICAgaWYgKHJpZ2h0KSBtLmxlZnQgPSBtLnJpZ2h0OyBlbHNlIG0ucmlnaHQgPSBtLmxlZnQ7XG4gICAgICByZXR1cm4gaW50b0Nvb3JkU3lzdGVtKGNtLCBsaW5lT2JqLCBtLCBjb250ZXh0KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZ2V0QmlkaShjaCwgcGFydFBvcykge1xuICAgICAgdmFyIHBhcnQgPSBvcmRlcltwYXJ0UG9zXSwgcmlnaHQgPSBwYXJ0LmxldmVsICUgMjtcbiAgICAgIGlmIChjaCA9PSBiaWRpTGVmdChwYXJ0KSAmJiBwYXJ0UG9zICYmIHBhcnQubGV2ZWwgPCBvcmRlcltwYXJ0UG9zIC0gMV0ubGV2ZWwpIHtcbiAgICAgICAgcGFydCA9IG9yZGVyWy0tcGFydFBvc107XG4gICAgICAgIGNoID0gYmlkaVJpZ2h0KHBhcnQpIC0gKHBhcnQubGV2ZWwgJSAyID8gMCA6IDEpO1xuICAgICAgICByaWdodCA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKGNoID09IGJpZGlSaWdodChwYXJ0KSAmJiBwYXJ0UG9zIDwgb3JkZXIubGVuZ3RoIC0gMSAmJiBwYXJ0LmxldmVsIDwgb3JkZXJbcGFydFBvcyArIDFdLmxldmVsKSB7XG4gICAgICAgIHBhcnQgPSBvcmRlclsrK3BhcnRQb3NdO1xuICAgICAgICBjaCA9IGJpZGlMZWZ0KHBhcnQpIC0gcGFydC5sZXZlbCAlIDI7XG4gICAgICAgIHJpZ2h0ID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocmlnaHQgJiYgY2ggPT0gcGFydC50byAmJiBjaCA+IHBhcnQuZnJvbSkgcmV0dXJuIGdldChjaCAtIDEpO1xuICAgICAgcmV0dXJuIGdldChjaCwgcmlnaHQpO1xuICAgIH1cbiAgICB2YXIgb3JkZXIgPSBnZXRPcmRlcihsaW5lT2JqKSwgY2ggPSBwb3MuY2g7XG4gICAgaWYgKCFvcmRlcikgcmV0dXJuIGdldChjaCk7XG4gICAgdmFyIHBhcnRQb3MgPSBnZXRCaWRpUGFydEF0KG9yZGVyLCBjaCk7XG4gICAgdmFyIHZhbCA9IGdldEJpZGkoY2gsIHBhcnRQb3MpO1xuICAgIGlmIChiaWRpT3RoZXIgIT0gbnVsbCkgdmFsLm90aGVyID0gZ2V0QmlkaShjaCwgYmlkaU90aGVyKTtcbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgLy8gVXNlZCB0byBjaGVhcGx5IGVzdGltYXRlIHRoZSBjb29yZGluYXRlcyBmb3IgYSBwb3NpdGlvbi4gVXNlZCBmb3JcbiAgLy8gaW50ZXJtZWRpYXRlIHNjcm9sbCB1cGRhdGVzLlxuICBmdW5jdGlvbiBlc3RpbWF0ZUNvb3JkcyhjbSwgcG9zKSB7XG4gICAgdmFyIGxlZnQgPSAwLCBwb3MgPSBjbGlwUG9zKGNtLmRvYywgcG9zKTtcbiAgICBpZiAoIWNtLm9wdGlvbnMubGluZVdyYXBwaW5nKSBsZWZ0ID0gY2hhcldpZHRoKGNtLmRpc3BsYXkpICogcG9zLmNoO1xuICAgIHZhciBsaW5lT2JqID0gZ2V0TGluZShjbS5kb2MsIHBvcy5saW5lKTtcbiAgICB2YXIgdG9wID0gaGVpZ2h0QXRMaW5lKGxpbmVPYmopICsgcGFkZGluZ1RvcChjbS5kaXNwbGF5KTtcbiAgICByZXR1cm4ge2xlZnQ6IGxlZnQsIHJpZ2h0OiBsZWZ0LCB0b3A6IHRvcCwgYm90dG9tOiB0b3AgKyBsaW5lT2JqLmhlaWdodH07XG4gIH1cblxuICAvLyBQb3NpdGlvbnMgcmV0dXJuZWQgYnkgY29vcmRzQ2hhciBjb250YWluIHNvbWUgZXh0cmEgaW5mb3JtYXRpb24uXG4gIC8vIHhSZWwgaXMgdGhlIHJlbGF0aXZlIHggcG9zaXRpb24gb2YgdGhlIGlucHV0IGNvb3JkaW5hdGVzIGNvbXBhcmVkXG4gIC8vIHRvIHRoZSBmb3VuZCBwb3NpdGlvbiAoc28geFJlbCA+IDAgbWVhbnMgdGhlIGNvb3JkaW5hdGVzIGFyZSB0b1xuICAvLyB0aGUgcmlnaHQgb2YgdGhlIGNoYXJhY3RlciBwb3NpdGlvbiwgZm9yIGV4YW1wbGUpLiBXaGVuIG91dHNpZGVcbiAgLy8gaXMgdHJ1ZSwgdGhhdCBtZWFucyB0aGUgY29vcmRpbmF0ZXMgbGllIG91dHNpZGUgdGhlIGxpbmUnc1xuICAvLyB2ZXJ0aWNhbCByYW5nZS5cbiAgZnVuY3Rpb24gUG9zV2l0aEluZm8obGluZSwgY2gsIG91dHNpZGUsIHhSZWwpIHtcbiAgICB2YXIgcG9zID0gUG9zKGxpbmUsIGNoKTtcbiAgICBwb3MueFJlbCA9IHhSZWw7XG4gICAgaWYgKG91dHNpZGUpIHBvcy5vdXRzaWRlID0gdHJ1ZTtcbiAgICByZXR1cm4gcG9zO1xuICB9XG5cbiAgLy8gQ29tcHV0ZSB0aGUgY2hhcmFjdGVyIHBvc2l0aW9uIGNsb3Nlc3QgdG8gdGhlIGdpdmVuIGNvb3JkaW5hdGVzLlxuICAvLyBJbnB1dCBtdXN0IGJlIGxpbmVTcGFjZS1sb2NhbCAoXCJkaXZcIiBjb29yZGluYXRlIHN5c3RlbSkuXG4gIGZ1bmN0aW9uIGNvb3Jkc0NoYXIoY20sIHgsIHkpIHtcbiAgICB2YXIgZG9jID0gY20uZG9jO1xuICAgIHkgKz0gY20uZGlzcGxheS52aWV3T2Zmc2V0O1xuICAgIGlmICh5IDwgMCkgcmV0dXJuIFBvc1dpdGhJbmZvKGRvYy5maXJzdCwgMCwgdHJ1ZSwgLTEpO1xuICAgIHZhciBsaW5lTiA9IGxpbmVBdEhlaWdodChkb2MsIHkpLCBsYXN0ID0gZG9jLmZpcnN0ICsgZG9jLnNpemUgLSAxO1xuICAgIGlmIChsaW5lTiA+IGxhc3QpXG4gICAgICByZXR1cm4gUG9zV2l0aEluZm8oZG9jLmZpcnN0ICsgZG9jLnNpemUgLSAxLCBnZXRMaW5lKGRvYywgbGFzdCkudGV4dC5sZW5ndGgsIHRydWUsIDEpO1xuICAgIGlmICh4IDwgMCkgeCA9IDA7XG5cbiAgICB2YXIgbGluZU9iaiA9IGdldExpbmUoZG9jLCBsaW5lTik7XG4gICAgZm9yICg7Oykge1xuICAgICAgdmFyIGZvdW5kID0gY29vcmRzQ2hhcklubmVyKGNtLCBsaW5lT2JqLCBsaW5lTiwgeCwgeSk7XG4gICAgICB2YXIgbWVyZ2VkID0gY29sbGFwc2VkU3BhbkF0RW5kKGxpbmVPYmopO1xuICAgICAgdmFyIG1lcmdlZFBvcyA9IG1lcmdlZCAmJiBtZXJnZWQuZmluZCgwLCB0cnVlKTtcbiAgICAgIGlmIChtZXJnZWQgJiYgKGZvdW5kLmNoID4gbWVyZ2VkUG9zLmZyb20uY2ggfHwgZm91bmQuY2ggPT0gbWVyZ2VkUG9zLmZyb20uY2ggJiYgZm91bmQueFJlbCA+IDApKVxuICAgICAgICBsaW5lTiA9IGxpbmVObyhsaW5lT2JqID0gbWVyZ2VkUG9zLnRvLmxpbmUpO1xuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZm91bmQ7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY29vcmRzQ2hhcklubmVyKGNtLCBsaW5lT2JqLCBsaW5lTm8sIHgsIHkpIHtcbiAgICB2YXIgaW5uZXJPZmYgPSB5IC0gaGVpZ2h0QXRMaW5lKGxpbmVPYmopO1xuICAgIHZhciB3cm9uZ0xpbmUgPSBmYWxzZSwgYWRqdXN0ID0gMiAqIGNtLmRpc3BsYXkud3JhcHBlci5jbGllbnRXaWR0aDtcbiAgICB2YXIgcHJlcGFyZWRNZWFzdXJlID0gcHJlcGFyZU1lYXN1cmVGb3JMaW5lKGNtLCBsaW5lT2JqKTtcblxuICAgIGZ1bmN0aW9uIGdldFgoY2gpIHtcbiAgICAgIHZhciBzcCA9IGN1cnNvckNvb3JkcyhjbSwgUG9zKGxpbmVObywgY2gpLCBcImxpbmVcIiwgbGluZU9iaiwgcHJlcGFyZWRNZWFzdXJlKTtcbiAgICAgIHdyb25nTGluZSA9IHRydWU7XG4gICAgICBpZiAoaW5uZXJPZmYgPiBzcC5ib3R0b20pIHJldHVybiBzcC5sZWZ0IC0gYWRqdXN0O1xuICAgICAgZWxzZSBpZiAoaW5uZXJPZmYgPCBzcC50b3ApIHJldHVybiBzcC5sZWZ0ICsgYWRqdXN0O1xuICAgICAgZWxzZSB3cm9uZ0xpbmUgPSBmYWxzZTtcbiAgICAgIHJldHVybiBzcC5sZWZ0O1xuICAgIH1cblxuICAgIHZhciBiaWRpID0gZ2V0T3JkZXIobGluZU9iaiksIGRpc3QgPSBsaW5lT2JqLnRleHQubGVuZ3RoO1xuICAgIHZhciBmcm9tID0gbGluZUxlZnQobGluZU9iaiksIHRvID0gbGluZVJpZ2h0KGxpbmVPYmopO1xuICAgIHZhciBmcm9tWCA9IGdldFgoZnJvbSksIGZyb21PdXRzaWRlID0gd3JvbmdMaW5lLCB0b1ggPSBnZXRYKHRvKSwgdG9PdXRzaWRlID0gd3JvbmdMaW5lO1xuXG4gICAgaWYgKHggPiB0b1gpIHJldHVybiBQb3NXaXRoSW5mbyhsaW5lTm8sIHRvLCB0b091dHNpZGUsIDEpO1xuICAgIC8vIERvIGEgYmluYXJ5IHNlYXJjaCBiZXR3ZWVuIHRoZXNlIGJvdW5kcy5cbiAgICBmb3IgKDs7KSB7XG4gICAgICBpZiAoYmlkaSA/IHRvID09IGZyb20gfHwgdG8gPT0gbW92ZVZpc3VhbGx5KGxpbmVPYmosIGZyb20sIDEpIDogdG8gLSBmcm9tIDw9IDEpIHtcbiAgICAgICAgdmFyIGNoID0geCA8IGZyb21YIHx8IHggLSBmcm9tWCA8PSB0b1ggLSB4ID8gZnJvbSA6IHRvO1xuICAgICAgICB2YXIgeERpZmYgPSB4IC0gKGNoID09IGZyb20gPyBmcm9tWCA6IHRvWCk7XG4gICAgICAgIHdoaWxlIChpc0V4dGVuZGluZ0NoYXIobGluZU9iai50ZXh0LmNoYXJBdChjaCkpKSArK2NoO1xuICAgICAgICB2YXIgcG9zID0gUG9zV2l0aEluZm8obGluZU5vLCBjaCwgY2ggPT0gZnJvbSA/IGZyb21PdXRzaWRlIDogdG9PdXRzaWRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeERpZmYgPCAtMSA/IC0xIDogeERpZmYgPiAxID8gMSA6IDApO1xuICAgICAgICByZXR1cm4gcG9zO1xuICAgICAgfVxuICAgICAgdmFyIHN0ZXAgPSBNYXRoLmNlaWwoZGlzdCAvIDIpLCBtaWRkbGUgPSBmcm9tICsgc3RlcDtcbiAgICAgIGlmIChiaWRpKSB7XG4gICAgICAgIG1pZGRsZSA9IGZyb207XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RlcDsgKytpKSBtaWRkbGUgPSBtb3ZlVmlzdWFsbHkobGluZU9iaiwgbWlkZGxlLCAxKTtcbiAgICAgIH1cbiAgICAgIHZhciBtaWRkbGVYID0gZ2V0WChtaWRkbGUpO1xuICAgICAgaWYgKG1pZGRsZVggPiB4KSB7dG8gPSBtaWRkbGU7IHRvWCA9IG1pZGRsZVg7IGlmICh0b091dHNpZGUgPSB3cm9uZ0xpbmUpIHRvWCArPSAxMDAwOyBkaXN0ID0gc3RlcDt9XG4gICAgICBlbHNlIHtmcm9tID0gbWlkZGxlOyBmcm9tWCA9IG1pZGRsZVg7IGZyb21PdXRzaWRlID0gd3JvbmdMaW5lOyBkaXN0IC09IHN0ZXA7fVxuICAgIH1cbiAgfVxuXG4gIHZhciBtZWFzdXJlVGV4dDtcbiAgLy8gQ29tcHV0ZSB0aGUgZGVmYXVsdCB0ZXh0IGhlaWdodC5cbiAgZnVuY3Rpb24gdGV4dEhlaWdodChkaXNwbGF5KSB7XG4gICAgaWYgKGRpc3BsYXkuY2FjaGVkVGV4dEhlaWdodCAhPSBudWxsKSByZXR1cm4gZGlzcGxheS5jYWNoZWRUZXh0SGVpZ2h0O1xuICAgIGlmIChtZWFzdXJlVGV4dCA9PSBudWxsKSB7XG4gICAgICBtZWFzdXJlVGV4dCA9IGVsdChcInByZVwiKTtcbiAgICAgIC8vIE1lYXN1cmUgYSBidW5jaCBvZiBsaW5lcywgZm9yIGJyb3dzZXJzIHRoYXQgY29tcHV0ZVxuICAgICAgLy8gZnJhY3Rpb25hbCBoZWlnaHRzLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCA0OTsgKytpKSB7XG4gICAgICAgIG1lYXN1cmVUZXh0LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwieFwiKSk7XG4gICAgICAgIG1lYXN1cmVUZXh0LmFwcGVuZENoaWxkKGVsdChcImJyXCIpKTtcbiAgICAgIH1cbiAgICAgIG1lYXN1cmVUZXh0LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwieFwiKSk7XG4gICAgfVxuICAgIHJlbW92ZUNoaWxkcmVuQW5kQWRkKGRpc3BsYXkubWVhc3VyZSwgbWVhc3VyZVRleHQpO1xuICAgIHZhciBoZWlnaHQgPSBtZWFzdXJlVGV4dC5vZmZzZXRIZWlnaHQgLyA1MDtcbiAgICBpZiAoaGVpZ2h0ID4gMykgZGlzcGxheS5jYWNoZWRUZXh0SGVpZ2h0ID0gaGVpZ2h0O1xuICAgIHJlbW92ZUNoaWxkcmVuKGRpc3BsYXkubWVhc3VyZSk7XG4gICAgcmV0dXJuIGhlaWdodCB8fCAxO1xuICB9XG5cbiAgLy8gQ29tcHV0ZSB0aGUgZGVmYXVsdCBjaGFyYWN0ZXIgd2lkdGguXG4gIGZ1bmN0aW9uIGNoYXJXaWR0aChkaXNwbGF5KSB7XG4gICAgaWYgKGRpc3BsYXkuY2FjaGVkQ2hhcldpZHRoICE9IG51bGwpIHJldHVybiBkaXNwbGF5LmNhY2hlZENoYXJXaWR0aDtcbiAgICB2YXIgYW5jaG9yID0gZWx0KFwic3BhblwiLCBcInh4eHh4eHh4eHhcIik7XG4gICAgdmFyIHByZSA9IGVsdChcInByZVwiLCBbYW5jaG9yXSk7XG4gICAgcmVtb3ZlQ2hpbGRyZW5BbmRBZGQoZGlzcGxheS5tZWFzdXJlLCBwcmUpO1xuICAgIHZhciByZWN0ID0gYW5jaG9yLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLCB3aWR0aCA9IChyZWN0LnJpZ2h0IC0gcmVjdC5sZWZ0KSAvIDEwO1xuICAgIGlmICh3aWR0aCA+IDIpIGRpc3BsYXkuY2FjaGVkQ2hhcldpZHRoID0gd2lkdGg7XG4gICAgcmV0dXJuIHdpZHRoIHx8IDEwO1xuICB9XG5cbiAgLy8gT1BFUkFUSU9OU1xuXG4gIC8vIE9wZXJhdGlvbnMgYXJlIHVzZWQgdG8gd3JhcCBhIHNlcmllcyBvZiBjaGFuZ2VzIHRvIHRoZSBlZGl0b3JcbiAgLy8gc3RhdGUgaW4gc3VjaCBhIHdheSB0aGF0IGVhY2ggY2hhbmdlIHdvbid0IGhhdmUgdG8gdXBkYXRlIHRoZVxuICAvLyBjdXJzb3IgYW5kIGRpc3BsYXkgKHdoaWNoIHdvdWxkIGJlIGF3a3dhcmQsIHNsb3csIGFuZFxuICAvLyBlcnJvci1wcm9uZSkuIEluc3RlYWQsIGRpc3BsYXkgdXBkYXRlcyBhcmUgYmF0Y2hlZCBhbmQgdGhlbiBhbGxcbiAgLy8gY29tYmluZWQgYW5kIGV4ZWN1dGVkIGF0IG9uY2UuXG5cbiAgdmFyIG9wZXJhdGlvbkdyb3VwID0gbnVsbDtcblxuICB2YXIgbmV4dE9wSWQgPSAwO1xuICAvLyBTdGFydCBhIG5ldyBvcGVyYXRpb24uXG4gIGZ1bmN0aW9uIHN0YXJ0T3BlcmF0aW9uKGNtKSB7XG4gICAgY20uY3VyT3AgPSB7XG4gICAgICBjbTogY20sXG4gICAgICB2aWV3Q2hhbmdlZDogZmFsc2UsICAgICAgLy8gRmxhZyB0aGF0IGluZGljYXRlcyB0aGF0IGxpbmVzIG1pZ2h0IG5lZWQgdG8gYmUgcmVkcmF3blxuICAgICAgc3RhcnRIZWlnaHQ6IGNtLmRvYy5oZWlnaHQsIC8vIFVzZWQgdG8gZGV0ZWN0IG5lZWQgdG8gdXBkYXRlIHNjcm9sbGJhclxuICAgICAgZm9yY2VVcGRhdGU6IGZhbHNlLCAgICAgIC8vIFVzZWQgdG8gZm9yY2UgYSByZWRyYXdcbiAgICAgIHVwZGF0ZUlucHV0OiBudWxsLCAgICAgICAvLyBXaGV0aGVyIHRvIHJlc2V0IHRoZSBpbnB1dCB0ZXh0YXJlYVxuICAgICAgdHlwaW5nOiBmYWxzZSwgICAgICAgICAgIC8vIFdoZXRoZXIgdGhpcyByZXNldCBzaG91bGQgYmUgY2FyZWZ1bCB0byBsZWF2ZSBleGlzdGluZyB0ZXh0IChmb3IgY29tcG9zaXRpbmcpXG4gICAgICBjaGFuZ2VPYmpzOiBudWxsLCAgICAgICAgLy8gQWNjdW11bGF0ZWQgY2hhbmdlcywgZm9yIGZpcmluZyBjaGFuZ2UgZXZlbnRzXG4gICAgICBjdXJzb3JBY3Rpdml0eUhhbmRsZXJzOiBudWxsLCAvLyBTZXQgb2YgaGFuZGxlcnMgdG8gZmlyZSBjdXJzb3JBY3Rpdml0eSBvblxuICAgICAgY3Vyc29yQWN0aXZpdHlDYWxsZWQ6IDAsIC8vIFRyYWNrcyB3aGljaCBjdXJzb3JBY3Rpdml0eSBoYW5kbGVycyBoYXZlIGJlZW4gY2FsbGVkIGFscmVhZHlcbiAgICAgIHNlbGVjdGlvbkNoYW5nZWQ6IGZhbHNlLCAvLyBXaGV0aGVyIHRoZSBzZWxlY3Rpb24gbmVlZHMgdG8gYmUgcmVkcmF3blxuICAgICAgdXBkYXRlTWF4TGluZTogZmFsc2UsICAgIC8vIFNldCB3aGVuIHRoZSB3aWRlc3QgbGluZSBuZWVkcyB0byBiZSBkZXRlcm1pbmVkIGFuZXdcbiAgICAgIHNjcm9sbExlZnQ6IG51bGwsIHNjcm9sbFRvcDogbnVsbCwgLy8gSW50ZXJtZWRpYXRlIHNjcm9sbCBwb3NpdGlvbiwgbm90IHB1c2hlZCB0byBET00geWV0XG4gICAgICBzY3JvbGxUb1BvczogbnVsbCwgICAgICAgLy8gVXNlZCB0byBzY3JvbGwgdG8gYSBzcGVjaWZpYyBwb3NpdGlvblxuICAgICAgZm9jdXM6IGZhbHNlLFxuICAgICAgaWQ6ICsrbmV4dE9wSWQgICAgICAgICAgIC8vIFVuaXF1ZSBJRFxuICAgIH07XG4gICAgaWYgKG9wZXJhdGlvbkdyb3VwKSB7XG4gICAgICBvcGVyYXRpb25Hcm91cC5vcHMucHVzaChjbS5jdXJPcCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNtLmN1ck9wLm93bnNHcm91cCA9IG9wZXJhdGlvbkdyb3VwID0ge1xuICAgICAgICBvcHM6IFtjbS5jdXJPcF0sXG4gICAgICAgIGRlbGF5ZWRDYWxsYmFja3M6IFtdXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZpcmVDYWxsYmFja3NGb3JPcHMoZ3JvdXApIHtcbiAgICAvLyBDYWxscyBkZWxheWVkIGNhbGxiYWNrcyBhbmQgY3Vyc29yQWN0aXZpdHkgaGFuZGxlcnMgdW50aWwgbm9cbiAgICAvLyBuZXcgb25lcyBhcHBlYXJcbiAgICB2YXIgY2FsbGJhY2tzID0gZ3JvdXAuZGVsYXllZENhbGxiYWNrcywgaSA9IDA7XG4gICAgZG8ge1xuICAgICAgZm9yICg7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspXG4gICAgICAgIGNhbGxiYWNrc1tpXS5jYWxsKG51bGwpO1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBncm91cC5vcHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgdmFyIG9wID0gZ3JvdXAub3BzW2pdO1xuICAgICAgICBpZiAob3AuY3Vyc29yQWN0aXZpdHlIYW5kbGVycylcbiAgICAgICAgICB3aGlsZSAob3AuY3Vyc29yQWN0aXZpdHlDYWxsZWQgPCBvcC5jdXJzb3JBY3Rpdml0eUhhbmRsZXJzLmxlbmd0aClcbiAgICAgICAgICAgIG9wLmN1cnNvckFjdGl2aXR5SGFuZGxlcnNbb3AuY3Vyc29yQWN0aXZpdHlDYWxsZWQrK10uY2FsbChudWxsLCBvcC5jbSk7XG4gICAgICB9XG4gICAgfSB3aGlsZSAoaSA8IGNhbGxiYWNrcy5sZW5ndGgpO1xuICB9XG5cbiAgLy8gRmluaXNoIGFuIG9wZXJhdGlvbiwgdXBkYXRpbmcgdGhlIGRpc3BsYXkgYW5kIHNpZ25hbGxpbmcgZGVsYXllZCBldmVudHNcbiAgZnVuY3Rpb24gZW5kT3BlcmF0aW9uKGNtKSB7XG4gICAgdmFyIG9wID0gY20uY3VyT3AsIGdyb3VwID0gb3Aub3duc0dyb3VwO1xuICAgIGlmICghZ3JvdXApIHJldHVybjtcblxuICAgIHRyeSB7IGZpcmVDYWxsYmFja3NGb3JPcHMoZ3JvdXApOyB9XG4gICAgZmluYWxseSB7XG4gICAgICBvcGVyYXRpb25Hcm91cCA9IG51bGw7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdyb3VwLm9wcy5sZW5ndGg7IGkrKylcbiAgICAgICAgZ3JvdXAub3BzW2ldLmNtLmN1ck9wID0gbnVsbDtcbiAgICAgIGVuZE9wZXJhdGlvbnMoZ3JvdXApO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZSBET00gdXBkYXRlcyBkb25lIHdoZW4gYW4gb3BlcmF0aW9uIGZpbmlzaGVzIGFyZSBiYXRjaGVkIHNvXG4gIC8vIHRoYXQgdGhlIG1pbmltdW0gbnVtYmVyIG9mIHJlbGF5b3V0cyBhcmUgcmVxdWlyZWQuXG4gIGZ1bmN0aW9uIGVuZE9wZXJhdGlvbnMoZ3JvdXApIHtcbiAgICB2YXIgb3BzID0gZ3JvdXAub3BzO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSAvLyBSZWFkIERPTVxuICAgICAgZW5kT3BlcmF0aW9uX1IxKG9wc1tpXSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIC8vIFdyaXRlIERPTSAobWF5YmUpXG4gICAgICBlbmRPcGVyYXRpb25fVzEob3BzW2ldKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wcy5sZW5ndGg7IGkrKykgLy8gUmVhZCBET01cbiAgICAgIGVuZE9wZXJhdGlvbl9SMihvcHNbaV0pO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSAvLyBXcml0ZSBET00gKG1heWJlKVxuICAgICAgZW5kT3BlcmF0aW9uX1cyKG9wc1tpXSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIC8vIFJlYWQgRE9NXG4gICAgICBlbmRPcGVyYXRpb25fZmluaXNoKG9wc1tpXSk7XG4gIH1cblxuICBmdW5jdGlvbiBlbmRPcGVyYXRpb25fUjEob3ApIHtcbiAgICB2YXIgY20gPSBvcC5jbSwgZGlzcGxheSA9IGNtLmRpc3BsYXk7XG4gICAgbWF5YmVDbGlwU2Nyb2xsYmFycyhjbSk7XG4gICAgaWYgKG9wLnVwZGF0ZU1heExpbmUpIGZpbmRNYXhMaW5lKGNtKTtcblxuICAgIG9wLm11c3RVcGRhdGUgPSBvcC52aWV3Q2hhbmdlZCB8fCBvcC5mb3JjZVVwZGF0ZSB8fCBvcC5zY3JvbGxUb3AgIT0gbnVsbCB8fFxuICAgICAgb3Auc2Nyb2xsVG9Qb3MgJiYgKG9wLnNjcm9sbFRvUG9zLmZyb20ubGluZSA8IGRpc3BsYXkudmlld0Zyb20gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICBvcC5zY3JvbGxUb1Bvcy50by5saW5lID49IGRpc3BsYXkudmlld1RvKSB8fFxuICAgICAgZGlzcGxheS5tYXhMaW5lQ2hhbmdlZCAmJiBjbS5vcHRpb25zLmxpbmVXcmFwcGluZztcbiAgICBvcC51cGRhdGUgPSBvcC5tdXN0VXBkYXRlICYmXG4gICAgICBuZXcgRGlzcGxheVVwZGF0ZShjbSwgb3AubXVzdFVwZGF0ZSAmJiB7dG9wOiBvcC5zY3JvbGxUb3AsIGVuc3VyZTogb3Auc2Nyb2xsVG9Qb3N9LCBvcC5mb3JjZVVwZGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBlbmRPcGVyYXRpb25fVzEob3ApIHtcbiAgICBvcC51cGRhdGVkRGlzcGxheSA9IG9wLm11c3RVcGRhdGUgJiYgdXBkYXRlRGlzcGxheUlmTmVlZGVkKG9wLmNtLCBvcC51cGRhdGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5kT3BlcmF0aW9uX1IyKG9wKSB7XG4gICAgdmFyIGNtID0gb3AuY20sIGRpc3BsYXkgPSBjbS5kaXNwbGF5O1xuICAgIGlmIChvcC51cGRhdGVkRGlzcGxheSkgdXBkYXRlSGVpZ2h0c0luVmlld3BvcnQoY20pO1xuXG4gICAgb3AuYmFyTWVhc3VyZSA9IG1lYXN1cmVGb3JTY3JvbGxiYXJzKGNtKTtcblxuICAgIC8vIElmIHRoZSBtYXggbGluZSBjaGFuZ2VkIHNpbmNlIGl0IHdhcyBsYXN0IG1lYXN1cmVkLCBtZWFzdXJlIGl0LFxuICAgIC8vIGFuZCBlbnN1cmUgdGhlIGRvY3VtZW50J3Mgd2lkdGggbWF0Y2hlcyBpdC5cbiAgICAvLyB1cGRhdGVEaXNwbGF5X1cyIHdpbGwgdXNlIHRoZXNlIHByb3BlcnRpZXMgdG8gZG8gdGhlIGFjdHVhbCByZXNpemluZ1xuICAgIGlmIChkaXNwbGF5Lm1heExpbmVDaGFuZ2VkICYmICFjbS5vcHRpb25zLmxpbmVXcmFwcGluZykge1xuICAgICAgb3AuYWRqdXN0V2lkdGhUbyA9IG1lYXN1cmVDaGFyKGNtLCBkaXNwbGF5Lm1heExpbmUsIGRpc3BsYXkubWF4TGluZS50ZXh0Lmxlbmd0aCkubGVmdCArIDM7XG4gICAgICBjbS5kaXNwbGF5LnNpemVyV2lkdGggPSBvcC5hZGp1c3RXaWR0aFRvO1xuICAgICAgb3AuYmFyTWVhc3VyZS5zY3JvbGxXaWR0aCA9XG4gICAgICAgIE1hdGgubWF4KGRpc3BsYXkuc2Nyb2xsZXIuY2xpZW50V2lkdGgsIGRpc3BsYXkuc2l6ZXIub2Zmc2V0TGVmdCArIG9wLmFkanVzdFdpZHRoVG8gKyBzY3JvbGxHYXAoY20pICsgY20uZGlzcGxheS5iYXJXaWR0aCk7XG4gICAgICBvcC5tYXhTY3JvbGxMZWZ0ID0gTWF0aC5tYXgoMCwgZGlzcGxheS5zaXplci5vZmZzZXRMZWZ0ICsgb3AuYWRqdXN0V2lkdGhUbyAtIGRpc3BsYXlXaWR0aChjbSkpO1xuICAgIH1cblxuICAgIGlmIChvcC51cGRhdGVkRGlzcGxheSB8fCBvcC5zZWxlY3Rpb25DaGFuZ2VkKVxuICAgICAgb3AucHJlcGFyZWRTZWxlY3Rpb24gPSBkaXNwbGF5LmlucHV0LnByZXBhcmVTZWxlY3Rpb24oKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuZE9wZXJhdGlvbl9XMihvcCkge1xuICAgIHZhciBjbSA9IG9wLmNtO1xuXG4gICAgaWYgKG9wLmFkanVzdFdpZHRoVG8gIT0gbnVsbCkge1xuICAgICAgY20uZGlzcGxheS5zaXplci5zdHlsZS5taW5XaWR0aCA9IG9wLmFkanVzdFdpZHRoVG8gKyBcInB4XCI7XG4gICAgICBpZiAob3AubWF4U2Nyb2xsTGVmdCA8IGNtLmRvYy5zY3JvbGxMZWZ0KVxuICAgICAgICBzZXRTY3JvbGxMZWZ0KGNtLCBNYXRoLm1pbihjbS5kaXNwbGF5LnNjcm9sbGVyLnNjcm9sbExlZnQsIG9wLm1heFNjcm9sbExlZnQpLCB0cnVlKTtcbiAgICAgIGNtLmRpc3BsYXkubWF4TGluZUNoYW5nZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAob3AucHJlcGFyZWRTZWxlY3Rpb24pXG4gICAgICBjbS5kaXNwbGF5LmlucHV0LnNob3dTZWxlY3Rpb24ob3AucHJlcGFyZWRTZWxlY3Rpb24pO1xuICAgIGlmIChvcC51cGRhdGVkRGlzcGxheSlcbiAgICAgIHNldERvY3VtZW50SGVpZ2h0KGNtLCBvcC5iYXJNZWFzdXJlKTtcbiAgICBpZiAob3AudXBkYXRlZERpc3BsYXkgfHwgb3Auc3RhcnRIZWlnaHQgIT0gY20uZG9jLmhlaWdodClcbiAgICAgIHVwZGF0ZVNjcm9sbGJhcnMoY20sIG9wLmJhck1lYXN1cmUpO1xuXG4gICAgaWYgKG9wLnNlbGVjdGlvbkNoYW5nZWQpIHJlc3RhcnRCbGluayhjbSk7XG5cbiAgICBpZiAoY20uc3RhdGUuZm9jdXNlZCAmJiBvcC51cGRhdGVJbnB1dClcbiAgICAgIGNtLmRpc3BsYXkuaW5wdXQucmVzZXQob3AudHlwaW5nKTtcbiAgICBpZiAob3AuZm9jdXMgJiYgb3AuZm9jdXMgPT0gYWN0aXZlRWx0KCkgJiYgKCFkb2N1bWVudC5oYXNGb2N1cyB8fCBkb2N1bWVudC5oYXNGb2N1cygpKSlcbiAgICAgIGVuc3VyZUZvY3VzKG9wLmNtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuZE9wZXJhdGlvbl9maW5pc2gob3ApIHtcbiAgICB2YXIgY20gPSBvcC5jbSwgZGlzcGxheSA9IGNtLmRpc3BsYXksIGRvYyA9IGNtLmRvYztcblxuICAgIGlmIChvcC51cGRhdGVkRGlzcGxheSkgcG9zdFVwZGF0ZURpc3BsYXkoY20sIG9wLnVwZGF0ZSk7XG5cbiAgICAvLyBBYm9ydCBtb3VzZSB3aGVlbCBkZWx0YSBtZWFzdXJlbWVudCwgd2hlbiBzY3JvbGxpbmcgZXhwbGljaXRseVxuICAgIGlmIChkaXNwbGF5LndoZWVsU3RhcnRYICE9IG51bGwgJiYgKG9wLnNjcm9sbFRvcCAhPSBudWxsIHx8IG9wLnNjcm9sbExlZnQgIT0gbnVsbCB8fCBvcC5zY3JvbGxUb1BvcykpXG4gICAgICBkaXNwbGF5LndoZWVsU3RhcnRYID0gZGlzcGxheS53aGVlbFN0YXJ0WSA9IG51bGw7XG5cbiAgICAvLyBQcm9wYWdhdGUgdGhlIHNjcm9sbCBwb3NpdGlvbiB0byB0aGUgYWN0dWFsIERPTSBzY3JvbGxlclxuICAgIGlmIChvcC5zY3JvbGxUb3AgIT0gbnVsbCAmJiAoZGlzcGxheS5zY3JvbGxlci5zY3JvbGxUb3AgIT0gb3Auc2Nyb2xsVG9wIHx8IG9wLmZvcmNlU2Nyb2xsKSkge1xuICAgICAgZG9jLnNjcm9sbFRvcCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsSGVpZ2h0IC0gZGlzcGxheS5zY3JvbGxlci5jbGllbnRIZWlnaHQsIG9wLnNjcm9sbFRvcCkpO1xuICAgICAgZGlzcGxheS5zY3JvbGxiYXJzLnNldFNjcm9sbFRvcChkb2Muc2Nyb2xsVG9wKTtcbiAgICAgIGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wID0gZG9jLnNjcm9sbFRvcDtcbiAgICB9XG4gICAgaWYgKG9wLnNjcm9sbExlZnQgIT0gbnVsbCAmJiAoZGlzcGxheS5zY3JvbGxlci5zY3JvbGxMZWZ0ICE9IG9wLnNjcm9sbExlZnQgfHwgb3AuZm9yY2VTY3JvbGwpKSB7XG4gICAgICBkb2Muc2Nyb2xsTGVmdCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsV2lkdGggLSBkaXNwbGF5V2lkdGgoY20pLCBvcC5zY3JvbGxMZWZ0KSk7XG4gICAgICBkaXNwbGF5LnNjcm9sbGJhcnMuc2V0U2Nyb2xsTGVmdChkb2Muc2Nyb2xsTGVmdCk7XG4gICAgICBkaXNwbGF5LnNjcm9sbGVyLnNjcm9sbExlZnQgPSBkb2Muc2Nyb2xsTGVmdDtcbiAgICAgIGFsaWduSG9yaXpvbnRhbGx5KGNtKTtcbiAgICB9XG4gICAgLy8gSWYgd2UgbmVlZCB0byBzY3JvbGwgYSBzcGVjaWZpYyBwb3NpdGlvbiBpbnRvIHZpZXcsIGRvIHNvLlxuICAgIGlmIChvcC5zY3JvbGxUb1Bvcykge1xuICAgICAgdmFyIGNvb3JkcyA9IHNjcm9sbFBvc0ludG9WaWV3KGNtLCBjbGlwUG9zKGRvYywgb3Auc2Nyb2xsVG9Qb3MuZnJvbSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpcFBvcyhkb2MsIG9wLnNjcm9sbFRvUG9zLnRvKSwgb3Auc2Nyb2xsVG9Qb3MubWFyZ2luKTtcbiAgICAgIGlmIChvcC5zY3JvbGxUb1Bvcy5pc0N1cnNvciAmJiBjbS5zdGF0ZS5mb2N1c2VkKSBtYXliZVNjcm9sbFdpbmRvdyhjbSwgY29vcmRzKTtcbiAgICB9XG5cbiAgICAvLyBGaXJlIGV2ZW50cyBmb3IgbWFya2VycyB0aGF0IGFyZSBoaWRkZW4vdW5pZGRlbiBieSBlZGl0aW5nIG9yXG4gICAgLy8gdW5kb2luZ1xuICAgIHZhciBoaWRkZW4gPSBvcC5tYXliZUhpZGRlbk1hcmtlcnMsIHVuaGlkZGVuID0gb3AubWF5YmVVbmhpZGRlbk1hcmtlcnM7XG4gICAgaWYgKGhpZGRlbikgZm9yICh2YXIgaSA9IDA7IGkgPCBoaWRkZW4ubGVuZ3RoOyArK2kpXG4gICAgICBpZiAoIWhpZGRlbltpXS5saW5lcy5sZW5ndGgpIHNpZ25hbChoaWRkZW5baV0sIFwiaGlkZVwiKTtcbiAgICBpZiAodW5oaWRkZW4pIGZvciAodmFyIGkgPSAwOyBpIDwgdW5oaWRkZW4ubGVuZ3RoOyArK2kpXG4gICAgICBpZiAodW5oaWRkZW5baV0ubGluZXMubGVuZ3RoKSBzaWduYWwodW5oaWRkZW5baV0sIFwidW5oaWRlXCIpO1xuXG4gICAgaWYgKGRpc3BsYXkud3JhcHBlci5vZmZzZXRIZWlnaHQpXG4gICAgICBkb2Muc2Nyb2xsVG9wID0gY20uZGlzcGxheS5zY3JvbGxlci5zY3JvbGxUb3A7XG5cbiAgICAvLyBGaXJlIGNoYW5nZSBldmVudHMsIGFuZCBkZWxheWVkIGV2ZW50IGhhbmRsZXJzXG4gICAgaWYgKG9wLmNoYW5nZU9ianMpXG4gICAgICBzaWduYWwoY20sIFwiY2hhbmdlc1wiLCBjbSwgb3AuY2hhbmdlT2Jqcyk7XG4gICAgaWYgKG9wLnVwZGF0ZSlcbiAgICAgIG9wLnVwZGF0ZS5maW5pc2goKTtcbiAgfVxuXG4gIC8vIFJ1biB0aGUgZ2l2ZW4gZnVuY3Rpb24gaW4gYW4gb3BlcmF0aW9uXG4gIGZ1bmN0aW9uIHJ1bkluT3AoY20sIGYpIHtcbiAgICBpZiAoY20uY3VyT3ApIHJldHVybiBmKCk7XG4gICAgc3RhcnRPcGVyYXRpb24oY20pO1xuICAgIHRyeSB7IHJldHVybiBmKCk7IH1cbiAgICBmaW5hbGx5IHsgZW5kT3BlcmF0aW9uKGNtKTsgfVxuICB9XG4gIC8vIFdyYXBzIGEgZnVuY3Rpb24gaW4gYW4gb3BlcmF0aW9uLiBSZXR1cm5zIHRoZSB3cmFwcGVkIGZ1bmN0aW9uLlxuICBmdW5jdGlvbiBvcGVyYXRpb24oY20sIGYpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoY20uY3VyT3ApIHJldHVybiBmLmFwcGx5KGNtLCBhcmd1bWVudHMpO1xuICAgICAgc3RhcnRPcGVyYXRpb24oY20pO1xuICAgICAgdHJ5IHsgcmV0dXJuIGYuYXBwbHkoY20sIGFyZ3VtZW50cyk7IH1cbiAgICAgIGZpbmFsbHkgeyBlbmRPcGVyYXRpb24oY20pOyB9XG4gICAgfTtcbiAgfVxuICAvLyBVc2VkIHRvIGFkZCBtZXRob2RzIHRvIGVkaXRvciBhbmQgZG9jIGluc3RhbmNlcywgd3JhcHBpbmcgdGhlbSBpblxuICAvLyBvcGVyYXRpb25zLlxuICBmdW5jdGlvbiBtZXRob2RPcChmKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY3VyT3ApIHJldHVybiBmLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICBzdGFydE9wZXJhdGlvbih0aGlzKTtcbiAgICAgIHRyeSB7IHJldHVybiBmLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7IH1cbiAgICAgIGZpbmFsbHkgeyBlbmRPcGVyYXRpb24odGhpcyk7IH1cbiAgICB9O1xuICB9XG4gIGZ1bmN0aW9uIGRvY01ldGhvZE9wKGYpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY20gPSB0aGlzLmNtO1xuICAgICAgaWYgKCFjbSB8fCBjbS5jdXJPcCkgcmV0dXJuIGYuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHN0YXJ0T3BlcmF0aW9uKGNtKTtcbiAgICAgIHRyeSB7IHJldHVybiBmLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7IH1cbiAgICAgIGZpbmFsbHkgeyBlbmRPcGVyYXRpb24oY20pOyB9XG4gICAgfTtcbiAgfVxuXG4gIC8vIFZJRVcgVFJBQ0tJTkdcblxuICAvLyBUaGVzZSBvYmplY3RzIGFyZSB1c2VkIHRvIHJlcHJlc2VudCB0aGUgdmlzaWJsZSAoY3VycmVudGx5IGRyYXduKVxuICAvLyBwYXJ0IG9mIHRoZSBkb2N1bWVudC4gQSBMaW5lVmlldyBtYXkgY29ycmVzcG9uZCB0byBtdWx0aXBsZVxuICAvLyBsb2dpY2FsIGxpbmVzLCBpZiB0aG9zZSBhcmUgY29ubmVjdGVkIGJ5IGNvbGxhcHNlZCByYW5nZXMuXG4gIGZ1bmN0aW9uIExpbmVWaWV3KGRvYywgbGluZSwgbGluZU4pIHtcbiAgICAvLyBUaGUgc3RhcnRpbmcgbGluZVxuICAgIHRoaXMubGluZSA9IGxpbmU7XG4gICAgLy8gQ29udGludWluZyBsaW5lcywgaWYgYW55XG4gICAgdGhpcy5yZXN0ID0gdmlzdWFsTGluZUNvbnRpbnVlZChsaW5lKTtcbiAgICAvLyBOdW1iZXIgb2YgbG9naWNhbCBsaW5lcyBpbiB0aGlzIHZpc3VhbCBsaW5lXG4gICAgdGhpcy5zaXplID0gdGhpcy5yZXN0ID8gbGluZU5vKGxzdCh0aGlzLnJlc3QpKSAtIGxpbmVOICsgMSA6IDE7XG4gICAgdGhpcy5ub2RlID0gdGhpcy50ZXh0ID0gbnVsbDtcbiAgICB0aGlzLmhpZGRlbiA9IGxpbmVJc0hpZGRlbihkb2MsIGxpbmUpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIGEgcmFuZ2Ugb2YgTGluZVZpZXcgb2JqZWN0cyBmb3IgdGhlIGdpdmVuIGxpbmVzLlxuICBmdW5jdGlvbiBidWlsZFZpZXdBcnJheShjbSwgZnJvbSwgdG8pIHtcbiAgICB2YXIgYXJyYXkgPSBbXSwgbmV4dFBvcztcbiAgICBmb3IgKHZhciBwb3MgPSBmcm9tOyBwb3MgPCB0bzsgcG9zID0gbmV4dFBvcykge1xuICAgICAgdmFyIHZpZXcgPSBuZXcgTGluZVZpZXcoY20uZG9jLCBnZXRMaW5lKGNtLmRvYywgcG9zKSwgcG9zKTtcbiAgICAgIG5leHRQb3MgPSBwb3MgKyB2aWV3LnNpemU7XG4gICAgICBhcnJheS5wdXNoKHZpZXcpO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXk7XG4gIH1cblxuICAvLyBVcGRhdGVzIHRoZSBkaXNwbGF5LnZpZXcgZGF0YSBzdHJ1Y3R1cmUgZm9yIGEgZ2l2ZW4gY2hhbmdlIHRvIHRoZVxuICAvLyBkb2N1bWVudC4gRnJvbSBhbmQgdG8gYXJlIGluIHByZS1jaGFuZ2UgY29vcmRpbmF0ZXMuIExlbmRpZmYgaXNcbiAgLy8gdGhlIGFtb3VudCBvZiBsaW5lcyBhZGRlZCBvciBzdWJ0cmFjdGVkIGJ5IHRoZSBjaGFuZ2UuIFRoaXMgaXNcbiAgLy8gdXNlZCBmb3IgY2hhbmdlcyB0aGF0IHNwYW4gbXVsdGlwbGUgbGluZXMsIG9yIGNoYW5nZSB0aGUgd2F5XG4gIC8vIGxpbmVzIGFyZSBkaXZpZGVkIGludG8gdmlzdWFsIGxpbmVzLiByZWdMaW5lQ2hhbmdlIChiZWxvdylcbiAgLy8gcmVnaXN0ZXJzIHNpbmdsZS1saW5lIGNoYW5nZXMuXG4gIGZ1bmN0aW9uIHJlZ0NoYW5nZShjbSwgZnJvbSwgdG8sIGxlbmRpZmYpIHtcbiAgICBpZiAoZnJvbSA9PSBudWxsKSBmcm9tID0gY20uZG9jLmZpcnN0O1xuICAgIGlmICh0byA9PSBudWxsKSB0byA9IGNtLmRvYy5maXJzdCArIGNtLmRvYy5zaXplO1xuICAgIGlmICghbGVuZGlmZikgbGVuZGlmZiA9IDA7XG5cbiAgICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXk7XG4gICAgaWYgKGxlbmRpZmYgJiYgdG8gPCBkaXNwbGF5LnZpZXdUbyAmJlxuICAgICAgICAoZGlzcGxheS51cGRhdGVMaW5lTnVtYmVycyA9PSBudWxsIHx8IGRpc3BsYXkudXBkYXRlTGluZU51bWJlcnMgPiBmcm9tKSlcbiAgICAgIGRpc3BsYXkudXBkYXRlTGluZU51bWJlcnMgPSBmcm9tO1xuXG4gICAgY20uY3VyT3Audmlld0NoYW5nZWQgPSB0cnVlO1xuXG4gICAgaWYgKGZyb20gPj0gZGlzcGxheS52aWV3VG8pIHsgLy8gQ2hhbmdlIGFmdGVyXG4gICAgICBpZiAoc2F3Q29sbGFwc2VkU3BhbnMgJiYgdmlzdWFsTGluZU5vKGNtLmRvYywgZnJvbSkgPCBkaXNwbGF5LnZpZXdUbylcbiAgICAgICAgcmVzZXRWaWV3KGNtKTtcbiAgICB9IGVsc2UgaWYgKHRvIDw9IGRpc3BsYXkudmlld0Zyb20pIHsgLy8gQ2hhbmdlIGJlZm9yZVxuICAgICAgaWYgKHNhd0NvbGxhcHNlZFNwYW5zICYmIHZpc3VhbExpbmVFbmRObyhjbS5kb2MsIHRvICsgbGVuZGlmZikgPiBkaXNwbGF5LnZpZXdGcm9tKSB7XG4gICAgICAgIHJlc2V0VmlldyhjbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkaXNwbGF5LnZpZXdGcm9tICs9IGxlbmRpZmY7XG4gICAgICAgIGRpc3BsYXkudmlld1RvICs9IGxlbmRpZmY7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChmcm9tIDw9IGRpc3BsYXkudmlld0Zyb20gJiYgdG8gPj0gZGlzcGxheS52aWV3VG8pIHsgLy8gRnVsbCBvdmVybGFwXG4gICAgICByZXNldFZpZXcoY20pO1xuICAgIH0gZWxzZSBpZiAoZnJvbSA8PSBkaXNwbGF5LnZpZXdGcm9tKSB7IC8vIFRvcCBvdmVybGFwXG4gICAgICB2YXIgY3V0ID0gdmlld0N1dHRpbmdQb2ludChjbSwgdG8sIHRvICsgbGVuZGlmZiwgMSk7XG4gICAgICBpZiAoY3V0KSB7XG4gICAgICAgIGRpc3BsYXkudmlldyA9IGRpc3BsYXkudmlldy5zbGljZShjdXQuaW5kZXgpO1xuICAgICAgICBkaXNwbGF5LnZpZXdGcm9tID0gY3V0LmxpbmVOO1xuICAgICAgICBkaXNwbGF5LnZpZXdUbyArPSBsZW5kaWZmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzZXRWaWV3KGNtKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRvID49IGRpc3BsYXkudmlld1RvKSB7IC8vIEJvdHRvbSBvdmVybGFwXG4gICAgICB2YXIgY3V0ID0gdmlld0N1dHRpbmdQb2ludChjbSwgZnJvbSwgZnJvbSwgLTEpO1xuICAgICAgaWYgKGN1dCkge1xuICAgICAgICBkaXNwbGF5LnZpZXcgPSBkaXNwbGF5LnZpZXcuc2xpY2UoMCwgY3V0LmluZGV4KTtcbiAgICAgICAgZGlzcGxheS52aWV3VG8gPSBjdXQubGluZU47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNldFZpZXcoY20pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7IC8vIEdhcCBpbiB0aGUgbWlkZGxlXG4gICAgICB2YXIgY3V0VG9wID0gdmlld0N1dHRpbmdQb2ludChjbSwgZnJvbSwgZnJvbSwgLTEpO1xuICAgICAgdmFyIGN1dEJvdCA9IHZpZXdDdXR0aW5nUG9pbnQoY20sIHRvLCB0byArIGxlbmRpZmYsIDEpO1xuICAgICAgaWYgKGN1dFRvcCAmJiBjdXRCb3QpIHtcbiAgICAgICAgZGlzcGxheS52aWV3ID0gZGlzcGxheS52aWV3LnNsaWNlKDAsIGN1dFRvcC5pbmRleClcbiAgICAgICAgICAuY29uY2F0KGJ1aWxkVmlld0FycmF5KGNtLCBjdXRUb3AubGluZU4sIGN1dEJvdC5saW5lTikpXG4gICAgICAgICAgLmNvbmNhdChkaXNwbGF5LnZpZXcuc2xpY2UoY3V0Qm90LmluZGV4KSk7XG4gICAgICAgIGRpc3BsYXkudmlld1RvICs9IGxlbmRpZmY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNldFZpZXcoY20pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBleHQgPSBkaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQ7XG4gICAgaWYgKGV4dCkge1xuICAgICAgaWYgKHRvIDwgZXh0LmxpbmVOKVxuICAgICAgICBleHQubGluZU4gKz0gbGVuZGlmZjtcbiAgICAgIGVsc2UgaWYgKGZyb20gPCBleHQubGluZU4gKyBleHQuc2l6ZSlcbiAgICAgICAgZGlzcGxheS5leHRlcm5hbE1lYXN1cmVkID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvLyBSZWdpc3RlciBhIGNoYW5nZSB0byBhIHNpbmdsZSBsaW5lLiBUeXBlIG11c3QgYmUgb25lIG9mIFwidGV4dFwiLFxuICAvLyBcImd1dHRlclwiLCBcImNsYXNzXCIsIFwid2lkZ2V0XCJcbiAgZnVuY3Rpb24gcmVnTGluZUNoYW5nZShjbSwgbGluZSwgdHlwZSkge1xuICAgIGNtLmN1ck9wLnZpZXdDaGFuZ2VkID0gdHJ1ZTtcbiAgICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXksIGV4dCA9IGNtLmRpc3BsYXkuZXh0ZXJuYWxNZWFzdXJlZDtcbiAgICBpZiAoZXh0ICYmIGxpbmUgPj0gZXh0LmxpbmVOICYmIGxpbmUgPCBleHQubGluZU4gKyBleHQuc2l6ZSlcbiAgICAgIGRpc3BsYXkuZXh0ZXJuYWxNZWFzdXJlZCA9IG51bGw7XG5cbiAgICBpZiAobGluZSA8IGRpc3BsYXkudmlld0Zyb20gfHwgbGluZSA+PSBkaXNwbGF5LnZpZXdUbykgcmV0dXJuO1xuICAgIHZhciBsaW5lVmlldyA9IGRpc3BsYXkudmlld1tmaW5kVmlld0luZGV4KGNtLCBsaW5lKV07XG4gICAgaWYgKGxpbmVWaWV3Lm5vZGUgPT0gbnVsbCkgcmV0dXJuO1xuICAgIHZhciBhcnIgPSBsaW5lVmlldy5jaGFuZ2VzIHx8IChsaW5lVmlldy5jaGFuZ2VzID0gW10pO1xuICAgIGlmIChpbmRleE9mKGFyciwgdHlwZSkgPT0gLTEpIGFyci5wdXNoKHR5cGUpO1xuICB9XG5cbiAgLy8gQ2xlYXIgdGhlIHZpZXcuXG4gIGZ1bmN0aW9uIHJlc2V0VmlldyhjbSkge1xuICAgIGNtLmRpc3BsYXkudmlld0Zyb20gPSBjbS5kaXNwbGF5LnZpZXdUbyA9IGNtLmRvYy5maXJzdDtcbiAgICBjbS5kaXNwbGF5LnZpZXcgPSBbXTtcbiAgICBjbS5kaXNwbGF5LnZpZXdPZmZzZXQgPSAwO1xuICB9XG5cbiAgLy8gRmluZCB0aGUgdmlldyBlbGVtZW50IGNvcnJlc3BvbmRpbmcgdG8gYSBnaXZlbiBsaW5lLiBSZXR1cm4gbnVsbFxuICAvLyB3aGVuIHRoZSBsaW5lIGlzbid0IHZpc2libGUuXG4gIGZ1bmN0aW9uIGZpbmRWaWV3SW5kZXgoY20sIG4pIHtcbiAgICBpZiAobiA+PSBjbS5kaXNwbGF5LnZpZXdUbykgcmV0dXJuIG51bGw7XG4gICAgbiAtPSBjbS5kaXNwbGF5LnZpZXdGcm9tO1xuICAgIGlmIChuIDwgMCkgcmV0dXJuIG51bGw7XG4gICAgdmFyIHZpZXcgPSBjbS5kaXNwbGF5LnZpZXc7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2aWV3Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBuIC09IHZpZXdbaV0uc2l6ZTtcbiAgICAgIGlmIChuIDwgMCkgcmV0dXJuIGk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdmlld0N1dHRpbmdQb2ludChjbSwgb2xkTiwgbmV3TiwgZGlyKSB7XG4gICAgdmFyIGluZGV4ID0gZmluZFZpZXdJbmRleChjbSwgb2xkTiksIGRpZmYsIHZpZXcgPSBjbS5kaXNwbGF5LnZpZXc7XG4gICAgaWYgKCFzYXdDb2xsYXBzZWRTcGFucyB8fCBuZXdOID09IGNtLmRvYy5maXJzdCArIGNtLmRvYy5zaXplKVxuICAgICAgcmV0dXJuIHtpbmRleDogaW5kZXgsIGxpbmVOOiBuZXdOfTtcbiAgICBmb3IgKHZhciBpID0gMCwgbiA9IGNtLmRpc3BsYXkudmlld0Zyb207IGkgPCBpbmRleDsgaSsrKVxuICAgICAgbiArPSB2aWV3W2ldLnNpemU7XG4gICAgaWYgKG4gIT0gb2xkTikge1xuICAgICAgaWYgKGRpciA+IDApIHtcbiAgICAgICAgaWYgKGluZGV4ID09IHZpZXcubGVuZ3RoIC0gMSkgcmV0dXJuIG51bGw7XG4gICAgICAgIGRpZmYgPSAobiArIHZpZXdbaW5kZXhdLnNpemUpIC0gb2xkTjtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRpZmYgPSBuIC0gb2xkTjtcbiAgICAgIH1cbiAgICAgIG9sZE4gKz0gZGlmZjsgbmV3TiArPSBkaWZmO1xuICAgIH1cbiAgICB3aGlsZSAodmlzdWFsTGluZU5vKGNtLmRvYywgbmV3TikgIT0gbmV3Tikge1xuICAgICAgaWYgKGluZGV4ID09IChkaXIgPCAwID8gMCA6IHZpZXcubGVuZ3RoIC0gMSkpIHJldHVybiBudWxsO1xuICAgICAgbmV3TiArPSBkaXIgKiB2aWV3W2luZGV4IC0gKGRpciA8IDAgPyAxIDogMCldLnNpemU7XG4gICAgICBpbmRleCArPSBkaXI7XG4gICAgfVxuICAgIHJldHVybiB7aW5kZXg6IGluZGV4LCBsaW5lTjogbmV3Tn07XG4gIH1cblxuICAvLyBGb3JjZSB0aGUgdmlldyB0byBjb3ZlciBhIGdpdmVuIHJhbmdlLCBhZGRpbmcgZW1wdHkgdmlldyBlbGVtZW50XG4gIC8vIG9yIGNsaXBwaW5nIG9mZiBleGlzdGluZyBvbmVzIGFzIG5lZWRlZC5cbiAgZnVuY3Rpb24gYWRqdXN0VmlldyhjbSwgZnJvbSwgdG8pIHtcbiAgICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXksIHZpZXcgPSBkaXNwbGF5LnZpZXc7XG4gICAgaWYgKHZpZXcubGVuZ3RoID09IDAgfHwgZnJvbSA+PSBkaXNwbGF5LnZpZXdUbyB8fCB0byA8PSBkaXNwbGF5LnZpZXdGcm9tKSB7XG4gICAgICBkaXNwbGF5LnZpZXcgPSBidWlsZFZpZXdBcnJheShjbSwgZnJvbSwgdG8pO1xuICAgICAgZGlzcGxheS52aWV3RnJvbSA9IGZyb207XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChkaXNwbGF5LnZpZXdGcm9tID4gZnJvbSlcbiAgICAgICAgZGlzcGxheS52aWV3ID0gYnVpbGRWaWV3QXJyYXkoY20sIGZyb20sIGRpc3BsYXkudmlld0Zyb20pLmNvbmNhdChkaXNwbGF5LnZpZXcpO1xuICAgICAgZWxzZSBpZiAoZGlzcGxheS52aWV3RnJvbSA8IGZyb20pXG4gICAgICAgIGRpc3BsYXkudmlldyA9IGRpc3BsYXkudmlldy5zbGljZShmaW5kVmlld0luZGV4KGNtLCBmcm9tKSk7XG4gICAgICBkaXNwbGF5LnZpZXdGcm9tID0gZnJvbTtcbiAgICAgIGlmIChkaXNwbGF5LnZpZXdUbyA8IHRvKVxuICAgICAgICBkaXNwbGF5LnZpZXcgPSBkaXNwbGF5LnZpZXcuY29uY2F0KGJ1aWxkVmlld0FycmF5KGNtLCBkaXNwbGF5LnZpZXdUbywgdG8pKTtcbiAgICAgIGVsc2UgaWYgKGRpc3BsYXkudmlld1RvID4gdG8pXG4gICAgICAgIGRpc3BsYXkudmlldyA9IGRpc3BsYXkudmlldy5zbGljZSgwLCBmaW5kVmlld0luZGV4KGNtLCB0bykpO1xuICAgIH1cbiAgICBkaXNwbGF5LnZpZXdUbyA9IHRvO1xuICB9XG5cbiAgLy8gQ291bnQgdGhlIG51bWJlciBvZiBsaW5lcyBpbiB0aGUgdmlldyB3aG9zZSBET00gcmVwcmVzZW50YXRpb24gaXNcbiAgLy8gb3V0IG9mIGRhdGUgKG9yIG5vbmV4aXN0ZW50KS5cbiAgZnVuY3Rpb24gY291bnREaXJ0eVZpZXcoY20pIHtcbiAgICB2YXIgdmlldyA9IGNtLmRpc3BsYXkudmlldywgZGlydHkgPSAwO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlldy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGxpbmVWaWV3ID0gdmlld1tpXTtcbiAgICAgIGlmICghbGluZVZpZXcuaGlkZGVuICYmICghbGluZVZpZXcubm9kZSB8fCBsaW5lVmlldy5jaGFuZ2VzKSkgKytkaXJ0eTtcbiAgICB9XG4gICAgcmV0dXJuIGRpcnR5O1xuICB9XG5cbiAgLy8gRVZFTlQgSEFORExFUlNcblxuICAvLyBBdHRhY2ggdGhlIG5lY2Vzc2FyeSBldmVudCBoYW5kbGVycyB3aGVuIGluaXRpYWxpemluZyB0aGUgZWRpdG9yXG4gIGZ1bmN0aW9uIHJlZ2lzdGVyRXZlbnRIYW5kbGVycyhjbSkge1xuICAgIHZhciBkID0gY20uZGlzcGxheTtcbiAgICBvbihkLnNjcm9sbGVyLCBcIm1vdXNlZG93blwiLCBvcGVyYXRpb24oY20sIG9uTW91c2VEb3duKSk7XG4gICAgLy8gT2xkZXIgSUUncyB3aWxsIG5vdCBmaXJlIGEgc2Vjb25kIG1vdXNlZG93biBmb3IgYSBkb3VibGUgY2xpY2tcbiAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDExKVxuICAgICAgb24oZC5zY3JvbGxlciwgXCJkYmxjbGlja1wiLCBvcGVyYXRpb24oY20sIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKHNpZ25hbERPTUV2ZW50KGNtLCBlKSkgcmV0dXJuO1xuICAgICAgICB2YXIgcG9zID0gcG9zRnJvbU1vdXNlKGNtLCBlKTtcbiAgICAgICAgaWYgKCFwb3MgfHwgY2xpY2tJbkd1dHRlcihjbSwgZSkgfHwgZXZlbnRJbldpZGdldChjbS5kaXNwbGF5LCBlKSkgcmV0dXJuO1xuICAgICAgICBlX3ByZXZlbnREZWZhdWx0KGUpO1xuICAgICAgICB2YXIgd29yZCA9IGNtLmZpbmRXb3JkQXQocG9zKTtcbiAgICAgICAgZXh0ZW5kU2VsZWN0aW9uKGNtLmRvYywgd29yZC5hbmNob3IsIHdvcmQuaGVhZCk7XG4gICAgICB9KSk7XG4gICAgZWxzZVxuICAgICAgb24oZC5zY3JvbGxlciwgXCJkYmxjbGlja1wiLCBmdW5jdGlvbihlKSB7IHNpZ25hbERPTUV2ZW50KGNtLCBlKSB8fCBlX3ByZXZlbnREZWZhdWx0KGUpOyB9KTtcbiAgICAvLyBTb21lIGJyb3dzZXJzIGZpcmUgY29udGV4dG1lbnUgKmFmdGVyKiBvcGVuaW5nIHRoZSBtZW51LCBhdFxuICAgIC8vIHdoaWNoIHBvaW50IHdlIGNhbid0IG1lc3Mgd2l0aCBpdCBhbnltb3JlLiBDb250ZXh0IG1lbnUgaXNcbiAgICAvLyBoYW5kbGVkIGluIG9uTW91c2VEb3duIGZvciB0aGVzZSBicm93c2Vycy5cbiAgICBpZiAoIWNhcHR1cmVSaWdodENsaWNrKSBvbihkLnNjcm9sbGVyLCBcImNvbnRleHRtZW51XCIsIGZ1bmN0aW9uKGUpIHtvbkNvbnRleHRNZW51KGNtLCBlKTt9KTtcblxuICAgIC8vIFVzZWQgdG8gc3VwcHJlc3MgbW91c2UgZXZlbnQgaGFuZGxpbmcgd2hlbiBhIHRvdWNoIGhhcHBlbnNcbiAgICB2YXIgdG91Y2hGaW5pc2hlZCwgcHJldlRvdWNoID0ge2VuZDogMH07XG4gICAgZnVuY3Rpb24gZmluaXNoVG91Y2goKSB7XG4gICAgICBpZiAoZC5hY3RpdmVUb3VjaCkge1xuICAgICAgICB0b3VjaEZpbmlzaGVkID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtkLmFjdGl2ZVRvdWNoID0gbnVsbDt9LCAxMDAwKTtcbiAgICAgICAgcHJldlRvdWNoID0gZC5hY3RpdmVUb3VjaDtcbiAgICAgICAgcHJldlRvdWNoLmVuZCA9ICtuZXcgRGF0ZTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGZ1bmN0aW9uIGlzTW91c2VMaWtlVG91Y2hFdmVudChlKSB7XG4gICAgICBpZiAoZS50b3VjaGVzLmxlbmd0aCAhPSAxKSByZXR1cm4gZmFsc2U7XG4gICAgICB2YXIgdG91Y2ggPSBlLnRvdWNoZXNbMF07XG4gICAgICByZXR1cm4gdG91Y2gucmFkaXVzWCA8PSAxICYmIHRvdWNoLnJhZGl1c1kgPD0gMTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZmFyQXdheSh0b3VjaCwgb3RoZXIpIHtcbiAgICAgIGlmIChvdGhlci5sZWZ0ID09IG51bGwpIHJldHVybiB0cnVlO1xuICAgICAgdmFyIGR4ID0gb3RoZXIubGVmdCAtIHRvdWNoLmxlZnQsIGR5ID0gb3RoZXIudG9wIC0gdG91Y2gudG9wO1xuICAgICAgcmV0dXJuIGR4ICogZHggKyBkeSAqIGR5ID4gMjAgKiAyMDtcbiAgICB9XG4gICAgb24oZC5zY3JvbGxlciwgXCJ0b3VjaHN0YXJ0XCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmICghaXNNb3VzZUxpa2VUb3VjaEV2ZW50KGUpKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0b3VjaEZpbmlzaGVkKTtcbiAgICAgICAgdmFyIG5vdyA9ICtuZXcgRGF0ZTtcbiAgICAgICAgZC5hY3RpdmVUb3VjaCA9IHtzdGFydDogbm93LCBtb3ZlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgcHJldjogbm93IC0gcHJldlRvdWNoLmVuZCA8PSAzMDAgPyBwcmV2VG91Y2ggOiBudWxsfTtcbiAgICAgICAgaWYgKGUudG91Y2hlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgIGQuYWN0aXZlVG91Y2gubGVmdCA9IGUudG91Y2hlc1swXS5wYWdlWDtcbiAgICAgICAgICBkLmFjdGl2ZVRvdWNoLnRvcCA9IGUudG91Y2hlc1swXS5wYWdlWTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIG9uKGQuc2Nyb2xsZXIsIFwidG91Y2htb3ZlXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGQuYWN0aXZlVG91Y2gpIGQuYWN0aXZlVG91Y2gubW92ZWQgPSB0cnVlO1xuICAgIH0pO1xuICAgIG9uKGQuc2Nyb2xsZXIsIFwidG91Y2hlbmRcIiwgZnVuY3Rpb24oZSkge1xuICAgICAgdmFyIHRvdWNoID0gZC5hY3RpdmVUb3VjaDtcbiAgICAgIGlmICh0b3VjaCAmJiAhZXZlbnRJbldpZGdldChkLCBlKSAmJiB0b3VjaC5sZWZ0ICE9IG51bGwgJiZcbiAgICAgICAgICAhdG91Y2gubW92ZWQgJiYgbmV3IERhdGUgLSB0b3VjaC5zdGFydCA8IDMwMCkge1xuICAgICAgICB2YXIgcG9zID0gY20uY29vcmRzQ2hhcihkLmFjdGl2ZVRvdWNoLCBcInBhZ2VcIiksIHJhbmdlO1xuICAgICAgICBpZiAoIXRvdWNoLnByZXYgfHwgZmFyQXdheSh0b3VjaCwgdG91Y2gucHJldikpIC8vIFNpbmdsZSB0YXBcbiAgICAgICAgICByYW5nZSA9IG5ldyBSYW5nZShwb3MsIHBvcyk7XG4gICAgICAgIGVsc2UgaWYgKCF0b3VjaC5wcmV2LnByZXYgfHwgZmFyQXdheSh0b3VjaCwgdG91Y2gucHJldi5wcmV2KSkgLy8gRG91YmxlIHRhcFxuICAgICAgICAgIHJhbmdlID0gY20uZmluZFdvcmRBdChwb3MpO1xuICAgICAgICBlbHNlIC8vIFRyaXBsZSB0YXBcbiAgICAgICAgICByYW5nZSA9IG5ldyBSYW5nZShQb3MocG9zLmxpbmUsIDApLCBjbGlwUG9zKGNtLmRvYywgUG9zKHBvcy5saW5lICsgMSwgMCkpKTtcbiAgICAgICAgY20uc2V0U2VsZWN0aW9uKHJhbmdlLmFuY2hvciwgcmFuZ2UuaGVhZCk7XG4gICAgICAgIGNtLmZvY3VzKCk7XG4gICAgICAgIGVfcHJldmVudERlZmF1bHQoZSk7XG4gICAgICB9XG4gICAgICBmaW5pc2hUb3VjaCgpO1xuICAgIH0pO1xuICAgIG9uKGQuc2Nyb2xsZXIsIFwidG91Y2hjYW5jZWxcIiwgZmluaXNoVG91Y2gpO1xuXG4gICAgLy8gU3luYyBzY3JvbGxpbmcgYmV0d2VlbiBmYWtlIHNjcm9sbGJhcnMgYW5kIHJlYWwgc2Nyb2xsYWJsZVxuICAgIC8vIGFyZWEsIGVuc3VyZSB2aWV3cG9ydCBpcyB1cGRhdGVkIHdoZW4gc2Nyb2xsaW5nLlxuICAgIG9uKGQuc2Nyb2xsZXIsIFwic2Nyb2xsXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGQuc2Nyb2xsZXIuY2xpZW50SGVpZ2h0KSB7XG4gICAgICAgIHNldFNjcm9sbFRvcChjbSwgZC5zY3JvbGxlci5zY3JvbGxUb3ApO1xuICAgICAgICBzZXRTY3JvbGxMZWZ0KGNtLCBkLnNjcm9sbGVyLnNjcm9sbExlZnQsIHRydWUpO1xuICAgICAgICBzaWduYWwoY20sIFwic2Nyb2xsXCIsIGNtKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExpc3RlbiB0byB3aGVlbCBldmVudHMgaW4gb3JkZXIgdG8gdHJ5IGFuZCB1cGRhdGUgdGhlIHZpZXdwb3J0IG9uIHRpbWUuXG4gICAgb24oZC5zY3JvbGxlciwgXCJtb3VzZXdoZWVsXCIsIGZ1bmN0aW9uKGUpe29uU2Nyb2xsV2hlZWwoY20sIGUpO30pO1xuICAgIG9uKGQuc2Nyb2xsZXIsIFwiRE9NTW91c2VTY3JvbGxcIiwgZnVuY3Rpb24oZSl7b25TY3JvbGxXaGVlbChjbSwgZSk7fSk7XG5cbiAgICAvLyBQcmV2ZW50IHdyYXBwZXIgZnJvbSBldmVyIHNjcm9sbGluZ1xuICAgIG9uKGQud3JhcHBlciwgXCJzY3JvbGxcIiwgZnVuY3Rpb24oKSB7IGQud3JhcHBlci5zY3JvbGxUb3AgPSBkLndyYXBwZXIuc2Nyb2xsTGVmdCA9IDA7IH0pO1xuXG4gICAgZC5kcmFnRnVuY3Rpb25zID0ge1xuICAgICAgZW50ZXI6IGZ1bmN0aW9uKGUpIHtpZiAoIXNpZ25hbERPTUV2ZW50KGNtLCBlKSkgZV9zdG9wKGUpO30sXG4gICAgICBvdmVyOiBmdW5jdGlvbihlKSB7aWYgKCFzaWduYWxET01FdmVudChjbSwgZSkpIHsgb25EcmFnT3ZlcihjbSwgZSk7IGVfc3RvcChlKTsgfX0sXG4gICAgICBzdGFydDogZnVuY3Rpb24oZSl7b25EcmFnU3RhcnQoY20sIGUpO30sXG4gICAgICBkcm9wOiBvcGVyYXRpb24oY20sIG9uRHJvcCksXG4gICAgICBsZWF2ZTogZnVuY3Rpb24oKSB7Y2xlYXJEcmFnQ3Vyc29yKGNtKTt9XG4gICAgfTtcblxuICAgIHZhciBpbnAgPSBkLmlucHV0LmdldEZpZWxkKCk7XG4gICAgb24oaW5wLCBcImtleXVwXCIsIGZ1bmN0aW9uKGUpIHsgb25LZXlVcC5jYWxsKGNtLCBlKTsgfSk7XG4gICAgb24oaW5wLCBcImtleWRvd25cIiwgb3BlcmF0aW9uKGNtLCBvbktleURvd24pKTtcbiAgICBvbihpbnAsIFwia2V5cHJlc3NcIiwgb3BlcmF0aW9uKGNtLCBvbktleVByZXNzKSk7XG4gICAgb24oaW5wLCBcImZvY3VzXCIsIGJpbmQob25Gb2N1cywgY20pKTtcbiAgICBvbihpbnAsIFwiYmx1clwiLCBiaW5kKG9uQmx1ciwgY20pKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYWdEcm9wQ2hhbmdlZChjbSwgdmFsdWUsIG9sZCkge1xuICAgIHZhciB3YXNPbiA9IG9sZCAmJiBvbGQgIT0gQ29kZU1pcnJvci5Jbml0O1xuICAgIGlmICghdmFsdWUgIT0gIXdhc09uKSB7XG4gICAgICB2YXIgZnVuY3MgPSBjbS5kaXNwbGF5LmRyYWdGdW5jdGlvbnM7XG4gICAgICB2YXIgdG9nZ2xlID0gdmFsdWUgPyBvbiA6IG9mZjtcbiAgICAgIHRvZ2dsZShjbS5kaXNwbGF5LnNjcm9sbGVyLCBcImRyYWdzdGFydFwiLCBmdW5jcy5zdGFydCk7XG4gICAgICB0b2dnbGUoY20uZGlzcGxheS5zY3JvbGxlciwgXCJkcmFnZW50ZXJcIiwgZnVuY3MuZW50ZXIpO1xuICAgICAgdG9nZ2xlKGNtLmRpc3BsYXkuc2Nyb2xsZXIsIFwiZHJhZ292ZXJcIiwgZnVuY3Mub3Zlcik7XG4gICAgICB0b2dnbGUoY20uZGlzcGxheS5zY3JvbGxlciwgXCJkcmFnbGVhdmVcIiwgZnVuY3MubGVhdmUpO1xuICAgICAgdG9nZ2xlKGNtLmRpc3BsYXkuc2Nyb2xsZXIsIFwiZHJvcFwiLCBmdW5jcy5kcm9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBDYWxsZWQgd2hlbiB0aGUgd2luZG93IHJlc2l6ZXNcbiAgZnVuY3Rpb24gb25SZXNpemUoY20pIHtcbiAgICB2YXIgZCA9IGNtLmRpc3BsYXk7XG4gICAgaWYgKGQubGFzdFdyYXBIZWlnaHQgPT0gZC53cmFwcGVyLmNsaWVudEhlaWdodCAmJiBkLmxhc3RXcmFwV2lkdGggPT0gZC53cmFwcGVyLmNsaWVudFdpZHRoKVxuICAgICAgcmV0dXJuO1xuICAgIC8vIE1pZ2h0IGJlIGEgdGV4dCBzY2FsaW5nIG9wZXJhdGlvbiwgY2xlYXIgc2l6ZSBjYWNoZXMuXG4gICAgZC5jYWNoZWRDaGFyV2lkdGggPSBkLmNhY2hlZFRleHRIZWlnaHQgPSBkLmNhY2hlZFBhZGRpbmdIID0gbnVsbDtcbiAgICBkLnNjcm9sbGJhcnNDbGlwcGVkID0gZmFsc2U7XG4gICAgY20uc2V0U2l6ZSgpO1xuICB9XG5cbiAgLy8gTU9VU0UgRVZFTlRTXG5cbiAgLy8gUmV0dXJuIHRydWUgd2hlbiB0aGUgZ2l2ZW4gbW91c2UgZXZlbnQgaGFwcGVuZWQgaW4gYSB3aWRnZXRcbiAgZnVuY3Rpb24gZXZlbnRJbldpZGdldChkaXNwbGF5LCBlKSB7XG4gICAgZm9yICh2YXIgbiA9IGVfdGFyZ2V0KGUpOyBuICE9IGRpc3BsYXkud3JhcHBlcjsgbiA9IG4ucGFyZW50Tm9kZSkge1xuICAgICAgaWYgKCFuIHx8IChuLm5vZGVUeXBlID09IDEgJiYgbi5nZXRBdHRyaWJ1dGUoXCJjbS1pZ25vcmUtZXZlbnRzXCIpID09IFwidHJ1ZVwiKSB8fFxuICAgICAgICAgIChuLnBhcmVudE5vZGUgPT0gZGlzcGxheS5zaXplciAmJiBuICE9IGRpc3BsYXkubW92ZXIpKVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBHaXZlbiBhIG1vdXNlIGV2ZW50LCBmaW5kIHRoZSBjb3JyZXNwb25kaW5nIHBvc2l0aW9uLiBJZiBsaWJlcmFsXG4gIC8vIGlzIGZhbHNlLCBpdCBjaGVja3Mgd2hldGhlciBhIGd1dHRlciBvciBzY3JvbGxiYXIgd2FzIGNsaWNrZWQsXG4gIC8vIGFuZCByZXR1cm5zIG51bGwgaWYgaXQgd2FzLiBmb3JSZWN0IGlzIHVzZWQgYnkgcmVjdGFuZ3VsYXJcbiAgLy8gc2VsZWN0aW9ucywgYW5kIHRyaWVzIHRvIGVzdGltYXRlIGEgY2hhcmFjdGVyIHBvc2l0aW9uIGV2ZW4gZm9yXG4gIC8vIGNvb3JkaW5hdGVzIGJleW9uZCB0aGUgcmlnaHQgb2YgdGhlIHRleHQuXG4gIGZ1bmN0aW9uIHBvc0Zyb21Nb3VzZShjbSwgZSwgbGliZXJhbCwgZm9yUmVjdCkge1xuICAgIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgICBpZiAoIWxpYmVyYWwgJiYgZV90YXJnZXQoZSkuZ2V0QXR0cmlidXRlKFwiY20tbm90LWNvbnRlbnRcIikgPT0gXCJ0cnVlXCIpIHJldHVybiBudWxsO1xuXG4gICAgdmFyIHgsIHksIHNwYWNlID0gZGlzcGxheS5saW5lU3BhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgLy8gRmFpbHMgdW5wcmVkaWN0YWJseSBvbiBJRVs2N10gd2hlbiBtb3VzZSBpcyBkcmFnZ2VkIGFyb3VuZCBxdWlja2x5LlxuICAgIHRyeSB7IHggPSBlLmNsaWVudFggLSBzcGFjZS5sZWZ0OyB5ID0gZS5jbGllbnRZIC0gc3BhY2UudG9wOyB9XG4gICAgY2F0Y2ggKGUpIHsgcmV0dXJuIG51bGw7IH1cbiAgICB2YXIgY29vcmRzID0gY29vcmRzQ2hhcihjbSwgeCwgeSksIGxpbmU7XG4gICAgaWYgKGZvclJlY3QgJiYgY29vcmRzLnhSZWwgPT0gMSAmJiAobGluZSA9IGdldExpbmUoY20uZG9jLCBjb29yZHMubGluZSkudGV4dCkubGVuZ3RoID09IGNvb3Jkcy5jaCkge1xuICAgICAgdmFyIGNvbERpZmYgPSBjb3VudENvbHVtbihsaW5lLCBsaW5lLmxlbmd0aCwgY20ub3B0aW9ucy50YWJTaXplKSAtIGxpbmUubGVuZ3RoO1xuICAgICAgY29vcmRzID0gUG9zKGNvb3Jkcy5saW5lLCBNYXRoLm1heCgwLCBNYXRoLnJvdW5kKCh4IC0gcGFkZGluZ0goY20uZGlzcGxheSkubGVmdCkgLyBjaGFyV2lkdGgoY20uZGlzcGxheSkpIC0gY29sRGlmZikpO1xuICAgIH1cbiAgICByZXR1cm4gY29vcmRzO1xuICB9XG5cbiAgLy8gQSBtb3VzZSBkb3duIGNhbiBiZSBhIHNpbmdsZSBjbGljaywgZG91YmxlIGNsaWNrLCB0cmlwbGUgY2xpY2ssXG4gIC8vIHN0YXJ0IG9mIHNlbGVjdGlvbiBkcmFnLCBzdGFydCBvZiB0ZXh0IGRyYWcsIG5ldyBjdXJzb3JcbiAgLy8gKGN0cmwtY2xpY2spLCByZWN0YW5nbGUgZHJhZyAoYWx0LWRyYWcpLCBvciB4d2luXG4gIC8vIG1pZGRsZS1jbGljay1wYXN0ZS4gT3IgaXQgbWlnaHQgYmUgYSBjbGljayBvbiBzb21ldGhpbmcgd2Ugc2hvdWxkXG4gIC8vIG5vdCBpbnRlcmZlcmUgd2l0aCwgc3VjaCBhcyBhIHNjcm9sbGJhciBvciB3aWRnZXQuXG4gIGZ1bmN0aW9uIG9uTW91c2VEb3duKGUpIHtcbiAgICB2YXIgY20gPSB0aGlzLCBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgICBpZiAoZGlzcGxheS5hY3RpdmVUb3VjaCAmJiBkaXNwbGF5LmlucHV0LnN1cHBvcnRzVG91Y2goKSB8fCBzaWduYWxET01FdmVudChjbSwgZSkpIHJldHVybjtcbiAgICBkaXNwbGF5LnNoaWZ0ID0gZS5zaGlmdEtleTtcblxuICAgIGlmIChldmVudEluV2lkZ2V0KGRpc3BsYXksIGUpKSB7XG4gICAgICBpZiAoIXdlYmtpdCkge1xuICAgICAgICAvLyBCcmllZmx5IHR1cm4gb2ZmIGRyYWdnYWJpbGl0eSwgdG8gYWxsb3cgd2lkZ2V0cyB0byBkb1xuICAgICAgICAvLyBub3JtYWwgZHJhZ2dpbmcgdGhpbmdzLlxuICAgICAgICBkaXNwbGF5LnNjcm9sbGVyLmRyYWdnYWJsZSA9IGZhbHNlO1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7ZGlzcGxheS5zY3JvbGxlci5kcmFnZ2FibGUgPSB0cnVlO30sIDEwMCk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChjbGlja0luR3V0dGVyKGNtLCBlKSkgcmV0dXJuO1xuICAgIHZhciBzdGFydCA9IHBvc0Zyb21Nb3VzZShjbSwgZSk7XG4gICAgd2luZG93LmZvY3VzKCk7XG5cbiAgICBzd2l0Y2ggKGVfYnV0dG9uKGUpKSB7XG4gICAgY2FzZSAxOlxuICAgICAgLy8gIzMyNjE6IG1ha2Ugc3VyZSwgdGhhdCB3ZSdyZSBub3Qgc3RhcnRpbmcgYSBzZWNvbmQgc2VsZWN0aW9uXG4gICAgICBpZiAoY20uc3RhdGUuc2VsZWN0aW5nVGV4dClcbiAgICAgICAgY20uc3RhdGUuc2VsZWN0aW5nVGV4dChlKTtcbiAgICAgIGVsc2UgaWYgKHN0YXJ0KVxuICAgICAgICBsZWZ0QnV0dG9uRG93bihjbSwgZSwgc3RhcnQpO1xuICAgICAgZWxzZSBpZiAoZV90YXJnZXQoZSkgPT0gZGlzcGxheS5zY3JvbGxlcilcbiAgICAgICAgZV9wcmV2ZW50RGVmYXVsdChlKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMjpcbiAgICAgIGlmICh3ZWJraXQpIGNtLnN0YXRlLmxhc3RNaWRkbGVEb3duID0gK25ldyBEYXRlO1xuICAgICAgaWYgKHN0YXJ0KSBleHRlbmRTZWxlY3Rpb24oY20uZG9jLCBzdGFydCk7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge2Rpc3BsYXkuaW5wdXQuZm9jdXMoKTt9LCAyMCk7XG4gICAgICBlX3ByZXZlbnREZWZhdWx0KGUpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAzOlxuICAgICAgaWYgKGNhcHR1cmVSaWdodENsaWNrKSBvbkNvbnRleHRNZW51KGNtLCBlKTtcbiAgICAgIGVsc2UgZGVsYXlCbHVyRXZlbnQoY20pO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgdmFyIGxhc3RDbGljaywgbGFzdERvdWJsZUNsaWNrO1xuICBmdW5jdGlvbiBsZWZ0QnV0dG9uRG93bihjbSwgZSwgc3RhcnQpIHtcbiAgICBpZiAoaWUpIHNldFRpbWVvdXQoYmluZChlbnN1cmVGb2N1cywgY20pLCAwKTtcbiAgICBlbHNlIGNtLmN1ck9wLmZvY3VzID0gYWN0aXZlRWx0KCk7XG5cbiAgICB2YXIgbm93ID0gK25ldyBEYXRlLCB0eXBlO1xuICAgIGlmIChsYXN0RG91YmxlQ2xpY2sgJiYgbGFzdERvdWJsZUNsaWNrLnRpbWUgPiBub3cgLSA0MDAgJiYgY21wKGxhc3REb3VibGVDbGljay5wb3MsIHN0YXJ0KSA9PSAwKSB7XG4gICAgICB0eXBlID0gXCJ0cmlwbGVcIjtcbiAgICB9IGVsc2UgaWYgKGxhc3RDbGljayAmJiBsYXN0Q2xpY2sudGltZSA+IG5vdyAtIDQwMCAmJiBjbXAobGFzdENsaWNrLnBvcywgc3RhcnQpID09IDApIHtcbiAgICAgIHR5cGUgPSBcImRvdWJsZVwiO1xuICAgICAgbGFzdERvdWJsZUNsaWNrID0ge3RpbWU6IG5vdywgcG9zOiBzdGFydH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHR5cGUgPSBcInNpbmdsZVwiO1xuICAgICAgbGFzdENsaWNrID0ge3RpbWU6IG5vdywgcG9zOiBzdGFydH07XG4gICAgfVxuXG4gICAgdmFyIHNlbCA9IGNtLmRvYy5zZWwsIG1vZGlmaWVyID0gbWFjID8gZS5tZXRhS2V5IDogZS5jdHJsS2V5LCBjb250YWluZWQ7XG4gICAgaWYgKGNtLm9wdGlvbnMuZHJhZ0Ryb3AgJiYgZHJhZ0FuZERyb3AgJiYgIWlzUmVhZE9ubHkoY20pICYmXG4gICAgICAgIHR5cGUgPT0gXCJzaW5nbGVcIiAmJiAoY29udGFpbmVkID0gc2VsLmNvbnRhaW5zKHN0YXJ0KSkgPiAtMSAmJlxuICAgICAgICAoY21wKChjb250YWluZWQgPSBzZWwucmFuZ2VzW2NvbnRhaW5lZF0pLmZyb20oKSwgc3RhcnQpIDwgMCB8fCBzdGFydC54UmVsID4gMCkgJiZcbiAgICAgICAgKGNtcChjb250YWluZWQudG8oKSwgc3RhcnQpID4gMCB8fCBzdGFydC54UmVsIDwgMCkpXG4gICAgICBsZWZ0QnV0dG9uU3RhcnREcmFnKGNtLCBlLCBzdGFydCwgbW9kaWZpZXIpO1xuICAgIGVsc2VcbiAgICAgIGxlZnRCdXR0b25TZWxlY3QoY20sIGUsIHN0YXJ0LCB0eXBlLCBtb2RpZmllcik7XG4gIH1cblxuICAvLyBTdGFydCBhIHRleHQgZHJhZy4gV2hlbiBpdCBlbmRzLCBzZWUgaWYgYW55IGRyYWdnaW5nIGFjdHVhbGx5XG4gIC8vIGhhcHBlbiwgYW5kIHRyZWF0IGFzIGEgY2xpY2sgaWYgaXQgZGlkbid0LlxuICBmdW5jdGlvbiBsZWZ0QnV0dG9uU3RhcnREcmFnKGNtLCBlLCBzdGFydCwgbW9kaWZpZXIpIHtcbiAgICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXksIHN0YXJ0VGltZSA9ICtuZXcgRGF0ZTtcbiAgICB2YXIgZHJhZ0VuZCA9IG9wZXJhdGlvbihjbSwgZnVuY3Rpb24oZTIpIHtcbiAgICAgIGlmICh3ZWJraXQpIGRpc3BsYXkuc2Nyb2xsZXIuZHJhZ2dhYmxlID0gZmFsc2U7XG4gICAgICBjbS5zdGF0ZS5kcmFnZ2luZ1RleHQgPSBmYWxzZTtcbiAgICAgIG9mZihkb2N1bWVudCwgXCJtb3VzZXVwXCIsIGRyYWdFbmQpO1xuICAgICAgb2ZmKGRpc3BsYXkuc2Nyb2xsZXIsIFwiZHJvcFwiLCBkcmFnRW5kKTtcbiAgICAgIGlmIChNYXRoLmFicyhlLmNsaWVudFggLSBlMi5jbGllbnRYKSArIE1hdGguYWJzKGUuY2xpZW50WSAtIGUyLmNsaWVudFkpIDwgMTApIHtcbiAgICAgICAgZV9wcmV2ZW50RGVmYXVsdChlMik7XG4gICAgICAgIGlmICghbW9kaWZpZXIgJiYgK25ldyBEYXRlIC0gMjAwIDwgc3RhcnRUaW1lKVxuICAgICAgICAgIGV4dGVuZFNlbGVjdGlvbihjbS5kb2MsIHN0YXJ0KTtcbiAgICAgICAgLy8gV29yayBhcm91bmQgdW5leHBsYWluYWJsZSBmb2N1cyBwcm9ibGVtIGluIElFOSAoIzIxMjcpIGFuZCBDaHJvbWUgKCMzMDgxKVxuICAgICAgICBpZiAod2Via2l0IHx8IGllICYmIGllX3ZlcnNpb24gPT0gOSlcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge2RvY3VtZW50LmJvZHkuZm9jdXMoKTsgZGlzcGxheS5pbnB1dC5mb2N1cygpO30sIDIwKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGRpc3BsYXkuaW5wdXQuZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBMZXQgdGhlIGRyYWcgaGFuZGxlciBoYW5kbGUgdGhpcy5cbiAgICBpZiAod2Via2l0KSBkaXNwbGF5LnNjcm9sbGVyLmRyYWdnYWJsZSA9IHRydWU7XG4gICAgY20uc3RhdGUuZHJhZ2dpbmdUZXh0ID0gZHJhZ0VuZDtcbiAgICAvLyBJRSdzIGFwcHJvYWNoIHRvIGRyYWdnYWJsZVxuICAgIGlmIChkaXNwbGF5LnNjcm9sbGVyLmRyYWdEcm9wKSBkaXNwbGF5LnNjcm9sbGVyLmRyYWdEcm9wKCk7XG4gICAgb24oZG9jdW1lbnQsIFwibW91c2V1cFwiLCBkcmFnRW5kKTtcbiAgICBvbihkaXNwbGF5LnNjcm9sbGVyLCBcImRyb3BcIiwgZHJhZ0VuZCk7XG4gIH1cblxuICAvLyBOb3JtYWwgc2VsZWN0aW9uLCBhcyBvcHBvc2VkIHRvIHRleHQgZHJhZ2dpbmcuXG4gIGZ1bmN0aW9uIGxlZnRCdXR0b25TZWxlY3QoY20sIGUsIHN0YXJ0LCB0eXBlLCBhZGROZXcpIHtcbiAgICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXksIGRvYyA9IGNtLmRvYztcbiAgICBlX3ByZXZlbnREZWZhdWx0KGUpO1xuXG4gICAgdmFyIG91clJhbmdlLCBvdXJJbmRleCwgc3RhcnRTZWwgPSBkb2Muc2VsLCByYW5nZXMgPSBzdGFydFNlbC5yYW5nZXM7XG4gICAgaWYgKGFkZE5ldyAmJiAhZS5zaGlmdEtleSkge1xuICAgICAgb3VySW5kZXggPSBkb2Muc2VsLmNvbnRhaW5zKHN0YXJ0KTtcbiAgICAgIGlmIChvdXJJbmRleCA+IC0xKVxuICAgICAgICBvdXJSYW5nZSA9IHJhbmdlc1tvdXJJbmRleF07XG4gICAgICBlbHNlXG4gICAgICAgIG91clJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBzdGFydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91clJhbmdlID0gZG9jLnNlbC5wcmltYXJ5KCk7XG4gICAgICBvdXJJbmRleCA9IGRvYy5zZWwucHJpbUluZGV4O1xuICAgIH1cblxuICAgIGlmIChlLmFsdEtleSkge1xuICAgICAgdHlwZSA9IFwicmVjdFwiO1xuICAgICAgaWYgKCFhZGROZXcpIG91clJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBzdGFydCk7XG4gICAgICBzdGFydCA9IHBvc0Zyb21Nb3VzZShjbSwgZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICBvdXJJbmRleCA9IC0xO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImRvdWJsZVwiKSB7XG4gICAgICB2YXIgd29yZCA9IGNtLmZpbmRXb3JkQXQoc3RhcnQpO1xuICAgICAgaWYgKGNtLmRpc3BsYXkuc2hpZnQgfHwgZG9jLmV4dGVuZClcbiAgICAgICAgb3VyUmFuZ2UgPSBleHRlbmRSYW5nZShkb2MsIG91clJhbmdlLCB3b3JkLmFuY2hvciwgd29yZC5oZWFkKTtcbiAgICAgIGVsc2VcbiAgICAgICAgb3VyUmFuZ2UgPSB3b3JkO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyaXBsZVwiKSB7XG4gICAgICB2YXIgbGluZSA9IG5ldyBSYW5nZShQb3Moc3RhcnQubGluZSwgMCksIGNsaXBQb3MoZG9jLCBQb3Moc3RhcnQubGluZSArIDEsIDApKSk7XG4gICAgICBpZiAoY20uZGlzcGxheS5zaGlmdCB8fCBkb2MuZXh0ZW5kKVxuICAgICAgICBvdXJSYW5nZSA9IGV4dGVuZFJhbmdlKGRvYywgb3VyUmFuZ2UsIGxpbmUuYW5jaG9yLCBsaW5lLmhlYWQpO1xuICAgICAgZWxzZVxuICAgICAgICBvdXJSYW5nZSA9IGxpbmU7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91clJhbmdlID0gZXh0ZW5kUmFuZ2UoZG9jLCBvdXJSYW5nZSwgc3RhcnQpO1xuICAgIH1cblxuICAgIGlmICghYWRkTmV3KSB7XG4gICAgICBvdXJJbmRleCA9IDA7XG4gICAgICBzZXRTZWxlY3Rpb24oZG9jLCBuZXcgU2VsZWN0aW9uKFtvdXJSYW5nZV0sIDApLCBzZWxfbW91c2UpO1xuICAgICAgc3RhcnRTZWwgPSBkb2Muc2VsO1xuICAgIH0gZWxzZSBpZiAob3VySW5kZXggPT0gLTEpIHtcbiAgICAgIG91ckluZGV4ID0gcmFuZ2VzLmxlbmd0aDtcbiAgICAgIHNldFNlbGVjdGlvbihkb2MsIG5vcm1hbGl6ZVNlbGVjdGlvbihyYW5nZXMuY29uY2F0KFtvdXJSYW5nZV0pLCBvdXJJbmRleCksXG4gICAgICAgICAgICAgICAgICAge3Njcm9sbDogZmFsc2UsIG9yaWdpbjogXCIqbW91c2VcIn0pO1xuICAgIH0gZWxzZSBpZiAocmFuZ2VzLmxlbmd0aCA+IDEgJiYgcmFuZ2VzW291ckluZGV4XS5lbXB0eSgpICYmIHR5cGUgPT0gXCJzaW5nbGVcIiAmJiAhZS5zaGlmdEtleSkge1xuICAgICAgc2V0U2VsZWN0aW9uKGRvYywgbm9ybWFsaXplU2VsZWN0aW9uKHJhbmdlcy5zbGljZSgwLCBvdXJJbmRleCkuY29uY2F0KHJhbmdlcy5zbGljZShvdXJJbmRleCArIDEpKSwgMCksXG4gICAgICAgICAgICAgICAgICAge3Njcm9sbDogZmFsc2UsIG9yaWdpbjogXCIqbW91c2VcIn0pO1xuICAgICAgc3RhcnRTZWwgPSBkb2Muc2VsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXBsYWNlT25lU2VsZWN0aW9uKGRvYywgb3VySW5kZXgsIG91clJhbmdlLCBzZWxfbW91c2UpO1xuICAgIH1cblxuICAgIHZhciBsYXN0UG9zID0gc3RhcnQ7XG4gICAgZnVuY3Rpb24gZXh0ZW5kVG8ocG9zKSB7XG4gICAgICBpZiAoY21wKGxhc3RQb3MsIHBvcykgPT0gMCkgcmV0dXJuO1xuICAgICAgbGFzdFBvcyA9IHBvcztcblxuICAgICAgaWYgKHR5cGUgPT0gXCJyZWN0XCIpIHtcbiAgICAgICAgdmFyIHJhbmdlcyA9IFtdLCB0YWJTaXplID0gY20ub3B0aW9ucy50YWJTaXplO1xuICAgICAgICB2YXIgc3RhcnRDb2wgPSBjb3VudENvbHVtbihnZXRMaW5lKGRvYywgc3RhcnQubGluZSkudGV4dCwgc3RhcnQuY2gsIHRhYlNpemUpO1xuICAgICAgICB2YXIgcG9zQ29sID0gY291bnRDb2x1bW4oZ2V0TGluZShkb2MsIHBvcy5saW5lKS50ZXh0LCBwb3MuY2gsIHRhYlNpemUpO1xuICAgICAgICB2YXIgbGVmdCA9IE1hdGgubWluKHN0YXJ0Q29sLCBwb3NDb2wpLCByaWdodCA9IE1hdGgubWF4KHN0YXJ0Q29sLCBwb3NDb2wpO1xuICAgICAgICBmb3IgKHZhciBsaW5lID0gTWF0aC5taW4oc3RhcnQubGluZSwgcG9zLmxpbmUpLCBlbmQgPSBNYXRoLm1pbihjbS5sYXN0TGluZSgpLCBNYXRoLm1heChzdGFydC5saW5lLCBwb3MubGluZSkpO1xuICAgICAgICAgICAgIGxpbmUgPD0gZW5kOyBsaW5lKyspIHtcbiAgICAgICAgICB2YXIgdGV4dCA9IGdldExpbmUoZG9jLCBsaW5lKS50ZXh0LCBsZWZ0UG9zID0gZmluZENvbHVtbih0ZXh0LCBsZWZ0LCB0YWJTaXplKTtcbiAgICAgICAgICBpZiAobGVmdCA9PSByaWdodClcbiAgICAgICAgICAgIHJhbmdlcy5wdXNoKG5ldyBSYW5nZShQb3MobGluZSwgbGVmdFBvcyksIFBvcyhsaW5lLCBsZWZ0UG9zKSkpO1xuICAgICAgICAgIGVsc2UgaWYgKHRleHQubGVuZ3RoID4gbGVmdFBvcylcbiAgICAgICAgICAgIHJhbmdlcy5wdXNoKG5ldyBSYW5nZShQb3MobGluZSwgbGVmdFBvcyksIFBvcyhsaW5lLCBmaW5kQ29sdW1uKHRleHQsIHJpZ2h0LCB0YWJTaXplKSkpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXJhbmdlcy5sZW5ndGgpIHJhbmdlcy5wdXNoKG5ldyBSYW5nZShzdGFydCwgc3RhcnQpKTtcbiAgICAgICAgc2V0U2VsZWN0aW9uKGRvYywgbm9ybWFsaXplU2VsZWN0aW9uKHN0YXJ0U2VsLnJhbmdlcy5zbGljZSgwLCBvdXJJbmRleCkuY29uY2F0KHJhbmdlcyksIG91ckluZGV4KSxcbiAgICAgICAgICAgICAgICAgICAgIHtvcmlnaW46IFwiKm1vdXNlXCIsIHNjcm9sbDogZmFsc2V9KTtcbiAgICAgICAgY20uc2Nyb2xsSW50b1ZpZXcocG9zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBvbGRSYW5nZSA9IG91clJhbmdlO1xuICAgICAgICB2YXIgYW5jaG9yID0gb2xkUmFuZ2UuYW5jaG9yLCBoZWFkID0gcG9zO1xuICAgICAgICBpZiAodHlwZSAhPSBcInNpbmdsZVwiKSB7XG4gICAgICAgICAgaWYgKHR5cGUgPT0gXCJkb3VibGVcIilcbiAgICAgICAgICAgIHZhciByYW5nZSA9IGNtLmZpbmRXb3JkQXQocG9zKTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB2YXIgcmFuZ2UgPSBuZXcgUmFuZ2UoUG9zKHBvcy5saW5lLCAwKSwgY2xpcFBvcyhkb2MsIFBvcyhwb3MubGluZSArIDEsIDApKSk7XG4gICAgICAgICAgaWYgKGNtcChyYW5nZS5hbmNob3IsIGFuY2hvcikgPiAwKSB7XG4gICAgICAgICAgICBoZWFkID0gcmFuZ2UuaGVhZDtcbiAgICAgICAgICAgIGFuY2hvciA9IG1pblBvcyhvbGRSYW5nZS5mcm9tKCksIHJhbmdlLmFuY2hvcik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhlYWQgPSByYW5nZS5hbmNob3I7XG4gICAgICAgICAgICBhbmNob3IgPSBtYXhQb3Mob2xkUmFuZ2UudG8oKSwgcmFuZ2UuaGVhZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciByYW5nZXMgPSBzdGFydFNlbC5yYW5nZXMuc2xpY2UoMCk7XG4gICAgICAgIHJhbmdlc1tvdXJJbmRleF0gPSBuZXcgUmFuZ2UoY2xpcFBvcyhkb2MsIGFuY2hvciksIGhlYWQpO1xuICAgICAgICBzZXRTZWxlY3Rpb24oZG9jLCBub3JtYWxpemVTZWxlY3Rpb24ocmFuZ2VzLCBvdXJJbmRleCksIHNlbF9tb3VzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGVkaXRvclNpemUgPSBkaXNwbGF5LndyYXBwZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgLy8gVXNlZCB0byBlbnN1cmUgdGltZW91dCByZS10cmllcyBkb24ndCBmaXJlIHdoZW4gYW5vdGhlciBleHRlbmRcbiAgICAvLyBoYXBwZW5lZCBpbiB0aGUgbWVhbnRpbWUgKGNsZWFyVGltZW91dCBpc24ndCByZWxpYWJsZSAtLSBhdFxuICAgIC8vIGxlYXN0IG9uIENocm9tZSwgdGhlIHRpbWVvdXRzIHN0aWxsIGhhcHBlbiBldmVuIHdoZW4gY2xlYXJlZCxcbiAgICAvLyBpZiB0aGUgY2xlYXIgaGFwcGVucyBhZnRlciB0aGVpciBzY2hlZHVsZWQgZmlyaW5nIHRpbWUpLlxuICAgIHZhciBjb3VudGVyID0gMDtcblxuICAgIGZ1bmN0aW9uIGV4dGVuZChlKSB7XG4gICAgICB2YXIgY3VyQ291bnQgPSArK2NvdW50ZXI7XG4gICAgICB2YXIgY3VyID0gcG9zRnJvbU1vdXNlKGNtLCBlLCB0cnVlLCB0eXBlID09IFwicmVjdFwiKTtcbiAgICAgIGlmICghY3VyKSByZXR1cm47XG4gICAgICBpZiAoY21wKGN1ciwgbGFzdFBvcykgIT0gMCkge1xuICAgICAgICBjbS5jdXJPcC5mb2N1cyA9IGFjdGl2ZUVsdCgpO1xuICAgICAgICBleHRlbmRUbyhjdXIpO1xuICAgICAgICB2YXIgdmlzaWJsZSA9IHZpc2libGVMaW5lcyhkaXNwbGF5LCBkb2MpO1xuICAgICAgICBpZiAoY3VyLmxpbmUgPj0gdmlzaWJsZS50byB8fCBjdXIubGluZSA8IHZpc2libGUuZnJvbSlcbiAgICAgICAgICBzZXRUaW1lb3V0KG9wZXJhdGlvbihjbSwgZnVuY3Rpb24oKXtpZiAoY291bnRlciA9PSBjdXJDb3VudCkgZXh0ZW5kKGUpO30pLCAxNTApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG91dHNpZGUgPSBlLmNsaWVudFkgPCBlZGl0b3JTaXplLnRvcCA/IC0yMCA6IGUuY2xpZW50WSA+IGVkaXRvclNpemUuYm90dG9tID8gMjAgOiAwO1xuICAgICAgICBpZiAob3V0c2lkZSkgc2V0VGltZW91dChvcGVyYXRpb24oY20sIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChjb3VudGVyICE9IGN1ckNvdW50KSByZXR1cm47XG4gICAgICAgICAgZGlzcGxheS5zY3JvbGxlci5zY3JvbGxUb3AgKz0gb3V0c2lkZTtcbiAgICAgICAgICBleHRlbmQoZSk7XG4gICAgICAgIH0pLCA1MCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZG9uZShlKSB7XG4gICAgICBjbS5zdGF0ZS5zZWxlY3RpbmdUZXh0ID0gZmFsc2U7XG4gICAgICBjb3VudGVyID0gSW5maW5pdHk7XG4gICAgICBlX3ByZXZlbnREZWZhdWx0KGUpO1xuICAgICAgZGlzcGxheS5pbnB1dC5mb2N1cygpO1xuICAgICAgb2ZmKGRvY3VtZW50LCBcIm1vdXNlbW92ZVwiLCBtb3ZlKTtcbiAgICAgIG9mZihkb2N1bWVudCwgXCJtb3VzZXVwXCIsIHVwKTtcbiAgICAgIGRvYy5oaXN0b3J5Lmxhc3RTZWxPcmlnaW4gPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBtb3ZlID0gb3BlcmF0aW9uKGNtLCBmdW5jdGlvbihlKSB7XG4gICAgICBpZiAoIWVfYnV0dG9uKGUpKSBkb25lKGUpO1xuICAgICAgZWxzZSBleHRlbmQoZSk7XG4gICAgfSk7XG4gICAgdmFyIHVwID0gb3BlcmF0aW9uKGNtLCBkb25lKTtcbiAgICBjbS5zdGF0ZS5zZWxlY3RpbmdUZXh0ID0gdXA7XG4gICAgb24oZG9jdW1lbnQsIFwibW91c2Vtb3ZlXCIsIG1vdmUpO1xuICAgIG9uKGRvY3VtZW50LCBcIm1vdXNldXBcIiwgdXApO1xuICB9XG5cbiAgLy8gRGV0ZXJtaW5lcyB3aGV0aGVyIGFuIGV2ZW50IGhhcHBlbmVkIGluIHRoZSBndXR0ZXIsIGFuZCBmaXJlcyB0aGVcbiAgLy8gaGFuZGxlcnMgZm9yIHRoZSBjb3JyZXNwb25kaW5nIGV2ZW50LlxuICBmdW5jdGlvbiBndXR0ZXJFdmVudChjbSwgZSwgdHlwZSwgcHJldmVudCkge1xuICAgIHRyeSB7IHZhciBtWCA9IGUuY2xpZW50WCwgbVkgPSBlLmNsaWVudFk7IH1cbiAgICBjYXRjaChlKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIGlmIChtWCA+PSBNYXRoLmZsb29yKGNtLmRpc3BsYXkuZ3V0dGVycy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5yaWdodCkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAocHJldmVudCkgZV9wcmV2ZW50RGVmYXVsdChlKTtcblxuICAgIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgICB2YXIgbGluZUJveCA9IGRpc3BsYXkubGluZURpdi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgIGlmIChtWSA+IGxpbmVCb3guYm90dG9tIHx8ICFoYXNIYW5kbGVyKGNtLCB0eXBlKSkgcmV0dXJuIGVfZGVmYXVsdFByZXZlbnRlZChlKTtcbiAgICBtWSAtPSBsaW5lQm94LnRvcCAtIGRpc3BsYXkudmlld09mZnNldDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY20ub3B0aW9ucy5ndXR0ZXJzLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgZyA9IGRpc3BsYXkuZ3V0dGVycy5jaGlsZE5vZGVzW2ldO1xuICAgICAgaWYgKGcgJiYgZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5yaWdodCA+PSBtWCkge1xuICAgICAgICB2YXIgbGluZSA9IGxpbmVBdEhlaWdodChjbS5kb2MsIG1ZKTtcbiAgICAgICAgdmFyIGd1dHRlciA9IGNtLm9wdGlvbnMuZ3V0dGVyc1tpXTtcbiAgICAgICAgc2lnbmFsKGNtLCB0eXBlLCBjbSwgbGluZSwgZ3V0dGVyLCBlKTtcbiAgICAgICAgcmV0dXJuIGVfZGVmYXVsdFByZXZlbnRlZChlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjbGlja0luR3V0dGVyKGNtLCBlKSB7XG4gICAgcmV0dXJuIGd1dHRlckV2ZW50KGNtLCBlLCBcImd1dHRlckNsaWNrXCIsIHRydWUpO1xuICB9XG5cbiAgLy8gS2x1ZGdlIHRvIHdvcmsgYXJvdW5kIHN0cmFuZ2UgSUUgYmVoYXZpb3Igd2hlcmUgaXQnbGwgc29tZXRpbWVzXG4gIC8vIHJlLWZpcmUgYSBzZXJpZXMgb2YgZHJhZy1yZWxhdGVkIGV2ZW50cyByaWdodCBhZnRlciB0aGUgZHJvcCAoIzE1NTEpXG4gIHZhciBsYXN0RHJvcCA9IDA7XG5cbiAgZnVuY3Rpb24gb25Ecm9wKGUpIHtcbiAgICB2YXIgY20gPSB0aGlzO1xuICAgIGNsZWFyRHJhZ0N1cnNvcihjbSk7XG4gICAgaWYgKHNpZ25hbERPTUV2ZW50KGNtLCBlKSB8fCBldmVudEluV2lkZ2V0KGNtLmRpc3BsYXksIGUpKVxuICAgICAgcmV0dXJuO1xuICAgIGVfcHJldmVudERlZmF1bHQoZSk7XG4gICAgaWYgKGllKSBsYXN0RHJvcCA9ICtuZXcgRGF0ZTtcbiAgICB2YXIgcG9zID0gcG9zRnJvbU1vdXNlKGNtLCBlLCB0cnVlKSwgZmlsZXMgPSBlLmRhdGFUcmFuc2Zlci5maWxlcztcbiAgICBpZiAoIXBvcyB8fCBpc1JlYWRPbmx5KGNtKSkgcmV0dXJuO1xuICAgIC8vIE1pZ2h0IGJlIGEgZmlsZSBkcm9wLCBpbiB3aGljaCBjYXNlIHdlIHNpbXBseSBleHRyYWN0IHRoZSB0ZXh0XG4gICAgLy8gYW5kIGluc2VydCBpdC5cbiAgICBpZiAoZmlsZXMgJiYgZmlsZXMubGVuZ3RoICYmIHdpbmRvdy5GaWxlUmVhZGVyICYmIHdpbmRvdy5GaWxlKSB7XG4gICAgICB2YXIgbiA9IGZpbGVzLmxlbmd0aCwgdGV4dCA9IEFycmF5KG4pLCByZWFkID0gMDtcbiAgICAgIHZhciBsb2FkRmlsZSA9IGZ1bmN0aW9uKGZpbGUsIGkpIHtcbiAgICAgICAgaWYgKGNtLm9wdGlvbnMuYWxsb3dEcm9wRmlsZVR5cGVzICYmXG4gICAgICAgICAgICBpbmRleE9mKGNtLm9wdGlvbnMuYWxsb3dEcm9wRmlsZVR5cGVzLCBmaWxlLnR5cGUpID09IC0xKVxuICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXI7XG4gICAgICAgIHJlYWRlci5vbmxvYWQgPSBvcGVyYXRpb24oY20sIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBjb250ZW50ID0gcmVhZGVyLnJlc3VsdDtcbiAgICAgICAgICBpZiAoL1tcXHgwMC1cXHgwOFxceDBlLVxceDFmXXsyfS8udGVzdChjb250ZW50KSkgY29udGVudCA9IFwiXCI7XG4gICAgICAgICAgdGV4dFtpXSA9IGNvbnRlbnQ7XG4gICAgICAgICAgaWYgKCsrcmVhZCA9PSBuKSB7XG4gICAgICAgICAgICBwb3MgPSBjbGlwUG9zKGNtLmRvYywgcG9zKTtcbiAgICAgICAgICAgIHZhciBjaGFuZ2UgPSB7ZnJvbTogcG9zLCB0bzogcG9zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBjbS5kb2Muc3BsaXRMaW5lcyh0ZXh0LmpvaW4oY20uZG9jLmxpbmVTZXBhcmF0b3IoKSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW46IFwicGFzdGVcIn07XG4gICAgICAgICAgICBtYWtlQ2hhbmdlKGNtLmRvYywgY2hhbmdlKTtcbiAgICAgICAgICAgIHNldFNlbGVjdGlvblJlcGxhY2VIaXN0b3J5KGNtLmRvYywgc2ltcGxlU2VsZWN0aW9uKHBvcywgY2hhbmdlRW5kKGNoYW5nZSkpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcbiAgICAgIH07XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkgbG9hZEZpbGUoZmlsZXNbaV0sIGkpO1xuICAgIH0gZWxzZSB7IC8vIE5vcm1hbCBkcm9wXG4gICAgICAvLyBEb24ndCBkbyBhIHJlcGxhY2UgaWYgdGhlIGRyb3AgaGFwcGVuZWQgaW5zaWRlIG9mIHRoZSBzZWxlY3RlZCB0ZXh0LlxuICAgICAgaWYgKGNtLnN0YXRlLmRyYWdnaW5nVGV4dCAmJiBjbS5kb2Muc2VsLmNvbnRhaW5zKHBvcykgPiAtMSkge1xuICAgICAgICBjbS5zdGF0ZS5kcmFnZ2luZ1RleHQoZSk7XG4gICAgICAgIC8vIEVuc3VyZSB0aGUgZWRpdG9yIGlzIHJlLWZvY3VzZWRcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtjbS5kaXNwbGF5LmlucHV0LmZvY3VzKCk7fSwgMjApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgdGV4dCA9IGUuZGF0YVRyYW5zZmVyLmdldERhdGEoXCJUZXh0XCIpO1xuICAgICAgICBpZiAodGV4dCkge1xuICAgICAgICAgIGlmIChjbS5zdGF0ZS5kcmFnZ2luZ1RleHQgJiYgIShtYWMgPyBlLmFsdEtleSA6IGUuY3RybEtleSkpXG4gICAgICAgICAgICB2YXIgc2VsZWN0ZWQgPSBjbS5saXN0U2VsZWN0aW9ucygpO1xuICAgICAgICAgIHNldFNlbGVjdGlvbk5vVW5kbyhjbS5kb2MsIHNpbXBsZVNlbGVjdGlvbihwb3MsIHBvcykpO1xuICAgICAgICAgIGlmIChzZWxlY3RlZCkgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxlY3RlZC5sZW5ndGg7ICsraSlcbiAgICAgICAgICAgIHJlcGxhY2VSYW5nZShjbS5kb2MsIFwiXCIsIHNlbGVjdGVkW2ldLmFuY2hvciwgc2VsZWN0ZWRbaV0uaGVhZCwgXCJkcmFnXCIpO1xuICAgICAgICAgIGNtLnJlcGxhY2VTZWxlY3Rpb24odGV4dCwgXCJhcm91bmRcIiwgXCJwYXN0ZVwiKTtcbiAgICAgICAgICBjbS5kaXNwbGF5LmlucHV0LmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNhdGNoKGUpe31cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvbkRyYWdTdGFydChjbSwgZSkge1xuICAgIGlmIChpZSAmJiAoIWNtLnN0YXRlLmRyYWdnaW5nVGV4dCB8fCArbmV3IERhdGUgLSBsYXN0RHJvcCA8IDEwMCkpIHsgZV9zdG9wKGUpOyByZXR1cm47IH1cbiAgICBpZiAoc2lnbmFsRE9NRXZlbnQoY20sIGUpIHx8IGV2ZW50SW5XaWRnZXQoY20uZGlzcGxheSwgZSkpIHJldHVybjtcblxuICAgIGUuZGF0YVRyYW5zZmVyLnNldERhdGEoXCJUZXh0XCIsIGNtLmdldFNlbGVjdGlvbigpKTtcblxuICAgIC8vIFVzZSBkdW1teSBpbWFnZSBpbnN0ZWFkIG9mIGRlZmF1bHQgYnJvd3NlcnMgaW1hZ2UuXG4gICAgLy8gUmVjZW50IFNhZmFyaSAofjYuMC4yKSBoYXZlIGEgdGVuZGVuY3kgdG8gc2VnZmF1bHQgd2hlbiB0aGlzIGhhcHBlbnMsIHNvIHdlIGRvbid0IGRvIGl0IHRoZXJlLlxuICAgIGlmIChlLmRhdGFUcmFuc2Zlci5zZXREcmFnSW1hZ2UgJiYgIXNhZmFyaSkge1xuICAgICAgdmFyIGltZyA9IGVsdChcImltZ1wiLCBudWxsLCBudWxsLCBcInBvc2l0aW9uOiBmaXhlZDsgbGVmdDogMDsgdG9wOiAwO1wiKTtcbiAgICAgIGltZy5zcmMgPSBcImRhdGE6aW1hZ2UvZ2lmO2Jhc2U2NCxSMGxHT0RsaEFRQUJBQUFBQUNINUJBRUtBQUVBTEFBQUFBQUJBQUVBQUFJQ1RBRUFPdz09XCI7XG4gICAgICBpZiAocHJlc3RvKSB7XG4gICAgICAgIGltZy53aWR0aCA9IGltZy5oZWlnaHQgPSAxO1xuICAgICAgICBjbS5kaXNwbGF5LndyYXBwZXIuYXBwZW5kQ2hpbGQoaW1nKTtcbiAgICAgICAgLy8gRm9yY2UgYSByZWxheW91dCwgb3IgT3BlcmEgd29uJ3QgdXNlIG91ciBpbWFnZSBmb3Igc29tZSBvYnNjdXJlIHJlYXNvblxuICAgICAgICBpbWcuX3RvcCA9IGltZy5vZmZzZXRUb3A7XG4gICAgICB9XG4gICAgICBlLmRhdGFUcmFuc2Zlci5zZXREcmFnSW1hZ2UoaW1nLCAwLCAwKTtcbiAgICAgIGlmIChwcmVzdG8pIGltZy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGltZyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25EcmFnT3ZlcihjbSwgZSkge1xuICAgIHZhciBwb3MgPSBwb3NGcm9tTW91c2UoY20sIGUpO1xuICAgIGlmICghcG9zKSByZXR1cm47XG4gICAgdmFyIGZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgZHJhd1NlbGVjdGlvbkN1cnNvcihjbSwgcG9zLCBmcmFnKTtcbiAgICBpZiAoIWNtLmRpc3BsYXkuZHJhZ0N1cnNvcikge1xuICAgICAgY20uZGlzcGxheS5kcmFnQ3Vyc29yID0gZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1jdXJzb3JzIENvZGVNaXJyb3ItZHJhZ2N1cnNvcnNcIik7XG4gICAgICBjbS5kaXNwbGF5LmxpbmVTcGFjZS5pbnNlcnRCZWZvcmUoY20uZGlzcGxheS5kcmFnQ3Vyc29yLCBjbS5kaXNwbGF5LmN1cnNvckRpdik7XG4gICAgfVxuICAgIHJlbW92ZUNoaWxkcmVuQW5kQWRkKGNtLmRpc3BsYXkuZHJhZ0N1cnNvciwgZnJhZyk7XG4gIH1cblxuICBmdW5jdGlvbiBjbGVhckRyYWdDdXJzb3IoY20pIHtcbiAgICBpZiAoY20uZGlzcGxheS5kcmFnQ3Vyc29yKSB7XG4gICAgICBjbS5kaXNwbGF5LmxpbmVTcGFjZS5yZW1vdmVDaGlsZChjbS5kaXNwbGF5LmRyYWdDdXJzb3IpO1xuICAgICAgY20uZGlzcGxheS5kcmFnQ3Vyc29yID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvLyBTQ1JPTEwgRVZFTlRTXG5cbiAgLy8gU3luYyB0aGUgc2Nyb2xsYWJsZSBhcmVhIGFuZCBzY3JvbGxiYXJzLCBlbnN1cmUgdGhlIHZpZXdwb3J0XG4gIC8vIGNvdmVycyB0aGUgdmlzaWJsZSBhcmVhLlxuICBmdW5jdGlvbiBzZXRTY3JvbGxUb3AoY20sIHZhbCkge1xuICAgIGlmIChNYXRoLmFicyhjbS5kb2Muc2Nyb2xsVG9wIC0gdmFsKSA8IDIpIHJldHVybjtcbiAgICBjbS5kb2Muc2Nyb2xsVG9wID0gdmFsO1xuICAgIGlmICghZ2Vja28pIHVwZGF0ZURpc3BsYXlTaW1wbGUoY20sIHt0b3A6IHZhbH0pO1xuICAgIGlmIChjbS5kaXNwbGF5LnNjcm9sbGVyLnNjcm9sbFRvcCAhPSB2YWwpIGNtLmRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wID0gdmFsO1xuICAgIGNtLmRpc3BsYXkuc2Nyb2xsYmFycy5zZXRTY3JvbGxUb3AodmFsKTtcbiAgICBpZiAoZ2Vja28pIHVwZGF0ZURpc3BsYXlTaW1wbGUoY20pO1xuICAgIHN0YXJ0V29ya2VyKGNtLCAxMDApO1xuICB9XG4gIC8vIFN5bmMgc2Nyb2xsZXIgYW5kIHNjcm9sbGJhciwgZW5zdXJlIHRoZSBndXR0ZXIgZWxlbWVudHMgYXJlXG4gIC8vIGFsaWduZWQuXG4gIGZ1bmN0aW9uIHNldFNjcm9sbExlZnQoY20sIHZhbCwgaXNTY3JvbGxlcikge1xuICAgIGlmIChpc1Njcm9sbGVyID8gdmFsID09IGNtLmRvYy5zY3JvbGxMZWZ0IDogTWF0aC5hYnMoY20uZG9jLnNjcm9sbExlZnQgLSB2YWwpIDwgMikgcmV0dXJuO1xuICAgIHZhbCA9IE1hdGgubWluKHZhbCwgY20uZGlzcGxheS5zY3JvbGxlci5zY3JvbGxXaWR0aCAtIGNtLmRpc3BsYXkuc2Nyb2xsZXIuY2xpZW50V2lkdGgpO1xuICAgIGNtLmRvYy5zY3JvbGxMZWZ0ID0gdmFsO1xuICAgIGFsaWduSG9yaXpvbnRhbGx5KGNtKTtcbiAgICBpZiAoY20uZGlzcGxheS5zY3JvbGxlci5zY3JvbGxMZWZ0ICE9IHZhbCkgY20uZGlzcGxheS5zY3JvbGxlci5zY3JvbGxMZWZ0ID0gdmFsO1xuICAgIGNtLmRpc3BsYXkuc2Nyb2xsYmFycy5zZXRTY3JvbGxMZWZ0KHZhbCk7XG4gIH1cblxuICAvLyBTaW5jZSB0aGUgZGVsdGEgdmFsdWVzIHJlcG9ydGVkIG9uIG1vdXNlIHdoZWVsIGV2ZW50cyBhcmVcbiAgLy8gdW5zdGFuZGFyZGl6ZWQgYmV0d2VlbiBicm93c2VycyBhbmQgZXZlbiBicm93c2VyIHZlcnNpb25zLCBhbmRcbiAgLy8gZ2VuZXJhbGx5IGhvcnJpYmx5IHVucHJlZGljdGFibGUsIHRoaXMgY29kZSBzdGFydHMgYnkgbWVhc3VyaW5nXG4gIC8vIHRoZSBzY3JvbGwgZWZmZWN0IHRoYXQgdGhlIGZpcnN0IGZldyBtb3VzZSB3aGVlbCBldmVudHMgaGF2ZSxcbiAgLy8gYW5kLCBmcm9tIHRoYXQsIGRldGVjdHMgdGhlIHdheSBpdCBjYW4gY29udmVydCBkZWx0YXMgdG8gcGl4ZWxcbiAgLy8gb2Zmc2V0cyBhZnRlcndhcmRzLlxuICAvL1xuICAvLyBUaGUgcmVhc29uIHdlIHdhbnQgdG8ga25vdyB0aGUgYW1vdW50IGEgd2hlZWwgZXZlbnQgd2lsbCBzY3JvbGxcbiAgLy8gaXMgdGhhdCBpdCBnaXZlcyB1cyBhIGNoYW5jZSB0byB1cGRhdGUgdGhlIGRpc3BsYXkgYmVmb3JlIHRoZVxuICAvLyBhY3R1YWwgc2Nyb2xsaW5nIGhhcHBlbnMsIHJlZHVjaW5nIGZsaWNrZXJpbmcuXG5cbiAgdmFyIHdoZWVsU2FtcGxlcyA9IDAsIHdoZWVsUGl4ZWxzUGVyVW5pdCA9IG51bGw7XG4gIC8vIEZpbGwgaW4gYSBicm93c2VyLWRldGVjdGVkIHN0YXJ0aW5nIHZhbHVlIG9uIGJyb3dzZXJzIHdoZXJlIHdlXG4gIC8vIGtub3cgb25lLiBUaGVzZSBkb24ndCBoYXZlIHRvIGJlIGFjY3VyYXRlIC0tIHRoZSByZXN1bHQgb2YgdGhlbVxuICAvLyBiZWluZyB3cm9uZyB3b3VsZCBqdXN0IGJlIGEgc2xpZ2h0IGZsaWNrZXIgb24gdGhlIGZpcnN0IHdoZWVsXG4gIC8vIHNjcm9sbCAoaWYgaXQgaXMgbGFyZ2UgZW5vdWdoKS5cbiAgaWYgKGllKSB3aGVlbFBpeGVsc1BlclVuaXQgPSAtLjUzO1xuICBlbHNlIGlmIChnZWNrbykgd2hlZWxQaXhlbHNQZXJVbml0ID0gMTU7XG4gIGVsc2UgaWYgKGNocm9tZSkgd2hlZWxQaXhlbHNQZXJVbml0ID0gLS43O1xuICBlbHNlIGlmIChzYWZhcmkpIHdoZWVsUGl4ZWxzUGVyVW5pdCA9IC0xLzM7XG5cbiAgdmFyIHdoZWVsRXZlbnREZWx0YSA9IGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgZHggPSBlLndoZWVsRGVsdGFYLCBkeSA9IGUud2hlZWxEZWx0YVk7XG4gICAgaWYgKGR4ID09IG51bGwgJiYgZS5kZXRhaWwgJiYgZS5heGlzID09IGUuSE9SSVpPTlRBTF9BWElTKSBkeCA9IGUuZGV0YWlsO1xuICAgIGlmIChkeSA9PSBudWxsICYmIGUuZGV0YWlsICYmIGUuYXhpcyA9PSBlLlZFUlRJQ0FMX0FYSVMpIGR5ID0gZS5kZXRhaWw7XG4gICAgZWxzZSBpZiAoZHkgPT0gbnVsbCkgZHkgPSBlLndoZWVsRGVsdGE7XG4gICAgcmV0dXJuIHt4OiBkeCwgeTogZHl9O1xuICB9O1xuICBDb2RlTWlycm9yLndoZWVsRXZlbnRQaXhlbHMgPSBmdW5jdGlvbihlKSB7XG4gICAgdmFyIGRlbHRhID0gd2hlZWxFdmVudERlbHRhKGUpO1xuICAgIGRlbHRhLnggKj0gd2hlZWxQaXhlbHNQZXJVbml0O1xuICAgIGRlbHRhLnkgKj0gd2hlZWxQaXhlbHNQZXJVbml0O1xuICAgIHJldHVybiBkZWx0YTtcbiAgfTtcblxuICBmdW5jdGlvbiBvblNjcm9sbFdoZWVsKGNtLCBlKSB7XG4gICAgdmFyIGRlbHRhID0gd2hlZWxFdmVudERlbHRhKGUpLCBkeCA9IGRlbHRhLngsIGR5ID0gZGVsdGEueTtcblxuICAgIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheSwgc2Nyb2xsID0gZGlzcGxheS5zY3JvbGxlcjtcbiAgICAvLyBRdWl0IGlmIHRoZXJlJ3Mgbm90aGluZyB0byBzY3JvbGwgaGVyZVxuICAgIHZhciBjYW5TY3JvbGxYID0gc2Nyb2xsLnNjcm9sbFdpZHRoID4gc2Nyb2xsLmNsaWVudFdpZHRoO1xuICAgIHZhciBjYW5TY3JvbGxZID0gc2Nyb2xsLnNjcm9sbEhlaWdodCA+IHNjcm9sbC5jbGllbnRIZWlnaHQ7XG4gICAgaWYgKCEoZHggJiYgY2FuU2Nyb2xsWCB8fCBkeSAmJiBjYW5TY3JvbGxZKSkgcmV0dXJuO1xuXG4gICAgLy8gV2Via2l0IGJyb3dzZXJzIG9uIE9TIFggYWJvcnQgbW9tZW50dW0gc2Nyb2xscyB3aGVuIHRoZSB0YXJnZXRcbiAgICAvLyBvZiB0aGUgc2Nyb2xsIGV2ZW50IGlzIHJlbW92ZWQgZnJvbSB0aGUgc2Nyb2xsYWJsZSBlbGVtZW50LlxuICAgIC8vIFRoaXMgaGFjayAoc2VlIHJlbGF0ZWQgY29kZSBpbiBwYXRjaERpc3BsYXkpIG1ha2VzIHN1cmUgdGhlXG4gICAgLy8gZWxlbWVudCBpcyBrZXB0IGFyb3VuZC5cbiAgICBpZiAoZHkgJiYgbWFjICYmIHdlYmtpdCkge1xuICAgICAgb3V0ZXI6IGZvciAodmFyIGN1ciA9IGUudGFyZ2V0LCB2aWV3ID0gZGlzcGxheS52aWV3OyBjdXIgIT0gc2Nyb2xsOyBjdXIgPSBjdXIucGFyZW50Tm9kZSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZpZXcubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAodmlld1tpXS5ub2RlID09IGN1cikge1xuICAgICAgICAgICAgY20uZGlzcGxheS5jdXJyZW50V2hlZWxUYXJnZXQgPSBjdXI7XG4gICAgICAgICAgICBicmVhayBvdXRlcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPbiBzb21lIGJyb3dzZXJzLCBob3Jpem9udGFsIHNjcm9sbGluZyB3aWxsIGNhdXNlIHJlZHJhd3MgdG9cbiAgICAvLyBoYXBwZW4gYmVmb3JlIHRoZSBndXR0ZXIgaGFzIGJlZW4gcmVhbGlnbmVkLCBjYXVzaW5nIGl0IHRvXG4gICAgLy8gd3JpZ2dsZSBhcm91bmQgaW4gYSBtb3N0IHVuc2VlbWx5IHdheS4gV2hlbiB3ZSBoYXZlIGFuXG4gICAgLy8gZXN0aW1hdGVkIHBpeGVscy9kZWx0YSB2YWx1ZSwgd2UganVzdCBoYW5kbGUgaG9yaXpvbnRhbFxuICAgIC8vIHNjcm9sbGluZyBlbnRpcmVseSBoZXJlLiBJdCdsbCBiZSBzbGlnaHRseSBvZmYgZnJvbSBuYXRpdmUsIGJ1dFxuICAgIC8vIGJldHRlciB0aGFuIGdsaXRjaGluZyBvdXQuXG4gICAgaWYgKGR4ICYmICFnZWNrbyAmJiAhcHJlc3RvICYmIHdoZWVsUGl4ZWxzUGVyVW5pdCAhPSBudWxsKSB7XG4gICAgICBpZiAoZHkgJiYgY2FuU2Nyb2xsWSlcbiAgICAgICAgc2V0U2Nyb2xsVG9wKGNtLCBNYXRoLm1heCgwLCBNYXRoLm1pbihzY3JvbGwuc2Nyb2xsVG9wICsgZHkgKiB3aGVlbFBpeGVsc1BlclVuaXQsIHNjcm9sbC5zY3JvbGxIZWlnaHQgLSBzY3JvbGwuY2xpZW50SGVpZ2h0KSkpO1xuICAgICAgc2V0U2Nyb2xsTGVmdChjbSwgTWF0aC5tYXgoMCwgTWF0aC5taW4oc2Nyb2xsLnNjcm9sbExlZnQgKyBkeCAqIHdoZWVsUGl4ZWxzUGVyVW5pdCwgc2Nyb2xsLnNjcm9sbFdpZHRoIC0gc2Nyb2xsLmNsaWVudFdpZHRoKSkpO1xuICAgICAgLy8gT25seSBwcmV2ZW50IGRlZmF1bHQgc2Nyb2xsaW5nIGlmIHZlcnRpY2FsIHNjcm9sbGluZyBpc1xuICAgICAgLy8gYWN0dWFsbHkgcG9zc2libGUuIE90aGVyd2lzZSwgaXQgY2F1c2VzIHZlcnRpY2FsIHNjcm9sbFxuICAgICAgLy8gaml0dGVyIG9uIE9TWCB0cmFja3BhZHMgd2hlbiBkZWx0YVggaXMgc21hbGwgYW5kIGRlbHRhWVxuICAgICAgLy8gaXMgbGFyZ2UgKGlzc3VlICMzNTc5KVxuICAgICAgaWYgKCFkeSB8fCAoZHkgJiYgY2FuU2Nyb2xsWSkpXG4gICAgICAgIGVfcHJldmVudERlZmF1bHQoZSk7XG4gICAgICBkaXNwbGF5LndoZWVsU3RhcnRYID0gbnVsbDsgLy8gQWJvcnQgbWVhc3VyZW1lbnQsIGlmIGluIHByb2dyZXNzXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gJ1Byb2plY3QnIHRoZSB2aXNpYmxlIHZpZXdwb3J0IHRvIGNvdmVyIHRoZSBhcmVhIHRoYXQgaXMgYmVpbmdcbiAgICAvLyBzY3JvbGxlZCBpbnRvIHZpZXcgKGlmIHdlIGtub3cgZW5vdWdoIHRvIGVzdGltYXRlIGl0KS5cbiAgICBpZiAoZHkgJiYgd2hlZWxQaXhlbHNQZXJVbml0ICE9IG51bGwpIHtcbiAgICAgIHZhciBwaXhlbHMgPSBkeSAqIHdoZWVsUGl4ZWxzUGVyVW5pdDtcbiAgICAgIHZhciB0b3AgPSBjbS5kb2Muc2Nyb2xsVG9wLCBib3QgPSB0b3AgKyBkaXNwbGF5LndyYXBwZXIuY2xpZW50SGVpZ2h0O1xuICAgICAgaWYgKHBpeGVscyA8IDApIHRvcCA9IE1hdGgubWF4KDAsIHRvcCArIHBpeGVscyAtIDUwKTtcbiAgICAgIGVsc2UgYm90ID0gTWF0aC5taW4oY20uZG9jLmhlaWdodCwgYm90ICsgcGl4ZWxzICsgNTApO1xuICAgICAgdXBkYXRlRGlzcGxheVNpbXBsZShjbSwge3RvcDogdG9wLCBib3R0b206IGJvdH0pO1xuICAgIH1cblxuICAgIGlmICh3aGVlbFNhbXBsZXMgPCAyMCkge1xuICAgICAgaWYgKGRpc3BsYXkud2hlZWxTdGFydFggPT0gbnVsbCkge1xuICAgICAgICBkaXNwbGF5LndoZWVsU3RhcnRYID0gc2Nyb2xsLnNjcm9sbExlZnQ7IGRpc3BsYXkud2hlZWxTdGFydFkgPSBzY3JvbGwuc2Nyb2xsVG9wO1xuICAgICAgICBkaXNwbGF5LndoZWVsRFggPSBkeDsgZGlzcGxheS53aGVlbERZID0gZHk7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKGRpc3BsYXkud2hlZWxTdGFydFggPT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICAgIHZhciBtb3ZlZFggPSBzY3JvbGwuc2Nyb2xsTGVmdCAtIGRpc3BsYXkud2hlZWxTdGFydFg7XG4gICAgICAgICAgdmFyIG1vdmVkWSA9IHNjcm9sbC5zY3JvbGxUb3AgLSBkaXNwbGF5LndoZWVsU3RhcnRZO1xuICAgICAgICAgIHZhciBzYW1wbGUgPSAobW92ZWRZICYmIGRpc3BsYXkud2hlZWxEWSAmJiBtb3ZlZFkgLyBkaXNwbGF5LndoZWVsRFkpIHx8XG4gICAgICAgICAgICAobW92ZWRYICYmIGRpc3BsYXkud2hlZWxEWCAmJiBtb3ZlZFggLyBkaXNwbGF5LndoZWVsRFgpO1xuICAgICAgICAgIGRpc3BsYXkud2hlZWxTdGFydFggPSBkaXNwbGF5LndoZWVsU3RhcnRZID0gbnVsbDtcbiAgICAgICAgICBpZiAoIXNhbXBsZSkgcmV0dXJuO1xuICAgICAgICAgIHdoZWVsUGl4ZWxzUGVyVW5pdCA9ICh3aGVlbFBpeGVsc1BlclVuaXQgKiB3aGVlbFNhbXBsZXMgKyBzYW1wbGUpIC8gKHdoZWVsU2FtcGxlcyArIDEpO1xuICAgICAgICAgICsrd2hlZWxTYW1wbGVzO1xuICAgICAgICB9LCAyMDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGlzcGxheS53aGVlbERYICs9IGR4OyBkaXNwbGF5LndoZWVsRFkgKz0gZHk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gS0VZIEVWRU5UU1xuXG4gIC8vIFJ1biBhIGhhbmRsZXIgdGhhdCB3YXMgYm91bmQgdG8gYSBrZXkuXG4gIGZ1bmN0aW9uIGRvSGFuZGxlQmluZGluZyhjbSwgYm91bmQsIGRyb3BTaGlmdCkge1xuICAgIGlmICh0eXBlb2YgYm91bmQgPT0gXCJzdHJpbmdcIikge1xuICAgICAgYm91bmQgPSBjb21tYW5kc1tib3VuZF07XG4gICAgICBpZiAoIWJvdW5kKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIEVuc3VyZSBwcmV2aW91cyBpbnB1dCBoYXMgYmVlbiByZWFkLCBzbyB0aGF0IHRoZSBoYW5kbGVyIHNlZXMgYVxuICAgIC8vIGNvbnNpc3RlbnQgdmlldyBvZiB0aGUgZG9jdW1lbnRcbiAgICBjbS5kaXNwbGF5LmlucHV0LmVuc3VyZVBvbGxlZCgpO1xuICAgIHZhciBwcmV2U2hpZnQgPSBjbS5kaXNwbGF5LnNoaWZ0LCBkb25lID0gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChpc1JlYWRPbmx5KGNtKSkgY20uc3RhdGUuc3VwcHJlc3NFZGl0cyA9IHRydWU7XG4gICAgICBpZiAoZHJvcFNoaWZ0KSBjbS5kaXNwbGF5LnNoaWZ0ID0gZmFsc2U7XG4gICAgICBkb25lID0gYm91bmQoY20pICE9IFBhc3M7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGNtLmRpc3BsYXkuc2hpZnQgPSBwcmV2U2hpZnQ7XG4gICAgICBjbS5zdGF0ZS5zdXBwcmVzc0VkaXRzID0gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBkb25lO1xuICB9XG5cbiAgZnVuY3Rpb24gbG9va3VwS2V5Rm9yRWRpdG9yKGNtLCBuYW1lLCBoYW5kbGUpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNtLnN0YXRlLmtleU1hcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZXN1bHQgPSBsb29rdXBLZXkobmFtZSwgY20uc3RhdGUua2V5TWFwc1tpXSwgaGFuZGxlLCBjbSk7XG4gICAgICBpZiAocmVzdWx0KSByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICByZXR1cm4gKGNtLm9wdGlvbnMuZXh0cmFLZXlzICYmIGxvb2t1cEtleShuYW1lLCBjbS5vcHRpb25zLmV4dHJhS2V5cywgaGFuZGxlLCBjbSkpXG4gICAgICB8fCBsb29rdXBLZXkobmFtZSwgY20ub3B0aW9ucy5rZXlNYXAsIGhhbmRsZSwgY20pO1xuICB9XG5cbiAgdmFyIHN0b3BTZXEgPSBuZXcgRGVsYXllZDtcbiAgZnVuY3Rpb24gZGlzcGF0Y2hLZXkoY20sIG5hbWUsIGUsIGhhbmRsZSkge1xuICAgIHZhciBzZXEgPSBjbS5zdGF0ZS5rZXlTZXE7XG4gICAgaWYgKHNlcSkge1xuICAgICAgaWYgKGlzTW9kaWZpZXJLZXkobmFtZSkpIHJldHVybiBcImhhbmRsZWRcIjtcbiAgICAgIHN0b3BTZXEuc2V0KDUwLCBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGNtLnN0YXRlLmtleVNlcSA9PSBzZXEpIHtcbiAgICAgICAgICBjbS5zdGF0ZS5rZXlTZXEgPSBudWxsO1xuICAgICAgICAgIGNtLmRpc3BsYXkuaW5wdXQucmVzZXQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBuYW1lID0gc2VxICsgXCIgXCIgKyBuYW1lO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gbG9va3VwS2V5Rm9yRWRpdG9yKGNtLCBuYW1lLCBoYW5kbGUpO1xuXG4gICAgaWYgKHJlc3VsdCA9PSBcIm11bHRpXCIpXG4gICAgICBjbS5zdGF0ZS5rZXlTZXEgPSBuYW1lO1xuICAgIGlmIChyZXN1bHQgPT0gXCJoYW5kbGVkXCIpXG4gICAgICBzaWduYWxMYXRlcihjbSwgXCJrZXlIYW5kbGVkXCIsIGNtLCBuYW1lLCBlKTtcblxuICAgIGlmIChyZXN1bHQgPT0gXCJoYW5kbGVkXCIgfHwgcmVzdWx0ID09IFwibXVsdGlcIikge1xuICAgICAgZV9wcmV2ZW50RGVmYXVsdChlKTtcbiAgICAgIHJlc3RhcnRCbGluayhjbSk7XG4gICAgfVxuXG4gICAgaWYgKHNlcSAmJiAhcmVzdWx0ICYmIC9cXCckLy50ZXN0KG5hbWUpKSB7XG4gICAgICBlX3ByZXZlbnREZWZhdWx0KGUpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiAhIXJlc3VsdDtcbiAgfVxuXG4gIC8vIEhhbmRsZSBhIGtleSBmcm9tIHRoZSBrZXlkb3duIGV2ZW50LlxuICBmdW5jdGlvbiBoYW5kbGVLZXlCaW5kaW5nKGNtLCBlKSB7XG4gICAgdmFyIG5hbWUgPSBrZXlOYW1lKGUsIHRydWUpO1xuICAgIGlmICghbmFtZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKGUuc2hpZnRLZXkgJiYgIWNtLnN0YXRlLmtleVNlcSkge1xuICAgICAgLy8gRmlyc3QgdHJ5IHRvIHJlc29sdmUgZnVsbCBuYW1lIChpbmNsdWRpbmcgJ1NoaWZ0LScpLiBGYWlsaW5nXG4gICAgICAvLyB0aGF0LCBzZWUgaWYgdGhlcmUgaXMgYSBjdXJzb3ItbW90aW9uIGNvbW1hbmQgKHN0YXJ0aW5nIHdpdGhcbiAgICAgIC8vICdnbycpIGJvdW5kIHRvIHRoZSBrZXluYW1lIHdpdGhvdXQgJ1NoaWZ0LScuXG4gICAgICByZXR1cm4gZGlzcGF0Y2hLZXkoY20sIFwiU2hpZnQtXCIgKyBuYW1lLCBlLCBmdW5jdGlvbihiKSB7cmV0dXJuIGRvSGFuZGxlQmluZGluZyhjbSwgYiwgdHJ1ZSk7fSlcbiAgICAgICAgICB8fCBkaXNwYXRjaEtleShjbSwgbmFtZSwgZSwgZnVuY3Rpb24oYikge1xuICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBiID09IFwic3RyaW5nXCIgPyAvXmdvW0EtWl0vLnRlc3QoYikgOiBiLm1vdGlvbilcbiAgICAgICAgICAgICAgICAgcmV0dXJuIGRvSGFuZGxlQmluZGluZyhjbSwgYik7XG4gICAgICAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBkaXNwYXRjaEtleShjbSwgbmFtZSwgZSwgZnVuY3Rpb24oYikgeyByZXR1cm4gZG9IYW5kbGVCaW5kaW5nKGNtLCBiKTsgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gSGFuZGxlIGEga2V5IGZyb20gdGhlIGtleXByZXNzIGV2ZW50XG4gIGZ1bmN0aW9uIGhhbmRsZUNoYXJCaW5kaW5nKGNtLCBlLCBjaCkge1xuICAgIHJldHVybiBkaXNwYXRjaEtleShjbSwgXCInXCIgKyBjaCArIFwiJ1wiLCBlLFxuICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbihiKSB7IHJldHVybiBkb0hhbmRsZUJpbmRpbmcoY20sIGIsIHRydWUpOyB9KTtcbiAgfVxuXG4gIHZhciBsYXN0U3RvcHBlZEtleSA9IG51bGw7XG4gIGZ1bmN0aW9uIG9uS2V5RG93bihlKSB7XG4gICAgdmFyIGNtID0gdGhpcztcbiAgICBjbS5jdXJPcC5mb2N1cyA9IGFjdGl2ZUVsdCgpO1xuICAgIGlmIChzaWduYWxET01FdmVudChjbSwgZSkpIHJldHVybjtcbiAgICAvLyBJRSBkb2VzIHN0cmFuZ2UgdGhpbmdzIHdpdGggZXNjYXBlLlxuICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgMTEgJiYgZS5rZXlDb2RlID09IDI3KSBlLnJldHVyblZhbHVlID0gZmFsc2U7XG4gICAgdmFyIGNvZGUgPSBlLmtleUNvZGU7XG4gICAgY20uZGlzcGxheS5zaGlmdCA9IGNvZGUgPT0gMTYgfHwgZS5zaGlmdEtleTtcbiAgICB2YXIgaGFuZGxlZCA9IGhhbmRsZUtleUJpbmRpbmcoY20sIGUpO1xuICAgIGlmIChwcmVzdG8pIHtcbiAgICAgIGxhc3RTdG9wcGVkS2V5ID0gaGFuZGxlZCA/IGNvZGUgOiBudWxsO1xuICAgICAgLy8gT3BlcmEgaGFzIG5vIGN1dCBldmVudC4uLiB3ZSB0cnkgdG8gYXQgbGVhc3QgY2F0Y2ggdGhlIGtleSBjb21ib1xuICAgICAgaWYgKCFoYW5kbGVkICYmIGNvZGUgPT0gODggJiYgIWhhc0NvcHlFdmVudCAmJiAobWFjID8gZS5tZXRhS2V5IDogZS5jdHJsS2V5KSlcbiAgICAgICAgY20ucmVwbGFjZVNlbGVjdGlvbihcIlwiLCBudWxsLCBcImN1dFwiKTtcbiAgICB9XG5cbiAgICAvLyBUdXJuIG1vdXNlIGludG8gY3Jvc3NoYWlyIHdoZW4gQWx0IGlzIGhlbGQgb24gTWFjLlxuICAgIGlmIChjb2RlID09IDE4ICYmICEvXFxiQ29kZU1pcnJvci1jcm9zc2hhaXJcXGIvLnRlc3QoY20uZGlzcGxheS5saW5lRGl2LmNsYXNzTmFtZSkpXG4gICAgICBzaG93Q3Jvc3NIYWlyKGNtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNob3dDcm9zc0hhaXIoY20pIHtcbiAgICB2YXIgbGluZURpdiA9IGNtLmRpc3BsYXkubGluZURpdjtcbiAgICBhZGRDbGFzcyhsaW5lRGl2LCBcIkNvZGVNaXJyb3ItY3Jvc3NoYWlyXCIpO1xuXG4gICAgZnVuY3Rpb24gdXAoZSkge1xuICAgICAgaWYgKGUua2V5Q29kZSA9PSAxOCB8fCAhZS5hbHRLZXkpIHtcbiAgICAgICAgcm1DbGFzcyhsaW5lRGl2LCBcIkNvZGVNaXJyb3ItY3Jvc3NoYWlyXCIpO1xuICAgICAgICBvZmYoZG9jdW1lbnQsIFwia2V5dXBcIiwgdXApO1xuICAgICAgICBvZmYoZG9jdW1lbnQsIFwibW91c2VvdmVyXCIsIHVwKTtcbiAgICAgIH1cbiAgICB9XG4gICAgb24oZG9jdW1lbnQsIFwia2V5dXBcIiwgdXApO1xuICAgIG9uKGRvY3VtZW50LCBcIm1vdXNlb3ZlclwiLCB1cCk7XG4gIH1cblxuICBmdW5jdGlvbiBvbktleVVwKGUpIHtcbiAgICBpZiAoZS5rZXlDb2RlID09IDE2KSB0aGlzLmRvYy5zZWwuc2hpZnQgPSBmYWxzZTtcbiAgICBzaWduYWxET01FdmVudCh0aGlzLCBlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uS2V5UHJlc3MoZSkge1xuICAgIHZhciBjbSA9IHRoaXM7XG4gICAgaWYgKGV2ZW50SW5XaWRnZXQoY20uZGlzcGxheSwgZSkgfHwgc2lnbmFsRE9NRXZlbnQoY20sIGUpIHx8IGUuY3RybEtleSAmJiAhZS5hbHRLZXkgfHwgbWFjICYmIGUubWV0YUtleSkgcmV0dXJuO1xuICAgIHZhciBrZXlDb2RlID0gZS5rZXlDb2RlLCBjaGFyQ29kZSA9IGUuY2hhckNvZGU7XG4gICAgaWYgKHByZXN0byAmJiBrZXlDb2RlID09IGxhc3RTdG9wcGVkS2V5KSB7bGFzdFN0b3BwZWRLZXkgPSBudWxsOyBlX3ByZXZlbnREZWZhdWx0KGUpOyByZXR1cm47fVxuICAgIGlmICgocHJlc3RvICYmICghZS53aGljaCB8fCBlLndoaWNoIDwgMTApKSAmJiBoYW5kbGVLZXlCaW5kaW5nKGNtLCBlKSkgcmV0dXJuO1xuICAgIHZhciBjaCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoY2hhckNvZGUgPT0gbnVsbCA/IGtleUNvZGUgOiBjaGFyQ29kZSk7XG4gICAgaWYgKGhhbmRsZUNoYXJCaW5kaW5nKGNtLCBlLCBjaCkpIHJldHVybjtcbiAgICBjbS5kaXNwbGF5LmlucHV0Lm9uS2V5UHJlc3MoZSk7XG4gIH1cblxuICAvLyBGT0NVUy9CTFVSIEVWRU5UU1xuXG4gIGZ1bmN0aW9uIGRlbGF5Qmx1ckV2ZW50KGNtKSB7XG4gICAgY20uc3RhdGUuZGVsYXlpbmdCbHVyRXZlbnQgPSB0cnVlO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoY20uc3RhdGUuZGVsYXlpbmdCbHVyRXZlbnQpIHtcbiAgICAgICAgY20uc3RhdGUuZGVsYXlpbmdCbHVyRXZlbnQgPSBmYWxzZTtcbiAgICAgICAgb25CbHVyKGNtKTtcbiAgICAgIH1cbiAgICB9LCAxMDApO1xuICB9XG5cbiAgZnVuY3Rpb24gb25Gb2N1cyhjbSkge1xuICAgIGlmIChjbS5zdGF0ZS5kZWxheWluZ0JsdXJFdmVudCkgY20uc3RhdGUuZGVsYXlpbmdCbHVyRXZlbnQgPSBmYWxzZTtcblxuICAgIGlmIChjbS5vcHRpb25zLnJlYWRPbmx5ID09IFwibm9jdXJzb3JcIikgcmV0dXJuO1xuICAgIGlmICghY20uc3RhdGUuZm9jdXNlZCkge1xuICAgICAgc2lnbmFsKGNtLCBcImZvY3VzXCIsIGNtKTtcbiAgICAgIGNtLnN0YXRlLmZvY3VzZWQgPSB0cnVlO1xuICAgICAgYWRkQ2xhc3MoY20uZGlzcGxheS53cmFwcGVyLCBcIkNvZGVNaXJyb3ItZm9jdXNlZFwiKTtcbiAgICAgIC8vIFRoaXMgdGVzdCBwcmV2ZW50cyB0aGlzIGZyb20gZmlyaW5nIHdoZW4gYSBjb250ZXh0XG4gICAgICAvLyBtZW51IGlzIGNsb3NlZCAoc2luY2UgdGhlIGlucHV0IHJlc2V0IHdvdWxkIGtpbGwgdGhlXG4gICAgICAvLyBzZWxlY3QtYWxsIGRldGVjdGlvbiBoYWNrKVxuICAgICAgaWYgKCFjbS5jdXJPcCAmJiBjbS5kaXNwbGF5LnNlbEZvckNvbnRleHRNZW51ICE9IGNtLmRvYy5zZWwpIHtcbiAgICAgICAgY20uZGlzcGxheS5pbnB1dC5yZXNldCgpO1xuICAgICAgICBpZiAod2Via2l0KSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBjbS5kaXNwbGF5LmlucHV0LnJlc2V0KHRydWUpOyB9LCAyMCk7IC8vIElzc3VlICMxNzMwXG4gICAgICB9XG4gICAgICBjbS5kaXNwbGF5LmlucHV0LnJlY2VpdmVkRm9jdXMoKTtcbiAgICB9XG4gICAgcmVzdGFydEJsaW5rKGNtKTtcbiAgfVxuICBmdW5jdGlvbiBvbkJsdXIoY20pIHtcbiAgICBpZiAoY20uc3RhdGUuZGVsYXlpbmdCbHVyRXZlbnQpIHJldHVybjtcblxuICAgIGlmIChjbS5zdGF0ZS5mb2N1c2VkKSB7XG4gICAgICBzaWduYWwoY20sIFwiYmx1clwiLCBjbSk7XG4gICAgICBjbS5zdGF0ZS5mb2N1c2VkID0gZmFsc2U7XG4gICAgICBybUNsYXNzKGNtLmRpc3BsYXkud3JhcHBlciwgXCJDb2RlTWlycm9yLWZvY3VzZWRcIik7XG4gICAgfVxuICAgIGNsZWFySW50ZXJ2YWwoY20uZGlzcGxheS5ibGlua2VyKTtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge2lmICghY20uc3RhdGUuZm9jdXNlZCkgY20uZGlzcGxheS5zaGlmdCA9IGZhbHNlO30sIDE1MCk7XG4gIH1cblxuICAvLyBDT05URVhUIE1FTlUgSEFORExJTkdcblxuICAvLyBUbyBtYWtlIHRoZSBjb250ZXh0IG1lbnUgd29yaywgd2UgbmVlZCB0byBicmllZmx5IHVuaGlkZSB0aGVcbiAgLy8gdGV4dGFyZWEgKG1ha2luZyBpdCBhcyB1bm9idHJ1c2l2ZSBhcyBwb3NzaWJsZSkgdG8gbGV0IHRoZVxuICAvLyByaWdodC1jbGljayB0YWtlIGVmZmVjdCBvbiBpdC5cbiAgZnVuY3Rpb24gb25Db250ZXh0TWVudShjbSwgZSkge1xuICAgIGlmIChldmVudEluV2lkZ2V0KGNtLmRpc3BsYXksIGUpIHx8IGNvbnRleHRNZW51SW5HdXR0ZXIoY20sIGUpKSByZXR1cm47XG4gICAgaWYgKHNpZ25hbERPTUV2ZW50KGNtLCBlLCBcImNvbnRleHRtZW51XCIpKSByZXR1cm47XG4gICAgY20uZGlzcGxheS5pbnB1dC5vbkNvbnRleHRNZW51KGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY29udGV4dE1lbnVJbkd1dHRlcihjbSwgZSkge1xuICAgIGlmICghaGFzSGFuZGxlcihjbSwgXCJndXR0ZXJDb250ZXh0TWVudVwiKSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiBndXR0ZXJFdmVudChjbSwgZSwgXCJndXR0ZXJDb250ZXh0TWVudVwiLCBmYWxzZSk7XG4gIH1cblxuICAvLyBVUERBVElOR1xuXG4gIC8vIENvbXB1dGUgdGhlIHBvc2l0aW9uIG9mIHRoZSBlbmQgb2YgYSBjaGFuZ2UgKGl0cyAndG8nIHByb3BlcnR5XG4gIC8vIHJlZmVycyB0byB0aGUgcHJlLWNoYW5nZSBlbmQpLlxuICB2YXIgY2hhbmdlRW5kID0gQ29kZU1pcnJvci5jaGFuZ2VFbmQgPSBmdW5jdGlvbihjaGFuZ2UpIHtcbiAgICBpZiAoIWNoYW5nZS50ZXh0KSByZXR1cm4gY2hhbmdlLnRvO1xuICAgIHJldHVybiBQb3MoY2hhbmdlLmZyb20ubGluZSArIGNoYW5nZS50ZXh0Lmxlbmd0aCAtIDEsXG4gICAgICAgICAgICAgICBsc3QoY2hhbmdlLnRleHQpLmxlbmd0aCArIChjaGFuZ2UudGV4dC5sZW5ndGggPT0gMSA/IGNoYW5nZS5mcm9tLmNoIDogMCkpO1xuICB9O1xuXG4gIC8vIEFkanVzdCBhIHBvc2l0aW9uIHRvIHJlZmVyIHRvIHRoZSBwb3N0LWNoYW5nZSBwb3NpdGlvbiBvZiB0aGVcbiAgLy8gc2FtZSB0ZXh0LCBvciB0aGUgZW5kIG9mIHRoZSBjaGFuZ2UgaWYgdGhlIGNoYW5nZSBjb3ZlcnMgaXQuXG4gIGZ1bmN0aW9uIGFkanVzdEZvckNoYW5nZShwb3MsIGNoYW5nZSkge1xuICAgIGlmIChjbXAocG9zLCBjaGFuZ2UuZnJvbSkgPCAwKSByZXR1cm4gcG9zO1xuICAgIGlmIChjbXAocG9zLCBjaGFuZ2UudG8pIDw9IDApIHJldHVybiBjaGFuZ2VFbmQoY2hhbmdlKTtcblxuICAgIHZhciBsaW5lID0gcG9zLmxpbmUgKyBjaGFuZ2UudGV4dC5sZW5ndGggLSAoY2hhbmdlLnRvLmxpbmUgLSBjaGFuZ2UuZnJvbS5saW5lKSAtIDEsIGNoID0gcG9zLmNoO1xuICAgIGlmIChwb3MubGluZSA9PSBjaGFuZ2UudG8ubGluZSkgY2ggKz0gY2hhbmdlRW5kKGNoYW5nZSkuY2ggLSBjaGFuZ2UudG8uY2g7XG4gICAgcmV0dXJuIFBvcyhsaW5lLCBjaCk7XG4gIH1cblxuICBmdW5jdGlvbiBjb21wdXRlU2VsQWZ0ZXJDaGFuZ2UoZG9jLCBjaGFuZ2UpIHtcbiAgICB2YXIgb3V0ID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkb2Muc2VsLnJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJhbmdlID0gZG9jLnNlbC5yYW5nZXNbaV07XG4gICAgICBvdXQucHVzaChuZXcgUmFuZ2UoYWRqdXN0Rm9yQ2hhbmdlKHJhbmdlLmFuY2hvciwgY2hhbmdlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICBhZGp1c3RGb3JDaGFuZ2UocmFuZ2UuaGVhZCwgY2hhbmdlKSkpO1xuICAgIH1cbiAgICByZXR1cm4gbm9ybWFsaXplU2VsZWN0aW9uKG91dCwgZG9jLnNlbC5wcmltSW5kZXgpO1xuICB9XG5cbiAgZnVuY3Rpb24gb2Zmc2V0UG9zKHBvcywgb2xkLCBudykge1xuICAgIGlmIChwb3MubGluZSA9PSBvbGQubGluZSlcbiAgICAgIHJldHVybiBQb3MobncubGluZSwgcG9zLmNoIC0gb2xkLmNoICsgbncuY2gpO1xuICAgIGVsc2VcbiAgICAgIHJldHVybiBQb3MobncubGluZSArIChwb3MubGluZSAtIG9sZC5saW5lKSwgcG9zLmNoKTtcbiAgfVxuXG4gIC8vIFVzZWQgYnkgcmVwbGFjZVNlbGVjdGlvbnMgdG8gYWxsb3cgbW92aW5nIHRoZSBzZWxlY3Rpb24gdG8gdGhlXG4gIC8vIHN0YXJ0IG9yIGFyb3VuZCB0aGUgcmVwbGFjZWQgdGVzdC4gSGludCBtYXkgYmUgXCJzdGFydFwiIG9yIFwiYXJvdW5kXCIuXG4gIGZ1bmN0aW9uIGNvbXB1dGVSZXBsYWNlZFNlbChkb2MsIGNoYW5nZXMsIGhpbnQpIHtcbiAgICB2YXIgb3V0ID0gW107XG4gICAgdmFyIG9sZFByZXYgPSBQb3MoZG9jLmZpcnN0LCAwKSwgbmV3UHJldiA9IG9sZFByZXY7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY2hhbmdlID0gY2hhbmdlc1tpXTtcbiAgICAgIHZhciBmcm9tID0gb2Zmc2V0UG9zKGNoYW5nZS5mcm9tLCBvbGRQcmV2LCBuZXdQcmV2KTtcbiAgICAgIHZhciB0byA9IG9mZnNldFBvcyhjaGFuZ2VFbmQoY2hhbmdlKSwgb2xkUHJldiwgbmV3UHJldik7XG4gICAgICBvbGRQcmV2ID0gY2hhbmdlLnRvO1xuICAgICAgbmV3UHJldiA9IHRvO1xuICAgICAgaWYgKGhpbnQgPT0gXCJhcm91bmRcIikge1xuICAgICAgICB2YXIgcmFuZ2UgPSBkb2Muc2VsLnJhbmdlc1tpXSwgaW52ID0gY21wKHJhbmdlLmhlYWQsIHJhbmdlLmFuY2hvcikgPCAwO1xuICAgICAgICBvdXRbaV0gPSBuZXcgUmFuZ2UoaW52ID8gdG8gOiBmcm9tLCBpbnYgPyBmcm9tIDogdG8pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0W2ldID0gbmV3IFJhbmdlKGZyb20sIGZyb20pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IFNlbGVjdGlvbihvdXQsIGRvYy5zZWwucHJpbUluZGV4KTtcbiAgfVxuXG4gIC8vIEFsbG93IFwiYmVmb3JlQ2hhbmdlXCIgZXZlbnQgaGFuZGxlcnMgdG8gaW5mbHVlbmNlIGEgY2hhbmdlXG4gIGZ1bmN0aW9uIGZpbHRlckNoYW5nZShkb2MsIGNoYW5nZSwgdXBkYXRlKSB7XG4gICAgdmFyIG9iaiA9IHtcbiAgICAgIGNhbmNlbGVkOiBmYWxzZSxcbiAgICAgIGZyb206IGNoYW5nZS5mcm9tLFxuICAgICAgdG86IGNoYW5nZS50byxcbiAgICAgIHRleHQ6IGNoYW5nZS50ZXh0LFxuICAgICAgb3JpZ2luOiBjaGFuZ2Uub3JpZ2luLFxuICAgICAgY2FuY2VsOiBmdW5jdGlvbigpIHsgdGhpcy5jYW5jZWxlZCA9IHRydWU7IH1cbiAgICB9O1xuICAgIGlmICh1cGRhdGUpIG9iai51cGRhdGUgPSBmdW5jdGlvbihmcm9tLCB0bywgdGV4dCwgb3JpZ2luKSB7XG4gICAgICBpZiAoZnJvbSkgdGhpcy5mcm9tID0gY2xpcFBvcyhkb2MsIGZyb20pO1xuICAgICAgaWYgKHRvKSB0aGlzLnRvID0gY2xpcFBvcyhkb2MsIHRvKTtcbiAgICAgIGlmICh0ZXh0KSB0aGlzLnRleHQgPSB0ZXh0O1xuICAgICAgaWYgKG9yaWdpbiAhPT0gdW5kZWZpbmVkKSB0aGlzLm9yaWdpbiA9IG9yaWdpbjtcbiAgICB9O1xuICAgIHNpZ25hbChkb2MsIFwiYmVmb3JlQ2hhbmdlXCIsIGRvYywgb2JqKTtcbiAgICBpZiAoZG9jLmNtKSBzaWduYWwoZG9jLmNtLCBcImJlZm9yZUNoYW5nZVwiLCBkb2MuY20sIG9iaik7XG5cbiAgICBpZiAob2JqLmNhbmNlbGVkKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4ge2Zyb206IG9iai5mcm9tLCB0bzogb2JqLnRvLCB0ZXh0OiBvYmoudGV4dCwgb3JpZ2luOiBvYmoub3JpZ2lufTtcbiAgfVxuXG4gIC8vIEFwcGx5IGEgY2hhbmdlIHRvIGEgZG9jdW1lbnQsIGFuZCBhZGQgaXQgdG8gdGhlIGRvY3VtZW50J3NcbiAgLy8gaGlzdG9yeSwgYW5kIHByb3BhZ2F0aW5nIGl0IHRvIGFsbCBsaW5rZWQgZG9jdW1lbnRzLlxuICBmdW5jdGlvbiBtYWtlQ2hhbmdlKGRvYywgY2hhbmdlLCBpZ25vcmVSZWFkT25seSkge1xuICAgIGlmIChkb2MuY20pIHtcbiAgICAgIGlmICghZG9jLmNtLmN1ck9wKSByZXR1cm4gb3BlcmF0aW9uKGRvYy5jbSwgbWFrZUNoYW5nZSkoZG9jLCBjaGFuZ2UsIGlnbm9yZVJlYWRPbmx5KTtcbiAgICAgIGlmIChkb2MuY20uc3RhdGUuc3VwcHJlc3NFZGl0cykgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChoYXNIYW5kbGVyKGRvYywgXCJiZWZvcmVDaGFuZ2VcIikgfHwgZG9jLmNtICYmIGhhc0hhbmRsZXIoZG9jLmNtLCBcImJlZm9yZUNoYW5nZVwiKSkge1xuICAgICAgY2hhbmdlID0gZmlsdGVyQ2hhbmdlKGRvYywgY2hhbmdlLCB0cnVlKTtcbiAgICAgIGlmICghY2hhbmdlKSByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUG9zc2libHkgc3BsaXQgb3Igc3VwcHJlc3MgdGhlIHVwZGF0ZSBiYXNlZCBvbiB0aGUgcHJlc2VuY2VcbiAgICAvLyBvZiByZWFkLW9ubHkgc3BhbnMgaW4gaXRzIHJhbmdlLlxuICAgIHZhciBzcGxpdCA9IHNhd1JlYWRPbmx5U3BhbnMgJiYgIWlnbm9yZVJlYWRPbmx5ICYmIHJlbW92ZVJlYWRPbmx5UmFuZ2VzKGRvYywgY2hhbmdlLmZyb20sIGNoYW5nZS50byk7XG4gICAgaWYgKHNwbGl0KSB7XG4gICAgICBmb3IgKHZhciBpID0gc3BsaXQubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpXG4gICAgICAgIG1ha2VDaGFuZ2VJbm5lcihkb2MsIHtmcm9tOiBzcGxpdFtpXS5mcm9tLCB0bzogc3BsaXRbaV0udG8sIHRleHQ6IGkgPyBbXCJcIl0gOiBjaGFuZ2UudGV4dH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYWtlQ2hhbmdlSW5uZXIoZG9jLCBjaGFuZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1ha2VDaGFuZ2VJbm5lcihkb2MsIGNoYW5nZSkge1xuICAgIGlmIChjaGFuZ2UudGV4dC5sZW5ndGggPT0gMSAmJiBjaGFuZ2UudGV4dFswXSA9PSBcIlwiICYmIGNtcChjaGFuZ2UuZnJvbSwgY2hhbmdlLnRvKSA9PSAwKSByZXR1cm47XG4gICAgdmFyIHNlbEFmdGVyID0gY29tcHV0ZVNlbEFmdGVyQ2hhbmdlKGRvYywgY2hhbmdlKTtcbiAgICBhZGRDaGFuZ2VUb0hpc3RvcnkoZG9jLCBjaGFuZ2UsIHNlbEFmdGVyLCBkb2MuY20gPyBkb2MuY20uY3VyT3AuaWQgOiBOYU4pO1xuXG4gICAgbWFrZUNoYW5nZVNpbmdsZURvYyhkb2MsIGNoYW5nZSwgc2VsQWZ0ZXIsIHN0cmV0Y2hTcGFuc092ZXJDaGFuZ2UoZG9jLCBjaGFuZ2UpKTtcbiAgICB2YXIgcmViYXNlZCA9IFtdO1xuXG4gICAgbGlua2VkRG9jcyhkb2MsIGZ1bmN0aW9uKGRvYywgc2hhcmVkSGlzdCkge1xuICAgICAgaWYgKCFzaGFyZWRIaXN0ICYmIGluZGV4T2YocmViYXNlZCwgZG9jLmhpc3RvcnkpID09IC0xKSB7XG4gICAgICAgIHJlYmFzZUhpc3QoZG9jLmhpc3RvcnksIGNoYW5nZSk7XG4gICAgICAgIHJlYmFzZWQucHVzaChkb2MuaGlzdG9yeSk7XG4gICAgICB9XG4gICAgICBtYWtlQ2hhbmdlU2luZ2xlRG9jKGRvYywgY2hhbmdlLCBudWxsLCBzdHJldGNoU3BhbnNPdmVyQ2hhbmdlKGRvYywgY2hhbmdlKSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXZlcnQgYSBjaGFuZ2Ugc3RvcmVkIGluIGEgZG9jdW1lbnQncyBoaXN0b3J5LlxuICBmdW5jdGlvbiBtYWtlQ2hhbmdlRnJvbUhpc3RvcnkoZG9jLCB0eXBlLCBhbGxvd1NlbGVjdGlvbk9ubHkpIHtcbiAgICBpZiAoZG9jLmNtICYmIGRvYy5jbS5zdGF0ZS5zdXBwcmVzc0VkaXRzKSByZXR1cm47XG5cbiAgICB2YXIgaGlzdCA9IGRvYy5oaXN0b3J5LCBldmVudCwgc2VsQWZ0ZXIgPSBkb2Muc2VsO1xuICAgIHZhciBzb3VyY2UgPSB0eXBlID09IFwidW5kb1wiID8gaGlzdC5kb25lIDogaGlzdC51bmRvbmUsIGRlc3QgPSB0eXBlID09IFwidW5kb1wiID8gaGlzdC51bmRvbmUgOiBoaXN0LmRvbmU7XG5cbiAgICAvLyBWZXJpZnkgdGhhdCB0aGVyZSBpcyBhIHVzZWFibGUgZXZlbnQgKHNvIHRoYXQgY3RybC16IHdvbid0XG4gICAgLy8gbmVlZGxlc3NseSBjbGVhciBzZWxlY3Rpb24gZXZlbnRzKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc291cmNlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBldmVudCA9IHNvdXJjZVtpXTtcbiAgICAgIGlmIChhbGxvd1NlbGVjdGlvbk9ubHkgPyBldmVudC5yYW5nZXMgJiYgIWV2ZW50LmVxdWFscyhkb2Muc2VsKSA6ICFldmVudC5yYW5nZXMpXG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBpZiAoaSA9PSBzb3VyY2UubGVuZ3RoKSByZXR1cm47XG4gICAgaGlzdC5sYXN0T3JpZ2luID0gaGlzdC5sYXN0U2VsT3JpZ2luID0gbnVsbDtcblxuICAgIGZvciAoOzspIHtcbiAgICAgIGV2ZW50ID0gc291cmNlLnBvcCgpO1xuICAgICAgaWYgKGV2ZW50LnJhbmdlcykge1xuICAgICAgICBwdXNoU2VsZWN0aW9uVG9IaXN0b3J5KGV2ZW50LCBkZXN0KTtcbiAgICAgICAgaWYgKGFsbG93U2VsZWN0aW9uT25seSAmJiAhZXZlbnQuZXF1YWxzKGRvYy5zZWwpKSB7XG4gICAgICAgICAgc2V0U2VsZWN0aW9uKGRvYywgZXZlbnQsIHtjbGVhclJlZG86IGZhbHNlfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNlbEFmdGVyID0gZXZlbnQ7XG4gICAgICB9XG4gICAgICBlbHNlIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIEJ1aWxkIHVwIGEgcmV2ZXJzZSBjaGFuZ2Ugb2JqZWN0IHRvIGFkZCB0byB0aGUgb3Bwb3NpdGUgaGlzdG9yeVxuICAgIC8vIHN0YWNrIChyZWRvIHdoZW4gdW5kb2luZywgYW5kIHZpY2UgdmVyc2EpLlxuICAgIHZhciBhbnRpQ2hhbmdlcyA9IFtdO1xuICAgIHB1c2hTZWxlY3Rpb25Ub0hpc3Rvcnkoc2VsQWZ0ZXIsIGRlc3QpO1xuICAgIGRlc3QucHVzaCh7Y2hhbmdlczogYW50aUNoYW5nZXMsIGdlbmVyYXRpb246IGhpc3QuZ2VuZXJhdGlvbn0pO1xuICAgIGhpc3QuZ2VuZXJhdGlvbiA9IGV2ZW50LmdlbmVyYXRpb24gfHwgKytoaXN0Lm1heEdlbmVyYXRpb247XG5cbiAgICB2YXIgZmlsdGVyID0gaGFzSGFuZGxlcihkb2MsIFwiYmVmb3JlQ2hhbmdlXCIpIHx8IGRvYy5jbSAmJiBoYXNIYW5kbGVyKGRvYy5jbSwgXCJiZWZvcmVDaGFuZ2VcIik7XG5cbiAgICBmb3IgKHZhciBpID0gZXZlbnQuY2hhbmdlcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgdmFyIGNoYW5nZSA9IGV2ZW50LmNoYW5nZXNbaV07XG4gICAgICBjaGFuZ2Uub3JpZ2luID0gdHlwZTtcbiAgICAgIGlmIChmaWx0ZXIgJiYgIWZpbHRlckNoYW5nZShkb2MsIGNoYW5nZSwgZmFsc2UpKSB7XG4gICAgICAgIHNvdXJjZS5sZW5ndGggPSAwO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGFudGlDaGFuZ2VzLnB1c2goaGlzdG9yeUNoYW5nZUZyb21DaGFuZ2UoZG9jLCBjaGFuZ2UpKTtcblxuICAgICAgdmFyIGFmdGVyID0gaSA/IGNvbXB1dGVTZWxBZnRlckNoYW5nZShkb2MsIGNoYW5nZSkgOiBsc3Qoc291cmNlKTtcbiAgICAgIG1ha2VDaGFuZ2VTaW5nbGVEb2MoZG9jLCBjaGFuZ2UsIGFmdGVyLCBtZXJnZU9sZFNwYW5zKGRvYywgY2hhbmdlKSk7XG4gICAgICBpZiAoIWkgJiYgZG9jLmNtKSBkb2MuY20uc2Nyb2xsSW50b1ZpZXcoe2Zyb206IGNoYW5nZS5mcm9tLCB0bzogY2hhbmdlRW5kKGNoYW5nZSl9KTtcbiAgICAgIHZhciByZWJhc2VkID0gW107XG5cbiAgICAgIC8vIFByb3BhZ2F0ZSB0byB0aGUgbGlua2VkIGRvY3VtZW50c1xuICAgICAgbGlua2VkRG9jcyhkb2MsIGZ1bmN0aW9uKGRvYywgc2hhcmVkSGlzdCkge1xuICAgICAgICBpZiAoIXNoYXJlZEhpc3QgJiYgaW5kZXhPZihyZWJhc2VkLCBkb2MuaGlzdG9yeSkgPT0gLTEpIHtcbiAgICAgICAgICByZWJhc2VIaXN0KGRvYy5oaXN0b3J5LCBjaGFuZ2UpO1xuICAgICAgICAgIHJlYmFzZWQucHVzaChkb2MuaGlzdG9yeSk7XG4gICAgICAgIH1cbiAgICAgICAgbWFrZUNoYW5nZVNpbmdsZURvYyhkb2MsIGNoYW5nZSwgbnVsbCwgbWVyZ2VPbGRTcGFucyhkb2MsIGNoYW5nZSkpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gU3ViLXZpZXdzIG5lZWQgdGhlaXIgbGluZSBudW1iZXJzIHNoaWZ0ZWQgd2hlbiB0ZXh0IGlzIGFkZGVkXG4gIC8vIGFib3ZlIG9yIGJlbG93IHRoZW0gaW4gdGhlIHBhcmVudCBkb2N1bWVudC5cbiAgZnVuY3Rpb24gc2hpZnREb2MoZG9jLCBkaXN0YW5jZSkge1xuICAgIGlmIChkaXN0YW5jZSA9PSAwKSByZXR1cm47XG4gICAgZG9jLmZpcnN0ICs9IGRpc3RhbmNlO1xuICAgIGRvYy5zZWwgPSBuZXcgU2VsZWN0aW9uKG1hcChkb2Muc2VsLnJhbmdlcywgZnVuY3Rpb24ocmFuZ2UpIHtcbiAgICAgIHJldHVybiBuZXcgUmFuZ2UoUG9zKHJhbmdlLmFuY2hvci5saW5lICsgZGlzdGFuY2UsIHJhbmdlLmFuY2hvci5jaCksXG4gICAgICAgICAgICAgICAgICAgICAgIFBvcyhyYW5nZS5oZWFkLmxpbmUgKyBkaXN0YW5jZSwgcmFuZ2UuaGVhZC5jaCkpO1xuICAgIH0pLCBkb2Muc2VsLnByaW1JbmRleCk7XG4gICAgaWYgKGRvYy5jbSkge1xuICAgICAgcmVnQ2hhbmdlKGRvYy5jbSwgZG9jLmZpcnN0LCBkb2MuZmlyc3QgLSBkaXN0YW5jZSwgZGlzdGFuY2UpO1xuICAgICAgZm9yICh2YXIgZCA9IGRvYy5jbS5kaXNwbGF5LCBsID0gZC52aWV3RnJvbTsgbCA8IGQudmlld1RvOyBsKyspXG4gICAgICAgIHJlZ0xpbmVDaGFuZ2UoZG9jLmNtLCBsLCBcImd1dHRlclwiKTtcbiAgICB9XG4gIH1cblxuICAvLyBNb3JlIGxvd2VyLWxldmVsIGNoYW5nZSBmdW5jdGlvbiwgaGFuZGxpbmcgb25seSBhIHNpbmdsZSBkb2N1bWVudFxuICAvLyAobm90IGxpbmtlZCBvbmVzKS5cbiAgZnVuY3Rpb24gbWFrZUNoYW5nZVNpbmdsZURvYyhkb2MsIGNoYW5nZSwgc2VsQWZ0ZXIsIHNwYW5zKSB7XG4gICAgaWYgKGRvYy5jbSAmJiAhZG9jLmNtLmN1ck9wKVxuICAgICAgcmV0dXJuIG9wZXJhdGlvbihkb2MuY20sIG1ha2VDaGFuZ2VTaW5nbGVEb2MpKGRvYywgY2hhbmdlLCBzZWxBZnRlciwgc3BhbnMpO1xuXG4gICAgaWYgKGNoYW5nZS50by5saW5lIDwgZG9jLmZpcnN0KSB7XG4gICAgICBzaGlmdERvYyhkb2MsIGNoYW5nZS50ZXh0Lmxlbmd0aCAtIDEgLSAoY2hhbmdlLnRvLmxpbmUgLSBjaGFuZ2UuZnJvbS5saW5lKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChjaGFuZ2UuZnJvbS5saW5lID4gZG9jLmxhc3RMaW5lKCkpIHJldHVybjtcblxuICAgIC8vIENsaXAgdGhlIGNoYW5nZSB0byB0aGUgc2l6ZSBvZiB0aGlzIGRvY1xuICAgIGlmIChjaGFuZ2UuZnJvbS5saW5lIDwgZG9jLmZpcnN0KSB7XG4gICAgICB2YXIgc2hpZnQgPSBjaGFuZ2UudGV4dC5sZW5ndGggLSAxIC0gKGRvYy5maXJzdCAtIGNoYW5nZS5mcm9tLmxpbmUpO1xuICAgICAgc2hpZnREb2MoZG9jLCBzaGlmdCk7XG4gICAgICBjaGFuZ2UgPSB7ZnJvbTogUG9zKGRvYy5maXJzdCwgMCksIHRvOiBQb3MoY2hhbmdlLnRvLmxpbmUgKyBzaGlmdCwgY2hhbmdlLnRvLmNoKSxcbiAgICAgICAgICAgICAgICB0ZXh0OiBbbHN0KGNoYW5nZS50ZXh0KV0sIG9yaWdpbjogY2hhbmdlLm9yaWdpbn07XG4gICAgfVxuICAgIHZhciBsYXN0ID0gZG9jLmxhc3RMaW5lKCk7XG4gICAgaWYgKGNoYW5nZS50by5saW5lID4gbGFzdCkge1xuICAgICAgY2hhbmdlID0ge2Zyb206IGNoYW5nZS5mcm9tLCB0bzogUG9zKGxhc3QsIGdldExpbmUoZG9jLCBsYXN0KS50ZXh0Lmxlbmd0aCksXG4gICAgICAgICAgICAgICAgdGV4dDogW2NoYW5nZS50ZXh0WzBdXSwgb3JpZ2luOiBjaGFuZ2Uub3JpZ2lufTtcbiAgICB9XG5cbiAgICBjaGFuZ2UucmVtb3ZlZCA9IGdldEJldHdlZW4oZG9jLCBjaGFuZ2UuZnJvbSwgY2hhbmdlLnRvKTtcblxuICAgIGlmICghc2VsQWZ0ZXIpIHNlbEFmdGVyID0gY29tcHV0ZVNlbEFmdGVyQ2hhbmdlKGRvYywgY2hhbmdlKTtcbiAgICBpZiAoZG9jLmNtKSBtYWtlQ2hhbmdlU2luZ2xlRG9jSW5FZGl0b3IoZG9jLmNtLCBjaGFuZ2UsIHNwYW5zKTtcbiAgICBlbHNlIHVwZGF0ZURvYyhkb2MsIGNoYW5nZSwgc3BhbnMpO1xuICAgIHNldFNlbGVjdGlvbk5vVW5kbyhkb2MsIHNlbEFmdGVyLCBzZWxfZG9udFNjcm9sbCk7XG4gIH1cblxuICAvLyBIYW5kbGUgdGhlIGludGVyYWN0aW9uIG9mIGEgY2hhbmdlIHRvIGEgZG9jdW1lbnQgd2l0aCB0aGUgZWRpdG9yXG4gIC8vIHRoYXQgdGhpcyBkb2N1bWVudCBpcyBwYXJ0IG9mLlxuICBmdW5jdGlvbiBtYWtlQ2hhbmdlU2luZ2xlRG9jSW5FZGl0b3IoY20sIGNoYW5nZSwgc3BhbnMpIHtcbiAgICB2YXIgZG9jID0gY20uZG9jLCBkaXNwbGF5ID0gY20uZGlzcGxheSwgZnJvbSA9IGNoYW5nZS5mcm9tLCB0byA9IGNoYW5nZS50bztcblxuICAgIHZhciByZWNvbXB1dGVNYXhMZW5ndGggPSBmYWxzZSwgY2hlY2tXaWR0aFN0YXJ0ID0gZnJvbS5saW5lO1xuICAgIGlmICghY20ub3B0aW9ucy5saW5lV3JhcHBpbmcpIHtcbiAgICAgIGNoZWNrV2lkdGhTdGFydCA9IGxpbmVObyh2aXN1YWxMaW5lKGdldExpbmUoZG9jLCBmcm9tLmxpbmUpKSk7XG4gICAgICBkb2MuaXRlcihjaGVja1dpZHRoU3RhcnQsIHRvLmxpbmUgKyAxLCBmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgIGlmIChsaW5lID09IGRpc3BsYXkubWF4TGluZSkge1xuICAgICAgICAgIHJlY29tcHV0ZU1heExlbmd0aCA9IHRydWU7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChkb2Muc2VsLmNvbnRhaW5zKGNoYW5nZS5mcm9tLCBjaGFuZ2UudG8pID4gLTEpXG4gICAgICBzaWduYWxDdXJzb3JBY3Rpdml0eShjbSk7XG5cbiAgICB1cGRhdGVEb2MoZG9jLCBjaGFuZ2UsIHNwYW5zLCBlc3RpbWF0ZUhlaWdodChjbSkpO1xuXG4gICAgaWYgKCFjbS5vcHRpb25zLmxpbmVXcmFwcGluZykge1xuICAgICAgZG9jLml0ZXIoY2hlY2tXaWR0aFN0YXJ0LCBmcm9tLmxpbmUgKyBjaGFuZ2UudGV4dC5sZW5ndGgsIGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgdmFyIGxlbiA9IGxpbmVMZW5ndGgobGluZSk7XG4gICAgICAgIGlmIChsZW4gPiBkaXNwbGF5Lm1heExpbmVMZW5ndGgpIHtcbiAgICAgICAgICBkaXNwbGF5Lm1heExpbmUgPSBsaW5lO1xuICAgICAgICAgIGRpc3BsYXkubWF4TGluZUxlbmd0aCA9IGxlbjtcbiAgICAgICAgICBkaXNwbGF5Lm1heExpbmVDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICByZWNvbXB1dGVNYXhMZW5ndGggPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAocmVjb21wdXRlTWF4TGVuZ3RoKSBjbS5jdXJPcC51cGRhdGVNYXhMaW5lID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBBZGp1c3QgZnJvbnRpZXIsIHNjaGVkdWxlIHdvcmtlclxuICAgIGRvYy5mcm9udGllciA9IE1hdGgubWluKGRvYy5mcm9udGllciwgZnJvbS5saW5lKTtcbiAgICBzdGFydFdvcmtlcihjbSwgNDAwKTtcblxuICAgIHZhciBsZW5kaWZmID0gY2hhbmdlLnRleHQubGVuZ3RoIC0gKHRvLmxpbmUgLSBmcm9tLmxpbmUpIC0gMTtcbiAgICAvLyBSZW1lbWJlciB0aGF0IHRoZXNlIGxpbmVzIGNoYW5nZWQsIGZvciB1cGRhdGluZyB0aGUgZGlzcGxheVxuICAgIGlmIChjaGFuZ2UuZnVsbClcbiAgICAgIHJlZ0NoYW5nZShjbSk7XG4gICAgZWxzZSBpZiAoZnJvbS5saW5lID09IHRvLmxpbmUgJiYgY2hhbmdlLnRleHQubGVuZ3RoID09IDEgJiYgIWlzV2hvbGVMaW5lVXBkYXRlKGNtLmRvYywgY2hhbmdlKSlcbiAgICAgIHJlZ0xpbmVDaGFuZ2UoY20sIGZyb20ubGluZSwgXCJ0ZXh0XCIpO1xuICAgIGVsc2VcbiAgICAgIHJlZ0NoYW5nZShjbSwgZnJvbS5saW5lLCB0by5saW5lICsgMSwgbGVuZGlmZik7XG5cbiAgICB2YXIgY2hhbmdlc0hhbmRsZXIgPSBoYXNIYW5kbGVyKGNtLCBcImNoYW5nZXNcIiksIGNoYW5nZUhhbmRsZXIgPSBoYXNIYW5kbGVyKGNtLCBcImNoYW5nZVwiKTtcbiAgICBpZiAoY2hhbmdlSGFuZGxlciB8fCBjaGFuZ2VzSGFuZGxlcikge1xuICAgICAgdmFyIG9iaiA9IHtcbiAgICAgICAgZnJvbTogZnJvbSwgdG86IHRvLFxuICAgICAgICB0ZXh0OiBjaGFuZ2UudGV4dCxcbiAgICAgICAgcmVtb3ZlZDogY2hhbmdlLnJlbW92ZWQsXG4gICAgICAgIG9yaWdpbjogY2hhbmdlLm9yaWdpblxuICAgICAgfTtcbiAgICAgIGlmIChjaGFuZ2VIYW5kbGVyKSBzaWduYWxMYXRlcihjbSwgXCJjaGFuZ2VcIiwgY20sIG9iaik7XG4gICAgICBpZiAoY2hhbmdlc0hhbmRsZXIpIChjbS5jdXJPcC5jaGFuZ2VPYmpzIHx8IChjbS5jdXJPcC5jaGFuZ2VPYmpzID0gW10pKS5wdXNoKG9iaik7XG4gICAgfVxuICAgIGNtLmRpc3BsYXkuc2VsRm9yQ29udGV4dE1lbnUgPSBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVwbGFjZVJhbmdlKGRvYywgY29kZSwgZnJvbSwgdG8sIG9yaWdpbikge1xuICAgIGlmICghdG8pIHRvID0gZnJvbTtcbiAgICBpZiAoY21wKHRvLCBmcm9tKSA8IDApIHsgdmFyIHRtcCA9IHRvOyB0byA9IGZyb207IGZyb20gPSB0bXA7IH1cbiAgICBpZiAodHlwZW9mIGNvZGUgPT0gXCJzdHJpbmdcIikgY29kZSA9IGRvYy5zcGxpdExpbmVzKGNvZGUpO1xuICAgIG1ha2VDaGFuZ2UoZG9jLCB7ZnJvbTogZnJvbSwgdG86IHRvLCB0ZXh0OiBjb2RlLCBvcmlnaW46IG9yaWdpbn0pO1xuICB9XG5cbiAgLy8gU0NST0xMSU5HIFRISU5HUyBJTlRPIFZJRVdcblxuICAvLyBJZiBhbiBlZGl0b3Igc2l0cyBvbiB0aGUgdG9wIG9yIGJvdHRvbSBvZiB0aGUgd2luZG93LCBwYXJ0aWFsbHlcbiAgLy8gc2Nyb2xsZWQgb3V0IG9mIHZpZXcsIHRoaXMgZW5zdXJlcyB0aGF0IHRoZSBjdXJzb3IgaXMgdmlzaWJsZS5cbiAgZnVuY3Rpb24gbWF5YmVTY3JvbGxXaW5kb3coY20sIGNvb3Jkcykge1xuICAgIGlmIChzaWduYWxET01FdmVudChjbSwgXCJzY3JvbGxDdXJzb3JJbnRvVmlld1wiKSkgcmV0dXJuO1xuXG4gICAgdmFyIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCBib3ggPSBkaXNwbGF5LnNpemVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLCBkb1Njcm9sbCA9IG51bGw7XG4gICAgaWYgKGNvb3Jkcy50b3AgKyBib3gudG9wIDwgMCkgZG9TY3JvbGwgPSB0cnVlO1xuICAgIGVsc2UgaWYgKGNvb3Jkcy5ib3R0b20gKyBib3gudG9wID4gKHdpbmRvdy5pbm5lckhlaWdodCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0KSkgZG9TY3JvbGwgPSBmYWxzZTtcbiAgICBpZiAoZG9TY3JvbGwgIT0gbnVsbCAmJiAhcGhhbnRvbSkge1xuICAgICAgdmFyIHNjcm9sbE5vZGUgPSBlbHQoXCJkaXZcIiwgXCJcXHUyMDBiXCIsIG51bGwsIFwicG9zaXRpb246IGFic29sdXRlOyB0b3A6IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIChjb29yZHMudG9wIC0gZGlzcGxheS52aWV3T2Zmc2V0IC0gcGFkZGluZ1RvcChjbS5kaXNwbGF5KSkgKyBcInB4OyBoZWlnaHQ6IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIChjb29yZHMuYm90dG9tIC0gY29vcmRzLnRvcCArIHNjcm9sbEdhcChjbSkgKyBkaXNwbGF5LmJhckhlaWdodCkgKyBcInB4OyBsZWZ0OiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjb29yZHMubGVmdCArIFwicHg7IHdpZHRoOiAycHg7XCIpO1xuICAgICAgY20uZGlzcGxheS5saW5lU3BhY2UuYXBwZW5kQ2hpbGQoc2Nyb2xsTm9kZSk7XG4gICAgICBzY3JvbGxOb2RlLnNjcm9sbEludG9WaWV3KGRvU2Nyb2xsKTtcbiAgICAgIGNtLmRpc3BsYXkubGluZVNwYWNlLnJlbW92ZUNoaWxkKHNjcm9sbE5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNjcm9sbCBhIGdpdmVuIHBvc2l0aW9uIGludG8gdmlldyAoaW1tZWRpYXRlbHkpLCB2ZXJpZnlpbmcgdGhhdFxuICAvLyBpdCBhY3R1YWxseSBiZWNhbWUgdmlzaWJsZSAoYXMgbGluZSBoZWlnaHRzIGFyZSBhY2N1cmF0ZWx5XG4gIC8vIG1lYXN1cmVkLCB0aGUgcG9zaXRpb24gb2Ygc29tZXRoaW5nIG1heSAnZHJpZnQnIGR1cmluZyBkcmF3aW5nKS5cbiAgZnVuY3Rpb24gc2Nyb2xsUG9zSW50b1ZpZXcoY20sIHBvcywgZW5kLCBtYXJnaW4pIHtcbiAgICBpZiAobWFyZ2luID09IG51bGwpIG1hcmdpbiA9IDA7XG4gICAgZm9yICh2YXIgbGltaXQgPSAwOyBsaW1pdCA8IDU7IGxpbWl0KyspIHtcbiAgICAgIHZhciBjaGFuZ2VkID0gZmFsc2UsIGNvb3JkcyA9IGN1cnNvckNvb3JkcyhjbSwgcG9zKTtcbiAgICAgIHZhciBlbmRDb29yZHMgPSAhZW5kIHx8IGVuZCA9PSBwb3MgPyBjb29yZHMgOiBjdXJzb3JDb29yZHMoY20sIGVuZCk7XG4gICAgICB2YXIgc2Nyb2xsUG9zID0gY2FsY3VsYXRlU2Nyb2xsUG9zKGNtLCBNYXRoLm1pbihjb29yZHMubGVmdCwgZW5kQ29vcmRzLmxlZnQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1pbihjb29yZHMudG9wLCBlbmRDb29yZHMudG9wKSAtIG1hcmdpbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoY29vcmRzLmxlZnQsIGVuZENvb3Jkcy5sZWZ0KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoY29vcmRzLmJvdHRvbSwgZW5kQ29vcmRzLmJvdHRvbSkgKyBtYXJnaW4pO1xuICAgICAgdmFyIHN0YXJ0VG9wID0gY20uZG9jLnNjcm9sbFRvcCwgc3RhcnRMZWZ0ID0gY20uZG9jLnNjcm9sbExlZnQ7XG4gICAgICBpZiAoc2Nyb2xsUG9zLnNjcm9sbFRvcCAhPSBudWxsKSB7XG4gICAgICAgIHNldFNjcm9sbFRvcChjbSwgc2Nyb2xsUG9zLnNjcm9sbFRvcCk7XG4gICAgICAgIGlmIChNYXRoLmFicyhjbS5kb2Muc2Nyb2xsVG9wIC0gc3RhcnRUb3ApID4gMSkgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZiAoc2Nyb2xsUG9zLnNjcm9sbExlZnQgIT0gbnVsbCkge1xuICAgICAgICBzZXRTY3JvbGxMZWZ0KGNtLCBzY3JvbGxQb3Muc2Nyb2xsTGVmdCk7XG4gICAgICAgIGlmIChNYXRoLmFicyhjbS5kb2Muc2Nyb2xsTGVmdCAtIHN0YXJ0TGVmdCkgPiAxKSBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICghY2hhbmdlZCkgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBjb29yZHM7XG4gIH1cblxuICAvLyBTY3JvbGwgYSBnaXZlbiBzZXQgb2YgY29vcmRpbmF0ZXMgaW50byB2aWV3IChpbW1lZGlhdGVseSkuXG4gIGZ1bmN0aW9uIHNjcm9sbEludG9WaWV3KGNtLCB4MSwgeTEsIHgyLCB5Mikge1xuICAgIHZhciBzY3JvbGxQb3MgPSBjYWxjdWxhdGVTY3JvbGxQb3MoY20sIHgxLCB5MSwgeDIsIHkyKTtcbiAgICBpZiAoc2Nyb2xsUG9zLnNjcm9sbFRvcCAhPSBudWxsKSBzZXRTY3JvbGxUb3AoY20sIHNjcm9sbFBvcy5zY3JvbGxUb3ApO1xuICAgIGlmIChzY3JvbGxQb3Muc2Nyb2xsTGVmdCAhPSBudWxsKSBzZXRTY3JvbGxMZWZ0KGNtLCBzY3JvbGxQb3Muc2Nyb2xsTGVmdCk7XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgYSBuZXcgc2Nyb2xsIHBvc2l0aW9uIG5lZWRlZCB0byBzY3JvbGwgdGhlIGdpdmVuXG4gIC8vIHJlY3RhbmdsZSBpbnRvIHZpZXcuIFJldHVybnMgYW4gb2JqZWN0IHdpdGggc2Nyb2xsVG9wIGFuZFxuICAvLyBzY3JvbGxMZWZ0IHByb3BlcnRpZXMuIFdoZW4gdGhlc2UgYXJlIHVuZGVmaW5lZCwgdGhlXG4gIC8vIHZlcnRpY2FsL2hvcml6b250YWwgcG9zaXRpb24gZG9lcyBub3QgbmVlZCB0byBiZSBhZGp1c3RlZC5cbiAgZnVuY3Rpb24gY2FsY3VsYXRlU2Nyb2xsUG9zKGNtLCB4MSwgeTEsIHgyLCB5Mikge1xuICAgIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheSwgc25hcE1hcmdpbiA9IHRleHRIZWlnaHQoY20uZGlzcGxheSk7XG4gICAgaWYgKHkxIDwgMCkgeTEgPSAwO1xuICAgIHZhciBzY3JlZW50b3AgPSBjbS5jdXJPcCAmJiBjbS5jdXJPcC5zY3JvbGxUb3AgIT0gbnVsbCA/IGNtLmN1ck9wLnNjcm9sbFRvcCA6IGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wO1xuICAgIHZhciBzY3JlZW4gPSBkaXNwbGF5SGVpZ2h0KGNtKSwgcmVzdWx0ID0ge307XG4gICAgaWYgKHkyIC0geTEgPiBzY3JlZW4pIHkyID0geTEgKyBzY3JlZW47XG4gICAgdmFyIGRvY0JvdHRvbSA9IGNtLmRvYy5oZWlnaHQgKyBwYWRkaW5nVmVydChkaXNwbGF5KTtcbiAgICB2YXIgYXRUb3AgPSB5MSA8IHNuYXBNYXJnaW4sIGF0Qm90dG9tID0geTIgPiBkb2NCb3R0b20gLSBzbmFwTWFyZ2luO1xuICAgIGlmICh5MSA8IHNjcmVlbnRvcCkge1xuICAgICAgcmVzdWx0LnNjcm9sbFRvcCA9IGF0VG9wID8gMCA6IHkxO1xuICAgIH0gZWxzZSBpZiAoeTIgPiBzY3JlZW50b3AgKyBzY3JlZW4pIHtcbiAgICAgIHZhciBuZXdUb3AgPSBNYXRoLm1pbih5MSwgKGF0Qm90dG9tID8gZG9jQm90dG9tIDogeTIpIC0gc2NyZWVuKTtcbiAgICAgIGlmIChuZXdUb3AgIT0gc2NyZWVudG9wKSByZXN1bHQuc2Nyb2xsVG9wID0gbmV3VG9wO1xuICAgIH1cblxuICAgIHZhciBzY3JlZW5sZWZ0ID0gY20uY3VyT3AgJiYgY20uY3VyT3Auc2Nyb2xsTGVmdCAhPSBudWxsID8gY20uY3VyT3Auc2Nyb2xsTGVmdCA6IGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsTGVmdDtcbiAgICB2YXIgc2NyZWVudyA9IGRpc3BsYXlXaWR0aChjbSkgLSAoY20ub3B0aW9ucy5maXhlZEd1dHRlciA/IGRpc3BsYXkuZ3V0dGVycy5vZmZzZXRXaWR0aCA6IDApO1xuICAgIHZhciB0b29XaWRlID0geDIgLSB4MSA+IHNjcmVlbnc7XG4gICAgaWYgKHRvb1dpZGUpIHgyID0geDEgKyBzY3JlZW53O1xuICAgIGlmICh4MSA8IDEwKVxuICAgICAgcmVzdWx0LnNjcm9sbExlZnQgPSAwO1xuICAgIGVsc2UgaWYgKHgxIDwgc2NyZWVubGVmdClcbiAgICAgIHJlc3VsdC5zY3JvbGxMZWZ0ID0gTWF0aC5tYXgoMCwgeDEgLSAodG9vV2lkZSA/IDAgOiAxMCkpO1xuICAgIGVsc2UgaWYgKHgyID4gc2NyZWVudyArIHNjcmVlbmxlZnQgLSAzKVxuICAgICAgcmVzdWx0LnNjcm9sbExlZnQgPSB4MiArICh0b29XaWRlID8gMCA6IDEwKSAtIHNjcmVlbnc7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFN0b3JlIGEgcmVsYXRpdmUgYWRqdXN0bWVudCB0byB0aGUgc2Nyb2xsIHBvc2l0aW9uIGluIHRoZSBjdXJyZW50XG4gIC8vIG9wZXJhdGlvbiAodG8gYmUgYXBwbGllZCB3aGVuIHRoZSBvcGVyYXRpb24gZmluaXNoZXMpLlxuICBmdW5jdGlvbiBhZGRUb1Njcm9sbFBvcyhjbSwgbGVmdCwgdG9wKSB7XG4gICAgaWYgKGxlZnQgIT0gbnVsbCB8fCB0b3AgIT0gbnVsbCkgcmVzb2x2ZVNjcm9sbFRvUG9zKGNtKTtcbiAgICBpZiAobGVmdCAhPSBudWxsKVxuICAgICAgY20uY3VyT3Auc2Nyb2xsTGVmdCA9IChjbS5jdXJPcC5zY3JvbGxMZWZ0ID09IG51bGwgPyBjbS5kb2Muc2Nyb2xsTGVmdCA6IGNtLmN1ck9wLnNjcm9sbExlZnQpICsgbGVmdDtcbiAgICBpZiAodG9wICE9IG51bGwpXG4gICAgICBjbS5jdXJPcC5zY3JvbGxUb3AgPSAoY20uY3VyT3Auc2Nyb2xsVG9wID09IG51bGwgPyBjbS5kb2Muc2Nyb2xsVG9wIDogY20uY3VyT3Auc2Nyb2xsVG9wKSArIHRvcDtcbiAgfVxuXG4gIC8vIE1ha2Ugc3VyZSB0aGF0IGF0IHRoZSBlbmQgb2YgdGhlIG9wZXJhdGlvbiB0aGUgY3VycmVudCBjdXJzb3IgaXNcbiAgLy8gc2hvd24uXG4gIGZ1bmN0aW9uIGVuc3VyZUN1cnNvclZpc2libGUoY20pIHtcbiAgICByZXNvbHZlU2Nyb2xsVG9Qb3MoY20pO1xuICAgIHZhciBjdXIgPSBjbS5nZXRDdXJzb3IoKSwgZnJvbSA9IGN1ciwgdG8gPSBjdXI7XG4gICAgaWYgKCFjbS5vcHRpb25zLmxpbmVXcmFwcGluZykge1xuICAgICAgZnJvbSA9IGN1ci5jaCA/IFBvcyhjdXIubGluZSwgY3VyLmNoIC0gMSkgOiBjdXI7XG4gICAgICB0byA9IFBvcyhjdXIubGluZSwgY3VyLmNoICsgMSk7XG4gICAgfVxuICAgIGNtLmN1ck9wLnNjcm9sbFRvUG9zID0ge2Zyb206IGZyb20sIHRvOiB0bywgbWFyZ2luOiBjbS5vcHRpb25zLmN1cnNvclNjcm9sbE1hcmdpbiwgaXNDdXJzb3I6IHRydWV9O1xuICB9XG5cbiAgLy8gV2hlbiBhbiBvcGVyYXRpb24gaGFzIGl0cyBzY3JvbGxUb1BvcyBwcm9wZXJ0eSBzZXQsIGFuZCBhbm90aGVyXG4gIC8vIHNjcm9sbCBhY3Rpb24gaXMgYXBwbGllZCBiZWZvcmUgdGhlIGVuZCBvZiB0aGUgb3BlcmF0aW9uLCB0aGlzXG4gIC8vICdzaW11bGF0ZXMnIHNjcm9sbGluZyB0aGF0IHBvc2l0aW9uIGludG8gdmlldyBpbiBhIGNoZWFwIHdheSwgc29cbiAgLy8gdGhhdCB0aGUgZWZmZWN0IG9mIGludGVybWVkaWF0ZSBzY3JvbGwgY29tbWFuZHMgaXMgbm90IGlnbm9yZWQuXG4gIGZ1bmN0aW9uIHJlc29sdmVTY3JvbGxUb1BvcyhjbSkge1xuICAgIHZhciByYW5nZSA9IGNtLmN1ck9wLnNjcm9sbFRvUG9zO1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgY20uY3VyT3Auc2Nyb2xsVG9Qb3MgPSBudWxsO1xuICAgICAgdmFyIGZyb20gPSBlc3RpbWF0ZUNvb3JkcyhjbSwgcmFuZ2UuZnJvbSksIHRvID0gZXN0aW1hdGVDb29yZHMoY20sIHJhbmdlLnRvKTtcbiAgICAgIHZhciBzUG9zID0gY2FsY3VsYXRlU2Nyb2xsUG9zKGNtLCBNYXRoLm1pbihmcm9tLmxlZnQsIHRvLmxlZnQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5taW4oZnJvbS50b3AsIHRvLnRvcCkgLSByYW5nZS5tYXJnaW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChmcm9tLnJpZ2h0LCB0by5yaWdodCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChmcm9tLmJvdHRvbSwgdG8uYm90dG9tKSArIHJhbmdlLm1hcmdpbik7XG4gICAgICBjbS5zY3JvbGxUbyhzUG9zLnNjcm9sbExlZnQsIHNQb3Muc2Nyb2xsVG9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBBUEkgVVRJTElUSUVTXG5cbiAgLy8gSW5kZW50IHRoZSBnaXZlbiBsaW5lLiBUaGUgaG93IHBhcmFtZXRlciBjYW4gYmUgXCJzbWFydFwiLFxuICAvLyBcImFkZFwiL251bGwsIFwic3VidHJhY3RcIiwgb3IgXCJwcmV2XCIuIFdoZW4gYWdncmVzc2l2ZSBpcyBmYWxzZVxuICAvLyAodHlwaWNhbGx5IHNldCB0byB0cnVlIGZvciBmb3JjZWQgc2luZ2xlLWxpbmUgaW5kZW50cyksIGVtcHR5XG4gIC8vIGxpbmVzIGFyZSBub3QgaW5kZW50ZWQsIGFuZCBwbGFjZXMgd2hlcmUgdGhlIG1vZGUgcmV0dXJucyBQYXNzXG4gIC8vIGFyZSBsZWZ0IGFsb25lLlxuICBmdW5jdGlvbiBpbmRlbnRMaW5lKGNtLCBuLCBob3csIGFnZ3Jlc3NpdmUpIHtcbiAgICB2YXIgZG9jID0gY20uZG9jLCBzdGF0ZTtcbiAgICBpZiAoaG93ID09IG51bGwpIGhvdyA9IFwiYWRkXCI7XG4gICAgaWYgKGhvdyA9PSBcInNtYXJ0XCIpIHtcbiAgICAgIC8vIEZhbGwgYmFjayB0byBcInByZXZcIiB3aGVuIHRoZSBtb2RlIGRvZXNuJ3QgaGF2ZSBhbiBpbmRlbnRhdGlvblxuICAgICAgLy8gbWV0aG9kLlxuICAgICAgaWYgKCFkb2MubW9kZS5pbmRlbnQpIGhvdyA9IFwicHJldlwiO1xuICAgICAgZWxzZSBzdGF0ZSA9IGdldFN0YXRlQmVmb3JlKGNtLCBuKTtcbiAgICB9XG5cbiAgICB2YXIgdGFiU2l6ZSA9IGNtLm9wdGlvbnMudGFiU2l6ZTtcbiAgICB2YXIgbGluZSA9IGdldExpbmUoZG9jLCBuKSwgY3VyU3BhY2UgPSBjb3VudENvbHVtbihsaW5lLnRleHQsIG51bGwsIHRhYlNpemUpO1xuICAgIGlmIChsaW5lLnN0YXRlQWZ0ZXIpIGxpbmUuc3RhdGVBZnRlciA9IG51bGw7XG4gICAgdmFyIGN1clNwYWNlU3RyaW5nID0gbGluZS50ZXh0Lm1hdGNoKC9eXFxzKi8pWzBdLCBpbmRlbnRhdGlvbjtcbiAgICBpZiAoIWFnZ3Jlc3NpdmUgJiYgIS9cXFMvLnRlc3QobGluZS50ZXh0KSkge1xuICAgICAgaW5kZW50YXRpb24gPSAwO1xuICAgICAgaG93ID0gXCJub3RcIjtcbiAgICB9IGVsc2UgaWYgKGhvdyA9PSBcInNtYXJ0XCIpIHtcbiAgICAgIGluZGVudGF0aW9uID0gZG9jLm1vZGUuaW5kZW50KHN0YXRlLCBsaW5lLnRleHQuc2xpY2UoY3VyU3BhY2VTdHJpbmcubGVuZ3RoKSwgbGluZS50ZXh0KTtcbiAgICAgIGlmIChpbmRlbnRhdGlvbiA9PSBQYXNzIHx8IGluZGVudGF0aW9uID4gMTUwKSB7XG4gICAgICAgIGlmICghYWdncmVzc2l2ZSkgcmV0dXJuO1xuICAgICAgICBob3cgPSBcInByZXZcIjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGhvdyA9PSBcInByZXZcIikge1xuICAgICAgaWYgKG4gPiBkb2MuZmlyc3QpIGluZGVudGF0aW9uID0gY291bnRDb2x1bW4oZ2V0TGluZShkb2MsIG4tMSkudGV4dCwgbnVsbCwgdGFiU2l6ZSk7XG4gICAgICBlbHNlIGluZGVudGF0aW9uID0gMDtcbiAgICB9IGVsc2UgaWYgKGhvdyA9PSBcImFkZFwiKSB7XG4gICAgICBpbmRlbnRhdGlvbiA9IGN1clNwYWNlICsgY20ub3B0aW9ucy5pbmRlbnRVbml0O1xuICAgIH0gZWxzZSBpZiAoaG93ID09IFwic3VidHJhY3RcIikge1xuICAgICAgaW5kZW50YXRpb24gPSBjdXJTcGFjZSAtIGNtLm9wdGlvbnMuaW5kZW50VW5pdDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBob3cgPT0gXCJudW1iZXJcIikge1xuICAgICAgaW5kZW50YXRpb24gPSBjdXJTcGFjZSArIGhvdztcbiAgICB9XG4gICAgaW5kZW50YXRpb24gPSBNYXRoLm1heCgwLCBpbmRlbnRhdGlvbik7XG5cbiAgICB2YXIgaW5kZW50U3RyaW5nID0gXCJcIiwgcG9zID0gMDtcbiAgICBpZiAoY20ub3B0aW9ucy5pbmRlbnRXaXRoVGFicylcbiAgICAgIGZvciAodmFyIGkgPSBNYXRoLmZsb29yKGluZGVudGF0aW9uIC8gdGFiU2l6ZSk7IGk7IC0taSkge3BvcyArPSB0YWJTaXplOyBpbmRlbnRTdHJpbmcgKz0gXCJcXHRcIjt9XG4gICAgaWYgKHBvcyA8IGluZGVudGF0aW9uKSBpbmRlbnRTdHJpbmcgKz0gc3BhY2VTdHIoaW5kZW50YXRpb24gLSBwb3MpO1xuXG4gICAgaWYgKGluZGVudFN0cmluZyAhPSBjdXJTcGFjZVN0cmluZykge1xuICAgICAgcmVwbGFjZVJhbmdlKGRvYywgaW5kZW50U3RyaW5nLCBQb3MobiwgMCksIFBvcyhuLCBjdXJTcGFjZVN0cmluZy5sZW5ndGgpLCBcIitpbnB1dFwiKTtcbiAgICAgIGxpbmUuc3RhdGVBZnRlciA9IG51bGw7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRW5zdXJlIHRoYXQsIGlmIHRoZSBjdXJzb3Igd2FzIGluIHRoZSB3aGl0ZXNwYWNlIGF0IHRoZSBzdGFydFxuICAgICAgLy8gb2YgdGhlIGxpbmUsIGl0IGlzIG1vdmVkIHRvIHRoZSBlbmQgb2YgdGhhdCBzcGFjZS5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZG9jLnNlbC5yYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJhbmdlID0gZG9jLnNlbC5yYW5nZXNbaV07XG4gICAgICAgIGlmIChyYW5nZS5oZWFkLmxpbmUgPT0gbiAmJiByYW5nZS5oZWFkLmNoIDwgY3VyU3BhY2VTdHJpbmcubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHBvcyA9IFBvcyhuLCBjdXJTcGFjZVN0cmluZy5sZW5ndGgpO1xuICAgICAgICAgIHJlcGxhY2VPbmVTZWxlY3Rpb24oZG9jLCBpLCBuZXcgUmFuZ2UocG9zLCBwb3MpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFV0aWxpdHkgZm9yIGFwcGx5aW5nIGEgY2hhbmdlIHRvIGEgbGluZSBieSBoYW5kbGUgb3IgbnVtYmVyLFxuICAvLyByZXR1cm5pbmcgdGhlIG51bWJlciBhbmQgb3B0aW9uYWxseSByZWdpc3RlcmluZyB0aGUgbGluZSBhc1xuICAvLyBjaGFuZ2VkLlxuICBmdW5jdGlvbiBjaGFuZ2VMaW5lKGRvYywgaGFuZGxlLCBjaGFuZ2VUeXBlLCBvcCkge1xuICAgIHZhciBubyA9IGhhbmRsZSwgbGluZSA9IGhhbmRsZTtcbiAgICBpZiAodHlwZW9mIGhhbmRsZSA9PSBcIm51bWJlclwiKSBsaW5lID0gZ2V0TGluZShkb2MsIGNsaXBMaW5lKGRvYywgaGFuZGxlKSk7XG4gICAgZWxzZSBubyA9IGxpbmVObyhoYW5kbGUpO1xuICAgIGlmIChubyA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICBpZiAob3AobGluZSwgbm8pICYmIGRvYy5jbSkgcmVnTGluZUNoYW5nZShkb2MuY20sIG5vLCBjaGFuZ2VUeXBlKTtcbiAgICByZXR1cm4gbGluZTtcbiAgfVxuXG4gIC8vIEhlbHBlciBmb3IgZGVsZXRpbmcgdGV4dCBuZWFyIHRoZSBzZWxlY3Rpb24ocyksIHVzZWQgdG8gaW1wbGVtZW50XG4gIC8vIGJhY2tzcGFjZSwgZGVsZXRlLCBhbmQgc2ltaWxhciBmdW5jdGlvbmFsaXR5LlxuICBmdW5jdGlvbiBkZWxldGVOZWFyU2VsZWN0aW9uKGNtLCBjb21wdXRlKSB7XG4gICAgdmFyIHJhbmdlcyA9IGNtLmRvYy5zZWwucmFuZ2VzLCBraWxsID0gW107XG4gICAgLy8gQnVpbGQgdXAgYSBzZXQgb2YgcmFuZ2VzIHRvIGtpbGwgZmlyc3QsIG1lcmdpbmcgb3ZlcmxhcHBpbmdcbiAgICAvLyByYW5nZXMuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB0b0tpbGwgPSBjb21wdXRlKHJhbmdlc1tpXSk7XG4gICAgICB3aGlsZSAoa2lsbC5sZW5ndGggJiYgY21wKHRvS2lsbC5mcm9tLCBsc3Qoa2lsbCkudG8pIDw9IDApIHtcbiAgICAgICAgdmFyIHJlcGxhY2VkID0ga2lsbC5wb3AoKTtcbiAgICAgICAgaWYgKGNtcChyZXBsYWNlZC5mcm9tLCB0b0tpbGwuZnJvbSkgPCAwKSB7XG4gICAgICAgICAgdG9LaWxsLmZyb20gPSByZXBsYWNlZC5mcm9tO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBraWxsLnB1c2godG9LaWxsKTtcbiAgICB9XG4gICAgLy8gTmV4dCwgcmVtb3ZlIHRob3NlIGFjdHVhbCByYW5nZXMuXG4gICAgcnVuSW5PcChjbSwgZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKHZhciBpID0ga2lsbC5sZW5ndGggLSAxOyBpID49IDA7IGktLSlcbiAgICAgICAgcmVwbGFjZVJhbmdlKGNtLmRvYywgXCJcIiwga2lsbFtpXS5mcm9tLCBraWxsW2ldLnRvLCBcIitkZWxldGVcIik7XG4gICAgICBlbnN1cmVDdXJzb3JWaXNpYmxlKGNtKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFVzZWQgZm9yIGhvcml6b250YWwgcmVsYXRpdmUgbW90aW9uLiBEaXIgaXMgLTEgb3IgMSAobGVmdCBvclxuICAvLyByaWdodCksIHVuaXQgY2FuIGJlIFwiY2hhclwiLCBcImNvbHVtblwiIChsaWtlIGNoYXIsIGJ1dCBkb2Vzbid0XG4gIC8vIGNyb3NzIGxpbmUgYm91bmRhcmllcyksIFwid29yZFwiIChhY3Jvc3MgbmV4dCB3b3JkKSwgb3IgXCJncm91cFwiICh0b1xuICAvLyB0aGUgc3RhcnQgb2YgbmV4dCBncm91cCBvZiB3b3JkIG9yIG5vbi13b3JkLW5vbi13aGl0ZXNwYWNlXG4gIC8vIGNoYXJzKS4gVGhlIHZpc3VhbGx5IHBhcmFtIGNvbnRyb2xzIHdoZXRoZXIsIGluIHJpZ2h0LXRvLWxlZnRcbiAgLy8gdGV4dCwgZGlyZWN0aW9uIDEgbWVhbnMgdG8gbW92ZSB0b3dhcmRzIHRoZSBuZXh0IGluZGV4IGluIHRoZVxuICAvLyBzdHJpbmcsIG9yIHRvd2FyZHMgdGhlIGNoYXJhY3RlciB0byB0aGUgcmlnaHQgb2YgdGhlIGN1cnJlbnRcbiAgLy8gcG9zaXRpb24uIFRoZSByZXN1bHRpbmcgcG9zaXRpb24gd2lsbCBoYXZlIGEgaGl0U2lkZT10cnVlXG4gIC8vIHByb3BlcnR5IGlmIGl0IHJlYWNoZWQgdGhlIGVuZCBvZiB0aGUgZG9jdW1lbnQuXG4gIGZ1bmN0aW9uIGZpbmRQb3NIKGRvYywgcG9zLCBkaXIsIHVuaXQsIHZpc3VhbGx5KSB7XG4gICAgdmFyIGxpbmUgPSBwb3MubGluZSwgY2ggPSBwb3MuY2gsIG9yaWdEaXIgPSBkaXI7XG4gICAgdmFyIGxpbmVPYmogPSBnZXRMaW5lKGRvYywgbGluZSk7XG4gICAgdmFyIHBvc3NpYmxlID0gdHJ1ZTtcbiAgICBmdW5jdGlvbiBmaW5kTmV4dExpbmUoKSB7XG4gICAgICB2YXIgbCA9IGxpbmUgKyBkaXI7XG4gICAgICBpZiAobCA8IGRvYy5maXJzdCB8fCBsID49IGRvYy5maXJzdCArIGRvYy5zaXplKSByZXR1cm4gKHBvc3NpYmxlID0gZmFsc2UpO1xuICAgICAgbGluZSA9IGw7XG4gICAgICByZXR1cm4gbGluZU9iaiA9IGdldExpbmUoZG9jLCBsKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbW92ZU9uY2UoYm91bmRUb0xpbmUpIHtcbiAgICAgIHZhciBuZXh0ID0gKHZpc3VhbGx5ID8gbW92ZVZpc3VhbGx5IDogbW92ZUxvZ2ljYWxseSkobGluZU9iaiwgY2gsIGRpciwgdHJ1ZSk7XG4gICAgICBpZiAobmV4dCA9PSBudWxsKSB7XG4gICAgICAgIGlmICghYm91bmRUb0xpbmUgJiYgZmluZE5leHRMaW5lKCkpIHtcbiAgICAgICAgICBpZiAodmlzdWFsbHkpIGNoID0gKGRpciA8IDAgPyBsaW5lUmlnaHQgOiBsaW5lTGVmdCkobGluZU9iaik7XG4gICAgICAgICAgZWxzZSBjaCA9IGRpciA8IDAgPyBsaW5lT2JqLnRleHQubGVuZ3RoIDogMDtcbiAgICAgICAgfSBlbHNlIHJldHVybiAocG9zc2libGUgPSBmYWxzZSk7XG4gICAgICB9IGVsc2UgY2ggPSBuZXh0O1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHVuaXQgPT0gXCJjaGFyXCIpIG1vdmVPbmNlKCk7XG4gICAgZWxzZSBpZiAodW5pdCA9PSBcImNvbHVtblwiKSBtb3ZlT25jZSh0cnVlKTtcbiAgICBlbHNlIGlmICh1bml0ID09IFwid29yZFwiIHx8IHVuaXQgPT0gXCJncm91cFwiKSB7XG4gICAgICB2YXIgc2F3VHlwZSA9IG51bGwsIGdyb3VwID0gdW5pdCA9PSBcImdyb3VwXCI7XG4gICAgICB2YXIgaGVscGVyID0gZG9jLmNtICYmIGRvYy5jbS5nZXRIZWxwZXIocG9zLCBcIndvcmRDaGFyc1wiKTtcbiAgICAgIGZvciAodmFyIGZpcnN0ID0gdHJ1ZTs7IGZpcnN0ID0gZmFsc2UpIHtcbiAgICAgICAgaWYgKGRpciA8IDAgJiYgIW1vdmVPbmNlKCFmaXJzdCkpIGJyZWFrO1xuICAgICAgICB2YXIgY3VyID0gbGluZU9iai50ZXh0LmNoYXJBdChjaCkgfHwgXCJcXG5cIjtcbiAgICAgICAgdmFyIHR5cGUgPSBpc1dvcmRDaGFyKGN1ciwgaGVscGVyKSA/IFwid1wiXG4gICAgICAgICAgOiBncm91cCAmJiBjdXIgPT0gXCJcXG5cIiA/IFwiblwiXG4gICAgICAgICAgOiAhZ3JvdXAgfHwgL1xccy8udGVzdChjdXIpID8gbnVsbFxuICAgICAgICAgIDogXCJwXCI7XG4gICAgICAgIGlmIChncm91cCAmJiAhZmlyc3QgJiYgIXR5cGUpIHR5cGUgPSBcInNcIjtcbiAgICAgICAgaWYgKHNhd1R5cGUgJiYgc2F3VHlwZSAhPSB0eXBlKSB7XG4gICAgICAgICAgaWYgKGRpciA8IDApIHtkaXIgPSAxOyBtb3ZlT25jZSgpO31cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlKSBzYXdUeXBlID0gdHlwZTtcbiAgICAgICAgaWYgKGRpciA+IDAgJiYgIW1vdmVPbmNlKCFmaXJzdCkpIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gc2tpcEF0b21pYyhkb2MsIFBvcyhsaW5lLCBjaCksIG9yaWdEaXIsIHRydWUpO1xuICAgIGlmICghcG9zc2libGUpIHJlc3VsdC5oaXRTaWRlID0gdHJ1ZTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gRm9yIHJlbGF0aXZlIHZlcnRpY2FsIG1vdmVtZW50LiBEaXIgbWF5IGJlIC0xIG9yIDEuIFVuaXQgY2FuIGJlXG4gIC8vIFwicGFnZVwiIG9yIFwibGluZVwiLiBUaGUgcmVzdWx0aW5nIHBvc2l0aW9uIHdpbGwgaGF2ZSBhIGhpdFNpZGU9dHJ1ZVxuICAvLyBwcm9wZXJ0eSBpZiBpdCByZWFjaGVkIHRoZSBlbmQgb2YgdGhlIGRvY3VtZW50LlxuICBmdW5jdGlvbiBmaW5kUG9zVihjbSwgcG9zLCBkaXIsIHVuaXQpIHtcbiAgICB2YXIgZG9jID0gY20uZG9jLCB4ID0gcG9zLmxlZnQsIHk7XG4gICAgaWYgKHVuaXQgPT0gXCJwYWdlXCIpIHtcbiAgICAgIHZhciBwYWdlU2l6ZSA9IE1hdGgubWluKGNtLmRpc3BsYXkud3JhcHBlci5jbGllbnRIZWlnaHQsIHdpbmRvdy5pbm5lckhlaWdodCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0KTtcbiAgICAgIHkgPSBwb3MudG9wICsgZGlyICogKHBhZ2VTaXplIC0gKGRpciA8IDAgPyAxLjUgOiAuNSkgKiB0ZXh0SGVpZ2h0KGNtLmRpc3BsYXkpKTtcbiAgICB9IGVsc2UgaWYgKHVuaXQgPT0gXCJsaW5lXCIpIHtcbiAgICAgIHkgPSBkaXIgPiAwID8gcG9zLmJvdHRvbSArIDMgOiBwb3MudG9wIC0gMztcbiAgICB9XG4gICAgZm9yICg7Oykge1xuICAgICAgdmFyIHRhcmdldCA9IGNvb3Jkc0NoYXIoY20sIHgsIHkpO1xuICAgICAgaWYgKCF0YXJnZXQub3V0c2lkZSkgYnJlYWs7XG4gICAgICBpZiAoZGlyIDwgMCA/IHkgPD0gMCA6IHkgPj0gZG9jLmhlaWdodCkgeyB0YXJnZXQuaGl0U2lkZSA9IHRydWU7IGJyZWFrOyB9XG4gICAgICB5ICs9IGRpciAqIDU7XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICAvLyBFRElUT1IgTUVUSE9EU1xuXG4gIC8vIFRoZSBwdWJsaWNseSB2aXNpYmxlIEFQSS4gTm90ZSB0aGF0IG1ldGhvZE9wKGYpIG1lYW5zXG4gIC8vICd3cmFwIGYgaW4gYW4gb3BlcmF0aW9uLCBwZXJmb3JtZWQgb24gaXRzIGB0aGlzYCBwYXJhbWV0ZXInLlxuXG4gIC8vIFRoaXMgaXMgbm90IHRoZSBjb21wbGV0ZSBzZXQgb2YgZWRpdG9yIG1ldGhvZHMuIE1vc3Qgb2YgdGhlXG4gIC8vIG1ldGhvZHMgZGVmaW5lZCBvbiB0aGUgRG9jIHR5cGUgYXJlIGFsc28gaW5qZWN0ZWQgaW50b1xuICAvLyBDb2RlTWlycm9yLnByb3RvdHlwZSwgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IGFuZFxuICAvLyBjb252ZW5pZW5jZS5cblxuICBDb2RlTWlycm9yLnByb3RvdHlwZSA9IHtcbiAgICBjb25zdHJ1Y3RvcjogQ29kZU1pcnJvcixcbiAgICBmb2N1czogZnVuY3Rpb24oKXt3aW5kb3cuZm9jdXMoKTsgdGhpcy5kaXNwbGF5LmlucHV0LmZvY3VzKCk7fSxcblxuICAgIHNldE9wdGlvbjogZnVuY3Rpb24ob3B0aW9uLCB2YWx1ZSkge1xuICAgICAgdmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnMsIG9sZCA9IG9wdGlvbnNbb3B0aW9uXTtcbiAgICAgIGlmIChvcHRpb25zW29wdGlvbl0gPT0gdmFsdWUgJiYgb3B0aW9uICE9IFwibW9kZVwiKSByZXR1cm47XG4gICAgICBvcHRpb25zW29wdGlvbl0gPSB2YWx1ZTtcbiAgICAgIGlmIChvcHRpb25IYW5kbGVycy5oYXNPd25Qcm9wZXJ0eShvcHRpb24pKVxuICAgICAgICBvcGVyYXRpb24odGhpcywgb3B0aW9uSGFuZGxlcnNbb3B0aW9uXSkodGhpcywgdmFsdWUsIG9sZCk7XG4gICAgfSxcblxuICAgIGdldE9wdGlvbjogZnVuY3Rpb24ob3B0aW9uKSB7cmV0dXJuIHRoaXMub3B0aW9uc1tvcHRpb25dO30sXG4gICAgZ2V0RG9jOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5kb2M7fSxcblxuICAgIGFkZEtleU1hcDogZnVuY3Rpb24obWFwLCBib3R0b20pIHtcbiAgICAgIHRoaXMuc3RhdGUua2V5TWFwc1tib3R0b20gPyBcInB1c2hcIiA6IFwidW5zaGlmdFwiXShnZXRLZXlNYXAobWFwKSk7XG4gICAgfSxcbiAgICByZW1vdmVLZXlNYXA6IGZ1bmN0aW9uKG1hcCkge1xuICAgICAgdmFyIG1hcHMgPSB0aGlzLnN0YXRlLmtleU1hcHM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hcHMubGVuZ3RoOyArK2kpXG4gICAgICAgIGlmIChtYXBzW2ldID09IG1hcCB8fCBtYXBzW2ldLm5hbWUgPT0gbWFwKSB7XG4gICAgICAgICAgbWFwcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgYWRkT3ZlcmxheTogbWV0aG9kT3AoZnVuY3Rpb24oc3BlYywgb3B0aW9ucykge1xuICAgICAgdmFyIG1vZGUgPSBzcGVjLnRva2VuID8gc3BlYyA6IENvZGVNaXJyb3IuZ2V0TW9kZSh0aGlzLm9wdGlvbnMsIHNwZWMpO1xuICAgICAgaWYgKG1vZGUuc3RhcnRTdGF0ZSkgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxheXMgbWF5IG5vdCBiZSBzdGF0ZWZ1bC5cIik7XG4gICAgICB0aGlzLnN0YXRlLm92ZXJsYXlzLnB1c2goe21vZGU6IG1vZGUsIG1vZGVTcGVjOiBzcGVjLCBvcGFxdWU6IG9wdGlvbnMgJiYgb3B0aW9ucy5vcGFxdWV9KTtcbiAgICAgIHRoaXMuc3RhdGUubW9kZUdlbisrO1xuICAgICAgcmVnQ2hhbmdlKHRoaXMpO1xuICAgIH0pLFxuICAgIHJlbW92ZU92ZXJsYXk6IG1ldGhvZE9wKGZ1bmN0aW9uKHNwZWMpIHtcbiAgICAgIHZhciBvdmVybGF5cyA9IHRoaXMuc3RhdGUub3ZlcmxheXM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG92ZXJsYXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBjdXIgPSBvdmVybGF5c1tpXS5tb2RlU3BlYztcbiAgICAgICAgaWYgKGN1ciA9PSBzcGVjIHx8IHR5cGVvZiBzcGVjID09IFwic3RyaW5nXCIgJiYgY3VyLm5hbWUgPT0gc3BlYykge1xuICAgICAgICAgIG92ZXJsYXlzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB0aGlzLnN0YXRlLm1vZGVHZW4rKztcbiAgICAgICAgICByZWdDaGFuZ2UodGhpcyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSksXG5cbiAgICBpbmRlbnRMaW5lOiBtZXRob2RPcChmdW5jdGlvbihuLCBkaXIsIGFnZ3Jlc3NpdmUpIHtcbiAgICAgIGlmICh0eXBlb2YgZGlyICE9IFwic3RyaW5nXCIgJiYgdHlwZW9mIGRpciAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgIGlmIChkaXIgPT0gbnVsbCkgZGlyID0gdGhpcy5vcHRpb25zLnNtYXJ0SW5kZW50ID8gXCJzbWFydFwiIDogXCJwcmV2XCI7XG4gICAgICAgIGVsc2UgZGlyID0gZGlyID8gXCJhZGRcIiA6IFwic3VidHJhY3RcIjtcbiAgICAgIH1cbiAgICAgIGlmIChpc0xpbmUodGhpcy5kb2MsIG4pKSBpbmRlbnRMaW5lKHRoaXMsIG4sIGRpciwgYWdncmVzc2l2ZSk7XG4gICAgfSksXG4gICAgaW5kZW50U2VsZWN0aW9uOiBtZXRob2RPcChmdW5jdGlvbihob3cpIHtcbiAgICAgIHZhciByYW5nZXMgPSB0aGlzLmRvYy5zZWwucmFuZ2VzLCBlbmQgPSAtMTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByYW5nZSA9IHJhbmdlc1tpXTtcbiAgICAgICAgaWYgKCFyYW5nZS5lbXB0eSgpKSB7XG4gICAgICAgICAgdmFyIGZyb20gPSByYW5nZS5mcm9tKCksIHRvID0gcmFuZ2UudG8oKTtcbiAgICAgICAgICB2YXIgc3RhcnQgPSBNYXRoLm1heChlbmQsIGZyb20ubGluZSk7XG4gICAgICAgICAgZW5kID0gTWF0aC5taW4odGhpcy5sYXN0TGluZSgpLCB0by5saW5lIC0gKHRvLmNoID8gMCA6IDEpKSArIDE7XG4gICAgICAgICAgZm9yICh2YXIgaiA9IHN0YXJ0OyBqIDwgZW5kOyArK2opXG4gICAgICAgICAgICBpbmRlbnRMaW5lKHRoaXMsIGosIGhvdyk7XG4gICAgICAgICAgdmFyIG5ld1JhbmdlcyA9IHRoaXMuZG9jLnNlbC5yYW5nZXM7XG4gICAgICAgICAgaWYgKGZyb20uY2ggPT0gMCAmJiByYW5nZXMubGVuZ3RoID09IG5ld1Jhbmdlcy5sZW5ndGggJiYgbmV3UmFuZ2VzW2ldLmZyb20oKS5jaCA+IDApXG4gICAgICAgICAgICByZXBsYWNlT25lU2VsZWN0aW9uKHRoaXMuZG9jLCBpLCBuZXcgUmFuZ2UoZnJvbSwgbmV3UmFuZ2VzW2ldLnRvKCkpLCBzZWxfZG9udFNjcm9sbCk7XG4gICAgICAgIH0gZWxzZSBpZiAocmFuZ2UuaGVhZC5saW5lID4gZW5kKSB7XG4gICAgICAgICAgaW5kZW50TGluZSh0aGlzLCByYW5nZS5oZWFkLmxpbmUsIGhvdywgdHJ1ZSk7XG4gICAgICAgICAgZW5kID0gcmFuZ2UuaGVhZC5saW5lO1xuICAgICAgICAgIGlmIChpID09IHRoaXMuZG9jLnNlbC5wcmltSW5kZXgpIGVuc3VyZUN1cnNvclZpc2libGUodGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSxcblxuICAgIC8vIEZldGNoIHRoZSBwYXJzZXIgdG9rZW4gZm9yIGEgZ2l2ZW4gY2hhcmFjdGVyLiBVc2VmdWwgZm9yIGhhY2tzXG4gICAgLy8gdGhhdCB3YW50IHRvIGluc3BlY3QgdGhlIG1vZGUgc3RhdGUgKHNheSwgZm9yIGNvbXBsZXRpb24pLlxuICAgIGdldFRva2VuQXQ6IGZ1bmN0aW9uKHBvcywgcHJlY2lzZSkge1xuICAgICAgcmV0dXJuIHRha2VUb2tlbih0aGlzLCBwb3MsIHByZWNpc2UpO1xuICAgIH0sXG5cbiAgICBnZXRMaW5lVG9rZW5zOiBmdW5jdGlvbihsaW5lLCBwcmVjaXNlKSB7XG4gICAgICByZXR1cm4gdGFrZVRva2VuKHRoaXMsIFBvcyhsaW5lKSwgcHJlY2lzZSwgdHJ1ZSk7XG4gICAgfSxcblxuICAgIGdldFRva2VuVHlwZUF0OiBmdW5jdGlvbihwb3MpIHtcbiAgICAgIHBvcyA9IGNsaXBQb3ModGhpcy5kb2MsIHBvcyk7XG4gICAgICB2YXIgc3R5bGVzID0gZ2V0TGluZVN0eWxlcyh0aGlzLCBnZXRMaW5lKHRoaXMuZG9jLCBwb3MubGluZSkpO1xuICAgICAgdmFyIGJlZm9yZSA9IDAsIGFmdGVyID0gKHN0eWxlcy5sZW5ndGggLSAxKSAvIDIsIGNoID0gcG9zLmNoO1xuICAgICAgdmFyIHR5cGU7XG4gICAgICBpZiAoY2ggPT0gMCkgdHlwZSA9IHN0eWxlc1syXTtcbiAgICAgIGVsc2UgZm9yICg7Oykge1xuICAgICAgICB2YXIgbWlkID0gKGJlZm9yZSArIGFmdGVyKSA+PiAxO1xuICAgICAgICBpZiAoKG1pZCA/IHN0eWxlc1ttaWQgKiAyIC0gMV0gOiAwKSA+PSBjaCkgYWZ0ZXIgPSBtaWQ7XG4gICAgICAgIGVsc2UgaWYgKHN0eWxlc1ttaWQgKiAyICsgMV0gPCBjaCkgYmVmb3JlID0gbWlkICsgMTtcbiAgICAgICAgZWxzZSB7IHR5cGUgPSBzdHlsZXNbbWlkICogMiArIDJdOyBicmVhazsgfVxuICAgICAgfVxuICAgICAgdmFyIGN1dCA9IHR5cGUgPyB0eXBlLmluZGV4T2YoXCJjbS1vdmVybGF5IFwiKSA6IC0xO1xuICAgICAgcmV0dXJuIGN1dCA8IDAgPyB0eXBlIDogY3V0ID09IDAgPyBudWxsIDogdHlwZS5zbGljZSgwLCBjdXQgLSAxKTtcbiAgICB9LFxuXG4gICAgZ2V0TW9kZUF0OiBmdW5jdGlvbihwb3MpIHtcbiAgICAgIHZhciBtb2RlID0gdGhpcy5kb2MubW9kZTtcbiAgICAgIGlmICghbW9kZS5pbm5lck1vZGUpIHJldHVybiBtb2RlO1xuICAgICAgcmV0dXJuIENvZGVNaXJyb3IuaW5uZXJNb2RlKG1vZGUsIHRoaXMuZ2V0VG9rZW5BdChwb3MpLnN0YXRlKS5tb2RlO1xuICAgIH0sXG5cbiAgICBnZXRIZWxwZXI6IGZ1bmN0aW9uKHBvcywgdHlwZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0SGVscGVycyhwb3MsIHR5cGUpWzBdO1xuICAgIH0sXG5cbiAgICBnZXRIZWxwZXJzOiBmdW5jdGlvbihwb3MsIHR5cGUpIHtcbiAgICAgIHZhciBmb3VuZCA9IFtdO1xuICAgICAgaWYgKCFoZWxwZXJzLmhhc093blByb3BlcnR5KHR5cGUpKSByZXR1cm4gZm91bmQ7XG4gICAgICB2YXIgaGVscCA9IGhlbHBlcnNbdHlwZV0sIG1vZGUgPSB0aGlzLmdldE1vZGVBdChwb3MpO1xuICAgICAgaWYgKHR5cGVvZiBtb2RlW3R5cGVdID09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgaWYgKGhlbHBbbW9kZVt0eXBlXV0pIGZvdW5kLnB1c2goaGVscFttb2RlW3R5cGVdXSk7XG4gICAgICB9IGVsc2UgaWYgKG1vZGVbdHlwZV0pIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb2RlW3R5cGVdLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIHZhbCA9IGhlbHBbbW9kZVt0eXBlXVtpXV07XG4gICAgICAgICAgaWYgKHZhbCkgZm91bmQucHVzaCh2YWwpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKG1vZGUuaGVscGVyVHlwZSAmJiBoZWxwW21vZGUuaGVscGVyVHlwZV0pIHtcbiAgICAgICAgZm91bmQucHVzaChoZWxwW21vZGUuaGVscGVyVHlwZV0pO1xuICAgICAgfSBlbHNlIGlmIChoZWxwW21vZGUubmFtZV0pIHtcbiAgICAgICAgZm91bmQucHVzaChoZWxwW21vZGUubmFtZV0pO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBoZWxwLl9nbG9iYWwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGN1ciA9IGhlbHAuX2dsb2JhbFtpXTtcbiAgICAgICAgaWYgKGN1ci5wcmVkKG1vZGUsIHRoaXMpICYmIGluZGV4T2YoZm91bmQsIGN1ci52YWwpID09IC0xKVxuICAgICAgICAgIGZvdW5kLnB1c2goY3VyLnZhbCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZm91bmQ7XG4gICAgfSxcblxuICAgIGdldFN0YXRlQWZ0ZXI6IGZ1bmN0aW9uKGxpbmUsIHByZWNpc2UpIHtcbiAgICAgIHZhciBkb2MgPSB0aGlzLmRvYztcbiAgICAgIGxpbmUgPSBjbGlwTGluZShkb2MsIGxpbmUgPT0gbnVsbCA/IGRvYy5maXJzdCArIGRvYy5zaXplIC0gMTogbGluZSk7XG4gICAgICByZXR1cm4gZ2V0U3RhdGVCZWZvcmUodGhpcywgbGluZSArIDEsIHByZWNpc2UpO1xuICAgIH0sXG5cbiAgICBjdXJzb3JDb29yZHM6IGZ1bmN0aW9uKHN0YXJ0LCBtb2RlKSB7XG4gICAgICB2YXIgcG9zLCByYW5nZSA9IHRoaXMuZG9jLnNlbC5wcmltYXJ5KCk7XG4gICAgICBpZiAoc3RhcnQgPT0gbnVsbCkgcG9zID0gcmFuZ2UuaGVhZDtcbiAgICAgIGVsc2UgaWYgKHR5cGVvZiBzdGFydCA9PSBcIm9iamVjdFwiKSBwb3MgPSBjbGlwUG9zKHRoaXMuZG9jLCBzdGFydCk7XG4gICAgICBlbHNlIHBvcyA9IHN0YXJ0ID8gcmFuZ2UuZnJvbSgpIDogcmFuZ2UudG8oKTtcbiAgICAgIHJldHVybiBjdXJzb3JDb29yZHModGhpcywgcG9zLCBtb2RlIHx8IFwicGFnZVwiKTtcbiAgICB9LFxuXG4gICAgY2hhckNvb3JkczogZnVuY3Rpb24ocG9zLCBtb2RlKSB7XG4gICAgICByZXR1cm4gY2hhckNvb3Jkcyh0aGlzLCBjbGlwUG9zKHRoaXMuZG9jLCBwb3MpLCBtb2RlIHx8IFwicGFnZVwiKTtcbiAgICB9LFxuXG4gICAgY29vcmRzQ2hhcjogZnVuY3Rpb24oY29vcmRzLCBtb2RlKSB7XG4gICAgICBjb29yZHMgPSBmcm9tQ29vcmRTeXN0ZW0odGhpcywgY29vcmRzLCBtb2RlIHx8IFwicGFnZVwiKTtcbiAgICAgIHJldHVybiBjb29yZHNDaGFyKHRoaXMsIGNvb3Jkcy5sZWZ0LCBjb29yZHMudG9wKTtcbiAgICB9LFxuXG4gICAgbGluZUF0SGVpZ2h0OiBmdW5jdGlvbihoZWlnaHQsIG1vZGUpIHtcbiAgICAgIGhlaWdodCA9IGZyb21Db29yZFN5c3RlbSh0aGlzLCB7dG9wOiBoZWlnaHQsIGxlZnQ6IDB9LCBtb2RlIHx8IFwicGFnZVwiKS50b3A7XG4gICAgICByZXR1cm4gbGluZUF0SGVpZ2h0KHRoaXMuZG9jLCBoZWlnaHQgKyB0aGlzLmRpc3BsYXkudmlld09mZnNldCk7XG4gICAgfSxcbiAgICBoZWlnaHRBdExpbmU6IGZ1bmN0aW9uKGxpbmUsIG1vZGUpIHtcbiAgICAgIHZhciBlbmQgPSBmYWxzZSwgbGluZU9iajtcbiAgICAgIGlmICh0eXBlb2YgbGluZSA9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHZhciBsYXN0ID0gdGhpcy5kb2MuZmlyc3QgKyB0aGlzLmRvYy5zaXplIC0gMTtcbiAgICAgICAgaWYgKGxpbmUgPCB0aGlzLmRvYy5maXJzdCkgbGluZSA9IHRoaXMuZG9jLmZpcnN0O1xuICAgICAgICBlbHNlIGlmIChsaW5lID4gbGFzdCkgeyBsaW5lID0gbGFzdDsgZW5kID0gdHJ1ZTsgfVxuICAgICAgICBsaW5lT2JqID0gZ2V0TGluZSh0aGlzLmRvYywgbGluZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaW5lT2JqID0gbGluZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbnRvQ29vcmRTeXN0ZW0odGhpcywgbGluZU9iaiwge3RvcDogMCwgbGVmdDogMH0sIG1vZGUgfHwgXCJwYWdlXCIpLnRvcCArXG4gICAgICAgIChlbmQgPyB0aGlzLmRvYy5oZWlnaHQgLSBoZWlnaHRBdExpbmUobGluZU9iaikgOiAwKTtcbiAgICB9LFxuXG4gICAgZGVmYXVsdFRleHRIZWlnaHQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGV4dEhlaWdodCh0aGlzLmRpc3BsYXkpOyB9LFxuICAgIGRlZmF1bHRDaGFyV2lkdGg6IGZ1bmN0aW9uKCkgeyByZXR1cm4gY2hhcldpZHRoKHRoaXMuZGlzcGxheSk7IH0sXG5cbiAgICBzZXRHdXR0ZXJNYXJrZXI6IG1ldGhvZE9wKGZ1bmN0aW9uKGxpbmUsIGd1dHRlcklELCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGNoYW5nZUxpbmUodGhpcy5kb2MsIGxpbmUsIFwiZ3V0dGVyXCIsIGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgdmFyIG1hcmtlcnMgPSBsaW5lLmd1dHRlck1hcmtlcnMgfHwgKGxpbmUuZ3V0dGVyTWFya2VycyA9IHt9KTtcbiAgICAgICAgbWFya2Vyc1tndXR0ZXJJRF0gPSB2YWx1ZTtcbiAgICAgICAgaWYgKCF2YWx1ZSAmJiBpc0VtcHR5KG1hcmtlcnMpKSBsaW5lLmd1dHRlck1hcmtlcnMgPSBudWxsO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH0pLFxuXG4gICAgY2xlYXJHdXR0ZXI6IG1ldGhvZE9wKGZ1bmN0aW9uKGd1dHRlcklEKSB7XG4gICAgICB2YXIgY20gPSB0aGlzLCBkb2MgPSBjbS5kb2MsIGkgPSBkb2MuZmlyc3Q7XG4gICAgICBkb2MuaXRlcihmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgIGlmIChsaW5lLmd1dHRlck1hcmtlcnMgJiYgbGluZS5ndXR0ZXJNYXJrZXJzW2d1dHRlcklEXSkge1xuICAgICAgICAgIGxpbmUuZ3V0dGVyTWFya2Vyc1tndXR0ZXJJRF0gPSBudWxsO1xuICAgICAgICAgIHJlZ0xpbmVDaGFuZ2UoY20sIGksIFwiZ3V0dGVyXCIpO1xuICAgICAgICAgIGlmIChpc0VtcHR5KGxpbmUuZ3V0dGVyTWFya2VycykpIGxpbmUuZ3V0dGVyTWFya2VycyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgKytpO1xuICAgICAgfSk7XG4gICAgfSksXG5cbiAgICBsaW5lSW5mbzogZnVuY3Rpb24obGluZSkge1xuICAgICAgaWYgKHR5cGVvZiBsaW5lID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgaWYgKCFpc0xpbmUodGhpcy5kb2MsIGxpbmUpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgdmFyIG4gPSBsaW5lO1xuICAgICAgICBsaW5lID0gZ2V0TGluZSh0aGlzLmRvYywgbGluZSk7XG4gICAgICAgIGlmICghbGluZSkgcmV0dXJuIG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgbiA9IGxpbmVObyhsaW5lKTtcbiAgICAgICAgaWYgKG4gPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4ge2xpbmU6IG4sIGhhbmRsZTogbGluZSwgdGV4dDogbGluZS50ZXh0LCBndXR0ZXJNYXJrZXJzOiBsaW5lLmd1dHRlck1hcmtlcnMsXG4gICAgICAgICAgICAgIHRleHRDbGFzczogbGluZS50ZXh0Q2xhc3MsIGJnQ2xhc3M6IGxpbmUuYmdDbGFzcywgd3JhcENsYXNzOiBsaW5lLndyYXBDbGFzcyxcbiAgICAgICAgICAgICAgd2lkZ2V0czogbGluZS53aWRnZXRzfTtcbiAgICB9LFxuXG4gICAgZ2V0Vmlld3BvcnQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4ge2Zyb206IHRoaXMuZGlzcGxheS52aWV3RnJvbSwgdG86IHRoaXMuZGlzcGxheS52aWV3VG99O30sXG5cbiAgICBhZGRXaWRnZXQ6IGZ1bmN0aW9uKHBvcywgbm9kZSwgc2Nyb2xsLCB2ZXJ0LCBob3Jpeikge1xuICAgICAgdmFyIGRpc3BsYXkgPSB0aGlzLmRpc3BsYXk7XG4gICAgICBwb3MgPSBjdXJzb3JDb29yZHModGhpcywgY2xpcFBvcyh0aGlzLmRvYywgcG9zKSk7XG4gICAgICB2YXIgdG9wID0gcG9zLmJvdHRvbSwgbGVmdCA9IHBvcy5sZWZ0O1xuICAgICAgbm9kZS5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcbiAgICAgIG5vZGUuc2V0QXR0cmlidXRlKFwiY20taWdub3JlLWV2ZW50c1wiLCBcInRydWVcIik7XG4gICAgICB0aGlzLmRpc3BsYXkuaW5wdXQuc2V0VW5lZGl0YWJsZShub2RlKTtcbiAgICAgIGRpc3BsYXkuc2l6ZXIuYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgICBpZiAodmVydCA9PSBcIm92ZXJcIikge1xuICAgICAgICB0b3AgPSBwb3MudG9wO1xuICAgICAgfSBlbHNlIGlmICh2ZXJ0ID09IFwiYWJvdmVcIiB8fCB2ZXJ0ID09IFwibmVhclwiKSB7XG4gICAgICAgIHZhciB2c3BhY2UgPSBNYXRoLm1heChkaXNwbGF5LndyYXBwZXIuY2xpZW50SGVpZ2h0LCB0aGlzLmRvYy5oZWlnaHQpLFxuICAgICAgICBoc3BhY2UgPSBNYXRoLm1heChkaXNwbGF5LnNpemVyLmNsaWVudFdpZHRoLCBkaXNwbGF5LmxpbmVTcGFjZS5jbGllbnRXaWR0aCk7XG4gICAgICAgIC8vIERlZmF1bHQgdG8gcG9zaXRpb25pbmcgYWJvdmUgKGlmIHNwZWNpZmllZCBhbmQgcG9zc2libGUpOyBvdGhlcndpc2UgZGVmYXVsdCB0byBwb3NpdGlvbmluZyBiZWxvd1xuICAgICAgICBpZiAoKHZlcnQgPT0gJ2Fib3ZlJyB8fCBwb3MuYm90dG9tICsgbm9kZS5vZmZzZXRIZWlnaHQgPiB2c3BhY2UpICYmIHBvcy50b3AgPiBub2RlLm9mZnNldEhlaWdodClcbiAgICAgICAgICB0b3AgPSBwb3MudG9wIC0gbm9kZS5vZmZzZXRIZWlnaHQ7XG4gICAgICAgIGVsc2UgaWYgKHBvcy5ib3R0b20gKyBub2RlLm9mZnNldEhlaWdodCA8PSB2c3BhY2UpXG4gICAgICAgICAgdG9wID0gcG9zLmJvdHRvbTtcbiAgICAgICAgaWYgKGxlZnQgKyBub2RlLm9mZnNldFdpZHRoID4gaHNwYWNlKVxuICAgICAgICAgIGxlZnQgPSBoc3BhY2UgLSBub2RlLm9mZnNldFdpZHRoO1xuICAgICAgfVxuICAgICAgbm9kZS5zdHlsZS50b3AgPSB0b3AgKyBcInB4XCI7XG4gICAgICBub2RlLnN0eWxlLmxlZnQgPSBub2RlLnN0eWxlLnJpZ2h0ID0gXCJcIjtcbiAgICAgIGlmIChob3JpeiA9PSBcInJpZ2h0XCIpIHtcbiAgICAgICAgbGVmdCA9IGRpc3BsYXkuc2l6ZXIuY2xpZW50V2lkdGggLSBub2RlLm9mZnNldFdpZHRoO1xuICAgICAgICBub2RlLnN0eWxlLnJpZ2h0ID0gXCIwcHhcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChob3JpeiA9PSBcImxlZnRcIikgbGVmdCA9IDA7XG4gICAgICAgIGVsc2UgaWYgKGhvcml6ID09IFwibWlkZGxlXCIpIGxlZnQgPSAoZGlzcGxheS5zaXplci5jbGllbnRXaWR0aCAtIG5vZGUub2Zmc2V0V2lkdGgpIC8gMjtcbiAgICAgICAgbm9kZS5zdHlsZS5sZWZ0ID0gbGVmdCArIFwicHhcIjtcbiAgICAgIH1cbiAgICAgIGlmIChzY3JvbGwpXG4gICAgICAgIHNjcm9sbEludG9WaWV3KHRoaXMsIGxlZnQsIHRvcCwgbGVmdCArIG5vZGUub2Zmc2V0V2lkdGgsIHRvcCArIG5vZGUub2Zmc2V0SGVpZ2h0KTtcbiAgICB9LFxuXG4gICAgdHJpZ2dlck9uS2V5RG93bjogbWV0aG9kT3Aob25LZXlEb3duKSxcbiAgICB0cmlnZ2VyT25LZXlQcmVzczogbWV0aG9kT3Aob25LZXlQcmVzcyksXG4gICAgdHJpZ2dlck9uS2V5VXA6IG9uS2V5VXAsXG5cbiAgICBleGVjQ29tbWFuZDogZnVuY3Rpb24oY21kKSB7XG4gICAgICBpZiAoY29tbWFuZHMuaGFzT3duUHJvcGVydHkoY21kKSlcbiAgICAgICAgcmV0dXJuIGNvbW1hbmRzW2NtZF0uY2FsbChudWxsLCB0aGlzKTtcbiAgICB9LFxuXG4gICAgdHJpZ2dlckVsZWN0cmljOiBtZXRob2RPcChmdW5jdGlvbih0ZXh0KSB7IHRyaWdnZXJFbGVjdHJpYyh0aGlzLCB0ZXh0KTsgfSksXG5cbiAgICBmaW5kUG9zSDogZnVuY3Rpb24oZnJvbSwgYW1vdW50LCB1bml0LCB2aXN1YWxseSkge1xuICAgICAgdmFyIGRpciA9IDE7XG4gICAgICBpZiAoYW1vdW50IDwgMCkgeyBkaXIgPSAtMTsgYW1vdW50ID0gLWFtb3VudDsgfVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGN1ciA9IGNsaXBQb3ModGhpcy5kb2MsIGZyb20pOyBpIDwgYW1vdW50OyArK2kpIHtcbiAgICAgICAgY3VyID0gZmluZFBvc0godGhpcy5kb2MsIGN1ciwgZGlyLCB1bml0LCB2aXN1YWxseSk7XG4gICAgICAgIGlmIChjdXIuaGl0U2lkZSkgYnJlYWs7XG4gICAgICB9XG4gICAgICByZXR1cm4gY3VyO1xuICAgIH0sXG5cbiAgICBtb3ZlSDogbWV0aG9kT3AoZnVuY3Rpb24oZGlyLCB1bml0KSB7XG4gICAgICB2YXIgY20gPSB0aGlzO1xuICAgICAgY20uZXh0ZW5kU2VsZWN0aW9uc0J5KGZ1bmN0aW9uKHJhbmdlKSB7XG4gICAgICAgIGlmIChjbS5kaXNwbGF5LnNoaWZ0IHx8IGNtLmRvYy5leHRlbmQgfHwgcmFuZ2UuZW1wdHkoKSlcbiAgICAgICAgICByZXR1cm4gZmluZFBvc0goY20uZG9jLCByYW5nZS5oZWFkLCBkaXIsIHVuaXQsIGNtLm9wdGlvbnMucnRsTW92ZVZpc3VhbGx5KTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHJldHVybiBkaXIgPCAwID8gcmFuZ2UuZnJvbSgpIDogcmFuZ2UudG8oKTtcbiAgICAgIH0sIHNlbF9tb3ZlKTtcbiAgICB9KSxcblxuICAgIGRlbGV0ZUg6IG1ldGhvZE9wKGZ1bmN0aW9uKGRpciwgdW5pdCkge1xuICAgICAgdmFyIHNlbCA9IHRoaXMuZG9jLnNlbCwgZG9jID0gdGhpcy5kb2M7XG4gICAgICBpZiAoc2VsLnNvbWV0aGluZ1NlbGVjdGVkKCkpXG4gICAgICAgIGRvYy5yZXBsYWNlU2VsZWN0aW9uKFwiXCIsIG51bGwsIFwiK2RlbGV0ZVwiKTtcbiAgICAgIGVsc2VcbiAgICAgICAgZGVsZXRlTmVhclNlbGVjdGlvbih0aGlzLCBmdW5jdGlvbihyYW5nZSkge1xuICAgICAgICAgIHZhciBvdGhlciA9IGZpbmRQb3NIKGRvYywgcmFuZ2UuaGVhZCwgZGlyLCB1bml0LCBmYWxzZSk7XG4gICAgICAgICAgcmV0dXJuIGRpciA8IDAgPyB7ZnJvbTogb3RoZXIsIHRvOiByYW5nZS5oZWFkfSA6IHtmcm9tOiByYW5nZS5oZWFkLCB0bzogb3RoZXJ9O1xuICAgICAgICB9KTtcbiAgICB9KSxcblxuICAgIGZpbmRQb3NWOiBmdW5jdGlvbihmcm9tLCBhbW91bnQsIHVuaXQsIGdvYWxDb2x1bW4pIHtcbiAgICAgIHZhciBkaXIgPSAxLCB4ID0gZ29hbENvbHVtbjtcbiAgICAgIGlmIChhbW91bnQgPCAwKSB7IGRpciA9IC0xOyBhbW91bnQgPSAtYW1vdW50OyB9XG4gICAgICBmb3IgKHZhciBpID0gMCwgY3VyID0gY2xpcFBvcyh0aGlzLmRvYywgZnJvbSk7IGkgPCBhbW91bnQ7ICsraSkge1xuICAgICAgICB2YXIgY29vcmRzID0gY3Vyc29yQ29vcmRzKHRoaXMsIGN1ciwgXCJkaXZcIik7XG4gICAgICAgIGlmICh4ID09IG51bGwpIHggPSBjb29yZHMubGVmdDtcbiAgICAgICAgZWxzZSBjb29yZHMubGVmdCA9IHg7XG4gICAgICAgIGN1ciA9IGZpbmRQb3NWKHRoaXMsIGNvb3JkcywgZGlyLCB1bml0KTtcbiAgICAgICAgaWYgKGN1ci5oaXRTaWRlKSBicmVhaztcbiAgICAgIH1cbiAgICAgIHJldHVybiBjdXI7XG4gICAgfSxcblxuICAgIG1vdmVWOiBtZXRob2RPcChmdW5jdGlvbihkaXIsIHVuaXQpIHtcbiAgICAgIHZhciBjbSA9IHRoaXMsIGRvYyA9IHRoaXMuZG9jLCBnb2FscyA9IFtdO1xuICAgICAgdmFyIGNvbGxhcHNlID0gIWNtLmRpc3BsYXkuc2hpZnQgJiYgIWRvYy5leHRlbmQgJiYgZG9jLnNlbC5zb21ldGhpbmdTZWxlY3RlZCgpO1xuICAgICAgZG9jLmV4dGVuZFNlbGVjdGlvbnNCeShmdW5jdGlvbihyYW5nZSkge1xuICAgICAgICBpZiAoY29sbGFwc2UpXG4gICAgICAgICAgcmV0dXJuIGRpciA8IDAgPyByYW5nZS5mcm9tKCkgOiByYW5nZS50bygpO1xuICAgICAgICB2YXIgaGVhZFBvcyA9IGN1cnNvckNvb3JkcyhjbSwgcmFuZ2UuaGVhZCwgXCJkaXZcIik7XG4gICAgICAgIGlmIChyYW5nZS5nb2FsQ29sdW1uICE9IG51bGwpIGhlYWRQb3MubGVmdCA9IHJhbmdlLmdvYWxDb2x1bW47XG4gICAgICAgIGdvYWxzLnB1c2goaGVhZFBvcy5sZWZ0KTtcbiAgICAgICAgdmFyIHBvcyA9IGZpbmRQb3NWKGNtLCBoZWFkUG9zLCBkaXIsIHVuaXQpO1xuICAgICAgICBpZiAodW5pdCA9PSBcInBhZ2VcIiAmJiByYW5nZSA9PSBkb2Muc2VsLnByaW1hcnkoKSlcbiAgICAgICAgICBhZGRUb1Njcm9sbFBvcyhjbSwgbnVsbCwgY2hhckNvb3JkcyhjbSwgcG9zLCBcImRpdlwiKS50b3AgLSBoZWFkUG9zLnRvcCk7XG4gICAgICAgIHJldHVybiBwb3M7XG4gICAgICB9LCBzZWxfbW92ZSk7XG4gICAgICBpZiAoZ29hbHMubGVuZ3RoKSBmb3IgKHZhciBpID0gMDsgaSA8IGRvYy5zZWwucmFuZ2VzLmxlbmd0aDsgaSsrKVxuICAgICAgICBkb2Muc2VsLnJhbmdlc1tpXS5nb2FsQ29sdW1uID0gZ29hbHNbaV07XG4gICAgfSksXG5cbiAgICAvLyBGaW5kIHRoZSB3b3JkIGF0IHRoZSBnaXZlbiBwb3NpdGlvbiAoYXMgcmV0dXJuZWQgYnkgY29vcmRzQ2hhcikuXG4gICAgZmluZFdvcmRBdDogZnVuY3Rpb24ocG9zKSB7XG4gICAgICB2YXIgZG9jID0gdGhpcy5kb2MsIGxpbmUgPSBnZXRMaW5lKGRvYywgcG9zLmxpbmUpLnRleHQ7XG4gICAgICB2YXIgc3RhcnQgPSBwb3MuY2gsIGVuZCA9IHBvcy5jaDtcbiAgICAgIGlmIChsaW5lKSB7XG4gICAgICAgIHZhciBoZWxwZXIgPSB0aGlzLmdldEhlbHBlcihwb3MsIFwid29yZENoYXJzXCIpO1xuICAgICAgICBpZiAoKHBvcy54UmVsIDwgMCB8fCBlbmQgPT0gbGluZS5sZW5ndGgpICYmIHN0YXJ0KSAtLXN0YXJ0OyBlbHNlICsrZW5kO1xuICAgICAgICB2YXIgc3RhcnRDaGFyID0gbGluZS5jaGFyQXQoc3RhcnQpO1xuICAgICAgICB2YXIgY2hlY2sgPSBpc1dvcmRDaGFyKHN0YXJ0Q2hhciwgaGVscGVyKVxuICAgICAgICAgID8gZnVuY3Rpb24oY2gpIHsgcmV0dXJuIGlzV29yZENoYXIoY2gsIGhlbHBlcik7IH1cbiAgICAgICAgICA6IC9cXHMvLnRlc3Qoc3RhcnRDaGFyKSA/IGZ1bmN0aW9uKGNoKSB7cmV0dXJuIC9cXHMvLnRlc3QoY2gpO31cbiAgICAgICAgICA6IGZ1bmN0aW9uKGNoKSB7cmV0dXJuICEvXFxzLy50ZXN0KGNoKSAmJiAhaXNXb3JkQ2hhcihjaCk7fTtcbiAgICAgICAgd2hpbGUgKHN0YXJ0ID4gMCAmJiBjaGVjayhsaW5lLmNoYXJBdChzdGFydCAtIDEpKSkgLS1zdGFydDtcbiAgICAgICAgd2hpbGUgKGVuZCA8IGxpbmUubGVuZ3RoICYmIGNoZWNrKGxpbmUuY2hhckF0KGVuZCkpKSArK2VuZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUmFuZ2UoUG9zKHBvcy5saW5lLCBzdGFydCksIFBvcyhwb3MubGluZSwgZW5kKSk7XG4gICAgfSxcblxuICAgIHRvZ2dsZU92ZXJ3cml0ZTogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsICYmIHZhbHVlID09IHRoaXMuc3RhdGUub3ZlcndyaXRlKSByZXR1cm47XG4gICAgICBpZiAodGhpcy5zdGF0ZS5vdmVyd3JpdGUgPSAhdGhpcy5zdGF0ZS5vdmVyd3JpdGUpXG4gICAgICAgIGFkZENsYXNzKHRoaXMuZGlzcGxheS5jdXJzb3JEaXYsIFwiQ29kZU1pcnJvci1vdmVyd3JpdGVcIik7XG4gICAgICBlbHNlXG4gICAgICAgIHJtQ2xhc3ModGhpcy5kaXNwbGF5LmN1cnNvckRpdiwgXCJDb2RlTWlycm9yLW92ZXJ3cml0ZVwiKTtcblxuICAgICAgc2lnbmFsKHRoaXMsIFwib3ZlcndyaXRlVG9nZ2xlXCIsIHRoaXMsIHRoaXMuc3RhdGUub3ZlcndyaXRlKTtcbiAgICB9LFxuICAgIGhhc0ZvY3VzOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZGlzcGxheS5pbnB1dC5nZXRGaWVsZCgpID09IGFjdGl2ZUVsdCgpOyB9LFxuXG4gICAgc2Nyb2xsVG86IG1ldGhvZE9wKGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAgIGlmICh4ICE9IG51bGwgfHwgeSAhPSBudWxsKSByZXNvbHZlU2Nyb2xsVG9Qb3ModGhpcyk7XG4gICAgICBpZiAoeCAhPSBudWxsKSB0aGlzLmN1ck9wLnNjcm9sbExlZnQgPSB4O1xuICAgICAgaWYgKHkgIT0gbnVsbCkgdGhpcy5jdXJPcC5zY3JvbGxUb3AgPSB5O1xuICAgIH0pLFxuICAgIGdldFNjcm9sbEluZm86IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNjcm9sbGVyID0gdGhpcy5kaXNwbGF5LnNjcm9sbGVyO1xuICAgICAgcmV0dXJuIHtsZWZ0OiBzY3JvbGxlci5zY3JvbGxMZWZ0LCB0b3A6IHNjcm9sbGVyLnNjcm9sbFRvcCxcbiAgICAgICAgICAgICAgaGVpZ2h0OiBzY3JvbGxlci5zY3JvbGxIZWlnaHQgLSBzY3JvbGxHYXAodGhpcykgLSB0aGlzLmRpc3BsYXkuYmFySGVpZ2h0LFxuICAgICAgICAgICAgICB3aWR0aDogc2Nyb2xsZXIuc2Nyb2xsV2lkdGggLSBzY3JvbGxHYXAodGhpcykgLSB0aGlzLmRpc3BsYXkuYmFyV2lkdGgsXG4gICAgICAgICAgICAgIGNsaWVudEhlaWdodDogZGlzcGxheUhlaWdodCh0aGlzKSwgY2xpZW50V2lkdGg6IGRpc3BsYXlXaWR0aCh0aGlzKX07XG4gICAgfSxcblxuICAgIHNjcm9sbEludG9WaWV3OiBtZXRob2RPcChmdW5jdGlvbihyYW5nZSwgbWFyZ2luKSB7XG4gICAgICBpZiAocmFuZ2UgPT0gbnVsbCkge1xuICAgICAgICByYW5nZSA9IHtmcm9tOiB0aGlzLmRvYy5zZWwucHJpbWFyeSgpLmhlYWQsIHRvOiBudWxsfTtcbiAgICAgICAgaWYgKG1hcmdpbiA9PSBudWxsKSBtYXJnaW4gPSB0aGlzLm9wdGlvbnMuY3Vyc29yU2Nyb2xsTWFyZ2luO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcmFuZ2UgPT0gXCJudW1iZXJcIikge1xuICAgICAgICByYW5nZSA9IHtmcm9tOiBQb3MocmFuZ2UsIDApLCB0bzogbnVsbH07XG4gICAgICB9IGVsc2UgaWYgKHJhbmdlLmZyb20gPT0gbnVsbCkge1xuICAgICAgICByYW5nZSA9IHtmcm9tOiByYW5nZSwgdG86IG51bGx9O1xuICAgICAgfVxuICAgICAgaWYgKCFyYW5nZS50bykgcmFuZ2UudG8gPSByYW5nZS5mcm9tO1xuICAgICAgcmFuZ2UubWFyZ2luID0gbWFyZ2luIHx8IDA7XG5cbiAgICAgIGlmIChyYW5nZS5mcm9tLmxpbmUgIT0gbnVsbCkge1xuICAgICAgICByZXNvbHZlU2Nyb2xsVG9Qb3ModGhpcyk7XG4gICAgICAgIHRoaXMuY3VyT3Auc2Nyb2xsVG9Qb3MgPSByYW5nZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBzUG9zID0gY2FsY3VsYXRlU2Nyb2xsUG9zKHRoaXMsIE1hdGgubWluKHJhbmdlLmZyb20ubGVmdCwgcmFuZ2UudG8ubGVmdCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWluKHJhbmdlLmZyb20udG9wLCByYW5nZS50by50b3ApIC0gcmFuZ2UubWFyZ2luLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChyYW5nZS5mcm9tLnJpZ2h0LCByYW5nZS50by5yaWdodCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHJhbmdlLmZyb20uYm90dG9tLCByYW5nZS50by5ib3R0b20pICsgcmFuZ2UubWFyZ2luKTtcbiAgICAgICAgdGhpcy5zY3JvbGxUbyhzUG9zLnNjcm9sbExlZnQsIHNQb3Muc2Nyb2xsVG9wKTtcbiAgICAgIH1cbiAgICB9KSxcblxuICAgIHNldFNpemU6IG1ldGhvZE9wKGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgIHZhciBjbSA9IHRoaXM7XG4gICAgICBmdW5jdGlvbiBpbnRlcnByZXQodmFsKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgdmFsID09IFwibnVtYmVyXCIgfHwgL15cXGQrJC8udGVzdChTdHJpbmcodmFsKSkgPyB2YWwgKyBcInB4XCIgOiB2YWw7XG4gICAgICB9XG4gICAgICBpZiAod2lkdGggIT0gbnVsbCkgY20uZGlzcGxheS53cmFwcGVyLnN0eWxlLndpZHRoID0gaW50ZXJwcmV0KHdpZHRoKTtcbiAgICAgIGlmIChoZWlnaHQgIT0gbnVsbCkgY20uZGlzcGxheS53cmFwcGVyLnN0eWxlLmhlaWdodCA9IGludGVycHJldChoZWlnaHQpO1xuICAgICAgaWYgKGNtLm9wdGlvbnMubGluZVdyYXBwaW5nKSBjbGVhckxpbmVNZWFzdXJlbWVudENhY2hlKHRoaXMpO1xuICAgICAgdmFyIGxpbmVObyA9IGNtLmRpc3BsYXkudmlld0Zyb207XG4gICAgICBjbS5kb2MuaXRlcihsaW5lTm8sIGNtLmRpc3BsYXkudmlld1RvLCBmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgIGlmIChsaW5lLndpZGdldHMpIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZS53aWRnZXRzLmxlbmd0aDsgaSsrKVxuICAgICAgICAgIGlmIChsaW5lLndpZGdldHNbaV0ubm9IU2Nyb2xsKSB7IHJlZ0xpbmVDaGFuZ2UoY20sIGxpbmVObywgXCJ3aWRnZXRcIik7IGJyZWFrOyB9XG4gICAgICAgICsrbGluZU5vO1xuICAgICAgfSk7XG4gICAgICBjbS5jdXJPcC5mb3JjZVVwZGF0ZSA9IHRydWU7XG4gICAgICBzaWduYWwoY20sIFwicmVmcmVzaFwiLCB0aGlzKTtcbiAgICB9KSxcblxuICAgIG9wZXJhdGlvbjogZnVuY3Rpb24oZil7cmV0dXJuIHJ1bkluT3AodGhpcywgZik7fSxcblxuICAgIHJlZnJlc2g6IG1ldGhvZE9wKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG9sZEhlaWdodCA9IHRoaXMuZGlzcGxheS5jYWNoZWRUZXh0SGVpZ2h0O1xuICAgICAgcmVnQ2hhbmdlKHRoaXMpO1xuICAgICAgdGhpcy5jdXJPcC5mb3JjZVVwZGF0ZSA9IHRydWU7XG4gICAgICBjbGVhckNhY2hlcyh0aGlzKTtcbiAgICAgIHRoaXMuc2Nyb2xsVG8odGhpcy5kb2Muc2Nyb2xsTGVmdCwgdGhpcy5kb2Muc2Nyb2xsVG9wKTtcbiAgICAgIHVwZGF0ZUd1dHRlclNwYWNlKHRoaXMpO1xuICAgICAgaWYgKG9sZEhlaWdodCA9PSBudWxsIHx8IE1hdGguYWJzKG9sZEhlaWdodCAtIHRleHRIZWlnaHQodGhpcy5kaXNwbGF5KSkgPiAuNSlcbiAgICAgICAgZXN0aW1hdGVMaW5lSGVpZ2h0cyh0aGlzKTtcbiAgICAgIHNpZ25hbCh0aGlzLCBcInJlZnJlc2hcIiwgdGhpcyk7XG4gICAgfSksXG5cbiAgICBzd2FwRG9jOiBtZXRob2RPcChmdW5jdGlvbihkb2MpIHtcbiAgICAgIHZhciBvbGQgPSB0aGlzLmRvYztcbiAgICAgIG9sZC5jbSA9IG51bGw7XG4gICAgICBhdHRhY2hEb2ModGhpcywgZG9jKTtcbiAgICAgIGNsZWFyQ2FjaGVzKHRoaXMpO1xuICAgICAgdGhpcy5kaXNwbGF5LmlucHV0LnJlc2V0KCk7XG4gICAgICB0aGlzLnNjcm9sbFRvKGRvYy5zY3JvbGxMZWZ0LCBkb2Muc2Nyb2xsVG9wKTtcbiAgICAgIHRoaXMuY3VyT3AuZm9yY2VTY3JvbGwgPSB0cnVlO1xuICAgICAgc2lnbmFsTGF0ZXIodGhpcywgXCJzd2FwRG9jXCIsIHRoaXMsIG9sZCk7XG4gICAgICByZXR1cm4gb2xkO1xuICAgIH0pLFxuXG4gICAgZ2V0SW5wdXRGaWVsZDogZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kaXNwbGF5LmlucHV0LmdldEZpZWxkKCk7fSxcbiAgICBnZXRXcmFwcGVyRWxlbWVudDogZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kaXNwbGF5LndyYXBwZXI7fSxcbiAgICBnZXRTY3JvbGxlckVsZW1lbnQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZGlzcGxheS5zY3JvbGxlcjt9LFxuICAgIGdldEd1dHRlckVsZW1lbnQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZGlzcGxheS5ndXR0ZXJzO31cbiAgfTtcbiAgZXZlbnRNaXhpbihDb2RlTWlycm9yKTtcblxuICAvLyBPUFRJT04gREVGQVVMVFNcblxuICAvLyBUaGUgZGVmYXVsdCBjb25maWd1cmF0aW9uIG9wdGlvbnMuXG4gIHZhciBkZWZhdWx0cyA9IENvZGVNaXJyb3IuZGVmYXVsdHMgPSB7fTtcbiAgLy8gRnVuY3Rpb25zIHRvIHJ1biB3aGVuIG9wdGlvbnMgYXJlIGNoYW5nZWQuXG4gIHZhciBvcHRpb25IYW5kbGVycyA9IENvZGVNaXJyb3Iub3B0aW9uSGFuZGxlcnMgPSB7fTtcblxuICBmdW5jdGlvbiBvcHRpb24obmFtZSwgZGVmbHQsIGhhbmRsZSwgbm90T25Jbml0KSB7XG4gICAgQ29kZU1pcnJvci5kZWZhdWx0c1tuYW1lXSA9IGRlZmx0O1xuICAgIGlmIChoYW5kbGUpIG9wdGlvbkhhbmRsZXJzW25hbWVdID1cbiAgICAgIG5vdE9uSW5pdCA/IGZ1bmN0aW9uKGNtLCB2YWwsIG9sZCkge2lmIChvbGQgIT0gSW5pdCkgaGFuZGxlKGNtLCB2YWwsIG9sZCk7fSA6IGhhbmRsZTtcbiAgfVxuXG4gIC8vIFBhc3NlZCB0byBvcHRpb24gaGFuZGxlcnMgd2hlbiB0aGVyZSBpcyBubyBvbGQgdmFsdWUuXG4gIHZhciBJbml0ID0gQ29kZU1pcnJvci5Jbml0ID0ge3RvU3RyaW5nOiBmdW5jdGlvbigpe3JldHVybiBcIkNvZGVNaXJyb3IuSW5pdFwiO319O1xuXG4gIC8vIFRoZXNlIHR3byBhcmUsIG9uIGluaXQsIGNhbGxlZCBmcm9tIHRoZSBjb25zdHJ1Y3RvciBiZWNhdXNlIHRoZXlcbiAgLy8gaGF2ZSB0byBiZSBpbml0aWFsaXplZCBiZWZvcmUgdGhlIGVkaXRvciBjYW4gc3RhcnQgYXQgYWxsLlxuICBvcHRpb24oXCJ2YWx1ZVwiLCBcIlwiLCBmdW5jdGlvbihjbSwgdmFsKSB7XG4gICAgY20uc2V0VmFsdWUodmFsKTtcbiAgfSwgdHJ1ZSk7XG4gIG9wdGlvbihcIm1vZGVcIiwgbnVsbCwgZnVuY3Rpb24oY20sIHZhbCkge1xuICAgIGNtLmRvYy5tb2RlT3B0aW9uID0gdmFsO1xuICAgIGxvYWRNb2RlKGNtKTtcbiAgfSwgdHJ1ZSk7XG5cbiAgb3B0aW9uKFwiaW5kZW50VW5pdFwiLCAyLCBsb2FkTW9kZSwgdHJ1ZSk7XG4gIG9wdGlvbihcImluZGVudFdpdGhUYWJzXCIsIGZhbHNlKTtcbiAgb3B0aW9uKFwic21hcnRJbmRlbnRcIiwgdHJ1ZSk7XG4gIG9wdGlvbihcInRhYlNpemVcIiwgNCwgZnVuY3Rpb24oY20pIHtcbiAgICByZXNldE1vZGVTdGF0ZShjbSk7XG4gICAgY2xlYXJDYWNoZXMoY20pO1xuICAgIHJlZ0NoYW5nZShjbSk7XG4gIH0sIHRydWUpO1xuICBvcHRpb24oXCJsaW5lU2VwYXJhdG9yXCIsIG51bGwsIGZ1bmN0aW9uKGNtLCB2YWwpIHtcbiAgICBjbS5kb2MubGluZVNlcCA9IHZhbDtcbiAgICBpZiAoIXZhbCkgcmV0dXJuO1xuICAgIHZhciBuZXdCcmVha3MgPSBbXSwgbGluZU5vID0gY20uZG9jLmZpcnN0O1xuICAgIGNtLmRvYy5pdGVyKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgIGZvciAodmFyIHBvcyA9IDA7Oykge1xuICAgICAgICB2YXIgZm91bmQgPSBsaW5lLnRleHQuaW5kZXhPZih2YWwsIHBvcyk7XG4gICAgICAgIGlmIChmb3VuZCA9PSAtMSkgYnJlYWs7XG4gICAgICAgIHBvcyA9IGZvdW5kICsgdmFsLmxlbmd0aDtcbiAgICAgICAgbmV3QnJlYWtzLnB1c2goUG9zKGxpbmVObywgZm91bmQpKTtcbiAgICAgIH1cbiAgICAgIGxpbmVObysrO1xuICAgIH0pO1xuICAgIGZvciAodmFyIGkgPSBuZXdCcmVha3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pXG4gICAgICByZXBsYWNlUmFuZ2UoY20uZG9jLCB2YWwsIG5ld0JyZWFrc1tpXSwgUG9zKG5ld0JyZWFrc1tpXS5saW5lLCBuZXdCcmVha3NbaV0uY2ggKyB2YWwubGVuZ3RoKSlcbiAgfSk7XG4gIG9wdGlvbihcInNwZWNpYWxDaGFyc1wiLCAvW1xcdFxcdTAwMDAtXFx1MDAxOVxcdTAwYWRcXHUyMDBiLVxcdTIwMGZcXHUyMDI4XFx1MjAyOVxcdWZlZmZdL2csIGZ1bmN0aW9uKGNtLCB2YWwsIG9sZCkge1xuICAgIGNtLnN0YXRlLnNwZWNpYWxDaGFycyA9IG5ldyBSZWdFeHAodmFsLnNvdXJjZSArICh2YWwudGVzdChcIlxcdFwiKSA/IFwiXCIgOiBcInxcXHRcIiksIFwiZ1wiKTtcbiAgICBpZiAob2xkICE9IENvZGVNaXJyb3IuSW5pdCkgY20ucmVmcmVzaCgpO1xuICB9KTtcbiAgb3B0aW9uKFwic3BlY2lhbENoYXJQbGFjZWhvbGRlclwiLCBkZWZhdWx0U3BlY2lhbENoYXJQbGFjZWhvbGRlciwgZnVuY3Rpb24oY20pIHtjbS5yZWZyZXNoKCk7fSwgdHJ1ZSk7XG4gIG9wdGlvbihcImVsZWN0cmljQ2hhcnNcIiwgdHJ1ZSk7XG4gIG9wdGlvbihcImlucHV0U3R5bGVcIiwgbW9iaWxlID8gXCJjb250ZW50ZWRpdGFibGVcIiA6IFwidGV4dGFyZWFcIiwgZnVuY3Rpb24oKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiaW5wdXRTdHlsZSBjYW4gbm90ICh5ZXQpIGJlIGNoYW5nZWQgaW4gYSBydW5uaW5nIGVkaXRvclwiKTsgLy8gRklYTUVcbiAgfSwgdHJ1ZSk7XG4gIG9wdGlvbihcInJ0bE1vdmVWaXN1YWxseVwiLCAhd2luZG93cyk7XG4gIG9wdGlvbihcIndob2xlTGluZVVwZGF0ZUJlZm9yZVwiLCB0cnVlKTtcblxuICBvcHRpb24oXCJ0aGVtZVwiLCBcImRlZmF1bHRcIiwgZnVuY3Rpb24oY20pIHtcbiAgICB0aGVtZUNoYW5nZWQoY20pO1xuICAgIGd1dHRlcnNDaGFuZ2VkKGNtKTtcbiAgfSwgdHJ1ZSk7XG4gIG9wdGlvbihcImtleU1hcFwiLCBcImRlZmF1bHRcIiwgZnVuY3Rpb24oY20sIHZhbCwgb2xkKSB7XG4gICAgdmFyIG5leHQgPSBnZXRLZXlNYXAodmFsKTtcbiAgICB2YXIgcHJldiA9IG9sZCAhPSBDb2RlTWlycm9yLkluaXQgJiYgZ2V0S2V5TWFwKG9sZCk7XG4gICAgaWYgKHByZXYgJiYgcHJldi5kZXRhY2gpIHByZXYuZGV0YWNoKGNtLCBuZXh0KTtcbiAgICBpZiAobmV4dC5hdHRhY2gpIG5leHQuYXR0YWNoKGNtLCBwcmV2IHx8IG51bGwpO1xuICB9KTtcbiAgb3B0aW9uKFwiZXh0cmFLZXlzXCIsIG51bGwpO1xuXG4gIG9wdGlvbihcImxpbmVXcmFwcGluZ1wiLCBmYWxzZSwgd3JhcHBpbmdDaGFuZ2VkLCB0cnVlKTtcbiAgb3B0aW9uKFwiZ3V0dGVyc1wiLCBbXSwgZnVuY3Rpb24oY20pIHtcbiAgICBzZXRHdXR0ZXJzRm9yTGluZU51bWJlcnMoY20ub3B0aW9ucyk7XG4gICAgZ3V0dGVyc0NoYW5nZWQoY20pO1xuICB9LCB0cnVlKTtcbiAgb3B0aW9uKFwiZml4ZWRHdXR0ZXJcIiwgdHJ1ZSwgZnVuY3Rpb24oY20sIHZhbCkge1xuICAgIGNtLmRpc3BsYXkuZ3V0dGVycy5zdHlsZS5sZWZ0ID0gdmFsID8gY29tcGVuc2F0ZUZvckhTY3JvbGwoY20uZGlzcGxheSkgKyBcInB4XCIgOiBcIjBcIjtcbiAgICBjbS5yZWZyZXNoKCk7XG4gIH0sIHRydWUpO1xuICBvcHRpb24oXCJjb3Zlckd1dHRlck5leHRUb1Njcm9sbGJhclwiLCBmYWxzZSwgZnVuY3Rpb24oY20pIHt1cGRhdGVTY3JvbGxiYXJzKGNtKTt9LCB0cnVlKTtcbiAgb3B0aW9uKFwic2Nyb2xsYmFyU3R5bGVcIiwgXCJuYXRpdmVcIiwgZnVuY3Rpb24oY20pIHtcbiAgICBpbml0U2Nyb2xsYmFycyhjbSk7XG4gICAgdXBkYXRlU2Nyb2xsYmFycyhjbSk7XG4gICAgY20uZGlzcGxheS5zY3JvbGxiYXJzLnNldFNjcm9sbFRvcChjbS5kb2Muc2Nyb2xsVG9wKTtcbiAgICBjbS5kaXNwbGF5LnNjcm9sbGJhcnMuc2V0U2Nyb2xsTGVmdChjbS5kb2Muc2Nyb2xsTGVmdCk7XG4gIH0sIHRydWUpO1xuICBvcHRpb24oXCJsaW5lTnVtYmVyc1wiLCBmYWxzZSwgZnVuY3Rpb24oY20pIHtcbiAgICBzZXRHdXR0ZXJzRm9yTGluZU51bWJlcnMoY20ub3B0aW9ucyk7XG4gICAgZ3V0dGVyc0NoYW5nZWQoY20pO1xuICB9LCB0cnVlKTtcbiAgb3B0aW9uKFwiZmlyc3RMaW5lTnVtYmVyXCIsIDEsIGd1dHRlcnNDaGFuZ2VkLCB0cnVlKTtcbiAgb3B0aW9uKFwibGluZU51bWJlckZvcm1hdHRlclwiLCBmdW5jdGlvbihpbnRlZ2VyKSB7cmV0dXJuIGludGVnZXI7fSwgZ3V0dGVyc0NoYW5nZWQsIHRydWUpO1xuICBvcHRpb24oXCJzaG93Q3Vyc29yV2hlblNlbGVjdGluZ1wiLCBmYWxzZSwgdXBkYXRlU2VsZWN0aW9uLCB0cnVlKTtcblxuICBvcHRpb24oXCJyZXNldFNlbGVjdGlvbk9uQ29udGV4dE1lbnVcIiwgdHJ1ZSk7XG4gIG9wdGlvbihcImxpbmVXaXNlQ29weUN1dFwiLCB0cnVlKTtcblxuICBvcHRpb24oXCJyZWFkT25seVwiLCBmYWxzZSwgZnVuY3Rpb24oY20sIHZhbCkge1xuICAgIGlmICh2YWwgPT0gXCJub2N1cnNvclwiKSB7XG4gICAgICBvbkJsdXIoY20pO1xuICAgICAgY20uZGlzcGxheS5pbnB1dC5ibHVyKCk7XG4gICAgICBjbS5kaXNwbGF5LmRpc2FibGVkID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY20uZGlzcGxheS5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIH1cbiAgICBjbS5kaXNwbGF5LmlucHV0LnJlYWRPbmx5Q2hhbmdlZCh2YWwpXG4gIH0pO1xuICBvcHRpb24oXCJkaXNhYmxlSW5wdXRcIiwgZmFsc2UsIGZ1bmN0aW9uKGNtLCB2YWwpIHtpZiAoIXZhbCkgY20uZGlzcGxheS5pbnB1dC5yZXNldCgpO30sIHRydWUpO1xuICBvcHRpb24oXCJkcmFnRHJvcFwiLCB0cnVlLCBkcmFnRHJvcENoYW5nZWQpO1xuICBvcHRpb24oXCJhbGxvd0Ryb3BGaWxlVHlwZXNcIiwgbnVsbCk7XG5cbiAgb3B0aW9uKFwiY3Vyc29yQmxpbmtSYXRlXCIsIDUzMCk7XG4gIG9wdGlvbihcImN1cnNvclNjcm9sbE1hcmdpblwiLCAwKTtcbiAgb3B0aW9uKFwiY3Vyc29ySGVpZ2h0XCIsIDEsIHVwZGF0ZVNlbGVjdGlvbiwgdHJ1ZSk7XG4gIG9wdGlvbihcInNpbmdsZUN1cnNvckhlaWdodFBlckxpbmVcIiwgdHJ1ZSwgdXBkYXRlU2VsZWN0aW9uLCB0cnVlKTtcbiAgb3B0aW9uKFwid29ya1RpbWVcIiwgMTAwKTtcbiAgb3B0aW9uKFwid29ya0RlbGF5XCIsIDEwMCk7XG4gIG9wdGlvbihcImZsYXR0ZW5TcGFuc1wiLCB0cnVlLCByZXNldE1vZGVTdGF0ZSwgdHJ1ZSk7XG4gIG9wdGlvbihcImFkZE1vZGVDbGFzc1wiLCBmYWxzZSwgcmVzZXRNb2RlU3RhdGUsIHRydWUpO1xuICBvcHRpb24oXCJwb2xsSW50ZXJ2YWxcIiwgMTAwKTtcbiAgb3B0aW9uKFwidW5kb0RlcHRoXCIsIDIwMCwgZnVuY3Rpb24oY20sIHZhbCl7Y20uZG9jLmhpc3RvcnkudW5kb0RlcHRoID0gdmFsO30pO1xuICBvcHRpb24oXCJoaXN0b3J5RXZlbnREZWxheVwiLCAxMjUwKTtcbiAgb3B0aW9uKFwidmlld3BvcnRNYXJnaW5cIiwgMTAsIGZ1bmN0aW9uKGNtKXtjbS5yZWZyZXNoKCk7fSwgdHJ1ZSk7XG4gIG9wdGlvbihcIm1heEhpZ2hsaWdodExlbmd0aFwiLCAxMDAwMCwgcmVzZXRNb2RlU3RhdGUsIHRydWUpO1xuICBvcHRpb24oXCJtb3ZlSW5wdXRXaXRoQ3Vyc29yXCIsIHRydWUsIGZ1bmN0aW9uKGNtLCB2YWwpIHtcbiAgICBpZiAoIXZhbCkgY20uZGlzcGxheS5pbnB1dC5yZXNldFBvc2l0aW9uKCk7XG4gIH0pO1xuXG4gIG9wdGlvbihcInRhYmluZGV4XCIsIG51bGwsIGZ1bmN0aW9uKGNtLCB2YWwpIHtcbiAgICBjbS5kaXNwbGF5LmlucHV0LmdldEZpZWxkKCkudGFiSW5kZXggPSB2YWwgfHwgXCJcIjtcbiAgfSk7XG4gIG9wdGlvbihcImF1dG9mb2N1c1wiLCBudWxsKTtcblxuICAvLyBNT0RFIERFRklOSVRJT04gQU5EIFFVRVJZSU5HXG5cbiAgLy8gS25vd24gbW9kZXMsIGJ5IG5hbWUgYW5kIGJ5IE1JTUVcbiAgdmFyIG1vZGVzID0gQ29kZU1pcnJvci5tb2RlcyA9IHt9LCBtaW1lTW9kZXMgPSBDb2RlTWlycm9yLm1pbWVNb2RlcyA9IHt9O1xuXG4gIC8vIEV4dHJhIGFyZ3VtZW50cyBhcmUgc3RvcmVkIGFzIHRoZSBtb2RlJ3MgZGVwZW5kZW5jaWVzLCB3aGljaCBpc1xuICAvLyB1c2VkIGJ5IChsZWdhY3kpIG1lY2hhbmlzbXMgbGlrZSBsb2FkbW9kZS5qcyB0byBhdXRvbWF0aWNhbGx5XG4gIC8vIGxvYWQgYSBtb2RlLiAoUHJlZmVycmVkIG1lY2hhbmlzbSBpcyB0aGUgcmVxdWlyZS9kZWZpbmUgY2FsbHMuKVxuICBDb2RlTWlycm9yLmRlZmluZU1vZGUgPSBmdW5jdGlvbihuYW1lLCBtb2RlKSB7XG4gICAgaWYgKCFDb2RlTWlycm9yLmRlZmF1bHRzLm1vZGUgJiYgbmFtZSAhPSBcIm51bGxcIikgQ29kZU1pcnJvci5kZWZhdWx0cy5tb2RlID0gbmFtZTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpXG4gICAgICBtb2RlLmRlcGVuZGVuY2llcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgbW9kZXNbbmFtZV0gPSBtb2RlO1xuICB9O1xuXG4gIENvZGVNaXJyb3IuZGVmaW5lTUlNRSA9IGZ1bmN0aW9uKG1pbWUsIHNwZWMpIHtcbiAgICBtaW1lTW9kZXNbbWltZV0gPSBzcGVjO1xuICB9O1xuXG4gIC8vIEdpdmVuIGEgTUlNRSB0eXBlLCBhIHtuYW1lLCAuLi5vcHRpb25zfSBjb25maWcgb2JqZWN0LCBvciBhIG5hbWVcbiAgLy8gc3RyaW5nLCByZXR1cm4gYSBtb2RlIGNvbmZpZyBvYmplY3QuXG4gIENvZGVNaXJyb3IucmVzb2x2ZU1vZGUgPSBmdW5jdGlvbihzcGVjKSB7XG4gICAgaWYgKHR5cGVvZiBzcGVjID09IFwic3RyaW5nXCIgJiYgbWltZU1vZGVzLmhhc093blByb3BlcnR5KHNwZWMpKSB7XG4gICAgICBzcGVjID0gbWltZU1vZGVzW3NwZWNdO1xuICAgIH0gZWxzZSBpZiAoc3BlYyAmJiB0eXBlb2Ygc3BlYy5uYW1lID09IFwic3RyaW5nXCIgJiYgbWltZU1vZGVzLmhhc093blByb3BlcnR5KHNwZWMubmFtZSkpIHtcbiAgICAgIHZhciBmb3VuZCA9IG1pbWVNb2Rlc1tzcGVjLm5hbWVdO1xuICAgICAgaWYgKHR5cGVvZiBmb3VuZCA9PSBcInN0cmluZ1wiKSBmb3VuZCA9IHtuYW1lOiBmb3VuZH07XG4gICAgICBzcGVjID0gY3JlYXRlT2JqKGZvdW5kLCBzcGVjKTtcbiAgICAgIHNwZWMubmFtZSA9IGZvdW5kLm5hbWU7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc3BlYyA9PSBcInN0cmluZ1wiICYmIC9eW1xcd1xcLV0rXFwvW1xcd1xcLV0rXFwreG1sJC8udGVzdChzcGVjKSkge1xuICAgICAgcmV0dXJuIENvZGVNaXJyb3IucmVzb2x2ZU1vZGUoXCJhcHBsaWNhdGlvbi94bWxcIik7XG4gICAgfVxuICAgIGlmICh0eXBlb2Ygc3BlYyA9PSBcInN0cmluZ1wiKSByZXR1cm4ge25hbWU6IHNwZWN9O1xuICAgIGVsc2UgcmV0dXJuIHNwZWMgfHwge25hbWU6IFwibnVsbFwifTtcbiAgfTtcblxuICAvLyBHaXZlbiBhIG1vZGUgc3BlYyAoYW55dGhpbmcgdGhhdCByZXNvbHZlTW9kZSBhY2NlcHRzKSwgZmluZCBhbmRcbiAgLy8gaW5pdGlhbGl6ZSBhbiBhY3R1YWwgbW9kZSBvYmplY3QuXG4gIENvZGVNaXJyb3IuZ2V0TW9kZSA9IGZ1bmN0aW9uKG9wdGlvbnMsIHNwZWMpIHtcbiAgICB2YXIgc3BlYyA9IENvZGVNaXJyb3IucmVzb2x2ZU1vZGUoc3BlYyk7XG4gICAgdmFyIG1mYWN0b3J5ID0gbW9kZXNbc3BlYy5uYW1lXTtcbiAgICBpZiAoIW1mYWN0b3J5KSByZXR1cm4gQ29kZU1pcnJvci5nZXRNb2RlKG9wdGlvbnMsIFwidGV4dC9wbGFpblwiKTtcbiAgICB2YXIgbW9kZU9iaiA9IG1mYWN0b3J5KG9wdGlvbnMsIHNwZWMpO1xuICAgIGlmIChtb2RlRXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eShzcGVjLm5hbWUpKSB7XG4gICAgICB2YXIgZXh0cyA9IG1vZGVFeHRlbnNpb25zW3NwZWMubmFtZV07XG4gICAgICBmb3IgKHZhciBwcm9wIGluIGV4dHMpIHtcbiAgICAgICAgaWYgKCFleHRzLmhhc093blByb3BlcnR5KHByb3ApKSBjb250aW51ZTtcbiAgICAgICAgaWYgKG1vZGVPYmouaGFzT3duUHJvcGVydHkocHJvcCkpIG1vZGVPYmpbXCJfXCIgKyBwcm9wXSA9IG1vZGVPYmpbcHJvcF07XG4gICAgICAgIG1vZGVPYmpbcHJvcF0gPSBleHRzW3Byb3BdO1xuICAgICAgfVxuICAgIH1cbiAgICBtb2RlT2JqLm5hbWUgPSBzcGVjLm5hbWU7XG4gICAgaWYgKHNwZWMuaGVscGVyVHlwZSkgbW9kZU9iai5oZWxwZXJUeXBlID0gc3BlYy5oZWxwZXJUeXBlO1xuICAgIGlmIChzcGVjLm1vZGVQcm9wcykgZm9yICh2YXIgcHJvcCBpbiBzcGVjLm1vZGVQcm9wcylcbiAgICAgIG1vZGVPYmpbcHJvcF0gPSBzcGVjLm1vZGVQcm9wc1twcm9wXTtcblxuICAgIHJldHVybiBtb2RlT2JqO1xuICB9O1xuXG4gIC8vIE1pbmltYWwgZGVmYXVsdCBtb2RlLlxuICBDb2RlTWlycm9yLmRlZmluZU1vZGUoXCJudWxsXCIsIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7dG9rZW46IGZ1bmN0aW9uKHN0cmVhbSkge3N0cmVhbS5za2lwVG9FbmQoKTt9fTtcbiAgfSk7XG4gIENvZGVNaXJyb3IuZGVmaW5lTUlNRShcInRleHQvcGxhaW5cIiwgXCJudWxsXCIpO1xuXG4gIC8vIFRoaXMgY2FuIGJlIHVzZWQgdG8gYXR0YWNoIHByb3BlcnRpZXMgdG8gbW9kZSBvYmplY3RzIGZyb21cbiAgLy8gb3V0c2lkZSB0aGUgYWN0dWFsIG1vZGUgZGVmaW5pdGlvbi5cbiAgdmFyIG1vZGVFeHRlbnNpb25zID0gQ29kZU1pcnJvci5tb2RlRXh0ZW5zaW9ucyA9IHt9O1xuICBDb2RlTWlycm9yLmV4dGVuZE1vZGUgPSBmdW5jdGlvbihtb2RlLCBwcm9wZXJ0aWVzKSB7XG4gICAgdmFyIGV4dHMgPSBtb2RlRXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eShtb2RlKSA/IG1vZGVFeHRlbnNpb25zW21vZGVdIDogKG1vZGVFeHRlbnNpb25zW21vZGVdID0ge30pO1xuICAgIGNvcHlPYmoocHJvcGVydGllcywgZXh0cyk7XG4gIH07XG5cbiAgLy8gRVhURU5TSU9OU1xuXG4gIENvZGVNaXJyb3IuZGVmaW5lRXh0ZW5zaW9uID0gZnVuY3Rpb24obmFtZSwgZnVuYykge1xuICAgIENvZGVNaXJyb3IucHJvdG90eXBlW25hbWVdID0gZnVuYztcbiAgfTtcbiAgQ29kZU1pcnJvci5kZWZpbmVEb2NFeHRlbnNpb24gPSBmdW5jdGlvbihuYW1lLCBmdW5jKSB7XG4gICAgRG9jLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmM7XG4gIH07XG4gIENvZGVNaXJyb3IuZGVmaW5lT3B0aW9uID0gb3B0aW9uO1xuXG4gIHZhciBpbml0SG9va3MgPSBbXTtcbiAgQ29kZU1pcnJvci5kZWZpbmVJbml0SG9vayA9IGZ1bmN0aW9uKGYpIHtpbml0SG9va3MucHVzaChmKTt9O1xuXG4gIHZhciBoZWxwZXJzID0gQ29kZU1pcnJvci5oZWxwZXJzID0ge307XG4gIENvZGVNaXJyb3IucmVnaXN0ZXJIZWxwZXIgPSBmdW5jdGlvbih0eXBlLCBuYW1lLCB2YWx1ZSkge1xuICAgIGlmICghaGVscGVycy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkgaGVscGVyc1t0eXBlXSA9IENvZGVNaXJyb3JbdHlwZV0gPSB7X2dsb2JhbDogW119O1xuICAgIGhlbHBlcnNbdHlwZV1bbmFtZV0gPSB2YWx1ZTtcbiAgfTtcbiAgQ29kZU1pcnJvci5yZWdpc3Rlckdsb2JhbEhlbHBlciA9IGZ1bmN0aW9uKHR5cGUsIG5hbWUsIHByZWRpY2F0ZSwgdmFsdWUpIHtcbiAgICBDb2RlTWlycm9yLnJlZ2lzdGVySGVscGVyKHR5cGUsIG5hbWUsIHZhbHVlKTtcbiAgICBoZWxwZXJzW3R5cGVdLl9nbG9iYWwucHVzaCh7cHJlZDogcHJlZGljYXRlLCB2YWw6IHZhbHVlfSk7XG4gIH07XG5cbiAgLy8gTU9ERSBTVEFURSBIQU5ETElOR1xuXG4gIC8vIFV0aWxpdHkgZnVuY3Rpb25zIGZvciB3b3JraW5nIHdpdGggc3RhdGUuIEV4cG9ydGVkIGJlY2F1c2UgbmVzdGVkXG4gIC8vIG1vZGVzIG5lZWQgdG8gZG8gdGhpcyBmb3IgdGhlaXIgaW5uZXIgbW9kZXMuXG5cbiAgdmFyIGNvcHlTdGF0ZSA9IENvZGVNaXJyb3IuY29weVN0YXRlID0gZnVuY3Rpb24obW9kZSwgc3RhdGUpIHtcbiAgICBpZiAoc3RhdGUgPT09IHRydWUpIHJldHVybiBzdGF0ZTtcbiAgICBpZiAobW9kZS5jb3B5U3RhdGUpIHJldHVybiBtb2RlLmNvcHlTdGF0ZShzdGF0ZSk7XG4gICAgdmFyIG5zdGF0ZSA9IHt9O1xuICAgIGZvciAodmFyIG4gaW4gc3RhdGUpIHtcbiAgICAgIHZhciB2YWwgPSBzdGF0ZVtuXTtcbiAgICAgIGlmICh2YWwgaW5zdGFuY2VvZiBBcnJheSkgdmFsID0gdmFsLmNvbmNhdChbXSk7XG4gICAgICBuc3RhdGVbbl0gPSB2YWw7XG4gICAgfVxuICAgIHJldHVybiBuc3RhdGU7XG4gIH07XG5cbiAgdmFyIHN0YXJ0U3RhdGUgPSBDb2RlTWlycm9yLnN0YXJ0U3RhdGUgPSBmdW5jdGlvbihtb2RlLCBhMSwgYTIpIHtcbiAgICByZXR1cm4gbW9kZS5zdGFydFN0YXRlID8gbW9kZS5zdGFydFN0YXRlKGExLCBhMikgOiB0cnVlO1xuICB9O1xuXG4gIC8vIEdpdmVuIGEgbW9kZSBhbmQgYSBzdGF0ZSAoZm9yIHRoYXQgbW9kZSksIGZpbmQgdGhlIGlubmVyIG1vZGUgYW5kXG4gIC8vIHN0YXRlIGF0IHRoZSBwb3NpdGlvbiB0aGF0IHRoZSBzdGF0ZSByZWZlcnMgdG8uXG4gIENvZGVNaXJyb3IuaW5uZXJNb2RlID0gZnVuY3Rpb24obW9kZSwgc3RhdGUpIHtcbiAgICB3aGlsZSAobW9kZS5pbm5lck1vZGUpIHtcbiAgICAgIHZhciBpbmZvID0gbW9kZS5pbm5lck1vZGUoc3RhdGUpO1xuICAgICAgaWYgKCFpbmZvIHx8IGluZm8ubW9kZSA9PSBtb2RlKSBicmVhaztcbiAgICAgIHN0YXRlID0gaW5mby5zdGF0ZTtcbiAgICAgIG1vZGUgPSBpbmZvLm1vZGU7XG4gICAgfVxuICAgIHJldHVybiBpbmZvIHx8IHttb2RlOiBtb2RlLCBzdGF0ZTogc3RhdGV9O1xuICB9O1xuXG4gIC8vIFNUQU5EQVJEIENPTU1BTkRTXG5cbiAgLy8gQ29tbWFuZHMgYXJlIHBhcmFtZXRlci1sZXNzIGFjdGlvbnMgdGhhdCBjYW4gYmUgcGVyZm9ybWVkIG9uIGFuXG4gIC8vIGVkaXRvciwgbW9zdGx5IHVzZWQgZm9yIGtleWJpbmRpbmdzLlxuICB2YXIgY29tbWFuZHMgPSBDb2RlTWlycm9yLmNvbW1hbmRzID0ge1xuICAgIHNlbGVjdEFsbDogZnVuY3Rpb24oY20pIHtjbS5zZXRTZWxlY3Rpb24oUG9zKGNtLmZpcnN0TGluZSgpLCAwKSwgUG9zKGNtLmxhc3RMaW5lKCkpLCBzZWxfZG9udFNjcm9sbCk7fSxcbiAgICBzaW5nbGVTZWxlY3Rpb246IGZ1bmN0aW9uKGNtKSB7XG4gICAgICBjbS5zZXRTZWxlY3Rpb24oY20uZ2V0Q3Vyc29yKFwiYW5jaG9yXCIpLCBjbS5nZXRDdXJzb3IoXCJoZWFkXCIpLCBzZWxfZG9udFNjcm9sbCk7XG4gICAgfSxcbiAgICBraWxsTGluZTogZnVuY3Rpb24oY20pIHtcbiAgICAgIGRlbGV0ZU5lYXJTZWxlY3Rpb24oY20sIGZ1bmN0aW9uKHJhbmdlKSB7XG4gICAgICAgIGlmIChyYW5nZS5lbXB0eSgpKSB7XG4gICAgICAgICAgdmFyIGxlbiA9IGdldExpbmUoY20uZG9jLCByYW5nZS5oZWFkLmxpbmUpLnRleHQubGVuZ3RoO1xuICAgICAgICAgIGlmIChyYW5nZS5oZWFkLmNoID09IGxlbiAmJiByYW5nZS5oZWFkLmxpbmUgPCBjbS5sYXN0TGluZSgpKVxuICAgICAgICAgICAgcmV0dXJuIHtmcm9tOiByYW5nZS5oZWFkLCB0bzogUG9zKHJhbmdlLmhlYWQubGluZSArIDEsIDApfTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXR1cm4ge2Zyb206IHJhbmdlLmhlYWQsIHRvOiBQb3MocmFuZ2UuaGVhZC5saW5lLCBsZW4pfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4ge2Zyb206IHJhbmdlLmZyb20oKSwgdG86IHJhbmdlLnRvKCl9O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGRlbGV0ZUxpbmU6IGZ1bmN0aW9uKGNtKSB7XG4gICAgICBkZWxldGVOZWFyU2VsZWN0aW9uKGNtLCBmdW5jdGlvbihyYW5nZSkge1xuICAgICAgICByZXR1cm4ge2Zyb206IFBvcyhyYW5nZS5mcm9tKCkubGluZSwgMCksXG4gICAgICAgICAgICAgICAgdG86IGNsaXBQb3MoY20uZG9jLCBQb3MocmFuZ2UudG8oKS5saW5lICsgMSwgMCkpfTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgZGVsTGluZUxlZnQ6IGZ1bmN0aW9uKGNtKSB7XG4gICAgICBkZWxldGVOZWFyU2VsZWN0aW9uKGNtLCBmdW5jdGlvbihyYW5nZSkge1xuICAgICAgICByZXR1cm4ge2Zyb206IFBvcyhyYW5nZS5mcm9tKCkubGluZSwgMCksIHRvOiByYW5nZS5mcm9tKCl9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBkZWxXcmFwcGVkTGluZUxlZnQ6IGZ1bmN0aW9uKGNtKSB7XG4gICAgICBkZWxldGVOZWFyU2VsZWN0aW9uKGNtLCBmdW5jdGlvbihyYW5nZSkge1xuICAgICAgICB2YXIgdG9wID0gY20uY2hhckNvb3JkcyhyYW5nZS5oZWFkLCBcImRpdlwiKS50b3AgKyA1O1xuICAgICAgICB2YXIgbGVmdFBvcyA9IGNtLmNvb3Jkc0NoYXIoe2xlZnQ6IDAsIHRvcDogdG9wfSwgXCJkaXZcIik7XG4gICAgICAgIHJldHVybiB7ZnJvbTogbGVmdFBvcywgdG86IHJhbmdlLmZyb20oKX07XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGRlbFdyYXBwZWRMaW5lUmlnaHQ6IGZ1bmN0aW9uKGNtKSB7XG4gICAgICBkZWxldGVOZWFyU2VsZWN0aW9uKGNtLCBmdW5jdGlvbihyYW5nZSkge1xuICAgICAgICB2YXIgdG9wID0gY20uY2hhckNvb3JkcyhyYW5nZS5oZWFkLCBcImRpdlwiKS50b3AgKyA1O1xuICAgICAgICB2YXIgcmlnaHRQb3MgPSBjbS5jb29yZHNDaGFyKHtsZWZ0OiBjbS5kaXNwbGF5LmxpbmVEaXYub2Zmc2V0V2lkdGggKyAxMDAsIHRvcDogdG9wfSwgXCJkaXZcIik7XG4gICAgICAgIHJldHVybiB7ZnJvbTogcmFuZ2UuZnJvbSgpLCB0bzogcmlnaHRQb3MgfTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgdW5kbzogZnVuY3Rpb24oY20pIHtjbS51bmRvKCk7fSxcbiAgICByZWRvOiBmdW5jdGlvbihjbSkge2NtLnJlZG8oKTt9LFxuICAgIHVuZG9TZWxlY3Rpb246IGZ1bmN0aW9uKGNtKSB7Y20udW5kb1NlbGVjdGlvbigpO30sXG4gICAgcmVkb1NlbGVjdGlvbjogZnVuY3Rpb24oY20pIHtjbS5yZWRvU2VsZWN0aW9uKCk7fSxcbiAgICBnb0RvY1N0YXJ0OiBmdW5jdGlvbihjbSkge2NtLmV4dGVuZFNlbGVjdGlvbihQb3MoY20uZmlyc3RMaW5lKCksIDApKTt9LFxuICAgIGdvRG9jRW5kOiBmdW5jdGlvbihjbSkge2NtLmV4dGVuZFNlbGVjdGlvbihQb3MoY20ubGFzdExpbmUoKSkpO30sXG4gICAgZ29MaW5lU3RhcnQ6IGZ1bmN0aW9uKGNtKSB7XG4gICAgICBjbS5leHRlbmRTZWxlY3Rpb25zQnkoZnVuY3Rpb24ocmFuZ2UpIHsgcmV0dXJuIGxpbmVTdGFydChjbSwgcmFuZ2UuaGVhZC5saW5lKTsgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7b3JpZ2luOiBcIittb3ZlXCIsIGJpYXM6IDF9KTtcbiAgICB9LFxuICAgIGdvTGluZVN0YXJ0U21hcnQ6IGZ1bmN0aW9uKGNtKSB7XG4gICAgICBjbS5leHRlbmRTZWxlY3Rpb25zQnkoZnVuY3Rpb24ocmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIGxpbmVTdGFydFNtYXJ0KGNtLCByYW5nZS5oZWFkKTtcbiAgICAgIH0sIHtvcmlnaW46IFwiK21vdmVcIiwgYmlhczogMX0pO1xuICAgIH0sXG4gICAgZ29MaW5lRW5kOiBmdW5jdGlvbihjbSkge1xuICAgICAgY20uZXh0ZW5kU2VsZWN0aW9uc0J5KGZ1bmN0aW9uKHJhbmdlKSB7IHJldHVybiBsaW5lRW5kKGNtLCByYW5nZS5oZWFkLmxpbmUpOyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtvcmlnaW46IFwiK21vdmVcIiwgYmlhczogLTF9KTtcbiAgICB9LFxuICAgIGdvTGluZVJpZ2h0OiBmdW5jdGlvbihjbSkge1xuICAgICAgY20uZXh0ZW5kU2VsZWN0aW9uc0J5KGZ1bmN0aW9uKHJhbmdlKSB7XG4gICAgICAgIHZhciB0b3AgPSBjbS5jaGFyQ29vcmRzKHJhbmdlLmhlYWQsIFwiZGl2XCIpLnRvcCArIDU7XG4gICAgICAgIHJldHVybiBjbS5jb29yZHNDaGFyKHtsZWZ0OiBjbS5kaXNwbGF5LmxpbmVEaXYub2Zmc2V0V2lkdGggKyAxMDAsIHRvcDogdG9wfSwgXCJkaXZcIik7XG4gICAgICB9LCBzZWxfbW92ZSk7XG4gICAgfSxcbiAgICBnb0xpbmVMZWZ0OiBmdW5jdGlvbihjbSkge1xuICAgICAgY20uZXh0ZW5kU2VsZWN0aW9uc0J5KGZ1bmN0aW9uKHJhbmdlKSB7XG4gICAgICAgIHZhciB0b3AgPSBjbS5jaGFyQ29vcmRzKHJhbmdlLmhlYWQsIFwiZGl2XCIpLnRvcCArIDU7XG4gICAgICAgIHJldHVybiBjbS5jb29yZHNDaGFyKHtsZWZ0OiAwLCB0b3A6IHRvcH0sIFwiZGl2XCIpO1xuICAgICAgfSwgc2VsX21vdmUpO1xuICAgIH0sXG4gICAgZ29MaW5lTGVmdFNtYXJ0OiBmdW5jdGlvbihjbSkge1xuICAgICAgY20uZXh0ZW5kU2VsZWN0aW9uc0J5KGZ1bmN0aW9uKHJhbmdlKSB7XG4gICAgICAgIHZhciB0b3AgPSBjbS5jaGFyQ29vcmRzKHJhbmdlLmhlYWQsIFwiZGl2XCIpLnRvcCArIDU7XG4gICAgICAgIHZhciBwb3MgPSBjbS5jb29yZHNDaGFyKHtsZWZ0OiAwLCB0b3A6IHRvcH0sIFwiZGl2XCIpO1xuICAgICAgICBpZiAocG9zLmNoIDwgY20uZ2V0TGluZShwb3MubGluZSkuc2VhcmNoKC9cXFMvKSkgcmV0dXJuIGxpbmVTdGFydFNtYXJ0KGNtLCByYW5nZS5oZWFkKTtcbiAgICAgICAgcmV0dXJuIHBvcztcbiAgICAgIH0sIHNlbF9tb3ZlKTtcbiAgICB9LFxuICAgIGdvTGluZVVwOiBmdW5jdGlvbihjbSkge2NtLm1vdmVWKC0xLCBcImxpbmVcIik7fSxcbiAgICBnb0xpbmVEb3duOiBmdW5jdGlvbihjbSkge2NtLm1vdmVWKDEsIFwibGluZVwiKTt9LFxuICAgIGdvUGFnZVVwOiBmdW5jdGlvbihjbSkge2NtLm1vdmVWKC0xLCBcInBhZ2VcIik7fSxcbiAgICBnb1BhZ2VEb3duOiBmdW5jdGlvbihjbSkge2NtLm1vdmVWKDEsIFwicGFnZVwiKTt9LFxuICAgIGdvQ2hhckxlZnQ6IGZ1bmN0aW9uKGNtKSB7Y20ubW92ZUgoLTEsIFwiY2hhclwiKTt9LFxuICAgIGdvQ2hhclJpZ2h0OiBmdW5jdGlvbihjbSkge2NtLm1vdmVIKDEsIFwiY2hhclwiKTt9LFxuICAgIGdvQ29sdW1uTGVmdDogZnVuY3Rpb24oY20pIHtjbS5tb3ZlSCgtMSwgXCJjb2x1bW5cIik7fSxcbiAgICBnb0NvbHVtblJpZ2h0OiBmdW5jdGlvbihjbSkge2NtLm1vdmVIKDEsIFwiY29sdW1uXCIpO30sXG4gICAgZ29Xb3JkTGVmdDogZnVuY3Rpb24oY20pIHtjbS5tb3ZlSCgtMSwgXCJ3b3JkXCIpO30sXG4gICAgZ29Hcm91cFJpZ2h0OiBmdW5jdGlvbihjbSkge2NtLm1vdmVIKDEsIFwiZ3JvdXBcIik7fSxcbiAgICBnb0dyb3VwTGVmdDogZnVuY3Rpb24oY20pIHtjbS5tb3ZlSCgtMSwgXCJncm91cFwiKTt9LFxuICAgIGdvV29yZFJpZ2h0OiBmdW5jdGlvbihjbSkge2NtLm1vdmVIKDEsIFwid29yZFwiKTt9LFxuICAgIGRlbENoYXJCZWZvcmU6IGZ1bmN0aW9uKGNtKSB7Y20uZGVsZXRlSCgtMSwgXCJjaGFyXCIpO30sXG4gICAgZGVsQ2hhckFmdGVyOiBmdW5jdGlvbihjbSkge2NtLmRlbGV0ZUgoMSwgXCJjaGFyXCIpO30sXG4gICAgZGVsV29yZEJlZm9yZTogZnVuY3Rpb24oY20pIHtjbS5kZWxldGVIKC0xLCBcIndvcmRcIik7fSxcbiAgICBkZWxXb3JkQWZ0ZXI6IGZ1bmN0aW9uKGNtKSB7Y20uZGVsZXRlSCgxLCBcIndvcmRcIik7fSxcbiAgICBkZWxHcm91cEJlZm9yZTogZnVuY3Rpb24oY20pIHtjbS5kZWxldGVIKC0xLCBcImdyb3VwXCIpO30sXG4gICAgZGVsR3JvdXBBZnRlcjogZnVuY3Rpb24oY20pIHtjbS5kZWxldGVIKDEsIFwiZ3JvdXBcIik7fSxcbiAgICBpbmRlbnRBdXRvOiBmdW5jdGlvbihjbSkge2NtLmluZGVudFNlbGVjdGlvbihcInNtYXJ0XCIpO30sXG4gICAgaW5kZW50TW9yZTogZnVuY3Rpb24oY20pIHtjbS5pbmRlbnRTZWxlY3Rpb24oXCJhZGRcIik7fSxcbiAgICBpbmRlbnRMZXNzOiBmdW5jdGlvbihjbSkge2NtLmluZGVudFNlbGVjdGlvbihcInN1YnRyYWN0XCIpO30sXG4gICAgaW5zZXJ0VGFiOiBmdW5jdGlvbihjbSkge2NtLnJlcGxhY2VTZWxlY3Rpb24oXCJcXHRcIik7fSxcbiAgICBpbnNlcnRTb2Z0VGFiOiBmdW5jdGlvbihjbSkge1xuICAgICAgdmFyIHNwYWNlcyA9IFtdLCByYW5nZXMgPSBjbS5saXN0U2VsZWN0aW9ucygpLCB0YWJTaXplID0gY20ub3B0aW9ucy50YWJTaXplO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHBvcyA9IHJhbmdlc1tpXS5mcm9tKCk7XG4gICAgICAgIHZhciBjb2wgPSBjb3VudENvbHVtbihjbS5nZXRMaW5lKHBvcy5saW5lKSwgcG9zLmNoLCB0YWJTaXplKTtcbiAgICAgICAgc3BhY2VzLnB1c2gobmV3IEFycmF5KHRhYlNpemUgLSBjb2wgJSB0YWJTaXplICsgMSkuam9pbihcIiBcIikpO1xuICAgICAgfVxuICAgICAgY20ucmVwbGFjZVNlbGVjdGlvbnMoc3BhY2VzKTtcbiAgICB9LFxuICAgIGRlZmF1bHRUYWI6IGZ1bmN0aW9uKGNtKSB7XG4gICAgICBpZiAoY20uc29tZXRoaW5nU2VsZWN0ZWQoKSkgY20uaW5kZW50U2VsZWN0aW9uKFwiYWRkXCIpO1xuICAgICAgZWxzZSBjbS5leGVjQ29tbWFuZChcImluc2VydFRhYlwiKTtcbiAgICB9LFxuICAgIHRyYW5zcG9zZUNoYXJzOiBmdW5jdGlvbihjbSkge1xuICAgICAgcnVuSW5PcChjbSwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByYW5nZXMgPSBjbS5saXN0U2VsZWN0aW9ucygpLCBuZXdTZWwgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgY3VyID0gcmFuZ2VzW2ldLmhlYWQsIGxpbmUgPSBnZXRMaW5lKGNtLmRvYywgY3VyLmxpbmUpLnRleHQ7XG4gICAgICAgICAgaWYgKGxpbmUpIHtcbiAgICAgICAgICAgIGlmIChjdXIuY2ggPT0gbGluZS5sZW5ndGgpIGN1ciA9IG5ldyBQb3MoY3VyLmxpbmUsIGN1ci5jaCAtIDEpO1xuICAgICAgICAgICAgaWYgKGN1ci5jaCA+IDApIHtcbiAgICAgICAgICAgICAgY3VyID0gbmV3IFBvcyhjdXIubGluZSwgY3VyLmNoICsgMSk7XG4gICAgICAgICAgICAgIGNtLnJlcGxhY2VSYW5nZShsaW5lLmNoYXJBdChjdXIuY2ggLSAxKSArIGxpbmUuY2hhckF0KGN1ci5jaCAtIDIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUG9zKGN1ci5saW5lLCBjdXIuY2ggLSAyKSwgY3VyLCBcIit0cmFuc3Bvc2VcIik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGN1ci5saW5lID4gY20uZG9jLmZpcnN0KSB7XG4gICAgICAgICAgICAgIHZhciBwcmV2ID0gZ2V0TGluZShjbS5kb2MsIGN1ci5saW5lIC0gMSkudGV4dDtcbiAgICAgICAgICAgICAgaWYgKHByZXYpXG4gICAgICAgICAgICAgICAgY20ucmVwbGFjZVJhbmdlKGxpbmUuY2hhckF0KDApICsgY20uZG9jLmxpbmVTZXBhcmF0b3IoKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXYuY2hhckF0KHByZXYubGVuZ3RoIC0gMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFBvcyhjdXIubGluZSAtIDEsIHByZXYubGVuZ3RoIC0gMSksIFBvcyhjdXIubGluZSwgMSksIFwiK3RyYW5zcG9zZVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgbmV3U2VsLnB1c2gobmV3IFJhbmdlKGN1ciwgY3VyKSk7XG4gICAgICAgIH1cbiAgICAgICAgY20uc2V0U2VsZWN0aW9ucyhuZXdTZWwpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBuZXdsaW5lQW5kSW5kZW50OiBmdW5jdGlvbihjbSkge1xuICAgICAgcnVuSW5PcChjbSwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBsZW4gPSBjbS5saXN0U2VsZWN0aW9ucygpLmxlbmd0aDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgIHZhciByYW5nZSA9IGNtLmxpc3RTZWxlY3Rpb25zKClbaV07XG4gICAgICAgICAgY20ucmVwbGFjZVJhbmdlKGNtLmRvYy5saW5lU2VwYXJhdG9yKCksIHJhbmdlLmFuY2hvciwgcmFuZ2UuaGVhZCwgXCIraW5wdXRcIik7XG4gICAgICAgICAgY20uaW5kZW50TGluZShyYW5nZS5mcm9tKCkubGluZSArIDEsIG51bGwsIHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIGVuc3VyZUN1cnNvclZpc2libGUoY20pO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICB0b2dnbGVPdmVyd3JpdGU6IGZ1bmN0aW9uKGNtKSB7Y20udG9nZ2xlT3ZlcndyaXRlKCk7fVxuICB9O1xuXG5cbiAgLy8gU1RBTkRBUkQgS0VZTUFQU1xuXG4gIHZhciBrZXlNYXAgPSBDb2RlTWlycm9yLmtleU1hcCA9IHt9O1xuXG4gIGtleU1hcC5iYXNpYyA9IHtcbiAgICBcIkxlZnRcIjogXCJnb0NoYXJMZWZ0XCIsIFwiUmlnaHRcIjogXCJnb0NoYXJSaWdodFwiLCBcIlVwXCI6IFwiZ29MaW5lVXBcIiwgXCJEb3duXCI6IFwiZ29MaW5lRG93blwiLFxuICAgIFwiRW5kXCI6IFwiZ29MaW5lRW5kXCIsIFwiSG9tZVwiOiBcImdvTGluZVN0YXJ0U21hcnRcIiwgXCJQYWdlVXBcIjogXCJnb1BhZ2VVcFwiLCBcIlBhZ2VEb3duXCI6IFwiZ29QYWdlRG93blwiLFxuICAgIFwiRGVsZXRlXCI6IFwiZGVsQ2hhckFmdGVyXCIsIFwiQmFja3NwYWNlXCI6IFwiZGVsQ2hhckJlZm9yZVwiLCBcIlNoaWZ0LUJhY2tzcGFjZVwiOiBcImRlbENoYXJCZWZvcmVcIixcbiAgICBcIlRhYlwiOiBcImRlZmF1bHRUYWJcIiwgXCJTaGlmdC1UYWJcIjogXCJpbmRlbnRBdXRvXCIsXG4gICAgXCJFbnRlclwiOiBcIm5ld2xpbmVBbmRJbmRlbnRcIiwgXCJJbnNlcnRcIjogXCJ0b2dnbGVPdmVyd3JpdGVcIixcbiAgICBcIkVzY1wiOiBcInNpbmdsZVNlbGVjdGlvblwiXG4gIH07XG4gIC8vIE5vdGUgdGhhdCB0aGUgc2F2ZSBhbmQgZmluZC1yZWxhdGVkIGNvbW1hbmRzIGFyZW4ndCBkZWZpbmVkIGJ5XG4gIC8vIGRlZmF1bHQuIFVzZXIgY29kZSBvciBhZGRvbnMgY2FuIGRlZmluZSB0aGVtLiBVbmtub3duIGNvbW1hbmRzXG4gIC8vIGFyZSBzaW1wbHkgaWdub3JlZC5cbiAga2V5TWFwLnBjRGVmYXVsdCA9IHtcbiAgICBcIkN0cmwtQVwiOiBcInNlbGVjdEFsbFwiLCBcIkN0cmwtRFwiOiBcImRlbGV0ZUxpbmVcIiwgXCJDdHJsLVpcIjogXCJ1bmRvXCIsIFwiU2hpZnQtQ3RybC1aXCI6IFwicmVkb1wiLCBcIkN0cmwtWVwiOiBcInJlZG9cIixcbiAgICBcIkN0cmwtSG9tZVwiOiBcImdvRG9jU3RhcnRcIiwgXCJDdHJsLUVuZFwiOiBcImdvRG9jRW5kXCIsIFwiQ3RybC1VcFwiOiBcImdvTGluZVVwXCIsIFwiQ3RybC1Eb3duXCI6IFwiZ29MaW5lRG93blwiLFxuICAgIFwiQ3RybC1MZWZ0XCI6IFwiZ29Hcm91cExlZnRcIiwgXCJDdHJsLVJpZ2h0XCI6IFwiZ29Hcm91cFJpZ2h0XCIsIFwiQWx0LUxlZnRcIjogXCJnb0xpbmVTdGFydFwiLCBcIkFsdC1SaWdodFwiOiBcImdvTGluZUVuZFwiLFxuICAgIFwiQ3RybC1CYWNrc3BhY2VcIjogXCJkZWxHcm91cEJlZm9yZVwiLCBcIkN0cmwtRGVsZXRlXCI6IFwiZGVsR3JvdXBBZnRlclwiLCBcIkN0cmwtU1wiOiBcInNhdmVcIiwgXCJDdHJsLUZcIjogXCJmaW5kXCIsXG4gICAgXCJDdHJsLUdcIjogXCJmaW5kTmV4dFwiLCBcIlNoaWZ0LUN0cmwtR1wiOiBcImZpbmRQcmV2XCIsIFwiU2hpZnQtQ3RybC1GXCI6IFwicmVwbGFjZVwiLCBcIlNoaWZ0LUN0cmwtUlwiOiBcInJlcGxhY2VBbGxcIixcbiAgICBcIkN0cmwtW1wiOiBcImluZGVudExlc3NcIiwgXCJDdHJsLV1cIjogXCJpbmRlbnRNb3JlXCIsXG4gICAgXCJDdHJsLVVcIjogXCJ1bmRvU2VsZWN0aW9uXCIsIFwiU2hpZnQtQ3RybC1VXCI6IFwicmVkb1NlbGVjdGlvblwiLCBcIkFsdC1VXCI6IFwicmVkb1NlbGVjdGlvblwiLFxuICAgIGZhbGx0aHJvdWdoOiBcImJhc2ljXCJcbiAgfTtcbiAgLy8gVmVyeSBiYXNpYyByZWFkbGluZS9lbWFjcy1zdHlsZSBiaW5kaW5ncywgd2hpY2ggYXJlIHN0YW5kYXJkIG9uIE1hYy5cbiAga2V5TWFwLmVtYWNzeSA9IHtcbiAgICBcIkN0cmwtRlwiOiBcImdvQ2hhclJpZ2h0XCIsIFwiQ3RybC1CXCI6IFwiZ29DaGFyTGVmdFwiLCBcIkN0cmwtUFwiOiBcImdvTGluZVVwXCIsIFwiQ3RybC1OXCI6IFwiZ29MaW5lRG93blwiLFxuICAgIFwiQWx0LUZcIjogXCJnb1dvcmRSaWdodFwiLCBcIkFsdC1CXCI6IFwiZ29Xb3JkTGVmdFwiLCBcIkN0cmwtQVwiOiBcImdvTGluZVN0YXJ0XCIsIFwiQ3RybC1FXCI6IFwiZ29MaW5lRW5kXCIsXG4gICAgXCJDdHJsLVZcIjogXCJnb1BhZ2VEb3duXCIsIFwiU2hpZnQtQ3RybC1WXCI6IFwiZ29QYWdlVXBcIiwgXCJDdHJsLURcIjogXCJkZWxDaGFyQWZ0ZXJcIiwgXCJDdHJsLUhcIjogXCJkZWxDaGFyQmVmb3JlXCIsXG4gICAgXCJBbHQtRFwiOiBcImRlbFdvcmRBZnRlclwiLCBcIkFsdC1CYWNrc3BhY2VcIjogXCJkZWxXb3JkQmVmb3JlXCIsIFwiQ3RybC1LXCI6IFwia2lsbExpbmVcIiwgXCJDdHJsLVRcIjogXCJ0cmFuc3Bvc2VDaGFyc1wiXG4gIH07XG4gIGtleU1hcC5tYWNEZWZhdWx0ID0ge1xuICAgIFwiQ21kLUFcIjogXCJzZWxlY3RBbGxcIiwgXCJDbWQtRFwiOiBcImRlbGV0ZUxpbmVcIiwgXCJDbWQtWlwiOiBcInVuZG9cIiwgXCJTaGlmdC1DbWQtWlwiOiBcInJlZG9cIiwgXCJDbWQtWVwiOiBcInJlZG9cIixcbiAgICBcIkNtZC1Ib21lXCI6IFwiZ29Eb2NTdGFydFwiLCBcIkNtZC1VcFwiOiBcImdvRG9jU3RhcnRcIiwgXCJDbWQtRW5kXCI6IFwiZ29Eb2NFbmRcIiwgXCJDbWQtRG93blwiOiBcImdvRG9jRW5kXCIsIFwiQWx0LUxlZnRcIjogXCJnb0dyb3VwTGVmdFwiLFxuICAgIFwiQWx0LVJpZ2h0XCI6IFwiZ29Hcm91cFJpZ2h0XCIsIFwiQ21kLUxlZnRcIjogXCJnb0xpbmVMZWZ0XCIsIFwiQ21kLVJpZ2h0XCI6IFwiZ29MaW5lUmlnaHRcIiwgXCJBbHQtQmFja3NwYWNlXCI6IFwiZGVsR3JvdXBCZWZvcmVcIixcbiAgICBcIkN0cmwtQWx0LUJhY2tzcGFjZVwiOiBcImRlbEdyb3VwQWZ0ZXJcIiwgXCJBbHQtRGVsZXRlXCI6IFwiZGVsR3JvdXBBZnRlclwiLCBcIkNtZC1TXCI6IFwic2F2ZVwiLCBcIkNtZC1GXCI6IFwiZmluZFwiLFxuICAgIFwiQ21kLUdcIjogXCJmaW5kTmV4dFwiLCBcIlNoaWZ0LUNtZC1HXCI6IFwiZmluZFByZXZcIiwgXCJDbWQtQWx0LUZcIjogXCJyZXBsYWNlXCIsIFwiU2hpZnQtQ21kLUFsdC1GXCI6IFwicmVwbGFjZUFsbFwiLFxuICAgIFwiQ21kLVtcIjogXCJpbmRlbnRMZXNzXCIsIFwiQ21kLV1cIjogXCJpbmRlbnRNb3JlXCIsIFwiQ21kLUJhY2tzcGFjZVwiOiBcImRlbFdyYXBwZWRMaW5lTGVmdFwiLCBcIkNtZC1EZWxldGVcIjogXCJkZWxXcmFwcGVkTGluZVJpZ2h0XCIsXG4gICAgXCJDbWQtVVwiOiBcInVuZG9TZWxlY3Rpb25cIiwgXCJTaGlmdC1DbWQtVVwiOiBcInJlZG9TZWxlY3Rpb25cIiwgXCJDdHJsLVVwXCI6IFwiZ29Eb2NTdGFydFwiLCBcIkN0cmwtRG93blwiOiBcImdvRG9jRW5kXCIsXG4gICAgZmFsbHRocm91Z2g6IFtcImJhc2ljXCIsIFwiZW1hY3N5XCJdXG4gIH07XG4gIGtleU1hcFtcImRlZmF1bHRcIl0gPSBtYWMgPyBrZXlNYXAubWFjRGVmYXVsdCA6IGtleU1hcC5wY0RlZmF1bHQ7XG5cbiAgLy8gS0VZTUFQIERJU1BBVENIXG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplS2V5TmFtZShuYW1lKSB7XG4gICAgdmFyIHBhcnRzID0gbmFtZS5zcGxpdCgvLSg/ISQpLyksIG5hbWUgPSBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXTtcbiAgICB2YXIgYWx0LCBjdHJsLCBzaGlmdCwgY21kO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICB2YXIgbW9kID0gcGFydHNbaV07XG4gICAgICBpZiAoL14oY21kfG1ldGF8bSkkL2kudGVzdChtb2QpKSBjbWQgPSB0cnVlO1xuICAgICAgZWxzZSBpZiAoL15hKGx0KT8kL2kudGVzdChtb2QpKSBhbHQgPSB0cnVlO1xuICAgICAgZWxzZSBpZiAoL14oY3xjdHJsfGNvbnRyb2wpJC9pLnRlc3QobW9kKSkgY3RybCA9IHRydWU7XG4gICAgICBlbHNlIGlmICgvXnMoaGlmdCkkL2kudGVzdChtb2QpKSBzaGlmdCA9IHRydWU7XG4gICAgICBlbHNlIHRocm93IG5ldyBFcnJvcihcIlVucmVjb2duaXplZCBtb2RpZmllciBuYW1lOiBcIiArIG1vZCk7XG4gICAgfVxuICAgIGlmIChhbHQpIG5hbWUgPSBcIkFsdC1cIiArIG5hbWU7XG4gICAgaWYgKGN0cmwpIG5hbWUgPSBcIkN0cmwtXCIgKyBuYW1lO1xuICAgIGlmIChjbWQpIG5hbWUgPSBcIkNtZC1cIiArIG5hbWU7XG4gICAgaWYgKHNoaWZ0KSBuYW1lID0gXCJTaGlmdC1cIiArIG5hbWU7XG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cblxuICAvLyBUaGlzIGlzIGEga2x1ZGdlIHRvIGtlZXAga2V5bWFwcyBtb3N0bHkgd29ya2luZyBhcyByYXcgb2JqZWN0c1xuICAvLyAoYmFja3dhcmRzIGNvbXBhdGliaWxpdHkpIHdoaWxlIGF0IHRoZSBzYW1lIHRpbWUgc3VwcG9ydCBmZWF0dXJlc1xuICAvLyBsaWtlIG5vcm1hbGl6YXRpb24gYW5kIG11bHRpLXN0cm9rZSBrZXkgYmluZGluZ3MuIEl0IGNvbXBpbGVzIGFcbiAgLy8gbmV3IG5vcm1hbGl6ZWQga2V5bWFwLCBhbmQgdGhlbiB1cGRhdGVzIHRoZSBvbGQgb2JqZWN0IHRvIHJlZmxlY3RcbiAgLy8gdGhpcy5cbiAgQ29kZU1pcnJvci5ub3JtYWxpemVLZXlNYXAgPSBmdW5jdGlvbihrZXltYXApIHtcbiAgICB2YXIgY29weSA9IHt9O1xuICAgIGZvciAodmFyIGtleW5hbWUgaW4ga2V5bWFwKSBpZiAoa2V5bWFwLmhhc093blByb3BlcnR5KGtleW5hbWUpKSB7XG4gICAgICB2YXIgdmFsdWUgPSBrZXltYXBba2V5bmFtZV07XG4gICAgICBpZiAoL14obmFtZXxmYWxsdGhyb3VnaHwoZGV8YXQpdGFjaCkkLy50ZXN0KGtleW5hbWUpKSBjb250aW51ZTtcbiAgICAgIGlmICh2YWx1ZSA9PSBcIi4uLlwiKSB7IGRlbGV0ZSBrZXltYXBba2V5bmFtZV07IGNvbnRpbnVlOyB9XG5cbiAgICAgIHZhciBrZXlzID0gbWFwKGtleW5hbWUuc3BsaXQoXCIgXCIpLCBub3JtYWxpemVLZXlOYW1lKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgdmFsLCBuYW1lO1xuICAgICAgICBpZiAoaSA9PSBrZXlzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICBuYW1lID0ga2V5cy5qb2luKFwiIFwiKTtcbiAgICAgICAgICB2YWwgPSB2YWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuYW1lID0ga2V5cy5zbGljZSgwLCBpICsgMSkuam9pbihcIiBcIik7XG4gICAgICAgICAgdmFsID0gXCIuLi5cIjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcHJldiA9IGNvcHlbbmFtZV07XG4gICAgICAgIGlmICghcHJldikgY29weVtuYW1lXSA9IHZhbDtcbiAgICAgICAgZWxzZSBpZiAocHJldiAhPSB2YWwpIHRocm93IG5ldyBFcnJvcihcIkluY29uc2lzdGVudCBiaW5kaW5ncyBmb3IgXCIgKyBuYW1lKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSBrZXltYXBba2V5bmFtZV07XG4gICAgfVxuICAgIGZvciAodmFyIHByb3AgaW4gY29weSkga2V5bWFwW3Byb3BdID0gY29weVtwcm9wXTtcbiAgICByZXR1cm4ga2V5bWFwO1xuICB9O1xuXG4gIHZhciBsb29rdXBLZXkgPSBDb2RlTWlycm9yLmxvb2t1cEtleSA9IGZ1bmN0aW9uKGtleSwgbWFwLCBoYW5kbGUsIGNvbnRleHQpIHtcbiAgICBtYXAgPSBnZXRLZXlNYXAobWFwKTtcbiAgICB2YXIgZm91bmQgPSBtYXAuY2FsbCA/IG1hcC5jYWxsKGtleSwgY29udGV4dCkgOiBtYXBba2V5XTtcbiAgICBpZiAoZm91bmQgPT09IGZhbHNlKSByZXR1cm4gXCJub3RoaW5nXCI7XG4gICAgaWYgKGZvdW5kID09PSBcIi4uLlwiKSByZXR1cm4gXCJtdWx0aVwiO1xuICAgIGlmIChmb3VuZCAhPSBudWxsICYmIGhhbmRsZShmb3VuZCkpIHJldHVybiBcImhhbmRsZWRcIjtcblxuICAgIGlmIChtYXAuZmFsbHRocm91Z2gpIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobWFwLmZhbGx0aHJvdWdoKSAhPSBcIltvYmplY3QgQXJyYXldXCIpXG4gICAgICAgIHJldHVybiBsb29rdXBLZXkoa2V5LCBtYXAuZmFsbHRocm91Z2gsIGhhbmRsZSwgY29udGV4dCk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hcC5mYWxsdGhyb3VnaC5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gbG9va3VwS2V5KGtleSwgbWFwLmZhbGx0aHJvdWdoW2ldLCBoYW5kbGUsIGNvbnRleHQpO1xuICAgICAgICBpZiAocmVzdWx0KSByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvLyBNb2RpZmllciBrZXkgcHJlc3NlcyBkb24ndCBjb3VudCBhcyAncmVhbCcga2V5IHByZXNzZXMgZm9yIHRoZVxuICAvLyBwdXJwb3NlIG9mIGtleW1hcCBmYWxsdGhyb3VnaC5cbiAgdmFyIGlzTW9kaWZpZXJLZXkgPSBDb2RlTWlycm9yLmlzTW9kaWZpZXJLZXkgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBuYW1lID0gdHlwZW9mIHZhbHVlID09IFwic3RyaW5nXCIgPyB2YWx1ZSA6IGtleU5hbWVzW3ZhbHVlLmtleUNvZGVdO1xuICAgIHJldHVybiBuYW1lID09IFwiQ3RybFwiIHx8IG5hbWUgPT0gXCJBbHRcIiB8fCBuYW1lID09IFwiU2hpZnRcIiB8fCBuYW1lID09IFwiTW9kXCI7XG4gIH07XG5cbiAgLy8gTG9vayB1cCB0aGUgbmFtZSBvZiBhIGtleSBhcyBpbmRpY2F0ZWQgYnkgYW4gZXZlbnQgb2JqZWN0LlxuICB2YXIga2V5TmFtZSA9IENvZGVNaXJyb3Iua2V5TmFtZSA9IGZ1bmN0aW9uKGV2ZW50LCBub1NoaWZ0KSB7XG4gICAgaWYgKHByZXN0byAmJiBldmVudC5rZXlDb2RlID09IDM0ICYmIGV2ZW50W1wiY2hhclwiXSkgcmV0dXJuIGZhbHNlO1xuICAgIHZhciBiYXNlID0ga2V5TmFtZXNbZXZlbnQua2V5Q29kZV0sIG5hbWUgPSBiYXNlO1xuICAgIGlmIChuYW1lID09IG51bGwgfHwgZXZlbnQuYWx0R3JhcGhLZXkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoZXZlbnQuYWx0S2V5ICYmIGJhc2UgIT0gXCJBbHRcIikgbmFtZSA9IFwiQWx0LVwiICsgbmFtZTtcbiAgICBpZiAoKGZsaXBDdHJsQ21kID8gZXZlbnQubWV0YUtleSA6IGV2ZW50LmN0cmxLZXkpICYmIGJhc2UgIT0gXCJDdHJsXCIpIG5hbWUgPSBcIkN0cmwtXCIgKyBuYW1lO1xuICAgIGlmICgoZmxpcEN0cmxDbWQgPyBldmVudC5jdHJsS2V5IDogZXZlbnQubWV0YUtleSkgJiYgYmFzZSAhPSBcIkNtZFwiKSBuYW1lID0gXCJDbWQtXCIgKyBuYW1lO1xuICAgIGlmICghbm9TaGlmdCAmJiBldmVudC5zaGlmdEtleSAmJiBiYXNlICE9IFwiU2hpZnRcIikgbmFtZSA9IFwiU2hpZnQtXCIgKyBuYW1lO1xuICAgIHJldHVybiBuYW1lO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGdldEtleU1hcCh2YWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbCA9PSBcInN0cmluZ1wiID8ga2V5TWFwW3ZhbF0gOiB2YWw7XG4gIH1cblxuICAvLyBGUk9NVEVYVEFSRUFcblxuICBDb2RlTWlycm9yLmZyb21UZXh0QXJlYSA9IGZ1bmN0aW9uKHRleHRhcmVhLCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgPyBjb3B5T2JqKG9wdGlvbnMpIDoge307XG4gICAgb3B0aW9ucy52YWx1ZSA9IHRleHRhcmVhLnZhbHVlO1xuICAgIGlmICghb3B0aW9ucy50YWJpbmRleCAmJiB0ZXh0YXJlYS50YWJJbmRleClcbiAgICAgIG9wdGlvbnMudGFiaW5kZXggPSB0ZXh0YXJlYS50YWJJbmRleDtcbiAgICBpZiAoIW9wdGlvbnMucGxhY2Vob2xkZXIgJiYgdGV4dGFyZWEucGxhY2Vob2xkZXIpXG4gICAgICBvcHRpb25zLnBsYWNlaG9sZGVyID0gdGV4dGFyZWEucGxhY2Vob2xkZXI7XG4gICAgLy8gU2V0IGF1dG9mb2N1cyB0byB0cnVlIGlmIHRoaXMgdGV4dGFyZWEgaXMgZm9jdXNlZCwgb3IgaWYgaXQgaGFzXG4gICAgLy8gYXV0b2ZvY3VzIGFuZCBubyBvdGhlciBlbGVtZW50IGlzIGZvY3VzZWQuXG4gICAgaWYgKG9wdGlvbnMuYXV0b2ZvY3VzID09IG51bGwpIHtcbiAgICAgIHZhciBoYXNGb2N1cyA9IGFjdGl2ZUVsdCgpO1xuICAgICAgb3B0aW9ucy5hdXRvZm9jdXMgPSBoYXNGb2N1cyA9PSB0ZXh0YXJlYSB8fFxuICAgICAgICB0ZXh0YXJlYS5nZXRBdHRyaWJ1dGUoXCJhdXRvZm9jdXNcIikgIT0gbnVsbCAmJiBoYXNGb2N1cyA9PSBkb2N1bWVudC5ib2R5O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNhdmUoKSB7dGV4dGFyZWEudmFsdWUgPSBjbS5nZXRWYWx1ZSgpO31cbiAgICBpZiAodGV4dGFyZWEuZm9ybSkge1xuICAgICAgb24odGV4dGFyZWEuZm9ybSwgXCJzdWJtaXRcIiwgc2F2ZSk7XG4gICAgICAvLyBEZXBsb3JhYmxlIGhhY2sgdG8gbWFrZSB0aGUgc3VibWl0IG1ldGhvZCBkbyB0aGUgcmlnaHQgdGhpbmcuXG4gICAgICBpZiAoIW9wdGlvbnMubGVhdmVTdWJtaXRNZXRob2RBbG9uZSkge1xuICAgICAgICB2YXIgZm9ybSA9IHRleHRhcmVhLmZvcm0sIHJlYWxTdWJtaXQgPSBmb3JtLnN1Ym1pdDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgd3JhcHBlZFN1Ym1pdCA9IGZvcm0uc3VibWl0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzYXZlKCk7XG4gICAgICAgICAgICBmb3JtLnN1Ym1pdCA9IHJlYWxTdWJtaXQ7XG4gICAgICAgICAgICBmb3JtLnN1Ym1pdCgpO1xuICAgICAgICAgICAgZm9ybS5zdWJtaXQgPSB3cmFwcGVkU3VibWl0O1xuICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2goZSkge31cbiAgICAgIH1cbiAgICB9XG5cbiAgICBvcHRpb25zLmZpbmlzaEluaXQgPSBmdW5jdGlvbihjbSkge1xuICAgICAgY20uc2F2ZSA9IHNhdmU7XG4gICAgICBjbS5nZXRUZXh0QXJlYSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGV4dGFyZWE7IH07XG4gICAgICBjbS50b1RleHRBcmVhID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNtLnRvVGV4dEFyZWEgPSBpc05hTjsgLy8gUHJldmVudCB0aGlzIGZyb20gYmVpbmcgcmFuIHR3aWNlXG4gICAgICAgIHNhdmUoKTtcbiAgICAgICAgdGV4dGFyZWEucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChjbS5nZXRXcmFwcGVyRWxlbWVudCgpKTtcbiAgICAgICAgdGV4dGFyZWEuc3R5bGUuZGlzcGxheSA9IFwiXCI7XG4gICAgICAgIGlmICh0ZXh0YXJlYS5mb3JtKSB7XG4gICAgICAgICAgb2ZmKHRleHRhcmVhLmZvcm0sIFwic3VibWl0XCIsIHNhdmUpO1xuICAgICAgICAgIGlmICh0eXBlb2YgdGV4dGFyZWEuZm9ybS5zdWJtaXQgPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgdGV4dGFyZWEuZm9ybS5zdWJtaXQgPSByZWFsU3VibWl0O1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH07XG5cbiAgICB0ZXh0YXJlYS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgdmFyIGNtID0gQ29kZU1pcnJvcihmdW5jdGlvbihub2RlKSB7XG4gICAgICB0ZXh0YXJlYS5wYXJlbnROb2RlLmluc2VydEJlZm9yZShub2RlLCB0ZXh0YXJlYS5uZXh0U2libGluZyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIGNtO1xuICB9O1xuXG4gIC8vIFNUUklORyBTVFJFQU1cblxuICAvLyBGZWQgdG8gdGhlIG1vZGUgcGFyc2VycywgcHJvdmlkZXMgaGVscGVyIGZ1bmN0aW9ucyB0byBtYWtlXG4gIC8vIHBhcnNlcnMgbW9yZSBzdWNjaW5jdC5cblxuICB2YXIgU3RyaW5nU3RyZWFtID0gQ29kZU1pcnJvci5TdHJpbmdTdHJlYW0gPSBmdW5jdGlvbihzdHJpbmcsIHRhYlNpemUpIHtcbiAgICB0aGlzLnBvcyA9IHRoaXMuc3RhcnQgPSAwO1xuICAgIHRoaXMuc3RyaW5nID0gc3RyaW5nO1xuICAgIHRoaXMudGFiU2l6ZSA9IHRhYlNpemUgfHwgODtcbiAgICB0aGlzLmxhc3RDb2x1bW5Qb3MgPSB0aGlzLmxhc3RDb2x1bW5WYWx1ZSA9IDA7XG4gICAgdGhpcy5saW5lU3RhcnQgPSAwO1xuICB9O1xuXG4gIFN0cmluZ1N0cmVhbS5wcm90b3R5cGUgPSB7XG4gICAgZW9sOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5wb3MgPj0gdGhpcy5zdHJpbmcubGVuZ3RoO30sXG4gICAgc29sOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5wb3MgPT0gdGhpcy5saW5lU3RhcnQ7fSxcbiAgICBwZWVrOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5zdHJpbmcuY2hhckF0KHRoaXMucG9zKSB8fCB1bmRlZmluZWQ7fSxcbiAgICBuZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnBvcyA8IHRoaXMuc3RyaW5nLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaW5nLmNoYXJBdCh0aGlzLnBvcysrKTtcbiAgICB9LFxuICAgIGVhdDogZnVuY3Rpb24obWF0Y2gpIHtcbiAgICAgIHZhciBjaCA9IHRoaXMuc3RyaW5nLmNoYXJBdCh0aGlzLnBvcyk7XG4gICAgICBpZiAodHlwZW9mIG1hdGNoID09IFwic3RyaW5nXCIpIHZhciBvayA9IGNoID09IG1hdGNoO1xuICAgICAgZWxzZSB2YXIgb2sgPSBjaCAmJiAobWF0Y2gudGVzdCA/IG1hdGNoLnRlc3QoY2gpIDogbWF0Y2goY2gpKTtcbiAgICAgIGlmIChvaykgeysrdGhpcy5wb3M7IHJldHVybiBjaDt9XG4gICAgfSxcbiAgICBlYXRXaGlsZTogZnVuY3Rpb24obWF0Y2gpIHtcbiAgICAgIHZhciBzdGFydCA9IHRoaXMucG9zO1xuICAgICAgd2hpbGUgKHRoaXMuZWF0KG1hdGNoKSl7fVxuICAgICAgcmV0dXJuIHRoaXMucG9zID4gc3RhcnQ7XG4gICAgfSxcbiAgICBlYXRTcGFjZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc3RhcnQgPSB0aGlzLnBvcztcbiAgICAgIHdoaWxlICgvW1xcc1xcdTAwYTBdLy50ZXN0KHRoaXMuc3RyaW5nLmNoYXJBdCh0aGlzLnBvcykpKSArK3RoaXMucG9zO1xuICAgICAgcmV0dXJuIHRoaXMucG9zID4gc3RhcnQ7XG4gICAgfSxcbiAgICBza2lwVG9FbmQ6IGZ1bmN0aW9uKCkge3RoaXMucG9zID0gdGhpcy5zdHJpbmcubGVuZ3RoO30sXG4gICAgc2tpcFRvOiBmdW5jdGlvbihjaCkge1xuICAgICAgdmFyIGZvdW5kID0gdGhpcy5zdHJpbmcuaW5kZXhPZihjaCwgdGhpcy5wb3MpO1xuICAgICAgaWYgKGZvdW5kID4gLTEpIHt0aGlzLnBvcyA9IGZvdW5kOyByZXR1cm4gdHJ1ZTt9XG4gICAgfSxcbiAgICBiYWNrVXA6IGZ1bmN0aW9uKG4pIHt0aGlzLnBvcyAtPSBuO30sXG4gICAgY29sdW1uOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmxhc3RDb2x1bW5Qb3MgPCB0aGlzLnN0YXJ0KSB7XG4gICAgICAgIHRoaXMubGFzdENvbHVtblZhbHVlID0gY291bnRDb2x1bW4odGhpcy5zdHJpbmcsIHRoaXMuc3RhcnQsIHRoaXMudGFiU2l6ZSwgdGhpcy5sYXN0Q29sdW1uUG9zLCB0aGlzLmxhc3RDb2x1bW5WYWx1ZSk7XG4gICAgICAgIHRoaXMubGFzdENvbHVtblBvcyA9IHRoaXMuc3RhcnQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5sYXN0Q29sdW1uVmFsdWUgLSAodGhpcy5saW5lU3RhcnQgPyBjb3VudENvbHVtbih0aGlzLnN0cmluZywgdGhpcy5saW5lU3RhcnQsIHRoaXMudGFiU2l6ZSkgOiAwKTtcbiAgICB9LFxuICAgIGluZGVudGF0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBjb3VudENvbHVtbih0aGlzLnN0cmluZywgbnVsbCwgdGhpcy50YWJTaXplKSAtXG4gICAgICAgICh0aGlzLmxpbmVTdGFydCA/IGNvdW50Q29sdW1uKHRoaXMuc3RyaW5nLCB0aGlzLmxpbmVTdGFydCwgdGhpcy50YWJTaXplKSA6IDApO1xuICAgIH0sXG4gICAgbWF0Y2g6IGZ1bmN0aW9uKHBhdHRlcm4sIGNvbnN1bWUsIGNhc2VJbnNlbnNpdGl2ZSkge1xuICAgICAgaWYgKHR5cGVvZiBwYXR0ZXJuID09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgdmFyIGNhc2VkID0gZnVuY3Rpb24oc3RyKSB7cmV0dXJuIGNhc2VJbnNlbnNpdGl2ZSA/IHN0ci50b0xvd2VyQ2FzZSgpIDogc3RyO307XG4gICAgICAgIHZhciBzdWJzdHIgPSB0aGlzLnN0cmluZy5zdWJzdHIodGhpcy5wb3MsIHBhdHRlcm4ubGVuZ3RoKTtcbiAgICAgICAgaWYgKGNhc2VkKHN1YnN0cikgPT0gY2FzZWQocGF0dGVybikpIHtcbiAgICAgICAgICBpZiAoY29uc3VtZSAhPT0gZmFsc2UpIHRoaXMucG9zICs9IHBhdHRlcm4ubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgbWF0Y2ggPSB0aGlzLnN0cmluZy5zbGljZSh0aGlzLnBvcykubWF0Y2gocGF0dGVybik7XG4gICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaC5pbmRleCA+IDApIHJldHVybiBudWxsO1xuICAgICAgICBpZiAobWF0Y2ggJiYgY29uc3VtZSAhPT0gZmFsc2UpIHRoaXMucG9zICs9IG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgICAgcmV0dXJuIG1hdGNoO1xuICAgICAgfVxuICAgIH0sXG4gICAgY3VycmVudDogZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5zdHJpbmcuc2xpY2UodGhpcy5zdGFydCwgdGhpcy5wb3MpO30sXG4gICAgaGlkZUZpcnN0Q2hhcnM6IGZ1bmN0aW9uKG4sIGlubmVyKSB7XG4gICAgICB0aGlzLmxpbmVTdGFydCArPSBuO1xuICAgICAgdHJ5IHsgcmV0dXJuIGlubmVyKCk7IH1cbiAgICAgIGZpbmFsbHkgeyB0aGlzLmxpbmVTdGFydCAtPSBuOyB9XG4gICAgfVxuICB9O1xuXG4gIC8vIFRFWFRNQVJLRVJTXG5cbiAgLy8gQ3JlYXRlZCB3aXRoIG1hcmtUZXh0IGFuZCBzZXRCb29rbWFyayBtZXRob2RzLiBBIFRleHRNYXJrZXIgaXMgYVxuICAvLyBoYW5kbGUgdGhhdCBjYW4gYmUgdXNlZCB0byBjbGVhciBvciBmaW5kIGEgbWFya2VkIHBvc2l0aW9uIGluIHRoZVxuICAvLyBkb2N1bWVudC4gTGluZSBvYmplY3RzIGhvbGQgYXJyYXlzIChtYXJrZWRTcGFucykgY29udGFpbmluZ1xuICAvLyB7ZnJvbSwgdG8sIG1hcmtlcn0gb2JqZWN0IHBvaW50aW5nIHRvIHN1Y2ggbWFya2VyIG9iamVjdHMsIGFuZFxuICAvLyBpbmRpY2F0aW5nIHRoYXQgc3VjaCBhIG1hcmtlciBpcyBwcmVzZW50IG9uIHRoYXQgbGluZS4gTXVsdGlwbGVcbiAgLy8gbGluZXMgbWF5IHBvaW50IHRvIHRoZSBzYW1lIG1hcmtlciB3aGVuIGl0IHNwYW5zIGFjcm9zcyBsaW5lcy5cbiAgLy8gVGhlIHNwYW5zIHdpbGwgaGF2ZSBudWxsIGZvciB0aGVpciBmcm9tL3RvIHByb3BlcnRpZXMgd2hlbiB0aGVcbiAgLy8gbWFya2VyIGNvbnRpbnVlcyBiZXlvbmQgdGhlIHN0YXJ0L2VuZCBvZiB0aGUgbGluZS4gTWFya2VycyBoYXZlXG4gIC8vIGxpbmtzIGJhY2sgdG8gdGhlIGxpbmVzIHRoZXkgY3VycmVudGx5IHRvdWNoLlxuXG4gIHZhciBuZXh0TWFya2VySWQgPSAwO1xuXG4gIHZhciBUZXh0TWFya2VyID0gQ29kZU1pcnJvci5UZXh0TWFya2VyID0gZnVuY3Rpb24oZG9jLCB0eXBlKSB7XG4gICAgdGhpcy5saW5lcyA9IFtdO1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5kb2MgPSBkb2M7XG4gICAgdGhpcy5pZCA9ICsrbmV4dE1hcmtlcklkO1xuICB9O1xuICBldmVudE1peGluKFRleHRNYXJrZXIpO1xuXG4gIC8vIENsZWFyIHRoZSBtYXJrZXIuXG4gIFRleHRNYXJrZXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuZXhwbGljaXRseUNsZWFyZWQpIHJldHVybjtcbiAgICB2YXIgY20gPSB0aGlzLmRvYy5jbSwgd2l0aE9wID0gY20gJiYgIWNtLmN1ck9wO1xuICAgIGlmICh3aXRoT3ApIHN0YXJ0T3BlcmF0aW9uKGNtKTtcbiAgICBpZiAoaGFzSGFuZGxlcih0aGlzLCBcImNsZWFyXCIpKSB7XG4gICAgICB2YXIgZm91bmQgPSB0aGlzLmZpbmQoKTtcbiAgICAgIGlmIChmb3VuZCkgc2lnbmFsTGF0ZXIodGhpcywgXCJjbGVhclwiLCBmb3VuZC5mcm9tLCBmb3VuZC50byk7XG4gICAgfVxuICAgIHZhciBtaW4gPSBudWxsLCBtYXggPSBudWxsO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5saW5lcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGxpbmUgPSB0aGlzLmxpbmVzW2ldO1xuICAgICAgdmFyIHNwYW4gPSBnZXRNYXJrZWRTcGFuRm9yKGxpbmUubWFya2VkU3BhbnMsIHRoaXMpO1xuICAgICAgaWYgKGNtICYmICF0aGlzLmNvbGxhcHNlZCkgcmVnTGluZUNoYW5nZShjbSwgbGluZU5vKGxpbmUpLCBcInRleHRcIik7XG4gICAgICBlbHNlIGlmIChjbSkge1xuICAgICAgICBpZiAoc3Bhbi50byAhPSBudWxsKSBtYXggPSBsaW5lTm8obGluZSk7XG4gICAgICAgIGlmIChzcGFuLmZyb20gIT0gbnVsbCkgbWluID0gbGluZU5vKGxpbmUpO1xuICAgICAgfVxuICAgICAgbGluZS5tYXJrZWRTcGFucyA9IHJlbW92ZU1hcmtlZFNwYW4obGluZS5tYXJrZWRTcGFucywgc3Bhbik7XG4gICAgICBpZiAoc3Bhbi5mcm9tID09IG51bGwgJiYgdGhpcy5jb2xsYXBzZWQgJiYgIWxpbmVJc0hpZGRlbih0aGlzLmRvYywgbGluZSkgJiYgY20pXG4gICAgICAgIHVwZGF0ZUxpbmVIZWlnaHQobGluZSwgdGV4dEhlaWdodChjbS5kaXNwbGF5KSk7XG4gICAgfVxuICAgIGlmIChjbSAmJiB0aGlzLmNvbGxhcHNlZCAmJiAhY20ub3B0aW9ucy5saW5lV3JhcHBpbmcpIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5saW5lcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIHZpc3VhbCA9IHZpc3VhbExpbmUodGhpcy5saW5lc1tpXSksIGxlbiA9IGxpbmVMZW5ndGgodmlzdWFsKTtcbiAgICAgIGlmIChsZW4gPiBjbS5kaXNwbGF5Lm1heExpbmVMZW5ndGgpIHtcbiAgICAgICAgY20uZGlzcGxheS5tYXhMaW5lID0gdmlzdWFsO1xuICAgICAgICBjbS5kaXNwbGF5Lm1heExpbmVMZW5ndGggPSBsZW47XG4gICAgICAgIGNtLmRpc3BsYXkubWF4TGluZUNoYW5nZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtaW4gIT0gbnVsbCAmJiBjbSAmJiB0aGlzLmNvbGxhcHNlZCkgcmVnQ2hhbmdlKGNtLCBtaW4sIG1heCArIDEpO1xuICAgIHRoaXMubGluZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLmV4cGxpY2l0bHlDbGVhcmVkID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5hdG9taWMgJiYgdGhpcy5kb2MuY2FudEVkaXQpIHtcbiAgICAgIHRoaXMuZG9jLmNhbnRFZGl0ID0gZmFsc2U7XG4gICAgICBpZiAoY20pIHJlQ2hlY2tTZWxlY3Rpb24oY20uZG9jKTtcbiAgICB9XG4gICAgaWYgKGNtKSBzaWduYWxMYXRlcihjbSwgXCJtYXJrZXJDbGVhcmVkXCIsIGNtLCB0aGlzKTtcbiAgICBpZiAod2l0aE9wKSBlbmRPcGVyYXRpb24oY20pO1xuICAgIGlmICh0aGlzLnBhcmVudCkgdGhpcy5wYXJlbnQuY2xlYXIoKTtcbiAgfTtcblxuICAvLyBGaW5kIHRoZSBwb3NpdGlvbiBvZiB0aGUgbWFya2VyIGluIHRoZSBkb2N1bWVudC4gUmV0dXJucyBhIHtmcm9tLFxuICAvLyB0b30gb2JqZWN0IGJ5IGRlZmF1bHQuIFNpZGUgY2FuIGJlIHBhc3NlZCB0byBnZXQgYSBzcGVjaWZpYyBzaWRlXG4gIC8vIC0tIDAgKGJvdGgpLCAtMSAobGVmdCksIG9yIDEgKHJpZ2h0KS4gV2hlbiBsaW5lT2JqIGlzIHRydWUsIHRoZVxuICAvLyBQb3Mgb2JqZWN0cyByZXR1cm5lZCBjb250YWluIGEgbGluZSBvYmplY3QsIHJhdGhlciB0aGFuIGEgbGluZVxuICAvLyBudW1iZXIgKHVzZWQgdG8gcHJldmVudCBsb29raW5nIHVwIHRoZSBzYW1lIGxpbmUgdHdpY2UpLlxuICBUZXh0TWFya2VyLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24oc2lkZSwgbGluZU9iaikge1xuICAgIGlmIChzaWRlID09IG51bGwgJiYgdGhpcy50eXBlID09IFwiYm9va21hcmtcIikgc2lkZSA9IDE7XG4gICAgdmFyIGZyb20sIHRvO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5saW5lcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGxpbmUgPSB0aGlzLmxpbmVzW2ldO1xuICAgICAgdmFyIHNwYW4gPSBnZXRNYXJrZWRTcGFuRm9yKGxpbmUubWFya2VkU3BhbnMsIHRoaXMpO1xuICAgICAgaWYgKHNwYW4uZnJvbSAhPSBudWxsKSB7XG4gICAgICAgIGZyb20gPSBQb3MobGluZU9iaiA/IGxpbmUgOiBsaW5lTm8obGluZSksIHNwYW4uZnJvbSk7XG4gICAgICAgIGlmIChzaWRlID09IC0xKSByZXR1cm4gZnJvbTtcbiAgICAgIH1cbiAgICAgIGlmIChzcGFuLnRvICE9IG51bGwpIHtcbiAgICAgICAgdG8gPSBQb3MobGluZU9iaiA/IGxpbmUgOiBsaW5lTm8obGluZSksIHNwYW4udG8pO1xuICAgICAgICBpZiAoc2lkZSA9PSAxKSByZXR1cm4gdG87XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmcm9tICYmIHtmcm9tOiBmcm9tLCB0bzogdG99O1xuICB9O1xuXG4gIC8vIFNpZ25hbHMgdGhhdCB0aGUgbWFya2VyJ3Mgd2lkZ2V0IGNoYW5nZWQsIGFuZCBzdXJyb3VuZGluZyBsYXlvdXRcbiAgLy8gc2hvdWxkIGJlIHJlY29tcHV0ZWQuXG4gIFRleHRNYXJrZXIucHJvdG90eXBlLmNoYW5nZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcG9zID0gdGhpcy5maW5kKC0xLCB0cnVlKSwgd2lkZ2V0ID0gdGhpcywgY20gPSB0aGlzLmRvYy5jbTtcbiAgICBpZiAoIXBvcyB8fCAhY20pIHJldHVybjtcbiAgICBydW5Jbk9wKGNtLCBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBsaW5lID0gcG9zLmxpbmUsIGxpbmVOID0gbGluZU5vKHBvcy5saW5lKTtcbiAgICAgIHZhciB2aWV3ID0gZmluZFZpZXdGb3JMaW5lKGNtLCBsaW5lTik7XG4gICAgICBpZiAodmlldykge1xuICAgICAgICBjbGVhckxpbmVNZWFzdXJlbWVudENhY2hlRm9yKHZpZXcpO1xuICAgICAgICBjbS5jdXJPcC5zZWxlY3Rpb25DaGFuZ2VkID0gY20uY3VyT3AuZm9yY2VVcGRhdGUgPSB0cnVlO1xuICAgICAgfVxuICAgICAgY20uY3VyT3AudXBkYXRlTWF4TGluZSA9IHRydWU7XG4gICAgICBpZiAoIWxpbmVJc0hpZGRlbih3aWRnZXQuZG9jLCBsaW5lKSAmJiB3aWRnZXQuaGVpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgdmFyIG9sZEhlaWdodCA9IHdpZGdldC5oZWlnaHQ7XG4gICAgICAgIHdpZGdldC5oZWlnaHQgPSBudWxsO1xuICAgICAgICB2YXIgZEhlaWdodCA9IHdpZGdldEhlaWdodCh3aWRnZXQpIC0gb2xkSGVpZ2h0O1xuICAgICAgICBpZiAoZEhlaWdodClcbiAgICAgICAgICB1cGRhdGVMaW5lSGVpZ2h0KGxpbmUsIGxpbmUuaGVpZ2h0ICsgZEhlaWdodCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG5cbiAgVGV4dE1hcmtlci5wcm90b3R5cGUuYXR0YWNoTGluZSA9IGZ1bmN0aW9uKGxpbmUpIHtcbiAgICBpZiAoIXRoaXMubGluZXMubGVuZ3RoICYmIHRoaXMuZG9jLmNtKSB7XG4gICAgICB2YXIgb3AgPSB0aGlzLmRvYy5jbS5jdXJPcDtcbiAgICAgIGlmICghb3AubWF5YmVIaWRkZW5NYXJrZXJzIHx8IGluZGV4T2Yob3AubWF5YmVIaWRkZW5NYXJrZXJzLCB0aGlzKSA9PSAtMSlcbiAgICAgICAgKG9wLm1heWJlVW5oaWRkZW5NYXJrZXJzIHx8IChvcC5tYXliZVVuaGlkZGVuTWFya2VycyA9IFtdKSkucHVzaCh0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5saW5lcy5wdXNoKGxpbmUpO1xuICB9O1xuICBUZXh0TWFya2VyLnByb3RvdHlwZS5kZXRhY2hMaW5lID0gZnVuY3Rpb24obGluZSkge1xuICAgIHRoaXMubGluZXMuc3BsaWNlKGluZGV4T2YodGhpcy5saW5lcywgbGluZSksIDEpO1xuICAgIGlmICghdGhpcy5saW5lcy5sZW5ndGggJiYgdGhpcy5kb2MuY20pIHtcbiAgICAgIHZhciBvcCA9IHRoaXMuZG9jLmNtLmN1ck9wO1xuICAgICAgKG9wLm1heWJlSGlkZGVuTWFya2VycyB8fCAob3AubWF5YmVIaWRkZW5NYXJrZXJzID0gW10pKS5wdXNoKHRoaXMpO1xuICAgIH1cbiAgfTtcblxuICAvLyBDb2xsYXBzZWQgbWFya2VycyBoYXZlIHVuaXF1ZSBpZHMsIGluIG9yZGVyIHRvIGJlIGFibGUgdG8gb3JkZXJcbiAgLy8gdGhlbSwgd2hpY2ggaXMgbmVlZGVkIGZvciB1bmlxdWVseSBkZXRlcm1pbmluZyBhbiBvdXRlciBtYXJrZXJcbiAgLy8gd2hlbiB0aGV5IG92ZXJsYXAgKHRoZXkgbWF5IG5lc3QsIGJ1dCBub3QgcGFydGlhbGx5IG92ZXJsYXApLlxuICB2YXIgbmV4dE1hcmtlcklkID0gMDtcblxuICAvLyBDcmVhdGUgYSBtYXJrZXIsIHdpcmUgaXQgdXAgdG8gdGhlIHJpZ2h0IGxpbmVzLCBhbmRcbiAgZnVuY3Rpb24gbWFya1RleHQoZG9jLCBmcm9tLCB0bywgb3B0aW9ucywgdHlwZSkge1xuICAgIC8vIFNoYXJlZCBtYXJrZXJzIChhY3Jvc3MgbGlua2VkIGRvY3VtZW50cykgYXJlIGhhbmRsZWQgc2VwYXJhdGVseVxuICAgIC8vIChtYXJrVGV4dFNoYXJlZCB3aWxsIGNhbGwgb3V0IHRvIHRoaXMgYWdhaW4sIG9uY2UgcGVyXG4gICAgLy8gZG9jdW1lbnQpLlxuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuc2hhcmVkKSByZXR1cm4gbWFya1RleHRTaGFyZWQoZG9jLCBmcm9tLCB0bywgb3B0aW9ucywgdHlwZSk7XG4gICAgLy8gRW5zdXJlIHdlIGFyZSBpbiBhbiBvcGVyYXRpb24uXG4gICAgaWYgKGRvYy5jbSAmJiAhZG9jLmNtLmN1ck9wKSByZXR1cm4gb3BlcmF0aW9uKGRvYy5jbSwgbWFya1RleHQpKGRvYywgZnJvbSwgdG8sIG9wdGlvbnMsIHR5cGUpO1xuXG4gICAgdmFyIG1hcmtlciA9IG5ldyBUZXh0TWFya2VyKGRvYywgdHlwZSksIGRpZmYgPSBjbXAoZnJvbSwgdG8pO1xuICAgIGlmIChvcHRpb25zKSBjb3B5T2JqKG9wdGlvbnMsIG1hcmtlciwgZmFsc2UpO1xuICAgIC8vIERvbid0IGNvbm5lY3QgZW1wdHkgbWFya2VycyB1bmxlc3MgY2xlYXJXaGVuRW1wdHkgaXMgZmFsc2VcbiAgICBpZiAoZGlmZiA+IDAgfHwgZGlmZiA9PSAwICYmIG1hcmtlci5jbGVhcldoZW5FbXB0eSAhPT0gZmFsc2UpXG4gICAgICByZXR1cm4gbWFya2VyO1xuICAgIGlmIChtYXJrZXIucmVwbGFjZWRXaXRoKSB7XG4gICAgICAvLyBTaG93aW5nIHVwIGFzIGEgd2lkZ2V0IGltcGxpZXMgY29sbGFwc2VkICh3aWRnZXQgcmVwbGFjZXMgdGV4dClcbiAgICAgIG1hcmtlci5jb2xsYXBzZWQgPSB0cnVlO1xuICAgICAgbWFya2VyLndpZGdldE5vZGUgPSBlbHQoXCJzcGFuXCIsIFttYXJrZXIucmVwbGFjZWRXaXRoXSwgXCJDb2RlTWlycm9yLXdpZGdldFwiKTtcbiAgICAgIGlmICghb3B0aW9ucy5oYW5kbGVNb3VzZUV2ZW50cykgbWFya2VyLndpZGdldE5vZGUuc2V0QXR0cmlidXRlKFwiY20taWdub3JlLWV2ZW50c1wiLCBcInRydWVcIik7XG4gICAgICBpZiAob3B0aW9ucy5pbnNlcnRMZWZ0KSBtYXJrZXIud2lkZ2V0Tm9kZS5pbnNlcnRMZWZ0ID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKG1hcmtlci5jb2xsYXBzZWQpIHtcbiAgICAgIGlmIChjb25mbGljdGluZ0NvbGxhcHNlZFJhbmdlKGRvYywgZnJvbS5saW5lLCBmcm9tLCB0bywgbWFya2VyKSB8fFxuICAgICAgICAgIGZyb20ubGluZSAhPSB0by5saW5lICYmIGNvbmZsaWN0aW5nQ29sbGFwc2VkUmFuZ2UoZG9jLCB0by5saW5lLCBmcm9tLCB0bywgbWFya2VyKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5zZXJ0aW5nIGNvbGxhcHNlZCBtYXJrZXIgcGFydGlhbGx5IG92ZXJsYXBwaW5nIGFuIGV4aXN0aW5nIG9uZVwiKTtcbiAgICAgIHNhd0NvbGxhcHNlZFNwYW5zID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAobWFya2VyLmFkZFRvSGlzdG9yeSlcbiAgICAgIGFkZENoYW5nZVRvSGlzdG9yeShkb2MsIHtmcm9tOiBmcm9tLCB0bzogdG8sIG9yaWdpbjogXCJtYXJrVGV4dFwifSwgZG9jLnNlbCwgTmFOKTtcblxuICAgIHZhciBjdXJMaW5lID0gZnJvbS5saW5lLCBjbSA9IGRvYy5jbSwgdXBkYXRlTWF4TGluZTtcbiAgICBkb2MuaXRlcihjdXJMaW5lLCB0by5saW5lICsgMSwgZnVuY3Rpb24obGluZSkge1xuICAgICAgaWYgKGNtICYmIG1hcmtlci5jb2xsYXBzZWQgJiYgIWNtLm9wdGlvbnMubGluZVdyYXBwaW5nICYmIHZpc3VhbExpbmUobGluZSkgPT0gY20uZGlzcGxheS5tYXhMaW5lKVxuICAgICAgICB1cGRhdGVNYXhMaW5lID0gdHJ1ZTtcbiAgICAgIGlmIChtYXJrZXIuY29sbGFwc2VkICYmIGN1ckxpbmUgIT0gZnJvbS5saW5lKSB1cGRhdGVMaW5lSGVpZ2h0KGxpbmUsIDApO1xuICAgICAgYWRkTWFya2VkU3BhbihsaW5lLCBuZXcgTWFya2VkU3BhbihtYXJrZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1ckxpbmUgPT0gZnJvbS5saW5lID8gZnJvbS5jaCA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1ckxpbmUgPT0gdG8ubGluZSA/IHRvLmNoIDogbnVsbCkpO1xuICAgICAgKytjdXJMaW5lO1xuICAgIH0pO1xuICAgIC8vIGxpbmVJc0hpZGRlbiBkZXBlbmRzIG9uIHRoZSBwcmVzZW5jZSBvZiB0aGUgc3BhbnMsIHNvIG5lZWRzIGEgc2Vjb25kIHBhc3NcbiAgICBpZiAobWFya2VyLmNvbGxhcHNlZCkgZG9jLml0ZXIoZnJvbS5saW5lLCB0by5saW5lICsgMSwgZnVuY3Rpb24obGluZSkge1xuICAgICAgaWYgKGxpbmVJc0hpZGRlbihkb2MsIGxpbmUpKSB1cGRhdGVMaW5lSGVpZ2h0KGxpbmUsIDApO1xuICAgIH0pO1xuXG4gICAgaWYgKG1hcmtlci5jbGVhck9uRW50ZXIpIG9uKG1hcmtlciwgXCJiZWZvcmVDdXJzb3JFbnRlclwiLCBmdW5jdGlvbigpIHsgbWFya2VyLmNsZWFyKCk7IH0pO1xuXG4gICAgaWYgKG1hcmtlci5yZWFkT25seSkge1xuICAgICAgc2F3UmVhZE9ubHlTcGFucyA9IHRydWU7XG4gICAgICBpZiAoZG9jLmhpc3RvcnkuZG9uZS5sZW5ndGggfHwgZG9jLmhpc3RvcnkudW5kb25lLmxlbmd0aClcbiAgICAgICAgZG9jLmNsZWFySGlzdG9yeSgpO1xuICAgIH1cbiAgICBpZiAobWFya2VyLmNvbGxhcHNlZCkge1xuICAgICAgbWFya2VyLmlkID0gKytuZXh0TWFya2VySWQ7XG4gICAgICBtYXJrZXIuYXRvbWljID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGNtKSB7XG4gICAgICAvLyBTeW5jIGVkaXRvciBzdGF0ZVxuICAgICAgaWYgKHVwZGF0ZU1heExpbmUpIGNtLmN1ck9wLnVwZGF0ZU1heExpbmUgPSB0cnVlO1xuICAgICAgaWYgKG1hcmtlci5jb2xsYXBzZWQpXG4gICAgICAgIHJlZ0NoYW5nZShjbSwgZnJvbS5saW5lLCB0by5saW5lICsgMSk7XG4gICAgICBlbHNlIGlmIChtYXJrZXIuY2xhc3NOYW1lIHx8IG1hcmtlci50aXRsZSB8fCBtYXJrZXIuc3RhcnRTdHlsZSB8fCBtYXJrZXIuZW5kU3R5bGUgfHwgbWFya2VyLmNzcylcbiAgICAgICAgZm9yICh2YXIgaSA9IGZyb20ubGluZTsgaSA8PSB0by5saW5lOyBpKyspIHJlZ0xpbmVDaGFuZ2UoY20sIGksIFwidGV4dFwiKTtcbiAgICAgIGlmIChtYXJrZXIuYXRvbWljKSByZUNoZWNrU2VsZWN0aW9uKGNtLmRvYyk7XG4gICAgICBzaWduYWxMYXRlcihjbSwgXCJtYXJrZXJBZGRlZFwiLCBjbSwgbWFya2VyKTtcbiAgICB9XG4gICAgcmV0dXJuIG1hcmtlcjtcbiAgfVxuXG4gIC8vIFNIQVJFRCBURVhUTUFSS0VSU1xuXG4gIC8vIEEgc2hhcmVkIG1hcmtlciBzcGFucyBtdWx0aXBsZSBsaW5rZWQgZG9jdW1lbnRzLiBJdCBpc1xuICAvLyBpbXBsZW1lbnRlZCBhcyBhIG1ldGEtbWFya2VyLW9iamVjdCBjb250cm9sbGluZyBtdWx0aXBsZSBub3JtYWxcbiAgLy8gbWFya2Vycy5cbiAgdmFyIFNoYXJlZFRleHRNYXJrZXIgPSBDb2RlTWlycm9yLlNoYXJlZFRleHRNYXJrZXIgPSBmdW5jdGlvbihtYXJrZXJzLCBwcmltYXJ5KSB7XG4gICAgdGhpcy5tYXJrZXJzID0gbWFya2VycztcbiAgICB0aGlzLnByaW1hcnkgPSBwcmltYXJ5O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWFya2Vycy5sZW5ndGg7ICsraSlcbiAgICAgIG1hcmtlcnNbaV0ucGFyZW50ID0gdGhpcztcbiAgfTtcbiAgZXZlbnRNaXhpbihTaGFyZWRUZXh0TWFya2VyKTtcblxuICBTaGFyZWRUZXh0TWFya2VyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLmV4cGxpY2l0bHlDbGVhcmVkKSByZXR1cm47XG4gICAgdGhpcy5leHBsaWNpdGx5Q2xlYXJlZCA9IHRydWU7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm1hcmtlcnMubGVuZ3RoOyArK2kpXG4gICAgICB0aGlzLm1hcmtlcnNbaV0uY2xlYXIoKTtcbiAgICBzaWduYWxMYXRlcih0aGlzLCBcImNsZWFyXCIpO1xuICB9O1xuICBTaGFyZWRUZXh0TWFya2VyLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24oc2lkZSwgbGluZU9iaikge1xuICAgIHJldHVybiB0aGlzLnByaW1hcnkuZmluZChzaWRlLCBsaW5lT2JqKTtcbiAgfTtcblxuICBmdW5jdGlvbiBtYXJrVGV4dFNoYXJlZChkb2MsIGZyb20sIHRvLCBvcHRpb25zLCB0eXBlKSB7XG4gICAgb3B0aW9ucyA9IGNvcHlPYmoob3B0aW9ucyk7XG4gICAgb3B0aW9ucy5zaGFyZWQgPSBmYWxzZTtcbiAgICB2YXIgbWFya2VycyA9IFttYXJrVGV4dChkb2MsIGZyb20sIHRvLCBvcHRpb25zLCB0eXBlKV0sIHByaW1hcnkgPSBtYXJrZXJzWzBdO1xuICAgIHZhciB3aWRnZXQgPSBvcHRpb25zLndpZGdldE5vZGU7XG4gICAgbGlua2VkRG9jcyhkb2MsIGZ1bmN0aW9uKGRvYykge1xuICAgICAgaWYgKHdpZGdldCkgb3B0aW9ucy53aWRnZXROb2RlID0gd2lkZ2V0LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgIG1hcmtlcnMucHVzaChtYXJrVGV4dChkb2MsIGNsaXBQb3MoZG9jLCBmcm9tKSwgY2xpcFBvcyhkb2MsIHRvKSwgb3B0aW9ucywgdHlwZSkpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkb2MubGlua2VkLmxlbmd0aDsgKytpKVxuICAgICAgICBpZiAoZG9jLmxpbmtlZFtpXS5pc1BhcmVudCkgcmV0dXJuO1xuICAgICAgcHJpbWFyeSA9IGxzdChtYXJrZXJzKTtcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3IFNoYXJlZFRleHRNYXJrZXIobWFya2VycywgcHJpbWFyeSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaW5kU2hhcmVkTWFya2Vycyhkb2MpIHtcbiAgICByZXR1cm4gZG9jLmZpbmRNYXJrcyhQb3MoZG9jLmZpcnN0LCAwKSwgZG9jLmNsaXBQb3MoUG9zKGRvYy5sYXN0TGluZSgpKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24obSkgeyByZXR1cm4gbS5wYXJlbnQ7IH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gY29weVNoYXJlZE1hcmtlcnMoZG9jLCBtYXJrZXJzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYXJrZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgbWFya2VyID0gbWFya2Vyc1tpXSwgcG9zID0gbWFya2VyLmZpbmQoKTtcbiAgICAgIHZhciBtRnJvbSA9IGRvYy5jbGlwUG9zKHBvcy5mcm9tKSwgbVRvID0gZG9jLmNsaXBQb3MocG9zLnRvKTtcbiAgICAgIGlmIChjbXAobUZyb20sIG1UbykpIHtcbiAgICAgICAgdmFyIHN1Yk1hcmsgPSBtYXJrVGV4dChkb2MsIG1Gcm9tLCBtVG8sIG1hcmtlci5wcmltYXJ5LCBtYXJrZXIucHJpbWFyeS50eXBlKTtcbiAgICAgICAgbWFya2VyLm1hcmtlcnMucHVzaChzdWJNYXJrKTtcbiAgICAgICAgc3ViTWFyay5wYXJlbnQgPSBtYXJrZXI7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGV0YWNoU2hhcmVkTWFya2VycyhtYXJrZXJzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYXJrZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgbWFya2VyID0gbWFya2Vyc1tpXSwgbGlua2VkID0gW21hcmtlci5wcmltYXJ5LmRvY107O1xuICAgICAgbGlua2VkRG9jcyhtYXJrZXIucHJpbWFyeS5kb2MsIGZ1bmN0aW9uKGQpIHsgbGlua2VkLnB1c2goZCk7IH0pO1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBtYXJrZXIubWFya2Vycy5sZW5ndGg7IGorKykge1xuICAgICAgICB2YXIgc3ViTWFya2VyID0gbWFya2VyLm1hcmtlcnNbal07XG4gICAgICAgIGlmIChpbmRleE9mKGxpbmtlZCwgc3ViTWFya2VyLmRvYykgPT0gLTEpIHtcbiAgICAgICAgICBzdWJNYXJrZXIucGFyZW50ID0gbnVsbDtcbiAgICAgICAgICBtYXJrZXIubWFya2Vycy5zcGxpY2Uoai0tLCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFRFWFRNQVJLRVIgU1BBTlNcblxuICBmdW5jdGlvbiBNYXJrZWRTcGFuKG1hcmtlciwgZnJvbSwgdG8pIHtcbiAgICB0aGlzLm1hcmtlciA9IG1hcmtlcjtcbiAgICB0aGlzLmZyb20gPSBmcm9tOyB0aGlzLnRvID0gdG87XG4gIH1cblxuICAvLyBTZWFyY2ggYW4gYXJyYXkgb2Ygc3BhbnMgZm9yIGEgc3BhbiBtYXRjaGluZyB0aGUgZ2l2ZW4gbWFya2VyLlxuICBmdW5jdGlvbiBnZXRNYXJrZWRTcGFuRm9yKHNwYW5zLCBtYXJrZXIpIHtcbiAgICBpZiAoc3BhbnMpIGZvciAodmFyIGkgPSAwOyBpIDwgc3BhbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBzcGFuID0gc3BhbnNbaV07XG4gICAgICBpZiAoc3Bhbi5tYXJrZXIgPT0gbWFya2VyKSByZXR1cm4gc3BhbjtcbiAgICB9XG4gIH1cbiAgLy8gUmVtb3ZlIGEgc3BhbiBmcm9tIGFuIGFycmF5LCByZXR1cm5pbmcgdW5kZWZpbmVkIGlmIG5vIHNwYW5zIGFyZVxuICAvLyBsZWZ0ICh3ZSBkb24ndCBzdG9yZSBhcnJheXMgZm9yIGxpbmVzIHdpdGhvdXQgc3BhbnMpLlxuICBmdW5jdGlvbiByZW1vdmVNYXJrZWRTcGFuKHNwYW5zLCBzcGFuKSB7XG4gICAgZm9yICh2YXIgciwgaSA9IDA7IGkgPCBzcGFucy5sZW5ndGg7ICsraSlcbiAgICAgIGlmIChzcGFuc1tpXSAhPSBzcGFuKSAociB8fCAociA9IFtdKSkucHVzaChzcGFuc1tpXSk7XG4gICAgcmV0dXJuIHI7XG4gIH1cbiAgLy8gQWRkIGEgc3BhbiB0byBhIGxpbmUuXG4gIGZ1bmN0aW9uIGFkZE1hcmtlZFNwYW4obGluZSwgc3Bhbikge1xuICAgIGxpbmUubWFya2VkU3BhbnMgPSBsaW5lLm1hcmtlZFNwYW5zID8gbGluZS5tYXJrZWRTcGFucy5jb25jYXQoW3NwYW5dKSA6IFtzcGFuXTtcbiAgICBzcGFuLm1hcmtlci5hdHRhY2hMaW5lKGxpbmUpO1xuICB9XG5cbiAgLy8gVXNlZCBmb3IgdGhlIGFsZ29yaXRobSB0aGF0IGFkanVzdHMgbWFya2VycyBmb3IgYSBjaGFuZ2UgaW4gdGhlXG4gIC8vIGRvY3VtZW50LiBUaGVzZSBmdW5jdGlvbnMgY3V0IGFuIGFycmF5IG9mIHNwYW5zIGF0IGEgZ2l2ZW5cbiAgLy8gY2hhcmFjdGVyIHBvc2l0aW9uLCByZXR1cm5pbmcgYW4gYXJyYXkgb2YgcmVtYWluaW5nIGNodW5rcyAob3JcbiAgLy8gdW5kZWZpbmVkIGlmIG5vdGhpbmcgcmVtYWlucykuXG4gIGZ1bmN0aW9uIG1hcmtlZFNwYW5zQmVmb3JlKG9sZCwgc3RhcnRDaCwgaXNJbnNlcnQpIHtcbiAgICBpZiAob2xkKSBmb3IgKHZhciBpID0gMCwgbnc7IGkgPCBvbGQubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBzcGFuID0gb2xkW2ldLCBtYXJrZXIgPSBzcGFuLm1hcmtlcjtcbiAgICAgIHZhciBzdGFydHNCZWZvcmUgPSBzcGFuLmZyb20gPT0gbnVsbCB8fCAobWFya2VyLmluY2x1c2l2ZUxlZnQgPyBzcGFuLmZyb20gPD0gc3RhcnRDaCA6IHNwYW4uZnJvbSA8IHN0YXJ0Q2gpO1xuICAgICAgaWYgKHN0YXJ0c0JlZm9yZSB8fCBzcGFuLmZyb20gPT0gc3RhcnRDaCAmJiBtYXJrZXIudHlwZSA9PSBcImJvb2ttYXJrXCIgJiYgKCFpc0luc2VydCB8fCAhc3Bhbi5tYXJrZXIuaW5zZXJ0TGVmdCkpIHtcbiAgICAgICAgdmFyIGVuZHNBZnRlciA9IHNwYW4udG8gPT0gbnVsbCB8fCAobWFya2VyLmluY2x1c2l2ZVJpZ2h0ID8gc3Bhbi50byA+PSBzdGFydENoIDogc3Bhbi50byA+IHN0YXJ0Q2gpO1xuICAgICAgICAobncgfHwgKG53ID0gW10pKS5wdXNoKG5ldyBNYXJrZWRTcGFuKG1hcmtlciwgc3Bhbi5mcm9tLCBlbmRzQWZ0ZXIgPyBudWxsIDogc3Bhbi50bykpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnc7XG4gIH1cbiAgZnVuY3Rpb24gbWFya2VkU3BhbnNBZnRlcihvbGQsIGVuZENoLCBpc0luc2VydCkge1xuICAgIGlmIChvbGQpIGZvciAodmFyIGkgPSAwLCBudzsgaSA8IG9sZC5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIHNwYW4gPSBvbGRbaV0sIG1hcmtlciA9IHNwYW4ubWFya2VyO1xuICAgICAgdmFyIGVuZHNBZnRlciA9IHNwYW4udG8gPT0gbnVsbCB8fCAobWFya2VyLmluY2x1c2l2ZVJpZ2h0ID8gc3Bhbi50byA+PSBlbmRDaCA6IHNwYW4udG8gPiBlbmRDaCk7XG4gICAgICBpZiAoZW5kc0FmdGVyIHx8IHNwYW4uZnJvbSA9PSBlbmRDaCAmJiBtYXJrZXIudHlwZSA9PSBcImJvb2ttYXJrXCIgJiYgKCFpc0luc2VydCB8fCBzcGFuLm1hcmtlci5pbnNlcnRMZWZ0KSkge1xuICAgICAgICB2YXIgc3RhcnRzQmVmb3JlID0gc3Bhbi5mcm9tID09IG51bGwgfHwgKG1hcmtlci5pbmNsdXNpdmVMZWZ0ID8gc3Bhbi5mcm9tIDw9IGVuZENoIDogc3Bhbi5mcm9tIDwgZW5kQ2gpO1xuICAgICAgICAobncgfHwgKG53ID0gW10pKS5wdXNoKG5ldyBNYXJrZWRTcGFuKG1hcmtlciwgc3RhcnRzQmVmb3JlID8gbnVsbCA6IHNwYW4uZnJvbSAtIGVuZENoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwYW4udG8gPT0gbnVsbCA/IG51bGwgOiBzcGFuLnRvIC0gZW5kQ2gpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG53O1xuICB9XG5cbiAgLy8gR2l2ZW4gYSBjaGFuZ2Ugb2JqZWN0LCBjb21wdXRlIHRoZSBuZXcgc2V0IG9mIG1hcmtlciBzcGFucyB0aGF0XG4gIC8vIGNvdmVyIHRoZSBsaW5lIGluIHdoaWNoIHRoZSBjaGFuZ2UgdG9vayBwbGFjZS4gUmVtb3ZlcyBzcGFuc1xuICAvLyBlbnRpcmVseSB3aXRoaW4gdGhlIGNoYW5nZSwgcmVjb25uZWN0cyBzcGFucyBiZWxvbmdpbmcgdG8gdGhlXG4gIC8vIHNhbWUgbWFya2VyIHRoYXQgYXBwZWFyIG9uIGJvdGggc2lkZXMgb2YgdGhlIGNoYW5nZSwgYW5kIGN1dHMgb2ZmXG4gIC8vIHNwYW5zIHBhcnRpYWxseSB3aXRoaW4gdGhlIGNoYW5nZS4gUmV0dXJucyBhbiBhcnJheSBvZiBzcGFuXG4gIC8vIGFycmF5cyB3aXRoIG9uZSBlbGVtZW50IGZvciBlYWNoIGxpbmUgaW4gKGFmdGVyKSB0aGUgY2hhbmdlLlxuICBmdW5jdGlvbiBzdHJldGNoU3BhbnNPdmVyQ2hhbmdlKGRvYywgY2hhbmdlKSB7XG4gICAgaWYgKGNoYW5nZS5mdWxsKSByZXR1cm4gbnVsbDtcbiAgICB2YXIgb2xkRmlyc3QgPSBpc0xpbmUoZG9jLCBjaGFuZ2UuZnJvbS5saW5lKSAmJiBnZXRMaW5lKGRvYywgY2hhbmdlLmZyb20ubGluZSkubWFya2VkU3BhbnM7XG4gICAgdmFyIG9sZExhc3QgPSBpc0xpbmUoZG9jLCBjaGFuZ2UudG8ubGluZSkgJiYgZ2V0TGluZShkb2MsIGNoYW5nZS50by5saW5lKS5tYXJrZWRTcGFucztcbiAgICBpZiAoIW9sZEZpcnN0ICYmICFvbGRMYXN0KSByZXR1cm4gbnVsbDtcblxuICAgIHZhciBzdGFydENoID0gY2hhbmdlLmZyb20uY2gsIGVuZENoID0gY2hhbmdlLnRvLmNoLCBpc0luc2VydCA9IGNtcChjaGFuZ2UuZnJvbSwgY2hhbmdlLnRvKSA9PSAwO1xuICAgIC8vIEdldCB0aGUgc3BhbnMgdGhhdCAnc3RpY2sgb3V0JyBvbiBib3RoIHNpZGVzXG4gICAgdmFyIGZpcnN0ID0gbWFya2VkU3BhbnNCZWZvcmUob2xkRmlyc3QsIHN0YXJ0Q2gsIGlzSW5zZXJ0KTtcbiAgICB2YXIgbGFzdCA9IG1hcmtlZFNwYW5zQWZ0ZXIob2xkTGFzdCwgZW5kQ2gsIGlzSW5zZXJ0KTtcblxuICAgIC8vIE5leHQsIG1lcmdlIHRob3NlIHR3byBlbmRzXG4gICAgdmFyIHNhbWVMaW5lID0gY2hhbmdlLnRleHQubGVuZ3RoID09IDEsIG9mZnNldCA9IGxzdChjaGFuZ2UudGV4dCkubGVuZ3RoICsgKHNhbWVMaW5lID8gc3RhcnRDaCA6IDApO1xuICAgIGlmIChmaXJzdCkge1xuICAgICAgLy8gRml4IHVwIC50byBwcm9wZXJ0aWVzIG9mIGZpcnN0XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpcnN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBzcGFuID0gZmlyc3RbaV07XG4gICAgICAgIGlmIChzcGFuLnRvID09IG51bGwpIHtcbiAgICAgICAgICB2YXIgZm91bmQgPSBnZXRNYXJrZWRTcGFuRm9yKGxhc3QsIHNwYW4ubWFya2VyKTtcbiAgICAgICAgICBpZiAoIWZvdW5kKSBzcGFuLnRvID0gc3RhcnRDaDtcbiAgICAgICAgICBlbHNlIGlmIChzYW1lTGluZSkgc3Bhbi50byA9IGZvdW5kLnRvID09IG51bGwgPyBudWxsIDogZm91bmQudG8gKyBvZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGxhc3QpIHtcbiAgICAgIC8vIEZpeCB1cCAuZnJvbSBpbiBsYXN0IChvciBtb3ZlIHRoZW0gaW50byBmaXJzdCBpbiBjYXNlIG9mIHNhbWVMaW5lKVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsYXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBzcGFuID0gbGFzdFtpXTtcbiAgICAgICAgaWYgKHNwYW4udG8gIT0gbnVsbCkgc3Bhbi50byArPSBvZmZzZXQ7XG4gICAgICAgIGlmIChzcGFuLmZyb20gPT0gbnVsbCkge1xuICAgICAgICAgIHZhciBmb3VuZCA9IGdldE1hcmtlZFNwYW5Gb3IoZmlyc3QsIHNwYW4ubWFya2VyKTtcbiAgICAgICAgICBpZiAoIWZvdW5kKSB7XG4gICAgICAgICAgICBzcGFuLmZyb20gPSBvZmZzZXQ7XG4gICAgICAgICAgICBpZiAoc2FtZUxpbmUpIChmaXJzdCB8fCAoZmlyc3QgPSBbXSkpLnB1c2goc3Bhbik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNwYW4uZnJvbSArPSBvZmZzZXQ7XG4gICAgICAgICAgaWYgKHNhbWVMaW5lKSAoZmlyc3QgfHwgKGZpcnN0ID0gW10pKS5wdXNoKHNwYW4pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE1ha2Ugc3VyZSB3ZSBkaWRuJ3QgY3JlYXRlIGFueSB6ZXJvLWxlbmd0aCBzcGFuc1xuICAgIGlmIChmaXJzdCkgZmlyc3QgPSBjbGVhckVtcHR5U3BhbnMoZmlyc3QpO1xuICAgIGlmIChsYXN0ICYmIGxhc3QgIT0gZmlyc3QpIGxhc3QgPSBjbGVhckVtcHR5U3BhbnMobGFzdCk7XG5cbiAgICB2YXIgbmV3TWFya2VycyA9IFtmaXJzdF07XG4gICAgaWYgKCFzYW1lTGluZSkge1xuICAgICAgLy8gRmlsbCBnYXAgd2l0aCB3aG9sZS1saW5lLXNwYW5zXG4gICAgICB2YXIgZ2FwID0gY2hhbmdlLnRleHQubGVuZ3RoIC0gMiwgZ2FwTWFya2VycztcbiAgICAgIGlmIChnYXAgPiAwICYmIGZpcnN0KVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpcnN0Lmxlbmd0aDsgKytpKVxuICAgICAgICAgIGlmIChmaXJzdFtpXS50byA9PSBudWxsKVxuICAgICAgICAgICAgKGdhcE1hcmtlcnMgfHwgKGdhcE1hcmtlcnMgPSBbXSkpLnB1c2gobmV3IE1hcmtlZFNwYW4oZmlyc3RbaV0ubWFya2VyLCBudWxsLCBudWxsKSk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdhcDsgKytpKVxuICAgICAgICBuZXdNYXJrZXJzLnB1c2goZ2FwTWFya2Vycyk7XG4gICAgICBuZXdNYXJrZXJzLnB1c2gobGFzdCk7XG4gICAgfVxuICAgIHJldHVybiBuZXdNYXJrZXJzO1xuICB9XG5cbiAgLy8gUmVtb3ZlIHNwYW5zIHRoYXQgYXJlIGVtcHR5IGFuZCBkb24ndCBoYXZlIGEgY2xlYXJXaGVuRW1wdHlcbiAgLy8gb3B0aW9uIG9mIGZhbHNlLlxuICBmdW5jdGlvbiBjbGVhckVtcHR5U3BhbnMoc3BhbnMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNwYW5zLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgc3BhbiA9IHNwYW5zW2ldO1xuICAgICAgaWYgKHNwYW4uZnJvbSAhPSBudWxsICYmIHNwYW4uZnJvbSA9PSBzcGFuLnRvICYmIHNwYW4ubWFya2VyLmNsZWFyV2hlbkVtcHR5ICE9PSBmYWxzZSlcbiAgICAgICAgc3BhbnMuc3BsaWNlKGktLSwgMSk7XG4gICAgfVxuICAgIGlmICghc3BhbnMubGVuZ3RoKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gc3BhbnM7XG4gIH1cblxuICAvLyBVc2VkIGZvciB1bi9yZS1kb2luZyBjaGFuZ2VzIGZyb20gdGhlIGhpc3RvcnkuIENvbWJpbmVzIHRoZVxuICAvLyByZXN1bHQgb2YgY29tcHV0aW5nIHRoZSBleGlzdGluZyBzcGFucyB3aXRoIHRoZSBzZXQgb2Ygc3BhbnMgdGhhdFxuICAvLyBleGlzdGVkIGluIHRoZSBoaXN0b3J5IChzbyB0aGF0IGRlbGV0aW5nIGFyb3VuZCBhIHNwYW4gYW5kIHRoZW5cbiAgLy8gdW5kb2luZyBicmluZ3MgYmFjayB0aGUgc3BhbikuXG4gIGZ1bmN0aW9uIG1lcmdlT2xkU3BhbnMoZG9jLCBjaGFuZ2UpIHtcbiAgICB2YXIgb2xkID0gZ2V0T2xkU3BhbnMoZG9jLCBjaGFuZ2UpO1xuICAgIHZhciBzdHJldGNoZWQgPSBzdHJldGNoU3BhbnNPdmVyQ2hhbmdlKGRvYywgY2hhbmdlKTtcbiAgICBpZiAoIW9sZCkgcmV0dXJuIHN0cmV0Y2hlZDtcbiAgICBpZiAoIXN0cmV0Y2hlZCkgcmV0dXJuIG9sZDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2xkLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgb2xkQ3VyID0gb2xkW2ldLCBzdHJldGNoQ3VyID0gc3RyZXRjaGVkW2ldO1xuICAgICAgaWYgKG9sZEN1ciAmJiBzdHJldGNoQ3VyKSB7XG4gICAgICAgIHNwYW5zOiBmb3IgKHZhciBqID0gMDsgaiA8IHN0cmV0Y2hDdXIubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICB2YXIgc3BhbiA9IHN0cmV0Y2hDdXJbal07XG4gICAgICAgICAgZm9yICh2YXIgayA9IDA7IGsgPCBvbGRDdXIubGVuZ3RoOyArK2spXG4gICAgICAgICAgICBpZiAob2xkQ3VyW2tdLm1hcmtlciA9PSBzcGFuLm1hcmtlcikgY29udGludWUgc3BhbnM7XG4gICAgICAgICAgb2xkQ3VyLnB1c2goc3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3RyZXRjaEN1cikge1xuICAgICAgICBvbGRbaV0gPSBzdHJldGNoQ3VyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2xkO1xuICB9XG5cbiAgLy8gVXNlZCB0byAnY2xpcCcgb3V0IHJlYWRPbmx5IHJhbmdlcyB3aGVuIG1ha2luZyBhIGNoYW5nZS5cbiAgZnVuY3Rpb24gcmVtb3ZlUmVhZE9ubHlSYW5nZXMoZG9jLCBmcm9tLCB0bykge1xuICAgIHZhciBtYXJrZXJzID0gbnVsbDtcbiAgICBkb2MuaXRlcihmcm9tLmxpbmUsIHRvLmxpbmUgKyAxLCBmdW5jdGlvbihsaW5lKSB7XG4gICAgICBpZiAobGluZS5tYXJrZWRTcGFucykgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lLm1hcmtlZFNwYW5zLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBtYXJrID0gbGluZS5tYXJrZWRTcGFuc1tpXS5tYXJrZXI7XG4gICAgICAgIGlmIChtYXJrLnJlYWRPbmx5ICYmICghbWFya2VycyB8fCBpbmRleE9mKG1hcmtlcnMsIG1hcmspID09IC0xKSlcbiAgICAgICAgICAobWFya2VycyB8fCAobWFya2VycyA9IFtdKSkucHVzaChtYXJrKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIW1hcmtlcnMpIHJldHVybiBudWxsO1xuICAgIHZhciBwYXJ0cyA9IFt7ZnJvbTogZnJvbSwgdG86IHRvfV07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYXJrZXJzLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgbWsgPSBtYXJrZXJzW2ldLCBtID0gbWsuZmluZCgwKTtcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgcGFydHMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgdmFyIHAgPSBwYXJ0c1tqXTtcbiAgICAgICAgaWYgKGNtcChwLnRvLCBtLmZyb20pIDwgMCB8fCBjbXAocC5mcm9tLCBtLnRvKSA+IDApIGNvbnRpbnVlO1xuICAgICAgICB2YXIgbmV3UGFydHMgPSBbaiwgMV0sIGRmcm9tID0gY21wKHAuZnJvbSwgbS5mcm9tKSwgZHRvID0gY21wKHAudG8sIG0udG8pO1xuICAgICAgICBpZiAoZGZyb20gPCAwIHx8ICFtay5pbmNsdXNpdmVMZWZ0ICYmICFkZnJvbSlcbiAgICAgICAgICBuZXdQYXJ0cy5wdXNoKHtmcm9tOiBwLmZyb20sIHRvOiBtLmZyb219KTtcbiAgICAgICAgaWYgKGR0byA+IDAgfHwgIW1rLmluY2x1c2l2ZVJpZ2h0ICYmICFkdG8pXG4gICAgICAgICAgbmV3UGFydHMucHVzaCh7ZnJvbTogbS50bywgdG86IHAudG99KTtcbiAgICAgICAgcGFydHMuc3BsaWNlLmFwcGx5KHBhcnRzLCBuZXdQYXJ0cyk7XG4gICAgICAgIGogKz0gbmV3UGFydHMubGVuZ3RoIC0gMTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHBhcnRzO1xuICB9XG5cbiAgLy8gQ29ubmVjdCBvciBkaXNjb25uZWN0IHNwYW5zIGZyb20gYSBsaW5lLlxuICBmdW5jdGlvbiBkZXRhY2hNYXJrZWRTcGFucyhsaW5lKSB7XG4gICAgdmFyIHNwYW5zID0gbGluZS5tYXJrZWRTcGFucztcbiAgICBpZiAoIXNwYW5zKSByZXR1cm47XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGFucy5sZW5ndGg7ICsraSlcbiAgICAgIHNwYW5zW2ldLm1hcmtlci5kZXRhY2hMaW5lKGxpbmUpO1xuICAgIGxpbmUubWFya2VkU3BhbnMgPSBudWxsO1xuICB9XG4gIGZ1bmN0aW9uIGF0dGFjaE1hcmtlZFNwYW5zKGxpbmUsIHNwYW5zKSB7XG4gICAgaWYgKCFzcGFucykgcmV0dXJuO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3BhbnMubGVuZ3RoOyArK2kpXG4gICAgICBzcGFuc1tpXS5tYXJrZXIuYXR0YWNoTGluZShsaW5lKTtcbiAgICBsaW5lLm1hcmtlZFNwYW5zID0gc3BhbnM7XG4gIH1cblxuICAvLyBIZWxwZXJzIHVzZWQgd2hlbiBjb21wdXRpbmcgd2hpY2ggb3ZlcmxhcHBpbmcgY29sbGFwc2VkIHNwYW5cbiAgLy8gY291bnRzIGFzIHRoZSBsYXJnZXIgb25lLlxuICBmdW5jdGlvbiBleHRyYUxlZnQobWFya2VyKSB7IHJldHVybiBtYXJrZXIuaW5jbHVzaXZlTGVmdCA/IC0xIDogMDsgfVxuICBmdW5jdGlvbiBleHRyYVJpZ2h0KG1hcmtlcikgeyByZXR1cm4gbWFya2VyLmluY2x1c2l2ZVJpZ2h0ID8gMSA6IDA7IH1cblxuICAvLyBSZXR1cm5zIGEgbnVtYmVyIGluZGljYXRpbmcgd2hpY2ggb2YgdHdvIG92ZXJsYXBwaW5nIGNvbGxhcHNlZFxuICAvLyBzcGFucyBpcyBsYXJnZXIgKGFuZCB0aHVzIGluY2x1ZGVzIHRoZSBvdGhlcikuIEZhbGxzIGJhY2sgdG9cbiAgLy8gY29tcGFyaW5nIGlkcyB3aGVuIHRoZSBzcGFucyBjb3ZlciBleGFjdGx5IHRoZSBzYW1lIHJhbmdlLlxuICBmdW5jdGlvbiBjb21wYXJlQ29sbGFwc2VkTWFya2VycyhhLCBiKSB7XG4gICAgdmFyIGxlbkRpZmYgPSBhLmxpbmVzLmxlbmd0aCAtIGIubGluZXMubGVuZ3RoO1xuICAgIGlmIChsZW5EaWZmICE9IDApIHJldHVybiBsZW5EaWZmO1xuICAgIHZhciBhUG9zID0gYS5maW5kKCksIGJQb3MgPSBiLmZpbmQoKTtcbiAgICB2YXIgZnJvbUNtcCA9IGNtcChhUG9zLmZyb20sIGJQb3MuZnJvbSkgfHwgZXh0cmFMZWZ0KGEpIC0gZXh0cmFMZWZ0KGIpO1xuICAgIGlmIChmcm9tQ21wKSByZXR1cm4gLWZyb21DbXA7XG4gICAgdmFyIHRvQ21wID0gY21wKGFQb3MudG8sIGJQb3MudG8pIHx8IGV4dHJhUmlnaHQoYSkgLSBleHRyYVJpZ2h0KGIpO1xuICAgIGlmICh0b0NtcCkgcmV0dXJuIHRvQ21wO1xuICAgIHJldHVybiBiLmlkIC0gYS5pZDtcbiAgfVxuXG4gIC8vIEZpbmQgb3V0IHdoZXRoZXIgYSBsaW5lIGVuZHMgb3Igc3RhcnRzIGluIGEgY29sbGFwc2VkIHNwYW4uIElmXG4gIC8vIHNvLCByZXR1cm4gdGhlIG1hcmtlciBmb3IgdGhhdCBzcGFuLlxuICBmdW5jdGlvbiBjb2xsYXBzZWRTcGFuQXRTaWRlKGxpbmUsIHN0YXJ0KSB7XG4gICAgdmFyIHNwcyA9IHNhd0NvbGxhcHNlZFNwYW5zICYmIGxpbmUubWFya2VkU3BhbnMsIGZvdW5kO1xuICAgIGlmIChzcHMpIGZvciAodmFyIHNwLCBpID0gMDsgaSA8IHNwcy5sZW5ndGg7ICsraSkge1xuICAgICAgc3AgPSBzcHNbaV07XG4gICAgICBpZiAoc3AubWFya2VyLmNvbGxhcHNlZCAmJiAoc3RhcnQgPyBzcC5mcm9tIDogc3AudG8pID09IG51bGwgJiZcbiAgICAgICAgICAoIWZvdW5kIHx8IGNvbXBhcmVDb2xsYXBzZWRNYXJrZXJzKGZvdW5kLCBzcC5tYXJrZXIpIDwgMCkpXG4gICAgICAgIGZvdW5kID0gc3AubWFya2VyO1xuICAgIH1cbiAgICByZXR1cm4gZm91bmQ7XG4gIH1cbiAgZnVuY3Rpb24gY29sbGFwc2VkU3BhbkF0U3RhcnQobGluZSkgeyByZXR1cm4gY29sbGFwc2VkU3BhbkF0U2lkZShsaW5lLCB0cnVlKTsgfVxuICBmdW5jdGlvbiBjb2xsYXBzZWRTcGFuQXRFbmQobGluZSkgeyByZXR1cm4gY29sbGFwc2VkU3BhbkF0U2lkZShsaW5lLCBmYWxzZSk7IH1cblxuICAvLyBUZXN0IHdoZXRoZXIgdGhlcmUgZXhpc3RzIGEgY29sbGFwc2VkIHNwYW4gdGhhdCBwYXJ0aWFsbHlcbiAgLy8gb3ZlcmxhcHMgKGNvdmVycyB0aGUgc3RhcnQgb3IgZW5kLCBidXQgbm90IGJvdGgpIG9mIGEgbmV3IHNwYW4uXG4gIC8vIFN1Y2ggb3ZlcmxhcCBpcyBub3QgYWxsb3dlZC5cbiAgZnVuY3Rpb24gY29uZmxpY3RpbmdDb2xsYXBzZWRSYW5nZShkb2MsIGxpbmVObywgZnJvbSwgdG8sIG1hcmtlcikge1xuICAgIHZhciBsaW5lID0gZ2V0TGluZShkb2MsIGxpbmVObyk7XG4gICAgdmFyIHNwcyA9IHNhd0NvbGxhcHNlZFNwYW5zICYmIGxpbmUubWFya2VkU3BhbnM7XG4gICAgaWYgKHNwcykgZm9yICh2YXIgaSA9IDA7IGkgPCBzcHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBzcCA9IHNwc1tpXTtcbiAgICAgIGlmICghc3AubWFya2VyLmNvbGxhcHNlZCkgY29udGludWU7XG4gICAgICB2YXIgZm91bmQgPSBzcC5tYXJrZXIuZmluZCgwKTtcbiAgICAgIHZhciBmcm9tQ21wID0gY21wKGZvdW5kLmZyb20sIGZyb20pIHx8IGV4dHJhTGVmdChzcC5tYXJrZXIpIC0gZXh0cmFMZWZ0KG1hcmtlcik7XG4gICAgICB2YXIgdG9DbXAgPSBjbXAoZm91bmQudG8sIHRvKSB8fCBleHRyYVJpZ2h0KHNwLm1hcmtlcikgLSBleHRyYVJpZ2h0KG1hcmtlcik7XG4gICAgICBpZiAoZnJvbUNtcCA+PSAwICYmIHRvQ21wIDw9IDAgfHwgZnJvbUNtcCA8PSAwICYmIHRvQ21wID49IDApIGNvbnRpbnVlO1xuICAgICAgaWYgKGZyb21DbXAgPD0gMCAmJiAoY21wKGZvdW5kLnRvLCBmcm9tKSA+IDAgfHwgKHNwLm1hcmtlci5pbmNsdXNpdmVSaWdodCAmJiBtYXJrZXIuaW5jbHVzaXZlTGVmdCkpIHx8XG4gICAgICAgICAgZnJvbUNtcCA+PSAwICYmIChjbXAoZm91bmQuZnJvbSwgdG8pIDwgMCB8fCAoc3AubWFya2VyLmluY2x1c2l2ZUxlZnQgJiYgbWFya2VyLmluY2x1c2l2ZVJpZ2h0KSkpXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIC8vIEEgdmlzdWFsIGxpbmUgaXMgYSBsaW5lIGFzIGRyYXduIG9uIHRoZSBzY3JlZW4uIEZvbGRpbmcsIGZvclxuICAvLyBleGFtcGxlLCBjYW4gY2F1c2UgbXVsdGlwbGUgbG9naWNhbCBsaW5lcyB0byBhcHBlYXIgb24gdGhlIHNhbWVcbiAgLy8gdmlzdWFsIGxpbmUuIFRoaXMgZmluZHMgdGhlIHN0YXJ0IG9mIHRoZSB2aXN1YWwgbGluZSB0aGF0IHRoZVxuICAvLyBnaXZlbiBsaW5lIGlzIHBhcnQgb2YgKHVzdWFsbHkgdGhhdCBpcyB0aGUgbGluZSBpdHNlbGYpLlxuICBmdW5jdGlvbiB2aXN1YWxMaW5lKGxpbmUpIHtcbiAgICB2YXIgbWVyZ2VkO1xuICAgIHdoaWxlIChtZXJnZWQgPSBjb2xsYXBzZWRTcGFuQXRTdGFydChsaW5lKSlcbiAgICAgIGxpbmUgPSBtZXJnZWQuZmluZCgtMSwgdHJ1ZSkubGluZTtcbiAgICByZXR1cm4gbGluZTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYW4gYXJyYXkgb2YgbG9naWNhbCBsaW5lcyB0aGF0IGNvbnRpbnVlIHRoZSB2aXN1YWwgbGluZVxuICAvLyBzdGFydGVkIGJ5IHRoZSBhcmd1bWVudCwgb3IgdW5kZWZpbmVkIGlmIHRoZXJlIGFyZSBubyBzdWNoIGxpbmVzLlxuICBmdW5jdGlvbiB2aXN1YWxMaW5lQ29udGludWVkKGxpbmUpIHtcbiAgICB2YXIgbWVyZ2VkLCBsaW5lcztcbiAgICB3aGlsZSAobWVyZ2VkID0gY29sbGFwc2VkU3BhbkF0RW5kKGxpbmUpKSB7XG4gICAgICBsaW5lID0gbWVyZ2VkLmZpbmQoMSwgdHJ1ZSkubGluZTtcbiAgICAgIChsaW5lcyB8fCAobGluZXMgPSBbXSkpLnB1c2gobGluZSk7XG4gICAgfVxuICAgIHJldHVybiBsaW5lcztcbiAgfVxuXG4gIC8vIEdldCB0aGUgbGluZSBudW1iZXIgb2YgdGhlIHN0YXJ0IG9mIHRoZSB2aXN1YWwgbGluZSB0aGF0IHRoZVxuICAvLyBnaXZlbiBsaW5lIG51bWJlciBpcyBwYXJ0IG9mLlxuICBmdW5jdGlvbiB2aXN1YWxMaW5lTm8oZG9jLCBsaW5lTikge1xuICAgIHZhciBsaW5lID0gZ2V0TGluZShkb2MsIGxpbmVOKSwgdmlzID0gdmlzdWFsTGluZShsaW5lKTtcbiAgICBpZiAobGluZSA9PSB2aXMpIHJldHVybiBsaW5lTjtcbiAgICByZXR1cm4gbGluZU5vKHZpcyk7XG4gIH1cbiAgLy8gR2V0IHRoZSBsaW5lIG51bWJlciBvZiB0aGUgc3RhcnQgb2YgdGhlIG5leHQgdmlzdWFsIGxpbmUgYWZ0ZXJcbiAgLy8gdGhlIGdpdmVuIGxpbmUuXG4gIGZ1bmN0aW9uIHZpc3VhbExpbmVFbmRObyhkb2MsIGxpbmVOKSB7XG4gICAgaWYgKGxpbmVOID4gZG9jLmxhc3RMaW5lKCkpIHJldHVybiBsaW5lTjtcbiAgICB2YXIgbGluZSA9IGdldExpbmUoZG9jLCBsaW5lTiksIG1lcmdlZDtcbiAgICBpZiAoIWxpbmVJc0hpZGRlbihkb2MsIGxpbmUpKSByZXR1cm4gbGluZU47XG4gICAgd2hpbGUgKG1lcmdlZCA9IGNvbGxhcHNlZFNwYW5BdEVuZChsaW5lKSlcbiAgICAgIGxpbmUgPSBtZXJnZWQuZmluZCgxLCB0cnVlKS5saW5lO1xuICAgIHJldHVybiBsaW5lTm8obGluZSkgKyAxO1xuICB9XG5cbiAgLy8gQ29tcHV0ZSB3aGV0aGVyIGEgbGluZSBpcyBoaWRkZW4uIExpbmVzIGNvdW50IGFzIGhpZGRlbiB3aGVuIHRoZXlcbiAgLy8gYXJlIHBhcnQgb2YgYSB2aXN1YWwgbGluZSB0aGF0IHN0YXJ0cyB3aXRoIGFub3RoZXIgbGluZSwgb3Igd2hlblxuICAvLyB0aGV5IGFyZSBlbnRpcmVseSBjb3ZlcmVkIGJ5IGNvbGxhcHNlZCwgbm9uLXdpZGdldCBzcGFuLlxuICBmdW5jdGlvbiBsaW5lSXNIaWRkZW4oZG9jLCBsaW5lKSB7XG4gICAgdmFyIHNwcyA9IHNhd0NvbGxhcHNlZFNwYW5zICYmIGxpbmUubWFya2VkU3BhbnM7XG4gICAgaWYgKHNwcykgZm9yICh2YXIgc3AsIGkgPSAwOyBpIDwgc3BzLmxlbmd0aDsgKytpKSB7XG4gICAgICBzcCA9IHNwc1tpXTtcbiAgICAgIGlmICghc3AubWFya2VyLmNvbGxhcHNlZCkgY29udGludWU7XG4gICAgICBpZiAoc3AuZnJvbSA9PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICAgIGlmIChzcC5tYXJrZXIud2lkZ2V0Tm9kZSkgY29udGludWU7XG4gICAgICBpZiAoc3AuZnJvbSA9PSAwICYmIHNwLm1hcmtlci5pbmNsdXNpdmVMZWZ0ICYmIGxpbmVJc0hpZGRlbklubmVyKGRvYywgbGluZSwgc3ApKVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gbGluZUlzSGlkZGVuSW5uZXIoZG9jLCBsaW5lLCBzcGFuKSB7XG4gICAgaWYgKHNwYW4udG8gPT0gbnVsbCkge1xuICAgICAgdmFyIGVuZCA9IHNwYW4ubWFya2VyLmZpbmQoMSwgdHJ1ZSk7XG4gICAgICByZXR1cm4gbGluZUlzSGlkZGVuSW5uZXIoZG9jLCBlbmQubGluZSwgZ2V0TWFya2VkU3BhbkZvcihlbmQubGluZS5tYXJrZWRTcGFucywgc3Bhbi5tYXJrZXIpKTtcbiAgICB9XG4gICAgaWYgKHNwYW4ubWFya2VyLmluY2x1c2l2ZVJpZ2h0ICYmIHNwYW4udG8gPT0gbGluZS50ZXh0Lmxlbmd0aClcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGZvciAodmFyIHNwLCBpID0gMDsgaSA8IGxpbmUubWFya2VkU3BhbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHNwID0gbGluZS5tYXJrZWRTcGFuc1tpXTtcbiAgICAgIGlmIChzcC5tYXJrZXIuY29sbGFwc2VkICYmICFzcC5tYXJrZXIud2lkZ2V0Tm9kZSAmJiBzcC5mcm9tID09IHNwYW4udG8gJiZcbiAgICAgICAgICAoc3AudG8gPT0gbnVsbCB8fCBzcC50byAhPSBzcGFuLmZyb20pICYmXG4gICAgICAgICAgKHNwLm1hcmtlci5pbmNsdXNpdmVMZWZ0IHx8IHNwYW4ubWFya2VyLmluY2x1c2l2ZVJpZ2h0KSAmJlxuICAgICAgICAgIGxpbmVJc0hpZGRlbklubmVyKGRvYywgbGluZSwgc3ApKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBMSU5FIFdJREdFVFNcblxuICAvLyBMaW5lIHdpZGdldHMgYXJlIGJsb2NrIGVsZW1lbnRzIGRpc3BsYXllZCBhYm92ZSBvciBiZWxvdyBhIGxpbmUuXG5cbiAgdmFyIExpbmVXaWRnZXQgPSBDb2RlTWlycm9yLkxpbmVXaWRnZXQgPSBmdW5jdGlvbihkb2MsIG5vZGUsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucykgZm9yICh2YXIgb3B0IGluIG9wdGlvbnMpIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KG9wdCkpXG4gICAgICB0aGlzW29wdF0gPSBvcHRpb25zW29wdF07XG4gICAgdGhpcy5kb2MgPSBkb2M7XG4gICAgdGhpcy5ub2RlID0gbm9kZTtcbiAgfTtcbiAgZXZlbnRNaXhpbihMaW5lV2lkZ2V0KTtcblxuICBmdW5jdGlvbiBhZGp1c3RTY3JvbGxXaGVuQWJvdmVWaXNpYmxlKGNtLCBsaW5lLCBkaWZmKSB7XG4gICAgaWYgKGhlaWdodEF0TGluZShsaW5lKSA8ICgoY20uY3VyT3AgJiYgY20uY3VyT3Auc2Nyb2xsVG9wKSB8fCBjbS5kb2Muc2Nyb2xsVG9wKSlcbiAgICAgIGFkZFRvU2Nyb2xsUG9zKGNtLCBudWxsLCBkaWZmKTtcbiAgfVxuXG4gIExpbmVXaWRnZXQucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNtID0gdGhpcy5kb2MuY20sIHdzID0gdGhpcy5saW5lLndpZGdldHMsIGxpbmUgPSB0aGlzLmxpbmUsIG5vID0gbGluZU5vKGxpbmUpO1xuICAgIGlmIChubyA9PSBudWxsIHx8ICF3cykgcmV0dXJuO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgd3MubGVuZ3RoOyArK2kpIGlmICh3c1tpXSA9PSB0aGlzKSB3cy5zcGxpY2UoaS0tLCAxKTtcbiAgICBpZiAoIXdzLmxlbmd0aCkgbGluZS53aWRnZXRzID0gbnVsbDtcbiAgICB2YXIgaGVpZ2h0ID0gd2lkZ2V0SGVpZ2h0KHRoaXMpO1xuICAgIHVwZGF0ZUxpbmVIZWlnaHQobGluZSwgTWF0aC5tYXgoMCwgbGluZS5oZWlnaHQgLSBoZWlnaHQpKTtcbiAgICBpZiAoY20pIHJ1bkluT3AoY20sIGZ1bmN0aW9uKCkge1xuICAgICAgYWRqdXN0U2Nyb2xsV2hlbkFib3ZlVmlzaWJsZShjbSwgbGluZSwgLWhlaWdodCk7XG4gICAgICByZWdMaW5lQ2hhbmdlKGNtLCBubywgXCJ3aWRnZXRcIik7XG4gICAgfSk7XG4gIH07XG4gIExpbmVXaWRnZXQucHJvdG90eXBlLmNoYW5nZWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgb2xkSCA9IHRoaXMuaGVpZ2h0LCBjbSA9IHRoaXMuZG9jLmNtLCBsaW5lID0gdGhpcy5saW5lO1xuICAgIHRoaXMuaGVpZ2h0ID0gbnVsbDtcbiAgICB2YXIgZGlmZiA9IHdpZGdldEhlaWdodCh0aGlzKSAtIG9sZEg7XG4gICAgaWYgKCFkaWZmKSByZXR1cm47XG4gICAgdXBkYXRlTGluZUhlaWdodChsaW5lLCBsaW5lLmhlaWdodCArIGRpZmYpO1xuICAgIGlmIChjbSkgcnVuSW5PcChjbSwgZnVuY3Rpb24oKSB7XG4gICAgICBjbS5jdXJPcC5mb3JjZVVwZGF0ZSA9IHRydWU7XG4gICAgICBhZGp1c3RTY3JvbGxXaGVuQWJvdmVWaXNpYmxlKGNtLCBsaW5lLCBkaWZmKTtcbiAgICB9KTtcbiAgfTtcblxuICBmdW5jdGlvbiB3aWRnZXRIZWlnaHQod2lkZ2V0KSB7XG4gICAgaWYgKHdpZGdldC5oZWlnaHQgIT0gbnVsbCkgcmV0dXJuIHdpZGdldC5oZWlnaHQ7XG4gICAgdmFyIGNtID0gd2lkZ2V0LmRvYy5jbTtcbiAgICBpZiAoIWNtKSByZXR1cm4gMDtcbiAgICBpZiAoIWNvbnRhaW5zKGRvY3VtZW50LmJvZHksIHdpZGdldC5ub2RlKSkge1xuICAgICAgdmFyIHBhcmVudFN0eWxlID0gXCJwb3NpdGlvbjogcmVsYXRpdmU7XCI7XG4gICAgICBpZiAod2lkZ2V0LmNvdmVyR3V0dGVyKVxuICAgICAgICBwYXJlbnRTdHlsZSArPSBcIm1hcmdpbi1sZWZ0OiAtXCIgKyBjbS5kaXNwbGF5Lmd1dHRlcnMub2Zmc2V0V2lkdGggKyBcInB4O1wiO1xuICAgICAgaWYgKHdpZGdldC5ub0hTY3JvbGwpXG4gICAgICAgIHBhcmVudFN0eWxlICs9IFwid2lkdGg6IFwiICsgY20uZGlzcGxheS53cmFwcGVyLmNsaWVudFdpZHRoICsgXCJweDtcIjtcbiAgICAgIHJlbW92ZUNoaWxkcmVuQW5kQWRkKGNtLmRpc3BsYXkubWVhc3VyZSwgZWx0KFwiZGl2XCIsIFt3aWRnZXQubm9kZV0sIG51bGwsIHBhcmVudFN0eWxlKSk7XG4gICAgfVxuICAgIHJldHVybiB3aWRnZXQuaGVpZ2h0ID0gd2lkZ2V0Lm5vZGUub2Zmc2V0SGVpZ2h0O1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkTGluZVdpZGdldChkb2MsIGhhbmRsZSwgbm9kZSwgb3B0aW9ucykge1xuICAgIHZhciB3aWRnZXQgPSBuZXcgTGluZVdpZGdldChkb2MsIG5vZGUsIG9wdGlvbnMpO1xuICAgIHZhciBjbSA9IGRvYy5jbTtcbiAgICBpZiAoY20gJiYgd2lkZ2V0Lm5vSFNjcm9sbCkgY20uZGlzcGxheS5hbGlnbldpZGdldHMgPSB0cnVlO1xuICAgIGNoYW5nZUxpbmUoZG9jLCBoYW5kbGUsIFwid2lkZ2V0XCIsIGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgIHZhciB3aWRnZXRzID0gbGluZS53aWRnZXRzIHx8IChsaW5lLndpZGdldHMgPSBbXSk7XG4gICAgICBpZiAod2lkZ2V0Lmluc2VydEF0ID09IG51bGwpIHdpZGdldHMucHVzaCh3aWRnZXQpO1xuICAgICAgZWxzZSB3aWRnZXRzLnNwbGljZShNYXRoLm1pbih3aWRnZXRzLmxlbmd0aCAtIDEsIE1hdGgubWF4KDAsIHdpZGdldC5pbnNlcnRBdCkpLCAwLCB3aWRnZXQpO1xuICAgICAgd2lkZ2V0LmxpbmUgPSBsaW5lO1xuICAgICAgaWYgKGNtICYmICFsaW5lSXNIaWRkZW4oZG9jLCBsaW5lKSkge1xuICAgICAgICB2YXIgYWJvdmVWaXNpYmxlID0gaGVpZ2h0QXRMaW5lKGxpbmUpIDwgZG9jLnNjcm9sbFRvcDtcbiAgICAgICAgdXBkYXRlTGluZUhlaWdodChsaW5lLCBsaW5lLmhlaWdodCArIHdpZGdldEhlaWdodCh3aWRnZXQpKTtcbiAgICAgICAgaWYgKGFib3ZlVmlzaWJsZSkgYWRkVG9TY3JvbGxQb3MoY20sIG51bGwsIHdpZGdldC5oZWlnaHQpO1xuICAgICAgICBjbS5jdXJPcC5mb3JjZVVwZGF0ZSA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gd2lkZ2V0O1xuICB9XG5cbiAgLy8gTElORSBEQVRBIFNUUlVDVFVSRVxuXG4gIC8vIExpbmUgb2JqZWN0cy4gVGhlc2UgaG9sZCBzdGF0ZSByZWxhdGVkIHRvIGEgbGluZSwgaW5jbHVkaW5nXG4gIC8vIGhpZ2hsaWdodGluZyBpbmZvICh0aGUgc3R5bGVzIGFycmF5KS5cbiAgdmFyIExpbmUgPSBDb2RlTWlycm9yLkxpbmUgPSBmdW5jdGlvbih0ZXh0LCBtYXJrZWRTcGFucywgZXN0aW1hdGVIZWlnaHQpIHtcbiAgICB0aGlzLnRleHQgPSB0ZXh0O1xuICAgIGF0dGFjaE1hcmtlZFNwYW5zKHRoaXMsIG1hcmtlZFNwYW5zKTtcbiAgICB0aGlzLmhlaWdodCA9IGVzdGltYXRlSGVpZ2h0ID8gZXN0aW1hdGVIZWlnaHQodGhpcykgOiAxO1xuICB9O1xuICBldmVudE1peGluKExpbmUpO1xuICBMaW5lLnByb3RvdHlwZS5saW5lTm8gPSBmdW5jdGlvbigpIHsgcmV0dXJuIGxpbmVObyh0aGlzKTsgfTtcblxuICAvLyBDaGFuZ2UgdGhlIGNvbnRlbnQgKHRleHQsIG1hcmtlcnMpIG9mIGEgbGluZS4gQXV0b21hdGljYWxseVxuICAvLyBpbnZhbGlkYXRlcyBjYWNoZWQgaW5mb3JtYXRpb24gYW5kIHRyaWVzIHRvIHJlLWVzdGltYXRlIHRoZVxuICAvLyBsaW5lJ3MgaGVpZ2h0LlxuICBmdW5jdGlvbiB1cGRhdGVMaW5lKGxpbmUsIHRleHQsIG1hcmtlZFNwYW5zLCBlc3RpbWF0ZUhlaWdodCkge1xuICAgIGxpbmUudGV4dCA9IHRleHQ7XG4gICAgaWYgKGxpbmUuc3RhdGVBZnRlcikgbGluZS5zdGF0ZUFmdGVyID0gbnVsbDtcbiAgICBpZiAobGluZS5zdHlsZXMpIGxpbmUuc3R5bGVzID0gbnVsbDtcbiAgICBpZiAobGluZS5vcmRlciAhPSBudWxsKSBsaW5lLm9yZGVyID0gbnVsbDtcbiAgICBkZXRhY2hNYXJrZWRTcGFucyhsaW5lKTtcbiAgICBhdHRhY2hNYXJrZWRTcGFucyhsaW5lLCBtYXJrZWRTcGFucyk7XG4gICAgdmFyIGVzdEhlaWdodCA9IGVzdGltYXRlSGVpZ2h0ID8gZXN0aW1hdGVIZWlnaHQobGluZSkgOiAxO1xuICAgIGlmIChlc3RIZWlnaHQgIT0gbGluZS5oZWlnaHQpIHVwZGF0ZUxpbmVIZWlnaHQobGluZSwgZXN0SGVpZ2h0KTtcbiAgfVxuXG4gIC8vIERldGFjaCBhIGxpbmUgZnJvbSB0aGUgZG9jdW1lbnQgdHJlZSBhbmQgaXRzIG1hcmtlcnMuXG4gIGZ1bmN0aW9uIGNsZWFuVXBMaW5lKGxpbmUpIHtcbiAgICBsaW5lLnBhcmVudCA9IG51bGw7XG4gICAgZGV0YWNoTWFya2VkU3BhbnMobGluZSk7XG4gIH1cblxuICBmdW5jdGlvbiBleHRyYWN0TGluZUNsYXNzZXModHlwZSwgb3V0cHV0KSB7XG4gICAgaWYgKHR5cGUpIGZvciAoOzspIHtcbiAgICAgIHZhciBsaW5lQ2xhc3MgPSB0eXBlLm1hdGNoKC8oPzpefFxccyspbGluZS0oYmFja2dyb3VuZC0pPyhcXFMrKS8pO1xuICAgICAgaWYgKCFsaW5lQ2xhc3MpIGJyZWFrO1xuICAgICAgdHlwZSA9IHR5cGUuc2xpY2UoMCwgbGluZUNsYXNzLmluZGV4KSArIHR5cGUuc2xpY2UobGluZUNsYXNzLmluZGV4ICsgbGluZUNsYXNzWzBdLmxlbmd0aCk7XG4gICAgICB2YXIgcHJvcCA9IGxpbmVDbGFzc1sxXSA/IFwiYmdDbGFzc1wiIDogXCJ0ZXh0Q2xhc3NcIjtcbiAgICAgIGlmIChvdXRwdXRbcHJvcF0gPT0gbnVsbClcbiAgICAgICAgb3V0cHV0W3Byb3BdID0gbGluZUNsYXNzWzJdO1xuICAgICAgZWxzZSBpZiAoIShuZXcgUmVnRXhwKFwiKD86XnxcXHMpXCIgKyBsaW5lQ2xhc3NbMl0gKyBcIig/OiR8XFxzKVwiKSkudGVzdChvdXRwdXRbcHJvcF0pKVxuICAgICAgICBvdXRwdXRbcHJvcF0gKz0gXCIgXCIgKyBsaW5lQ2xhc3NbMl07XG4gICAgfVxuICAgIHJldHVybiB0eXBlO1xuICB9XG5cbiAgZnVuY3Rpb24gY2FsbEJsYW5rTGluZShtb2RlLCBzdGF0ZSkge1xuICAgIGlmIChtb2RlLmJsYW5rTGluZSkgcmV0dXJuIG1vZGUuYmxhbmtMaW5lKHN0YXRlKTtcbiAgICBpZiAoIW1vZGUuaW5uZXJNb2RlKSByZXR1cm47XG4gICAgdmFyIGlubmVyID0gQ29kZU1pcnJvci5pbm5lck1vZGUobW9kZSwgc3RhdGUpO1xuICAgIGlmIChpbm5lci5tb2RlLmJsYW5rTGluZSkgcmV0dXJuIGlubmVyLm1vZGUuYmxhbmtMaW5lKGlubmVyLnN0YXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRUb2tlbihtb2RlLCBzdHJlYW0sIHN0YXRlLCBpbm5lcikge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMTA7IGkrKykge1xuICAgICAgaWYgKGlubmVyKSBpbm5lclswXSA9IENvZGVNaXJyb3IuaW5uZXJNb2RlKG1vZGUsIHN0YXRlKS5tb2RlO1xuICAgICAgdmFyIHN0eWxlID0gbW9kZS50b2tlbihzdHJlYW0sIHN0YXRlKTtcbiAgICAgIGlmIChzdHJlYW0ucG9zID4gc3RyZWFtLnN0YXJ0KSByZXR1cm4gc3R5bGU7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcIk1vZGUgXCIgKyBtb2RlLm5hbWUgKyBcIiBmYWlsZWQgdG8gYWR2YW5jZSBzdHJlYW0uXCIpO1xuICB9XG5cbiAgLy8gVXRpbGl0eSBmb3IgZ2V0VG9rZW5BdCBhbmQgZ2V0TGluZVRva2Vuc1xuICBmdW5jdGlvbiB0YWtlVG9rZW4oY20sIHBvcywgcHJlY2lzZSwgYXNBcnJheSkge1xuICAgIGZ1bmN0aW9uIGdldE9iaihjb3B5KSB7XG4gICAgICByZXR1cm4ge3N0YXJ0OiBzdHJlYW0uc3RhcnQsIGVuZDogc3RyZWFtLnBvcyxcbiAgICAgICAgICAgICAgc3RyaW5nOiBzdHJlYW0uY3VycmVudCgpLFxuICAgICAgICAgICAgICB0eXBlOiBzdHlsZSB8fCBudWxsLFxuICAgICAgICAgICAgICBzdGF0ZTogY29weSA/IGNvcHlTdGF0ZShkb2MubW9kZSwgc3RhdGUpIDogc3RhdGV9O1xuICAgIH1cblxuICAgIHZhciBkb2MgPSBjbS5kb2MsIG1vZGUgPSBkb2MubW9kZSwgc3R5bGU7XG4gICAgcG9zID0gY2xpcFBvcyhkb2MsIHBvcyk7XG4gICAgdmFyIGxpbmUgPSBnZXRMaW5lKGRvYywgcG9zLmxpbmUpLCBzdGF0ZSA9IGdldFN0YXRlQmVmb3JlKGNtLCBwb3MubGluZSwgcHJlY2lzZSk7XG4gICAgdmFyIHN0cmVhbSA9IG5ldyBTdHJpbmdTdHJlYW0obGluZS50ZXh0LCBjbS5vcHRpb25zLnRhYlNpemUpLCB0b2tlbnM7XG4gICAgaWYgKGFzQXJyYXkpIHRva2VucyA9IFtdO1xuICAgIHdoaWxlICgoYXNBcnJheSB8fCBzdHJlYW0ucG9zIDwgcG9zLmNoKSAmJiAhc3RyZWFtLmVvbCgpKSB7XG4gICAgICBzdHJlYW0uc3RhcnQgPSBzdHJlYW0ucG9zO1xuICAgICAgc3R5bGUgPSByZWFkVG9rZW4obW9kZSwgc3RyZWFtLCBzdGF0ZSk7XG4gICAgICBpZiAoYXNBcnJheSkgdG9rZW5zLnB1c2goZ2V0T2JqKHRydWUpKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzQXJyYXkgPyB0b2tlbnMgOiBnZXRPYmooKTtcbiAgfVxuXG4gIC8vIFJ1biB0aGUgZ2l2ZW4gbW9kZSdzIHBhcnNlciBvdmVyIGEgbGluZSwgY2FsbGluZyBmIGZvciBlYWNoIHRva2VuLlxuICBmdW5jdGlvbiBydW5Nb2RlKGNtLCB0ZXh0LCBtb2RlLCBzdGF0ZSwgZiwgbGluZUNsYXNzZXMsIGZvcmNlVG9FbmQpIHtcbiAgICB2YXIgZmxhdHRlblNwYW5zID0gbW9kZS5mbGF0dGVuU3BhbnM7XG4gICAgaWYgKGZsYXR0ZW5TcGFucyA9PSBudWxsKSBmbGF0dGVuU3BhbnMgPSBjbS5vcHRpb25zLmZsYXR0ZW5TcGFucztcbiAgICB2YXIgY3VyU3RhcnQgPSAwLCBjdXJTdHlsZSA9IG51bGw7XG4gICAgdmFyIHN0cmVhbSA9IG5ldyBTdHJpbmdTdHJlYW0odGV4dCwgY20ub3B0aW9ucy50YWJTaXplKSwgc3R5bGU7XG4gICAgdmFyIGlubmVyID0gY20ub3B0aW9ucy5hZGRNb2RlQ2xhc3MgJiYgW251bGxdO1xuICAgIGlmICh0ZXh0ID09IFwiXCIpIGV4dHJhY3RMaW5lQ2xhc3NlcyhjYWxsQmxhbmtMaW5lKG1vZGUsIHN0YXRlKSwgbGluZUNsYXNzZXMpO1xuICAgIHdoaWxlICghc3RyZWFtLmVvbCgpKSB7XG4gICAgICBpZiAoc3RyZWFtLnBvcyA+IGNtLm9wdGlvbnMubWF4SGlnaGxpZ2h0TGVuZ3RoKSB7XG4gICAgICAgIGZsYXR0ZW5TcGFucyA9IGZhbHNlO1xuICAgICAgICBpZiAoZm9yY2VUb0VuZCkgcHJvY2Vzc0xpbmUoY20sIHRleHQsIHN0YXRlLCBzdHJlYW0ucG9zKTtcbiAgICAgICAgc3RyZWFtLnBvcyA9IHRleHQubGVuZ3RoO1xuICAgICAgICBzdHlsZSA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHlsZSA9IGV4dHJhY3RMaW5lQ2xhc3NlcyhyZWFkVG9rZW4obW9kZSwgc3RyZWFtLCBzdGF0ZSwgaW5uZXIpLCBsaW5lQ2xhc3Nlcyk7XG4gICAgICB9XG4gICAgICBpZiAoaW5uZXIpIHtcbiAgICAgICAgdmFyIG1OYW1lID0gaW5uZXJbMF0ubmFtZTtcbiAgICAgICAgaWYgKG1OYW1lKSBzdHlsZSA9IFwibS1cIiArIChzdHlsZSA/IG1OYW1lICsgXCIgXCIgKyBzdHlsZSA6IG1OYW1lKTtcbiAgICAgIH1cbiAgICAgIGlmICghZmxhdHRlblNwYW5zIHx8IGN1clN0eWxlICE9IHN0eWxlKSB7XG4gICAgICAgIHdoaWxlIChjdXJTdGFydCA8IHN0cmVhbS5zdGFydCkge1xuICAgICAgICAgIGN1clN0YXJ0ID0gTWF0aC5taW4oc3RyZWFtLnN0YXJ0LCBjdXJTdGFydCArIDUwMDAwKTtcbiAgICAgICAgICBmKGN1clN0YXJ0LCBjdXJTdHlsZSk7XG4gICAgICAgIH1cbiAgICAgICAgY3VyU3R5bGUgPSBzdHlsZTtcbiAgICAgIH1cbiAgICAgIHN0cmVhbS5zdGFydCA9IHN0cmVhbS5wb3M7XG4gICAgfVxuICAgIHdoaWxlIChjdXJTdGFydCA8IHN0cmVhbS5wb3MpIHtcbiAgICAgIC8vIFdlYmtpdCBzZWVtcyB0byByZWZ1c2UgdG8gcmVuZGVyIHRleHQgbm9kZXMgbG9uZ2VyIHRoYW4gNTc0NDQgY2hhcmFjdGVyc1xuICAgICAgdmFyIHBvcyA9IE1hdGgubWluKHN0cmVhbS5wb3MsIGN1clN0YXJ0ICsgNTAwMDApO1xuICAgICAgZihwb3MsIGN1clN0eWxlKTtcbiAgICAgIGN1clN0YXJ0ID0gcG9zO1xuICAgIH1cbiAgfVxuXG4gIC8vIENvbXB1dGUgYSBzdHlsZSBhcnJheSAoYW4gYXJyYXkgc3RhcnRpbmcgd2l0aCBhIG1vZGUgZ2VuZXJhdGlvblxuICAvLyAtLSBmb3IgaW52YWxpZGF0aW9uIC0tIGZvbGxvd2VkIGJ5IHBhaXJzIG9mIGVuZCBwb3NpdGlvbnMgYW5kXG4gIC8vIHN0eWxlIHN0cmluZ3MpLCB3aGljaCBpcyB1c2VkIHRvIGhpZ2hsaWdodCB0aGUgdG9rZW5zIG9uIHRoZVxuICAvLyBsaW5lLlxuICBmdW5jdGlvbiBoaWdobGlnaHRMaW5lKGNtLCBsaW5lLCBzdGF0ZSwgZm9yY2VUb0VuZCkge1xuICAgIC8vIEEgc3R5bGVzIGFycmF5IGFsd2F5cyBzdGFydHMgd2l0aCBhIG51bWJlciBpZGVudGlmeWluZyB0aGVcbiAgICAvLyBtb2RlL292ZXJsYXlzIHRoYXQgaXQgaXMgYmFzZWQgb24gKGZvciBlYXN5IGludmFsaWRhdGlvbikuXG4gICAgdmFyIHN0ID0gW2NtLnN0YXRlLm1vZGVHZW5dLCBsaW5lQ2xhc3NlcyA9IHt9O1xuICAgIC8vIENvbXB1dGUgdGhlIGJhc2UgYXJyYXkgb2Ygc3R5bGVzXG4gICAgcnVuTW9kZShjbSwgbGluZS50ZXh0LCBjbS5kb2MubW9kZSwgc3RhdGUsIGZ1bmN0aW9uKGVuZCwgc3R5bGUpIHtcbiAgICAgIHN0LnB1c2goZW5kLCBzdHlsZSk7XG4gICAgfSwgbGluZUNsYXNzZXMsIGZvcmNlVG9FbmQpO1xuXG4gICAgLy8gUnVuIG92ZXJsYXlzLCBhZGp1c3Qgc3R5bGUgYXJyYXkuXG4gICAgZm9yICh2YXIgbyA9IDA7IG8gPCBjbS5zdGF0ZS5vdmVybGF5cy5sZW5ndGg7ICsrbykge1xuICAgICAgdmFyIG92ZXJsYXkgPSBjbS5zdGF0ZS5vdmVybGF5c1tvXSwgaSA9IDEsIGF0ID0gMDtcbiAgICAgIHJ1bk1vZGUoY20sIGxpbmUudGV4dCwgb3ZlcmxheS5tb2RlLCB0cnVlLCBmdW5jdGlvbihlbmQsIHN0eWxlKSB7XG4gICAgICAgIHZhciBzdGFydCA9IGk7XG4gICAgICAgIC8vIEVuc3VyZSB0aGVyZSdzIGEgdG9rZW4gZW5kIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uLCBhbmQgdGhhdCBpIHBvaW50cyBhdCBpdFxuICAgICAgICB3aGlsZSAoYXQgPCBlbmQpIHtcbiAgICAgICAgICB2YXIgaV9lbmQgPSBzdFtpXTtcbiAgICAgICAgICBpZiAoaV9lbmQgPiBlbmQpXG4gICAgICAgICAgICBzdC5zcGxpY2UoaSwgMSwgZW5kLCBzdFtpKzFdLCBpX2VuZCk7XG4gICAgICAgICAgaSArPSAyO1xuICAgICAgICAgIGF0ID0gTWF0aC5taW4oZW5kLCBpX2VuZCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFzdHlsZSkgcmV0dXJuO1xuICAgICAgICBpZiAob3ZlcmxheS5vcGFxdWUpIHtcbiAgICAgICAgICBzdC5zcGxpY2Uoc3RhcnQsIGkgLSBzdGFydCwgZW5kLCBcImNtLW92ZXJsYXkgXCIgKyBzdHlsZSk7XG4gICAgICAgICAgaSA9IHN0YXJ0ICsgMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb3IgKDsgc3RhcnQgPCBpOyBzdGFydCArPSAyKSB7XG4gICAgICAgICAgICB2YXIgY3VyID0gc3Rbc3RhcnQrMV07XG4gICAgICAgICAgICBzdFtzdGFydCsxXSA9IChjdXIgPyBjdXIgKyBcIiBcIiA6IFwiXCIpICsgXCJjbS1vdmVybGF5IFwiICsgc3R5bGU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LCBsaW5lQ2xhc3Nlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtzdHlsZXM6IHN0LCBjbGFzc2VzOiBsaW5lQ2xhc3Nlcy5iZ0NsYXNzIHx8IGxpbmVDbGFzc2VzLnRleHRDbGFzcyA/IGxpbmVDbGFzc2VzIDogbnVsbH07XG4gIH1cblxuICBmdW5jdGlvbiBnZXRMaW5lU3R5bGVzKGNtLCBsaW5lLCB1cGRhdGVGcm9udGllcikge1xuICAgIGlmICghbGluZS5zdHlsZXMgfHwgbGluZS5zdHlsZXNbMF0gIT0gY20uc3RhdGUubW9kZUdlbikge1xuICAgICAgdmFyIHN0YXRlID0gZ2V0U3RhdGVCZWZvcmUoY20sIGxpbmVObyhsaW5lKSk7XG4gICAgICB2YXIgcmVzdWx0ID0gaGlnaGxpZ2h0TGluZShjbSwgbGluZSwgbGluZS50ZXh0Lmxlbmd0aCA+IGNtLm9wdGlvbnMubWF4SGlnaGxpZ2h0TGVuZ3RoID8gY29weVN0YXRlKGNtLmRvYy5tb2RlLCBzdGF0ZSkgOiBzdGF0ZSk7XG4gICAgICBsaW5lLnN0YXRlQWZ0ZXIgPSBzdGF0ZTtcbiAgICAgIGxpbmUuc3R5bGVzID0gcmVzdWx0LnN0eWxlcztcbiAgICAgIGlmIChyZXN1bHQuY2xhc3NlcykgbGluZS5zdHlsZUNsYXNzZXMgPSByZXN1bHQuY2xhc3NlcztcbiAgICAgIGVsc2UgaWYgKGxpbmUuc3R5bGVDbGFzc2VzKSBsaW5lLnN0eWxlQ2xhc3NlcyA9IG51bGw7XG4gICAgICBpZiAodXBkYXRlRnJvbnRpZXIgPT09IGNtLmRvYy5mcm9udGllcikgY20uZG9jLmZyb250aWVyKys7XG4gICAgfVxuICAgIHJldHVybiBsaW5lLnN0eWxlcztcbiAgfVxuXG4gIC8vIExpZ2h0d2VpZ2h0IGZvcm0gb2YgaGlnaGxpZ2h0IC0tIHByb2NlZWQgb3ZlciB0aGlzIGxpbmUgYW5kXG4gIC8vIHVwZGF0ZSBzdGF0ZSwgYnV0IGRvbid0IHNhdmUgYSBzdHlsZSBhcnJheS4gVXNlZCBmb3IgbGluZXMgdGhhdFxuICAvLyBhcmVuJ3QgY3VycmVudGx5IHZpc2libGUuXG4gIGZ1bmN0aW9uIHByb2Nlc3NMaW5lKGNtLCB0ZXh0LCBzdGF0ZSwgc3RhcnRBdCkge1xuICAgIHZhciBtb2RlID0gY20uZG9jLm1vZGU7XG4gICAgdmFyIHN0cmVhbSA9IG5ldyBTdHJpbmdTdHJlYW0odGV4dCwgY20ub3B0aW9ucy50YWJTaXplKTtcbiAgICBzdHJlYW0uc3RhcnQgPSBzdHJlYW0ucG9zID0gc3RhcnRBdCB8fCAwO1xuICAgIGlmICh0ZXh0ID09IFwiXCIpIGNhbGxCbGFua0xpbmUobW9kZSwgc3RhdGUpO1xuICAgIHdoaWxlICghc3RyZWFtLmVvbCgpKSB7XG4gICAgICByZWFkVG9rZW4obW9kZSwgc3RyZWFtLCBzdGF0ZSk7XG4gICAgICBzdHJlYW0uc3RhcnQgPSBzdHJlYW0ucG9zO1xuICAgIH1cbiAgfVxuXG4gIC8vIENvbnZlcnQgYSBzdHlsZSBhcyByZXR1cm5lZCBieSBhIG1vZGUgKGVpdGhlciBudWxsLCBvciBhIHN0cmluZ1xuICAvLyBjb250YWluaW5nIG9uZSBvciBtb3JlIHN0eWxlcykgdG8gYSBDU1Mgc3R5bGUuIFRoaXMgaXMgY2FjaGVkLFxuICAvLyBhbmQgYWxzbyBsb29rcyBmb3IgbGluZS13aWRlIHN0eWxlcy5cbiAgdmFyIHN0eWxlVG9DbGFzc0NhY2hlID0ge30sIHN0eWxlVG9DbGFzc0NhY2hlV2l0aE1vZGUgPSB7fTtcbiAgZnVuY3Rpb24gaW50ZXJwcmV0VG9rZW5TdHlsZShzdHlsZSwgb3B0aW9ucykge1xuICAgIGlmICghc3R5bGUgfHwgL15cXHMqJC8udGVzdChzdHlsZSkpIHJldHVybiBudWxsO1xuICAgIHZhciBjYWNoZSA9IG9wdGlvbnMuYWRkTW9kZUNsYXNzID8gc3R5bGVUb0NsYXNzQ2FjaGVXaXRoTW9kZSA6IHN0eWxlVG9DbGFzc0NhY2hlO1xuICAgIHJldHVybiBjYWNoZVtzdHlsZV0gfHxcbiAgICAgIChjYWNoZVtzdHlsZV0gPSBzdHlsZS5yZXBsYWNlKC9cXFMrL2csIFwiY20tJCZcIikpO1xuICB9XG5cbiAgLy8gUmVuZGVyIHRoZSBET00gcmVwcmVzZW50YXRpb24gb2YgdGhlIHRleHQgb2YgYSBsaW5lLiBBbHNvIGJ1aWxkc1xuICAvLyB1cCBhICdsaW5lIG1hcCcsIHdoaWNoIHBvaW50cyBhdCB0aGUgRE9NIG5vZGVzIHRoYXQgcmVwcmVzZW50XG4gIC8vIHNwZWNpZmljIHN0cmV0Y2hlcyBvZiB0ZXh0LCBhbmQgaXMgdXNlZCBieSB0aGUgbWVhc3VyaW5nIGNvZGUuXG4gIC8vIFRoZSByZXR1cm5lZCBvYmplY3QgY29udGFpbnMgdGhlIERPTSBub2RlLCB0aGlzIG1hcCwgYW5kXG4gIC8vIGluZm9ybWF0aW9uIGFib3V0IGxpbmUtd2lkZSBzdHlsZXMgdGhhdCB3ZXJlIHNldCBieSB0aGUgbW9kZS5cbiAgZnVuY3Rpb24gYnVpbGRMaW5lQ29udGVudChjbSwgbGluZVZpZXcpIHtcbiAgICAvLyBUaGUgcGFkZGluZy1yaWdodCBmb3JjZXMgdGhlIGVsZW1lbnQgdG8gaGF2ZSBhICdib3JkZXInLCB3aGljaFxuICAgIC8vIGlzIG5lZWRlZCBvbiBXZWJraXQgdG8gYmUgYWJsZSB0byBnZXQgbGluZS1sZXZlbCBib3VuZGluZ1xuICAgIC8vIHJlY3RhbmdsZXMgZm9yIGl0IChpbiBtZWFzdXJlQ2hhcikuXG4gICAgdmFyIGNvbnRlbnQgPSBlbHQoXCJzcGFuXCIsIG51bGwsIG51bGwsIHdlYmtpdCA/IFwicGFkZGluZy1yaWdodDogLjFweFwiIDogbnVsbCk7XG4gICAgdmFyIGJ1aWxkZXIgPSB7cHJlOiBlbHQoXCJwcmVcIiwgW2NvbnRlbnRdLCBcIkNvZGVNaXJyb3ItbGluZVwiKSwgY29udGVudDogY29udGVudCxcbiAgICAgICAgICAgICAgICAgICBjb2w6IDAsIHBvczogMCwgY206IGNtLFxuICAgICAgICAgICAgICAgICAgIHNwbGl0U3BhY2VzOiAoaWUgfHwgd2Via2l0KSAmJiBjbS5nZXRPcHRpb24oXCJsaW5lV3JhcHBpbmdcIil9O1xuICAgIGxpbmVWaWV3Lm1lYXN1cmUgPSB7fTtcblxuICAgIC8vIEl0ZXJhdGUgb3ZlciB0aGUgbG9naWNhbCBsaW5lcyB0aGF0IG1ha2UgdXAgdGhpcyB2aXN1YWwgbGluZS5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8PSAobGluZVZpZXcucmVzdCA/IGxpbmVWaWV3LnJlc3QubGVuZ3RoIDogMCk7IGkrKykge1xuICAgICAgdmFyIGxpbmUgPSBpID8gbGluZVZpZXcucmVzdFtpIC0gMV0gOiBsaW5lVmlldy5saW5lLCBvcmRlcjtcbiAgICAgIGJ1aWxkZXIucG9zID0gMDtcbiAgICAgIGJ1aWxkZXIuYWRkVG9rZW4gPSBidWlsZFRva2VuO1xuICAgICAgLy8gT3B0aW9uYWxseSB3aXJlIGluIHNvbWUgaGFja3MgaW50byB0aGUgdG9rZW4tcmVuZGVyaW5nXG4gICAgICAvLyBhbGdvcml0aG0sIHRvIGRlYWwgd2l0aCBicm93c2VyIHF1aXJrcy5cbiAgICAgIGlmIChoYXNCYWRCaWRpUmVjdHMoY20uZGlzcGxheS5tZWFzdXJlKSAmJiAob3JkZXIgPSBnZXRPcmRlcihsaW5lKSkpXG4gICAgICAgIGJ1aWxkZXIuYWRkVG9rZW4gPSBidWlsZFRva2VuQmFkQmlkaShidWlsZGVyLmFkZFRva2VuLCBvcmRlcik7XG4gICAgICBidWlsZGVyLm1hcCA9IFtdO1xuICAgICAgdmFyIGFsbG93RnJvbnRpZXJVcGRhdGUgPSBsaW5lVmlldyAhPSBjbS5kaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQgJiYgbGluZU5vKGxpbmUpO1xuICAgICAgaW5zZXJ0TGluZUNvbnRlbnQobGluZSwgYnVpbGRlciwgZ2V0TGluZVN0eWxlcyhjbSwgbGluZSwgYWxsb3dGcm9udGllclVwZGF0ZSkpO1xuICAgICAgaWYgKGxpbmUuc3R5bGVDbGFzc2VzKSB7XG4gICAgICAgIGlmIChsaW5lLnN0eWxlQ2xhc3Nlcy5iZ0NsYXNzKVxuICAgICAgICAgIGJ1aWxkZXIuYmdDbGFzcyA9IGpvaW5DbGFzc2VzKGxpbmUuc3R5bGVDbGFzc2VzLmJnQ2xhc3MsIGJ1aWxkZXIuYmdDbGFzcyB8fCBcIlwiKTtcbiAgICAgICAgaWYgKGxpbmUuc3R5bGVDbGFzc2VzLnRleHRDbGFzcylcbiAgICAgICAgICBidWlsZGVyLnRleHRDbGFzcyA9IGpvaW5DbGFzc2VzKGxpbmUuc3R5bGVDbGFzc2VzLnRleHRDbGFzcywgYnVpbGRlci50ZXh0Q2xhc3MgfHwgXCJcIik7XG4gICAgICB9XG5cbiAgICAgIC8vIEVuc3VyZSBhdCBsZWFzdCBhIHNpbmdsZSBub2RlIGlzIHByZXNlbnQsIGZvciBtZWFzdXJpbmcuXG4gICAgICBpZiAoYnVpbGRlci5tYXAubGVuZ3RoID09IDApXG4gICAgICAgIGJ1aWxkZXIubWFwLnB1c2goMCwgMCwgYnVpbGRlci5jb250ZW50LmFwcGVuZENoaWxkKHplcm9XaWR0aEVsZW1lbnQoY20uZGlzcGxheS5tZWFzdXJlKSkpO1xuXG4gICAgICAvLyBTdG9yZSB0aGUgbWFwIGFuZCBhIGNhY2hlIG9iamVjdCBmb3IgdGhlIGN1cnJlbnQgbG9naWNhbCBsaW5lXG4gICAgICBpZiAoaSA9PSAwKSB7XG4gICAgICAgIGxpbmVWaWV3Lm1lYXN1cmUubWFwID0gYnVpbGRlci5tYXA7XG4gICAgICAgIGxpbmVWaWV3Lm1lYXN1cmUuY2FjaGUgPSB7fTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIChsaW5lVmlldy5tZWFzdXJlLm1hcHMgfHwgKGxpbmVWaWV3Lm1lYXN1cmUubWFwcyA9IFtdKSkucHVzaChidWlsZGVyLm1hcCk7XG4gICAgICAgIChsaW5lVmlldy5tZWFzdXJlLmNhY2hlcyB8fCAobGluZVZpZXcubWVhc3VyZS5jYWNoZXMgPSBbXSkpLnB1c2goe30pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNlZSBpc3N1ZSAjMjkwMVxuICAgIGlmICh3ZWJraXQgJiYgL1xcYmNtLXRhYlxcYi8udGVzdChidWlsZGVyLmNvbnRlbnQubGFzdENoaWxkLmNsYXNzTmFtZSkpXG4gICAgICBidWlsZGVyLmNvbnRlbnQuY2xhc3NOYW1lID0gXCJjbS10YWItd3JhcC1oYWNrXCI7XG5cbiAgICBzaWduYWwoY20sIFwicmVuZGVyTGluZVwiLCBjbSwgbGluZVZpZXcubGluZSwgYnVpbGRlci5wcmUpO1xuICAgIGlmIChidWlsZGVyLnByZS5jbGFzc05hbWUpXG4gICAgICBidWlsZGVyLnRleHRDbGFzcyA9IGpvaW5DbGFzc2VzKGJ1aWxkZXIucHJlLmNsYXNzTmFtZSwgYnVpbGRlci50ZXh0Q2xhc3MgfHwgXCJcIik7XG5cbiAgICByZXR1cm4gYnVpbGRlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRTcGVjaWFsQ2hhclBsYWNlaG9sZGVyKGNoKSB7XG4gICAgdmFyIHRva2VuID0gZWx0KFwic3BhblwiLCBcIlxcdTIwMjJcIiwgXCJjbS1pbnZhbGlkY2hhclwiKTtcbiAgICB0b2tlbi50aXRsZSA9IFwiXFxcXHVcIiArIGNoLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpO1xuICAgIHRva2VuLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgdG9rZW4udGl0bGUpO1xuICAgIHJldHVybiB0b2tlbjtcbiAgfVxuXG4gIC8vIEJ1aWxkIHVwIHRoZSBET00gcmVwcmVzZW50YXRpb24gZm9yIGEgc2luZ2xlIHRva2VuLCBhbmQgYWRkIGl0IHRvXG4gIC8vIHRoZSBsaW5lIG1hcC4gVGFrZXMgY2FyZSB0byByZW5kZXIgc3BlY2lhbCBjaGFyYWN0ZXJzIHNlcGFyYXRlbHkuXG4gIGZ1bmN0aW9uIGJ1aWxkVG9rZW4oYnVpbGRlciwgdGV4dCwgc3R5bGUsIHN0YXJ0U3R5bGUsIGVuZFN0eWxlLCB0aXRsZSwgY3NzKSB7XG4gICAgaWYgKCF0ZXh0KSByZXR1cm47XG4gICAgdmFyIGRpc3BsYXlUZXh0ID0gYnVpbGRlci5zcGxpdFNwYWNlcyA/IHRleHQucmVwbGFjZSgvIHszLH0vZywgc3BsaXRTcGFjZXMpIDogdGV4dDtcbiAgICB2YXIgc3BlY2lhbCA9IGJ1aWxkZXIuY20uc3RhdGUuc3BlY2lhbENoYXJzLCBtdXN0V3JhcCA9IGZhbHNlO1xuICAgIGlmICghc3BlY2lhbC50ZXN0KHRleHQpKSB7XG4gICAgICBidWlsZGVyLmNvbCArPSB0ZXh0Lmxlbmd0aDtcbiAgICAgIHZhciBjb250ZW50ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoZGlzcGxheVRleHQpO1xuICAgICAgYnVpbGRlci5tYXAucHVzaChidWlsZGVyLnBvcywgYnVpbGRlci5wb3MgKyB0ZXh0Lmxlbmd0aCwgY29udGVudCk7XG4gICAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDkpIG11c3RXcmFwID0gdHJ1ZTtcbiAgICAgIGJ1aWxkZXIucG9zICs9IHRleHQubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSwgcG9zID0gMDtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHNwZWNpYWwubGFzdEluZGV4ID0gcG9zO1xuICAgICAgICB2YXIgbSA9IHNwZWNpYWwuZXhlYyh0ZXh0KTtcbiAgICAgICAgdmFyIHNraXBwZWQgPSBtID8gbS5pbmRleCAtIHBvcyA6IHRleHQubGVuZ3RoIC0gcG9zO1xuICAgICAgICBpZiAoc2tpcHBlZCkge1xuICAgICAgICAgIHZhciB0eHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShkaXNwbGF5VGV4dC5zbGljZShwb3MsIHBvcyArIHNraXBwZWQpKTtcbiAgICAgICAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDkpIGNvbnRlbnQuYXBwZW5kQ2hpbGQoZWx0KFwic3BhblwiLCBbdHh0XSkpO1xuICAgICAgICAgIGVsc2UgY29udGVudC5hcHBlbmRDaGlsZCh0eHQpO1xuICAgICAgICAgIGJ1aWxkZXIubWFwLnB1c2goYnVpbGRlci5wb3MsIGJ1aWxkZXIucG9zICsgc2tpcHBlZCwgdHh0KTtcbiAgICAgICAgICBidWlsZGVyLmNvbCArPSBza2lwcGVkO1xuICAgICAgICAgIGJ1aWxkZXIucG9zICs9IHNraXBwZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFtKSBicmVhaztcbiAgICAgICAgcG9zICs9IHNraXBwZWQgKyAxO1xuICAgICAgICBpZiAobVswXSA9PSBcIlxcdFwiKSB7XG4gICAgICAgICAgdmFyIHRhYlNpemUgPSBidWlsZGVyLmNtLm9wdGlvbnMudGFiU2l6ZSwgdGFiV2lkdGggPSB0YWJTaXplIC0gYnVpbGRlci5jb2wgJSB0YWJTaXplO1xuICAgICAgICAgIHZhciB0eHQgPSBjb250ZW50LmFwcGVuZENoaWxkKGVsdChcInNwYW5cIiwgc3BhY2VTdHIodGFiV2lkdGgpLCBcImNtLXRhYlwiKSk7XG4gICAgICAgICAgdHh0LnNldEF0dHJpYnV0ZShcInJvbGVcIiwgXCJwcmVzZW50YXRpb25cIik7XG4gICAgICAgICAgdHh0LnNldEF0dHJpYnV0ZShcImNtLXRleHRcIiwgXCJcXHRcIik7XG4gICAgICAgICAgYnVpbGRlci5jb2wgKz0gdGFiV2lkdGg7XG4gICAgICAgIH0gZWxzZSBpZiAobVswXSA9PSBcIlxcclwiIHx8IG1bMF0gPT0gXCJcXG5cIikge1xuICAgICAgICAgIHZhciB0eHQgPSBjb250ZW50LmFwcGVuZENoaWxkKGVsdChcInNwYW5cIiwgbVswXSA9PSBcIlxcclwiID8gXCJcXHUyNDBkXCIgOiBcIlxcdTI0MjRcIiwgXCJjbS1pbnZhbGlkY2hhclwiKSk7XG4gICAgICAgICAgdHh0LnNldEF0dHJpYnV0ZShcImNtLXRleHRcIiwgbVswXSk7XG4gICAgICAgICAgYnVpbGRlci5jb2wgKz0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgdHh0ID0gYnVpbGRlci5jbS5vcHRpb25zLnNwZWNpYWxDaGFyUGxhY2Vob2xkZXIobVswXSk7XG4gICAgICAgICAgdHh0LnNldEF0dHJpYnV0ZShcImNtLXRleHRcIiwgbVswXSk7XG4gICAgICAgICAgaWYgKGllICYmIGllX3ZlcnNpb24gPCA5KSBjb250ZW50LmFwcGVuZENoaWxkKGVsdChcInNwYW5cIiwgW3R4dF0pKTtcbiAgICAgICAgICBlbHNlIGNvbnRlbnQuYXBwZW5kQ2hpbGQodHh0KTtcbiAgICAgICAgICBidWlsZGVyLmNvbCArPSAxO1xuICAgICAgICB9XG4gICAgICAgIGJ1aWxkZXIubWFwLnB1c2goYnVpbGRlci5wb3MsIGJ1aWxkZXIucG9zICsgMSwgdHh0KTtcbiAgICAgICAgYnVpbGRlci5wb3MrKztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHN0eWxlIHx8IHN0YXJ0U3R5bGUgfHwgZW5kU3R5bGUgfHwgbXVzdFdyYXAgfHwgY3NzKSB7XG4gICAgICB2YXIgZnVsbFN0eWxlID0gc3R5bGUgfHwgXCJcIjtcbiAgICAgIGlmIChzdGFydFN0eWxlKSBmdWxsU3R5bGUgKz0gc3RhcnRTdHlsZTtcbiAgICAgIGlmIChlbmRTdHlsZSkgZnVsbFN0eWxlICs9IGVuZFN0eWxlO1xuICAgICAgdmFyIHRva2VuID0gZWx0KFwic3BhblwiLCBbY29udGVudF0sIGZ1bGxTdHlsZSwgY3NzKTtcbiAgICAgIGlmICh0aXRsZSkgdG9rZW4udGl0bGUgPSB0aXRsZTtcbiAgICAgIHJldHVybiBidWlsZGVyLmNvbnRlbnQuYXBwZW5kQ2hpbGQodG9rZW4pO1xuICAgIH1cbiAgICBidWlsZGVyLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY29udGVudCk7XG4gIH1cblxuICBmdW5jdGlvbiBzcGxpdFNwYWNlcyhvbGQpIHtcbiAgICB2YXIgb3V0ID0gXCIgXCI7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvbGQubGVuZ3RoIC0gMjsgKytpKSBvdXQgKz0gaSAlIDIgPyBcIiBcIiA6IFwiXFx1MDBhMFwiO1xuICAgIG91dCArPSBcIiBcIjtcbiAgICByZXR1cm4gb3V0O1xuICB9XG5cbiAgLy8gV29yayBhcm91bmQgbm9uc2Vuc2UgZGltZW5zaW9ucyBiZWluZyByZXBvcnRlZCBmb3Igc3RyZXRjaGVzIG9mXG4gIC8vIHJpZ2h0LXRvLWxlZnQgdGV4dC5cbiAgZnVuY3Rpb24gYnVpbGRUb2tlbkJhZEJpZGkoaW5uZXIsIG9yZGVyKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGJ1aWxkZXIsIHRleHQsIHN0eWxlLCBzdGFydFN0eWxlLCBlbmRTdHlsZSwgdGl0bGUsIGNzcykge1xuICAgICAgc3R5bGUgPSBzdHlsZSA/IHN0eWxlICsgXCIgY20tZm9yY2UtYm9yZGVyXCIgOiBcImNtLWZvcmNlLWJvcmRlclwiO1xuICAgICAgdmFyIHN0YXJ0ID0gYnVpbGRlci5wb3MsIGVuZCA9IHN0YXJ0ICsgdGV4dC5sZW5ndGg7XG4gICAgICBmb3IgKDs7KSB7XG4gICAgICAgIC8vIEZpbmQgdGhlIHBhcnQgdGhhdCBvdmVybGFwcyB3aXRoIHRoZSBzdGFydCBvZiB0aGlzIHRleHRcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcmRlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBwYXJ0ID0gb3JkZXJbaV07XG4gICAgICAgICAgaWYgKHBhcnQudG8gPiBzdGFydCAmJiBwYXJ0LmZyb20gPD0gc3RhcnQpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYXJ0LnRvID49IGVuZCkgcmV0dXJuIGlubmVyKGJ1aWxkZXIsIHRleHQsIHN0eWxlLCBzdGFydFN0eWxlLCBlbmRTdHlsZSwgdGl0bGUsIGNzcyk7XG4gICAgICAgIGlubmVyKGJ1aWxkZXIsIHRleHQuc2xpY2UoMCwgcGFydC50byAtIHN0YXJ0KSwgc3R5bGUsIHN0YXJ0U3R5bGUsIG51bGwsIHRpdGxlLCBjc3MpO1xuICAgICAgICBzdGFydFN0eWxlID0gbnVsbDtcbiAgICAgICAgdGV4dCA9IHRleHQuc2xpY2UocGFydC50byAtIHN0YXJ0KTtcbiAgICAgICAgc3RhcnQgPSBwYXJ0LnRvO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBidWlsZENvbGxhcHNlZFNwYW4oYnVpbGRlciwgc2l6ZSwgbWFya2VyLCBpZ25vcmVXaWRnZXQpIHtcbiAgICB2YXIgd2lkZ2V0ID0gIWlnbm9yZVdpZGdldCAmJiBtYXJrZXIud2lkZ2V0Tm9kZTtcbiAgICBpZiAod2lkZ2V0KSBidWlsZGVyLm1hcC5wdXNoKGJ1aWxkZXIucG9zLCBidWlsZGVyLnBvcyArIHNpemUsIHdpZGdldCk7XG4gICAgaWYgKCFpZ25vcmVXaWRnZXQgJiYgYnVpbGRlci5jbS5kaXNwbGF5LmlucHV0Lm5lZWRzQ29udGVudEF0dHJpYnV0ZSkge1xuICAgICAgaWYgKCF3aWRnZXQpXG4gICAgICAgIHdpZGdldCA9IGJ1aWxkZXIuY29udGVudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKSk7XG4gICAgICB3aWRnZXQuc2V0QXR0cmlidXRlKFwiY20tbWFya2VyXCIsIG1hcmtlci5pZCk7XG4gICAgfVxuICAgIGlmICh3aWRnZXQpIHtcbiAgICAgIGJ1aWxkZXIuY20uZGlzcGxheS5pbnB1dC5zZXRVbmVkaXRhYmxlKHdpZGdldCk7XG4gICAgICBidWlsZGVyLmNvbnRlbnQuYXBwZW5kQ2hpbGQod2lkZ2V0KTtcbiAgICB9XG4gICAgYnVpbGRlci5wb3MgKz0gc2l6ZTtcbiAgfVxuXG4gIC8vIE91dHB1dHMgYSBudW1iZXIgb2Ygc3BhbnMgdG8gbWFrZSB1cCBhIGxpbmUsIHRha2luZyBoaWdobGlnaHRpbmdcbiAgLy8gYW5kIG1hcmtlZCB0ZXh0IGludG8gYWNjb3VudC5cbiAgZnVuY3Rpb24gaW5zZXJ0TGluZUNvbnRlbnQobGluZSwgYnVpbGRlciwgc3R5bGVzKSB7XG4gICAgdmFyIHNwYW5zID0gbGluZS5tYXJrZWRTcGFucywgYWxsVGV4dCA9IGxpbmUudGV4dCwgYXQgPSAwO1xuICAgIGlmICghc3BhbnMpIHtcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgc3R5bGVzLmxlbmd0aDsgaSs9MilcbiAgICAgICAgYnVpbGRlci5hZGRUb2tlbihidWlsZGVyLCBhbGxUZXh0LnNsaWNlKGF0LCBhdCA9IHN0eWxlc1tpXSksIGludGVycHJldFRva2VuU3R5bGUoc3R5bGVzW2krMV0sIGJ1aWxkZXIuY20ub3B0aW9ucykpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBsZW4gPSBhbGxUZXh0Lmxlbmd0aCwgcG9zID0gMCwgaSA9IDEsIHRleHQgPSBcIlwiLCBzdHlsZSwgY3NzO1xuICAgIHZhciBuZXh0Q2hhbmdlID0gMCwgc3BhblN0eWxlLCBzcGFuRW5kU3R5bGUsIHNwYW5TdGFydFN0eWxlLCB0aXRsZSwgY29sbGFwc2VkO1xuICAgIGZvciAoOzspIHtcbiAgICAgIGlmIChuZXh0Q2hhbmdlID09IHBvcykgeyAvLyBVcGRhdGUgY3VycmVudCBtYXJrZXIgc2V0XG4gICAgICAgIHNwYW5TdHlsZSA9IHNwYW5FbmRTdHlsZSA9IHNwYW5TdGFydFN0eWxlID0gdGl0bGUgPSBjc3MgPSBcIlwiO1xuICAgICAgICBjb2xsYXBzZWQgPSBudWxsOyBuZXh0Q2hhbmdlID0gSW5maW5pdHk7XG4gICAgICAgIHZhciBmb3VuZEJvb2ttYXJrcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHNwYW5zLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgdmFyIHNwID0gc3BhbnNbal0sIG0gPSBzcC5tYXJrZXI7XG4gICAgICAgICAgaWYgKG0udHlwZSA9PSBcImJvb2ttYXJrXCIgJiYgc3AuZnJvbSA9PSBwb3MgJiYgbS53aWRnZXROb2RlKSB7XG4gICAgICAgICAgICBmb3VuZEJvb2ttYXJrcy5wdXNoKG0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAoc3AuZnJvbSA8PSBwb3MgJiYgKHNwLnRvID09IG51bGwgfHwgc3AudG8gPiBwb3MgfHwgbS5jb2xsYXBzZWQgJiYgc3AudG8gPT0gcG9zICYmIHNwLmZyb20gPT0gcG9zKSkge1xuICAgICAgICAgICAgaWYgKHNwLnRvICE9IG51bGwgJiYgc3AudG8gIT0gcG9zICYmIG5leHRDaGFuZ2UgPiBzcC50bykge1xuICAgICAgICAgICAgICBuZXh0Q2hhbmdlID0gc3AudG87XG4gICAgICAgICAgICAgIHNwYW5FbmRTdHlsZSA9IFwiXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobS5jbGFzc05hbWUpIHNwYW5TdHlsZSArPSBcIiBcIiArIG0uY2xhc3NOYW1lO1xuICAgICAgICAgICAgaWYgKG0uY3NzKSBjc3MgPSAoY3NzID8gY3NzICsgXCI7XCIgOiBcIlwiKSArIG0uY3NzO1xuICAgICAgICAgICAgaWYgKG0uc3RhcnRTdHlsZSAmJiBzcC5mcm9tID09IHBvcykgc3BhblN0YXJ0U3R5bGUgKz0gXCIgXCIgKyBtLnN0YXJ0U3R5bGU7XG4gICAgICAgICAgICBpZiAobS5lbmRTdHlsZSAmJiBzcC50byA9PSBuZXh0Q2hhbmdlKSBzcGFuRW5kU3R5bGUgKz0gXCIgXCIgKyBtLmVuZFN0eWxlO1xuICAgICAgICAgICAgaWYgKG0udGl0bGUgJiYgIXRpdGxlKSB0aXRsZSA9IG0udGl0bGU7XG4gICAgICAgICAgICBpZiAobS5jb2xsYXBzZWQgJiYgKCFjb2xsYXBzZWQgfHwgY29tcGFyZUNvbGxhcHNlZE1hcmtlcnMoY29sbGFwc2VkLm1hcmtlciwgbSkgPCAwKSlcbiAgICAgICAgICAgICAgY29sbGFwc2VkID0gc3A7XG4gICAgICAgICAgfSBlbHNlIGlmIChzcC5mcm9tID4gcG9zICYmIG5leHRDaGFuZ2UgPiBzcC5mcm9tKSB7XG4gICAgICAgICAgICBuZXh0Q2hhbmdlID0gc3AuZnJvbTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbGxhcHNlZCAmJiAoY29sbGFwc2VkLmZyb20gfHwgMCkgPT0gcG9zKSB7XG4gICAgICAgICAgYnVpbGRDb2xsYXBzZWRTcGFuKGJ1aWxkZXIsIChjb2xsYXBzZWQudG8gPT0gbnVsbCA/IGxlbiArIDEgOiBjb2xsYXBzZWQudG8pIC0gcG9zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsYXBzZWQubWFya2VyLCBjb2xsYXBzZWQuZnJvbSA9PSBudWxsKTtcbiAgICAgICAgICBpZiAoY29sbGFwc2VkLnRvID09IG51bGwpIHJldHVybjtcbiAgICAgICAgICBpZiAoY29sbGFwc2VkLnRvID09IHBvcykgY29sbGFwc2VkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFjb2xsYXBzZWQgJiYgZm91bmRCb29rbWFya3MubGVuZ3RoKSBmb3IgKHZhciBqID0gMDsgaiA8IGZvdW5kQm9va21hcmtzLmxlbmd0aDsgKytqKVxuICAgICAgICAgIGJ1aWxkQ29sbGFwc2VkU3BhbihidWlsZGVyLCAwLCBmb3VuZEJvb2ttYXJrc1tqXSk7XG4gICAgICB9XG4gICAgICBpZiAocG9zID49IGxlbikgYnJlYWs7XG5cbiAgICAgIHZhciB1cHRvID0gTWF0aC5taW4obGVuLCBuZXh0Q2hhbmdlKTtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGlmICh0ZXh0KSB7XG4gICAgICAgICAgdmFyIGVuZCA9IHBvcyArIHRleHQubGVuZ3RoO1xuICAgICAgICAgIGlmICghY29sbGFwc2VkKSB7XG4gICAgICAgICAgICB2YXIgdG9rZW5UZXh0ID0gZW5kID4gdXB0byA/IHRleHQuc2xpY2UoMCwgdXB0byAtIHBvcykgOiB0ZXh0O1xuICAgICAgICAgICAgYnVpbGRlci5hZGRUb2tlbihidWlsZGVyLCB0b2tlblRleHQsIHN0eWxlID8gc3R5bGUgKyBzcGFuU3R5bGUgOiBzcGFuU3R5bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwYW5TdGFydFN0eWxlLCBwb3MgKyB0b2tlblRleHQubGVuZ3RoID09IG5leHRDaGFuZ2UgPyBzcGFuRW5kU3R5bGUgOiBcIlwiLCB0aXRsZSwgY3NzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGVuZCA+PSB1cHRvKSB7dGV4dCA9IHRleHQuc2xpY2UodXB0byAtIHBvcyk7IHBvcyA9IHVwdG87IGJyZWFrO31cbiAgICAgICAgICBwb3MgPSBlbmQ7XG4gICAgICAgICAgc3BhblN0YXJ0U3R5bGUgPSBcIlwiO1xuICAgICAgICB9XG4gICAgICAgIHRleHQgPSBhbGxUZXh0LnNsaWNlKGF0LCBhdCA9IHN0eWxlc1tpKytdKTtcbiAgICAgICAgc3R5bGUgPSBpbnRlcnByZXRUb2tlblN0eWxlKHN0eWxlc1tpKytdLCBidWlsZGVyLmNtLm9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIERPQ1VNRU5UIERBVEEgU1RSVUNUVVJFXG5cbiAgLy8gQnkgZGVmYXVsdCwgdXBkYXRlcyB0aGF0IHN0YXJ0IGFuZCBlbmQgYXQgdGhlIGJlZ2lubmluZyBvZiBhIGxpbmVcbiAgLy8gYXJlIHRyZWF0ZWQgc3BlY2lhbGx5LCBpbiBvcmRlciB0byBtYWtlIHRoZSBhc3NvY2lhdGlvbiBvZiBsaW5lXG4gIC8vIHdpZGdldHMgYW5kIG1hcmtlciBlbGVtZW50cyB3aXRoIHRoZSB0ZXh0IGJlaGF2ZSBtb3JlIGludHVpdGl2ZS5cbiAgZnVuY3Rpb24gaXNXaG9sZUxpbmVVcGRhdGUoZG9jLCBjaGFuZ2UpIHtcbiAgICByZXR1cm4gY2hhbmdlLmZyb20uY2ggPT0gMCAmJiBjaGFuZ2UudG8uY2ggPT0gMCAmJiBsc3QoY2hhbmdlLnRleHQpID09IFwiXCIgJiZcbiAgICAgICghZG9jLmNtIHx8IGRvYy5jbS5vcHRpb25zLndob2xlTGluZVVwZGF0ZUJlZm9yZSk7XG4gIH1cblxuICAvLyBQZXJmb3JtIGEgY2hhbmdlIG9uIHRoZSBkb2N1bWVudCBkYXRhIHN0cnVjdHVyZS5cbiAgZnVuY3Rpb24gdXBkYXRlRG9jKGRvYywgY2hhbmdlLCBtYXJrZWRTcGFucywgZXN0aW1hdGVIZWlnaHQpIHtcbiAgICBmdW5jdGlvbiBzcGFuc0ZvcihuKSB7cmV0dXJuIG1hcmtlZFNwYW5zID8gbWFya2VkU3BhbnNbbl0gOiBudWxsO31cbiAgICBmdW5jdGlvbiB1cGRhdGUobGluZSwgdGV4dCwgc3BhbnMpIHtcbiAgICAgIHVwZGF0ZUxpbmUobGluZSwgdGV4dCwgc3BhbnMsIGVzdGltYXRlSGVpZ2h0KTtcbiAgICAgIHNpZ25hbExhdGVyKGxpbmUsIFwiY2hhbmdlXCIsIGxpbmUsIGNoYW5nZSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGxpbmVzRm9yKHN0YXJ0LCBlbmQpIHtcbiAgICAgIGZvciAodmFyIGkgPSBzdGFydCwgcmVzdWx0ID0gW107IGkgPCBlbmQ7ICsraSlcbiAgICAgICAgcmVzdWx0LnB1c2gobmV3IExpbmUodGV4dFtpXSwgc3BhbnNGb3IoaSksIGVzdGltYXRlSGVpZ2h0KSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHZhciBmcm9tID0gY2hhbmdlLmZyb20sIHRvID0gY2hhbmdlLnRvLCB0ZXh0ID0gY2hhbmdlLnRleHQ7XG4gICAgdmFyIGZpcnN0TGluZSA9IGdldExpbmUoZG9jLCBmcm9tLmxpbmUpLCBsYXN0TGluZSA9IGdldExpbmUoZG9jLCB0by5saW5lKTtcbiAgICB2YXIgbGFzdFRleHQgPSBsc3QodGV4dCksIGxhc3RTcGFucyA9IHNwYW5zRm9yKHRleHQubGVuZ3RoIC0gMSksIG5saW5lcyA9IHRvLmxpbmUgLSBmcm9tLmxpbmU7XG5cbiAgICAvLyBBZGp1c3QgdGhlIGxpbmUgc3RydWN0dXJlXG4gICAgaWYgKGNoYW5nZS5mdWxsKSB7XG4gICAgICBkb2MuaW5zZXJ0KDAsIGxpbmVzRm9yKDAsIHRleHQubGVuZ3RoKSk7XG4gICAgICBkb2MucmVtb3ZlKHRleHQubGVuZ3RoLCBkb2Muc2l6ZSAtIHRleHQubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKGlzV2hvbGVMaW5lVXBkYXRlKGRvYywgY2hhbmdlKSkge1xuICAgICAgLy8gVGhpcyBpcyBhIHdob2xlLWxpbmUgcmVwbGFjZS4gVHJlYXRlZCBzcGVjaWFsbHkgdG8gbWFrZVxuICAgICAgLy8gc3VyZSBsaW5lIG9iamVjdHMgbW92ZSB0aGUgd2F5IHRoZXkgYXJlIHN1cHBvc2VkIHRvLlxuICAgICAgdmFyIGFkZGVkID0gbGluZXNGb3IoMCwgdGV4dC5sZW5ndGggLSAxKTtcbiAgICAgIHVwZGF0ZShsYXN0TGluZSwgbGFzdExpbmUudGV4dCwgbGFzdFNwYW5zKTtcbiAgICAgIGlmIChubGluZXMpIGRvYy5yZW1vdmUoZnJvbS5saW5lLCBubGluZXMpO1xuICAgICAgaWYgKGFkZGVkLmxlbmd0aCkgZG9jLmluc2VydChmcm9tLmxpbmUsIGFkZGVkKTtcbiAgICB9IGVsc2UgaWYgKGZpcnN0TGluZSA9PSBsYXN0TGluZSkge1xuICAgICAgaWYgKHRleHQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgdXBkYXRlKGZpcnN0TGluZSwgZmlyc3RMaW5lLnRleHQuc2xpY2UoMCwgZnJvbS5jaCkgKyBsYXN0VGV4dCArIGZpcnN0TGluZS50ZXh0LnNsaWNlKHRvLmNoKSwgbGFzdFNwYW5zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhZGRlZCA9IGxpbmVzRm9yKDEsIHRleHQubGVuZ3RoIC0gMSk7XG4gICAgICAgIGFkZGVkLnB1c2gobmV3IExpbmUobGFzdFRleHQgKyBmaXJzdExpbmUudGV4dC5zbGljZSh0by5jaCksIGxhc3RTcGFucywgZXN0aW1hdGVIZWlnaHQpKTtcbiAgICAgICAgdXBkYXRlKGZpcnN0TGluZSwgZmlyc3RMaW5lLnRleHQuc2xpY2UoMCwgZnJvbS5jaCkgKyB0ZXh0WzBdLCBzcGFuc0ZvcigwKSk7XG4gICAgICAgIGRvYy5pbnNlcnQoZnJvbS5saW5lICsgMSwgYWRkZWQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGV4dC5sZW5ndGggPT0gMSkge1xuICAgICAgdXBkYXRlKGZpcnN0TGluZSwgZmlyc3RMaW5lLnRleHQuc2xpY2UoMCwgZnJvbS5jaCkgKyB0ZXh0WzBdICsgbGFzdExpbmUudGV4dC5zbGljZSh0by5jaCksIHNwYW5zRm9yKDApKTtcbiAgICAgIGRvYy5yZW1vdmUoZnJvbS5saW5lICsgMSwgbmxpbmVzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXBkYXRlKGZpcnN0TGluZSwgZmlyc3RMaW5lLnRleHQuc2xpY2UoMCwgZnJvbS5jaCkgKyB0ZXh0WzBdLCBzcGFuc0ZvcigwKSk7XG4gICAgICB1cGRhdGUobGFzdExpbmUsIGxhc3RUZXh0ICsgbGFzdExpbmUudGV4dC5zbGljZSh0by5jaCksIGxhc3RTcGFucyk7XG4gICAgICB2YXIgYWRkZWQgPSBsaW5lc0ZvcigxLCB0ZXh0Lmxlbmd0aCAtIDEpO1xuICAgICAgaWYgKG5saW5lcyA+IDEpIGRvYy5yZW1vdmUoZnJvbS5saW5lICsgMSwgbmxpbmVzIC0gMSk7XG4gICAgICBkb2MuaW5zZXJ0KGZyb20ubGluZSArIDEsIGFkZGVkKTtcbiAgICB9XG5cbiAgICBzaWduYWxMYXRlcihkb2MsIFwiY2hhbmdlXCIsIGRvYywgY2hhbmdlKTtcbiAgfVxuXG4gIC8vIFRoZSBkb2N1bWVudCBpcyByZXByZXNlbnRlZCBhcyBhIEJUcmVlIGNvbnNpc3Rpbmcgb2YgbGVhdmVzLCB3aXRoXG4gIC8vIGNodW5rIG9mIGxpbmVzIGluIHRoZW0sIGFuZCBicmFuY2hlcywgd2l0aCB1cCB0byB0ZW4gbGVhdmVzIG9yXG4gIC8vIG90aGVyIGJyYW5jaCBub2RlcyBiZWxvdyB0aGVtLiBUaGUgdG9wIG5vZGUgaXMgYWx3YXlzIGEgYnJhbmNoXG4gIC8vIG5vZGUsIGFuZCBpcyB0aGUgZG9jdW1lbnQgb2JqZWN0IGl0c2VsZiAobWVhbmluZyBpdCBoYXNcbiAgLy8gYWRkaXRpb25hbCBtZXRob2RzIGFuZCBwcm9wZXJ0aWVzKS5cbiAgLy9cbiAgLy8gQWxsIG5vZGVzIGhhdmUgcGFyZW50IGxpbmtzLiBUaGUgdHJlZSBpcyB1c2VkIGJvdGggdG8gZ28gZnJvbVxuICAvLyBsaW5lIG51bWJlcnMgdG8gbGluZSBvYmplY3RzLCBhbmQgdG8gZ28gZnJvbSBvYmplY3RzIHRvIG51bWJlcnMuXG4gIC8vIEl0IGFsc28gaW5kZXhlcyBieSBoZWlnaHQsIGFuZCBpcyB1c2VkIHRvIGNvbnZlcnQgYmV0d2VlbiBoZWlnaHRcbiAgLy8gYW5kIGxpbmUgb2JqZWN0LCBhbmQgdG8gZmluZCB0aGUgdG90YWwgaGVpZ2h0IG9mIHRoZSBkb2N1bWVudC5cbiAgLy9cbiAgLy8gU2VlIGFsc28gaHR0cDovL21hcmlqbmhhdmVyYmVrZS5ubC9ibG9nL2NvZGVtaXJyb3ItbGluZS10cmVlLmh0bWxcblxuICBmdW5jdGlvbiBMZWFmQ2h1bmsobGluZXMpIHtcbiAgICB0aGlzLmxpbmVzID0gbGluZXM7XG4gICAgdGhpcy5wYXJlbnQgPSBudWxsO1xuICAgIGZvciAodmFyIGkgPSAwLCBoZWlnaHQgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGxpbmVzW2ldLnBhcmVudCA9IHRoaXM7XG4gICAgICBoZWlnaHQgKz0gbGluZXNbaV0uaGVpZ2h0O1xuICAgIH1cbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcbiAgfVxuXG4gIExlYWZDaHVuay5wcm90b3R5cGUgPSB7XG4gICAgY2h1bmtTaXplOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMubGluZXMubGVuZ3RoOyB9LFxuICAgIC8vIFJlbW92ZSB0aGUgbiBsaW5lcyBhdCBvZmZzZXQgJ2F0Jy5cbiAgICByZW1vdmVJbm5lcjogZnVuY3Rpb24oYXQsIG4pIHtcbiAgICAgIGZvciAodmFyIGkgPSBhdCwgZSA9IGF0ICsgbjsgaSA8IGU7ICsraSkge1xuICAgICAgICB2YXIgbGluZSA9IHRoaXMubGluZXNbaV07XG4gICAgICAgIHRoaXMuaGVpZ2h0IC09IGxpbmUuaGVpZ2h0O1xuICAgICAgICBjbGVhblVwTGluZShsaW5lKTtcbiAgICAgICAgc2lnbmFsTGF0ZXIobGluZSwgXCJkZWxldGVcIik7XG4gICAgICB9XG4gICAgICB0aGlzLmxpbmVzLnNwbGljZShhdCwgbik7XG4gICAgfSxcbiAgICAvLyBIZWxwZXIgdXNlZCB0byBjb2xsYXBzZSBhIHNtYWxsIGJyYW5jaCBpbnRvIGEgc2luZ2xlIGxlYWYuXG4gICAgY29sbGFwc2U6IGZ1bmN0aW9uKGxpbmVzKSB7XG4gICAgICBsaW5lcy5wdXNoLmFwcGx5KGxpbmVzLCB0aGlzLmxpbmVzKTtcbiAgICB9LFxuICAgIC8vIEluc2VydCB0aGUgZ2l2ZW4gYXJyYXkgb2YgbGluZXMgYXQgb2Zmc2V0ICdhdCcsIGNvdW50IHRoZW0gYXNcbiAgICAvLyBoYXZpbmcgdGhlIGdpdmVuIGhlaWdodC5cbiAgICBpbnNlcnRJbm5lcjogZnVuY3Rpb24oYXQsIGxpbmVzLCBoZWlnaHQpIHtcbiAgICAgIHRoaXMuaGVpZ2h0ICs9IGhlaWdodDtcbiAgICAgIHRoaXMubGluZXMgPSB0aGlzLmxpbmVzLnNsaWNlKDAsIGF0KS5jb25jYXQobGluZXMpLmNvbmNhdCh0aGlzLmxpbmVzLnNsaWNlKGF0KSk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgKytpKSBsaW5lc1tpXS5wYXJlbnQgPSB0aGlzO1xuICAgIH0sXG4gICAgLy8gVXNlZCB0byBpdGVyYXRlIG92ZXIgYSBwYXJ0IG9mIHRoZSB0cmVlLlxuICAgIGl0ZXJOOiBmdW5jdGlvbihhdCwgbiwgb3ApIHtcbiAgICAgIGZvciAodmFyIGUgPSBhdCArIG47IGF0IDwgZTsgKythdClcbiAgICAgICAgaWYgKG9wKHRoaXMubGluZXNbYXRdKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9O1xuXG4gIGZ1bmN0aW9uIEJyYW5jaENodW5rKGNoaWxkcmVuKSB7XG4gICAgdGhpcy5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICAgIHZhciBzaXplID0gMCwgaGVpZ2h0ID0gMDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgY2ggPSBjaGlsZHJlbltpXTtcbiAgICAgIHNpemUgKz0gY2guY2h1bmtTaXplKCk7IGhlaWdodCArPSBjaC5oZWlnaHQ7XG4gICAgICBjaC5wYXJlbnQgPSB0aGlzO1xuICAgIH1cbiAgICB0aGlzLnNpemUgPSBzaXplO1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgIHRoaXMucGFyZW50ID0gbnVsbDtcbiAgfVxuXG4gIEJyYW5jaENodW5rLnByb3RvdHlwZSA9IHtcbiAgICBjaHVua1NpemU6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5zaXplOyB9LFxuICAgIHJlbW92ZUlubmVyOiBmdW5jdGlvbihhdCwgbikge1xuICAgICAgdGhpcy5zaXplIC09IG47XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXSwgc3ogPSBjaGlsZC5jaHVua1NpemUoKTtcbiAgICAgICAgaWYgKGF0IDwgc3opIHtcbiAgICAgICAgICB2YXIgcm0gPSBNYXRoLm1pbihuLCBzeiAtIGF0KSwgb2xkSGVpZ2h0ID0gY2hpbGQuaGVpZ2h0O1xuICAgICAgICAgIGNoaWxkLnJlbW92ZUlubmVyKGF0LCBybSk7XG4gICAgICAgICAgdGhpcy5oZWlnaHQgLT0gb2xkSGVpZ2h0IC0gY2hpbGQuaGVpZ2h0O1xuICAgICAgICAgIGlmIChzeiA9PSBybSkgeyB0aGlzLmNoaWxkcmVuLnNwbGljZShpLS0sIDEpOyBjaGlsZC5wYXJlbnQgPSBudWxsOyB9XG4gICAgICAgICAgaWYgKChuIC09IHJtKSA9PSAwKSBicmVhaztcbiAgICAgICAgICBhdCA9IDA7XG4gICAgICAgIH0gZWxzZSBhdCAtPSBzejtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZSByZXN1bHQgaXMgc21hbGxlciB0aGFuIDI1IGxpbmVzLCBlbnN1cmUgdGhhdCBpdCBpcyBhXG4gICAgICAvLyBzaW5nbGUgbGVhZiBub2RlLlxuICAgICAgaWYgKHRoaXMuc2l6ZSAtIG4gPCAyNSAmJlxuICAgICAgICAgICh0aGlzLmNoaWxkcmVuLmxlbmd0aCA+IDEgfHwgISh0aGlzLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgTGVhZkNodW5rKSkpIHtcbiAgICAgICAgdmFyIGxpbmVzID0gW107XG4gICAgICAgIHRoaXMuY29sbGFwc2UobGluZXMpO1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW25ldyBMZWFmQ2h1bmsobGluZXMpXTtcbiAgICAgICAgdGhpcy5jaGlsZHJlblswXS5wYXJlbnQgPSB0aGlzO1xuICAgICAgfVxuICAgIH0sXG4gICAgY29sbGFwc2U6IGZ1bmN0aW9uKGxpbmVzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHRoaXMuY2hpbGRyZW5baV0uY29sbGFwc2UobGluZXMpO1xuICAgIH0sXG4gICAgaW5zZXJ0SW5uZXI6IGZ1bmN0aW9uKGF0LCBsaW5lcywgaGVpZ2h0KSB7XG4gICAgICB0aGlzLnNpemUgKz0gbGluZXMubGVuZ3RoO1xuICAgICAgdGhpcy5oZWlnaHQgKz0gaGVpZ2h0O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IHRoaXMuY2hpbGRyZW5baV0sIHN6ID0gY2hpbGQuY2h1bmtTaXplKCk7XG4gICAgICAgIGlmIChhdCA8PSBzeikge1xuICAgICAgICAgIGNoaWxkLmluc2VydElubmVyKGF0LCBsaW5lcywgaGVpZ2h0KTtcbiAgICAgICAgICBpZiAoY2hpbGQubGluZXMgJiYgY2hpbGQubGluZXMubGVuZ3RoID4gNTApIHtcbiAgICAgICAgICAgIHdoaWxlIChjaGlsZC5saW5lcy5sZW5ndGggPiA1MCkge1xuICAgICAgICAgICAgICB2YXIgc3BpbGxlZCA9IGNoaWxkLmxpbmVzLnNwbGljZShjaGlsZC5saW5lcy5sZW5ndGggLSAyNSwgMjUpO1xuICAgICAgICAgICAgICB2YXIgbmV3bGVhZiA9IG5ldyBMZWFmQ2h1bmsoc3BpbGxlZCk7XG4gICAgICAgICAgICAgIGNoaWxkLmhlaWdodCAtPSBuZXdsZWFmLmhlaWdodDtcbiAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaSArIDEsIDAsIG5ld2xlYWYpO1xuICAgICAgICAgICAgICBuZXdsZWFmLnBhcmVudCA9IHRoaXM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm1heWJlU3BpbGwoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgYXQgLT0gc3o7XG4gICAgICB9XG4gICAgfSxcbiAgICAvLyBXaGVuIGEgbm9kZSBoYXMgZ3Jvd24sIGNoZWNrIHdoZXRoZXIgaXQgc2hvdWxkIGJlIHNwbGl0LlxuICAgIG1heWJlU3BpbGw6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY2hpbGRyZW4ubGVuZ3RoIDw9IDEwKSByZXR1cm47XG4gICAgICB2YXIgbWUgPSB0aGlzO1xuICAgICAgZG8ge1xuICAgICAgICB2YXIgc3BpbGxlZCA9IG1lLmNoaWxkcmVuLnNwbGljZShtZS5jaGlsZHJlbi5sZW5ndGggLSA1LCA1KTtcbiAgICAgICAgdmFyIHNpYmxpbmcgPSBuZXcgQnJhbmNoQ2h1bmsoc3BpbGxlZCk7XG4gICAgICAgIGlmICghbWUucGFyZW50KSB7IC8vIEJlY29tZSB0aGUgcGFyZW50IG5vZGVcbiAgICAgICAgICB2YXIgY29weSA9IG5ldyBCcmFuY2hDaHVuayhtZS5jaGlsZHJlbik7XG4gICAgICAgICAgY29weS5wYXJlbnQgPSBtZTtcbiAgICAgICAgICBtZS5jaGlsZHJlbiA9IFtjb3B5LCBzaWJsaW5nXTtcbiAgICAgICAgICBtZSA9IGNvcHk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWUuc2l6ZSAtPSBzaWJsaW5nLnNpemU7XG4gICAgICAgICAgbWUuaGVpZ2h0IC09IHNpYmxpbmcuaGVpZ2h0O1xuICAgICAgICAgIHZhciBteUluZGV4ID0gaW5kZXhPZihtZS5wYXJlbnQuY2hpbGRyZW4sIG1lKTtcbiAgICAgICAgICBtZS5wYXJlbnQuY2hpbGRyZW4uc3BsaWNlKG15SW5kZXggKyAxLCAwLCBzaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBzaWJsaW5nLnBhcmVudCA9IG1lLnBhcmVudDtcbiAgICAgIH0gd2hpbGUgKG1lLmNoaWxkcmVuLmxlbmd0aCA+IDEwKTtcbiAgICAgIG1lLnBhcmVudC5tYXliZVNwaWxsKCk7XG4gICAgfSxcbiAgICBpdGVyTjogZnVuY3Rpb24oYXQsIG4sIG9wKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXSwgc3ogPSBjaGlsZC5jaHVua1NpemUoKTtcbiAgICAgICAgaWYgKGF0IDwgc3opIHtcbiAgICAgICAgICB2YXIgdXNlZCA9IE1hdGgubWluKG4sIHN6IC0gYXQpO1xuICAgICAgICAgIGlmIChjaGlsZC5pdGVyTihhdCwgdXNlZCwgb3ApKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICBpZiAoKG4gLT0gdXNlZCkgPT0gMCkgYnJlYWs7XG4gICAgICAgICAgYXQgPSAwO1xuICAgICAgICB9IGVsc2UgYXQgLT0gc3o7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHZhciBuZXh0RG9jSWQgPSAwO1xuICB2YXIgRG9jID0gQ29kZU1pcnJvci5Eb2MgPSBmdW5jdGlvbih0ZXh0LCBtb2RlLCBmaXJzdExpbmUsIGxpbmVTZXApIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRG9jKSkgcmV0dXJuIG5ldyBEb2ModGV4dCwgbW9kZSwgZmlyc3RMaW5lLCBsaW5lU2VwKTtcbiAgICBpZiAoZmlyc3RMaW5lID09IG51bGwpIGZpcnN0TGluZSA9IDA7XG5cbiAgICBCcmFuY2hDaHVuay5jYWxsKHRoaXMsIFtuZXcgTGVhZkNodW5rKFtuZXcgTGluZShcIlwiLCBudWxsKV0pXSk7XG4gICAgdGhpcy5maXJzdCA9IGZpcnN0TGluZTtcbiAgICB0aGlzLnNjcm9sbFRvcCA9IHRoaXMuc2Nyb2xsTGVmdCA9IDA7XG4gICAgdGhpcy5jYW50RWRpdCA9IGZhbHNlO1xuICAgIHRoaXMuY2xlYW5HZW5lcmF0aW9uID0gMTtcbiAgICB0aGlzLmZyb250aWVyID0gZmlyc3RMaW5lO1xuICAgIHZhciBzdGFydCA9IFBvcyhmaXJzdExpbmUsIDApO1xuICAgIHRoaXMuc2VsID0gc2ltcGxlU2VsZWN0aW9uKHN0YXJ0KTtcbiAgICB0aGlzLmhpc3RvcnkgPSBuZXcgSGlzdG9yeShudWxsKTtcbiAgICB0aGlzLmlkID0gKytuZXh0RG9jSWQ7XG4gICAgdGhpcy5tb2RlT3B0aW9uID0gbW9kZTtcbiAgICB0aGlzLmxpbmVTZXAgPSBsaW5lU2VwO1xuICAgIHRoaXMuZXh0ZW5kID0gZmFsc2U7XG5cbiAgICBpZiAodHlwZW9mIHRleHQgPT0gXCJzdHJpbmdcIikgdGV4dCA9IHRoaXMuc3BsaXRMaW5lcyh0ZXh0KTtcbiAgICB1cGRhdGVEb2ModGhpcywge2Zyb206IHN0YXJ0LCB0bzogc3RhcnQsIHRleHQ6IHRleHR9KTtcbiAgICBzZXRTZWxlY3Rpb24odGhpcywgc2ltcGxlU2VsZWN0aW9uKHN0YXJ0KSwgc2VsX2RvbnRTY3JvbGwpO1xuICB9O1xuXG4gIERvYy5wcm90b3R5cGUgPSBjcmVhdGVPYmooQnJhbmNoQ2h1bmsucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IERvYyxcbiAgICAvLyBJdGVyYXRlIG92ZXIgdGhlIGRvY3VtZW50LiBTdXBwb3J0cyB0d28gZm9ybXMgLS0gd2l0aCBvbmx5IG9uZVxuICAgIC8vIGFyZ3VtZW50LCBpdCBjYWxscyB0aGF0IGZvciBlYWNoIGxpbmUgaW4gdGhlIGRvY3VtZW50LiBXaXRoXG4gICAgLy8gdGhyZWUsIGl0IGl0ZXJhdGVzIG92ZXIgdGhlIHJhbmdlIGdpdmVuIGJ5IHRoZSBmaXJzdCB0d28gKHdpdGhcbiAgICAvLyB0aGUgc2Vjb25kIGJlaW5nIG5vbi1pbmNsdXNpdmUpLlxuICAgIGl0ZXI6IGZ1bmN0aW9uKGZyb20sIHRvLCBvcCkge1xuICAgICAgaWYgKG9wKSB0aGlzLml0ZXJOKGZyb20gLSB0aGlzLmZpcnN0LCB0byAtIGZyb20sIG9wKTtcbiAgICAgIGVsc2UgdGhpcy5pdGVyTih0aGlzLmZpcnN0LCB0aGlzLmZpcnN0ICsgdGhpcy5zaXplLCBmcm9tKTtcbiAgICB9LFxuXG4gICAgLy8gTm9uLXB1YmxpYyBpbnRlcmZhY2UgZm9yIGFkZGluZyBhbmQgcmVtb3ZpbmcgbGluZXMuXG4gICAgaW5zZXJ0OiBmdW5jdGlvbihhdCwgbGluZXMpIHtcbiAgICAgIHZhciBoZWlnaHQgPSAwO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7ICsraSkgaGVpZ2h0ICs9IGxpbmVzW2ldLmhlaWdodDtcbiAgICAgIHRoaXMuaW5zZXJ0SW5uZXIoYXQgLSB0aGlzLmZpcnN0LCBsaW5lcywgaGVpZ2h0KTtcbiAgICB9LFxuICAgIHJlbW92ZTogZnVuY3Rpb24oYXQsIG4pIHsgdGhpcy5yZW1vdmVJbm5lcihhdCAtIHRoaXMuZmlyc3QsIG4pOyB9LFxuXG4gICAgLy8gRnJvbSBoZXJlLCB0aGUgbWV0aG9kcyBhcmUgcGFydCBvZiB0aGUgcHVibGljIGludGVyZmFjZS4gTW9zdFxuICAgIC8vIGFyZSBhbHNvIGF2YWlsYWJsZSBmcm9tIENvZGVNaXJyb3IgKGVkaXRvcikgaW5zdGFuY2VzLlxuXG4gICAgZ2V0VmFsdWU6IGZ1bmN0aW9uKGxpbmVTZXApIHtcbiAgICAgIHZhciBsaW5lcyA9IGdldExpbmVzKHRoaXMsIHRoaXMuZmlyc3QsIHRoaXMuZmlyc3QgKyB0aGlzLnNpemUpO1xuICAgICAgaWYgKGxpbmVTZXAgPT09IGZhbHNlKSByZXR1cm4gbGluZXM7XG4gICAgICByZXR1cm4gbGluZXMuam9pbihsaW5lU2VwIHx8IHRoaXMubGluZVNlcGFyYXRvcigpKTtcbiAgICB9LFxuICAgIHNldFZhbHVlOiBkb2NNZXRob2RPcChmdW5jdGlvbihjb2RlKSB7XG4gICAgICB2YXIgdG9wID0gUG9zKHRoaXMuZmlyc3QsIDApLCBsYXN0ID0gdGhpcy5maXJzdCArIHRoaXMuc2l6ZSAtIDE7XG4gICAgICBtYWtlQ2hhbmdlKHRoaXMsIHtmcm9tOiB0b3AsIHRvOiBQb3MobGFzdCwgZ2V0TGluZSh0aGlzLCBsYXN0KS50ZXh0Lmxlbmd0aCksXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiB0aGlzLnNwbGl0TGluZXMoY29kZSksIG9yaWdpbjogXCJzZXRWYWx1ZVwiLCBmdWxsOiB0cnVlfSwgdHJ1ZSk7XG4gICAgICBzZXRTZWxlY3Rpb24odGhpcywgc2ltcGxlU2VsZWN0aW9uKHRvcCkpO1xuICAgIH0pLFxuICAgIHJlcGxhY2VSYW5nZTogZnVuY3Rpb24oY29kZSwgZnJvbSwgdG8sIG9yaWdpbikge1xuICAgICAgZnJvbSA9IGNsaXBQb3ModGhpcywgZnJvbSk7XG4gICAgICB0byA9IHRvID8gY2xpcFBvcyh0aGlzLCB0bykgOiBmcm9tO1xuICAgICAgcmVwbGFjZVJhbmdlKHRoaXMsIGNvZGUsIGZyb20sIHRvLCBvcmlnaW4pO1xuICAgIH0sXG4gICAgZ2V0UmFuZ2U6IGZ1bmN0aW9uKGZyb20sIHRvLCBsaW5lU2VwKSB7XG4gICAgICB2YXIgbGluZXMgPSBnZXRCZXR3ZWVuKHRoaXMsIGNsaXBQb3ModGhpcywgZnJvbSksIGNsaXBQb3ModGhpcywgdG8pKTtcbiAgICAgIGlmIChsaW5lU2VwID09PSBmYWxzZSkgcmV0dXJuIGxpbmVzO1xuICAgICAgcmV0dXJuIGxpbmVzLmpvaW4obGluZVNlcCB8fCB0aGlzLmxpbmVTZXBhcmF0b3IoKSk7XG4gICAgfSxcblxuICAgIGdldExpbmU6IGZ1bmN0aW9uKGxpbmUpIHt2YXIgbCA9IHRoaXMuZ2V0TGluZUhhbmRsZShsaW5lKTsgcmV0dXJuIGwgJiYgbC50ZXh0O30sXG5cbiAgICBnZXRMaW5lSGFuZGxlOiBmdW5jdGlvbihsaW5lKSB7aWYgKGlzTGluZSh0aGlzLCBsaW5lKSkgcmV0dXJuIGdldExpbmUodGhpcywgbGluZSk7fSxcbiAgICBnZXRMaW5lTnVtYmVyOiBmdW5jdGlvbihsaW5lKSB7cmV0dXJuIGxpbmVObyhsaW5lKTt9LFxuXG4gICAgZ2V0TGluZUhhbmRsZVZpc3VhbFN0YXJ0OiBmdW5jdGlvbihsaW5lKSB7XG4gICAgICBpZiAodHlwZW9mIGxpbmUgPT0gXCJudW1iZXJcIikgbGluZSA9IGdldExpbmUodGhpcywgbGluZSk7XG4gICAgICByZXR1cm4gdmlzdWFsTGluZShsaW5lKTtcbiAgICB9LFxuXG4gICAgbGluZUNvdW50OiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5zaXplO30sXG4gICAgZmlyc3RMaW5lOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5maXJzdDt9LFxuICAgIGxhc3RMaW5lOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5maXJzdCArIHRoaXMuc2l6ZSAtIDE7fSxcblxuICAgIGNsaXBQb3M6IGZ1bmN0aW9uKHBvcykge3JldHVybiBjbGlwUG9zKHRoaXMsIHBvcyk7fSxcblxuICAgIGdldEN1cnNvcjogZnVuY3Rpb24oc3RhcnQpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuc2VsLnByaW1hcnkoKSwgcG9zO1xuICAgICAgaWYgKHN0YXJ0ID09IG51bGwgfHwgc3RhcnQgPT0gXCJoZWFkXCIpIHBvcyA9IHJhbmdlLmhlYWQ7XG4gICAgICBlbHNlIGlmIChzdGFydCA9PSBcImFuY2hvclwiKSBwb3MgPSByYW5nZS5hbmNob3I7XG4gICAgICBlbHNlIGlmIChzdGFydCA9PSBcImVuZFwiIHx8IHN0YXJ0ID09IFwidG9cIiB8fCBzdGFydCA9PT0gZmFsc2UpIHBvcyA9IHJhbmdlLnRvKCk7XG4gICAgICBlbHNlIHBvcyA9IHJhbmdlLmZyb20oKTtcbiAgICAgIHJldHVybiBwb3M7XG4gICAgfSxcbiAgICBsaXN0U2VsZWN0aW9uczogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLnNlbC5yYW5nZXM7IH0sXG4gICAgc29tZXRoaW5nU2VsZWN0ZWQ6IGZ1bmN0aW9uKCkge3JldHVybiB0aGlzLnNlbC5zb21ldGhpbmdTZWxlY3RlZCgpO30sXG5cbiAgICBzZXRDdXJzb3I6IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGxpbmUsIGNoLCBvcHRpb25zKSB7XG4gICAgICBzZXRTaW1wbGVTZWxlY3Rpb24odGhpcywgY2xpcFBvcyh0aGlzLCB0eXBlb2YgbGluZSA9PSBcIm51bWJlclwiID8gUG9zKGxpbmUsIGNoIHx8IDApIDogbGluZSksIG51bGwsIG9wdGlvbnMpO1xuICAgIH0pLFxuICAgIHNldFNlbGVjdGlvbjogZG9jTWV0aG9kT3AoZnVuY3Rpb24oYW5jaG9yLCBoZWFkLCBvcHRpb25zKSB7XG4gICAgICBzZXRTaW1wbGVTZWxlY3Rpb24odGhpcywgY2xpcFBvcyh0aGlzLCBhbmNob3IpLCBjbGlwUG9zKHRoaXMsIGhlYWQgfHwgYW5jaG9yKSwgb3B0aW9ucyk7XG4gICAgfSksXG4gICAgZXh0ZW5kU2VsZWN0aW9uOiBkb2NNZXRob2RPcChmdW5jdGlvbihoZWFkLCBvdGhlciwgb3B0aW9ucykge1xuICAgICAgZXh0ZW5kU2VsZWN0aW9uKHRoaXMsIGNsaXBQb3ModGhpcywgaGVhZCksIG90aGVyICYmIGNsaXBQb3ModGhpcywgb3RoZXIpLCBvcHRpb25zKTtcbiAgICB9KSxcbiAgICBleHRlbmRTZWxlY3Rpb25zOiBkb2NNZXRob2RPcChmdW5jdGlvbihoZWFkcywgb3B0aW9ucykge1xuICAgICAgZXh0ZW5kU2VsZWN0aW9ucyh0aGlzLCBjbGlwUG9zQXJyYXkodGhpcywgaGVhZHMsIG9wdGlvbnMpKTtcbiAgICB9KSxcbiAgICBleHRlbmRTZWxlY3Rpb25zQnk6IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGYsIG9wdGlvbnMpIHtcbiAgICAgIGV4dGVuZFNlbGVjdGlvbnModGhpcywgbWFwKHRoaXMuc2VsLnJhbmdlcywgZiksIG9wdGlvbnMpO1xuICAgIH0pLFxuICAgIHNldFNlbGVjdGlvbnM6IGRvY01ldGhvZE9wKGZ1bmN0aW9uKHJhbmdlcywgcHJpbWFyeSwgb3B0aW9ucykge1xuICAgICAgaWYgKCFyYW5nZXMubGVuZ3RoKSByZXR1cm47XG4gICAgICBmb3IgKHZhciBpID0gMCwgb3V0ID0gW107IGkgPCByYW5nZXMubGVuZ3RoOyBpKyspXG4gICAgICAgIG91dFtpXSA9IG5ldyBSYW5nZShjbGlwUG9zKHRoaXMsIHJhbmdlc1tpXS5hbmNob3IpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpcFBvcyh0aGlzLCByYW5nZXNbaV0uaGVhZCkpO1xuICAgICAgaWYgKHByaW1hcnkgPT0gbnVsbCkgcHJpbWFyeSA9IE1hdGgubWluKHJhbmdlcy5sZW5ndGggLSAxLCB0aGlzLnNlbC5wcmltSW5kZXgpO1xuICAgICAgc2V0U2VsZWN0aW9uKHRoaXMsIG5vcm1hbGl6ZVNlbGVjdGlvbihvdXQsIHByaW1hcnkpLCBvcHRpb25zKTtcbiAgICB9KSxcbiAgICBhZGRTZWxlY3Rpb246IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGFuY2hvciwgaGVhZCwgb3B0aW9ucykge1xuICAgICAgdmFyIHJhbmdlcyA9IHRoaXMuc2VsLnJhbmdlcy5zbGljZSgwKTtcbiAgICAgIHJhbmdlcy5wdXNoKG5ldyBSYW5nZShjbGlwUG9zKHRoaXMsIGFuY2hvciksIGNsaXBQb3ModGhpcywgaGVhZCB8fCBhbmNob3IpKSk7XG4gICAgICBzZXRTZWxlY3Rpb24odGhpcywgbm9ybWFsaXplU2VsZWN0aW9uKHJhbmdlcywgcmFuZ2VzLmxlbmd0aCAtIDEpLCBvcHRpb25zKTtcbiAgICB9KSxcblxuICAgIGdldFNlbGVjdGlvbjogZnVuY3Rpb24obGluZVNlcCkge1xuICAgICAgdmFyIHJhbmdlcyA9IHRoaXMuc2VsLnJhbmdlcywgbGluZXM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgc2VsID0gZ2V0QmV0d2Vlbih0aGlzLCByYW5nZXNbaV0uZnJvbSgpLCByYW5nZXNbaV0udG8oKSk7XG4gICAgICAgIGxpbmVzID0gbGluZXMgPyBsaW5lcy5jb25jYXQoc2VsKSA6IHNlbDtcbiAgICAgIH1cbiAgICAgIGlmIChsaW5lU2VwID09PSBmYWxzZSkgcmV0dXJuIGxpbmVzO1xuICAgICAgZWxzZSByZXR1cm4gbGluZXMuam9pbihsaW5lU2VwIHx8IHRoaXMubGluZVNlcGFyYXRvcigpKTtcbiAgICB9LFxuICAgIGdldFNlbGVjdGlvbnM6IGZ1bmN0aW9uKGxpbmVTZXApIHtcbiAgICAgIHZhciBwYXJ0cyA9IFtdLCByYW5nZXMgPSB0aGlzLnNlbC5yYW5nZXM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgc2VsID0gZ2V0QmV0d2Vlbih0aGlzLCByYW5nZXNbaV0uZnJvbSgpLCByYW5nZXNbaV0udG8oKSk7XG4gICAgICAgIGlmIChsaW5lU2VwICE9PSBmYWxzZSkgc2VsID0gc2VsLmpvaW4obGluZVNlcCB8fCB0aGlzLmxpbmVTZXBhcmF0b3IoKSk7XG4gICAgICAgIHBhcnRzW2ldID0gc2VsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcnRzO1xuICAgIH0sXG4gICAgcmVwbGFjZVNlbGVjdGlvbjogZnVuY3Rpb24oY29kZSwgY29sbGFwc2UsIG9yaWdpbikge1xuICAgICAgdmFyIGR1cCA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnNlbC5yYW5nZXMubGVuZ3RoOyBpKyspXG4gICAgICAgIGR1cFtpXSA9IGNvZGU7XG4gICAgICB0aGlzLnJlcGxhY2VTZWxlY3Rpb25zKGR1cCwgY29sbGFwc2UsIG9yaWdpbiB8fCBcIitpbnB1dFwiKTtcbiAgICB9LFxuICAgIHJlcGxhY2VTZWxlY3Rpb25zOiBkb2NNZXRob2RPcChmdW5jdGlvbihjb2RlLCBjb2xsYXBzZSwgb3JpZ2luKSB7XG4gICAgICB2YXIgY2hhbmdlcyA9IFtdLCBzZWwgPSB0aGlzLnNlbDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsLnJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmFuZ2UgPSBzZWwucmFuZ2VzW2ldO1xuICAgICAgICBjaGFuZ2VzW2ldID0ge2Zyb206IHJhbmdlLmZyb20oKSwgdG86IHJhbmdlLnRvKCksIHRleHQ6IHRoaXMuc3BsaXRMaW5lcyhjb2RlW2ldKSwgb3JpZ2luOiBvcmlnaW59O1xuICAgICAgfVxuICAgICAgdmFyIG5ld1NlbCA9IGNvbGxhcHNlICYmIGNvbGxhcHNlICE9IFwiZW5kXCIgJiYgY29tcHV0ZVJlcGxhY2VkU2VsKHRoaXMsIGNoYW5nZXMsIGNvbGxhcHNlKTtcbiAgICAgIGZvciAodmFyIGkgPSBjaGFuZ2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKVxuICAgICAgICBtYWtlQ2hhbmdlKHRoaXMsIGNoYW5nZXNbaV0pO1xuICAgICAgaWYgKG5ld1NlbCkgc2V0U2VsZWN0aW9uUmVwbGFjZUhpc3RvcnkodGhpcywgbmV3U2VsKTtcbiAgICAgIGVsc2UgaWYgKHRoaXMuY20pIGVuc3VyZUN1cnNvclZpc2libGUodGhpcy5jbSk7XG4gICAgfSksXG4gICAgdW5kbzogZG9jTWV0aG9kT3AoZnVuY3Rpb24oKSB7bWFrZUNoYW5nZUZyb21IaXN0b3J5KHRoaXMsIFwidW5kb1wiKTt9KSxcbiAgICByZWRvOiBkb2NNZXRob2RPcChmdW5jdGlvbigpIHttYWtlQ2hhbmdlRnJvbUhpc3RvcnkodGhpcywgXCJyZWRvXCIpO30pLFxuICAgIHVuZG9TZWxlY3Rpb246IGRvY01ldGhvZE9wKGZ1bmN0aW9uKCkge21ha2VDaGFuZ2VGcm9tSGlzdG9yeSh0aGlzLCBcInVuZG9cIiwgdHJ1ZSk7fSksXG4gICAgcmVkb1NlbGVjdGlvbjogZG9jTWV0aG9kT3AoZnVuY3Rpb24oKSB7bWFrZUNoYW5nZUZyb21IaXN0b3J5KHRoaXMsIFwicmVkb1wiLCB0cnVlKTt9KSxcblxuICAgIHNldEV4dGVuZGluZzogZnVuY3Rpb24odmFsKSB7dGhpcy5leHRlbmQgPSB2YWw7fSxcbiAgICBnZXRFeHRlbmRpbmc6IGZ1bmN0aW9uKCkge3JldHVybiB0aGlzLmV4dGVuZDt9LFxuXG4gICAgaGlzdG9yeVNpemU6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGhpc3QgPSB0aGlzLmhpc3RvcnksIGRvbmUgPSAwLCB1bmRvbmUgPSAwO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBoaXN0LmRvbmUubGVuZ3RoOyBpKyspIGlmICghaGlzdC5kb25lW2ldLnJhbmdlcykgKytkb25lO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBoaXN0LnVuZG9uZS5sZW5ndGg7IGkrKykgaWYgKCFoaXN0LnVuZG9uZVtpXS5yYW5nZXMpICsrdW5kb25lO1xuICAgICAgcmV0dXJuIHt1bmRvOiBkb25lLCByZWRvOiB1bmRvbmV9O1xuICAgIH0sXG4gICAgY2xlYXJIaXN0b3J5OiBmdW5jdGlvbigpIHt0aGlzLmhpc3RvcnkgPSBuZXcgSGlzdG9yeSh0aGlzLmhpc3RvcnkubWF4R2VuZXJhdGlvbik7fSxcblxuICAgIG1hcmtDbGVhbjogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNsZWFuR2VuZXJhdGlvbiA9IHRoaXMuY2hhbmdlR2VuZXJhdGlvbih0cnVlKTtcbiAgICB9LFxuICAgIGNoYW5nZUdlbmVyYXRpb246IGZ1bmN0aW9uKGZvcmNlU3BsaXQpIHtcbiAgICAgIGlmIChmb3JjZVNwbGl0KVxuICAgICAgICB0aGlzLmhpc3RvcnkubGFzdE9wID0gdGhpcy5oaXN0b3J5Lmxhc3RTZWxPcCA9IHRoaXMuaGlzdG9yeS5sYXN0T3JpZ2luID0gbnVsbDtcbiAgICAgIHJldHVybiB0aGlzLmhpc3RvcnkuZ2VuZXJhdGlvbjtcbiAgICB9LFxuICAgIGlzQ2xlYW46IGZ1bmN0aW9uIChnZW4pIHtcbiAgICAgIHJldHVybiB0aGlzLmhpc3RvcnkuZ2VuZXJhdGlvbiA9PSAoZ2VuIHx8IHRoaXMuY2xlYW5HZW5lcmF0aW9uKTtcbiAgICB9LFxuXG4gICAgZ2V0SGlzdG9yeTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4ge2RvbmU6IGNvcHlIaXN0b3J5QXJyYXkodGhpcy5oaXN0b3J5LmRvbmUpLFxuICAgICAgICAgICAgICB1bmRvbmU6IGNvcHlIaXN0b3J5QXJyYXkodGhpcy5oaXN0b3J5LnVuZG9uZSl9O1xuICAgIH0sXG4gICAgc2V0SGlzdG9yeTogZnVuY3Rpb24oaGlzdERhdGEpIHtcbiAgICAgIHZhciBoaXN0ID0gdGhpcy5oaXN0b3J5ID0gbmV3IEhpc3RvcnkodGhpcy5oaXN0b3J5Lm1heEdlbmVyYXRpb24pO1xuICAgICAgaGlzdC5kb25lID0gY29weUhpc3RvcnlBcnJheShoaXN0RGF0YS5kb25lLnNsaWNlKDApLCBudWxsLCB0cnVlKTtcbiAgICAgIGhpc3QudW5kb25lID0gY29weUhpc3RvcnlBcnJheShoaXN0RGF0YS51bmRvbmUuc2xpY2UoMCksIG51bGwsIHRydWUpO1xuICAgIH0sXG5cbiAgICBhZGRMaW5lQ2xhc3M6IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGhhbmRsZSwgd2hlcmUsIGNscykge1xuICAgICAgcmV0dXJuIGNoYW5nZUxpbmUodGhpcywgaGFuZGxlLCB3aGVyZSA9PSBcImd1dHRlclwiID8gXCJndXR0ZXJcIiA6IFwiY2xhc3NcIiwgZnVuY3Rpb24obGluZSkge1xuICAgICAgICB2YXIgcHJvcCA9IHdoZXJlID09IFwidGV4dFwiID8gXCJ0ZXh0Q2xhc3NcIlxuICAgICAgICAgICAgICAgICA6IHdoZXJlID09IFwiYmFja2dyb3VuZFwiID8gXCJiZ0NsYXNzXCJcbiAgICAgICAgICAgICAgICAgOiB3aGVyZSA9PSBcImd1dHRlclwiID8gXCJndXR0ZXJDbGFzc1wiIDogXCJ3cmFwQ2xhc3NcIjtcbiAgICAgICAgaWYgKCFsaW5lW3Byb3BdKSBsaW5lW3Byb3BdID0gY2xzO1xuICAgICAgICBlbHNlIGlmIChjbGFzc1Rlc3QoY2xzKS50ZXN0KGxpbmVbcHJvcF0pKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGVsc2UgbGluZVtwcm9wXSArPSBcIiBcIiArIGNscztcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9KTtcbiAgICB9KSxcbiAgICByZW1vdmVMaW5lQ2xhc3M6IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGhhbmRsZSwgd2hlcmUsIGNscykge1xuICAgICAgcmV0dXJuIGNoYW5nZUxpbmUodGhpcywgaGFuZGxlLCB3aGVyZSA9PSBcImd1dHRlclwiID8gXCJndXR0ZXJcIiA6IFwiY2xhc3NcIiwgZnVuY3Rpb24obGluZSkge1xuICAgICAgICB2YXIgcHJvcCA9IHdoZXJlID09IFwidGV4dFwiID8gXCJ0ZXh0Q2xhc3NcIlxuICAgICAgICAgICAgICAgICA6IHdoZXJlID09IFwiYmFja2dyb3VuZFwiID8gXCJiZ0NsYXNzXCJcbiAgICAgICAgICAgICAgICAgOiB3aGVyZSA9PSBcImd1dHRlclwiID8gXCJndXR0ZXJDbGFzc1wiIDogXCJ3cmFwQ2xhc3NcIjtcbiAgICAgICAgdmFyIGN1ciA9IGxpbmVbcHJvcF07XG4gICAgICAgIGlmICghY3VyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGVsc2UgaWYgKGNscyA9PSBudWxsKSBsaW5lW3Byb3BdID0gbnVsbDtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdmFyIGZvdW5kID0gY3VyLm1hdGNoKGNsYXNzVGVzdChjbHMpKTtcbiAgICAgICAgICBpZiAoIWZvdW5kKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgdmFyIGVuZCA9IGZvdW5kLmluZGV4ICsgZm91bmRbMF0ubGVuZ3RoO1xuICAgICAgICAgIGxpbmVbcHJvcF0gPSBjdXIuc2xpY2UoMCwgZm91bmQuaW5kZXgpICsgKCFmb3VuZC5pbmRleCB8fCBlbmQgPT0gY3VyLmxlbmd0aCA/IFwiXCIgOiBcIiBcIikgKyBjdXIuc2xpY2UoZW5kKSB8fCBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gICAgfSksXG5cbiAgICBhZGRMaW5lV2lkZ2V0OiBkb2NNZXRob2RPcChmdW5jdGlvbihoYW5kbGUsIG5vZGUsIG9wdGlvbnMpIHtcbiAgICAgIHJldHVybiBhZGRMaW5lV2lkZ2V0KHRoaXMsIGhhbmRsZSwgbm9kZSwgb3B0aW9ucyk7XG4gICAgfSksXG4gICAgcmVtb3ZlTGluZVdpZGdldDogZnVuY3Rpb24od2lkZ2V0KSB7IHdpZGdldC5jbGVhcigpOyB9LFxuXG4gICAgbWFya1RleHQ6IGZ1bmN0aW9uKGZyb20sIHRvLCBvcHRpb25zKSB7XG4gICAgICByZXR1cm4gbWFya1RleHQodGhpcywgY2xpcFBvcyh0aGlzLCBmcm9tKSwgY2xpcFBvcyh0aGlzLCB0byksIG9wdGlvbnMsIG9wdGlvbnMgJiYgb3B0aW9ucy50eXBlIHx8IFwicmFuZ2VcIik7XG4gICAgfSxcbiAgICBzZXRCb29rbWFyazogZnVuY3Rpb24ocG9zLCBvcHRpb25zKSB7XG4gICAgICB2YXIgcmVhbE9wdHMgPSB7cmVwbGFjZWRXaXRoOiBvcHRpb25zICYmIChvcHRpb25zLm5vZGVUeXBlID09IG51bGwgPyBvcHRpb25zLndpZGdldCA6IG9wdGlvbnMpLFxuICAgICAgICAgICAgICAgICAgICAgIGluc2VydExlZnQ6IG9wdGlvbnMgJiYgb3B0aW9ucy5pbnNlcnRMZWZ0LFxuICAgICAgICAgICAgICAgICAgICAgIGNsZWFyV2hlbkVtcHR5OiBmYWxzZSwgc2hhcmVkOiBvcHRpb25zICYmIG9wdGlvbnMuc2hhcmVkLFxuICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZU1vdXNlRXZlbnRzOiBvcHRpb25zICYmIG9wdGlvbnMuaGFuZGxlTW91c2VFdmVudHN9O1xuICAgICAgcG9zID0gY2xpcFBvcyh0aGlzLCBwb3MpO1xuICAgICAgcmV0dXJuIG1hcmtUZXh0KHRoaXMsIHBvcywgcG9zLCByZWFsT3B0cywgXCJib29rbWFya1wiKTtcbiAgICB9LFxuICAgIGZpbmRNYXJrc0F0OiBmdW5jdGlvbihwb3MpIHtcbiAgICAgIHBvcyA9IGNsaXBQb3ModGhpcywgcG9zKTtcbiAgICAgIHZhciBtYXJrZXJzID0gW10sIHNwYW5zID0gZ2V0TGluZSh0aGlzLCBwb3MubGluZSkubWFya2VkU3BhbnM7XG4gICAgICBpZiAoc3BhbnMpIGZvciAodmFyIGkgPSAwOyBpIDwgc3BhbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIHNwYW4gPSBzcGFuc1tpXTtcbiAgICAgICAgaWYgKChzcGFuLmZyb20gPT0gbnVsbCB8fCBzcGFuLmZyb20gPD0gcG9zLmNoKSAmJlxuICAgICAgICAgICAgKHNwYW4udG8gPT0gbnVsbCB8fCBzcGFuLnRvID49IHBvcy5jaCkpXG4gICAgICAgICAgbWFya2Vycy5wdXNoKHNwYW4ubWFya2VyLnBhcmVudCB8fCBzcGFuLm1hcmtlcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFya2VycztcbiAgICB9LFxuICAgIGZpbmRNYXJrczogZnVuY3Rpb24oZnJvbSwgdG8sIGZpbHRlcikge1xuICAgICAgZnJvbSA9IGNsaXBQb3ModGhpcywgZnJvbSk7IHRvID0gY2xpcFBvcyh0aGlzLCB0byk7XG4gICAgICB2YXIgZm91bmQgPSBbXSwgbGluZU5vID0gZnJvbS5saW5lO1xuICAgICAgdGhpcy5pdGVyKGZyb20ubGluZSwgdG8ubGluZSArIDEsIGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgdmFyIHNwYW5zID0gbGluZS5tYXJrZWRTcGFucztcbiAgICAgICAgaWYgKHNwYW5zKSBmb3IgKHZhciBpID0gMDsgaSA8IHNwYW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIHNwYW4gPSBzcGFuc1tpXTtcbiAgICAgICAgICBpZiAoIShsaW5lTm8gPT0gZnJvbS5saW5lICYmIGZyb20uY2ggPiBzcGFuLnRvIHx8XG4gICAgICAgICAgICAgICAgc3Bhbi5mcm9tID09IG51bGwgJiYgbGluZU5vICE9IGZyb20ubGluZXx8XG4gICAgICAgICAgICAgICAgbGluZU5vID09IHRvLmxpbmUgJiYgc3Bhbi5mcm9tID4gdG8uY2gpICYmXG4gICAgICAgICAgICAgICghZmlsdGVyIHx8IGZpbHRlcihzcGFuLm1hcmtlcikpKVxuICAgICAgICAgICAgZm91bmQucHVzaChzcGFuLm1hcmtlci5wYXJlbnQgfHwgc3Bhbi5tYXJrZXIpO1xuICAgICAgICB9XG4gICAgICAgICsrbGluZU5vO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gZm91bmQ7XG4gICAgfSxcbiAgICBnZXRBbGxNYXJrczogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbWFya2VycyA9IFtdO1xuICAgICAgdGhpcy5pdGVyKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgdmFyIHNwcyA9IGxpbmUubWFya2VkU3BhbnM7XG4gICAgICAgIGlmIChzcHMpIGZvciAodmFyIGkgPSAwOyBpIDwgc3BzLmxlbmd0aDsgKytpKVxuICAgICAgICAgIGlmIChzcHNbaV0uZnJvbSAhPSBudWxsKSBtYXJrZXJzLnB1c2goc3BzW2ldLm1hcmtlcik7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBtYXJrZXJzO1xuICAgIH0sXG5cbiAgICBwb3NGcm9tSW5kZXg6IGZ1bmN0aW9uKG9mZikge1xuICAgICAgdmFyIGNoLCBsaW5lTm8gPSB0aGlzLmZpcnN0O1xuICAgICAgdGhpcy5pdGVyKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgdmFyIHN6ID0gbGluZS50ZXh0Lmxlbmd0aCArIDE7XG4gICAgICAgIGlmIChzeiA+IG9mZikgeyBjaCA9IG9mZjsgcmV0dXJuIHRydWU7IH1cbiAgICAgICAgb2ZmIC09IHN6O1xuICAgICAgICArK2xpbmVObztcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGNsaXBQb3ModGhpcywgUG9zKGxpbmVObywgY2gpKTtcbiAgICB9LFxuICAgIGluZGV4RnJvbVBvczogZnVuY3Rpb24gKGNvb3Jkcykge1xuICAgICAgY29vcmRzID0gY2xpcFBvcyh0aGlzLCBjb29yZHMpO1xuICAgICAgdmFyIGluZGV4ID0gY29vcmRzLmNoO1xuICAgICAgaWYgKGNvb3Jkcy5saW5lIDwgdGhpcy5maXJzdCB8fCBjb29yZHMuY2ggPCAwKSByZXR1cm4gMDtcbiAgICAgIHRoaXMuaXRlcih0aGlzLmZpcnN0LCBjb29yZHMubGluZSwgZnVuY3Rpb24gKGxpbmUpIHtcbiAgICAgICAgaW5kZXggKz0gbGluZS50ZXh0Lmxlbmd0aCArIDE7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBpbmRleDtcbiAgICB9LFxuXG4gICAgY29weTogZnVuY3Rpb24oY29weUhpc3RvcnkpIHtcbiAgICAgIHZhciBkb2MgPSBuZXcgRG9jKGdldExpbmVzKHRoaXMsIHRoaXMuZmlyc3QsIHRoaXMuZmlyc3QgKyB0aGlzLnNpemUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlT3B0aW9uLCB0aGlzLmZpcnN0LCB0aGlzLmxpbmVTZXApO1xuICAgICAgZG9jLnNjcm9sbFRvcCA9IHRoaXMuc2Nyb2xsVG9wOyBkb2Muc2Nyb2xsTGVmdCA9IHRoaXMuc2Nyb2xsTGVmdDtcbiAgICAgIGRvYy5zZWwgPSB0aGlzLnNlbDtcbiAgICAgIGRvYy5leHRlbmQgPSBmYWxzZTtcbiAgICAgIGlmIChjb3B5SGlzdG9yeSkge1xuICAgICAgICBkb2MuaGlzdG9yeS51bmRvRGVwdGggPSB0aGlzLmhpc3RvcnkudW5kb0RlcHRoO1xuICAgICAgICBkb2Muc2V0SGlzdG9yeSh0aGlzLmdldEhpc3RvcnkoKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZG9jO1xuICAgIH0sXG5cbiAgICBsaW5rZWREb2M6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIGlmICghb3B0aW9ucykgb3B0aW9ucyA9IHt9O1xuICAgICAgdmFyIGZyb20gPSB0aGlzLmZpcnN0LCB0byA9IHRoaXMuZmlyc3QgKyB0aGlzLnNpemU7XG4gICAgICBpZiAob3B0aW9ucy5mcm9tICE9IG51bGwgJiYgb3B0aW9ucy5mcm9tID4gZnJvbSkgZnJvbSA9IG9wdGlvbnMuZnJvbTtcbiAgICAgIGlmIChvcHRpb25zLnRvICE9IG51bGwgJiYgb3B0aW9ucy50byA8IHRvKSB0byA9IG9wdGlvbnMudG87XG4gICAgICB2YXIgY29weSA9IG5ldyBEb2MoZ2V0TGluZXModGhpcywgZnJvbSwgdG8pLCBvcHRpb25zLm1vZGUgfHwgdGhpcy5tb2RlT3B0aW9uLCBmcm9tLCB0aGlzLmxpbmVTZXApO1xuICAgICAgaWYgKG9wdGlvbnMuc2hhcmVkSGlzdCkgY29weS5oaXN0b3J5ID0gdGhpcy5oaXN0b3J5O1xuICAgICAgKHRoaXMubGlua2VkIHx8ICh0aGlzLmxpbmtlZCA9IFtdKSkucHVzaCh7ZG9jOiBjb3B5LCBzaGFyZWRIaXN0OiBvcHRpb25zLnNoYXJlZEhpc3R9KTtcbiAgICAgIGNvcHkubGlua2VkID0gW3tkb2M6IHRoaXMsIGlzUGFyZW50OiB0cnVlLCBzaGFyZWRIaXN0OiBvcHRpb25zLnNoYXJlZEhpc3R9XTtcbiAgICAgIGNvcHlTaGFyZWRNYXJrZXJzKGNvcHksIGZpbmRTaGFyZWRNYXJrZXJzKHRoaXMpKTtcbiAgICAgIHJldHVybiBjb3B5O1xuICAgIH0sXG4gICAgdW5saW5rRG9jOiBmdW5jdGlvbihvdGhlcikge1xuICAgICAgaWYgKG90aGVyIGluc3RhbmNlb2YgQ29kZU1pcnJvcikgb3RoZXIgPSBvdGhlci5kb2M7XG4gICAgICBpZiAodGhpcy5saW5rZWQpIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5saW5rZWQubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGxpbmsgPSB0aGlzLmxpbmtlZFtpXTtcbiAgICAgICAgaWYgKGxpbmsuZG9jICE9IG90aGVyKSBjb250aW51ZTtcbiAgICAgICAgdGhpcy5saW5rZWQuc3BsaWNlKGksIDEpO1xuICAgICAgICBvdGhlci51bmxpbmtEb2ModGhpcyk7XG4gICAgICAgIGRldGFjaFNoYXJlZE1hcmtlcnMoZmluZFNoYXJlZE1hcmtlcnModGhpcykpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZSBoaXN0b3JpZXMgd2VyZSBzaGFyZWQsIHNwbGl0IHRoZW0gYWdhaW5cbiAgICAgIGlmIChvdGhlci5oaXN0b3J5ID09IHRoaXMuaGlzdG9yeSkge1xuICAgICAgICB2YXIgc3BsaXRJZHMgPSBbb3RoZXIuaWRdO1xuICAgICAgICBsaW5rZWREb2NzKG90aGVyLCBmdW5jdGlvbihkb2MpIHtzcGxpdElkcy5wdXNoKGRvYy5pZCk7fSwgdHJ1ZSk7XG4gICAgICAgIG90aGVyLmhpc3RvcnkgPSBuZXcgSGlzdG9yeShudWxsKTtcbiAgICAgICAgb3RoZXIuaGlzdG9yeS5kb25lID0gY29weUhpc3RvcnlBcnJheSh0aGlzLmhpc3RvcnkuZG9uZSwgc3BsaXRJZHMpO1xuICAgICAgICBvdGhlci5oaXN0b3J5LnVuZG9uZSA9IGNvcHlIaXN0b3J5QXJyYXkodGhpcy5oaXN0b3J5LnVuZG9uZSwgc3BsaXRJZHMpO1xuICAgICAgfVxuICAgIH0sXG4gICAgaXRlckxpbmtlZERvY3M6IGZ1bmN0aW9uKGYpIHtsaW5rZWREb2NzKHRoaXMsIGYpO30sXG5cbiAgICBnZXRNb2RlOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5tb2RlO30sXG4gICAgZ2V0RWRpdG9yOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5jbTt9LFxuXG4gICAgc3BsaXRMaW5lczogZnVuY3Rpb24oc3RyKSB7XG4gICAgICBpZiAodGhpcy5saW5lU2VwKSByZXR1cm4gc3RyLnNwbGl0KHRoaXMubGluZVNlcCk7XG4gICAgICByZXR1cm4gc3BsaXRMaW5lc0F1dG8oc3RyKTtcbiAgICB9LFxuICAgIGxpbmVTZXBhcmF0b3I6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5saW5lU2VwIHx8IFwiXFxuXCI7IH1cbiAgfSk7XG5cbiAgLy8gUHVibGljIGFsaWFzLlxuICBEb2MucHJvdG90eXBlLmVhY2hMaW5lID0gRG9jLnByb3RvdHlwZS5pdGVyO1xuXG4gIC8vIFNldCB1cCBtZXRob2RzIG9uIENvZGVNaXJyb3IncyBwcm90b3R5cGUgdG8gcmVkaXJlY3QgdG8gdGhlIGVkaXRvcidzIGRvY3VtZW50LlxuICB2YXIgZG9udERlbGVnYXRlID0gXCJpdGVyIGluc2VydCByZW1vdmUgY29weSBnZXRFZGl0b3IgY29uc3RydWN0b3JcIi5zcGxpdChcIiBcIik7XG4gIGZvciAodmFyIHByb3AgaW4gRG9jLnByb3RvdHlwZSkgaWYgKERvYy5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkocHJvcCkgJiYgaW5kZXhPZihkb250RGVsZWdhdGUsIHByb3ApIDwgMClcbiAgICBDb2RlTWlycm9yLnByb3RvdHlwZVtwcm9wXSA9IChmdW5jdGlvbihtZXRob2QpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtyZXR1cm4gbWV0aG9kLmFwcGx5KHRoaXMuZG9jLCBhcmd1bWVudHMpO307XG4gICAgfSkoRG9jLnByb3RvdHlwZVtwcm9wXSk7XG5cbiAgZXZlbnRNaXhpbihEb2MpO1xuXG4gIC8vIENhbGwgZiBmb3IgYWxsIGxpbmtlZCBkb2N1bWVudHMuXG4gIGZ1bmN0aW9uIGxpbmtlZERvY3MoZG9jLCBmLCBzaGFyZWRIaXN0T25seSkge1xuICAgIGZ1bmN0aW9uIHByb3BhZ2F0ZShkb2MsIHNraXAsIHNoYXJlZEhpc3QpIHtcbiAgICAgIGlmIChkb2MubGlua2VkKSBmb3IgKHZhciBpID0gMDsgaSA8IGRvYy5saW5rZWQubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIHJlbCA9IGRvYy5saW5rZWRbaV07XG4gICAgICAgIGlmIChyZWwuZG9jID09IHNraXApIGNvbnRpbnVlO1xuICAgICAgICB2YXIgc2hhcmVkID0gc2hhcmVkSGlzdCAmJiByZWwuc2hhcmVkSGlzdDtcbiAgICAgICAgaWYgKHNoYXJlZEhpc3RPbmx5ICYmICFzaGFyZWQpIGNvbnRpbnVlO1xuICAgICAgICBmKHJlbC5kb2MsIHNoYXJlZCk7XG4gICAgICAgIHByb3BhZ2F0ZShyZWwuZG9jLCBkb2MsIHNoYXJlZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHByb3BhZ2F0ZShkb2MsIG51bGwsIHRydWUpO1xuICB9XG5cbiAgLy8gQXR0YWNoIGEgZG9jdW1lbnQgdG8gYW4gZWRpdG9yLlxuICBmdW5jdGlvbiBhdHRhY2hEb2MoY20sIGRvYykge1xuICAgIGlmIChkb2MuY20pIHRocm93IG5ldyBFcnJvcihcIlRoaXMgZG9jdW1lbnQgaXMgYWxyZWFkeSBpbiB1c2UuXCIpO1xuICAgIGNtLmRvYyA9IGRvYztcbiAgICBkb2MuY20gPSBjbTtcbiAgICBlc3RpbWF0ZUxpbmVIZWlnaHRzKGNtKTtcbiAgICBsb2FkTW9kZShjbSk7XG4gICAgaWYgKCFjbS5vcHRpb25zLmxpbmVXcmFwcGluZykgZmluZE1heExpbmUoY20pO1xuICAgIGNtLm9wdGlvbnMubW9kZSA9IGRvYy5tb2RlT3B0aW9uO1xuICAgIHJlZ0NoYW5nZShjbSk7XG4gIH1cblxuICAvLyBMSU5FIFVUSUxJVElFU1xuXG4gIC8vIEZpbmQgdGhlIGxpbmUgb2JqZWN0IGNvcnJlc3BvbmRpbmcgdG8gdGhlIGdpdmVuIGxpbmUgbnVtYmVyLlxuICBmdW5jdGlvbiBnZXRMaW5lKGRvYywgbikge1xuICAgIG4gLT0gZG9jLmZpcnN0O1xuICAgIGlmIChuIDwgMCB8fCBuID49IGRvYy5zaXplKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGVyZSBpcyBubyBsaW5lIFwiICsgKG4gKyBkb2MuZmlyc3QpICsgXCIgaW4gdGhlIGRvY3VtZW50LlwiKTtcbiAgICBmb3IgKHZhciBjaHVuayA9IGRvYzsgIWNodW5rLmxpbmVzOykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7OyArK2kpIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2h1bmsuY2hpbGRyZW5baV0sIHN6ID0gY2hpbGQuY2h1bmtTaXplKCk7XG4gICAgICAgIGlmIChuIDwgc3opIHsgY2h1bmsgPSBjaGlsZDsgYnJlYWs7IH1cbiAgICAgICAgbiAtPSBzejtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNodW5rLmxpbmVzW25dO1xuICB9XG5cbiAgLy8gR2V0IHRoZSBwYXJ0IG9mIGEgZG9jdW1lbnQgYmV0d2VlbiB0d28gcG9zaXRpb25zLCBhcyBhbiBhcnJheSBvZlxuICAvLyBzdHJpbmdzLlxuICBmdW5jdGlvbiBnZXRCZXR3ZWVuKGRvYywgc3RhcnQsIGVuZCkge1xuICAgIHZhciBvdXQgPSBbXSwgbiA9IHN0YXJ0LmxpbmU7XG4gICAgZG9jLml0ZXIoc3RhcnQubGluZSwgZW5kLmxpbmUgKyAxLCBmdW5jdGlvbihsaW5lKSB7XG4gICAgICB2YXIgdGV4dCA9IGxpbmUudGV4dDtcbiAgICAgIGlmIChuID09IGVuZC5saW5lKSB0ZXh0ID0gdGV4dC5zbGljZSgwLCBlbmQuY2gpO1xuICAgICAgaWYgKG4gPT0gc3RhcnQubGluZSkgdGV4dCA9IHRleHQuc2xpY2Uoc3RhcnQuY2gpO1xuICAgICAgb3V0LnB1c2godGV4dCk7XG4gICAgICArK247XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dDtcbiAgfVxuICAvLyBHZXQgdGhlIGxpbmVzIGJldHdlZW4gZnJvbSBhbmQgdG8sIGFzIGFycmF5IG9mIHN0cmluZ3MuXG4gIGZ1bmN0aW9uIGdldExpbmVzKGRvYywgZnJvbSwgdG8pIHtcbiAgICB2YXIgb3V0ID0gW107XG4gICAgZG9jLml0ZXIoZnJvbSwgdG8sIGZ1bmN0aW9uKGxpbmUpIHsgb3V0LnB1c2gobGluZS50ZXh0KTsgfSk7XG4gICAgcmV0dXJuIG91dDtcbiAgfVxuXG4gIC8vIFVwZGF0ZSB0aGUgaGVpZ2h0IG9mIGEgbGluZSwgcHJvcGFnYXRpbmcgdGhlIGhlaWdodCBjaGFuZ2VcbiAgLy8gdXB3YXJkcyB0byBwYXJlbnQgbm9kZXMuXG4gIGZ1bmN0aW9uIHVwZGF0ZUxpbmVIZWlnaHQobGluZSwgaGVpZ2h0KSB7XG4gICAgdmFyIGRpZmYgPSBoZWlnaHQgLSBsaW5lLmhlaWdodDtcbiAgICBpZiAoZGlmZikgZm9yICh2YXIgbiA9IGxpbmU7IG47IG4gPSBuLnBhcmVudCkgbi5oZWlnaHQgKz0gZGlmZjtcbiAgfVxuXG4gIC8vIEdpdmVuIGEgbGluZSBvYmplY3QsIGZpbmQgaXRzIGxpbmUgbnVtYmVyIGJ5IHdhbGtpbmcgdXAgdGhyb3VnaFxuICAvLyBpdHMgcGFyZW50IGxpbmtzLlxuICBmdW5jdGlvbiBsaW5lTm8obGluZSkge1xuICAgIGlmIChsaW5lLnBhcmVudCA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICB2YXIgY3VyID0gbGluZS5wYXJlbnQsIG5vID0gaW5kZXhPZihjdXIubGluZXMsIGxpbmUpO1xuICAgIGZvciAodmFyIGNodW5rID0gY3VyLnBhcmVudDsgY2h1bms7IGN1ciA9IGNodW5rLCBjaHVuayA9IGNodW5rLnBhcmVudCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7OyArK2kpIHtcbiAgICAgICAgaWYgKGNodW5rLmNoaWxkcmVuW2ldID09IGN1cikgYnJlYWs7XG4gICAgICAgIG5vICs9IGNodW5rLmNoaWxkcmVuW2ldLmNodW5rU2l6ZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbm8gKyBjdXIuZmlyc3Q7XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsaW5lIGF0IHRoZSBnaXZlbiB2ZXJ0aWNhbCBwb3NpdGlvbiwgdXNpbmcgdGhlIGhlaWdodFxuICAvLyBpbmZvcm1hdGlvbiBpbiB0aGUgZG9jdW1lbnQgdHJlZS5cbiAgZnVuY3Rpb24gbGluZUF0SGVpZ2h0KGNodW5rLCBoKSB7XG4gICAgdmFyIG4gPSBjaHVuay5maXJzdDtcbiAgICBvdXRlcjogZG8ge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaHVuay5jaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgY2hpbGQgPSBjaHVuay5jaGlsZHJlbltpXSwgY2ggPSBjaGlsZC5oZWlnaHQ7XG4gICAgICAgIGlmIChoIDwgY2gpIHsgY2h1bmsgPSBjaGlsZDsgY29udGludWUgb3V0ZXI7IH1cbiAgICAgICAgaCAtPSBjaDtcbiAgICAgICAgbiArPSBjaGlsZC5jaHVua1NpemUoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuO1xuICAgIH0gd2hpbGUgKCFjaHVuay5saW5lcyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaHVuay5saW5lcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGxpbmUgPSBjaHVuay5saW5lc1tpXSwgbGggPSBsaW5lLmhlaWdodDtcbiAgICAgIGlmIChoIDwgbGgpIGJyZWFrO1xuICAgICAgaCAtPSBsaDtcbiAgICB9XG4gICAgcmV0dXJuIG4gKyBpO1xuICB9XG5cblxuICAvLyBGaW5kIHRoZSBoZWlnaHQgYWJvdmUgdGhlIGdpdmVuIGxpbmUuXG4gIGZ1bmN0aW9uIGhlaWdodEF0TGluZShsaW5lT2JqKSB7XG4gICAgbGluZU9iaiA9IHZpc3VhbExpbmUobGluZU9iaik7XG5cbiAgICB2YXIgaCA9IDAsIGNodW5rID0gbGluZU9iai5wYXJlbnQ7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaHVuay5saW5lcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGxpbmUgPSBjaHVuay5saW5lc1tpXTtcbiAgICAgIGlmIChsaW5lID09IGxpbmVPYmopIGJyZWFrO1xuICAgICAgZWxzZSBoICs9IGxpbmUuaGVpZ2h0O1xuICAgIH1cbiAgICBmb3IgKHZhciBwID0gY2h1bmsucGFyZW50OyBwOyBjaHVuayA9IHAsIHAgPSBjaHVuay5wYXJlbnQpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcC5jaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgY3VyID0gcC5jaGlsZHJlbltpXTtcbiAgICAgICAgaWYgKGN1ciA9PSBjaHVuaykgYnJlYWs7XG4gICAgICAgIGVsc2UgaCArPSBjdXIuaGVpZ2h0O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaDtcbiAgfVxuXG4gIC8vIEdldCB0aGUgYmlkaSBvcmRlcmluZyBmb3IgdGhlIGdpdmVuIGxpbmUgKGFuZCBjYWNoZSBpdCkuIFJldHVybnNcbiAgLy8gZmFsc2UgZm9yIGxpbmVzIHRoYXQgYXJlIGZ1bGx5IGxlZnQtdG8tcmlnaHQsIGFuZCBhbiBhcnJheSBvZlxuICAvLyBCaWRpU3BhbiBvYmplY3RzIG90aGVyd2lzZS5cbiAgZnVuY3Rpb24gZ2V0T3JkZXIobGluZSkge1xuICAgIHZhciBvcmRlciA9IGxpbmUub3JkZXI7XG4gICAgaWYgKG9yZGVyID09IG51bGwpIG9yZGVyID0gbGluZS5vcmRlciA9IGJpZGlPcmRlcmluZyhsaW5lLnRleHQpO1xuICAgIHJldHVybiBvcmRlcjtcbiAgfVxuXG4gIC8vIEhJU1RPUllcblxuICBmdW5jdGlvbiBIaXN0b3J5KHN0YXJ0R2VuKSB7XG4gICAgLy8gQXJyYXlzIG9mIGNoYW5nZSBldmVudHMgYW5kIHNlbGVjdGlvbnMuIERvaW5nIHNvbWV0aGluZyBhZGRzIGFuXG4gICAgLy8gZXZlbnQgdG8gZG9uZSBhbmQgY2xlYXJzIHVuZG8uIFVuZG9pbmcgbW92ZXMgZXZlbnRzIGZyb20gZG9uZVxuICAgIC8vIHRvIHVuZG9uZSwgcmVkb2luZyBtb3ZlcyB0aGVtIGluIHRoZSBvdGhlciBkaXJlY3Rpb24uXG4gICAgdGhpcy5kb25lID0gW107IHRoaXMudW5kb25lID0gW107XG4gICAgdGhpcy51bmRvRGVwdGggPSBJbmZpbml0eTtcbiAgICAvLyBVc2VkIHRvIHRyYWNrIHdoZW4gY2hhbmdlcyBjYW4gYmUgbWVyZ2VkIGludG8gYSBzaW5nbGUgdW5kb1xuICAgIC8vIGV2ZW50XG4gICAgdGhpcy5sYXN0TW9kVGltZSA9IHRoaXMubGFzdFNlbFRpbWUgPSAwO1xuICAgIHRoaXMubGFzdE9wID0gdGhpcy5sYXN0U2VsT3AgPSBudWxsO1xuICAgIHRoaXMubGFzdE9yaWdpbiA9IHRoaXMubGFzdFNlbE9yaWdpbiA9IG51bGw7XG4gICAgLy8gVXNlZCBieSB0aGUgaXNDbGVhbigpIG1ldGhvZFxuICAgIHRoaXMuZ2VuZXJhdGlvbiA9IHRoaXMubWF4R2VuZXJhdGlvbiA9IHN0YXJ0R2VuIHx8IDE7XG4gIH1cblxuICAvLyBDcmVhdGUgYSBoaXN0b3J5IGNoYW5nZSBldmVudCBmcm9tIGFuIHVwZGF0ZURvYy1zdHlsZSBjaGFuZ2VcbiAgLy8gb2JqZWN0LlxuICBmdW5jdGlvbiBoaXN0b3J5Q2hhbmdlRnJvbUNoYW5nZShkb2MsIGNoYW5nZSkge1xuICAgIHZhciBoaXN0Q2hhbmdlID0ge2Zyb206IGNvcHlQb3MoY2hhbmdlLmZyb20pLCB0bzogY2hhbmdlRW5kKGNoYW5nZSksIHRleHQ6IGdldEJldHdlZW4oZG9jLCBjaGFuZ2UuZnJvbSwgY2hhbmdlLnRvKX07XG4gICAgYXR0YWNoTG9jYWxTcGFucyhkb2MsIGhpc3RDaGFuZ2UsIGNoYW5nZS5mcm9tLmxpbmUsIGNoYW5nZS50by5saW5lICsgMSk7XG4gICAgbGlua2VkRG9jcyhkb2MsIGZ1bmN0aW9uKGRvYykge2F0dGFjaExvY2FsU3BhbnMoZG9jLCBoaXN0Q2hhbmdlLCBjaGFuZ2UuZnJvbS5saW5lLCBjaGFuZ2UudG8ubGluZSArIDEpO30sIHRydWUpO1xuICAgIHJldHVybiBoaXN0Q2hhbmdlO1xuICB9XG5cbiAgLy8gUG9wIGFsbCBzZWxlY3Rpb24gZXZlbnRzIG9mZiB0aGUgZW5kIG9mIGEgaGlzdG9yeSBhcnJheS4gU3RvcCBhdFxuICAvLyBhIGNoYW5nZSBldmVudC5cbiAgZnVuY3Rpb24gY2xlYXJTZWxlY3Rpb25FdmVudHMoYXJyYXkpIHtcbiAgICB3aGlsZSAoYXJyYXkubGVuZ3RoKSB7XG4gICAgICB2YXIgbGFzdCA9IGxzdChhcnJheSk7XG4gICAgICBpZiAobGFzdC5yYW5nZXMpIGFycmF5LnBvcCgpO1xuICAgICAgZWxzZSBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSB0b3AgY2hhbmdlIGV2ZW50IGluIHRoZSBoaXN0b3J5LiBQb3Agb2ZmIHNlbGVjdGlvblxuICAvLyBldmVudHMgdGhhdCBhcmUgaW4gdGhlIHdheS5cbiAgZnVuY3Rpb24gbGFzdENoYW5nZUV2ZW50KGhpc3QsIGZvcmNlKSB7XG4gICAgaWYgKGZvcmNlKSB7XG4gICAgICBjbGVhclNlbGVjdGlvbkV2ZW50cyhoaXN0LmRvbmUpO1xuICAgICAgcmV0dXJuIGxzdChoaXN0LmRvbmUpO1xuICAgIH0gZWxzZSBpZiAoaGlzdC5kb25lLmxlbmd0aCAmJiAhbHN0KGhpc3QuZG9uZSkucmFuZ2VzKSB7XG4gICAgICByZXR1cm4gbHN0KGhpc3QuZG9uZSk7XG4gICAgfSBlbHNlIGlmIChoaXN0LmRvbmUubGVuZ3RoID4gMSAmJiAhaGlzdC5kb25lW2hpc3QuZG9uZS5sZW5ndGggLSAyXS5yYW5nZXMpIHtcbiAgICAgIGhpc3QuZG9uZS5wb3AoKTtcbiAgICAgIHJldHVybiBsc3QoaGlzdC5kb25lKTtcbiAgICB9XG4gIH1cblxuICAvLyBSZWdpc3RlciBhIGNoYW5nZSBpbiB0aGUgaGlzdG9yeS4gTWVyZ2VzIGNoYW5nZXMgdGhhdCBhcmUgd2l0aGluXG4gIC8vIGEgc2luZ2xlIG9wZXJhdGlvbiwgb3JlIGFyZSBjbG9zZSB0b2dldGhlciB3aXRoIGFuIG9yaWdpbiB0aGF0XG4gIC8vIGFsbG93cyBtZXJnaW5nIChzdGFydGluZyB3aXRoIFwiK1wiKSBpbnRvIGEgc2luZ2xlIGV2ZW50LlxuICBmdW5jdGlvbiBhZGRDaGFuZ2VUb0hpc3RvcnkoZG9jLCBjaGFuZ2UsIHNlbEFmdGVyLCBvcElkKSB7XG4gICAgdmFyIGhpc3QgPSBkb2MuaGlzdG9yeTtcbiAgICBoaXN0LnVuZG9uZS5sZW5ndGggPSAwO1xuICAgIHZhciB0aW1lID0gK25ldyBEYXRlLCBjdXI7XG5cbiAgICBpZiAoKGhpc3QubGFzdE9wID09IG9wSWQgfHxcbiAgICAgICAgIGhpc3QubGFzdE9yaWdpbiA9PSBjaGFuZ2Uub3JpZ2luICYmIGNoYW5nZS5vcmlnaW4gJiZcbiAgICAgICAgICgoY2hhbmdlLm9yaWdpbi5jaGFyQXQoMCkgPT0gXCIrXCIgJiYgZG9jLmNtICYmIGhpc3QubGFzdE1vZFRpbWUgPiB0aW1lIC0gZG9jLmNtLm9wdGlvbnMuaGlzdG9yeUV2ZW50RGVsYXkpIHx8XG4gICAgICAgICAgY2hhbmdlLm9yaWdpbi5jaGFyQXQoMCkgPT0gXCIqXCIpKSAmJlxuICAgICAgICAoY3VyID0gbGFzdENoYW5nZUV2ZW50KGhpc3QsIGhpc3QubGFzdE9wID09IG9wSWQpKSkge1xuICAgICAgLy8gTWVyZ2UgdGhpcyBjaGFuZ2UgaW50byB0aGUgbGFzdCBldmVudFxuICAgICAgdmFyIGxhc3QgPSBsc3QoY3VyLmNoYW5nZXMpO1xuICAgICAgaWYgKGNtcChjaGFuZ2UuZnJvbSwgY2hhbmdlLnRvKSA9PSAwICYmIGNtcChjaGFuZ2UuZnJvbSwgbGFzdC50bykgPT0gMCkge1xuICAgICAgICAvLyBPcHRpbWl6ZWQgY2FzZSBmb3Igc2ltcGxlIGluc2VydGlvbiAtLSBkb24ndCB3YW50IHRvIGFkZFxuICAgICAgICAvLyBuZXcgY2hhbmdlc2V0cyBmb3IgZXZlcnkgY2hhcmFjdGVyIHR5cGVkXG4gICAgICAgIGxhc3QudG8gPSBjaGFuZ2VFbmQoY2hhbmdlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEFkZCBuZXcgc3ViLWV2ZW50XG4gICAgICAgIGN1ci5jaGFuZ2VzLnB1c2goaGlzdG9yeUNoYW5nZUZyb21DaGFuZ2UoZG9jLCBjaGFuZ2UpKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ2FuIG5vdCBiZSBtZXJnZWQsIHN0YXJ0IGEgbmV3IGV2ZW50LlxuICAgICAgdmFyIGJlZm9yZSA9IGxzdChoaXN0LmRvbmUpO1xuICAgICAgaWYgKCFiZWZvcmUgfHwgIWJlZm9yZS5yYW5nZXMpXG4gICAgICAgIHB1c2hTZWxlY3Rpb25Ub0hpc3RvcnkoZG9jLnNlbCwgaGlzdC5kb25lKTtcbiAgICAgIGN1ciA9IHtjaGFuZ2VzOiBbaGlzdG9yeUNoYW5nZUZyb21DaGFuZ2UoZG9jLCBjaGFuZ2UpXSxcbiAgICAgICAgICAgICBnZW5lcmF0aW9uOiBoaXN0LmdlbmVyYXRpb259O1xuICAgICAgaGlzdC5kb25lLnB1c2goY3VyKTtcbiAgICAgIHdoaWxlIChoaXN0LmRvbmUubGVuZ3RoID4gaGlzdC51bmRvRGVwdGgpIHtcbiAgICAgICAgaGlzdC5kb25lLnNoaWZ0KCk7XG4gICAgICAgIGlmICghaGlzdC5kb25lWzBdLnJhbmdlcykgaGlzdC5kb25lLnNoaWZ0KCk7XG4gICAgICB9XG4gICAgfVxuICAgIGhpc3QuZG9uZS5wdXNoKHNlbEFmdGVyKTtcbiAgICBoaXN0LmdlbmVyYXRpb24gPSArK2hpc3QubWF4R2VuZXJhdGlvbjtcbiAgICBoaXN0Lmxhc3RNb2RUaW1lID0gaGlzdC5sYXN0U2VsVGltZSA9IHRpbWU7XG4gICAgaGlzdC5sYXN0T3AgPSBoaXN0Lmxhc3RTZWxPcCA9IG9wSWQ7XG4gICAgaGlzdC5sYXN0T3JpZ2luID0gaGlzdC5sYXN0U2VsT3JpZ2luID0gY2hhbmdlLm9yaWdpbjtcblxuICAgIGlmICghbGFzdCkgc2lnbmFsKGRvYywgXCJoaXN0b3J5QWRkZWRcIik7XG4gIH1cblxuICBmdW5jdGlvbiBzZWxlY3Rpb25FdmVudENhbkJlTWVyZ2VkKGRvYywgb3JpZ2luLCBwcmV2LCBzZWwpIHtcbiAgICB2YXIgY2ggPSBvcmlnaW4uY2hhckF0KDApO1xuICAgIHJldHVybiBjaCA9PSBcIipcIiB8fFxuICAgICAgY2ggPT0gXCIrXCIgJiZcbiAgICAgIHByZXYucmFuZ2VzLmxlbmd0aCA9PSBzZWwucmFuZ2VzLmxlbmd0aCAmJlxuICAgICAgcHJldi5zb21ldGhpbmdTZWxlY3RlZCgpID09IHNlbC5zb21ldGhpbmdTZWxlY3RlZCgpICYmXG4gICAgICBuZXcgRGF0ZSAtIGRvYy5oaXN0b3J5Lmxhc3RTZWxUaW1lIDw9IChkb2MuY20gPyBkb2MuY20ub3B0aW9ucy5oaXN0b3J5RXZlbnREZWxheSA6IDUwMCk7XG4gIH1cblxuICAvLyBDYWxsZWQgd2hlbmV2ZXIgdGhlIHNlbGVjdGlvbiBjaGFuZ2VzLCBzZXRzIHRoZSBuZXcgc2VsZWN0aW9uIGFzXG4gIC8vIHRoZSBwZW5kaW5nIHNlbGVjdGlvbiBpbiB0aGUgaGlzdG9yeSwgYW5kIHB1c2hlcyB0aGUgb2xkIHBlbmRpbmdcbiAgLy8gc2VsZWN0aW9uIGludG8gdGhlICdkb25lJyBhcnJheSB3aGVuIGl0IHdhcyBzaWduaWZpY2FudGx5XG4gIC8vIGRpZmZlcmVudCAoaW4gbnVtYmVyIG9mIHNlbGVjdGVkIHJhbmdlcywgZW1wdGluZXNzLCBvciB0aW1lKS5cbiAgZnVuY3Rpb24gYWRkU2VsZWN0aW9uVG9IaXN0b3J5KGRvYywgc2VsLCBvcElkLCBvcHRpb25zKSB7XG4gICAgdmFyIGhpc3QgPSBkb2MuaGlzdG9yeSwgb3JpZ2luID0gb3B0aW9ucyAmJiBvcHRpb25zLm9yaWdpbjtcblxuICAgIC8vIEEgbmV3IGV2ZW50IGlzIHN0YXJ0ZWQgd2hlbiB0aGUgcHJldmlvdXMgb3JpZ2luIGRvZXMgbm90IG1hdGNoXG4gICAgLy8gdGhlIGN1cnJlbnQsIG9yIHRoZSBvcmlnaW5zIGRvbid0IGFsbG93IG1hdGNoaW5nLiBPcmlnaW5zXG4gICAgLy8gc3RhcnRpbmcgd2l0aCAqIGFyZSBhbHdheXMgbWVyZ2VkLCB0aG9zZSBzdGFydGluZyB3aXRoICsgYXJlXG4gICAgLy8gbWVyZ2VkIHdoZW4gc2ltaWxhciBhbmQgY2xvc2UgdG9nZXRoZXIgaW4gdGltZS5cbiAgICBpZiAob3BJZCA9PSBoaXN0Lmxhc3RTZWxPcCB8fFxuICAgICAgICAob3JpZ2luICYmIGhpc3QubGFzdFNlbE9yaWdpbiA9PSBvcmlnaW4gJiZcbiAgICAgICAgIChoaXN0Lmxhc3RNb2RUaW1lID09IGhpc3QubGFzdFNlbFRpbWUgJiYgaGlzdC5sYXN0T3JpZ2luID09IG9yaWdpbiB8fFxuICAgICAgICAgIHNlbGVjdGlvbkV2ZW50Q2FuQmVNZXJnZWQoZG9jLCBvcmlnaW4sIGxzdChoaXN0LmRvbmUpLCBzZWwpKSkpXG4gICAgICBoaXN0LmRvbmVbaGlzdC5kb25lLmxlbmd0aCAtIDFdID0gc2VsO1xuICAgIGVsc2VcbiAgICAgIHB1c2hTZWxlY3Rpb25Ub0hpc3Rvcnkoc2VsLCBoaXN0LmRvbmUpO1xuXG4gICAgaGlzdC5sYXN0U2VsVGltZSA9ICtuZXcgRGF0ZTtcbiAgICBoaXN0Lmxhc3RTZWxPcmlnaW4gPSBvcmlnaW47XG4gICAgaGlzdC5sYXN0U2VsT3AgPSBvcElkO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuY2xlYXJSZWRvICE9PSBmYWxzZSlcbiAgICAgIGNsZWFyU2VsZWN0aW9uRXZlbnRzKGhpc3QudW5kb25lKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hTZWxlY3Rpb25Ub0hpc3Rvcnkoc2VsLCBkZXN0KSB7XG4gICAgdmFyIHRvcCA9IGxzdChkZXN0KTtcbiAgICBpZiAoISh0b3AgJiYgdG9wLnJhbmdlcyAmJiB0b3AuZXF1YWxzKHNlbCkpKVxuICAgICAgZGVzdC5wdXNoKHNlbCk7XG4gIH1cblxuICAvLyBVc2VkIHRvIHN0b3JlIG1hcmtlZCBzcGFuIGluZm9ybWF0aW9uIGluIHRoZSBoaXN0b3J5LlxuICBmdW5jdGlvbiBhdHRhY2hMb2NhbFNwYW5zKGRvYywgY2hhbmdlLCBmcm9tLCB0bykge1xuICAgIHZhciBleGlzdGluZyA9IGNoYW5nZVtcInNwYW5zX1wiICsgZG9jLmlkXSwgbiA9IDA7XG4gICAgZG9jLml0ZXIoTWF0aC5tYXgoZG9jLmZpcnN0LCBmcm9tKSwgTWF0aC5taW4oZG9jLmZpcnN0ICsgZG9jLnNpemUsIHRvKSwgZnVuY3Rpb24obGluZSkge1xuICAgICAgaWYgKGxpbmUubWFya2VkU3BhbnMpXG4gICAgICAgIChleGlzdGluZyB8fCAoZXhpc3RpbmcgPSBjaGFuZ2VbXCJzcGFuc19cIiArIGRvYy5pZF0gPSB7fSkpW25dID0gbGluZS5tYXJrZWRTcGFucztcbiAgICAgICsrbjtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFdoZW4gdW4vcmUtZG9pbmcgcmVzdG9yZXMgdGV4dCBjb250YWluaW5nIG1hcmtlZCBzcGFucywgdGhvc2VcbiAgLy8gdGhhdCBoYXZlIGJlZW4gZXhwbGljaXRseSBjbGVhcmVkIHNob3VsZCBub3QgYmUgcmVzdG9yZWQuXG4gIGZ1bmN0aW9uIHJlbW92ZUNsZWFyZWRTcGFucyhzcGFucykge1xuICAgIGlmICghc3BhbnMpIHJldHVybiBudWxsO1xuICAgIGZvciAodmFyIGkgPSAwLCBvdXQ7IGkgPCBzcGFucy5sZW5ndGg7ICsraSkge1xuICAgICAgaWYgKHNwYW5zW2ldLm1hcmtlci5leHBsaWNpdGx5Q2xlYXJlZCkgeyBpZiAoIW91dCkgb3V0ID0gc3BhbnMuc2xpY2UoMCwgaSk7IH1cbiAgICAgIGVsc2UgaWYgKG91dCkgb3V0LnB1c2goc3BhbnNbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gIW91dCA/IHNwYW5zIDogb3V0Lmxlbmd0aCA/IG91dCA6IG51bGw7XG4gIH1cblxuICAvLyBSZXRyaWV2ZSBhbmQgZmlsdGVyIHRoZSBvbGQgbWFya2VkIHNwYW5zIHN0b3JlZCBpbiBhIGNoYW5nZSBldmVudC5cbiAgZnVuY3Rpb24gZ2V0T2xkU3BhbnMoZG9jLCBjaGFuZ2UpIHtcbiAgICB2YXIgZm91bmQgPSBjaGFuZ2VbXCJzcGFuc19cIiArIGRvYy5pZF07XG4gICAgaWYgKCFmb3VuZCkgcmV0dXJuIG51bGw7XG4gICAgZm9yICh2YXIgaSA9IDAsIG53ID0gW107IGkgPCBjaGFuZ2UudGV4dC5sZW5ndGg7ICsraSlcbiAgICAgIG53LnB1c2gocmVtb3ZlQ2xlYXJlZFNwYW5zKGZvdW5kW2ldKSk7XG4gICAgcmV0dXJuIG53O1xuICB9XG5cbiAgLy8gVXNlZCBib3RoIHRvIHByb3ZpZGUgYSBKU09OLXNhZmUgb2JqZWN0IGluIC5nZXRIaXN0b3J5LCBhbmQsIHdoZW5cbiAgLy8gZGV0YWNoaW5nIGEgZG9jdW1lbnQsIHRvIHNwbGl0IHRoZSBoaXN0b3J5IGluIHR3b1xuICBmdW5jdGlvbiBjb3B5SGlzdG9yeUFycmF5KGV2ZW50cywgbmV3R3JvdXAsIGluc3RhbnRpYXRlU2VsKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGNvcHkgPSBbXTsgaSA8IGV2ZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGV2ZW50ID0gZXZlbnRzW2ldO1xuICAgICAgaWYgKGV2ZW50LnJhbmdlcykge1xuICAgICAgICBjb3B5LnB1c2goaW5zdGFudGlhdGVTZWwgPyBTZWxlY3Rpb24ucHJvdG90eXBlLmRlZXBDb3B5LmNhbGwoZXZlbnQpIDogZXZlbnQpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHZhciBjaGFuZ2VzID0gZXZlbnQuY2hhbmdlcywgbmV3Q2hhbmdlcyA9IFtdO1xuICAgICAgY29weS5wdXNoKHtjaGFuZ2VzOiBuZXdDaGFuZ2VzfSk7XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGNoYW5nZXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgdmFyIGNoYW5nZSA9IGNoYW5nZXNbal0sIG07XG4gICAgICAgIG5ld0NoYW5nZXMucHVzaCh7ZnJvbTogY2hhbmdlLmZyb20sIHRvOiBjaGFuZ2UudG8sIHRleHQ6IGNoYW5nZS50ZXh0fSk7XG4gICAgICAgIGlmIChuZXdHcm91cCkgZm9yICh2YXIgcHJvcCBpbiBjaGFuZ2UpIGlmIChtID0gcHJvcC5tYXRjaCgvXnNwYW5zXyhcXGQrKSQvKSkge1xuICAgICAgICAgIGlmIChpbmRleE9mKG5ld0dyb3VwLCBOdW1iZXIobVsxXSkpID4gLTEpIHtcbiAgICAgICAgICAgIGxzdChuZXdDaGFuZ2VzKVtwcm9wXSA9IGNoYW5nZVtwcm9wXTtcbiAgICAgICAgICAgIGRlbGV0ZSBjaGFuZ2VbcHJvcF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb3B5O1xuICB9XG5cbiAgLy8gUmViYXNpbmcvcmVzZXR0aW5nIGhpc3RvcnkgdG8gZGVhbCB3aXRoIGV4dGVybmFsbHktc291cmNlZCBjaGFuZ2VzXG5cbiAgZnVuY3Rpb24gcmViYXNlSGlzdFNlbFNpbmdsZShwb3MsIGZyb20sIHRvLCBkaWZmKSB7XG4gICAgaWYgKHRvIDwgcG9zLmxpbmUpIHtcbiAgICAgIHBvcy5saW5lICs9IGRpZmY7XG4gICAgfSBlbHNlIGlmIChmcm9tIDwgcG9zLmxpbmUpIHtcbiAgICAgIHBvcy5saW5lID0gZnJvbTtcbiAgICAgIHBvcy5jaCA9IDA7XG4gICAgfVxuICB9XG5cbiAgLy8gVHJpZXMgdG8gcmViYXNlIGFuIGFycmF5IG9mIGhpc3RvcnkgZXZlbnRzIGdpdmVuIGEgY2hhbmdlIGluIHRoZVxuICAvLyBkb2N1bWVudC4gSWYgdGhlIGNoYW5nZSB0b3VjaGVzIHRoZSBzYW1lIGxpbmVzIGFzIHRoZSBldmVudCwgdGhlXG4gIC8vIGV2ZW50LCBhbmQgZXZlcnl0aGluZyAnYmVoaW5kJyBpdCwgaXMgZGlzY2FyZGVkLiBJZiB0aGUgY2hhbmdlIGlzXG4gIC8vIGJlZm9yZSB0aGUgZXZlbnQsIHRoZSBldmVudCdzIHBvc2l0aW9ucyBhcmUgdXBkYXRlZC4gVXNlcyBhXG4gIC8vIGNvcHktb24td3JpdGUgc2NoZW1lIGZvciB0aGUgcG9zaXRpb25zLCB0byBhdm9pZCBoYXZpbmcgdG9cbiAgLy8gcmVhbGxvY2F0ZSB0aGVtIGFsbCBvbiBldmVyeSByZWJhc2UsIGJ1dCBhbHNvIGF2b2lkIHByb2JsZW1zIHdpdGhcbiAgLy8gc2hhcmVkIHBvc2l0aW9uIG9iamVjdHMgYmVpbmcgdW5zYWZlbHkgdXBkYXRlZC5cbiAgZnVuY3Rpb24gcmViYXNlSGlzdEFycmF5KGFycmF5LCBmcm9tLCB0bywgZGlmZikge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBzdWIgPSBhcnJheVtpXSwgb2sgPSB0cnVlO1xuICAgICAgaWYgKHN1Yi5yYW5nZXMpIHtcbiAgICAgICAgaWYgKCFzdWIuY29waWVkKSB7IHN1YiA9IGFycmF5W2ldID0gc3ViLmRlZXBDb3B5KCk7IHN1Yi5jb3BpZWQgPSB0cnVlOyB9XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgc3ViLnJhbmdlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHJlYmFzZUhpc3RTZWxTaW5nbGUoc3ViLnJhbmdlc1tqXS5hbmNob3IsIGZyb20sIHRvLCBkaWZmKTtcbiAgICAgICAgICByZWJhc2VIaXN0U2VsU2luZ2xlKHN1Yi5yYW5nZXNbal0uaGVhZCwgZnJvbSwgdG8sIGRpZmYpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBzdWIuY2hhbmdlcy5sZW5ndGg7ICsraikge1xuICAgICAgICB2YXIgY3VyID0gc3ViLmNoYW5nZXNbal07XG4gICAgICAgIGlmICh0byA8IGN1ci5mcm9tLmxpbmUpIHtcbiAgICAgICAgICBjdXIuZnJvbSA9IFBvcyhjdXIuZnJvbS5saW5lICsgZGlmZiwgY3VyLmZyb20uY2gpO1xuICAgICAgICAgIGN1ci50byA9IFBvcyhjdXIudG8ubGluZSArIGRpZmYsIGN1ci50by5jaCk7XG4gICAgICAgIH0gZWxzZSBpZiAoZnJvbSA8PSBjdXIudG8ubGluZSkge1xuICAgICAgICAgIG9rID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghb2spIHtcbiAgICAgICAgYXJyYXkuc3BsaWNlKDAsIGkgKyAxKTtcbiAgICAgICAgaSA9IDA7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmViYXNlSGlzdChoaXN0LCBjaGFuZ2UpIHtcbiAgICB2YXIgZnJvbSA9IGNoYW5nZS5mcm9tLmxpbmUsIHRvID0gY2hhbmdlLnRvLmxpbmUsIGRpZmYgPSBjaGFuZ2UudGV4dC5sZW5ndGggLSAodG8gLSBmcm9tKSAtIDE7XG4gICAgcmViYXNlSGlzdEFycmF5KGhpc3QuZG9uZSwgZnJvbSwgdG8sIGRpZmYpO1xuICAgIHJlYmFzZUhpc3RBcnJheShoaXN0LnVuZG9uZSwgZnJvbSwgdG8sIGRpZmYpO1xuICB9XG5cbiAgLy8gRVZFTlQgVVRJTElUSUVTXG5cbiAgLy8gRHVlIHRvIHRoZSBmYWN0IHRoYXQgd2Ugc3RpbGwgc3VwcG9ydCBqdXJhc3NpYyBJRSB2ZXJzaW9ucywgc29tZVxuICAvLyBjb21wYXRpYmlsaXR5IHdyYXBwZXJzIGFyZSBuZWVkZWQuXG5cbiAgdmFyIGVfcHJldmVudERlZmF1bHQgPSBDb2RlTWlycm9yLmVfcHJldmVudERlZmF1bHQgPSBmdW5jdGlvbihlKSB7XG4gICAgaWYgKGUucHJldmVudERlZmF1bHQpIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlbHNlIGUucmV0dXJuVmFsdWUgPSBmYWxzZTtcbiAgfTtcbiAgdmFyIGVfc3RvcFByb3BhZ2F0aW9uID0gQ29kZU1pcnJvci5lX3N0b3BQcm9wYWdhdGlvbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICBpZiAoZS5zdG9wUHJvcGFnYXRpb24pIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZWxzZSBlLmNhbmNlbEJ1YmJsZSA9IHRydWU7XG4gIH07XG4gIGZ1bmN0aW9uIGVfZGVmYXVsdFByZXZlbnRlZChlKSB7XG4gICAgcmV0dXJuIGUuZGVmYXVsdFByZXZlbnRlZCAhPSBudWxsID8gZS5kZWZhdWx0UHJldmVudGVkIDogZS5yZXR1cm5WYWx1ZSA9PSBmYWxzZTtcbiAgfVxuICB2YXIgZV9zdG9wID0gQ29kZU1pcnJvci5lX3N0b3AgPSBmdW5jdGlvbihlKSB7ZV9wcmV2ZW50RGVmYXVsdChlKTsgZV9zdG9wUHJvcGFnYXRpb24oZSk7fTtcblxuICBmdW5jdGlvbiBlX3RhcmdldChlKSB7cmV0dXJuIGUudGFyZ2V0IHx8IGUuc3JjRWxlbWVudDt9XG4gIGZ1bmN0aW9uIGVfYnV0dG9uKGUpIHtcbiAgICB2YXIgYiA9IGUud2hpY2g7XG4gICAgaWYgKGIgPT0gbnVsbCkge1xuICAgICAgaWYgKGUuYnV0dG9uICYgMSkgYiA9IDE7XG4gICAgICBlbHNlIGlmIChlLmJ1dHRvbiAmIDIpIGIgPSAzO1xuICAgICAgZWxzZSBpZiAoZS5idXR0b24gJiA0KSBiID0gMjtcbiAgICB9XG4gICAgaWYgKG1hYyAmJiBlLmN0cmxLZXkgJiYgYiA9PSAxKSBiID0gMztcbiAgICByZXR1cm4gYjtcbiAgfVxuXG4gIC8vIEVWRU5UIEhBTkRMSU5HXG5cbiAgLy8gTGlnaHR3ZWlnaHQgZXZlbnQgZnJhbWV3b3JrLiBvbi9vZmYgYWxzbyB3b3JrIG9uIERPTSBub2RlcyxcbiAgLy8gcmVnaXN0ZXJpbmcgbmF0aXZlIERPTSBoYW5kbGVycy5cblxuICB2YXIgb24gPSBDb2RlTWlycm9yLm9uID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSwgZikge1xuICAgIGlmIChlbWl0dGVyLmFkZEV2ZW50TGlzdGVuZXIpXG4gICAgICBlbWl0dGVyLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZiwgZmFsc2UpO1xuICAgIGVsc2UgaWYgKGVtaXR0ZXIuYXR0YWNoRXZlbnQpXG4gICAgICBlbWl0dGVyLmF0dGFjaEV2ZW50KFwib25cIiArIHR5cGUsIGYpO1xuICAgIGVsc2Uge1xuICAgICAgdmFyIG1hcCA9IGVtaXR0ZXIuX2hhbmRsZXJzIHx8IChlbWl0dGVyLl9oYW5kbGVycyA9IHt9KTtcbiAgICAgIHZhciBhcnIgPSBtYXBbdHlwZV0gfHwgKG1hcFt0eXBlXSA9IFtdKTtcbiAgICAgIGFyci5wdXNoKGYpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgbm9IYW5kbGVycyA9IFtdXG4gIGZ1bmN0aW9uIGdldEhhbmRsZXJzKGVtaXR0ZXIsIHR5cGUsIGNvcHkpIHtcbiAgICB2YXIgYXJyID0gZW1pdHRlci5faGFuZGxlcnMgJiYgZW1pdHRlci5faGFuZGxlcnNbdHlwZV1cbiAgICBpZiAoY29weSkgcmV0dXJuIGFyciAmJiBhcnIubGVuZ3RoID4gMCA/IGFyci5zbGljZSgpIDogbm9IYW5kbGVyc1xuICAgIGVsc2UgcmV0dXJuIGFyciB8fCBub0hhbmRsZXJzXG4gIH1cblxuICB2YXIgb2ZmID0gQ29kZU1pcnJvci5vZmYgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlLCBmKSB7XG4gICAgaWYgKGVtaXR0ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcilcbiAgICAgIGVtaXR0ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBmLCBmYWxzZSk7XG4gICAgZWxzZSBpZiAoZW1pdHRlci5kZXRhY2hFdmVudClcbiAgICAgIGVtaXR0ZXIuZGV0YWNoRXZlbnQoXCJvblwiICsgdHlwZSwgZik7XG4gICAgZWxzZSB7XG4gICAgICB2YXIgaGFuZGxlcnMgPSBnZXRIYW5kbGVycyhlbWl0dGVyLCB0eXBlLCBmYWxzZSlcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaGFuZGxlcnMubGVuZ3RoOyArK2kpXG4gICAgICAgIGlmIChoYW5kbGVyc1tpXSA9PSBmKSB7IGhhbmRsZXJzLnNwbGljZShpLCAxKTsgYnJlYWs7IH1cbiAgICB9XG4gIH07XG5cbiAgdmFyIHNpZ25hbCA9IENvZGVNaXJyb3Iuc2lnbmFsID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSAvKiwgdmFsdWVzLi4uKi8pIHtcbiAgICB2YXIgaGFuZGxlcnMgPSBnZXRIYW5kbGVycyhlbWl0dGVyLCB0eXBlLCB0cnVlKVxuICAgIGlmICghaGFuZGxlcnMubGVuZ3RoKSByZXR1cm47XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaGFuZGxlcnMubGVuZ3RoOyArK2kpIGhhbmRsZXJzW2ldLmFwcGx5KG51bGwsIGFyZ3MpO1xuICB9O1xuXG4gIHZhciBvcnBoYW5EZWxheWVkQ2FsbGJhY2tzID0gbnVsbDtcblxuICAvLyBPZnRlbiwgd2Ugd2FudCB0byBzaWduYWwgZXZlbnRzIGF0IGEgcG9pbnQgd2hlcmUgd2UgYXJlIGluIHRoZVxuICAvLyBtaWRkbGUgb2Ygc29tZSB3b3JrLCBidXQgZG9uJ3Qgd2FudCB0aGUgaGFuZGxlciB0byBzdGFydCBjYWxsaW5nXG4gIC8vIG90aGVyIG1ldGhvZHMgb24gdGhlIGVkaXRvciwgd2hpY2ggbWlnaHQgYmUgaW4gYW4gaW5jb25zaXN0ZW50XG4gIC8vIHN0YXRlIG9yIHNpbXBseSBub3QgZXhwZWN0IGFueSBvdGhlciBldmVudHMgdG8gaGFwcGVuLlxuICAvLyBzaWduYWxMYXRlciBsb29rcyB3aGV0aGVyIHRoZXJlIGFyZSBhbnkgaGFuZGxlcnMsIGFuZCBzY2hlZHVsZXNcbiAgLy8gdGhlbSB0byBiZSBleGVjdXRlZCB3aGVuIHRoZSBsYXN0IG9wZXJhdGlvbiBlbmRzLCBvciwgaWYgbm9cbiAgLy8gb3BlcmF0aW9uIGlzIGFjdGl2ZSwgd2hlbiBhIHRpbWVvdXQgZmlyZXMuXG4gIGZ1bmN0aW9uIHNpZ25hbExhdGVyKGVtaXR0ZXIsIHR5cGUgLyosIHZhbHVlcy4uLiovKSB7XG4gICAgdmFyIGFyciA9IGdldEhhbmRsZXJzKGVtaXR0ZXIsIHR5cGUsIGZhbHNlKVxuICAgIGlmICghYXJyLmxlbmd0aCkgcmV0dXJuO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSwgbGlzdDtcbiAgICBpZiAob3BlcmF0aW9uR3JvdXApIHtcbiAgICAgIGxpc3QgPSBvcGVyYXRpb25Hcm91cC5kZWxheWVkQ2FsbGJhY2tzO1xuICAgIH0gZWxzZSBpZiAob3JwaGFuRGVsYXllZENhbGxiYWNrcykge1xuICAgICAgbGlzdCA9IG9ycGhhbkRlbGF5ZWRDYWxsYmFja3M7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3QgPSBvcnBoYW5EZWxheWVkQ2FsbGJhY2tzID0gW107XG4gICAgICBzZXRUaW1lb3V0KGZpcmVPcnBoYW5EZWxheWVkLCAwKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gYm5kKGYpIHtyZXR1cm4gZnVuY3Rpb24oKXtmLmFwcGx5KG51bGwsIGFyZ3MpO307fTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7ICsraSlcbiAgICAgIGxpc3QucHVzaChibmQoYXJyW2ldKSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaXJlT3JwaGFuRGVsYXllZCgpIHtcbiAgICB2YXIgZGVsYXllZCA9IG9ycGhhbkRlbGF5ZWRDYWxsYmFja3M7XG4gICAgb3JwaGFuRGVsYXllZENhbGxiYWNrcyA9IG51bGw7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZWxheWVkLmxlbmd0aDsgKytpKSBkZWxheWVkW2ldKCk7XG4gIH1cblxuICAvLyBUaGUgRE9NIGV2ZW50cyB0aGF0IENvZGVNaXJyb3IgaGFuZGxlcyBjYW4gYmUgb3ZlcnJpZGRlbiBieVxuICAvLyByZWdpc3RlcmluZyBhIChub24tRE9NKSBoYW5kbGVyIG9uIHRoZSBlZGl0b3IgZm9yIHRoZSBldmVudCBuYW1lLFxuICAvLyBhbmQgcHJldmVudERlZmF1bHQtaW5nIHRoZSBldmVudCBpbiB0aGF0IGhhbmRsZXIuXG4gIGZ1bmN0aW9uIHNpZ25hbERPTUV2ZW50KGNtLCBlLCBvdmVycmlkZSkge1xuICAgIGlmICh0eXBlb2YgZSA9PSBcInN0cmluZ1wiKVxuICAgICAgZSA9IHt0eXBlOiBlLCBwcmV2ZW50RGVmYXVsdDogZnVuY3Rpb24oKSB7IHRoaXMuZGVmYXVsdFByZXZlbnRlZCA9IHRydWU7IH19O1xuICAgIHNpZ25hbChjbSwgb3ZlcnJpZGUgfHwgZS50eXBlLCBjbSwgZSk7XG4gICAgcmV0dXJuIGVfZGVmYXVsdFByZXZlbnRlZChlKSB8fCBlLmNvZGVtaXJyb3JJZ25vcmU7XG4gIH1cblxuICBmdW5jdGlvbiBzaWduYWxDdXJzb3JBY3Rpdml0eShjbSkge1xuICAgIHZhciBhcnIgPSBjbS5faGFuZGxlcnMgJiYgY20uX2hhbmRsZXJzLmN1cnNvckFjdGl2aXR5O1xuICAgIGlmICghYXJyKSByZXR1cm47XG4gICAgdmFyIHNldCA9IGNtLmN1ck9wLmN1cnNvckFjdGl2aXR5SGFuZGxlcnMgfHwgKGNtLmN1ck9wLmN1cnNvckFjdGl2aXR5SGFuZGxlcnMgPSBbXSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyArK2kpIGlmIChpbmRleE9mKHNldCwgYXJyW2ldKSA9PSAtMSlcbiAgICAgIHNldC5wdXNoKGFycltpXSk7XG4gIH1cblxuICBmdW5jdGlvbiBoYXNIYW5kbGVyKGVtaXR0ZXIsIHR5cGUpIHtcbiAgICByZXR1cm4gZ2V0SGFuZGxlcnMoZW1pdHRlciwgdHlwZSkubGVuZ3RoID4gMFxuICB9XG5cbiAgLy8gQWRkIG9uIGFuZCBvZmYgbWV0aG9kcyB0byBhIGNvbnN0cnVjdG9yJ3MgcHJvdG90eXBlLCB0byBtYWtlXG4gIC8vIHJlZ2lzdGVyaW5nIGV2ZW50cyBvbiBzdWNoIG9iamVjdHMgbW9yZSBjb252ZW5pZW50LlxuICBmdW5jdGlvbiBldmVudE1peGluKGN0b3IpIHtcbiAgICBjdG9yLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKHR5cGUsIGYpIHtvbih0aGlzLCB0eXBlLCBmKTt9O1xuICAgIGN0b3IucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKHR5cGUsIGYpIHtvZmYodGhpcywgdHlwZSwgZik7fTtcbiAgfVxuXG4gIC8vIE1JU0MgVVRJTElUSUVTXG5cbiAgLy8gTnVtYmVyIG9mIHBpeGVscyBhZGRlZCB0byBzY3JvbGxlciBhbmQgc2l6ZXIgdG8gaGlkZSBzY3JvbGxiYXJcbiAgdmFyIHNjcm9sbGVyR2FwID0gMzA7XG5cbiAgLy8gUmV0dXJuZWQgb3IgdGhyb3duIGJ5IHZhcmlvdXMgcHJvdG9jb2xzIHRvIHNpZ25hbCAnSSdtIG5vdFxuICAvLyBoYW5kbGluZyB0aGlzJy5cbiAgdmFyIFBhc3MgPSBDb2RlTWlycm9yLlBhc3MgPSB7dG9TdHJpbmc6IGZ1bmN0aW9uKCl7cmV0dXJuIFwiQ29kZU1pcnJvci5QYXNzXCI7fX07XG5cbiAgLy8gUmV1c2VkIG9wdGlvbiBvYmplY3RzIGZvciBzZXRTZWxlY3Rpb24gJiBmcmllbmRzXG4gIHZhciBzZWxfZG9udFNjcm9sbCA9IHtzY3JvbGw6IGZhbHNlfSwgc2VsX21vdXNlID0ge29yaWdpbjogXCIqbW91c2VcIn0sIHNlbF9tb3ZlID0ge29yaWdpbjogXCIrbW92ZVwifTtcblxuICBmdW5jdGlvbiBEZWxheWVkKCkge3RoaXMuaWQgPSBudWxsO31cbiAgRGVsYXllZC5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24obXMsIGYpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5pZCk7XG4gICAgdGhpcy5pZCA9IHNldFRpbWVvdXQoZiwgbXMpO1xuICB9O1xuXG4gIC8vIENvdW50cyB0aGUgY29sdW1uIG9mZnNldCBpbiBhIHN0cmluZywgdGFraW5nIHRhYnMgaW50byBhY2NvdW50LlxuICAvLyBVc2VkIG1vc3RseSB0byBmaW5kIGluZGVudGF0aW9uLlxuICB2YXIgY291bnRDb2x1bW4gPSBDb2RlTWlycm9yLmNvdW50Q29sdW1uID0gZnVuY3Rpb24oc3RyaW5nLCBlbmQsIHRhYlNpemUsIHN0YXJ0SW5kZXgsIHN0YXJ0VmFsdWUpIHtcbiAgICBpZiAoZW5kID09IG51bGwpIHtcbiAgICAgIGVuZCA9IHN0cmluZy5zZWFyY2goL1teXFxzXFx1MDBhMF0vKTtcbiAgICAgIGlmIChlbmQgPT0gLTEpIGVuZCA9IHN0cmluZy5sZW5ndGg7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSBzdGFydEluZGV4IHx8IDAsIG4gPSBzdGFydFZhbHVlIHx8IDA7Oykge1xuICAgICAgdmFyIG5leHRUYWIgPSBzdHJpbmcuaW5kZXhPZihcIlxcdFwiLCBpKTtcbiAgICAgIGlmIChuZXh0VGFiIDwgMCB8fCBuZXh0VGFiID49IGVuZClcbiAgICAgICAgcmV0dXJuIG4gKyAoZW5kIC0gaSk7XG4gICAgICBuICs9IG5leHRUYWIgLSBpO1xuICAgICAgbiArPSB0YWJTaXplIC0gKG4gJSB0YWJTaXplKTtcbiAgICAgIGkgPSBuZXh0VGFiICsgMTtcbiAgICB9XG4gIH07XG5cbiAgLy8gVGhlIGludmVyc2Ugb2YgY291bnRDb2x1bW4gLS0gZmluZCB0aGUgb2Zmc2V0IHRoYXQgY29ycmVzcG9uZHMgdG9cbiAgLy8gYSBwYXJ0aWN1bGFyIGNvbHVtbi5cbiAgdmFyIGZpbmRDb2x1bW4gPSBDb2RlTWlycm9yLmZpbmRDb2x1bW4gPSBmdW5jdGlvbihzdHJpbmcsIGdvYWwsIHRhYlNpemUpIHtcbiAgICBmb3IgKHZhciBwb3MgPSAwLCBjb2wgPSAwOzspIHtcbiAgICAgIHZhciBuZXh0VGFiID0gc3RyaW5nLmluZGV4T2YoXCJcXHRcIiwgcG9zKTtcbiAgICAgIGlmIChuZXh0VGFiID09IC0xKSBuZXh0VGFiID0gc3RyaW5nLmxlbmd0aDtcbiAgICAgIHZhciBza2lwcGVkID0gbmV4dFRhYiAtIHBvcztcbiAgICAgIGlmIChuZXh0VGFiID09IHN0cmluZy5sZW5ndGggfHwgY29sICsgc2tpcHBlZCA+PSBnb2FsKVxuICAgICAgICByZXR1cm4gcG9zICsgTWF0aC5taW4oc2tpcHBlZCwgZ29hbCAtIGNvbCk7XG4gICAgICBjb2wgKz0gbmV4dFRhYiAtIHBvcztcbiAgICAgIGNvbCArPSB0YWJTaXplIC0gKGNvbCAlIHRhYlNpemUpO1xuICAgICAgcG9zID0gbmV4dFRhYiArIDE7XG4gICAgICBpZiAoY29sID49IGdvYWwpIHJldHVybiBwb3M7XG4gICAgfVxuICB9XG5cbiAgdmFyIHNwYWNlU3RycyA9IFtcIlwiXTtcbiAgZnVuY3Rpb24gc3BhY2VTdHIobikge1xuICAgIHdoaWxlIChzcGFjZVN0cnMubGVuZ3RoIDw9IG4pXG4gICAgICBzcGFjZVN0cnMucHVzaChsc3Qoc3BhY2VTdHJzKSArIFwiIFwiKTtcbiAgICByZXR1cm4gc3BhY2VTdHJzW25dO1xuICB9XG5cbiAgZnVuY3Rpb24gbHN0KGFycikgeyByZXR1cm4gYXJyW2Fyci5sZW5ndGgtMV07IH1cblxuICB2YXIgc2VsZWN0SW5wdXQgPSBmdW5jdGlvbihub2RlKSB7IG5vZGUuc2VsZWN0KCk7IH07XG4gIGlmIChpb3MpIC8vIE1vYmlsZSBTYWZhcmkgYXBwYXJlbnRseSBoYXMgYSBidWcgd2hlcmUgc2VsZWN0KCkgaXMgYnJva2VuLlxuICAgIHNlbGVjdElucHV0ID0gZnVuY3Rpb24obm9kZSkgeyBub2RlLnNlbGVjdGlvblN0YXJ0ID0gMDsgbm9kZS5zZWxlY3Rpb25FbmQgPSBub2RlLnZhbHVlLmxlbmd0aDsgfTtcbiAgZWxzZSBpZiAoaWUpIC8vIFN1cHByZXNzIG15c3RlcmlvdXMgSUUxMCBlcnJvcnNcbiAgICBzZWxlY3RJbnB1dCA9IGZ1bmN0aW9uKG5vZGUpIHsgdHJ5IHsgbm9kZS5zZWxlY3QoKTsgfSBjYXRjaChfZSkge30gfTtcblxuICBmdW5jdGlvbiBpbmRleE9mKGFycmF5LCBlbHQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgKytpKVxuICAgICAgaWYgKGFycmF5W2ldID09IGVsdCkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xuICB9XG4gIGZ1bmN0aW9uIG1hcChhcnJheSwgZikge1xuICAgIHZhciBvdXQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSBvdXRbaV0gPSBmKGFycmF5W2ldLCBpKTtcbiAgICByZXR1cm4gb3V0O1xuICB9XG5cbiAgZnVuY3Rpb24gbm90aGluZygpIHt9XG5cbiAgZnVuY3Rpb24gY3JlYXRlT2JqKGJhc2UsIHByb3BzKSB7XG4gICAgdmFyIGluc3Q7XG4gICAgaWYgKE9iamVjdC5jcmVhdGUpIHtcbiAgICAgIGluc3QgPSBPYmplY3QuY3JlYXRlKGJhc2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBub3RoaW5nLnByb3RvdHlwZSA9IGJhc2U7XG4gICAgICBpbnN0ID0gbmV3IG5vdGhpbmcoKTtcbiAgICB9XG4gICAgaWYgKHByb3BzKSBjb3B5T2JqKHByb3BzLCBpbnN0KTtcbiAgICByZXR1cm4gaW5zdDtcbiAgfTtcblxuICBmdW5jdGlvbiBjb3B5T2JqKG9iaiwgdGFyZ2V0LCBvdmVyd3JpdGUpIHtcbiAgICBpZiAoIXRhcmdldCkgdGFyZ2V0ID0ge307XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmopXG4gICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3ApICYmIChvdmVyd3JpdGUgIT09IGZhbHNlIHx8ICF0YXJnZXQuaGFzT3duUHJvcGVydHkocHJvcCkpKVxuICAgICAgICB0YXJnZXRbcHJvcF0gPSBvYmpbcHJvcF07XG4gICAgcmV0dXJuIHRhcmdldDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmQoZikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKXtyZXR1cm4gZi5hcHBseShudWxsLCBhcmdzKTt9O1xuICB9XG5cbiAgdmFyIG5vbkFTQ0lJU2luZ2xlQ2FzZVdvcmRDaGFyID0gL1tcXHUwMGRmXFx1MDU4N1xcdTA1OTAtXFx1MDVmNFxcdTA2MDAtXFx1MDZmZlxcdTMwNDAtXFx1MzA5ZlxcdTMwYTAtXFx1MzBmZlxcdTM0MDAtXFx1NGRiNVxcdTRlMDAtXFx1OWZjY1xcdWFjMDAtXFx1ZDdhZl0vO1xuICB2YXIgaXNXb3JkQ2hhckJhc2ljID0gQ29kZU1pcnJvci5pc1dvcmRDaGFyID0gZnVuY3Rpb24oY2gpIHtcbiAgICByZXR1cm4gL1xcdy8udGVzdChjaCkgfHwgY2ggPiBcIlxceDgwXCIgJiZcbiAgICAgIChjaC50b1VwcGVyQ2FzZSgpICE9IGNoLnRvTG93ZXJDYXNlKCkgfHwgbm9uQVNDSUlTaW5nbGVDYXNlV29yZENoYXIudGVzdChjaCkpO1xuICB9O1xuICBmdW5jdGlvbiBpc1dvcmRDaGFyKGNoLCBoZWxwZXIpIHtcbiAgICBpZiAoIWhlbHBlcikgcmV0dXJuIGlzV29yZENoYXJCYXNpYyhjaCk7XG4gICAgaWYgKGhlbHBlci5zb3VyY2UuaW5kZXhPZihcIlxcXFx3XCIpID4gLTEgJiYgaXNXb3JkQ2hhckJhc2ljKGNoKSkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIGhlbHBlci50ZXN0KGNoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzRW1wdHkob2JqKSB7XG4gICAgZm9yICh2YXIgbiBpbiBvYmopIGlmIChvYmouaGFzT3duUHJvcGVydHkobikgJiYgb2JqW25dKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBFeHRlbmRpbmcgdW5pY29kZSBjaGFyYWN0ZXJzLiBBIHNlcmllcyBvZiBhIG5vbi1leHRlbmRpbmcgY2hhciArXG4gIC8vIGFueSBudW1iZXIgb2YgZXh0ZW5kaW5nIGNoYXJzIGlzIHRyZWF0ZWQgYXMgYSBzaW5nbGUgdW5pdCBhcyBmYXJcbiAgLy8gYXMgZWRpdGluZyBhbmQgbWVhc3VyaW5nIGlzIGNvbmNlcm5lZC4gVGhpcyBpcyBub3QgZnVsbHkgY29ycmVjdCxcbiAgLy8gc2luY2Ugc29tZSBzY3JpcHRzL2ZvbnRzL2Jyb3dzZXJzIGFsc28gdHJlYXQgb3RoZXIgY29uZmlndXJhdGlvbnNcbiAgLy8gb2YgY29kZSBwb2ludHMgYXMgYSBncm91cC5cbiAgdmFyIGV4dGVuZGluZ0NoYXJzID0gL1tcXHUwMzAwLVxcdTAzNmZcXHUwNDgzLVxcdTA0ODlcXHUwNTkxLVxcdTA1YmRcXHUwNWJmXFx1MDVjMVxcdTA1YzJcXHUwNWM0XFx1MDVjNVxcdTA1YzdcXHUwNjEwLVxcdTA2MWFcXHUwNjRiLVxcdTA2NWVcXHUwNjcwXFx1MDZkNi1cXHUwNmRjXFx1MDZkZS1cXHUwNmU0XFx1MDZlN1xcdTA2ZThcXHUwNmVhLVxcdTA2ZWRcXHUwNzExXFx1MDczMC1cXHUwNzRhXFx1MDdhNi1cXHUwN2IwXFx1MDdlYi1cXHUwN2YzXFx1MDgxNi1cXHUwODE5XFx1MDgxYi1cXHUwODIzXFx1MDgyNS1cXHUwODI3XFx1MDgyOS1cXHUwODJkXFx1MDkwMC1cXHUwOTAyXFx1MDkzY1xcdTA5NDEtXFx1MDk0OFxcdTA5NGRcXHUwOTUxLVxcdTA5NTVcXHUwOTYyXFx1MDk2M1xcdTA5ODFcXHUwOWJjXFx1MDliZVxcdTA5YzEtXFx1MDljNFxcdTA5Y2RcXHUwOWQ3XFx1MDllMlxcdTA5ZTNcXHUwYTAxXFx1MGEwMlxcdTBhM2NcXHUwYTQxXFx1MGE0MlxcdTBhNDdcXHUwYTQ4XFx1MGE0Yi1cXHUwYTRkXFx1MGE1MVxcdTBhNzBcXHUwYTcxXFx1MGE3NVxcdTBhODFcXHUwYTgyXFx1MGFiY1xcdTBhYzEtXFx1MGFjNVxcdTBhYzdcXHUwYWM4XFx1MGFjZFxcdTBhZTJcXHUwYWUzXFx1MGIwMVxcdTBiM2NcXHUwYjNlXFx1MGIzZlxcdTBiNDEtXFx1MGI0NFxcdTBiNGRcXHUwYjU2XFx1MGI1N1xcdTBiNjJcXHUwYjYzXFx1MGI4MlxcdTBiYmVcXHUwYmMwXFx1MGJjZFxcdTBiZDdcXHUwYzNlLVxcdTBjNDBcXHUwYzQ2LVxcdTBjNDhcXHUwYzRhLVxcdTBjNGRcXHUwYzU1XFx1MGM1NlxcdTBjNjJcXHUwYzYzXFx1MGNiY1xcdTBjYmZcXHUwY2MyXFx1MGNjNlxcdTBjY2NcXHUwY2NkXFx1MGNkNVxcdTBjZDZcXHUwY2UyXFx1MGNlM1xcdTBkM2VcXHUwZDQxLVxcdTBkNDRcXHUwZDRkXFx1MGQ1N1xcdTBkNjJcXHUwZDYzXFx1MGRjYVxcdTBkY2ZcXHUwZGQyLVxcdTBkZDRcXHUwZGQ2XFx1MGRkZlxcdTBlMzFcXHUwZTM0LVxcdTBlM2FcXHUwZTQ3LVxcdTBlNGVcXHUwZWIxXFx1MGViNC1cXHUwZWI5XFx1MGViYlxcdTBlYmNcXHUwZWM4LVxcdTBlY2RcXHUwZjE4XFx1MGYxOVxcdTBmMzVcXHUwZjM3XFx1MGYzOVxcdTBmNzEtXFx1MGY3ZVxcdTBmODAtXFx1MGY4NFxcdTBmODZcXHUwZjg3XFx1MGY5MC1cXHUwZjk3XFx1MGY5OS1cXHUwZmJjXFx1MGZjNlxcdTEwMmQtXFx1MTAzMFxcdTEwMzItXFx1MTAzN1xcdTEwMzlcXHUxMDNhXFx1MTAzZFxcdTEwM2VcXHUxMDU4XFx1MTA1OVxcdTEwNWUtXFx1MTA2MFxcdTEwNzEtXFx1MTA3NFxcdTEwODJcXHUxMDg1XFx1MTA4NlxcdTEwOGRcXHUxMDlkXFx1MTM1ZlxcdTE3MTItXFx1MTcxNFxcdTE3MzItXFx1MTczNFxcdTE3NTJcXHUxNzUzXFx1MTc3MlxcdTE3NzNcXHUxN2I3LVxcdTE3YmRcXHUxN2M2XFx1MTdjOS1cXHUxN2QzXFx1MTdkZFxcdTE4MGItXFx1MTgwZFxcdTE4YTlcXHUxOTIwLVxcdTE5MjJcXHUxOTI3XFx1MTkyOFxcdTE5MzJcXHUxOTM5LVxcdTE5M2JcXHUxYTE3XFx1MWExOFxcdTFhNTZcXHUxYTU4LVxcdTFhNWVcXHUxYTYwXFx1MWE2MlxcdTFhNjUtXFx1MWE2Y1xcdTFhNzMtXFx1MWE3Y1xcdTFhN2ZcXHUxYjAwLVxcdTFiMDNcXHUxYjM0XFx1MWIzNi1cXHUxYjNhXFx1MWIzY1xcdTFiNDJcXHUxYjZiLVxcdTFiNzNcXHUxYjgwXFx1MWI4MVxcdTFiYTItXFx1MWJhNVxcdTFiYThcXHUxYmE5XFx1MWMyYy1cXHUxYzMzXFx1MWMzNlxcdTFjMzdcXHUxY2QwLVxcdTFjZDJcXHUxY2Q0LVxcdTFjZTBcXHUxY2UyLVxcdTFjZThcXHUxY2VkXFx1MWRjMC1cXHUxZGU2XFx1MWRmZC1cXHUxZGZmXFx1MjAwY1xcdTIwMGRcXHUyMGQwLVxcdTIwZjBcXHUyY2VmLVxcdTJjZjFcXHUyZGUwLVxcdTJkZmZcXHUzMDJhLVxcdTMwMmZcXHUzMDk5XFx1MzA5YVxcdWE2NmYtXFx1YTY3MlxcdWE2N2NcXHVhNjdkXFx1YTZmMFxcdWE2ZjFcXHVhODAyXFx1YTgwNlxcdWE4MGJcXHVhODI1XFx1YTgyNlxcdWE4YzRcXHVhOGUwLVxcdWE4ZjFcXHVhOTI2LVxcdWE5MmRcXHVhOTQ3LVxcdWE5NTFcXHVhOTgwLVxcdWE5ODJcXHVhOWIzXFx1YTliNi1cXHVhOWI5XFx1YTliY1xcdWFhMjktXFx1YWEyZVxcdWFhMzFcXHVhYTMyXFx1YWEzNVxcdWFhMzZcXHVhYTQzXFx1YWE0Y1xcdWFhYjBcXHVhYWIyLVxcdWFhYjRcXHVhYWI3XFx1YWFiOFxcdWFhYmVcXHVhYWJmXFx1YWFjMVxcdWFiZTVcXHVhYmU4XFx1YWJlZFxcdWRjMDAtXFx1ZGZmZlxcdWZiMWVcXHVmZTAwLVxcdWZlMGZcXHVmZTIwLVxcdWZlMjZcXHVmZjllXFx1ZmY5Zl0vO1xuICBmdW5jdGlvbiBpc0V4dGVuZGluZ0NoYXIoY2gpIHsgcmV0dXJuIGNoLmNoYXJDb2RlQXQoMCkgPj0gNzY4ICYmIGV4dGVuZGluZ0NoYXJzLnRlc3QoY2gpOyB9XG5cbiAgLy8gRE9NIFVUSUxJVElFU1xuXG4gIGZ1bmN0aW9uIGVsdCh0YWcsIGNvbnRlbnQsIGNsYXNzTmFtZSwgc3R5bGUpIHtcbiAgICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKTtcbiAgICBpZiAoY2xhc3NOYW1lKSBlLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbiAgICBpZiAoc3R5bGUpIGUuc3R5bGUuY3NzVGV4dCA9IHN0eWxlO1xuICAgIGlmICh0eXBlb2YgY29udGVudCA9PSBcInN0cmluZ1wiKSBlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNvbnRlbnQpKTtcbiAgICBlbHNlIGlmIChjb250ZW50KSBmb3IgKHZhciBpID0gMDsgaSA8IGNvbnRlbnQubGVuZ3RoOyArK2kpIGUuYXBwZW5kQ2hpbGQoY29udGVudFtpXSk7XG4gICAgcmV0dXJuIGU7XG4gIH1cblxuICB2YXIgcmFuZ2U7XG4gIGlmIChkb2N1bWVudC5jcmVhdGVSYW5nZSkgcmFuZ2UgPSBmdW5jdGlvbihub2RlLCBzdGFydCwgZW5kLCBlbmROb2RlKSB7XG4gICAgdmFyIHIgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpO1xuICAgIHIuc2V0RW5kKGVuZE5vZGUgfHwgbm9kZSwgZW5kKTtcbiAgICByLnNldFN0YXJ0KG5vZGUsIHN0YXJ0KTtcbiAgICByZXR1cm4gcjtcbiAgfTtcbiAgZWxzZSByYW5nZSA9IGZ1bmN0aW9uKG5vZGUsIHN0YXJ0LCBlbmQpIHtcbiAgICB2YXIgciA9IGRvY3VtZW50LmJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gICAgdHJ5IHsgci5tb3ZlVG9FbGVtZW50VGV4dChub2RlLnBhcmVudE5vZGUpOyB9XG4gICAgY2F0Y2goZSkgeyByZXR1cm4gcjsgfVxuICAgIHIuY29sbGFwc2UodHJ1ZSk7XG4gICAgci5tb3ZlRW5kKFwiY2hhcmFjdGVyXCIsIGVuZCk7XG4gICAgci5tb3ZlU3RhcnQoXCJjaGFyYWN0ZXJcIiwgc3RhcnQpO1xuICAgIHJldHVybiByO1xuICB9O1xuXG4gIGZ1bmN0aW9uIHJlbW92ZUNoaWxkcmVuKGUpIHtcbiAgICBmb3IgKHZhciBjb3VudCA9IGUuY2hpbGROb2Rlcy5sZW5ndGg7IGNvdW50ID4gMDsgLS1jb3VudClcbiAgICAgIGUucmVtb3ZlQ2hpbGQoZS5maXJzdENoaWxkKTtcbiAgICByZXR1cm4gZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUNoaWxkcmVuQW5kQWRkKHBhcmVudCwgZSkge1xuICAgIHJldHVybiByZW1vdmVDaGlsZHJlbihwYXJlbnQpLmFwcGVuZENoaWxkKGUpO1xuICB9XG5cbiAgdmFyIGNvbnRhaW5zID0gQ29kZU1pcnJvci5jb250YWlucyA9IGZ1bmN0aW9uKHBhcmVudCwgY2hpbGQpIHtcbiAgICBpZiAoY2hpbGQubm9kZVR5cGUgPT0gMykgLy8gQW5kcm9pZCBicm93c2VyIGFsd2F5cyByZXR1cm5zIGZhbHNlIHdoZW4gY2hpbGQgaXMgYSB0ZXh0bm9kZVxuICAgICAgY2hpbGQgPSBjaGlsZC5wYXJlbnROb2RlO1xuICAgIGlmIChwYXJlbnQuY29udGFpbnMpXG4gICAgICByZXR1cm4gcGFyZW50LmNvbnRhaW5zKGNoaWxkKTtcbiAgICBkbyB7XG4gICAgICBpZiAoY2hpbGQubm9kZVR5cGUgPT0gMTEpIGNoaWxkID0gY2hpbGQuaG9zdDtcbiAgICAgIGlmIChjaGlsZCA9PSBwYXJlbnQpIHJldHVybiB0cnVlO1xuICAgIH0gd2hpbGUgKGNoaWxkID0gY2hpbGQucGFyZW50Tm9kZSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gYWN0aXZlRWx0KCkge1xuICAgIHZhciBhY3RpdmVFbGVtZW50ID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgICB3aGlsZSAoYWN0aXZlRWxlbWVudCAmJiBhY3RpdmVFbGVtZW50LnJvb3QgJiYgYWN0aXZlRWxlbWVudC5yb290LmFjdGl2ZUVsZW1lbnQpXG4gICAgICBhY3RpdmVFbGVtZW50ID0gYWN0aXZlRWxlbWVudC5yb290LmFjdGl2ZUVsZW1lbnQ7XG4gICAgcmV0dXJuIGFjdGl2ZUVsZW1lbnQ7XG4gIH1cbiAgLy8gT2xkZXIgdmVyc2lvbnMgb2YgSUUgdGhyb3dzIHVuc3BlY2lmaWVkIGVycm9yIHdoZW4gdG91Y2hpbmdcbiAgLy8gZG9jdW1lbnQuYWN0aXZlRWxlbWVudCBpbiBzb21lIGNhc2VzIChkdXJpbmcgbG9hZGluZywgaW4gaWZyYW1lKVxuICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDExKSBhY3RpdmVFbHQgPSBmdW5jdGlvbigpIHtcbiAgICB0cnkgeyByZXR1cm4gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDsgfVxuICAgIGNhdGNoKGUpIHsgcmV0dXJuIGRvY3VtZW50LmJvZHk7IH1cbiAgfTtcblxuICBmdW5jdGlvbiBjbGFzc1Rlc3QoY2xzKSB7IHJldHVybiBuZXcgUmVnRXhwKFwiKF58XFxcXHMpXCIgKyBjbHMgKyBcIig/OiR8XFxcXHMpXFxcXHMqXCIpOyB9XG4gIHZhciBybUNsYXNzID0gQ29kZU1pcnJvci5ybUNsYXNzID0gZnVuY3Rpb24obm9kZSwgY2xzKSB7XG4gICAgdmFyIGN1cnJlbnQgPSBub2RlLmNsYXNzTmFtZTtcbiAgICB2YXIgbWF0Y2ggPSBjbGFzc1Rlc3QoY2xzKS5leGVjKGN1cnJlbnQpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgdmFyIGFmdGVyID0gY3VycmVudC5zbGljZShtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICBub2RlLmNsYXNzTmFtZSA9IGN1cnJlbnQuc2xpY2UoMCwgbWF0Y2guaW5kZXgpICsgKGFmdGVyID8gbWF0Y2hbMV0gKyBhZnRlciA6IFwiXCIpO1xuICAgIH1cbiAgfTtcbiAgdmFyIGFkZENsYXNzID0gQ29kZU1pcnJvci5hZGRDbGFzcyA9IGZ1bmN0aW9uKG5vZGUsIGNscykge1xuICAgIHZhciBjdXJyZW50ID0gbm9kZS5jbGFzc05hbWU7XG4gICAgaWYgKCFjbGFzc1Rlc3QoY2xzKS50ZXN0KGN1cnJlbnQpKSBub2RlLmNsYXNzTmFtZSArPSAoY3VycmVudCA/IFwiIFwiIDogXCJcIikgKyBjbHM7XG4gIH07XG4gIGZ1bmN0aW9uIGpvaW5DbGFzc2VzKGEsIGIpIHtcbiAgICB2YXIgYXMgPSBhLnNwbGl0KFwiIFwiKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFzLmxlbmd0aDsgaSsrKVxuICAgICAgaWYgKGFzW2ldICYmICFjbGFzc1Rlc3QoYXNbaV0pLnRlc3QoYikpIGIgKz0gXCIgXCIgKyBhc1tpXTtcbiAgICByZXR1cm4gYjtcbiAgfVxuXG4gIC8vIFdJTkRPVy1XSURFIEVWRU5UU1xuXG4gIC8vIFRoZXNlIG11c3QgYmUgaGFuZGxlZCBjYXJlZnVsbHksIGJlY2F1c2UgbmFpdmVseSByZWdpc3RlcmluZyBhXG4gIC8vIGhhbmRsZXIgZm9yIGVhY2ggZWRpdG9yIHdpbGwgY2F1c2UgdGhlIGVkaXRvcnMgdG8gbmV2ZXIgYmVcbiAgLy8gZ2FyYmFnZSBjb2xsZWN0ZWQuXG5cbiAgZnVuY3Rpb24gZm9yRWFjaENvZGVNaXJyb3IoZikge1xuICAgIGlmICghZG9jdW1lbnQuYm9keS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKSByZXR1cm47XG4gICAgdmFyIGJ5Q2xhc3MgPSBkb2N1bWVudC5ib2R5LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJDb2RlTWlycm9yXCIpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnlDbGFzcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGNtID0gYnlDbGFzc1tpXS5Db2RlTWlycm9yO1xuICAgICAgaWYgKGNtKSBmKGNtKTtcbiAgICB9XG4gIH1cblxuICB2YXIgZ2xvYmFsc1JlZ2lzdGVyZWQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gZW5zdXJlR2xvYmFsSGFuZGxlcnMoKSB7XG4gICAgaWYgKGdsb2JhbHNSZWdpc3RlcmVkKSByZXR1cm47XG4gICAgcmVnaXN0ZXJHbG9iYWxIYW5kbGVycygpO1xuICAgIGdsb2JhbHNSZWdpc3RlcmVkID0gdHJ1ZTtcbiAgfVxuICBmdW5jdGlvbiByZWdpc3Rlckdsb2JhbEhhbmRsZXJzKCkge1xuICAgIC8vIFdoZW4gdGhlIHdpbmRvdyByZXNpemVzLCB3ZSBuZWVkIHRvIHJlZnJlc2ggYWN0aXZlIGVkaXRvcnMuXG4gICAgdmFyIHJlc2l6ZVRpbWVyO1xuICAgIG9uKHdpbmRvdywgXCJyZXNpemVcIiwgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAocmVzaXplVGltZXIgPT0gbnVsbCkgcmVzaXplVGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNpemVUaW1lciA9IG51bGw7XG4gICAgICAgIGZvckVhY2hDb2RlTWlycm9yKG9uUmVzaXplKTtcbiAgICAgIH0sIDEwMCk7XG4gICAgfSk7XG4gICAgLy8gV2hlbiB0aGUgd2luZG93IGxvc2VzIGZvY3VzLCB3ZSB3YW50IHRvIHNob3cgdGhlIGVkaXRvciBhcyBibHVycmVkXG4gICAgb24od2luZG93LCBcImJsdXJcIiwgZnVuY3Rpb24oKSB7XG4gICAgICBmb3JFYWNoQ29kZU1pcnJvcihvbkJsdXIpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gRkVBVFVSRSBERVRFQ1RJT05cblxuICAvLyBEZXRlY3QgZHJhZy1hbmQtZHJvcFxuICB2YXIgZHJhZ0FuZERyb3AgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBUaGVyZSBpcyAqc29tZSoga2luZCBvZiBkcmFnLWFuZC1kcm9wIHN1cHBvcnQgaW4gSUU2LTgsIGJ1dCBJXG4gICAgLy8gY291bGRuJ3QgZ2V0IGl0IHRvIHdvcmsgeWV0LlxuICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOSkgcmV0dXJuIGZhbHNlO1xuICAgIHZhciBkaXYgPSBlbHQoJ2RpdicpO1xuICAgIHJldHVybiBcImRyYWdnYWJsZVwiIGluIGRpdiB8fCBcImRyYWdEcm9wXCIgaW4gZGl2O1xuICB9KCk7XG5cbiAgdmFyIHp3c3BTdXBwb3J0ZWQ7XG4gIGZ1bmN0aW9uIHplcm9XaWR0aEVsZW1lbnQobWVhc3VyZSkge1xuICAgIGlmICh6d3NwU3VwcG9ydGVkID09IG51bGwpIHtcbiAgICAgIHZhciB0ZXN0ID0gZWx0KFwic3BhblwiLCBcIlxcdTIwMGJcIik7XG4gICAgICByZW1vdmVDaGlsZHJlbkFuZEFkZChtZWFzdXJlLCBlbHQoXCJzcGFuXCIsIFt0ZXN0LCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcInhcIildKSk7XG4gICAgICBpZiAobWVhc3VyZS5maXJzdENoaWxkLm9mZnNldEhlaWdodCAhPSAwKVxuICAgICAgICB6d3NwU3VwcG9ydGVkID0gdGVzdC5vZmZzZXRXaWR0aCA8PSAxICYmIHRlc3Qub2Zmc2V0SGVpZ2h0ID4gMiAmJiAhKGllICYmIGllX3ZlcnNpb24gPCA4KTtcbiAgICB9XG4gICAgdmFyIG5vZGUgPSB6d3NwU3VwcG9ydGVkID8gZWx0KFwic3BhblwiLCBcIlxcdTIwMGJcIikgOlxuICAgICAgZWx0KFwic3BhblwiLCBcIlxcdTAwYTBcIiwgbnVsbCwgXCJkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IHdpZHRoOiAxcHg7IG1hcmdpbi1yaWdodDogLTFweFwiKTtcbiAgICBub2RlLnNldEF0dHJpYnV0ZShcImNtLXRleHRcIiwgXCJcIik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICAvLyBGZWF0dXJlLWRldGVjdCBJRSdzIGNydW1teSBjbGllbnQgcmVjdCByZXBvcnRpbmcgZm9yIGJpZGkgdGV4dFxuICB2YXIgYmFkQmlkaVJlY3RzO1xuICBmdW5jdGlvbiBoYXNCYWRCaWRpUmVjdHMobWVhc3VyZSkge1xuICAgIGlmIChiYWRCaWRpUmVjdHMgIT0gbnVsbCkgcmV0dXJuIGJhZEJpZGlSZWN0cztcbiAgICB2YXIgdHh0ID0gcmVtb3ZlQ2hpbGRyZW5BbmRBZGQobWVhc3VyZSwgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJBXFx1MDYyZUFcIikpO1xuICAgIHZhciByMCA9IHJhbmdlKHR4dCwgMCwgMSkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgaWYgKCFyMCB8fCByMC5sZWZ0ID09IHIwLnJpZ2h0KSByZXR1cm4gZmFsc2U7IC8vIFNhZmFyaSByZXR1cm5zIG51bGwgaW4gc29tZSBjYXNlcyAoIzI3ODApXG4gICAgdmFyIHIxID0gcmFuZ2UodHh0LCAxLCAyKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICByZXR1cm4gYmFkQmlkaVJlY3RzID0gKHIxLnJpZ2h0IC0gcjAucmlnaHQgPCAzKTtcbiAgfVxuXG4gIC8vIFNlZSBpZiBcIlwiLnNwbGl0IGlzIHRoZSBicm9rZW4gSUUgdmVyc2lvbiwgaWYgc28sIHByb3ZpZGUgYW5cbiAgLy8gYWx0ZXJuYXRpdmUgd2F5IHRvIHNwbGl0IGxpbmVzLlxuICB2YXIgc3BsaXRMaW5lc0F1dG8gPSBDb2RlTWlycm9yLnNwbGl0TGluZXMgPSBcIlxcblxcbmJcIi5zcGxpdCgvXFxuLykubGVuZ3RoICE9IDMgPyBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICB2YXIgcG9zID0gMCwgcmVzdWx0ID0gW10sIGwgPSBzdHJpbmcubGVuZ3RoO1xuICAgIHdoaWxlIChwb3MgPD0gbCkge1xuICAgICAgdmFyIG5sID0gc3RyaW5nLmluZGV4T2YoXCJcXG5cIiwgcG9zKTtcbiAgICAgIGlmIChubCA9PSAtMSkgbmwgPSBzdHJpbmcubGVuZ3RoO1xuICAgICAgdmFyIGxpbmUgPSBzdHJpbmcuc2xpY2UocG9zLCBzdHJpbmcuY2hhckF0KG5sIC0gMSkgPT0gXCJcXHJcIiA/IG5sIC0gMSA6IG5sKTtcbiAgICAgIHZhciBydCA9IGxpbmUuaW5kZXhPZihcIlxcclwiKTtcbiAgICAgIGlmIChydCAhPSAtMSkge1xuICAgICAgICByZXN1bHQucHVzaChsaW5lLnNsaWNlKDAsIHJ0KSk7XG4gICAgICAgIHBvcyArPSBydCArIDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQucHVzaChsaW5lKTtcbiAgICAgICAgcG9zID0gbmwgKyAxO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IDogZnVuY3Rpb24oc3RyaW5nKXtyZXR1cm4gc3RyaW5nLnNwbGl0KC9cXHJcXG4/fFxcbi8pO307XG5cbiAgdmFyIGhhc1NlbGVjdGlvbiA9IHdpbmRvdy5nZXRTZWxlY3Rpb24gPyBmdW5jdGlvbih0ZSkge1xuICAgIHRyeSB7IHJldHVybiB0ZS5zZWxlY3Rpb25TdGFydCAhPSB0ZS5zZWxlY3Rpb25FbmQ7IH1cbiAgICBjYXRjaChlKSB7IHJldHVybiBmYWxzZTsgfVxuICB9IDogZnVuY3Rpb24odGUpIHtcbiAgICB0cnkge3ZhciByYW5nZSA9IHRlLm93bmVyRG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7fVxuICAgIGNhdGNoKGUpIHt9XG4gICAgaWYgKCFyYW5nZSB8fCByYW5nZS5wYXJlbnRFbGVtZW50KCkgIT0gdGUpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gcmFuZ2UuY29tcGFyZUVuZFBvaW50cyhcIlN0YXJ0VG9FbmRcIiwgcmFuZ2UpICE9IDA7XG4gIH07XG5cbiAgdmFyIGhhc0NvcHlFdmVudCA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgZSA9IGVsdChcImRpdlwiKTtcbiAgICBpZiAoXCJvbmNvcHlcIiBpbiBlKSByZXR1cm4gdHJ1ZTtcbiAgICBlLnNldEF0dHJpYnV0ZShcIm9uY29weVwiLCBcInJldHVybjtcIik7XG4gICAgcmV0dXJuIHR5cGVvZiBlLm9uY29weSA9PSBcImZ1bmN0aW9uXCI7XG4gIH0pKCk7XG5cbiAgdmFyIGJhZFpvb21lZFJlY3RzID0gbnVsbDtcbiAgZnVuY3Rpb24gaGFzQmFkWm9vbWVkUmVjdHMobWVhc3VyZSkge1xuICAgIGlmIChiYWRab29tZWRSZWN0cyAhPSBudWxsKSByZXR1cm4gYmFkWm9vbWVkUmVjdHM7XG4gICAgdmFyIG5vZGUgPSByZW1vdmVDaGlsZHJlbkFuZEFkZChtZWFzdXJlLCBlbHQoXCJzcGFuXCIsIFwieFwiKSk7XG4gICAgdmFyIG5vcm1hbCA9IG5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdmFyIGZyb21SYW5nZSA9IHJhbmdlKG5vZGUsIDAsIDEpLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHJldHVybiBiYWRab29tZWRSZWN0cyA9IE1hdGguYWJzKG5vcm1hbC5sZWZ0IC0gZnJvbVJhbmdlLmxlZnQpID4gMTtcbiAgfVxuXG4gIC8vIEtFWSBOQU1FU1xuXG4gIHZhciBrZXlOYW1lcyA9IENvZGVNaXJyb3Iua2V5TmFtZXMgPSB7XG4gICAgMzogXCJFbnRlclwiLCA4OiBcIkJhY2tzcGFjZVwiLCA5OiBcIlRhYlwiLCAxMzogXCJFbnRlclwiLCAxNjogXCJTaGlmdFwiLCAxNzogXCJDdHJsXCIsIDE4OiBcIkFsdFwiLFxuICAgIDE5OiBcIlBhdXNlXCIsIDIwOiBcIkNhcHNMb2NrXCIsIDI3OiBcIkVzY1wiLCAzMjogXCJTcGFjZVwiLCAzMzogXCJQYWdlVXBcIiwgMzQ6IFwiUGFnZURvd25cIiwgMzU6IFwiRW5kXCIsXG4gICAgMzY6IFwiSG9tZVwiLCAzNzogXCJMZWZ0XCIsIDM4OiBcIlVwXCIsIDM5OiBcIlJpZ2h0XCIsIDQwOiBcIkRvd25cIiwgNDQ6IFwiUHJpbnRTY3JuXCIsIDQ1OiBcIkluc2VydFwiLFxuICAgIDQ2OiBcIkRlbGV0ZVwiLCA1OTogXCI7XCIsIDYxOiBcIj1cIiwgOTE6IFwiTW9kXCIsIDkyOiBcIk1vZFwiLCA5MzogXCJNb2RcIixcbiAgICAxMDY6IFwiKlwiLCAxMDc6IFwiPVwiLCAxMDk6IFwiLVwiLCAxMTA6IFwiLlwiLCAxMTE6IFwiL1wiLCAxMjc6IFwiRGVsZXRlXCIsXG4gICAgMTczOiBcIi1cIiwgMTg2OiBcIjtcIiwgMTg3OiBcIj1cIiwgMTg4OiBcIixcIiwgMTg5OiBcIi1cIiwgMTkwOiBcIi5cIiwgMTkxOiBcIi9cIiwgMTkyOiBcImBcIiwgMjE5OiBcIltcIiwgMjIwOiBcIlxcXFxcIixcbiAgICAyMjE6IFwiXVwiLCAyMjI6IFwiJ1wiLCA2MzIzMjogXCJVcFwiLCA2MzIzMzogXCJEb3duXCIsIDYzMjM0OiBcIkxlZnRcIiwgNjMyMzU6IFwiUmlnaHRcIiwgNjMyNzI6IFwiRGVsZXRlXCIsXG4gICAgNjMyNzM6IFwiSG9tZVwiLCA2MzI3NTogXCJFbmRcIiwgNjMyNzY6IFwiUGFnZVVwXCIsIDYzMjc3OiBcIlBhZ2VEb3duXCIsIDYzMzAyOiBcIkluc2VydFwiXG4gIH07XG4gIChmdW5jdGlvbigpIHtcbiAgICAvLyBOdW1iZXIga2V5c1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMTA7IGkrKykga2V5TmFtZXNbaSArIDQ4XSA9IGtleU5hbWVzW2kgKyA5Nl0gPSBTdHJpbmcoaSk7XG4gICAgLy8gQWxwaGFiZXRpYyBrZXlzXG4gICAgZm9yICh2YXIgaSA9IDY1OyBpIDw9IDkwOyBpKyspIGtleU5hbWVzW2ldID0gU3RyaW5nLmZyb21DaGFyQ29kZShpKTtcbiAgICAvLyBGdW5jdGlvbiBrZXlzXG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPD0gMTI7IGkrKykga2V5TmFtZXNbaSArIDExMV0gPSBrZXlOYW1lc1tpICsgNjMyMzVdID0gXCJGXCIgKyBpO1xuICB9KSgpO1xuXG4gIC8vIEJJREkgSEVMUEVSU1xuXG4gIGZ1bmN0aW9uIGl0ZXJhdGVCaWRpU2VjdGlvbnMob3JkZXIsIGZyb20sIHRvLCBmKSB7XG4gICAgaWYgKCFvcmRlcikgcmV0dXJuIGYoZnJvbSwgdG8sIFwibHRyXCIpO1xuICAgIHZhciBmb3VuZCA9IGZhbHNlO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3JkZXIubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBwYXJ0ID0gb3JkZXJbaV07XG4gICAgICBpZiAocGFydC5mcm9tIDwgdG8gJiYgcGFydC50byA+IGZyb20gfHwgZnJvbSA9PSB0byAmJiBwYXJ0LnRvID09IGZyb20pIHtcbiAgICAgICAgZihNYXRoLm1heChwYXJ0LmZyb20sIGZyb20pLCBNYXRoLm1pbihwYXJ0LnRvLCB0byksIHBhcnQubGV2ZWwgPT0gMSA/IFwicnRsXCIgOiBcImx0clwiKTtcbiAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWZvdW5kKSBmKGZyb20sIHRvLCBcImx0clwiKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJpZGlMZWZ0KHBhcnQpIHsgcmV0dXJuIHBhcnQubGV2ZWwgJSAyID8gcGFydC50byA6IHBhcnQuZnJvbTsgfVxuICBmdW5jdGlvbiBiaWRpUmlnaHQocGFydCkgeyByZXR1cm4gcGFydC5sZXZlbCAlIDIgPyBwYXJ0LmZyb20gOiBwYXJ0LnRvOyB9XG5cbiAgZnVuY3Rpb24gbGluZUxlZnQobGluZSkgeyB2YXIgb3JkZXIgPSBnZXRPcmRlcihsaW5lKTsgcmV0dXJuIG9yZGVyID8gYmlkaUxlZnQob3JkZXJbMF0pIDogMDsgfVxuICBmdW5jdGlvbiBsaW5lUmlnaHQobGluZSkge1xuICAgIHZhciBvcmRlciA9IGdldE9yZGVyKGxpbmUpO1xuICAgIGlmICghb3JkZXIpIHJldHVybiBsaW5lLnRleHQubGVuZ3RoO1xuICAgIHJldHVybiBiaWRpUmlnaHQobHN0KG9yZGVyKSk7XG4gIH1cblxuICBmdW5jdGlvbiBsaW5lU3RhcnQoY20sIGxpbmVOKSB7XG4gICAgdmFyIGxpbmUgPSBnZXRMaW5lKGNtLmRvYywgbGluZU4pO1xuICAgIHZhciB2aXN1YWwgPSB2aXN1YWxMaW5lKGxpbmUpO1xuICAgIGlmICh2aXN1YWwgIT0gbGluZSkgbGluZU4gPSBsaW5lTm8odmlzdWFsKTtcbiAgICB2YXIgb3JkZXIgPSBnZXRPcmRlcih2aXN1YWwpO1xuICAgIHZhciBjaCA9ICFvcmRlciA/IDAgOiBvcmRlclswXS5sZXZlbCAlIDIgPyBsaW5lUmlnaHQodmlzdWFsKSA6IGxpbmVMZWZ0KHZpc3VhbCk7XG4gICAgcmV0dXJuIFBvcyhsaW5lTiwgY2gpO1xuICB9XG4gIGZ1bmN0aW9uIGxpbmVFbmQoY20sIGxpbmVOKSB7XG4gICAgdmFyIG1lcmdlZCwgbGluZSA9IGdldExpbmUoY20uZG9jLCBsaW5lTik7XG4gICAgd2hpbGUgKG1lcmdlZCA9IGNvbGxhcHNlZFNwYW5BdEVuZChsaW5lKSkge1xuICAgICAgbGluZSA9IG1lcmdlZC5maW5kKDEsIHRydWUpLmxpbmU7XG4gICAgICBsaW5lTiA9IG51bGw7XG4gICAgfVxuICAgIHZhciBvcmRlciA9IGdldE9yZGVyKGxpbmUpO1xuICAgIHZhciBjaCA9ICFvcmRlciA/IGxpbmUudGV4dC5sZW5ndGggOiBvcmRlclswXS5sZXZlbCAlIDIgPyBsaW5lTGVmdChsaW5lKSA6IGxpbmVSaWdodChsaW5lKTtcbiAgICByZXR1cm4gUG9zKGxpbmVOID09IG51bGwgPyBsaW5lTm8obGluZSkgOiBsaW5lTiwgY2gpO1xuICB9XG4gIGZ1bmN0aW9uIGxpbmVTdGFydFNtYXJ0KGNtLCBwb3MpIHtcbiAgICB2YXIgc3RhcnQgPSBsaW5lU3RhcnQoY20sIHBvcy5saW5lKTtcbiAgICB2YXIgbGluZSA9IGdldExpbmUoY20uZG9jLCBzdGFydC5saW5lKTtcbiAgICB2YXIgb3JkZXIgPSBnZXRPcmRlcihsaW5lKTtcbiAgICBpZiAoIW9yZGVyIHx8IG9yZGVyWzBdLmxldmVsID09IDApIHtcbiAgICAgIHZhciBmaXJzdE5vbldTID0gTWF0aC5tYXgoMCwgbGluZS50ZXh0LnNlYXJjaCgvXFxTLykpO1xuICAgICAgdmFyIGluV1MgPSBwb3MubGluZSA9PSBzdGFydC5saW5lICYmIHBvcy5jaCA8PSBmaXJzdE5vbldTICYmIHBvcy5jaDtcbiAgICAgIHJldHVybiBQb3Moc3RhcnQubGluZSwgaW5XUyA/IDAgOiBmaXJzdE5vbldTKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXJ0O1xuICB9XG5cbiAgZnVuY3Rpb24gY29tcGFyZUJpZGlMZXZlbChvcmRlciwgYSwgYikge1xuICAgIHZhciBsaW5lZGlyID0gb3JkZXJbMF0ubGV2ZWw7XG4gICAgaWYgKGEgPT0gbGluZWRpcikgcmV0dXJuIHRydWU7XG4gICAgaWYgKGIgPT0gbGluZWRpcikgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiBhIDwgYjtcbiAgfVxuICB2YXIgYmlkaU90aGVyO1xuICBmdW5jdGlvbiBnZXRCaWRpUGFydEF0KG9yZGVyLCBwb3MpIHtcbiAgICBiaWRpT3RoZXIgPSBudWxsO1xuICAgIGZvciAodmFyIGkgPSAwLCBmb3VuZDsgaSA8IG9yZGVyLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgY3VyID0gb3JkZXJbaV07XG4gICAgICBpZiAoY3VyLmZyb20gPCBwb3MgJiYgY3VyLnRvID4gcG9zKSByZXR1cm4gaTtcbiAgICAgIGlmICgoY3VyLmZyb20gPT0gcG9zIHx8IGN1ci50byA9PSBwb3MpKSB7XG4gICAgICAgIGlmIChmb3VuZCA9PSBudWxsKSB7XG4gICAgICAgICAgZm91bmQgPSBpO1xuICAgICAgICB9IGVsc2UgaWYgKGNvbXBhcmVCaWRpTGV2ZWwob3JkZXIsIGN1ci5sZXZlbCwgb3JkZXJbZm91bmRdLmxldmVsKSkge1xuICAgICAgICAgIGlmIChjdXIuZnJvbSAhPSBjdXIudG8pIGJpZGlPdGhlciA9IGZvdW5kO1xuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChjdXIuZnJvbSAhPSBjdXIudG8pIGJpZGlPdGhlciA9IGk7XG4gICAgICAgICAgcmV0dXJuIGZvdW5kO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmb3VuZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1vdmVJbkxpbmUobGluZSwgcG9zLCBkaXIsIGJ5VW5pdCkge1xuICAgIGlmICghYnlVbml0KSByZXR1cm4gcG9zICsgZGlyO1xuICAgIGRvIHBvcyArPSBkaXI7XG4gICAgd2hpbGUgKHBvcyA+IDAgJiYgaXNFeHRlbmRpbmdDaGFyKGxpbmUudGV4dC5jaGFyQXQocG9zKSkpO1xuICAgIHJldHVybiBwb3M7XG4gIH1cblxuICAvLyBUaGlzIGlzIG5lZWRlZCBpbiBvcmRlciB0byBtb3ZlICd2aXN1YWxseScgdGhyb3VnaCBiaS1kaXJlY3Rpb25hbFxuICAvLyB0ZXh0IC0tIGkuZS4sIHByZXNzaW5nIGxlZnQgc2hvdWxkIG1ha2UgdGhlIGN1cnNvciBnbyBsZWZ0LCBldmVuXG4gIC8vIHdoZW4gaW4gUlRMIHRleHQuIFRoZSB0cmlja3kgcGFydCBpcyB0aGUgJ2p1bXBzJywgd2hlcmUgUlRMIGFuZFxuICAvLyBMVFIgdGV4dCB0b3VjaCBlYWNoIG90aGVyLiBUaGlzIG9mdGVuIHJlcXVpcmVzIHRoZSBjdXJzb3Igb2Zmc2V0XG4gIC8vIHRvIG1vdmUgbW9yZSB0aGFuIG9uZSB1bml0LCBpbiBvcmRlciB0byB2aXN1YWxseSBtb3ZlIG9uZSB1bml0LlxuICBmdW5jdGlvbiBtb3ZlVmlzdWFsbHkobGluZSwgc3RhcnQsIGRpciwgYnlVbml0KSB7XG4gICAgdmFyIGJpZGkgPSBnZXRPcmRlcihsaW5lKTtcbiAgICBpZiAoIWJpZGkpIHJldHVybiBtb3ZlTG9naWNhbGx5KGxpbmUsIHN0YXJ0LCBkaXIsIGJ5VW5pdCk7XG4gICAgdmFyIHBvcyA9IGdldEJpZGlQYXJ0QXQoYmlkaSwgc3RhcnQpLCBwYXJ0ID0gYmlkaVtwb3NdO1xuICAgIHZhciB0YXJnZXQgPSBtb3ZlSW5MaW5lKGxpbmUsIHN0YXJ0LCBwYXJ0LmxldmVsICUgMiA/IC1kaXIgOiBkaXIsIGJ5VW5pdCk7XG5cbiAgICBmb3IgKDs7KSB7XG4gICAgICBpZiAodGFyZ2V0ID4gcGFydC5mcm9tICYmIHRhcmdldCA8IHBhcnQudG8pIHJldHVybiB0YXJnZXQ7XG4gICAgICBpZiAodGFyZ2V0ID09IHBhcnQuZnJvbSB8fCB0YXJnZXQgPT0gcGFydC50bykge1xuICAgICAgICBpZiAoZ2V0QmlkaVBhcnRBdChiaWRpLCB0YXJnZXQpID09IHBvcykgcmV0dXJuIHRhcmdldDtcbiAgICAgICAgcGFydCA9IGJpZGlbcG9zICs9IGRpcl07XG4gICAgICAgIHJldHVybiAoZGlyID4gMCkgPT0gcGFydC5sZXZlbCAlIDIgPyBwYXJ0LnRvIDogcGFydC5mcm9tO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGFydCA9IGJpZGlbcG9zICs9IGRpcl07XG4gICAgICAgIGlmICghcGFydCkgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICgoZGlyID4gMCkgPT0gcGFydC5sZXZlbCAlIDIpXG4gICAgICAgICAgdGFyZ2V0ID0gbW92ZUluTGluZShsaW5lLCBwYXJ0LnRvLCAtMSwgYnlVbml0KTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRhcmdldCA9IG1vdmVJbkxpbmUobGluZSwgcGFydC5mcm9tLCAxLCBieVVuaXQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1vdmVMb2dpY2FsbHkobGluZSwgc3RhcnQsIGRpciwgYnlVbml0KSB7XG4gICAgdmFyIHRhcmdldCA9IHN0YXJ0ICsgZGlyO1xuICAgIGlmIChieVVuaXQpIHdoaWxlICh0YXJnZXQgPiAwICYmIGlzRXh0ZW5kaW5nQ2hhcihsaW5lLnRleHQuY2hhckF0KHRhcmdldCkpKSB0YXJnZXQgKz0gZGlyO1xuICAgIHJldHVybiB0YXJnZXQgPCAwIHx8IHRhcmdldCA+IGxpbmUudGV4dC5sZW5ndGggPyBudWxsIDogdGFyZ2V0O1xuICB9XG5cbiAgLy8gQmlkaXJlY3Rpb25hbCBvcmRlcmluZyBhbGdvcml0aG1cbiAgLy8gU2VlIGh0dHA6Ly91bmljb2RlLm9yZy9yZXBvcnRzL3RyOS90cjktMTMuaHRtbCBmb3IgdGhlIGFsZ29yaXRobVxuICAvLyB0aGF0IHRoaXMgKHBhcnRpYWxseSkgaW1wbGVtZW50cy5cblxuICAvLyBPbmUtY2hhciBjb2RlcyB1c2VkIGZvciBjaGFyYWN0ZXIgdHlwZXM6XG4gIC8vIEwgKEwpOiAgIExlZnQtdG8tUmlnaHRcbiAgLy8gUiAoUik6ICAgUmlnaHQtdG8tTGVmdFxuICAvLyByIChBTCk6ICBSaWdodC10by1MZWZ0IEFyYWJpY1xuICAvLyAxIChFTik6ICBFdXJvcGVhbiBOdW1iZXJcbiAgLy8gKyAoRVMpOiAgRXVyb3BlYW4gTnVtYmVyIFNlcGFyYXRvclxuICAvLyAlIChFVCk6ICBFdXJvcGVhbiBOdW1iZXIgVGVybWluYXRvclxuICAvLyBuIChBTik6ICBBcmFiaWMgTnVtYmVyXG4gIC8vICwgKENTKTogIENvbW1vbiBOdW1iZXIgU2VwYXJhdG9yXG4gIC8vIG0gKE5TTSk6IE5vbi1TcGFjaW5nIE1hcmtcbiAgLy8gYiAoQk4pOiAgQm91bmRhcnkgTmV1dHJhbFxuICAvLyBzIChCKTogICBQYXJhZ3JhcGggU2VwYXJhdG9yXG4gIC8vIHQgKFMpOiAgIFNlZ21lbnQgU2VwYXJhdG9yXG4gIC8vIHcgKFdTKTogIFdoaXRlc3BhY2VcbiAgLy8gTiAoT04pOiAgT3RoZXIgTmV1dHJhbHNcblxuICAvLyBSZXR1cm5zIG51bGwgaWYgY2hhcmFjdGVycyBhcmUgb3JkZXJlZCBhcyB0aGV5IGFwcGVhclxuICAvLyAobGVmdC10by1yaWdodCksIG9yIGFuIGFycmF5IG9mIHNlY3Rpb25zICh7ZnJvbSwgdG8sIGxldmVsfVxuICAvLyBvYmplY3RzKSBpbiB0aGUgb3JkZXIgaW4gd2hpY2ggdGhleSBvY2N1ciB2aXN1YWxseS5cbiAgdmFyIGJpZGlPcmRlcmluZyA9IChmdW5jdGlvbigpIHtcbiAgICAvLyBDaGFyYWN0ZXIgdHlwZXMgZm9yIGNvZGVwb2ludHMgMCB0byAweGZmXG4gICAgdmFyIGxvd1R5cGVzID0gXCJiYmJiYmJiYmJ0c3R3c2JiYmJiYmJiYmJiYmJic3NzdHdOTiUlJU5OTk5OTixOLE4xMTExMTExMTExTk5OTk5OTkxMTExMTExMTExMTExMTExMTExMTExMTExMTk5OTk5OTExMTExMTExMTExMTExMTExMTExMTExMTExOTk5OYmJiYmJic2JiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiLE4lJSUlTk5OTkxOTk5OTiUlMTFOTE5OTjFMTk5OTk5MTExMTExMTExMTExMTExMTExMTExMTE5MTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTlwiO1xuICAgIC8vIENoYXJhY3RlciB0eXBlcyBmb3IgY29kZXBvaW50cyAweDYwMCB0byAweDZmZlxuICAgIHZhciBhcmFiaWNUeXBlcyA9IFwicnJycnJycnJycnJyLHJOTm1tbW1tbXJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJybW1tbW1tbW1tbW1tbW1ycnJycnJybm5ubm5ubm5ubiVubnJycm1ycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycm1tbW1tbW1tbW1tbW1tbW1tbW1ObW1tbVwiO1xuICAgIGZ1bmN0aW9uIGNoYXJUeXBlKGNvZGUpIHtcbiAgICAgIGlmIChjb2RlIDw9IDB4ZjcpIHJldHVybiBsb3dUeXBlcy5jaGFyQXQoY29kZSk7XG4gICAgICBlbHNlIGlmICgweDU5MCA8PSBjb2RlICYmIGNvZGUgPD0gMHg1ZjQpIHJldHVybiBcIlJcIjtcbiAgICAgIGVsc2UgaWYgKDB4NjAwIDw9IGNvZGUgJiYgY29kZSA8PSAweDZlZCkgcmV0dXJuIGFyYWJpY1R5cGVzLmNoYXJBdChjb2RlIC0gMHg2MDApO1xuICAgICAgZWxzZSBpZiAoMHg2ZWUgPD0gY29kZSAmJiBjb2RlIDw9IDB4OGFjKSByZXR1cm4gXCJyXCI7XG4gICAgICBlbHNlIGlmICgweDIwMDAgPD0gY29kZSAmJiBjb2RlIDw9IDB4MjAwYikgcmV0dXJuIFwid1wiO1xuICAgICAgZWxzZSBpZiAoY29kZSA9PSAweDIwMGMpIHJldHVybiBcImJcIjtcbiAgICAgIGVsc2UgcmV0dXJuIFwiTFwiO1xuICAgIH1cblxuICAgIHZhciBiaWRpUkUgPSAvW1xcdTA1OTAtXFx1MDVmNFxcdTA2MDAtXFx1MDZmZlxcdTA3MDAtXFx1MDhhY10vO1xuICAgIHZhciBpc05ldXRyYWwgPSAvW3N0d05dLywgaXNTdHJvbmcgPSAvW0xScl0vLCBjb3VudHNBc0xlZnQgPSAvW0xiMW5dLywgY291bnRzQXNOdW0gPSAvWzFuXS87XG4gICAgLy8gQnJvd3NlcnMgc2VlbSB0byBhbHdheXMgdHJlYXQgdGhlIGJvdW5kYXJpZXMgb2YgYmxvY2sgZWxlbWVudHMgYXMgYmVpbmcgTC5cbiAgICB2YXIgb3V0ZXJUeXBlID0gXCJMXCI7XG5cbiAgICBmdW5jdGlvbiBCaWRpU3BhbihsZXZlbCwgZnJvbSwgdG8pIHtcbiAgICAgIHRoaXMubGV2ZWwgPSBsZXZlbDtcbiAgICAgIHRoaXMuZnJvbSA9IGZyb207IHRoaXMudG8gPSB0bztcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oc3RyKSB7XG4gICAgICBpZiAoIWJpZGlSRS50ZXN0KHN0cikpIHJldHVybiBmYWxzZTtcbiAgICAgIHZhciBsZW4gPSBzdHIubGVuZ3RoLCB0eXBlcyA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIHR5cGU7IGkgPCBsZW47ICsraSlcbiAgICAgICAgdHlwZXMucHVzaCh0eXBlID0gY2hhclR5cGUoc3RyLmNoYXJDb2RlQXQoaSkpKTtcblxuICAgICAgLy8gVzEuIEV4YW1pbmUgZWFjaCBub24tc3BhY2luZyBtYXJrIChOU00pIGluIHRoZSBsZXZlbCBydW4sIGFuZFxuICAgICAgLy8gY2hhbmdlIHRoZSB0eXBlIG9mIHRoZSBOU00gdG8gdGhlIHR5cGUgb2YgdGhlIHByZXZpb3VzXG4gICAgICAvLyBjaGFyYWN0ZXIuIElmIHRoZSBOU00gaXMgYXQgdGhlIHN0YXJ0IG9mIHRoZSBsZXZlbCBydW4sIGl0IHdpbGxcbiAgICAgIC8vIGdldCB0aGUgdHlwZSBvZiBzb3IuXG4gICAgICBmb3IgKHZhciBpID0gMCwgcHJldiA9IG91dGVyVHlwZTsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIHZhciB0eXBlID0gdHlwZXNbaV07XG4gICAgICAgIGlmICh0eXBlID09IFwibVwiKSB0eXBlc1tpXSA9IHByZXY7XG4gICAgICAgIGVsc2UgcHJldiA9IHR5cGU7XG4gICAgICB9XG5cbiAgICAgIC8vIFcyLiBTZWFyY2ggYmFja3dhcmRzIGZyb20gZWFjaCBpbnN0YW5jZSBvZiBhIEV1cm9wZWFuIG51bWJlclxuICAgICAgLy8gdW50aWwgdGhlIGZpcnN0IHN0cm9uZyB0eXBlIChSLCBMLCBBTCwgb3Igc29yKSBpcyBmb3VuZC4gSWYgYW5cbiAgICAgIC8vIEFMIGlzIGZvdW5kLCBjaGFuZ2UgdGhlIHR5cGUgb2YgdGhlIEV1cm9wZWFuIG51bWJlciB0byBBcmFiaWNcbiAgICAgIC8vIG51bWJlci5cbiAgICAgIC8vIFczLiBDaGFuZ2UgYWxsIEFMcyB0byBSLlxuICAgICAgZm9yICh2YXIgaSA9IDAsIGN1ciA9IG91dGVyVHlwZTsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIHZhciB0eXBlID0gdHlwZXNbaV07XG4gICAgICAgIGlmICh0eXBlID09IFwiMVwiICYmIGN1ciA9PSBcInJcIikgdHlwZXNbaV0gPSBcIm5cIjtcbiAgICAgICAgZWxzZSBpZiAoaXNTdHJvbmcudGVzdCh0eXBlKSkgeyBjdXIgPSB0eXBlOyBpZiAodHlwZSA9PSBcInJcIikgdHlwZXNbaV0gPSBcIlJcIjsgfVxuICAgICAgfVxuXG4gICAgICAvLyBXNC4gQSBzaW5nbGUgRXVyb3BlYW4gc2VwYXJhdG9yIGJldHdlZW4gdHdvIEV1cm9wZWFuIG51bWJlcnNcbiAgICAgIC8vIGNoYW5nZXMgdG8gYSBFdXJvcGVhbiBudW1iZXIuIEEgc2luZ2xlIGNvbW1vbiBzZXBhcmF0b3IgYmV0d2VlblxuICAgICAgLy8gdHdvIG51bWJlcnMgb2YgdGhlIHNhbWUgdHlwZSBjaGFuZ2VzIHRvIHRoYXQgdHlwZS5cbiAgICAgIGZvciAodmFyIGkgPSAxLCBwcmV2ID0gdHlwZXNbMF07IGkgPCBsZW4gLSAxOyArK2kpIHtcbiAgICAgICAgdmFyIHR5cGUgPSB0eXBlc1tpXTtcbiAgICAgICAgaWYgKHR5cGUgPT0gXCIrXCIgJiYgcHJldiA9PSBcIjFcIiAmJiB0eXBlc1tpKzFdID09IFwiMVwiKSB0eXBlc1tpXSA9IFwiMVwiO1xuICAgICAgICBlbHNlIGlmICh0eXBlID09IFwiLFwiICYmIHByZXYgPT0gdHlwZXNbaSsxXSAmJlxuICAgICAgICAgICAgICAgICAocHJldiA9PSBcIjFcIiB8fCBwcmV2ID09IFwiblwiKSkgdHlwZXNbaV0gPSBwcmV2O1xuICAgICAgICBwcmV2ID0gdHlwZTtcbiAgICAgIH1cblxuICAgICAgLy8gVzUuIEEgc2VxdWVuY2Ugb2YgRXVyb3BlYW4gdGVybWluYXRvcnMgYWRqYWNlbnQgdG8gRXVyb3BlYW5cbiAgICAgIC8vIG51bWJlcnMgY2hhbmdlcyB0byBhbGwgRXVyb3BlYW4gbnVtYmVycy5cbiAgICAgIC8vIFc2LiBPdGhlcndpc2UsIHNlcGFyYXRvcnMgYW5kIHRlcm1pbmF0b3JzIGNoYW5nZSB0byBPdGhlclxuICAgICAgLy8gTmV1dHJhbC5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgdmFyIHR5cGUgPSB0eXBlc1tpXTtcbiAgICAgICAgaWYgKHR5cGUgPT0gXCIsXCIpIHR5cGVzW2ldID0gXCJOXCI7XG4gICAgICAgIGVsc2UgaWYgKHR5cGUgPT0gXCIlXCIpIHtcbiAgICAgICAgICBmb3IgKHZhciBlbmQgPSBpICsgMTsgZW5kIDwgbGVuICYmIHR5cGVzW2VuZF0gPT0gXCIlXCI7ICsrZW5kKSB7fVxuICAgICAgICAgIHZhciByZXBsYWNlID0gKGkgJiYgdHlwZXNbaS0xXSA9PSBcIiFcIikgfHwgKGVuZCA8IGxlbiAmJiB0eXBlc1tlbmRdID09IFwiMVwiKSA/IFwiMVwiIDogXCJOXCI7XG4gICAgICAgICAgZm9yICh2YXIgaiA9IGk7IGogPCBlbmQ7ICsraikgdHlwZXNbal0gPSByZXBsYWNlO1xuICAgICAgICAgIGkgPSBlbmQgLSAxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFc3LiBTZWFyY2ggYmFja3dhcmRzIGZyb20gZWFjaCBpbnN0YW5jZSBvZiBhIEV1cm9wZWFuIG51bWJlclxuICAgICAgLy8gdW50aWwgdGhlIGZpcnN0IHN0cm9uZyB0eXBlIChSLCBMLCBvciBzb3IpIGlzIGZvdW5kLiBJZiBhbiBMIGlzXG4gICAgICAvLyBmb3VuZCwgdGhlbiBjaGFuZ2UgdGhlIHR5cGUgb2YgdGhlIEV1cm9wZWFuIG51bWJlciB0byBMLlxuICAgICAgZm9yICh2YXIgaSA9IDAsIGN1ciA9IG91dGVyVHlwZTsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIHZhciB0eXBlID0gdHlwZXNbaV07XG4gICAgICAgIGlmIChjdXIgPT0gXCJMXCIgJiYgdHlwZSA9PSBcIjFcIikgdHlwZXNbaV0gPSBcIkxcIjtcbiAgICAgICAgZWxzZSBpZiAoaXNTdHJvbmcudGVzdCh0eXBlKSkgY3VyID0gdHlwZTtcbiAgICAgIH1cblxuICAgICAgLy8gTjEuIEEgc2VxdWVuY2Ugb2YgbmV1dHJhbHMgdGFrZXMgdGhlIGRpcmVjdGlvbiBvZiB0aGVcbiAgICAgIC8vIHN1cnJvdW5kaW5nIHN0cm9uZyB0ZXh0IGlmIHRoZSB0ZXh0IG9uIGJvdGggc2lkZXMgaGFzIHRoZSBzYW1lXG4gICAgICAvLyBkaXJlY3Rpb24uIEV1cm9wZWFuIGFuZCBBcmFiaWMgbnVtYmVycyBhY3QgYXMgaWYgdGhleSB3ZXJlIFIgaW5cbiAgICAgIC8vIHRlcm1zIG9mIHRoZWlyIGluZmx1ZW5jZSBvbiBuZXV0cmFscy4gU3RhcnQtb2YtbGV2ZWwtcnVuIChzb3IpXG4gICAgICAvLyBhbmQgZW5kLW9mLWxldmVsLXJ1biAoZW9yKSBhcmUgdXNlZCBhdCBsZXZlbCBydW4gYm91bmRhcmllcy5cbiAgICAgIC8vIE4yLiBBbnkgcmVtYWluaW5nIG5ldXRyYWxzIHRha2UgdGhlIGVtYmVkZGluZyBkaXJlY3Rpb24uXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIGlmIChpc05ldXRyYWwudGVzdCh0eXBlc1tpXSkpIHtcbiAgICAgICAgICBmb3IgKHZhciBlbmQgPSBpICsgMTsgZW5kIDwgbGVuICYmIGlzTmV1dHJhbC50ZXN0KHR5cGVzW2VuZF0pOyArK2VuZCkge31cbiAgICAgICAgICB2YXIgYmVmb3JlID0gKGkgPyB0eXBlc1tpLTFdIDogb3V0ZXJUeXBlKSA9PSBcIkxcIjtcbiAgICAgICAgICB2YXIgYWZ0ZXIgPSAoZW5kIDwgbGVuID8gdHlwZXNbZW5kXSA6IG91dGVyVHlwZSkgPT0gXCJMXCI7XG4gICAgICAgICAgdmFyIHJlcGxhY2UgPSBiZWZvcmUgfHwgYWZ0ZXIgPyBcIkxcIiA6IFwiUlwiO1xuICAgICAgICAgIGZvciAodmFyIGogPSBpOyBqIDwgZW5kOyArK2opIHR5cGVzW2pdID0gcmVwbGFjZTtcbiAgICAgICAgICBpID0gZW5kIC0gMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBIZXJlIHdlIGRlcGFydCBmcm9tIHRoZSBkb2N1bWVudGVkIGFsZ29yaXRobSwgaW4gb3JkZXIgdG8gYXZvaWRcbiAgICAgIC8vIGJ1aWxkaW5nIHVwIGFuIGFjdHVhbCBsZXZlbHMgYXJyYXkuIFNpbmNlIHRoZXJlIGFyZSBvbmx5IHRocmVlXG4gICAgICAvLyBsZXZlbHMgKDAsIDEsIDIpIGluIGFuIGltcGxlbWVudGF0aW9uIHRoYXQgZG9lc24ndCB0YWtlXG4gICAgICAvLyBleHBsaWNpdCBlbWJlZGRpbmcgaW50byBhY2NvdW50LCB3ZSBjYW4gYnVpbGQgdXAgdGhlIG9yZGVyIG9uXG4gICAgICAvLyB0aGUgZmx5LCB3aXRob3V0IGZvbGxvd2luZyB0aGUgbGV2ZWwtYmFzZWQgYWxnb3JpdGhtLlxuICAgICAgdmFyIG9yZGVyID0gW10sIG07XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjspIHtcbiAgICAgICAgaWYgKGNvdW50c0FzTGVmdC50ZXN0KHR5cGVzW2ldKSkge1xuICAgICAgICAgIHZhciBzdGFydCA9IGk7XG4gICAgICAgICAgZm9yICgrK2k7IGkgPCBsZW4gJiYgY291bnRzQXNMZWZ0LnRlc3QodHlwZXNbaV0pOyArK2kpIHt9XG4gICAgICAgICAgb3JkZXIucHVzaChuZXcgQmlkaVNwYW4oMCwgc3RhcnQsIGkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgcG9zID0gaSwgYXQgPSBvcmRlci5sZW5ndGg7XG4gICAgICAgICAgZm9yICgrK2k7IGkgPCBsZW4gJiYgdHlwZXNbaV0gIT0gXCJMXCI7ICsraSkge31cbiAgICAgICAgICBmb3IgKHZhciBqID0gcG9zOyBqIDwgaTspIHtcbiAgICAgICAgICAgIGlmIChjb3VudHNBc051bS50ZXN0KHR5cGVzW2pdKSkge1xuICAgICAgICAgICAgICBpZiAocG9zIDwgaikgb3JkZXIuc3BsaWNlKGF0LCAwLCBuZXcgQmlkaVNwYW4oMSwgcG9zLCBqKSk7XG4gICAgICAgICAgICAgIHZhciBuc3RhcnQgPSBqO1xuICAgICAgICAgICAgICBmb3IgKCsrajsgaiA8IGkgJiYgY291bnRzQXNOdW0udGVzdCh0eXBlc1tqXSk7ICsraikge31cbiAgICAgICAgICAgICAgb3JkZXIuc3BsaWNlKGF0LCAwLCBuZXcgQmlkaVNwYW4oMiwgbnN0YXJ0LCBqKSk7XG4gICAgICAgICAgICAgIHBvcyA9IGo7XG4gICAgICAgICAgICB9IGVsc2UgKytqO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocG9zIDwgaSkgb3JkZXIuc3BsaWNlKGF0LCAwLCBuZXcgQmlkaVNwYW4oMSwgcG9zLCBpKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChvcmRlclswXS5sZXZlbCA9PSAxICYmIChtID0gc3RyLm1hdGNoKC9eXFxzKy8pKSkge1xuICAgICAgICBvcmRlclswXS5mcm9tID0gbVswXS5sZW5ndGg7XG4gICAgICAgIG9yZGVyLnVuc2hpZnQobmV3IEJpZGlTcGFuKDAsIDAsIG1bMF0ubGVuZ3RoKSk7XG4gICAgICB9XG4gICAgICBpZiAobHN0KG9yZGVyKS5sZXZlbCA9PSAxICYmIChtID0gc3RyLm1hdGNoKC9cXHMrJC8pKSkge1xuICAgICAgICBsc3Qob3JkZXIpLnRvIC09IG1bMF0ubGVuZ3RoO1xuICAgICAgICBvcmRlci5wdXNoKG5ldyBCaWRpU3BhbigwLCBsZW4gLSBtWzBdLmxlbmd0aCwgbGVuKSk7XG4gICAgICB9XG4gICAgICBpZiAob3JkZXJbMF0ubGV2ZWwgPT0gMilcbiAgICAgICAgb3JkZXIudW5zaGlmdChuZXcgQmlkaVNwYW4oMSwgb3JkZXJbMF0udG8sIG9yZGVyWzBdLnRvKSk7XG4gICAgICBpZiAob3JkZXJbMF0ubGV2ZWwgIT0gbHN0KG9yZGVyKS5sZXZlbClcbiAgICAgICAgb3JkZXIucHVzaChuZXcgQmlkaVNwYW4ob3JkZXJbMF0ubGV2ZWwsIGxlbiwgbGVuKSk7XG5cbiAgICAgIHJldHVybiBvcmRlcjtcbiAgICB9O1xuICB9KSgpO1xuXG4gIC8vIFRIRSBFTkRcblxuICBDb2RlTWlycm9yLnZlcnNpb24gPSBcIjUuOS4wXCI7XG5cbiAgcmV0dXJuIENvZGVNaXJyb3I7XG59KTtcbiIsIi8vIENvZGVNaXJyb3IsIGNvcHlyaWdodCAoYykgYnkgTWFyaWpuIEhhdmVyYmVrZSBhbmQgb3RoZXJzXG4vLyBEaXN0cmlidXRlZCB1bmRlciBhbiBNSVQgbGljZW5zZTogaHR0cDovL2NvZGVtaXJyb3IubmV0L0xJQ0VOU0VcblxuLy8gVE9ETyBhY3R1YWxseSByZWNvZ25pemUgc3ludGF4IG9mIFR5cGVTY3JpcHQgY29uc3RydWN0c1xuXG4oZnVuY3Rpb24obW9kKSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PSBcIm9iamVjdFwiICYmIHR5cGVvZiBtb2R1bGUgPT0gXCJvYmplY3RcIikgLy8gQ29tbW9uSlNcbiAgICBtb2QocmVxdWlyZShcIi4uLy4uL2xpYi9jb2RlbWlycm9yXCIpKTtcbiAgZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkgLy8gQU1EXG4gICAgZGVmaW5lKFtcIi4uLy4uL2xpYi9jb2RlbWlycm9yXCJdLCBtb2QpO1xuICBlbHNlIC8vIFBsYWluIGJyb3dzZXIgZW52XG4gICAgbW9kKENvZGVNaXJyb3IpO1xufSkoZnVuY3Rpb24oQ29kZU1pcnJvcikge1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbkNvZGVNaXJyb3IuZGVmaW5lTW9kZShcImphdmFzY3JpcHRcIiwgZnVuY3Rpb24oY29uZmlnLCBwYXJzZXJDb25maWcpIHtcbiAgdmFyIGluZGVudFVuaXQgPSBjb25maWcuaW5kZW50VW5pdDtcbiAgdmFyIHN0YXRlbWVudEluZGVudCA9IHBhcnNlckNvbmZpZy5zdGF0ZW1lbnRJbmRlbnQ7XG4gIHZhciBqc29ubGRNb2RlID0gcGFyc2VyQ29uZmlnLmpzb25sZDtcbiAgdmFyIGpzb25Nb2RlID0gcGFyc2VyQ29uZmlnLmpzb24gfHwganNvbmxkTW9kZTtcbiAgdmFyIGlzVFMgPSBwYXJzZXJDb25maWcudHlwZXNjcmlwdDtcbiAgdmFyIHdvcmRSRSA9IHBhcnNlckNvbmZpZy53b3JkQ2hhcmFjdGVycyB8fCAvW1xcdyRcXHhhMS1cXHVmZmZmXS87XG5cbiAgLy8gVG9rZW5pemVyXG5cbiAgdmFyIGtleXdvcmRzID0gZnVuY3Rpb24oKXtcbiAgICBmdW5jdGlvbiBrdyh0eXBlKSB7cmV0dXJuIHt0eXBlOiB0eXBlLCBzdHlsZTogXCJrZXl3b3JkXCJ9O31cbiAgICB2YXIgQSA9IGt3KFwia2V5d29yZCBhXCIpLCBCID0ga3coXCJrZXl3b3JkIGJcIiksIEMgPSBrdyhcImtleXdvcmQgY1wiKTtcbiAgICB2YXIgb3BlcmF0b3IgPSBrdyhcIm9wZXJhdG9yXCIpLCBhdG9tID0ge3R5cGU6IFwiYXRvbVwiLCBzdHlsZTogXCJhdG9tXCJ9O1xuXG4gICAgdmFyIGpzS2V5d29yZHMgPSB7XG4gICAgICBcImlmXCI6IGt3KFwiaWZcIiksIFwid2hpbGVcIjogQSwgXCJ3aXRoXCI6IEEsIFwiZWxzZVwiOiBCLCBcImRvXCI6IEIsIFwidHJ5XCI6IEIsIFwiZmluYWxseVwiOiBCLFxuICAgICAgXCJyZXR1cm5cIjogQywgXCJicmVha1wiOiBDLCBcImNvbnRpbnVlXCI6IEMsIFwibmV3XCI6IGt3KFwibmV3XCIpLCBcImRlbGV0ZVwiOiBDLCBcInRocm93XCI6IEMsIFwiZGVidWdnZXJcIjogQyxcbiAgICAgIFwidmFyXCI6IGt3KFwidmFyXCIpLCBcImNvbnN0XCI6IGt3KFwidmFyXCIpLCBcImxldFwiOiBrdyhcInZhclwiKSxcbiAgICAgIFwiZnVuY3Rpb25cIjoga3coXCJmdW5jdGlvblwiKSwgXCJjYXRjaFwiOiBrdyhcImNhdGNoXCIpLFxuICAgICAgXCJmb3JcIjoga3coXCJmb3JcIiksIFwic3dpdGNoXCI6IGt3KFwic3dpdGNoXCIpLCBcImNhc2VcIjoga3coXCJjYXNlXCIpLCBcImRlZmF1bHRcIjoga3coXCJkZWZhdWx0XCIpLFxuICAgICAgXCJpblwiOiBvcGVyYXRvciwgXCJ0eXBlb2ZcIjogb3BlcmF0b3IsIFwiaW5zdGFuY2VvZlwiOiBvcGVyYXRvcixcbiAgICAgIFwidHJ1ZVwiOiBhdG9tLCBcImZhbHNlXCI6IGF0b20sIFwibnVsbFwiOiBhdG9tLCBcInVuZGVmaW5lZFwiOiBhdG9tLCBcIk5hTlwiOiBhdG9tLCBcIkluZmluaXR5XCI6IGF0b20sXG4gICAgICBcInRoaXNcIjoga3coXCJ0aGlzXCIpLCBcImNsYXNzXCI6IGt3KFwiY2xhc3NcIiksIFwic3VwZXJcIjoga3coXCJhdG9tXCIpLFxuICAgICAgXCJ5aWVsZFwiOiBDLCBcImV4cG9ydFwiOiBrdyhcImV4cG9ydFwiKSwgXCJpbXBvcnRcIjoga3coXCJpbXBvcnRcIiksIFwiZXh0ZW5kc1wiOiBDXG4gICAgfTtcblxuICAgIC8vIEV4dGVuZCB0aGUgJ25vcm1hbCcga2V5d29yZHMgd2l0aCB0aGUgVHlwZVNjcmlwdCBsYW5ndWFnZSBleHRlbnNpb25zXG4gICAgaWYgKGlzVFMpIHtcbiAgICAgIHZhciB0eXBlID0ge3R5cGU6IFwidmFyaWFibGVcIiwgc3R5bGU6IFwidmFyaWFibGUtM1wifTtcbiAgICAgIHZhciB0c0tleXdvcmRzID0ge1xuICAgICAgICAvLyBvYmplY3QtbGlrZSB0aGluZ3NcbiAgICAgICAgXCJpbnRlcmZhY2VcIjoga3coXCJpbnRlcmZhY2VcIiksXG4gICAgICAgIFwiZXh0ZW5kc1wiOiBrdyhcImV4dGVuZHNcIiksXG4gICAgICAgIFwiY29uc3RydWN0b3JcIjoga3coXCJjb25zdHJ1Y3RvclwiKSxcblxuICAgICAgICAvLyBzY29wZSBtb2RpZmllcnNcbiAgICAgICAgXCJwdWJsaWNcIjoga3coXCJwdWJsaWNcIiksXG4gICAgICAgIFwicHJpdmF0ZVwiOiBrdyhcInByaXZhdGVcIiksXG4gICAgICAgIFwicHJvdGVjdGVkXCI6IGt3KFwicHJvdGVjdGVkXCIpLFxuICAgICAgICBcInN0YXRpY1wiOiBrdyhcInN0YXRpY1wiKSxcblxuICAgICAgICAvLyB0eXBlc1xuICAgICAgICBcInN0cmluZ1wiOiB0eXBlLCBcIm51bWJlclwiOiB0eXBlLCBcImJvb2xlYW5cIjogdHlwZSwgXCJhbnlcIjogdHlwZVxuICAgICAgfTtcblxuICAgICAgZm9yICh2YXIgYXR0ciBpbiB0c0tleXdvcmRzKSB7XG4gICAgICAgIGpzS2V5d29yZHNbYXR0cl0gPSB0c0tleXdvcmRzW2F0dHJdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBqc0tleXdvcmRzO1xuICB9KCk7XG5cbiAgdmFyIGlzT3BlcmF0b3JDaGFyID0gL1srXFwtKiYlPTw+IT98fl5dLztcbiAgdmFyIGlzSnNvbmxkS2V5d29yZCA9IC9eQChjb250ZXh0fGlkfHZhbHVlfGxhbmd1YWdlfHR5cGV8Y29udGFpbmVyfGxpc3R8c2V0fHJldmVyc2V8aW5kZXh8YmFzZXx2b2NhYnxncmFwaClcIi87XG5cbiAgZnVuY3Rpb24gcmVhZFJlZ2V4cChzdHJlYW0pIHtcbiAgICB2YXIgZXNjYXBlZCA9IGZhbHNlLCBuZXh0LCBpblNldCA9IGZhbHNlO1xuICAgIHdoaWxlICgobmV4dCA9IHN0cmVhbS5uZXh0KCkpICE9IG51bGwpIHtcbiAgICAgIGlmICghZXNjYXBlZCkge1xuICAgICAgICBpZiAobmV4dCA9PSBcIi9cIiAmJiAhaW5TZXQpIHJldHVybjtcbiAgICAgICAgaWYgKG5leHQgPT0gXCJbXCIpIGluU2V0ID0gdHJ1ZTtcbiAgICAgICAgZWxzZSBpZiAoaW5TZXQgJiYgbmV4dCA9PSBcIl1cIikgaW5TZXQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGVzY2FwZWQgPSAhZXNjYXBlZCAmJiBuZXh0ID09IFwiXFxcXFwiO1xuICAgIH1cbiAgfVxuXG4gIC8vIFVzZWQgYXMgc2NyYXRjaCB2YXJpYWJsZXMgdG8gY29tbXVuaWNhdGUgbXVsdGlwbGUgdmFsdWVzIHdpdGhvdXRcbiAgLy8gY29uc2luZyB1cCB0b25zIG9mIG9iamVjdHMuXG4gIHZhciB0eXBlLCBjb250ZW50O1xuICBmdW5jdGlvbiByZXQodHAsIHN0eWxlLCBjb250KSB7XG4gICAgdHlwZSA9IHRwOyBjb250ZW50ID0gY29udDtcbiAgICByZXR1cm4gc3R5bGU7XG4gIH1cbiAgZnVuY3Rpb24gdG9rZW5CYXNlKHN0cmVhbSwgc3RhdGUpIHtcbiAgICB2YXIgY2ggPSBzdHJlYW0ubmV4dCgpO1xuICAgIGlmIChjaCA9PSAnXCInIHx8IGNoID09IFwiJ1wiKSB7XG4gICAgICBzdGF0ZS50b2tlbml6ZSA9IHRva2VuU3RyaW5nKGNoKTtcbiAgICAgIHJldHVybiBzdGF0ZS50b2tlbml6ZShzdHJlYW0sIHN0YXRlKTtcbiAgICB9IGVsc2UgaWYgKGNoID09IFwiLlwiICYmIHN0cmVhbS5tYXRjaCgvXlxcZCsoPzpbZUVdWytcXC1dP1xcZCspPy8pKSB7XG4gICAgICByZXR1cm4gcmV0KFwibnVtYmVyXCIsIFwibnVtYmVyXCIpO1xuICAgIH0gZWxzZSBpZiAoY2ggPT0gXCIuXCIgJiYgc3RyZWFtLm1hdGNoKFwiLi5cIikpIHtcbiAgICAgIHJldHVybiByZXQoXCJzcHJlYWRcIiwgXCJtZXRhXCIpO1xuICAgIH0gZWxzZSBpZiAoL1tcXFtcXF17fVxcKFxcKSw7XFw6XFwuXS8udGVzdChjaCkpIHtcbiAgICAgIHJldHVybiByZXQoY2gpO1xuICAgIH0gZWxzZSBpZiAoY2ggPT0gXCI9XCIgJiYgc3RyZWFtLmVhdChcIj5cIikpIHtcbiAgICAgIHJldHVybiByZXQoXCI9PlwiLCBcIm9wZXJhdG9yXCIpO1xuICAgIH0gZWxzZSBpZiAoY2ggPT0gXCIwXCIgJiYgc3RyZWFtLmVhdCgveC9pKSkge1xuICAgICAgc3RyZWFtLmVhdFdoaWxlKC9bXFxkYS1mXS9pKTtcbiAgICAgIHJldHVybiByZXQoXCJudW1iZXJcIiwgXCJudW1iZXJcIik7XG4gICAgfSBlbHNlIGlmIChjaCA9PSBcIjBcIiAmJiBzdHJlYW0uZWF0KC9vL2kpKSB7XG4gICAgICBzdHJlYW0uZWF0V2hpbGUoL1swLTddL2kpO1xuICAgICAgcmV0dXJuIHJldChcIm51bWJlclwiLCBcIm51bWJlclwiKTtcbiAgICB9IGVsc2UgaWYgKGNoID09IFwiMFwiICYmIHN0cmVhbS5lYXQoL2IvaSkpIHtcbiAgICAgIHN0cmVhbS5lYXRXaGlsZSgvWzAxXS9pKTtcbiAgICAgIHJldHVybiByZXQoXCJudW1iZXJcIiwgXCJudW1iZXJcIik7XG4gICAgfSBlbHNlIGlmICgvXFxkLy50ZXN0KGNoKSkge1xuICAgICAgc3RyZWFtLm1hdGNoKC9eXFxkKig/OlxcLlxcZCopPyg/OltlRV1bK1xcLV0/XFxkKyk/Lyk7XG4gICAgICByZXR1cm4gcmV0KFwibnVtYmVyXCIsIFwibnVtYmVyXCIpO1xuICAgIH0gZWxzZSBpZiAoY2ggPT0gXCIvXCIpIHtcbiAgICAgIGlmIChzdHJlYW0uZWF0KFwiKlwiKSkge1xuICAgICAgICBzdGF0ZS50b2tlbml6ZSA9IHRva2VuQ29tbWVudDtcbiAgICAgICAgcmV0dXJuIHRva2VuQ29tbWVudChzdHJlYW0sIHN0YXRlKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RyZWFtLmVhdChcIi9cIikpIHtcbiAgICAgICAgc3RyZWFtLnNraXBUb0VuZCgpO1xuICAgICAgICByZXR1cm4gcmV0KFwiY29tbWVudFwiLCBcImNvbW1lbnRcIik7XG4gICAgICB9IGVsc2UgaWYgKC9eKD86b3BlcmF0b3J8c29mfGtleXdvcmQgY3xjYXNlfG5ld3xbXFxbe31cXCgsOzpdKSQvLnRlc3Qoc3RhdGUubGFzdFR5cGUpKSB7XG4gICAgICAgIHJlYWRSZWdleHAoc3RyZWFtKTtcbiAgICAgICAgc3RyZWFtLm1hdGNoKC9eXFxiKChbZ2lteXVdKSg/IVtnaW15dV0qXFwyKSkrXFxiLyk7XG4gICAgICAgIHJldHVybiByZXQoXCJyZWdleHBcIiwgXCJzdHJpbmctMlwiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0cmVhbS5lYXRXaGlsZShpc09wZXJhdG9yQ2hhcik7XG4gICAgICAgIHJldHVybiByZXQoXCJvcGVyYXRvclwiLCBcIm9wZXJhdG9yXCIsIHN0cmVhbS5jdXJyZW50KCkpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2ggPT0gXCJgXCIpIHtcbiAgICAgIHN0YXRlLnRva2VuaXplID0gdG9rZW5RdWFzaTtcbiAgICAgIHJldHVybiB0b2tlblF1YXNpKHN0cmVhbSwgc3RhdGUpO1xuICAgIH0gZWxzZSBpZiAoY2ggPT0gXCIjXCIpIHtcbiAgICAgIHN0cmVhbS5za2lwVG9FbmQoKTtcbiAgICAgIHJldHVybiByZXQoXCJlcnJvclwiLCBcImVycm9yXCIpO1xuICAgIH0gZWxzZSBpZiAoaXNPcGVyYXRvckNoYXIudGVzdChjaCkpIHtcbiAgICAgIHN0cmVhbS5lYXRXaGlsZShpc09wZXJhdG9yQ2hhcik7XG4gICAgICByZXR1cm4gcmV0KFwib3BlcmF0b3JcIiwgXCJvcGVyYXRvclwiLCBzdHJlYW0uY3VycmVudCgpKTtcbiAgICB9IGVsc2UgaWYgKHdvcmRSRS50ZXN0KGNoKSkge1xuICAgICAgc3RyZWFtLmVhdFdoaWxlKHdvcmRSRSk7XG4gICAgICB2YXIgd29yZCA9IHN0cmVhbS5jdXJyZW50KCksIGtub3duID0ga2V5d29yZHMucHJvcGVydHlJc0VudW1lcmFibGUod29yZCkgJiYga2V5d29yZHNbd29yZF07XG4gICAgICByZXR1cm4gKGtub3duICYmIHN0YXRlLmxhc3RUeXBlICE9IFwiLlwiKSA/IHJldChrbm93bi50eXBlLCBrbm93bi5zdHlsZSwgd29yZCkgOlxuICAgICAgICAgICAgICAgICAgICAgcmV0KFwidmFyaWFibGVcIiwgXCJ2YXJpYWJsZVwiLCB3b3JkKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB0b2tlblN0cmluZyhxdW90ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW0sIHN0YXRlKSB7XG4gICAgICB2YXIgZXNjYXBlZCA9IGZhbHNlLCBuZXh0O1xuICAgICAgaWYgKGpzb25sZE1vZGUgJiYgc3RyZWFtLnBlZWsoKSA9PSBcIkBcIiAmJiBzdHJlYW0ubWF0Y2goaXNKc29ubGRLZXl3b3JkKSl7XG4gICAgICAgIHN0YXRlLnRva2VuaXplID0gdG9rZW5CYXNlO1xuICAgICAgICByZXR1cm4gcmV0KFwianNvbmxkLWtleXdvcmRcIiwgXCJtZXRhXCIpO1xuICAgICAgfVxuICAgICAgd2hpbGUgKChuZXh0ID0gc3RyZWFtLm5leHQoKSkgIT0gbnVsbCkge1xuICAgICAgICBpZiAobmV4dCA9PSBxdW90ZSAmJiAhZXNjYXBlZCkgYnJlYWs7XG4gICAgICAgIGVzY2FwZWQgPSAhZXNjYXBlZCAmJiBuZXh0ID09IFwiXFxcXFwiO1xuICAgICAgfVxuICAgICAgaWYgKCFlc2NhcGVkKSBzdGF0ZS50b2tlbml6ZSA9IHRva2VuQmFzZTtcbiAgICAgIHJldHVybiByZXQoXCJzdHJpbmdcIiwgXCJzdHJpbmdcIik7XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRva2VuQ29tbWVudChzdHJlYW0sIHN0YXRlKSB7XG4gICAgdmFyIG1heWJlRW5kID0gZmFsc2UsIGNoO1xuICAgIHdoaWxlIChjaCA9IHN0cmVhbS5uZXh0KCkpIHtcbiAgICAgIGlmIChjaCA9PSBcIi9cIiAmJiBtYXliZUVuZCkge1xuICAgICAgICBzdGF0ZS50b2tlbml6ZSA9IHRva2VuQmFzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBtYXliZUVuZCA9IChjaCA9PSBcIipcIik7XG4gICAgfVxuICAgIHJldHVybiByZXQoXCJjb21tZW50XCIsIFwiY29tbWVudFwiKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRva2VuUXVhc2koc3RyZWFtLCBzdGF0ZSkge1xuICAgIHZhciBlc2NhcGVkID0gZmFsc2UsIG5leHQ7XG4gICAgd2hpbGUgKChuZXh0ID0gc3RyZWFtLm5leHQoKSkgIT0gbnVsbCkge1xuICAgICAgaWYgKCFlc2NhcGVkICYmIChuZXh0ID09IFwiYFwiIHx8IG5leHQgPT0gXCIkXCIgJiYgc3RyZWFtLmVhdChcIntcIikpKSB7XG4gICAgICAgIHN0YXRlLnRva2VuaXplID0gdG9rZW5CYXNlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGVzY2FwZWQgPSAhZXNjYXBlZCAmJiBuZXh0ID09IFwiXFxcXFwiO1xuICAgIH1cbiAgICByZXR1cm4gcmV0KFwicXVhc2lcIiwgXCJzdHJpbmctMlwiLCBzdHJlYW0uY3VycmVudCgpKTtcbiAgfVxuXG4gIHZhciBicmFja2V0cyA9IFwiKFt7fV0pXCI7XG4gIC8vIFRoaXMgaXMgYSBjcnVkZSBsb29rYWhlYWQgdHJpY2sgdG8gdHJ5IGFuZCBub3RpY2UgdGhhdCB3ZSdyZVxuICAvLyBwYXJzaW5nIHRoZSBhcmd1bWVudCBwYXR0ZXJucyBmb3IgYSBmYXQtYXJyb3cgZnVuY3Rpb24gYmVmb3JlIHdlXG4gIC8vIGFjdHVhbGx5IGhpdCB0aGUgYXJyb3cgdG9rZW4uIEl0IG9ubHkgd29ya3MgaWYgdGhlIGFycm93IGlzIG9uXG4gIC8vIHRoZSBzYW1lIGxpbmUgYXMgdGhlIGFyZ3VtZW50cyBhbmQgdGhlcmUncyBubyBzdHJhbmdlIG5vaXNlXG4gIC8vIChjb21tZW50cykgaW4gYmV0d2Vlbi4gRmFsbGJhY2sgaXMgdG8gb25seSBub3RpY2Ugd2hlbiB3ZSBoaXQgdGhlXG4gIC8vIGFycm93LCBhbmQgbm90IGRlY2xhcmUgdGhlIGFyZ3VtZW50cyBhcyBsb2NhbHMgZm9yIHRoZSBhcnJvd1xuICAvLyBib2R5LlxuICBmdW5jdGlvbiBmaW5kRmF0QXJyb3coc3RyZWFtLCBzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5mYXRBcnJvd0F0KSBzdGF0ZS5mYXRBcnJvd0F0ID0gbnVsbDtcbiAgICB2YXIgYXJyb3cgPSBzdHJlYW0uc3RyaW5nLmluZGV4T2YoXCI9PlwiLCBzdHJlYW0uc3RhcnQpO1xuICAgIGlmIChhcnJvdyA8IDApIHJldHVybjtcblxuICAgIHZhciBkZXB0aCA9IDAsIHNhd1NvbWV0aGluZyA9IGZhbHNlO1xuICAgIGZvciAodmFyIHBvcyA9IGFycm93IC0gMTsgcG9zID49IDA7IC0tcG9zKSB7XG4gICAgICB2YXIgY2ggPSBzdHJlYW0uc3RyaW5nLmNoYXJBdChwb3MpO1xuICAgICAgdmFyIGJyYWNrZXQgPSBicmFja2V0cy5pbmRleE9mKGNoKTtcbiAgICAgIGlmIChicmFja2V0ID49IDAgJiYgYnJhY2tldCA8IDMpIHtcbiAgICAgICAgaWYgKCFkZXB0aCkgeyArK3BvczsgYnJlYWs7IH1cbiAgICAgICAgaWYgKC0tZGVwdGggPT0gMCkgYnJlYWs7XG4gICAgICB9IGVsc2UgaWYgKGJyYWNrZXQgPj0gMyAmJiBicmFja2V0IDwgNikge1xuICAgICAgICArK2RlcHRoO1xuICAgICAgfSBlbHNlIGlmICh3b3JkUkUudGVzdChjaCkpIHtcbiAgICAgICAgc2F3U29tZXRoaW5nID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoL1tcIidcXC9dLy50ZXN0KGNoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHNhd1NvbWV0aGluZyAmJiAhZGVwdGgpIHtcbiAgICAgICAgKytwb3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoc2F3U29tZXRoaW5nICYmICFkZXB0aCkgc3RhdGUuZmF0QXJyb3dBdCA9IHBvcztcbiAgfVxuXG4gIC8vIFBhcnNlclxuXG4gIHZhciBhdG9taWNUeXBlcyA9IHtcImF0b21cIjogdHJ1ZSwgXCJudW1iZXJcIjogdHJ1ZSwgXCJ2YXJpYWJsZVwiOiB0cnVlLCBcInN0cmluZ1wiOiB0cnVlLCBcInJlZ2V4cFwiOiB0cnVlLCBcInRoaXNcIjogdHJ1ZSwgXCJqc29ubGQta2V5d29yZFwiOiB0cnVlfTtcblxuICBmdW5jdGlvbiBKU0xleGljYWwoaW5kZW50ZWQsIGNvbHVtbiwgdHlwZSwgYWxpZ24sIHByZXYsIGluZm8pIHtcbiAgICB0aGlzLmluZGVudGVkID0gaW5kZW50ZWQ7XG4gICAgdGhpcy5jb2x1bW4gPSBjb2x1bW47XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLnByZXYgPSBwcmV2O1xuICAgIHRoaXMuaW5mbyA9IGluZm87XG4gICAgaWYgKGFsaWduICE9IG51bGwpIHRoaXMuYWxpZ24gPSBhbGlnbjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGluU2NvcGUoc3RhdGUsIHZhcm5hbWUpIHtcbiAgICBmb3IgKHZhciB2ID0gc3RhdGUubG9jYWxWYXJzOyB2OyB2ID0gdi5uZXh0KVxuICAgICAgaWYgKHYubmFtZSA9PSB2YXJuYW1lKSByZXR1cm4gdHJ1ZTtcbiAgICBmb3IgKHZhciBjeCA9IHN0YXRlLmNvbnRleHQ7IGN4OyBjeCA9IGN4LnByZXYpIHtcbiAgICAgIGZvciAodmFyIHYgPSBjeC52YXJzOyB2OyB2ID0gdi5uZXh0KVxuICAgICAgICBpZiAodi5uYW1lID09IHZhcm5hbWUpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlSlMoc3RhdGUsIHN0eWxlLCB0eXBlLCBjb250ZW50LCBzdHJlYW0pIHtcbiAgICB2YXIgY2MgPSBzdGF0ZS5jYztcbiAgICAvLyBDb21tdW5pY2F0ZSBvdXIgY29udGV4dCB0byB0aGUgY29tYmluYXRvcnMuXG4gICAgLy8gKExlc3Mgd2FzdGVmdWwgdGhhbiBjb25zaW5nIHVwIGEgaHVuZHJlZCBjbG9zdXJlcyBvbiBldmVyeSBjYWxsLilcbiAgICBjeC5zdGF0ZSA9IHN0YXRlOyBjeC5zdHJlYW0gPSBzdHJlYW07IGN4Lm1hcmtlZCA9IG51bGwsIGN4LmNjID0gY2M7IGN4LnN0eWxlID0gc3R5bGU7XG5cbiAgICBpZiAoIXN0YXRlLmxleGljYWwuaGFzT3duUHJvcGVydHkoXCJhbGlnblwiKSlcbiAgICAgIHN0YXRlLmxleGljYWwuYWxpZ24gPSB0cnVlO1xuXG4gICAgd2hpbGUodHJ1ZSkge1xuICAgICAgdmFyIGNvbWJpbmF0b3IgPSBjYy5sZW5ndGggPyBjYy5wb3AoKSA6IGpzb25Nb2RlID8gZXhwcmVzc2lvbiA6IHN0YXRlbWVudDtcbiAgICAgIGlmIChjb21iaW5hdG9yKHR5cGUsIGNvbnRlbnQpKSB7XG4gICAgICAgIHdoaWxlKGNjLmxlbmd0aCAmJiBjY1tjYy5sZW5ndGggLSAxXS5sZXgpXG4gICAgICAgICAgY2MucG9wKCkoKTtcbiAgICAgICAgaWYgKGN4Lm1hcmtlZCkgcmV0dXJuIGN4Lm1hcmtlZDtcbiAgICAgICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiICYmIGluU2NvcGUoc3RhdGUsIGNvbnRlbnQpKSByZXR1cm4gXCJ2YXJpYWJsZS0yXCI7XG4gICAgICAgIHJldHVybiBzdHlsZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBDb21iaW5hdG9yIHV0aWxzXG5cbiAgdmFyIGN4ID0ge3N0YXRlOiBudWxsLCBjb2x1bW46IG51bGwsIG1hcmtlZDogbnVsbCwgY2M6IG51bGx9O1xuICBmdW5jdGlvbiBwYXNzKCkge1xuICAgIGZvciAodmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGN4LmNjLnB1c2goYXJndW1lbnRzW2ldKTtcbiAgfVxuICBmdW5jdGlvbiBjb250KCkge1xuICAgIHBhc3MuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBmdW5jdGlvbiByZWdpc3Rlcih2YXJuYW1lKSB7XG4gICAgZnVuY3Rpb24gaW5MaXN0KGxpc3QpIHtcbiAgICAgIGZvciAodmFyIHYgPSBsaXN0OyB2OyB2ID0gdi5uZXh0KVxuICAgICAgICBpZiAodi5uYW1lID09IHZhcm5hbWUpIHJldHVybiB0cnVlO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB2YXIgc3RhdGUgPSBjeC5zdGF0ZTtcbiAgICBjeC5tYXJrZWQgPSBcImRlZlwiO1xuICAgIGlmIChzdGF0ZS5jb250ZXh0KSB7XG4gICAgICBpZiAoaW5MaXN0KHN0YXRlLmxvY2FsVmFycykpIHJldHVybjtcbiAgICAgIHN0YXRlLmxvY2FsVmFycyA9IHtuYW1lOiB2YXJuYW1lLCBuZXh0OiBzdGF0ZS5sb2NhbFZhcnN9O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaW5MaXN0KHN0YXRlLmdsb2JhbFZhcnMpKSByZXR1cm47XG4gICAgICBpZiAocGFyc2VyQ29uZmlnLmdsb2JhbFZhcnMpXG4gICAgICAgIHN0YXRlLmdsb2JhbFZhcnMgPSB7bmFtZTogdmFybmFtZSwgbmV4dDogc3RhdGUuZ2xvYmFsVmFyc307XG4gICAgfVxuICB9XG5cbiAgLy8gQ29tYmluYXRvcnNcblxuICB2YXIgZGVmYXVsdFZhcnMgPSB7bmFtZTogXCJ0aGlzXCIsIG5leHQ6IHtuYW1lOiBcImFyZ3VtZW50c1wifX07XG4gIGZ1bmN0aW9uIHB1c2hjb250ZXh0KCkge1xuICAgIGN4LnN0YXRlLmNvbnRleHQgPSB7cHJldjogY3guc3RhdGUuY29udGV4dCwgdmFyczogY3guc3RhdGUubG9jYWxWYXJzfTtcbiAgICBjeC5zdGF0ZS5sb2NhbFZhcnMgPSBkZWZhdWx0VmFycztcbiAgfVxuICBmdW5jdGlvbiBwb3Bjb250ZXh0KCkge1xuICAgIGN4LnN0YXRlLmxvY2FsVmFycyA9IGN4LnN0YXRlLmNvbnRleHQudmFycztcbiAgICBjeC5zdGF0ZS5jb250ZXh0ID0gY3guc3RhdGUuY29udGV4dC5wcmV2O1xuICB9XG4gIGZ1bmN0aW9uIHB1c2hsZXgodHlwZSwgaW5mbykge1xuICAgIHZhciByZXN1bHQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzdGF0ZSA9IGN4LnN0YXRlLCBpbmRlbnQgPSBzdGF0ZS5pbmRlbnRlZDtcbiAgICAgIGlmIChzdGF0ZS5sZXhpY2FsLnR5cGUgPT0gXCJzdGF0XCIpIGluZGVudCA9IHN0YXRlLmxleGljYWwuaW5kZW50ZWQ7XG4gICAgICBlbHNlIGZvciAodmFyIG91dGVyID0gc3RhdGUubGV4aWNhbDsgb3V0ZXIgJiYgb3V0ZXIudHlwZSA9PSBcIilcIiAmJiBvdXRlci5hbGlnbjsgb3V0ZXIgPSBvdXRlci5wcmV2KVxuICAgICAgICBpbmRlbnQgPSBvdXRlci5pbmRlbnRlZDtcbiAgICAgIHN0YXRlLmxleGljYWwgPSBuZXcgSlNMZXhpY2FsKGluZGVudCwgY3guc3RyZWFtLmNvbHVtbigpLCB0eXBlLCBudWxsLCBzdGF0ZS5sZXhpY2FsLCBpbmZvKTtcbiAgICB9O1xuICAgIHJlc3VsdC5sZXggPSB0cnVlO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZnVuY3Rpb24gcG9wbGV4KCkge1xuICAgIHZhciBzdGF0ZSA9IGN4LnN0YXRlO1xuICAgIGlmIChzdGF0ZS5sZXhpY2FsLnByZXYpIHtcbiAgICAgIGlmIChzdGF0ZS5sZXhpY2FsLnR5cGUgPT0gXCIpXCIpXG4gICAgICAgIHN0YXRlLmluZGVudGVkID0gc3RhdGUubGV4aWNhbC5pbmRlbnRlZDtcbiAgICAgIHN0YXRlLmxleGljYWwgPSBzdGF0ZS5sZXhpY2FsLnByZXY7XG4gICAgfVxuICB9XG4gIHBvcGxleC5sZXggPSB0cnVlO1xuXG4gIGZ1bmN0aW9uIGV4cGVjdCh3YW50ZWQpIHtcbiAgICBmdW5jdGlvbiBleHAodHlwZSkge1xuICAgICAgaWYgKHR5cGUgPT0gd2FudGVkKSByZXR1cm4gY29udCgpO1xuICAgICAgZWxzZSBpZiAod2FudGVkID09IFwiO1wiKSByZXR1cm4gcGFzcygpO1xuICAgICAgZWxzZSByZXR1cm4gY29udChleHApO1xuICAgIH07XG4gICAgcmV0dXJuIGV4cDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0YXRlbWVudCh0eXBlLCB2YWx1ZSkge1xuICAgIGlmICh0eXBlID09IFwidmFyXCIpIHJldHVybiBjb250KHB1c2hsZXgoXCJ2YXJkZWZcIiwgdmFsdWUubGVuZ3RoKSwgdmFyZGVmLCBleHBlY3QoXCI7XCIpLCBwb3BsZXgpO1xuICAgIGlmICh0eXBlID09IFwia2V5d29yZCBhXCIpIHJldHVybiBjb250KHB1c2hsZXgoXCJmb3JtXCIpLCBleHByZXNzaW9uLCBzdGF0ZW1lbnQsIHBvcGxleCk7XG4gICAgaWYgKHR5cGUgPT0gXCJrZXl3b3JkIGJcIikgcmV0dXJuIGNvbnQocHVzaGxleChcImZvcm1cIiksIHN0YXRlbWVudCwgcG9wbGV4KTtcbiAgICBpZiAodHlwZSA9PSBcIntcIikgcmV0dXJuIGNvbnQocHVzaGxleChcIn1cIiksIGJsb2NrLCBwb3BsZXgpO1xuICAgIGlmICh0eXBlID09IFwiO1wiKSByZXR1cm4gY29udCgpO1xuICAgIGlmICh0eXBlID09IFwiaWZcIikge1xuICAgICAgaWYgKGN4LnN0YXRlLmxleGljYWwuaW5mbyA9PSBcImVsc2VcIiAmJiBjeC5zdGF0ZS5jY1tjeC5zdGF0ZS5jYy5sZW5ndGggLSAxXSA9PSBwb3BsZXgpXG4gICAgICAgIGN4LnN0YXRlLmNjLnBvcCgpKCk7XG4gICAgICByZXR1cm4gY29udChwdXNobGV4KFwiZm9ybVwiKSwgZXhwcmVzc2lvbiwgc3RhdGVtZW50LCBwb3BsZXgsIG1heWJlZWxzZSk7XG4gICAgfVxuICAgIGlmICh0eXBlID09IFwiZnVuY3Rpb25cIikgcmV0dXJuIGNvbnQoZnVuY3Rpb25kZWYpO1xuICAgIGlmICh0eXBlID09IFwiZm9yXCIpIHJldHVybiBjb250KHB1c2hsZXgoXCJmb3JtXCIpLCBmb3JzcGVjLCBzdGF0ZW1lbnQsIHBvcGxleCk7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiKSByZXR1cm4gY29udChwdXNobGV4KFwic3RhdFwiKSwgbWF5YmVsYWJlbCk7XG4gICAgaWYgKHR5cGUgPT0gXCJzd2l0Y2hcIikgcmV0dXJuIGNvbnQocHVzaGxleChcImZvcm1cIiksIGV4cHJlc3Npb24sIHB1c2hsZXgoXCJ9XCIsIFwic3dpdGNoXCIpLCBleHBlY3QoXCJ7XCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBibG9jaywgcG9wbGV4LCBwb3BsZXgpO1xuICAgIGlmICh0eXBlID09IFwiY2FzZVwiKSByZXR1cm4gY29udChleHByZXNzaW9uLCBleHBlY3QoXCI6XCIpKTtcbiAgICBpZiAodHlwZSA9PSBcImRlZmF1bHRcIikgcmV0dXJuIGNvbnQoZXhwZWN0KFwiOlwiKSk7XG4gICAgaWYgKHR5cGUgPT0gXCJjYXRjaFwiKSByZXR1cm4gY29udChwdXNobGV4KFwiZm9ybVwiKSwgcHVzaGNvbnRleHQsIGV4cGVjdChcIihcIiksIGZ1bmFyZywgZXhwZWN0KFwiKVwiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZW1lbnQsIHBvcGxleCwgcG9wY29udGV4dCk7XG4gICAgaWYgKHR5cGUgPT0gXCJjbGFzc1wiKSByZXR1cm4gY29udChwdXNobGV4KFwiZm9ybVwiKSwgY2xhc3NOYW1lLCBwb3BsZXgpO1xuICAgIGlmICh0eXBlID09IFwiZXhwb3J0XCIpIHJldHVybiBjb250KHB1c2hsZXgoXCJzdGF0XCIpLCBhZnRlckV4cG9ydCwgcG9wbGV4KTtcbiAgICBpZiAodHlwZSA9PSBcImltcG9ydFwiKSByZXR1cm4gY29udChwdXNobGV4KFwic3RhdFwiKSwgYWZ0ZXJJbXBvcnQsIHBvcGxleCk7XG4gICAgcmV0dXJuIHBhc3MocHVzaGxleChcInN0YXRcIiksIGV4cHJlc3Npb24sIGV4cGVjdChcIjtcIiksIHBvcGxleCk7XG4gIH1cbiAgZnVuY3Rpb24gZXhwcmVzc2lvbih0eXBlKSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb25Jbm5lcih0eXBlLCBmYWxzZSk7XG4gIH1cbiAgZnVuY3Rpb24gZXhwcmVzc2lvbk5vQ29tbWEodHlwZSkge1xuICAgIHJldHVybiBleHByZXNzaW9uSW5uZXIodHlwZSwgdHJ1ZSk7XG4gIH1cbiAgZnVuY3Rpb24gZXhwcmVzc2lvbklubmVyKHR5cGUsIG5vQ29tbWEpIHtcbiAgICBpZiAoY3guc3RhdGUuZmF0QXJyb3dBdCA9PSBjeC5zdHJlYW0uc3RhcnQpIHtcbiAgICAgIHZhciBib2R5ID0gbm9Db21tYSA/IGFycm93Qm9keU5vQ29tbWEgOiBhcnJvd0JvZHk7XG4gICAgICBpZiAodHlwZSA9PSBcIihcIikgcmV0dXJuIGNvbnQocHVzaGNvbnRleHQsIHB1c2hsZXgoXCIpXCIpLCBjb21tYXNlcChwYXR0ZXJuLCBcIilcIiksIHBvcGxleCwgZXhwZWN0KFwiPT5cIiksIGJvZHksIHBvcGNvbnRleHQpO1xuICAgICAgZWxzZSBpZiAodHlwZSA9PSBcInZhcmlhYmxlXCIpIHJldHVybiBwYXNzKHB1c2hjb250ZXh0LCBwYXR0ZXJuLCBleHBlY3QoXCI9PlwiKSwgYm9keSwgcG9wY29udGV4dCk7XG4gICAgfVxuXG4gICAgdmFyIG1heWJlb3AgPSBub0NvbW1hID8gbWF5YmVvcGVyYXRvck5vQ29tbWEgOiBtYXliZW9wZXJhdG9yQ29tbWE7XG4gICAgaWYgKGF0b21pY1R5cGVzLmhhc093blByb3BlcnR5KHR5cGUpKSByZXR1cm4gY29udChtYXliZW9wKTtcbiAgICBpZiAodHlwZSA9PSBcImZ1bmN0aW9uXCIpIHJldHVybiBjb250KGZ1bmN0aW9uZGVmLCBtYXliZW9wKTtcbiAgICBpZiAodHlwZSA9PSBcImtleXdvcmQgY1wiKSByZXR1cm4gY29udChub0NvbW1hID8gbWF5YmVleHByZXNzaW9uTm9Db21tYSA6IG1heWJlZXhwcmVzc2lvbik7XG4gICAgaWYgKHR5cGUgPT0gXCIoXCIpIHJldHVybiBjb250KHB1c2hsZXgoXCIpXCIpLCBtYXliZWV4cHJlc3Npb24sIGNvbXByZWhlbnNpb24sIGV4cGVjdChcIilcIiksIHBvcGxleCwgbWF5YmVvcCk7XG4gICAgaWYgKHR5cGUgPT0gXCJvcGVyYXRvclwiIHx8IHR5cGUgPT0gXCJzcHJlYWRcIikgcmV0dXJuIGNvbnQobm9Db21tYSA/IGV4cHJlc3Npb25Ob0NvbW1hIDogZXhwcmVzc2lvbik7XG4gICAgaWYgKHR5cGUgPT0gXCJbXCIpIHJldHVybiBjb250KHB1c2hsZXgoXCJdXCIpLCBhcnJheUxpdGVyYWwsIHBvcGxleCwgbWF5YmVvcCk7XG4gICAgaWYgKHR5cGUgPT0gXCJ7XCIpIHJldHVybiBjb250Q29tbWFzZXAob2JqcHJvcCwgXCJ9XCIsIG51bGwsIG1heWJlb3ApO1xuICAgIGlmICh0eXBlID09IFwicXVhc2lcIikgcmV0dXJuIHBhc3MocXVhc2ksIG1heWJlb3ApO1xuICAgIGlmICh0eXBlID09IFwibmV3XCIpIHJldHVybiBjb250KG1heWJlVGFyZ2V0KG5vQ29tbWEpKTtcbiAgICByZXR1cm4gY29udCgpO1xuICB9XG4gIGZ1bmN0aW9uIG1heWJlZXhwcmVzc2lvbih0eXBlKSB7XG4gICAgaWYgKHR5cGUubWF0Y2goL1s7XFx9XFwpXFxdLF0vKSkgcmV0dXJuIHBhc3MoKTtcbiAgICByZXR1cm4gcGFzcyhleHByZXNzaW9uKTtcbiAgfVxuICBmdW5jdGlvbiBtYXliZWV4cHJlc3Npb25Ob0NvbW1hKHR5cGUpIHtcbiAgICBpZiAodHlwZS5tYXRjaCgvWztcXH1cXClcXF0sXS8pKSByZXR1cm4gcGFzcygpO1xuICAgIHJldHVybiBwYXNzKGV4cHJlc3Npb25Ob0NvbW1hKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1heWJlb3BlcmF0b3JDb21tYSh0eXBlLCB2YWx1ZSkge1xuICAgIGlmICh0eXBlID09IFwiLFwiKSByZXR1cm4gY29udChleHByZXNzaW9uKTtcbiAgICByZXR1cm4gbWF5YmVvcGVyYXRvck5vQ29tbWEodHlwZSwgdmFsdWUsIGZhbHNlKTtcbiAgfVxuICBmdW5jdGlvbiBtYXliZW9wZXJhdG9yTm9Db21tYSh0eXBlLCB2YWx1ZSwgbm9Db21tYSkge1xuICAgIHZhciBtZSA9IG5vQ29tbWEgPT0gZmFsc2UgPyBtYXliZW9wZXJhdG9yQ29tbWEgOiBtYXliZW9wZXJhdG9yTm9Db21tYTtcbiAgICB2YXIgZXhwciA9IG5vQ29tbWEgPT0gZmFsc2UgPyBleHByZXNzaW9uIDogZXhwcmVzc2lvbk5vQ29tbWE7XG4gICAgaWYgKHR5cGUgPT0gXCI9PlwiKSByZXR1cm4gY29udChwdXNoY29udGV4dCwgbm9Db21tYSA/IGFycm93Qm9keU5vQ29tbWEgOiBhcnJvd0JvZHksIHBvcGNvbnRleHQpO1xuICAgIGlmICh0eXBlID09IFwib3BlcmF0b3JcIikge1xuICAgICAgaWYgKC9cXCtcXCt8LS0vLnRlc3QodmFsdWUpKSByZXR1cm4gY29udChtZSk7XG4gICAgICBpZiAodmFsdWUgPT0gXCI/XCIpIHJldHVybiBjb250KGV4cHJlc3Npb24sIGV4cGVjdChcIjpcIiksIGV4cHIpO1xuICAgICAgcmV0dXJuIGNvbnQoZXhwcik7XG4gICAgfVxuICAgIGlmICh0eXBlID09IFwicXVhc2lcIikgeyByZXR1cm4gcGFzcyhxdWFzaSwgbWUpOyB9XG4gICAgaWYgKHR5cGUgPT0gXCI7XCIpIHJldHVybjtcbiAgICBpZiAodHlwZSA9PSBcIihcIikgcmV0dXJuIGNvbnRDb21tYXNlcChleHByZXNzaW9uTm9Db21tYSwgXCIpXCIsIFwiY2FsbFwiLCBtZSk7XG4gICAgaWYgKHR5cGUgPT0gXCIuXCIpIHJldHVybiBjb250KHByb3BlcnR5LCBtZSk7XG4gICAgaWYgKHR5cGUgPT0gXCJbXCIpIHJldHVybiBjb250KHB1c2hsZXgoXCJdXCIpLCBtYXliZWV4cHJlc3Npb24sIGV4cGVjdChcIl1cIiksIHBvcGxleCwgbWUpO1xuICB9XG4gIGZ1bmN0aW9uIHF1YXNpKHR5cGUsIHZhbHVlKSB7XG4gICAgaWYgKHR5cGUgIT0gXCJxdWFzaVwiKSByZXR1cm4gcGFzcygpO1xuICAgIGlmICh2YWx1ZS5zbGljZSh2YWx1ZS5sZW5ndGggLSAyKSAhPSBcIiR7XCIpIHJldHVybiBjb250KHF1YXNpKTtcbiAgICByZXR1cm4gY29udChleHByZXNzaW9uLCBjb250aW51ZVF1YXNpKTtcbiAgfVxuICBmdW5jdGlvbiBjb250aW51ZVF1YXNpKHR5cGUpIHtcbiAgICBpZiAodHlwZSA9PSBcIn1cIikge1xuICAgICAgY3gubWFya2VkID0gXCJzdHJpbmctMlwiO1xuICAgICAgY3guc3RhdGUudG9rZW5pemUgPSB0b2tlblF1YXNpO1xuICAgICAgcmV0dXJuIGNvbnQocXVhc2kpO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBhcnJvd0JvZHkodHlwZSkge1xuICAgIGZpbmRGYXRBcnJvdyhjeC5zdHJlYW0sIGN4LnN0YXRlKTtcbiAgICByZXR1cm4gcGFzcyh0eXBlID09IFwie1wiID8gc3RhdGVtZW50IDogZXhwcmVzc2lvbik7XG4gIH1cbiAgZnVuY3Rpb24gYXJyb3dCb2R5Tm9Db21tYSh0eXBlKSB7XG4gICAgZmluZEZhdEFycm93KGN4LnN0cmVhbSwgY3guc3RhdGUpO1xuICAgIHJldHVybiBwYXNzKHR5cGUgPT0gXCJ7XCIgPyBzdGF0ZW1lbnQgOiBleHByZXNzaW9uTm9Db21tYSk7XG4gIH1cbiAgZnVuY3Rpb24gbWF5YmVUYXJnZXQobm9Db21tYSkge1xuICAgIHJldHVybiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICBpZiAodHlwZSA9PSBcIi5cIikgcmV0dXJuIGNvbnQobm9Db21tYSA/IHRhcmdldE5vQ29tbWEgOiB0YXJnZXQpO1xuICAgICAgZWxzZSByZXR1cm4gcGFzcyhub0NvbW1hID8gZXhwcmVzc2lvbk5vQ29tbWEgOiBleHByZXNzaW9uKTtcbiAgICB9O1xuICB9XG4gIGZ1bmN0aW9uIHRhcmdldChfLCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBcInRhcmdldFwiKSB7IGN4Lm1hcmtlZCA9IFwia2V5d29yZFwiOyByZXR1cm4gY29udChtYXliZW9wZXJhdG9yQ29tbWEpOyB9XG4gIH1cbiAgZnVuY3Rpb24gdGFyZ2V0Tm9Db21tYShfLCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBcInRhcmdldFwiKSB7IGN4Lm1hcmtlZCA9IFwia2V5d29yZFwiOyByZXR1cm4gY29udChtYXliZW9wZXJhdG9yTm9Db21tYSk7IH1cbiAgfVxuICBmdW5jdGlvbiBtYXliZWxhYmVsKHR5cGUpIHtcbiAgICBpZiAodHlwZSA9PSBcIjpcIikgcmV0dXJuIGNvbnQocG9wbGV4LCBzdGF0ZW1lbnQpO1xuICAgIHJldHVybiBwYXNzKG1heWJlb3BlcmF0b3JDb21tYSwgZXhwZWN0KFwiO1wiKSwgcG9wbGV4KTtcbiAgfVxuICBmdW5jdGlvbiBwcm9wZXJ0eSh0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiKSB7Y3gubWFya2VkID0gXCJwcm9wZXJ0eVwiOyByZXR1cm4gY29udCgpO31cbiAgfVxuICBmdW5jdGlvbiBvYmpwcm9wKHR5cGUsIHZhbHVlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiIHx8IGN4LnN0eWxlID09IFwia2V5d29yZFwiKSB7XG4gICAgICBjeC5tYXJrZWQgPSBcInByb3BlcnR5XCI7XG4gICAgICBpZiAodmFsdWUgPT0gXCJnZXRcIiB8fCB2YWx1ZSA9PSBcInNldFwiKSByZXR1cm4gY29udChnZXR0ZXJTZXR0ZXIpO1xuICAgICAgcmV0dXJuIGNvbnQoYWZ0ZXJwcm9wKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJudW1iZXJcIiB8fCB0eXBlID09IFwic3RyaW5nXCIpIHtcbiAgICAgIGN4Lm1hcmtlZCA9IGpzb25sZE1vZGUgPyBcInByb3BlcnR5XCIgOiAoY3guc3R5bGUgKyBcIiBwcm9wZXJ0eVwiKTtcbiAgICAgIHJldHVybiBjb250KGFmdGVycHJvcCk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwianNvbmxkLWtleXdvcmRcIikge1xuICAgICAgcmV0dXJuIGNvbnQoYWZ0ZXJwcm9wKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJbXCIpIHtcbiAgICAgIHJldHVybiBjb250KGV4cHJlc3Npb24sIGV4cGVjdChcIl1cIiksIGFmdGVycHJvcCk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwic3ByZWFkXCIpIHtcbiAgICAgIHJldHVybiBjb250KGV4cHJlc3Npb24pO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBnZXR0ZXJTZXR0ZXIodHlwZSkge1xuICAgIGlmICh0eXBlICE9IFwidmFyaWFibGVcIikgcmV0dXJuIHBhc3MoYWZ0ZXJwcm9wKTtcbiAgICBjeC5tYXJrZWQgPSBcInByb3BlcnR5XCI7XG4gICAgcmV0dXJuIGNvbnQoZnVuY3Rpb25kZWYpO1xuICB9XG4gIGZ1bmN0aW9uIGFmdGVycHJvcCh0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCI6XCIpIHJldHVybiBjb250KGV4cHJlc3Npb25Ob0NvbW1hKTtcbiAgICBpZiAodHlwZSA9PSBcIihcIikgcmV0dXJuIHBhc3MoZnVuY3Rpb25kZWYpO1xuICB9XG4gIGZ1bmN0aW9uIGNvbW1hc2VwKHdoYXQsIGVuZCkge1xuICAgIGZ1bmN0aW9uIHByb2NlZWQodHlwZSkge1xuICAgICAgaWYgKHR5cGUgPT0gXCIsXCIpIHtcbiAgICAgICAgdmFyIGxleCA9IGN4LnN0YXRlLmxleGljYWw7XG4gICAgICAgIGlmIChsZXguaW5mbyA9PSBcImNhbGxcIikgbGV4LnBvcyA9IChsZXgucG9zIHx8IDApICsgMTtcbiAgICAgICAgcmV0dXJuIGNvbnQod2hhdCwgcHJvY2VlZCk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZSA9PSBlbmQpIHJldHVybiBjb250KCk7XG4gICAgICByZXR1cm4gY29udChleHBlY3QoZW5kKSk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICBpZiAodHlwZSA9PSBlbmQpIHJldHVybiBjb250KCk7XG4gICAgICByZXR1cm4gcGFzcyh3aGF0LCBwcm9jZWVkKTtcbiAgICB9O1xuICB9XG4gIGZ1bmN0aW9uIGNvbnRDb21tYXNlcCh3aGF0LCBlbmQsIGluZm8pIHtcbiAgICBmb3IgKHZhciBpID0gMzsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcbiAgICAgIGN4LmNjLnB1c2goYXJndW1lbnRzW2ldKTtcbiAgICByZXR1cm4gY29udChwdXNobGV4KGVuZCwgaW5mbyksIGNvbW1hc2VwKHdoYXQsIGVuZCksIHBvcGxleCk7XG4gIH1cbiAgZnVuY3Rpb24gYmxvY2sodHlwZSkge1xuICAgIGlmICh0eXBlID09IFwifVwiKSByZXR1cm4gY29udCgpO1xuICAgIHJldHVybiBwYXNzKHN0YXRlbWVudCwgYmxvY2spO1xuICB9XG4gIGZ1bmN0aW9uIG1heWJldHlwZSh0eXBlKSB7XG4gICAgaWYgKGlzVFMgJiYgdHlwZSA9PSBcIjpcIikgcmV0dXJuIGNvbnQodHlwZWRlZik7XG4gIH1cbiAgZnVuY3Rpb24gbWF5YmVkZWZhdWx0KF8sIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IFwiPVwiKSByZXR1cm4gY29udChleHByZXNzaW9uTm9Db21tYSk7XG4gIH1cbiAgZnVuY3Rpb24gdHlwZWRlZih0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiKSB7Y3gubWFya2VkID0gXCJ2YXJpYWJsZS0zXCI7IHJldHVybiBjb250KCk7fVxuICB9XG4gIGZ1bmN0aW9uIHZhcmRlZigpIHtcbiAgICByZXR1cm4gcGFzcyhwYXR0ZXJuLCBtYXliZXR5cGUsIG1heWJlQXNzaWduLCB2YXJkZWZDb250KTtcbiAgfVxuICBmdW5jdGlvbiBwYXR0ZXJuKHR5cGUsIHZhbHVlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiKSB7IHJlZ2lzdGVyKHZhbHVlKTsgcmV0dXJuIGNvbnQoKTsgfVxuICAgIGlmICh0eXBlID09IFwic3ByZWFkXCIpIHJldHVybiBjb250KHBhdHRlcm4pO1xuICAgIGlmICh0eXBlID09IFwiW1wiKSByZXR1cm4gY29udENvbW1hc2VwKHBhdHRlcm4sIFwiXVwiKTtcbiAgICBpZiAodHlwZSA9PSBcIntcIikgcmV0dXJuIGNvbnRDb21tYXNlcChwcm9wcGF0dGVybiwgXCJ9XCIpO1xuICB9XG4gIGZ1bmN0aW9uIHByb3BwYXR0ZXJuKHR5cGUsIHZhbHVlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiICYmICFjeC5zdHJlYW0ubWF0Y2goL15cXHMqOi8sIGZhbHNlKSkge1xuICAgICAgcmVnaXN0ZXIodmFsdWUpO1xuICAgICAgcmV0dXJuIGNvbnQobWF5YmVBc3NpZ24pO1xuICAgIH1cbiAgICBpZiAodHlwZSA9PSBcInZhcmlhYmxlXCIpIGN4Lm1hcmtlZCA9IFwicHJvcGVydHlcIjtcbiAgICBpZiAodHlwZSA9PSBcInNwcmVhZFwiKSByZXR1cm4gY29udChwYXR0ZXJuKTtcbiAgICByZXR1cm4gY29udChleHBlY3QoXCI6XCIpLCBwYXR0ZXJuLCBtYXliZUFzc2lnbik7XG4gIH1cbiAgZnVuY3Rpb24gbWF5YmVBc3NpZ24oX3R5cGUsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IFwiPVwiKSByZXR1cm4gY29udChleHByZXNzaW9uTm9Db21tYSk7XG4gIH1cbiAgZnVuY3Rpb24gdmFyZGVmQ29udCh0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCIsXCIpIHJldHVybiBjb250KHZhcmRlZik7XG4gIH1cbiAgZnVuY3Rpb24gbWF5YmVlbHNlKHR5cGUsIHZhbHVlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJrZXl3b3JkIGJcIiAmJiB2YWx1ZSA9PSBcImVsc2VcIikgcmV0dXJuIGNvbnQocHVzaGxleChcImZvcm1cIiwgXCJlbHNlXCIpLCBzdGF0ZW1lbnQsIHBvcGxleCk7XG4gIH1cbiAgZnVuY3Rpb24gZm9yc3BlYyh0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCIoXCIpIHJldHVybiBjb250KHB1c2hsZXgoXCIpXCIpLCBmb3JzcGVjMSwgZXhwZWN0KFwiKVwiKSwgcG9wbGV4KTtcbiAgfVxuICBmdW5jdGlvbiBmb3JzcGVjMSh0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJcIikgcmV0dXJuIGNvbnQodmFyZGVmLCBleHBlY3QoXCI7XCIpLCBmb3JzcGVjMik7XG4gICAgaWYgKHR5cGUgPT0gXCI7XCIpIHJldHVybiBjb250KGZvcnNwZWMyKTtcbiAgICBpZiAodHlwZSA9PSBcInZhcmlhYmxlXCIpIHJldHVybiBjb250KGZvcm1heWJlaW5vZik7XG4gICAgcmV0dXJuIHBhc3MoZXhwcmVzc2lvbiwgZXhwZWN0KFwiO1wiKSwgZm9yc3BlYzIpO1xuICB9XG4gIGZ1bmN0aW9uIGZvcm1heWJlaW5vZihfdHlwZSwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gXCJpblwiIHx8IHZhbHVlID09IFwib2ZcIikgeyBjeC5tYXJrZWQgPSBcImtleXdvcmRcIjsgcmV0dXJuIGNvbnQoZXhwcmVzc2lvbik7IH1cbiAgICByZXR1cm4gY29udChtYXliZW9wZXJhdG9yQ29tbWEsIGZvcnNwZWMyKTtcbiAgfVxuICBmdW5jdGlvbiBmb3JzcGVjMih0eXBlLCB2YWx1ZSkge1xuICAgIGlmICh0eXBlID09IFwiO1wiKSByZXR1cm4gY29udChmb3JzcGVjMyk7XG4gICAgaWYgKHZhbHVlID09IFwiaW5cIiB8fCB2YWx1ZSA9PSBcIm9mXCIpIHsgY3gubWFya2VkID0gXCJrZXl3b3JkXCI7IHJldHVybiBjb250KGV4cHJlc3Npb24pOyB9XG4gICAgcmV0dXJuIHBhc3MoZXhwcmVzc2lvbiwgZXhwZWN0KFwiO1wiKSwgZm9yc3BlYzMpO1xuICB9XG4gIGZ1bmN0aW9uIGZvcnNwZWMzKHR5cGUpIHtcbiAgICBpZiAodHlwZSAhPSBcIilcIikgY29udChleHByZXNzaW9uKTtcbiAgfVxuICBmdW5jdGlvbiBmdW5jdGlvbmRlZih0eXBlLCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBcIipcIikge2N4Lm1hcmtlZCA9IFwia2V5d29yZFwiOyByZXR1cm4gY29udChmdW5jdGlvbmRlZik7fVxuICAgIGlmICh0eXBlID09IFwidmFyaWFibGVcIikge3JlZ2lzdGVyKHZhbHVlKTsgcmV0dXJuIGNvbnQoZnVuY3Rpb25kZWYpO31cbiAgICBpZiAodHlwZSA9PSBcIihcIikgcmV0dXJuIGNvbnQocHVzaGNvbnRleHQsIHB1c2hsZXgoXCIpXCIpLCBjb21tYXNlcChmdW5hcmcsIFwiKVwiKSwgcG9wbGV4LCBzdGF0ZW1lbnQsIHBvcGNvbnRleHQpO1xuICB9XG4gIGZ1bmN0aW9uIGZ1bmFyZyh0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJzcHJlYWRcIikgcmV0dXJuIGNvbnQoZnVuYXJnKTtcbiAgICByZXR1cm4gcGFzcyhwYXR0ZXJuLCBtYXliZXR5cGUsIG1heWJlZGVmYXVsdCk7XG4gIH1cbiAgZnVuY3Rpb24gY2xhc3NOYW1lKHR5cGUsIHZhbHVlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiKSB7cmVnaXN0ZXIodmFsdWUpOyByZXR1cm4gY29udChjbGFzc05hbWVBZnRlcik7fVxuICB9XG4gIGZ1bmN0aW9uIGNsYXNzTmFtZUFmdGVyKHR5cGUsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IFwiZXh0ZW5kc1wiKSByZXR1cm4gY29udChleHByZXNzaW9uLCBjbGFzc05hbWVBZnRlcik7XG4gICAgaWYgKHR5cGUgPT0gXCJ7XCIpIHJldHVybiBjb250KHB1c2hsZXgoXCJ9XCIpLCBjbGFzc0JvZHksIHBvcGxleCk7XG4gIH1cbiAgZnVuY3Rpb24gY2xhc3NCb2R5KHR5cGUsIHZhbHVlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiIHx8IGN4LnN0eWxlID09IFwia2V5d29yZFwiKSB7XG4gICAgICBpZiAodmFsdWUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICBjeC5tYXJrZWQgPSBcImtleXdvcmRcIjtcbiAgICAgICAgcmV0dXJuIGNvbnQoY2xhc3NCb2R5KTtcbiAgICAgIH1cbiAgICAgIGN4Lm1hcmtlZCA9IFwicHJvcGVydHlcIjtcbiAgICAgIGlmICh2YWx1ZSA9PSBcImdldFwiIHx8IHZhbHVlID09IFwic2V0XCIpIHJldHVybiBjb250KGNsYXNzR2V0dGVyU2V0dGVyLCBmdW5jdGlvbmRlZiwgY2xhc3NCb2R5KTtcbiAgICAgIHJldHVybiBjb250KGZ1bmN0aW9uZGVmLCBjbGFzc0JvZHkpO1xuICAgIH1cbiAgICBpZiAodmFsdWUgPT0gXCIqXCIpIHtcbiAgICAgIGN4Lm1hcmtlZCA9IFwia2V5d29yZFwiO1xuICAgICAgcmV0dXJuIGNvbnQoY2xhc3NCb2R5KTtcbiAgICB9XG4gICAgaWYgKHR5cGUgPT0gXCI7XCIpIHJldHVybiBjb250KGNsYXNzQm9keSk7XG4gICAgaWYgKHR5cGUgPT0gXCJ9XCIpIHJldHVybiBjb250KCk7XG4gIH1cbiAgZnVuY3Rpb24gY2xhc3NHZXR0ZXJTZXR0ZXIodHlwZSkge1xuICAgIGlmICh0eXBlICE9IFwidmFyaWFibGVcIikgcmV0dXJuIHBhc3MoKTtcbiAgICBjeC5tYXJrZWQgPSBcInByb3BlcnR5XCI7XG4gICAgcmV0dXJuIGNvbnQoKTtcbiAgfVxuICBmdW5jdGlvbiBhZnRlckV4cG9ydChfdHlwZSwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gXCIqXCIpIHsgY3gubWFya2VkID0gXCJrZXl3b3JkXCI7IHJldHVybiBjb250KG1heWJlRnJvbSwgZXhwZWN0KFwiO1wiKSk7IH1cbiAgICBpZiAodmFsdWUgPT0gXCJkZWZhdWx0XCIpIHsgY3gubWFya2VkID0gXCJrZXl3b3JkXCI7IHJldHVybiBjb250KGV4cHJlc3Npb24sIGV4cGVjdChcIjtcIikpOyB9XG4gICAgcmV0dXJuIHBhc3Moc3RhdGVtZW50KTtcbiAgfVxuICBmdW5jdGlvbiBhZnRlckltcG9ydCh0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJzdHJpbmdcIikgcmV0dXJuIGNvbnQoKTtcbiAgICByZXR1cm4gcGFzcyhpbXBvcnRTcGVjLCBtYXliZUZyb20pO1xuICB9XG4gIGZ1bmN0aW9uIGltcG9ydFNwZWModHlwZSwgdmFsdWUpIHtcbiAgICBpZiAodHlwZSA9PSBcIntcIikgcmV0dXJuIGNvbnRDb21tYXNlcChpbXBvcnRTcGVjLCBcIn1cIik7XG4gICAgaWYgKHR5cGUgPT0gXCJ2YXJpYWJsZVwiKSByZWdpc3Rlcih2YWx1ZSk7XG4gICAgaWYgKHZhbHVlID09IFwiKlwiKSBjeC5tYXJrZWQgPSBcImtleXdvcmRcIjtcbiAgICByZXR1cm4gY29udChtYXliZUFzKTtcbiAgfVxuICBmdW5jdGlvbiBtYXliZUFzKF90eXBlLCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBcImFzXCIpIHsgY3gubWFya2VkID0gXCJrZXl3b3JkXCI7IHJldHVybiBjb250KGltcG9ydFNwZWMpOyB9XG4gIH1cbiAgZnVuY3Rpb24gbWF5YmVGcm9tKF90eXBlLCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBcImZyb21cIikgeyBjeC5tYXJrZWQgPSBcImtleXdvcmRcIjsgcmV0dXJuIGNvbnQoZXhwcmVzc2lvbik7IH1cbiAgfVxuICBmdW5jdGlvbiBhcnJheUxpdGVyYWwodHlwZSkge1xuICAgIGlmICh0eXBlID09IFwiXVwiKSByZXR1cm4gY29udCgpO1xuICAgIHJldHVybiBwYXNzKGV4cHJlc3Npb25Ob0NvbW1hLCBtYXliZUFycmF5Q29tcHJlaGVuc2lvbik7XG4gIH1cbiAgZnVuY3Rpb24gbWF5YmVBcnJheUNvbXByZWhlbnNpb24odHlwZSkge1xuICAgIGlmICh0eXBlID09IFwiZm9yXCIpIHJldHVybiBwYXNzKGNvbXByZWhlbnNpb24sIGV4cGVjdChcIl1cIikpO1xuICAgIGlmICh0eXBlID09IFwiLFwiKSByZXR1cm4gY29udChjb21tYXNlcChtYXliZWV4cHJlc3Npb25Ob0NvbW1hLCBcIl1cIikpO1xuICAgIHJldHVybiBwYXNzKGNvbW1hc2VwKGV4cHJlc3Npb25Ob0NvbW1hLCBcIl1cIikpO1xuICB9XG4gIGZ1bmN0aW9uIGNvbXByZWhlbnNpb24odHlwZSkge1xuICAgIGlmICh0eXBlID09IFwiZm9yXCIpIHJldHVybiBjb250KGZvcnNwZWMsIGNvbXByZWhlbnNpb24pO1xuICAgIGlmICh0eXBlID09IFwiaWZcIikgcmV0dXJuIGNvbnQoZXhwcmVzc2lvbiwgY29tcHJlaGVuc2lvbik7XG4gIH1cblxuICBmdW5jdGlvbiBpc0NvbnRpbnVlZFN0YXRlbWVudChzdGF0ZSwgdGV4dEFmdGVyKSB7XG4gICAgcmV0dXJuIHN0YXRlLmxhc3RUeXBlID09IFwib3BlcmF0b3JcIiB8fCBzdGF0ZS5sYXN0VHlwZSA9PSBcIixcIiB8fFxuICAgICAgaXNPcGVyYXRvckNoYXIudGVzdCh0ZXh0QWZ0ZXIuY2hhckF0KDApKSB8fFxuICAgICAgL1ssLl0vLnRlc3QodGV4dEFmdGVyLmNoYXJBdCgwKSk7XG4gIH1cblxuICAvLyBJbnRlcmZhY2VcblxuICByZXR1cm4ge1xuICAgIHN0YXJ0U3RhdGU6IGZ1bmN0aW9uKGJhc2Vjb2x1bW4pIHtcbiAgICAgIHZhciBzdGF0ZSA9IHtcbiAgICAgICAgdG9rZW5pemU6IHRva2VuQmFzZSxcbiAgICAgICAgbGFzdFR5cGU6IFwic29mXCIsXG4gICAgICAgIGNjOiBbXSxcbiAgICAgICAgbGV4aWNhbDogbmV3IEpTTGV4aWNhbCgoYmFzZWNvbHVtbiB8fCAwKSAtIGluZGVudFVuaXQsIDAsIFwiYmxvY2tcIiwgZmFsc2UpLFxuICAgICAgICBsb2NhbFZhcnM6IHBhcnNlckNvbmZpZy5sb2NhbFZhcnMsXG4gICAgICAgIGNvbnRleHQ6IHBhcnNlckNvbmZpZy5sb2NhbFZhcnMgJiYge3ZhcnM6IHBhcnNlckNvbmZpZy5sb2NhbFZhcnN9LFxuICAgICAgICBpbmRlbnRlZDogMFxuICAgICAgfTtcbiAgICAgIGlmIChwYXJzZXJDb25maWcuZ2xvYmFsVmFycyAmJiB0eXBlb2YgcGFyc2VyQ29uZmlnLmdsb2JhbFZhcnMgPT0gXCJvYmplY3RcIilcbiAgICAgICAgc3RhdGUuZ2xvYmFsVmFycyA9IHBhcnNlckNvbmZpZy5nbG9iYWxWYXJzO1xuICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH0sXG5cbiAgICB0b2tlbjogZnVuY3Rpb24oc3RyZWFtLCBzdGF0ZSkge1xuICAgICAgaWYgKHN0cmVhbS5zb2woKSkge1xuICAgICAgICBpZiAoIXN0YXRlLmxleGljYWwuaGFzT3duUHJvcGVydHkoXCJhbGlnblwiKSlcbiAgICAgICAgICBzdGF0ZS5sZXhpY2FsLmFsaWduID0gZmFsc2U7XG4gICAgICAgIHN0YXRlLmluZGVudGVkID0gc3RyZWFtLmluZGVudGF0aW9uKCk7XG4gICAgICAgIGZpbmRGYXRBcnJvdyhzdHJlYW0sIHN0YXRlKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdGF0ZS50b2tlbml6ZSAhPSB0b2tlbkNvbW1lbnQgJiYgc3RyZWFtLmVhdFNwYWNlKCkpIHJldHVybiBudWxsO1xuICAgICAgdmFyIHN0eWxlID0gc3RhdGUudG9rZW5pemUoc3RyZWFtLCBzdGF0ZSk7XG4gICAgICBpZiAodHlwZSA9PSBcImNvbW1lbnRcIikgcmV0dXJuIHN0eWxlO1xuICAgICAgc3RhdGUubGFzdFR5cGUgPSB0eXBlID09IFwib3BlcmF0b3JcIiAmJiAoY29udGVudCA9PSBcIisrXCIgfHwgY29udGVudCA9PSBcIi0tXCIpID8gXCJpbmNkZWNcIiA6IHR5cGU7XG4gICAgICByZXR1cm4gcGFyc2VKUyhzdGF0ZSwgc3R5bGUsIHR5cGUsIGNvbnRlbnQsIHN0cmVhbSk7XG4gICAgfSxcblxuICAgIGluZGVudDogZnVuY3Rpb24oc3RhdGUsIHRleHRBZnRlcikge1xuICAgICAgaWYgKHN0YXRlLnRva2VuaXplID09IHRva2VuQ29tbWVudCkgcmV0dXJuIENvZGVNaXJyb3IuUGFzcztcbiAgICAgIGlmIChzdGF0ZS50b2tlbml6ZSAhPSB0b2tlbkJhc2UpIHJldHVybiAwO1xuICAgICAgdmFyIGZpcnN0Q2hhciA9IHRleHRBZnRlciAmJiB0ZXh0QWZ0ZXIuY2hhckF0KDApLCBsZXhpY2FsID0gc3RhdGUubGV4aWNhbDtcbiAgICAgIC8vIEtsdWRnZSB0byBwcmV2ZW50ICdtYXliZWxzZScgZnJvbSBibG9ja2luZyBsZXhpY2FsIHNjb3BlIHBvcHNcbiAgICAgIGlmICghL15cXHMqZWxzZVxcYi8udGVzdCh0ZXh0QWZ0ZXIpKSBmb3IgKHZhciBpID0gc3RhdGUuY2MubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgdmFyIGMgPSBzdGF0ZS5jY1tpXTtcbiAgICAgICAgaWYgKGMgPT0gcG9wbGV4KSBsZXhpY2FsID0gbGV4aWNhbC5wcmV2O1xuICAgICAgICBlbHNlIGlmIChjICE9IG1heWJlZWxzZSkgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAobGV4aWNhbC50eXBlID09IFwic3RhdFwiICYmIGZpcnN0Q2hhciA9PSBcIn1cIikgbGV4aWNhbCA9IGxleGljYWwucHJldjtcbiAgICAgIGlmIChzdGF0ZW1lbnRJbmRlbnQgJiYgbGV4aWNhbC50eXBlID09IFwiKVwiICYmIGxleGljYWwucHJldi50eXBlID09IFwic3RhdFwiKVxuICAgICAgICBsZXhpY2FsID0gbGV4aWNhbC5wcmV2O1xuICAgICAgdmFyIHR5cGUgPSBsZXhpY2FsLnR5cGUsIGNsb3NpbmcgPSBmaXJzdENoYXIgPT0gdHlwZTtcblxuICAgICAgaWYgKHR5cGUgPT0gXCJ2YXJkZWZcIikgcmV0dXJuIGxleGljYWwuaW5kZW50ZWQgKyAoc3RhdGUubGFzdFR5cGUgPT0gXCJvcGVyYXRvclwiIHx8IHN0YXRlLmxhc3RUeXBlID09IFwiLFwiID8gbGV4aWNhbC5pbmZvICsgMSA6IDApO1xuICAgICAgZWxzZSBpZiAodHlwZSA9PSBcImZvcm1cIiAmJiBmaXJzdENoYXIgPT0gXCJ7XCIpIHJldHVybiBsZXhpY2FsLmluZGVudGVkO1xuICAgICAgZWxzZSBpZiAodHlwZSA9PSBcImZvcm1cIikgcmV0dXJuIGxleGljYWwuaW5kZW50ZWQgKyBpbmRlbnRVbml0O1xuICAgICAgZWxzZSBpZiAodHlwZSA9PSBcInN0YXRcIilcbiAgICAgICAgcmV0dXJuIGxleGljYWwuaW5kZW50ZWQgKyAoaXNDb250aW51ZWRTdGF0ZW1lbnQoc3RhdGUsIHRleHRBZnRlcikgPyBzdGF0ZW1lbnRJbmRlbnQgfHwgaW5kZW50VW5pdCA6IDApO1xuICAgICAgZWxzZSBpZiAobGV4aWNhbC5pbmZvID09IFwic3dpdGNoXCIgJiYgIWNsb3NpbmcgJiYgcGFyc2VyQ29uZmlnLmRvdWJsZUluZGVudFN3aXRjaCAhPSBmYWxzZSlcbiAgICAgICAgcmV0dXJuIGxleGljYWwuaW5kZW50ZWQgKyAoL14oPzpjYXNlfGRlZmF1bHQpXFxiLy50ZXN0KHRleHRBZnRlcikgPyBpbmRlbnRVbml0IDogMiAqIGluZGVudFVuaXQpO1xuICAgICAgZWxzZSBpZiAobGV4aWNhbC5hbGlnbikgcmV0dXJuIGxleGljYWwuY29sdW1uICsgKGNsb3NpbmcgPyAwIDogMSk7XG4gICAgICBlbHNlIHJldHVybiBsZXhpY2FsLmluZGVudGVkICsgKGNsb3NpbmcgPyAwIDogaW5kZW50VW5pdCk7XG4gICAgfSxcblxuICAgIGVsZWN0cmljSW5wdXQ6IC9eXFxzKig/OmNhc2UgLio/OnxkZWZhdWx0OnxcXHt8XFx9KSQvLFxuICAgIGJsb2NrQ29tbWVudFN0YXJ0OiBqc29uTW9kZSA/IG51bGwgOiBcIi8qXCIsXG4gICAgYmxvY2tDb21tZW50RW5kOiBqc29uTW9kZSA/IG51bGwgOiBcIiovXCIsXG4gICAgbGluZUNvbW1lbnQ6IGpzb25Nb2RlID8gbnVsbCA6IFwiLy9cIixcbiAgICBmb2xkOiBcImJyYWNlXCIsXG4gICAgY2xvc2VCcmFja2V0czogXCIoKVtde30nJ1xcXCJcXFwiYGBcIixcblxuICAgIGhlbHBlclR5cGU6IGpzb25Nb2RlID8gXCJqc29uXCIgOiBcImphdmFzY3JpcHRcIixcbiAgICBqc29ubGRNb2RlOiBqc29ubGRNb2RlLFxuICAgIGpzb25Nb2RlOiBqc29uTW9kZVxuICB9O1xufSk7XG5cbkNvZGVNaXJyb3IucmVnaXN0ZXJIZWxwZXIoXCJ3b3JkQ2hhcnNcIiwgXCJqYXZhc2NyaXB0XCIsIC9bXFx3JF0vKTtcblxuQ29kZU1pcnJvci5kZWZpbmVNSU1FKFwidGV4dC9qYXZhc2NyaXB0XCIsIFwiamF2YXNjcmlwdFwiKTtcbkNvZGVNaXJyb3IuZGVmaW5lTUlNRShcInRleHQvZWNtYXNjcmlwdFwiLCBcImphdmFzY3JpcHRcIik7XG5Db2RlTWlycm9yLmRlZmluZU1JTUUoXCJhcHBsaWNhdGlvbi9qYXZhc2NyaXB0XCIsIFwiamF2YXNjcmlwdFwiKTtcbkNvZGVNaXJyb3IuZGVmaW5lTUlNRShcImFwcGxpY2F0aW9uL3gtamF2YXNjcmlwdFwiLCBcImphdmFzY3JpcHRcIik7XG5Db2RlTWlycm9yLmRlZmluZU1JTUUoXCJhcHBsaWNhdGlvbi9lY21hc2NyaXB0XCIsIFwiamF2YXNjcmlwdFwiKTtcbkNvZGVNaXJyb3IuZGVmaW5lTUlNRShcImFwcGxpY2F0aW9uL2pzb25cIiwge25hbWU6IFwiamF2YXNjcmlwdFwiLCBqc29uOiB0cnVlfSk7XG5Db2RlTWlycm9yLmRlZmluZU1JTUUoXCJhcHBsaWNhdGlvbi94LWpzb25cIiwge25hbWU6IFwiamF2YXNjcmlwdFwiLCBqc29uOiB0cnVlfSk7XG5Db2RlTWlycm9yLmRlZmluZU1JTUUoXCJhcHBsaWNhdGlvbi9sZCtqc29uXCIsIHtuYW1lOiBcImphdmFzY3JpcHRcIiwganNvbmxkOiB0cnVlfSk7XG5Db2RlTWlycm9yLmRlZmluZU1JTUUoXCJ0ZXh0L3R5cGVzY3JpcHRcIiwgeyBuYW1lOiBcImphdmFzY3JpcHRcIiwgdHlwZXNjcmlwdDogdHJ1ZSB9KTtcbkNvZGVNaXJyb3IuZGVmaW5lTUlNRShcImFwcGxpY2F0aW9uL3R5cGVzY3JpcHRcIiwgeyBuYW1lOiBcImphdmFzY3JpcHRcIiwgdHlwZXNjcmlwdDogdHJ1ZSB9KTtcblxufSk7XG4iLCJ2YXIgV0FBQ2xvY2sgPSByZXF1aXJlKCcuL2xpYi9XQUFDbG9jaycpXG5cbm1vZHVsZS5leHBvcnRzID0gV0FBQ2xvY2tcbmlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgd2luZG93LldBQUNsb2NrID0gV0FBQ2xvY2tcbiIsInZhciBpc0Jyb3dzZXIgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpXG5cbnZhciBDTE9DS19ERUZBVUxUUyA9IHtcbiAgdG9sZXJhbmNlTGF0ZTogMC4xMCxcbiAgdG9sZXJhbmNlRWFybHk6IDAuMDAxXG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09IEV2ZW50ID09PT09PT09PT09PT09PT09PT09IC8vXG52YXIgRXZlbnQgPSBmdW5jdGlvbihjbG9jaywgZGVhZGxpbmUsIGZ1bmMpIHtcbiAgdGhpcy5jbG9jayA9IGNsb2NrXG4gIHRoaXMuZnVuYyA9IGZ1bmNcbiAgdGhpcy5fY2xlYXJlZCA9IGZhbHNlIC8vIEZsYWcgdXNlZCB0byBjbGVhciBhbiBldmVudCBpbnNpZGUgY2FsbGJhY2tcblxuICB0aGlzLnRvbGVyYW5jZUxhdGUgPSBjbG9jay50b2xlcmFuY2VMYXRlXG4gIHRoaXMudG9sZXJhbmNlRWFybHkgPSBjbG9jay50b2xlcmFuY2VFYXJseVxuICB0aGlzLl9sYXRlc3RUaW1lID0gbnVsbFxuICB0aGlzLl9lYXJsaWVzdFRpbWUgPSBudWxsXG4gIHRoaXMuZGVhZGxpbmUgPSBudWxsXG4gIHRoaXMucmVwZWF0VGltZSA9IG51bGxcblxuICB0aGlzLnNjaGVkdWxlKGRlYWRsaW5lKVxufVxuXG4vLyBVbnNjaGVkdWxlcyB0aGUgZXZlbnRcbkV2ZW50LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmNsb2NrLl9yZW1vdmVFdmVudCh0aGlzKVxuICB0aGlzLl9jbGVhcmVkID0gdHJ1ZVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBTZXRzIHRoZSBldmVudCB0byByZXBlYXQgZXZlcnkgYHRpbWVgIHNlY29uZHMuXG5FdmVudC5wcm90b3R5cGUucmVwZWF0ID0gZnVuY3Rpb24odGltZSkge1xuICBpZiAodGltZSA9PT0gMClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2RlbGF5IGNhbm5vdCBiZSAwJylcbiAgdGhpcy5yZXBlYXRUaW1lID0gdGltZVxuICBpZiAoIXRoaXMuY2xvY2suX2hhc0V2ZW50KHRoaXMpKVxuICAgIHRoaXMuc2NoZWR1bGUodGhpcy5kZWFkbGluZSArIHRoaXMucmVwZWF0VGltZSlcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gU2V0cyB0aGUgdGltZSB0b2xlcmFuY2Ugb2YgdGhlIGV2ZW50LlxuLy8gVGhlIGV2ZW50IHdpbGwgYmUgZXhlY3V0ZWQgaW4gdGhlIGludGVydmFsIGBbZGVhZGxpbmUgLSBlYXJseSwgZGVhZGxpbmUgKyBsYXRlXWBcbi8vIElmIHRoZSBjbG9jayBmYWlscyB0byBleGVjdXRlIHRoZSBldmVudCBpbiB0aW1lLCB0aGUgZXZlbnQgd2lsbCBiZSBkcm9wcGVkLlxuRXZlbnQucHJvdG90eXBlLnRvbGVyYW5jZSA9IGZ1bmN0aW9uKHZhbHVlcykge1xuICBpZiAodHlwZW9mIHZhbHVlcy5sYXRlID09PSAnbnVtYmVyJylcbiAgICB0aGlzLnRvbGVyYW5jZUxhdGUgPSB2YWx1ZXMubGF0ZVxuICBpZiAodHlwZW9mIHZhbHVlcy5lYXJseSA9PT0gJ251bWJlcicpXG4gICAgdGhpcy50b2xlcmFuY2VFYXJseSA9IHZhbHVlcy5lYXJseVxuICB0aGlzLl9yZWZyZXNoRWFybHlMYXRlRGF0ZXMoKVxuICBpZiAodGhpcy5jbG9jay5faGFzRXZlbnQodGhpcykpIHtcbiAgICB0aGlzLmNsb2NrLl9yZW1vdmVFdmVudCh0aGlzKVxuICAgIHRoaXMuY2xvY2suX2luc2VydEV2ZW50KHRoaXMpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBldmVudCBpcyByZXBlYXRlZCwgZmFsc2Ugb3RoZXJ3aXNlXG5FdmVudC5wcm90b3R5cGUuaXNSZXBlYXRlZCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5yZXBlYXRUaW1lICE9PSBudWxsIH1cblxuLy8gU2NoZWR1bGVzIHRoZSBldmVudCB0byBiZSByYW4gYmVmb3JlIGBkZWFkbGluZWAuXG4vLyBJZiB0aGUgdGltZSBpcyB3aXRoaW4gdGhlIGV2ZW50IHRvbGVyYW5jZSwgd2UgaGFuZGxlIHRoZSBldmVudCBpbW1lZGlhdGVseS5cbi8vIElmIHRoZSBldmVudCB3YXMgYWxyZWFkeSBzY2hlZHVsZWQgYXQgYSBkaWZmZXJlbnQgdGltZSwgaXQgaXMgcmVzY2hlZHVsZWQuXG5FdmVudC5wcm90b3R5cGUuc2NoZWR1bGUgPSBmdW5jdGlvbihkZWFkbGluZSkge1xuICB0aGlzLl9jbGVhcmVkID0gZmFsc2VcbiAgdGhpcy5kZWFkbGluZSA9IGRlYWRsaW5lXG4gIHRoaXMuX3JlZnJlc2hFYXJseUxhdGVEYXRlcygpXG5cbiAgaWYgKHRoaXMuY2xvY2suY29udGV4dC5jdXJyZW50VGltZSA+PSB0aGlzLl9lYXJsaWVzdFRpbWUpIHtcbiAgICB0aGlzLl9leGVjdXRlKClcbiAgXG4gIH0gZWxzZSBpZiAodGhpcy5jbG9jay5faGFzRXZlbnQodGhpcykpIHtcbiAgICB0aGlzLmNsb2NrLl9yZW1vdmVFdmVudCh0aGlzKVxuICAgIHRoaXMuY2xvY2suX2luc2VydEV2ZW50KHRoaXMpXG4gIFxuICB9IGVsc2UgdGhpcy5jbG9jay5faW5zZXJ0RXZlbnQodGhpcylcbn1cblxuRXZlbnQucHJvdG90eXBlLnRpbWVTdHJldGNoID0gZnVuY3Rpb24odFJlZiwgcmF0aW8pIHtcbiAgaWYgKHRoaXMuaXNSZXBlYXRlZCgpKVxuICAgIHRoaXMucmVwZWF0VGltZSA9IHRoaXMucmVwZWF0VGltZSAqIHJhdGlvXG5cbiAgdmFyIGRlYWRsaW5lID0gdFJlZiArIHJhdGlvICogKHRoaXMuZGVhZGxpbmUgLSB0UmVmKVxuICAvLyBJZiB0aGUgZGVhZGxpbmUgaXMgdG9vIGNsb3NlIG9yIHBhc3QsIGFuZCB0aGUgZXZlbnQgaGFzIGEgcmVwZWF0LFxuICAvLyB3ZSBjYWxjdWxhdGUgdGhlIG5leHQgcmVwZWF0IHBvc3NpYmxlIGluIHRoZSBzdHJldGNoZWQgc3BhY2UuXG4gIGlmICh0aGlzLmlzUmVwZWF0ZWQoKSkge1xuICAgIHdoaWxlICh0aGlzLmNsb2NrLmNvbnRleHQuY3VycmVudFRpbWUgPj0gZGVhZGxpbmUgLSB0aGlzLnRvbGVyYW5jZUVhcmx5KVxuICAgICAgZGVhZGxpbmUgKz0gdGhpcy5yZXBlYXRUaW1lXG4gIH1cbiAgdGhpcy5zY2hlZHVsZShkZWFkbGluZSlcbn1cblxuLy8gRXhlY3V0ZXMgdGhlIGV2ZW50XG5FdmVudC5wcm90b3R5cGUuX2V4ZWN1dGUgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuY2xvY2suX3N0YXJ0ZWQgPT09IGZhbHNlKSByZXR1cm5cbiAgdGhpcy5jbG9jay5fcmVtb3ZlRXZlbnQodGhpcylcblxuICBpZiAodGhpcy5jbG9jay5jb250ZXh0LmN1cnJlbnRUaW1lIDwgdGhpcy5fbGF0ZXN0VGltZSlcbiAgICB0aGlzLmZ1bmModGhpcylcbiAgZWxzZSB7XG4gICAgaWYgKHRoaXMub25leHBpcmVkKSB0aGlzLm9uZXhwaXJlZCh0aGlzKVxuICAgIGNvbnNvbGUud2FybignZXZlbnQgZXhwaXJlZCcpXG4gIH1cbiAgLy8gSW4gdGhlIGNhc2UgYHNjaGVkdWxlYCBpcyBjYWxsZWQgaW5zaWRlIGBmdW5jYCwgd2UgbmVlZCB0byBhdm9pZFxuICAvLyBvdmVycndyaXRpbmcgd2l0aCB5ZXQgYW5vdGhlciBgc2NoZWR1bGVgLlxuICBpZiAoIXRoaXMuY2xvY2suX2hhc0V2ZW50KHRoaXMpICYmIHRoaXMuaXNSZXBlYXRlZCgpICYmICF0aGlzLl9jbGVhcmVkKVxuICAgIHRoaXMuc2NoZWR1bGUodGhpcy5kZWFkbGluZSArIHRoaXMucmVwZWF0VGltZSkgXG59XG5cbi8vIFVwZGF0ZXMgY2FjaGVkIHRpbWVzXG5FdmVudC5wcm90b3R5cGUuX3JlZnJlc2hFYXJseUxhdGVEYXRlcyA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9sYXRlc3RUaW1lID0gdGhpcy5kZWFkbGluZSArIHRoaXMudG9sZXJhbmNlTGF0ZVxuICB0aGlzLl9lYXJsaWVzdFRpbWUgPSB0aGlzLmRlYWRsaW5lIC0gdGhpcy50b2xlcmFuY2VFYXJseVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PSBXQUFDbG9jayA9PT09PT09PT09PT09PT09PT09PSAvL1xudmFyIFdBQUNsb2NrID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjb250ZXh0LCBvcHRzKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICBvcHRzID0gb3B0cyB8fCB7fVxuICB0aGlzLnRpY2tNZXRob2QgPSBvcHRzLnRpY2tNZXRob2QgfHwgJ1NjcmlwdFByb2Nlc3Nvck5vZGUnXG4gIHRoaXMudG9sZXJhbmNlRWFybHkgPSBvcHRzLnRvbGVyYW5jZUVhcmx5IHx8IENMT0NLX0RFRkFVTFRTLnRvbGVyYW5jZUVhcmx5XG4gIHRoaXMudG9sZXJhbmNlTGF0ZSA9IG9wdHMudG9sZXJhbmNlTGF0ZSB8fCBDTE9DS19ERUZBVUxUUy50b2xlcmFuY2VMYXRlXG4gIHRoaXMuY29udGV4dCA9IGNvbnRleHRcbiAgdGhpcy5fZXZlbnRzID0gW11cbiAgdGhpcy5fc3RhcnRlZCA9IGZhbHNlXG59XG5cbi8vIC0tLS0tLS0tLS0gUHVibGljIEFQSSAtLS0tLS0tLS0tIC8vXG4vLyBTY2hlZHVsZXMgYGZ1bmNgIHRvIHJ1biBhZnRlciBgZGVsYXlgIHNlY29uZHMuXG5XQUFDbG9jay5wcm90b3R5cGUuc2V0VGltZW91dCA9IGZ1bmN0aW9uKGZ1bmMsIGRlbGF5KSB7XG4gIHJldHVybiB0aGlzLl9jcmVhdGVFdmVudChmdW5jLCB0aGlzLl9hYnNUaW1lKGRlbGF5KSlcbn1cblxuLy8gU2NoZWR1bGVzIGBmdW5jYCB0byBydW4gYmVmb3JlIGBkZWFkbGluZWAuXG5XQUFDbG9jay5wcm90b3R5cGUuY2FsbGJhY2tBdFRpbWUgPSBmdW5jdGlvbihmdW5jLCBkZWFkbGluZSkge1xuICByZXR1cm4gdGhpcy5fY3JlYXRlRXZlbnQoZnVuYywgZGVhZGxpbmUpXG59XG5cbi8vIFN0cmV0Y2hlcyBgZGVhZGxpbmVgIGFuZCBgcmVwZWF0YCBvZiBhbGwgc2NoZWR1bGVkIGBldmVudHNgIGJ5IGByYXRpb2AsIGtlZXBpbmdcbi8vIHRoZWlyIHJlbGF0aXZlIGRpc3RhbmNlIHRvIGB0UmVmYC4gSW4gZmFjdCB0aGlzIGlzIGVxdWl2YWxlbnQgdG8gY2hhbmdpbmcgdGhlIHRlbXBvLlxuV0FBQ2xvY2sucHJvdG90eXBlLnRpbWVTdHJldGNoID0gZnVuY3Rpb24odFJlZiwgZXZlbnRzLCByYXRpbykge1xuICBldmVudHMuZm9yRWFjaChmdW5jdGlvbihldmVudCkgeyBldmVudC50aW1lU3RyZXRjaCh0UmVmLCByYXRpbykgfSlcbiAgcmV0dXJuIGV2ZW50c1xufVxuXG4vLyBSZW1vdmVzIGFsbCBzY2hlZHVsZWQgZXZlbnRzIGFuZCBzdGFydHMgdGhlIGNsb2NrIFxuV0FBQ2xvY2sucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9zdGFydGVkID09PSBmYWxzZSkge1xuICAgIHZhciBzZWxmID0gdGhpc1xuICAgIHRoaXMuX3N0YXJ0ZWQgPSB0cnVlXG4gICAgdGhpcy5fZXZlbnRzID0gW11cblxuICAgIGlmICh0aGlzLnRpY2tNZXRob2QgPT09ICdTY3JpcHRQcm9jZXNzb3JOb2RlJykge1xuICAgICAgdmFyIGJ1ZmZlclNpemUgPSAyNTZcbiAgICAgIC8vIFdlIGhhdmUgdG8ga2VlcCBhIHJlZmVyZW5jZSB0byB0aGUgbm9kZSB0byBhdm9pZCBnYXJiYWdlIGNvbGxlY3Rpb25cbiAgICAgIHRoaXMuX2Nsb2NrTm9kZSA9IHRoaXMuY29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoYnVmZmVyU2l6ZSwgMSwgMSlcbiAgICAgIHRoaXMuX2Nsb2NrTm9kZS5jb25uZWN0KHRoaXMuY29udGV4dC5kZXN0aW5hdGlvbilcbiAgICAgIHRoaXMuX2Nsb2NrTm9kZS5vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHsgc2VsZi5fdGljaygpIH0pXG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLnRpY2tNZXRob2QgPT09ICdtYW51YWwnKSBudWxsIC8vIF90aWNrIGlzIGNhbGxlZCBtYW51YWxseVxuXG4gICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgdGlja01ldGhvZCAnICsgdGhpcy50aWNrTWV0aG9kKVxuICB9XG59XG5cbi8vIFN0b3BzIHRoZSBjbG9ja1xuV0FBQ2xvY2sucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuX3N0YXJ0ZWQgPT09IHRydWUpIHtcbiAgICB0aGlzLl9zdGFydGVkID0gZmFsc2VcbiAgICB0aGlzLl9jbG9ja05vZGUuZGlzY29ubmVjdCgpXG4gIH0gIFxufVxuXG4vLyAtLS0tLS0tLS0tIFByaXZhdGUgLS0tLS0tLS0tLSAvL1xuXG4vLyBUaGlzIGZ1bmN0aW9uIGlzIHJhbiBwZXJpb2RpY2FsbHksIGFuZCBhdCBlYWNoIHRpY2sgaXQgZXhlY3V0ZXNcbi8vIGV2ZW50cyBmb3Igd2hpY2ggYGN1cnJlbnRUaW1lYCBpcyBpbmNsdWRlZCBpbiB0aGVpciB0b2xlcmFuY2UgaW50ZXJ2YWwuXG5XQUFDbG9jay5wcm90b3R5cGUuX3RpY2sgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGV2ZW50ID0gdGhpcy5fZXZlbnRzLnNoaWZ0KClcblxuICB3aGlsZShldmVudCAmJiBldmVudC5fZWFybGllc3RUaW1lIDw9IHRoaXMuY29udGV4dC5jdXJyZW50VGltZSkge1xuICAgIGV2ZW50Ll9leGVjdXRlKClcbiAgICBldmVudCA9IHRoaXMuX2V2ZW50cy5zaGlmdCgpXG4gIH1cblxuICAvLyBQdXQgYmFjayB0aGUgbGFzdCBldmVudFxuICBpZihldmVudCkgdGhpcy5fZXZlbnRzLnVuc2hpZnQoZXZlbnQpXG59XG5cbi8vIENyZWF0ZXMgYW4gZXZlbnQgYW5kIGluc2VydCBpdCB0byB0aGUgbGlzdFxuV0FBQ2xvY2sucHJvdG90eXBlLl9jcmVhdGVFdmVudCA9IGZ1bmN0aW9uKGZ1bmMsIGRlYWRsaW5lKSB7XG4gIHJldHVybiBuZXcgRXZlbnQodGhpcywgZGVhZGxpbmUsIGZ1bmMpXG59XG5cbi8vIEluc2VydHMgYW4gZXZlbnQgdG8gdGhlIGxpc3RcbldBQUNsb2NrLnByb3RvdHlwZS5faW5zZXJ0RXZlbnQgPSBmdW5jdGlvbihldmVudCkge1xuICB0aGlzLl9ldmVudHMuc3BsaWNlKHRoaXMuX2luZGV4QnlUaW1lKGV2ZW50Ll9lYXJsaWVzdFRpbWUpLCAwLCBldmVudClcbn1cblxuLy8gUmVtb3ZlcyBhbiBldmVudCBmcm9tIHRoZSBsaXN0XG5XQUFDbG9jay5wcm90b3R5cGUuX3JlbW92ZUV2ZW50ID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgdmFyIGluZCA9IHRoaXMuX2V2ZW50cy5pbmRleE9mKGV2ZW50KVxuICBpZiAoaW5kICE9PSAtMSkgdGhpcy5fZXZlbnRzLnNwbGljZShpbmQsIDEpXG59XG5cbi8vIFJldHVybnMgdHJ1ZSBpZiBgZXZlbnRgIGlzIGluIHF1ZXVlLCBmYWxzZSBvdGhlcndpc2VcbldBQUNsb2NrLnByb3RvdHlwZS5faGFzRXZlbnQgPSBmdW5jdGlvbihldmVudCkge1xuIHJldHVybiB0aGlzLl9ldmVudHMuaW5kZXhPZihldmVudCkgIT09IC0xXG59XG5cbi8vIFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBmaXJzdCBldmVudCB3aG9zZSBkZWFkbGluZSBpcyA+PSB0byBgZGVhZGxpbmVgXG5XQUFDbG9jay5wcm90b3R5cGUuX2luZGV4QnlUaW1lID0gZnVuY3Rpb24oZGVhZGxpbmUpIHtcbiAgLy8gcGVyZm9ybXMgYSBiaW5hcnkgc2VhcmNoXG4gIHZhciBsb3cgPSAwXG4gICAgLCBoaWdoID0gdGhpcy5fZXZlbnRzLmxlbmd0aFxuICAgICwgbWlkXG4gIHdoaWxlIChsb3cgPCBoaWdoKSB7XG4gICAgbWlkID0gTWF0aC5mbG9vcigobG93ICsgaGlnaCkgLyAyKVxuICAgIGlmICh0aGlzLl9ldmVudHNbbWlkXS5fZWFybGllc3RUaW1lIDwgZGVhZGxpbmUpXG4gICAgICBsb3cgPSBtaWQgKyAxXG4gICAgZWxzZSBoaWdoID0gbWlkXG4gIH1cbiAgcmV0dXJuIGxvd1xufVxuXG4vLyBDb252ZXJ0cyBmcm9tIHJlbGF0aXZlIHRpbWUgdG8gYWJzb2x1dGUgdGltZVxuV0FBQ2xvY2sucHJvdG90eXBlLl9hYnNUaW1lID0gZnVuY3Rpb24ocmVsVGltZSkge1xuICByZXR1cm4gcmVsVGltZSArIHRoaXMuY29udGV4dC5jdXJyZW50VGltZVxufVxuXG4vLyBDb252ZXJ0cyBmcm9tIGFic29sdXRlIHRpbWUgdG8gcmVsYXRpdmUgdGltZSBcbldBQUNsb2NrLnByb3RvdHlwZS5fcmVsVGltZSA9IGZ1bmN0aW9uKGFic1RpbWUpIHtcbiAgcmV0dXJuIGFic1RpbWUgLSB0aGlzLmNvbnRleHQuY3VycmVudFRpbWVcbn0iXX0=
