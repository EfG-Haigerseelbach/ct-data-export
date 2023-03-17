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
const { getSystemErrorMap } = require('util');
const marked = require('marked');
var { Draft07 } = require ('json-schema-library');

var CronJob = require('cron').CronJob;

checkAuthenticated = (req, res, next) => {
  if(req.isAuthenticated()) { 
    return next();
  } else {
    res.redirect("/login");
  }
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

function getProperty(path, obj) {
  return path.split('.').reduce(function(prev, curr) {
      return prev ? prev[curr] : null
  }, obj || self);
}

function getWeekdayById(id) {
  if(id == 0) {
    return 'Sonntag';
  } else if(id == 1) {
    return 'Montag';
  } else if(id == 2) {
    return 'Dienstag';
  } else if(id == 3) {
    return 'Mittwoch';
  } else if(id == 4) {
    return 'Donnerstag';
  } else if(id == 5) {
    return 'Freitag';
  } else if(id == 6) {
    return 'Samstag';
  } else {
    return '';
  }
}

function buildGroupsExport(groupsDataFromChurchToolsApi) {
  return new Promise((resolve, reject) => {
    assertIsArray(groupsDataFromChurchToolsApi, reject);
    var result = [];
    groupsDataFromChurchToolsApi.forEach(group => {
        var tmp = {};
        tmp.id = group.id;
        tmp.name = group.name;
        
        tmp.startDate = group.information.dateOfFoundation != null ? group.information.dateOfFoundation : '';
        tmp.startDate = tmp.startDate.length == 0 ? '' : moment(tmp.startDate, "YYYY-MM-DD").format("DD.MM.YYYY");
        
        tmp.endDate = group.information.endDate != null ? group.information.endDate : '';
        tmp.endDate = tmp.endDate.length == 0 ? '' : moment(tmp.endDate, "YYYY-MM-DD").format("DD.MM.YYYY");
        
        tmp.weekday = group.information.weekday != null ? getWeekdayById(group.information.weekday) : '';
        
        tmp.startTime = group.information.meetingTime != null ? group.information.meetingTime : '';

        tmp.note = marked.parse(group.information.note).replace(/"/g,"\"");

        tmp.imageUrl = group.information.imageUrl;
        tmp.export = getProperty(config.get('export.accessPath.exposureIndicator'), group);
        tmp.export = tmp.export === undefined ? false : tmp.export;
        tmp.showOnLandingPage = getProperty(config.get('export.accessPath.showOnLandingPage'), group);
        tmp.showOnLandingPage = tmp.showOnLandingPage === undefined ? false : tmp.showOnLandingPage;

        tmp.categories = [];
        var categories = getProperty(config.get('export.accessPath.categoryData'), group);
        if(categories != null) {
          for(var [id, value] of Object.entries(categories)) {
            var groupCategory = getMasterDataById("groupCategories", value);
            if(groupCategory != undefined) {
              tmp.categories.push(groupCategory.nameTranslated);
            } else {
              console.error(`For group with ID ${group.id} (name: ${group.name}) the data field ${config.get('export.accessPath.categoryData')} contains value ${value} but there is no such master data for 'groupCategories'!`);
            }
          }
        }
        tmp.targetGroups = [];
        var targetGroupsIdsTmp = getProperty(config.get('export.accessPath.targetGroupIds'), group);
        if(targetGroupsIdsTmp != null) {
          for(var [id, value] of Object.entries(targetGroupsIdsTmp)) {
            var masterDataTmp = getMasterDataById("targetGroups", value);
            if(masterDataTmp != null) {
              tmp.targetGroups.push(masterDataTmp.nameTranslated);
            } else {
              console.error(`Error while processing group ${tmp.name} ${tmp.id}: No person master data (/person/masterdata) for 'targetGroups' with id ${value} found!`);
            }
          }
        }
        tmp.ageCategory = '';
        var ageCategoryTmp = getProperty(config.get('export.accessPath.agecategory'), group);
        if(ageCategoryTmp != null) {
          tmp.ageCategory = ageCategoryTmp;
        }
        tmp.recurrenceDescription = '';
        var recurrenceDescriptionTmp = getProperty(config.get('export.accessPath.recurrenceDescription'), group);
        if(recurrenceDescriptionTmp != null) {
          tmp.recurrenceDescription = recurrenceDescriptionTmp;
        }
        tmp.contactPersons = [];
        var contactPersonIdsTmp = getProperty(config.get('export.accessPath.contactPersonIds'), group);
        if(contactPersonIdsTmp != null && contactPersonIdsTmp.length > 0) {
          tmp.contactPersons = contactPersonIdsTmp.split(/[\s,;]/);
        }
        // Remove empty array elements.
        tmp.contactPersons = tmp.contactPersons.filter((contactPersonId) => { return contactPersonId.length > 0; });
        result.push(tmp);
    });
    result.sort(function compare(group_a, group_b) {
      if (group_a.id < group_b.id ){
        return -1;
      }
      if (group_a.id > group_b.id ){
        return 1;
      }
      return 0;
    });
    //return result;
    resolve(result);
  });
}

function removeDuplicates(a) {
  var seen = {};
  var out = [];
  var len = a.length;
  var j = 0;
  for(var i = 0; i < len; i++) {
       var item = a[i];
       if(seen[item] !== 1) {
             seen[item] = 1;
             out[j++] = item;
       }
  }
  return out;
}

function expandGroupContactPerson(groups, person) {
  for(var i = 0; i < groups.length; i++) {
    for(var j = 0; j < groups[i].contactPersons.length; j++) {
      if(!Number.isNaN(Number.parseInt(groups[i].contactPersons[j])) && groups[i].contactPersons[j] == person.id) {
        // not expanded yet
        groups[i].contactPersons.splice(j,1,person);
      }
    }
  }
  return groups;
}

function expandGroupContactPersons(groups) {
  return new Promise((resolve, reject) => {
    assertIsArray(groups, reject);
    var idsOfPersonsToExpand = [];
    groups.forEach(group => {
      idsOfPersonsToExpand = idsOfPersonsToExpand.concat(group.contactPersons);
    });
    idsOfPersonsToExpand = removeDuplicates(idsOfPersonsToExpand);
    getPersons(idsOfPersonsToExpand)
      .then(persons => {
        for(var i = 0; i < persons.length; i++) {
          groups = expandGroupContactPerson(groups, persons[i]);
        }
        resolve(groups);
      })
      .catch(reason => reject(reason));
  });
}

function replaceGroupsImages(groups) {
  return new Promise((resolve, reject) => {
    assertIsArray(groups, reject);
    Promise.allSettled(groups.map(group => {
      return new Promise((resolveGroupImage, rejectGroupImage) => {
        getGroupImageUrl(group.id).then(url => {
          resolveGroupImage({id: group.id, imageUrl: url});
        });
      });
    })).then(data => {
      for(var i = 0; i < groups.length; i++) {
        for(var j = 0; j < data.length; j++) {
          if(groups[i].id == data[j].value.id) {
            groups[i].imageUrl = data[j].value.imageUrl;
            break;
          }
        }
      }
      resolve(groups);
    });
  });
}

function replacePersonsImagesForGroups(groups) {
  return new Promise((resolve, reject) => {
    assertIsArray(groups, reject);

    var personIds = [];
    for(var i = 0; i < groups.length; i++) {
      for(var j = 0; j < groups[i].contactPersons.length; j++) {
        if(!personIds.includes(groups[i].contactPersons[j].id)) {
          personIds.push(groups[i].contactPersons[j].id);
        }
      }
    }

    Promise.allSettled(personIds.map(personId => {
      return new Promise((resolvePersonImage, rejectPersonImage) => {
        getPersonImageUrl(personId).then(url => {
          resolvePersonImage({id: personId, imageUrl: url});
        });
      });
    })).then(data => {
      for(var i = 0; i < groups.length; i++) {
        for(var j = 0; j < groups[i].contactPersons.length; j++) {
          // Cross-check the promises' result data.
          for(var k = 0; k < data.length; k++) {
            if(groups[i].contactPersons[j].id == data[k].value.id) {
              // Only change the person's image URL in case the new URL is not empty.
              if(data[k].value.imageUrl.length > 0) {
                groups[i].contactPersons[j].imageUrl = data[k].value.imageUrl;
              }
              break;
            }
          }
        }
      }
      resolve(groups);
    });
  });
}

function filterForToBeExportedGroups(groups) {
  return new Promise((resolve, reject) => {
    assertIsArray(groups, reject);
    var result = [];
    for(var i = 0; i < groups.length; i++) {
      if(groups[i].export) {
        result.push(groups[i]);
      }
    }
    resolve(result);
  });
}

function cacheGroups(groups) {
  return new Promise((resolve, reject) => {
    _groups.timestamp = moment();
    _groups.groups = groups;
    resolve(groups);
  });
}

var _groups = {
  timestamp : moment().subtract(1, 'years'),
  groups : []
};

/**
 * Get data of all groups from ChurchTools.
 * 
 * @returns {object} promise
 */
function getAllGroups() {
  // Check if the groups have just been retrieved
  if(_groups.timestamp.isAfter(moment().subtract(60, 'seconds'))) {
    console.log('Using groups from the cache');
    return new Promise((resolve, reject) => {
      resolve(_groups.groups);
    });
  } else {
    var url = `/groups`;
    console.log(`Querying all groups URL: ${url}`);
    return churchtoolsClient.getAllPages(url)
      .then(groups => buildGroupsExport(groups))
      .then(groups => filterForToBeExportedGroups(groups))
      .then(groups => expandGroupContactPersons(groups))
      .then(groups => replaceGroupsImages(groups))
      .then(groups => replacePersonsImagesForGroups(groups))
      .then(groups => cacheGroups(groups))
      .catch(reason => console.error(reason));
  }
}

/**
 * Query the group image
 * @param {Number} groupId ID of the group
 * @returns {object} promise
 */
 function getGroupImageUrl(groupId) {
  var url = `/files/groupimage/${groupId}`; // needs authorization 'administer groups'
  console.log(`Querying the groupimage of group ${groupId} via URL: ${url}`);
  return churchtoolsClient.get(url).then(groupImage => {
    return new Promise((resolve, reject) => {
      assertIsArray(groupImage, reject);
      if(groupImage.length > 0) {
        resolve(groupImage[0].fileUrl);
      } else {
        resolve('');
      }
    });
  }, reason => {
    console.error(reason); 
  });
}

/**
 * Query the person image (avatar)
 * @param {Number} personId ID of the person
 * @returns {object} promise
 */
 function getPersonImageUrl(personId) {
  var url = `/files/avatar/${personId}`; // TODO: needs authorization ???
  console.log(`Querying the avatar of person ${personId} via URL: ${url}`);
  return churchtoolsClient.get(url).then(personImage => {
    return new Promise((resolve, reject) => {
      assertIsArray(personImage, reject);
      if(personImage.length > 0) {
        if(personImage[0].fileUrl !== undefined) {
          resolve(personImage[0].fileUrl);
        } else {
          resolve(config.get('churchtools.url') + '/system/assets/img/nobody-new.jpg');
        }
      } else {
        resolve(config.get('churchtools.url') + '/system/assets/img/nobody-new.jpg');
      }
    });
  }, reason => {
    console.error(reason); 
  });
}

function assertIsArray(toCheck, reject) {
  if(!Array.isArray(toCheck)) {
    console.log(`The ChurchTool API responded using data which is not a JSON-array and hence unexpected.`)
    console.log(`Payload (see next line):`);
    console.log(toCheck);
    reject(`The ChurchTool API responded using data which is not a JSON-array and hence unexpected.`);
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
  if(_tags.timestamp.isAfter(moment().subtract(60, 'seconds'))) {
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

var _masterData = {
  timestamp : moment().subtract(1, 'years'),
  masterData : []
};

/**
 * Get all master data.
 * @returns {object} promise
 */
 function getMasterData() {
  // Check if the master data have just been retrieved
  if(_masterData.timestamp.isAfter(moment().subtract(20, 'seconds'))) {
    console.log('Using master data from the cache');
    return new Promise((resolve, reject) => {
      resolve(_masterData.masterData);
    });
  } else {
    var url = `/person/masterdata`;
    console.log(`Querying all master data via URL: ${url}`);
    return churchtoolsClient.get(url).then(masterData => {
      return new Promise((resolve, reject) => {
        _masterData.timestamp = moment();
        _masterData.masterData = masterData;
        resolve(masterData);
      });
    }, reason => {
      console.error(reason); 
    });
  }
}

function getMasterDataById(section, id) {
  for(var i = 0; i < _masterData.masterData[section].length; i++) {
    if(_masterData.masterData[section][i].id == id) {
      return _masterData.masterData[section][i];
    }
  }
}

function isFilenameInConfig(filename) {
  filename = filename.replace(/\.json/,''); 
  if(filename == config.get('storage.groupsData') ||
     filename == config.get('storage.contactPersonsData')) {
    return true;
  }
  return false;
}

function getFile(filename) {
  return new Promise((resolve, reject) => {
    if(filename === undefined || filename == null || filename.length == 0 || !isFilenameInConfig(filename)) {
      reject({ error: 'Invalid filename'});
    }
    var content = fs.readFileSync(path.join('tmp',filename), 'utf8');
    resolve({ error: 'false', content: content});
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

var _persons = {
  timestamp : moment().subtract(1, 'years'),
  persons : []
};

function addOrUpdatePerson(person) {
  var personsTmp = [];
  var found = false;
  for(var i = 0; i < _persons.persons.length; i++) {
    if(_persons.persons[i].id == person.id) {
      found = true;
      personsTmp.push(person);
    } else {
      personsTmp.push(_persons.persons[i]);
    }
  }
  if(!found) {
    person.timestamp = moment();
    personsTmp.push(person);
  }
  _persons.persons = personsTmp;
};

function getPerson(id) {
  var found = false;
  for(var i = 0; i < _persons.persons.length; i++) {
    if(_persons.persons[i].id == id) {
      if(_persons.persons[i].timestamp.isAfter(moment().subtract(120, 'seconds'))) {
        found = true;
        console.log(`Using person with id ${id} from the cache`);
        return new Promise((resolve, reject) => {
          resolve(_persons.persons[i]);
        });
      }
    }
  }
  if(!found) {
    var personIdsTmp = [];
    personIdsTmp.push(id);
    return new Promise((resolve, reject) => {
      getPersons(personIdsTmp)
        .then(allPersons => { allPersons.forEach(addOrUpdatePerson) },
        reason => { reject(reason); });
      });
  }
}

function buildPersonsExport(personsDataFromChurchToolsApi) {
  const exportIndicator = config.get('export.person.attributeThatIndicatesToExport');
  return new Promise((resolve, reject) => {
    assertIsArray(personsDataFromChurchToolsApi, reject);
    var result = [];
    personsDataFromChurchToolsApi.forEach(person => {
        var tmp = {};
        tmp.id = person.id;
        tmp.firstName = person.firstName;
        tmp.lastName = person.lastName;
        tmp.email = null;
        if(person.emails != null && person.emails.length > 0) {
          for(var i = 0; i < person.emails.length; i++) {
            if(person.emails[i].contactLabelId == 7 /*7=Webseite*/) {
              tmp.email = person.emails[i].email;
              break;
            }
          }
          if(tmp.email == null) {
            for(var i = 0; i < person.emails.length; i++) {
              if(person.emails[i].isDefault) {
                tmp.email = person.emails[i].email;
                break;
              }
            }
          }
          // No email is flagged as default. Take the first one.
          if(tmp.email == null) {
            if(person.emails.length > 0) {
              tmp.email = person.emails[0].email;
            } else {
              tmp.email = '';
            }
          }
        }
        tmp.imageUrl = person.imageUrl;
        tmp.responsibilities = person.website_responsibilities;

        tmp.export = getProperty(exportIndicator, person);
        tmp.export = tmp.export === undefined ? false : tmp.export;

        tmp.sortOrder = getProperty(config.get('export.person.sortOrder'), person);
        tmp.sortOrder = tmp.sortOrder === undefined ? 99 : tmp.sortOrder;
        if(!Number.isInteger(tmp.sortOrder)) {
          tmp.sortOrder = 99;
        }
        
        result.push(tmp);
    });
    // Sort using the ID
    result.sort(function compare(person_a, person_b) {
      if(person_a.id < person_b.id ){
        return -1;
      } else if(person_a.id > person_b.id ){
        return 1;
      } else {
        return 0;
      }      
    });
    resolve(result);
  });
}

function filterForToBeExportedPersons(persons) {
  return new Promise((resolve, reject) => {
    assertIsArray(persons, reject);
    var result = [];
    for(var i = 0; i < persons.length; i++) {
      if(persons[i].export) {
        // Remove the export indicator since it shall not get to file output
        delete persons[i].export;
        result.push(persons[i]);
      }
    }
    // Sort using the sort order
    result.sort(function compare(person_a, person_b) {
      if(person_a.sortOrder < person_b.sortOrder ){
        return -1;
      } else if(person_a.sortOrder > person_b.sortOrder ){
        return 1;
      } else {
        if(person_a.firstName < person_b.firstName){
          return -1;
        } else if(person_a.firstName > person_b.firstName){
          return 1;
        } else {
          return 0;
        }
      }      
    });
    // Overwrite the sort order with uniq integer values.
    for(var i = 0; i < result.length; i++) {
      result[i].sortOrder = i+1;
    }
    resolve(result);
  });
}

function expandContactForGroups(persons) {
  return new Promise((resolve, reject) => {
    assertIsArray(persons, reject); 
    getAllGroups()  
      .then(groups => { 
        for(var i = 0; i < persons.length; i++) {
          persons[i].groups = [];
          for(var j = 0; j < groups.length; j++) {
            for(var k = 0; k < groups[j].contactPersons.length; k++) {
              if(groups[j].contactPersons[k].id == persons[i].id) {
                persons[i].groups.push({ id: groups[j].id, name: groups[j].name });
                // Since this person is found to be a contact person for a group set the export indicator.
                persons[i].export = true;
                break;
              }
            }
          }
        }
        resolve(persons); })
      .catch(reason => reject(reason));
  });
}

function replacePersonsImages(persons) {
  return new Promise((resolve, reject) => {
    assertIsArray(persons, reject);

    var personIds = [];
    for(var i = 0; i < persons.length; i++) {
      if(!personIds.includes(persons[i].id)) {
        personIds.push(persons[i].id);
      }
    }

    Promise.allSettled(personIds.map(personId => {
      return new Promise((resolvePersonImage, rejectPersonImage) => {
        getPersonImageUrl(personId).then(url => {
          resolvePersonImage({id: personId, imageUrl: url});
        });
      });
    })).then(data => {
      for(var i = 0; i < persons.length; i++) {
        // Cross-check the promises' result data.
        for(var k = 0; k < data.length; k++) {
          if(persons[i].id == data[k].value.id) {
            persons[i].imageUrl = data[k].value.imageUrl;
            break;
          }
        }
      }
      resolve(persons);
    });
  });
}

function getAllContactPersons() {
  var url = `/persons`;
  console.log(`Querying all groups URL: ${url}`);
  return churchtoolsClient.getAllPages(url)
    .then(persons => buildPersonsExport(persons))
    .then(persons => expandContactForGroups(persons))
    .then(persons => filterForToBeExportedPersons(persons))
    .then(persons => replacePersonsImages(persons))
    .catch(reason => console.error(reason));
}

/**
 * 
 * @param {Array} personIds array of person IDs as numbers
 * @returns 
 */
function getPersons(personIds) {
  // Check if the tags have just been retrieved
  if(_persons.timestamp.isAfter(moment().subtract(60, 'seconds'))) {
    console.log('Using persons from the cache');
    return new Promise((resolve, reject) => {
      resolve(_persons.persons);
    });
  } else {
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
                if(person.emails.length > 0) {
                  tmp.email = person.emails[0].email;
                } else {
                  tmp.email = '';
                }
              }
            }
            tmp.imageUrl = person.imageUrl;
            if(tmp.imageUrl.length == 0) {
              // Person has no avatar image. Use the default image.
              tmp.imageUrl = config.get('churchtools.url') + '/system/assets/img/nobody-new.jpg';
            }
            if(person.mobile.length > 0) {
              tmp.phone = person.mobile;
            } else if(person.phonePrivate.length > 0) {
              tmp.phone = person.phonePrivate;
            } else if(person.phoneWork.length > 0) {
              tmp.phone = person.phoneWork;
            } else {
              tmp.phone = '';
            }
            //console.log(tmp);
            result.push(tmp);
        });
        _persons.timestamp = moment();
        _persons.persons = result;
        resolve(result);
      });
    }, reason => {
      console.error(reason); 
    });
  }
}

