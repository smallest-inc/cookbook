import axios from 'axios';
import env from '../utils/env';

type StartSessionParams = { callerName?: string; callerNumber?: string };

class SmallestService {
  baseUrl: string;
  apiKey: string;

  constructor() {
    this.baseUrl = env.SMALLEST_API_BASE_URL;
    this.apiKey = env.SMALLEST_API_KEY;
  }

  private getOutboundCallUrl() {
    const trimmed = this.baseUrl.replace(/\/$/, '');

    // Backward-compatible handling: if older host is configured, map it to Atoms API.
    if (trimmed.includes('api.smallest.ai') && !trimmed.includes('atoms-api.smallest.ai')) {
      return 'https://atoms-api.smallest.ai/api/v1/conversation/outbound';
    }

    if (trimmed.endsWith('/api/v1')) {
      return `${trimmed}/conversation/outbound`;
    }

    return `${trimmed}/api/v1/conversation/outbound`;
  }

  async startReceptionistSession(opts: StartSessionParams) {
    const phoneNumber = opts.callerNumber || env.SMALLEST_DEFAULT_PHONE_NUMBER;
    if (!phoneNumber) {
      const err = new Error('Missing caller number. Set SMALLEST_DEFAULT_PHONE_NUMBER in server/.env for one-click calling.');
      (err as any).status = 400;
      throw err;
    }

    const payload = {
      agentId: env.SMALLEST_RECEPTIONIST_AGENT_ID,
      phoneNumber,
      variables: {
        callerName: opts.callerName || 'Caller'
      },
    };

    const url = this.getOutboundCallUrl();
    try {
      const resp = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return resp.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const details = error?.response?.data;
      const message = `Smallest API request failed${status ? ` (${status})` : ''}`;
      const detailMessage =
        details?.message ||
        details?.error ||
        (Array.isArray(details?.errors) ? details.errors.join(', ') : undefined);
      const err = new Error(detailMessage || message);
      (err as any).status = status || 502;
      throw err;
    }
  }
}

export default new SmallestService();
