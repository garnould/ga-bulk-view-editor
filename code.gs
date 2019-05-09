/**
* Apps Script Specific Navigation Logic
*/

function onInstall(e) {
  onOpen(e);
}

function onOpen(e) {
  SpreadsheetApp.getUi().createAddonMenu()
      .addItem('Launch Sidebar', 'showSidebar')
      .addSeparator()
      .addItem('Preferences', 'showPreferences')
      .addToUi();
}

function showSidebar() {
  var ui = HtmlService.createHtmlOutputFromFile('sidebar')
      .setTitle('GA Bulk View Editor');
  SpreadsheetApp.getUi().showSidebar(ui);
}

function showPreferences() {
  var ui = HtmlService.createHtmlOutputFromFile('preferences')
      .setTitle('GA Bulk View Editor - Preferences');
  SpreadsheetApp.getUi().showSidebar(ui);
}

/**
* Execute the application and save data to Google Analytics.
*/
function executeApp() {
  var sheet = getMainSheet();
  var data = getKeyedObjectFromRange(sheet.getDataRange());
  var ui = SpreadsheetApp.getUi();
  var accountList = getPreferences()['accountList'] ;
  var rejectedPatches = [ ] ;
  var msg = 'Your changes have been sent to Google Analytics' ;

  data.forEach(function(item){
    // Delete empty properties
    item = clean(item);

    // Generate a resource from the item, by cloning a duplicate with specified keys removed.
    var resource = except( item, [ 'Account ID',
                                   'Property ID',
                                   'Property Name',
                                   'View ID',
                                   'Goal 1',
                                   'Goal 2',
                                   'Goal 3',
                                   'Goal 4',
                                   'Goal 5',
                                   'Goal 6',
                                   'Goal 7',
                                   'Goal 8',
                                   'Goal 9',
                                   'Goal 10',
                                   'Goal 11',
                                   'Goal 12',
                                   'Goal 13',
                                   'Goal 14',
                                   'Goal 15',
                                   'Goal 16',
                                   'Goal 17',
                                   'Goal 18',
                                   'Goal 19',
                                   'Goal 20' ] );

    // Patch the data in the GA API.

    if ((accountList.length == 0) || (accountList.indexOf(item["Account ID"]) !== -1)) {

      updateViewSettings(item["Account ID"], item["Property ID"], item["View ID"], resource);

      // Retrieving goals to decide later if we have to create/update/deactivate

      var goalsContext = Array(20) ;
      var goals = getViewGoals(item["Account ID"], item["Property ID"], item["View ID"]);

      for (var i=0; i<goals.length; ++i) {
        goalsContext[goals[i].id-1] = goals[i] ;
      }

      // Handling new goals data

      [ 'Goal 1',
        'Goal 2',
        'Goal 3',
        'Goal 4',
        'Goal 5',
        'Goal 6',
        'Goal 7',
        'Goal 8',
        'Goal 9',
        'Goal 10',
        'Goal 11',
        'Goal 12',
        'Goal 13',
        'Goal 14',
        'Goal 15',
        'Goal 16',
        'Goal 17',
        'Goal 18',
        'Goal 19',
        'Goal 20' ].forEach(function(goalKey) {
          var goalId = goalKey.replace('Goal ', '') ;

          Logger.log("key = '%s', value = '%s'", goalKey, item[goalKey]);

          if ( (typeof(item[goalKey]) === 'undefined') || (/^\s*$/.exec(item[goalKey]) !== null) ) {

            if ((typeof(goalsContext[goalId-1]) !== 'undefined') && (goalsContext[goalId-1]['active'])) {

              // deactivating existing activated goal

              goalsContext[goalId-1]['active'] = false

              updateGoal(item["Account ID"], item["Property ID"], item["View ID"], goalId, goalsContext[goalId-1]);

            }

            Logger.log('goalId #' + goalId + " > empty") ;

          } else {

            var newGoal = normalizeGoal(item["Account ID"], item["Property ID"], item["View ID"], goalId, item[goalKey]) ;

            Logger.log(JSON.stringify(newGoal)) ;

            if (typeof(goalsContext[goalId-1]) !== 'undefined') {
              // There's an existing goal on the same slot

              updateGoal(item["Account ID"], item["Property ID"], item["View ID"], goalId, newGoal);

            } else {
              // There's no previously created goal on the same slot

              createGoal(item["Account ID"], item["Property ID"], item["View ID"], newGoal);

            }

          }

        }) ;

    } else {
      rejectedPatches.push(item["Account ID"]) ;
    }
  });

  rejectedPatches = rejectedPatches.filter(function onlyUnique(value, index, self) { return self.indexOf(value) === index; }) ;

  if (rejectedPatches.length > 0) {

    msg += "\n\n" ;
    msg += "WARNING : Changes targeting the following account(s) were rejected because account IDs were not declared in the Preferences account list : " + rejectedPatches.join(', ') ;

  }

  ui.alert('Success!', msg, ui.ButtonSet.OK);
}