/**
 * Store the given JSON-data.
 * @param {Array} data JSON-array which contains objects with group data
 * @param {string} path Path (incl. filename) where to store the data
 * @returns 
 */
function storeData(data, path) {
  return new Promise((resolve, reject) => {
    config.get('storage.mimeTypes').forEach(mimeType => {
      if(mimeType == 'application/json') {
        try {
          fs.writeFileSync(path+".json", JSON.stringify(data,null,4));
        } catch(error) {
          reject(error.message);
        }
      } else {
        reject(`Unsupported mime-type: ${mimeType}`);
      }
    });
    resolve("Data gathered and stored ");
  });
}

function storeGroups(data, path) {
  return new Promise((resolve, reject) => {
    config.get('storage.mimeTypes').forEach(mimeType => {
      if(mimeType == 'application/json') {
        try {
          fs.writeFileSync(path+".json", JSON.stringify(data,null,4));
        } catch(error) {
          reject(error.message);
        }
      } else {
        reject(`Unsupported mime-type: ${mimeType}`);
      }
    });
    resolve("Data gathered and stored ");
  });
}

function storeAllGroupsData() {
  return new Promise((resolve, reject) => {
    getAllGroups()  
      .then(groups => { resolve(storeGroups(groups, path.join('tmp',config.get('storage.groupsData').trim()))); },
            reason => { reject(reason); });
  });
}

