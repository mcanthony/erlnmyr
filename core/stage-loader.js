var assert = require('chai').assert;
var stream = require('./stream');

var phaseLib = require('./phase-lib');
var stages = require('./stages');
var fancyStages = require('./fancy-stages');
var types = require('./types');
var device = require('./device');
var experiment = require('./experiment');

var argInputs = {
  'JSON': stages.JSONReader,
  'file': stages.fileReader,
  'output': stages.fileOutput,
  'ejs': stages.ejsFabricator,
  'immediate': fancyStages.immediate,
}

var byName = [device, experiment, phaseLib, stages];

function _stageSpecificationToStage(stage, options) {
  options = options || {};
  var spec = stage.split(':');
  if (spec.length > 1 && spec[0] in argInputs)
    return argInputs[spec[0]](spec.slice(1, spec.length).join(':'));

  for (var i = 0; i < byName.length; i++) {
    if (stage in byName[i])
      return byName[i][stage](options);
  }

  assert(false, "No stage found for specification " + stage);
}

// TODO once everything is a phase, this can be removed.
function stageSpecificationToStage(stage, options) {
  var stage = _stageSpecificationToStage(stage, options);
  if (!stage.isStream)
    stage = stream.streamedStage(stage);
  return stage;
}

function processStages(stages, cb, fail) {
  // TODO: Put this back when I work out what it means for stages.
  // assert.equal(stages[0].input, 'unit');
  processStagesWithInput(null, stages, cb, fail);
}

function typeCheck(stages) {
  var coersion = {};
  for (var i = 0; i < stages.length - 1; i++) {
    var inputCoersion = coersion;
    // console.log('checking ' + JSON.stringify(stages[i].output) + ' : ' + JSON.stringify(stages[i + 1].input));
    // console.log(' --> ' + JSON.stringify(coersion));
    coersion = types.coerce(stages[i].output, stages[i + 1].input, coersion);
    assert.isDefined(coersion, "Type checking failed for\n  " + stages[i].name + ': ' + JSON.stringify(stages[i].output) + 
      "\n  ->\n  " + stages[i + 1].name + ': ' + JSON.stringify(stages[i + 1].input) + "\n    " + JSON.stringify(inputCoersion));
  }
}

/*
 * Constructing a pipeline
 *
 * Sorry for potato quality.
 */
function processStagesWithInput(input, stages, cb, fail) {
  typeCheck(stages);
  for (var i = stages.length - 1; i >= 0; i--) {
    cb = (function(i, cb) { return function(data) {
      try {
        stages[i].impl(data, cb);
      } catch (e) {
        fail(e);
      }
    } })(i, cb);
  }
  cb(input);
};

// TODO: This doesn't currently fail if the internal type is consistent and the external type is consistent
// but they aren't consistent with each other.
// for example, if the provided list uses tee() then justLeft(), regardless of what steps are in between,
// this typechecks as 'a -> 'a from the perspective of the outside world.
module.exports.stage = function(list) {
  return {
    impl: function(input, cb) {
      processStagesWithInput(input, list, cb, function(e) { console.log('failed pipeline', e, '\n', e.stack); cb(null); });
    },
    name: '[' + list.map(function(a) { return a.name; }) + ']',
    input: list[0].input,
    output: list[list.length - 1].output
  };
}

module.exports.typeCheck = typeCheck;
module.exports.processStages = processStages;
module.exports.processStagesWithInput = processStagesWithInput;
module.exports.stageSpecificationToStage = stageSpecificationToStage;
