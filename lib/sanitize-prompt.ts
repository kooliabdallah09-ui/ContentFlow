// Sanitises user-provided text before it's stuffed into an AI system prompt.
// Not a silver bullet — but blocks the obvious jailbreak / prompt-injection
// patterns that show up in the wild. Apply to any field the user controls
// that reaches an LLM / image model: influencer bios, product descriptions,
// UGC scripts, campaign briefs, custom prompts.

const INJECTION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, label: 'ignore-previous' },
  { re: /disregard\s+(all\s+)?(previous|prior|above)/gi, label: 'disregard-previous' },
  { re: /forget\s+(everything|all\s+instructions)/gi, label: 'forget-all' },
  { re: /you\s+are\s+now\s+(a|an)\s+/gi, label: 'role-hijack' },
  { re: /act\s+as\s+(if\s+you\s+(are|were))?\s*(a|an)\s+/gi, label: 'act-as' },
  { re: /pretend\s+(you\s+are|to\s+be)/gi, label: 'pretend' },
  { re: /system\s*(prompt|message|instruction)s?\s*:/gi, label: 'system-prompt-header' },
  { re: /<\s*\/?\s*system\s*>/gi, label: 'system-tag' },
  { re: /\[\s*(system|assistant|user)\s*\]/gi, label: 'role-bracket' },
  { re: /###\s*(system|instruction|new instruction)/gi, label: 'markdown-role' },
  { re: /jailbreak/gi, label: 'jailbreak' },
  { re: /do\s+anything\s+now/gi, label: 'dan' },
  { re: /developer\s+mode/gi, label: 'developer-mode' },
]

const MAX_LEN = 4000

export interface SanitizeResult {
  clean: string
  flagged: string[]
  wasTruncated: boolean
}

export function sanitizeUserPrompt(input: string | null | undefined): SanitizeResult {
  const flagged: string[] = []
  let text = (input ?? '').toString()

  const wasTruncated = text.length > MAX_LEN
  if (wasTruncated) text = text.slice(0, MAX_LEN)

  for (const { re, label } of INJECTION_PATTERNS) {
    if (re.test(text)) {
      flagged.push(label)
      text = text.replace(re, '[removed]')
    }
  }

  // Collapse repeated whitespace and strip zero-width / bidi override chars
  // that some attacks use to hide instructions.
  text = text
    .replace(/[​-‍﻿‪-‮]/g, '')
    .replace(/\s{3,}/g, '  ')
    .trim()

  return { clean: text, flagged, wasTruncated }
}
