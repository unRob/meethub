var test = require('blue-tape');
var colorize = require('tap-colorize');
test.createStream().pipe(colorize()).pipe(process.stdout);

var Meethub = require('../index.js');
var Parser = require('./_parser.js');
var fs = require('fs');
var _ = require('lodash');

var cfg = JSON.parse(fs.readFileSync('config.json'));
var github = require('octonode');
var gh_client = github.client(cfg.github.access_token);
var meetup = require('meetup-api')(cfg.meetup.credentials);

var mh = new Meethub(cfg, Parser);

var PATH = 'test/eventos/2016-03-14.yaml';
var data = fs.readFileSync(PATH).toString();
var evt;

test('Read a meeting file', function(t){
  t.plan(2);
  evt = new Meethub.Event(Parser.unserialize(data));
  t.equal(evt.name, "Día Pi");
  t.equal(evt.talks.length, 3);
});

test('Can fetch an event from github', {skip: true}, function(){
  res = mh.fetch(PATH);
  res.then(function(e){
    evt = e;
  });
  return res;
});

test('Modify a meetup event', {skip: true}, function(t){
  evt.draft = true;
  return evt.publish(meetup);
});

test('Modify github files', {skip: true}, function(t){
  t.comment(evt.url());
  return evt.save(gh_client);
});