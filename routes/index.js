var express = require('express');
var passport = require('passport');
var router = express.Router();
const config = require('config');
const fs = require('fs');
const { churchtoolsClient, activateLogging, LOG_LEVEL_DEBUG, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_NONE, errorHelper } = require('@churchtools/churchtools-client');
const axiosCookieJarSupport = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const path = require('path');



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
  var tmp = config.get('calendar.allowedCalendarIds');
  for(var i = 0; i < tmp.length; i++) {
    if(tmp[i].id == calendarId) {
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
  var tmp = config.get('calendar.allowedCalendarIds');
  var result = [];
  for(var i = 0; i < tmp.length; i++) {
    result.push(tmp[i].id);
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
  return 'from='+now;
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
    fs.writeFileSync(path, json2csv(data,";", true));
    resolve("Data gathered and stored");
  });
}

function storeAllGroupsData() {
  return new Promise((resolve, reject) => {
    getAllGroups()
      .then(value => { resolve(storeData(value, path.join(config.get('storagePaths.path').trim(),config.get('storagePaths.groupsData').trim()))); },
            reason => { reject(reason); });
  });
}

function storeAllContactPersons() {
  return new Promise((resolve, reject) => {
    getPersons([1,2,3,4,5,6,7])
      .then(value => { resolve(storeData(value,  path.join(config.get('storagePaths.path').trim(),config.get('storagePaths.contactPersonsData').trim()))); },
            reason => { reject(reason); });
  });
}

function storeNextAppointments() {
  return new Promise((resolve, reject) => {
    getNextAppointmentForCalendars()
      .then(value => { resolve(storeData(value,  path.join(config.get('storagePaths.path').trim(),config.get('storagePaths.appointmentData').trim()))); },
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
    res.send(reason);
    console.log(reason);
  });
});

router.get('/storeAllContactPersons', checkAuthenticatedApi, function (req, res, next) {
  storeAllContactPersons().then(value => {
    res.setHeader("Content-Type", "text/plain");
    res.send(value);
  }, reason => {
    res.status(500);
    res.send(reason);
    console.log(reason);
  });
});

router.get('/storeNextAppointments', checkAuthenticatedApi, function (req, res, next) {
  storeNextAppointments().then(value => {
    res.setHeader("Content-Type", "text/plain");
    res.send(value);
  }, reason => {
    res.status(500);
    res.send(reason);
  });
});

router.get('/getAllGroups', checkAuthenticatedApi, function (req, res, next) {
  getAllGroups().then(value => {
    res.setHeader("Content-Type", "application/json");
    res.send(value);
  }, reason => {
    res.status(500);
    res.send(reason);
  });
});

router.get('/getAllAppointments', checkAuthenticatedApi, function (req, res, next) {
  getNextAppointmentForCalendars().then(value => {
    res.setHeader("Content-Type", "application/json");
    res.send(value);
  }, reason => {
    res.status(500);
    res.send(reason);
  });
});

router.get('/', checkAuthenticated,  function (req, res, next) {
  res.render('index', {});
});

router.post('/login', passport.authenticate('local'
, {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlush: true
}));/*, function(req, res) {
  //res.status(200);
  //res.send("OK");
  res.redirect('/');
});*/

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
    //console.log(`-------> User Logged out`);
    //res.status(200);
    //res.send("OK");
  });
})

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
