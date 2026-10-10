#!/usr/bin/env node
'use strict';

async function submit(order, queue, store) {
  const message = await queue.enqueue({ orderId: order.id });
  await store.setStatus(order.id, 'COMPLETED');
  return { accepted: true, messageId: message.id };
}

module.exports = { submit };
