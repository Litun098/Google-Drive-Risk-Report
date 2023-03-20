const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const app = express();
const router = require('./router/routes');


app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(router);

// connecting to mongoDB
module.exports = mongoose.connect(process.env.dbUrl,).then(()=>{
    console.log("Connected to MongoDB");
}).catch((err)=>{
    console.log(`Couldn't connected to database`,err);
})


app.listen(process.env.PORT,()=>{
    console.log("Server is running at port",process.env.PORT)
})