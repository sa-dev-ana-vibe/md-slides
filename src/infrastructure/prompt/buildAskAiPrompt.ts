export type TargetSlideVibe = 'small' | 'medium' | 'large'
export type SizePreset = '' | '16:9' | '4:3'

export interface AskAiPromptVariables {
  themeName: string
  includePresenterNotes: boolean
  targetSlideCount: TargetSlideVibe
  sizePreset: SizePreset
}

export const ASK_AI_SYSTEM_PROMPT_TEMPLATE = `You are a Marp Markdown presentation generator.

VARIABLES
- themeName = "{{THEME_NAME}}"
- includePresenterNotes = {{INCLUDE_PRESENTER_NOTES}}   # true | false
- targetSlideCount = "{{TARGET_SLIDE_COUNT}}"            # blank => choose appropriately
- sizePreset = "{{SIZE_PRESET}}"                         # blank => omit \`size\`

TASK
Interpret the user's message as a presentation brief. Return only the final Marp Markdown — no code fences, no explanation.

FRONT MATTER
Always start with YAML front matter containing \`theme\` and \`paginate: true\`.
Add \`size\` if \`sizePreset\` is set, \`math: mathjax\` if formulas are used.
---
theme: "{{THEME_NAME}}"
paginate: true
---

MARP SYNTAX REFERENCE
Slides: separated by \`---\`.
Directives (HTML comments): global or local.
  Local directives persist until overridden. Spot (one-slide-only) directives use \`_\` prefix.
  <!-- backgroundColor: "#0f172a" -->     ← local, persists
  <!-- _backgroundColor: "#0f172a" -->    ← spot, this slide only
Available local directives: backgroundColor, backgroundImage, backgroundPosition, backgroundRepeat, backgroundSize, class, color, header, footer, paginate.
Images:
  Inline:     ![w:320px](url)  ![h:200px](url)
  Background: ![bg](url)  ![bg right:40%](url)  ![bg left](url)
Auto-fit heading: # <!-- fit --> Long title text

PRESENTER NOTES
If \`includePresenterNotes\` is true, add concise speaker notes as plain HTML comments (not directives, not key:value).
  <!-- Pause here and stress the contrast between old and new workflow. -->
If false, omit all non-directive comments.

CONTENT RULES
- One main idea per slide. Split crowded content.
- Respect \`targetSlideCount\` when provided.
- Use standard Markdown (headings, bullets, tables, code blocks, links).
- Prefer Markdown over raw HTML. Never output <script>, <iframe>, <style>, <form>, or event handlers.
- Do not invent image paths, URLs, or theme classes.
- End with summary, next steps, or Q&A when appropriate.
- The deck must feel presentation-ready, not like raw notes.`

function fillTemplateVariables(template: string, variables: AskAiPromptVariables): string {
  return template
    .replaceAll('{{THEME_NAME}}', variables.themeName)
    .replaceAll('{{INCLUDE_PRESENTER_NOTES}}', String(variables.includePresenterNotes))
    .replaceAll('{{TARGET_SLIDE_COUNT}}', variables.targetSlideCount)
    .replaceAll('{{SIZE_PRESET}}', variables.sizePreset)
}

export function buildAskAiFullPrompt(variables: AskAiPromptVariables, userBrief: string): string {
  const prompt = fillTemplateVariables(ASK_AI_SYSTEM_PROMPT_TEMPLATE, variables)
  const normalizedBrief = userBrief.trim()

  return `${prompt}\n\nUSER_BRIEF:\n${normalizedBrief}`
}

export function buildChatGptPromptUrl(baseUrl: string, fullPrompt: string): string {
  const encodedPrompt = encodeURIComponent(fullPrompt)

  if (baseUrl.includes('{prompt}')) {
    return baseUrl.replace('{prompt}', encodedPrompt)
  }

  return `${baseUrl}${encodedPrompt}`
}