function storeAllContactPersons() {
  return new Promise((resolve, reject) => {
    getAllContactPersons()
      .then(filteredPersons => { resolve(storeData(filteredPersons,  path.join('tmp',config.get('storage.contactPersonsData').trim()))); },
            reason => { reject(reason); });
  });
}

function updateConfig(newConfig) {
  return new Promise((resolve, reject) => {

    var configSchema = require('../config/configChangeSchema.json');
    
    const configJsonSchema = new Draft07(configSchema);
    var errors = configJsonSchema.validate(newConfig);
    
    if(errors != undefined && errors.length > 0) {
      // The configuration is not valid.
      console.error(errors);
      reject(errors);
    }

    var result = {};
    // Read the current configuration file.
    var configTmp = JSON.parse(fs.readFileSync('config/default.json')); // TODO: filename is not dynamic
    
    // TODO: perform a connection test with the URL and user/password
    var configChanged = false;
    if(configTmp.churchtools.url != newConfig.churchtools.url) {
      configTmp.churchtools.url = newConfig.churchtools.url;
      configChanged = true;
    }
    
    if(configTmp.churchtools.username != newConfig.churchtools.username) {
      configTmp.churchtools.username = newConfig.churchtools.username;
      configChanged = true;
    }

    if(newConfig.churchtools.password.trim().length > 0 && configTmp.churchtools.password != newConfig.churchtools.password) {
      configTmp.churchtools.password = newConfig.churchtools.password.trim().length > 0 ? newConfig.churchtools.password : configTmp.churchtools.password;
      configChanged = true;
    }
    
    var allowedFilenameRegex = /^[\w\-.][\w\-. ]*$/;
    if(configTmp.storage.groupsData != newConfig.storage.groupsData) {
      if(allowedFilenameRegex.test(newConfig.storage.groupsData)) {
        configTmp.storage.groupsData = newConfig.storage.groupsData;
        configChanged = true;
      } else {
        result.storage.groupsData = 'The filename contains an invalid character';
      }
    }
    if(configTmp.storage.contactPersonsData != newConfig.storage.contactPersonsData) {
      if(allowedFilenameRegex.test(newConfig.storage.contactPersonsData)) {
        configTmp.storage.contactPersonsData = newConfig.storage.contactPersonsData;
        configChanged = true;
      } else {
        result.storage.contactPersonsData = 'The filename contains an invalid character';
      }
    }
    
    if(configTmp.storage.output != newConfig.storage.output) {
      configTmp.storage.output = newConfig.storage.output;
      configChanged = true;
    }
    
    if(configTmp.logging.level != newConfig.logging.level) {
      if(newConfig.logging.level == 'error' ||
      newConfig.logging.level == 'debug' ||
      newConfig.logging.level == 'info' ||
      newConfig.logging.level == 'none') {
        configTmp.logging.level = newConfig.logging.level;
        configChanged = true;
      } else {
        result.logging.level = 'The log level is invalid. Keeping the current log level.';
      }
    }
    
    if(configTmp.cronJob.pattern != newConfig.cronJob.pattern) {
      try {
        if(validateCronPatternSync(newConfig.cronJob.pattern)) {
          configTmp.cronJob.pattern = newConfig.cronJob.pattern;
          configChanged = true;
        }
      } catch(patternError) {
        result.cronJob = {};
        result.cronJob.pattern = patternError.message;
      }
    }
    
    if(configChanged) {
      result.changed = true;
      console.log("Configuration changed");
      // Create a backup.
      //fs.writeFileSync('config/default.json.bak', JSON.stringify(configTmp, null, 4));
      // Overwrite the current configuration file.
      //fs.writeFileSync('config/default.json', JSON.stringify(configTmp, null, 4)); // TODO: filename is not dynamic
      
      // Reload the configuration.
      delete require.cache[require.resolve('config')];
      config = require('config');

      resolve(result);
    } else {
      console.log("No changes to the configuration.");
      resolve({result: { changed: false, message: "Config not changed"}});
    }
  });
}

