import { 
	IAuthenticateGeneric, 
	ICredentialTestRequest, 
	ICredentialType, 
	INodeProperties 
} from 'n8n-workflow';

export class KirimiApi implements ICredentialType {
	name = 'kirimiApi';
	displayName = 'Kirimi API';
	documentationUrl = 'https://kirimi.id/docs';
	properties: INodeProperties[] = [
		{
			displayName: 'User Code',
			name: 'userCode',
			type: 'string',
			required: true,
			default: '',
			description: 'Your Kirimi API user code',
		},
		{
			displayName: 'Secret',
			name: 'secret',
			type: 'string',
			required: true,
			typeOptions: { password: true },
			default: '',
			description: 'Your Kirimi API secret key',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://api.kirimi.id/v1',
			description: 'The base URL for the Kirimi API',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			body: {
				user_code: '={{$credentials.userCode}}',
				secret: '={{$credentials.secret}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/user-info',
			method: 'POST',
		},
	};
}