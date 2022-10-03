var express = require('express');
var passport = require('passport');
var router = express.Router();
var config = require('config');
const fs = require('fs');
const { churchtoolsClient, activateLogging, LOG_LEVEL_DEBUG, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_NONE, errorHelper } = require('@churchtools/churchtools-client');
const axiosCookieJarSupport = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const path = require('path');
const { group } = require('console');
const { has } = require('config');
var moment = require('moment');

var CronJob = require('cron').CronJob;

checkAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) { return next() }
  res.redirect("/login")
}

checkAuthenticatedApi = (req, res, next) => {
  if (req.isAuthenticated()) { return next(); }
  res.status(401);
  res.send('You are not authenticated so far. Call /login first');
  //res.redirect("/login")
}

function initChurchToolsClient() {
    churchtoolsClient.setCookieJar(axiosCookieJarSupport.default, new tough.CookieJar());
    churchtoolsClient.setBaseUrl(config.get('churchtools.url'));
    var logLevel = config.get('logging.level');
    if(logLevel == "debug") {
      // LOG_LEVEL_DEBUG (outputs every request and response including request/response data)
      activateLogging(LOG_LEVEL_DEBUG);
    } else if(logLevel == "info") {
      // LOG_LEVEL_INFO (outputs every request and response, but only method and URL)
      activateLogging(LOG_LEVEL_INFO);
    } else if(logLevel == "error") {
      // LOG_LEVEL_ERROR (outputs only errors)
      activateLogging(LOG_LEVEL_ERROR);
    } else {
      // LOG_LEVEL_NONE (no logging at all, default)
      activateLogging(LOG_LEVEL_NONE);
    }
}

/**
 * Login to ChurchTools API
 * @param {string} username ChurchTools API username
 * @param {string} password user's passwort
 * @returns {object} Promise for login POST-request
 */
function login(username, password) {
    return churchtoolsClient.post('/login', { username, password });
}

/**
 * Replace all line breaks (\n) by HTML line breaks (&lt;br&gt;)
 * @param {string} text within which the line break (\n) shall be replaced by &lt;br&gt; 
 * @returns {string} text
 */
function lineBreak2HtmlLineBreak(text) {
  return text.replace(/\n/g,'<br>');
}

/**
 * Convert the given JSON-array to a CSV-string
 * @param {object} dataArray JSON-array which contains objects
 * @param {string} separator CSV-separator character
 * @param {boolean} withHeader Indicates if the attribute names of the first object are written to the CSV as header
 * @returns {string} CSV-string
 */
function json2csv(dataArray, separator, withHeader) {
  var tmp = '';
  if(withHeader) {
    for (const [key, val] of Object.entries(dataArray[0])) {
      tmp += key + separator;
    }
    tmp = tmp.slice(0,-1);
    tmp += '\n';
  }

  dataArray.forEach(dataObject => {
    for (const [key, val] of Object.entries(dataObject)) {
      var valTmp = val;
      if(key == 'note') {
        valTmp = lineBreak2HtmlLineBreak(valTmp);
      }
      tmp += valTmp + separator;
    }
    tmp = tmp.slice(0,-1);
    tmp += '\n';
  });
  return tmp;
}

/**
 * Get data of all groups from ChurchTools.
 * 
 * @returns {object} promise
 */
function getAllGroups() {
  // By default only 10 groups are returned. All 100 groups at once.
  // TODO: This approach does not work for scenarios where there are more than 100 groups.
  var url = `/groups?page=1&limit=100`;
  console.log(`Querying all groups URL: ${url}`);
  return churchtoolsClient.get(url).then(groups => {
    return new Promise((resolve, reject) => {
      assertIsArray(groups, reject);
      var result = [];
      groups.forEach(group => {
          var tmp = {};
          tmp.id = group.id;
          tmp.name = group.name;
          tmp.startDate = 'TODO'; // does not exist so far
          tmp.endDate = group.information.endDate;
          tmp.note = group.information.note;
          tmp.imageUrl = group.information.imageUrl;
          //console.log(tmp);
          result.push(tmp);
      });
      resolve(result);
    });
  }, reason => {
    console.error(reason); 
  });
}

