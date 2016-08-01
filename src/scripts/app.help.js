// Description:
//	Listens for commands to initiate actions against Bluemix for apps
//
// Configuration:
//	 HUBOT_BLUEMIX_API Bluemix API URL
//	 HUBOT_BLUEMIX_ORG Bluemix Organization
//	 HUBOT_BLUEMIX_SPACE Bluemix space
//	 HUBOT_BLUEMIX_USER Bluemix User ID
//	 HUBOT_BLUEMIX_PASSWORD Password for the Bluemix User
//
// Commands:
//   hubot app(s) help - Show available commands in the app category.
//
// Author:
//	kholdaway
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

// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
var i18n = new (require('i18n-2'))({
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

const APP_HELP = /app+(|s)\s+help/i;

module.exports = (robot) => {
	// TODO: This comments out the cognitive registration for app management because the required
	// ENV variables must be optional.  We must work when we aren't configured for Watson Services and Cloudant.
	//
	// const nlcPath = path.resolve(__dirname, '..', 'nlc', 'NLC.json');
	// var NLCConfiguration = require('hubot-ibmcloud-cognitive-lib').nlcConfiguration;
	// var nlcConfiguration = new NLCConfiguration(robot);
	// nlcConfiguration.registerNLCConfig(nlcPath);

	// Natural Language match
	robot.on('bluemix.app.help', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match. res.message.text=${res.message.text}.`);
		processAppHelp(robot, res);
	});


	// RegEx match
	robot.respond(APP_HELP, {
		id: 'hubot.help'
	}, function(res) {
		robot.logger.debug(`${TAG}: RegEx match. res.message.text=${res.message.text}.`);
		processAppHelp(robot, res);
	});


	function processAppHelp(robot, res) {
		let help = `${robot.name} app delete|destroy|remove [app] - ` + i18n.__('help.app.delete') + '\n';
		help += `${robot.name} app list|show  - ` + i18n.__('help.app.list') + '\n';
		help += `${robot.name} app logs [app] - ` + i18n.__('help.app.logs') + '\n';
		help += `${robot.name} app restage [app] - ` + i18n.__('help.app.restage') + '\n';
		help += `${robot.name} app scale [app] [num]  - ` + i18n.__('help.app.scale') + '\n';
		help += `${robot.name} app start [app] - ` + i18n.__('help.app.start') + '\n';
		help += `${robot.name} app status [app] - ` + i18n.__('help.app.status') + '\n';
		help += `${robot.name} app stop [app] - ` + i18n.__('help.app.stop') + '\n';

		let message = '\n' + help;
		robot.emit('ibmcloud.formatter', { response: res, message: message});
	};
};
