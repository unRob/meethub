var test = require('blue-tape');
var colorize = require('tap-colorize');
test.createStream().pipe(colorize()).pipe(process.stdout);



var Evento = require('../lib/evento.js');
var fs = require('fs');
var _ = require('lodash');

var cfg = JSON.parse(fs.readFileSync('config.json'));
var github = require('octonode');
var gh_client = github.client(cfg.github.access_token);
var meetup = require('meetup-api')(cfg.meetup.credentials);
Evento.configure(cfg.meetup.defaults);

var PATH = 'test/eventos/2016-03-14.md';
var evt = new Evento(fs.readFileSync(PATH).toString());

test('Read a meeting file', function(t){
  t.plan(1);

  console.log(evt.to_meetup().waitlisting);
  var vals = [evt.to_meetup(), cfg.mockup].map(JSON.stringify);
  t.equal.apply(t, vals);
});


test('Setting `id` modifies the event\'s content', {skip: false}, function(t){
  t.plan(2);
  evt.setId('225886834');
  t.ok(evt.contents.match(/id: 225886834/), 'The id was correctly added to the YAML section');

  evt.setId('225886834');
  t.equal(evt.contents.match(/id: 225886834/g).length, 1, 'The id was not added twice');
});

test('Can fetch an event from github', {skip: true}, function(){
  res = Evento.fetch(cfg.github.repo, PATH, gh_client);
  res.then(function(e){
    evt = e;
  });
  return res;
});

test('Modify a meetup event', {skip: false}, function(t){
  evt.draft = true;
  return evt.publish(meetup);
});

test('Modify github files', {skip: true}, function(t){
  t.comment(evt.url());
  return evt.save(gh_client);
});