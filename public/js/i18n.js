  const lngs = {
    en: { nativeName: 'English' },
    de: { nativeName: 'Deutsch' }
  };
  
  const rerender = () => {
    // start localizing, details:
    // https://github.com/i18next/jquery-i18next#usage-of-selector-function
    $('body').localize();
  }
  
  $(function () {
    // use plugins and options as needed, for options, detail see
    // https://www.i18next.com
    i18next
      // detect user language
      // learn more: https://github.com/i18next/i18next-browser-languageDetector
      .use(i18nextBrowserLanguageDetector)
      // init i18next
      // for all options read: https://www.i18next.com/overview/configuration-options
      .init({
        debug: true,
        fallbackLng: 'en',
        resources: {
            en: {
                translation: {
                    navbar: {
                        title: 'ChurchTools Data Export',
                        logout: 'Logout'
                    },
                    dashboard: 'Dashboard',
                    files: 'Files',
                    configuration: 'Configuration',
                    key: 'Key',
                    value: 'Value',
                    save: 'Save',
                    config: {
                        churchtools: {
                            url: 'ChurchTools URL',
                            username: 'ChurchTools API user',
                            password: 'ChurchTools API password'
                        },
                        storage: {
                            path: 'Path to store exported data',
                            groupsData: 'Filename for data of Groups (w/o extension)',
                            contactPersonsData: 'Filename for data of Persons (w/o extension)',
                            appointmentData: 'Filename for data of Appointments (w/o extension)',
                            csv: 'Output as CSV file (\'text/csv\')',
                            json: 'Output as JSON file (\'application/json\')'
                        },
                        calendar_ids: 'Calendar IDs',
                        tags: {
                            groupsToExport: 'Tag for Groups to Export',
                            personsToExport: 'Tag for Persons to Export'
                        },
                        logging: {
                            level: 'Log Level'
                        },
                        cronJob: 'Cron Job'
                    }
                }
              },
              de: {
                translation: {
                    navbar: {
                        title: 'ChurchTools Datenexport',
                        logout: 'Abmelden'
                    },
                    dashboard: 'Übersicht',
                    files: 'Dateien',
                    configuration: 'Konfiguration',
                    key: 'Schlüssel',
                    value: 'Wert',
                    save: 'Speichern',
                    config: {
                        churchtools: {
                            url: 'ChurchTools URL',
                            username: 'ChurchTools API Benutzer',
                            password: 'ChurchTools API Passwort'
                        },
                        storage: {
                            path: 'Speicherpfad für exportierte Daten',
                            groupsData: 'Dateiname für Gruppendaten (ohne Dateiendung)',
                            contactPersonsData: 'Dateiname für Personendaten (ohne Dateiendung)',
                            appointmentData: 'Dateiname für Termindaten (ohne Dateiendung)',
                            csv: 'Ausgabe als CSV-Datei (\'text/csv\')',
                            json: 'Ausgabe as JSON-Datei (\'application/json\')'
                        },
                        calendar_ids: 'Kalender IDs',
                        tags: {
                            groupsToExport: 'Tag für zu exportierende Gruppen',
                            personsToExport: 'Tag für zu exportierende Personen'
                        },
                        logging: {
                            level: 'Log Level'
                        },
                        cronJob: 'Cron Job'
                    }
                }
              }
        }
      }, (err, t) => {
        if (err) return console.error(err);
  
        // for options see
        // https://github.com/i18next/jquery-i18next#initialize-the-plugin
        jqueryI18next.init(i18next, $, { useOptionsAttr: true });
  
        // fill language switcher
        Object.keys(lngs).map((lng) => {
          const opt = new Option(lngs[lng].nativeName, lng);
          if (lng === i18next.resolvedLanguage) {
            opt.setAttribute("selected", "selected");
          }
          $('#languageSwitcher').append(opt);
        });
        $('#languageSwitcher').change((a, b, c) => {
          const chosenLng = $(this).find("option:selected").attr('value');
          i18next.changeLanguage(chosenLng, () => {
            rerender();
          });
        });
  
        rerender();
      });
  });