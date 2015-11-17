var yaml = require('js-yaml'),
    marked = require('marked');

var Markup = function (string) {
  this.klass = 'Markup';
  this.html = marked(string);
  this.md = string;
};

var MarkupType = new yaml.Type('!markdown', {
  kind: 'scalar',
  resolve: function (data) {
    return data !== null;
  },
  construct: function (string) {
    return new Markup(string);
  },
  instanceOf: Markup,
  represent: function (markup) {
    return markup.markdown;
  }
});

var MARKUP_SCHEMA = yaml.Schema.create([MarkupType]);
var yaml_opts = {schema: MARKUP_SCHEMA};

var Parser = {
  unserialize: function (string) {
    var d = yaml.load(string, yaml_opts);
    return d;
  },
  serialize: function (evt) {
    return yaml.dump(evt.props, yaml_opts);
  },
  description: function (evt) {
    var comps = [
      evt.intro.html,
      '<p>---</p>',
      evt.talks.map(function (talk) {
        return marked(["",
          "**> "+talk.title+"**",
          talk.summary,
          "["+talk.speaker.name+"]("+talk.speaker.url+") | "+talk.speaker.bio
        ].join("\n\n"));
      }).join("\n<p></p>\n"),
      '<p>---</p>',
      evt.footer.html
    ];
    return comps.join("\n<p></p>\n");
  }
};

module.exports = Parser;