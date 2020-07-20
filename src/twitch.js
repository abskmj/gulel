const axios = require('axios')

module.exports = (options) => {
  const http = axios.create({
    baseURL: 'https://api.twitch.tv/helix',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Client-ID': options.clientId
    }
  })

  const subscribe = (hub) => {
    return http.post('/webhooks/hub', { ...hub, 'hub.mode': 'subscribe' })
  }

  const unsubscribe = (hub) => {
    return http.post('/webhooks/hub', { ...hub, 'hub.mode': 'unsubscribe' })
  }

  const getSubscriptions = (topic) => {
    return http.get('/webhooks/subscriptions')
  }

  return { subscribe, unsubscribe, getSubscriptions }
}
