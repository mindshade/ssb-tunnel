var Client = require('ssb-client')
var isFeed = require('ssb-ref').isFeed
var DuplexPair = require('pull-pair/duplex')

function DuplexError (message) {
  var err = new Error(message)
  return {
    source: function (abort, cb) {
      cb(err)
    },
    sink: function (read) {
      read(err, function () {})
    }
  }
}

function isObject (o) {
  return 'object' === typeof o
}

exports.name = 'tunnel'
exports.version = '1.0.0'

exports.manifest = {
  announce: 'sync',
  connect: 'duplex',
  ping: 'sync',
  list: 'sync'
}
exports.permissions = {
  anonymous: {allow: ['connect', 'announce', 'ping', 'list']}
}

exports.init = function (sbot, config) {
  var endpoints = {}
  var portal = config.tunnel && config.tunnel.portal

  var logging = config.tunnel && config.tunnel.logging

  function log(msg) {
    if(logging)
      console.error(msg)
  }

  function parse (string) {
    var opts
    if(isObject(string))
      opts = string
    else {
      var parts = string.split(':')
      if(parts[0] != 'tunnel') return
      opts = {
        name: parts[0],
        portal: parts[1],
        target: parts[2],
        port: +parts[3] || 0,
      }
    }

    if(!(
        opts.name === 'tunnel' &&
        isFeed(opts.portal) &&
        isFeed(opts.target) &&
        Number.isInteger(opts.port)
    )) return

    return opts
  }

  var handlers = {}

  sbot.multiserver.transport({
    name: 'tunnel',
    create: function (config, instance) {
      instance = instance || 0
      var portal
      return {
        name: 'tunnel',
        scope: function () { return config.scope || 'public' },
        server: function (onConnect, startedCb) {
          //just remember the reference, call it
          //when the tunnel api is called.

          let isclosing = false;

          log("tunnel: invoking multiserver callback");
          startedCb && startedCb(null, true);

          portal = config.portal
          setImmediate(function again () {
            //todo: put this inside the server creator?
            //it would at least allow the tests to be fully ordered
            var timer
            function reconnect () {
              if(sbot.closed || isclosing) return;
              clearTimeout(timer)
              timer = setTimeout(again, 1000*Math.random())
            }
            if (!isclosing && !sbot.closed) {
              log('tunnel:listen - connecting to portal:'+portal)
              sbot.gossip.connect(portal, function (err, rpc) {
                if(err) {
                  log('tunnel:listen - failed to connect to portal:'+portal+' '+err.message)
                  return reconnect()
                }
                rpc.tunnel.announce(null, function (err) {
                  if(err) {
                    log('tunnel:listen - error during announcement at '+portal+' '+err.message)

                    return reconnect()
                  }
                  //emit an event here?
                  log('tunnel:listen - SUCCESS establishing portal:'+portal)
                  sbot.emit('tunnel:listening', portal)
                })
                rpc.on('closed', function () {
                  log('tunnel:listen - portal closed:'+portal)
                  sbot.emit('tunnel:closed')
                  return reconnect()
                })
              })
            }
          })
          handlers[instance] = onConnect

          return function close(cb) {
            log('tunnel: closing, caused by server closing');
            isclosing = true;
            cb();
          }
        },
        client: function (addr, cb) {
          var opts = parse(addr)
          log('tunnel:connect - connect to portal:'+opts.portal)
          sbot.gossip.connect(opts.portal, function (err, rpc) {
            if(err) {
              log('tunnel:connect - failed connect to portal:'+opts.portal+' '+err.message)
              cb(err)
            }
            else {
              log('tunnel:connect - portal connected, tunnel to target:'+opts.target)
              cb(null, rpc.tunnel.connect({target: opts.target, port: opts.port}, function (err) {
                  if (err) {
                      log('tunnel:connect - failed to connect to target:' + opts.target + ' ' + (err.message ? err.message : err))
                      //how to handle this error?
                  }
              }))
            }
          })
        },
        parse: parse,
        stringify: function () {
          if(portal)
            return ['tunnel', portal, sbot.id, instance].join(':')
        }
      }
    }
  })

  return {
    announce: function (opts) {
      log('tunnel:portal - received endpoint announcement from:'+this.id)
      endpoints[this.id] = sbot.peers[this.id][0]
    },
    connect: function (opts, cb) {
      if(!opts) return DuplexError('opts *must* be provided')
      log('tunnel:portal - received tunnel request for target:'+opts.target)
      //if we are being asked to forward connections...
      //TODO: config to disable forwarding
      if(endpoints[opts.target]) {
        return endpoints[opts.target].tunnel.connect(opts)
      }
      //if this connection is for us
      else if(opts.target === sbot.id && handlers[opts.port]) {
        var streams = DuplexPair()
        handlers[opts.port](streams[0])
        return streams[1]
      }
      else
        return DuplexError('could not connect to:'+opts.target)
    },
    ping: function () {
      return Date.now()
    },
    list: function() {
      return [...Object.keys(endpoints)];
    }
  }
}



