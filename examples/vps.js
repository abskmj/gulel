const gulel = require('../src/gulel')

gulel.subscribe('/users/follows?first=1&from_id=556070742', (data) => {
  console.log('DATA:', data)
})

gulel.subscribe('/streams?user_id=29795919', (data) => {
  console.log('DATA:', data)
})

const config = {
  twitch: {
    accessToken: '<access token>',
    clientId: '<client id>'
  },
  server: {
    port: 3000,
    tunnel: false,
    baseUrl: 'https://postb.in/1597325597324-6519950181245'
  }
}

gulel.start(config, () => console.log('Gulel is listening for Twitch webhooks'))