/**
 * Check if the group with the specified ID has the tag used to mark for export.
 * @param {Number} groupId ID of the group
 * @returns {object} promise
 */
 function hasGroupExportTag(groupId) {
  var url = `/groups/${groupId}/tags`;
  console.log(`Querying tags of group via URL: ${url}`);
  return churchtoolsClient.get(url).then(tags => {
    return new Promise((resolve, reject) => {
      assertIsArray(tags, reject);
      var result = false;
      
      tags.forEach(tag => {
        if(tag.name == config.get('tags.groupsToExport')) {
            result = true;
          }
      });
      resolve(result);
    });
  }, reason => {
    console.error(reason); 
  });
}

async function filterGroups(groups) {
  var result = [];
  for(let i = 0; i < groups.length; i++) {
    var hasTag = await hasGroupExportTag(groups[i].id);
    if(hasTag) {
      result.push(groups[i]);
    }
  }
  return result;
}

/**
 * Check if the person with the specified ID has the tag used to mark for export.
 * @param {Number} personId ID of the person
 * @returns {object} promise
 */
 function hasPersonExportTag(personId) {
  var url = `/persons/${personId}/tags`;
  console.log(`Querying tags of person via URL: ${url}`);
  return churchtoolsClient.get(url).then(tags => {
    return new Promise((resolve, reject) => {
      assertIsArray(tags, reject);
      var result = false;
      
      tags.forEach(tag => {
        if(tag.name == config.get('tags.personsToExport')) {
            result = true;
          }
      });
      resolve(result);
    });
  }, reason => {
    console.error(reason); 
  });
}

async function filterPersons(persons) {
  var result = [];
  for(let i = 0; i < persons.length; i++) {
    var hasTag = await hasPersonExportTag(persons[i].id);
    if(hasTag) {
      result.push(persons[i]);
    }
  }
  return result;
}

var options = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric'
};

var optionsEnd = {
  hour: 'numeric',
  minute: 'numeric'
};

/**
 * Check if the given calendar ID is allowed to be processed
 * @param {Number} calendarId calendar's ID in ChurchTools
 * @returns {Boolean} true in case processing is allowed by configuration, else false
 */
function isCalendarIdAllowed(calendarId) {
  // Ensure the given calendar ID is a number.
  if(isNaN(calendarId)) {
    return false;
  }
  var allowedCalendarIds = config.get('calendar.allowedCalendarIds');
  for(var i = 0; i < allowedCalendarIds.length; i++) {
    if(allowedCalendarIds[i] == calendarId) {
      return true;
    }
  }
  return false;
}

/**
 * 
 * @param {Array} calendarIds array of calendar IDs as numbers
 * @returns {Boolean} true in case processing of all calendar IDs is allowed by configuration, else false
 */
