# ChurchTools-Data-Export

Export data via ChurchTools API

1. [Installation](#installation)  
1.1 [Download](#download)  
1.2 [Configure](#configure)  
2. [Configuration](#configuration)  
2.1 [ChurchTools Master Data](#churchtools-master-data)  
2.2 [ChurchTools API](#churchtools-api)  
2.3 [Storage Paths](#storage-paths)  
2.4 [Calendar](#calendar)  
2.5 [Logging](#logging)  
2.6 [Cron Job](#cron-job)  
2.7 [Admin Token](#admin-token)  
3. [Data Structure](#data-structure)  
4. [Usage](#usage)  

## Installation

### Download

1. Clone this repository `git clone https://github.com/EfG-Haigerseelbach/ct-data-export.git`.
2. Change to directory `ct-data-export`.
3. Run command `npm install`.
4. Change to directory `ct-data-export\config`.

### Configure

All configuration settings are located at `config/default.json`. Initially this file *does not exist*. You need to copy `config/template.json` and adjust it according to your needs.

1. Copy `template.json` to `default.json`.
2. Edit `default.json` according to your needs. Refer to section **Configuration**.

## Configuration

### ChurchTools Master Data

This application expects certain additional data fields to exist. Hence, the standard master data of ChurchTools needs to be extended:

1) Go to tab `Persons & Groups` and press `Master data`.
2) Click on `DB-Fields` and add the following new fields by pressing the plus-icon at the end of the table:

| Property                             | Expose                 | Category               | Target Groups             |
|--------------------------------------|------------------------|------------------------|---------------------------|
| DB-Field-Category                    | Group                  | Group                  | Group                     |
| DB-Field-Type                        | Yes-No field           | Multiple selection     | Multiple selection        |
| Table column                         | `website_expose`       | `website_category_ids` | `website_targetgroup_ids` |
| Database table                       | (empty)                | `cdb_groupcategory`    | `cdb_targetgroup`         |
| Appears when people are entered      | No                     | No                     | No                        |
| Description                          | Show in Website        | Website - Categories   | Website - Target Groups   |
| Short description                    | (on purpose)           | (on purpose)           | (on purpose)              |
| HTML-View end of line                | `<br/>`                | `<br/>`                | `<br/>`                   |
| Security level                       | *1                     | *1                     | *1                        |
| Length                               | 1                      | 255                    | 255                       |
| Sort Order                           | 90                     | 91                     | 92                        |
| Delete when user is moved to archive | No                     | No                     | No                        |
| Null value is allowed                | Yes                    | Yes                    | Yes                       |
| Hide in surface                      | No                     | No                     | No                        |

| Property                             | Age Category           | Recurrence Description           | Contact Person IDs           |
|--------------------------------------|------------------------|----------------------------------|------------------------------|
| DB-Field-Category                    | Group                  | Group                            | Group                        |
| DB-Field-Type                        | Text field             | Text field                       | Text field                   |
| Table column                         | `website_agecategory`  | `website_recurrence_description` | `website_contact_person_ids` |
| Database table                       | (empty)                | (empty)                          | (empty)                      |
| Appears when people are entered      | No                     | No                               | No                           |
| Description                          | Website - Age Category | Website - Recurrence Description | Website - Contact Person IDs |
| Short description                    | (on purpose)           | (on purpose)                     | (on purpose)                 |
| HTML-View end of line                | `<br/>`                | `<br/>`                          | `<br/>`                      |
| Security level                       | *1                     | *1                               | *1                           |
| Length                               | 255                    | 255                              | 255                          |
| Sort Order                           | 93                     | 94                               | 95                           |
| Delete when user is moved to archive | No                     | No                               | No                           |
| Null value is allowed                | Yes                    | Yes                              | Yes                          |
| Hide in surface                      | No                     | No                               | No                           |

*1) depending on who should be able to display and edit these fields an appropriate security level should be selected. If you don't have any clue use level 4 in the beginning.

### ChurchTools API

| Parameter   | Data Type | Default | Possible Values | Explanation                                                                                                  |
|-------------|-----------|---------|-----------------|--------------------------------------------------------------------------------------------------------------|
| `url`       | string    | empty   | n/a             | This is the URL of your ChurchTools instance. If hosted, the pattern is `https://<church-name>.church.tools` |
| `username`  | string    | empty   | n/a             | Name of the user to authenticate against the ChurchTools API                                                 |
| `password`  | string    | empty   | n/a             | Password of this user                                                                                        |

In addition to the configuration of the parameters above you need to ensure that the user (see `username`) has appropriate authorizations:

```text
...
|
+- Persons & Groups
|  |
|  +- view (dt. Personen & Gruppen sehen)  
|  +- security level person according to your needs
|  +- security level group according to your needs
|  ...
|  +- view grouptype according to your needs
|  ...
|  +- view tags (dt. Tags einsehen)
|  ...
|  +- administer groups (dt. Gruppen administrieren)
...
```

You can check the user's authorization in the ChurchTools webpage by going to *Persons & Groups* > *Persons* > the user in question > *Authorizations* > *Edit Authorizations*.

### Storage Paths

| Parameter            | Data Type | Default                     | Possible Values | Explanation                                                                    |
|----------------------|-----------|-----------------------------|-----------------|--------------------------------------------------------------------------------|
| `groupsData`         | string    | `path/and/filename.csv`     | n/a             | Filename for data of groups without file type extension (e.g. `.csv`)          |
| `contactPersonsData` | string    | `path/and/filename.csv`     | n/a             | Filename for data of contact persons without file type extension (e.g. `.csv`) |
| `appointmentData`    | string    | `path/and/filename.csv`     | n/a             | Filename for data of appointments without file type extension (e.g. `.csv`)    |

### Calendar

Parameter `allowedCalendarIds` is an array of objects where are each object has the following semantics:

| Parameter | Data Type | Default | Possible Values | Explanation                                                                                     |
|-----------|-----------|---------|-----------------|-------------------------------------------------------------------------------------------------|
| `id`      | number    | n/a     | integer         | ID of the calendar given by ChurchTools                                                         |
| `name`    | string    | n/a     | n/a             | An descriptive text for the calendar ID o get a better readability of the config (not consumed) |

### Logging

| Parameter | Data Type | Default | Possible Values                 | Explanation                                                                                |
|-----------|-----------|---------|---------------------------------|--------------------------------------------------------------------------------------------|
| `level`   | string    | `error` | `error`, `debug`, `info`, `off` | Refer to <https://github.com/churchtools/churchtools-js-client/blob/master/src/logging.js> |

### Cron Job

| Parameter | Data Type | Default          | Possible Values   | Explanation                                                                |
|-----------|-----------|------------------|-------------------|----------------------------------------------------------------------------|
| `pattern` | string    | `00 00 23 * * *` | n/a               | Refer to chapter *Cron Syntax* at <https://github.com/node-cron/node-cron> |

### Admin Token

| Parameter    | Data Type | Default       | Possible Values | Explanation                         |
|--------------|-----------|---------------|-----------------|-------------------------------------|
| `adminToken` | string    | `toBeChanged` | n/a             | Token to access the admin dashboard |

## Data Structure

The exported groups data has the following schema:

```
[
    {
        "id": integer,
        "name": string,
        "startDate": string,
        "endDate": string,
        "weekday": string,
        "note": string,
        "imageUrl": string,
        "export": boolean,
        "categories": [ { string } ],
        "targetGroups": [ { string } ],
        "ageCategory": string,
        "recurrenceDescription": string,
        "contactPersons": [ {
            id: number,
            firstName: string,
            lastName: string,
            email: string,
            imageUrl: string,
            phone: string
        } ]
    },
]
```

| Property              | Data Type       | Description                                    | API-path at /groups                        | Example                                                                      |
|-----------------------|-----------------|------------------------------------------------|--------------------------------------------|------------------------------------------------------------------------------|
| id                    | number          | group's ID                                     | information.id                             | 42                                                                           |
| name                  | string          | group's name                                   | information.name                           | "Biking"                                                                     |
| startDate             | string          | group's date of creation/ foundation           | information.dateOfFoundation               | "2020-10-27"                                                                 |
| endDate               | string          | group's date of completion                     | information.endDate                        | "2021-10-28"                                                                 |
| weekday               | string          | group's day of meeting                         | information.weekday                        | "Wednesday"                                                                  |
| note                  | string          | group's description                            | informtion.note                            | "Some description"                                                           |
| imageUrl              | string          | group's image                                  | API /files/groupimage/{groupid}            | "https://test.church.tools/?q=public/filedownload&id=1234&filename=abcd...." |
| categories            | array of string | custom field for group: categories for website | information.website_groupcategory_ids      | [ "small groups", "regular" ]                                                |
| targetGroups          | array of string | custom field for group: target groups          | information.website_target_group_ids       | [ "youth", "families" ]                                                      |
| ageCategory           | string          | custom field for group: age category           | information.website_agecategory            | "30-50"                                                                      |
| recurrenceDescription | string          | custom field for group: recurrence description | information.website_recurrence_description | "every two weeks"                                                            |
| contactPersons        | string          | custom field for group: separated person IDs   | information.website_contact_person_ids     | "17 49"                                                                      |

##### id

This is the group's ID given by ChurchTools backend. In the (JSON) export it is represented as number. In the (standard) API `/groups/{groupId}` it is exposed at path `information.id`. Example values are `42`, `17`, `35`.

##### name

This is the group's name given by the creator/ maintainer of the group. In the (JSON) export it is represented as string. In the (standard) API `/groups/{groupId}` it is exposed at path `information.name`. Example values are `"Biking"`, `"Youth"`, `"Young Adults"`.

##### startDate

This is the group's start date given by the creator/ maintainer of the group. In the (JSON) export it is represented as string. In the (standard) API `/groups/{groupId}` it is exposed at path `information.dateOfFoundation`. The value exposed by the ChurchTools API is of type string and has format `YYYY-MM-DD`. This format is kept. Example values are `"2020-10-27"`, `"2020-05-21"`, `"2020-01-01"`.

##### endDate

This is the group's date of completion given by the creator/ maintainer of the group. In the (JSON) export it is represented as string. In the (standard) API `/groups/{groupId}` it is exposed at path `information.endDate`. The value exposed by the ChurchTools API is of type string and has format `YYYY-MM-DD`. This format is kept. Example values are `"2021-12-31"`, `"2021-04-17"`, `"2021-06-06"`.

##### weekday

This is the group's day of meeting given by the creator/ maintainer of the group. In the (JSON) export it is represented as string. In the (standard) API `/groups/{groupId}` it is exposed at path `information.weekday`. The value exposed by the ChurchTools API is of type number and has value range `''`, `0` (=Sunday), `1` (= Monday), ..., `6` (= Saturday). This value is transformed into day names in English language plus and empty value. Example values are `""`, `"Wednesday"`, `"Friday"`.

##### note

This is the group's description given by the creator/ maintainer of the group. In the (JSON) export it is represented as string. In the (standard) API `/groups/{groupId}` it is exposed at path `information.note`. The string is UTF-8 encoded. Hence it can contain arbitrary characters, inc. emojis, line feeds and new lines. Example values are `"Some description"`, `"This is a test"`, `"Lorem ipsum"`.

##### imageUrl

This is the group's image given by the creator/ maintainer of the group. In the (JSON) export it is represented as URL in form of a string. To get the group image in high resolution in stead of (standard) API `/groups/{groupId}` the API `/files/groupimage/{groupid}` is used. Here, the URL at path `fileUrl` is used. An example values is `""https://test.church.tools/?q=public/filedownload&id=1234&filename=abcd...."`.

##### categories

This is a custom field which does *not* exist in standard. In ChurchTools backend's master data > DB-Fields it needs to be defined as follows:

| Name                                 | Value                                                                          |
|--------------------------------------|--------------------------------------------------------------------------------|
| DB-Field-Category                    | Group                                                                          |
| DB-Field-Type                        | Multiple selection                                                             |
| Table column                         | `website_category_ids`                                                         |
| Database table                       | `cdb_groupcategory`                                                            |
| Appears when people are entered      | No                                                                             |
| Description                          | Website - Categories                                                           |
| Short description                    | (on purpose)                                                                   |
| HTML-View end of line                | `<br/>`                                                                        |
| Security level                       | dependens, use level 4 in case only very selected people should see this field |
| Length                               | 255                                                                            |
| Sort Order                           | 90                                                                             |
| Delete when user is moved to archive | No                                                                             |
| Null value is allowed                | Yes                                                                            |
| Hide in surface                      | No                                                                             |

Since database table `cdb_groupcategory` is used the (standard) mechanism for group categories is reused (master data > group category). In a group's details screen this is visualized as group's categories given by the creator/ maintainer of the group. In the (standard) API `/groups/{groupId}` it is exposed at path `information.website_category_ids`. A JSON-object is used which contains the a property for each selected category. Example:

```JSON
"website_groupcategory_ids": {
    "8": true,
    "11": true
}
```

The properties' names are the corresponding group category IDs (master data > group category). These IDs are replaced for the data export. Therefore the master data of group categories are read via API `/person/masterdata`. In the response the data from property `groupCategories` is used the get the titles (master data > group category > title). In the export an array of string (the titles) is used. An example values is `[ "small groups", "regular" ]`.

##### targetGroups

This is a custom field which does *not* exist in standard. In ChurchTools backend's master data > DB-Fields it needs to be defined as follows:

| Name                                 | Value                                                                          |
|--------------------------------------|--------------------------------------------------------------------------------|
| DB-Field-Category                    | Group                                                                          |
| DB-Field-Type                        | Multiple selection                                                             |
| Table column                         | `website_targetgroup_ids`                                                      |
| Database table                       | `cdb_targetgroup`                                                              |
| Appears when people are entered      | No                                                                             |
| Description                          | Website - Target Groups                                                        |
| Short description                    | (on purpose)                                                                   |
| HTML-View end of line                | `<br/>`                                                                        |
| Security level                       | dependens, use level 4 in case only very selected people should see this field |
| Length                               | 255                                                                            |
| Sort Order                           | 91                                                                             |
| Delete when user is moved to archive | No                                                                             |
| Null value is allowed                | Yes                                                                            |
| Hide in surface                      | No                                                                             |

Since database table `cdb_targetgroup` is used the (standard) mechanism for target groups is reused (master data > target group). In a group's details screen this is visualized as group's target groups given by the creator/ maintainer of the group. In the (standard) API `/groups/{groupId}` it is exposed at path `information.website_targetgroup_ids`. A JSON-object is used which contains the a property for each selected category. Example:

```JSON
"website_targetgroup_ids": {
    "8": true,
    "10": true,
    "11": true
}
```

The properties' names are the corresponding target group IDs (master data > target group). These IDs are replaced for the data export. Therefore the master data of group categories are read via API `/person/masterdata`. In the response the data from property `targetGroups` is used the get the titles (master data > target group > title). In the export an array of string (the titles) is used. An example values is `[ "youth", "families" ]`.

##### ageCategory

This is a custom field which does *not* exist in standard. In ChurchTools backend's master data > DB-Fields it needs to be defined as follows:

| Name                                 | Value                                                                          |
|--------------------------------------|--------------------------------------------------------------------------------|
| DB-Field-Category                    | Group                                                                          |
| DB-Field-Type                        | Text field                                                                     |
| Table column                         | `website_agecategory`                                                          |
| Database table                       | (empty)                                                                        |
| Appears when people are entered      | No                                                                             |
| Description                          | Website - Age Category                                                         |
| Short description                    | (on purpose)                                                                   |
| HTML-View end of line                | `<br/>`                                                                        |
| Security level                       | dependens, use level 4 in case only very selected people should see this field |
| Length                               | 255                                                                            |
| Sort Order                           | 92                                                                             |
| Delete when user is moved to archive | No                                                                             |
| Null value is allowed                | Yes                                                                            |
| Hide in surface                      | No                                                                             |

There is no reference to another database table used. In a group's details screen this is visualized as group's age category groups given by the creator/ maintainer of the group. In the (standard) API `/groups/{groupId}` it is exposed at path `information.website_agecategory`. A JSON-string is used. Example:

```JSON
"website_agecategory": "30-50"
```

The value is kept for the data export.

##### recurrenceDescription

This is a custom field which does *not* exist in standard. In ChurchTools backend's master data > DB-Fields it needs to be defined as follows:

| Name                                 | Value                                                                          |
|--------------------------------------|--------------------------------------------------------------------------------|
| DB-Field-Category                    | Group                                                                          |
| DB-Field-Type                        | Text field                                                                     |
| Table column                         | `website_recurrence_description`                                               |
| Database table                       | (empty)                                                                        |
| Appears when people are entered      | No                                                                             |
| Description                          | Website - Recurrence Description                                               |
| Short description                    | (on purpose)                                                                   |
| HTML-View end of line                | `<br/>`                                                                        |
| Security level                       | dependens, use level 4 in case only very selected people should see this field |
| Length                               | 255                                                                            |
| Sort Order                           | 93                                                                             |
| Delete when user is moved to archive | No                                                                             |
| Null value is allowed                | Yes                                                                            |
| Hide in surface                      | No                                                                             |

There is no reference to another database table used. In a group's details screen this is visualized as group's recurrence description given by the creator/ maintainer of the group. In the (standard) API `/groups/{groupId}` it is exposed at path `information.website_recurrence_description`. A JSON-string is used. Example:

```JSON
"website_agecategory": "every two weeks"
```

The value is kept for the data export.

This is the group's name given by the creator/ maintainer of the group. In the (JSON) export it is represented as string. In the (standard) API `/groups/{groupId}` it is exposed at path `information.name`. Example values are `"Biking"`, `"Youth"`, `"Young Adults"`.

##### contactPersons

This is a custom field which does *not* exist in standard. In ChurchTools backend's master data > DB-Fields it needs to be defined as follows:

| Name                                 | Value                                                                          |
|--------------------------------------|--------------------------------------------------------------------------------|
| DB-Field-Category                    | Group                                                                          |
| DB-Field-Type                        | Text field                                                                     |
| Table column                         | `website_contact_person_ids`                                                   |
| Database table                       | (empty)                                                                        |
| Appears when people are entered      | No                                                                             |
| Description                          | Website - Contact Person IDs                                                   |
| Short description                    | (on purpose)                                                                   |
| HTML-View end of line                | `<br/>`                                                                        |
| Security level                       | dependens, use level 4 in case only very selected people should see this field |
| Length                               | 255                                                                            |
| Sort Order                           | 94                                                                             |
| Delete when user is moved to archive | No                                                                             |
| Null value is allowed                | Yes                                                                            |
| Hide in surface                      | No                                                                             |

There is no reference to another database table used. In a group's details screen this is visualized as group's contact person IDs given by the creator/ maintainer of the group. In the (standard) API `/groups/{groupId}` it is exposed at path `information.website_contact_person_ids`. A JSON-string is used. Example:

```JSON
"website_agecategory": "4 17,45;77"
```

The (person) IDs can be separated by a space, `,` or `;` char. The IDs are expanded by calling API `/persons/ids[]=${personId_1}&...&ids[]=${personId_N}*`. From the persons' data the `firstName`, `lastName`, `email`, `imageUrl` and `phone` are taken. As result the exported data for contact persons is as follows:

````JSON
"contactPersons": [
    {
        "id": 4,
        "firstName": "Lucky",
        "lastName": "Luke",
        "email": "lucky.luke@example.org",
        "imageUrl": "https://test.church.tools/images/123/abcd...",
        "phone": "0123456789"
    },
    {
        "id": 17,
        "firstName": "Jolly",
        "lastName": "Jumper",
        "email": "jolly.jumper@example.org",
        "imageUrl": "https://test.church.tools/images/456/ef01...",
        "phone": "0987654321"
    }
]
````

Please note that there are at maximum *two* persons exported. Although further IDs might be specified only the first two ones are contained in the export. All others are ignored. 

## Usage

to be done
