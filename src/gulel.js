const express = require('express')
const parser = require('body-parser')
const ngrok = require('ngrok')
const morgan = require('morgan')

const crypto = require('./crypto')
const twitch = require('./twitch')

const app = express()
const router = express.Router()

const sleep = (ms = 1000) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const twitchBaseUrl = 'https://api.twitch.tv/helix'

router.use(morgan('tiny'))
router.use(parser.json({ verify: (req, res, buf, encoding) => { req.rawBody = buf.toString() } }))

app.subscriptions = []

app.subscribe = (topic, callback) => {
  // remove the twitch base url from the topic if present
  if (topic.startsWith(twitchBaseUrl)) topic = topic.replace(twitchBaseUrl, '')

  const context = crypto.hash(topic)

  router.route(`/${context}`)
    .get(async (req, res, nxt) => {
      try {
        const sub = app.subscriptions.find((sub) => sub.hub['hub.topic'] === req.query['hub.topic'])

        if (sub) {
          if (req.query && req.query['hub.challenge']) {
            // has a challenge

            if (req.query['hub.mode'] === 'subscribe')sub.subscribed = true
            else if (req.query['hub.mode'] === 'unsubscribe') sub.subscribed = false

            res.send(req.query['hub.challenge'])
          } else {
            sub.subscribed = false
            const err = new Error('There is an error on one of the subscriptions')
            err.hub = req.query
            throw err
          }
        } else {
          const err = new Error('Unknown topic')
          err.hub = req.query
          throw err
        }
      } catch (err) { nxt(err) }
    })
    .post(async (req, res, nxt) => {
      try {
        if (app.config.twitch.secret) {
          if (req.headers && req.headers['x-hub-signature']) {
            const signature = req.headers['x-hub-signature'].replace('sha256=', '')

            const computed = crypto.hmac(req.rawBody, app.config.twitch.secret)

            if (signature !== computed) throw new Error('Webhook payload verification failed')
          } else {
            throw new Error('x-hub-signature is missing')
          }
        }

        await callback(req.body)
        res.sendStatus(200)
      } catch (err) { nxt(err) }
    })

  app.subscriptions.push({
    hub: {
      'hub.callback': context, // domain will be added later
      'hub.topic': twitchBaseUrl + topic,
      'hub.lease_seconds': 3600
    },
    subscribed: false,
    subscribe: async function () {
      await app.twitch.subscribe(this.hub)
      // const sub = this
      // setTimeout(() => sub.unsubscribe(), 5000)
      this.enableRenewal()
    },
    unsubscribe: async function () {
      if (this.subscribed) {
        await app.twitch.unsubscribe(this.hub)
      }
    },
    enableRenewal: function () {
      const sub = this
      if (sub.subscribed) {
        const currentMillis = (new Date()).getTime()
        const nextMillis = currentMillis + ((sub.hub['hub.lease_seconds'] - 60) * 1000)
        console.log('Subscription will auto renew at', (new Date(nextMillis)).toString())

        setTimeout(async function () {
          await sub.subscribe()
        }, (sub.hub['hub.lease_seconds'] - 60) * 1000)
      }
    }
  })
}

app.router = router
app.use(router)

// error middleware
app.use((err, req, res, nxt) => {
  console.error(err)
  res.sendStatus(500)
})

app.start = (config, done) => {
  app.config = config

  // check if a secret is configured
  if (app.config && app.config.twitch && app.config.twitch.secret) {

  } else app.config.twitch.secret = crypto.secret()

  // check is tunnel option is configured
  if (app.config && app.config.server && app.config.server.tunnel === false) {

  } else app.config.server.tunnel = true

  app.twitch = twitch(config.twitch)

  const { port } = config.server

  app.listen(port, async () => {
    try {
      // start server

      const localhost = `http://localhost:${port}`

      let baseUrl

      if (config.server.tunnel) {
        baseUrl = await ngrok.connect(port)
        console.log(`Gulel is listening at ${baseUrl} -> ${localhost}`)
      } else {
        baseUrl = localhost
        console.log(`Gulel is listening at ${localhost}`)
      }

      // start subscriptions

      for (let index = 0; index < app.subscriptions.length; index++) {
        const sub = app.subscriptions[index]
        const { hub } = sub
        hub['hub.callback'] = baseUrl + '/' + hub['hub.callback']
        hub['hub.secret'] = app.config.twitch.secret

        await sub.subscribe()
      }

      const shutDown = async () => {
        // unsubcribe active subscriptions

        console.log('Gulel is shutting down')
        console.log('Unsubscribing from active subscriptions')

        for (let index = 0; index < app.subscriptions.length; index++) {
          const sub = app.subscriptions[index]
          await sub.unsubscribe()
        }

        // wait till all active subscriptions are unsubscribed

        while (true) {
          const sub = app.subscriptions.find((sub) => sub.subscribed === true)

          if (sub) {
            await sleep(1000)
          } else {
            break
          }
        }

        process.exit(0)
      }

      // shut down the server when `quit` key word is entered in terminal
      process.stdin.resume()
      process.stdin.on('data', data => {
        if (Buffer.compare(data, Buffer.from('quit\n')) === 0) shutDown()
      })

      done()
    } catch (err) {
      console.log(err)
    }
  })
}

module.exports = app
