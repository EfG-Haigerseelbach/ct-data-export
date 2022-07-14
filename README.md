# ChurchTools-Data-Export

Export data via ChurchTools API

## Installation

### Download

1. Clone this repository `git clone https://github.com/EfG-Haigerseelbach/ct-data-export.git`.
2. Change to directory `ct-data-export`.
3. Run command `npm install`.
4. Change to directory `ct-data-export\config`.

### Configure

5. Copy `template.json` to `default.json`.
6. Edit `default.json` according to your needs. Refer to section **Configuration**.

## Configuration

All configuration settings are located at `config/default.json`. Initially this file *does not exist*. You need to copy `config/template.json` and adjust it according to your needs.

### ChurchTools API

| Parameter   | Data Type | Default | Possible Values | Explanation                                                                                                  |
|-------------|-----------|---------|-----------------|--------------------------------------------------------------------------------------------------------------|
| `url`       | string    | empty   | n/a             | This is the URL of your ChurchTools instance. If hosted, the pattern is `https://<church-name>.church.tools` |
| `username`  | string    | empty   | n/a             | Name of the user to authenticate against the ChurchTools API                                                 |
| `password`  | string    | empty   | n/a             | Password of this user                                                                                        |

### Storage Paths

| Parameter            | Data Type | Default                   | Possible Values | Explanation                                                                                   |
|----------------------|-----------|---------------------------|-----------------|-----------------------------------------------------------------------------------------------|
| `path`               | string    | absolute/or/relative/path | n/a             | Absolute or relative path where to store the exported data with or without ending slash (`/`) |
| `groupsData`         | string    | path/and/filename.csv     | n/a             | Filename for data of groups without file type extension (e.g. `.csv`)                         |
| `contactPersonsData` | string    | path/and/filename.csv     | n/a             | Filename for data of contact persons without file type extension (e.g. `.csv`)                |
| `appointmentData`    | string    | path/and/filename.csv     | n/a             | Filename for data of appointments without file type extension (e.g. `.csv`)                   |

### Calendar

Parameter `allowedCalendarIds` is an array of objects where are each object has the following semantics:

| Parameter | Data Type | Default | Possible Values | Explanation                                                                                     |
|-----------|-----------|---------|-----------------|-------------------------------------------------------------------------------------------------|
| `id`      | number    | n/a     | integer         | ID of the calendar given by ChurchTools                                                         |
| `name`    | string    | n/a     | n/a             | An descriptive text for the calendar ID o get a better readability of the config (not consumed) |

### Logging

| Parameter | Data Type | Default | Possible Values                 | Explanation                                                                              |
|-----------|-----------|---------|---------------------------------|------------------------------------------------------------------------------------------|
| `level`   | string    | `error` | `error`, `debug`, `info`, `off` | Refer to https://github.com/churchtools/churchtools-js-client/blob/master/src/logging.js |

### Cron Job

| Parameter | Data Type | Default          | Possible Values                 | Explanation                                                              |
|-----------|-----------|------------------|---------------------------------|--------------------------------------------------------------------------|
| `pattern` | string    | `00 00 23 * * *` | `error`, `debug`, `info`, `off` | Refer to chapter *Cron Syntax* at https://github.com/node-cron/node-cron |

### Admin Token

| Parameter    | Data Type | Default       | Possible Values | Explanation                         |
|--------------|-----------|---------------|-----------------|-------------------------------------|
| `adminToken` | string    | `toBeChanged` | n/a             | Token to access the admin dashboard |

## Usage

tbd