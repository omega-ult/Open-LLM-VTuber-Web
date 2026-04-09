export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface HeartbeatOptions {
  heartbeatInterval?: number;
  initialBackoff?: number;
  maxBackoff?: number;
  onReconnect?: (attempt: number) => void;
  onStateChange?: (state: ConnectionState) => void;
}

export class HeartbeatManager {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff: number;
  private reconnectAttempts = 0;
  private connectedAt: number | null = null;

  private readonly url: string;
  private readonly heartbeatInterval: number;
  private readonly initialBackoff: number;
  private readonly maxBackoff: number;

  onReconnect?: (attempt: number) => void;
  onStateChange?: (state: ConnectionState) => void;

  constructor(url: string, options: HeartbeatOptions = {}) {
    this.url = url;
    this.heartbeatInterval = options.heartbeatInterval ?? 5000;
    this.initialBackoff = options.initialBackoff ?? 1000;
    this.maxBackoff = options.maxBackoff ?? 30000;
    this.backoff = this.initialBackoff;
    this.onReconnect = options.onReconnect;
    this.onStateChange = options.onStateChange;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getUptimeMs(): number {
    if (this.connectedAt === null || this.state === 'disconnected') return 0;
    return Date.now() - this.connectedAt;
  }

  start(): void {
    if (this.state !== 'disconnected') return;
    this.connect();
  }

  stop(): void {
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
    this.connectedAt = null;
    this.reconnectAttempts = 0;
    this.backoff = this.initialBackoff;
  }

  private connect(): void {
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.setState('connected');
      this.connectedAt = Date.now();
      this.reconnectAttempts = 0;
      this.backoff = this.initialBackoff;
      this.startHeartbeat();
    };

    this.ws.onclose = () => {
      this.clearTimers();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, handled there
    };
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
      }
    }, this.heartbeatInterval);
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    this.setState('reconnecting');
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, this.maxBackoff);

    this.reconnectTimer = setTimeout(() => {
      this.onReconnect?.(this.reconnectAttempts);
      this.connect();
    }, delay);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
}
