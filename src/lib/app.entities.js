/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

const cf = require('hubot-cf-convenience');
const nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;

const NAMESPACE = 'IBMcloudAppManagment';
const PARAM_APPNAME = 'appname';

let functionsRegistered = false;


function buildGlobalName(parameterName) {
	return NAMESPACE + '_' + parameterName;
}
function buildGlobalFuncName(parameterName) {
	return NAMESPACE + '_func' + parameterName;
}

function registerEntityFunctions() {
	if (!functionsRegistered) {
		nlcconfig.setGlobalEntityFunction(buildGlobalFuncName(PARAM_APPNAME), getAppNames);
		functionsRegistered = true;
	}
}

function getAppNames(robot, res, parameterName, parameters) {
	return new Promise(function(resolve, reject) {
		const spaceGuid = cf.activeSpace(robot, res).guid;
		cf.Spaces.getSummary(spaceGuid).then((result) => {
			let appNames = result.apps.map(function(app){
				return app.name;
			});
			nlcconfig.updateGlobalParameterValues(buildGlobalName(PARAM_APPNAME), appNames);
			resolve(appNames);
		}).catch(function(err) {
			reject(err);
		});
	});
}

module.exports.registerEntityFunctions = registerEntityFunctions;
module.exports.getAppNames = getAppNames;
