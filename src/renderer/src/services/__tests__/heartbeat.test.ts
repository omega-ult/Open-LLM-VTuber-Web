import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatManager } from '../heartbeat';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  // Helper to simulate receiving a message
  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

describe('HeartbeatManager', () => {
  let originalWebSocket: typeof WebSocket;
  let mockSockets: MockWebSocket[];

  beforeEach(() => {
    mockSockets = [];
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        mockSockets.push(this);
      }
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it('initializes in disconnected state', () => {
    const hb = new HeartbeatManager('ws://localhost:8080');
    expect(hb.getState()).toBe('disconnected');
  });

  it('transitions to connecting then connected on start', async () => {
    const hb = new HeartbeatManager('ws://localhost:8080');
    const stateChanges: string[] = [];
    hb.onStateChange = (state) => stateChanges.push(state);

    hb.start();
    expect(hb.getState()).toBe('connecting');

    // Allow microtask for mock WebSocket to open
    await vi.advanceTimersByTimeAsync(10);
    expect(hb.getState()).toBe('connected');
    expect(stateChanges).toContain('connecting');
    expect(stateChanges).toContain('connected');
  });

  it('sends heartbeat message after connection', async () => {
    const hb = new HeartbeatManager('ws://localhost:8080');
    hb.start();
    await vi.advanceTimersByTimeAsync(10);

    // First heartbeat interval
    await vi.advanceTimersByTimeAsync(5000);

    expect(mockSockets.length).toBeGreaterThan(0);
    const sent = mockSockets[0].sent;
    expect(sent.some(s => JSON.parse(s).type === 'heartbeat')).toBe(true);
  });

  it('reconnects after connection failure', async () => {
    const onReconnect = vi.fn();
    const onStateChange = vi.fn();
    const hb = new HeartbeatManager('ws://localhost:8080', { onReconnect, onStateChange });
    hb.start();
    await vi.advanceTimersByTimeAsync(10); // Wait for WS open
    expect(hb.getState()).toBe('connected');

    // Simulate disconnect by triggering onclose on the internal ws
    const ws = mockSockets[0];
    ws.readyState = MockWebSocket.CLOSED;
    ws.onclose!(new CloseEvent('close'));

    await vi.advanceTimersByTimeAsync(1);
    console.log('states:', onStateChange.mock.calls);
    expect(hb.getState()).toBe('reconnecting');

    // Advance through backoff
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockSockets.length).toBe(2);

    // Second socket opens
    await vi.advanceTimersByTimeAsync(10);
    expect(hb.getState()).toBe('connected');
  });

  it('uses exponential backoff for reconnection', async () => {
    const hb = new HeartbeatManager('ws://localhost:8080');
    hb.start();
    await vi.advanceTimersByTimeAsync(10);

    // First disconnect
    mockSockets[0].close();
    await vi.advanceTimersByTimeAsync(1000); // First backoff: 1s
    expect(mockSockets.length).toBe(2);

    // Second disconnect
    mockSockets[1].close();
    await vi.advanceTimersByTimeAsync(1000); // Still in 2s backoff
    expect(mockSockets.length).toBe(2); // Not yet

    await vi.advanceTimersByTimeAsync(1500); // Now at 2.5s total
    expect(mockSockets.length).toBe(3);
  });

  it('stops heartbeat and closes socket on stop()', async () => {
    const hb = new HeartbeatManager('ws://localhost:8080');
    hb.start();
    await vi.advanceTimersByTimeAsync(10);

    hb.stop();
    expect(hb.getState()).toBe('disconnected');
    expect(mockSockets[0].readyState).toBe(MockWebSocket.CLOSED);
  });

  it('tracks connection uptime', async () => {
    const hb = new HeartbeatManager('ws://localhost:8080');
    hb.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(hb.getState()).toBe('connected');

    await vi.advanceTimersByTimeAsync(10000);
    expect(hb.getUptimeMs()).toBeGreaterThanOrEqual(10000);
  });
});
