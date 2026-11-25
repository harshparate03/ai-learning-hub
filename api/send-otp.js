import auth from './auth.js';
export default function handler(req, res) {
  req.body = { email: req.body?.email, action: 'send-otp' };
  return auth(req, res);
}
