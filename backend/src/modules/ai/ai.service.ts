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
