import test from 'node:test';
import assert from 'node:assert/strict';
import { siegeSignals, siegeRehearsal, signalTime } from '../lib/siege-briefing.ts';

test('rehearsal waits for supplied findings and rejects unsupported timing instead of rounding', () => {
  const partial = siegeSignals({ tolerance: '2', travel: '6' });
  assert.equal(partial.travel, 6000);
  assert.equal(partial.arrival, null);
  assert.equal(siegeRehearsal(partial, 12000), null);
  for (const value of ['1/3', '-1', '1/0', 'x', '3601', '0.0001']) {
    assert.equal(siegeSignals({ travel: value }).travel, null);
  }
  assert.equal(siegeSignals({ travel: '1/8' }).travel, 125);
  assert.equal(signalTime(0), '0');
  assert.equal(signalTime(125), '0.125');
  assert.equal(signalTime(null), '—');
});

test('Siege rehearsal respects both tolerance boundaries and the deadline', () => {
  const signals = siegeSignals({ travel: '6', arrival: '20', deadline: '21', tolerance: '2' });
  assert.equal(siegeRehearsal(signals, 11999)?.fits, false);
  assert.equal(siegeRehearsal(signals, 12000)?.fits, true);
  assert.equal(siegeRehearsal(signals, 15000)?.fits, true);
  assert.equal(siegeRehearsal(signals, 15001)?.fits, false);
  const late = siegeRehearsal(signals, 16000)!;
  assert.equal(late.synchronized, true);
  assert.equal(late.beforeDeadline, false);
  assert.equal(siegeRehearsal(signals, -1), null);
  assert.equal(siegeRehearsal(signals, 0.5), null);
});

test('the rehearsal checks the teammate deadline and exact fractional boundary values', () => {
  const impossible = siegeSignals({ travel: '6', arrival: '22', deadline: '21', tolerance: '2' });
  assert.equal(siegeRehearsal(impossible, 15000)?.fits, false);
  const fraction = siegeSignals({ travel: '0.1', arrival: '0.3', deadline: '0.3', tolerance: '0' });
  assert.equal(siegeRehearsal(fraction, 200)?.fits, true);
  assert.equal(siegeRehearsal(fraction, 201)?.fits, false);
  const zero = siegeSignals({ travel: '0', arrival: '0', deadline: '0', tolerance: '0' });
  assert.equal(siegeRehearsal(zero, 0)?.fits, true);
});