/**
* Return a list of the accounts from the connected GA user.
*/
function getAccounts() {
  accountItems = Analytics.Management.Accounts.list().items;
  accountList = getPreferences()['accountList'] ;

  // Keeping only accounts declared in Preferences
  accountItems = accountItems.filter(function (value) { return (( accountList.length == 0 ) || (-1 !== accountList.indexOf(value.id))) } );

  return accountItems ;
}

/**
* Return a list of GA properties by accountID
*/
function getProperties(accountId) {
  return Analytics.Management.Webproperties.list(accountId).items;
}

/**
* Return a list of GA views by accountID and PropertyID
*/
function getViews(accountId, propertyId) {
  return Analytics.Management.Profiles.list(accountId, propertyId).items;
}

/**
* Return an account summary from GA.
*/
function getAccountSummary() {
  return Analytics.Management.AccountSummaries.list().items;
}

/**
* Update View Settings
*/
function updateViewSettings(accountId, propertyId, profileId, resource) {
  Analytics.Management.Profiles.patch(resource, accountId, propertyId, profileId);
}

/**
* Retrieve View Goals
*/

function getViewGoals(accountId, propertyId, profileId) {
  return Analytics.Management.Goals.list(accountId, propertyId, profileId).items ;
}

/**
* insert new goal
*/

function createGoal(accountId, propertyId, profileId, resource) {
  // ScriptError: Value must not be set for field account, web property, or profile Id.
  delete resource["accountId"] ;
  delete resource["profileId"] ;
  delete resource["webPropertyId"] ;

  return Analytics.Management.Goals.insert(resource, accountId, propertyId, profileId);
}

/**
* update new goal
*/

function updateGoal(accountId, propertyId, profileId, goalId, resource) {
  return Analytics.Management.Goals.update(resource, accountId, propertyId, profileId, goalId);
}

/**
* Output the views and the settings for the selected account.
*/
function printViewList(accountId, sheet) {
  var properties = getProperties(accountId);
  var viewPropertyNames = [ 'name',
                            'websiteUrl',
                            'timezone',
                            'botFilteringEnabled',
                            'currency',
                            'defaultPage',
                            'excludeQueryParameters',
                            'eCommerceTracking',
                            'enhancedECommerceTracking',
                            'siteSearchCategoryParameters',
                            'siteSearchQueryParameters',
                            'stripSiteSearchCategoryParameters',
                            'stripSiteSearchQueryParameters'
                          ];
  var final = [];
  var k, j, i, property, views, row;

  // Build hierarchy of accounts, properties, and views
  if (properties) {
    // Loop through properties
    for (i = 0; i < properties.length; i++) {
      property = properties[i];
      views = getViews(accountId, property.id);
      if (views) {
        // Loop through properties
        for (j = 0; j < views.length; j++) {

          // Check if we have edit access to this view.
          // If we don't continue to the next view, we require edit access to do anything.
          if (views[j].permissions.effective.indexOf('EDIT') == -1) {
            continue;
          }

          // Build up a new row.
          row = [
            accountId,
            property.id,
            property.name,
            views[j].id];

          viewPropertyNames.forEach(function(item){
            var value = views[j][item];
            value = value === undefined ? '' : value;
            row.push(value);
          });

          // handling goals

          var goals = getViewGoals(accountId, property.id, views[j].id);
          var goalValues = Array(20) ;

          for (k=0; k<goals.length; ++k) {
            goalValues[goals[k].id-1] = JSON.stringify(goals[k]) ;
          }

          // Faking goals
          for (k=0; k<20; ++k) {
            row.push(typeof(goalValues[k]) === 'undefined' ? '' : goalValues[k]) ;
          }

          // Push to output array
          final.push(row);
        }
      }
    }

    /**
    * Create the main sheet and nuke any existing data.
    */
    var headers = ['Account ID', 'Property ID', 'Property Name', 'View ID'];
    headers = headers.concat(viewPropertyNames);

    var goalsHeaders = [ 'Goal 1',
                         'Goal 2',
                         'Goal 3',
                         'Goal 4',
                         'Goal 5',
                         'Goal 6',
                         'Goal 7',
                         'Goal 8',
                         'Goal 9',
                         'Goal 10',
                         'Goal 11',
                         'Goal 12',
                         'Goal 13',
                         'Goal 14',
                         'Goal 15',
                         'Goal 16',
                         'Goal 17',
                         'Goal 18',
                         'Goal 19',
                         'Goal 20'
      ] ;
    headers = headers.concat(goalsHeaders);

    var sheet = getMainSheet(headers, true);

    if (final.length > 0) {
      sheet.getRange(2, 1, final.length, headers.length).setNumberFormat('@').setValues(final);
    } else {
      var ui = SpreadsheetApp.getUi();
      ui.alert('No editable views', 'There are no editable views for this account', ui.ButtonSet.OK);
    }
  }
}
