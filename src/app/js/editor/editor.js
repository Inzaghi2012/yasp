if (typeof yasp == 'undefined') yasp = { };

yasp.Storage = localStorage || { };

(function() {
  /**
   * Initialize code mirror textarea and keeps track of every editor textarrea
   * @constructor
   */
  var EditorManager = function() {
    this.editors = [ ];
    this.editorContext = null;
  };

  /**
   * Calls a function for every editor associated with the EditorManager
   * @param func
   */
  EditorManager.prototype.apply = function(func) {
    for (var i = 0; i < this.editors.length; i++) {
      func(this.editors[i]);
    }
  };

  /**
   * Sets the context (this is where the breakpoints are saved for example)
   * @param context
   */
  EditorManager.prototype.setContext = function(context) {
    this.editorContext = context;
  };
  
  /**
   * Creates an editor instance
   * @param domElement
   * @returns {*}
   */
  EditorManager.prototype.create = function(domElement) {
    var editor = CodeMirror.fromTextArea(domElement, {
      mode: "text/assembler",
      theme: yasp.Storage['theme'],
      lineNumbers: true,
      undoDepth: 100,
      autofocus: true,
      indentUnit: yasp.Storage['indentUnit'],
      tabSize: yasp.Storage['indentUnit'],
      indentWithTabs: true,
      gutters: ["CodeMirror-lint-markers", "breakpoints"],
      lint: true,
      extraKeys: {
        "Ctrl-Space": "autocompleteforce"
      }
    });
    editor.on("gutterClick", (function(cm, n) {
      this.apply((function(cm) {
        var info = cm.lineInfo(n);
        cm.setGutterMarker(n, "breakpoints", info.gutterMarkers ? null : (function() {
          var marker = $(document.createElement('div'));
          marker.css({
            "color": '#FF0000',
            "font-size": "125%",
            "position": "relative",
            "top": "-2px",
            "left": "-2px"
          });
          marker.text("●");
          return marker.get(0);
        })());
      }).bind(this));
    }).bind(this));
    this.editors.push(editor);
    return editor;
  };
  yasp.EditorManager = new EditorManager();
})();

