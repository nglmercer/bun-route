type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  redirect?: RequestRedirect;
};

export async function apiFetch<T = unknown>(
  url: string,
  opts: FetchOptions = {}
): Promise<{ status: number; statusText: string; headers: Headers; data: T }> {
  const { method = "GET", headers = {}, body, redirect } = opts;

  const fetchOpts: RequestInit = { method, headers: { ...headers }, redirect };
  if (body !== undefined) {
    fetchOpts.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!headers["Content-Type"]) {
      (fetchOpts.headers as Record<string, string>)["Content-Type"] =
        "application/json";
    }
  }

  const res = await fetch(url, fetchOpts);
  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = text as T;
  }
  return { status: res.status, statusText: res.statusText, headers: res.headers, data };
}

export async function apiFetchRaw(
  url: string,
  opts: FetchOptions = {}
): Promise<{ status: number; statusText: string; headers: Headers; body: string }> {
  const { method = "GET", headers = {}, body, redirect } = opts;
  const fetchOpts: RequestInit = { method, headers: { ...headers }, redirect };
  if (body !== undefined) {
    fetchOpts.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!headers["Content-Type"]) {
      (fetchOpts.headers as Record<string, string>)["Content-Type"] =
        "application/json";
    }
  }
  const res = await fetch(url, fetchOpts);
  const text = await res.text();
  return { status: res.status, statusText: res.statusText, headers: res.headers, body: text };
}
