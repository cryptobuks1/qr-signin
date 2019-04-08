import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { QR_RTDB_PATH, QR_EXPIRATION_TIME } from './util';

const topicBuilder =
  process.env.BUILD === 'dev' || process.env.NOT_MODS
    ? functions.pubsub.topic('qr-tokens-cleanup')
    : functions.handler.pubsub.topic;

const qrTokensCleanup = topicBuilder.onPublish(async () => {
  const toRemove: { [k: string]: null } = {};

  // Clean up any expired unused QR code tokens.
  const unused = await admin
    .database()
    .ref(QR_RTDB_PATH)
    .orderByChild('used')
    .equalTo(null)
    .once('value');
  unused.forEach(snap => {
    if (snap.child('ts').val() + QR_EXPIRATION_TIME <= Date.now()) {
      toRemove[snap.ref.path] = null;
    }
  });

  // Clean up any QR code tokens marked as used in the database but that
  // haven't been actually used. Any such token that has doubled the
  // expiration time is considered stale and therefore is removed.
  const used = await admin
    .database()
    .ref(QR_RTDB_PATH)
    .orderByChild('used')
    .equalTo(true)
    .once('value');
  used.forEach(snap => {
    if (snap.child('ts').val() + 2 * QR_EXPIRATION_TIME <= Date.now()) {
      toRemove[snap.ref.path] = null;
    }
  });

  if (Object.keys(toRemove).length > 0) {
    await admin
      .database()
      .ref()
      .update(toRemove);
  }
});

exports = module.exports = qrTokensCleanup;
