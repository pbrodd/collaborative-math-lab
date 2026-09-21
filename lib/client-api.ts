export async function api(path: string, body?: Record<string, unknown>, method = 'POST') {
  const response = await fetch(path, {
    method: body ? method : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The workspace could not connect. Please try again.');
  }
  if (!response.ok) throw new Error(data.error || 'That request could not be completed.');
  return data;
}
