#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var rest = require('restler');
var Promise = require('bluebird');
Promise.longStackTraces();
var urls = require('url');
var util = require('util');
var VError = require('verror');

// @todo: @bcauldwell - Needs to point to the production instance.
// @todo: @bcauldwell - Should probably be https, and there should
// be some barebones security.
/*
 * Default target.
 */
var DEFAULT_TARGET = {
  protocol: 'http',
  hostname: '127.0.0.1',
  port: '3030'
};

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
function Client(id, address) {

  // @todo: @bcauldwell - Do some argument processing here.

  // The id argument is optional.
  this.id = id;

  // The address argument is also optional.
  if (address) {
    this.target = urls.parse(address);
  } else {
    // Grab the default target that points to the production instance.
    this.target = DEFAULT_TARGET;
  }

}

/*
 * Send and handle a REST request.
 */
Client.prototype.__request = function(verb, pathname, data) {

  // Save for later.
  var self = this;

  // Build url.
  return Promise.try(function() {
    var obj = _.extend(self.target, {pathname: pathname});
    return urls.format(obj);
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
 * Get full list of all metrics record ids.
 */
Client.prototype.getAll = function(username, password) {

  var opts = {
    username: username,
    password: password
  };

  return this.__request('get', 'metrics/v1/admin', opts);

};

/*
 * Get one metric record.
 */
Client.prototype.getOne = function(id, username, password) {

  var opts = {
    username: username,
    password: password
  };

  return this.__request('get', 'metrics/v1/admin/' + id, opts);
};

/*
 * Create a new metric record and return it's ID.
 */
Client.prototype.create = function() {

  // Send REST request.
  return this.__request('post', 'metrics/v1/')
  // Validate response and return ID.
  .then(function(data) {
    if (!data || !data.id) {
      throw new Error('Invalid create response: ' + pp(data));
    } else {
      return data.id;
    }
  });

};

/*
 * Return the metric record's ID, or create one if it doesn't have one.
 */
Client.prototype.__getId = function() {

  var self = this;

  if (self.id) {
    // ID is already set, just return it.
    return Promise.resolve(self.id);
  } else {
    // No metic record exists, so create one.
    return self.create()
    .tap(function(id) {
      self.id = id;
    });
  }

};

/*
 * Get the current metric record to this instance.
 */
Client.prototype.get = function() {

  var self = this;

  // Get ID.
  return self.__getId()
  // Send REST request.
  .then(function(id) {
    return self.__request('get', 'metrics/v1/' + id);
  });

};

/*
 * Report meta data for this metric client instance.
 */
Client.prototype.report = function(metaData) {

  // Save for later.
  var self = this;

  // Build request data.
  var record = {
    created: ts(),
    data: metaData
  };

  // Get this metric client's ID.
  return self.__getId()
  // Send REST request.
  .then(function(id) {
    return self.__request('putJson', 'metrics/v1/' + id, record);
  });

};

// Return constructor as the module object.
module.exports = Client;
