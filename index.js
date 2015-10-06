var http = require('http');
var fs = require('fs');
var Evento = require('./lib/evento.js');
var _ = require('lodash');

var cfg = JSON.parse(fs.readFileSync('config.json'));

// var content = 'https://api.github.com/repos/javascriptmx/chelajs/contents/eventos';
var meetup = require('meetup-api')(cfg.meetup.credentials);
var webhook = require('github-webhook-handler')(cfg.github.hook);
var github = require('octonode').client();
var ghrepo = github.repo(cfg.github.repo);
Evento.configure(cfg.meetup.defaults);

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
    if (!err) res.json({"error": "Not found"}, 404);
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
    if (commit.message.indexOf('x-meethub-commit') == -1) {
      var files = commit.modified.concat(commit.added);
      console.log(files, files.filter(of_events));
      events = _.union(events, files.filter(of_events));
    }
  });

  console.log(events);

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

      console.log(action, evento);
      // meetup[action](evento.to_meetup(), function(err, resp){
      //   if (err) {
      //     console.log(err, resp);
      //   } else {
      //     if (action == 'postEvent') {
      //       evento.id = resp.id;
      //       evento.contents = evento.contents.replace('<!--\n', 'id: '+evento.id);

      //       var url = ['repos', cfg.repo, 'contents', res.path].join('/');
      //       var opts = {
      //         path: res.path,
      //         message: 'x-meethub-commit',
      //         content: new Buffer(evento.contents).toString('base64'),
      //         sha: res.sha,
      //         committer: {
      //           name: "Meethub Bot",
      //           email: "meethub@rob.mx"
      //         }
      //       };

      //       github.put(url, opts, function(err, s, b, h){

      //       });
      //     }
      //   }
      // });
    });
  });


});