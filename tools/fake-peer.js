//------------------------------------------------------------------------------
//  テスト用：PeerJS の代わり(tools/coop-test.html から使う)
//  本物のPeerJSと同じ形(new Peer・on・connect・send・close・destroy)で、
//  通信は親ページ(coop-test.html)が中継する。インターネットにはつながない
//------------------------------------------------------------------------------
(function(){
    var peers = {};
    function post(m){ m.fp = true; top.postMessage(m, "*"); }   //parent は common.js で上書きされているので top を使う

    function Emitter(){ this._h = {}; }
    Emitter.prototype.on = function(ev, fn){ (this._h[ev] = this._h[ev] || []).push(fn); return this; };
    Emitter.prototype._emit = function(ev, a){ (this._h[ev] || []).slice().forEach(function(f){ f(a); }); };

    function Conn(peer, remoteId, cid){
        Emitter.call(this);
        this.owner = peer; this.peer = remoteId; this.peerId = remoteId; this.cid = cid; this.open = false; this.closed = false;    //peer は本物と同じく相手のID
    }
    Conn.prototype = Object.create(Emitter.prototype);
    Conn.prototype.send = function(d){
        if(!this.open) return;
        post({ type:"data", to:this.peerId, cid:this.cid, d:JSON.parse(JSON.stringify(d)) });   //serialization:"json" と同じく文字列化できるものだけ届く
    };
    Conn.prototype.close = function(){
        if(this.closed) return;
        this.closed = true; this.open = false;
        post({ type:"close", to:this.peerId, cid:this.cid });
        this._emit("close");
    };

    function Peer(id){
        Emitter.call(this);
        if(typeof id != "string") id = "anon-" + Math.random().toString(36).slice(2);
        this.id = id; this.conns = {}; this.destroyed = false;
        peers[id] = this;
        setTimeout(function(){ post({ type:"register", id:id }); }, 10);
    }
    Peer.prototype = Object.create(Emitter.prototype);
    Peer.prototype.connect = function(rid){
        var cid = this.id + ">" + rid + ":" + Math.random();
        var c = new Conn(this, rid, cid);
        this.conns[cid] = c;
        post({ type:"connect", id:this.id, to:rid, cid:cid });
        return c;
    };
    Peer.prototype.destroy = function(){
        if(this.destroyed) return;
        this.destroyed = true;
        for(var k in this.conns) this.conns[k].close();
        post({ type:"destroy", id:this.id });
        delete peers[this.id];
    };
    Peer.prototype.reconnect = function(){};

    function findConn(cid){
        for(var k in peers) if(peers[k].conns[cid]) return peers[k].conns[cid];
        return null;
    }
    window.addEventListener("message", function(ev){
        var m = ev.data;
        if(!m || !m.fp || !m.toFrame) return;
        var p = peers[m.peer];
        switch(m.type){
            case "open":  if(p) p._emit("open", m.peer); break;
            case "error": if(p) p._emit("error", { type:m.etype }); break;
            case "incoming":
                if(!p) return;
                var c = new Conn(p, m.from, m.cid);
                p.conns[m.cid] = c;
                p._emit("connection", c);
                setTimeout(function(){ c.open = true; c._emit("open"); }, 5);
                break;
            case "connopen":
                var c2 = findConn(m.cid);
                if(c2){ c2.open = true; c2._emit("open"); }
                break;
            case "data":
                var c3 = findConn(m.cid);
                if(c3 && c3.open) c3._emit("data", m.d);
                break;
            case "close":
                var c4 = findConn(m.cid);
                if(c4 && !c4.closed){ c4.closed = true; c4.open = false; c4._emit("close"); }
                break;
        }
    });
    window.Peer = Peer;
})();
