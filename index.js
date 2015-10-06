var http = require('http');
var fs = require('fs');
var Evento = require('./lib/evento.js');

var cfg = JSON.parse(fs.readFileSync('config.json'));

// var content = 'https://api.github.com/repos/javascriptmx/chelajs/contents/eventos';
var meetup = require('meetup-api')(cfg.meetup.credentials);
var webhook = require('github-webhook-handler')(cfg.github.hook);
var github = require('octonode');
var ghrepo = github.repo(cfg.github.repo);
Evento.configure(cfg.meetup.defaults);

var json = function(message, code) {
  if (code){
    this.statusCode = code;
  }
  this.setHeader('Content-type', 'application/json');
  this.send(JSON.stringify(message));
};
http.ServerResponse.prototype.json = json;

http.createServer(function (req, res) {
  webhook(req, res, function (err) {
    res.json({"error": "Not found"}, 404);
  });
}).listen(7777);

webhook.on('error', function (err) {
  console.error('Error:', err.message);
});


webhook.on('push', function (event) {
  var pl = event.payload;
  console.log('PUSH %s@%s', pl.repository.full_name, pl.after.substring(0,5));



});