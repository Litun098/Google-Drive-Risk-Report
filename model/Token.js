const mongoose = require('mongoose');

const TokenModelSchema = new mongoose.Schema({
  access_token: String,
  refresh_token: Object,
  expiry_date: Number,
  token_type: Object
});

const TokenModel = mongoose.model('TokenModel', TokenModelSchema);

module.exports = TokenModel;
