const gulel = require('../src/gulel')

const config = {
  twitch: {
    accessToken: '<access token>',
    clientId: '<client id>'
  },
  server: {
    port: 3000
  }
}

gulel.start(config, async () => {
  console.log('Gulel is listening for Twitch webhooks')

  // subscribe
  gulel.subscribe('/users/follows?first=1&from_id=556070742', (data) => {
    console.log('DATA:', data)
  })

  const subscription = await gulel.subscribe('/streams?user_id=29795919', (data) => {
    console.log('DATA:', data)
  })

  // unsubscribe
  setTimeout(async () => { await subscription.unsubscribe() }, 5000)

  setTimeout(async () => {
    const subscription = gulel.getSubscription('/users/follows?first=1&from_id=556070742')

    subscription.unsubscribe()
  }, 7000)

  // shutdown
  setTimeout(() => { gulel.shutdown() }, 10000)
})
