import { expect, test } from 'claude-code/testing'
import { changes } from '../hooks/register.ts'

const USAGE = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
const answered = (text: string) => ({ value: { isAnswered: true, text, usage: USAGE } as const })

function engine(on: any, reply: unknown, store: Record<string, unknown> = {}) {
  const sent: string[] = []
  on('prompt.submit', (_: unknown, e: { text: string }) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('model.complete', () => reply)
  on('store.get', (_: unknown, e: { key: string }) => ({ value: store[e.key] }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  return sent
}

const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } as const })

test('a typo-filled prompt reaches the model fixed', async ($, on) => {
  const sent = engine(on, answered('Please fix the bug in the login form.'))
  await $.prompt.submit(typed('plese fix teh bug in the login form'))
  expect(sent).toEqual(['Please fix the bug in the login form.'])
})

test('a reply that answers instead of fixing is ignored', async ($, on) => {
  const sent = engine(on, answered('Sure! Here is a detailed plan for fixing the login form, step by step, with tests and docs.'))
  await $.prompt.submit(typed('fix login form'))
  expect(sent).toEqual(['fix login form'])
})

test('an API failure lets the original through', async ($, on) => {
  const sent = engine(on, { value: { isAnswered: false, reason: 'empty-reply', usage: USAGE } })
  await $.prompt.submit(typed('plese fix teh bug'))
  expect(sent).toEqual(['plese fix teh bug'])
})

test('turned off, the prompt is left alone', async ($, on) => {
  const sent = engine(on, answered('Please fix the bug.'), { enabled: false })
  await $.prompt.submit(typed('plese fix teh bug'))
  expect(sent).toEqual(['plese fix teh bug'])
})

test('a prompt not typed by the person is left alone', async ($, on) => {
  const sent = engine(on, answered('Please fix the bug.'))
  await $.prompt.submit({ text: 'plese fix teh bug', wait: false, origin: { kind: 'task-notification' } })
  expect(sent).toEqual(['plese fix teh bug'])
})

test('a shell-mode line is left alone', async ($, on) => {
  const sent = engine(on, answered('git status --short'))
  await $.prompt.submit(typed('!git stauts --short'))
  expect(sent).toEqual(['!git stauts --short'])
})

test('/destoopify turns it off, then on again', async ($, on) => {
  const store: Record<string, unknown> = {}
  engine(on, answered('x'), store)
  on('command.run', () => ({}))
  const off = await $.command.run({ command: 'destoopify', args: '' } as any)
  expect(off.text).toBe('destoopify is now off')
  expect(store.enabled).toBe(false)
  const back = await $.command.run({ command: 'destoopify', args: '' } as any)
  expect(back.text).toBe('destoopify is now on')
})

test('the changed words are listed', async () => {
  expect(changes('plese fix teh bug', 'Please fix the bug.')).toEqual(['plese → Please', 'teh bug → the bug.'])
  expect(changes('same text', 'same text')).toEqual([])
})
