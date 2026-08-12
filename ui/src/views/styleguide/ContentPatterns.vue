<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ArticleCard from '@/components/content/ArticleCard.vue'
import MarkdownView from '@/components/content/MarkdownView.vue'
import PostMeta from '@/components/content/PostMeta.vue'
import { Card } from '@/components/ui/card'

const sample = `## Rendered markdown

Everything routes through **MarkdownView**: \`marked\` parses, \`DOMPurify\`
sanitizes, and \`.md-prose\` styles with theme tokens — switch the preset and
this repaints too.

- Lists, [links](https://example.com), and \`inline code\`
- Blockquotes and tables

> The prose styles live in \`src/assets/index.css\`.

\`\`\`ts
const html = DOMPurify.sanitize(marked.parse(source))
\`\`\`
`
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2">
    <div class="space-y-3">
      <h3 class="text-sm font-medium text-muted-foreground">
        MarkdownView — sanitized, token-themed prose
      </h3>
      <Card class="p-5">
        <MarkdownView :source="sample" />
      </Card>
    </div>

    <div class="space-y-3">
      <h3 class="text-sm font-medium text-muted-foreground">
        ArticleCard — wrap in a RouterLink for navigation
      </h3>
      <RouterLink to="/blog/touch-first-kanban" class="block">
        <ArticleCard
          title="Touch-first kanban drag & drop"
          excerpt="HTML5 drag events don't exist on phones. Pointer events, elementFromPoint, and one CSS property get you the rest of the way."
          date="Jul 24, 2026"
          :tags="['ui', 'mobile']"
          reading-time="2 min read"
        />
      </RouterLink>

      <h3 class="pt-3 text-sm font-medium text-muted-foreground">
        PostMeta — byline for article headers
      </h3>
      <Card class="p-5">
        <PostMeta author="Jade Fisher" date="Jul 24, 2026" reading-time="2 min read" />
      </Card>
    </div>
  </div>
</template>
