#!/usr/bin/env node

const functions = require("./wsFunctions");

functions.startServer(process.env.API_PORT);