function isCalendarIdsAllowed(calendarIds) {
  for(var i = 0; i < calendarIds.length; i++) {
    if(!isCalendarIdAllowed(calendarIds[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Read the allowed calendar IDs from the configuration
 * @returns {array} calendar IDs as array of numbers
 */
function getCalendarIds() {
  var allowedCalendarIds = config.get('calendar.allowedCalendarIds');
  var result = [];
  for(var i = 0; i < allowedCalendarIds.length; i++) {
    result.push(allowedCalendarIds[i]);
  }
  return result;
}

/**
 * Build query parameters calendar_ids from the given array of calendar IDs
 * @param {Array} calendarIds array of calendar IDs as numbers
 * @returns {string} query parameters calendar_ids[]=...&calendar_ids[]=...
 */
function buildQueryParametersForCalendarIds(calendarIds) {
  var tmp = '';
  calendarIds.forEach(calendarId => {
    tmp += `calendar_ids%5B%5D=${calendarId}&`;
  });
  tmp = tmp.slice(0,-1);
  return tmp;
}

/**
 * Build query parameter from with the current date
 * @returns {string} query parameter from=...
 */
function buildQueryParameterFromWithCurrentDate() {
  var now = new Date().toISOString().replace(/T.*/,'');
  var tmp = new Date();
  var to = new Date(tmp.setMonth(tmp.getMonth()+3)).toISOString().replace(/T.*/,'');
  return 'from='+now+'&to='+to;
}

function assertIsArray(toCheck, reject) {
  if(!Array.isArray(toCheck)) {
    console.log(`The ChurchTool API responded using data which is not a JSON-array and hence unexpected.`)
    console.log(`Payload (see next line):`);
    console.log(toCheck);
    reject(`The ChurchTool API responded using data which is not a JSON-array and hence unexpected.`);
  }
}

/**
 * 
 * @returns {Object} Promise for HTTP-GET on /calendars
 */
function getNextAppointmentForCalendars() {
  var url = `/calendars/appointments?${buildQueryParametersForCalendarIds(getCalendarIds())}`;
  url += '&'+buildQueryParameterFromWithCurrentDate();

  console.log(`Querying appointments for calendars using URL: ${url}`);
  return churchtoolsClient.get(url).then(appointments => {
    return new Promise((resolve, reject) => {
      assertIsArray(appointments, reject);

      var result = [];
      appointments.forEach(appointment => {
        var startDate = new Date(appointment.calculated.startDate);
        var endDate = new Date(appointment.calculated.endDate);
        var startDateString = startDate.toLocaleDateString('de-DE', options);
        startDateString = startDateString.replace(/:00/g,'');
        var endDateString = endDate.toLocaleTimeString('de-DE', optionsEnd);
        endDateString = endDateString.replace(/:00/g,'');
  
        var tmp = appointment.base.calendar.name + ' ' + startDateString + ' bis '+endDateString + ' Uhr';
        //console.log(tmp);
  
        result.push({
          //string: tmp,
          calendarId: appointment.base.calendar.id,
          calendarName: appointment.base.calendar.name,
          information: appointment.base.information,
          localizedStartDateString: startDate.toLocaleDateString('de-DE', options),
          localizedEndDateString: endDate.toLocaleTimeString('de-DE', options),
          //startDateString: startDateString,
          //endDateString: endDateString,
          //localizedDateString: startDateString + ' bis '+endDateString + ' Uhr'
        });
      });
      resolve(result);
    });  
  }, reason => {
    console.error(reason); 
  });
}

var _calendars = {
  timestamp : moment().subtract(1, 'years'),
  calendars : []
};

/**
 * Get all calendars (ID and name).
 * @returns {object} promise
 */
 function getCalenders() {
  // Check if the calendars have just been retrieved
  if(_calendars.timestamp.isAfter(moment().subtract(20, 'seconds'))) {
    console.log('Using calendars from the cache');
    return new Promise((resolve, reject) => {
      resolve(_calendars.calendars);
    });
  } else {
    var url = `/calendars`;
    console.log(`Querying all calendars via URL: ${url}`);
    return churchtoolsClient.get(url).then(calendars => {
      return new Promise((resolve, reject) => {
        assertIsArray(calendars, reject);
        var result = [];
        
        calendars.forEach(calendar => {
          result.push({ id: calendar.id, name: calendar.name });
        });
        _calendars.timestamp = moment();
        _calendars.calendars = result;
        resolve(result);
      });
    }, reason => {
      console.error(reason); 
    });
  }
}

var _tags = {
  timestamp : moment().subtract(1, 'years'),
  tags : []
};

/**
 * Get all tags (ID and name).
 * @returns {object} promise
 */
 function getTags() {
  // Check if the tags have just been retrieved
  if(_tags.timestamp.isAfter(moment().subtract(20, 'seconds'))) {
    console.log('Using tags from the cache');
    return new Promise((resolve, reject) => {
      resolve(_tags.tags);
    });
  } else {
    var url = `/tags?type=persons`;
    console.log(`Querying all tags for type=persons via URL: ${url}`);
    return churchtoolsClient.get(url).then(tags => {
      return new Promise((resolve, reject) => {
        assertIsArray(tags, reject);
        var result = [];
        
        tags.forEach(tag => {
          result.push({ id: tag.id, name: tag.name });
        });
        _tags.timestamp = moment();
        _tags.tags = result;
        resolve(result);
      });
    }, reason => {
      console.error(reason); 
    });
  }
}

/**
 * Build query parameters ids from the given array of person IDs
 * @param {Array} personIds array of person IDs as numbers
 * @returns {string} query parameters ids[]=...&ids[]=...
 */
 function buildQueryParametersForPersonIds(personIds) {
  var tmp = '';
  personIds.forEach(personId => {
    tmp += `ids%5B%5D=${personId}&`;
  });
  tmp = tmp.slice(0,-1);
  return tmp;
}

/**
 * 
 * @param {Array} personIds array of person IDs as numbers
 * @returns 
 */
function getPersons(personIds) {
  var url = `/persons?${buildQueryParametersForPersonIds(personIds)}`;
  url += '&page=1&limit=100';
  console.log(`Querying persons using URL: ${url}`);
  return churchtoolsClient.get(url).then(persons => {
    return new Promise((resolve, reject) => {
      assertIsArray(persons, reject);
      var result = [];
      persons.forEach(person => {
          var tmp = {};
          tmp.id = person.id;
          tmp.firstName = person.firstName;
          tmp.lastName = person.lastName;
          tmp.email = null;
          if(person.emails != null && person.emails.length > 0) {
            for(var i = 0; i < person.emails.length; i++) {
              if(person.emails[i].isDefault) {
                tmp.email = person.emails[i].email;
                break;
              }
            }
            // No email is flagged as default. Take the first one.
            if(tmp.email == null) {
              tmp.email = person.emails[0].email;
            }
          }
          tmp.imageUrl = person.imageUrl;
          if(person.mobile.length > 0) {
            tmp.phone = person.mobile;
          } else if(person.phonePrivate.length > 0) {
            tmp.phone = person.phonePrivate;
          } else if(person.phoneWork.length > 0) {
            tmp.phone = person.phoneWork;
          } else {
            tmp.phone = null;
          }
          //console.log(tmp);
          result.push(tmp);
      });
      resolve(result);
    });
  }, reason => {
    console.error(reason); 
  });
}

/**
 * Store the given JSON-data as CSV.
 * @param {Array} data JSON-array which contains objects with group data
 * @param {string} path Path (incl. filename) where to store the data
 * @returns 
 */
function storeData(data, path) {
  return new Promise((resolve, reject) => {
    config.get('storage.mimeTypes').forEach(mimeType => {
      if(mimeType == 'application/json') {
        fs.writeFileSync(path+".json", JSON.stringify(data,null,4));
      } else if(mimeType == 'text/csv') {
        fs.writeFileSync(path+".csv", json2csv(data,";", true));
      }
    });
    resolve("Data gathered and stored ");
  });
}

function storeAllGroupsData() {
  return new Promise((resolve, reject) => {
    getAllGroups()
      .then(allGroups => filterGroups(allGroups),
            reason => { reject(reason); })    
      .then(filteredGroups => { resolve(storeData(filteredGroups, path.join('tmp',config.get('storage.groupsData').trim()))); },
            reason => { reject(reason); });
  });
}

function storeAllContactPersons() {
  return new Promise((resolve, reject) => {
    getPersons([1,2,3,4,5,6,7])
      .then(allPersons => filterPersons(allPersons),
            reason => { reject(reason); })    
      .then(filteredPersons => { resolve(storeData(filteredPersons,  path.join('tmp',config.get('storage.contactPersonsData').trim()))); },
            reason => { reject(reason); });
  });
}

function storeNextAppointments() {
  return new Promise((resolve, reject) => {
    getNextAppointmentForCalendars()
      .then(value => { resolve(storeData(value,  path.join('tmp',config.get('storage.appointmentData').trim()))); },
            reason => { reject(reason); });
  });
}

initChurchToolsClient();
login(config.get('churchtools.username'), config.get('churchtools.password')).then(() => {
    //getNextAppointmentForCalendar(nn);
}).catch(error => {
    // getTranslatedErrorMessage returns a human readable translated error message
    // from either a full response object, response data or Exception or Error instances.
    console.error(errorHelper.getTranslatedErrorMessage(error));
});

router.get('/storeAllGroupsData', checkAuthenticatedApi, function (req, res, next) {
  storeAllGroupsData().then(value => {
    res.setHeader("Content-Type", "text/plain");
    res.send(value);
  }, reason => {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(reason));
    console.error(reason);
  });
});

router.get('/storeAllContactPersons', checkAuthenticatedApi, function (req, res, next) {
  storeAllContactPersons().then(value => {
    res.setHeader("Content-Type", "text/plain");
    res.send(value);
  }, reason => {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(reason));
    console.error(reason);
  });
});

router.get('/storeNextAppointments', checkAuthenticatedApi, function (req, res, next) {
  storeNextAppointments().then(value => {
    res.setHeader("Content-Type", "text/plain");
    res.send(value);
  }, reason => {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(reason));
    console.error(reason);
  });
});

router.get('/store', checkAuthenticatedApi, function (req, res, next) {
  storeAllGroupsData()
    .then(storeAllContactPersons)
    .then(storeNextAppointments)
    .then(value => {
    res.setHeader("Content-Type", "text/plain");
    res.send("OK");
  }, reason => {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(reason));
    console.error(reason);
  });
});

router.get('/getAllGroups', checkAuthenticatedApi, function (req, res, next) {
  getAllGroups().then(value => {
    res.setHeader("Content-Type", "application/json");
    res.send(value);
  }, reason => {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(reason));
    console.error(reason);
  });
});

