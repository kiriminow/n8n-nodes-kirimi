import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { KirimiApi } from '../credentials/KirimiApi.credentials';
import { Kirimi } from '../nodes/Kirimi/Kirimi.node';
import { buildMultipartBody } from '../nodes/Kirimi/multipart';
import { createContext } from './helpers.cjs';

const parse = async (body: Buffer, contentType: string) =>
	await new Response(body, { headers: { 'content-type': contentType } }).formData();

describe('buildMultipartBody', () => {
	it('serializes fields and the file part, skipping empty values', async () => {
		const { body, contentType } = await buildMultipartBody(
			{ user_code: 'U', secret: 'S', receiver: '62812', message: '', caption: undefined },
			{
				buffer: Buffer.from([1, 2, 3, 255]),
				fileName: 'a.bin',
				mimeType: 'application/octet-stream',
			},
		);
		assert.match(contentType, /^multipart\/form-data; boundary=/);
		const form = await parse(body, contentType);
		assert.equal(form.get('user_code'), 'U');
		assert.equal(form.get('receiver'), '62812');
		assert.equal(form.has('message'), false);
		assert.equal(form.has('caption'), false);
		const file = form.get('file') as File;
		assert.equal(file.name, 'a.bin');
		assert.deepEqual(Buffer.from(await file.arrayBuffer()), Buffer.from([1, 2, 3, 255]));
	});
});

describe('Kirimi node: send message file', () => {
	it('sends multipart with the documented field names, credentials and clientMsgId', async () => {
		const ctx = createContext({
			executionId: 'exec-5',
			items: [
				{ json: {}, binary: { data: { fileName: 'receipt.pdf', mimeType: 'application/pdf' } } },
			],
			binaryBuffer: Buffer.from('%PDF-fake'),
			params: {
				resource: 'message',
				operation: 'sendMessageFile',
				deviceId: { mode: 'list', value: 'D-1' },
				receiver: '62812',
				binaryPropertyName: 'data',
				fileNameOverride: '',
				messageFile: 'Your receipt',
				quotedMessageId: 'Q1',
				clientMsgId: '',
				autoClientMsgId: true,
			},
			respond: () => ({ success: true }),
		});
		const output = await new Kirimi().execute.call(ctx as never);

		const request = ctx.requests[0];
		assert.equal(
			request.kind,
			'plain',
			'multipart must not go through generic body authentication',
		);
		assert.equal(request.options.url, 'https://api.example.test/v1/send-message-file');
		assert.ok(Buffer.isBuffer(request.options.body));
		const contentType = request.options.headers?.['Content-Type'] as string;
		const form = await parse(request.options.body as Buffer, contentType);

		assert.equal(form.get('user_code'), 'USER1');
		assert.equal(form.get('secret'), 'SECRET1');
		assert.equal(form.get('device_id'), 'D-1');
		assert.equal(form.get('receiver'), '62812');
		assert.equal(form.get('message'), 'Your receipt');
		assert.equal(form.get('caption'), 'Your receipt');
		assert.equal(form.get('fileName'), 'receipt.pdf');
		assert.equal(form.get('quotedMessageId'), 'Q1');
		const clientMsgId = form.get('clientMsgId') as string;
		assert.match(clientMsgId, /^n8n-exec-5-[a-z0-9]+-0$/);
		const file = form.get('file') as File;
		assert.equal(file.name, 'receipt.pdf');
		assert.equal(file.type, 'application/pdf');
		assert.equal(await file.text(), '%PDF-fake');
		assert.equal(output[0][0].json.clientMsgId, clientMsgId);
	});
});

describe('credentials', () => {
	it('inject user_code and secret into the JSON body of every authenticated request', () => {
		const { authenticate } = new KirimiApi();
		assert.deepEqual((authenticate as { properties: unknown }).properties, {
			body: {
				user_code: '={{$credentials.userCode}}',
				secret: '={{$credentials.secret}}',
			},
		});
	});

	it('JSON calls use httpRequestWithAuthentication and no longer put secrets in the body', async () => {
		const ctx = createContext({
			params: { resource: 'user', operation: 'userInfo' },
			respond: () => ({ success: true }),
		});
		await new Kirimi().execute.call(ctx as never);
		assert.equal(ctx.requests[0].kind, 'auth');
		assert.deepEqual(ctx.requests[0].options.body, {});
	});
});
