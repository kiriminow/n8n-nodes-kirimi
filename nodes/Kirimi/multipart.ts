export interface MultipartFile {
	buffer: Buffer;
	fileName: string;
	mimeType?: string;
}

export interface MultipartBody {
	body: Buffer;
	contentType: string;
}

/**
 * Serialize text fields plus one `file` part into a multipart/form-data payload using the global
 * FormData and Blob (Node 18+), without any runtime dependency.
 *
 * n8n's request helper only understands the `form-data` package's FormData, so the global one is
 * serialized to a Buffer here and sent with an explicit Content-Type header that carries the boundary.
 * Empty values are skipped.
 */
export async function buildMultipartBody(
	fields: Record<string, string | undefined>,
	file: MultipartFile,
): Promise<MultipartBody> {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === '') continue;
		form.append(key, value);
	}
	form.append(
		'file',
		new Blob([new Uint8Array(file.buffer)], { type: file.mimeType || 'application/octet-stream' }),
		file.fileName,
	);

	const response = new Response(form);
	const contentType = response.headers.get('content-type');
	if (!contentType) throw new Error('Could not determine the multipart Content-Type');
	return { body: Buffer.from(await response.arrayBuffer()), contentType };
}