router.get('/getAllAppointments', checkAuthenticatedApi, function (req, res, next) {
  getNextAppointmentForCalendars().then(value => {
    res.setHeader("Content-Type", "application/json");
    res.send(value);
  }, reason => {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(reason));
    console.error(reason);
  });
});

router.get('/getCalendars', checkAuthenticatedApi, function (req, res, next) {
  getCalenders().then(calendarIdsAndNames => {
    res.setHeader("Content-Type", "application/json");
    res.send(calendarIdsAndNames);
  }, reason => {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(reason));
    console.error(reason);
  });
});

router.get('/getTags', checkAuthenticatedApi, function (req, res, next) {
  getTags().then(tagIdsAndNames => {
    res.setHeader("Content-Type", "application/json");
    res.send(tagIdsAndNames);
  }, reason => {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(reason));
    console.error(reason);
  });
});

router.post('/updateConfig', checkAuthenticatedApi, function (req, res, next) {
  var result = {};
  newConfig = req.body;
  var configTmp = JSON.parse(fs.readFileSync('config/default.json'));
  fs.writeFileSync('config/default.json.bak', JSON.stringify(configTmp));

  // TODO: perform a connection test with the URL and user/password
  configTmp.churchtools.url = newConfig.churchtools.url;
  configTmp.churchtools.username = newConfig.churchtools.username;
  configTmp.churchtools.password = newConfig.churchtools.password.trim().length > 0 ? newConfig.churchtools.password : configTmp.churchtools.password;

  var allowedFilenameRegex = /^[\w\-.][\w\-. ]*$/;
  if(allowedFilenameRegex.test(newConfig.storage.groupsData)) {
    configTmp.storage.groupsData = newConfig.storage.groupsData;
  } else {
    result.storage.groupsData = 'The filename contains an invalid character';
  }
  if(allowedFilenameRegex.test(newConfig.storage.contactPersonsData)) {
    configTmp.storage.contactPersonsData = newConfig.storage.contactPersonsData;
  } else {
    result.storage.contactPersonsData = 'The filename contains an invalid character';
  }
  if(allowedFilenameRegex.test(newConfig.storage.appointmentData)) {
    configTmp.storage.appointmentData = newConfig.storage.appointmentData;
  } else {
    result.storage.appointmentData = 'The filename contains an invalid character';
  }


  configTmp.storage.mimeTypes = [];
  if(newConfig.storage.mimeTypes.includes("text/csv")) {
    configTmp.storage.mimeTypes.push("text/csv");
  }
  if(newConfig.storage.mimeTypes.includes("application/json")) {
    configTmp.storage.mimeTypes.push("application/json");
  }

  // TODO: input validation for ID and name
  configTmp.calendar.allowedCalendarIds = newConfig.calendar.allowedCalendarIds;

  configTmp.tags.groupsToExport = newConfig.tags.groupsToExport; //JSON.stringify();
  configTmp.tags.personsToExport = newConfig.tags.personsToExport;//JSON.stringify();

  if(newConfig.logging.level == 'error' ||
     newConfig.logging.level == 'debug' ||
     newConfig.logging.level == 'info' ||
     newConfig.logging.level == 'none') {
    configTmp.logging.level = newConfig.logging.level;
  } else {
    configTmp.logging.level = 'error';
    result.logging.level = 'The log level is invalid. Set the log level to "error"';
  }

  var cronPatternRegex = /((\d{1,2}|\*)\s){5}(\d{1,2}|\*)/;
  if(cronPatternRegex.test(newConfig.cronJob.pattern)) {
    configTmp.cronJob.pattern = newConfig.cronJob.pattern;
  }

  console.log(configTmp);

  fs.writeFileSync('config/default.json', JSON.stringify(configTmp, null, 4));

  delete require.cache[require.resolve('config')];
  config = require('config');
  res.setHeader("Content-Type", "application/json");
  res.send({ "result" : "OK" });
});

