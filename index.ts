import {makeDOMDriver, div, input} from '@cycle/dom';
import {timeDriver} from '@cycle/time';
import {run} from '@cycle/run';
import xs from 'xstream';

import * as fs from 'fs';

const WORDS = new Set(fs.readFileSync('./words.txt', 'utf-8').split('\n').map(word => word.toUpperCase().trim()).filter(word => word !== ''));

const drivers = {
  DOM: makeDOMDriver(document.body)
}

function renderChallengeGrid (word, {challenge, rows, columns}) {
  return (
    div('.challenge-grid', [
      div('.rowular', [div('.cellular.blank')].concat(columns.map(valid => div('.cellular', {class: {valid}}, valid ? '😊': '😞')))),

      ...challenge.map((row, rowIndex) =>
        div('.row', [
          div('.cellular', {class: {valid: rows[rowIndex]}}, rows[rowIndex] ? '😊': '😞'),

          ...row.map((value, columnIndex) => div('.cell', [input({props: {value, disabled: rowIndex === 0}, class: {disabled: rowIndex == 0}, dataset: {rowIndex: rowIndex.toString(), columnIndex: columnIndex.toString()}})]))
        ])
      )
    ])
  )
}

function zip (...items) {
  return new Array(items[0].length)
    .fill(0)
    .map((_, index) => items.map(arr => arr[index]));
}

function transpose (array) {
  return zip(...array);
}

function checkValid (challenge) {
  const rows = challenge.map(row => row.join(''));
  const columns = transpose(challenge).map(column => column.join(''));

  return {
    challenge,

    rows: rows.map(word => word.length === challenge.length && WORDS.has(word)),
    columns: columns.map(word => word.length === challenge.length && WORDS.has(word))
  }
}

function view ([word, challenge]) {
  return (
    div('.challenge', [
      input('.challenge-word', {attrs: {value: word}}),

      renderChallengeGrid(word, challenge)
    ])
  )
}

function applyReducer (challenge, reducer) {
  return reducer(challenge);
}

function main (sources) {
  const challengeWord$ = sources.DOM
    .select('.challenge-word')
    .events('change')
    .map(ev => ev.target.value)
    .startWith('CAT');

  const startChallenge$ = challengeWord$.map(word => {
    return function reduce () {
      const size = word.length;
      const challenge = new Array(size).fill('').map(() => new Array(size).fill(''));

      challenge[0] = word.toUpperCase().split('');

      return challenge;
    }
  });

  const updateChallengeCell$ = sources.DOM
    .select('.cell input')
    .events('input')
    .map(ev => {
      return function reduce (challenge) {
        const row = ev.target.dataset.rowIndex;
        const column = ev.target.dataset.columnIndex;

        challenge[row][column] = ev.target.value.toUpperCase();

        return challenge;
      }
    });

  const reducer$ = xs.merge(
    startChallenge$,
    updateChallengeCell$
  );

  const challenge$ = reducer$.fold(applyReducer, [[]]).drop(1);
  const challengeWithValidity$ = challenge$.map(checkValid);

  return {
    DOM: xs.combine(challengeWord$, challengeWithValidity$).map(view)
  }
}

run(main, drivers);
