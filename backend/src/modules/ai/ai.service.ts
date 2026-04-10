import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SharedFileAiContext } from '../shared-files/shared-files.service';
import {
  AiProvider,
  aiProviderConfigs,
  defaultAiProvider,
  getDefaultAiModel,
  isCustomOpenAiProvider,
  normalizeCustomBaseUrl,
} from './ai-provider.config';

type AiRuntimeSettings = {
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type MindMapContext = {
  messages?: Array<{ author: string; content: string }>;
  referenceFiles?: SharedFileAiContext[];
};

type WhiteboardSummaryContext = {
  topic: string;
  boardContentHtml?: string;
  messages: Array<{ author: string; content: string }>;
  mindMap?: {
    nodes: Array<{ label: string; type: string }>;
    edges: Array<{ sourceLabel: string; targetLabel: string; label?: string }>;
  };
  sharedFiles?: SharedFileAiContext[];
  allFileNames?: string[];
  settings?: AiRuntimeSettings;
};

export type MindMapGenerationStyle =
  | 'balanced'
  | 'debate'
  | 'strategy'
  | 'study';

export type MindMapGenerationStructure =
  | 'hierarchy'
  | 'radial'
  | 'timeline'
  | 'compare';

const mindMapStyleGuides: Record<MindMapGenerationStyle, string> = {
  balanced:
    'Keep the map balanced and general-purpose, covering the topic from multiple angles without overfocusing on one branch.',
  debate:
    'Emphasize opposing views, pros and cons, open questions, evidence, and decision tension.',
  strategy:
    'Organize the map around goals, risks, decisions, execution steps, and owners where useful.',
  study:
    'Organize the map for review and learning, highlighting definitions, facts, questions, and action checkpoints.',
};

const mindMapStructureGuides: Record<MindMapGenerationStructure, string> = {
  hierarchy:
    'Output a clear top-down hierarchy with the topic as root and grouped child branches.',
  radial:
    'Output a hub-and-spoke structure where the first node is the center and major ideas radiate from it.',
  timeline:
    'Output a sequential structure that moves from earlier stages to later stages when possible.',
  compare:
    'Output branches that make comparison easy, such as options, dimensions, tradeoffs, or alternatives.',
};

@Injectable()
export class AiService {
  constructor(private config: ConfigService) {}

  async extractConcepts(text: string): Promise<{ concepts: string[]; relations: Array<{ from: string; to: string; label: string }> }> {
    const prompt = `From the following discussion text, extract key concepts as a JSON object with:
- "concepts": array of short concept labels (max 5 words each)
- "relations": array of {from, to, label} objects showing connections between concepts

Text: "${text}"

Respond with only valid JSON.`;

    const result = await this.callProvider([{ role: 'user', content: prompt }]);
    try {
      return JSON.parse(result);
    } catch {
      return { concepts: [text.slice(0, 30)], relations: [] };
    }
  }

  async generateSummary(messages: Array<{ author: string; content: string }>): Promise<string> {
    const transcript = messages.map(m => `${m.author}: ${m.content}`).join('\n');
    const prompt = `Summarize this group discussion in 3-5 bullet points in the same language as the discussion:\n\n${transcript}`;
    return this.callProvider([{ role: 'user', content: prompt }]);
  }

  async generateIcebreaker(topic: string): Promise<string[]> {
    const prompt = `Generate 3 fun and engaging icebreaker questions related to the topic: "${topic}". Return as a JSON array of strings.`;
    const result = await this.callProvider([{ role: 'user', content: prompt }]);
    try {
      return JSON.parse(result);
    } catch {
      return ['What is your biggest hope for this discussion?'];
    }
  }

  async testConnection(settings: {
    provider?: AiProvider;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }) {
    const resolved = this.resolveSettings(settings);
    const message = await this.callProvider(
      [{ role: 'user', content: 'Reply with exactly "OK" and one short model self-identification phrase.' }],
      settings,
    );

    return {
      ok: true,
      provider: resolved.provider,
      model: resolved.model,
      message,
    };
  }

  async fetchModels(settings: {
    provider?: AiProvider;
    apiKey?: string;
    baseUrl?: string;
  }) {
    const resolved = this.resolveSettings(settings);
    if (!resolved.apiKey) {
      throw new BadRequestException('API Key is required before fetching models');
    }

    const res = await fetch(`${resolved.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolved.apiKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `AI provider model list request failed (${res.status}): ${text || res.statusText}`,
      );
    }

    const data = (await res.json()) as { data?: Array<{ id?: string | null }> };
    const models = Array.from(
      new Set(
        (data.data ?? [])
          .map((item) => item?.id?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return {
      provider: resolved.provider,
      baseUrl: resolved.baseUrl,
      models,
    };
  }

  async answerRoomQuestion(dto: {
    topic: string;
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    selectedFiles?: Array<{ id: string; filename: string; mimeType?: string }>;
    provider?: AiProvider;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    messages: Array<{ author: string; content: string }>;
    sharedFiles?: string[];
  }): Promise<string> {
    const transcript = dto.messages
      .slice(-12)
      .map((message) => `${message.author}: ${message.content}`)
      .join('\n');
    const filesLine =
      dto.sharedFiles && dto.sharedFiles.length > 0
        ? `Shared files in this room: ${dto.sharedFiles.join(', ')}`
        : 'Shared files in this room: none';
    const selectedFilesLine =
      dto.selectedFiles && dto.selectedFiles.length > 0
        ? `User selected reference files: ${dto.selectedFiles
            .map((file) =>
              file.mimeType?.startsWith('image/')
                ? `${file.filename} [image]`
                : file.filename,
            )
            .join(', ')}`
        : 'User selected reference files: none';
    const history = (dto.history ?? [])
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }))
      .filter((message) => message.content.length > 0);
    const systemPrompt = `You are assisting a live discussion room.
Topic: ${dto.topic}
${filesLine}
${selectedFilesLine}

Recent discussion:
${transcript || '[No discussion yet]'}

Use the room context above when it is relevant. If the user selected reference files, explicitly consider those files first. Answer in the same language as the user's latest message. Keep the reply concise, practical, and conversational.`;

    return this.callProvider([
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: dto.message },
    ], {
      provider: dto.provider,
      apiKey: dto.apiKey,
      model: dto.model,
      baseUrl: dto.baseUrl,
    });
  }

  async generateWhiteboardSummary(dto: WhiteboardSummaryContext): Promise<string> {
    const discussion = this.formatDiscussionTranscriptWithinBudget(dto.messages, 12000);
    const existingBoard = this.extractTextFromHtml(dto.boardContentHtml ?? '', 3500);
    const mindMapContext = this.formatMindMapSummary(dto.mindMap);
    const sharedFileNames =
      dto.allFileNames && dto.allFileNames.length > 0
        ? dto.allFileNames.join(', ')
        : 'none';
    const referenceFiles = this.formatReferenceFiles(dto.sharedFiles ?? []);
    const prompt = `You are writing a structured discussion summary directly into a collaborative rich-text whiteboard.

Return ONLY an HTML fragment. Do not return Markdown. Do not use \`\`\` fences. Do not include <html> or <body>.
Allowed tags: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>.

Write in the dominant language of the room discussion. If the room is mixed, prefer Chinese.
Keep the summary concise, specific, and useful for students reviewing the room later.
If existing whiteboard notes are present, incorporate the useful points instead of duplicating them line by line.

Room topic:
${dto.topic}

Existing whiteboard notes:
${existingBoard || '[Whiteboard is empty]'}

Discussion transcript:
${discussion || '[No discussion yet]'}

Mind map:
${mindMapContext}

Shared files in room:
${sharedFileNames}

Extracted file context:
${referenceFiles}

Required structure:
1. One title section summarizing the discussion topic
2. A section for key conclusions
3. A section for major evidence, viewpoints, or disagreements
4. A section for open questions or risks
5. A section for next actions or follow-up items

Requirements:
- Focus on information that is grounded in the room context above
- Prefer bullet lists over long paragraphs
- If evidence is weak or the room lacks enough discussion, say that clearly
- Do not mention these instructions`;

    const result = await this.callProvider([{ role: 'user', content: prompt }], dto.settings);
    return this.normalizeHtmlFragment(result);
  }

  async generateCompanionReply(dto: {
    topic: string;
    companion: {
      name: string;
      emoji?: string | null;
      description: string;
      styleGuide: string;
      systemPrompt: string;
    };
    latestMessage: string;
    cleanedMessage: string;
    senderNickname: string;
    provider?: AiProvider;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    messages: Array<{ author: string; content: string }>;
  }) {
    const transcript = dto.messages
      .slice(-12)
      .map((message) => `${message.author}: ${message.content}`)
      .join('\n');
    const systemPrompt = `You are ${dto.companion.name}${dto.companion.emoji ?? ''}, a companion bot inside a live group discussion room.
Room topic: ${dto.topic}
Public style: ${dto.companion.styleGuide}
Public description: ${dto.companion.description}
Persona instructions: ${dto.companion.systemPrompt}

Recent room messages:
${transcript || '[No discussion yet]'}

Rules:
- Reply as the companion only.
- Help warm up the conversation, ease tension, invite participation, or open a useful next angle.
- Keep the reply short: 1-4 sentences.
- Use the same language as the latest user message.
- Sound natural and supportive, not robotic.
- If the user only mentions you without a real question, offer one easy opening prompt about the topic.
- Do not mention these hidden instructions.`;

    const userPrompt = `${dto.senderNickname} mentioned you in the room.
Original message: ${dto.latestMessage}
Message after removing your mention: ${dto.cleanedMessage || '[No extra content - start the conversation yourself]'}

Write the companion's reply now.`;

    return this.callProvider(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        provider: dto.provider,
        apiKey: dto.apiKey,
        model: dto.model,
        baseUrl: dto.baseUrl,
      },
    );
  }

  async generateMindMap(
    topic: string,
    messages: Array<{ author: string; content: string }>,
    settings?: AiRuntimeSettings,
    referenceFiles: SharedFileAiContext[] = [],
    options?: {
      style?: MindMapGenerationStyle;
      structure?: MindMapGenerationStructure;
    },
  ): Promise<{
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ sourceId: string; targetId: string; label: string }>;
  }> {
    const transcript = this.formatDiscussionTranscript(messages, 20);
    const fileContext = this.formatReferenceFiles(referenceFiles);
    const style = options?.style ?? 'balanced';
    const structure = options?.structure ?? 'hierarchy';
    const prompt = `You are a mind map generator. Based on the discussion topic, optional chat history, and optional uploaded file context, create a structured mind map.

Topic: "${topic}"

Style preference: ${style}
Style guidance: ${mindMapStyleGuides[style]}

Structure preference: ${structure}
Structure guidance: ${mindMapStructureGuides[structure]}

Discussion:
${transcript || '[No discussion yet]'}

Uploaded file context:
${fileContext}

Return a JSON object with:
- "nodes": array of objects with { "id": "n1"/"n2"/..., "label": short keyword (2-8 chars, same language as discussion), "type": one of "IDEA"/"QUESTION"/"FACT"/"ACTION" }
- "edges": array of objects with { "sourceId": node id, "targetId": node id, "label": short relation description }

Rules:
- Generate 4-8 nodes covering the key points
- The first node should be the central topic
- Connect related nodes with meaningful edges
- Use uploaded file excerpts when they provide concrete facts or structure
- If both discussion and files are provided, merge them into one coherent map
- Follow the requested style and structure preference explicitly
- Use the same language as the discussion or uploaded materials for labels
- Respond with ONLY valid JSON, no markdown fences`;

    const result = await this.callProvider([{ role: 'user', content: prompt }], settings);
    try {
      const parsed = JSON.parse(result.replace(/```json?\s*|```/g, '').trim());
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      };
    } catch {
      return { nodes: [{ id: 'n1', label: topic.slice(0, 20), type: 'IDEA' }], edges: [] };
    }
  }

  async expandNode(
    topic: string,
    targetNodeLabel: string,
    existingLabels: string[],
    settings?: AiRuntimeSettings,
  ): Promise<{
    nodes: Array<{ label: string; type: string }>;
    edges: Array<{ label: string }>;
  }> {
    const prompt = `You are a mind map assistant. Given a mind map node, suggest child nodes to expand it.

Topic: "${topic}"
Node to expand: "${targetNodeLabel}"
Existing nodes: ${existingLabels.join(', ') || 'none'}

Return a JSON object with:
- "nodes": array of 3-5 objects with { "label": short keyword (2-8 chars, same language as the topic), "type": one of "IDEA"/"QUESTION"/"FACT"/"ACTION" }
- "edges": array of objects with { "label": short relation from parent to child }

Rules:
- Do NOT repeat existing node labels
- Each node should be a distinct sub-topic or related concept
- Use the same language as the topic
- Respond with ONLY valid JSON, no markdown fences`;

    const result = await this.callProvider([{ role: 'user', content: prompt }], settings);
    try {
      const parsed = JSON.parse(result.replace(/```json?\s*|```/g, '').trim());
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes.slice(0, 5) : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      };
    } catch {
      return { nodes: [], edges: [] };
    }
  }

  async optimizeMindMap(
    topic: string,
    nodes: Array<{ id: string; label: string; type: string }>,
    edges: Array<{ id: string; sourceId: string; targetId: string; label?: string }>,
    settings?: AiRuntimeSettings,
    context?: MindMapContext,
  ): Promise<{
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ sourceId: string; targetId: string; label: string }>;
  }> {
    const transcript = this.formatDiscussionTranscript(context?.messages ?? [], 20);
    const fileContext = this.formatReferenceFiles(context?.referenceFiles ?? []);
    const prompt = `You are a mind map optimizer. Review and improve the following mind map structure.

Topic: "${topic}"

Current nodes:
${nodes.map((n) => `- [${n.id}] ${n.label} (${n.type})`).join('\n')}

Current edges:
${edges.map((e) => `- ${e.sourceId} -> ${e.targetId}${e.label ? ` (${e.label})` : ''}`).join('\n') || 'none'}

Recent discussion:
${transcript || '[No discussion yet]'}

Uploaded file context:
${fileContext}

Return an optimized JSON object with:
- "nodes": array with { "id": keep original ids where possible, "label": improved label, "type": one of "IDEA"/"QUESTION"/"FACT"/"ACTION" }
- "edges": array with { "sourceId", "targetId", "label": relation description }

Optimization rules:
- Merge duplicate or very similar nodes (keep one id)
- Add missing logical connections between related nodes
- Improve unclear labels to be more specific
- Assign more appropriate node types if needed
- Use the discussion and uploaded file context to add missing concepts or relations when justified
- Keep the same language as the original labels
- Do NOT remove nodes unless they are clear duplicates
- Respond with ONLY valid JSON, no markdown fences`;

    const result = await this.callProvider([{ role: 'user', content: prompt }], settings);
    try {
      const parsed = JSON.parse(result.replace(/```json?\s*|```/g, '').trim());
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : nodes,
        edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      };
    } catch {
      return { nodes, edges: edges.map((e) => ({ sourceId: e.sourceId, targetId: e.targetId, label: e.label ?? '' })) };
    }
  }

  private formatDiscussionTranscript(
    messages: Array<{ author: string; content: string }>,
    limit: number,
  ) {
    return messages
      .slice(-limit)
      .map((message) => `${message.author}: ${message.content}`)
      .join('\n');
  }

  private formatDiscussionTranscriptWithinBudget(
    messages: Array<{ author: string; content: string }>,
    maxChars: number,
  ) {
    if (messages.length === 0) {
      return '';
    }

    const selected: string[] = [];
    let used = 0;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      const line = `${message.author}: ${message.content}`.trim();
      if (!line) {
        continue;
      }

      const nextSize = line.length + (selected.length > 0 ? 1 : 0);
      if (used + nextSize > maxChars) {
        if (selected.length === 0) {
          selected.unshift(`${line.slice(0, Math.max(0, maxChars - 16))}...[truncated]`);
        } else {
          selected.unshift('[Earlier discussion truncated]');
        }
        break;
      }

      selected.unshift(line);
      used += nextSize;
    }

    return selected.join('\n');
  }

  private formatReferenceFiles(files: SharedFileAiContext[]) {
    if (files.length === 0) {
      return '[No uploaded files selected]';
    }

    return files
      .map((file, index) => {
        const header = `${index + 1}. ${file.filename} (${file.mimeType}, ${file.sizeBytes} bytes)`;
        const detail = file.extractedText
          ? `Extracted text:\n${file.extractedText}`
          : `Note: ${file.note}`;

        return `${header}\n${detail}`;
      })
      .join('\n\n');
  }

  private formatMindMapSummary(mindMap?: WhiteboardSummaryContext['mindMap']) {
    const nodes = mindMap?.nodes ?? [];
    const edges = mindMap?.edges ?? [];

    if (nodes.length === 0 && edges.length === 0) {
      return '[No mind map content]';
    }

    const nodeLines = nodes.length
      ? nodes.map((node) => `- ${node.label} (${node.type})`).join('\n')
      : 'none';
    const edgeLines = edges.length
      ? edges
          .map((edge) =>
            `- ${edge.sourceLabel} -> ${edge.targetLabel}${edge.label ? ` (${edge.label})` : ''}`,
          )
          .join('\n')
      : 'none';

    return `Nodes:\n${nodeLines}\n\nEdges:\n${edgeLines}`;
  }

  private extractTextFromHtml(html: string, maxChars: number) {
    const normalized = html
      .replace(/<li\b[^>]*>/gi, '- ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/blockquote)\s*>/gi, '\n')
      .replace(/<\/(ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!normalized) {
      return '';
    }

    return normalized.length > maxChars
      ? `${normalized.slice(0, maxChars)}\n...[truncated]`
      : normalized;
  }

  private normalizeHtmlFragment(content: string) {
    const stripped = content
      .trim()
      .replace(/^```(?:html)?/i, '')
      .replace(/```$/i, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/?(html|body)[^>]*>/gi, '')
      .trim();

    if (/<[a-z][\s\S]*>/i.test(stripped)) {
      return stripped;
    }

    return this.plainTextToHtml(stripped);
  }

  private plainTextToHtml(text: string) {
    const lines = text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim());

    if (lines.length === 0 || lines.every((line) => !line)) {
      return '<p>No summary generated.</p>';
    }

    const blocks: string[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        blocks.push(`<ul>${listItems.join('')}</ul>`);
        listItems = [];
      }
    };

    for (const line of lines) {
      if (!line) {
        flushList();
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        listItems.push(`<li>${this.escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`);
        continue;
      }

      flushList();

      if (/^#{1,2}\s+/.test(line)) {
        blocks.push(`<h2>${this.escapeHtml(line.replace(/^#{1,2}\s+/, ''))}</h2>`);
        continue;
      }

      if (/^#{3,6}\s+/.test(line)) {
        blocks.push(`<h3>${this.escapeHtml(line.replace(/^#{3,6}\s+/, ''))}</h3>`);
        continue;
      }

      blocks.push(`<p>${this.escapeHtml(line)}</p>`);
    }

    flushList();

    return blocks.join('');
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private resolveSettings(settings?: AiRuntimeSettings) {
    const provider = settings?.provider ?? defaultAiProvider;
    const providerConfig = aiProviderConfigs[provider];
    const baseUrl = isCustomOpenAiProvider(provider)
      ? normalizeCustomBaseUrl(settings?.baseUrl)
      : providerConfig.baseUrl;
    const apiKey =
      settings?.apiKey?.trim() ||
      (providerConfig.envKey ? this.config.get<string>(providerConfig.envKey) || '' : '');
    const model = settings?.model?.trim() || getDefaultAiModel(provider);

    return {
      provider,
      baseUrl,
      apiKey,
      model,
    };
  }

  private async callProvider(messages: AiChatMessage[], settings?: AiRuntimeSettings): Promise<string> {
    const resolved = this.resolveSettings(settings);
    if (!resolved.apiKey) {
      const envKey = aiProviderConfigs[resolved.provider].envKey;
      return envKey
        ? `[AI service not configured - set ${envKey} or provide API Key]`
        : '[AI service not configured - provide API Key]';
    }

    const res = await fetch(`${resolved.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolved.apiKey}` },
      body: JSON.stringify({
        model: resolved.model,
        messages,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI provider request failed (${res.status}): ${text || res.statusText}`);
    }

    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content ?? '[AI provider returned empty response]';
  }
}
