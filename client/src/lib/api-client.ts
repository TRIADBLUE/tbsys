const API_BASE = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  options?: {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
  },
): Promise<T> {
  let url = `${API_BASE}${path}`;

  // Append query params
  if (options?.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message || data.error || "Request failed",
      data.details,
    );
  }

  return data as T;
}

export const apiClient = {
  get: <T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ) => request<T>("GET", path, { params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>("POST", path, { body }),

  put: <T>(path: string, body?: unknown) =>
    request<T>("PUT", path, { body }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, { body }),

  delete: <T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ) => request<T>("DELETE", path, { params }),
};

export { ApiError };