function getStatus() {
  return new Promise((resolve, reject) => {
    try {
      var filesToCheck = [];

      config.get('storage.mimeTypes').forEach(mimeType => {
        if(mimeType == 'application/json') {
          filesToCheck.push({ "path": path.join('tmp',config.get('storage.groupsData').trim())+".json", 
            "category": "groupsData", "mimeType":"application/json"});
          filesToCheck.push({ "path": path.join('tmp',config.get('storage.contactPersonsData').trim())+".json", 
            "category": "contactPersonsData", "mimeType":"application/json"});
        }
      });

      var result = {
        "files": [],
        "config": {}
      };
      filesToCheck.forEach(file => {
        if(fs.existsSync(file.path)) {
          result.files.push({"filename": file.path.replace(/tmp[\\/]/,''), "exists": true, "stats": fs.statSync(file.path), "mimeType":file.mimeType});
        } else {
          result.files.push({"filename": file.path.replace(/tmp[\\/]/,''), "exists": false});
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
        "mimeTypes": config.get('storage.mimeTypes'),
      };
      result.config.tags = config.get('tags');

      result.config.logging = {
        "level": config.get('logging.level'),
      };
      result.config.cronJob = {
        "pattern": config.get('cronJob.pattern'),
      };
      resolve(result);
    } catch(err) {
      reject(err);
    }
  });
}

const cronParser = require("cron-parser");

function validateCronPatternSync(data) {
  try {
    var interval = cronParser.parseExpression(data);
    return interval.stringify();
  } catch(err) {
    throw err;
  }
}

function validateCronPattern(data) {
  return new Promise((resolve, reject) => {
    try {
      var normalizedPattern = validateCronPatternSync(data.pattern);
      resolve({valid: true, normalizedPattern: normalizedPattern });
    } catch(err) {
      resolve({valid: false, error: err.toString()});
    }
  });
}

function clientInitializationAndLogin() {
  console.log("(Re-)initialization of the ChurchTools client");
  initChurchToolsClient();
  console.log("Login using the configured API user...");
  login(config.get('churchtools.username'), config.get('churchtools.password')).then(() => {
    console.log("Login successful!");
    getMasterData();
    getTags();
  }).catch(error => {
      console.error("Login not successful!");
      console.error(error.stack);
      // getTranslatedErrorMessage returns a human readable translated error message
      // from either a full response object, response data or Exception or Error instances.
      console.error(errorHelper.getTranslatedErrorMessage(error));
  });
}

clientInitializationAndLogin();
// Start the job for recurrent client initialization and login
new CronJob(
	'0 0 1 * * *', // every night at 1:00:00
	clientInitializationAndLogin,
	null,
	true,
	'Europe/Berlin'
);

function sendEmptyHttp200(response) {
  response.setHeader("Content-Type", "text/plain").status(200).send();
}

function sendJsonHttp200(data, response) {
  response.status(200).json(data);
}

function sendHttp500(reason, response) {
  response.status(500).json(reason);
  console.error(reason);
}

router.post('/store', checkAuthenticatedApi, function (req, res, next) {
  storeAllGroupsData()
    .then(storeAllContactPersons)
    .then((value) => { sendEmptyHttp200(res) },
          reason => sendHttp500(reason, res));
});

router.get('/hooks', checkAuthenticatedApi, function(req, res, next) {
  getHooks()
    .then(hooks => { sendJsonHttp200(hooks, res) },
          reason => sendHttp500(reason, res));
}); 

router.post('/hooks', checkAuthenticatedApi, function(req, res, next) {
  triggerHooks('cron')
    .then(result => { sendJsonHttp200(result, res) },
          reason => sendHttp500(reason, res));
}); 

router.get('/hooks/status', checkAuthenticatedApi, function(req, res, next) {
  getHooksResults()
    .then(hooksResults => { sendJsonHttp200(hooksResults, res) },
          reason => sendHttp500(reason, res));
}); 

router.get('/getTags', checkAuthenticatedApi, function (req, res, next) {
  getTags()
    .then(tagIdsAndNames => { sendJsonHttp200(tagIdsAndNames, res) },
          reason => sendHttp500(reason, res));
});

router.get('/file', checkAuthenticatedApi, function (req, res, next) {
  getFile(req.query.filename)
    .then(file => { sendJsonHttp200(file, res) },
          reason => sendHttp500(reason, res));
});

router.post('/updateConfig', checkAuthenticatedApi, function (req, res, next) {
  updateConfig(req.body)
    .then((result) => { sendJsonHttp200(result, res) },
          reason => sendHttp500(reason, res));
});

router.get('/status', checkAuthenticatedApi, function (req, res, next) {
  getStatus()
    .then(status => sendJsonHttp200(status, res),
          reason => sendHttp500(reason, res));
});

router.post('/validateCronPattern', checkAuthenticatedApi, function (req, res, next) {
  validateCronPattern(req.body)
    .then(result => sendJsonHttp200(result, res),
          reason => sendHttp500(reason, res));
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
  res.status(401);
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
    res.redirect("/login");
  });
});

