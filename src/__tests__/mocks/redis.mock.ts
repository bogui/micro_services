import { EventEmitter } from 'events';

export class MockRedis extends EventEmitter {
  private readonly callbacks: Map<
    string,
    (err: Error | null, count: number) => void
  >;
  public channels: Set<string>;

  constructor() {
    super();
    this.callbacks = new Map();
    this.channels = new Set();
  }

  subscribe(
    channel: string,
    callback: (err: Error | null, count: number) => void,
  ): Promise<void> {
    this.channels.add(channel);
    this.callbacks.set(channel, callback);
    callback(null, this.channels.size);
    return Promise.resolve();
  }

  set = jest.fn().mockResolvedValue('OK');
  publish = jest.fn().mockResolvedValue(1);
  quit = jest.fn().mockResolvedValue('OK');

  // Helper method to simulate receiving a message
  simulateMessage(channel: string, message: string): void {
    if (this.channels.has(channel)) {
      this.emit('message', channel, message);
    }
  }
}
