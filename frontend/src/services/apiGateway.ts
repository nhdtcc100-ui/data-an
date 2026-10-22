const API_BASE_URL = '/api/v1';

export const apiGateway = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return res.json();
  },

  async post<T>(endpoint: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return res.json();
  }
};

export const dashboardService = {
  async executeQuery(dashboardId: string, queryPayload: any) {
    return apiGateway.post(`/dashboards/${dashboardId}/query`, queryPayload);
  },

  async generateShareLink(dashboardId: string, options: { password?: string; expiresAt?: string }) {
    return apiGateway.post(`/dashboards/${dashboardId}/share-link`, options);
  },

  async getPublicReport(publicToken: string, password?: string) {
    const headers: HeadersInit = {};
    if (password) headers['X-Report-Password'] = password;
    const res = await fetch(`${API_BASE_URL}/public/reports/${publicToken}`, { headers });
    if (!res.ok) throw new Error(`Public report fetch failed: ${res.status}`);
    return res.json();
  }
};
