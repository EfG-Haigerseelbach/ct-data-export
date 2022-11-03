# ChurchTools-Data-Export

Export data via ChurchTools API

## Installation

### Download

1. Clone this repository `git clone https://github.com/EfG-Haigerseelbach/ct-data-export.git`.
2. Change to directory `ct-data-export`.
3. Run command `npm install`.
4. Change to directory `ct-data-export\config`.

### Configure

1. Copy `template.json` to `default.json`.
2. Edit `default.json` according to your needs. Refer to section **Configuration**.

## Configuration

### ChurchTools Master Data

This application expects certain additional data fields to exist. Hence, the pre-delivered master data of ChurchTools need to be extended:

1) Go to tab `Persons & Groups` and press `Master data`.
2) Click on `DB-Fields` and add the following fields (by pressing the plus-icon at the end of the table):

### Data Export

All configuration settings are located at `config/default.json`. Initially this file *does not exist*. You need to copy `config/template.json` and adjust it according to your needs.

#### ChurchTools API

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

#### Storage Paths

| Parameter            | Data Type | Default                     | Possible Values | Explanation                                                                    |
|----------------------|-----------|-----------------------------|-----------------|--------------------------------------------------------------------------------|
| `groupsData`         | string    | `path/and/filename.csv`     | n/a             | Filename for data of groups without file type extension (e.g. `.csv`)          |
| `contactPersonsData` | string    | `path/and/filename.csv`     | n/a             | Filename for data of contact persons without file type extension (e.g. `.csv`) |
| `appointmentData`    | string    | `path/and/filename.csv`     | n/a             | Filename for data of appointments without file type extension (e.g. `.csv`)    |

#### Calendar

Parameter `allowedCalendarIds` is an array of objects where are each object has the following semantics:

| Parameter | Data Type | Default | Possible Values | Explanation                                                                                     |
|-----------|-----------|---------|-----------------|-------------------------------------------------------------------------------------------------|
| `id`      | number    | n/a     | integer         | ID of the calendar given by ChurchTools                                                         |
| `name`    | string    | n/a     | n/a             | An descriptive text for the calendar ID o get a better readability of the config (not consumed) |

#### Logging

| Parameter | Data Type | Default | Possible Values                 | Explanation                                                                                |
|-----------|-----------|---------|---------------------------------|--------------------------------------------------------------------------------------------|
| `level`   | string    | `error` | `error`, `debug`, `info`, `off` | Refer to <https://github.com/churchtools/churchtools-js-client/blob/master/src/logging.js> |

#### Cron Job

| Parameter | Data Type | Default          | Possible Values   | Explanation                                                                |
|-----------|-----------|------------------|-------------------|----------------------------------------------------------------------------|
| `pattern` | string    | `00 00 23 * * *` | n/a               | Refer to chapter *Cron Syntax* at <https://github.com/node-cron/node-cron> |

#### Admin Token

| Parameter    | Data Type | Default       | Possible Values | Explanation                         |
|--------------|-----------|---------------|-----------------|-------------------------------------|
| `adminToken` | string    | `toBeChanged` | n/a             | Token to access the admin dashboard |

#### Data Structure

The exported groups data has the following schema:

```
[
    {
        "id": integer | group's ID | information.id | example: 42,
        "name": string | group's name | information.name | example: "Biking",
        "startDate": string | group's date of creation/ foundation | information.dateOfFoundation | example: "2020-12-08",
        "endDate": string | group's date of completion | information.endDate | example: "2021-10-25",
        "weekday": string | group's day of meeting | information.weekday | example: "Wednesday",
        "note": string | group's description | information.note | example: "Some description",
        "imageUrl": string | group's groupimage, cf. API /files/groupimage/{groupid} | fileUrl | example: "https://test.church.tools/?q=public/filedownload&id=1234&filename=abcd....",
        "export": boolean | custom field for group: expose to website | information.website_expose | example: true,
        "categories": array of { number as string: boolean } objects | custom field for group: categories for website | information.website_groupcategory_ids | example: { "10" : true, "17": true },
        "targetGroups": array of strings | custom field for group: target groups | information.website_targetgroup_ids | example: [ "GroupA", "GroupB" ],
        "ageCategory": string | custom field for group: age category | information.website_agecategory | example: "30-50",
        "recurrenceDescription": string | custom field for group: recurrence description | infomation.website_recurrence_description | "every two weeks",
        "contactPersons": string | custom field for group: comma separated person IDs that are expanded with person details | information.website_recurrence_description | example: "4, 7, 17"
    },
]
```

## Usage

to be done
