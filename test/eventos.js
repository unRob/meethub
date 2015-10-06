var test = require('tape');
var Evento = require('../lib/evento.js');
var fs = require('fs');

var cfg = JSON.parse(fs.readFileSync('config.json'));
Evento.configure(cfg.meetup.defaults);

test('debe leer correctamente el ejemplo', function(t){
  t.plan(1);

  var evt = new Evento(fs.readFileSync('test/eventos/2016-03-14.md').toString());
  var vals = [evt.to_meetup(), cfg.mockup].map(JSON.stringify);
  t.equal.apply(t, vals);
});