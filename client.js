'use strict';

var _ = require('lodash');
var rest = require('restler');
var Promise = require('bluebird');
Promise.longStackTraces();
var url = require('url');
var util = require('util');
var VError = require('verror');

/*
 * Return a formatted string (aka pretty print).
 */
var pp = function(obj) {
  return JSON.stringify(obj, null, '  ');
};

/*
 * Return current time in JSON format.
 */
var ts = function() {
  return new Date().toJSON();
};

/*
 * Constructor.
 */
function Client(opts) {
  this.id = opts.id;
  this.url = url.parse(opts.url);
}

/*
 * Send and handle a REST request.
 */
Client.prototype.__request = function(verb, pathname, data) {

  // Save for later.
  var self = this;

  // Build url.
  return Promise.try(function() {
    var obj = _.extend(self.url, {pathname: pathname});
    return url.format(obj);
  })
  .then(function(url) {
    // Send REST request.
    return new Promise(function(fulfill, reject) {
      rest[verb](url, data)
      .on('success', fulfill)
      .on('fail', function(data, resp) {
        var err = new Error(pp(data));
        reject(err);
      })
      .on('error', reject);
    })
    // Give request a 10 second timeout.
    .timeout(10 * 1000)
    // Wrap errors for more information.
    .catch(function(err) {
      var dataString = typeof data === 'object' ? JSON.stringify(data) : data;
      throw new VError(err,
        'Error during REST request. url=%s, data=%s.',
        [verb, url].join(':'),
        dataString
      );
    });
  });

};

/*
 * Report meta data for this metric client instance.
 */
Client.prototype.report = function(record) {

  // Save for later.
  var self = this;

  // Build request data.
  record.created = ts();

  // Send REST request.
  return self.__request('postJson', 'metrics/v2/' + self.id, record);

};

// Return constructor as the module object.
module.exports = Client;
