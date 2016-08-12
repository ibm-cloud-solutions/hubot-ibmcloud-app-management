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
const sprinkles = require('mocha-sprinkles');
const utils = require('hubot-ibmcloud-utils').utils;

// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
var i18n = new (require('i18n-2'))({
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

const validApp = 'testApp1';
const invalidApp = 'testApp4';

// Length of time to wait for a message
const timeout = 1000;

function waitForMessageQueue(room, len){
	return sprinkles.eventually({
		timeout: timeout
	}, function() {
		if (room.messages.length < len) {
			throw new Error('too soon');
		}
	}).then(() => false).catch(() => true).then((success) => {
		// Great.  Move on to tests
		expect(room.messages.length).to.eql(len);
	});
}

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Interacting with Bluemix via Slack', function() {

	let room;
	let cf;

	before(function() {
		mockUtils.setupMockery();
		// initialize cf, hubot-test-helper doesn't test Middleware
		cf = require('hubot-cf-convenience');
		return cf.promise.then();
	});

	beforeEach(function() {
		room = helper.createRoom();
		// Force all emits into a reply.
		room.robot.on('ibmcloud.formatter', function(event) {
			if (event.message) {
				event.response.reply(event.message);
			}
			else {
				event.response.send({attachments: event.attachments});
			}
		});
	});

	afterEach(function() {
		room.destroy();
	});

	context('user calls `list my apps`', function() {
		it('app list - should send a slack event with a list of apps', function(done) {
			return room.user.say('mimiron', '@hubot app list').then(() => {
				expect(room.messages.length).to.eql(3);
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.list.showing.apps', 'testSpace')]);
				let event = room.messages[room.messages.length - 1][1];
				expect(event.attachments.length).to.eql(4);
				expect(event.attachments[0].title).to.eql(`${validApp}Name`);
				expect(event.attachments[1].title).to.eql('testApp2Name');
				expect(event.attachments[2].title).to.eql('testApp4Name');
				expect(event.attachments[3].title).to.eql('testAppLongLogsName');
				done();
			});
		});
	});

	context('user calls `show my apps`', function() {
		it('app show - should send a slack event with a list of apps', function(done) {
			return room.user.say('mimiron', '@hubot app show').then(() => {
				expect(room.messages.length).to.eql(3);
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.list.showing.apps', 'testSpace')]);
				let event = room.messages[room.messages.length - 1][1];
				expect(event.attachments.length).to.eql(4);
				expect(event.attachments[0].title).to.eql(`${validApp}Name`);
				expect(event.attachments[1].title).to.eql('testApp2Name');
				expect(event.attachments[2].title).to.eql('testApp4Name');
				expect(event.attachments[3].title).to.eql('testAppLongLogsName');
				done();
			});
		});
	});

	context('user calls `app status` for invalid app', function() {
		it('should send in progress, then error, for invalid app', function(done) {
			return room.user.say('mimiron', `@hubot app status ${invalidApp}Name`).then(() => {
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					// Great.  Move on to tests
					expect(room.messages.length).to.eql(3);
					let response = room.messages[room.messages.length - 2];
					expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.status.in.progress', invalidApp + 'Name', 'testSpace')]);
					response = room.messages[room.messages.length - 1];
					let error = i18n.__('app.general.not.found', invalidApp + 'Name', 'testSpace');
					expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.status.failure', invalidApp + 'Name', error)]);
					done();
				});
			});
		});
	});

	context('user calls `app status` for stopped app', function() {
		it('should send in progress, then error, for invalid app', function(done) {
			return room.user.say('mimiron', '@hubot app status testApp3Name').then(() => {
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					// Great.  Move on to tests
					expect(room.messages.length).to.eql(3);
					let response = room.messages[room.messages.length - 2];
					expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.status.in.progress', 'testApp3Name', 'testSpace')]);
					response = room.messages[room.messages.length - 1];
					let error = i18n.__('app.general.not.found', 'testApp3Name', 'testSpace');
					expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.status.failure', 'testApp3Name', error)]);
					done();
				});
			});
		});
	});

	context('user calls `app status`', function() {
		it('should send a slack event with app status', function(done) {
			return room.user.say('mimiron', `@hubot app status ${validApp}Name`).then(() => {
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					expect(room.messages.length).to.eql(3);
					let response = room.messages[1];
					expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.status.in.progress', validApp + 'Name', 'testSpace')]);
					let event = room.messages[2][1];
					expect(event.attachments.length).to.eql(2);
					expect(event.attachments[0].title).to.eql(`Status of ${validApp}Name`);
					expect(event.attachments[1].title).to.eql('Instance #0');
					done();
				});
			});
		});
	});

	context('user calls `app state`', function() {
		it('should send a slack event with app status', function(done) {
			return room.user.say('mimiron', `@hubot app state ${validApp}Name`).then(() => {
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					expect(room.messages.length).to.eql(3);
					let response = room.messages[1];
					expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.status.in.progress', validApp + 'Name', 'testSpace')]);
					let event = room.messages[2][1];
					expect(event.attachments.length).to.eql(2);
					expect(event.attachments[0].title).to.eql(`Status of ${validApp}Name`);
					expect(event.attachments[1].title).to.eql('Instance #0');
					done();
				});
			});
		});
	});

	context('user calls `app start`', function() {
		beforeEach(function() {
			let messageLen = 5;

			// Don't move on from this until the promise resolves
			room.user.say('mimiron', `@hubot app start ${validApp}Name`);
			room.user.say('mimiron', `@hubot app start ${invalidApp}Name`);

			return sprinkles.eventually({
				timeout: timeout
			}, function() {
				if (room.messages.length < messageLen) {
					throw new Error('too soon');
				}
			}).then(() => false).catch(() => true).then((success) => {
				// Great.  Move on to tests
				expect(room.messages.length).to.eql(messageLen);
			});
		});

		it('should respond with started', function() {
			expect(room.messages[4]).to.eql(['hubot', '@mimiron ' + i18n.__('app.start.success', validApp + 'Name')]);
		});

		it('should respond with not found', function() {
			let error = i18n.__('app.general.not.found', invalidApp + 'Name', 'testSpace');
			expect(room.messages[3]).to.eql(['hubot', '@mimiron ' +
				i18n.__('app.start.failure', invalidApp + 'Name', error)
			]);
		});
	});

	context('user calls `app stop` with valid app', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app stop ${validApp}Name`).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.stop.prompt', validApp + 'Name')]);
				room.user.say('mimiron', 'yes');
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					expect(room.messages.length).to.eql(5);
					expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.stop.in.progress', validApp + 'Name', 'testSpace')]);
					expect(room.messages[4]).to.eql(['hubot', '@mimiron ' + i18n.__('app.stop.success', validApp + 'Name')]);
					done();
				});
			});
		});
	});

	context('user calls `app stop` with invalid app', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app stop ${invalidApp}Name`).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.stop.prompt', invalidApp + 'Name')]);
				room.user.say('mimiron', 'yes');
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					expect(room.messages.length).to.eql(5);
					let error = i18n.__('app.general.not.found', invalidApp + 'Name', 'testSpace');
					expect(room.messages[4]).to.eql(['hubot', '@mimiron ' + i18n.__('app.stop.failure', invalidApp + 'Name', error)]);
					done();
				});
			});
		});
	});

	context('user calls `app restart` with valid app', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app restart ${validApp}Name`).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.restart.prompt', validApp + 'Name')]);
				room.user.say('mimiron', 'yes');
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					expect(room.messages.length).to.eql(5);
					expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.restart.in.progress', validApp + 'Name', 'testSpace')]);
					expect(room.messages[4]).to.eql(['hubot', '@mimiron ' + i18n.__('app.restart.success', validApp + 'Name')]);
					done();
				});
			});
		});
	});

	context('user calls `app restart` with invalid app', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app restart ${invalidApp}Name`).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.restart.prompt', invalidApp + 'Name')]);
				room.user.say('mimiron', 'yes');
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					expect(room.messages.length).to.eql(5);
					let error = i18n.__('app.general.not.found', invalidApp + 'Name', 'testSpace');
					expect(room.messages[4]).to.eql(['hubot', '@mimiron ' + i18n.__('app.restart.failure', invalidApp + 'Name', error)]);
					done();
				});
			});
		});
	});

	context('user calls `app scale` with invalid app', function() {
		it('Should respond with not found.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${invalidApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages.length).to.eql(2);
				let error = i18n.__('app.general.not.found', invalidApp + 'Name', 'testSpace');
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.failure', invalidApp + 'Name', error)]);
				done();
			}).catch(function(error) {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify nothing', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.disk_quota', validApp + 'Name', 1024)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 8);
			}).then(() => {
				expect(room.messages[7]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.failure', validApp + 'Name', i18n.__('app.scale.abort'))]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify instances', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.instances')]);
				room.user.say('mimiron', '@hubot 4');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 8);
			}).then(() => {
				expect(room.messages[7]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.disk_quota', validApp + 'Name', 1024)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 11);
			}).then(() => {
				expect(room.messages[9]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.in.progress', validApp + 'Name', 'testSpace')]);
				expect(room.messages[10]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.success.instances', validApp + 'Name', 4)]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify memory', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.memory')]);
				room.user.say('mimiron', '@hubot 1024');
				return waitForMessageQueue(room, 8);
			}).then(() => {
				expect(room.messages[7]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.disk_quota', validApp + 'Name', 1024)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 11);
			}).then(() => {
				expect(room.messages[9]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.in.progress', validApp + 'Name', 'testSpace')]);
				expect(room.messages[10]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.success.memory', validApp + 'Name', 1024)]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify disk', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.disk_quota', validApp + 'Name', 1024)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 8);
			}).then(() => {
				expect(room.messages[7]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.disk_quota')]);
				room.user.say('mimiron', '@hubot 2048');
				return waitForMessageQueue(room, 11);
			}).then(() => {
				expect(room.messages[9]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.in.progress', validApp + 'Name', 'testSpace')]);
				expect(room.messages[10]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.success.disk', validApp + 'Name', 2048)]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify instances/memory', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.instances')]);
				room.user.say('mimiron', '@hubot 4');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 8);
			}).then(() => {
				expect(room.messages[7]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.memory')]);
				room.user.say('mimiron', '@hubot 1024');
				return waitForMessageQueue(room, 10);
			}).then(() => {
				expect(room.messages[9]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.disk_quota', validApp + 'Name', 1024)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 13);
			}).then(() => {
				expect(room.messages[11]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.in.progress', validApp + 'Name', 'testSpace')]);
				expect(room.messages[12]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.success.instances.memory', validApp + 'Name', 4, 1024)]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify instances/disk', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.instances')]);
				room.user.say('mimiron', '@hubot 4');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 8);
			}).then(() => {
				expect(room.messages[7]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.disk_quota', validApp + 'Name', 1024)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 10);
			}).then(() => {
				expect(room.messages[9]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.disk_quota')]);
				room.user.say('mimiron', '@hubot 2048');
				return waitForMessageQueue(room, 13);
			}).then(() => {
				expect(room.messages[11]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.in.progress', validApp + 'Name', 'testSpace')]);
				expect(room.messages[12]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.success.instances.disk', validApp + 'Name', 4, 2048)]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify memory/disk', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.memory')]);
				room.user.say('mimiron', '@hubot 1024');
				return waitForMessageQueue(room, 8);
			}).then(() => {
				expect(room.messages[7]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.disk_quota', validApp + 'Name', 1024)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 10);
			}).then(() => {
				expect(room.messages[9]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.disk_quota')]);
				room.user.say('mimiron', '@hubot 2048');
				return waitForMessageQueue(room, 13);
			}).then(() => {
				expect(room.messages[11]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.in.progress', validApp + 'Name', 'testSpace')]);
				expect(room.messages[12]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.success.memory.disk', validApp + 'Name', 1024, 2048)]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify instances/memory/disk', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.instances')]);
				room.user.say('mimiron', '@hubot 4');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 8);
			}).then(() => {
				expect(room.messages[7]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.memory')]);
				room.user.say('mimiron', '@hubot 1024');
				return waitForMessageQueue(room, 10);
			}).then(() => {
				expect(room.messages[9]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.disk_quota', validApp + 'Name', 1024)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 12);
			}).then(() => {
				expect(room.messages[11]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.disk_quota')]);
				room.user.say('mimiron', '@hubot 2048');
				return waitForMessageQueue(room, 15);
			}).then(() => {
				expect(room.messages[13]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.in.progress', validApp + 'Name', 'testSpace')]);
				expect(room.messages[14]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.success.instances.memory.disk', validApp + 'Name', 4, 1024, 2048)]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify junk', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.instances')]);
				room.user.say('mimiron', '@hubot junk');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 8);
			}).then(() => {
				expect(room.messages[7]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.memory')]);
				room.user.say('mimiron', '@hubot junk');
				return waitForMessageQueue(room, 10);
			}).then(() => {
				expect(room.messages[9]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.disk_quota', validApp + 'Name', 1024)]);
				room.user.say('mimiron', '@hubot yes');
				return waitForMessageQueue(room, 12);
			}).then(() => {
				expect(room.messages[11]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.value.disk_quota')]);
				room.user.say('mimiron', '@hubot junk');
				return waitForMessageQueue(room, 14);
			}).then(() => {
				expect(room.messages[13]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.failure', validApp + 'Name', i18n.__('app.scale.abort'))]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app; specify exit', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name`).then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.instances', validApp + 'Name', 2)]);
				room.user.say('mimiron', '@hubot no');
				return waitForMessageQueue(room, 4);
			}).then(() => {
				expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.prompt.set.memory', validApp + 'Name', 512)]);
				room.user.say('mimiron', '@hubot exit');
				return waitForMessageQueue(room, 6);
			}).then(() => {
				expect(room.messages[5]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.failure', validApp + 'Name', i18n.__('app.scale.abort'))]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app scale` with valid app, instances/memory/disk', function() {
		it('Should process command without conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app scale ${validApp}Name 4 instances 1024 memory 2048 disk`).then(() => {
				return waitForMessageQueue(room, 3);
			}).then(() => {
				expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.in.progress', validApp + 'Name', 'testSpace')]);
				expect(room.messages[2]).to.eql(['hubot', '@mimiron ' + i18n.__('app.scale.success.instances.memory.disk', validApp + 'Name', 4, 1024, 2048)]);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('user calls `app restage` with valid app', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app restage ${validApp}Name`).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.restage.prompt', validApp + 'Name')]);
				room.user.say('mimiron', 'yes');
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					expect(room.messages.length).to.eql(5);
					expect(room.messages[3]).to.eql(['hubot', '@mimiron ' + i18n.__('app.restage.in.progress', validApp + 'Name', 'testSpace')]);
					expect(room.messages[4]).to.eql(['hubot', '@mimiron ' + i18n.__('app.restage.success', validApp + 'Name')]);
					done();
				});
			});
		});
	});

	context('user calls `app restage` with invalid app', function() {
		it('Should have a clean conversation.', function(done) {
			return room.user.say('mimiron', `@hubot app restage ${invalidApp}Name`).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.restage.prompt', invalidApp + 'Name')]);
				room.user.say('mimiron', 'yes');
				return sprinkles.eventually({
					timeout: timeout
				}, function() {
					if (room.messages.length < 4) {
						throw new Error('too soon');
					}
				}).then(() => false).catch(() => true).then((success) => {
					expect(room.messages.length).to.eql(5);
					let error = i18n.__('app.general.not.found', invalidApp + 'Name', 'testSpace');
					expect(room.messages[4]).to.eql(['hubot', '@mimiron ' + i18n.__('app.restage.failure', invalidApp + 'Name', error)]);
					done();
				});
			});
		});
	});

	context('user calls `app logs` for invalid app', function() {
		beforeEach(function() {
			return room.user.say('mimiron', `@hubot app logs ${invalidApp}Name`);
		});

		it('should respond with not found', function() {
			expect(room.messages.length).to.eql(3);
			expect(room.messages[room.messages.length - 2]).to.eql(['hubot',
				'@mimiron ' + i18n.__('app.logs.inspecting', 'testApp4Name', 'testSpace')
			]);
			expect(room.messages[room.messages.length - 1]).to.eql(['hubot',
				'@mimiron ' + i18n.__('app.logs.not.found', 'testApp4Name')
			]);
		});
	});

	context('user calls `app logs` for a valid app which short logs', function() {
		beforeEach(function() {
			return room.user.say('mimiron', `@hubot app logs ${validApp}Name`);
		});

		it('should respond with app logs', function(done) {
			expect(room.messages.length).to.eql(3);
			expect(room.messages[1]).to.eql(['hubot',
				'@mimiron ' + i18n.__('app.logs.inspecting', 'testApp1Name', 'testSpace')
			]);
			expect(room.messages[2]).to.eql(['hubot', '@mimiron Log entry 1']);
			done();
		});
	});
	context.skip('user calls `app logs` for a valid app with long logs', function() {
		beforeEach(function() {
			utils.SLACK_MSG_LIMIT = 10;
			return room.user.say('mimiron', '@hubot app logs testAppLongLogsName');
		});

		it('should respond with app logs', function(done) {
			expect(room.messages.length).to.eql(3);
			expect(room.messages[1]).to.eql(['hubot',
				'@mimiron ' + i18n.__('app.logs.inspecting', 'testAppLongLogsName', 'testSpace')
			]);
			done();
		});
	});

	context('user calls `app remove`', function() {
		beforeEach(function() {
			// Don't move on from this until the promise resolves
			room.user.say('mimiron', `@hubot app remove ${validApp}Name`);
			return room.user.say('mimiron', `@hubot app remove ${invalidApp}Name`);
		});

		it('should respond with check', function() {
			expect(room.messages.length).to.eql(4);
			expect(room.messages[2]).to.eql(['hubot', '@mimiron ' + i18n.__('app.remove.prompt', validApp + 'Name')]);
			return room.user.say('mimiron', 'yes');
		});
	});

	context('user calls `app help`', function() {
		beforeEach(function() {
			return room.user.say('mimiron', '@hubot app help');
		});

		it('should respond with the help', function() {
			expect(room.messages.length).to.eql(2);
			expect(room.messages[1][1]).to.be.a('string');
		});
	});

	context('user calls `apps help`', function() {
		beforeEach(function() {
			return room.user.say('mimiron', '@hubot apps help');
		});

		it('should respond with the help', function() {
			expect(room.messages.length).to.eql(2);
			expect(room.messages[1][1]).to.be.a('string');
			let help = 'hubot app delete|destroy|remove [app] - ' + i18n.__('help.app.delete') + '\n';
			help += 'hubot app list|show  - ' + i18n.__('help.app.list') + '\n';
			help += 'hubot app logs [app] - ' + i18n.__('help.app.logs') + '\n';
			help += 'hubot app restage [app] - ' + i18n.__('help.app.restage') + '\n';
			help += 'hubot app restart [app] - ' + i18n.__('help.app.restart') + '\n';
			help += 'hubot app scale [app]  - ' + i18n.__('help.app.scale') + '\n';
			help += 'hubot app start [app] - ' + i18n.__('help.app.start') + '\n';
			help += 'hubot app status [app] - ' + i18n.__('help.app.status') + '\n';
			help += 'hubot app stop [app] - ' + i18n.__('help.app.stop') + '\n';
			expect(room.messages[1]).to.eql(['hubot', '@mimiron \n' + help]);
		});
	});

});
