var http = require('http'),
    fs = require('fs'),
    _ = require('lodash'),
    qs = require('querystring'),
    url = require('url'),
    EventEmitter = require('events'),
    meetup = require('meetup-api'),
    util = require('util'),
    github = require('octonode');

var starts_with = function (string) {
  return function (item) {
    return item.indexOf(string) === 0;
  };
};

var Meethub = function(cfg) {
  EventEmitter.call(this);
  this.config = cfg;
  this.meetup = meetup(cfg.meetup.credentials);
  this.webhook = require('github-webhook-handler')(cfg.github.hook);
  this.github = github.client(cfg.github.token);
  Meethub.Event.configure(cfg.meetup.defaults);
  this.setup();
};
util.inherits(Meethub, EventEmitter);

Meethub.Event = require('./lib/evento.js');

Meethub.prototype.fetch = function (path) {
  var cfg = this.config;
  return new Promise(function(resolve, rejejct){
    client.repo(cfg.github.repo).contents(path, function(err, file){
      if (err) {
        reject(err);
      } else {
        var metadata = {
          sha: file.sha,
          repo: cfg.github.repo,
          path: file.path
        };
        resolve(new Buffer(file.content, 'base64'), metadata);
      }
    });
  });
};

Meethub.prototype.publish = function (event) {
  var self = this;
  return new Promise(function(resolve, reject){
    var action = event.meetup_id ? 'editEvent' : 'postEvent';
    var created = false;

    var description = self.parser.description ? self.parser.description(event) : event.description;
    self.meetup[action](event.to_meetup(description), function(err, res){
      if (err) {
        reject(err);
      } else {
        if (action == 'postEvent') {
          created = true;
          event.setId(res.id);
        }
        resolve(created);
      }
    });
  });
};

Meethub.prototype.store = function (event) {
  var self = this;
  var endpoint = event.url(true);
  var opts = {
    path: event.metadata.path,
    message: 'x-meethub-commit',
    content: new Buffer(event.contents).toString('base64'),
    sha: event.metadata.sha,
    committer: {
      name: "Meethub Bot",
      email: "meethub@rob.mx"
    }
  };

  return new Promise(function(resolve, reject){
    self.github.put(endpoint, opts, function(err, status, body, headers){
      if (err) {
        reject(err);
      } else {
        resolve(body);
      }
    });
  });
};

Meethub.prototype.setup = function () {
  if (this._setup) {
    return false;
  }

  this._setup = true;
  var self = this;
  var cfg = this.config;

  this.webhook.on('error', function (err) {
    console.error('Error:', err.message);
  });

  this.webhook.on('push', function (event) {
    var pl = event.payload;
    console.log('PUSH %s@%s', pl.repository.full_name, pl.after.substring(0,5));

    var folder = cfg.github.folder || "eventos";
    var of_events = starts_with(folder);

    var filter_events = function (evts, commit) {
      if (commit.committer.email !== 'meethub@rob.mx' && commit.message.indexOf('X-meethub-skip') !== -1) {
        var files = commit.modified.concat(commit.added);
        return _.union(evts, files.filter(of_events));
      }
    };

    pl.commits.reduce(filter_events, [])
    .forEach(function (path) {

      got_contents = self.fetch(path);
      got_contents.then(function (contents, metadata) {
        var data = self.parser.unserialize(contents);
        data.metadata = contents;
        var evt = new Meethub.Event(contents, metadata);
        if (!evt.private) {
          self.publish(evt).then(function (created){
            if (created) {
              var stored = self.store(evt);
              stored.then(function () {
                self.emit('created', evt);
              });
              stored.catch(function (err) {
                self.emit('error', err);
              });
            } else {
              self.emit('updated', evt);
            }
          })
          .catch(function (err){
            self.emit('error', err);
          });
        } else {
          self.emit('private', evt);
        }
      });

      got_contents.catch(function (err) {
        console.error("Could not fetch event from github at "+file.path);
        console.log(err);
      });
    }); //foreach
  }); //on: push
};


Meethub.prototype.handler = function (req, res, next) {
  switch (req.path.split('/')[1]) {
    case 'github':
      webhook(req, res, function(){
        res.status(400).json({'error': 'Not found'});
      });
      break;
  }
};

module.exports = Meethub;