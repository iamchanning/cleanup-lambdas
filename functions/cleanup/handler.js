'use strict'

const lib = require('../lib')

module.exports.handler = function (event, context, cb) {
  lib.cleanupLambdas({
    authorizerUserId: event.authorizerUserId,
    authorizedJwt: event.authorizedJwt
  }, cb);
}
