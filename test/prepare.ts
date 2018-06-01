const prepare = require('mocha-prepare');
import 'reflect-metadata';
import { createConnection } from 'typeorm';

prepare(function(done) {
  createConnection({
    'type': 'mongodb',
    'host': 'mongo',
    'port': 27017,
    'username': '',
    'password': '',
    'database': 'backend-boilerplate-test',
    'synchronize': true,
    'logging': true,
    'entities': [
      'src/entities/**/*.ts'
    ],
    'migrations': [
      'src/migrations/**/*.ts'
    ],
    'subscribers': [
      'src/subscriber/**/*.ts'
    ]
  }).then(async connection => {
    done();
  });
});