(function() {
  var UPDATE_DELAY = 500; // time between souce code is parsed
  var HINT_DELAY = 750; // time between hints are displayed
  
  
  var fireDataReceived;
  
  yasp.CompileManager = {
    lastCompile: null,
    commands: null,
    registers: null,
    compile: function(content, cb) {
      if (content != this.lastUpdate) {
        this.lastUpdate = content;
        console.log("update");
        yasp.AssemblerCommunicator.sendMessage("assemble", {
          code: content,
          jobs: ['symbols', 'map', 'ast', 'bitcode']
        }, function(response) {
          yasp.Editor.error = !!response.error ? response.error.errors : null;
          if (!!response.payload) {
            yasp.Editor.map = response.payload.map;
            yasp.Editor.symbols = response.payload.symbols;
            yasp.Editor.ast = response.payload.ast;
            yasp.Editor.bitcode = response.payload.bitcode;
            
            // update orderedSymbols
            var osymbols = yasp.Editor.orderedSymbols;
            osymbols.length = 0;
            var instructions = yasp.Editor.symbols.instructions;
            for (var k in instructions) {
              osymbols.push(k);
            }
            var labels = yasp.Editor.symbols.labels;
            for (var k in labels) {
              osymbols.push(labels[k].text);
            }
            var usedRegisters = yasp.Editor.symbols.usedRegisters;
            for (var k in usedRegisters) {
              osymbols.push(k);
            }
            var defines = yasp.Editor.symbols.defines;
            for (var k in defines) {
              osymbols.push(k);
            }
            osymbols.sort(function(a, b) {
              var aCount = yasp.Editor.getIdentifierOccurence(a);
              var bCount = yasp.Editor.getIdentifierOccurence(b);
              
              return bCount - aCount;
            });
            
            // init commands if uninitialized
            if (!this.commands) {
              this.commands = [ ];
              var added = { }
              for (var i = 0; i < yasp.commands.length; i++) {
                var commandName = yasp.commands[i].name;
                for (var j = 0; j < (commandName instanceof Array ? commandName.length : 1); j++) {
                  var name = commandName instanceof Array ? commandName[j] : commandName;
                  if (!added[name] && !yasp.Editor.symbols.instructions[name] && name != null) {
                    this.commands.push(name);
                    added[name] = 42;
                  }
                }
              }
              this.commands.sort();
            }
            
            // add commands
            var added = { }
            for (var i = 0; i < this.commands.length; i++) {
              var name = this.commands[i];
              if (!added[name] && !yasp.Editor.symbols.instructions[name] && name != null) {
                osymbols.push(name);
                added[name] = 42;
              }
            }
            
            // init registers
            if (!this.registers) this.registers = yasp.Lexer.getRegisters();
            
            // add registers
            for (var i = 0; i < this.registers.length; i++) {
              if (!usedRegisters[this.registers[i]]) osymbols.push(this.registers[i]);
            }
            
            fireDataReceived();
          }
          
          cb(response);
        });
      } else {
        cb(null);
      }
    }
  }
  yasp.CompileManager.compile = yasp.CompileManager.compile.bind(yasp.CompileManager);
  
  yasp.Editor = {
    map: { },
    symbols: {
      labels: { },
      instructions: { },
      usedRegisters: { },
      defines: { }
    },
    orderedSymbols: [ ],
    error: [ ],
    labelText: "",
    breakpoints: [ ],
    ast: [ ],
    bitcode: new Uint8Array(),
    getIdentifierOccurence: function(name) {
      if (!!yasp.Editor.symbols.instructions[name]) return yasp.Editor.symbols.instructions[name];
      if (!!yasp.Editor.symbols.usedRegisters[name]) return yasp.Editor.symbols.usedRegisters[name];
      return 0;
    }
  };
  
  yasp.AssemblerCommunicator = new yasp.Communicator("app/js/assembler/assembler_backend.js");
  
  $('body').ready(function() {
    // linting
    (function() {
      CodeMirror.registerHelper("lint", "assembler", function(text) {
        var result = [ ];
        var errs = yasp.Editor.error;
        if (!!errs) {
          for (var i = 0; i < errs.length; i++) {
            var err = errs[i];
            result.push({
              from: CodeMirror.Pos(err.line-1, 0),
              to: CodeMirror.Pos(err.line-1, err.char),
              message: err.message,
              severity: err.type
            });
          }
        }
        
        return result;
      });
    })();
    
    
    if (typeof yasp.Storage['theme'] == 'undefined')           yasp.Storage['theme'] = 'eclipse';
    if (typeof yasp.Storage['indentUnit'] == 'undefined')      yasp.Storage['indentUnit'] = "8"; // localStorage saves as string
    if (typeof yasp.Storage['automaticsave'] == 'undefined')   yasp.Storage['automaticsave'] = "true";
    if (typeof yasp.Storage['codecompletion'] == 'undefined')  yasp.Storage['codecompletion'] = "true";
    if (typeof yasp.Storage['language'] == 'undefined')        yasp.Storage['language'] = "English";
    if (typeof yasp.Storage['labellist'] == 'undefined')       yasp.Storage['labellist'] = "true";
    if (typeof yasp.Storage['help'] == 'undefined')       yasp.Storage['help'] = "true";
    
    yasp.EditorManager.setContext(yasp.Editor);
    var editor = yasp.EditorManager.create($('#editor').get(0));
    
    // force intendation everytime something changes
    editor.on("change", function() {
      var c = editor.getCursor();
      if (!!c) {
        var content = editor.getLine(c.line);
        editor.indentLine(c.line);
        // fix bug introduced in Commit #32d7db0cf78f5ed9dde3450ad885ced98851271b that causes the input to be fucked up...
        if (editor.getLine(c.line) != content) {
          c.ch++; // if you ever add multiple levels of intendation this should be changed into somehting more intelligent
        }
        editor.setCursor(c);
        
        setTimeout(function() { // fixes bug that causes the completition dialog to be immediately closed
          CodeMirror.commands.autocomplete(editor);
        }, 0);
      }
    });
    
    // update symbols
    var update, first = true;
    (update = function() {
      var content = editor.getValue();
      yasp.CompileManager.compile(content, function(result) {
        if (first) editor.setValue(content); // force update of existing labels, VERY dirty
        first = false;
        
        setTimeout(update, UPDATE_DELAY)
      });
    })();
    
    // update label list
    fireDataReceived = function() {
      // build new label list text
      var text = "<h4>Labels</h4><ul>";
      var labels = yasp.Editor.symbols.labels;
      for (var l in labels) {
        text += "<li><a class='labellink'>" + labels[l].text + "</a></li>";
      }
      text += "</ul>";
      
      $('#labellist')
        .html(text)
        .find('.labellink')
        .click(function(e) {
          var elem = $(this);
          console.log("Jump to "+elem.text());
          var label = yasp.Editor.symbols.labels[elem.text().toUpperCase()];
          if (!!label) {
            editor.scrollIntoView(CodeMirror.Pos(label.line, label.char), 32);
            editor.setCursor(CodeMirror.Pos(label.line, label.char));
          } else {
            console.log("Unknown label");
          }
        });
      
    };
    
    var updateLabelListVisiblity = function() {
      var mode;
      if (yasp.Storage['labellist'] == "false") { // hide label list if deactivated
        mode = "none";
      } else {
        mode = "block";
      }
      $('#labellist').css({
        'display': mode
      });
    };
    
    // menu & UI events
    (function() {
      updateLabelListVisiblity();
      
      $('#labellist').hover(function() {
        $(this).filter(':not(:animated)').animate({
          'marginLeft': '-100px',
          'opacity': '1'
        }, 'fast');
      }, function() {
        $(this).animate({
          'marginLeft': '-20px',
          'opacity': '0.5'
        }, 'fast');
      });
      
      $('.menu_undo').click(function() {
        editor.undo();
      });
      $('.menu_redo').click(function() {
        editor.redo();
      });
      $('.menu_find').click(function() {
        CodeMirror.commands.find(editor);
      });
      $('.menu_replace').click(function() {
        CodeMirror.commands.replace(editor);
      });
      $('.menu_go2line').click(function() {
        editor.openDialog('Go to line: <input type="text" style="width: 10em"/>', function(line) {
          line = +line-1;
          if (line >= 0 && line < editor.lineCount()) {
            editor.scrollIntoView(CodeMirror.Pos(+line, 0), 32);
            editor.setCursor(CodeMirror.Pos(+line, 0));
          } else {
            console.log("invalid line");
          }
        });
      });
      $('.menu_settings').click(function() {
        $('#dialog_settings').modal({
          'keyboard': true
        });
        
        $('#theme_picker').change(function() {
          yasp.Storage['theme'] = this.value;
          yasp.EditorManager.apply((function(e) {
            e.setOption("theme", this.value);
          }).bind(this));
        }).val(editor.getOption("theme"));
        
        $('#tab_picker').change(function() {
          yasp.Storage['indentUnit'] = this.value;
          yasp.EditorManager.apply((function(e) {
            e.setOption("indentUnit", +this.value);
            e.setOption("tabSize", +this.value);
          }).bind(this));
        }).val(+editor.getOption("indentUnit"));

        $('#language_picker').change(function() {
          yasp.Storage['language'] = this.value;
          yasp.EditorManager.apply((function(e) {
            e.setOption("language", this.value);
          }).bind(this));
        }).val(yasp.Storage['language']);
        
        $('#automaticsave_picker').change(function() {
          yasp.Storage['automaticsave'] = this.checked;
        }).attr('checked', yasp.Storage['automaticsave'] == "true" ? true : false);
        
        $('#codecompletion_picker').change(function() {
          yasp.Storage['codecompletion'] = this.checked;
        }).attr('checked', yasp.Storage['codecompletion'] == "true" ? true : false);

        $('#labellist_picker').change(function() {
          yasp.Storage['labellist'] = this.checked;
          updateLabelListVisiblity();
        }).attr('checked', yasp.Storage['labellist'] == "true" ? true : false);
        
        $('#help_picker').change(function() {
          yasp.Storage['help'] = this.checked;
        }).attr('checked', yasp.Storage['help'] == "true" ? true : false);
      });
      $('.menu_about').click(function() {
        $('#dialog_about').modal({
          'keyboard': true
        });
      });
      
      $('.menu_run').click(function() {
        // compile
        yasp.CompileManager.compile(editor.getValue(), function(data) {
          if (!yasp.Editor.error || yasp.Editor.error.length == 0) {
            yasp.Debugger.show(); // open debugger
          } else {
            console.log("Invalid code");
            // TODO implement proper error dialog
          }
        });
      });
      
      $('.menu_help').click(function() {
        switch(yasp.Storage["language"].toLowerCase()) {
          case "english":
            $('.help_en').css({'display': 'block'});
            $('.help_de').css({'display': 'none'});
            break;
          case "deutsch":
            $('.help_en').css({'display': 'none'});
            $('.help_de').css({'display': 'block'});
            break;
        }
        $('#dialog_help').modal({
          'keyboard': true
        });
      });
    })();
    
    // load help data
    $.ajax('app/help/help.html').done(function(responseText) {
      $('#help_container').html(responseText);
    }).fail(function() {
      console.log("failed to load help");
    });
    
    // update help rendering parameters
    var quickdoc = null;
    setInterval(function() {
      var c = editor.getCursor();
      var found = false;
      var changed = false;
      var height = 0;
      if (!!c &&  (!yasp.Editor.error || yasp.Editor.error.length == 0) && yasp.Storage['help'] == "true") {
        for (var i = 0; i < yasp.Editor.ast.length; i++) {
          var entry = yasp.Editor.ast[i];
          if (entry.type.name == "command" && entry.token.line == (c.line + 1) && !!entry.params.command) {            
            var command = entry.params.command;
            var desc = yasp.Language.getSpecificLanguage(command.doc);

            var cmdStr = "";
            if (command.name instanceof Array) {
              var names = command.name;
              for (var j = 0; j < names.length; j++) {
                if (j > 0) cmdStr += " | ";
                cmdStr += names[j].toUpperCase();
              }
              cmdStr += " ";
            } else {
              cmdStr = command.name.toUpperCase()+" ";
            }
            for (var j = 0; j < command.params.length; j++) {
              if (j > 0) cmdStr += ", ";
              
              var param = command.params[j];
              switch (param.type) {
                case "r_byte":
                  cmdStr += "Byte Register";
                  break;
                case "r_word":
                  cmdStr += "Word Register";
                  break;
                case "l_byte":
                  cmdStr += "Byte Literal";
                  break;
                case "l_word":
                  cmdStr += "Word Literal";
                  break;
                case "pin":
                  cmdStr += "Pin";
                  break;
                case "address":
                  cmdStr += "Label";
                  break;
                default:
                  cmdStr += type.type;
              }
            }
            
            $('#help_quick .command').html("<b>"+cmdStr+"</b>");
            
            $('#help_quick .desc').html(desc.description);
            
            if (!!desc.flags) {
              var state = "";
              state += !!desc.flags.c ? ("Carry Bit: " + desc.flags.c + "<br />") : "";
              state += !!desc.flags.z ? ("Zero Bit: " + desc.flags.z) : "";
              
              if (state.length > 0) state = "<p>" + state + "</p>";
              
              $('#help_quick .state').html(state);
            }
            
            height = $('#help_quick .helpquick_container').height() + 16;
            if (quickdoc != desc) changed = true;
            quickdoc = desc;
            
            found = true;
          }
        }
      }
      if (!found && !!quickdoc) {
        changed = true;
        quickdoc = null;
      }

      if (changed) {
        $('#help_quick').animate({
          height: height + "px"
        }, "fast");
      }
    }, 500);
    
    // hinting
    (function() {
      var delimiters = yasp.Lexer.getDelimiters();
      CodeMirror.registerHelper("hint", "assembler", function(editor, options) {
        var cur = editor.getCursor(), curLine = editor.getLine(cur.line);
        var start = cur.ch, end = start;
        while (end < curLine.length && delimiters.indexOf(curLine.charAt(end)) == -1) ++end;
        while (start && delimiters.indexOf(curLine.charAt(start - 1)) == -1) --start;
        var curWord = start != end && curLine.slice(start, end);
        if (!!curWord) {
          curWord = curWord.toUpperCase();
        } else {
          if (options.force) {
            curWord = "";
          } else {
            curWord = null;
          }
        }
        
        console.log("Current Word: '"+curWord+"'");
        
        var symbols = [];
        
        var osymbols = yasp.Editor.orderedSymbols;
        for (var i = 0; i < osymbols.length && curWord != null; i++) {
          if ((osymbols[i].toUpperCase().indexOf(curWord) == 0 && osymbols[i].toUpperCase() != curWord)) {
            symbols.push(osymbols[i]);
          }
        }
        
        return {list: symbols, from: CodeMirror.Pos(cur.line, start), to: CodeMirror.Pos(cur.line, end)};
      });
      
      CodeMirror.commands.autocomplete = function(cm) {
        if (yasp.Storage['codecompletion'] == "true") {
          var cursor = editor.getCursor();
          setTimeout(function() {
            var newCursor = editor.getCursor();
            if (cursor && newCursor && cursor.line == newCursor.line && cursor.ch == newCursor.ch) {
              CodeMirror.showHint(cm, CodeMirror.hint.assembler, {
                completeSingle: false,
                alignWithWord: false,
                closeOnUnfocus: true,
                force: false
              });
            }
          }, HINT_DELAY);
        }
      };
      CodeMirror.commands.autocompleteforce = function(cm) {
        CodeMirror.showHint(cm, CodeMirror.hint.assembler, {
          completeSingle: true,
          alignWithWord: false,
          closeOnUnfocus: true,
          force: true
        });
      };
    })();
  });
})();