function callHookUrl(hook) {
  return new Promise((resolve, reject) => {
    console.log(moment().format('YYYY.MM.DD HH:mm:ss')+' - Calling hook URL: '+hook.url);
    if(hook.url.startsWith('https')) {
      const https = require('https');
    
      https.get(hook.url, res => {
        let data = [];  
        res.on('data', chunk => {
          data.push(chunk);
        });
        res.on('end', () => {
          console.log('Response Status Code: '+res.statusCode);
          if(res.statusCode >= 400 && res.statusCode < 600) {
            resolve(callHookUrl(hook));
          } else {
            console.log(moment().format('YYYY.MM.DD HH:mm:ss')+' - Received result for hook URL: '+hook.url);
            try{
              var tmp = JSON.parse(Buffer.concat(data).toString());
              tmp = moment().format('YYYY.MM.DD HH:mm:ss') + ': '+tmp.message;
              hook.result = tmp;
            } catch(error) {
              // Seems to be no JSON, use the result as plain text
              hook.result = Buffer.concat(data).toString();
            }
            resolve(hook);
          }
        });
      }).on('error', err => {
        console.log(`An error occurred when calling the hook URL ${hook.url}: `, err.message);
        console.log(JSON.stringify(err));
        hook.result = err.message;
        reject(hook);
      });
          
    } else {
      const http = require('http');
      var urlTmp = new URL(hook.url);

      var options = {
        host: urlTmp.hostname,
        path: urlTmp.pathname + urlTmp.search + urlTmp.hash
      };
      
      callback = function(response) {
        var str = '';
        //another chunk of data has been received, so append it to `str`
        response.on('data', function (chunk) {
          str += chunk;
        });
        //the whole response has been received, so we just print it out here
        response.on('end', function () {
          hook.result = str;
          resolve(hook);
        });
      }
      
      http.request(options, callback).end();
    }
  });
}

