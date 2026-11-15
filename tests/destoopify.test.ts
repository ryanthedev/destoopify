import { expect, test } from 'claude-code/testing'
import { changes, protect } from '../hooks/register.ts'

const USAGE = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
const answered = (text: string) => ({ value: { isAnswered: true, text, usage: USAGE } as const })

function engine(on: any, reply: unknown, store: Record<string, unknown> = {}) {
  const sent: string[] = []
  on('prompt.submit', (_: unknown, e: { text: string }) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('model.complete', typeof reply === 'function' ? (reply as any) : () => reply)
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

test('a kept word reaches the model as typed, while other typos are still fixed', async ($, on) => {
  const sent = engine(on, answered('Please unpublish the site and fix the bug.'), { words: ['upublish'] })
  await $.prompt.submit(typed('plese upublish the site and fix teh bug'))
  expect(sent).toEqual(['Please upublish the site and fix the bug.'])
})

test('the kept words are named to Haiku', async ($, on) => {
  let system = ''
  engine(on, (_: unknown, e: { system: string }) => {
    system = e.system
    return answered('upublish it')
  }, { words: ['upublish'] })
  await $.prompt.submit(typed('upublish it'))
  expect(system).toContain('keep them exactly as typed: upublish')
})

test('an older store with no word list still fixes', async ($, on) => {
  const sent = engine(on, answered('Please fix the bug.'), { enabled: true })
  await $.prompt.submit(typed('plese fix teh bug'))
  expect(sent).toEqual(['Please fix the bug.'])
})

test('protect keeps line breaks, case, punctuation and possessives', async () => {
  expect(protect('teh Upublish,\nrun it', 'The Unpublish,\nrun it', ['upublish'])).toBe('The Upublish,\nrun it')
  expect(protect("upublish's cli is broke", "unpublish's CLI is broken", ['upublish'])).toBe("upublish's CLI is broken")
  expect(protect('no kept word here', 'No kept word here.', ['upublish'])).toBe('No kept word here.')
  // A changed run of a different length reverts whole rather than guess.
  expect(protect('upublish teh site', 'un publish the site', ['upublish'])).toBe('upublish teh site')
  // Same length: only the kept word reverts.
  expect(protect('upublish teh site', 'un-publish the site', ['upublish'])).toBe('upublish the site')
})

test('/destoopify keep, words and forget manage the list', async ($, on) => {
  const store: Record<string, unknown> = {}
  engine(on, answered('x'), store)
  on('command.run', () => ({}))
  const run = (args: string) => $.command.run({ command: 'destoopify', args } as any)
  expect((await run('keep upublish Herdr,')).text).toBe('destoopify will leave upublish, herdr alone (2 kept)')
  expect(store.words).toEqual(['herdr', 'upublish'])
  expect((await run('words')).text).toBe('destoopify keeps: herdr, upublish')
  expect((await run('forget herdr')).text).toBe('destoopify forgot herdr (1 kept)')
  expect(store.words).toEqual(['upublish'])
  expect((await run('keep')).text).toContain('Usage:')
  expect(store.enabled).toBeUndefined()
})
