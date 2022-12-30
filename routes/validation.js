var express = require('express');
var passport = require('passport');
var router = express.Router();
var config = require('config');
const fs = require('fs');
const tough = require('tough-cookie');
const path = require('path');
const { group } = require('console');
const { has } = require('config');
var moment = require('moment');
const { getSystemErrorMap } = require('util');
const marked = require('marked');
var { Draft07 } = require ('json-schema-library');
const { isValidFilename } = require('valid-filename');
var CronJob = require('cron').CronJob;

checkAuthenticatedApi = (req, res, next) => {
    if (req.isAuthenticated()) { return next(); }
    res.status(401);
    res.send('You are not authenticated so far. Call /login first');
}

function validateFilename(filename) {
    return new Promise((resolve, reject) => {
        var validFilename = filenamify(filename, {replacement: '_'});
        if(validFilename == filename) {
            resolve({ valid: true });
        } else {
            reject({valid : false, validFilename: validFilename });
        }
    });
  }
  

router.post('/filename', checkAuthenticatedApi, function (req, res, next) {
    validateFilename(req.body)
        .then(result => res.status(200).json(result),
            reason => res.status(200).json(reason));
  });

module.exports = router;