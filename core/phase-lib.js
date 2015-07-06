var fs = require('fs');
var path = require('path');
var types = require('./types');
var stream = require('./stream');
var phase = require('./phase');
var TreeBuilder = require('../lib/tree-builder');

function register(info, impl, defaults) {
  function override(defaults, options) {
    var result = {};
    for (key in defaults) {
      if (key in options)
        result[key] = options[key];
      else
        result[key] = defaults[key];
    }
    return result;
  }
  module.exports[info.name] = function(options) {
    var options = override(defaults, options);
    return new phase.PhaseBase(info, impl, options);
  }
}

register({name: 'readDir', input: types.string, output: types.string, arity: '1:N'},
  function(dirName, tags) {
    fs.readdirSync(dirName).forEach(function(filename) {
      this.put(path.join(dirName, filename)).tag('filename', filename);
    }.bind(this));
  });


register({name: 'log', input: types.string, output: types.string, arity: '1:1'},
  function(data, tags) {
    // TODO: well defined default.
    var tagsToPrint = (this.options.tags && this.options.tags.split(', ')) || [];
    tagsToPrint.forEach(function(tag) {
      console.log(tag, tags.read(tag));
    });
    console.log(data);
    return data;
  },
  { tags: '' });

register({name: 'jsonParse', input: types.string, output: types.JSON, arity: '1:1'},
  function(string) { return JSON.parse(string); });

// var treeBuilder = function(WriterType) {
//   console.log('MAKE treeBuilder');
//   return function(data, cb) {
//     var writer = new WriterType();
//     var builder = new TreeBuilder();
//     builder.build(data);
//     builder.write(writer);
//     cb(writer.getHTML());
//   };
// };

// module.exports.filter = function(FilterType) {
//   return {
//     impl: treeBuilder(FilterType),
//     name: 'filter: ' + FilterType.name,
//     input: types.JSON,
//     output: types.JSON,
//   };
// }

// module.exports.treeBuilderWriter = function(WriterType) {
//   return {
//     impl: treeBuilder(WriterType),
//     name: 'treeBuilderWriter: ' + WriterType.name,
//     input: types.JSON,
//     output: types.string
//   };
// }

var treeBuilder = function(Type) {
  console.log('Make treeBuilder', Type);
  return function(data) {
    var writer = new Type();
    var builder = new TreeBuilder();
    builder.build(data);
    builder.write(writer);
    return writer.getHTML();
  };
};
var filters = {
  StyleFilter: require('../lib/style-filter'),
  StyleMinimizationFilter: require('../lib/style-minimization-filter'),
  StyleTokenizerFilter: require('../lib/style-tokenizer-filter'),
  NukeIFrameFilter: require('../lib/nuke-iframe-filter'),
  StyleDetokenizerFilter: require('../lib/style-detokenizer-filter')
};
var writers = {
  HTMLWriter: require('../lib/html-writer'),
  JSWriter: require('../lib/js-writer'),
  StatsWriter: require('../lib/stats-writer')
};
for (FilterType in filters) {
  console.log(FilterType);
  register({name: FilterType, input: types.JSON, output: types.JSON, arity: '1:1'},
    treeBuilder(filters[FilterType]));
}
for (WriterType in writers) {
  console.log(WriterType);
  register({name: WriterType, input: types.JSON, output: types.JSON, arity: '1:1'},
    treeBuilder(writers[WriterType]));
}

register({name: 'dummy', input: types.string, output: types.string, arity: '1:1'},
  function(data) { return data; });

register({name: 'writeStringFile', input: types.string, output: types.string, arity: '1:1'},
    function(data, tags) {
      if (this.options.tag == '') {
        var filename = this.options.filename;
      } else {
        var filename = tags.read(this.options.tag);
      }
      fs.writeFileSync(filename, data);
      return data;
    },
    { tag: '', filename: 'result' });

register({name: 'input', output: types.string, arity: '0:1'},
    function(tags) {
      if (this.options.tag)
        tags.tag('data', this.options.data);
      return this.options.data;
    },
    { data: '', tag: true});

register({name: 'retag', input: types.string, output: types.string, arity: '1:1'},
  function(data, tags) {
    var input = tags.read(this.options.tag);
    if (input !== undefined)
      tags.tag(this.options.tag, input.replace(new RegExp(this.options.in), this.options.out));
    return data;
  },
  { tag: '', in: '', out: ''});

// TODO: This is for testing. Does it belong here?
register({name: 'compare', input: types.string, output: types.string, arity: '1:1'},
  function(data, tags) {
    var input = tags.read(this.options.tag);
    var inFile = fs.readFileSync(input, 'utf8');
    if (!(inFile == data)) {
      throw new Error(input + " file doesn't match provided data");
    }
  },
  { tag: ''});
