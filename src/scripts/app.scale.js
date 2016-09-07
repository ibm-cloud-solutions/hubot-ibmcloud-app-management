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

const path = require('path');
const TAG = path.basename(__filename);

const cf = require('hubot-cf-convenience');
const utils = require('hubot-ibmcloud-utils').utils;
const Conversation = require('hubot-conversation');
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

// Match patterns:
// app scale <name>
const SCALE = /app\sscale\s+(\S+)(\sto)?(\s+([0-9]+)\sinstances)?(\s+([0-9]+)\smemory)?(\s+([0-9]+)\sdisk)?/i;

function getSuccessMessage(name, newScaleInfo) {
	let msg;
	if (newScaleInfo.instances) {
		if (newScaleInfo.memory) {
			if (newScaleInfo.disk_quota) {
				msg = i18n.__('app.scale.success.instances.memory.disk', name, newScaleInfo.instances, newScaleInfo.memory, newScaleInfo.disk_quota);
			}
			else {
				msg = i18n.__('app.scale.success.instances.memory', name, newScaleInfo.instances, newScaleInfo.memory);
			}
		}
		else {
			if (newScaleInfo.disk_quota) {
				msg = i18n.__('app.scale.success.instances.disk', name, newScaleInfo.instances, newScaleInfo.disk_quota);
			}
			else {
				msg = i18n.__('app.scale.success.instances', name, newScaleInfo.instances);
			}
		}
	}
	else {
		if (newScaleInfo.memory) {
			if (newScaleInfo.disk_quota) {
				msg = i18n.__('app.scale.success.memory.disk', name, newScaleInfo.memory, newScaleInfo.disk_quota);
			}
			else {
				msg = i18n.__('app.scale.success.memory', name, newScaleInfo.memory);
			}
		}
		else {
			if (newScaleInfo.disk_quota) {
				msg = i18n.__('app.scale.success.disk', name, newScaleInfo.disk_quota);
			}
		}
	}
	return msg;
}

