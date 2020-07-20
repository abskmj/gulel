const crypto = require('crypto')

module.exports.hash = (data) => crypto.createHash('sha256').update(data).digest('hex')
module.exports.hmac = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('hex')
module.exports.secret = () => (crypto.randomBytes(16)).toString('hex')
