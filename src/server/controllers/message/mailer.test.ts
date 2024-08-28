'use strict';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs';
import {Mailer} from './mailer';
import {Config} from '../../config/config';
let sendgrid = require('sendgrid')(Config.sendGrid.apikey);

describe.skip('Mailer Tests', function() {

    this.timeout(0);

    it('should successfully send an email', function(done) {
        let recipient = 'albert@ruingaming.io';
        let subject = 'test email from RUIn';
        let msg = 'test email from RUIn body';
        Mailer.SendMail(recipient, subject, msg, (err: Error, json: string) => {
            expect(err, 'should be no errors').to.equal(null);
            done();
        });
    });

    it('should successfully send an email template', function(done) {
        let recipient = 'albert@ruingaming.io';
        let subject = 'test email from RUIn';
        let msg = 'test email from RUIn body';

        let html = fs.readFileSync( path.join(__dirname, '../message/templates/massmail', 'test-email.html')).toString();
        Mailer.SendMail(recipient, subject, html, (err: Error, json: string) => {
            expect(err, 'should be no errors').to.equal(null);
            done();
        });
    });

    it.skip('should successfully send an onboarding email', function(done) {
        let recipient = 'albert@ruingaming.io';
        Mailer.SendMailTemplate(recipient, Config.sendGrid.templates.onboarding, (err: Error, json: string) => {
            expect(err, 'should be no errors').to.equal(null);
            done();
        });
    });
});