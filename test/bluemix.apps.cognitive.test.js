/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const expect = require('chai').expect;
const mockUtils = require('./mock.utils.cf.js');

const validApp = 'testApp1Name';
// const invalidApp = 'testApp4Name';

// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
const i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../src/messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Interacting with Natural Language -', function() {

	let room;
	let cf;

	before(function(done) {
		mockUtils.setupMockery();
		cf = require('hubot-cf-convenience');
		return cf.promise.then(function() {
			done();
		});
	});

	beforeEach(function() {
		room = helper.createRoom();
	});

	afterEach(function() {
		room.destroy();
	});

	context('app help - user says `I want help with apps` ', function() {
		it('should display help', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain('app delete');
				expect(event.message).to.contain('app list|show');
				expect(event.message).to.contain('app logs [app]');
				expect(event.message).to.contain('app restage [app]');
				expect(event.message).to.contain('app restart [app]');
				expect(event.message).to.contain('app scale [app]');
				expect(event.message).to.contain('app start [app]');
				expect(event.message).to.contain('app status [app]');
				expect(event.message).to.contain('app stop [app]');
				done();
			});

			let res = { message: {text: 'I want help with apps'}, response: room };
			room.robot.emit('bluemix.app.help', res, {});

		});
	});

	context('app list - user says `I want to list my apps`', function() {
		it('should list apps', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.attachments && event.attachments.length >= 4){

					expect(event.attachments.length).to.eql(4);
					expect(event.attachments[0].title).to.eql(`${validApp}`);
					expect(event.attachments[1].title).to.eql('testApp2Name');
					expect(event.attachments[2].title).to.eql('testApp4Name');
					expect(event.attachments[3].title).to.eql('testAppLongLogsName');
					done();
				}
			});

			let res = { message: {text: 'I want to list my apps'}, response: room };
			room.robot.emit('bluemix.app.list', res, {});

		});
	});

	context('app logs - user says `Show me the logs for app testApp1Name`', function() {
		it('should display logs for `testApp1Name` ', function(done) {
			// 2. Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('Checking on *testApp1Name* in the *testSpace* space.');
				done();
			});
			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'Show me the logs for app testApp1Name', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.logs', res, { appname: 'testApp1Name' });
		});

		it('should fail display logs due to missing appname parameter ', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('I\'m having problems understanding the name of your app. To display logs use *app logs [app]*');
				done();
			});
			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'Show me the logs', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.logs', res, {});
		});
	});


	context('app remove - user says `I want to remove app testApp1Name`', function() {
		it('should remove `testApp1Name`', function(done) {

			// 5. Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.message === 'Removing application *testApp1Name* from the *testSpace* space.') {
					expect(event.message).to.contain('Removing application *testApp1* from the *testSpace* space.');
				}
				else if (event.message === 'Application *testApp1Name* has been removed.'){
					expect(event.message).to.contain('Application *testApp1Name* has been removed.');
					done();
				}
			});

			// 2. Handle the dialog questions.
			let replyFn = function(msg){
				// 3. Sends a message to the room with the response to dialog requesting app name.
				if (msg === 'Are you sure that you want to remove *testApp1Name*?') {
					room.user.say('mimiron', 'yes');
				}
				else {
					done(Error('Unexpected dialog question: ' + msg));
				}

			};

			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to remove app testApp1Name', user: {id: 'mimiron'}}, response: room, reply: replyFn };
			room.robot.emit('bluemix.app.remove', res, { appname: 'testApp1Name' });
		});

		it('should fail remove app due to missing appname parameter ', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('I\'m having problems understanding the name of your app. To remove an app use *app remove [app]*');
				done();
			});
			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to remove app', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.remove', res, {});
		});
	});


	context('app restage - user says `I want to restage app testApp1Name`', function() {
		it('should restage `testApp01`', function(done) {

			// 4. Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('Restaging application *testApp1Name* in the *testSpace* space.');
				done();
			});

			// 2. Handle the dialog question.
			let replyFn = function(msg){
				if (msg === 'Are you sure that you want to restage *testApp1Name*?') {
					room.user.say('mimiron', 'yes');
				}
			};

			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to restage app testApp1Name', user: {id: 'mimiron'}}, response: room, reply: replyFn };
			room.robot.emit('bluemix.app.restage', res, { appname: 'testApp1Name' });

		});

		it('should fail restage app due to missing appname parameter ', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('I\'m having problems understanding the name of your app. To restage an app use *app restage [app]*');
				done();
			});
			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to restage app', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.restage', res, {});
		});
	});


	context('app scale - user says `I want to scale app testApp1Name`', function() {
		it('should scale `testApp1Name` when user says `I want to scale app testApp1Name.`', function(done) {

			// 2. Handle the dialog question.
			let replyFn = function(msg){
				if (msg.includes(i18n.__('app.scale.prompt.set.instances', 'testApp1Name', 2))) {
					room.user.say('mimiron', 'no');
				}
				else if (msg.includes(i18n.__('app.scale.prompt.set.memory', 'testApp1Name', 512))) {
					room.user.say('mimiron', 'no');
				}
				else if (msg.includes(i18n.__('app.scale.prompt.set.disk_quota', 'testApp1Name', 1024))) {
					room.user.say('mimiron', 'no');
				}
				else {
					done(new Error(`Unexpected dialog prompt [${msg}].`));
				}
			};

			// 4. Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.message === i18n.__('app.scale.failure', 'testApp1Name', i18n.__('app.scale.abort'))) {
					expect(event.message).to.contain(i18n.__('app.scale.failure', 'testApp1Name', i18n.__('app.scale.abort')));
					done();
				}
				else {
					done(new Error('Unexpected dialog message [${event.message}].'));
				}
			});

			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to scale app testApp1Name.', user: {id: 'mimiron'}}, response: room, reply: replyFn };
			room.robot.emit('bluemix.app.scale', res, { appname: 'testApp1Name' });

		});

		it('should fail scale app due to missing appname parameter ', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain(i18n.__('cognitive.parse.problem.scale'));
				done();
			});
			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to scale app', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.scale', res, {});
		});
	});


	context('app start - user says `I want to start app testApp1Name`', function() {
		it('should start `testApp01`', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain('Starting application *testApp1Name* in the *testSpace* space.');
				done();
			});

			let res = { message: {text: 'I want to start app testApp1Name'}, response: room };
			room.robot.emit('bluemix.app.start', res, { appname: 'testApp1Name' });
		});


		it('should fail to start `testApp4Name`', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain('Failed to start *testApp4Name*');
				done();
			});

			let res = { message: {text: 'I want to start app testApp4Name'}, response: room };
			room.robot.emit('bluemix.app.start', res, { appname: 'testApp4Name' });
		});

		it('should fail start app due to missing appname parameter ', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('I\'m having problems understanding the name of your app. To start an app use *app start [app]*');
				done();
			});
			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to start app', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.start', res, {});
		});
	});


	context('app status', function() {
		it('should display status `testApp1Name` when user says `What is the status of app testApp01?`', function(done) {

			// 4. Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.message === 'Getting status for *testApp1Name* in the *testSpace* space.') {
					expect(event.message).to.contain('Getting status for *testApp1Name* in the *testSpace* space.');
				}
				else if (event.attachments){
					expect(event.attachments.length).to.eql(2);
					expect(event.attachments[0].title).to.eql(`Status of ${validApp}`);
					expect(event.attachments[1].title).to.eql('Instance #0');
					done();
				}
			});

			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'What is the status of app testApp1Name?', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.status', res, { appname: 'testApp1Name' });

		});

		it('should fail display status due to missing appname parameter ', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('I\'m having problems understanding the name of your app. To display the status of an app use *app status [app]*');
				done();
			});
			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'What is the status of app', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.status', res, {});
		});
	});

	context('app stop', function() {
		it('should stop `testApp1Name` when user says `I want to stop app testApp1Name`', function(done) {

			// 4. Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('Stopping application *testApp1Name* in the *testSpace* space.');
				done();
			});

			// 2. Handle the dialog question.
			let replyFn = function(msg){
				// 3. Respond to open dialog.
				if (msg.indexOf('Are you sure that you want to stop') >= 0) {
					return room.user.say('mimiron', 'yes');
				}
			};

			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to stop app testApp1Name', user: {id: 'mimiron'}}, response: room, reply: replyFn };
			room.robot.emit('bluemix.app.stop', res, { appname: 'testApp1Name' });
		});

		it('should fail stop app due to missing appname parameter ', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('I\'m having problems understanding the name of your app. To stop an app use *app stop [app]*');
				done();
			});
			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to stop app', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.stop', res, {});
		});
	});

	context('app restart', function() {
		it('should restart `testApp1Name` when user says `I want to restart app testApp1Name`', function(done) {

			// 4. Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('Restarting application *testApp1Name* in the *testSpace* space.');
				done();
			});

			// 2. Handle the dialog question.
			let replyFn = function(msg){
				// 3. Respond to open dialog.
				if (msg.indexOf('Are you sure that you want to restart') >= 0) {
					return room.user.say('mimiron', 'yes');
				}
			};

			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to restart app testApp1Name', user: {id: 'mimiron'}}, response: room, reply: replyFn };
			room.robot.emit('bluemix.app.restart', res, { appname: 'testApp1Name' });
		});

		it('should fail restart app due to missing appname parameter ', function(done) {

			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.contain('I\'m having problems understanding the name of your app. To restart an app use *app restart [app]*');
				done();
			});
			// 1. Mock Natural Language message by calling emit.
			let res = { message: {text: 'I want to restart app', user: {id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.app.restart', res, {});
		});
	});

	context('verify entity functions', function() {

		it('should retrieve set of app names', function(done) {
			const entities = require('../src/lib/app.entities');
			let res = { message: {text: '', user: {id: 'mimiron'}}, response: room };
			entities.getAppNames(room.robot, res, 'appname', {}).then(function(appNames) {
				expect(appNames.length).to.eql(4);
				done();
			}).catch(function(error) {
				done(error);
			});
		});
	});
});
