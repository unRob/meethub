var _ = require('lodash'),
    moment = require('moment');

var not_null = function(k, v, obj){
  return (v !== null && v !== [] && v!== '');
};

var Evento = function (props) {
  this.props = props;
  _.extend(this, _.pick(_.merge(Evento.defaults, this.props), not_null));

  return this;
};

Evento.defaults = {
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

Evento.configure = function(config) {
  Evento.defaults = _.merge(Evento.defaults, config);
};

Evento.prototype.setId = function(id) {
  if (!this.meetup_id) {
    this.meetup_id = id;
    this.props.meetup_id = id;
  }
};

Evento.prototype.to_meetup = function (description) {
  var data = {
    id: this.meetup_id,
    group_id: this.group.id,
    group_name: this.group.name,
    name: this.name,
    rsvp_limit: this.spots,
    venue_visibility: this.venue.visibility,
    venue_id: this.venue.id,
    description: description,
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

Evento.prototype.url = function (contents) {
  var parts;
  if (this.metadata.repo) {
    throw new Error("Can't generate github url for repo-less event");
  }

  if (contents) {
    parts = ['repos', this.metadata.repo, 'contents', this.metadata.path];
  } else {
    parts = [this.metadata.repo, this.metadata.path];
  }
  return "https://github.com/"+parts.join('/');
};

module.exports = Evento;