#!/usr/bin/env node
'use strict';

const http = require('http');
const chp = require('child_process');
const fs = require('fs-extra');
const express = require('express');
const bodyParser = require('body-parser');
const ip = require('ip');
const portfinder = require('portfinder');
const rp = require('request-promise-native');
const json5 = require('json5');
const yargs = require('yargs');
const merge = require('lodash.merge');
const defaultConfig = require('../lib/default-config.js');

const msleep = time => new Promise(resolve => setTimeout(() => resolve(), time));

const argv = yargs
  .option('ip', {
    describe: 'SDRangel IP address',
    default: '127.0.0.1:8091'
  })
  .option('config', {
    alias: 'c',
    describe: 'SDR config file'
  })
  .version()
  .help()
  .argv;

const baseUri = `http://${argv.ip}/sdrangel`;

function angel () {
  let p = [baseUri];
  for (let i = 0; i < arguments.length; i++) {
    p.push(arguments[i]);
  }
  return function () {
    let p1 = [];
    for (let i = 0; i < arguments.length; i++) {
      p1.push(arguments[i]);
    }
    return p.concat(p1).join('/');
  };
}

const rx = angel('deviceset', 0);
const tx = angel('deviceset', 1);

const initConfig = async () => {
  // client
  const sdrangel = chp.spawn('sdrangel');

  sdrangel.on('error', () => {
    console.log('sdrangel not found');
    process.exit(1);
  });

  sdrangel.stdout.on('data', (data) => { console.log(`stdout: ${data}`); });
  sdrangel.stderr.on('data', (data) => { console.log(`stderr: ${data}`); });
  sdrangel.on('close', (code) => { console.log(`child process exited with code ${code}`); });
  await msleep(5000);

  let devsets = await rp({uri: [baseUri, 'devicesets'].join('/'), json: true});

  for (let d = 0; d < devsets.deviceSets.length; d++) {
    const deviceSet = devsets.deviceSets[d];
    for (let c = deviceSet.channelcount - 1; c >= 0; c--) {
      await rp({method: 'DELETE', uri: rx('channel', c), json: true});
    }
  }

  await rp({method: 'PUT', uri: rx('device'), json: true, body: {hwType: 'PlutoSDR', direction: 0}});
  await rp({method: 'POST', uri: rx('channel'), json: true, body: {channelType: 'SSBDemod', direction: 0}});

  await rp({method: 'POST', uri: baseUri + '/deviceset?direction=1'});
  await rp({method: 'PUT', uri: tx('device'), json: true, body: {hwType: 'PlutoSDR', direction: 1}});
  await rp({method: 'POST', uri: tx('channel'), json: true, body: {channelType: 'SSBMod', direction: 1}});

  if (argv.config) {
    const fbody = await fs.readFile(argv.config, 'utf8');
    const config1 = json5.parse(fbody);
    const config = merge(defaultConfig, config1);

    let rxset = await rp({uri: rx('device', 'settings'), json: true});
    console.log(rxset);
    Object.assign(rxset, config[0].device);
    await rp({method: 'PATCH', uri: rx('device', 'settings'), json: true, body: rxset});

    let demodset = await rp({uri: rx('channel', 0, 'settings'), json: true});
    console.log(demodset);
    Object.assign(demodset, config[0].channel);
    await rp({method: 'PATCH', uri: rx('channel', 0, 'settings'), json: true, body: demodset});

    let txset = await rp({uri: tx('device', 'settings'), json: true});
    console.log(txset);
    Object.assign(txset, config[1].device);
    await rp({method: 'PATCH', uri: tx('device', 'settings'), json: true, body: txset});

    let modset = await rp({uri: tx('channel', 0, 'settings'), json: true});
    console.log(modset);
    Object.assign(modset, config[1].channel);
    await rp({method: 'PATCH', uri: tx('channel', 0, 'settings'), json: true, body: modset});
  }
  await rp({method: 'POST',  uri: rx('device', 'run'), json: true});
  await rp({method: 'PATCH', uri: rx('focus'), json: true});
  await rp({method: 'POST',  uri: tx('device', 'run'), json: true});
};

const main = async () => {
  // server
  const app = express();
  app.use(bodyParser.json());
  app.patch('/sdrangel/deviceset/0/channel/0/settings', async function (req, res) {
    res.send('OK');
    const fOffset = ((req.body || {}).SSBDemodSettings || {}).inputFrequencyOffset;
    if (fOffset !== undefined) {
      // console.log(fOffset);
      const tx0 = await rp({uri: tx('channel', 0, 'settings'), json: true});
      tx0.SSBModSettings.inputFrequencyOffset = fOffset;
      await rp({method: 'PATCH', uri: tx('channel', 0, 'settings'), json: true, body: tx0});
    }
  });
  const server = http.createServer(app);
  const port = await portfinder.getPortPromise();
  server.listen(port, async () => {
    const addr = 'http://' + ip.address() + ':' + server.address().port + '/';
    console.log(addr);
    await msleep(1000);
    await initConfig();
  });
};

main();

/* eslint camelcase: 0 */
