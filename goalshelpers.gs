function normalizeGoal(accountId, propertyId, profileId, goalId, jsonResource) {

  var obj = JSON.parse(jsonResource) ;

  delete obj["parentLink"] ;
  delete obj["created"] ;
  delete obj["updated"] ;
  delete obj["internalWebPropertyId"] ;
  delete obj["selfLink"] ;

  obj["accountId"] = accountId ;
  obj["webPropertyId"] = propertyId ;
  obj["profileId"] = profileId ;
  obj["id"] = goalId ;

  return obj ;
}
