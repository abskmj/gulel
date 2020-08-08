const gulel = require('../src/gulel')

gulel.subscribe('/users/follows?first=1&from_id=556070742', (data) => {
  console.log('DATA:', data)
})

gulel.subscribe('/streams?user_id=29795919', (data) => {
  console.log('DATA:', data)
})

const config = {
  twitch: {
    accessToken: '9e7ppqxazc802kp11z00vsj2hmjqem',
    clientId: 'gp762nuuoqcoxypju8c569th9wz7q5'
  },
  server: {
    port: 3000
  }
}

gulel.start(config, () => console.log('Gulel is listening for Twitch webhooks'))
