'use strict'

const aws = require('aws-sdk')
const _ = require('lodash')
const Promise = require('bluebird')
const MAX_ITEMS = 0 // 0 === unlimited

function LambdaService () {
  this.initialize()
}

LambdaService.prototype = {
  client: null,

  initialize: function () {
    aws.config.setPromisesDependency(require('bluebird'))

    this.client = new aws.Lambda({
      apiVersion: 'latest',
      region: process.env.SERVERLESS_REGION
    })
  },

  getAllLambdas: function () {
    let params = {}
    if (MAX_ITEMS > 0) {
      params.MaxItems = MAX_ITEMS
    }

    return __listFunctions(this.client, params)
  },

  getVersionsForLambda: function (functionName) {
    let params = {}
    if (MAX_ITEMS > 0) {
      params.MaxItems = MAX_ITEMS
    }
    params.FunctionName = functionName

    return __listVersionsByFunction(this.client, params)
  },

  getAliasesForLambda: function (functionName) {
    let params = {}
    if (MAX_ITEMS > 0) {
      params.MaxItems = MAX_ITEMS
    }
    params.FunctionName = functionName

    return __listAliases(this.client, params)
  },

  deleteFunction: function (functionName, version) {
    if (_.isEmpty(functionName) || _.isEmpty(version)) {
      return Promise.reject('Cannot delete function without function name and version')
    }

    let params = {
      FunctionName: functionName,
      Qualifier: version
    }

    this.client.deleteFunction(params)
      .promise()
      .then(function (data) {
        return Promise.resolve(data)
      }, function (error) {
        console.warn('Error deleteing function', functionName, version, error)
        return Promise.resolve(error)
      })
  },

  invokeForAlias: function (functionName, alias) {
    alias = alias || process.env.SERVERLESS_STAGE

    let heaterPayload = {
      invokerType: 'HEATER'
    }

    return this.client.invoke({
      InvocationType: 'Event',
      FunctionName: functionName,
      Qualifier: alias,
      Payload: JSON.stringify(heaterPayload)
    })
      .promise()
      .then(function (data) {
        if (data.FunctionError === 'Unhandled') {
          throw data.Payload
        }

        return data
      }, function (error) {
        throw error
      })
  }
}

function __listVersionsByFunction (client, params) {
  let versions = []

  return client.listVersionsByFunction(params)
    .promise()
    .then(function (data) {
      versions = versions.concat(_.map(data.Versions, 'Version'))

      if (data.NextMarker) {
        params.Marker = data.NextMarker

        return __listVersionsByFunction(client, params)
      }

      return []
    }, function (error) {
      console.warn('Error on listVersionsByFunction with params ', params, error)
      throw error
    })
    .then(function (versionList) {
      return versions.concat(versionList)
    })
}

function __listAliases (client, params) {
  let aliases = []

  return client.listAliases(params)
    .promise()
    .then(function (data) {
      aliases = data.Aliases

      if (data.NextMarker) {
        params.Marker = data.NextMarker

        return __listAliases(client, params)
      }

      return []
    }, function (error) {
      console.warn('Error on listAliases with params ', params, error)
      throw error
    })
    .then(function (aliasList) {
      return aliases.concat(aliasList)
    })
}

function __listFunctions (client, params) {
  let functions = []

  return client.listFunctions(params)
    .promise()
    .then(function (data) {
      functions = functions.concat(_.map(data.Functions, 'FunctionName'))

      if (data.NextMarker) {
        params.Marker = data.NextMarker

        return __listFunctions(client, params)
      }

      return []
    }, function (error) {
      throw error
    })
    .then(function (functionList) {
      return functions.concat(functionList)
    })
}

module.exports = LambdaService
