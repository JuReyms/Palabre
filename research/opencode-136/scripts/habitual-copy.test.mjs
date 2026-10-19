/** Contrôles de corrélation sur données fictives ; aucun moteur ni connexion. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceFromMarkdown, validateSource, inspectReply } from './habitual-copy.mjs';

const assistant = text => ({ type: 'assistant', model: { providerID: 'fixture', id: 'local' }, finish: 'stop', time: { completed: 1 }, content: [{ type: 'text', text }] });
const before = [{ type: 'user', text: 'seed' }, assistant('ACK'), { type: 'idle', outcome: 'succeeded' }];
const after = [...before, { type: 'user', text: 'question' }, assistant('Avis fictif'), { type: 'idle', outcome: 'succeeded' }];

test('identifiant explicite unique : aucun choix de dernière conversation', () => {
  assert.equal(sourceFromMarkdown('**Session ID:** ses_AbC123\n'), 'ses_AbC123');
  assert.throws(() => sourceFromMarkdown('ses_AbC123'), /une seule/);
  assert.throws(() => sourceFromMarkdown('**Session ID:** ses_AbC123\n**Session ID:** ses_Def456\n'), /une seule/);
});

test('dossier différent, modèle absent ou inbox occupée refusés avant envoi', () => {
  const snapshot = { info: { id: 'ses_x', location: { directory: 'C:/fixture' }, agent: 'build', model: { providerID: 'fixture', id: 'local' }, outcome: 'succeeded', time: { idle: 1 } }, context: before, inbox: [] };
  const expected = { sourceID: 'ses_x', project: 'C:/fixture', seed: 'seed' };
  validateSource(snapshot, expected);
  assert.throws(() => validateSource(snapshot, { ...expected, project: 'C:/other' }), /dossier/);
  assert.throws(() => validateSource({ ...snapshot, info: { ...snapshot.info, model: undefined } }, expected), /Modèle/);
  assert.throws(() => validateSource({ ...snapshot, inbox: [{}] }, expected), /inbox/);
});

test('réponse exacte terminée acceptée ; nonce seul et concurrence refusés', () => {
  assert.equal(inspectReply(before, after, 'question').reply, 'Avis fictif');
  assert.throws(() => inspectReply(before, after, 'question avec le même nonce'), /exactement/);
  assert.throws(() => inspectReply(before, [...after, { type: 'user', text: 'autre' }], 'question'), /concurrent/);
  assert.throws(() => inspectReply(before, [...after.slice(0, -1), { type: 'synthetic', text: 'autre' }, after.at(-1)], 'question'), /Autre apport/);
  assert.throws(() => inspectReply(before, [...after, { type: 'idle', outcome: 'succeeded' }], 'question'), /plusieurs tours/);
});

test('fin length, texte partiel, erreur outil et altération du contexte ne valent pas réponse valide', () => {
  const limited = structuredClone(after); limited[4].finish = 'length';
  assert.throws(() => inspectReply(before, limited, 'question'), /Fin/);
  assert.throws(() => inspectReply(before, after.slice(0, -1), 'question'), /Fin/);
  const broken = structuredClone(after); broken[4].content.push({ type: 'tool', state: { status: 'error' } });
  assert.throws(() => inspectReply(before, broken, 'question'), /Outil/);
  const changed = structuredClone(after); changed[0].text = 'autre contexte';
  assert.throws(() => inspectReply(before, changed, 'question'), /contexte/);
});
