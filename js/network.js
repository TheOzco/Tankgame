// ==============================
// لایه شبکه (بر پایه PeerJS - WebRTC مستقیم بین دو مرورگر)
// نیازی به سرور اختصاصی نیست، فقط برای برقراری اتصال اولیه
// از سرور عمومی PeerJS استفاده می‌کنه
// ==============================

class Network {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.onMessage = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;
  }

  _randomCode() {
    // کد اتاق ۴ رقمی (۱۰۰۰ تا ۹۹۹۹)
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  hostGame(onId) {
    this.isHost = true;
    const tryCreate = () => {
      const code = this._randomCode();
      this.peer = new Peer('tankbattle-' + code);
      this.peer.on('open', () => onId(code));
      this.peer.on('connection', conn => {
        this.conn = conn;
        this._bind();
      });
      this.peer.on('error', err => {
        if (err.type === 'unavailable-id') {
          // این کد قبلاً اشغال شده، یه کد دیگه امتحان کن
          this.peer.destroy();
          tryCreate();
          return;
        }
        console.error('Peer error:', err);
        if (this.onError) this.onError(err);
      });
    };
    tryCreate();
  }

  joinGame(hostCode) {
    this.isHost = false;
    this.peer = new Peer();
    this.peer.on('open', () => {
      this.conn = this.peer.connect('tankbattle-' + hostCode, { reliable: true });
      this._bind();
    });
    this.peer.on('error', err => {
      console.error('Peer error:', err);
      if (this.onError) this.onError(err);
    });
  }

  _bind() {
    this.conn.on('open', () => { if (this.onConnected) this.onConnected(); });
    this.conn.on('data', data => { if (this.onMessage) this.onMessage(data); });
    this.conn.on('close', () => { if (this.onDisconnected) this.onDisconnected(); });
    this.conn.on('error', err => {
      console.error('Connection error:', err);
      if (this.onError) this.onError(err);
    });
  }

  send(msg) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  }
}
