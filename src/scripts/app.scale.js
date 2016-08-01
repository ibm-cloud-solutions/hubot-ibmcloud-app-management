// Description:
//	Listens for commands to initiate actions against Bluemix
//
// Configuration:
//	 HUBOT_BLUEMIX_API Bluemix API URL
//	 HUBOT_BLUEMIX_ORG Bluemix Organization
//	 HUBOT_BLUEMIX_SPACE Bluemix space
//	 HUBOT_BLUEMIX_USER Bluemix User ID
//	 HUBOT_BLUEMIX_PASSWORD Password for the Bluemix User
//
// Author:
//	clanzen
//
/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

var path = require('path');
var TAG = path.basename(__filename);

const cf = require('hubot-cf-convenience');
const activity = require('hubot-ibmcloud-activity-emitter');

// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
const i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

// Match patterns:
// app scale <name> <name>
// app scale <name> <num> instances
// app scale <name> to <num>
// app scale <name> to <num> instances
const SCALE = /app\sscale\s(\S+)(|\sto)\s(\d+)(|\sinstances)/i;

module.exports = (robot) => {

	// Natural Language match
	robot.on('bluemix.app.scale', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.app.scale - Natural Language match - res.message.text=${res.message.text}.`);
		if (parameters && parameters.appname) {
			if (parameters && parameters.instances) {
				processAppScale(robot, res, parameters.appname, parameters.instances);
			}
			else {
				robot.logger.error(`${TAG}: Error extracting instances from text [${res.message.text}].`);
				let message = i18n.__('cognitive.parse.problem.scale.instances');
				robot.emit('ibmcloud.formatter', { response: res, message: message});
			}
		}
		else {
			robot.logger.error(`${TAG}: Error extracting App Name from text [${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.scale');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
	});

	// RegEx match
	robot.respond(SCALE, {id: 'bluemix.app.scale'}, (res) => {
		robot.logger.debug(`${TAG}: bluemix.app.scale - RegEx match - res.message.text=${res.message.text}.`);
		processAppScale(robot, res, res.match[1], res.match[3]);
	});


	function processAppScale(robot, res, name, instances){
		let appGuid;

		const activeSpace = cf.activeSpace(robot, res);
		const numInstances = parseInt(instances, 10);
		const body = { instances: numInstances};

		robot.logger.info(`${TAG}: Scaling application ${name} to ${numInstances} instance(s) in space ${activeSpace.name}.`);
		robot.logger.info(`${TAG}: Asynch call using cf library to obtain app information for ${name} in space ${activeSpace.name}.`);
		cf.Apps.getApp(name, activeSpace.guid).then((result) => {
			if (!result) {
				robot.logger.error(`${TAG}: No application named ${name} was found in space ${activeSpace.name}.`);
				return Promise.reject(i18n.__('app.general.not.found', name, cf.activeSpace().name));
			}
			appGuid = result.metadata.guid;

			robot.logger.info(`${TAG}: Asynch call using cf library to scale app ${name} in space ${activeSpace.name}.`);
			let message = i18n.__('app.scale.in.progress', name, cf.activeSpace().name, numInstances);
			robot.emit('ibmcloud.formatter', { response: res, message: message});
			return cf.Apps.update(appGuid, body);
		}).then(() => {
			robot.logger.info(`${TAG}: Scaling of app ${name} in space ${activeSpace.name} was successful.`);
			let message = i18n.__('app.scale.success', name, numInstances);
			robot.emit('ibmcloud.formatter', { response: res, message: message});
			activity.emitBotActivity(robot, res, {
				activity_id: 'activity.app.scale',
				app_name: name,
				app_guid: appGuid,
				space_name: activeSpace.name,
				space_guid: activeSpace.guid
			});
		}, (response) => {
			robot.logger.error(`${TAG}: Scaling of app ${name} in space ${activeSpace.name} failed.`);
			robot.logger.error(response);
			let message = i18n.__('app.scale.failure', name, response);
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		});
	};
};
