/**
 * Servicio de redacción de informes con IA — 100% local (llama.cpp embebido).
 *
 * No hay inferencia remota ni economía de tokens: el LLM activo en
 * `Ajustes → Modelos IA → Asistente local` solo pule la redacción del
 * comentario clínico que ya produjo la guía. Si no hay LLM activo, el texto
 * se devuelve sin tocar.
 */

import { llmActiveId, llmGenerate } from '@/lib/ai/llm-client';

interface ProcessConclusionResult {
  processed_data: any;
  ai_processed: boolean;
  message?: string;
}

function buildSystemPrompt(language: string): string {
  if (language.startsWith('en')) {
    return (
      'You are an ophthalmology assistant that polishes draft clinical reports for diabetic ' +
      'retinopathy screening. Improve grammar and clarity without inventing findings, without ' +
      'adding clinical claims that are not in the input, and without changing severity grades. ' +
      'Return only the rewritten paragraph in the same language as the input.'
    );
  }
  return (
    'Eres un asistente de oftalmología que pule borradores de informes clínicos de tamizaje de ' +
    'retinopatía diabética. Mejora la gramática y la claridad sin inventar hallazgos, sin ' +
    'añadir afirmaciones clínicas que no estén en el texto y sin cambiar los grados de severidad. ' +
    'Devuelve únicamente el párrafo reescrito en el mismo idioma del texto original.'
  );
}

/**
 * Procesa una conclusión con el LLM local activo. Si no hay LLM cargado,
 * devuelve el dato sin tocar marcado `ai_processed: false`.
 *
 * La forma de `reportData` y `processed_data` se preserva: el LLM recibe el
 * texto plano de la conclusión y devuelve la versión pulida en el mismo
 * campo. Los demás campos pasan sin modificar.
 */
export async function processConclusion(
  reportData: any,
  language: string,
): Promise<ProcessConclusionResult> {
  const active = await llmActiveId();
  if (!active) {
    return {
      processed_data: reportData,
      ai_processed: false,
      message: 'No hay un modelo LLM local activo. Configúralo en Ajustes → Modelos IA.',
    };
  }

  const draft: string = typeof reportData === 'string'
    ? reportData
    : (reportData?.conclusion ?? reportData?.evaluator_notes ?? JSON.stringify(reportData));

  try {
    const polished = await llmGenerate({
      prompt: draft,
      system: buildSystemPrompt(language),
      max_tokens: 512,
      temperature: 0.4,
    });

    // Preservar shape: si entró objeto, devolvemos objeto con conclusion actualizada.
    const processed = typeof reportData === 'string'
      ? polished.trim()
      : { ...reportData, conclusion: polished.trim() };

    return {
      processed_data: processed,
      ai_processed: true,
      message: 'Procesado con LLM local.',
    };
  } catch (error) {
    console.error('Error en LLM local:', error);
    throw error;
  }
}
