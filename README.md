![npm (scoped)](https://img.shields.io/npm/v/gulel?label=NPM) ![NPM](https://img.shields.io/npm/l/gulel?label=License) ![npm](https://img.shields.io/npm/dt/gulel?label=Downloads)

# Gulel - Local Server for Twitch Webhooks
Gulel is an [express](https://expressjs.com) based application server that manages [Twitch Webhooks](https://dev.twitch.tv/docs/api/guide#webhooks) with minimal setup. It uses [ngrok](https://ngrok.com/) to make the local server reachable by Twitch servers.

It handles most of the stuff automatically for you.
- It creates the HTTP endpoints needed by Twitch.
- It [verifies the payload received](https://dev.twitch.tv/docs/api/webhooks-guide/#webhooks-guide) on the HTTP endpoints.
- It [creates the subscriptions](https://dev.twitch.tv/docs/api/webhooks-reference) by calling Twitch API.
- It renews the subscriptions on expiry.
- It stops the subscriptions by calling Twitch API when the server is shutting down.

> **Note:** As of April 30, 2020, all Helix endpoints require OAuth and matching client IDs. See [this announcement](https://discuss.dev.twitch.tv/t/requiring-oauth-for-helix-twitch-api-endpoints/23916) for more details. Gulel is already compatible with the changes announced.

# Installation
```bash
npm install gulel
```

# Usage
Gulel is an express based application server with additional methods for handling Twitch Webhooks.

## Importing the module
```javascript
const gulel = require('gulel')
```

## Listening for a Webhook
```javascript
gulel.subscribe('/users/follows?first=1&to_id=1337', (data) => { 
    // data passed from Twitch is available as an argument

    console.log(data)

    /*{
      "data": [
          {
            "from_id": "1336",
            "from_name": "ebi",
            "to_id": "1337",
            "to_name": "oliver0823nagy",
            "followed_at": "2017-08-22T22:55:24Z"
          }
      ]
    }*/
})
```

This creates a new route for the subscription on the express server. It starts listening for both `GET` & `POST` calls. `GET` method is needed by Twitch to confirm the subscription. `POST` method is to receive data from Twitch.

Each subscription is automatically subscribed when the server starts and renewed around 1 minute before they expire. The default expiry is set at 1 hour.

`/users/follows?first=1&to_id=1337` is the topic to subscribe to. More topics are documented at [dev.twitch.tv](https://dev.twitch.tv/docs/api/webhooks-reference).
 

## Starting the server
```javascript
gulel.start({
  twitch: {
    accessToken: '<access token>',
    clientId: '<client id>'
  },
  server: {
    port: 3000
}, () => console.log('Gulel is listening for Twitch calls'))

// Output
// Gulel is listening at https://39697b582cd8.ngrok.io -> http://localhost:3000
```

This starts the express server on a port configured with routes for the subscriptions mounted. The express server is also available on the internet as a subdomain for [`ngrok.io`](https://ngrok.com) and therefore, the local server is reachable for Twitch servers to send data.

## Shutting down the server gracefully
Type `quit` in the terminal where the server is running and press `enter`. This will also unsubscribe from any active subscriptions.

```
Gulel is shutting down
Unsubscribing from active subscriptions
```

Also, `gulel.shutdown()` can be used to shut it down.

## Examples
Few examples are available in the [examples](./examples) directory.

# Configuration
## Twitch
```
twitch.secret
```
This secret will be used as `hub.secret` while creating subscriptions. If not configured, the application will generate one.

```
twitch.accessToken
```
User's Access Token for authenticating Twitch APIs. 

```
twitch.clientId
```
Client ID for the Twitch application.

> **Tip!** If you want to try out the server without creating a Twitch application, you can use [an online token generator](https://twitchtokengenerator.com/) to get an access token and client id. This will also help you to get an access token with the scopes needed by some subscriptions.

## Server
```
server.port
```
Local port number where the server will listen on. Should be a number.

```
server.tunnel
```
If `true`, ngrok service will be used. The default value is `true`

# Fixes & Improvements
Head over to the issues tab at [github.com](https://github.com/abskmj/gulel/issues) to report a bug or suggest an improvement. Feel free to contribute to the code or documentation by creating a pull request.