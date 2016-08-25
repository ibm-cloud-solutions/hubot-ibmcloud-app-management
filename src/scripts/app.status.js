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
const palette = require('hubot-ibmcloud-utils').palette;
const utils = require('hubot-ibmcloud-utils').utils;
const activity = require('hubot-ibmcloud-activity-emitter');
const dateformat = require('dateformat');
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

const STATUS = /(app\s(state|status))\s(.*)/i;

module.exports = (robot) => {

	// Register entity handling functions
	entities.registerEntityFunctions();

	// Natural Language match
	robot.on('bluemix.app.status', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.app.status - Natural Language match - res.message.text=${res.message.text}.`);
		if (parameters && parameters.appname) {
			processAppStatus(robot, res, parameters.appname);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting App Name from text [${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.status');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
	});

	// RegEx match
	robot.respond(STATUS, {id: 'bluemix.app.status'}, (res) => {
		robot.logger.debug(`${TAG}: bluemix.app.status - RegEx match - res.message.text=${res.message.text}.`);
		processAppStatus(robot, res, res.match[3]);
	});


	function processAppStatus(robot, res, name){
		var appSummary = null;
		var appStats = null;
		var appInstances = null;
		let appGuid;

		const activeSpace = cf.activeSpace(robot, res);
		let message = i18n.__('app.status.in.progress', name, cf.activeSpace().name);
		robot.emit('ibmcloud.formatter', { response: res, message: message});

		robot.logger.info(`${TAG}: Checking the status of application ${name} in space ${activeSpace.name}`);
		robot.logger.info(`${TAG}: Asynch call using cf library to obtain app information for ${name} in space ${activeSpace.name}.`);
		cf.Apps.getApp(name, activeSpace.guid).then((result) => {
			if (!result) {
				robot.logger.error(`${TAG}: No application named ${name} was found in space ${activeSpace.name}.`);
				return Promise.reject(i18n.__('app.general.not.found', name, cf.activeSpace().name));
			}
			appGuid = result.metadata.guid;

			robot.logger.info(`${TAG}: Asynch call using cf library to obtain app summary for ${name} in space ${activeSpace.name}.`);
			return cf.Apps.getSummary(appGuid);
		}).then((result) => {
			appSummary = result;
			let appSummaryStr = '';
			if (appSummary) {
				appSummaryStr = JSON.stringify(appSummary);
			}
			robot.logger.info(`${TAG}: Obtain app summary for ${name}: ${appSummaryStr}.`);

			// only bother with stats if we have some running instances
			if (appSummary.running_instances > 0) {
				// Get the application stats.
				robot.logger.info(`${TAG}: Asynch call using cf library to obtain app stats for ${name} in space ${activeSpace.name}.`);
				cf.Apps.getStats(appGuid).then((result) => {
					appStats = result;
					robot.logger.info(`${TAG}: App stats were obtained for ${name} in space ${activeSpace.name}.`);

					// Get the application instances.
					robot.logger.info(`${TAG}: Asynch call using cf library to obtain app instances info for ${name} in space ${activeSpace.name}.`);
					cf.Apps.getInstances(appGuid).then((result) => {
						appInstances = result;
						robot.logger.info(`${TAG}: App instances info was obtained for ${name} in space ${activeSpace.name}.`);

						let urlOutput = 'N/A';
						// Printable list of the app URLs.
						if (appStats[0] && appStats[0].stats && appStats[0].stats.uris) {
							urlOutput = appStats['0'].stats.uris.join(', ');
						}

						const attachments = Object.keys(appStats).map((key, index, keys) => {
							// TODO: 'details' - not sure which API call has this data.
							const appStat = appStats[key];
							const appInstance = appInstances[key];

							let cpuOutput = 'N/A';
							let memoryOutput = 'N/A';
							let diskOutput = 'N/A';
							if (appStat.stats && appStat.stats.usage) {
								cpuOutput = (appStat.stats.usage.cpu * 100).toFixed(2);
								memoryOutput = utils.bytesToSize(appStat.stats.usage.mem);
								diskOutput = utils.bytesToSize(appStat.stats.usage.disk);
							}

							const attachment = {
								title: `Instance #${index}`,
								color: palette[appStat.state.toLowerCase()] || palette.normal,
								fields: [
									{title: 'state', value: appStat.state.toLowerCase(), short: true},
									{title: 'since', value: dateformat(1000 * appInstance.since, 'yyyy-mm-dd HH:MM:ss'), short: true},
									{title: 'cpu (%)', value: `${cpuOutput}`, short: true},
									{title: 'memory', value: `${memoryOutput} of ${utils.bytesToSize(appSummary.memory * 1024 * 1024)}`, short: true},
									{title: 'disk', value: `${diskOutput} of ${utils.bytesToSize(appSummary.disk_quota * 1024 * 1024)}`, short: true}
								]
							};
							return attachment;
						});
						attachments.unshift({
							title: `Status of ${name}`,
							color: palette[appSummary.state.toLowerCase()] || palette.normal,
							fields: [
								{title: 'requested state', value: appSummary.state.toLowerCase(), short: true},
								{title: 'instances', value: `${appSummary.running_instances} / ${appSummary.instances}`, short: true},
								{title: 'usage', value: `${appSummary.memory}M x ${appSummary.instances}`, short: true},
								{title: 'last updated', value: appSummary.package_updated_at, short: true},
								{title: 'urls', value: urlOutput}
							]
						});

						// Add the list of bound services if they exist.
						if (appSummary.services.length > 0) {
							var serviceList = '';
							for (var i = 0; i < appSummary.services.length; i++) {
								if (i !== 0) {
									serviceList += ', ';
								}
								serviceList += appSummary.services[i].name;
							}
							attachments[1].fields.push({title: 'bound services', value: serviceList});
						}

						// Emit the app status as an attachment
						robot.emit('ibmcloud.formatter', {
							response: res,
							attachments
						});

						activity.emitBotActivity(robot, res, {
							activity_id: 'activity.app.status',
							app_name: name,
							app_guid: appGuid,
							space_name: activeSpace.name,
							space_guid: activeSpace.guid
						});
					}, (response) => {
						robot.logger.error(`${TAG}: Getting instance status of app ${name} in space ${activeSpace.name} failed.`);
						robot.logger.error(response);
						let message = i18n.__('app.status.failure.instances', name, response);
						robot.emit('ibmcloud.formatter', { response: res, message: message});
					});
				}, (response) => {
					robot.logger.error(`${TAG}: Getting stats of app ${name} in space ${activeSpace.name} failed.`);
					robot.logger.error(response);
					let message = i18n.__('app.status.failure.stats', name, response);
					robot.emit('ibmcloud.formatter', { response: res, message: message});
				});
			}
			else {
				robot.logger.info(`${TAG}: No running instances of app ${name}.`);
				robot.emit('ibmcloud.formatter', { response: res, message: i18n.__('app.status.no.instances.running', name)});
				robot.emit('ibmcloud.formatter', { response: res, message: i18n.__('app.status.try.restage')});

				activity.emitBotActivity(robot, res, {
					activity_id: 'activity.app.status',
					app_name: name,
					app_guid: appGuid,
					space_name: activeSpace.name,
					space_guid: activeSpace.guid
				});
			}
		}, (response) => {
			robot.logger.error(`${TAG}: Getting status of app ${name} in space ${activeSpace.name} failed.`);
			robot.logger.error(response);
			let message = i18n.__('app.status.failure', name, response);
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		});
	};
};
