import { ApiClientError } from './http-client';

/** Fetches an authenticated binary endpoint and triggers a browser download — plain `<a href>` can't attach the bearer token, so this does the fetch + Blob + object-URL dance instead. */
export async function downloadAuthenticated(url: string, accessToken: string, filename: string): Promise<void> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = await response.json();
      message = payload?.error?.message ?? message;
    } catch {
      // Response wasn't JSON (e.g. the PDF/CSV stream itself) — keep the status text.
    }
    throw new ApiClientError(message, String(response.status), response.status);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