module.exports = (robot) => {

	// Register entity handling functions
	entities.registerEntityFunctions();

	// for dialog
	const switchBoard = new Conversation(robot);

	// Natural Language match
	robot.on('bluemix.app.scale', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.app.scale - Natural Language match - res.message.text=${res.message.text}.`);
		if (parameters && parameters.appname) {
			processAppScale(robot, res, parameters.appname);
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
		processAppScale(robot, res, res.match[1], res.match[4], res.match[6], res.match[8]);
	});


	function processAppScale(robot, res, name, instances, memory, disk_quota){
		let appGuid;
		let scaleInfo;
		let reqScaleInfo = {};
		if (instances && !isNaN(instances)) reqScaleInfo.instances = parseInt(instances, 10);
		if (memory && !isNaN(memory)) reqScaleInfo.memory = parseInt(memory, 10);
		if (disk_quota && !isNaN(disk_quota)) reqScaleInfo.disk_quota = parseInt(disk_quota, 10);

		const activeSpace = cf.activeSpace(robot, res);

		robot.logger.info(`${TAG}: Scaling application ${name} in space ${activeSpace.name}.`);
		robot.logger.info(`${TAG}: Asynch call using cf library to obtain app information for ${name} in space ${activeSpace.name}.`);
		cf.Apps.getApp(name, activeSpace.guid).then((result) => {
			if (!result) {
				robot.logger.error(`${TAG}: No application named ${name} was found in space ${activeSpace.name}.`);
				return Promise.reject(i18n.__('app.general.not.found', name, cf.activeSpace().name));
			}
			appGuid = result.metadata.guid;

			let currentScaleInfo = {
				instances: result.entity.instances,
				memory: result.entity.memory,
				disk_quota: result.entity.disk_quota
			};
			return getScaleInformation(res, name, currentScaleInfo, reqScaleInfo);
		}).then((newScaleInfo) => {
			scaleInfo = newScaleInfo;
			if (newScaleInfo.instances || newScaleInfo.memory || newScaleInfo.disk_quota) {
				robot.logger.info(`${TAG}: Asynch call using cf library to scale app ${name} in space ${activeSpace.name}.`);
				let message = i18n.__('app.scale.in.progress', name, cf.activeSpace().name);
				robot.emit('ibmcloud.formatter', { response: res, message: message});
				return cf.Apps.update(appGuid, newScaleInfo);
			}
			else {
				robot.logger.error(`${TAG}: No scaling desired for application named ${name} in space ${activeSpace.name}.`);
				return Promise.reject(i18n.__('app.scale.abort'));
			}
		}).then(() => {
			robot.logger.info(`${TAG}: Scaling of app ${name} in space ${activeSpace.name} using ${JSON.stringify(scaleInfo)} was successful.`);
			let message = getSuccessMessage(name, scaleInfo);
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

	/**
	 * If the user specified any instances, memory, or disk values on the Regex command,
	 * then just return those.
	 * If no values were specified on the Regex command or the NLC path was used, then
	 * start a conversation with the user to obtain the information to pass on the scale
	 * request (instances, memory, disk).
	 * The user will be prompted for resource to determine if the user wants to
	 * alter that resource and what to alter it to.
	 * Returned Promise's resolve function is invoked with an object contain the
	 * instances, memory, and disk_quota fields.
	 *
	 * @param {object} res [The hubot response object]
	 * @param {string} name [The app name]
	 * @param {object} currentScaleInfo [An object with instances, memory, and disk_quota fields].
	 * @param {object} reqScaleInfo [An object with any instances, memory, or disk_quota values specified in Regex]
	 * @return {Promise} [Promise object]
	 */
	function getScaleInformation(res, name, currentScaleInfo, reqScaleInfo) {
		return new Promise(function(resolve, reject) {

			let newScaleInfo = {};

			// If any values specified on the request, use them
			if (reqScaleInfo.instances || reqScaleInfo.memory || reqScaleInfo.disk_quota) {
				resolve(reqScaleInfo);
			}

			// Otherwise, start conversations to obtain values
			else {

				getScaleValue(res, name, currentScaleInfo.instances, 'instances').then((newInstances) => {

					if (newInstances) newScaleInfo.instances = newInstances;
					return getScaleValue(res, name, currentScaleInfo.memory, 'memory');

				}).then((newMemory) => {

					if (newMemory) newScaleInfo.memory = newMemory;
					return getScaleValue(res, name, currentScaleInfo.disk_quota, 'disk_quota');

				}).then((newDisk) => {

					if (newDisk) newScaleInfo.disk_quota = newDisk;
					resolve(newScaleInfo);

				}).catch(() => {
					resolve({});
				});

			}

		});
	};

	/**
	 * Start a conversation with the user to determine if it is desired change the specified value
	 * associated with the given application.
	 * Returned Promise's resolve function is invoked with either the desired value
	 * (if specified) or undefined (if not specified).
	 *
	 * @param {object} res [The hubot response object]
	 * @param {string} name [The app name]
	 * @param {object} currentInstances The current number of instances.
	 * @param {string} promptKey The identifier for prompts for the value.
	 * @return {Promise} [Promise object]
	 */
	function getScaleValue(res, name, currentValue, promptKey) {
		return new Promise(function(resolve, reject) {

			// Start conversation and wait for response
			let prompt1 = i18n.__('app.scale.prompt.set.' + promptKey, name, currentValue);
			utils.getExpectedResponse(res, robot, switchBoard, prompt1, /(yes|no)/i).then((dialogResult) => {
				let reply = dialogResult.match[1].trim();
				robot.logger.debug(`${TAG}: Dialog reply is: ${reply}`);

				// If response is yes, start conversation to obtain the desired value
				if (reply === 'yes') {

					let prompt2 = i18n.__('app.scale.prompt.value.' + promptKey);
					utils.getExpectedResponse(res, robot, switchBoard, prompt2, /(.*)/i).then((dialogResult) => {
						let reply = dialogResult.match[1].trim();
						robot.logger.debug(`${TAG}: Dialog reply is: ${reply}`);

						// If the response is not a number, return undefined
						if (isNaN(reply)) {
							resolve();
						}

						// If the response is a number, retun the number value
						else {
							resolve(parseInt(reply, 10));
						}

					});

				}

				// If resonse is no, return undefined
				else {
					resolve();
				}

			// If response is exit, return undefined
			}).catch(function() {
				robot.logger.debug(`${TAG}: User is choosing to terminate the command.`);
				reject();
			});

		});
	};
};
