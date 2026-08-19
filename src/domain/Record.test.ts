import {describe, expect, it} from 'vitest';
import {Observation} from './Observation';
import {Metric} from './Metric';
import {Record} from './Record';
import {RECORD_NOTE_MAX_LENGTH} from './validationLimits';

describe('Record', () => {
  it('should initialize with values', () => {
    const date = new Date();
    const record = new Record('r1', 'o1', date, new Map([['m1', 10]]));

    expect(record.id).toBe('r1');
    expect(record.observationId).toBe('o1');
    expect(record.timestamp).toBe(date);
    expect(record.values.get('m1')).toBe(10);
  });

  it('should default its note to null', () => {
    const record = new Record('r1', 'o1', new Date(), new Map());

    expect(record.note).toBeNull();
  });

  it('should keep the note it was constructed with', () => {
    const record = new Record('r1', 'o1', new Date(), new Map(), 'the hotel bed');

    expect(record.note).toBe('the hotel bed');
  });

  it('should allow getting and removing values', () => {
    const record = new Record('r1', 'o1', new Date(), new Map([['m1', 10]]));
    expect(record.getValue('m1')).toBe(10);
    
    record.removeValue('m1');
    expect(record.getValue('m1')).toBeUndefined();
  });

  describe('updateValues', () => {
    it('should update values when observation is valid and values are correct', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric');
      const obs = new Observation('o1', 'Sleep', [metric1]);
      
      const record = new Record('r1', 'o1', new Date(), new Map());
      const newValues = new Map<string, any>([['m1', 8]]);
      
      record.updateValues(newValues, obs);
      expect(record.getValue('m1')).toBe(8);
    });

    it('should remove a value whose metric is absent from the incoming values', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric');
      const metric2 = new Metric('m2', 'Quality', 'Numeric');
      const obs = new Observation('o1', 'Sleep', [metric1, metric2]);

      const record = new Record('r1', 'o1', new Date(), new Map([['m1', 8], ['m2', 3]]));

      record.updateValues(new Map<string, any>([['m1', 9]]), obs);

      expect(record.getValue('m1')).toBe(9);
      expect(record.getValue('m2')).toBeUndefined();
    });

    it('should leave the record with no values when given none', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric');
      const obs = new Observation('o1', 'Sleep', [metric1]);

      const record = new Record('r1', 'o1', new Date(), new Map([['m1', 8]]));

      record.updateValues(new Map<string, any>(), obs);

      expect(record.values.size).toBe(0);
    });

    it('should store a Text value less the whitespace around it', () => {
      const obs = new Observation('o1', 'Sleep', [new Metric('m1', 'Note', 'Text')]);
      const record = new Record('r1', 'o1', new Date(), new Map());

      record.updateValues(new Map<string, any>([['m1', '  slept badly  ']]), obs);

      expect(record.getValue('m1')).toBe('slept badly');
    });

    it.each(['', '   ', '\t\n'])('should clear a value replaced by %j', value => {
      const obs = new Observation('o1', 'Sleep', [new Metric('m1', 'Note', 'Text')]);
      const record = new Record('r1', 'o1', new Date(), new Map([['m1', 'slept badly']]));

      record.updateValues(new Map<string, any>([['m1', value]]), obs);

      expect(record.values.has('m1')).toBe(false);
    });

    it('should throw an error if observation id does not match', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric');
      const obs = new Observation('o2', 'Sleep', [metric1]); // Notice o2 instead of o1
      
      const record = new Record('r1', 'o1', new Date(), new Map());
      
      expect(() => record.updateValues(new Map([['m1', 8]]), obs)).toThrow(/mismatch/);
    });

    it('should throw an error if values are invalid according to the observation', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric');
      const obs = new Observation('o1', 'Sleep', [metric1]);

      const record = new Record('r1', 'o1', new Date(), new Map());
      const newValues = new Map<string, any>([['m1', 'invalid_string']]);

      expect(() => record.updateValues(newValues, obs)).toThrow(/Invalid value/);
    });
  });

  describe('normalizeNote', () => {
    it('should trim surrounding whitespace', () => {
      expect(Record.normalizeNote('  the hotel bed  ')).toBe('the hotel bed');
    });

    it.each([undefined, null, '', '   ', '\n \n'])('should map %j to null', value => {
      expect(Record.normalizeNote(value)).toBeNull();
    });

    it('should keep interior line breaks', () => {
      expect(Record.normalizeNote(' first line\nsecond line ')).toBe('first line\nsecond line');
    });

    it('should accept a note of exactly the maximum length', () => {
      const note = 'x'.repeat(RECORD_NOTE_MAX_LENGTH);

      expect(Record.normalizeNote(note)).toBe(note);
    });

    it('should reject a note one character over the maximum', () => {
      expect(() => Record.normalizeNote('x'.repeat(RECORD_NOTE_MAX_LENGTH + 1)))
        .toThrow('Record note cannot exceed 150 characters');
    });

    // The input's own `maxLength` counts them, so the use case has to agree.
    it('should count newline characters towards the limit', () => {
      const note = 'x'.repeat(RECORD_NOTE_MAX_LENGTH - 1) + '\nx';

      expect(() => Record.normalizeNote(note)).toThrow(/cannot exceed/);
    });
  });
});
