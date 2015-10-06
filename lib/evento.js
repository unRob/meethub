var marked = require('marked');
var _ = require('lodash');
var yaml = require('js-yaml');

var not_null = function(k, v, obj){
  return (v !== null && v !== [] && v!== '');
};

var find = function(exp, text) {
  var res = text.match(exp);
  return res && res[1];
};

var Evt = function(contents) {
  this.contents = contents;
  var props = Evt.parse(contents);
  _.extend(this, _.pick(_.merge(Evt.defaults, props), not_null));

  return this;
};

Evt.defaults = {
  name: "",
  group: {id: null, name: ""},
  spots: null,
  hosts: null,
  time: null,
  description: "",
  venue: {
    id: null,
    visibility: 'public'
  }
};


Evt.parse = function(markdown) {
  var props = {
    name: find(/^# (.+)/m, markdown),
    description: markdown.split(/-->\n+/)[1]
  };

  // http://stackoverflow.com/a/1732454/88311
  var options = yaml.safeLoad(find(/<!--([^>]+)-->/, markdown));
  return _.merge(options, props);
};

Evt.configure = function(config){
  Evt.defaults = _.merge(Evt.defaults, config);
};

Evt.prototype.to_meetup = function(){

  var data = {
    group_id: this.group.id,
    group_name: this.group.name,
    name: this.name,
    rsvp_limit: this.capacity,
    venue_visibility: this.venue.visibility,
    venue_id: this.venue.id,
    description: this.description,
  };

  if (this.hosts) data.hosts = this.hosts.join(',');

  return _.pick(data, not_null);
};


// var Talk = function(markdown) {

// };

// Talk.to_markdown = function() {
//   return [
//     "## " + this.title,
//     this.description,
//     "["+this.speaker.name+"]("+this.speaker.url+")" + " | " + "_"+this.speaker.bio+"_"
//   ].join('\n');
// };


module.exports = Evt;