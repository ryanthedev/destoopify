# destoopify

A Claude Code mod that fixes the spelling and grammar in your prompt before Claude reads it.

When you press Enter, destoopify sends what you typed to Haiku with one instruction: fix typos, spelling, grammar and punctuation, and change nothing else. Your wording, tone and casualness stay. Code in backticks, file paths, URLs, flags and slash commands are left alone. Claude then reads the fixed text.

## What you see

- A status line under the prompt: `✎ destoopify: on`, `checking…`, `no typos`, or `fixed 2 — teh → the, plese → please`.

## When it stays out of the way

- Slash commands, `!` shell lines, and prompts you didn't type (background notifications, scheduled tasks).
- Prompts under 4 or over 4,000 characters (long ones are usually pasted logs or code).
- Any failure: if Haiku errors, takes over 8 seconds, or returns something that looks like an answer instead of a fix, your original text goes through untouched.

Each fix is one small Haiku call billed to your Claude account, usually about a second.

## Turn it off or on

Type `/destoopify`. The setting is remembered across sessions.

## Keep words it must never change

If destoopify "fixes" a word you meant, such as a tool name (`upublish` becoming `unpublish`), keep it:

```
/destoopify keep upublish
```

- `/destoopify keep <word>…` adds words, `/destoopify forget <word>…` removes them, `/destoopify words` lists them.
- Kept words match without regard to case or surrounding punctuation, so `Upublish's,` counts.
- Haiku is told the list, and destoopify also checks the reply: any kept word Haiku changed is put back as you typed it, while its other fixes still land.
- The list lives with your Claude Code settings on this computer; it does not follow you to other machines.

## Install

At the prompt of a Claude Code session:

```
/plugin install destoopify --marketplace ryanthedev/destoopify
```

From a shell:

```
claude plugin install destoopify --marketplace ryanthedev/destoopify
```

It is also listed in the `rtd` marketplace (`ryanthedev/rtd-claude-inn`) as `destoopify@rtd`.
