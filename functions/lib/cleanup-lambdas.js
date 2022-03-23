'use strict'

// Load all needed libraries
const Promise = require('bluebird')
const AWSLambdaService = require('../lib/LambdaService')
const _ = require('lodash')

function cleanupLambdas (viewParameters, callbacker) {
  let lambdaService = new AWSLambdaService()

  return lambdaService
    .getAllLambdas()
    .then(function (functions) {
      console.info('Cleanup to run for ' + functions.length + ' functions')
      return Promise.map(functions, function (name) {
        console.log('Lambda name: ', name)
        return lambdaService.getVersionsForLambda(name)
          .then((versions) => {
            // Get all but the last 5 versions
            let versionsToRemove = _.sortBy(versions, [function (v) { return parseInt(v) }]).slice(0, -5)

            if (_.isEmpty(versionsToRemove)) {
              return Promise.resolve()
            }

            return lambdaService.getAliasesForLambda(name)
              .then((aliases) => {
                return Promise.each(versionsToRemove, function (version) {
                  let versionHasAlias = aliases.find((alias) => { return alias.FunctionVersion === version })
                  if (version === '$LATEST' || versionHasAlias) {
                    console.info('Skipping version', version, versionHasAlias)
                    return Promise.resolve()
                  } else {
                    // Limit delete call frequency to prevent "Rate Exceeded" errors
                    console.log('Deleting function name: ' + name + ' at version: ' + version)
                    return Promise.delay(500).then(() => {
                      return lambdaService.deleteFunction(name, version)
                    })
                  }
                })
              })
          })
      }, { concurrency: 3 })
    })
    .then(function () {
      callbacker.makeCallback(null, '')
    })
    .catch(function (error) {
      callbacker.makeCallback(error)
    })
}

module.exports = cleanupLambdas