function linearizeHooks(hooks, task, delay, internalId) {
  var linearizedHooks = [];
  for(var i = 0; i < hooks.length; i++) {
    if(!hooks[i].hasOwnProperty('task') || ( hooks[i].task == task || task == null ) ) {
      var hookTmp = {
        internalId: internalId,
        description: hooks[i].description,
        url: hooks[i].url
      };
      internalId++;
      if(hooks[i].hasOwnProperty('delay')) {
        hookTmp.delay = parseInt(delay) + parseInt(hooks[i].delay);
      } else {
        hookTmp.delay = delay;
      }
      linearizedHooks.push(hookTmp);
      // Check for child hooks.
      if(hooks[i].hasOwnProperty('followedBy')) {
        // There are child hooks.
        linearizedHooks = linearizedHooks.concat(linearizeHooks(hooks[i].followedBy, task, hookTmp.delay, internalId++));
      }
    }
  }
  return linearizedHooks;
}

var lastHookResults = { start: null, results: [], finished: false, linearizedHooks: [] };

function triggerHooks(task) {
  return new Promise((resolve, reject) => {
    lastHookResults = {
      start: moment().format("YYYY.MM.DD hh:mm:ss"),
      results: [],
      finished: false
    };
    var pathToHooks = './config/hooks.json';
    if(!fs.existsSync(pathToHooks)) {
      console.log('No hooks defined.');
      return;
    }
    var hooks = fs.readFileSync(pathToHooks, 'utf-8');
    hooks = JSON.parse(hooks);

    linearizedHooks = linearizeHooks(hooks, task, 0, 0);
    lastHookResults.linearizedHooks = linearizedHooks;

    Promise.allSettled(linearizedHooks.map(hook => {
      return new Promise((resolveHook, rejectHook) => {
        setTimeout(() => {
          callHookUrl(hook)
            .then((hookResult) => { resolveHook(hookResult)})
            .catch((hookRejectionReason) => { rejectHook(hookRejectionReason)});
        }, hook.delay * 1000);
      });
    })).then(data => {
      for(var i = 0; i < data.length; i++) {
        lastHookResults.results.push(data[i].value);
      }
      lastHookResults.finished = true;
    });
    resolve("Hooks started");
  });
}

function getHooksResults() {
  return new Promise((resolve, reject) => {
    resolve(lastHookResults);
  });
}

function getHooks() {
  return new Promise((resolve, reject) => {
    var pathToHooks = './config/hooks.json';
    if(!fs.existsSync(pathToHooks)) {
      console.log('No hooks defined.');
      return;
    }
    var hooks = fs.readFileSync(pathToHooks, 'utf-8');
    hooks = JSON.parse(hooks);
    linearizedHooks = linearizeHooks(hooks, null, 0, 0);
    resolve(linearizedHooks);
  });
}

console.log(`Cron job pattern: ${config.get('cronJob.pattern')}`);
var job = new CronJob(
	config.get('cronJob.pattern'), 
	function() {
		console.log('Gather all data');
    storeAllGroupsData()
    .then(storeAllContactPersons)
    .then(value => {
      console.log(`Job completed. Updated the groups' and contact persons' data.`)
    }, reason => {
      console.error(`Job ended with error. See below.`)
      console.error(reason);
    })
    .then(triggerHooks('cron'));
	},
	null,
	true,
	'Europe/Berlin'
);

module.exports = router;