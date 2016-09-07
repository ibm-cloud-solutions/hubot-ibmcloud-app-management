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
//	nsandona
//	aeweidne
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
const palette = require('hubot-ibmcloud-utils').palette;
const utils = require('hubot-ibmcloud-utils').utils;
const nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;
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

const SHOW_APPS = /app (show|list)$/i;

module.exports = (robot) => {

	// Natural Language match
	robot.on('bluemix.app.list', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.app.list - Natural Language match - res.message.text=${res.message.text}.`);
		processAppList(res);
	});

	// RegEx match
	robot.respond(SHOW_APPS, {id: 'bluemix.app.list'}, function(res) {
		robot.logger.debug(`${TAG}: bluemix.app.list - RegEx match - res.message.text=${res.message.text}.`);
		processAppList(res);
	});


	function processAppList(res){
		const spaceGuid = cf.activeSpace(robot, res).guid;
		const spaceName = cf.activeSpace(robot, res).name;

		// Get a space summary, including status of the apps.
		robot.logger.info(`${TAG}: Asynch call using cf library to obtain space summary for ${spaceName} with guid ${spaceGuid}.`);
		cf.Spaces.getSummary(spaceGuid).then((result) => {
			let resultStr = '';
			if (result) {
				resultStr = JSON.stringify(result);
			}
			robot.logger.debug(`${TAG}: Obtained space summary for ${spaceName}: ${resultStr}.`);
			// Iterate the apps and create a suitable response.
			let apps = result.apps;

			const attachments = apps.map((app) => {
				const attachment = {
					title: app.name,
					color: palette[app.state.toLowerCase()] || palette.normal
				};
				attachment.fields = [
					{title: i18n.__('app.list.field.request.state'), value: app.state.toLowerCase(), short: true},
					{title: i18n.__('app.list.field.instances'), value: `${app.running_instances} / ${app.instances}`, short: true},
					{title: i18n.__('app.list.field.memory'), value: utils.bytesToSize(app.memory * 1024 * 1024), short: true},
					{title: i18n.__('app.list.field.disk'), value: utils.bytesToSize(app.disk_quota * 1024 * 1024), short: true},
					{title: i18n.__('app.list.field.urls'), value: app.urls.join(', ')}
				];
				// Only list bound services if any exist (to save real estate)
				if (app.service_names.length > 0) {
					attachment.fields.push({title: i18n.__('app.list.field.bound.services'), value: app.service_names.join(', ')});
				}
				return attachment;
			});

			// const appNames = [];
			let appNames = apps.map(function(app){
				return app.name;
			});
			nlcconfig.updateGlobalParameterValues('IBMcloudAppManagment_appname', appNames);

			if (attachments.length === 0) {
				robot.logger.info(`${TAG}: No applications to list.`);
				let message = i18n.__('app.list.no.apps', spaceName);
				robot.emit('ibmcloud.formatter', { response: res, message: message});
			}
			else {
				robot.logger.info(`${TAG}: Listing ${attachments.length} applications.`);
				let message = i18n.__('app.list.showing.apps', spaceName);
				robot.emit('ibmcloud.formatter', { response: res, message: message});
				// Emit the app status as an attachment
				robot.emit('ibmcloud.formatter', {
					response: res,
					attachments
				});
			}

			activity.emitBotActivity(robot, res, {
				activity_id: 'activity.app.list',
				space_name: spaceName,
				space_guid: spaceGuid
			});
		}).catch((reason) => {
			robot.logger.error(`${TAG}: An error has occurred listing applications.`);
			robot.logger.error(reason.stack);
			let message = i18n.__('app.list.error');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		});
	}
};