router.get('/status', checkAuthenticatedApi, function (req, res, next) {
  try {
    res.setHeader("Content-Type", "application/json");
    var filesToCheck = [];

    config.get('storage.mimeTypes').forEach(mimeType => {
      if(mimeType == 'text/csv') {
        filesToCheck.push({ "path": path.join('tmp',config.get('storage.groupsData').trim())+".csv", 
          "category": "groupsData", "mimeType":"text/csv"});
        filesToCheck.push({ "path": path.join('tmp',config.get('storage.contactPersonsData').trim())+".csv", 
          "category": "contactPersonsData", "mimeType":"text/csv"});
        filesToCheck.push({ "path": path.join('tmp',config.get('storage.appointmentData').trim())+".csv", 
          "category": "appointmentData", "mimeType":"text/csv"});
      }
      if(mimeType == 'application/json') {
        filesToCheck.push({ "path": path.join('tmp',config.get('storage.groupsData').trim())+".json", 
          "category": "groupsData", "mimeType":"application/json"});
        filesToCheck.push({ "path": path.join('tmp',config.get('storage.contactPersonsData').trim())+".json", 
          "category": "contactPersonsData", "mimeType":"application/json"});
        filesToCheck.push({ "path": path.join('tmp',config.get('storage.appointmentData').trim())+".json", 
          "category": "appointmentData", "mimeType":"application/json"});
      }
    });

    var result = {
      "files": [],
      "config": {}
    };
    filesToCheck.forEach(file => {
      if(fs.existsSync(file.path)) {
        result.files.push({"filename": file.path.replace('tmp\\',''), "exists": true, "stats": fs.statSync(file.path), "mimeType":file.mimeType});
      } else {
        result.files.push({"filename": file.path.replace('tmp\\',''), "exists": false});
      }
    });

    result.files.sort(function compare(file_a, file_b) {
      if (file_a.filename < file_b.filename ){
        return -1;
      }
      if (file_a.filename > file_b.filename ){
        return 1;
      }
      return 0;
    });

    result.config.churchtools = {
      "url": config.get('churchtools.url'),
      "username": config.get('churchtools.username'),
    };
    result.config.storage = {
      "groupsData": config.get('storage.groupsData'),
      "contactPersonsData": config.get('storage.contactPersonsData'),
      "appointmentData": config.get('storage.appointmentData'),
      "mimeTypes": config.get('storage.mimeTypes'),
    };
    result.config.calendar = {
      "allowedCalendarIds": config.get('calendar.allowedCalendarIds'),
    };
    result.config.tags = config.get('tags');

    result.config.logging = {
      "level": config.get('logging.level'),
    };
    result.config.cronJob = {
      "pattern": config.get('cronJob.pattern'),
    };
    res.send(result);
  } catch(err) {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(err));
    console.error(err);
  }
});


router.get('/', checkAuthenticated,  function (req, res, next) {
  res.render('index', {});
});

router.post('/login', passport.authenticate('local' , {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlush: true
}));

function checkLoggedIn(req, res, next) {
  console.log('req.isAuthenticated(): '+req.isAuthenticated());
  if (req.isAuthenticated()) { 
       return res.redirect("/login");
   }
  next();
}

router.get('/login', checkLoggedIn, function (req, res, next) {
  res.render('login', {});
});

router.post("/logout", (req,res) => {
  req.logout(function(err) {
    if (err) { 
      return next(err); 
    }
    res.redirect("/login")
  });
});

var job = new CronJob(
	config.get('cronJob.pattern'), 
	function() {
		console.log('Gather all data');
    storeAllGroupsData();
    storeAllContactPersons();
    storeNextAppointments();
	},
	null,
	true,
	'Europe/Berlin'
);

module.exports = router;