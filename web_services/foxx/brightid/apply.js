'use strict';
const createRouter = require('@arangodb/foxx/router');
const joi = require('joi');
const arango = require('@arangodb').db;
const nacl = require('tweetnacl');
const db = require('./db');
const operations = require('./operations');
const schemas = require('./schemas');

const router = createRouter();
module.context.use(router);
const operationsHashesColl = arango._collection('operationsHashes');

const handlers = {
  operationsPut: function(req, res){
    const op = req.body;
    const hash = req.param('hash');
    op.hash = hash;

    if (op.name == 'Link ContextId') {
      if (!db.getContext(op.context)) {
        op.state = 'ignored';
        db.upsertOperation(op);
        return res.send({'success': true, 'state': op.state, 'result': op.result});
      } else {
        // decrypt first to fix the hash
        operations.decrypt(op);
      }
    }

    if (operationsHashesColl.exists(op.hash)) {
      return res.send({'success': true, 'state': 'duplicate'});
    }

    try {
      operations.verify(op);
      op.result = operations.apply(op);
      op.state = 'applied';
      operationsHashesColl.insert({ _key: op.hash });
    } catch (e) {
      op.state = 'failed';
      op.result = {
        message: e.message || e,
        stack: e.stack,
        errorNum: e.errorNum,
      };
    }
    if (op.name == 'Link ContextId') {
      operations.encrypt(op);
    }
    db.upsertOperation(op);
    res.send({'success': true, 'state': op.state, 'result': op.result});
  }
};

// add blockTime to operation schema
schemas.schemas.operation = joi.alternatives().try(
  Object.values(schemas.operations).map(op => {
    op.blockTime = joi.number().required().description('milliseconds since epoch when the block was created');
    return joi.object(op);
  })
).description('Send operations to idchain to be applied to BrightID nodes\' databases after consensus');

router.put('/operations/:hash', handlers.operationsPut)
  .pathParam('hash', joi.string().required().description('sha256 hash of the operation message'))
  .body(schemas.schemas.operation)
  .summary('Apply operation after consensus')
  .description("Apply operation after consensus.")
  .response(null);

module.context.use(function (req, res, next) {
  try {
    next();
  } catch (e) {
    console.group("Error returned");
    console.log('url:', req._raw.requestType, req._raw.url);
    console.log('error:', e);
    console.log('body:', req.body);
    console.groupEnd();
    throw e;
  }
});
