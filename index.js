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


var json = function(message, code) {
  if (code){
    this.statusCode = code;
  }
  this.setHeader('Content-type', 'application/json');
  this.write(JSON.stringify(message));
  this.end();
};
http.ServerResponse.prototype.json = json;

var starts_with = function(string) {
  return function(item){
    return item.indexOf(string) === 0;
  };
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

  var events = [];
  var folder = cfg.github.folder || "eventos";
  var of_events = starts_with(folder);

  pl.commits.forEach(function(commit){
    if (commit.committer.email !== 'meethub@rob.mx') {
      var files = commit.modified.concat(commit.added);
      events = _.union(events, files.filter(of_events));
    }
  });

  var ghrepo = github.client(cfg.github.access_token).repo(cfg.github.repo);

  events.forEach(function(file){
    ghrepo.contents(file, function(err, res){
      if (err) {
        // 404
        console.log(err);
        return true;
      }

      var contents = new Buffer(res.content, 'base64');
      var evento = new Evento(contents.toString());

      var action = evento.id ? 'editEvent' : 'postEvent';

      meetup[action](evento.to_meetup(), function(err, resp){
        if (err) {
          console.log(err, resp);
        } else {
          if (action == 'postEvent') {
            evento.id = resp.id;
            evento.contents = evento.contents.replace('<!--\n', 'id: '+evento.id);

            var url = ['repos', cfg.repo, 'contents', res.path].join('/');
            var opts = {
              path: res.path,
              message: 'x-meethub-commit',
              content: new Buffer(evento.contents).toString('base64'),
              sha: res.sha,
              committer: {
                name: "Meethub Bot",
                email: "meethub@rob.mx"
              }
            };

            github.put(url, opts, function(err, s, b, h){
              if (err) {
                console.log(err);
              } else {
                console.log("Event #"+evento.id+" created");
              }
            });
          } else {
            console.log("Event #"+evento.id+" updated");
          }
        }
      });
    });
  });


});