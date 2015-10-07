var http = require('http');
var fs = require('fs');
var Evento = require('./lib/evento.js');
var _ = require('lodash');
var qs = require('querystring');
var url = require('url');

var cfg = JSON.parse(fs.readFileSync('config.json'));

// var content = 'https://api.github.com/repos/javascriptmx/chelajs/contents/eventos';
var meetup = require('meetup-api')(cfg.meetup.credentials);
var webhook = require('github-webhook-handler')(cfg.github.hook);
var github = require('octonode');
Evento.configure(cfg.meetup.defaults);

var auth_url = github.auth.config(cfg.github.credentials).login(['repo']);


http.ServerResponse.prototype.json = function (message, code) {
  if (code){
    this.statusCode = code;
  }
  this.setHeader('Content-type', 'application/json');
  this.write(JSON.stringify(message));
  this.end();
};

var starts_with = function (string) {
  return function (item) {
    return item.indexOf(string) === 0;
  };
};

var github_client = function () {
  return github.client(cfg.github.access_token);
};


http.createServer(function (req, res) {
  webhook(req, res, function (err) {
    if (!err) {
      var uri = url.parse(req.url);

      if (uri.pathname.indexOf('/auth/github') === 0 && !cfg.github.access_token) {
        switch (uri.pathname) {

          case '/auth/github':
            res.writeHead(302, {'Content-Type': 'text/plain', 'Location': auth_url});
            res.end('Redirecting to ' + auth_url);
          break;

          case '/auth/github/callback':
            var values = qs.parse(uri.query);
            github.auth.login(values.code, function (err, token) {
              res.json(token);
            });
          break;

        }
      } else {
        res.json({"error": "Not found"}, 404);
      }
    }
  });
}).listen(cfg.port);


webhook.on('error', function (err) {
  console.error('Error:', err.message);
});


webhook.on('push', function (event) {
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

    Evento.fetch(cfg.github.repo, path, github_client())
    .then(function (evento, metadata) {
      evento.publish(meetup)
      .then(function (created) {
        console.log("Event <"+evento.id+"> successfully "+(created ? 'created' : 'modified'));
        if (created) {
          evento.save(github_client())
            .then(function () { console.log("Event file successfully saved to Github"); })
            .catch(function (err) { console.error("Could not save event file to Github"); });
        }
      })
      .catch(function (err, created) {
        console.error("The event could not be "+(created ? 'created' : 'modified'));
      });
    })
    .catch(function (err) {
      console.error("Could not fetch event from github at "+file.path);
      console.log(err);
    });

  });

});