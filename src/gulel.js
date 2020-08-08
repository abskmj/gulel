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

app.isListening = false
app.subscriptions = []

app.getSubscription = (topic) => {
  if (!topic.startsWith(twitchBaseUrl)) topic = twitchBaseUrl + topic
  return app.subscriptions.find((sub) => sub.hub['hub.topic'] === topic)
}

app.subscribe = async (topic, callback) => {
  // remove the twitch base url from the topic if present
  if (topic.startsWith(twitchBaseUrl)) topic = topic.replace(twitchBaseUrl, '')

  const context = crypto.hash(topic)

  router.route(`/${context}`)
    .get(async (req, res, nxt) => {
      try {
        const sub = app.getSubscription(req.query['hub.topic'])

        if (sub) {
          if (req.query && req.query['hub.challenge']) {
            // has a challenge

            if (req.query['hub.mode'] === 'subscribe') sub.markSubscribed()
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

  const subscription = {
    hub: {
      'hub.callback': context, // domain will be added later
      'hub.topic': twitchBaseUrl + topic,
      'hub.lease_seconds': 120
    },
    getHub: function () {
      const hub = { ...this.hub }

      hub['hub.callback'] = app.config.server.baseUrl + '/' + hub['hub.callback']
      hub['hub.secret'] = app.config.twitch.secret

      return hub
    },
    subscribed: false,
    markSubscribed: function () {
      this.subscribed = true
      this.enableRenewal()
    },
    subscribe: function () {
      app.twitch.subscribe(this.getHub())
    },
    unsubscribe: async function () {
      if (this.subscribed) {
        await app.twitch.unsubscribe(this.getHub())
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
  }

  app.subscriptions.push(subscription)

  // server is running
  if (app.isListening) {
    await subscription.subscribe()
  }

  return subscription
}

app.router = router
app.use(router)

// error middleware
app.use((err, req, res, nxt) => {
  console.error(err)
  res.sendStatus(500)
})

app.shutdown = async () => {
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

      if (config.server.tunnel) {
        app.config.server.baseUrl = await ngrok.connect(port)
        console.log(`Gulel is listening at ${app.config.server.baseUrl} -> ${localhost}`)
      } else {
        app.config.server.baseUrl = localhost
        console.log(`Gulel is listening at ${localhost}`)
      }

      // start subscriptions

      for (let index = 0; index < app.subscriptions.length; index++) {
        const sub = app.subscriptions[index]

        await sub.subscribe()
      }

      app.isListening = true

      // shut down the server when `quit` key word is entered in terminal
      process.stdin.resume()
      process.stdin.on('data', data => {
        if (Buffer.compare(data, Buffer.from('quit\n')) === 0) app.shutdown()
      })

      done()
    } catch (err) {
      console.log(err)
    }
  })
}

module.exports = app
