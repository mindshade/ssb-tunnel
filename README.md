
## ssb-tunnel

Indirectly connect to a peer by tunneling through another
connection. If A is connected to B, and C is connected to B,
this allows C to connect to A by using B as a proxy or "portal".

With this module, a peer `A` with an unstable IP address can
make a long term connection to a portal `P`, another peer `B` can then connect
to that portal, and tunnel back up the client connection `A->P`

```
,---,      ,---,     ,---,
|   |----->|   |<----|   |
| A |<=====|-B-|<====| C |
|   |----->|   |<----|   |
`---`      `---`     `---`
```
A connects to B, and waits to receive tunnel connections.
C connects to B, and then tunnels through that connection (B-C),
then through the first connection (A-B). Notice that for the tunnel,
A is the server and C is the client (client calls, server answers)
but B is just the portal. The tunnel is _inside_ the outer connections,
which means it is encrypted twice. This means A and C can mutually
authenticate each other, and B cannot see the content of their connection.

The arrows represent the _direction_ of the connection - from the client,
pointing to the server. Notice the `B<=C` tunnel is the same direction as the `B<-C` container,
but the `A<=B` tunnel is the opposite direction as the `A->B` container.

# address

tunnel addresses are multiserver style:

`tunnel:@7MG1hyfz8SsxlIgansud4LKM57IHIw2Okw/hvOdeJWw=.ed25519:0:net:localhost:1234!~shs:1b9KP8znF7A4i8wnSevBSK2ZabI/Re4bYF/Vh3hXasQ=~shs:7MG1hyfz8SsxlIgansud4LKM57IHIw2Okw/hvOdeJWw=`

for the protocol portion of the multiserver address,
`tunnel:target:port:portal_address`
this will include the `shs` portion for the portal.
`port` is just an integer that tells the server which
`ssb-tunnel` instance the client wants to connect to.
`target` is a ssb feed id, which represents the peer.
This tells the portal that C wants a connection to A.
`portal` tells A how to connect to B. Notice that since
the portal address has a shs portion, the protocol separator
`~` is escaped as `!~`.
The portal address can be any valid multiserver address.

## License

MIT
