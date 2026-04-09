/**
 * useErrorHandler — Unified error handling composable
 *
 * Provides consistent error handling across the application:
 * - User-facing toast notifications
 * - Structured error logging
 * - Error boundary state for recovery
 *
 * Usage:
 *   const { handleError, handleErrorAsync, errorMessage } = useErrorHandler()
 *
 *   // Sync
 *   try { ... } catch (e) { handleError(e, 'Failed to load agents') }
 *
 *   // Async with auto-catch
 *   await handleErrorAsync(fetchAgents(), 'Failed to load agents')
 */

import { ref, readonly } from 'vue'
import { useMessage, type MessageApi } from 'naive-ui'

export interface ErrorContext {
  /** Human-readable title shown in the notification */
  title?: string
  /** Technical details logged to console (not shown to user) */
  technicalDetails?: unknown
  /** Whether to show a toast (default: true) */
  notify?: boolean
  /** Whether to log to console (default: true) */
  log?: boolean
}

export interface AppError {
  /** Machine-readable error code */
  code: string
  /** User-facing message */
  message: string
  /** Original error object */
  cause?: unknown
  /** Timestamp */
  timestamp: number
}

/** Extract a safe user message from any error type */
function extractMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message)
  }
  return fallback
}

/** Generate a machine-readable error code from context */
function deriveErrorCode(context: string): string {
  return context
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32)
}

// Shared error state — can be used by error boundary components
const lastError = ref<AppError | null>(null)

let _message: MessageApi | null = null
function getMessage(): MessageApi {
  if (!_message) {
    // naive-ui useMessage must be called within a component setup context.
    // Fallback: console only (SSR or outside Vue setup).
    try {
      _message = useMessage()
    } catch {
      // ignore
    }
  }
  return _message!
}

export function useErrorHandler() {
  const lastAppError = readonly(lastError)

  /**
   * Log an error with consistent formatting.
   * @param error - The error object
   * @param context - Where/why it occurred
   */
  function logError(error: unknown, context: string): void {
    const code = deriveErrorCode(context)
    const message = extractMessage(error, 'Unknown error')
    console.error(`[${code}] ${context}:`, error)
    lastError.value = { code, message, cause: error, timestamp: Date.now() }
  }

  /**
   * Handle a synchronous or pre-caught error.
   * @param error - The caught error
   * @param options - Context and behaviour options
   */
  function handleError(error: unknown, options: string | ErrorContext = {}): AppError {
    const ctx: ErrorContext = typeof options === 'string' ? { title: options } : options
    const context = ctx.title ?? 'Error'
    const message = extractMessage(error, context)

    if (ctx.log !== false) {
      logError(error, context)
    }

    if (ctx.notify !== false) {
      const msgApi = getMessage()
      if (msgApi) {
        msgApi.error(message, { duration: 5000 })
      }
    }

    return lastError.value ?? {
      code: deriveErrorCode(context),
      message,
      cause: error,
      timestamp: Date.now(),
    }
  }

  /**
   * Wrap an async operation and handle any thrown error automatically.
   * @param promise - The async operation
   * @param options - Context and behaviour options
   * @returns The result of the promise, or undefined if it threw
   */
  async function handleErrorAsync<T>(
    promise: Promise<T>,
    options: string | ErrorContext = {},
  ): Promise<T | undefined> {
    try {
      return await promise
    } catch (error) {
      handleError(error, options)
      return undefined
    }
  }

  /**
   * Create an error handler bound to a specific context (useful for event handlers).
   * @param context - Fixed context string prepended to all errors
   */
  function createContextHandler(context: string) {
    return {
      handle: (error: unknown, extra?: string) =>
        handleError(error, { title: extra ? `${context}: ${extra}` : context }),
      handleAsync: <T>(promise: Promise<T>, extra?: string) =>
        handleErrorAsync(promise, { title: extra ? `${context}: ${extra}` : context }),
    }
  }

  return {
    /** Last error recorded (readonly) */
    lastAppError,
    /** Log an error to console with structured formatting */
    logError,
    /** Handle a synchronous or pre-caught error with optional notification */
    handleError,
    /** Wrap an async operation, catching and handling any errors automatically */
    handleErrorAsync,
    /** Create a context-bound error handler (useful for Vue event handlers) */
    createContextHandler,
  }
}
