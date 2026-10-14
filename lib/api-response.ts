export async function workspaceResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (
    response.type === 'opaqueredirect' ||
    response.redirected ||
    response.status === 401 ||
    (response.status === 403 && !contentType.includes('application/json'))
  )
    throw Error(
      'Your sign-in may have expired. Open Account to sign in again, then retry. Your basket has been kept.',
    );
  if (!contentType.includes('application/json'))
    throw Error(
      `The server could not save your changes (HTTP ${response.status}). Your basket has been kept. Please retry; if this continues, open Account and sign in again.`,
    );
  const result = (await response.json()) as { error?: string };
  if (!response.ok)
    throw Error(result.error || 'Unable to save changes. Your basket has been kept.');
  return result;
}
