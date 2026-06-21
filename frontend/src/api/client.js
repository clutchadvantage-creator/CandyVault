const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const API_BASE_URL = configuredBaseUrl.replace(/\/$/, "");
export const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = "api_error", data = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch(path, options = {}) {
  const {
    signal,
    timeout = DEFAULT_TIMEOUT_MS,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);

  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  try {
    return await fetch(apiUrl(path), { ...fetchOptions, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new ApiError("candyserver took too long to respond.", {
        status: 408,
        code: "timeout",
      });
    }
    if (signal?.aborted) throw error;
    throw new ApiError("CandyVault could not reach candyserver.", {
      code: "network_error",
      data: error,
    });
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

async function request(path, options = {}) {
  const { body, headers, ...requestOptions } = options;
  const isFormData = body instanceof FormData;
  const requestHeaders = new Headers(headers);
  let requestBody = body;

  if (body !== undefined && !isFormData && typeof body !== "string") {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const response = await apiFetch(path, {
    ...requestOptions,
    headers: requestHeaders,
    body: requestBody,
  });
  const data = await parseResponse(response);

  if (!response.ok) {
    const detail = data && typeof data === "object" ? data.detail : null;
    const message = typeof detail === "string"
      ? detail
      : Array.isArray(detail) && detail[0]?.msg
        ? detail[0].msg
        : `candyserver returned ${response.status}.`;
    throw new ApiError(message, { status: response.status, data });
  }

  return data;
}

export const api = Object.freeze({
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
  upload: (path, formData, options) => request(path, { ...options, method: "POST", body: formData }),
});
