/**
 * Wizard I/O — injectable so the CLI (readline), the web console (request-driven),
 * and tests (scripted) share one wizard implementation.
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

export interface WizardIO {
  choose<T extends string>(question: string, options: Choice<T>[], defaultValue?: T): Promise<T>;
  secret(question: string): Promise<string>;
  note(message: string): void;
}

export function createConsoleIO(): WizardIO {
  const rl = createInterface({ input, output });
  return {
    async choose(question, options, defaultValue) {
      rl.write(`${question}\n`);
      for (const [i, o] of options.entries()) rl.write(`  [${i + 1}] ${o.label}\n`);
      const defIdx = defaultValue ? options.findIndex((o) => o.value === defaultValue) : -1;
      const suffix = defIdx >= 0 ? ` (default ${defIdx + 1})` : '';
      for (;;) {
        const answer = (await rl.question(`Enter 1-${options.length}${suffix}: `)).trim();
        const idx = answer === '' && defIdx >= 0 ? defIdx : Number(answer) - 1;
        if (idx >= 0 && idx < options.length) return options[idx].value;
        rl.write('Invalid choice, try again.\n');
      }
    },
    async secret(question) {
      return (await rl.question(question)).trim();
    },
    note(message) {
      rl.write(`${message}\n`);
    },
  };
}

/** Collects notes into a transcript (used by the web console and tests). */
export function createTranscriptIO(notes: string[]): WizardIO {
  return {
    async choose(question, options, defaultValue) {
      const value = await createConsoleIO().choose(question, options, defaultValue);
      return value;
    },
    async secret(question) {
      const value = await createConsoleIO().secret(question);
      return value;
    },
    note(message) {
      notes.push(message);
    },
  };
}
