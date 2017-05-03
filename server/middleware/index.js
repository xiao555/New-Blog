'use strict';

import compose from 'koa-compose';
import convert from 'koa-convert';
import helmet from 'koa-helmet';
import cors from 'koa-cors';
import bodyParser from 'koa-bodyparser';
import session from 'koa-generic-session';
const RedisStore = require('koa-redis');

export default function middleware() {
  return compose([
    helmet(), // reset HTTP headers (e.g. remove x-powered-by)
    convert(cors()),
    convert(bodyParser()),
    convert(session({
      store: new RedisStore()
    })),
  ]);
}
