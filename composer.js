/*
 * Copyright (c) 2011, Lyon Bros Enterprises, LLC. (http://www.lyonbros.com)
 *
 * Licensed under The MIT License.
 * Redistributions of files must retain the above copyright notice.
 */
(function() {
  "use strict";
  if (!this.Composer) {
    var Composer = {
      version: "1.3.5",
      exp0rt: function(obj) {
        Object.keys(obj).forEach(function(key) {
          Composer[key] = obj[key];
        });
      }
    };
    this.Composer = Composer;
  }
  var Composer = this.Composer;
  var sync = function(method, model, options) {
    return options.success();
  };
  var set_sync = function(syncfn) {
    this.Composer.sync = syncfn;
  }.bind(this);
  var cid = (function() {
    var counter = 1;
    return function(inc) {
      return "c" + counter++;
    };
  })();
  var wrap_error = function(callback, model, options) {
    return function(resp) {
      if (callback) {
        callback(model, resp, options);
      } else {
        this.fire_event("error", options, model, resp, options);
      }
    };
  };
  var eq = function(a, b) {
    if (a === b) return true;
    if (a instanceof Function) return false;
    if (typeof a != typeof b) return false;
    if ((a && a.constructor && !b) || !b.constructor) return false;
    if ((b && b.constructor && !a) || !a.constructor) return false;
    if (a && b && a.constructor != b.constructor) return false;
    if (
      a instanceof Array ||
      Object.prototype.toString.call(a) === "[object Array]"
    ) {
      if (a.length != b.length) return false;
      for (var i = 0, n = a.length; i < n; i++) {
        if (!b.hasOwnProperty(i)) return false;
        if (!eq(a[i], b[i])) return false;
      }
    } else if (a instanceof Date && b instanceof Date) {
      return a.getTime() == b.getTime();
    } else if (a instanceof Object) {
      for (var p in b) {
        if (b.hasOwnProperty(p) && !a.hasOwnProperty(p)) return false;
      }
      for (var p in a) {
        if (!a.hasOwnProperty(p)) continue;
        if (!b.hasOwnProperty(p)) return false;
        if (a[p] === b[p]) continue;
        if (typeof a[p] !== "object") return false;
        if (!eq(a[p], b[p])) return false;
      }
    } else if (a != b) {
      return false;
    }
    return true;
  };
  var merge_extend = function(cls, properties) {
    var _extend = cls.extend;
    cls.extend = function(def, base) {
      base || (base = this);
      var attr = base.prototype;
      properties.forEach(function(prop) {
        def[prop] = Composer.object.merge({}, attr[prop], def[prop]);
      });
      var cls = _extend.call(base, def);
      Composer.merge_extend(cls, properties);
      return cls;
    };
  };
  var array = {
    erase: function(arr, item) {
      for (var i = arr.length - 1; i >= 0; i--) {
        if (arr[i] === item) arr.splice(i, 1);
      }
    },
    is: (function() {
      return "isArray" in Array
        ? Array.isArray
        : function(obj) {
            return (
              obj instanceof Array ||
              Object.prototype.toString.call(obj) === "[object Array]"
            );
          };
    })()
  };
  var object = {
    each: function(obj, fn, bind) {
      if (!obj) return;
      bind || (bind = this);
      Object.keys(obj).forEach(function(key) {
        fn.bind(bind)(obj[key], key);
      });
    },
    clone: function(obj, options) {
      options || (options = {});
      if (options.deep) return JSON.parse(JSON.stringify(obj));
      var clone = {};
      Object.keys(obj).forEach(function(key) {
        clone[key] = obj[key];
      });
      return clone;
    },
    merge: function(to, _) {
      var args = Array.prototype.slice.call(arguments, 1);
      args.forEach(function(obj) {
        if (!obj) return;
        Object.keys(obj).forEach(function(key) {
          to[key] = obj[key];
        });
      });
      return to;
    },
    set: function(object, key, value) {
      object || (object = {});
      var paths = key.split(".");
      var obj = object;
      for (var i = 0, n = paths.length; i < n; i++) {
        var path = paths[i];
        if (i == n - 1) {
          obj[path] = value;
          break;
        }
        if (!obj[path]) {
          obj[path] = {};
        } else if (typeof obj != "object" || Composer.array.is(obj)) {
          obj[path] = {};
        }
        obj = obj[path];
      }
      return object;
    },
    get: function(object, key) {
      object || (object = {});
      var paths = key.split(".");
      var obj = object;
      for (var i = 0, n = paths.length; i < n; i++) {
        var path = paths[i];
        var type = typeof obj[path];
        if (type == "undefined") {
          return obj[path];
        }
        obj = obj[path];
      }
      return obj;
    }
  };
  var promisify = function(poptions) {
    poptions || (poptions = {});
    var convert = function(type, asyncs) {
      if (!Composer[type]) return;
      Object.keys(asyncs).forEach(function(key) {
        var spec = asyncs[key];
        var options_idx = spec.options_idx || 0;
        var names = spec.names || ["success", "error"];
        var _old = Composer[type].prototype[key];
        Composer[type].prototype[key] = function() {
          var args = Array.prototype.slice.call(arguments, 0);
          if (args.length < options_idx) {
            var _tmp = new Array(options_idx);
            args.forEach(function(item, i) {
              _tmp[i] = item;
            });
            args = _tmp;
          }
          if (!args[options_idx]) args[options_idx] = {};
          var _self = this;
          var options = args[options_idx];
          if (options.promisified) return _old.apply(_self, args);
          if (poptions.warn && (options[names[0]] || options[names[1]])) {
            console.warn(
              "Composer: promisify: attempting to pass callbacks to promisified function: ",
              type,
              key
            );
          }
          return new Promise(function(resolve, reject) {
            if (names[0]) options[names[0]] = resolve;
            if (names[1])
              options[names[1]] = function(_, err) {
                reject(err);
              };
            options.promisified = true;
            _old.apply(_self, args);
          });
        };
      });
    };
    convert("Model", { fetch: {}, save: {}, destroy: {} });
    convert("Collection", {
      fetch: {},
      reset_async: { options_idx: 1, names: ["complete"] }
    });
    convert("Controller", { html: { options_idx: 1, names: ["complete"] } });
    convert("ListController", {
      html: { options_idx: 1, names: ["complete"] }
    });
  };
  this.Composer.exp0rt({
    sync: sync,
    set_sync: set_sync,
    cid: cid,
    wrap_error: wrap_error,
    eq: eq,
    merge_extend: merge_extend,
    array: array,
    object: object,
    promisify: promisify
  });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var typeOf = function(obj) {
    if (obj == null) return "null";
    var type = typeof obj;
    if (type != "object") return type;
    if (obj instanceof Array) return "array";
    return type;
  };
  var merge = function(into, from, options) {
    options || (options = {});
    var keys = Object.keys(from);
    var transform = options.transform;
    for (var i = 0, n = keys.length; i < n; i++) {
      var k = keys[i];
      if (transform) transform(into, from, k);
      into[k] = from[k];
    }
    return into;
  };
  var copy = function(obj) {
    for (var k in obj) {
      var val = obj[k];
      var type = typeOf(val);
      if (type == "object") {
        obj[k] = copy(merge({}, val));
      } else if (type == "array") {
        obj[k] = val.map(copy);
      }
    }
    return obj;
  };
  var create = function(base) {
    if ("create" in Object) {
      var prototype = Object.create(base.prototype);
    } else {
      base.$initializing = true;
      var prototype = new base();
      delete base.$initializing;
    }
    var cls = function Omni() {
      if (cls.$initializing) return this;
      copy(this);
      this.$state = { parents: {}, fn: [] };
      return this.initialize ? this.initialize.apply(this, arguments) : this;
    };
    cls.$constructor = prototype.$constructor = cls;
    cls.prototype = prototype;
    cls.prototype.$parent = base;
    return cls;
  };
  var extend_parent = function(to, from, k) {
    return function() {
      if (!this.$state.parents[k]) this.$state.parents[k] = [];
      this.$state.parents[k].push(from);
      this.$state.fn.push(k);
      var val = to.apply(this, arguments);
      this.$state.fn.pop();
      this.$state.parents[k].pop();
      return val;
    };
  };
  var do_extend = function(to_prototype, from_prototype) {
    return merge(to_prototype, from_prototype, {
      transform: function(into, from, k) {
        if (
          typeof into[k] != "function" ||
          into[k].prototype.$parent ||
          typeof from[k] != "function" ||
          from[k].prototype.$parent
        )
          return false;
        from[k] = extend_parent(from[k], into[k], k);
        from[k].$parent = into[k];
      }
    });
  };
  var Base = function() {};
  Base.extend = function(obj) {
    var base = this;
    var cls = create(base);
    do_extend(cls.prototype, obj);
    cls.extend = Base.extend;
    cls.prototype.$get_parent = function() {
      var k = this.$state.fn[this.$state.fn.length - 1];
      if (!k) return false;
      var parents = this.$state.parents[k];
      var parent = parents[parents.length - 1];
      return parent || false;
    };
    cls.prototype.parent = function() {
      var fn = this.$get_parent();
      if (fn) return fn.apply(this, arguments);
      throw "Class.js: Bad parent method: " +
        this.$state.fn[this.$state.fn.length - 1];
    };
    return cls;
  };
  function Class(obj) {
    return Base.extend(obj);
  }
  Class.extend = Class;
  Composer.exp0rt({ Class: Class });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var make_lookup_name = function(event_name, bind_name) {
    return event_name + "@" + bind_name;
  };
  var Event = Composer.Class({
    _handlers: {},
    _handler_names: {},
    bind: function(event_name, fn, bind_name) {
      if (Composer.array.is(event_name)) {
        event_name.forEach(
          function(ev) {
            this.bind(ev, fn, bind_name);
          }.bind(this)
        );
        return this;
      }
      if (bind_name) this.unbind(event_name, bind_name);
      if (!this._handlers[event_name]) this._handlers[event_name] = [];
      var eventhandlers = this._handlers[event_name];
      eventhandlers.push(fn);
      if (bind_name) {
        this._handler_names[make_lookup_name(event_name, bind_name)] = fn;
      }
      return this;
    },
    bind_once: function(event_name, fn, bind_name) {
      bind_name || (bind_name = null);
      var wrapped_function = function() {
        this.unbind(event_name, wrapped_function);
        fn.apply(this, arguments);
      }.bind(this);
      return this.bind(event_name, wrapped_function, bind_name);
    },
    unbind: function(event_name, function_or_name) {
      if (!event_name) return this.wipe();
      if (Composer.array.is(event_name)) {
        event_name.forEach(
          function(ev) {
            this.unbind(ev, function_or_name);
          }.bind(this)
        );
        return this;
      }
      if (!function_or_name) return this.unbind_all(event_name);
      var is_fn = function_or_name instanceof Function;
      var lookup_name = is_fn
        ? null
        : make_lookup_name(event_name, function_or_name);
      var fn = is_fn ? function_or_name : this._handler_names[lookup_name];
      if (!fn) return this;
      if (!is_fn) delete this._handler_names[lookup_name];
      if (!this._handlers[event_name]) return this;
      var idx = this._handlers[event_name].indexOf(fn);
      if (idx < 0) return this;
      this._handlers[event_name].splice(idx, 1);
      return this;
    },
    unbind_all: function(event_name) {
      delete this._handlers[event_name];
      return this;
    },
    wipe: function(options) {
      options || (options = {});
      this._handlers = {};
      this._handler_names = {};
      return this;
    },
    trigger: function(event_name, _) {
      var args = Array.prototype.slice.call(arguments, 0);
      var handlers = this._handlers[event_name] || [];
      var catch_all = this._handlers["all"] || [];
      var handlers_copy = handlers.slice(0);
      var handlers_args = args.slice(1);
      for (var i = 0, n = handlers_copy.length; i < n; i++) {
        handlers_copy[i].apply(this, handlers_args);
      }
      var catchall_copy = catch_all.slice(0);
      var catchall_args = args.slice(0);
      for (var i = 0, n = catchall_copy.length; i < n; i++) {
        catchall_copy[i].apply(this, catchall_args);
      }
      return this;
    }
  });
  Event._make_lookup_name = make_lookup_name;
  Composer.exp0rt({ Event: Event });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var Base = Composer.Event.extend({
    __composer_type: "base",
    options: {},
    _cid: false,
    initialize: function() {
      this._cid = Composer.cid();
    },
    cid: function() {
      return this._cid;
    },
    set_options: function(options) {
      options || (options = {});
      Object.keys(options).forEach(
        function(key) {
          this.options[key] = options[key];
        }.bind(this)
      );
    },
    fire_event: function() {
      var args = Array.prototype.slice.call(arguments, 0);
      var evname = args.shift();
      var options = args.shift();
      options || (options = {});
      args.unshift(evname);
      if (!options.silent && !options.not_silent) {
        return this.trigger.apply(this, args);
      } else if (
        options.not_silent &&
        (options.not_silent == evname ||
          (options.not_silent.indexOf &&
            options.not_silent.indexOf(evname) >= 0))
      ) {
        return this.trigger.apply(this, args);
      } else if (
        options.silent &&
        ((typeof options.silent == "string" && options.silent != evname) ||
          (options.silent.indexOf && !(options.silent.indexOf(evname) >= 0)))
      ) {
        return this.trigger.apply(this, args);
      }
      return this;
    }
  });
  Composer.exp0rt({ Base: Base });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var Model = Composer.Base.extend({
    __composer_type: "model",
    defaults: {},
    data: {},
    _changed: false,
    collections: [],
    id_key: "id",
    base_url: false,
    validate: function(data, options) {
      return false;
    },
    initialize: function(data, options) {
      data || (data = {});
      var _data = {};
      var merge_fn = function(v, k) {
        _data[k] = v;
      };
      Composer.object.each(Composer.object.clone(this.defaults), merge_fn);
      Composer.object.each(data, merge_fn);
      this.parent();
      this.set(_data, options);
      this.init(options);
    },
    init: function() {},
    get: function(key, def) {
      if (typeof def == "undefined") def = null;
      if (typeof this.data[key] == "undefined") {
        return def;
      }
      return this.data[key];
    },
    escape: function(key) {
      var data = this.get(key);
      if (data == null || typeof data != "string") {
        return data;
      }
      return data
        .replace(/&(?!\w+;|#\d+;|#x[\da-f]+;)/gi, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
    },
    has: function(key) {
      return this.data[key] != null;
    },
    set: function(data, options) {
      options || (options = {});
      if (!options.silent && !this.perform_validation(data, options))
        return false;
      var already_changing = this.changing;
      this.changing = true;
      Composer.object.each(
        data,
        function(val, key) {
          if (!Composer.eq(val, this.data[key])) {
            this.data[key] = val;
            this._changed = true;
            this.fire_event("change:" + key, options, this, val, options);
          }
        }.bind(this)
      );
      if (!already_changing && this._changed) {
        this.fire_event("change", options, this, options, data);
        this._changed = false;
      }
      this.changing = false;
      return this;
    },
    unset: function(key, options) {
      if (!(key in this.data)) return this;
      options || (options = {});
      var obj = {};
      obj[key] = void 0;
      if (!options.silent && !this.perform_validation(obj, options))
        return false;
      delete this.data[key];
      this._changed = true;
      this.fire_event("change:" + key, options, this, void 0, options);
      this.fire_event("change", options, this, options);
      this._changed = false;
      return this;
    },
    reset: function(data, options) {
      options || (options = {});
      if (!options.silent && !this.perform_validation(data, options))
        return false;
      var already_changing = this.changing;
      this.changing = true;
      var old = this.data;
      Composer.object.each(
        old,
        function(_, key) {
          if (data.hasOwnProperty(key)) return;
          delete this.data[key];
          this._changed = true;
          this.fire_event("change:" + key, options, this, void 0, options);
        }.bind(this)
      );
      Composer.object.each(
        data,
        function(val, key) {
          if (Composer.eq(val, old[key])) return;
          this.data[key] = val;
          this._changed = true;
          this.fire_event("change:" + key, options, this, val, options);
        }.bind(this)
      );
      if (!already_changing && this._changed) {
        this.fire_event("change", options, this, options, data);
        this._changed = false;
      }
      this.changing = false;
      return this;
    },
    clear: function(options) {
      options || (options = {});
      var old = this.data;
      var obj = {};
      for (var key in old) obj[key] = void 0;
      if (!options.silent && !this.perform_validation(obj, options))
        return false;
      this.data = {};
      if (!options.silent) {
        for (var key in old) {
          this._changed = true;
          this.fire_event("change" + key, options, this, void 0, options);
        }
        if (this._changed) {
          this.fire_event("change", options, this, options);
          this._changed = false;
        }
      }
      return this;
    },
    fetch: function(options) {
      options || (options = {});
      var success = options.success;
      options.success = function(res) {
        this.set(this.parse(res), options);
        if (success) success(this, res);
      }.bind(this);
      options.error = Composer.wrap_error(
        options.error ? options.error.bind(this) : null,
        this,
        options
      ).bind(this);
      return (this.sync || Composer.sync).call(this, "read", this, options);
    },
    save: function(options) {
      options || (options = {});
      if (!this.perform_validation(this.data, options)) return false;
      var success = options.success;
      options.success = function(res) {
        if (!this.set(this.parse(res), options)) return false;
        if (success) success(this, res);
      }.bind(this);
      options.error = Composer.wrap_error(
        options.error ? options.error.bind(this) : null,
        this,
        options
      ).bind(this);
      return (this.sync || Composer.sync).call(
        this,
        this.is_new() ? "create" : "update",
        this,
        options
      );
    },
    destroy: function(options) {
      options || (options = {});
      var success = options.success;
      options.success = function(res) {
        this.fire_event("destroy", options, this, this.collections, options);
        if (success) success(this, res);
      }.bind(this);
      if (this.is_new() && !options.force) return options.success();
      options.error = Composer.wrap_error(
        options.error ? options.error.bind(this) : null,
        this,
        options
      ).bind(this);
      return (this.sync || Composer.sync).call(this, "delete", this, options);
    },
    parse: function(data) {
      return data;
    },
    id: function(no_cid) {
      if (typeof no_cid != "boolean") no_cid = false;
      var id = this.get(this.id_key);
      if (id) return id;
      if (no_cid) return false;
      return this.cid();
    },
    is_new: function() {
      return !this.id(true);
    },
    clone: function() {
      return new this.$constructor(this.toJSON());
    },
    toJSON: function() {
      return Composer.object.clone(this.data, { deep: true });
    },
    perform_validation: function(data, options) {
      if (typeof this.validate != "function") return true;
      var error = this.validate(data, options);
      if (error) {
        if (options.error) {
          options.error(this, error, options);
        } else {
          this.fire_event("error", options, this, error, options);
        }
        return false;
      }
      return true;
    },
    highest_priority_collection: function() {
      var collections = this.collections.slice(0);
      collections.sort(function(a, b) {
        return b.priority - a.priority;
      });
      return collections.length ? collections[0] : false;
    },
    url: false,
    get_url: function() {
      if (this.url) {
        if (this.url instanceof Function) {
          return this.url.call(this);
        }
        return this.url;
      }
      if (this.base_url) {
        var base_url = this.base_url;
      } else {
        var collection = this.highest_priority_collection();
        if (collection) {
          var base_url = collection.get_url();
        } else {
          var base_url = "";
        }
      }
      var id = this.id(true);
      id = id ? "/" + id : "";
      var url = base_url
        ? "/" + base_url.replace(/^\/+/, "").replace(/\/+$/, "") + id
        : id;
      return url;
    }
  });
  Composer.exp0rt({ Model: Model });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var global = this;
  var Collection = Composer.Base.extend({
    __composer_type: "collection",
    model: Composer.Model,
    _models: [],
    _id_idx: {},
    _cid_idx: {},
    sortfn: null,
    url: "/mycollection",
    priority: 1,
    initialize: function(models, params, options) {
      params || (params = {});
      for (var x in params) {
        this[x] = params[x];
      }
      this.parent();
      this.model =
        typeof this.model == "string" ? global[this.model] : this.model;
      if (models) {
        this.reset(models, options);
      }
      this.init();
    },
    init: function() {},
    toJSON: function() {
      return this.models().map(function(model) {
        return model.toJSON();
      });
    },
    models: function() {
      return this._models;
    },
    size: function() {
      return this.models().length;
    },
    add: function(data, options) {
      if (Composer.array.is(data)) {
        return data.forEach(
          function(model) {
            this.add(model, options);
          }.bind(this)
        );
      }
      options || (options = {});
      var model =
        data instanceof Composer.Model ? data : new this.model(data, options);
      if (model.collections.indexOf(this) == -1) {
        model.collections.push(this);
        options.is_new = true;
      }
      if (this.sortfn) {
        var index = options.at
          ? parseInt(options.at)
          : this.sort_index(model, options);
        this._models.splice(index, 0, model);
      } else {
        if (typeof options.at == "number") {
          this._models.splice(options.at, 0, model);
        } else {
          this._models.push(model);
        }
      }
      model.bind(
        "all",
        this._model_event.bind(this, model),
        "collection:" + this.cid() + ":listen:model:all"
      );
      this._index_model(model);
      this.fire_event("add", options, model, this, options);
      return model;
    },
    remove: function(model, options) {
      if (Composer.array.is(model)) {
        return model.slice(0).forEach(
          function(m) {
            this.remove(m, options);
          }.bind(this)
        );
      }
      if (!model) return;
      options || (options = {});
      Composer.array.erase(model.collections, this);
      var num_rec = this._models.length;
      Composer.array.erase(this._models, model);
      this._remove_reference(model);
      if (this._models.length != num_rec) {
        this.fire_event("remove", options, model);
      }
    },
    upsert: function(data, options) {
      if (Composer.array.is(data)) {
        return data.forEach(
          function(model) {
            this.upsert(model, options);
          }.bind(this)
        );
      }
      options || (options = {});
      var model =
        data instanceof Composer.Model ? data : new this.model(data, options);
      var existing = this.get(model.id(), options);
      if (existing) {
        var existing_idx = this.index_of(existing);
        if (typeof options.at == "number" && existing_idx != options.at) {
          this._models.splice(existing_idx, 1);
          this._models.splice(options.at, 0, existing);
          this.fire_event("sort", options);
        }
        existing.set(
          model.toJSON(),
          Composer.object.merge({}, { silent: true, upsert: true }, options)
        );
        this.fire_event("upsert", options, existing, options);
        return existing;
      }
      this.add(model, options);
      return model;
    },
    clear: function(options) {
      options || (options = {});
      var num_rec = this._models.length;
      if (num_rec == 0) return;
      this.remove(this._models, options);
      this._models = [];
      if (this._models.length != num_rec) {
        this.fire_event("clear", options, options);
      }
    },
    reset: function(data, options) {
      options || (options = {});
      if (!options.append && !options.upsert) this.clear(options);
      if (options.upsert) {
        if (!options.append) {
          var data_id_map = {};
          var id_key = new this.model().id_key;
          data.forEach(function(item) {
            if (item instanceof Composer.Model) {
              var id = item.id();
            } else {
              var id = item[id_key];
            }
            data_id_map[id] = true;
          });
          var missing = [];
          this.each(function(m) {
            var mid = m.id();
            if (!data_id_map[mid]) missing.push(mid);
          });
          var remove_list = missing.map(
            function(mid) {
              return this.get(mid);
            }.bind(this)
          );
          this.remove(remove_list);
        }
        this.upsert(data, options);
      } else {
        this.add(data, options);
      }
      this.fire_event("reset", options, options);
    },
    reset_async: function(data, options) {
      options || (options = {});
      if (data == undefined) return options.complete && options.complete();
      if (!Composer.array.is(data)) data = [data];
      data = data.slice(0);
      if (!options.append && !options.upsert) this.clear();
      if (data.length > 0) {
        var batch = options.batch || 1;
        var slice = data.splice(0, batch);
        if (options.upsert) {
          this.upsert(slice, options);
        } else {
          this.add(slice, options);
        }
      }
      if (data.length == 0) {
        this.fire_event("reset", options, options);
        if (options.complete) options.complete();
        return;
      }
      setTimeout(
        function() {
          this.reset_async(
            data,
            Composer.object.merge({ append: true }, options)
          );
        }.bind(this),
        0
      );
    },
    sort: function(options) {
      if (!this.sortfn) return false;
      this._models.sort(this.sortfn);
      this.fire_event("reset", options, options);
    },
    sort_index: function(model, options) {
      options || (options = {});
      if (this._models.length == 0) return 0;
      if (!this.sortfn) {
        var idx = this.index_of(model);
        if (idx === false || idx < 0) return this.size();
        return idx;
      }
      var sorted = this._models;
      if (options.accurate_sort) sorted = sorted.slice(0).sort(this.sortfn);
      for (var i = 0; i < sorted.length; i++) {
        if (model == sorted[i]) return i;
        if (this.sortfn(sorted[i], model) > 0) return i;
      }
      var index = sorted.indexOf(model);
      if (index == sorted.length - 1) return index;
      return sorted.length;
    },
    parse: function(data) {
      return data;
    },
    each: function(cb, bind) {
      bind || (bind = this);
      this.models().forEach(cb.bind(bind));
    },
    map: function(cb, bind) {
      bind || (bind = this);
      return this.models().map(cb.bind(bind));
    },
    find: function(callback, sortfn) {
      var models = this.models();
      if (sortfn) models = models.slice(0).sort(sortfn);
      for (var i = 0; i < models.length; i++) {
        var rec = models[i];
        if (callback(rec)) {
          return rec;
        }
      }
      return false;
    },
    exists: function(callback) {
      for (var i = 0; i < this.size(); i++) {
        if (callback(this.models()[i])) return true;
      }
      return false;
    },
    get: function(id, options) {
      options || (options = {});
      var model = this._id_idx[id];
      if (options.fast) return model || false;
      return (
        model ||
        this.find(function(model) {
          if (model.id(options.strict) == id) {
            return true;
          }
          if (options.allow_cid && model.cid() == id) {
            return true;
          }
        })
      );
    },
    find_by_cid: function(cid, options) {
      options || (options = {});
      var model = this._cid_idx[cid];
      if (options.fast) return model || false;
      return (
        model ||
        this.find(function(model) {
          if (model.cid() == cid) {
            return true;
          }
        })
      );
    },
    find_by_id: function(_) {
      return this.get.apply(this, arguments);
    },
    index_of: function(model_or_id) {
      var id =
        model_or_id.__composer_type == "model" ? model_or_id.id() : model_or_id;
      for (var i = 0; i < this._models.length; i++) {
        if (this._models[i].id() == id) {
          return i;
        }
      }
      return false;
    },
    filter: function(callback, bind) {
      bind || (bind = this);
      return this._models.filter(callback.bind(bind));
    },
    select: function(selector) {
      if (typeof selector == "object") {
        var params = selector;
        var keys = Object.keys(params);
        selector = function(model) {
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var compare = params[key];
            if (model.get(key) !== compare) return false;
          }
          return true;
        };
      }
      return this._models.filter(selector);
    },
    select_one: function(selector) {
      var result = this.select(selector);
      if (result.length) return result[0];
      return null;
    },
    first: function(n) {
      var models = this.models();
      return typeof n != "undefined" && parseInt(n) != 0
        ? models.slice(0, n)
        : models[0];
    },
    last: function(n) {
      var models = this.models();
      return typeof n != "undefined" && parseInt(n) != 0
        ? models.slice(models.length - n)
        : models[models.length - 1];
    },
    at: function(n) {
      var model = this._models[n];
      return model || false;
    },
    sort_at: function(n, options) {
      options || (options = {});
      if (!this.sortfn) return false;
      var sorted = this._models;
      if (options.accurate_sort) sorted = sorted.slice(0).sort(this.sortfn);
      return sorted[n];
    },
    fetch: function(options) {
      options || (options = {});
      var success = options.success;
      options.success = function(res) {
        this.reset(this.parse(res), options);
        if (success) success(this, res);
      }.bind(this);
      options.error = Composer.wrap_error(
        options.error ? options.error.bind(this) : null,
        this,
        options
      ).bind(this);
      return (this.sync || Composer.sync).call(this, "read", this, options);
    },
    get_url: function() {
      return this.url;
    },
    _index_model: function(model) {
      var id = model.id(true);
      if (id) {
        this._unindex_model(model);
        this._id_idx[id] = model;
        model._tracked_ids.push(id);
      }
      this._cid_idx[model.cid()] = model;
    },
    _unindex_model: function(model) {
      if (!model._tracked_ids) model._tracked_ids = [];
      model._tracked_ids.forEach(
        function(id) {
          delete this._id_idx[id];
        }.bind(this)
      );
      delete this._cid_idx[model.cid()];
    },
    _remove_reference: function(model) {
      this._unindex_model(model);
      Composer.array.erase(model.collections, this);
      model.unbind("all", "collection:" + this.cid() + ":listen:model:all");
    },
    _model_event: function(model, ev, _) {
      if (ev == "change:" + model.id_key) this._index_model(model);
      if (ev == "destroy") this.remove(model, arguments[4]);
      var args = Array.prototype.slice.call(arguments, 1);
      this.trigger.apply(this, args);
    }
  });
  Composer.exp0rt({ Collection: Collection });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var global = this;
  var document = global.document || { _blank: true };
  var has_sizzle = !!global.Sizzle;
  var has_jquery = !!global.jQuery;
  var has_slick = !!global.Slick;
  var which_adapter = function(types) {
    var wrap = function(fn) {
      return function(context, selector) {
        context || (context = document);
        if (types.native && context instanceof global.DocumentFragment) {
          return types.native(context, selector);
        } else {
          return fn(context, selector);
        }
      };
    };
    if (has_slick && types.slick) return wrap(types.slick);
    if (has_sizzle && types.sizzle) return wrap(types.sizzle);
    if (has_jquery && types.jquery) return wrap(types.jquery);
    if ("querySelector" in document && types.native) return wrap(types.native);
    if (document._blank) return function() {};
    throw new Error(
      "No selector engine present. Include Sizzle/jQuery or Slick/Mootools before loading composer (or use a modern browser with document.querySelector)."
    );
  };
  var find = which_adapter({
    slick: function(context, selector) {
      return Slick.find(context, selector);
    },
    sizzle: function(context, selector) {
      return Sizzle.select(selector, context)[0];
    },
    jquery: function(context, selector) {
      return jQuery(context).find(selector)[0];
    },
    native: (function() {
      var scope = false;
      try {
        document.querySelector(":scope > h1");
        scope = true;
      } catch (e) {}
      return function(context, selector) {
        if (scope && !(context instanceof global.DocumentFragment))
          selector = ":scope " + selector;
        return context.querySelector(selector);
      };
    })()
  });
  var match = which_adapter({
    slick: function(context, selector) {
      return Slick.match(context, selector);
    },
    sizzle: function(context, selector) {
      return Sizzle.matchesSelector(context, selector);
    },
    jquery: function(context, selector) {
      return jQuery(context).is(selector);
    },
    native: function(context, selector) {
      if ("matches" in context) var domatch = context.matches;
      if ("msMatchesSelector" in context)
        var domatch = context.msMatchesSelector;
      if ("mozMatchesSelector" in context)
        var domatch = context.mozMatchesSelector;
      if ("webkitMatchesSelector" in context)
        var domatch = context.webkitMatchesSelector;
      return domatch.call(context, selector);
    }
  });
  var captured_events = { focus: true, blur: true };
  var add_event = (function() {
    return function(el, ev, fn, selector) {
      var capture = captured_events[ev] || false;
      if (selector) {
        el.addEventListener(
          ev,
          function(event) {
            if (event && global.MooTools && global.DOMEvent)
              event = new DOMEvent(event);
            var target = event.target || event.srcElement;
            while (target) {
              if (match(target, selector)) {
                fn.apply(this, [event].concat(event.params || []));
                break;
              }
              target = target.parentNode;
              if (
                target == el.parentNode ||
                target == document.body.parentNode
              ) {
                target = false;
              }
            }
          },
          capture
        );
      } else {
        el.addEventListener(
          ev,
          function(event) {
            if (event && global.MooTools && global.DOMEvent)
              event = new DOMEvent(event);
            fn.apply(this, [event].concat(event.params || []));
          },
          capture
        );
      }
    };
  })();
  var remove_event = (function() {
    return function(el, ev, fn) {
      el.removeEventListener(ev, fn, false);
    };
  })();
  var fire_event = (function() {
    return function(el, type, options) {
      options || (options = {});
      if (type == "click" && el.click) {
        return el.click();
      }
      var ev = new CustomEvent(type, options.args);
      el.dispatchEvent(ev);
    };
  })();
  var find_parent = function(selector, element, stop) {
    if (!element) return false;
    if (element == stop) return false;
    if (match(element, selector)) return element;
    var par = element.parentNode;
    return find_parent(selector, par);
  };
  var frame = function(cb) {
    global.requestAnimationFrame(cb);
  };
  var xdom = {
    diff: function(from, to, options) {
      return [from, to];
    },
    patch: function(root, diff, options) {
      options || (options = {});
      if (!root || !diff[1]) return;
      var ignore_elements = options.ignore_elements || [];
      var ignore_children = options.ignore_children || [];
      return morphdom(root, diff[1], {
        onBeforeElUpdated: function(from, to) {
          if (options.reset_inputs) return;
          if (options.before_update instanceof Function) {
            options.before_update(from, to);
          }
          var tag = from.tagName.toLowerCase();
          var from_type = from.getAttribute("type");
          var to_tag = to.tagName.toLowerCase();
          var to_type = to.getAttribute("type");
          if (to_tag == "input" && to_type == "file") {
            if (tag == "input" && from_type == "file") {
              var attrs = to.attributes;
              for (var i = 0, n = attrs.length; i < n; i++) {
                var key = attrs.item(i).name;
                if (key == "value") continue;
                from.setAttribute(key, to.getAttribute(key));
              }
              return false;
            }
            return;
          }
          switch (tag) {
            case "input":
            case "textarea":
              to.checked = from.checked;
              to.value = from.value;
              break;
            case "select":
              to.value = from.value;
              break;
          }
        },
        onBeforeNodeDiscarded: function(node) {
          if (ignore_elements.indexOf(node) >= 0) return false;
        },
        onBeforeElChildrenUpdated: function(from, to) {
          if (ignore_children.indexOf(from) >= 0) return false;
        },
        childrenOnly: options.children_only
      });
    },
    hooks: function(options) {
      options || (options = {});
      var diff = options.diff;
      var patch = options.patch;
      if (diff) xdom.diff = diff;
      if (patch) xdom.patch = patch;
    }
  };
  Composer.exp0rt({
    find: find,
    match: match,
    add_event: add_event,
    fire_event: fire_event,
    remove_event: remove_event,
    find_parent: find_parent,
    frame: frame,
    xdom: xdom
  });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var xdom = false;
  var schedule_render = (function() {
    var diffs = [];
    var scheduled = false;
    return function(from, to, options, callback) {
      options || (options = {});
      diffs.push([
        from,
        Composer.xdom.diff(from, to, options),
        options,
        callback
      ]);
      if (scheduled) return;
      scheduled = true;
      Composer.frame(function() {
        scheduled = false;
        var diff_clone = diffs.slice(0);
        diffs = [];
        var cbs = [];
        diff_clone.forEach(function(entry) {
          var from = entry[0];
          var diff = entry[1];
          var options = entry[2];
          var cb = entry[3];
          Composer.xdom.patch(from, diff, options);
          if (cb) cbs.push(cb);
        });
        cbs.forEach(function(cb) {
          cb();
        });
      });
    };
  })();
  var Controller = Composer.Base.extend({
    __composer_type: "controller",
    _released: false,
    _bound_events: [],
    _subcontrollers: {},
    xdom: false,
    el: false,
    inject: false,
    tag: "div",
    class_name: false,
    elements: {},
    events: {},
    initialize: function(params, options) {
      options || (options = {});
      for (var x in params) {
        this[x] = params[x];
      }
      this.parent();
      this._ensure_el();
      if (this.inject) this.attach(options);
      if (this.className) this.class_name = this.className;
      if (this.class_name) {
        this.el.className += " " + this.class_name;
      }
      this.refresh_elements();
      this.delegate_events();
      this.init();
    },
    init: function() {},
    render: function() {
      return this;
    },
    html: function(obj, options) {
      options || (options = {});
      if (!this.el) this._ensure_el();
      var append = function(el, child) {
        if (typeof child == "string") {
          el.innerHTML = child;
        } else {
          el.innerHTML = "";
          el.appendChild(child);
        }
      };
      if (xdom || this.xdom) {
        var el = document.createElement(this.tag);
        append(el, obj);
        var cb = options.complete;
        var ignore_elements = options.ignore_elements || [];
        var ignore_children = options.ignore_children || [];
        ignore_elements = ignore_elements.concat(
          Object.keys(this._subcontrollers)
            .map(
              function(name) {
                return this._subcontrollers[name].el;
              }.bind(this)
            )
            .filter(function(el) {
              return !!el;
            })
        );
        options.ignore_elements = ignore_elements;
        options.children_only = true;
        schedule_render(
          this.el,
          el,
          options,
          function() {
            if (this._released) return;
            this.refresh_elements();
            if (cb) cb();
            this.trigger("xdom:render");
          }.bind(this)
        );
      } else {
        append(this.el, obj);
        this.refresh_elements();
      }
    },
    attach: function(options) {
      options || (options = {});
      this._ensure_el();
      var container =
        typeof this.inject == "string"
          ? Composer.find(document, this.inject)
          : this.inject;
      if (!container) return false;
      if (options.clean_injection) container.innerHTML = "";
      container.appendChild(this.el);
    },
    _with_binder: function(bind_fn, object, ev, fn, name) {
      name || (name = false);
      var wrapped = function() {
        if (this._released) return;
        fn.apply(this, arguments);
      }.bind(this);
      bind_fn.call(object, ev, wrapped, name);
      this._bound_events.push([object, ev, wrapped]);
    },
    with_bind: function(object, ev, fn, name) {
      return this._with_binder(object.bind, object, ev, fn, name);
    },
    with_bind_once: function(object, ev, fn, name) {
      return this._with_binder(object.bind_once, object, ev, fn, name);
    },
    sub: function(name, create_fn) {
      if (!create_fn) return this._subcontrollers[name] || false;
      this.remove(name);
      var instance = create_fn();
      instance.bind(
        "release",
        this.remove.bind(this, name, { skip_release: true })
      );
      this._subcontrollers[name] = instance;
      return instance;
    },
    remove: function(name, options) {
      options || (options = {});
      if (!this._subcontrollers[name]) return;
      if (!options.skip_release) this._subcontrollers[name].release();
      delete this._subcontrollers[name];
    },
    trigger_subs: function(_) {
      var args = Array.prototype.slice.call(arguments, 0);
      Object.keys(this._subcontrollers).forEach(
        function(name) {
          var con = this.sub(name);
          if (con) con.trigger.apply(con, args);
        }.bind(this)
      );
    },
    track_subcontroller: function() {
      return this.sub.apply(this, arguments);
    },
    get_subcontroller: function(name) {
      return this.sub.apply(this, arguments);
    },
    remove_subcontroller: function() {
      return this.remove.apply(this, arguments);
    },
    _ensure_el: function() {
      if (typeof this.el == "string") {
        this.el = Composer.find(document, this.el);
      }
      this.el || (this.el = document.createElement(this.tag));
    },
    release: function(options) {
      options || (options = {});
      if (this.el && this.el.parentNode)
        this.el.parentNode.removeChild(this.el);
      this.el = false;
      this._bound_events.forEach(function(binding) {
        var obj = binding[0];
        var ev = binding[1];
        var fn = binding[2];
        obj.unbind(ev, fn);
      });
      this._bound_events = [];
      Object.keys(this._subcontrollers).forEach(
        function(key) {
          this._subcontrollers[key].release();
        }.bind(this)
      );
      this._subcontrollers = {};
      this.fire_event("release", options, this);
      if (!options.keep_events) this.unbind();
      this._released = true;
    },
    replace: function(element) {
      if (this.el.parentNode) this.el.parentNode.replaceChild(element, this.el);
      this.el = element;
      this.refresh_elements();
      this.delegate_events();
      return element;
    },
    delegate_events: function() {
      for (var ev in this.events) {
        var fn = this[this.events[ev]];
        if (typeof fn != "function") {
          continue;
        }
        fn = fn.bind(this);
        var match = ev.match(/^(\w+)\s*(.*)$/);
        var evname = match[1].trim();
        var selector = match[2].trim();
        if (selector == "") {
          Composer.remove_event(this.el, evname, fn);
          Composer.add_event(this.el, evname, fn);
        } else {
          Composer.add_event(this.el, evname, fn, selector);
        }
      }
    },
    refresh_elements: function() {
      if (!this.elements) return false;
      Object.keys(this.elements).forEach(
        function(key) {
          var iname = this.elements[key];
          this[iname] = Composer.find(this.el, key);
        }.bind(this)
      );
    }
  });
  Controller.xdomify = function() {
    xdom = true;
  };
  Composer.merge_extend(Controller, ["events", "elements"]);
  Composer.exp0rt({ Controller: Controller });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var ListController = Composer.Controller.extend({
    __composer_type: "listcontroller",
    _subcontroller_list: [],
    _subcontroller_idx: {},
    _collection: null,
    _empty: true,
    options: { bind_reset: false, accurate_sort: false, container: null },
    track: function(collection, create_fn, options) {
      options || (options = {});
      this.set_options(options);
      this._collection = collection;
      if (collection.size() > 0) this._empty = false;
      this.with_bind(
        collection,
        ["clear", "add", "remove", "reset"],
        function() {
          var empty = collection.size() == 0;
          if (this._empty && !empty) this.trigger("list:notempty");
          if (!this._empty && empty) this.trigger("list:empty");
          this._empty = empty;
        }.bind(this)
      );
      this.trigger("list:" + (this._empty ? "empty" : "notempty"));
      this.with_bind(
        collection,
        "clear",
        function(options) {
          this._clear_subcontrollers();
        }.bind(this)
      );
      this.with_bind(
        collection,
        "add",
        function(model, _, options) {
          this._add_subcontroller(model, create_fn, options);
        }.bind(this)
      );
      this.with_bind(
        collection,
        "remove",
        function(model) {
          this._remove_subcontroller(model);
        }.bind(this)
      );
      if (options.bind_reset) {
        this.with_bind(
          collection,
          "reset",
          function(options) {
            this._reset_subcontrollers(create_fn, options);
          }.bind(this)
        );
      }
      this._reset_subcontrollers(create_fn);
    },
    release: function() {
      var fragment = document.createDocumentFragment();
      fragment.appendChild(this.el);
      this._clear_subcontrollers({ async: true });
      return this.parent.apply(this, arguments);
    },
    html: function(obj, options) {
      options || (options = {});
      var container = this.options.container;
      if (container instanceof Function) container = container();
      if (container) {
        var ignore_children = options.ignore_children || [];
        ignore_children.push(container);
        options.ignore_children = ignore_children;
      }
      return this.parent.apply(this, arguments);
    },
    _index_controller: function(model, controller) {
      if (!model) return false;
      this._subcontroller_idx[model.cid()] = controller;
      this._subcontroller_list.push(controller);
    },
    _unindex_controller: function(model, controller) {
      if (!model) return false;
      delete this._subcontroller_idx[model.cid()];
      this._subcontroller_list = this._subcontroller_list.filter(function(c) {
        return c != controller;
      });
    },
    _lookup_controller: function(model) {
      if (!model) return false;
      return this._subcontroller_idx[model.cid()];
    },
    _clear_subcontrollers: function(options) {
      options || (options = {});
      if (options.async) {
        var subs = this._subcontroller_list.slice(0);
        var batch = 10;
        var idx = 0;
        var next = function() {
          for (var i = 0; i < batch; i++) {
            var con = subs[idx];
            if (!con) return;
            idx++;
            try {
              con.release();
            } catch (e) {}
          }
          setTimeout(next);
        }.bind(this);
        setTimeout(next);
      } else {
        this._subcontroller_list.forEach(function(con) {
          con.release();
        });
      }
      this._subcontroller_list = [];
      this._subcontroller_idx = {};
    },
    _reset_subcontrollers: function(create_fn, options) {
      options || (options = {});
      this._clear_subcontrollers();
      var reset_fragment = this.options.container;
      if (reset_fragment) {
        var fragment = document.createDocumentFragment();
        options = Composer.object.clone(options);
        options.fragment = fragment;
        options.container = fragment;
      }
      this._collection.each(function(model) {
        this._add_subcontroller(model, create_fn, options);
      }, this);
      if (reset_fragment && fragment.children && fragment.children.length > 0) {
        var container =
          reset_fragment instanceof Function
            ? reset_fragment()
            : reset_fragment;
        container.appendChild(fragment);
      }
    },
    _add_subcontroller: function(model, create_fn, options) {
      options = Composer.object.clone(options);
      options.container = this.options.container;
      if (options.container instanceof Function)
        options.container = options.container();
      var con = create_fn(model, options);
      this._index_controller(model, con);
      con.bind(
        "release",
        function() {
          this._unindex_controller(model, con);
        }.bind(this)
      );
      var sort_idx = this._collection.sort_index(model, options);
      var before_model =
        this._collection.sort_at(sort_idx - 1, options) || false;
      var before_con = this._lookup_controller(before_model);
      var parent = con.el.parentNode;
      if (sort_idx == 0) {
        parent.insertBefore(con.el, parent.firstChild);
      } else if (before_con && before_con.el.parentNode == parent) {
        parent.insertBefore(con.el, before_con.el.nextSibling);
      } else {
        parent.appendChild(con.el);
      }
    },
    _remove_subcontroller: function(model) {
      var con = this._lookup_controller(model);
      if (!con) return false;
      con.release();
      this._unindex_controller(model, con);
    }
  });
  Composer.exp0rt({ ListController: ListController });
}.apply(typeof exports != "undefined" ? exports : this));
(function(global, undefined) {
  "use strict";
  var Composer = this.Composer;
  var global = this;
  var Router = Composer.Base.extend({
    __composer_type: "router",
    last_path: false,
    _last_url: null,
    routes: {},
    options: {
      suppress_initial_route: false,
      enable_cb: function(url) {
        return true;
      },
      process_querystring: false,
      base: false,
      default_title: ""
    },
    initialize: function(routes, options) {
      this.set_options(options);
      this.routes = routes;
      this.bind("route", this._do_route.bind(this));
      if (!global.History) global.History = { enabled: false };
      if (!History.enabled)
        throw "History.js is *required* for proper router operation: https://github.com/browserstate/history.js";
      this.bind("statechange", this.state_change.bind(this));
      this.bind_once("destroy", function() {
        Object.keys(History.Adapter.handlers).forEach(function(key) {
          delete History.Adapter.handlers[key];
        });
        delete global["onstatechange"];
      });
      History.Adapter.bind(
        global,
        "statechange",
        function(data) {
          data || (data = [this.cur_path()]);
          var url = data[0];
          var force = data[1];
          this.trigger("statechange", url, force);
        }.bind(this)
      );
      if (!this.options.suppress_initial_route) {
        History.Adapter.trigger(global, "statechange", [this.cur_path()]);
      }
    },
    destroy: function() {
      this.trigger("destroy");
      this.unbind();
    },
    debasify: function(path) {
      if (this.options.base && path.indexOf(this.options.base) == 0) {
        path = path.substr(this.options.base.length);
      }
      return path;
    },
    cur_path: function() {
      if (History.emulated.pushState) {
        var path =
          "/" +
          new String(global.location.hash).toString().replace(/^[#!\/]+/, "");
      } else {
        var path = global.location.pathname + global.location.search;
      }
      return this.debasify(decodeURIComponent(path));
    },
    get_param: function(search, key) {
      key = key.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
      var regex = new RegExp("[\\?&]" + key + "=([^&#]*)");
      var results = regex.exec(search);
      return results == null
        ? null
        : decodeURIComponent(results[1].replace(/\+/g, " "));
    },
    route: function(url, options) {
      url || (url = this.cur_path());
      options || (options = {});
      options.state || (options.state = {});
      var base = this.options.base || "";
      var newpath = url
        .trim()
        .replace(/^[a-z]+:\/\/.*?\//, "")
        .replace(/^[#!\/]+/, "");
      if (!options.raw) newpath = decodeURIComponent(newpath);
      var href = base + "/" + newpath;
      var old = base + this.cur_path();
      var title = options.title || (this.options.default_title || "");
      if (old == href) {
        this.trigger("statechange", href, true);
      } else if (History.emulated.pushState) {
        History.saveHash(url);
        window.location.hash = "#" + href;
        this.trigger("statechange", href, true);
      } else {
        if (options.replace_state) {
          History.replaceState(options.state, title, href);
        } else {
          History.pushState(options.state, title, href);
        }
      }
    },
    _do_route: function(url, routes) {
      if (!this.options.enable_cb(url)) {
        return false;
      }
      routes || (routes = this.routes);
      var routematch = this.find_matching_route(url, routes);
      if (!routematch) {
        return this.trigger("fail", {
          url: url,
          route: false,
          handler_exists: false,
          action_exists: false
        });
      }
      return this.process_match(url, routematch);
    },
    process_match: function(url, routematch) {
      var route = routematch.route;
      var match = routematch.args;
      var routefn;
      if (route instanceof Function) {
        routefn = route;
      } else if (typeof route == "object") {
        var obj = route[0];
        var action = route[1];
        if (typeof obj != "object") {
          if (!global[obj]) {
            return this.trigger("fail", {
              url: url,
              route: route,
              handler_exists: false,
              action_exists: false
            });
          }
          var obj = global[obj];
        }
        if (!obj[action] || typeof obj[action] != "function") {
          return this.trigger("fail", {
            url: url,
            route: route,
            handler_exists: true,
            action_exists: false
          });
        }
        routefn = function() {
          return obj[action].apply(obj, arguments);
        };
      } else {
        return this.trigger("fail", {
          url: url,
          route: route,
          handler_exists: false,
          action_exists: false
        });
      }
      var args = match;
      args.shift();
      this._last_url = url;
      this.trigger("route-success", route);
      routefn.apply(this, args);
    },
    find_matching_route: function(url, routes) {
      var url = "/" + url.replace(/^!?\//g, "");
      var route = false;
      var match = [];
      var regex = null;
      var matched_re = null;
      for (var re in routes) {
        regex = new RegExp("^" + re.replace(/\//g, "\\/") + "$");
        match = regex.exec(url);
        if (match) {
          route = routes[re];
          matched_re = re;
          break;
        }
      }
      if (!route) return false;
      return { route: route, args: match, regex: regex, key: matched_re };
    },
    state_change: function(path, force) {
      if (path && path.stop != undefined) path = false;
      if (path) path = this.debasify(path);
      if (!path) path = this.cur_path();
      force = !!force;
      if (this.last_path == path && !force) {
        return false;
      }
      this.last_path = path;
      if (!this.options.process_querystring) path = path.replace(/\?.*/, "");
      path = new String(path);
      var boxed = { path: path };
      this.trigger("preroute", boxed);
      this.trigger("route", boxed.path);
    },
    last_url: function() {
      return this._last_url;
    },
    bind_links: function(options) {
      options || (options = {});
      var selector = "a";
      if (options.selector) {
        selector = options.selector;
      } else if (options.exclude_class) {
        selector = 'a:not([class~="' + options.exclude_class + '"])';
      }
      var bind_element = options.bind_element || document.body;
      var route_link = function(e) {
        if (e.defaultPrevented) return;
        if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
        var a = Composer.find_parent(selector, e.target);
        var button = typeof e.button != "undefined" ? e.button : e.event.button;
        if (a.target == "_blank" || button > 0) return;
        if (a.href.match(/^javascript:/)) return;
        if (a.href.match(/^mailto:/)) return;
        if (a.href.match(/^tel:/)) return;
        if (History.emulated.pushState && a.href.replace(/^.*?#/, "") == "")
          return;
        var curhost = global.location.host;
        var linkhost = a.href.match(/^[a-z]+:\/\//)
          ? a.href.replace(/[a-z]+:\/\/(.*?)\/.*/i, "$1")
          : curhost;
        if (curhost != linkhost) return;
        if (options.do_state_change && !options.do_state_change(a)) return;
        if (e) e.preventDefault();
        var href = a.href
          .replace(/^file:\/\/(\/)?([a-z]:)?\//i, "")
          .replace(/^[a-z-]+:\/\/.*?\//i, "")
          .replace(/^[#!\/]+/, "");
        if (options.filter_trailing_slash) href = href.replace(/\/$/, "");
        href = "/" + href;
        if (options.rewrite) href = options.rewrite(href);
        this.route(href, { state: options.global_state });
        return;
      }.bind(this);
      Composer.add_event(bind_element, "click", route_link, selector);
    }
  });
  Composer.exp0rt({ Router: Router });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var global = this;
  var RelationalModel = Composer.Model.extend({
    relations: false,
    relation_data: {},
    skip_relational_serialize: false,
    initialize: function(data, options) {
      options || (options = {});
      if (this.relations) {
        Composer.object.each(
          this.relations,
          function(relation, k) {
            if (relation.model && typeof relation.model == "string") {
              relation.model = Composer.object.get(global, relation.model);
            } else if (
              relation.collection &&
              typeof relation.collection == "string"
            ) {
              relation.collection = Composer.object.get(
                global,
                relation.collection
              );
            } else if (
              relation.filter_collection &&
              typeof relation.filter_collection == "string"
            ) {
              relation.filter_collection = Composer.object.get(
                global,
                relation.filter_collection
              );
              var master = relation.master;
              if (typeof master == "string") {
                var master_key = relation.master;
                relation.master = function() {
                  var master = Composer.object.get(
                    this.relation_data,
                    master_key
                  );
                  if (!master) {
                    master = new this.relations[master_key].collection();
                    Composer.object.set(this.relation_data, master_key);
                  }
                  return master;
                }.bind(this);
                relation.master();
              }
            }
            if (!relation.delayed_init) {
              var obj = this._create_obj(relation, k, { set_parent: true });
            }
          },
          this
        );
      }
      return this.parent(data, options);
    },
    toJSON: function(options) {
      options || (options = {});
      var data = this.parent();
      if (options.raw) return data;
      if (this.skip_relational_serialize || options.skip_relational) {
        Object.keys(this.relations).forEach(function(key) {
          delete data[key];
        });
      } else {
        Object.keys(this.relations).forEach(
          function(k) {
            var obj = Composer.object.get(this.relation_data, k);
            if (!obj) return;
            Composer.object.set(data, k, obj.toJSON());
          }.bind(this)
        );
      }
      return data;
    },
    _set_impl: function(data, options) {
      if (this.relations && !options.skip_relational) {
        Composer.object.each(
          this.relations,
          function(relation, k) {
            var d = Composer.object.get(data, k);
            if (typeof d == "undefined") return;
            var options_copy = Composer.object.clone(options);
            options_copy.data = d;
            var obj = this._create_obj(relation, k, options_copy);
          },
          this
        );
      }
    },
    set: function(data, options) {
      options || (options = {});
      this._set_impl(data, options);
      return this.parent(data, options);
    },
    reset: function(data, options) {
      options || (options = {});
      var options_copy = Composer.object.clone(options);
      options_copy.relational_reset = true;
      this._set_impl(data, options_copy);
      return this.parent(data, options);
    },
    get: function(key, def) {
      var obj = Composer.object.get(this.relation_data, key);
      if (typeof obj != "undefined") return obj;
      return this.parent(key, def);
    },
    clear: function(options) {
      options || (options = {});
      if (this.relations && !options.skip_relational) {
        Composer.object.each(
          this.relations,
          function(relation, k) {
            var obj = Composer.object.get(this.relation_data, k);
            if (typeof obj == "undefined") return;
            if (obj.clear && typeof obj.clear == "function") obj.clear();
          },
          this
        );
      }
      return this.parent.apply(this, arguments);
    },
    bind_relational: function(key) {
      var relation = this.relations[key];
      if (!relation) return false;
      var obj = this._create_obj(relation, key);
      var args = Array.prototype.slice.call(arguments, 0);
      obj.bind.apply(obj, args.slice(1));
    },
    unbind_relational: function(key) {
      var relation = this.relations[key];
      if (!relation) return false;
      var obj = Composer.object.get(this.relation_data, key);
      if (!obj) return false;
      var args = Array.prototype.slice.call(arguments, 0);
      obj.unbind.apply(obj, args.slice(1));
    },
    set_parent: function(parent, child) {
      child.get_parent = function() {
        return parent;
      };
    },
    get_parent: function(child) {
      return child.get_parent();
    },
    _create_obj: function(relation, obj_key, options) {
      options || (options = {});
      var _data = options.data;
      delete options.data;
      if (_data && _data.__composer_type && _data.__composer_type != "") {
        var obj = _data;
      } else {
        var obj = Composer.object.get(this.relation_data, obj_key);
        var collection_or_model =
          relation.collection || relation.filter_collection
            ? "collection"
            : "model";
        switch (collection_or_model) {
          case "model":
            obj || (obj = new relation.model());
            if (options.set_parent) this.set_parent(this, obj);
            if (_data) {
              if (options.relational_reset) {
                obj.reset(_data, options);
              } else {
                obj.set(_data, options);
              }
            }
            break;
          case "collection":
            if (!obj) {
              if (relation.collection) {
                obj = new relation.collection();
              } else if (relation.filter_collection) {
                obj = new relation.filter_collection(
                  relation.master(),
                  Composer.object.merge(
                    { skip_initial_sync: true },
                    relation.options
                  )
                );
              }
            }
            if (options.set_parent) this.set_parent(this, obj);
            if (_data) obj.reset(_data, options);
            break;
        }
      }
      Composer.object.set(this.relation_data, obj_key, obj);
      this.trigger("relation", obj, obj_key);
      this.trigger("relation:" + obj_key, obj);
      return obj;
    }
  });
  Composer.merge_extend(RelationalModel, ["relations"]);
  Composer.exp0rt({
    HasOne: -1,
    HasMany: -1,
    RelationalModel: RelationalModel
  });
}.apply(typeof exports != "undefined" ? exports : this));
(function() {
  "use strict";
  var Composer = this.Composer;
  var FilterCollection = Composer.Collection.extend({
    __composer_type: "filtercollection",
    master: null,
    filter: function() {
      return true;
    },
    transform: null,
    limit: false,
    options: {
      forward_all_events: false,
      refresh_on_change: false,
      sort_event: false
    },
    initialize: function(master, options) {
      options || (options = {});
      var optkeys = Object.keys(this.options);
      Object.keys(options).forEach(
        function(k) {
          var v = options[k];
          if (typeof v == "function") v = v.bind(this);
          if (optkeys.indexOf(k) >= 0) {
            this.options[k] = v;
          } else {
            this[k] = v;
          }
        }.bind(this)
      );
      this.parent();
      this.master = master;
      if (!this.master) return false;
      if (!this.filter) return false;
      this.attach(options);
      if (!options.skip_initial_sync) this.refresh();
    },
    attach: function() {
      this.master.bind(
        "all",
        this.match_action.bind(this),
        "filtercollection:" + this.cid() + ":all"
      );
      this.bind(
        "reset",
        function(options) {
          options || (options = {});
          if (options.has_reload) return false;
          this.refresh(options);
        }.bind(this),
        "filtercollection:reset"
      );
    },
    detach: function() {
      this.master.unbind("all", "filtercollection:" + this.cid() + ":all");
      this.unbind("reset", "filtercollection:reset");
    },
    match_action: function(event, model) {
      var args = Array.prototype.slice.call(arguments, 0);
      switch (event) {
        case "add":
          this.add_event(model, { from_event: true });
          break;
        case "reset":
          this.refresh();
          break;
        case "clear":
          this.clear();
          break;
        case "remove":
          this.remove_event(model, { from_event: true });
          break;
        case "change":
          this.change_event(model, {}, args);
          break;
        case "sort":
          this.refresh();
          break;
        default:
          this.forward_event(event, model, args);
          break;
      }
    },
    refresh: function(options) {
      options || (options = {});
      if (options.diff_events) {
        var old_models = this._models;
      }
      this._models = this.master._models.filter(
        function(model) {
          return this.filter(model, this);
        }.bind(this)
      );
      this.sort({ silent: true });
      if (this.limit) this._models.splice(this.limit, this._models.length);
      if (options.diff_events) {
        var arrdiff = function(arr1, arr2) {
          return arr1.filter(function(el) {
            return arr2.indexOf(el) < 0;
          });
        };
        arrdiff(old_models, this._models).forEach(function(model) {
          this.fire_event("remove", options, model);
        }, this);
        arrdiff(this._models, old_models).forEach(function(model) {
          this.fire_event("add", options, model);
        }, this);
      }
      this.fire_event("reset", options, { has_reload: true });
    },
    change_event: function(model, options, forward_args) {
      options || (options = {});
      var cur_index = this.models().indexOf(model);
      var filters = this.filter(model, this);
      if (!model || (cur_index < 0 && !filters)) return false;
      var num_items = this._models.length;
      if (this.options.refresh_on_change) {
        this.refresh({ silent: true });
      } else {
        var new_index = this.sort_index(model);
        if (cur_index == -1 && filters) {
          this.add(model, options);
        } else if (cur_index > -1 && !filters) {
          this.remove(model, options);
        } else if (cur_index != new_index) {
          if (this.options.sort_event) {
            this.sort(Composer.object.merge({}, options, { silent: true }));
            this.fire_event("sort", options);
          } else {
            this.sort(options);
          }
        }
      }
      if (this._models.length == num_items) {
        forward_args.shift();
        var args = ["change", options].concat(forward_args);
        this.fire_event.apply(this, args);
      } else if (this.options.refresh_on_change) {
        this.fire_event("reset", options);
      }
    },
    add: function(data, options) {
      if (Composer.array.is(data)) {
        return Composer.object.each(
          data,
          function(model) {
            this.add(model, options);
          },
          this
        );
      }
      options || (options = {});
      if (typeof options.transform == "undefined") options.transform = true;
      var model =
        data.__composer_type == "model"
          ? data
          : new this.master.model(data, options);
      if (this.transform && options.transform) {
        model = this.transform.call(this, model, "add");
      }
      if (!this.filter(model, this)) return false;
      if (typeof options.at == "number") {
        var current = this.at(options.at);
        var master_idx = this.master.index_of(current);
        if (master_idx !== false) {
          options.at = master_idx;
        }
      }
      if (this.master.index_of(model)) {
        this._do_add(model, options);
      } else {
        this.master.add(model, options);
        if (this.limit) this._models.splice(this.limit);
      }
      return model;
    },
    _do_add: function(model, options) {
      this._models.push(model);
      var old_idx = this._models.indexOf(model);
      this.sort({ silent: true });
      var new_idx = this._models.indexOf(model);
      if (this.limit) this._models.splice(this.limit);
      if (this.index_of(model) >= 0) {
        this.fire_event("add", options, model, this, options);
        if (old_idx != new_idx) {
          if (this.options.sort_event) {
            this.fire_event("sort", options);
          } else {
            this.fire_event("reset", options);
          }
        }
      }
    },
    remove: function(model, options) {
      if (Composer.array.is(model)) {
        return Composer.object.each(
          model,
          function(m) {
            this.remove(m);
          },
          this
        );
      }
      options || (options = {});
      if (typeof options.transform == "undefined") options.transform = true;
      if (this._models.indexOf(model) < 0) return false;
      if (this.transform && options.transform) {
        model = this.transform.call(this, model, "remove");
      }
      Composer.array.erase(this._models, model);
      this.fire_event("remove", options, model);
      this._remove_reference(model);
    },
    add_event: function(model, options) {
      if (!this.filter(model, this)) return false;
      this.refresh({ silent: true });
      if (this.options.sort_event) this.fire_event("sort", options);
      this.fire_event("add", options, model, this, options);
    },
    remove_event: function(model, options) {
      if (this._models.indexOf(model) < 0) return false;
      this.refresh({ silent: true });
      this.fire_event("remove", options, model);
    },
    forward_event: function(event, model, args) {
      if (!this.options.forward_all_events) return false;
      if (
        model &&
        model.__composer_type == "model" &&
        !this.filter(model, this)
      ) {
        return false;
      }
      this.trigger.apply(this, args);
    }
  });
  Composer.exp0rt({ FilterCollection: FilterCollection });
}.apply(typeof exports != "undefined" ? exports : this));
