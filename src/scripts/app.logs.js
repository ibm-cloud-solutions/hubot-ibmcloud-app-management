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
//	@aeweidne
//  @nsandona
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

const dateformat = require('dateformat');
const len = require('string-length');
const Conversation = require('hubot-conversation');
const cf = require('hubot-cf-convenience');
const utils = require('hubot-ibmcloud-utils').utils;
const activity = require('hubot-ibmcloud-activity-emitter');
const entities = require('../lib/app.entities');

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

const LOGS = /(app\slogs)\s(.*)/i;

module.exports = (robot) => {

	// Register entity handling functions
	entities.registerEntityFunctions();

	var switchBoard = new Conversation(robot);

	// Natural Language match
	robot.on('bluemix.app.logs', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.app.logs - Natural Language match - res.message.text=${res.message.text}.`);
		if (parameters && parameters.appname) {
			processAppLogs(robot, res, parameters.appname);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting App Name from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.logs');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
	});

	// RegEx match
	robot.respond(LOGS, {id: 'bluemix.app.logs'}, function(res) {
		robot.logger.debug(`${TAG}: bluemix.app.logs - RegEx match - res.message.text=${res.message.text}.`);
		processAppLogs(robot, res, res.match[2]);
	});


	function processAppLogs(robot, res, name){
		let appGuid;
		const activeSpace = cf.activeSpace(robot, res);
		robot.logger.info(`${TAG}: Inspecting logs for app ${name} in space ${activeSpace.name}.`);

		let message = i18n.__('app.logs.inspecting', name, cf.activeSpace().name);
		robot.emit('ibmcloud.formatter', { response: res, message: message});

		robot.logger.info(`${TAG}: Asynch call using cf library to obtain app information for ${name} in space ${activeSpace.name}.`);
		cf.Apps.getApp(name, activeSpace.guid).then((result) => {
			if (!result) {
				robot.logger.error(`${TAG}: No application named ${name} was found in space ${activeSpace.name}.`);
				return Promise.reject(i18n.__('app.logs.not.found', name));
			}
			robot.logger.info(`${TAG}: App ${name} exists in space ${activeSpace.name}, making an asynch call using cf library to obtain app logs.`);
			appGuid = result.metadata.guid;
			return cf.Logs.getRecent(appGuid);
		}).then((result) => {
			let logOutput = result.reduce((logs, message) => logs + `${logs ? '\n' : ''}${dateformat(message.timestamp, 'dd mmm HH:MM:ss Z', true)} [${message.source_name}/${message.source_id}]\t${message.message_type === 1 ? 'OUT' : 'ERR'} ${message.message}`, '');
			if (logOutput === '') {
				let message = i18n.__('app.logs.no.recent', name);
				robot.emit('ibmcloud.formatter', { response: res, message: message});
				return;
			}

			activity.emitBotActivity(robot, res, {
				activity_id: 'activity.app.logs',
				app_name: name,
				app_guid: appGuid,
				space_name: activeSpace.name,
				space_guid: activeSpace.guid
			});

			let outputLen = len(logOutput);
			robot.logger.info(`${TAG}: Logs for app ${name} in space ${activeSpace.name} obtained - ${outputLen} lines.`);

			if (outputLen > utils.SLACK_MSG_LIMIT) {
				robot.logger.info('${TAG}: message above Slack limit of ${utils.SLACK_MSG_LIMIT} lines');
				let message = i18n.__('app.logs.too.long');
				robot.emit('ibmcloud.formatter', { response: res, message: message});
				let prompt = i18n.__('app.logs.too.long.prompt');
				utils.getExpectedResponse(res, robot, switchBoard, prompt, /(all of them)|(\d+)/i).then((dialogResult) => {
					if (dialogResult.match[1].startsWith('all')) {
						// page through all logs
						logOutput = logOutput.split('\n');
						let output = '';
						while (len(logOutput.toString()) > 0) {
							output += logOutput.shift() + '\n';

							if (len(output) >= utils.SLACK_MSG_LIMIT) {
								robot.emit('ibmcloud.formatter', { response: res, message: output});
								output = '';
							}
						}

						if (output !== '') {
							robot.emit('ibmcloud.formatter', { response: res, message: output});
						}

						let message = i18n.__('app.logs.too.long.done');
						robot.emit('ibmcloud.formatter', { response: res, message: message});
					}
					else {
						var count = parseInt(dialogResult, 10);
						let message = trim(logOutput, count);
						robot.emit('ibmcloud.formatter', { response: res, message: message});
					}
				});
			}
			else {
				robot.emit('ibmcloud.formatter', { response: res, message: logOutput});
				return;
			}
		}).catch((reason) => {
			robot.emit('ibmcloud.formatter', { response: res, message: reason});
			if (reason.stack) {
				robot.logger.error(`${TAG}: An error has occurred getting the application logs:`);
				robot.logger.error(reason.stack);
			}
		});
	};
};

const trim = (data, count) => {
	// break on new line so we dont return half a log message
	data = data.split('\n');

	return data.slice(data.length - count, data.length).join('\n');
};
