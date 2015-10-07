var marked = require('marked');
var _ = require('lodash');
var moment = require('moment');
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
  metadata: {},
  group: {id: null, name: ""},
  spots: null,
  hosts: null,
  starts: null,
  ends: null,
  description: "",
  waitlisting: true,
  venue: {
    id: null,
    visibility: 'public'
  }
};

Evt.fetch = function(repo, path, client) {
  return new Promise(function(resolve, rejejct){
    client.repo(repo).contents(path, function(err, file){
      if (err) {
        reject(err);
      } else {
        var contents = new Buffer(file.content, 'base64');
        var evt = new Evt(contents.toString());
        evt.metadata = {
          sha: file.sha,
          repo: repo,
          path: file.path
        };
        resolve(evt);
      }
    });
  });
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

Evt.prototype.setId = function(id) {
  if (!this.id) {
    this.id = id;
    this.contents = this.contents.replace('<!--\n', '<!--\nid: '+id+'\n');
  }
};

Evt.prototype.html_description = function() {
  return marked(
    this.description
      .replace(/##\s?([^\n]+)\n/g, '**> $1**\n') //headings
      .replace(/---/g, '\\-\\-\\-') //hr
  );
};

Evt.prototype.to_meetup = function(){

  var data = {
    id: this.id,
    group_id: this.group.id,
    group_name: this.group.name,
    name: this.name,
    rsvp_limit: this.spots,
    venue_visibility: this.venue.visibility,
    venue_id: this.venue.id,
    description: this.html_description(),
    guest_limit: (this.guests || 0),
  };

  switch(this.waitlist) {
    case true:
    case 'true':
      data.waitlisting = 'auto'; //on
      break;
    case false:
    case 'false':
      data.waitlisting = 'off';
      break;
    default:
      data.waitlisting = 'manual'; // who the fuck knows
  }

  if (this.draft) data.publish_status = "draft";
  if (this.hosts) data.hosts = this.hosts.join(',');
  if (this.starts) data.time = moment(this.starts).unix()*1000;

  if (this.starts && this.ends) {
    data.duration = (moment(this.ends).unix()*1000)-data.time;
  }

  return _.pick(data, not_null);
};

Evt.prototype.publish = function(client){
  var self = this;
  return new Promise(function(resolve, reject){
    var action = self.id ? 'editEvent' : 'postEvent';
    var created = false;

    client[action](self.to_meetup(), function(err, res){
      if (err) {
        reject(err);
      } else {
        if (action == 'postEvent') {
          created = true;
          self.setId(res.id);
        }
        resolve(created);
      }
    });
  });
};

Evt.prototype.url = function(contents){
  var parts;
  if (contents) {
    parts = ['repos', this.metadata.repo, 'contents', this.metadata.path];
  } else {
    parts = [this.metadata.repo, this.metadata.path];
  }
  return "https://github.com/"+parts.join('/');
};

Evt.prototype.save = function(client){
  var endpoint = this.url(true);
  var opts = {
    path: this.metadata.path,
    message: 'x-meethub-commit',
    content: new Buffer(this.contents).toString('base64'),
    sha: this.metadata.sha,
    committer: {
      name: "Meethub Bot",
      email: "meethub@rob.mx"
    }
  };

  return new Promise(function(resolve, reject){
    ghclient.put(endpoint, opts, function(err, status, body, headers){
      if (err) {
        reject(err);
      } else {
        resolve(body);
      }
    });
  });

};

module.exports = Evt;